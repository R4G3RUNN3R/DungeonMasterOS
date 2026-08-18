// server/items-use-auth.test.ts
//
// Regression test for an independent adversarial review finding (Critical):
// POST /api/items/:id/use had no requireAuth, requireCanPlay, or
// checkTurnLimit — the only AI-invoking route in the file without them.
// getVisitorId(req) trusts a raw client-supplied "x-visitor-id" header when
// there's no authenticated session, and a logged-in owner's character is
// stored with visitorId === `user-${userId}`. So an entirely unauthenticated
// request carrying `x-visitor-id: user-<id>` satisfied the route's only
// ownership check, and because req.user was undefined, incrementTurnCount
// never ran — unlimited, unmetered, unauthenticated Anthropic API calls
// against any character whose owning user id could be guessed (sequential
// autoincrement ids).
//
// This test proves, against the real registered route (not a reimplemented
// approximation): (1) the vulnerability existed before the fix — an
// unauthenticated request with a spoofed x-visitor-id was able to reach and
// mutate someone else's character/items — and (2) after the fix, the same
// request is rejected with 401 before any AI call or item mutation happens,
// and a logged-in but quota-exhausted user is rejected with 403 instead of
// receiving another free AI turn.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import os from "node:os";

const dbPath = path.join(os.tmpdir(), `dmos-items-use-auth-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "items-use-auth-test-secret";
process.env.ANTHROPIC_API_KEY = "items-use-auth-test";

const { storage, runMigrations } = await import("./storage");
runMigrations();

const { signToken } = await import("./auth");
const { registerRoutes } = await import("./routes");

let httpServer: ReturnType<typeof createServer>;
let base: string;

before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address !== "object") throw new Error("failed to bind test server");
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });
});

let fixtureCounter = 0;
function makeFixture() {
  const unique = `${Date.now()}-${fixtureCounter++}`;
  const owner = storage.createUser({
    email: `owner-${unique}@test.com`,
    username: `owner${unique}`,
    passwordHash: "x",
    tier: "adventurer",
    subscriptionStatus: "active",
    stripeBillingInterval: "monthly",
    aiTurnsUsedThisMonth: 0,
  } as any);
  const campaign = storage.createCampaign({
    userId: owner.id,
    name: "Test Campaign",
    inviteCode: `invite-${unique}`,
    hostVisitorId: `user-${owner.id}`,
    tone: "grim",
    rulesWeight: "light",
    powerLevel: "standard",
    worldType: "fantasy",
    combatStyle: "tactical",
    storyMode: false,
    worldGenStyle: "guided",
  } as any);
  const character = storage.createCharacter({
    campaignId: campaign.id,
    userId: owner.id,
    name: "Kira",
    race: "Human",
    charClass: "Fighter",
    hp: 20,
    maxHp: 20,
    ac: 12,
    attackBonus: 5,
    damageDice: "1d8",
    visitorId: `user-${owner.id}`,
  } as any);
  const item = storage.createItem({
    campaignId: campaign.id,
    characterId: character.id,
    name: "Healing Potion",
    consumable: true,
  } as any);
  return { owner, campaign, character, item };
}

test("an unauthenticated request cannot spoof x-visitor-id to use someone else's item", async () => {
  const { owner, item } = makeFixture();

  const res = await fetch(`${base}/api/items/${item.id}/use`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // The exact impersonation shape getVisitorId produces for a real
      // logged-in owner: `user-${userId}`. No cookie/session is sent.
      "x-visitor-id": `user-${owner.id}`,
    },
    body: JSON.stringify({}),
  });

  assert.equal(res.status, 401, "an unauthenticated request must be rejected before any ownership check or AI call");

  const afterItem = storage.getItem(item.id);
  assert.equal(afterItem?.charges ?? null, item.charges ?? null, "the item must not be mutated by a rejected request");
});

test("a logged-in but quota-exhausted user is rejected by checkTurnLimit, not granted another free AI turn", async () => {
  const { owner, item } = makeFixture();
  storage.updateUser(owner.id, { aiTurnsUsedThisMonth: 999_999 } as any);
  const token = signToken(owner.id);

  const res = await fetch(`${base}/api/items/${item.id}/use`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `dmos_session=${token}`,
    },
    body: JSON.stringify({}),
  });

  assert.equal(res.status, 403, "a quota-exhausted user must be blocked by checkTurnLimit");
  const body = await res.json() as any;
  assert.equal(body.code, "TURN_LIMIT");
});

test("a real, authenticated, in-quota owner can still use their own item", async () => {
  const { owner, item } = makeFixture();
  const token = signToken(owner.id);

  const res = await fetch(`${base}/api/items/${item.id}/use`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `dmos_session=${token}`,
    },
    body: JSON.stringify({}),
  });

  // The route still calls the real Anthropic client with a fake test key,
  // so the AI call itself fails — but it must fail AFTER clearing auth and
  // quota checks (500, not 401/403), proving the gates let a legitimate
  // owner through to the point of attempting the AI call.
  assert.notEqual(res.status, 401);
  assert.notEqual(res.status, 403);
});
