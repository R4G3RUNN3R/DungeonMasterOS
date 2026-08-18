import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-google-signup-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-google-signup-test";
delete process.env.STRIPE_SECRET_KEY;

const { runMigrations, storage } = await import("../server/storage");
runMigrations();

const { findOrCreateGoogleUser } = await import("../server/routes");

const email = "billing-google-signup-test@example.invalid";
const user = await findOrCreateGoogleUser({
  sub: "google-billing-signup-test",
  email,
  name: "Billing Google Test",
  picture: null,
} as any);

assert.equal(user.email, email);
assert.equal(user.tier, "free");
assert.equal(user.subscriptionStatus, "expired");
assert.equal(user.trialEndsAt, null);
assert.equal(user.usageResetAt, null);
assert.equal(user.aiTurnsUsedThisMonth, 0);
assert.equal(user.bonusTurns, 0);

const ledger = storage.getTurnLedgerByUser(user.id, 25);
assert.equal(ledger.length, 0);

console.log("Billing Google signup regression tests passed.");
