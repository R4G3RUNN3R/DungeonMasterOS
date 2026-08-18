// Production database consistency checks (2026-08-18 investigation).
//
// DMOS's actual schema is simpler than a generic "inventory vs equipment vs
// cache vs websocket" system might suggest: `equipped`/`carried` are plain
// columns directly on the `items` row, not a separate equipment table
// referencing item ids, and there's no cache layer or vector store (verified
// via grep — see the investigation notes). So "equipment references a
// missing item" or "cache differs from database" cannot occur by
// construction. What CAN genuinely go wrong is enumerated below; each
// checker queries the real tables directly (not a cache, not a client's
// view of them) since the database is the one canonical source of truth.

import { db } from "./storage";
import { items, characterCurrencies, characters, encounters, campaigns } from "../shared/schema";

export interface IntegrityIssue {
  check: string;
  severity: "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
}

export function runDataIntegrityChecks(): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  const allCharacters = db.select().from(characters).all();
  const characterIds = new Set(allCharacters.map((c) => c.id));

  const allItems = db.select().from(items).all();
  for (const item of allItems) {
    if (item.quantity < 0) {
      issues.push({
        check: "negative_item_quantity",
        severity: "critical",
        message: `Item ${item.id} ("${item.name}") has a negative quantity.`,
        details: { itemId: item.id, characterId: item.characterId, quantity: item.quantity },
      });
    }
    if (!characterIds.has(item.characterId)) {
      issues.push({
        check: "orphaned_item",
        severity: "critical",
        message: `Item ${item.id} ("${item.name}") references character ${item.characterId}, which does not exist.`,
        details: { itemId: item.id, characterId: item.characterId },
      });
    }
  }

  const allCurrencies = db.select().from(characterCurrencies).all();
  for (const balance of allCurrencies) {
    if (balance.amount < 0) {
      issues.push({
        check: "negative_currency_balance",
        severity: "critical",
        message: `Character ${balance.characterId}'s ${balance.currencyCode} balance is negative (${balance.amount}).`,
        details: { characterId: balance.characterId, currencyCode: balance.currencyCode, amount: balance.amount },
      });
    }
    if (!characterIds.has(balance.characterId)) {
      issues.push({
        check: "orphaned_currency_balance",
        severity: "critical",
        message: `A ${balance.currencyCode} balance references character ${balance.characterId}, which does not exist.`,
        details: { characterId: balance.characterId, currencyCode: balance.currencyCode },
      });
    }
  }

  const allEncounters = db.select().from(encounters).all();
  const activeByCampaign = new Map<number, number[]>();
  for (const encounter of allEncounters) {
    if (encounter.status !== "active") continue;
    const list = activeByCampaign.get(encounter.campaignId) ?? [];
    list.push(encounter.id);
    activeByCampaign.set(encounter.campaignId, list);
  }
  for (const [campaignId, encounterIds] of activeByCampaign) {
    if (encounterIds.length > 1) {
      issues.push({
        check: "multiple_active_encounters",
        severity: "critical",
        message: `Campaign ${campaignId} has ${encounterIds.length} simultaneously active encounters; only one should ever be active at a time.`,
        details: { campaignId, encounterIds },
      });
    }
  }

  const allCampaigns = db.select().from(campaigns).all();
  for (const campaign of allCampaigns) {
    if (!campaign.worldState) continue;
    try {
      JSON.parse(campaign.worldState);
    } catch {
      issues.push({
        check: "unparsable_world_state",
        severity: "warning",
        message: `Campaign ${campaign.id}'s world_state is not valid JSON — it silently falls back to an empty state on every read.`,
        details: { campaignId: campaign.id },
      });
    }
  }

  return issues;
}
