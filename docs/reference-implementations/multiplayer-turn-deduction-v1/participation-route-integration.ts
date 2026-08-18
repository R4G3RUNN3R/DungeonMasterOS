// Reference implementation only. Port selectively after comparing with the live server.

import type { CampaignParticipationLedgerService } from "./participation-ledger";

/**
 * Recommended account endpoint.
 *
 * GET /api/campaign-history
 *   auth required
 *   returns ONLY qualified historical participation for req.user.id
 *
 * Keep the existing GET /api/my-campaigns semantics as host/owner campaigns.
 */
export const CAMPAIGN_HISTORY_ROUTE = "/api/campaign-history" as const;

/**
 * Candidate participation should be initialized when an authenticated player actually establishes
 * campaign participation, normally when their character is created/joined in the campaign.
 */
export function onAuthenticatedCharacterJoined(input: {
  ledger: CampaignParticipationLedgerService;
  userId: number;
  campaignId: number;
  campaignName: string;
  hostUserId: number | null;
  hostUsername?: string | null;
  characterId: number;
  characterName: string;
  rulesProfile?: string | null;
  joinedAt?: string;
}) {
  return input.ledger.ensureJoined({
    userId: input.userId,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    hostUserId: input.hostUserId,
    hostUsername: input.hostUsername,
    characterId: input.characterId,
    characterName: input.characterName,
    rulesProfile: input.rulesProfile,
    joinedAt: input.joinedAt,
  });
}

/**
 * Call only AFTER the player's canonical gameplay contribution is accepted and persisted.
 * Do not wait for the AI provider response; participation is about what the player actually did.
 *
 * Good sourceKey examples:
 *   `message:${playerMessage.id}`
 *   `campaign_event:${event.id}`
 *   `batch_action:${batchAction.id}`
 */
export function onCanonicalMeaningfulAction(input: {
  ledger: CampaignParticipationLedgerService;
  userId: number;
  campaignId: number;
  sourceKey: string;
  actionAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  return input.ledger.recordMeaningfulAction({
    userId: input.userId,
    campaignId: input.campaignId,
    sourceKey: input.sourceKey,
    actionAt: input.actionAt,
    metadata: input.metadata,
  });
}

/**
 * Optional active-time support.
 *
 * Do NOT accept arbitrary sourceKey values from the browser.
 * The server should issue a campaign-presence session id and derive a time bucket itself, e.g.
 * `presence:${serverSessionId}:minute:${Math.floor(Date.now()/60000)}`.
 *
 * Rate limit to roughly one accepted pulse per minute and accept only while:
 * - user is authenticated
 * - user is a current participant
 * - campaign view is subscribed/active
 * - the client reports recent interaction/visibility
 * - the player has already produced at least one meaningful action
 *
 * This feature is approximate engagement accounting, not payroll software.
 */
export function onValidatedActivityPulse(input: {
  ledger: CampaignParticipationLedgerService;
  userId: number;
  campaignId: number;
  serverSessionId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const minuteBucket = Math.floor(now.getTime() / 60000);
  return input.ledger.recordActivityPulse({
    userId: input.userId,
    campaignId: input.campaignId,
    sourceKey: `presence:${input.serverSessionId}:minute:${minuteBucket}`,
    activityAt: now.toISOString(),
  });
}

/**
 * CURRENT GITHUB INTEGRATION TARGETS
 *
 * server/routes.ts
 *
 * - POST /api/campaigns/:id/characters
 *     after authenticated character creation, ensure candidate participation row
 *
 * - POST /api/campaigns/:id/action
 *     after playerMsg is successfully persisted, call onCanonicalMeaningfulAction using playerMsg.id
 *
 * - POST /api/items/:id/use
 *     if the item-use action is canonical gameplay, count the persisted player message once
 *
 * - future multiplayer batch endpoint
 *     count each accepted player's canonical batch action once, not the entire batch once
 *
 * - GET /api/campaign-history
 *     return ledger.getCampaignHistory(req.user.id)
 *
 * - WebSocket presence or authenticated HTTP activity pulse
 *     optional, rate-limited, server-keyed active-time accounting
 *
 * client/src/pages/dashboard.tsx
 *
 * - preserve current My Campaigns list for owned campaigns
 * - add Campaign History section/query for /api/campaign-history
 * - do not display unqualified candidate participation
 */
