# Phase 2A — D&D 3.5e SRD Corpus Manifest & Ingestion Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the machinery to prove what 3.5e SRD content has been discovered, extracted, and verified — before any of it is imported as real game data. This phase produces a queryable, honest answer to "we discovered N rules-bearing SRD sources; N are accounted for, X are extracted, Y verified, Z failed" — and nothing that touches gameplay, AI resolution, or a UI.

**Architecture:** A new page/content-item-level manifest (`srd_manifest_entries`) sits one layer below Phase 0/1's book/publication-level `rule_sources` table — one `rule_sources` row for the SRD compilation itself, many `srd_manifest_entries` rows underneath it (one per discovered HTML page). Every manifest row gets a real canonical ID (`dnd35e:srd-manifest:<slug>`) so Phase 0/1's existing `recordRevision`/`getRevisionHistory` audit trail — built in Task 6 of the prior plan but never wired to anything — becomes genuinely used for the first time. Discovery is driven by a hand-verified, hardcoded list of real files (mirroring `server/compendium.ts`'s existing `SRD_SOURCES` pattern), not runtime directory crawling, so every claim this phase makes is checkable against a fixed, reviewable list rather than a live external API's current state.

**Tech Stack:** Drizzle ORM (SQLite dialect), the existing hand-rolled `runMigrations()` mechanism in `server/storage.ts`, Node's built-in `crypto.createHash("sha256")` for content hashing (no new dependency — matches this file's existing `import { randomBytes } from "crypto"` style), `fetch()` against jsDelivr's GitHub-mirroring CDN (matching `server/compendium.ts`'s existing pattern — never `raw.githubusercontent.com`, which rate-limits the VPS), `node --import tsx --test` + `node:assert/strict` for tests.

## Global Constraints

- **No Library UI, no gameplay/AI-resolution wiring, no licensed Google Drive book ingestion, no 5e data merge, no Bestiary/Grimoire/Feat Codex presentation work.** This plan is investigation/foundation machinery only.
- **No entity content ingestion.** The manifest tracks *what SRD pages exist and their processing status* — it never populates `spell_definitions`/`feat_definitions`/`monster_definitions`/etc. (none of those tables exist yet, and none are created in this plan). A manifest row's `extractionStatus` reaching `"verified"` describes the *page-discovery record itself* being verified, not a game entity.
- **Every row this pipeline creates is explicitly `ruleset: "dnd35e"`, never inferred or caller-supplied.** `createSrdManifestEntry`'s input type has no `ruleset` field at all — the storage method hardcodes the literal — so it is structurally impossible to create a manifest row for any other ruleset through this path, not just conventionally discouraged.
- **Reuse Phase 0/1's foundation, do not reinvent parallel metadata.** `rule_sources` (Task 2), `canonical-id.ts` (Task 3), `provenance.ts`'s `IngestionStatus`/`VerificationMetadata` (Task 3), `revisions.ts` (Task 6) are all consumed, not duplicated. `IngestionStatus`'s existing 4-value union (`discovered|extracted|structured|verified`) is reused verbatim as this table's `extractionStatus` column — not extended, not replaced by a parallel enum.
- **No bulk entity import before the manifest framework is independently reviewed.** The one task in this plan that touches real network data (Task 7) is explicitly small-scale — it populates page-level discovery rows (~65-90 rows total across the whole known SRD dataset) with zero game-rule content in any of them, and is called out as separable/deferrable if the framework needs more hardening first.
- **Treat the stale `feature/library-of-knowledge` branch only as reference**, per Phase 0/1 Task 1's reconciliation doc (`docs/superpowers/notes/2026-08-22-library-branch-reconciliation.md`) — nothing in this plan copies from `server/dnd35-srd-{equipment,feat,spell,spell-items}-importer.ts` or `server/dnd35-item-library.ts` on that branch; those were never typecheck/test/build-verified or deployed.
- **Ingestion errors fail loudly.** Every fetch/discovery step that can fail persists a row recording the failure (`lastError` populated, `lastAttemptAt` stamped) — never a silent skip. This is a tested property, not a convention.
- **No claim of "complete" without the manifest proving it** (design spec's Locked Decision #9, §13) — Task 7's real scan output is captured in that task's own report, not asserted from folder/README inspection.
- **Every task includes:** files/components affected, expected behavior, tests required, migration risk, rollback consideration. **Every task ends with an independent verification step before the next task begins.**
- New tables/columns use `CREATE TABLE IF NOT EXISTS` / `addColumnIfMissing` inside `server/storage.ts`'s `runMigrations()`, matching every other table in this codebase.
- Follow the lazy-prepared-statement pattern: never declare `sqlite.prepare()` at module top level.
- Test file conventions: `node --import tsx --test`, `node:assert/strict`, temp SQLite DB via `process.env.DATABASE_URL` set before dynamic import — matching the pattern established across every Phase 0/1 task's test files.
- **Network calls in tests use an injectable fetcher, never the real network.** `server/srd-manifest-discovery.ts`'s functions accept a `fetchImpl` parameter (defaulting to the real global `fetch`) specifically so tests can inject a fake implementation — no test in this plan is allowed to depend on live network access to pass.

## A Note on Real Source Structure (read before Task 5)

`github.com/olimot/srd-v3.5` (default branch `master`, no `LICENSE` file detected by GitHub's own license API — cite the actual SRD/OGL document text when classifying license, not GitHub's absence of a detected file) is **HTML pages, not structured JSON** — unlike `5e-bits/5e-database`, which `server/compendium.ts` already syncs from and which this plan was originally assumed to resemble. Verified directly against the live repository (via the GitHub API, 2026-08-22):

```
basic-rules-and-legal/   22 files  (alignment-and-description.html, basics-and-ability-scores.html,
                                     carrying-movement-and-exploration.html, character-classes-i.html,
                                     character-classes-ii.html, combat-i-basics.html,
                                     combat-ii-movement-modifiers-and-special-actions.html, equipment.html,
                                     feats.html, legal-information.html, npc-classes.html, planes.html,
                                     prestige-classes.html, races.html, skills-i.html, skills-ii.html,
                                     special-abilities-and-conditions.html, special-materials.html,
                                     traps.html, treasure.html, types-subtypes-and-special-abilities.html,
                                     wilderness-weather-and-environment.html)
spells/                   12 files  (magic-overview.html, spell-list-i.html, spell-list-ii.html,
                                     spells-a-b.html, spells-c.html, spells-d-e.html, spells-f-g.html,
                                     spells-h-l.html, spells-m-o.html, spells-p-r.html, spells-s.html,
                                     spells-t-z.html)
monsters/                 18 files  (improving-monsters.html, monster-feats.html, monsters-animals.html,
                                     monsters-as-races.html, monsters-b-c.html, monsters-d-de.html,
                                     monsters-di-do.html, monsters-dr-dw.html, monsters-e-f.html,
                                     monsters-g.html, monsters-h-i.html, monsters-intro-a.html,
                                     monsters-k-l.html, monsters-m-n.html, monsters-o-r.html,
                                     monsters-s.html, monsters-t-z.html, monsters-vermin.html)
magic-items/               6 files  (magic-items-i-basics-and-creation.html,
                                     magic-items-ii-armor-and-weapons.html,
                                     magic-items-iii-potions-rings-and-rods.html,
                                     magic-items-iv-scrolls-staffs-and-wands.html,
                                     magic-items-v-wondrous-items.html,
                                     magic-items-vi-intelligent-cursed-and-artifacts.html)
divine/                    4 files  (divine-abilities-and-feats.html, divine-domains-and-spells.html,
                                     divine-minions.html, divine-ranks-and-powers.html)
epic/                      not yet enumerated file-by-file — Task 5 Step 1 must verify this directory's
                            real listing before it goes into the hardcoded manifest, same as every other
                            directory above. Do not guess its contents.
psionics/                  not yet enumerated file-by-file — same requirement as epic/ above.
```

**Critical structural fact:** these are *alphabetically-batched* pages — `spells-a-b.html` contains dozens of individual spells, not one. This plan's manifest therefore tracks discovery **at the page level** (one row per HTML file), not the individual-spell/individual-monster level. Splitting a page's content into individual canonical entities (`dnd35e:spell:fireball`) is real HTML-parsing/extraction work explicitly out of scope for this plan (Phase 2B+). This is not a scope-narrowing improvisation — it is the only granularity Task 5's discovery step can honestly claim without doing entity extraction, and doing so keeps every claim this plan makes checkable against a fixed list rather than an assumption about page contents.

`legal-information.html` is administrative text (OGL boilerplate), not rules-bearing content, and is **deliberately excluded** from the manifest — Task 5 documents this exclusion explicitly and tests that it wasn't accidentally omitted vs. deliberately skipped.

## Resolved Design Decisions (stated explicitly per the plan's own instructions — do not leave these ambiguous)

**`extractionStatus` vs. `verificationStatus`:** These are not two independent linear axes. `extractionStatus` reuses Phase 0/1's `IngestionStatus` type verbatim (`discovered|extracted|structured|verified`) — this *is* the extraction-progress axis, unmodified. "Verification status" is not a fifth parallel enum; it is whether `VerificationMetadata` (also reused verbatim from `provenance.ts`) is populated on the row, which is only ever true once `extractionStatus === "verified"`. A manifest-specific guard (`isValidSrdManifestStatusPair`, Task 2) enforces this exactly the way Phase 0/1's `isValidStatusPair` enforces the ingestion/automation relationship. Given this plan does zero entity-level HTML parsing, real manifest rows populated by Task 7 will realistically only ever reach `"discovered"` or `"extracted"` — Task 6 proves the machinery supports the full range up to `"verified"` via one deliberately hand-advanced sample row, without requiring a real parser.

**Failure tracking is a separate axis from `extractionStatus`, not a fifth status value.** Adding `"failed"` as a 5th member of the shared `IngestionStatus` union would be a breaking change to a type Phase 0/1 already shipped and reviewed, for the benefit of one table. Instead, `srd_manifest_entries` gets its own `lastError: text | null`, `lastAttemptAt: text | null`, `attemptCount: integer` columns — a row with `lastError IS NOT NULL` is the coverage report's "failed" bucket, independent of whatever `extractionStatus` it's otherwise sitting at.

**`automationStatus` does not appear on this table.** It describes whether the *deterministic engine* acts on a canonical entity (design spec §4) — meaningless for a page-level discovery record that isn't a game entity yet. It belongs on the eventual `spell_definitions`/etc. row a manifest entry may one day resolve to, not here.

**Manifest entries get real canonical IDs**, closing the gap Phase 0/1's final review flagged: `revisions.ts`'s doc comment explicitly says `rule_sources` rows are out of scope for canonicalId-based revisions because they're keyed by `sourceKey`, not the `ruleset:entityType:slug` grammar. Manifest entries do NOT have that problem — `buildCanonicalId("dnd35e", "srd-manifest", slug)` produces a real, valid canonical ID (`entityType = "srd-manifest"` satisfies `canonical-id.ts`'s `[a-z-]+` grammar), so `recordRevision`/`getRevisionHistory` are directly usable, and this plan wires every status transition through them (Task 5).

