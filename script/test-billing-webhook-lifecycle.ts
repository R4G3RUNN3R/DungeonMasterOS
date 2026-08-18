// Regression tests for three interrelated subscription-lifecycle bugs found
// by an independent adversarial review of the billing initiative, all
// centered on the customer.subscription.updated webhook handler and the
// Squire Pass active-subscription guard:
//
// 1. Portal cancellation reverted to "active": customer.subscription.updated
//    only read sub.status, never sub.cancel_at_period_end. When a user
//    cancels via the Stripe Billing Portal, Stripe fires this event with
//    status:"active" and cancel_at_period_end:true (the subscription is
//    still live through the paid period, just won't renew) — the old
//    handler wrote subscriptionStatus:"active", so a user who just
//    cancelled saw a green "Active" badge.
//
// 2. usageResetAt not re-anchored on interval change: the same handler
//    updated tier/stripeBillingInterval but left usageResetAt untouched, so
//    a weekly->monthly upgrade granted a free extra period (entitlement
//    jumps to 200 immediately, old weekly reset still fires days later,
//    resetting AGAIN a full month out) and a monthly->weekly downgrade
//    left the user stuck on the old low balance until the stale monthly
//    anchor happened to fire.
//
// 3. A cancelled-but-still-paid subscriber could buy a Squire Pass and lose
//    the remainder of their paid period: the guard on POST /api/stripe/squire
//    only blocked "active"/"past_due", not "cancelled" — but "cancelled"
//    (after fixing #1 above) means the subscription is still paid through
//    subscriptionCurrentPeriodEnd. Squire fulfillment unconditionally wipes
//    stripeSubscriptionId/stripePriceId/stripeBillingInterval/
//    subscriptionCurrentPeriodEnd, orphaning the still-live subscription.
//
// None of these webhook handlers call any Stripe API method themselves
// (unlike checkout.session.completed's subscription branch, which needs
// stripe.subscriptions.retrieve) — they read entirely from the signed event
// payload — so these tests make zero outbound network calls without needing
// the prototype-patching technique used elsewhere in this suite.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import Stripe from "stripe";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-webhook-lifecycle-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

const webhookSecret = "whsec_billing_webhook_lifecycle_test";

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-webhook-lifecycle-test";
process.env.STRIPE_SECRET_KEY = "sk_test_billing_webhook_lifecycle_test";
process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
delete process.env.STRIPE_PRICE_SQUIRE_PASS;

const { runMigrations, storage } = await import("../server/storage");
runMigrations();

const { signToken } = await import("../server/auth");
const { registerRoutes } = await import("../server/routes");

const app = express();
app.use(cookieParser());
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));
const server = createServer(app);
await registerRoutes(server, app);

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

const signingStripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function postWebhook(base: string, event: any) {
  const payload = JSON.stringify(event);
  const signature = signingStripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  return fetch(`${base}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  });
}

let fixtureCounter = 0;
function makeActiveMonthlySubscriber(base: string) {
  const unique = `${Date.now()}-${fixtureCounter++}`;
  const subscriptionId = `sub_lifecycle_${unique}`;
  const user = storage.createUser({
    email: `lifecycle-${unique}@test.com`,
    username: `lifecycle${unique}`,
    passwordHash: "x",
    tier: "adventurer",
    subscriptionStatus: "active",
    stripeSubscriptionId: subscriptionId,
    stripePriceId: "price_test_adventurer_monthly",
    stripeBillingInterval: "monthly",
    aiTurnsUsedThisMonth: 30,
    usageResetAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    subscriptionCurrentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
  } as any);
  return { user, subscriptionId, base };
}

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  // ── Test 1: portal cancellation must not be reverted back to "active" ──
  {
    const { user, subscriptionId } = makeActiveMonthlySubscriber(base);
    const periodEnd = Math.floor(Date.now() / 1000) + 20 * 24 * 60 * 60;

    const res = await postWebhook(base, {
      id: `evt_lifecycle_cancel_${user.id}`,
      object: "event",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: subscriptionId,
          object: "subscription",
          status: "active",
          cancel_at_period_end: true,
          current_period_end: periodEnd,
          items: { data: [{ price: { id: "price_test_adventurer_monthly", recurring: { interval: "month" } } }] },
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "customer.subscription.updated",
    });
    assert.equal(res.status, 200);

    const updated = storage.getUser(user.id);
    assert.equal(
      updated?.subscriptionStatus,
      "cancelled",
      `a portal cancellation (status:"active", cancel_at_period_end:true) must be stored as "cancelled", got "${updated?.subscriptionStatus}"`,
    );
  }

  // ── Test 2: an interval change must re-anchor usageResetAt, not just tier/interval ──
  {
    const { user, subscriptionId } = makeActiveMonthlySubscriber(base);
    const before = storage.getUser(user.id)!;
    assert.equal(before.stripeBillingInterval, "monthly");
    const staleResetAt = before.usageResetAt;

    const periodEnd = Math.floor(Date.now() / 1000) + 6 * 24 * 60 * 60;
    const res = await postWebhook(base, {
      id: `evt_lifecycle_interval_${user.id}`,
      object: "event",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: subscriptionId,
          object: "subscription",
          status: "active",
          cancel_at_period_end: false,
          current_period_end: periodEnd,
          items: { data: [{ price: { id: "price_test_adventurer_weekly", recurring: { interval: "week" } } }] },
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "customer.subscription.updated",
    });
    assert.equal(res.status, 200);

    const updated = storage.getUser(user.id);
    assert.equal(updated?.stripeBillingInterval, "weekly");
    assert.notEqual(
      updated?.usageResetAt,
      staleResetAt,
      "usageResetAt must be recomputed when the billing interval actually changes, not left at the old interval's stale anchor",
    );
    assert.equal(updated?.aiTurnsUsedThisMonth, 0, "usage must reset to 0 alongside the entitlement-changing interval switch");

    const resetAt = new Date(updated!.usageResetAt!).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    assert.ok(
      resetAt <= Date.now() + sevenDays + 5_000,
      `new usageResetAt must reflect the NEW weekly interval (~7 days out), got ${updated?.usageResetAt}`,
    );
  }

  // ── Test 3: a cancelled-but-still-paid subscriber cannot buy Squire and lose their remaining period ──
  {
    const unique = `${Date.now()}-${fixtureCounter++}`;
    const futurePeriodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const user = storage.createUser({
      email: `stillpaid-${unique}@test.com`,
      username: `stillpaid${unique}`,
      passwordHash: "x",
      tier: "master",
      subscriptionStatus: "cancelled",
      stripeSubscriptionId: `sub_stillpaid_${unique}`,
      stripePriceId: "price_test_master_monthly",
      stripeBillingInterval: "monthly",
      subscriptionCurrentPeriodEnd: futurePeriodEnd,
    } as any);
    const token = signToken(user.id);

    const res = await fetch(`${base}/api/stripe/squire`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `dmos_session=${token}` },
      body: JSON.stringify({}),
    });

    const body = await res.json() as any;
    assert.equal(res.status, 400, `a cancelled subscriber still paid through ${futurePeriodEnd} must be blocked from Squire, got ${res.status}: ${JSON.stringify(body)}`);
    assert.match(body.message ?? "", /already have|cancel your subscription/i);

    const afterUser = storage.getUser(user.id);
    assert.equal(afterUser?.stripeSubscriptionId, user.stripeSubscriptionId, "the still-live subscription link must not be touched by a rejected request");
  }

  // ── Test 4: a genuinely lapsed cancelled subscriber (period already ended) CAN buy Squire ──
  {
    const unique = `${Date.now()}-${fixtureCounter++}`;
    const pastPeriodEnd = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const user = storage.createUser({
      email: `lapsed-${unique}@test.com`,
      username: `lapsed${unique}`,
      passwordHash: "x",
      tier: "master",
      subscriptionStatus: "cancelled",
      stripeSubscriptionId: `sub_lapsed_${unique}`,
      stripePriceId: "price_test_master_monthly",
      stripeBillingInterval: "monthly",
      subscriptionCurrentPeriodEnd: pastPeriodEnd,
    } as any);
    const token = signToken(user.id);

    const res = await fetch(`${base}/api/stripe/squire`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `dmos_session=${token}` },
      body: JSON.stringify({}),
    });

    const body = await res.json() as any;
    // STRIPE_PRICE_SQUIRE_PASS is deliberately unset, so even a request
    // that correctly clears the active-subscription guard still hits the
    // "not configured" 400 one line later (matching this suite's
    // never-reach-a-real-Stripe-call convention) — assert on the message,
    // not the status code, to tell "blocked by the guard" apart from
    // "cleared the guard, stopped at not-configured".
    assert.doesNotMatch(
      body.message ?? "",
      /already have an active subscription/i,
      `a subscriber whose paid period already ended (${pastPeriodEnd}) must clear the active-subscription guard, got: ${JSON.stringify(body)}`,
    );
    assert.match(body.message ?? "", /not configured/i);
  }

  console.log("Billing webhook lifecycle regression tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
