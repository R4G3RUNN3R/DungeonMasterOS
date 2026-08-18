// Reference implementation only. Compare against live schema before porting.

import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const campaignTurnDeductionSettings = sqliteTable(
  "campaign_turn_deduction_settings",
  {
    campaignId: integer("campaign_id").primaryKey(),
    mode: text("mode").notNull().default("individual"),
    status: text("status").notNull().default("active"),
    selectedUserId: integer("selected_user_id"),
    revision: integer("revision").notNull().default(1),
    configuredByUserId: integer("configured_by_user_id"),
    configuredAt: text("configured_at"),

    pendingMode: text("pending_mode"),
    pendingSelectedUserId: integer("pending_selected_user_id"),
    pendingRequestedByUserId: integer("pending_requested_by_user_id"),
    pendingRequestedAt: text("pending_requested_at"),

    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
);

export const campaignTurnDeductionAcknowledgements = sqliteTable(
  "campaign_turn_deduction_acknowledgements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull(),
    userId: integer("user_id").notNull(),
    revision: integer("revision").notNull(),
    acceptedAt: text("accepted_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    campaignUserRevisionUnique: uniqueIndex("campaign_turn_ack_unique").on(
      table.campaignId,
      table.userId,
      table.revision,
    ),
  }),
);

export const campaignTurnDeductionEvents = sqliteTable(
  "campaign_turn_deduction_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull(),
    eventType: text("event_type").notNull(),
    actorUserId: integer("actor_user_id"),
    sourceUserId: integer("source_user_id"),
    mode: text("mode"),
    revision: integer("revision"),
    generationId: text("generation_id"),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    generationEventUnique: uniqueIndex("campaign_turn_generation_event_unique").on(
      table.generationId,
      table.eventType,
    ),
  }),
);

/**
 * Optional if the live allowance subsystem does not already provide idempotent reservations.
 * If production has a superior reservation/ledger model, KEEP_PRODUCTION instead.
 */
export const aiTurnReservations = sqliteTable(
  "ai_turn_reservations",
  {
    id: text("id").primaryKey(),
    generationId: text("generation_id").notNull().unique(),
    campaignId: integer("campaign_id").notNull(),
    userId: integer("user_id").notNull(),
    status: text("status").notNull().default("reserved"), // reserved | committed | released
    reason: text("reason"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    finalizedAt: text("finalized_at"),
  },
);

export const TURN_DEDUCTION_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS campaign_turn_deduction_settings (
  campaign_id INTEGER PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'individual',
  status TEXT NOT NULL DEFAULT 'active',
  selected_user_id INTEGER,
  revision INTEGER NOT NULL DEFAULT 1,
  configured_by_user_id INTEGER,
  configured_at TEXT,
  pending_mode TEXT,
  pending_selected_user_id INTEGER,
  pending_requested_by_user_id INTEGER,
  pending_requested_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaign_turn_deduction_acknowledgements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, user_id, revision)
);

CREATE TABLE IF NOT EXISTS campaign_turn_deduction_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id INTEGER,
  source_user_id INTEGER,
  mode TEXT,
  revision INTEGER,
  generation_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(generation_id, event_type)
);

-- Existing campaigns preserve current request-user deduction behavior.
INSERT OR IGNORE INTO campaign_turn_deduction_settings (
  campaign_id, mode, status, selected_user_id, revision, configured_by_user_id, configured_at, updated_at
)
SELECT id, 'individual', 'active', NULL, 1, user_id, datetime('now'), datetime('now')
FROM campaigns;
`;

/**
 * IMPORTANT: after this migration is deployed, campaign creation should explicitly insert a row with
 * mode='individual', status='setup_required', configured_at=NULL for NEW campaigns.
 * Do not rerun the legacy INSERT in a way that converts new setup_required rows.
 */
