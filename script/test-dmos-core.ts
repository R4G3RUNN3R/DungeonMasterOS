import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";

type TestResult = {
  name: string;
  run: () => Promise<void> | void;
};

function installMockWindow(pathname: string) {
  (globalThis as any).window = {
    location: {
      protocol: "https:",
      host: "nexis.nexus",
      pathname,
    },
  };
}

async function testApiRequestsUseMountedBasePath() {
  installMockWindow("/DMOS/#/dashboard");

  const { apiRequest } = await import("../client/src/lib/queryClient");
  let requestedUrl = "";
  const originalFetch = globalThis.fetch;

  (globalThis as any).fetch = async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await apiRequest("GET", "/api/auth/me");
  } finally {
    globalThis.fetch = originalFetch;
    delete (globalThis as any).window;
  }

  assert.equal(requestedUrl, "/DMOS/api/auth/me");
}

async function testWebSocketUsesMountedBasePath() {
  installMockWindow("/DMOS/#/campaign/1");

  let requestedUrl = "";
  const OriginalWebSocket = (globalThis as any).WebSocket;

  class MockWebSocket {
    static OPEN = 1;
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;

    constructor(url: string) {
      requestedUrl = url;
    }

    send() {}
    close() {}
  }

  (globalThis as any).WebSocket = MockWebSocket;

  try {
    const { gameWs } = await import("../client/src/lib/websocket");
    gameWs.connect(1);
    gameWs.disconnect();
  } finally {
    (globalThis as any).WebSocket = OriginalWebSocket;
    delete (globalThis as any).window;
  }

  assert.equal(requestedUrl, "wss://nexis.nexus/DMOS/ws");
}

