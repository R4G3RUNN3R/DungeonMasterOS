// Regression tests for POST /api/stripe/squire — the Squire Pass Checkout
// creation endpoint. Squire webhook fulfillment (checkout.session.completed
// with purchaseType === "squire") already exists and is tested in
// test-billing-squire-webhook.ts; this covers the missing other half —
// actually creating the Checkout Session an authenticated user is sent to.
//
// This deliberately never lets a request reach stripe.checkout.sessions.create
// or stripe.customers.create, matching this codebase's own established
// convention (see test-billing-checkout-validation.ts, which only exercises
// the existing /api/stripe/checkout route's pre-Stripe-call validation/
// rejection paths). STRIPE_PRICE_SQUIRE_PASS is deliberately left unset for
// every test below, so every request that clears the active-subscription
// guard still stops at the "not configured" check one line before any real
// Stripe SDK call — the two distinct 400 messages (active-subscription vs
// not-configured) are what prove the guard fired or didn't, with zero
// outbound network access anywhere in this file. The successful-creation
// path is covered by the production smoke-test step instead.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-squire-checkout-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-squire-checkout-test";
process.env.STRIPE_SECRET_KEY = "sk_test_billing_squire_checkout_test";
delete process.env.STRIPE_PRICE_SQUIRE_PASS;

const { runMigrations, storage } = await import("../server/storage");
runMigrations();

const { signToken } = await import("../server/auth");
const { registerRoutes } = await import("../server/routes");

