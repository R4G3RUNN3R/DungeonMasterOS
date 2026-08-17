// Reference implementation only.
// This is a Drizzle-shaped persistence proposal for comparison with production.
// Do not apply blindly if the live VPS already has stronger normalized rules storage.

import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Campaign-selected rules profile. A future generic version should serve every
 * rules engine, not one table per edition.
 */
export const referenceCampaignRulesProfiles = sqliteTable(
  "campaign_rules_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull(),
    rulesetId: text("ruleset_id").notNull(), // dnd35-core, dnd5e-2014, dnd5e-2024, pf1e, etc.
    rulesetVersion: integer("ruleset_version").notNull().default(1),
    sourcePolicyJson: text("source_policy_json").notNull().default("{}"),
    settingsJson: text("settings_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    oneProfilePerCampaign: uniqueIndex("campaign_rules_profile_unique").on(table.campaignId),
  }),
);

/**
 * One canonical versioned rules state per character.
 *
 * The JSON value is a typed Dnd35CharacterState, NOT the UI sheet object.
 * A version column allows deterministic migrations.
 */
export const referenceCharacterRulesState = sqliteTable(
  "character_rules_state",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    characterId: integer("character_id").notNull(),
    campaignId: integer("campaign_id").notNull(),
    rulesetId: text("ruleset_id").notNull(),
    stateVersion: integer("state_version").notNull(),
    stateJson: text("state_json").notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    oneStatePerCharacter: uniqueIndex("character_rules_state_unique").on(table.characterId),
  }),
);

/**
 * Optional append-only audit/event ledger. This is useful for level-up choices,
 * XP awards, correction/undo and debugging, while `character_rules_state`
 * remains the fast current snapshot.
 */
export const referenceCharacterRuleEvents = sqliteTable("character_rule_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  characterId: integer("character_id").notNull(),
  rulesetId: text("ruleset_id").notNull(),
  eventType: text("event_type").notNull(),
  eventKey: text("event_key").notNull(), // idempotency/deduplication key
  payloadJson: text("payload_json").notNull().default("{}"),
  sourceMessageId: integer("source_message_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

/**
 * If production has no generic rules-data field for items/effects, prefer adding
 * one generic column rather than D&D-specific columns to shared tables.
 *
 * Proposed additions, not complete table replacements:
 */
export type ProposedExistingTableAdditions = {
  items: {
    rulesData: string; // JSON envelope keyed/tagged by ruleset; ownership/equipped remains in items.
  };
  activeEffects: {
    rulesData: string; // typed modifiers/conditions for the selected ruleset.
  };
};

export type CharacterRuleEventType =
  | "character_created"
  | "ability_scores_assigned"
  | "race_selected"
  | "level_committed"
  | "xp_awarded"
  | "xp_removed"
  | "permanent_choice_corrected"
  | "spell_preparation_changed"
  | "resource_refreshed"
  | "legacy_imported";

export type CharacterRuleEventEnvelope = {
  eventType: CharacterRuleEventType;
  eventKey: string;
  characterId: number;
  campaignId: number;
  rulesetId: string;
  sourceMessageId?: number;
  payload: unknown;
};

/**
 * Compatibility projection contract for the existing `characters` row.
 * These values are updated atomically after a successful canonical rules-state
 * transaction. They are NOT independently player-editable in a rules-managed campaign.
 */
export type CharacterCompatibilityProjection = {
  race: string;
  charClass: string;
  level: number;
  hp: number;
  maxHp: number;
  tempHp: number;
  speed: number;
  attacksPerRound: number;
};

export const RECONCILIATION_RULES = [
  "Never store Dnd35CharacterSheetData as the authoritative state.",
  "Never keep character_rules_state and characterData.dnd35State independently writable.",
  "Keep items authoritative for ownership/equipped state.",
  "Keep active_effects authoritative for timed temporary effects.",
  "Tag mechanical payloads with a ruleset identifier.",
  "Use revision/idempotency controls for level-up and AI-proposed transactions.",
  "Snapshots must include or reconstruct canonical rules state and event revision coherently.",
  "Legacy migration may preserve unknown/missing fields, but must never invent permanent player choices.",
] as const;