**`rule_sources`' unused verification columns get a real write path.** `verificationMethod`/`verifiedBy`/`verifiedAt` exist as columns but `updateRuleSource(sourceKey, updates: Partial<CreateRuleSourceInput>)` cannot write them (`CreateRuleSourceInput` doesn't include them) — flagged in Phase 0/1's Task 2 review as "a real verification workflow (future phase) will need a distinct update path." Task 1 adds that path.

---

## File Structure

```
shared/rules-registry/
  srd-manifest.ts              CorpusArea vocabulary, srdManifestEntries Drizzle table, types,
                                buildSrdManifestSlug() (Task 2)
  srd-manifest.test.ts          Unit tests for buildSrdManifestSlug() and isValidSrdManifestStatusPair()
                                 (Task 2)

server/storage.ts               Modified: runMigrations() gains srd_manifest_entries table + index
                                 (Task 3); IStorage/DatabaseStorage gain recordRuleSourceVerification
                                 (Task 1), createSrdManifestEntry/upsertSrdManifestEntry/
                                 getSrdManifestEntry/listSrdManifestEntries/
                                 recordSrdManifestDiscoveryFailure (Task 3),
                                 getSrdManifestCoverageReport/findDuplicateSrdManifestEntries (Task 4).

server/srd-manifest-discovery.ts   New: SRD_DISCOVERY_MANIFEST (hardcoded, hand-verified file list),
                                     discoverSrdManifestEntry() (fetch + hash one page, injectable
                                     fetcher), runSrdManifestDiscovery() (orchestrates the full list,
                                     never throws on a per-page failure) (Task 5).

server/rules-registry.test.ts      Modified: Task 1's recordRuleSourceVerification tests appended to
                                     the existing file from Phase 0/1 Task 2.
server/srd-manifest-storage.test.ts   New: CRUD + coverage-report + duplicate-detection tests (Tasks 3-4).
server/srd-manifest-discovery.test.ts New: discovery pipeline tests against an injected fake fetcher,
                                        including the loud-failure and idempotent-rescan properties
                                        (Task 5).
server/srd-manifest-lifecycle.test.ts New: the sample discovered→extracted→structured→verified
                                        progression proof, wired through recordRevision (Task 6).

docs/superpowers/notes/2026-08-22-srd-manifest-real-scan-report.md   New: Task 7's real coverage-report
                                                                        output, captured as evidence.
```

---

### Task 1: Register the SRD source + add its verification write path

**Files:**
- Modify: `server/storage.ts` (add `recordRuleSourceVerification` to `IStorage`/`DatabaseStorage`)
- Modify: `server/rules-registry.test.ts` (append tests to the existing file from Phase 0/1 Task 2)
- Create: `docs/superpowers/notes/2026-08-22-srd-source-registration.md` (records the actual `createRuleSource` call made against the real dev DB, and its resulting row — a small paper trail, not a schema change)

**Interfaces:**
- Consumes: `RuleSource`, `CreateRuleSourceInput`, `storage.createRuleSource`, `storage.getRuleSource` (all Phase 0/1 Task 2, unchanged).
- Produces: `storage.recordRuleSourceVerification(sourceKey: string, metadata: VerificationMetadata): void` — writes `verificationMethod`/`verifiedBy`/`verifiedAt` onto the matching `rule_sources` row. `VerificationMetadata` is imported from `@shared/rules-registry/provenance` (Phase 0/1 Task 3) — not a new type.

**Expected behavior:** A `rule_sources` row exists for the SRD compilation itself: `sourceKey: "dnd35e-srd-v35"`, `title: "D&D 3.5 System Reference Document (olimot/srd-v3.5 HTML compilation)"`, `ruleset: "dnd35e"`, `setting: "generic"`, `publicationType: "core-rulebook"` (closest fit in the existing `PublicationType` union — this is the foundational open-content reference the whole corpus baselines against, not a splatbook; no new enum value is added for one row), `provenanceClassification: "open_game_content"`, `licenseClassification: "srd_open"`. `recordRuleSourceVerification` can then mark that row `verified` once a human confirms the registration is correct, using `method: "human_review"`.

**Migration risk:** None — no schema change. `recordRuleSourceVerification` is a plain `UPDATE` against existing columns that already exist (added by Phase 0/1 Task 2's `CREATE TABLE`).

**Rollback consideration:** Deleting the one registered `rule_sources` row (if ever needed) has zero downstream impact within this plan, since Task 3's `srd_manifest_entries.sourceId` is the only thing that references it, and rolling back would need to happen before Task 3 lands or alongside it.

- [ ] **Step 1: Write the failing test in `server/rules-registry.test.ts`**

Append after the existing 5 Task-2 tests (read the file first to match its exact fixture/import style — it already has `storage`/`runMigrations` imported and a temp-DB `before`/`after` pattern from Phase 0/1):

```ts
test("recordRuleSourceVerification writes verification metadata that getRuleSource then returns", () => {
  storage.createRuleSource({
    sourceKey: "dnd35e-srd-v35-verify-test",
    title: "SRD Verify Test",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "open_game_content",
    licenseClassification: "srd_open",
  });

  storage.recordRuleSourceVerification("dnd35e-srd-v35-verify-test", {
    method: "human_review",
    verifiedBy: "controller",
    verifiedAt: "2026-08-22T12:00:00.000Z",
    notes: "confirmed registration matches olimot/srd-v3.5",
  });

  const row = storage.getRuleSource("dnd35e-srd-v35-verify-test");
  assert.equal(row?.verificationMethod, "human_review");
  assert.equal(row?.verifiedBy, "controller");
  assert.equal(row?.verifiedAt, "2026-08-22T12:00:00.000Z");
});

test("recordRuleSourceVerification throws for an unknown sourceKey rather than silently no-oping", () => {
  assert.throws(() => storage.recordRuleSourceVerification("does-not-exist", {
    method: "human_review",
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test server/rules-registry.test.ts`
Expected: FAIL — `storage.recordRuleSourceVerification is not a function`.

- [ ] **Step 3: Add the method to `IStorage` and `DatabaseStorage` in `server/storage.ts`**

`IStorage` (alongside the existing `updateRuleSource` declaration):

```ts
// Rule source verification (Phase 2A) — closes the gap flagged in Phase 0/1's
// Task 2 review: verificationMethod/verifiedBy/verifiedAt exist as columns
// but updateRuleSource's Partial<CreateRuleSourceInput> typing can never
// reach them. This is the real write path for that metadata.
recordRuleSourceVerification(sourceKey: string, metadata: VerificationMetadata): void;
```

`DatabaseStorage`:

```ts
recordRuleSourceVerification(sourceKey: string, metadata: VerificationMetadata): void {
  const existing = this.getRuleSource(sourceKey);
  if (!existing) throw new Error(`Rule source "${sourceKey}" not found`);
  db.update(ruleSources)
    .set({
      verificationMethod: metadata.method,
      verifiedBy: metadata.verifiedBy ?? "",
      verifiedAt: metadata.verifiedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(ruleSources.sourceKey, sourceKey))
    .run();
},
```

Add `import type { VerificationMetadata } from "@shared/rules-registry/provenance";` to `server/storage.ts`'s import block (check the exact existing import style for `@shared/rules-registry/*` types already used in this file, e.g. how `SourcePreset`/`CampaignSourceContext` are imported, and match it).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test server/rules-registry.test.ts`
Expected: all 7 tests pass (5 existing + 2 new).

- [ ] **Step 5: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions against the 312-test baseline.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 6: Register the real SRD source against the real dev database and document it**

This is a one-time, real (not test-fixture) call — run it via a throwaway script or `node --import tsx -e`, against the actual dev `DATABASE_URL` (not a temp test DB):

```ts
import { storage } from "./server/storage";
const row = storage.createRuleSource({
  sourceKey: "dnd35e-srd-v35",
  title: "D&D 3.5 System Reference Document (olimot/srd-v3.5 HTML compilation)",
  publisher: "Wizards of the Coast (OGL); HTML compilation by olimot",
  ruleset: "dnd35e",
  nativeEdition: "dnd35e",
  setting: "generic",
  publicationType: "core-rulebook",
  provenanceClassification: "open_game_content",
  licenseClassification: "srd_open",
});
console.log(row);
```

Write the exact output (the real row, including its assigned `id`) into `docs/superpowers/notes/2026-08-22-srd-source-registration.md`, along with a one-paragraph note on why `licenseClassification: "srd_open"` is correct here despite GitHub's license API reporting no detected `LICENSE` file on `olimot/srd-v3.5` (the content is a compilation of Wizards of the Coast's own SRD, released under the OGL — the classification is about the underlying content's license, not about whether the compiling repository happens to also carry a `LICENSE` file GitHub's detector recognizes).

- [ ] **Step 7: Commit**

```bash
git add server/storage.ts server/rules-registry.test.ts docs/superpowers/notes/2026-08-22-srd-source-registration.md
git commit -m "feat: add rule_sources verification write path, register the 3.5e SRD source"
```

