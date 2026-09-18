import type { User } from "../shared/schema";

/**
 * Authorization and entitlement compatibility boundary.
 *
 * Canonical accessRole owns authorization when present. Explicit entitlement
 * overrides own billing/campaign/AI bypasses when present. Legacy fields are
 * consulted only for pre-migration principals so rollback-era data can still be
 * interpreted without allowing old flags to override canonical state.
 */
export type AccessPrincipal =
  Pick<User, "role" | "isAdmin"> &
  Partial<
    Pick<
      User,
      | "accessRole"
      | "unlimitedTurns"
      | "subscriptionBypass"
      | "campaignLimitBypass"
      | "unlimitedAiTurns"
    >
  >;

export type AccessCapabilities = Readonly<{
  dungeonMasterAccess: boolean;
  subscriptionBypass: boolean;
  campaignLimitBypass: boolean;
  unlimitedAiTurns: boolean;
}>;

function hasLegacyDungeonMasterAccess(
  user?: Pick<User, "role" | "isAdmin"> | null,
): boolean {
  return !!user && (user.role === "dungeon_master" || !!user.isAdmin);
}

function hasCanonicalEntitlements(
  user?: AccessPrincipal | null,
): user is AccessPrincipal & Pick<
  User,
  "subscriptionBypass" | "campaignLimitBypass" | "unlimitedAiTurns"
> {
  return (
    user?.subscriptionBypass != null &&
    user?.campaignLimitBypass != null &&
    user?.unlimitedAiTurns != null
  );
}

export function resolveAccessCapabilities(
  user?: AccessPrincipal | null,
): AccessCapabilities {
  const legacyDungeonMasterAccess = hasLegacyDungeonMasterAccess(user);
  const dungeonMasterAccess =
    user?.accessRole != null
      ? user.accessRole === "dungeon_master" || user.accessRole === "admin"
      : legacyDungeonMasterAccess;

  if (hasCanonicalEntitlements(user)) {
    return {
      dungeonMasterAccess,
      subscriptionBypass: !!user.subscriptionBypass,
      campaignLimitBypass: !!user.campaignLimitBypass,
      unlimitedAiTurns: !!user.unlimitedAiTurns,
    };
  }

  return {
    dungeonMasterAccess,
    subscriptionBypass: legacyDungeonMasterAccess,
    campaignLimitBypass: legacyDungeonMasterAccess,
    unlimitedAiTurns: legacyDungeonMasterAccess || !!user?.unlimitedTurns,
  };
}

export function hasDungeonMasterAccess(
  user?: AccessPrincipal | null,
): boolean {
  return resolveAccessCapabilities(user).dungeonMasterAccess;
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
