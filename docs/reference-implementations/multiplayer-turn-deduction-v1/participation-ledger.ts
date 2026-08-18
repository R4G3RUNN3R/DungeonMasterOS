// Reference implementation only. Intended to be ported into server/ after live comparison.

export const CAMPAIGN_HISTORY_POLICY = {
  meaningfulActionsForTimeQualification: 5,
  activeSecondsForTimeQualification: 15 * 60,
  meaningfulActionsAloneQualification: 10,
  minimumActionsForLongTimeQualification: 3,
  activeSecondsForLongTimeQualification: 30 * 60,
  /** A continuous activity segment cannot grow indefinitely without further authenticated activity. */
  activityWindowSeconds: 5 * 60,
  /** Start a new session after this much inactivity. */
  newSessionGapSeconds: 30 * 60,
} as const;

export type CampaignParticipationRecord = {
  userId: number;
  campaignId: number;
  characterId: number | null;

  campaignNameSnapshot: string;
  characterNameSnapshot: string | null;
  hostUserIdSnapshot: number | null;
  hostUsernameSnapshot: string | null;
  rulesProfileSnapshot: string | null;

  firstJoinedAt: string;
  firstMeaningfulActionAt: string | null;
  lastMeaningfulActionAt: string | null;
  lastActivityAt: string | null;
  lastPlayedAt: string | null;

  meaningfulActionCount: number;
  activePlaySeconds: number;
  sessionCount: number;

  qualifiedAt: string | null;
  currentAccessStatus: "active" | "left" | "removed" | "archived" | "ended";
  updatedAt: string;
};

export type CampaignHistoryCard = {
  campaignId: number;
  campaignName: string;
  characterId: number | null;
  characterName: string | null;
  hostUsername: string | null;
  rulesProfile: string | null;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
  activePlaySeconds: number;
  sessionCount: number;
  currentAccessStatus: CampaignParticipationRecord["currentAccessStatus"];
};

export interface CampaignParticipationStoragePort {
  getParticipation(userId: number, campaignId: number): CampaignParticipationRecord | undefined;
  upsertParticipation(record: CampaignParticipationRecord): CampaignParticipationRecord;
  getQualifiedCampaignHistory(userId: number): CampaignParticipationRecord[];
}

export function qualifiesForCampaignHistory(record: CampaignParticipationRecord): boolean {
  if (record.qualifiedAt) return true;

  const byBalancedParticipation =
    record.meaningfulActionCount >= CAMPAIGN_HISTORY_POLICY.meaningfulActionsForTimeQualification &&
    record.activePlaySeconds >= CAMPAIGN_HISTORY_POLICY.activeSecondsForTimeQualification;

  const bySubstantialActions =
    record.meaningfulActionCount >= CAMPAIGN_HISTORY_POLICY.meaningfulActionsAloneQualification;

  const byLongParticipation =
    record.meaningfulActionCount >= CAMPAIGN_HISTORY_POLICY.minimumActionsForLongTimeQualification &&
    record.activePlaySeconds >= CAMPAIGN_HISTORY_POLICY.activeSecondsForLongTimeQualification;

  return byBalancedParticipation || bySubstantialActions || byLongParticipation;
}

function secondsBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.floor((to - from) / 1000);
}

/**
 * Adds active time conservatively. Long idle gaps are never counted in full.
 * This may be called from meaningful actions and authenticated activity pulses.
 */
export function addCappedActiveTime(
  record: CampaignParticipationRecord,
  activityAt: string,
): CampaignParticipationRecord {
  let added = 0;
  let sessionCount = record.sessionCount;

  if (record.lastActivityAt) {
    const gap = secondsBetween(record.lastActivityAt, activityAt);
    if (gap > 0) {
      added = Math.min(gap, CAMPAIGN_HISTORY_POLICY.activityWindowSeconds);
      if (gap >= CAMPAIGN_HISTORY_POLICY.newSessionGapSeconds) {
        sessionCount += 1;
      }
    }
  } else {
    sessionCount = Math.max(1, sessionCount);
  }

  return {
    ...record,
    activePlaySeconds: record.activePlaySeconds + added,
    sessionCount,
    lastActivityAt: activityAt,
    lastPlayedAt: activityAt,
    updatedAt: activityAt,
  };
}

export class CampaignParticipationLedgerService {
  constructor(private readonly storage: CampaignParticipationStoragePort) {}

