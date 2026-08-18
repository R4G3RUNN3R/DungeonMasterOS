// Reference implementation only. Intended to be ported into server/ after comparison with live production.

import {
  type CampaignTurnDeductionSetting,
  type ConfigureTurnDeductionRequest,
  type PlayerFacingTurnDeductionState,
  type TurnSourceResolution,
  TurnDeductionError,
  legacyCompatibilitySetting,
} from "./domain";
import type { TurnAllowancePort, TurnDeductionStoragePort } from "./storage-contract";

function nowIso(): string {
  return new Date().toISOString();
}

function clearPending(setting: CampaignTurnDeductionSetting): CampaignTurnDeductionSetting {
  return {
    ...setting,
    pendingMode: null,
    pendingSelectedUserId: null,
    pendingRequestedByUserId: null,
    pendingRequestedAt: null,
  };
}

function labelFor(setting: CampaignTurnDeductionSetting, selectedUsername?: string): string {
  if (setting.status === "setup_required") return "Setup Required";
  if (setting.status === "blocked") return "Unavailable - Action Required";
  if (setting.mode === "host") return "Campaign Host";
  if (setting.mode === "individual") return "Each Player";
  return selectedUsername || "Selected Player";
}

export class TurnDeductionService {
  constructor(
    private readonly storage: TurnDeductionStoragePort,
    private readonly allowance: TurnAllowancePort,
  ) {}

  getEffectiveSetting(campaignId: number): CampaignTurnDeductionSetting {
    return this.storage.getTurnDeductionSetting(campaignId) ?? legacyCompatibilitySetting(campaignId);
  }

  /**
   * New campaigns should get a persisted setup_required row.
   * Existing campaigns should be migrated to active individual mode separately.
   */
  initializeNewCampaign(campaignId: number, hostUserId: number): CampaignTurnDeductionSetting {
    const existing = this.storage.getTurnDeductionSetting(campaignId);
    if (existing) return existing;

    const created: CampaignTurnDeductionSetting = {
      campaignId,
      mode: "individual",
      status: "setup_required",
      selectedUserId: null,
      revision: 1,
      configuredByUserId: hostUserId,
      configuredAt: null,
      pendingMode: null,
      pendingSelectedUserId: null,
      pendingRequestedByUserId: null,
      pendingRequestedAt: null,
      updatedAt: nowIso(),
    };
    const saved = this.storage.upsertTurnDeductionSetting(created);
    this.storage.appendTurnDeductionEvent({
      campaignId,
      eventType: "setup_required",
      actorUserId: hostUserId,
      mode: "individual",
      revision: saved.revision,
    });
    return saved;
  }

