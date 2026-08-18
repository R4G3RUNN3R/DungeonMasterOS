// Reference implementation only. Compare with live server membership/session/event tables before porting.

import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const campaignParticipation = sqliteTable(
  "campaign_participation",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    campaignId: integer("campaign_id").notNull(),
    characterId: integer("character_id"),

    campaignNameSnapshot: text("campaign_name_snapshot").notNull(),
    characterNameSnapshot: text("character_name_snapshot"),
    hostUserIdSnapshot: integer("host_user_id_snapshot"),
    hostUsernameSnapshot: text("host_username_snapshot"),
    rulesProfileSnapshot: text("rules_profile_snapshot"),

    firstJoinedAt: text("first_joined_at").notNull(),
    firstMeaningfulActionAt: text("first_meaningful_action_at"),
    lastMeaningfulActionAt: text("last_meaningful_action_at"),
    lastActivityAt: text("last_activity_at"),
    lastPlayedAt: text("last_played_at"),

    meaningfulActionCount: integer("meaningful_action_count").notNull().default(0),
    activePlaySeconds: integer("active_play_seconds").notNull().default(0),
    sessionCount: integer("session_count").notNull().default(0),

    qualifiedAt: text("qualified_at"),
    currentAccessStatus: text("current_access_status").notNull().default("active"),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    userCampaignUnique: uniqueIndex("campaign_participation_user_campaign_unique").on(
      table.userId,
      table.campaignId,
    ),
  }),
);

/**
 * Evidence makes participation counters idempotent.
 * Examples:
 * - meaningful_action / message:1842
 * - meaningful_action / campaign_event:912
 * - activity_pulse / ws-session:abc:minute:29372131
 */
export const campaignParticipationEvidence = sqliteTable(
  "campaign_participation_evidence",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    campaignId: integer("campaign_id").notNull(),
    evidenceType: text("evidence_type").notNull(), // meaningful_action | activity_pulse
    sourceKey: text("source_key").notNull(),
    occurredAt: text("occurred_at").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    evidenceUnique: uniqueIndex("campaign_participation_evidence_unique").on(
      table.userId,
      table.campaignId,
      table.evidenceType,
      table.sourceKey,
    ),
  }),
);

export const CAMPAIGN_PARTICIPATION_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS campaign_participation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  character_id INTEGER,
  campaign_name_snapshot TEXT NOT NULL,
  character_name_snapshot TEXT,
  host_user_id_snapshot INTEGER,
  host_username_snapshot TEXT,
  rules_profile_snapshot TEXT,
  first_joined_at TEXT NOT NULL,
  first_meaningful_action_at TEXT,
  last_meaningful_action_at TEXT,
  last_activity_at TEXT,
  last_played_at TEXT,
  meaningful_action_count INTEGER NOT NULL DEFAULT 0,
  active_play_seconds INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  qualified_at TEXT,
  current_access_status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, campaign_id)
);

CREATE TABLE IF NOT EXISTS campaign_participation_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  evidence_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, campaign_id, evidence_type, source_key)
);
`;

/**
 * Backfill policy:
 *
 * Do NOT automatically qualify every old `characters` row. Character existence is not proof of meaningful play.
 * If production has reliable historical action/session evidence, Claude may reconstruct qualification conservatively.
 * Otherwise start tracking prospectively and leave old unprovable drive-by joins out of Campaign History.
 */
