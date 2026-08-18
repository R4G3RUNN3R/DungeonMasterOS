/**
 * DMOS Tier Definitions + Top-Up Pack System
 */

export type TierName = "free" | "adventurer" | "master" | "legend" | "chronicler";

export interface TurnPack {
  id: string;
  turns: number;
  playTime: string;
  prices: Record<TierName, number | null>; // cents, null = not available
  // Stripe price IDs injected at runtime from env vars
  stripePriceIds?: Partial<Record<TierName, string>>;
}

export interface Tier {
  name: TierName;
  displayName: string;
  tagline: string;
  badge?: string;
  priceMonthly: number; // GBP cents
  priceWeekly: number;
  priceYearly: number;

  // Stripe Price ID env var names (resolved at runtime)
  stripePriceIdMonthly?: string;
  stripePriceIdWeekly?: string;
  stripePriceIdYearly?: string;

  activeCampaigns: number;
  archivedCampaigns: number;
  charactersTotal: number;
  playersPerCampaign: number;
  aiTurnsPerMonth: number; // -1 = fair use
  messageHistoryDepth: number;

  multiplayerHost: boolean;
  animeWorlds: boolean;
  epicMode: boolean;
  allWorldModes: boolean;
  exportSessions: boolean;
  customWorldPrompt: boolean;
  homebrewRules: boolean;
  priorityResponse: boolean;
  earlyAccess: boolean;

  topUpDiscountPct: number;
  color: string;
  upgradePrompt: string;
}

