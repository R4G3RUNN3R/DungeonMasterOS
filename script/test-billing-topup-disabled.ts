// Regression test for original billing spec's "Item B": the old turn
// top-up economics are not approved for the new commercial model.
// POST /api/stripe/topup must be deliberately unavailable for NEW
// purchases, without deleting the historical ledger/fulfillment support
// still needed to correctly account for and honor already-completed old
// purchases (i.e. TURN_PACKS, getTopUpPriceId, and the checkout.session.completed
// webhook's topUpTurns fulfillment branch must all remain intact — only the
// purchase-CREATION route itself becomes unavailable).
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-topup-disabled-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-topup-disabled-test";
process.env.STRIPE_SECRET_KEY = "sk_test_billing_topup_disabled_test";
// Deliberately configure a real-looking top-up price for the pack/tier combo
// below, so if the route were NOT disabled, this request would otherwise
// have cleared every pre-Stripe-call validation and reached a real Stripe
// API call. Proves the disable fires before price/pack validation, not
// merely as a side effect of something else being unconfigured.
process.env.STRIPE_PRICE_TOPUP_50_ADVENTURER = "price_test_topup_50_adventurer";

const { runMigrations, storage } = await import("../server/storage");
runMigrations();

const { signToken } = await import("../server/auth");
const { registerRoutes } = await import("../server/routes");

const app = express();
app.use(cookieParser());
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);

const user = storage.createUser({
  email: "billing-topup-disabled-test@example.invalid",
  username: "billing_topup_disabled_test",
  passwordHash: "not-a-real-password",
  tier: "adventurer",
  subscriptionStatus: "active",
} as any);
const token = signToken(user.id);

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  async function postTopup(body: any) {
    return fetch(`${base}/api/stripe/topup`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `dmos_session=${token}` },
      body: JSON.stringify(body),
    });
  }

  // 1. A request that would previously have fully succeeded (valid pack,
  // valid tier, valid configured price) is rejected — not with a 200 and a
  // Checkout URL, and not with any of the OLD validation error messages
  // ("Invalid pack.", "Subscribe first...", "not configured. Contact
  // support.") — a genuinely new, deliberate "unavailable" response.
  const validPackResponse = await postTopup({ packId: "pack_50" });
  assert.notEqual(validPackResponse.status, 200);
  const validPackBody = await validPackResponse.json() as any;
  assert.notEqual(validPackBody.message, "Invalid pack.");
  assert.notEqual(validPackBody.message, "Subscribe first to purchase turn top-ups.");
  assert.doesNotMatch(validPackBody.message ?? "", /not configured/i);
  assert.match(validPackBody.message ?? "", /(no longer|not available|unavailable|disabled)/i);

  const userAfterValidPack = storage.getUser(user.id);
  assert.equal(userAfterValidPack?.stripeCustomerId, null, "no Stripe customer should have been created");

  // 2. Disabled fires even for a request with no packId at all — proves
  // the disable is the very first thing the handler does, not merely one
  // branch among the existing validation checks.
  const noPackIdResponse = await postTopup({});
  assert.notEqual(noPackIdResponse.status, 200);
  const noPackIdBody = await noPackIdResponse.json() as any;
  assert.match(noPackIdBody.message ?? "", /(no longer|not available|unavailable|disabled)/i);
  assert.notEqual(noPackIdBody.message, "packId is required.");

  // 3. Disabled fires even for a completely invalid packId — same reasoning
  // as (2), proving no packId/pack-lookup validation runs before the
  // disable check.
  const invalidPackResponse = await postTopup({ packId: "not_a_real_pack" });
  assert.notEqual(invalidPackResponse.status, 200);
  const invalidPackBody = await invalidPackResponse.json() as any;
  assert.match(invalidPackBody.message ?? "", /(no longer|not available|unavailable|disabled)/i);

  console.log("Billing top-up disabled regression tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
