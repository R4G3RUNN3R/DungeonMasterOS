import type { User } from "../shared/schema";
import { storage } from "./storage";

export type ExplicitEntitlementUpdate = Partial<
  Pick<
    User,
    "subscriptionBypass" | "campaignLimitBypass" | "unlimitedAiTurns"
  >
>;

export function setExplicitEntitlements(
  userId: number,
  requested: ExplicitEntitlementUpdate,
): User | undefined {
  const user = storage.getUser(userId);
  if (!user) return undefined;

  const updates: ExplicitEntitlementUpdate = {};

  if (
    requested.subscriptionBypass !== undefined &&
    requested.subscriptionBypass !== user.subscriptionBypass
  ) {
    updates.subscriptionBypass = requested.subscriptionBypass;
  }

  if (
    requested.campaignLimitBypass !== undefined &&
    requested.campaignLimitBypass !== user.campaignLimitBypass
  ) {
    updates.campaignLimitBypass = requested.campaignLimitBypass;
  }

  if (
    requested.unlimitedAiTurns !== undefined &&
    requested.unlimitedAiTurns !== user.unlimitedAiTurns
  ) {
    updates.unlimitedAiTurns = requested.unlimitedAiTurns;
  }

  if (Object.keys(updates).length === 0) {
    return user;
  }

  storage.updateUser(user.id, updates);
  return { ...user, ...updates };
}
