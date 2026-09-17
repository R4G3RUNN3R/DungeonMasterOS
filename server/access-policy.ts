import type { User } from "../shared/schema";

/**
 * Compatibility boundary between legacy account flags and the capabilities
 * consumed by authorization/entitlement middleware.
 *
 * IMPORTANT: This mapping deliberately preserves the current V1 behaviour.
 * Changing these relationships is a separate, explicit migration.
 */
export type AccessPrincipal =
  Pick<User, "role" | "isAdmin"> &
  Partial<Pick<User, "unlimitedTurns">>;

export type AccessCapabilities = Readonly<{
  dungeonMasterAccess: boolean;
  subscriptionBypass: boolean;
  campaignLimitBypass: boolean;
  unlimitedAiTurns: boolean;
}>;

export function resolveAccessCapabilities(
  user?: AccessPrincipal | null,
): AccessCapabilities {
  const dungeonMasterAccess =
    !!user && (user.role === "dungeon_master" || !!user.isAdmin);

  return {
    dungeonMasterAccess,
    subscriptionBypass: dungeonMasterAccess,
    campaignLimitBypass: dungeonMasterAccess,
    unlimitedAiTurns: dungeonMasterAccess || !!user?.unlimitedTurns,
  };
}

export function hasDungeonMasterAccess(
  user?: Pick<User, "role" | "isAdmin"> | null,
): boolean {
  return !!user && (user.role === "dungeon_master" || !!user.isAdmin);
}

export function hasSubscriptionBypassAccess(
  user?: AccessPrincipal | null,
): boolean {
  return resolveAccessCapabilities(user).subscriptionBypass;
}

export function hasCampaignLimitBypass(
  user?: AccessPrincipal | null,
): boolean {
  return resolveAccessCapabilities(user).campaignLimitBypass;
}

export function hasUnlimitedAiAccess(
  user?: AccessPrincipal | null,
): boolean {
  return resolveAccessCapabilities(user).unlimitedAiTurns;
}
