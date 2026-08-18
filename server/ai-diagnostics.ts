// Safe, low-cardinality diagnostic logging for the DM AI pipeline.
//
// Purpose (2026-08-18 production investigation): when the AI DM contradicts
// live game state, we need to answer "what did DungeonMasterOS tell the AI
// was true before this response was generated?" and "what state changes did
// it propose, and which were actually applied?" without diagnosing blind.
//
// These are plain structured console.log lines (stdout is captured by
// systemd/journald in production — `journalctl -u dmos`), not a new logging
// service. Never log full item descriptions, currency totals tied to a
// specific value beyond what's needed, campaign narration text, or any
// auth/session/credential data — only counts, ids, and short hashes.

import { createHash } from "node:crypto";

export function hashSnapshot(value: unknown): string {
  const json = JSON.stringify(value ?? null);
  return createHash("sha256").update(json).digest("hex").slice(0, 12);
}

export type AiGenerationPurpose = "main_action" | "item_use" | "opening_scene";

export interface AiContextSnapshotEntry {
  purpose: AiGenerationPurpose;
  campaignId: number;
  characterIds: number[];
  triggerMessageId: number | null;
  provider: string;
  promptVersion: string;
  sceneHash: string;
  inventoryHash: string;
  currencyHash: string;
  combatActive: boolean;
}

export function logAiContextSnapshot(entry: AiContextSnapshotEntry): void {
  console.log(
    JSON.stringify({
      tag: "ai_context_snapshot",
      ts: new Date().toISOString(),
      ...entry,
    }),
  );
}

export interface AiMutationSummary {
  campaignId: number;
  characterId: number;
  narrationMessageId: number;
  proposedItemGrants: number;
  acceptedItemGrants: number;
  proposedItemLosses: number;
  acceptedItemLosses: number;
  proposedCurrencyChanges: Array<{ currencyCode: string; amount: number }>;
  acceptedCurrencyChanges: Array<{ currencyCode: string; amount: number }>;
  rejectedCurrencyChanges: Array<{ currencyCode: string; amount: number; reason: string }>;
}

export function logAiMutations(entry: AiMutationSummary): void {
  console.log(
    JSON.stringify({
      tag: "ai_mutations",
      ts: new Date().toISOString(),
      ...entry,
    }),
  );
}