  ensureJoined(input: {
    userId: number;
    campaignId: number;
    characterId?: number | null;
    campaignName: string;
    characterName?: string | null;
    hostUserId?: number | null;
    hostUsername?: string | null;
    rulesProfile?: string | null;
    joinedAt?: string;
  }): CampaignParticipationRecord {
    const existing = this.storage.getParticipation(input.userId, input.campaignId);
    if (existing) {
      const refreshed: CampaignParticipationRecord = {
        ...existing,
        characterId: input.characterId ?? existing.characterId,
        campaignNameSnapshot: input.campaignName || existing.campaignNameSnapshot,
        characterNameSnapshot: input.characterName ?? existing.characterNameSnapshot,
        hostUserIdSnapshot: input.hostUserId ?? existing.hostUserIdSnapshot,
        hostUsernameSnapshot: input.hostUsername ?? existing.hostUsernameSnapshot,
        rulesProfileSnapshot: input.rulesProfile ?? existing.rulesProfileSnapshot,
        currentAccessStatus: "active",
        updatedAt: input.joinedAt ?? new Date().toISOString(),
      };
      return this.storage.upsertParticipation(refreshed);
    }

    const now = input.joinedAt ?? new Date().toISOString();
    return this.storage.upsertParticipation({
      userId: input.userId,
      campaignId: input.campaignId,
      characterId: input.characterId ?? null,
      campaignNameSnapshot: input.campaignName,
      characterNameSnapshot: input.characterName ?? null,
      hostUserIdSnapshot: input.hostUserId ?? null,
      hostUsernameSnapshot: input.hostUsername ?? null,
      rulesProfileSnapshot: input.rulesProfile ?? null,
      firstJoinedAt: now,
      firstMeaningfulActionAt: null,
      lastMeaningfulActionAt: null,
      lastActivityAt: null,
      lastPlayedAt: null,
      meaningfulActionCount: 0,
      activePlaySeconds: 0,
      sessionCount: 0,
      qualifiedAt: null,
      currentAccessStatus: "active",
      updatedAt: now,
    });
  }

  /**
   * Call only after a canonical meaningful player action has been accepted exactly once.
   * Do not call on raw POST arrival before validation/idempotency.
   */
  recordMeaningfulAction(input: {
    userId: number;
    campaignId: number;
    actionAt?: string;
  }): CampaignParticipationRecord {
    const existing = this.storage.getParticipation(input.userId, input.campaignId);
    if (!existing) {
      throw new Error("Participation record must exist before recording meaningful play.");
    }

    const now = input.actionAt ?? new Date().toISOString();
    const withTime = addCappedActiveTime(existing, now);
    let next: CampaignParticipationRecord = {
      ...withTime,
      meaningfulActionCount: withTime.meaningfulActionCount + 1,
      firstMeaningfulActionAt: withTime.firstMeaningfulActionAt ?? now,
      lastMeaningfulActionAt: now,
      lastPlayedAt: now,
      updatedAt: now,
    };

    if (!next.qualifiedAt && qualifiesForCampaignHistory(next)) {
      next = { ...next, qualifiedAt: now };
    }

    return this.storage.upsertParticipation(next);
  }

  /**
   * Optional authenticated activity pulse. The client should send this only while campaign UI is visible
   * and the user has interacted recently. It does not increment meaningful actions.
   */
  recordActivityPulse(input: {
    userId: number;
    campaignId: number;
    activityAt?: string;
  }): CampaignParticipationRecord | undefined {
    const existing = this.storage.getParticipation(input.userId, input.campaignId);
    if (!existing || !existing.firstMeaningfulActionAt) return existing;

    const now = input.activityAt ?? new Date().toISOString();
    let next = addCappedActiveTime(existing, now);
    if (!next.qualifiedAt && qualifiesForCampaignHistory(next)) {
      next = { ...next, qualifiedAt: now };
    }
    return this.storage.upsertParticipation(next);
  }

  setAccessStatus(
    userId: number,
    campaignId: number,
    status: CampaignParticipationRecord["currentAccessStatus"],
  ): CampaignParticipationRecord | undefined {
    const existing = this.storage.getParticipation(userId, campaignId);
    if (!existing) return undefined;
    return this.storage.upsertParticipation({
      ...existing,
      currentAccessStatus: status,
      updatedAt: new Date().toISOString(),
    });
  }

  getCampaignHistory(userId: number): CampaignHistoryCard[] {
    return this.storage
      .getQualifiedCampaignHistory(userId)
      .filter((record) => !!record.qualifiedAt)
      .sort((a, b) => Date.parse(b.lastPlayedAt ?? b.qualifiedAt ?? "") - Date.parse(a.lastPlayedAt ?? a.qualifiedAt ?? ""))
      .map((record) => ({
        campaignId: record.campaignId,
        campaignName: record.campaignNameSnapshot,
        characterId: record.characterId,
        characterName: record.characterNameSnapshot,
        hostUsername: record.hostUsernameSnapshot,
        rulesProfile: record.rulesProfileSnapshot,
        firstPlayedAt: record.firstMeaningfulActionAt,
        lastPlayedAt: record.lastPlayedAt,
        activePlaySeconds: record.activePlaySeconds,
        sessionCount: record.sessionCount,
        currentAccessStatus: record.currentAccessStatus,
      }));
  }
}
