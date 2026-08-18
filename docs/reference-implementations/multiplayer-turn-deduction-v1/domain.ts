// Reference implementation only. This directory is outside the current app build.

export const TURN_DEDUCTION_MODES = ["host", "individual", "selected"] as const;
export type TurnDeductionMode = (typeof TURN_DEDUCTION_MODES)[number];

export const TURN_DEDUCTION_STATUSES = ["active", "setup_required", "blocked"] as const;
export type TurnDeductionStatus = (typeof TURN_DEDUCTION_STATUSES)[number];

export type CampaignTurnDeductionSetting = {
  campaignId: number;
  /** Effective mode. A pending selected-player request does not replace this until accepted. */
  mode: TurnDeductionMode;
  status: TurnDeductionStatus;
  selectedUserId: number | null;
  revision: number;
  configuredByUserId: number | null;
  configuredAt: string | null;

  pendingMode: TurnDeductionMode | null;
  pendingSelectedUserId: number | null;
  pendingRequestedByUserId: number | null;
  pendingRequestedAt: string | null;

  updatedAt: string;
};

export type TurnDeductionAcknowledgement = {
  campaignId: number;
  userId: number;
  revision: number;
  acceptedAt: string;
};

export type TurnDeductionEventType =
  | "setup_required"
  | "configured"
  | "selected_requested"
  | "selected_accepted"
  | "selected_declined"
  | "selected_revoked"
  | "source_unavailable"
  | "generation_reserved"
  | "generation_committed"
  | "generation_released";

export type TurnDeductionEvent = {
  id: number;
  campaignId: number;
  eventType: TurnDeductionEventType;
  actorUserId: number | null;
  sourceUserId: number | null;
  mode: TurnDeductionMode | null;
  revision: number | null;
  generationId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type CampaignIdentity = {
  id: number;
  /** Current repository campaign owner account id. */
  userId: number | null;
};

export type CampaignParticipant = {
  campaignId: number;
  userId: number;
  characterId?: number;
  username?: string;
};

export type TurnSourceResolution = {
  campaignId: number;
  actorUserId: number;
  sourceUserId: number;
  mode: TurnDeductionMode;
  revision: number;
  displayLabel: string;
};

export type TurnDeductionFailureCode =
  | "TURN_DEDUCTION_SETUP_REQUIRED"
  | "TURN_DEDUCTION_ACK_REQUIRED"
  | "TURN_SOURCE_UNAVAILABLE"
  | "TURN_SOURCE_NOT_PARTICIPANT"
  | "TURN_SOURCE_NOT_ACCEPTED"
  | "TURN_SOURCE_NO_ALLOWANCE"
  | "CAMPAIGN_OWNER_MISSING"
  | "CAMPAIGN_NOT_FOUND";

export class TurnDeductionError extends Error {
  readonly code: TurnDeductionFailureCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: TurnDeductionFailureCode,
    message: string,
    status = 409,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TurnDeductionError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type ConfigureTurnDeductionRequest =
  | { mode: "host" }
  | { mode: "individual" }
  | { mode: "selected"; selectedUserId: number };

export type PlayerFacingTurnDeductionState = {
  mode: TurnDeductionMode;
  status: TurnDeductionStatus;
  revision: number;
  label: string;
  selectedUserId: number | null;
  selectedUsername?: string;
  requiresAcknowledgement: boolean;
  hasAcknowledged: boolean;
  pendingRequestForCurrentUser: boolean;
  pendingSelectedUserId: number | null;
};

/**
 * Existing campaigns without a persisted row retain today's behavior.
 * Migration should persist an explicit row, but this fallback keeps reads safe during rollout.
 */
export function legacyCompatibilitySetting(campaignId: number, now = new Date().toISOString()): CampaignTurnDeductionSetting {
  return {
    campaignId,
    mode: "individual",
    status: "active",
    selectedUserId: null,
    revision: 0,
    configuredByUserId: null,
    configuredAt: null,
    pendingMode: null,
    pendingSelectedUserId: null,
    pendingRequestedByUserId: null,
    pendingRequestedAt: null,
    updatedAt: now,
  };
}
