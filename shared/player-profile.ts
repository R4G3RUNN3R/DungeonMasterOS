import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementCategory,
} from "./achievements";

/** Display-safe projection of one achievement for profile and collection UI. */
export interface PublicAchievementSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  unlocked: boolean;
  unlockedAt?: string | null;
  rewardTurns?: number;
}

/** Deliberately small character projection for a public profile. */
export interface PublicCharacterSummary {
  name: string;
  portraitUrl: string | null;
  identityLabel: string;
  progressionLabel: string;
  progressionValue: string | number;
}

/** Allowlisted player profile projection intended for later API wiring. */
export interface PublicPlayerProfileSummary {
  username: string;
  avatarUrl: string | null;
  memberSince: string;
  achievementsUnlocked: number;
  turnsEarned: number;
  showcasedAchievements: PublicAchievementSummary[];
  mostRecentCharacter: PublicCharacterSummary | null;
  viewerIsOwner: boolean;
}

/** Display-only recent achievement activity; no account or campaign data. */
export interface CommunityAchievementActivity {
  username: string;
  avatarUrl: string | null;
  achievement: PublicAchievementSummary;
  unlockedAt: string;
}

/** Display-only new-player summary for the community dashboard section. */
export interface NewAdventurerSummary {
  username: string;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface AchievementsPageModel {
  unlockedAchievementIds: string[];
  showcasedAchievementIds: string[];
  turnsEarned: number;
  viewerIsOwner: boolean;
}

export const EMPTY_ACHIEVEMENTS_PAGE_MODEL: AchievementsPageModel = {
  unlockedAchievementIds: [],
  showcasedAchievementIds: [],
  turnsEarned: 0,
  viewerIsOwner: false,
};

/**
 * Return catalogue definitions safe to show in the achievement collection.
 * Hidden definitions are only revealed after their canonical ID is unlocked.
 */
export function visibleAchievementDefinitions(
  unlockedAchievementIds: ReadonlySet<string>,
): Achievement[] {
  return ACHIEVEMENTS.filter(
    (achievement) => !achievement.hidden || unlockedAchievementIds.has(achievement.id),
  );
}

/** Sum lifetime reward turns represented by canonical unlocked achievements. */
export function calculateTurnsEarned(unlockedAchievementIds: Iterable<string>): number {
  const unlocked = new Set(unlockedAchievementIds);
  return ACHIEVEMENTS.reduce((total, achievement) => {
    if (!unlocked.has(achievement.id)) return total;
    const rewardTurns = achievement.rewardTurns ?? 0;
    return rewardTurns > 0 ? total + rewardTurns : total;
  }, 0);
}

/** Keep a showcase deterministic, unique, non-empty, and limited to three IDs. */
export function normalizeShowcaseSelection(ids: Iterable<string>): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (id.trim().length === 0 || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
    if (normalized.length === 3) break;
  }

  return normalized;
}
