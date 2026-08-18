import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import Stripe from "stripe";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-webhook-reset-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

const webhookSecret = "whsec_billing_webhook_reset_test";
const weeklyPriceId = "price_test_adventurer_weekly";
const subscriptionId = "sub_test_adventurer_weekly";

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-webhook-reset-test";
process.env.STRIPE_SECRET_KEY = "sk_test_billing_webhook_reset_test";
process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
process.env.STRIPE_PRICE_ADVENTURER_WEEKLY = weeklyPriceId;

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
  email: "billing-webhook-reset-test@example.invalid",
  username: "billing_webhook_reset_test",
  passwordHash: "not-a-real-password",
} as any);

storage.updateUser(user.id, {
  tier: "adventurer",
  subscriptionStatus: "active",
  stripeSubscriptionId: subscriptionId,
  stripePriceId: weeklyPriceId,
  stripeBillingInterval: "weekly",
  aiTurnsUsedThisMonth: 42,
  usageResetAt: new Date(Date.now() + 60_000).toISOString(),
} as any);

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const event = {
    id: "evt_billing_weekly_reset_test",
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: "in_billing_weekly_reset_test",
        object: "invoice",
        subscription: subscriptionId,
        lines: { data: [{ price: { id: weeklyPriceId } }] },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "invoice.payment_succeeded",
  };

  const payload = JSON.stringify(event);
  const stripe = new Stripe("sk_test_billing_webhook_reset_test");
  const signature = stripe.webhooks.generateTestHeaderString({
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
  assert.equal(updated.aiTurnsUsedThisMonth, 0);
  assert.ok(updated.usageResetAt);

  const resetAt = new Date(updated.usageResetAt).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  assert.ok(
    resetAt >= before + sevenDays - 5_000 && resetAt <= after + sevenDays + 5_000,
    `Expected weekly reset about 7 days from now, got ${updated.usageResetAt}`,
  );

  const ledger = storage.getTurnLedgerByUser(user.id, 25);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].visibleDelta, 50);
  assert.equal(ledger[0].reason, "subscription_grant");

  console.log("Billing weekly webhook reset regression tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