**Independent verification before Task 2 begins:** re-run tests fresh; confirm via `PRAGMA table_info(rule_sources)` (or reading the row in Step 6's output) that the real registered row's `id` is noted somewhere retrievable (Task 3's manifest rows will need it as `sourceId`); confirm `recordRuleSourceVerification` never silently no-ops on an unknown `sourceKey` (the explicit throw test from Step 1).

---

### Task 2: `shared/rules-registry/srd-manifest.ts` — schema, vocabulary, pure helpers

**Files:**
- Create: `shared/rules-registry/srd-manifest.ts`
- Create: `shared/rules-registry/srd-manifest.test.ts`

**Interfaces:**
- Consumes: `IngestionStatus`, `VerificationMetadata` (Phase 0/1 Task 3, `@shared/rules-registry/provenance`) — type-only, reused verbatim.
- Produces: `CorpusArea` type (the 15-value union), `srdManifestEntries` Drizzle table, `SrdManifestEntry` type, `CreateSrdManifestEntryInput` interface (deliberately has **no** `ruleset` field), `buildSrdManifestSlug(sourcePath: string): string`, `isValidSrdManifestStatusPair(extractionStatus: IngestionStatus, hasVerification: boolean): boolean`.

**Expected behavior:** `buildSrdManifestSlug("spells/spells-a-b.html")` returns `"spells-spells-a-b"` (lowercase, `/` and `.` replaced with `-`, `.html` extension stripped) — a value that satisfies `canonical-id.ts`'s `[a-z0-9-]+` slug grammar, so `buildCanonicalId("dnd35e", "srd-manifest", slug)` always produces a valid canonical ID. `isValidSrdManifestStatusPair` mirrors `provenance.ts`'s `isValidStatusPair` shape but for this table's actual axes: verification metadata (`hasVerification: true`) is only valid when `extractionStatus === "verified"` — a row can be `"verified"` with no verification metadata yet recorded (not yet audited) but never the reverse (verification metadata present while `extractionStatus` is anything earlier).

**Migration risk:** None — pure TypeScript, no DB in this task (the table definition exists here per the codebase's established split, but `CREATE TABLE` happens in Task 3's `runMigrations()` addition, matching exactly how Phase 0/1 Task 2 split `sources.ts` from its migration in `storage.ts`).

**Rollback consideration:** None; nothing outside this file imports these exports until Task 3.

- [ ] **Step 1: Write `shared/rules-registry/srd-manifest.ts`**

```ts
// shared/rules-registry/srd-manifest.ts
//
// Phase 2A: page/content-item-level discovery manifest, one layer below
// Phase 0/1's book/publication-level rule_sources table (shared/rules-registry/
// sources.ts). One row per discovered SRD page (e.g. "spells-a-b.html"), not
// per individual game entity — the source dataset is alphabetically-batched
// HTML, so per-entity extraction is out of scope for this table; see the
// plan's "Resolved Design Decisions" section for the extractionStatus vs.
// verificationStatus and automationStatus-is-absent decisions.

import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import type { IngestionStatus } from "./provenance";

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

export const srdManifestEntries = sqliteTable("srd_manifest_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  canonicalId: text("canonical_id").notNull().unique(),
  ruleset: text("ruleset").notNull(),
  sourceId: integer("source_id").notNull(),
  corpusArea: text("corpus_area").notNull(),
  sourceUrl: text("source_url").notNull().unique(),
  sourcePath: text("source_path").notNull(),
  contentHash: text("content_hash"),
  extractionStatus: text("extraction_status").notNull().default("discovered"),
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
// ruleset: "dnd35e" internally (see server/storage.ts). This is Phase 2A's
// "never inferred, never defaulted from context" requirement enforced
// structurally: there is no parameter through which a caller could supply
// a different value.
export interface CreateSrdManifestEntryInput {
  sourceId: number;
  corpusArea: CorpusArea;
  sourceUrl: string;
  sourcePath: string;
}

export function buildSrdManifestSlug(sourcePath: string): string {
  return sourcePath
    .toLowerCase()
    .replace(/\.html?$/, "")
    .replace(/[/.]/g, "-");
}

/**
 * Verification metadata (a populated verificationMethod) is only valid once
 * extractionStatus has reached "verified" — mirrors provenance.ts's
 * isValidStatusPair shape but for this table's actual two axes (extraction
 * progress vs. whether verification metadata has been recorded), not a
 * parallel automationStatus concept, which does not apply to manifest rows.
 */
export function isValidSrdManifestStatusPair(
  extractionStatus: IngestionStatus,
  hasVerification: boolean,
): boolean {
  if (!hasVerification) return true;
  return extractionStatus === "verified";
}
```

- [ ] **Step 2: Write `shared/rules-registry/srd-manifest.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSrdManifestSlug, isValidSrdManifestStatusPair } from "./srd-manifest";
import { buildCanonicalId, isValidCanonicalId } from "./canonical-id";

test("buildSrdManifestSlug converts a nested .html path into a valid canonical-id slug", () => {
  assert.equal(buildSrdManifestSlug("spells/spells-a-b.html"), "spells-spells-a-b");
});

test("buildSrdManifestSlug lowercases and strips the extension", () => {
  assert.equal(buildSrdManifestSlug("Monsters/Monsters-B-C.HTML"), "monsters-monsters-b-c");
});

test("buildSrdManifestSlug output always builds a valid canonical ID", () => {
  const paths = [
    "basic-rules-and-legal/feats.html",
    "spells/spell-list-i.html",
    "magic-items/magic-items-vi-intelligent-cursed-and-artifacts.html",
  ];
  for (const path of paths) {
    const slug = buildSrdManifestSlug(path);
    const id = buildCanonicalId("dnd35e", "srd-manifest", slug);
    assert.ok(isValidCanonicalId(id), `"${id}" (from "${path}") must be a valid canonical ID`);
  }
});

test("isValidSrdManifestStatusPair: verification metadata is valid only once extractionStatus is verified", () => {
  assert.equal(isValidSrdManifestStatusPair("discovered", true), false);
  assert.equal(isValidSrdManifestStatusPair("extracted", true), false);
  assert.equal(isValidSrdManifestStatusPair("structured", true), false);
  assert.equal(isValidSrdManifestStatusPair("verified", true), true);
});

test("isValidSrdManifestStatusPair: no verification metadata is valid at any extractionStatus", () => {
  for (const status of ["discovered", "extracted", "structured", "verified"] as const) {
    assert.equal(isValidSrdManifestStatusPair(status, false), true);
  }
});
```

- [ ] **Step 3: Run the tests**

Run: `node --import tsx --test shared/rules-registry/srd-manifest.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 4: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add shared/rules-registry/srd-manifest.ts shared/rules-registry/srd-manifest.test.ts
git commit -m "feat: add SRD manifest schema, corpus-area vocabulary, and slug builder"
```

**Independent verification before Task 3 begins:** re-run tests fresh; manually trace `buildSrdManifestSlug` against 2-3 of the real filenames listed in this plan's "Real Source Structure" section that aren't in the test file (e.g. `"basic-rules-and-legal/types-subtypes-and-special-abilities.html"`) and confirm the resulting slug is sane and collision-free against the other real filenames — a completeness check beyond the committed test cases.

---

### Task 3: `server/storage.ts` — migration + CRUD for `srd_manifest_entries`

**Files:**
- Modify: `server/storage.ts` (migration block, `IStorage`/`DatabaseStorage` CRUD)
- Create: `server/srd-manifest-storage.test.ts`

**Interfaces:**
- Consumes: `srdManifestEntries`, `SrdManifestEntry`, `CreateSrdManifestEntryInput`, `CorpusArea` (Task 2). `buildSrdManifestSlug`, `isValidSrdManifestStatusPair` (Task 2). `buildCanonicalId` (Phase 0/1 Task 3).
- Produces: `storage.createSrdManifestEntry(input: CreateSrdManifestEntryInput): SrdManifestEntry`, `storage.upsertSrdManifestEntry(input: CreateSrdManifestEntryInput & {contentHash: string}): SrdManifestEntry` (idempotent — same `contentHash` on re-scan is a no-op write, different hash resets `extractionStatus` to `"discovered"`), `storage.recordSrdManifestDiscoveryFailure(input: CreateSrdManifestEntryInput, errorMessage: string): SrdManifestEntry` (creates or updates the row with `lastError` set, no `contentHash` required), `storage.getSrdManifestEntry(canonicalId: string): SrdManifestEntry | undefined`, `storage.listSrdManifestEntries(filter?: {corpusArea?: CorpusArea}): SrdManifestEntry[]`.

**Expected behavior:** `createSrdManifestEntry` always writes `ruleset: "dnd35e"` literally — the input type has no field to override it. `upsertSrdManifestEntry` matches existing rows by `canonicalId` (derived via `buildSrdManifestSlug(input.sourcePath)`): no existing row → insert at `extractionStatus: "discovered"`; existing row with an identical `contentHash` → no-op (no false "changed" signal, per Phase 2A's explicit idempotency requirement); existing row with a different `contentHash` → update the hash, reset `extractionStatus` to `"discovered"`, and record why via Task 6's `recordRevision` wiring (added in Task 5, since that's where the real re-scan caller lives). `recordSrdManifestDiscoveryFailure` never throws on a missing prior row — it creates one so a failure is never silently invisible, and increments `attemptCount` on repeat failures for the same page.

**Migration risk:** Low — pure `CREATE TABLE IF NOT EXISTS` addition, no existing table altered, no existing row touched.

**Rollback consideration:** Dropping `srd_manifest_entries` has zero impact on any other table in this plan or Phase 0/1 — nothing references it via a foreign key (SQLite has none declared here, matching this codebase's existing `campaign_enabled_sources`/`canonical_revisions` convention of app-level rather than DB-level referential integrity).

- [ ] **Step 1: Add the migration block to `server/storage.ts`'s `runMigrations()`**

Place immediately after the existing `canonical_revisions` index (the last rules-registry migration statement from Phase 0/1 Task 6):

```ts
sqlite.exec(`CREATE TABLE IF NOT EXISTS srd_manifest_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_id TEXT NOT NULL UNIQUE,
  ruleset TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  corpus_area TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  source_path TEXT NOT NULL,
  content_hash TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'discovered',
  verification_method TEXT,
  verified_by TEXT,
  verified_at TEXT,
  verification_notes TEXT,
  last_error TEXT,
  last_attempt_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  discovered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`);

sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_srd_manifest_entries_corpus_area
  ON srd_manifest_entries(corpus_area);`);
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_srd_manifest_entries_extraction_status
  ON srd_manifest_entries(extraction_status);`);
```

- [ ] **Step 2: Write the failing test file `server/srd-manifest-storage.test.ts`**

Follow the established e2e fixture pattern (temp SQLite, `runMigrations()`, dynamic import) exactly as `server/rules-registry.test.ts` does:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-srd-manifest-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("./storage");
runMigrations();

let sourceId: number;
test("setup: register a source for manifest rows to reference", () => {
  const source = storage.createRuleSource({
    sourceKey: "dnd35e-srd-v35-storage-test",
    title: "SRD Storage Test Source",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "open_game_content",
    licenseClassification: "srd_open",
  });
  sourceId = source.id;
});

test("createSrdManifestEntry always writes ruleset dnd35e, never caller-supplied", () => {
  const entry = storage.createSrdManifestEntry({
    sourceId,
    corpusArea: "spells",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/spells/spells-a-b.html",
    sourcePath: "spells/spells-a-b.html",
  });
  assert.equal(entry.ruleset, "dnd35e");
  assert.equal(entry.canonicalId, "dnd35e:srd-manifest:spells-spells-a-b");
  assert.equal(entry.extractionStatus, "discovered");
});

test("upsertSrdManifestEntry is a no-op when the content hash hasn't changed", () => {
  const first = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/monsters/monsters-b-c.html",
    sourcePath: "monsters/monsters-b-c.html",
    contentHash: "abc123",
  });
  storage.updateSrdManifestEntryExtractionStatus(first.canonicalId, "extracted");

  const second = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/monsters/monsters-b-c.html",
    sourcePath: "monsters/monsters-b-c.html",
    contentHash: "abc123",
  });
  assert.equal(second.extractionStatus, "extracted", "unchanged hash must not reset extraction progress");
});

