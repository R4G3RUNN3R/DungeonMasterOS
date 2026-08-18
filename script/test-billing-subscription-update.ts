import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import Stripe from "stripe";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-subscription-update-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

const webhookSecret = "whsec_billing_subscription_update_test";
const weeklyPriceId = "price_test_adventurer_weekly";
const monthlyPriceId = "price_test_adventurer_monthly";
const subscriptionId = "sub_test_adventurer_interval_change";

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-subscription-update-test";
process.env.STRIPE_SECRET_KEY = "sk_test_billing_subscription_update_test";
process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
process.env.STRIPE_PRICE_ADVENTURER_WEEKLY = weeklyPriceId;
process.env.STRIPE_PRICE_ADVENTURER_MONTHLY = monthlyPriceId;

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
  email: "billing-subscription-update-test@example.invalid",
  username: "billing_subscription_update_test",
  passwordHash: "not-a-real-password",
} as any);

storage.updateUser(user.id, {
  tier: "adventurer",
  subscriptionStatus: "active",
  stripeSubscriptionId: subscriptionId,
  stripePriceId: weeklyPriceId,
  stripeBillingInterval: "weekly",
} as any);

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const event = {
    id: "evt_billing_subscription_update_test",
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: subscriptionId,
        object: "subscription",
        status: "active",
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        items: {
          data: [{
            price: {
              id: monthlyPriceId,
              recurring: { interval: "month" },
            },
          }],
        },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "customer.subscription.updated",
  };

  const payload = JSON.stringify(event);
  const stripe = new Stripe("sk_test_billing_subscription_update_test");
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  const response = await fetch(`http://127.0.0.1:${address.port}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

  assert.equal(response.status, 200);

  const updated = storage.getUser(user.id);
  assert.ok(updated);
  assert.equal(updated.stripePriceId, monthlyPriceId);
  assert.equal(updated.stripeBillingInterval, "monthly");

  console.log("Billing subscription update regression tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
