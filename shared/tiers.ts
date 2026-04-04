/**
 * DMOS Tier Definitions + Top-Up Pack System
 */

export type TierName = "free" | "adventurer" | "master" | "legend" | "chronicler";

export interface TurnPack {
  id: string;
  turns: number;
  playTime: string;
  prices: Record<TierName, number | null>; // pence, null = not available
  // Stripe price IDs injected at runtime from env vars
  stripePriceIds?: Partial<Record<TierName, string>>;
}

export interface Tier {
  name: TierName;
  displayName: string;
  tagline: string;
  badge?: string;
  priceMonthly: number; // GBP pence
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
    aiTurnsPerMonth: 60,
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
    priceMonthly: 1000,
    priceWeekly: 300,
    priceYearly: 8400,
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
    priceMonthly: 2000,
    priceWeekly: 600,
    priceYearly: 16800,
    stripePriceIdMonthly: "STRIPE_PRICE_MASTER_MONTHLY",
    stripePriceIdWeekly: "STRIPE_PRICE_MASTER_WEEKLY",
    stripePriceIdYearly: "STRIPE_PRICE_MASTER_YEARLY",
    activeCampaigns: 3,
    archivedCampaigns: 999,
    charactersTotal: 20,
    playersPerCampaign: 4,
    aiTurnsPerMonth: 600,
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
    priceMonthly: 3000,
    priceWeekly: 900,
    priceYearly: 25200,
    stripePriceIdMonthly: "STRIPE_PRICE_LEGEND_MONTHLY",
    stripePriceIdWeekly: "STRIPE_PRICE_LEGEND_WEEKLY",
    stripePriceIdYearly: "STRIPE_PRICE_LEGEND_YEARLY",
    activeCampaigns: 10,
    archivedCampaigns: 999,
    charactersTotal: 999,
    playersPerCampaign: 6,
    aiTurnsPerMonth: 2000,
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
    upgradePrompt: "For players who never stop, there's Chronicler.",
  },

  chronicler: {
    name: "chronicler",
    displayName: "Chronicler",
    tagline: "The Dungeon Master never tires. Neither do you.",
    badge: "For the Devoted",
    priceMonthly: 4900,
    priceWeekly: 1200,
    priceYearly: 41160,
    stripePriceIdMonthly: "STRIPE_PRICE_CHRONICLER_MONTHLY",
    stripePriceIdWeekly: "STRIPE_PRICE_CHRONICLER_WEEKLY",
    stripePriceIdYearly: "STRIPE_PRICE_CHRONICLER_YEARLY",
    activeCampaigns: 999,
    archivedCampaigns: 999,
    charactersTotal: 999,
    playersPerCampaign: 6,
    aiTurnsPerMonth: 3000,
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

export const TURN_PACKS: TurnPack[] = [
  {
    id: "pack_50",
    turns: 50,
    playTime: "4–7 hours of play",
    prices: { free: null, adventurer: 109, master: 99, legend: 79, chronicler: 99 },
  },
  {
    id: "pack_100",
    turns: 100,
    playTime: "8–14 hours of play",
    prices: { free: null, adventurer: 219, master: 199, legend: 149, chronicler: 149 },
  },
  {
    id: "pack_250",
    turns: 250,
    playTime: "21–36 hours of play",
    prices: { free: null, adventurer: 549, master: 499, legend: 349, chronicler: 299 },
  },
  {
    id: "pack_500",
    turns: 500,
    playTime: "42–71 hours of play",
    prices: { free: null, adventurer: 999, master: 849, legend: 649, chronicler: 549 },
  },
  {
    id: "pack_1000",
    turns: 1000,
    playTime: "83–143 hours of play",
    prices: { free: null, adventurer: 1799, master: 1499, legend: 1149, chronicler: 1099 },
  },
];

export const TRIAL_DAYS = 7;

export const TRIAL_LIMITS = {
  activeCampaigns: 3,
  charactersTotal: 12,
  playersPerCampaign: 4,
  aiTurnsPerMonth: 999,
  messageHistoryDepth: 500,
  multiplayerHost: true,
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

export function formatPrice(pence: number): string {
  if (pence === 0) return "Free";
  return `£${(pence / 100).toFixed(2).replace(".00", "")}`;
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