test("upsertSrdManifestEntry resets extractionStatus to discovered when the content hash changes", () => {
  const first = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/monsters/monsters-d-de.html",
    sourcePath: "monsters/monsters-d-de.html",
    contentHash: "hash-v1",
  });
  storage.updateSrdManifestEntryExtractionStatus(first.canonicalId, "structured");

  const second = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/monsters/monsters-d-de.html",
    sourcePath: "monsters/monsters-d-de.html",
    contentHash: "hash-v2",
  });
  assert.equal(second.contentHash, "hash-v2");
  assert.equal(second.extractionStatus, "discovered", "a changed hash must flag the row for re-verification");
});

test("recordSrdManifestDiscoveryFailure creates a row even though no content was ever fetched", () => {
  const entry = storage.recordSrdManifestDiscoveryFailure(
    {
      sourceId,
      corpusArea: "epic",
      sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/epic/does-not-exist.html",
      sourcePath: "epic/does-not-exist.html",
    },
    "404 Not Found",
  );
  assert.equal(entry.lastError, "404 Not Found");
  assert.equal(entry.contentHash, null);
  assert.equal(entry.attemptCount, 1);
});

test("recordSrdManifestDiscoveryFailure increments attemptCount on repeat failures for the same page", () => {
  const input = {
    sourceId,
    corpusArea: "epic" as const,
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/epic/flaky.html",
    sourcePath: "epic/flaky.html",
  };
  storage.recordSrdManifestDiscoveryFailure(input, "timeout");
  const second = storage.recordSrdManifestDiscoveryFailure(input, "timeout again");
  assert.equal(second.attemptCount, 2);
  assert.equal(second.lastError, "timeout again");
});

