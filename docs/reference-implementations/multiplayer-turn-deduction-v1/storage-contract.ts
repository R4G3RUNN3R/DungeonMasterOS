// Reference implementation only. Adapt these operations to the live storage layer rather than creating duplicate state.

import type {
  CampaignIdentity,
  CampaignParticipant,
  CampaignTurnDeductionSetting,
  TurnDeductionAcknowledgement,
  TurnDeductionEventType,
  TurnDeductionMode,
} from "./domain";

export type PersistTurnDeductionEvent = {
  campaignId: number;
  eventType: TurnDeductionEventType;
  actorUserId?: number | null;
  sourceUserId?: number | null;
  mode?: TurnDeductionMode | null;
  revision?: number | null;
  generationId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export interface TurnDeductionStoragePort {
  getCampaign(campaignId: number): CampaignIdentity | undefined;
  getTurnDeductionSetting(campaignId: number): CampaignTurnDeductionSetting | undefined;
  upsertTurnDeductionSetting(setting: CampaignTurnDeductionSetting): CampaignTurnDeductionSetting;

  /** Host OR character ownership may establish campaign participation. Do not trust a client-supplied participant list. */
  getCampaignParticipant(campaignId: number, userId: number): CampaignParticipant | undefined;
  getCampaignParticipants(campaignId: number): CampaignParticipant[];

  getTurnDeductionAcknowledgement(
    campaignId: number,
    userId: number,
    revision: number,
  ): TurnDeductionAcknowledgement | undefined;
  upsertTurnDeductionAcknowledgement(
    acknowledgement: TurnDeductionAcknowledgement,
  ): TurnDeductionAcknowledgement;

  appendTurnDeductionEvent(event: PersistTurnDeductionEvent): void;
}

/**
 * Turn allowance is intentionally a port. The live server may already have safer accounting than main.
 * Reuse the live implementation where it is better.
 *
 * A generation reservation must be idempotent by generationId and concurrency-safe.
 */
export interface TurnAllowancePort {
  checkAvailable(userId: number): Promise<{
    ok: boolean;
    remaining?: number;
    reason?: string;
  }>;

  reserve(input: {
    userId: number;
    campaignId: number;
    generationId: string;
  }): Promise<{
    reservationId: string;
    alreadyReserved: boolean;
  }>;

  /** Commit exactly once after a successful authoritative AI DM generation. */
  commit(reservationId: string): Promise<void>;

  /** Release/refund a reservation after provider failure, cancellation, timeout, or non-AI fallback. */
  release(reservationId: string, reason: string): Promise<void>;
}

/**
 * Recommended participation adapter for the current repo:
 * - campaign.userId is the host account
 * - characters.userId identifies authenticated campaign players
 *
 * Do not use visitorId as the selected-account identity when a real userId exists.
 */
export function uniqueParticipants(
  campaign: CampaignIdentity,
  characters: Array<{ campaignId: number; userId: number | null; id: number }>,
): CampaignParticipant[] {
  const byUser = new Map<number, CampaignParticipant>();

  if (campaign.userId) {
    byUser.set(campaign.userId, { campaignId: campaign.id, userId: campaign.userId });
  }

  for (const character of characters) {
    if (!character.userId) continue;
    if (!byUser.has(character.userId)) {
      byUser.set(character.userId, {
        campaignId: campaign.id,
        userId: character.userId,
        characterId: character.id,
      });
    }
  }

  return [...byUser.values()];
}
