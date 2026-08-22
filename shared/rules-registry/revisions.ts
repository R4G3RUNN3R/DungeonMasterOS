// shared/rules-registry/revisions.ts
//
// Generic, entity-type-agnostic audit trail (design spec §15). Any
// canonical record identified by a ruleset:entityType:slug canonical ID
// (shared/rules-registry/canonical-id.ts) — a future spell/feat/monster/
// prestige-class row — gets its corrections, errata application, or
// automation-status changes recorded here by canonicalId, append-only,
// following this codebase's existing turnLedger precedent (shared/schema.ts).
//
// Note: rule_sources rows are out of scope today — they're keyed by
// sourceKey (e.g. "dnd35e-phb"), which doesn't fit the canonical-ID grammar.
// A future task would need to define a canonical-ID convention for sources
// before this model could cover them.

import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const canonicalRevisions = sqliteTable("canonical_revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  canonicalId: text("canonical_id").notNull(),
  entityType: text("entity_type").notNull(),
  revision: integer("revision").notNull(),
  changedAt: text("changed_at").notNull().$defaultFn(() => new Date().toISOString()),
  changedBy: text("changed_by").notNull().default(""),
  changeReason: text("change_reason").notNull(),
  diffSummary: text("diff_summary").notNull().default(""),
});

export type CanonicalRevision = typeof canonicalRevisions.$inferSelect;

export interface RecordRevisionInput {
  canonicalId: string;
  entityType: string;
  revision: number;
  changedBy?: string;
  changeReason: string;
  diffSummary?: string;
}