test("listSrdManifestEntries filters by corpusArea", () => {
  const spellEntries = storage.listSrdManifestEntries({ corpusArea: "spells" });
  assert.ok(spellEntries.length > 0);
  assert.ok(spellEntries.every((e) => e.corpusArea === "spells"));
  assert.ok(!spellEntries.some((e) => e.corpusArea === "monsters"));
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

(Note: this test file references `storage.updateSrdManifestEntryExtractionStatus`, a small additional CRUD method needed to make the hash-change test meaningful — add it in Step 3 alongside the others. Also add the `import { after } from "node:test";` needed for the cleanup hook, matching the exact pattern other Phase 0/1 test files use.)

- [ ] **Step 3: Run test to verify it fails**

Run: `node --import tsx --test server/srd-manifest-storage.test.ts`
Expected: FAIL — `storage.createSrdManifestEntry is not a function`.

- [ ] **Step 4: Add CRUD methods to `IStorage`/`DatabaseStorage` in `server/storage.ts`**

`IStorage` additions:

```ts
// SRD manifest (Phase 2A) — page-level discovery tracking underneath
// rule_sources. ruleset is never a parameter: createSrdManifestEntry always
// writes "dnd35e" internally.
createSrdManifestEntry(input: CreateSrdManifestEntryInput): SrdManifestEntry;
upsertSrdManifestEntry(input: CreateSrdManifestEntryInput & { contentHash: string }): SrdManifestEntry;
updateSrdManifestEntryExtractionStatus(canonicalId: string, status: IngestionStatus): void;
recordSrdManifestDiscoveryFailure(input: CreateSrdManifestEntryInput, errorMessage: string): SrdManifestEntry;
getSrdManifestEntry(canonicalId: string): SrdManifestEntry | undefined;
listSrdManifestEntries(filter?: { corpusArea?: CorpusArea }): SrdManifestEntry[];
```

`DatabaseStorage` implementations:

```ts
createSrdManifestEntry(input: CreateSrdManifestEntryInput): SrdManifestEntry {
  const slug = buildSrdManifestSlug(input.sourcePath);
  const canonicalId = buildCanonicalId("dnd35e", "srd-manifest", slug);
  const now = new Date().toISOString();
  const row = db.insert(srdManifestEntries).values({
    canonicalId,
    ruleset: "dnd35e",
    sourceId: input.sourceId,
    corpusArea: input.corpusArea,
    sourceUrl: input.sourceUrl,
    sourcePath: input.sourcePath,
    extractionStatus: "discovered",
    attemptCount: 0,
    discoveredAt: now,
    updatedAt: now,
  }).returning().get();
  return row;
},

upsertSrdManifestEntry(input: CreateSrdManifestEntryInput & { contentHash: string }): SrdManifestEntry {
  const slug = buildSrdManifestSlug(input.sourcePath);
  const canonicalId = buildCanonicalId("dnd35e", "srd-manifest", slug);
  const existing = db.select().from(srdManifestEntries)
    .where(eq(srdManifestEntries.canonicalId, canonicalId)).get();

  if (!existing) {
    const now = new Date().toISOString();
    return db.insert(srdManifestEntries).values({
      canonicalId,
      ruleset: "dnd35e",
      sourceId: input.sourceId,
      corpusArea: input.corpusArea,
      sourceUrl: input.sourceUrl,
      sourcePath: input.sourcePath,
      contentHash: input.contentHash,
      extractionStatus: "discovered",
      attemptCount: 0,
      discoveredAt: now,
      updatedAt: now,
    }).returning().get();
  }

  if (existing.contentHash === input.contentHash) {
    return existing;
  }

  db.update(srdManifestEntries)
    .set({
      contentHash: input.contentHash,
      extractionStatus: "discovered",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(srdManifestEntries.canonicalId, canonicalId))
    .run();
  return db.select().from(srdManifestEntries).where(eq(srdManifestEntries.canonicalId, canonicalId)).get()!;
},

updateSrdManifestEntryExtractionStatus(canonicalId: string, status: IngestionStatus): void {
  db.update(srdManifestEntries)
    .set({ extractionStatus: status, updatedAt: new Date().toISOString() })
    .where(eq(srdManifestEntries.canonicalId, canonicalId))
    .run();
},

recordSrdManifestDiscoveryFailure(input: CreateSrdManifestEntryInput, errorMessage: string): SrdManifestEntry {
  const slug = buildSrdManifestSlug(input.sourcePath);
  const canonicalId = buildCanonicalId("dnd35e", "srd-manifest", slug);
  const now = new Date().toISOString();
  const existing = db.select().from(srdManifestEntries)
    .where(eq(srdManifestEntries.canonicalId, canonicalId)).get();

  if (!existing) {
    return db.insert(srdManifestEntries).values({
      canonicalId,
      ruleset: "dnd35e",
      sourceId: input.sourceId,
      corpusArea: input.corpusArea,
      sourceUrl: input.sourceUrl,
      sourcePath: input.sourcePath,
      extractionStatus: "discovered",
      lastError: errorMessage,
      lastAttemptAt: now,
      attemptCount: 1,
      discoveredAt: now,
      updatedAt: now,
    }).returning().get();
  }

  db.update(srdManifestEntries)
    .set({ lastError: errorMessage, lastAttemptAt: now, attemptCount: existing.attemptCount + 1, updatedAt: now })
    .where(eq(srdManifestEntries.canonicalId, canonicalId))
    .run();
  return db.select().from(srdManifestEntries).where(eq(srdManifestEntries.canonicalId, canonicalId)).get()!;
},

getSrdManifestEntry(canonicalId: string): SrdManifestEntry | undefined {
  return db.select().from(srdManifestEntries).where(eq(srdManifestEntries.canonicalId, canonicalId)).get();
},

listSrdManifestEntries(filter?: { corpusArea?: CorpusArea }): SrdManifestEntry[] {
  if (filter?.corpusArea) {
    return db.select().from(srdManifestEntries)
      .where(eq(srdManifestEntries.corpusArea, filter.corpusArea)).all();
  }
  return db.select().from(srdManifestEntries).all();
},
```

Add imports: `srdManifestEntries`, `SrdManifestEntry`, `CreateSrdManifestEntryInput`, `CorpusArea`, `buildSrdManifestSlug` from `@shared/rules-registry/srd-manifest`; `IngestionStatus` from `@shared/rules-registry/provenance` (if not already imported).

- [ ] **Step 5: Run the tests**

Run: `node --import tsx --test server/srd-manifest-storage.test.ts`
Expected: all 8 tests PASS.

- [ ] **Step 6: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 7: Commit**

```bash
git add server/storage.ts server/srd-manifest-storage.test.ts
git commit -m "feat: add srd_manifest_entries table and CRUD (create/upsert/failure-record/list)"
```

**Independent verification before Task 4 begins:** re-run tests fresh; confirm via a direct `PRAGMA table_info(srd_manifest_entries)` check against the test DB that `ruleset` genuinely has no way to be set to anything but `"dnd35e"` by reading `createSrdManifestEntry`'s full body (not just trusting the test); confirm `upsertSrdManifestEntry`'s no-op path returns the *existing* row object (not a freshly re-selected one that happens to look identical) by checking the code path, not just the test's assertion values.

---

### Task 4: Coverage-report and duplicate-detection queries

**Files:**
- Modify: `server/storage.ts` (add `getSrdManifestCoverageReport`, `findDuplicateSrdManifestEntries` to `IStorage`/`DatabaseStorage`)
- Modify: `server/srd-manifest-storage.test.ts` (append tests)

**Interfaces:**
- Consumes: `srdManifestEntries`, `SrdManifestEntry`, `CorpusArea` (Task 2/3).
- Produces: `storage.getSrdManifestCoverageReport(): SrdManifestCoverageReport` where
  ```ts
  interface SrdManifestCoverageReport {
    totalDiscovered: number;
    byExtractionStatus: Record<IngestionStatus, number>;
    byCorpusArea: Record<string, number>;
    verifiedCount: number;
    failedCount: number;
  }
  ```
  and `storage.findDuplicateSrdManifestEntries(): Array<{ contentHash: string; entries: SrdManifestEntry[] }>` (only groups rows with a non-null `contentHash` shared by 2+ rows).

**Expected behavior:** This is the concrete deliverable the user asked for by name — "we discovered N rules-bearing SRD sources; N are accounted for, X are structured, Y verified, Z failed" becomes a real, tested arithmetic result: `totalDiscovered` is every row in the table (all of them are "accounted for" by definition, since they exist as rows); `byExtractionStatus` breaks that total down across the 4 `IngestionStatus` values; `verifiedCount` is `byExtractionStatus.verified`; `failedCount` counts rows where `lastError IS NOT NULL`, independent of `extractionStatus`. `findDuplicateSrdManifestEntries` surfaces the case where two manifest rows ended up with byte-identical content (a real content-duplication signal, distinct from `upsertSrdManifestEntry`'s same-URL idempotency, which never creates a duplicate row in the first place).

**Migration risk:** None — read-only queries over Task 3's table.

**Rollback consideration:** None; these are pure query functions with no state.

- [ ] **Step 1: Write the failing tests, appended to `server/srd-manifest-storage.test.ts`**

```ts
test("getSrdManifestCoverageReport computes correct arithmetic against constructed fixture data", () => {
  const report = storage.getSrdManifestCoverageReport();

  // Recompute expected counts independently, directly from listSrdManifestEntries,
  // rather than hand-typing numbers — this is the arithmetic-correctness proof:
  // the report's numbers must agree with a from-scratch tally over the same data.
  const all = storage.listSrdManifestEntries();
  const expectedByStatus: Record<string, number> = { discovered: 0, extracted: 0, structured: 0, verified: 0 };
  let expectedFailed = 0;
  for (const entry of all) {
    expectedByStatus[entry.extractionStatus] = (expectedByStatus[entry.extractionStatus] ?? 0) + 1;
    if (entry.lastError) expectedFailed++;
  }

  assert.equal(report.totalDiscovered, all.length);
  assert.equal(report.verifiedCount, expectedByStatus.verified);
  assert.equal(report.failedCount, expectedFailed);
  for (const status of ["discovered", "extracted", "structured", "verified"] as const) {
    assert.equal(report.byExtractionStatus[status], expectedByStatus[status]);
  }
});

test("getSrdManifestCoverageReport's byCorpusArea sums to totalDiscovered", () => {
  const report = storage.getSrdManifestCoverageReport();
  const areaSum = Object.values(report.byCorpusArea).reduce((a, b) => a + b, 0);
  assert.equal(areaSum, report.totalDiscovered);
});

test("findDuplicateSrdManifestEntries surfaces two rows sharing a content hash", () => {
  storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "core",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/basic-rules-and-legal/dup-a.html",
    sourcePath: "basic-rules-and-legal/dup-a.html",
    contentHash: "duplicate-hash-xyz",
  });
  storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "core",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/basic-rules-and-legal/dup-b.html",
    sourcePath: "basic-rules-and-legal/dup-b.html",
    contentHash: "duplicate-hash-xyz",
  });

  const duplicates = storage.findDuplicateSrdManifestEntries();
  const match = duplicates.find((d) => d.contentHash === "duplicate-hash-xyz");
  assert.ok(match, "two rows sharing a content hash must be surfaced");
  assert.equal(match!.entries.length, 2);
});

test("findDuplicateSrdManifestEntries does not flag rows with distinct hashes", () => {
  const duplicates = storage.findDuplicateSrdManifestEntries();
  const bogus = duplicates.find((d) => d.contentHash === "hash-v2"); // from an earlier single-row test
  assert.equal(bogus, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test server/srd-manifest-storage.test.ts`
Expected: FAIL — `storage.getSrdManifestCoverageReport is not a function`.

- [ ] **Step 3: Add the two methods to `IStorage`/`DatabaseStorage`**

`IStorage`:

```ts
getSrdManifestCoverageReport(): {
  totalDiscovered: number;
  byExtractionStatus: Record<IngestionStatus, number>;
  byCorpusArea: Record<string, number>;
  verifiedCount: number;
  failedCount: number;
};
findDuplicateSrdManifestEntries(): Array<{ contentHash: string; entries: SrdManifestEntry[] }>;
```

`DatabaseStorage`:

```ts
getSrdManifestCoverageReport() {
  const all = db.select().from(srdManifestEntries).all();
  const byExtractionStatus: Record<IngestionStatus, number> = {
    discovered: 0, extracted: 0, structured: 0, verified: 0,
  };
  const byCorpusArea: Record<string, number> = {};
  let failedCount = 0;

  for (const entry of all) {
    const status = entry.extractionStatus as IngestionStatus;
    byExtractionStatus[status] = (byExtractionStatus[status] ?? 0) + 1;
    byCorpusArea[entry.corpusArea] = (byCorpusArea[entry.corpusArea] ?? 0) + 1;
    if (entry.lastError) failedCount++;
  }

  return {
    totalDiscovered: all.length,
    byExtractionStatus,
    byCorpusArea,
    verifiedCount: byExtractionStatus.verified,
    failedCount,
  };
},

findDuplicateSrdManifestEntries(): Array<{ contentHash: string; entries: SrdManifestEntry[] }> {
  const all = db.select().from(srdManifestEntries).all();
  const byHash = new Map<string, SrdManifestEntry[]>();
  for (const entry of all) {
    if (!entry.contentHash) continue;
    const group = byHash.get(entry.contentHash) ?? [];
    group.push(entry);
    byHash.set(entry.contentHash, group);
  }
  return Array.from(byHash.entries())
    .filter(([, entries]) => entries.length > 1)
    .map(([contentHash, entries]) => ({ contentHash, entries }));
},
```

(These are computed in-process over `.all()` rather than a SQL `GROUP BY`, matching the small real scale of this table — Task 7's real scan produces on the order of 65-90 rows total, not millions; a full-table scan per report call is the right tradeoff here over hand-rolling grouped SQL for a table this size.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test server/srd-manifest-storage.test.ts`
Expected: all 12 tests PASS (8 from Task 3 + 4 new).

- [ ] **Step 5: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 6: Commit**

```bash
git add server/storage.ts server/srd-manifest-storage.test.ts
git commit -m "feat: add SRD manifest coverage-report and duplicate-detection queries"
```

**Independent verification before Task 5 begins:** re-run tests fresh; confirm the coverage-report test's "recompute independently" approach genuinely can't pass by coincidence — deliberately break `getSrdManifestCoverageReport`'s implementation locally (e.g. hardcode `verifiedCount: 0`) and confirm the test fails, then revert; this is the check that the test is load-bearing, not just present.

---

### Task 5: `server/srd-manifest-discovery.ts` — the real discovery pipeline

**Files:**
- Create: `server/srd-manifest-discovery.ts`
- Create: `server/srd-manifest-discovery.test.ts`
- Modify: `server/storage.ts` (wire `upsertSrdManifestEntry`'s hash-change path to call `recordRevision`, per this plan's resolved design decision — see Step 5 below)

**Interfaces:**
- Consumes: `storage.upsertSrdManifestEntry`, `storage.recordSrdManifestDiscoveryFailure`, `storage.recordRevision` (Task 3, Phase 0/1 Task 6), `CorpusArea` (Task 2).
- Produces: `SRD_DISCOVERY_MANIFEST: Array<{ corpusArea: CorpusArea; sourcePath: string }>` (the hardcoded, hand-verified list), `discoverSrdManifestEntry(sourceId: number, entry: {corpusArea: CorpusArea; sourcePath: string}, fetchImpl?: typeof fetch): Promise<SrdManifestEntry>`, `runSrdManifestDiscovery(sourceId: number, fetchImpl?: typeof fetch): Promise<{succeeded: number; failed: number}>` (never throws — every per-page failure is caught and recorded, never propagated to abort the whole run).

**Expected behavior:** `SRD_DISCOVERY_MANIFEST` is a fixed array, verified against the real repository (not generated at runtime by crawling directories) — this is Step 1's real work, not a code-writing step. `discoverSrdManifestEntry` builds the jsDelivr URL (`https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/${sourcePath}`), fetches it via the injectable `fetchImpl`, computes `crypto.createHash("sha256").update(text).digest("hex")` over the raw response body, and calls `storage.upsertSrdManifestEntry`. On a non-OK response or a thrown fetch error, it calls `storage.recordSrdManifestDiscoveryFailure` instead — the error is captured as data, never left to propagate and abort sibling pages. `runSrdManifestDiscovery` iterates the full `SRD_DISCOVERY_MANIFEST`, calling `discoverSrdManifestEntry` for each and tallying successes/failures, using `Promise.allSettled` (matching `server/compendium.ts`'s own existing concurrency pattern for its `SRD_SOURCES` sync) so one page's failure can never take down the rest of the run.

**Migration risk:** None in this task's own diff (the `runMigrations()` change already landed in Task 3); this task is pure application logic.

**Rollback consideration:** This module has no callers yet outside its own tests until Task 7 — removable in isolation without breaking Tasks 1-4/6.

- [ ] **Step 1: Verify the two unconfirmed directories' real listings before writing `SRD_DISCOVERY_MANIFEST`**

This plan's "Real Source Structure" section already verified 5 of 7 directories (`basic-rules-and-legal`, `spells`, `monsters`, `magic-items`, `divine`) against the live `olimot/srd-v3.5` repository. Before writing the hardcoded list below, fetch the real listings for the remaining two:

```
https://api.github.com/repos/olimot/srd-v3.5/contents/epic
https://api.github.com/repos/olimot/srd-v3.5/contents/psionics
```

Record the exact file names found. Do not proceed to Step 2 with a guessed or placeholder list for these two directories — if either fetch fails or the directory structure has changed since this plan was written (2026-08-22), stop and report the discrepancy rather than silently substituting an assumption.

- [ ] **Step 2: Write `SRD_DISCOVERY_MANIFEST` in `server/srd-manifest-discovery.ts`, using the verified real file list**

```ts
// server/srd-manifest-discovery.ts
//
// Phase 2A discovery pipeline. SRD_DISCOVERY_MANIFEST is a hand-verified,
// hardcoded list of real files in github.com/olimot/srd-v3.5 (default
// branch "master") — matching server/compendium.ts's existing SRD_SOURCES
// pattern (a fixed, reviewable list, not runtime directory crawling), so
// every claim this pipeline makes is checkable against a stable list rather
// than a live external API's current state. legal-information.html is
// deliberately excluded — administrative OGL boilerplate, not rules-bearing
// content.

import { createHash } from "crypto";
import { storage } from "./storage";
import type { CorpusArea } from "@shared/rules-registry/srd-manifest";
import type { SrdManifestEntry } from "@shared/rules-registry/srd-manifest";

const SRD_REPO_BASE = "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master";

export const SRD_DISCOVERY_MANIFEST: Array<{ corpusArea: CorpusArea; sourcePath: string }> = [
  // basic-rules-and-legal/ (legal-information.html deliberately excluded)
  { corpusArea: "core", sourcePath: "basic-rules-and-legal/alignment-and-description.html" },
  { corpusArea: "core", sourcePath: "basic-rules-and-legal/basics-and-ability-scores.html" },
  { corpusArea: "core", sourcePath: "basic-rules-and-legal/carrying-movement-and-exploration.html" },
  { corpusArea: "classes", sourcePath: "basic-rules-and-legal/character-classes-i.html" },
  { corpusArea: "classes", sourcePath: "basic-rules-and-legal/character-classes-ii.html" },
  { corpusArea: "combat-rules", sourcePath: "basic-rules-and-legal/combat-i-basics.html" },
  { corpusArea: "combat-rules", sourcePath: "basic-rules-and-legal/combat-ii-movement-modifiers-and-special-actions.html" },
  { corpusArea: "items-equipment", sourcePath: "basic-rules-and-legal/equipment.html" },
  { corpusArea: "feats", sourcePath: "basic-rules-and-legal/feats.html" },
  { corpusArea: "classes", sourcePath: "basic-rules-and-legal/npc-classes.html" },
  { corpusArea: "core", sourcePath: "basic-rules-and-legal/planes.html" },
  { corpusArea: "prestige-classes", sourcePath: "basic-rules-and-legal/prestige-classes.html" },
  { corpusArea: "races", sourcePath: "basic-rules-and-legal/races.html" },
  { corpusArea: "skills", sourcePath: "basic-rules-and-legal/skills-i.html" },
  { corpusArea: "skills", sourcePath: "basic-rules-and-legal/skills-ii.html" },
  { corpusArea: "conditions", sourcePath: "basic-rules-and-legal/special-abilities-and-conditions.html" },
  { corpusArea: "items-equipment", sourcePath: "basic-rules-and-legal/special-materials.html" },
  { corpusArea: "core", sourcePath: "basic-rules-and-legal/traps.html" },
  { corpusArea: "items-equipment", sourcePath: "basic-rules-and-legal/treasure.html" },
  { corpusArea: "monsters", sourcePath: "basic-rules-and-legal/types-subtypes-and-special-abilities.html" },
  { corpusArea: "core", sourcePath: "basic-rules-and-legal/wilderness-weather-and-environment.html" },

  // spells/
  { corpusArea: "spells", sourcePath: "spells/magic-overview.html" },
  { corpusArea: "spells", sourcePath: "spells/spell-list-i.html" },
  { corpusArea: "spells", sourcePath: "spells/spell-list-ii.html" },
  { corpusArea: "spells", sourcePath: "spells/spells-a-b.html" },
  { corpusArea: "spells", sourcePath: "spells/spells-c.html" },
  { corpusArea: "spells", sourcePath: "spells/spells-d-e.html" },
  { corpusArea: "spells", sourcePath: "spells/spells-f-g.html" },
  { corpusArea: "spells", sourcePath: "spells/spells-h-l.html" },
  { corpusArea: "spells", sourcePath: "spells/spells-m-o.html" },
  { corpusArea: "spells", sourcePath: "spells/spells-p-r.html" },
  { corpusArea: "spells", sourcePath: "spells/spells-s.html" },
  { corpusArea: "spells", sourcePath: "spells/spells-t-z.html" },

  // monsters/
  { corpusArea: "monsters", sourcePath: "monsters/improving-monsters.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monster-feats.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-animals.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-as-races.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-b-c.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-d-de.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-di-do.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-dr-dw.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-e-f.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-g.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-h-i.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-intro-a.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-k-l.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-m-n.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-o-r.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-s.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-t-z.html" },
  { corpusArea: "monsters", sourcePath: "monsters/monsters-vermin.html" },

  // magic-items/
  { corpusArea: "items-equipment", sourcePath: "magic-items/magic-items-i-basics-and-creation.html" },
  { corpusArea: "items-equipment", sourcePath: "magic-items/magic-items-ii-armor-and-weapons.html" },
  { corpusArea: "items-equipment", sourcePath: "magic-items/magic-items-iii-potions-rings-and-rods.html" },
  { corpusArea: "items-equipment", sourcePath: "magic-items/magic-items-iv-scrolls-staffs-and-wands.html" },
  { corpusArea: "items-equipment", sourcePath: "magic-items/magic-items-v-wondrous-items.html" },
  { corpusArea: "items-equipment", sourcePath: "magic-items/magic-items-vi-intelligent-cursed-and-artifacts.html" },

  // divine/
  { corpusArea: "divine", sourcePath: "divine/divine-abilities-and-feats.html" },
  { corpusArea: "divine", sourcePath: "divine/divine-domains-and-spells.html" },
  { corpusArea: "divine", sourcePath: "divine/divine-minions.html" },
  { corpusArea: "divine", sourcePath: "divine/divine-ranks-and-powers.html" },

  // epic/ and psionics/ — ADD REAL ENTRIES HERE FROM STEP 1's VERIFICATION.
  // Do not leave this comment in place with no entries added — Step 1's
  // verification result belongs here as real { corpusArea, sourcePath }
  // pairs, the same as every directory above.
];

export async function discoverSrdManifestEntry(
  sourceId: number,
  entry: { corpusArea: CorpusArea; sourcePath: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SrdManifestEntry> {
  const sourceUrl = `${SRD_REPO_BASE}/${entry.sourcePath}`;
  try {
    const res = await fetchImpl(sourceUrl);
    if (!res.ok) {
      return storage.recordSrdManifestDiscoveryFailure(
        { sourceId, corpusArea: entry.corpusArea, sourceUrl, sourcePath: entry.sourcePath },
        `HTTP ${res.status}`,
      );
    }
    const text = await res.text();
    const contentHash = createHash("sha256").update(text).digest("hex");
    return storage.upsertSrdManifestEntry({
      sourceId,
      corpusArea: entry.corpusArea,
      sourceUrl,
      sourcePath: entry.sourcePath,
      contentHash,
    });
  } catch (err) {
    return storage.recordSrdManifestDiscoveryFailure(
      { sourceId, corpusArea: entry.corpusArea, sourceUrl, sourcePath: entry.sourcePath },
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function runSrdManifestDiscovery(
  sourceId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ succeeded: number; failed: number }> {
  const results = await Promise.allSettled(
    SRD_DISCOVERY_MANIFEST.map((entry) => discoverSrdManifestEntry(sourceId, entry, fetchImpl)),
  );
  let succeeded = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === "fulfilled" && !result.value.lastError) succeeded++;
    else failed++;
  }
  return { succeeded, failed };
}
```

- [ ] **Step 3: Write `server/srd-manifest-discovery.test.ts` — TDD against an injected fake fetcher, never the real network**

```ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-srd-discovery-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("./storage");
runMigrations();
const { discoverSrdManifestEntry, runSrdManifestDiscovery, SRD_DISCOVERY_MANIFEST } =
  await import("./srd-manifest-discovery");

let sourceId: number;
before(() => {
  const source = storage.createRuleSource({
    sourceKey: "dnd35e-srd-v35-discovery-test",
    title: "Discovery Test Source",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "open_game_content",
    licenseClassification: "srd_open",
  });
  sourceId = source.id;
});

function fakeFetchOk(body: string) {
  return async () => new Response(body, { status: 200 });
}

function fakeFetch404() {
  return async () => new Response("not found", { status: 404 });
}

function fakeFetchThrows(message: string) {
  return async () => { throw new Error(message); };
}

test("discoverSrdManifestEntry writes a discovered row with a real content hash on success", async () => {
  const entry = await discoverSrdManifestEntry(
    sourceId,
    { corpusArea: "spells", sourcePath: "spells/spells-a-b.html" },
    fakeFetchOk("<html>fake fireball page</html>"),
  );
  assert.ok(entry.contentHash);
  assert.equal(entry.contentHash!.length, 64, "sha256 hex digest is 64 characters");
  assert.equal(entry.lastError, null);
});

test("discoverSrdManifestEntry records a failure row (never throws) on a non-OK HTTP response", async () => {
  const entry = await discoverSrdManifestEntry(
    sourceId,
    { corpusArea: "epic", sourcePath: "epic/missing-page.html" },
    fakeFetch404(),
  );
  assert.equal(entry.lastError, "HTTP 404");
  assert.equal(entry.contentHash, null);
});

test("discoverSrdManifestEntry records a failure row (never throws) when the fetch itself throws", async () => {
  const entry = await discoverSrdManifestEntry(
    sourceId,
    { corpusArea: "psionics", sourcePath: "psionics/network-error-page.html" },
    fakeFetchThrows("ECONNRESET"),
  );
  assert.equal(entry.lastError, "ECONNRESET");
});

test("discoverSrdManifestEntry is idempotent: the same content fetched twice does not reset extraction progress", async () => {
  const first = await discoverSrdManifestEntry(
    sourceId,
    { corpusArea: "divine", sourcePath: "divine/idempotency-test.html" },
    fakeFetchOk("<html>stable content</html>"),
  );
  storage.updateSrdManifestEntryExtractionStatus(first.canonicalId, "extracted");

  const second = await discoverSrdManifestEntry(
    sourceId,
    { corpusArea: "divine", sourcePath: "divine/idempotency-test.html" },
    fakeFetchOk("<html>stable content</html>"),
  );
  assert.equal(second.extractionStatus, "extracted", "unchanged content must not silently reset progress");
});

test("runSrdManifestDiscovery never aborts the whole run on one page's failure", async () => {
  let callCount = 0;
  const mixedFetch: typeof fetch = async (url) => {
    callCount++;
    if (String(url).includes("spells-a-b")) return new Response("<html>ok</html>", { status: 200 });
    return new Response("gone", { status: 404 });
  };
  const result = await runSrdManifestDiscovery(sourceId, mixedFetch);
  assert.equal(callCount, SRD_DISCOVERY_MANIFEST.length, "every entry in the manifest must be attempted");
  assert.ok(result.failed > 0, "the deliberately-failing entries must be counted as failed, not silently dropped");
  assert.ok(result.succeeded > 0);
  assert.equal(result.succeeded + result.failed, SRD_DISCOVERY_MANIFEST.length);
});

test("SRD_DISCOVERY_MANIFEST deliberately excludes legal-information.html", () => {
  assert.ok(
    !SRD_DISCOVERY_MANIFEST.some((e) => e.sourcePath.includes("legal-information")),
    "administrative OGL boilerplate must not be treated as rules-bearing content",
  );
});

test("every SRD_DISCOVERY_MANIFEST entry has a corpusArea from the real 15-value vocabulary", () => {
  const valid = new Set([
    "core", "monsters", "spells", "feats", "items-equipment", "classes",
    "prestige-classes", "races", "skills", "conditions", "combat-rules",
    "epic", "psionics", "divine", "open-variants",
  ]);
  for (const entry of SRD_DISCOVERY_MANIFEST) {
    assert.ok(valid.has(entry.corpusArea), `"${entry.corpusArea}" (${entry.sourcePath}) must be a real corpus area`);
  }
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

- [ ] **Step 4: Run the tests**

Run: `node --import tsx --test server/srd-manifest-discovery.test.ts`
Expected: all 8 tests PASS. Confirm zero real network requests were made (the fake fetchers never touch the real internet — this is by construction, but re-read the test file to confirm no test omitted the `fetchImpl` argument and fell through to the real `fetch` default).

- [ ] **Step 5: Wire `upsertSrdManifestEntry`'s hash-change path to `recordRevision`**

Back in `server/storage.ts`, extend the hash-changed branch of `upsertSrdManifestEntry` (written in Task 3) to also record a revision, closing the "Task 6 shipped adjacent but unwired" gap:

```ts
// Inside upsertSrdManifestEntry's hash-differs branch, after the db.update call:
this.recordRevision({
  canonicalId,
  entityType: "srd-manifest",
  revision: existing.attemptCount + 1, // reuses attemptCount as a simple monotonic counter for this row
  changeReason: `content hash changed (${existing.contentHash} -> ${input.contentHash}), extractionStatus reset to discovered`,
  changedBy: "srd-manifest-discovery",
});
```

(If `attemptCount` isn't a semantically clean revision-number source on reflection — it's currently used for failure retries, not content revisions — add a dedicated `contentRevision: integer notNull default 0` column to `srd_manifest_entries` instead, incremented on every hash change, and use that for `recordRevision`'s `revision` field. Make this call during implementation by reading `recordRevision`'s actual contract in `revisions.ts` again before deciding; either is acceptable as long as the revision number is monotonic per canonicalId and the reasoning for the choice is stated in the commit message.)

Add a test to `server/srd-manifest-discovery.test.ts` proving this wiring:

```ts
test("a content hash change is recorded in the canonical revision history", async () => {
  const first = await discoverSrdManifestEntry(
    sourceId,
    { corpusArea: "core", sourcePath: "basic-rules-and-legal/revision-test.html" },
    fakeFetchOk("<html>version 1</html>"),
  );
  await discoverSrdManifestEntry(
    sourceId,
    { corpusArea: "core", sourcePath: "basic-rules-and-legal/revision-test.html" },
    fakeFetchOk("<html>version 2, changed content</html>"),
  );
  const history = storage.getRevisionHistory(first.canonicalId);
  assert.ok(history.length > 0, "a content-hash change must produce a real revision row, not a silent update");
  assert.ok(history[0].changeReason.includes("content hash changed"));
});
```

- [ ] **Step 6: Run test to verify it passes, then full suite + typecheck**

Run: `node --import tsx --test server/srd-manifest-discovery.test.ts` — expect 9/9 pass.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 7: Commit**

```bash
git add server/srd-manifest-discovery.ts server/srd-manifest-discovery.test.ts server/storage.ts
git commit -m "feat: add SRD manifest discovery pipeline (hardcoded verified file list, injectable fetcher, loud failures, revision wiring)"
```

**Independent verification before Task 6 begins:** re-run tests fresh; manually cross-check every `sourcePath` string in `SRD_DISCOVERY_MANIFEST` against the "Real Source Structure" section of this plan (and the real epic/psionics verification from Step 1) — confirm the count of entries matches the total real file count discovered, with `legal-information.html` the only deliberate omission; confirm no test file makes a real network call by grepping the test file for bare `fetch(` calls without a `fakeFetch*`/injected argument.

---

### Task 6: Sample end-to-end status-progression proof

**Files:**
- Create: `server/srd-manifest-lifecycle.test.ts`

**Interfaces:**
- Consumes: `storage.updateSrdManifestEntryExtractionStatus`, `storage.recordRuleSourceVerification`-equivalent pattern applied to manifest entries (a small addition, see Step 3), `storage.recordRevision`, `storage.getRevisionHistory`, `isValidSrdManifestStatusPair` (Task 2).
- Produces: `storage.recordSrdManifestEntryVerification(canonicalId: string, metadata: VerificationMetadata): void` — the manifest-entry equivalent of Task 1's `recordRuleSourceVerification`, enforcing `isValidSrdManifestStatusPair` before writing.

**Expected behavior:** This task does no new HTML parsing and imports no new external data — it proves, with one hand-advanced sample row, that the full `discovered → extracted → structured → verified` progression is genuinely usable end-to-end, with every transition recorded in `canonical_revisions`, and that verification metadata is rejected if attempted before `extractionStatus` reaches `"verified"` (the guard Task 2 wrote actually gets enforced at the storage layer, not just defined and left unused). This directly answers the coverage report's "X are structured, Y verified" columns with real, provable rows rather than aspirational schema.

**Migration risk:** None — no schema change; `recordSrdManifestEntryVerification` is a plain `UPDATE`.

**Rollback consideration:** None; this is a self-contained proof with no other task depending on its output.

- [ ] **Step 1: Write the failing test**

```ts
// server/srd-manifest-lifecycle.test.ts
//
// Proves the full extractionStatus progression is real and enforced, using
// one hand-advanced sample row. No HTML parsing, no new external data —
// this is a machinery proof, not entity extraction.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-srd-lifecycle-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("./storage");
runMigrations();

let sourceId: number;
before(() => {
  const source = storage.createRuleSource({
    sourceKey: "dnd35e-srd-v35-lifecycle-test",
    title: "Lifecycle Test Source",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "open_game_content",
    licenseClassification: "srd_open",
  });
  sourceId = source.id;
});

test("recordSrdManifestEntryVerification rejects verification before extractionStatus reaches verified", () => {
  const entry = storage.createSrdManifestEntry({
    sourceId,
    corpusArea: "feats",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/basic-rules-and-legal/feats.html",
    sourcePath: "basic-rules-and-legal/feats.html",
  });
  assert.throws(() => storage.recordSrdManifestEntryVerification(entry.canonicalId, { method: "human_review" }));
});

test("a manifest entry can be hand-advanced through the full discovered -> extracted -> structured -> verified progression, each step recorded as a revision", () => {
  const entry = storage.createSrdManifestEntry({
    sourceId,
    corpusArea: "feats",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@master/basic-rules-and-legal/feats-lifecycle-sample.html",
    sourcePath: "basic-rules-and-legal/feats-lifecycle-sample.html",
  });
  assert.equal(entry.extractionStatus, "discovered");

  storage.updateSrdManifestEntryExtractionStatus(entry.canonicalId, "extracted");
  storage.recordRevision({
    canonicalId: entry.canonicalId, entityType: "srd-manifest", revision: 1,
    changeReason: "raw HTML content fetched and hashed", changedBy: "controller",
  });

  storage.updateSrdManifestEntryExtractionStatus(entry.canonicalId, "structured");
  storage.recordRevision({
    canonicalId: entry.canonicalId, entityType: "srd-manifest", revision: 2,
    changeReason: "manually confirmed page structure matches expected feats-list format", changedBy: "controller",
  });

  storage.updateSrdManifestEntryExtractionStatus(entry.canonicalId, "verified");
  storage.recordSrdManifestEntryVerification(entry.canonicalId, {
    method: "human_review", verifiedBy: "controller", verifiedAt: new Date().toISOString(),
  });
  storage.recordRevision({
    canonicalId: entry.canonicalId, entityType: "srd-manifest", revision: 3,
    changeReason: "human-verified against the live page", changedBy: "controller",
  });

  const final = storage.getSrdManifestEntry(entry.canonicalId);
  assert.equal(final?.extractionStatus, "verified");
  assert.equal(final?.verificationMethod, "human_review");

  const history = storage.getRevisionHistory(entry.canonicalId);
  assert.equal(history.length, 3);
  assert.equal(history[0].revision, 3, "newest first");

  const report = storage.getSrdManifestCoverageReport();
  assert.ok(report.verifiedCount >= 1, "the coverage report must reflect this real verified row");
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test server/srd-manifest-lifecycle.test.ts`
Expected: FAIL — `storage.recordSrdManifestEntryVerification is not a function`.

- [ ] **Step 3: Add `recordSrdManifestEntryVerification` to `IStorage`/`DatabaseStorage`**

`IStorage`:

```ts
recordSrdManifestEntryVerification(canonicalId: string, metadata: VerificationMetadata): void;
```

`DatabaseStorage`:

```ts
recordSrdManifestEntryVerification(canonicalId: string, metadata: VerificationMetadata): void {
  const existing = this.getSrdManifestEntry(canonicalId);
  if (!existing) throw new Error(`SRD manifest entry "${canonicalId}" not found`);
  if (!isValidSrdManifestStatusPair(existing.extractionStatus as IngestionStatus, true)) {
    throw new Error(
      `Cannot record verification for "${canonicalId}": extractionStatus is "${existing.extractionStatus}", must be "verified" first`,
    );
  }
  db.update(srdManifestEntries)
    .set({
      verificationMethod: metadata.method,
      verifiedBy: metadata.verifiedBy ?? "",
      verifiedAt: metadata.verifiedAt ?? new Date().toISOString(),
      verificationNotes: metadata.notes ?? "",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(srdManifestEntries.canonicalId, canonicalId))
    .run();
},
```

Import `isValidSrdManifestStatusPair` from `@shared/rules-registry/srd-manifest` (if not already imported from Task 3).

- [ ] **Step 4: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/srd-manifest-lifecycle.test.ts` — expect 2/2 pass.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add server/storage.ts server/srd-manifest-lifecycle.test.ts
git commit -m "feat: add manifest-entry verification write path, prove full status-progression machinery"
```

**Independent verification before Task 7 begins:** re-run tests fresh; confirm `recordSrdManifestEntryVerification`'s guard actually uses `isValidSrdManifestStatusPair` (Task 2's function) rather than a duplicated inline condition — a second, drifting implementation of the same rule would be exactly the kind of gap this plan's own review process should catch.

---

### Task 7 (optional, small-scale, real network) — Execute the real discovery scan

**This task is explicitly separable.** Everything in Tasks 1-6 is independently complete, tested, and reviewable without ever touching the real network. If the manifest framework needs more hardening first, stop here and defer this task — nothing downstream in this plan depends on it having run.

**Files:**
- Create: `docs/superpowers/notes/2026-08-22-srd-manifest-real-scan-report.md`

**Interfaces:**
- Consumes: `runSrdManifestDiscovery` (Task 5), `storage.getSrdManifestCoverageReport`, `storage.findDuplicateSrdManifestEntries` (Task 4), the real registered `rule_sources` row's `id` (Task 1, Step 6).

**Expected behavior:** A single real, dev-environment run of `runSrdManifestDiscovery` against the actual `olimot/srd-v3.5` repository via jsDelivr, populating `srd_manifest_entries` with one row per real entry in `SRD_DISCOVERY_MANIFEST` (roughly 65-90 rows, exact count determined by Task 5 Step 1's real directory verification). Every row lands at `extractionStatus: "discovered"` or `"extracted"` (whichever `discoverSrdManifestEntry` actually sets on success — re-check Task 5's implementation; if it only ever sets `"discovered"` on a successful fetch+hash, that's consistent with this plan's stated design that "extracted" requires content genuinely being pulled into DMOS's own storage, which raw hashing arguably already satisfies — resolve this precisely by reading Task 5's actual shipped code, not by re-deciding it here). **Zero game-rule content is stored anywhere** — no spell names, no monster stat blocks, nothing beyond URLs, hashes, and classification. This is the literal "we discovered N sources; N accounted for" proof the user asked for, run for real.

**Migration risk:** None — no schema change, and this is additive data in a dev database, not production. **Do not run this against the live VPS database** unless/until the user explicitly asks for that in a later turn; this task's default target is the local dev `DATABASE_URL`.

**Rollback consideration:** Trivially reversible — `DELETE FROM srd_manifest_entries;` if the real scan needs to be redone after a `SRD_DISCOVERY_MANIFEST` correction, with zero impact on any other table.

- [ ] **Step 1: Run the real scan**

```ts
import { storage } from "./server/storage";
import { runSrdManifestDiscovery } from "./server/srd-manifest-discovery";

const source = storage.getRuleSource("dnd35e-srd-v35"); // Task 1's real registered row
if (!source) throw new Error("Run Task 1 Step 6 first — the SRD source must be registered.");

const result = await runSrdManifestDiscovery(source.id);
console.log("Discovery run result:", result);
console.log("Coverage report:", storage.getSrdManifestCoverageReport());
console.log("Duplicates:", storage.findDuplicateSrdManifestEntries());
```

- [ ] **Step 2: Capture the real output in a report document**

Write `docs/superpowers/notes/2026-08-22-srd-manifest-real-scan-report.md` containing: the exact `{succeeded, failed}` result, the full `getSrdManifestCoverageReport()` output (every `byExtractionStatus`/`byCorpusArea` count), the `findDuplicateSrdManifestEntries()` output (expected to be empty for a first real run — if not, investigate before writing the report, don't just record an unexplained duplicate), and — for any entry where `failed > 0` — the specific `sourcePath`s and `lastError` messages, since "fail loudly" means this report names them individually, not just a bare count.

- [ ] **Step 3: Independent verification**

Cross-check the report's `totalDiscovered` count against `SRD_DISCOVERY_MANIFEST.length` (they must be equal — every entry in the hardcoded list must produce exactly one row, success or failure) and against a manual count of every `sourcePath` line in this plan's own Task 5 code block. If they don't match exactly, that's a real discrepancy to resolve before treating this task as done — not a rounding difference to wave off.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/notes/2026-08-22-srd-manifest-real-scan-report.md
git commit -m "docs: capture real SRD manifest discovery scan results"
```

**Independent verification before this plan is considered complete:** re-run the full test suite, typecheck, and build fresh; confirm the real scan report's counts are internally consistent (`byExtractionStatus` values sum to `totalDiscovered`, `byCorpusArea` values sum to `totalDiscovered`, `succeeded + failed` from Step 1 equals `SRD_DISCOVERY_MANIFEST.length`); confirm zero rows in `srd_manifest_entries` have `extractionStatus` values of `"structured"` or `"verified"` from the real scan itself (those only exist from Task 6's deliberate hand-advanced sample row, never from the automated discovery pipeline) — this is the concrete proof that Task 7 stayed within "discovery," never silently drifted into claiming unearned progress.

---

## Self-Review

**Spec coverage:** §2 (Source Registry) is reused, not reinvented — Task 1. §4 (ingestion/automation status) is reused for `extractionStatus`, with the automation-status-doesn't-apply-here decision stated explicitly — Task 2's "Resolved Design Decisions." §9's `verification: {method, verifiedBy, verifiedAt}` shape (via `provenance.ts`'s `VerificationMetadata`, itself derived from §2/§4/§15) is the exact shape both `recordRuleSourceVerification` (Task 1) and `recordSrdManifestEntryVerification` (Task 6) write. §13 (Drive manifest, "no completeness claim without an audited manifest") is the literal design principle Task 4's coverage report and Task 7's real-scan report exist to satisfy, extended here to the SRD (not yet the Drive) as the phase's own stated first step. §15 (versioning/auditability) is wired for real for the first time via Task 5 Step 5 and Task 6's sample progression — closing the "Task 6 shipped, zero production callers" gap Phase 0/1's final review explicitly flagged. Every named user requirement (authoritative source registration, exhaustive manifest, 15-value corpus-area classification, provenance/source-reference capture, stable hashes, extraction/verification status resolved as two non-parallel axes, coverage accounting with a real arithmetic test, duplicate detection, loud failures, ruleset isolation enforced structurally, and the explicit prohibition on entity-content ingestion) maps to a task above. Nothing in this plan touches Library UI, gameplay/AI wiring, licensed-book ingestion, 5e data, or Bestiary/Grimoire/Feat Codex presentation — all correctly deferred per the user's explicit scope instruction.

**Placeholder scan:** every step has real, complete code. The one deliberately incomplete spot — `SRD_DISCOVERY_MANIFEST`'s `epic`/`psionics` entries in Task 5's code block — is explicitly flagged in-line as "ADD REAL ENTRIES HERE FROM STEP 1's VERIFICATION," not silently left blank; Task 5 Step 1 requires the implementer to do that verification before Step 2 can be honestly completed, and the plan states outright that guessing is not acceptable there. This is a structural requirement for real investigation, not a placeholder in the "TBD" sense the writing-plans checklist warns against — the plan cannot supply real file names for directories that weren't fully enumerated during planning without either fabricating them or delaying the whole plan for one more API round-trip; requiring the implementer to complete the verification is the honest choice given the plan's own "prove it, don't guess it" standard.

**Type consistency:** `CreateSrdManifestEntryInput` (Task 2) is used identically across Tasks 3 (CRUD), 5 (discovery), and 6 (lifecycle test) — field names never drift. `IngestionStatus` (Phase 0/1 Task 3) is the literal type of `extractionStatus` throughout, never shadowed or redefined. `VerificationMetadata` (Phase 0/1 Task 3) is the literal parameter type for both `recordRuleSourceVerification` (Task 1) and `recordSrdManifestEntryVerification` (Task 6) — one shape, two call sites, matching the design spec's "one architectural shape, applied consistently" principle (§1). `buildCanonicalId`/`isValidCanonicalId` (Phase 0/1 Task 3) are consumed, never reimplemented, by `buildSrdManifestSlug`'s design (Task 2) and every `canonicalId` construction in Tasks 3/5/6.

**Migration risk / rollback:** stated explicitly per task, not uniform boilerplate — Tasks 2/5/6 are no-DB-risk (pure TS or already-migrated-table logic); Task 3 is the only real migration (one new table, purely additive); Task 7 is flagged as reversible dev-data, explicitly not targeting production, and explicitly optional/deferrable as a whole task.

**Independent verification gate:** every task ends with a distinct, non-generic check (a `PRAGMA` inspection, a deliberate-breakage test-validity check in Task 4, a cross-reference against this plan's own real-structure data in Tasks 5/7, a check that a guard function is actually called rather than duplicated in Task 6) — matching the Phase 0/1 plan's own standard, not "re-run the tests" repeated seven times.

**"No entity content ingestion" check:** confirmed no task creates or writes to any table named `*_definitions`; `srd_manifest_entries` stores only URLs, hashes, classification, and status — verified by re-reading every `INSERT`/`db.insert` statement across Tasks 1-7 and confirming none carries spell/feat/monster mechanical data.

**"Small/sample-scale, no bulk import before independent review" check:** Task 7 populates ~65-90 page-level rows (a real, verified, small number — not "thousands of entities"), zero of which contain individual game-entity data; it's the only task touching the real network, and it's explicitly called out as separable/deferrable at its own header, before its file list, and again in its expected-behavior section.

**"Reuse Phase 0/1, don't invent parallel metadata" check:** confirmed by re-reading Tasks 1-6 — every status/provenance/audit concept traces back to an existing Phase 0/1 export (`RuleSource`, `IngestionStatus`, `VerificationMetadata`, `buildCanonicalId`, `recordRevision`) rather than a locally-defined equivalent; the two intentionally-new concepts (`CorpusArea`, the discovered/failed distinction) are new because the design spec and the user's explicit requirements name them as genuinely new dimensions Phase 0/1 never covered, not because an existing concept was overlooked.

No gaps found. Ready for user approval.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-22-dnd35-srd-ingestion-foundation-phase2a.md`. Per your explicit instruction, stopping here for your review before any code is written — this plan has not been executed, and Phase 2B/SRD entity extraction has not been started.