export const TIERS: Record<TierName, Tier> = {
  free: {
    name: "free",
    displayName: "Squire",
    tagline: "Your first steps into the dungeon",
    priceMonthly: 0,
    priceWeekly: 0,
    priceYearly: 0,
    activeCampaigns: 1,
    archivedCampaigns: 999,
    charactersTotal: 6,
    playersPerCampaign: 1,
    aiTurnsPerMonth: 0,
    messageHistoryDepth: 30,
    multiplayerHost: false,
    animeWorlds: false,
    epicMode: false,
    allWorldModes: false,
    exportSessions: false,
    customWorldPrompt: false,
    homebrewRules: false,
    priorityResponse: false,
    earlyAccess: false,
    topUpDiscountPct: 0,
    color: "#8a6830",
    upgradePrompt: "Subscribe to unlock more campaigns, players, and AI turns.",
  },

  adventurer: {
    name: "adventurer",
    displayName: "Adventurer",
    tagline: "Solo adventures and duo campaigns",
    priceMonthly: 1499,
    priceWeekly: 499,
    priceYearly: 15999,
    stripePriceIdMonthly: "STRIPE_PRICE_ADVENTURER_MONTHLY",
    stripePriceIdWeekly: "STRIPE_PRICE_ADVENTURER_WEEKLY",
    stripePriceIdYearly: "STRIPE_PRICE_ADVENTURER_YEARLY",
    activeCampaigns: 1,
    archivedCampaigns: 999,
    charactersTotal: 6,
    playersPerCampaign: 2,
    aiTurnsPerMonth: 200,
    messageHistoryDepth: 200,
    multiplayerHost: true,
    animeWorlds: false,
    epicMode: false,
    allWorldModes: false,
    exportSessions: true,
    customWorldPrompt: true,
    homebrewRules: true,
    priorityResponse: false,
    earlyAccess: false,
    topUpDiscountPct: 25,
    color: "#2980b9",
    upgradePrompt: "Need more campaigns or players? Upgrade to Campaign Master.",
  },

  master: {
    name: "master",
    displayName: "Campaign Master",
    tagline: "For regular groups and ongoing campaigns",
    badge: "Most Popular",
    priceMonthly: 2499,
    priceWeekly: 799,
    priceYearly: 26999,
    stripePriceIdMonthly: "STRIPE_PRICE_MASTER_MONTHLY",
    stripePriceIdWeekly: "STRIPE_PRICE_MASTER_WEEKLY",
    stripePriceIdYearly: "STRIPE_PRICE_MASTER_YEARLY",
    activeCampaigns: 3,
    archivedCampaigns: 999,
    charactersTotal: 20,
    playersPerCampaign: 4,
    aiTurnsPerMonth: 400,
    messageHistoryDepth: 1000,
    multiplayerHost: true,
    animeWorlds: true,
    epicMode: true,
    allWorldModes: true,
    exportSessions: true,
    customWorldPrompt: true,
    homebrewRules: true,
    priorityResponse: false,
    earlyAccess: false,
    topUpDiscountPct: 35,
    color: "#8e44ad",
    upgradePrompt: "Need more players or campaigns? Upgrade to Legend.",
  },

  legend: {
    name: "legend",
    displayName: "Legend",
    tagline: "For serious players running multiple groups",
    priceMonthly: 3499,
    priceWeekly: 1099,
    priceYearly: 37999,
    stripePriceIdMonthly: "STRIPE_PRICE_LEGEND_MONTHLY",
    stripePriceIdWeekly: "STRIPE_PRICE_LEGEND_WEEKLY",
    stripePriceIdYearly: "STRIPE_PRICE_LEGEND_YEARLY",
    activeCampaigns: 10,
    archivedCampaigns: 999,
    charactersTotal: 999,
    playersPerCampaign: 6,
    aiTurnsPerMonth: 600,
    messageHistoryDepth: 5000,
    multiplayerHost: true,
    animeWorlds: true,
    epicMode: true,
    allWorldModes: true,
    exportSessions: true,
    customWorldPrompt: true,
    homebrewRules: true,
    priorityResponse: true,
    earlyAccess: false,
    topUpDiscountPct: 50,
    color: "#e67e22",
    upgradePrompt: "Legend is our top tier — for even more headroom, add a Squire Pass for solo one-off sessions.",
  },

  chronicler: {
    name: "chronicler",
    displayName: "Chronicler",
    tagline: "The Dungeon Master never tires. Neither do you.",
    badge: "For the Devoted",
    priceMonthly: 7999,
    priceWeekly: 2399,
    priceYearly: 79990,
    stripePriceIdMonthly: "STRIPE_PRICE_CHRONICLER_MONTHLY",
    stripePriceIdWeekly: "STRIPE_PRICE_CHRONICLER_WEEKLY",
    stripePriceIdYearly: "STRIPE_PRICE_CHRONICLER_YEARLY",
    activeCampaigns: 999,
    archivedCampaigns: 999,
    charactersTotal: 999,
    playersPerCampaign: 6,
    aiTurnsPerMonth: 500,
    messageHistoryDepth: 99999,
    multiplayerHost: true,
    animeWorlds: true,
    epicMode: true,
    allWorldModes: true,
    exportSessions: true,
    customWorldPrompt: true,
    homebrewRules: true,
    priorityResponse: true,
    earlyAccess: true,
    topUpDiscountPct: 60,
    color: "#c0392b",
    upgradePrompt: "You're already at the highest tier. Thank you, adventurer.",
  },
};

export type BillingInterval = "weekly" | "monthly" | "yearly";

export const SQUIRE_PASS = {
  displayName: "Squire Pass",
  price: 499,
  turns: 50,
  stripePriceEnv: "STRIPE_PRICE_SQUIRE_PASS",
} as const;

const WEEKLY_INCLUDED_TURNS: Partial<Record<TierName, number>> = {
  adventurer: 50,
  master: 100,
  legend: 150,
};

export function getIncludedTurns(
  tier: TierName,
  interval: BillingInterval,
): number {
  if (tier === "free") return 0;

  if (interval === "weekly") {
    return WEEKLY_INCLUDED_TURNS[tier] ?? TIERS[tier]?.aiTurnsPerMonth ?? 0;
  }

  return TIERS[tier]?.aiTurnsPerMonth ?? 0;
}

export function getNextUsageResetAt(
  interval: BillingInterval,
  from: Date = new Date(),
): Date {
  const next = new Date(from.getTime());

  if (interval === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  const originalDay = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);

  const daysInTargetMonth = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();

  next.setUTCDate(Math.min(originalDay, daysInTargetMonth));
  return next;
}