const app = express();
app.use(cookieParser());
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  async function postSquire(token: string | null, body: any = {}) {
    return fetch(`${base}/api/stripe/squire`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { cookie: `dmos_session=${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  // 1. Unauthenticated request is rejected before anything else runs.
  const unauthedResponse = await postSquire(null);
  assert.equal(unauthedResponse.status, 401);
  const unauthedBody = await unauthedResponse.json() as any;
  assert.equal(unauthedBody.code, "UNAUTHENTICATED");

  // 2. A free/never-subscribed user clears the active-subscription guard
  // and reaches the "not configured" check (STRIPE_PRICE_SQUIRE_PASS is
  // unset throughout this whole file) — never creates a Stripe customer,
  // proving the request stopped before any Stripe SDK call, not merely
  // that a later real call also happened to fail.
  const freeUser = storage.createUser({
    email: "billing-squire-checkout-free@example.invalid",
    username: "billing_squire_checkout_free",
    passwordHash: "not-a-real-password",
    tier: "free",
    subscriptionStatus: "expired",
  } as any);
  const freeUserToken = signToken(freeUser.id);

  const freeUserResponse = await postSquire(freeUserToken);
  assert.equal(freeUserResponse.status, 400);
  const freeUserBody = await freeUserResponse.json() as any;
  assert.match(freeUserBody.message, /not configured/i);

  const freeUserAfter = storage.getUser(freeUser.id);
  assert.equal(freeUserAfter?.stripeCustomerId, null, "no Stripe customer should have been created");

  // 3. An already-active recurring subscriber is rejected by the dedicated
  // policy guard, with its own distinct message — Squire's webhook
  // fulfillment unconditionally resets tier, subscriptionStatus,
  // stripeSubscriptionId, stripePriceId, stripeBillingInterval and
  // subscriptionCurrentPeriodEnd to the Squire shape, so a currently-paying
  // subscriber must never be allowed to reach that fulfillment path — it
  // would silently orphan a subscription Stripe is still billing them for,
  // with no server-side record of it left.
  const activeSubscriberUser = storage.createUser({
    email: "billing-squire-checkout-active-sub@example.invalid",
    username: "billing_squire_checkout_active_sub",
    passwordHash: "not-a-real-password",
    tier: "adventurer",
    subscriptionStatus: "active",
    stripeSubscriptionId: "sub_real_active_subscription",
    stripeBillingInterval: "monthly",
  } as any);
  const activeSubscriberToken = signToken(activeSubscriberUser.id);

  const activeSubscriberResponse = await postSquire(activeSubscriberToken);
  assert.equal(activeSubscriberResponse.status, 400);
  const activeSubscriberBody = await activeSubscriberResponse.json() as any;
  assert.match(activeSubscriberBody.message, /already have an active subscription/i);
  assert.doesNotMatch(activeSubscriberBody.message, /not configured/i);

  // 3b. A past_due subscriber (Stripe is still dunning them for the same
  // live subscription — canPlay() still lets them use the app) must be
  // blocked by the same guard as an active one. Their stripeSubscriptionId
  // is still a real, currently-billing subscription; only cancelled/expired
  // statuses represent a subscription that has actually stopped.
  const pastDueSubscriberUser = storage.createUser({
    email: "billing-squire-checkout-past-due-sub@example.invalid",
    username: "billing_squire_checkout_past_due_sub",
    passwordHash: "not-a-real-password",
    tier: "master",
    subscriptionStatus: "past_due",
    stripeSubscriptionId: "sub_real_past_due_subscription",
    stripeBillingInterval: "monthly",
  } as any);
  const pastDueSubscriberToken = signToken(pastDueSubscriberUser.id);

  const pastDueSubscriberResponse = await postSquire(pastDueSubscriberToken);
  assert.equal(pastDueSubscriberResponse.status, 400);
  const pastDueSubscriberBody = await pastDueSubscriberResponse.json() as any;
  assert.match(pastDueSubscriberBody.message, /already have an active subscription/i);

  // 4. A cancelled former subscriber (has a stale stripeSubscriptionId, but
  // is no longer actively billing) is NOT blocked by the same guard — the
  // guard is keyed on subscriptionStatus === "active", not merely on
  // whether a subscription id was ever recorded. Distinguished from the
  // active-subscriber case by getting the SAME "not configured" message the
  // free user got, not the active-subscription rejection.
  const cancelledSubscriberUser = storage.createUser({
    email: "billing-squire-checkout-cancelled-sub@example.invalid",
    username: "billing_squire_checkout_cancelled_sub",
    passwordHash: "not-a-real-password",
    tier: "adventurer",
    subscriptionStatus: "cancelled",
    stripeSubscriptionId: "sub_stale_cancelled_subscription",
  } as any);
  const cancelledSubscriberToken = signToken(cancelledSubscriberUser.id);

  const cancelledSubscriberResponse = await postSquire(cancelledSubscriberToken);
  assert.equal(cancelledSubscriberResponse.status, 400);
  const cancelledSubscriberBody = await cancelledSubscriberResponse.json() as any;
  assert.match(cancelledSubscriberBody.message, /not configured/i);
  assert.doesNotMatch(cancelledSubscriberBody.message, /already have an active subscription/i);

  // 5. Client-supplied price/amount fields are never honored. This free
  // user's request carries an attacker-chosen priceId/amount in the body,
  // yet reaches the exact same "not configured" rejection as test 2's empty
  // body did — proving the server never even looks at the request body for
  // pricing, only its own STRIPE_PRICE_SQUIRE_PASS environment variable.
  const forgedPriceUser = storage.createUser({
    email: "billing-squire-checkout-forged-price@example.invalid",
    username: "billing_squire_checkout_forged_price",
    passwordHash: "not-a-real-password",
    tier: "free",
    subscriptionStatus: "expired",
  } as any);
  const forgedPriceToken = signToken(forgedPriceUser.id);

  const forgedPriceResponse = await postSquire(forgedPriceToken, {
    priceId: "price_attacker_chosen",
    amount: 1,
    purchaseType: "not_squire_at_all",
  });
  assert.equal(forgedPriceResponse.status, 400);
  const forgedPriceBody = await forgedPriceResponse.json() as any;
  assert.match(forgedPriceBody.message, /not configured/i);

  console.log("Billing Squire checkout regression tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
