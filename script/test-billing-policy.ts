import assert from "node:assert/strict";
import {
  getNewUserBillingState,
  isPurchasableSubscriptionTier,
} from "../shared/tiers";

assert.deepEqual(getNewUserBillingState(), {
  tier: "free",
  subscriptionStatus: "expired",
  trialEndsAt: null,
  usageResetAt: null,
  aiTurnsUsedThisMonth: 0,
  bonusTurns: 0,
  onboardingComplete: false,
});

assert.equal(isPurchasableSubscriptionTier("adventurer"), true);
assert.equal(isPurchasableSubscriptionTier("master"), true);
assert.equal(isPurchasableSubscriptionTier("legend"), true);

assert.equal(isPurchasableSubscriptionTier("free"), false);
assert.equal(isPurchasableSubscriptionTier("chronicler"), false);
assert.equal(isPurchasableSubscriptionTier("banana"), false);

console.log("Billing policy regression tests passed.");