export function calculateTurnSpend(
  used: number,
  bonusTurns: number,
  useBonusTurn: boolean,
): { used: number; bonusTurns: number } {
  if (useBonusTurn) {
    return {
      used,
      bonusTurns: Math.max(0, bonusTurns - 1),
    };
  }

  return {
    used: used + 1,
    bonusTurns,
  };
}

export function getNewUserBillingState() {
  return {
    tier: "free" as const,
    subscriptionStatus: "expired" as const,
    trialEndsAt: null,
    usageResetAt: null,
    aiTurnsUsedThisMonth: 0,
    bonusTurns: 0,
    onboardingComplete: false,
  };
}

export function isPurchasableSubscriptionTier(
  tier: unknown,
): tier is "adventurer" | "master" | "legend" {
  return tier === "adventurer" || tier === "master" || tier === "legend";
}

export const TURN_PACKS: TurnPack[] = [
  {
    id: "pack_50",
    turns: 50,
    playTime: "4-7 hours of play",
    prices: { free: null, adventurer: 999, master: 999, legend: 999, chronicler: 999 },
  },
  {
    id: "pack_125",
    turns: 125,
    playTime: "10-18 hours of play",
    prices: { free: null, adventurer: 1999, master: 1999, legend: 1999, chronicler: 1999 },
  },
  {
    id: "pack_300",
    turns: 300,
    playTime: "25-43 hours of play",
    prices: { free: null, adventurer: 4499, master: 4499, legend: 4499, chronicler: 4499 },
  },
  {
    id: "pack_750",
    turns: 750,
    playTime: "62-107 hours of play",
    prices: { free: null, adventurer: 9999, master: 9999, legend: 9999, chronicler: 9999 },
  },
];

export const TRIAL_DAYS = 7;

export const TRIAL_LIMITS = {
  activeCampaigns: 1,
  charactersTotal: 6,
  playersPerCampaign: 1,
  aiTurnsPerMonth: 10,
  messageHistoryDepth: 120,
  multiplayerHost: false,
  animeWorlds: true,
  epicMode: true,
  allWorldModes: true,
};

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export function isReadOnly(status: SubscriptionStatus): boolean {
  return status === "expired";
}

export function canPlay(status: SubscriptionStatus): boolean {
  return status !== "expired";
}

export function getEffectiveLimits(
  tier: TierName,
  status: SubscriptionStatus,
  trialEndsAt: Date | null,
): Tier {
  const base = TIERS[tier];

  if (status === "trial" && trialEndsAt && new Date() < trialEndsAt) {
    const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000);
    return {
      ...base,
      ...TRIAL_LIMITS,
      name: base.name,
      displayName: base.displayName,
      tagline: `Free trial — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`,
      priceMonthly: 0,
      priceWeekly: 0,
      priceYearly: 0,
      topUpDiscountPct: 0,
      color: base.color,
      badge: "Free Trial",
      upgradePrompt: `Your trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Subscribe to keep playing.`,
    };
  }

  return base;
}

export function getTopUpPrice(packId: string, tier: TierName): number | null {
  const pack = TURN_PACKS.find((p) => p.id === packId);
  if (!pack) return null;
  return pack.prices[tier] ?? null;
}

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `£${(cents / 100).toFixed(2).replace(".00", "")}`;
}

export function trialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000));
}

export function turnsUsedPercent(used: number, limit: number): number {
  if (limit <= 0 || limit >= 3000) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function getTurnsWarningLevel(
  used: number,
  limit: number,
): "none" | "caution" | "warning" | "critical" {
  if (limit < 0 || limit >= 3000) return "none";
  const pct = turnsUsedPercent(used, limit);
  if (pct >= 95) return "critical";
  if (pct >= 80) return "warning";
  if (pct >= 65) return "caution";
  return "none";
}

// Resolve a Stripe price ID from environment variable name
export function resolveStripePriceId(envVarName: string): string | undefined {
  return process.env[envVarName];
}
