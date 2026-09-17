import type { User } from "../shared/schema";
import {
  TOP_UP_SALES_ENABLED,
  canPlay,
  getAiTurnAllowance,
  getEffectiveLimits,
  isReadOnly,
  type SubscriptionStatus,
  type TierName,
} from "../shared/tiers";
import {
  hasCampaignLimitBypass,
  hasSubscriptionBypassAccess,
  hasUnlimitedAiAccess,
} from "./access-policy";

function getTierContext(user: User) {
  const tier = user.tier as TierName;
  const status = user.subscriptionStatus as SubscriptionStatus;
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  return { tier, status, trialEndsAt };
}

export function resolvePlayEntitlement(user: User) {
  const status = user.subscriptionStatus as SubscriptionStatus;
  if (hasSubscriptionBypassAccess(user)) {
    return {
      canPlay: true,
      readOnly: false,
      status,
      bypassed: true,
    } as const;
  }

  return {
    canPlay: canPlay(status),
    readOnly: isReadOnly(status),
    status,
    bypassed: false,
  } as const;
}

export function resolveCampaignEntitlement(user: User) {
  if (hasCampaignLimitBypass(user)) {
    return {
      unlimited: true,
      limits: null,
    } as const;
  }

  const { tier, status, trialEndsAt } = getTierContext(user);
  return {
    unlimited: false,
    limits: getEffectiveLimits(tier, status, trialEndsAt),
  } as const;
}

export function resolveAiEntitlement(user: User) {
  if (hasUnlimitedAiAccess(user)) {
    return {
      unlimited: true,
      limits: null,
      allowance: null,
      canTopUp: false,
    } as const;
  }

  const { tier, status, trialEndsAt } = getTierContext(user);
  const limits = getEffectiveLimits(tier, status, trialEndsAt);
  const allowance = getAiTurnAllowance(
    tier,
    status,
    trialEndsAt,
    user.stripeBillingInterval,
  );

  return {
    unlimited: false,
    limits,
    allowance,
    canTopUp: TOP_UP_SALES_ENABLED && tier !== "free",
  } as const;
}