  /** Existing campaigns must retain current behavior: each request user's turns are used. */
  migrateLegacyCampaign(campaignId: number): CampaignTurnDeductionSetting {
    const existing = this.storage.getTurnDeductionSetting(campaignId);
    if (existing) return existing;
    const migrated = legacyCompatibilitySetting(campaignId);
    return this.storage.upsertTurnDeductionSetting({
      ...migrated,
      status: "active",
      revision: 1,
      configuredAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  configure(
    campaignId: number,
    requestingUserId: number,
    request: ConfigureTurnDeductionRequest,
  ): CampaignTurnDeductionSetting {
    const campaign = this.storage.getCampaign(campaignId);
    if (!campaign) throw new TurnDeductionError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
    if (!campaign.userId || campaign.userId !== requestingUserId) {
      throw new TurnDeductionError(
        "TURN_SOURCE_UNAVAILABLE",
        "Only the campaign host can change AI turn deduction settings.",
        403,
      );
    }

    const current = this.getEffectiveSetting(campaignId);
    const timestamp = nowIso();

    if (request.mode === "selected") {
      if (request.selectedUserId === requestingUserId) {
        // Host selecting themselves is equivalent to host mode and needs no third-party approval.
        return this.configure(campaignId, requestingUserId, { mode: "host" });
      }

      const participant = this.storage.getCampaignParticipant(campaignId, request.selectedUserId);
      if (!participant) {
        throw new TurnDeductionError(
          "TURN_SOURCE_NOT_PARTICIPANT",
          "The selected account must be an authenticated participant in this campaign.",
          400,
        );
      }

      const pending = this.storage.upsertTurnDeductionSetting({
        ...current,
        pendingMode: "selected",
        pendingSelectedUserId: request.selectedUserId,
        pendingRequestedByUserId: requestingUserId,
        pendingRequestedAt: timestamp,
        updatedAt: timestamp,
      });
      this.storage.appendTurnDeductionEvent({
        campaignId,
        eventType: "selected_requested",
        actorUserId: requestingUserId,
        sourceUserId: request.selectedUserId,
        mode: "selected",
        revision: current.revision,
      });
      return pending;
    }

    const nextRevision = current.revision + 1;
    const next = clearPending({
      ...current,
      mode: request.mode,
      status: "active",
      selectedUserId: null,
      revision: nextRevision,
      configuredByUserId: requestingUserId,
      configuredAt: timestamp,
      updatedAt: timestamp,
    });

    const saved = this.storage.upsertTurnDeductionSetting(next);
    this.storage.appendTurnDeductionEvent({
      campaignId,
      eventType: "configured",
      actorUserId: requestingUserId,
      sourceUserId: request.mode === "host" ? requestingUserId : null,
      mode: request.mode,
      revision: nextRevision,
    });
    return saved;
  }

  acceptSelected(campaignId: number, acceptingUserId: number): CampaignTurnDeductionSetting {
    const current = this.getEffectiveSetting(campaignId);
    if (current.pendingMode !== "selected" || current.pendingSelectedUserId !== acceptingUserId) {
      throw new TurnDeductionError("TURN_SOURCE_NOT_ACCEPTED", "There is no pending turn-usage request for this account.", 409);
    }
    if (!this.storage.getCampaignParticipant(campaignId, acceptingUserId)) {
      throw new TurnDeductionError("TURN_SOURCE_NOT_PARTICIPANT", "You are no longer a participant in this campaign.", 409);
    }

    const timestamp = nowIso();
    const revision = current.revision + 1;
    const saved = this.storage.upsertTurnDeductionSetting(clearPending({
      ...current,
      mode: "selected",
      status: "active",
      selectedUserId: acceptingUserId,
      revision,
      configuredByUserId: current.pendingRequestedByUserId,
      configuredAt: timestamp,
      updatedAt: timestamp,
    }));

    this.storage.upsertTurnDeductionAcknowledgement({
      campaignId,
      userId: acceptingUserId,
      revision,
      acceptedAt: timestamp,
    });
    this.storage.appendTurnDeductionEvent({
      campaignId,
      eventType: "selected_accepted",
      actorUserId: acceptingUserId,
      sourceUserId: acceptingUserId,
      mode: "selected",
      revision,
    });
    return saved;
  }

  declineSelected(campaignId: number, decliningUserId: number): CampaignTurnDeductionSetting {
    const current = this.getEffectiveSetting(campaignId);
    if (current.pendingMode !== "selected" || current.pendingSelectedUserId !== decliningUserId) {
      throw new TurnDeductionError("TURN_SOURCE_NOT_ACCEPTED", "There is no pending turn-usage request for this account.", 409);
    }
    const saved = this.storage.upsertTurnDeductionSetting({
      ...clearPending(current),
      updatedAt: nowIso(),
    });
    this.storage.appendTurnDeductionEvent({
      campaignId,
      eventType: "selected_declined",
      actorUserId: decliningUserId,
      sourceUserId: decliningUserId,
      mode: "selected",
      revision: current.revision,
    });
    return saved;
  }

  revokeSelected(campaignId: number, userId: number): CampaignTurnDeductionSetting {
    const current = this.getEffectiveSetting(campaignId);
    if (current.mode !== "selected" || current.selectedUserId !== userId || current.status !== "active") {
      throw new TurnDeductionError("TURN_SOURCE_UNAVAILABLE", "This account is not the active selected turn source.", 409);
    }
    const revision = current.revision + 1;
    const saved = this.storage.upsertTurnDeductionSetting({
      ...current,
      status: "blocked",
      revision,
      updatedAt: nowIso(),
    });
    this.storage.appendTurnDeductionEvent({
      campaignId,
      eventType: "selected_revoked",
      actorUserId: userId,
      sourceUserId: userId,
      mode: "selected",
      revision,
    });
    return saved;
  }

  acknowledgeIndividual(campaignId: number, userId: number): void {
    const setting = this.getEffectiveSetting(campaignId);
    if (setting.mode !== "individual" || setting.status !== "active") {
      throw new TurnDeductionError("TURN_DEDUCTION_ACK_REQUIRED", "The campaign is not currently using individual turn deduction.", 409);
    }
    if (!this.storage.getCampaignParticipant(campaignId, userId)) {
      throw new TurnDeductionError("TURN_SOURCE_NOT_PARTICIPANT", "Only campaign participants can acknowledge turn usage.", 403);
    }
    this.storage.upsertTurnDeductionAcknowledgement({
      campaignId,
      userId,
      revision: setting.revision,
      acceptedAt: nowIso(),
    });
  }

  resolveSource(campaignId: number, actorUserId: number): TurnSourceResolution {
    const campaign = this.storage.getCampaign(campaignId);
    if (!campaign) throw new TurnDeductionError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
    const setting = this.getEffectiveSetting(campaignId);
    const participants = this.storage.getCampaignParticipants(campaignId);
    const multiplayer = new Set(participants.map((p) => p.userId)).size > 1;

    if (setting.status === "setup_required" && multiplayer) {
      throw new TurnDeductionError(
        "TURN_DEDUCTION_SETUP_REQUIRED",
        "Choose where AI Dungeon Master turns should be deducted from before multiplayer play continues.",
        409,
      );
    }
    if (setting.status === "blocked") {
      throw new TurnDeductionError(
        "TURN_SOURCE_UNAVAILABLE",
        "The configured AI turn source is unavailable. The campaign host must choose another turn-deduction option.",
        409,
      );
    }

    if (setting.mode === "host") {
      if (!campaign.userId) throw new TurnDeductionError("CAMPAIGN_OWNER_MISSING", "This campaign has no authenticated host account.", 409);
      return {
        campaignId,
        actorUserId,
        sourceUserId: campaign.userId,
        mode: "host",
        revision: setting.revision,
        displayLabel: "Campaign Host",
      };
    }

    if (setting.mode === "individual") {
      if (!this.storage.getCampaignParticipant(campaignId, actorUserId)) {
        throw new TurnDeductionError("TURN_SOURCE_NOT_PARTICIPANT", "The acting account is not an authenticated campaign participant.", 403);
      }
      const ack = this.storage.getTurnDeductionAcknowledgement(campaignId, actorUserId, setting.revision);
      if (multiplayer && setting.configuredAt && !ack) {
        throw new TurnDeductionError(
          "TURN_DEDUCTION_ACK_REQUIRED",
          "Confirm that your AI-triggering actions will use your own available turns before continuing.",
          409,
          { revision: setting.revision },
        );
      }
      return {
        campaignId,
        actorUserId,
        sourceUserId: actorUserId,
        mode: "individual",
        revision: setting.revision,
        displayLabel: "Each Player",
      };
    }

    if (!setting.selectedUserId) {
      throw new TurnDeductionError("TURN_SOURCE_UNAVAILABLE", "No selected player is available for AI turn deduction.", 409);
    }
    if (!this.storage.getCampaignParticipant(campaignId, setting.selectedUserId)) {
      throw new TurnDeductionError("TURN_SOURCE_NOT_PARTICIPANT", "The selected turn source is no longer a campaign participant.", 409);
    }
    const accepted = this.storage.getTurnDeductionAcknowledgement(campaignId, setting.selectedUserId, setting.revision);
    if (!accepted) {
      throw new TurnDeductionError("TURN_SOURCE_NOT_ACCEPTED", "The selected player has not accepted turn usage for the current policy.", 409);
    }
    return {
      campaignId,
      actorUserId,
      sourceUserId: setting.selectedUserId,
      mode: "selected",
      revision: setting.revision,
      displayLabel: "Selected Player",
    };
  }

  async reserveGeneration(campaignId: number, actorUserId: number, generationId: string) {
    const resolution = this.resolveSource(campaignId, actorUserId);
    const allowance = await this.allowance.checkAvailable(resolution.sourceUserId);
    if (!allowance.ok) {
      throw new TurnDeductionError(
        "TURN_SOURCE_NO_ALLOWANCE",
        "The configured turn source has no AI Dungeon Master turns available.",
        403,
        { sourceUserId: resolution.sourceUserId },
      );
    }

    const reservation = await this.allowance.reserve({
      userId: resolution.sourceUserId,
      campaignId,
      generationId,
    });
    this.storage.appendTurnDeductionEvent({
      campaignId,
      eventType: "generation_reserved",
      actorUserId,
      sourceUserId: resolution.sourceUserId,
      mode: resolution.mode,
      revision: resolution.revision,
      generationId,
    });
    return { resolution, reservation };
  }

  async commitGeneration(input: {
    campaignId: number;
    actorUserId: number;
    sourceUserId: number;
    mode: "host" | "individual" | "selected";
    revision: number;
    generationId: string;
    reservationId: string;
  }): Promise<void> {
    await this.allowance.commit(input.reservationId);
    this.storage.appendTurnDeductionEvent({
      campaignId: input.campaignId,
      eventType: "generation_committed",
      actorUserId: input.actorUserId,
      sourceUserId: input.sourceUserId,
      mode: input.mode,
      revision: input.revision,
      generationId: input.generationId,
    });
  }

  async releaseGeneration(input: {
    campaignId: number;
    actorUserId: number;
    sourceUserId: number;
    mode: "host" | "individual" | "selected";
    revision: number;
    generationId: string;
    reservationId: string;
    reason: string;
  }): Promise<void> {
    await this.allowance.release(input.reservationId, input.reason);
    this.storage.appendTurnDeductionEvent({
      campaignId: input.campaignId,
      eventType: "generation_released",
      actorUserId: input.actorUserId,
      sourceUserId: input.sourceUserId,
      mode: input.mode,
      revision: input.revision,
      generationId: input.generationId,
      metadata: { reason: input.reason },
    });
  }

  getPlayerFacingState(campaignId: number, currentUserId: number, selectedUsername?: string): PlayerFacingTurnDeductionState {
    const setting = this.getEffectiveSetting(campaignId);
    const ack = this.storage.getTurnDeductionAcknowledgement(campaignId, currentUserId, setting.revision);
    return {
      mode: setting.mode,
      status: setting.status,
      revision: setting.revision,
      label: labelFor(setting, selectedUsername),
      selectedUserId: setting.selectedUserId,
      selectedUsername,
      requiresAcknowledgement: setting.mode === "individual" && setting.status === "active",
      hasAcknowledged: !!ack,
      pendingRequestForCurrentUser:
        setting.pendingMode === "selected" && setting.pendingSelectedUserId === currentUserId,
      pendingSelectedUserId: setting.pendingSelectedUserId,
    };
  }
}
