import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-auth-test-${Date.now()}.sqlite`);

for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

process.env.DATABASE_URL = dbPath;

const { runMigrations, storage } = await import("../server/storage");
const {
  attachUser,
  checkTurnLimit,
  signToken,
} = await import("../server/auth");

runMigrations();

const weeklyUser = storage.createUser({
  email: "billing-auth-test" + String.fromCharCode(64) + "example.invalid",
  username: "billing_auth_test",
  passwordHash: "not-a-real-password",
} as any);

storage.updateUser(weeklyUser.id, {
  tier: "adventurer",
  subscriptionStatus: "active",
  stripeBillingInterval: "weekly",
  aiTurnsUsedThisMonth: 50,
  bonusTurns: 0,
  usageResetAt: null,
} as any);

const currentWeeklyUser = storage.getUser(weeklyUser.id);
assert.ok(currentWeeklyUser);

let nextCalled = false;
let statusCode = 200;
let responseBody: any = null;

checkTurnLimit()(
  { user: currentWeeklyUser } as any,
  {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      responseBody = body;
      return this;
    },
  } as any,
  () => {
    nextCalled = true;
  },
);

assert.equal(nextCalled, false);
assert.equal(statusCode, 403);
assert.equal(responseBody?.code, "TURN_LIMIT");
assert.equal(responseBody?.limit, 50);

const resetUser = storage.createUser({
  email: "billing-reset-test" + String.fromCharCode(64) + "example.invalid",
  username: "billing_reset_test",
  passwordHash: "not-a-real-password",
} as any);

storage.updateUser(resetUser.id, {
  tier: "adventurer",
  subscriptionStatus: "active",
  stripeBillingInterval: "weekly",
  aiTurnsUsedThisMonth: 25,
  usageResetAt: "2020-01-01T00:00:00.000Z",
} as any);

const before = Date.now();

attachUser(
  {
    cookies: {
      dmos_session: signToken(resetUser.id),
    },
  } as any,
  {} as any,
  () => {},
);

const after = Date.now();
const resetUpdated = storage.getUser(resetUser.id);

assert.ok(resetUpdated);
assert.equal(resetUpdated.aiTurnsUsedThisMonth, 0);
assert.ok(resetUpdated.usageResetAt);

const resetAt = new Date(resetUpdated.usageResetAt).getTime();
const sevenDays = 7 * 24 * 60 * 60 * 1000;

assert.ok(resetAt >= before + sevenDays - 5000);
assert.ok(resetAt <= after + sevenDays + 5000);

const { incrementTurnCount } = await import("../server/auth");

storage.updateUser(weeklyUser.id, {
  aiTurnsUsedThisMonth: 50,
  bonusTurns: 2,
} as any);

incrementTurnCount(weeklyUser.id);

const bonusUpdated = storage.getUser(weeklyUser.id);
assert.ok(bonusUpdated);
assert.equal(bonusUpdated.aiTurnsUsedThisMonth, 50);
assert.equal(bonusUpdated.bonusTurns, 1);

console.log("Billing auth regression tests passed.");
