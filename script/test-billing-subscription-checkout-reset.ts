// Regression test for the original billing spec's "Item A": auditing
// checkout.session.completed's recurring-subscription branch (session.tier
// && session.subscription — as opposed to the top-up or Squire branches).
// It was found to update tier/subscriptionStatus/stripeSubscriptionId/
// stripePriceId/stripeBillingInterval/subscriptionCurrentPeriodEnd/
// aiTurnsUsedThisMonth, but never establish usageResetAt. Since a brand-new
// user's usageResetAt starts null (getNewUserBillingState) and attachUser's
// auto-reset block only fires when usageResetAt is truthy, a subscriber
// whose first invoice.payment_succeeded webhook is ever missed or delayed
// would have no reset scheduled at all — accumulating usage forever with
// nothing to bring it back to zero.
//
// This branch calls a genuine Stripe API method (stripe.subscriptions.retrieve)
// before doing anything else, which this suite's own convention (see
// test-billing-squire-checkout.ts) never allows to reach a real network
// call. Since routes.ts's Stripe client is a module-internal singleton with
// no dependency-injection seam, the only way to exercise the REAL webhook
// handler through the REAL HTTP endpoint without a live network call is to
// patch the retrieve method on the Stripe SDK's shared subscriptions
// resource prototype before importing server/routes — this affects every
// Stripe client instance created afterward in this process (verified
// experimentally: a prototype patch made via one throwaway Stripe instance
// is visible on a subscriptions.retrieve call made through a completely
// different instance), including the one routes.ts constructs internally.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import Stripe from "stripe";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-subscription-checkout-reset-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

const webhookSecret = "whsec_billing_subscription_checkout_reset_test";
const weeklyPriceId = "price_test_adventurer_weekly";
const subscriptionId = "sub_test_billing_subscription_checkout_reset";
const checkoutSessionId = "cs_test_billing_subscription_checkout_reset";

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-subscription-checkout-reset-test";
process.env.STRIPE_SECRET_KEY = "sk_test_billing_subscription_checkout_reset_test";
process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
process.env.STRIPE_PRICE_ADVENTURER_WEEKLY = weeklyPriceId;

// Patch stripe.subscriptions.retrieve process-wide, BEFORE server/routes is
// imported (and so before its internal Stripe client is constructed), to
// return a fixed, deterministic subscription shape without any network call.
const probeStripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const subscriptionsProto = Object.getPrototypeOf(probeStripe.subscriptions);
const fakeCurrentPeriodEnd = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
subscriptionsProto.retrieve = async (id: string) => ({
  id,
  current_period_end: fakeCurrentPeriodEnd,
  items: { data: [{ price: { id: weeklyPriceId } }] },
});

const { runMigrations, storage } = await import("../server/storage");
runMigrations();

const { registerRoutes } = await import("../server/routes");
const app = express();
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));
const server = createServer(app);
await registerRoutes(server, app);

const user = storage.createUser({
  email: "billing-subscription-checkout-reset-test@example.invalid",
  username: "billing_subscription_checkout_reset_test",
  passwordHash: "not-a-real-password",
} as any);

// Brand-new user: exactly the getNewUserBillingState() shape, usageResetAt
// starts null — this is the actual pre-checkout state a real new subscriber
// would be in.
const before_ = storage.getUser(user.id);
assert.equal(before_?.usageResetAt, null, "precondition: new user must start with usageResetAt null");

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const event = {
    id: "evt_billing_subscription_checkout_reset_test",
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: checkoutSessionId,
        object: "checkout.session",
        mode: "subscription",
        customer: "cus_billing_subscription_checkout_reset_test",
        subscription: subscriptionId,
        invoice: "in_billing_subscription_checkout_reset_test",
        metadata: {
          userId: String(user.id),
          tier: "adventurer",
          interval: "weekly",
        },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "checkout.session.completed",
  };

  const payload = JSON.stringify(event);
  const signingStripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const signature = signingStripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  const before = Date.now();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
  const after = Date.now();

  assert.equal(response.status, 200);

  const updated = storage.getUser(user.id);
  assert.ok(updated);
  assert.equal(updated.tier, "adventurer");
  assert.equal(updated.subscriptionStatus, "active");
  assert.equal(updated.stripeSubscriptionId, subscriptionId);
  assert.equal(updated.stripeBillingInterval, "weekly");
  assert.equal(updated.aiTurnsUsedThisMonth, 0);

  // The actual regression this test exists for: usageResetAt must be
  // established at initial checkout, not left null pending some later event.
  assert.ok(updated.usageResetAt, "usageResetAt must be set on initial subscription checkout, not left null");

  const resetAt = new Date(updated.usageResetAt).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  assert.ok(
    resetAt >= before + sevenDays - 5_000 && resetAt <= after + sevenDays + 5_000,
    `Expected a weekly Adventurer's initial reset to be about 7 days out, got ${updated.usageResetAt}`,
  );

  console.log("Billing subscription checkout reset regression tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
