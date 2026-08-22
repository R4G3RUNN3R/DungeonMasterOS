// shared/rules-registry/sources.ts
//
// The canonical Rules Source Registry (design spec §2). Normalizes source
// provenance (which book, which publisher, what license) into one table
// that future canonical entity tables (spells, feats, monsters, prestige
// classes — not built in this plan) reference by sourceKey + page, rather
// than inlining sourceTitle/sourcePublisher/sourceLicense/etc. on every
// entity row the way server/compendium.ts's item_definitions does today.

import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export type PublicationType =
  | "core-rulebook"
  | "splatbook"
  | "setting-book"
  | "adventure"
  | "magazine"
  | "web-enhancement"
  | "errata";

export type ProvenanceClassification =
  | "wotc_official"
  | "wotc_licensed"
  | "open_game_content"
  | "ogl_third_party"
  | "homebrew";

export type LicenseClassification =
  | "srd_open"
  | "ogl_licensed"
  | "all_rights_reserved"
  | "unknown";

export const ruleSources = sqliteTable("rule_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceKey: text("source_key").notNull().unique(),
  title: text("title").notNull(),
  publisher: text("publisher").notNull().default(""),
  ruleset: text("ruleset").notNull(),
  nativeEdition: text("native_edition").notNull().default(""),
  setting: text("setting").notNull().default("generic"),
  publicationType: text("publication_type").notNull(),
  provenanceClassification: text("provenance_classification").notNull(),
  licenseClassification: text("license_classification").notNull(),
  publicationDate: text("publication_date"),
  supersedesSourceId: integer("supersedes_source_id"),
  verificationMethod: text("verification_method").notNull().default(""),
  verifiedBy: text("verified_by").notNull().default(""),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type RuleSource = typeof ruleSources.$inferSelect;

export interface CreateRuleSourceInput {
  sourceKey: string;
  title: string;
  publisher?: string;
  ruleset: string;
  nativeEdition?: string;
  setting?: string;
  publicationType: PublicationType;
  provenanceClassification: ProvenanceClassification;
  licenseClassification: LicenseClassification;
  publicationDate?: string;
  supersedesSourceId?: number;
}
