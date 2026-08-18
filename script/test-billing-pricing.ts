import assert from "node:assert/strict";
import {
  TIERS,
  SQUIRE_PASS,
  formatPrice,
  getIncludedTurns,
  getNextUsageResetAt,
  calculateTurnSpend,
} from "../shared/tiers";

assert.equal(SQUIRE_PASS.price, 499);
assert.equal(SQUIRE_PASS.turns, 50);
assert.equal(TIERS.free.aiTurnsPerMonth, 0);

assert.equal(TIERS.adventurer.priceWeekly, 499);
assert.equal(TIERS.adventurer.priceMonthly, 1499);
assert.equal(TIERS.adventurer.priceYearly, 15999);

assert.equal(TIERS.master.priceWeekly, 799);
assert.equal(TIERS.master.priceMonthly, 2499);
assert.equal(TIERS.master.priceYearly, 26999);

assert.equal(TIERS.legend.priceWeekly, 1099);
assert.equal(TIERS.legend.priceMonthly, 3499);
assert.equal(TIERS.legend.priceYearly, 37999);

assert.equal(getIncludedTurns("adventurer", "weekly"), 50);
assert.equal(getIncludedTurns("adventurer", "monthly"), 200);
assert.equal(getIncludedTurns("adventurer", "yearly"), 200);

assert.equal(getIncludedTurns("master", "weekly"), 100);
assert.equal(getIncludedTurns("master", "monthly"), 400);
assert.equal(getIncludedTurns("master", "yearly"), 400);

assert.equal(getIncludedTurns("legend", "weekly"), 150);
assert.equal(getIncludedTurns("legend", "monthly"), 600);
assert.equal(getIncludedTurns("legend", "yearly"), 600);

assert.equal(formatPrice(499), "£4.99");
assert.equal(formatPrice(1499), "£14.99");

const start = new Date("2026-08-12T12:00:00.000Z");

assert.equal(
  getNextUsageResetAt("weekly", start).toISOString(),
  "2026-08-19T12:00:00.000Z",
);

assert.equal(
  getNextUsageResetAt("monthly", start).toISOString(),
  "2026-09-12T12:00:00.000Z",
);

assert.equal(
  getNextUsageResetAt("yearly", start).toISOString(),
  "2026-09-12T12:00:00.000Z",
);

assert.deepEqual(
  calculateTurnSpend(59, 10, false),
  { used: 60, bonusTurns: 10 },
);

assert.deepEqual(
  calculateTurnSpend(60, 10, true),
  { used: 60, bonusTurns: 9 },
);

assert.deepEqual(
  calculateTurnSpend(0, 50, true),
  { used: 0, bonusTurns: 49 },
);

console.log("Billing pricing regression tests passed.");
