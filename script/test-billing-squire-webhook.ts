import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import Stripe from "stripe";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-squire-webhook-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

const webhookSecret = "whsec_billing_squire_webhook_test";

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-squire-webhook-test";
process.env.STRIPE_SECRET_KEY = "sk_test_billing_squire_webhook_test";
process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

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
  email: "billing-squire-webhook-test@example.invalid",
  username: "billing_squire_webhook_test",
  passwordHash: "not-a-real-password",
  tier: "free",
  subscriptionStatus: "expired",
  trialEndsAt: null,
  usageResetAt: null,
  aiTurnsUsedThisMonth: 0,
  bonusTurns: 0,
} as any);

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const event = {
    id: "evt_billing_squire_webhook_test",
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: "cs_test_billing_squire_pass",
        object: "checkout.session",
        mode: "payment",
        customer: "cus_test_billing_squire_pass",
        payment_status: "paid",
        subscription: null,
        metadata: {
          userId: String(user.id),
          purchaseType: "squire",
        },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "checkout.session.completed",
  };

  const payload = JSON.stringify(event);
  const stripe = new Stripe("sk_test_billing_squire_webhook_test");
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
  assert.equal(updated.tier, "free");
  assert.equal(updated.subscriptionStatus, "active");
  assert.equal(updated.stripeCustomerId, "cus_test_billing_squire_pass");
  assert.equal(updated.stripeSubscriptionId, null);
  assert.equal(updated.usageResetAt, null);
  assert.equal(updated.aiTurnsUsedThisMonth, 0);
  assert.equal(updated.bonusTurns, 50);

  const ledger = storage.getTurnLedgerByUser(user.id, 25);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].visibleDelta, 50);
  assert.equal(ledger[0].reason, "squire_pass_grant");

  const duplicateResponse = await fetch(`http://127.0.0.1:${address.port}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
  assert.equal(duplicateResponse.status, 200);
  assert.equal((await duplicateResponse.json() as any).duplicate, true);
  assert.equal(storage.getUser(user.id)?.bonusTurns, 50);

  console.log("Billing Squire webhook regression tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