async function testCampaignCurrenciesPersistAndSeedCharacterBalances() {
  const tempDir = mkdtempSync(path.join(tmpdir(), "dmos-core-"));
  const dbPath = path.join(tempDir, "test.db");

  process.env.DATABASE_URL = dbPath;
  process.env.JWT_SECRET = "test-secret";
  process.env.NODE_ENV = "test";
  process.env.APP_BASE_PATH = "/DMOS";
  process.env.APP_URL = "https://nexis.nexus/DMOS";
  process.env.GOOGLE_CLIENT_ID = "google-client.test";
  process.env.GOOGLE_CLIENT_SECRET = "google-secret.test";

  const { runMigrations } = await import("../server/storage");
  const { registerRoutes } = await import("../server/routes");

  const app = express();
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
  app.use(cookieParser());

  const server = createServer(app);
  runMigrations();
  await registerRoutes(server, app);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const prefixedAuthRes = await fetch(`${baseUrl}/DMOS/api/auth/me`);
    assert.equal(prefixedAuthRes.status, 401);

    const googleStartRes = await fetch(`${baseUrl}/DMOS/api/auth/google`, {
      redirect: "manual",
    });
    assert.equal(googleStartRes.status, 302);
    const googleLocation = googleStartRes.headers.get("location") || "";
    assert.match(googleLocation, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    assert.match(
      decodeURIComponent(googleLocation),
      /redirect_uri=https:\/\/nexis\.nexus\/DMOS\/api\/auth\/google\/callback/,
    );

    const googleStateCookie = googleStartRes.headers.get("set-cookie") || "";
    const stateCookieMatch = googleStateCookie.match(/dmos_google_oauth_state=([^;]+)/);
    assert(stateCookieMatch, "Google OAuth state cookie should be set");
    const googleState = decodeURIComponent(stateCookieMatch[1]);

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        const body = new URLSearchParams(String(init?.body || ""));
        assert.equal(body.get("client_id"), "google-client.test");
        assert.equal(body.get("client_secret"), "google-secret.test");
        assert.equal(body.get("redirect_uri"), "https://nexis.nexus/DMOS/api/auth/google/callback");
        assert.equal(body.get("grant_type"), "authorization_code");
        assert.equal(body.get("code"), "google-code");

        return new Response(JSON.stringify({ access_token: "google-access-token", id_token: "google-id-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "https://oauth2.googleapis.com/tokeninfo?id_token=google-id-token") {
        return new Response(JSON.stringify({
          aud: "google-client.test",
          sub: "google-sub-123",
          email: "google.player@example.com",
          email_verified: "true",
          name: "Google Player",
          picture: "https://example.com/avatar.png",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return originalFetch(input, init);
    };

    try {
      const googleCallbackRes = await fetch(
        `${baseUrl}/DMOS/api/auth/google/callback?code=google-code&state=${encodeURIComponent(googleState)}`,
        {
          redirect: "manual",
          headers: { Cookie: googleStateCookie },
        },
      );
      assert.equal(googleCallbackRes.status, 302);
      assert.equal(googleCallbackRes.headers.get("location"), "/DMOS/#/dashboard?google=1");
      const sessionCookie = googleCallbackRes.headers.get("set-cookie") || "";
      assert.match(sessionCookie, /dmos_session=/);
      const sessionCookieMatch = sessionCookie.match(/dmos_session=([^;]+)/);
      assert(sessionCookieMatch, "Google callback should set a DMOS session cookie");
      const browserCookie = `dmos_session=${sessionCookieMatch[1]}`;

      const googleMeRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: browserCookie },
      });
      assert.equal(googleMeRes.status, 200);
      const googleMe = await googleMeRes.json();
      assert.equal(googleMe.user.email, "google.player@example.com");
      assert.equal(googleMe.user.username, "google_player");

      const googleBillingRes = await fetch(`${baseUrl}/api/billing`, {
        headers: { Cookie: browserCookie },
      });
      assert.equal(googleBillingRes.status, 200);
      const googleBilling = await googleBillingRes.json();
      assert.equal(googleBilling.turnsIncluded, 10);
      assert.equal(googleBilling.turnBalance, 10);
      assert.equal(googleBilling.turnLedger[0].reason, "free_trial_grant");
      assert.equal(googleBilling.turnLedger[0].visibleDelta, 10);
      assert.equal(googleBilling.turnLedger[0].reserveDelta, 2);

    } finally {
      globalThis.fetch = originalFetch;
    }

    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "tester@example.com",
        username: "tester",
        password: "password123",
      }),
    });
    assert.equal(registerRes.status, 201);
    const cookie = registerRes.headers.get("set-cookie") || "";
    assert.match(cookie, /dmos_session=/);


    const billingRes = await fetch(`${baseUrl}/api/billing`, {
      headers: { Cookie: cookie },
    });
    assert.equal(billingRes.status, 200);
    const billing = await billingRes.json();
    assert.equal(billing.turnsIncluded, 10);
    assert.equal(billing.turnBalance, 10);
    assert.equal(billing.aiTurnsUsedThisMonth, 0);
    assert.equal(billing.bonusTurns, 0);
    assert.equal(billing.turnLedger[0].reason, "free_trial_grant");
    assert.equal(billing.turnLedger[0].visibleDelta, 10);
    assert.equal(billing.turnLedger[0].reserveDelta, 2);


    const campaignRes = await fetch(`${baseUrl}/api/campaigns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        name: "Currency Test",
        tone: "heroic",
        rulesWeight: "light",
        powerLevel: "standard",
        worldType: "custom",
        combatStyle: "cinematic",
        storyMode: true,
        worldGenStyle: "isekai",
        homebrewRules: "",
        customWorldPrompt: "A coastal kingdom.",
        epicMode: false,
        animeWorldSource: "",
        animeWorldMode: "none",
        currencies: [
          { code: "gold", name: "Gold", symbol: "gp", isPrimary: true, exchangeRate: 1 },
          { code: "silver", name: "Silver", symbol: "sp", isPrimary: false, exchangeRate: 10 },
        ],
      }),
    });
    assert.equal(campaignRes.status, 201);
    const campaign = await campaignRes.json();

    const currenciesRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/currencies`, {
      headers: { Cookie: cookie },
    });
    assert.equal(currenciesRes.status, 200);
    const currencies = await currenciesRes.json();
    assert.deepEqual(
      currencies.map((currency: any) => currency.code),
      ["gold", "silver"],
    );

    const characterRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        name: "Hennet",
        race: "Human",
        charClass: "Fighter",
        traits: "",
        backstory: "",
      }),
    });
    assert.equal(characterRes.status, 201);
    const character = await characterRes.json();

    const balancesRes = await fetch(`${baseUrl}/api/characters/${character.id}/currencies`, {
      headers: { Cookie: cookie },
    });
    assert.equal(balancesRes.status, 200);
    const balances = await balancesRes.json();
    assert.deepEqual(
      balances.map((balance: any) => [balance.currencyCode, balance.amount]),
      [
        ["gold", 0],
        ["silver", 0],
      ],
    );

    const adjustRes = await fetch(`${baseUrl}/api/characters/${character.id}/currencies/adjust`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ currencyCode: "gold", amount: 100 }),
    });
    assert.equal(adjustRes.status, 200);

    const createShopRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/shop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        merchantName: "Quartermaster Sel",
        merchantDescription: "A pragmatic trader with no patience for heroic haggling.",
        currencyCode: "gold",
        title: "Field Supplies",
        items: [
          {
            itemKey: "iron-ration",
            name: "Iron Ration",
            description: "A dense ration wrapped in waxed cloth.",
            itemType: "consumable",
            stock: 2,
            quantityPerPurchase: 1,
            priceAmount: 25,
            priceCurrencyCode: "gold",
          },
        ],
      }),
    });
    assert.equal(createShopRes.status, 201);

    const shopRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/shop`, {
      headers: { Cookie: cookie },
    });
    assert.equal(shopRes.status, 200);
    const shopPayload = await shopRes.json();
    assert.equal(shopPayload.shop.merchantName, "Quartermaster Sel");
    assert.equal(shopPayload.items[0].stock, 2);

    const buyRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/shop/buy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ shopItemId: shopPayload.items[0].id, quantity: 1 }),
    });
    assert.equal(buyRes.status, 200);

    const balancesAfterBuyRes = await fetch(`${baseUrl}/api/characters/${character.id}/currencies`, {
      headers: { Cookie: cookie },
    });
    const balancesAfterBuy = await balancesAfterBuyRes.json();
    assert.deepEqual(
      balancesAfterBuy.map((balance: any) => [balance.currencyCode, balance.amount]),
      [
        ["gold", 75],
        ["silver", 0],
      ],
    );

    const inventoryRes = await fetch(`${baseUrl}/api/characters/${character.id}/items`, {
      headers: { Cookie: cookie },
    });
    const inventory = await inventoryRes.json();
    assert.equal(inventory[0].name, "Iron Ration");

    const shopAfterBuyRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/shop`, {
      headers: { Cookie: cookie },
    });
    const shopAfterBuy = await shopAfterBuyRes.json();
    assert.equal(shopAfterBuy.items[0].stock, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    // The storage module keeps SQLite open for process lifetime, so Windows may
    // lock this temp dir until the test process exits.
  }
}

const tests: TestResult[] = [
  { name: "API requests honor the /DMOS mount path", run: testApiRequestsUseMountedBasePath },
  { name: "WebSockets honor the /DMOS mount path", run: testWebSocketUsesMountedBasePath },
  {
    name: "Campaign currencies persist and seed character balances",
    run: testCampaignCurrenciesPersistAndSeedCharacterBalances,
  },
];

for (const test of tests) {
  try {
    await test.run();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    console.error(`FAIL ${test.name}`);
    console.error(error);
    process.exitCode = 1;
    break;
  }
}
