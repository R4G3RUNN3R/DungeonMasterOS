// shared/rules-registry/srd-manifest.ts
//
// Phase 2A: page-level discovery manifest, one layer below Phase 0/1's
// book/publication-level rule_sources table. Deliberately does NOT reuse
// canonical-id.ts or provenance.ts's IngestionStatus — a source page is not
// a canonical game entity, and this table's status vocabulary must never be
// mistaken for canonical-rules-verification status. See the Phase 2A plan's
// "Resolved Design Decisions" for the full reasoning.

import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export type CorpusArea =
  | "core"
  | "monsters"
  | "spells"
  | "feats"
  | "items-equipment"
  | "classes"
  | "prestige-classes"
  | "races"
  | "skills"
  | "conditions"
  | "combat-rules"
  | "epic"
  | "psionics"
  | "divine"
  | "open-variants";

// Page-processing status, NOT canonical entity IngestionStatus. Automated
// discovery (server/srd-manifest-discovery.ts) only ever drives a row from
// "discovered" to "hashed" (fetch+hash happen as one atomic step in this
// implementation). "parsed" and "source_verified" are reachable only via a
// deliberate hand-advanced sample row (Phase 2A Task 7), proving the
// machinery without claiming any bulk page was individually parsed/verified.
export type PageProcessingStatus = "discovered" | "fetched" | "hashed" | "parsed" | "source_verified";

export const srdManifestEntries = sqliteTable("srd_manifest_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourcePageKey: text("source_page_key").notNull().unique(),
  ruleset: text("ruleset").notNull(),
  sourceId: integer("source_id").notNull(),
  corpusArea: text("corpus_area").notNull(),
  sourceUrl: text("source_url").notNull().unique(),
  sourcePath: text("source_path").notNull(),
  // Nullable — set only for a leaf page discovered by extracting a link
  // from one of d20srd.org's 44 index-page crawl roots (Task 6). Null for
  // olimot rows, which are directly enumerated from the pinned tree with
  // no crawl step. See "Resolved Design Decisions" #9.
  discoveredFromPath: text("discovered_from_path"),
  contentHash: text("content_hash"),
  processingStatus: text("processing_status").notNull().default("discovered"),
  verificationMethod: text("verification_method"),
  verifiedBy: text("verified_by"),
  verifiedAt: text("verified_at"),
  verificationNotes: text("verification_notes"),
  lastError: text("last_error"),
  lastAttemptAt: text("last_attempt_at"),
  attemptCount: integer("attempt_count").notNull().default(0),
  discoveredAt: text("discovered_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type SrdManifestEntry = typeof srdManifestEntries.$inferSelect;

// Deliberately no `ruleset` field — createSrdManifestEntry hardcodes
// ruleset: "dnd35e" internally. There is no parameter through which a
// caller could supply a different value.
export interface CreateSrdManifestEntryInput {
  sourceId: number;
  corpusArea: CorpusArea;
  sourceUrl: string;
  sourcePath: string;
  discoveredFromPath?: string;
}

// Dedicated, page-scoped, append-only revision/change history —
// deliberately NOT canonical_revisions (Phase 0/1 Task 6), which stays
// reserved for canonical rules entities. Keyed by sourcePageKey, never a
// canonical ID.
export const srdSourcePageRevisions = sqliteTable("srd_source_page_revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourcePageKey: text("source_page_key").notNull(),
  revision: integer("revision").notNull(),
  changedAt: text("changed_at").notNull().$defaultFn(() => new Date().toISOString()),
  changedBy: text("changed_by").notNull().default(""),
  changeReason: text("change_reason").notNull(),
  oldContentHash: text("old_content_hash"),
  newContentHash: text("new_content_hash"),
});

export type SrdSourcePageRevision = typeof srdSourcePageRevisions.$inferSelect;

export interface RecordSourcePageRevisionInput {
  sourcePageKey: string;
  revision: number;
  changedBy?: string;
  changeReason: string;
  oldContentHash?: string;
  newContentHash?: string;
}

export function buildSourcePageKey(sourceKey: string, sourcePath: string): string {
  return `${sourceKey}::${sourcePath}`;
}

/**
 * Verification metadata is only valid once processingStatus has reached
 * "source_verified" — mirrors provenance.ts's isValidStatusPair shape but
 * for this table's own axes. "source_verified" means the fetched page was
 * confirmed to genuinely reflect the pinned upstream — never a claim about
 * the correctness of individual rules described on that page.
 */
export function isValidSourcePageVerification(
  status: PageProcessingStatus,
  hasVerification: boolean,
): boolean {
  if (!hasVerification) return true;
  return status === "source_verified";
}
