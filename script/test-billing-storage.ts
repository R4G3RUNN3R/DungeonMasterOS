import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-storage-test-${Date.now()}.sqlite`);

for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

process.env.DATABASE_URL = dbPath;

const { runMigrations, storage } = await import("../server/storage");

runMigrations();

const user = storage.createUser({
  email: "billing-storage-test" + String.fromCharCode(64) + "example.invalid",
  username: "billing_storage_test",
  passwordHash: "not-a-real-password",
} as any);

storage.updateUser(user.id, {
  tier: "adventurer",
  subscriptionStatus: "active",
  aiTurnsUsedThisMonth: 60,
  bonusTurns: 10,
} as any);

storage.recordTurnSpend(user.id, true);

let updated = storage.getUser(user.id);
assert.ok(updated);
assert.equal(updated.aiTurnsUsedThisMonth, 60);
assert.equal(updated.bonusTurns, 9);

storage.recordTurnSpend(user.id, false);

updated = storage.getUser(user.id);
assert.ok(updated);
assert.equal(updated.aiTurnsUsedThisMonth, 61);
assert.equal(updated.bonusTurns, 9);

console.log("Billing storage regression tests passed.");
