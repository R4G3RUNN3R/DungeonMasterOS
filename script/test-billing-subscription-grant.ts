import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-subscription-grant-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-subscription-grant-test";
delete process.env.STRIPE_SECRET_KEY;

const { runMigrations, storage } = await import("../server/storage");
runMigrations();

const { recordSubscriptionTurnGrant } = await import("../server/routes");

const user = storage.createUser({
  email: "billing-subscription-grant-test@example.invalid",
  username: "billing_subscription_grant_test",
  passwordHash: "not-a-real-password",
} as any);

recordSubscriptionTurnGrant({
  userId: user.id,
  tier: "adventurer",
  source: "regression_test",
  sourceId: "regression:weekly-adventurer",
  interval: "weekly",
});

const ledger = storage.getTurnLedgerByUser(user.id, 25);
assert.equal(ledger.length, 1);
assert.equal(ledger[0].visibleDelta, 50);
assert.equal(ledger[0].reason, "subscription_grant");

console.log("Billing subscription grant regression tests passed.");
