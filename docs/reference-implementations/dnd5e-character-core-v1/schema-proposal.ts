// Reference implementation only. Pseudocode/contract, not a drop-in migration.

export const DND5E_PERSISTENCE_PROPOSAL = {
  preferred: {
    table: "character_rule_states",
    key: ["characterId", "rulesProfileId"],
    columns: {
      characterId: "integer FK characters.id unique per active profile",
      campaignId: "integer FK campaigns.id indexed",
      rulesProfileId: "text NOT NULL, e.g. dnd5e-2014 / dnd5e-2024",
      stateVersion: "integer NOT NULL",
      revision: "integer NOT NULL optimistic-lock counter",
      stateJson: "text NOT NULL canonical versioned rules state",
      createdAt: "timestamp",
      updatedAt: "timestamp",
    },
  },
  eventLedger: {
    table: "character_rule_events",
    columns: {
      id: "integer PK",
      eventKey: "text UNIQUE NOT NULL",
      characterId: "integer FK indexed",
      campaignId: "integer FK indexed",
      rulesProfileId: "text NOT NULL",
      eventType: "text NOT NULL",
      sourceMessageId: "integer nullable",
      payloadJson: "text NOT NULL",
      resultingRevision: "integer NOT NULL",
      createdAt: "timestamp",
    },
  },
  campaignRules: {
    reuseOrAdd: "campaign ruleset/source-policy storage",
    fields: {
      rulesProfileId: "exact mechanical profile",
      enabledSourcePackIds: "ordered/validated list",
      advancementMode: "xp or milestone",
      optionalRules: "profile-scoped flags, not generic booleans with edition-ambiguous meaning",
    },
  },
  sourceRegistry: {
    conceptualTables: ["rules_sources", "campaign_rules_sources"],
    purpose: "Track SRD/owned/licensed/homebrew sources enabled by a campaign without hard-coding all commercial content into public core.",
  },
} as const;

export const EXISTING_AUTHORITIES_TO_REUSE = {
  characters: ["identity/ownership", "current hp/temp hp/status compatibility", "fast display race/class/level/speed/attacks projection"],
  items: ["ownership", "quantity", "equipped", "identified"],
  active_effects: ["duration", "concentration", "effect lifecycle"],
  currencies: ["currency definitions", "character balances"],
  user_achievements: ["account achievement unlock persistence"],
  campaign_snapshots: ["rewind/save boundary; extend snapshot payload to include winning canonical rule state"],
} as const;

export const MIGRATION_PLAN = [
  "Back up the live database and identify the actual production schema before creating anything.",
  "Detect 2014 vs 2024 profile from explicit campaign/source data. If ambiguous, mark unresolved; never guess based on one feature string.",
  "Import known permanent choices exactly: assigned abilities, race/species, background, class levels, subclass, feats, skills/proficiencies, spells, HP history when available.",
  "Do not invent missing choices merely to make a complete sheet.",
  "Treat old computed totals as migration evidence only; recompute after authoritative sources are resolved.",
  "Migrate legacy item/effect mechanics into profile-tagged payloads only after verifying the source edition.",
  "Project old and new sheets side-by-side for representative characters before switching reads.",
  "Switch writers first, then readers, then retire/deprecate old writable characterData/computedStats paths.",
  "Maintain a migration log for every unresolved field/choice.",
] as const;

export const CHARACTER_DATA_POLICY = [
  "Do not create characterData.dnd5eSheet as a second writable character database.",
  "If characterData must temporarily carry dnd5e state during migration, use one versioned dnd5eState object with a single writer and an explicit retirement plan.",
  "Sheet data should be generated on read or cached with a revision key, never independently edited.",
] as const;
