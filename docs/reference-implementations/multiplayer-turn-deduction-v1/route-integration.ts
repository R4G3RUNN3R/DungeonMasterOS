// Reference implementation only. Port into live server/routes.ts or equivalent after comparison.

import { randomUUID } from "crypto";
import type { TurnDeductionService } from "./turn-deduction-service";
import { TurnDeductionError } from "./domain";

export function serializeTurnDeductionError(error: unknown) {
  if (!(error instanceof TurnDeductionError)) return null;
  return {
    status: error.status,
    body: {
      message: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}

/**
 * Routes to add/reuse in the live server.
 *
 * GET  /api/campaigns/:id/turn-deduction
 * PATCH /api/campaigns/:id/turn-deduction
 * POST /api/campaigns/:id/turn-deduction/acknowledge
 * POST /api/campaigns/:id/turn-deduction/accept-selected
 * POST /api/campaigns/:id/turn-deduction/decline-selected
 * POST /api/campaigns/:id/turn-deduction/revoke-selected
 *
 * All mutation routes require authentication.
 * PATCH is host-only inside TurnDeductionService.configure().
 */
export const TURN_DEDUCTION_ROUTE_CONTRACT = {
  get: {
    response: "PlayerFacingTurnDeductionState",
  },
  patch: {
    body: [
      { mode: "host" },
      { mode: "individual" },
      { mode: "selected", selectedUserId: 123 },
    ],
  },
} as const;

/**
 * This is the important replacement for today's route shape:
 *
 * OLD:
 *   checkTurnLimit(req.user)
 *   generateDMResponse(...)
 *   incrementTurnCount(req.user.id)
 *
 * NEW:
 *   reserve source resolved from campaign policy
 *   generateDMResponse(...)
 *   commit reservation on success
 *   release reservation on provider failure/non-AI fallback
 *
 * Do not leave checkTurnLimit middleware on AI routes if it still checks req.user;
 * that would reject the wrong player under host/selected mode.
 */
export async function withCampaignTurnReservation<T>(input: {
  turnDeduction: TurnDeductionService;
  campaignId: number;
  actorUserId: number;
  generate: () => Promise<T>;
  /** Return true only when a real authoritative AI DM generation succeeded and should consume one AI Turn. */
  shouldCommit: (result: T) => boolean;
}): Promise<T> {
  const generationId = randomUUID();
  const reserved = await input.turnDeduction.reserveGeneration(
    input.campaignId,
    input.actorUserId,
    generationId,
  );

  try {
    const result = await input.generate();
    const common = {
      campaignId: input.campaignId,
      actorUserId: input.actorUserId,
      sourceUserId: reserved.resolution.sourceUserId,
      mode: reserved.resolution.mode,
      revision: reserved.resolution.revision,
      generationId,
      reservationId: reserved.reservation.reservationId,
    } as const;

    if (input.shouldCommit(result)) {
      await input.turnDeduction.commitGeneration(common);
    } else {
      await input.turnDeduction.releaseGeneration({
        ...common,
        reason: "non_ai_or_fallback_response",
      });
    }
    return result;
  } catch (error) {
    await input.turnDeduction.releaseGeneration({
      campaignId: input.campaignId,
      actorUserId: input.actorUserId,
      sourceUserId: reserved.resolution.sourceUserId,
      mode: reserved.resolution.mode,
      revision: reserved.resolution.revision,
      generationId,
      reservationId: reserved.reservation.reservationId,
      reason: "generation_failed",
    });
    throw error;
  }
}

/**
 * Integration targets in the CURRENT GitHub server:
 *
 * 1. POST /api/campaigns/:id/action
 *    - remove request-user checkTurnLimit middleware
 *    - resolve/reserve using campaignId + req.user.id
 *    - actor remains the player's character; deduction account may differ
 *    - commit after valid Anthropic DM response is persisted
 *    - release if Anthropic fails and the server returns a local fallback/system message
 *
 * 2. POST /api/items/:id/use
 *    - same policy; using an item can trigger a DM generation and must not bypass campaign turn deduction
 *
 * 3. POST /api/campaigns/:id/start
 *    - same policy. Under individual mode the authenticated user initiating the opening scene is the actor/source.
 *    - under host/selected mode resolve configured source normally.
 *
 * 4. Any future retry/regenerate/continue/GM-assistant endpoint
 *    - must use this same resolver. Do not create a second billing path.
 *
 * 5. Campaign creation
 *    - call initializeNewCampaign(campaign.id, req.user.id)
 *
 * 6. Campaign character join / multiplayer activation
 *    - broadcast `turn_deduction_updated` / `turn_deduction_setup_required` so all clients refresh the top indicator.
 */

export const TURN_DEDUCTION_WEBSOCKET_EVENTS = [
  "turn_deduction_updated",
  "turn_deduction_request",
  "turn_deduction_setup_required",
  "turn_deduction_source_unavailable",
] as const;
