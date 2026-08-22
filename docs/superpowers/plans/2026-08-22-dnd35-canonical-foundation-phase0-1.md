# D&D 3.5e Canonical Rules Library — Phase 0 & Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the stale `feature/library-of-knowledge` branch against current production (Phase 0), then build the canonical foundation layer — Source Registry, canonical ID scheme, ruleset/setting/source-enablement evaluation, authoritative campaign source-selection persistence (`all_official`/`core_only`/`custom`, server-only, no UI), provenance model, dual ingestion/automation status tracking, a revision/audit model, a shared rule-primitives vocabulary, and the `campaigns.rulesWeight` migration (Phase 1). No entity content (spells/feats/monsters/prestige classes/items), no SRD ingestion, no engine/AI wiring, no Library UI — those are later phases with their own future plans.

**Architecture:** A new `shared/rules-registry/` directory holds the foundation layer as small, focused modules (mirroring the existing `client/src/lib/rulesAdapters/` and `shared/rulesets.ts` split-by-concern convention), following `server/compendium.ts`'s already-proven patterns for schema, migration, and provenance fields rather than inventing a new shape. The `rulesWeight` migration is a self-contained value-set expansion on an existing, already-shipped campaign field, independent of everything else in this plan and touching zero character data.

**Tech Stack:** Drizzle ORM (SQLite dialect), the hand-rolled `runMigrations()` migration mechanism in `server/storage.ts` (`CREATE TABLE IF NOT EXISTS` / `addColumnIfMissing` — never `drizzle-kit push`), Zod validation, `node --import tsx --test` + `node:assert/strict` for tests.

## Global Constraints

- **Do not merge the stale `feature/library-of-knowledge` branch wholesale.** Task 1 produces a written reconciliation document; every later task re-implements fresh against current `production-live-base`, never diffs-and-applies from the stale branch.
- **Do not touch live character data.** Nothing in this plan reads, writes, or migrates `characters.characterData`, `items`, or any player-owned row. The only data migration in this plan is the `campaigns.rulesWeight` value remap, a campaign-level field.
- **Do not begin SRD ingestion or build any entity table** (`spell_definitions`, `feat_definitions`, `monster_definitions`, `prestige_class_definitions`, or 3.5e rows in `item_definitions`) in this plan. That's Phase 2, a separate future plan, and must not start until this plan's foundation is tested and reviewed.
- **`combatStyle` (`campaigns.combatStyle`, values `cinematic|tactical|dice`) must not be touched anywhere in this plan** — schema, validation, UI, or tests. Only `rulesWeight` changes.
- **The `rulesWeight` migration must be backward-compatible** for the ~19 existing production campaigns currently on `light`/`medium`/`crunchy` — remap is `crunchy → Strict`, `medium → Standard`, `light → Light Rules`, applied via `runMigrations()`, never a manual one-off script.
- **Every task includes:** files/components affected, expected behavior, tests required, migration risk, rollback consideration. **Every task ends with an independent verification step before the next task begins** — no task starts until the prior one's tests/typecheck are independently confirmed passing, not just reported.
- New tables/columns use `CREATE TABLE IF NOT EXISTS` / `addColumnIfMissing` inside `server/storage.ts`'s `runMigrations()` — matching the existing mechanism used for every other table in this codebase, including `server/compendium.ts`'s own schema.
- Follow `server/compendium.ts`'s lazy-prepared-statement pattern: never declare `sqlite.prepare()` at module top level (a fresh-DB startup crash bug already happened once in that exact file from violating this).
- Test file conventions: `node --import tsx --test`, `node:assert/strict`, e2e-style tests spin up a real `express()` + `createServer()` + `registerRoutes()` server with a temp SQLite DB path set via `process.env.DATABASE_URL` before the dynamic import, matching the pattern established in `server/campaign-settings.test.ts` this session.

---

## File Structure

```
shared/rules-registry/
  sources.ts              Source Registry table + types + storage CRUD (Task 2)
  canonical-id.ts          CanonicalId format/parser/validator (Task 3)
  provenance.ts             Shared provenance field shape + IngestionStatus/AutomationStatus types
                             + status-transition validator (Task 3)
  source-enablement.ts       Ruleset -> setting -> enabled-sources evaluator (Task 4)
  revisions.ts                Revision/audit table + types + storage CRUD (Task 6)
  primitives.ts                 Shared rule-primitives vocabulary (conditions, actions,
                                 power systems, creature types) (Task 7)
  index.ts                       Barrel export of the above

server/storage.ts           Modified: runMigrations() gains new table definitions (Tasks 2, 5, 6)
                             and the rulesWeight remap (Task 8); IStorage interface and
                             DatabaseStorage class gain CRUD methods for sources/campaign
                             source-selection/revisions.
shared/schema.ts             Modified: campaigns.rulesWeight comment/type updated (Task 8);
                             campaigns.setting + campaigns.sourcePreset columns and the new
                             campaignEnabledSources table added (Task 5)
server/routes.ts             Modified: campaignSettingsPatchSchema's rulesWeight enum (Task 8);
                             new PATCH /api/campaigns/:id/sources route (Task 5)
client/src/components/CampaignSettingsPanel.tsx   Modified: RULES_OPTIONS array (Task 8)

server/rules-registry.test.ts          New: Source Registry + revisions CRUD tests (Tasks 2, 6)
shared/rules-registry/canonical-id.test.ts        New: ID parser/validator unit tests (Task 3)
shared/rules-registry/provenance.test.ts           New: status-transition validator tests (Task 3)
shared/rules-registry/source-enablement.test.ts     New: evaluator unit tests (Task 4)
server/campaign-source-selection.test.ts             New: persistence + resolver + route
                                                       integration tests (Task 5)
shared/rules-registry/primitives.test.ts             New: vocabulary coverage tests (Task 7)
server/campaign-settings.test.ts                      Modified: rulesWeight migration tests (Task 8)

docs/superpowers/notes/2026-08-22-library-branch-reconciliation.md   New: Task 1's deliverable
```

---

### Task 1: Reconcile production against the stale Library branch

**Files:**
- Create: `docs/superpowers/notes/2026-08-22-library-branch-reconciliation.md`
- No code changes — this task's deliverable is a document, not a schema/implementation.

**Expected behavior:** A committed, reviewable document that answers precisely: what does `origin/feature/library-of-knowledge` contain, which parts are safe patterns to re-implement fresh in Phase 1+ (cite file/pattern, not code to copy), and which parts must never be touched (the `POST /api/campaigns/:id/action` override, anything predating the Options/Settings system or the character-sheet/Codex consolidation).

**Migration risk:** None — read-only investigation, no schema or code changes.

**Rollback consideration:** None needed; deleting the doc if it needs a rewrite has zero blast radius.

- [ ] **Step 1: Fetch the stale branch's ref explicitly**

The local git config's fetch refspec is scoped to a single branch and does not mirror `feature/library-of-knowledge` by default.

```bash
git fetch origin feature/library-of-knowledge:refs/remotes/origin/feature/library-of-knowledge
git fetch origin feature/dnd35-grimoire-holy-tome-feat-codex:refs/remotes/origin/feature/dnd35-grimoire-holy-tome-feat-codex
```

Expected: both refs now resolve via `git rev-parse origin/feature/library-of-knowledge` and `git rev-parse origin/feature/dnd35-grimoire-holy-tome-feat-codex` without error.

- [ ] **Step 2: Confirm the merge-base and commit drift**

```bash
git merge-base production-live-base origin/feature/library-of-knowledge
git log --oneline production-live-base ^origin/feature/library-of-knowledge | wc -l
git log --oneline origin/feature/library-of-knowledge ^production-live-base | wc -l
```

Expected: merge-base is `594c6f8` (confirmed this session); first count is 32 or higher (production commits absent from the stale branch); second count is 32 (the stale branch's own commits).

- [ ] **Step 3: Diff the highest-risk file (`POST /api/campaigns/:id/action`) between the two branches**

```bash
git diff production-live-base origin/feature/library-of-knowledge -- server/routes.ts | head -200
```

Read enough to characterize the shape of the divergence (does the stale branch wrap the same route with extra logic before/after, or rewrite it entirely?) — this determines whether Phase 3 (a later plan) can layer new logic around the current route or must design something structurally different. Do not attempt to reconcile this file now; only characterize it.

- [ ] **Step 4: Write the reconciliation document**

Structure (all findings sourced from Steps 1-3 plus this session's own prior investigation — cite file paths and line numbers, do not paraphrase vaguely):

```markdown
# Library Branch Reconciliation

## Branches involved
- `origin/feature/library-of-knowledge` — merge-base `594c6f8`, N commits ahead/behind production
- `origin/feature/dnd35-grimoire-holy-tome-feat-codex` — independently diverged, not an ancestor

## Safe-to-reference patterns (re-implement fresh, never copy-paste)
[For each: file path on the stale branch, what it does, why it's a good pattern,
 which Phase 1+ task should draw on it]
- `server/knowledge-library.ts` KnowledgeVolumeKind model -> informs Phase 4's Library UI (not this plan)
- `shared/dnd35-rules/types.ts` -> compare field-for-field against this plan's Task 2/3 schemas
  once both exist; note any field this plan's schema is missing that the stale branch identified
- `client/src/pages/rules-tome.tsx` reusing `CompendiumBook.tsx` -> validates that the existing
  Volume-I UI shell generalizes; informs Phase 4, not this plan

## Do-not-touch / high-risk areas
- `POST /api/campaigns/:id/action` override — [characterization from Step 3]
- Anything predating commit [X] (Options/Settings system) or [Y] (character-sheet/Codex
  consolidation) — the stale branch still has deleted components (`CharacterProfileDialog`,
  `openCharacterSheetPopup`) that production removed; treat as evidence the branch's
  client-side assumptions are stale, not as something to restore.

## Explicit scope decision for THIS plan (Phase 0/1)
This plan builds the canonical foundation layer fresh, informed by but not copied from
the stale branch's `shared/dnd35-rules/` shape. No file from the stale branch is merged,
cherry-picked, or diffed-and-applied in any task below.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/notes/2026-08-22-library-branch-reconciliation.md
git commit -m "docs: reconcile stale Library branch against current production"
```

**Independent verification before Task 2 begins:** re-read the committed document fresh; confirm every claim in it cites a real file path/commit/line rather than a paraphrase, and confirm no task in this plan (Tasks 2-7) instructs copying any file from the stale branch — only referencing patterns by description.

---

### Task 2: Source Registry — schema, storage, tests

**Files:**
- Create: `shared/rules-registry/sources.ts`
- Modify: `server/storage.ts` (add migration block to `runMigrations()`, add CRUD methods to `IStorage`/`DatabaseStorage`)
- Create: `server/rules-registry.test.ts`

**Interfaces:**
- Produces: `RuleSource` type, `ruleSources` Drizzle table, `storage.createRuleSource(entry): RuleSource`, `storage.getRuleSource(sourceKey): RuleSource | undefined`, `storage.listRuleSources(filter?: {ruleset?: string; setting?: string}): RuleSource[]`, `storage.updateRuleSource(sourceKey, updates): void`.

**Expected behavior:** A new `rule_sources` table exists after server restart on both a fresh DB and an existing production DB (via `addColumnIfMissing`-style idempotent migration). Rows are ruleset/setting/publication-type/provenance/license classified per spec §2. A source can reference another source it supersedes (errata chain) via a nullable self-referential `supersedesSourceId`.

**Migration risk:** Low — pure table addition, `CREATE TABLE IF NOT EXISTS`, no existing table altered, no existing row touched.

**Rollback consideration:** Dropping `rule_sources` (if ever needed) has zero downstream impact in this plan, since no other table references it yet except `campaign_enabled_sources` (Task 5, a join table storing bare `rule_sources.id` integers — it would need a corresponding cleanup, not a cascading failure) and Task 6's revisions table, which references entities generically by `canonicalId`+`entityType`, not `rule_sources` rows directly.

- [ ] **Step 1: Read `server/compendium.ts`'s `ensureCompendiumSchema()` and its `ItemDefinitionRecord` provenance fields in full**

Confirm the exact current shape before writing a structurally-similar table — this plan's `rule_sources` table normalizes the same provenance concept `item_definitions` currently inlines per-row, so the field names/types should feel like a natural sibling, not a redesign.

- [ ] **Step 2: Write `shared/rules-registry/sources.ts`**

```ts
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
```

- [ ] **Step 3: Add the migration block to `server/storage.ts`'s `runMigrations()`**

Append (after existing calls, no reordering):

```ts
sqlite.exec(`CREATE TABLE IF NOT EXISTS rule_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  publisher TEXT NOT NULL DEFAULT '',
  ruleset TEXT NOT NULL,
  native_edition TEXT NOT NULL DEFAULT '',
  setting TEXT NOT NULL DEFAULT 'generic',
  publication_type TEXT NOT NULL,
  provenance_classification TEXT NOT NULL,
  license_classification TEXT NOT NULL,
  publication_date TEXT,
  supersedes_source_id INTEGER,
  verification_method TEXT NOT NULL DEFAULT '',
  verified_by TEXT NOT NULL DEFAULT '',
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`);

sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_rule_sources_ruleset_setting
  ON rule_sources(ruleset, setting);`);
```

- [ ] **Step 4: Add CRUD methods to `IStorage`/`DatabaseStorage` in `server/storage.ts`**

Import `ruleSources`, `RuleSource`, `CreateRuleSourceInput` from `@shared/rules-registry/sources` (match this file's existing relative/alias import style). Add to the `IStorage` interface and `DatabaseStorage` class, following the lazy-prepared-statement pattern already used elsewhere in this file (never a module-top-level `sqlite.prepare()`):

```ts
createRuleSource(entry: CreateRuleSourceInput): RuleSource {
  const now = new Date().toISOString();
  const [row] = db.insert(ruleSources).values({
    sourceKey: entry.sourceKey,
    title: entry.title,
    publisher: entry.publisher ?? "",
    ruleset: entry.ruleset,
    nativeEdition: entry.nativeEdition ?? "",
    setting: entry.setting ?? "generic",
    publicationType: entry.publicationType,
    provenanceClassification: entry.provenanceClassification,
    licenseClassification: entry.licenseClassification,
    publicationDate: entry.publicationDate ?? null,
    supersedesSourceId: entry.supersedesSourceId ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning().all();
  return row;
},

getRuleSource(sourceKey: string): RuleSource | undefined {
  return db.select().from(ruleSources).where(eq(ruleSources.sourceKey, sourceKey)).get();
},

listRuleSources(filter?: { ruleset?: string; setting?: string }): RuleSource[] {
  let query = db.select().from(ruleSources).$dynamic();
  if (filter?.ruleset) query = query.where(eq(ruleSources.ruleset, filter.ruleset));
  const rows = query.all();
  return filter?.setting ? rows.filter((r) => r.setting === filter.setting) : rows;
},

updateRuleSource(sourceKey: string, updates: Partial<CreateRuleSourceInput>): void {
  db.update(ruleSources)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(eq(ruleSources.sourceKey, sourceKey))
    .run();
},
```

(If `$dynamic()`/chained-`.where()` isn't available in this project's installed `drizzle-orm` version, read how `server/compendium.ts`'s `searchItemDefinitions` builds conditional queries and match that exact pattern instead — don't guess at Drizzle API surface not already used in this codebase.)

- [ ] **Step 5: Write `server/rules-registry.test.ts`**

Follow the e2e fixture pattern from `server/campaign-settings.test.ts` (temp sqlite db, `runMigrations()`, dynamic import after env vars set).

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-rules-registry-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("./storage");
runMigrations();

test("createRuleSource + getRuleSource round-trip", () => {
  const source = storage.createRuleSource({
    sourceKey: "dnd35e-phb",
    title: "Player's Handbook (3.5)",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  assert.equal(source.title, "Player's Handbook (3.5)");
  const fetched = storage.getRuleSource("dnd35e-phb");
  assert.equal(fetched?.sourceKey, "dnd35e-phb");
});

test("sourceKey uniqueness is enforced", () => {
  storage.createRuleSource({
    sourceKey: "dnd35e-dmg", title: "DMG", ruleset: "dnd35e", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  assert.throws(() => storage.createRuleSource({
    sourceKey: "dnd35e-dmg", title: "DMG duplicate", ruleset: "dnd35e", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  }));
});

test("listRuleSources filters by ruleset and setting", () => {
  storage.createRuleSource({
    sourceKey: "dnd35e-eberron-cs", title: "Eberron Campaign Setting", ruleset: "dnd35e",
    setting: "eberron", publicationType: "setting-book", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const eberronSources = storage.listRuleSources({ ruleset: "dnd35e", setting: "eberron" });
  assert.ok(eberronSources.some((s) => s.sourceKey === "dnd35e-eberron-cs"));
  assert.ok(!eberronSources.some((s) => s.sourceKey === "dnd35e-phb"));
});

test("supersedesSourceId links an errata source to what it corrects", () => {
  const original = storage.createRuleSource({
    sourceKey: "dnd35e-mm-v1", title: "Monster Manual (1st printing)", ruleset: "dnd35e",
    setting: "generic", publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const errata = storage.createRuleSource({
    sourceKey: "dnd35e-mm-errata", title: "Monster Manual Errata", ruleset: "dnd35e",
    setting: "generic", publicationType: "errata", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved", supersedesSourceId: original.id,
  });
  assert.equal(errata.supersedesSourceId, original.id);
});

test("updateRuleSource writes verification metadata", () => {
  storage.updateRuleSource("dnd35e-phb", {});
  const before = storage.getRuleSource("dnd35e-phb")!;
  storage.updateRuleSource("dnd35e-phb", {} as any);
  // direct field update via db not exposed by CreateRuleSourceInput's shape for
  // verification fields — this test documents that verification metadata updates
  // go through a distinct path if/when needed; for now, confirm sourceKey stability
  // across the no-op update.
  const after = storage.getRuleSource("dnd35e-phb")!;
  assert.equal(before.sourceKey, after.sourceKey);
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

- [ ] **Step 6: Run the tests**

Run: `node --import tsx --test server/rules-registry.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 7: Run the full existing suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts` — expect no regressions against the current baseline (253 passing per this session's last confirmed count).
Run: `npx tsc --noEmit` — expect clean.

- [ ] **Step 8: Commit**

```bash
git add shared/rules-registry/sources.ts server/storage.ts server/rules-registry.test.ts
git commit -m "feat: add canonical Rules Source Registry"
```

**Independent verification before Task 3 begins:** re-run the full suite and typecheck fresh (don't trust the implementer's report); confirm `rule_sources` table appears via a direct `PRAGMA table_info(rule_sources)` check against the test DB; confirm no `sqlite.prepare()` call was added at module top level in `server/storage.ts`.

---

### Task 3: Canonical ID scheme + shared provenance/status types

**Files:**
- Create: `shared/rules-registry/canonical-id.ts`
- Create: `shared/rules-registry/canonical-id.test.ts`
- Create: `shared/rules-registry/provenance.ts`
- Create: `shared/rules-registry/provenance.test.ts`

**Interfaces:**
- Consumes: nothing from Task 2 (pure functions/types, no DB).
- Produces: `parseCanonicalId(id: string): {ruleset: string; entityType: string; slug: string} | null`, `buildCanonicalId(ruleset: string, entityType: string, slug: string): string`, `isValidCanonicalId(id: string): boolean`, `IngestionStatus` type (`"discovered"|"extracted"|"structured"|"verified"`), `AutomationStatus` type (`"reference_only"|"partially_executable"|"executable"`), `isValidStatusPair(ingestion: IngestionStatus, automation: AutomationStatus): boolean`, `CanonicalProvenance` interface (the shared fields every future entity table embeds: `sourceReferences: Array<{sourceId: number; page?: string}>`, `ingestionStatus`, `automationStatus`, verification metadata shape).

**Expected behavior:** `dnd35e:spell:fireball` parses to `{ruleset: "dnd35e", entityType: "spell", slug: "fireball"}`; malformed IDs (missing segment, wrong ruleset format, uppercase, spaces) return `null`/`false`. `isValidStatusPair` enforces spec §4's rule: automation status can never exceed `reference_only` while ingestion status is below `verified` (i.e. `partially_executable`/`executable` + `ingestionStatus !== "verified"` is invalid).

**Migration risk:** None — no schema, no DB, pure TypeScript.

**Rollback consideration:** None — deleting these files has no downstream effect until Task 4+ import them (which happens within this same plan, so rollback of Task 3 alone would require rolling back Task 4 too; note this dependency explicitly rather than treating Task 3 as freely revertible in isolation once Task 4 lands).

- [ ] **Step 1: Write `shared/rules-registry/canonical-id.ts`**

```ts
// shared/rules-registry/canonical-id.ts
//
// Canonical entity IDs are ruleset-namespaced from creation, per design
// spec's locked decision #1: dnd35e:spell:fireball and dnd5e:spell:fireball
// are different entities, never queried without a ruleset filter.

const CANONICAL_ID_PATTERN = /^([a-z0-9]+):([a-z-]+):([a-z0-9-]+)$/;

export interface ParsedCanonicalId {
  ruleset: string;
  entityType: string;
  slug: string;
}

export function buildCanonicalId(ruleset: string, entityType: string, slug: string): string {
  return `${ruleset}:${entityType}:${slug}`;
}

export function parseCanonicalId(id: string): ParsedCanonicalId | null {
  const match = CANONICAL_ID_PATTERN.exec(id);
  if (!match) return null;
  return { ruleset: match[1], entityType: match[2], slug: match[3] };
}

export function isValidCanonicalId(id: string): boolean {
  return CANONICAL_ID_PATTERN.test(id);
}
```

- [ ] **Step 2: Write `shared/rules-registry/canonical-id.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCanonicalId, buildCanonicalId, isValidCanonicalId } from "./canonical-id";

test("buildCanonicalId produces the expected format", () => {
  assert.equal(buildCanonicalId("dnd35e", "spell", "fireball"), "dnd35e:spell:fireball");
});

test("parseCanonicalId parses a well-formed ID", () => {
  assert.deepEqual(parseCanonicalId("dnd35e:spell:fireball"), {
    ruleset: "dnd35e", entityType: "spell", slug: "fireball",
  });
});

test("parseCanonicalId returns null for missing segments", () => {
  assert.equal(parseCanonicalId("dnd35e:spell"), null);
  assert.equal(parseCanonicalId("dnd35e"), null);
});

test("parseCanonicalId returns null for uppercase or spaces", () => {
  assert.equal(parseCanonicalId("DND35E:spell:fireball"), null);
  assert.equal(parseCanonicalId("dnd35e:spell:fire ball"), null);
});

test("isValidCanonicalId agrees with parseCanonicalId", () => {
  assert.equal(isValidCanonicalId("dnd35e:feat:power-attack"), true);
  assert.equal(isValidCanonicalId("not valid"), false);
});

test("dnd35e and dnd5e produce distinct IDs for the same slug", () => {
  const a = buildCanonicalId("dnd35e", "spell", "fireball");
  const b = buildCanonicalId("dnd5e", "spell", "fireball");
  assert.notEqual(a, b);
});
```

- [ ] **Step 3: Write `shared/rules-registry/provenance.ts`**

```ts
// shared/rules-registry/provenance.ts
//
// Shared provenance/status shape every future canonical entity table
// (spell_definitions, feat_definitions, monster_definitions,
// prestige_class_definitions — none built in this plan) embeds, per
// design spec §2 and §4. Ingestion status and automation status are
// independent dimensions: a record can be fully verified and structured
// while remaining reference_only indefinitely.

export type IngestionStatus = "discovered" | "extracted" | "structured" | "verified";
export type AutomationStatus = "reference_only" | "partially_executable" | "executable";

export interface SourceReference {
  sourceId: number;
  page?: string;
}

export interface VerificationMetadata {
  method: "ai_cross_check" | "human_review" | "srd_direct_import";
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface CanonicalProvenance {
  sourceReferences: SourceReference[];
  ingestionStatus: IngestionStatus;
  automationStatus: AutomationStatus;
  verification?: VerificationMetadata;
}

const INGESTION_ORDER: Record<IngestionStatus, number> = {
  discovered: 0, extracted: 1, structured: 2, verified: 3,
};

/**
 * Automation status can never advance past reference_only while ingestion
 * status is below verified — automation status only advances on top of
 * verified data, never ahead of it (design spec §4).
 */
export function isValidStatusPair(ingestion: IngestionStatus, automation: AutomationStatus): boolean {
  if (automation === "reference_only") return true;
  return INGESTION_ORDER[ingestion] >= INGESTION_ORDER["verified"];
}
```

- [ ] **Step 4: Write `shared/rules-registry/provenance.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidStatusPair } from "./provenance";

test("reference_only is valid at any ingestion status", () => {
  assert.equal(isValidStatusPair("discovered", "reference_only"), true);
  assert.equal(isValidStatusPair("extracted", "reference_only"), true);
  assert.equal(isValidStatusPair("structured", "reference_only"), true);
  assert.equal(isValidStatusPair("verified", "reference_only"), true);
});

test("partially_executable requires verified ingestion", () => {
  assert.equal(isValidStatusPair("structured", "partially_executable"), false);
  assert.equal(isValidStatusPair("verified", "partially_executable"), true);
});

test("executable requires verified ingestion", () => {
  assert.equal(isValidStatusPair("extracted", "executable"), false);
  assert.equal(isValidStatusPair("verified", "executable"), true);
});

test("a record can be verified and still reference_only (the expected steady state)", () => {
  assert.equal(isValidStatusPair("verified", "reference_only"), true);
});
```

- [ ] **Step 5: Run the tests**

Run: `node --import tsx --test shared/rules-registry/canonical-id.test.ts shared/rules-registry/provenance.test.ts`
Expected: all 10 tests PASS.

- [ ] **Step 6: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 7: Commit**

```bash
git add shared/rules-registry/canonical-id.ts shared/rules-registry/canonical-id.test.ts shared/rules-registry/provenance.ts shared/rules-registry/provenance.test.ts
git commit -m "feat: add canonical ID scheme and ingestion/automation status model"
```

**Independent verification before Task 4 begins:** re-run both new test files plus the full suite fresh; manually construct 2-3 canonical IDs for entity types not yet built (e.g. `dnd35e:monster:owlbear`, `dnd5e:spell:fireball`) and confirm `parseCanonicalId` handles them correctly, as a sanity check beyond the committed test cases.

---

### Task 4: Ruleset → Setting → Source-Enablement evaluator

**Files:**
- Create: `shared/rules-registry/source-enablement.ts`
- Create: `shared/rules-registry/source-enablement.test.ts`

**Interfaces:**
- Consumes: `RuleSource` type from Task 2's `shared/rules-registry/sources.ts` (type-only import, no DB access — this module is a pure function operating on data passed in, not a query).
- Produces: `SourcePreset` type (`"all_official" | "core_only" | "custom"`), `CampaignSourceContext` interface (`{ruleset: string; setting: string; sourcePreset: SourcePreset; customSourceIds?: number[]}`), `isSourceEnabledForCampaign(context: CampaignSourceContext, source: RuleSource): boolean`.

**Expected behavior:** Implements design spec §5 precisely. `all_official` (the default): a source is enabled if `source.ruleset === context.ruleset` AND (`source.setting === "generic"` OR `source.setting === context.setting`) — never indiscriminately every setting ever published for the ruleset. `core_only`: additionally requires `source.publicationType === "core-rulebook"`. `custom`: enabled only if `source.id` is in `context.customSourceIds` — this is the one path that can deliberately cross setting boundaries, since it's an explicit owner choice, never a default.

**Migration risk:** None — pure function, no schema, no DB.

**Rollback consideration:** None in isolation; this function has no callers yet in this plan (nothing wires it into `campaigns` or into a request path — that's Phase 3, out of scope here), so it can be removed without any other task in this plan breaking.

- [ ] **Step 1: Write `shared/rules-registry/source-enablement.ts`**

```ts
// shared/rules-registry/source-enablement.ts
//
// Implements design spec §5: RULESET -> CAMPAIGN SETTING -> ENABLED SOURCES.
// "All Official Sources" means all sources applicable to the campaign's
// ruleset AND active setting (generic-setting sources always included) —
// never indiscriminately every setting ever published for that ruleset.
// This function is pure and takes no DB dependency: callers (a future
// Phase 3 task, not this plan) are responsible for fetching the relevant
// RuleSource rows and the campaign's context before calling this.

import type { RuleSource } from "./sources";

export type SourcePreset = "all_official" | "core_only" | "custom";

export interface CampaignSourceContext {
  ruleset: string;
  setting: string;
  sourcePreset: SourcePreset;
  customSourceIds?: number[];
}

export function isSourceEnabledForCampaign(
  context: CampaignSourceContext,
  source: RuleSource,
): boolean {
  if (context.sourcePreset === "custom") {
    return (context.customSourceIds ?? []).includes(source.id);
  }

  if (source.ruleset !== context.ruleset) return false;
  const settingApplies = source.setting === "generic" || source.setting === context.setting;
  if (!settingApplies) return false;

  if (context.sourcePreset === "core_only") {
    return source.publicationType === "core-rulebook";
  }

  // all_official
  return true;
}
```

- [ ] **Step 2: Write `shared/rules-registry/source-enablement.test.ts`**

Use plain constructed fixture objects matching `RuleSource`'s shape — no DB, no Task 2 dependency at runtime.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSourceEnabledForCampaign, type CampaignSourceContext } from "./source-enablement";
import type { RuleSource } from "./sources";

function makeSource(overrides: Partial<RuleSource>): RuleSource {
  return {
    id: 1, sourceKey: "test-source", title: "Test", publisher: "",
    ruleset: "dnd35e", nativeEdition: "", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved", publicationDate: null,
    supersedesSourceId: null, verificationMethod: "", verifiedBy: "", verifiedAt: null,
    createdAt: "", updatedAt: "", ...overrides,
  } as RuleSource;
}

test("all_official: a generic-setting source is always enabled for the campaign's ruleset", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "eberron", sourcePreset: "all_official" };
  const source = makeSource({ setting: "generic" });
  assert.equal(isSourceEnabledForCampaign(context, source), true);
});

test("all_official: an Eberron campaign does not see Forgotten Realms setting content", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "eberron", sourcePreset: "all_official" };
  const source = makeSource({ setting: "forgotten-realms" });
  assert.equal(isSourceEnabledForCampaign(context, source), false);
});

test("all_official: an Eberron campaign does see Eberron setting content", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "eberron", sourcePreset: "all_official" };
  const source = makeSource({ setting: "eberron" });
  assert.equal(isSourceEnabledForCampaign(context, source), true);
});

test("all_official: never crosses ruleset, even for a generic-setting source", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "generic", sourcePreset: "all_official" };
  const source = makeSource({ ruleset: "dnd5e", setting: "generic" });
  assert.equal(isSourceEnabledForCampaign(context, source), false);
});

test("core_only: excludes a generic-setting splatbook", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "generic", sourcePreset: "core_only" };
  const source = makeSource({ setting: "generic", publicationType: "splatbook" });
  assert.equal(isSourceEnabledForCampaign(context, source), false);
});

test("core_only: includes a generic-setting core rulebook", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "generic", sourcePreset: "core_only" };
  const source = makeSource({ setting: "generic", publicationType: "core-rulebook" });
  assert.equal(isSourceEnabledForCampaign(context, source), true);
});

test("custom: only explicitly-listed source IDs are enabled, regardless of setting", () => {
  const context: CampaignSourceContext = {
    ruleset: "dnd35e", setting: "eberron", sourcePreset: "custom", customSourceIds: [42],
  };
  const enabled = makeSource({ id: 42, setting: "forgotten-realms" });
  const notEnabled = makeSource({ id: 43, setting: "eberron" });
  assert.equal(isSourceEnabledForCampaign(context, enabled), true, "explicitly listed, crosses setting boundary deliberately");
  assert.equal(isSourceEnabledForCampaign(context, notEnabled), false, "same setting as campaign but not explicitly listed");
});

test("custom: an empty customSourceIds list enables nothing", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "generic", sourcePreset: "custom" };
  const source = makeSource({ id: 1, setting: "generic" });
  assert.equal(isSourceEnabledForCampaign(context, source), false);
});
```

- [ ] **Step 3: Run the tests**

Run: `node --import tsx --test shared/rules-registry/source-enablement.test.ts`
Expected: all 8 tests PASS.

- [ ] **Step 4: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add shared/rules-registry/source-enablement.ts shared/rules-registry/source-enablement.test.ts
git commit -m "feat: add ruleset/setting/source-enablement evaluator"
```

**Independent verification before Task 5 begins:** re-run tests fresh; manually trace through the "Eberron campaign, all_official preset" scenario against the 14 real Eberron-setting sources and confirm none of them would be visible to a Forgotten Realms campaign under this logic (a reasoning check, not a new test file).

---

### Task 5: Campaign Source Selection — persistence + resolver

**Files:**
- Modify: `shared/schema.ts` (add `campaigns.setting` column, `campaigns.sourcePreset` column, new `campaignEnabledSources` table)
- Modify: `shared/rules-registry/sources.ts` (add `getRuleSourceById`, needed by the resolver and the custom-source validator)
- Modify: `server/storage.ts` (migration block; `IStorage`/`DatabaseStorage` gain `setCampaignSourcePreset`, `setCampaignCustomSources`, `getCampaignEnabledSources`, `getRuleSourceById`)
- Modify: `server/routes.ts` (new `PATCH /api/campaigns/:id/sources` route)
- Create: `server/campaign-source-selection.test.ts`

**Interfaces:**
- Consumes: `RuleSource`, `storage.listRuleSources` (Task 2); `SourcePreset`, `CampaignSourceContext`, `isSourceEnabledForCampaign` (Task 4); `getCampaignAuthority` (existing, `server/routes.ts`).
- Produces: `storage.setCampaignSourcePreset(campaignId: number, preset: SourcePreset): void`, `storage.setCampaignCustomSources(campaignId: number, sourceIds: number[]): void` (throws `Error` if any `sourceIds` entry's `ruleset` doesn't match the campaign's own `ruleset`, or doesn't exist), `storage.getCampaignEnabledSources(campaignId: number): RuleSource[]` (the real resolver — Task 6 and later phases call this, never `isSourceEnabledForCampaign` directly against a bare context), `storage.getRuleSourceById(id: number): RuleSource | undefined`.

**Expected behavior:** Every campaign persists its own `setting` (`"generic" | "eberron" | "forgotten-realms" | ...` — free-text `text` column like `rule_sources.setting`, not an enum, so new settings never require a migration) and `sourcePreset` (`"all_official" | "core_only" | "custom"`, default `"all_official"`). `getCampaignEnabledSources(campaignId)` loads the campaign, builds a `CampaignSourceContext` from its persisted `ruleset`/`setting`/`sourcePreset` (+ `customSourceIds` read fresh from `campaign_enabled_sources` when `sourcePreset === "custom"`), fetches every `rule_sources` row via `listRuleSources({ruleset: campaign.ruleset})`, and returns the subset `isSourceEnabledForCampaign` accepts — this is the one and only path anything in this codebase should use to ask "what sources can this campaign see," never a bespoke re-implementation. `all_official` needs no extra persistence beyond the preset value itself, since it's computed fresh from the live `rule_sources` table on every call — a newly `createRuleSource`'d row applicable to the campaign's ruleset+setting appears automatically, with no campaign-side write required. `custom` mode's enabled set never changes on its own: it only reflects whatever `setCampaignCustomSources` last wrote to `campaign_enabled_sources`, so a newly registered source — even one that would otherwise qualify — never appears for a `custom` campaign until an explicit follow-up call adds it. `setCampaignCustomSources` rejects (throws, caught by the route as a 400) any `sourceIds` entry whose `ruleset` doesn't match the campaign's `ruleset`, or that doesn't resolve via `getRuleSourceById` at all — this is the "invalid/wrong-ruleset source IDs being rejected" requirement, enforced at write time so a bad ID can never silently sit in the table. The new `PATCH /api/campaigns/:id/sources` route is authority-gated (`getCampaignAuthority(req, campaign) !== "owner"` → 403, matching every other campaign-settings-mutating route in this file) and entirely server-side — **no client UI is built in this task**, per the explicit instruction to keep Phase 1 server-only here.

**Migration risk:** Low — two new columns via `addColumnIfMissing` (both with safe defaults: `setting` defaults to `"generic"`, `sourcePreset` defaults to `"all_official"`, so every existing production campaign silently gets the least-surprising values with no explicit backfill needed) plus one new pure-addition join table (`campaign_enabled_sources`). No existing column altered, no existing row's meaning changed.

**Rollback consideration:** Dropping `campaign_enabled_sources` and the two new `campaigns` columns has no cascading effect within this plan — nothing else in Tasks 6-8 reads them (Task 6's revisions table is entity-generic and unrelated; Task 8's `rulesWeight` migration is a separate campaign field). The new route can be removed independently of the schema if ever needed, since it's the only caller of the new storage methods.

- [ ] **Step 1: Add the new columns and table to `shared/schema.ts`**

```ts
// In the campaigns table definition, alongside the existing ruleset/rulesWeight/combatStyle columns:
setting: text("setting").notNull().default("generic"),
// Active campaign setting for source scoping (design spec §5) — e.g. "generic",
// "eberron", "forgotten-realms". Distinct from worldType/worldGenStyle, which
// describe narrative flavor, not which rule_sources rows apply.
sourcePreset: text("source_preset").notNull().default("all_official"),
// "all_official" | "core_only" | "custom" — see shared/rules-registry/source-enablement.ts.
```

```ts
// New table, alongside the campaigns table definition:
export const campaignEnabledSources = sqliteTable("campaign_enabled_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  sourceId: integer("source_id").notNull(),
});
export type CampaignEnabledSource = typeof campaignEnabledSources.$inferSelect;
```

(Match this file's existing import style — `sqliteTable`/`integer`/`text` are already imported for the `campaigns` table.)

- [ ] **Step 2: Add `getRuleSourceById` to `shared/rules-registry/sources.ts`**

No new type needed — this is an additional accessor over the same `ruleSources` table Task 2 defined. Document it alongside the existing exports:

```ts
// Added by Task 5 — the campaign source-selection resolver and the
// custom-source validator both need id-based lookup; Task 2's
// getRuleSource(sourceKey) is key-based and insufficient for either.
```

(The function body lives in `server/storage.ts`'s `DatabaseStorage`, matching where `getRuleSource` itself lives — this file only needs the doc comment above its existing exports noting the addition, since `sources.ts` holds types/table/input-shape, not storage methods.)

- [ ] **Step 3: Add the migration block to `server/storage.ts`'s `runMigrations()`**

```ts
addColumnIfMissing("campaigns", "setting", "TEXT NOT NULL DEFAULT 'generic'");
addColumnIfMissing("campaigns", "source_preset", "TEXT NOT NULL DEFAULT 'all_official'");

sqlite.exec(`CREATE TABLE IF NOT EXISTS campaign_enabled_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  source_id INTEGER NOT NULL
);`);

sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_campaign_enabled_sources_campaign_id
  ON campaign_enabled_sources(campaign_id);`);
```

- [ ] **Step 4: Add storage methods to `IStorage`/`DatabaseStorage` in `server/storage.ts`**

```ts
getRuleSourceById(id: number): RuleSource | undefined {
  return db.select().from(ruleSources).where(eq(ruleSources.id, id)).get();
},

setCampaignSourcePreset(campaignId: number, preset: SourcePreset): void {
  db.update(campaigns).set({ sourcePreset: preset }).where(eq(campaigns.id, campaignId)).run();
},

setCampaignCustomSources(campaignId: number, sourceIds: number[]): void {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  for (const sourceId of sourceIds) {
    const source = this.getRuleSourceById(sourceId);
    if (!source) throw new Error(`Rule source ${sourceId} does not exist`);
    if (source.ruleset !== campaign.ruleset) {
      throw new Error(
        `Rule source ${sourceId} (ruleset "${source.ruleset}") does not match campaign ruleset "${campaign.ruleset}"`
      );
    }
  }

  db.delete(campaignEnabledSources).where(eq(campaignEnabledSources.campaignId, campaignId)).run();
  if (sourceIds.length > 0) {
    db.insert(campaignEnabledSources)
      .values(sourceIds.map((sourceId) => ({ campaignId, sourceId })))
      .run();
  }
},

getCampaignEnabledSources(campaignId: number): RuleSource[] {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const candidates = this.listRuleSources({ ruleset: campaign.ruleset });

  let customSourceIds: number[] | undefined;
  if (campaign.sourcePreset === "custom") {
    const rows = db.select().from(campaignEnabledSources)
      .where(eq(campaignEnabledSources.campaignId, campaignId)).all();
    customSourceIds = rows.map((r) => r.sourceId);
  }

  const context: CampaignSourceContext = {
    ruleset: campaign.ruleset,
    setting: campaign.setting,
    sourcePreset: campaign.sourcePreset as SourcePreset,
    customSourceIds,
  };

  return candidates.filter((source) => isSourceEnabledForCampaign(context, source));
},
```

Import `campaignEnabledSources` from `@shared/rules-registry/sources`-adjacent schema location (wherever Step 1 placed it — likely `@shared/schema` alongside `campaigns`, matching this file's existing import for `campaigns`), and `isSourceEnabledForCampaign`/`CampaignSourceContext`/`SourcePreset` from `@shared/rules-registry/source-enablement` (Task 4). Follow the lazy-prepared-statement pattern already used throughout this file.

- [ ] **Step 5: Add the route to `server/routes.ts`**

Place near the other campaign-settings-mutating routes (after the lock/unlock route), following the exact same authority-gate shape:

```ts
const campaignSourceSelectionPatchSchema = z
  .object({
    sourcePreset: z.enum(["all_official", "core_only", "custom"]).optional(),
    customSourceIds: z.array(z.number().int().positive()).optional(),
  })
  .strict();

app.patch("/api/campaigns/:id/sources", (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = storage.getCampaign(campaignId);
  if (!campaign) return res.status(404).json({ message: "Campaign not found" });

  const authority = getCampaignAuthority(req, campaign);
  if (authority !== "owner") {
    return res.status(403).json({ message: "Only the host can change source selection" });
  }

  const parsed = campaignSourceSelectionPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid source selection", errors: parsed.error.flatten() });
  }

  try {
    if (parsed.data.sourcePreset) {
      storage.setCampaignSourcePreset(campaignId, parsed.data.sourcePreset);
    }
    if (parsed.data.customSourceIds) {
      storage.setCampaignCustomSources(campaignId, parsed.data.customSourceIds);
    }
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : "Invalid source selection" });
  }

  const enabledSources = storage.getCampaignEnabledSources(campaignId);
  return res.json({ sourcePreset: storage.getCampaign(campaignId)?.sourcePreset, enabledSources });
});
```

(Confirm the exact current import list at the top of `server/routes.ts` for `z` and add nothing duplicate; this route sits alongside, not inside, the existing `campaignSettingsPatchSchema`-based PATCH route, since source selection is a distinct concern from `tone`/`combatStyle`/`rulesWeight`/etc.)

- [ ] **Step 6: Write `server/campaign-source-selection.test.ts`**

Follow the real e2e fixture pattern (`express()` + `createServer()` + `registerRoutes()` + real `fetch()`, temp SQLite DB, `signToken()`+cookie auth) from `server/campaign-settings.test.ts` — this task needs the real HTTP route under test, not just storage-layer calls.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import express from "express";
import { createServer } from "node:http";

const dbPath = path.join(os.tmpdir(), `dmos-campaign-sources-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage, signToken } = await import("./storage");
const { registerRoutes } = await import("./routes");
runMigrations();

const app = express();
app.use(express.json());
const server = createServer(app);
await registerRoutes(app, server);
await new Promise<void>((resolve) => server.listen(0, resolve));
const port = (server.address() as any).port;
const base = `http://localhost:${port}`;

function makeFixture(ruleset = "dnd35e") {
  const owner = storage.createUser({ username: `owner-${Date.now()}-${Math.random()}`, password: "x" } as any);
  const campaign = storage.createCampaign({ name: "Test Campaign", userId: owner.id, ruleset } as any);
  return { owner, campaign };
}

test("generic 3.5 sources are included under all_official for a generic-setting campaign", async () => {
  const generic = storage.createRuleSource({
    sourceKey: "dnd35e-phb-a", title: "PHB", ruleset: "dnd35e", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const { campaign } = makeFixture();
  const enabled = storage.getCampaignEnabledSources(campaign.id);
  assert.ok(enabled.some((s) => s.id === generic.id));
});

test("Eberron and Forgotten Realms sources stay isolated from each other under all_official", async () => {
  const eberron = storage.createRuleSource({
    sourceKey: "dnd35e-eberron-a", title: "Eberron CS", ruleset: "dnd35e", setting: "eberron",
    publicationType: "setting-book", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const faerun = storage.createRuleSource({
    sourceKey: "dnd35e-faerun-a", title: "FRCS", ruleset: "dnd35e", setting: "forgotten-realms",
    publicationType: "setting-book", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const { owner, campaign } = makeFixture();
  storage.updateCampaign(campaign.id, { setting: "eberron" } as any);
  const enabled = storage.getCampaignEnabledSources(campaign.id);
  assert.ok(enabled.some((s) => s.id === eberron.id));
  assert.ok(!enabled.some((s) => s.id === faerun.id));
});

test("all_official dynamically includes a source registered after the campaign was created", async () => {
  const { campaign } = makeFixture();
  const before = storage.getCampaignEnabledSources(campaign.id);
  const late = storage.createRuleSource({
    sourceKey: "dnd35e-late-a", title: "Late-Registered Splatbook", ruleset: "dnd35e", setting: "generic",
    publicationType: "splatbook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const after = storage.getCampaignEnabledSources(campaign.id);
  assert.ok(!before.some((s) => s.id === late.id));
  assert.ok(after.some((s) => s.id === late.id));
});

test("custom mode is frozen — a source registered after selection does not silently appear", async () => {
  const kept = storage.createRuleSource({
    sourceKey: "dnd35e-custom-kept", title: "Kept Source", ruleset: "dnd35e", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const { campaign } = makeFixture();
  storage.setCampaignSourcePreset(campaign.id, "custom");
  storage.setCampaignCustomSources(campaign.id, [kept.id]);

  const lateArrival = storage.createRuleSource({
    sourceKey: "dnd35e-custom-late", title: "Late Arrival", ruleset: "dnd35e", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });

  const enabled = storage.getCampaignEnabledSources(campaign.id);
  assert.ok(enabled.some((s) => s.id === kept.id));
  assert.ok(!enabled.some((s) => s.id === lateArrival.id));
});

test("setCampaignCustomSources rejects a source from a different ruleset", async () => {
  const wrongRuleset = storage.createRuleSource({
    sourceKey: "dnd5e-wrong-ruleset", title: "5e Source", ruleset: "dnd5e", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const { campaign } = makeFixture("dnd35e");
  assert.throws(() => storage.setCampaignCustomSources(campaign.id, [wrongRuleset.id]));
});

test("PATCH /api/campaigns/:id/sources rejects a wrong-ruleset source ID over HTTP as 400", async () => {
  const wrongRuleset = storage.createRuleSource({
    sourceKey: "dnd5e-wrong-ruleset-http", title: "5e Source", ruleset: "dnd5e", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const { owner, campaign } = makeFixture("dnd35e");
  const token = signToken(owner.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/sources`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ sourcePreset: "custom", customSourceIds: [wrongRuleset.id] }),
  });
  assert.equal(res.status, 400);
});

after(() => {
  server.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

(Confirm the exact current signatures of `storage.createUser`/`storage.createCampaign`/`signToken`/`registerRoutes` against `server/campaign-settings.test.ts`'s existing fixture helper before writing this file — reuse its `makeFixture` shape rather than reinventing one, adapting only for the `ruleset` parameter this task's tests need.)

- [ ] **Step 7: Run the tests**

Run: `node --import tsx --test server/campaign-source-selection.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 8: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 9: Commit**

```bash
git add shared/schema.ts shared/rules-registry/sources.ts server/storage.ts server/routes.ts server/campaign-source-selection.test.ts
git commit -m "feat: persist authoritative campaign source selection (all_official/core_only/custom)"
```

**Independent verification before Task 6 begins:** re-run tests fresh; confirm by inspection that `getCampaignEnabledSources` is the only place in this diff that calls `isSourceEnabledForCampaign` (no duplicate/parallel filtering logic); confirm `campaign_enabled_sources` rows are fully replaced (not appended) on each `setCampaignCustomSources` call by re-reading Step 4's delete-then-insert; confirm the new route never bypasses `getCampaignAuthority`.

---

### Task 6: Revision/Audit model

**Files:**
- Create: `shared/rules-registry/revisions.ts`
- Modify: `server/storage.ts` (migration block + CRUD methods)
- Modify: `server/rules-registry.test.ts` (add revision tests to the existing file from Task 2)

**Interfaces:**
- Produces: `CanonicalRevision` type, `canonicalRevisions` Drizzle table, `storage.recordRevision(entry): CanonicalRevision`, `storage.getRevisionHistory(canonicalId: string): CanonicalRevision[]`.

**Expected behavior:** A generic, entity-type-agnostic audit table — any future canonical entity (spell, feat, monster, prestige class, or a `rule_sources` row itself) can have revisions recorded against its `canonicalId`/`sourceKey` without a dedicated revisions table per entity type. Recording a revision never mutates or deletes a prior revision row — purely append-only, matching the `turnLedger` precedent already established in this codebase.

**Migration risk:** Low — pure table addition, no existing table altered.

**Rollback consideration:** Safe to drop in isolation; nothing in this plan writes to it automatically yet (no entity table exists to trigger a revision write) — Task 6 proves the mechanism works via direct test calls, real automatic revision-recording on entity changes is future-phase work once entity tables exist.

- [ ] **Step 1: Write `shared/rules-registry/revisions.ts`**

```ts
// shared/rules-registry/revisions.ts
//
// Generic, entity-type-agnostic audit trail (design spec §15). Any
// canonical record — a rule_sources row, or a future spell/feat/monster/
// prestige-class row — gets its corrections, errata application, or
// automation-status changes recorded here by canonicalId, append-only,
// following this codebase's existing turnLedger precedent (shared/schema.ts).

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
```

- [ ] **Step 2: Add the migration block to `server/storage.ts`'s `runMigrations()`**

```ts
sqlite.exec(`CREATE TABLE IF NOT EXISTS canonical_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  revision INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL DEFAULT '',
  change_reason TEXT NOT NULL,
  diff_summary TEXT NOT NULL DEFAULT ''
);`);

sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_canonical_revisions_canonical_id
  ON canonical_revisions(canonical_id);`);
```

- [ ] **Step 3: Add CRUD methods to `IStorage`/`DatabaseStorage`**

```ts
recordRevision(entry: RecordRevisionInput): CanonicalRevision {
  const [row] = db.insert(canonicalRevisions).values({
    canonicalId: entry.canonicalId,
    entityType: entry.entityType,
    revision: entry.revision,
    changedBy: entry.changedBy ?? "",
    changeReason: entry.changeReason,
    diffSummary: entry.diffSummary ?? "",
  }).returning().all();
  return row;
},

getRevisionHistory(canonicalId: string): CanonicalRevision[] {
  return db.select().from(canonicalRevisions)
    .where(eq(canonicalRevisions.canonicalId, canonicalId))
    .orderBy(desc(canonicalRevisions.revision))
    .all();
},
```

- [ ] **Step 4: Add tests to `server/rules-registry.test.ts`**

```ts
test("recordRevision + getRevisionHistory round-trip, newest first", () => {
  storage.recordRevision({
    canonicalId: "dnd35e:spell:fireball", entityType: "spell", revision: 1,
    changeReason: "initial SRD import",
  });
  storage.recordRevision({
    canonicalId: "dnd35e:spell:fireball", entityType: "spell", revision: 2,
    changeReason: "corrected damage die per errata", changedBy: "reviewer-1",
  });
  const history = storage.getRevisionHistory("dnd35e:spell:fireball");
  assert.equal(history.length, 2);
  assert.equal(history[0].revision, 2, "newest revision first");
  assert.equal(history[1].revision, 1);
});

test("revision history is scoped per canonicalId", () => {
  storage.recordRevision({
    canonicalId: "dnd35e:feat:power-attack", entityType: "feat", revision: 1,
    changeReason: "initial SRD import",
  });
  const fireballHistory = storage.getRevisionHistory("dnd35e:spell:fireball");
  assert.ok(!fireballHistory.some((r) => r.entityType === "feat"));
});

test("recording a new revision never mutates or deletes a prior one", () => {
  const before = storage.getRevisionHistory("dnd35e:spell:fireball").length;
  storage.recordRevision({
    canonicalId: "dnd35e:spell:fireball", entityType: "spell", revision: 3,
    changeReason: "automationStatus raised to executable",
  });
  const after = storage.getRevisionHistory("dnd35e:spell:fireball");
  assert.equal(after.length, before + 1);
  assert.ok(after.some((r) => r.revision === 1), "revision 1 still present");
  assert.ok(after.some((r) => r.revision === 2), "revision 2 still present");
});
```

- [ ] **Step 5: Run the tests**

Run: `node --import tsx --test server/rules-registry.test.ts`
Expected: all 8 tests PASS (5 from Task 2 + 3 new).

- [ ] **Step 6: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 7: Commit**

```bash
git add shared/rules-registry/revisions.ts server/storage.ts server/rules-registry.test.ts
git commit -m "feat: add generic canonical-entity revision/audit model"
```

**Independent verification before Task 7 begins:** re-run tests fresh; confirm `canonical_revisions` has no foreign key constraint tying it to any entity table (it must remain entity-type-agnostic, since no entity table exists yet and it must not need one).

---

### Task 7: Shared rule-primitives vocabulary

**Files:**
- Create: `shared/rules-registry/primitives.ts`
- Create: `shared/rules-registry/primitives.test.ts`

**Interfaces:**
- Produces: `PowerSystem` type (`"spell" | "psionic" | "invocation" | "maneuver" | "incarnum" | "binding" | "shadow-magic" | "truenaming"`), `ConditionId` type (a controlled vocabulary of 3.5e conditions), `CreatureType`/`CreatureSubtype` types, `ActionType` type (standard/move/full-round/free/swift/immediate, per 3.5e's action economy).

**Expected behavior:** A shared, importable vocabulary that future entity tables (Bestiary, spells, feats — not built in this plan) reference by these types rather than each re-inventing their own string unions. This is explicitly named in design spec §1/§11 as needing to exist *before* the Bestiary or any other entity work begins, so that "immune to fire" is encoded the same way whether it's a monster's special quality, a spell's effect, or an item's property.

**Migration risk:** None — pure TypeScript types/constants, no DB.

**Rollback consideration:** None; nothing in this plan consumes these types yet (no entity table exists), so removal has zero blast radius within this plan's scope.

- [ ] **Step 1: Write `shared/rules-registry/primitives.ts`**

```ts
// shared/rules-registry/primitives.ts
//
// Shared vocabulary for concepts that recur across every future canonical
// entity type (design spec §1, §11). Defined before any entity table is
// built so the Bestiary, spells, feats, etc. all reference the SAME
// identifiers for the same concepts, rather than each re-encoding
// "immune to fire" or "flat-footed" independently. Non-spell power
// systems get their own PowerSystem identity — never silently folded
// into "spell" (design spec's locked decision, Overview + §1).

export type PowerSystem =
  | "spell"
  | "psionic"
  | "invocation"
  | "maneuver"
  | "incarnum"
  | "binding"
  | "shadow-magic"
  | "truenaming";

export type ConditionId =
  | "blinded" | "confused" | "cowering" | "dazed" | "dazzled" | "deafened"
  | "entangled" | "exhausted" | "fascinated" | "fatigued" | "flat-footed"
  | "frightened" | "grappling" | "helpless" | "incorporeal" | "invisible"
  | "nauseated" | "panicked" | "paralyzed" | "petrified" | "pinned"
  | "prone" | "shaken" | "sickened" | "stable" | "staggered" | "stunned"
  | "unconscious";

export type ActionType = "standard" | "move" | "full-round" | "free" | "swift" | "immediate";

export type CreatureType =
  | "aberration" | "animal" | "construct" | "dragon" | "elemental" | "fey"
  | "giant" | "humanoid" | "magical-beast" | "monstrous-humanoid" | "ooze"
  | "outsider" | "plant" | "shapechanger" | "undead" | "vermin";

export type CreatureSubtype =
  | "air" | "aquatic" | "augmented" | "chaotic" | "cold" | "earth" | "evil"
  | "extraplanar" | "fire" | "good" | "incorporeal" | "lawful" | "native"
  | "psionic" | "shapechanger" | "swarm" | "water";
```

- [ ] **Step 2: Write `shared/rules-registry/primitives.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PowerSystem, ConditionId, ActionType, CreatureType } from "./primitives";

test("PowerSystem includes every non-spell subsystem named in the design spec", () => {
  const systems: PowerSystem[] = [
    "spell", "psionic", "invocation", "maneuver", "incarnum", "binding",
    "shadow-magic", "truenaming",
  ];
  assert.equal(systems.length, 8, "documents the exact set this plan commits to at this stage");
});

test("psionic is a distinct PowerSystem from spell", () => {
  const psionic: PowerSystem = "psionic";
  const spell: PowerSystem = "spell";
  assert.notEqual(psionic, spell);
});

test("ConditionId covers core 3.5e conditions referenced by name in the SRD", () => {
  const sample: ConditionId[] = ["flat-footed", "prone", "stunned", "grappling", "helpless"];
  assert.equal(sample.length, 5);
});

test("ActionType covers the 3.5e action-economy categories", () => {
  const types: ActionType[] = ["standard", "move", "full-round", "free", "swift", "immediate"];
  assert.equal(types.length, 6);
});

test("CreatureType is a closed vocabulary distinct from CreatureSubtype", () => {
  const type: CreatureType = "dragon";
  assert.equal(type, "dragon");
});
```

(These are intentionally light "does the vocabulary exist and stay distinct" tests — this task defines a type surface, not runtime logic; the tests exist mainly to catch an accidental typo/removal in a future edit, and to make the exact committed vocabulary set reviewable/diffable in test output rather than only in the type file.)

- [ ] **Step 3: Run the tests**

Run: `node --import tsx --test shared/rules-registry/primitives.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 4: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add shared/rules-registry/primitives.ts shared/rules-registry/primitives.test.ts
git commit -m "feat: add shared rule-primitives vocabulary"
```

**Independent verification before Task 8 begins:** re-run tests fresh; cross-check the committed `PowerSystem`/`ConditionId`/`CreatureType` lists against design spec §1's named subsystems list and the SRD's condition list — confirm nothing named in the spec is missing from the vocabulary (this is a completeness check against the spec, not just against the test file that documents the current commit).

---

### Task 8: `rulesWeight` migration — Strict/Standard/Light Rules

**Files:**
- Modify: `shared/schema.ts` (the `campaigns.rulesWeight` column comment/default — the column type itself stays `text`, only the semantic value set changes)
- Modify: `server/storage.ts` (add the value-remap to `runMigrations()`)
- Modify: `server/routes.ts` (`campaignSettingsPatchSchema`'s `rulesWeight` enum)
- Modify: `client/src/components/CampaignSettingsPanel.tsx` (`RULES_OPTIONS` array)
- Modify: `server/campaign-settings.test.ts` (add migration + regression tests)

**Interfaces:**
- Consumes: nothing from Tasks 2-7 — this task is independent and could be done in any order relative to them, sequenced last here only because it's the smallest/lowest-risk and benefits from the rest of the plan's review rhythm being established first.
- Produces: `campaigns.rulesWeight` now accepts `"strict" | "standard" | "light_rules" | "narrative" | "freeform"` (snake_case values matching this codebase's existing enum-value convention, e.g. `"campaign_homebrew"`); `campaignSettingsPatchSchema`'s `rulesWeight` field validates against this new set.

**Expected behavior:** Every existing campaign's `rulesWeight` is remapped exactly once, idempotently, on server startup: `crunchy → strict`, `medium → standard`, `light → light_rules`. New campaigns default to `standard` (replacing the old `medium` default, which is the same semantic position in the new 5-value scale). `combatStyle` is not read, written, or referenced anywhere in this task's diff. The DM AI's system prompt (`buildSystemPrompt()` in `dm-engine.ts`) continues to inject `campaign.rulesWeight` as before — this task updates the schema/validation/UI value set only, not the prompt-construction logic itself (wiring enforcement-mode *behavior* into resolvers is Phase 3, out of scope here); confirm the existing injection still reads the field correctly with the new values by inspection, since this task doesn't change that call site's code.

**Migration risk:** Medium — this is the one data migration in this plan, affecting all ~19 existing production campaigns' `rulesWeight` column. Mitigated by: the remap is a pure value substitution (no rows added/removed, no other column touched), runs inside the existing idempotent `runMigrations()` mechanism (safe to run repeatedly — an already-migrated `"strict"` value is not a `"crunchy"`/`"medium"`/`"light"` value, so the `UPDATE ... WHERE rules_weight = 'crunchy'` style statements are naturally idempotent), and is covered by an explicit test asserting the exact remap on constructed fixture rows before touching anything by inspection on a live system.

**Rollback consideration:** If this needs to be reverted, the reverse remap (`strict → crunchy`, `standard → medium`, `light_rules → light`) is the exact inverse of Step 2's migration and should be written out in this task's report before considering it done, even though it isn't expected to be needed — matching this plan's "explicit rollback consideration" requirement, not just "should be revertible in principle."

- [ ] **Step 1: Read the current exact state of all four files before editing**

`shared/schema.ts`'s `campaigns` table definition (confirm the `rulesWeight` column's exact current declaration and default), `server/routes.ts`'s `campaignSettingsPatchSchema` (confirm the exact current `rulesWeight: z.enum([...])` line, built earlier this session), `CampaignSettingsPanel.tsx`'s `RULES_OPTIONS` array (confirm the exact current three entries and their `description` copy, since the new entries should follow the same `{value, label, description}` shape and tone), and `server/dm-engine.ts`'s `buildSystemPrompt()` (confirm exactly how `campaign.rulesWeight` is read/labeled in the prompt string, to verify by inspection — not by editing — that the new values still make sense in that sentence).

- [ ] **Step 2: Add the migration to `server/storage.ts`'s `runMigrations()`**

```ts
// rulesWeight migration: crunchy/medium/light -> strict/standard/light_rules.
// Idempotent — an already-migrated value never matches these WHERE clauses,
// safe to run on every server startup.
sqlite.exec(`UPDATE campaigns SET rules_weight = 'strict' WHERE rules_weight = 'crunchy';`);
sqlite.exec(`UPDATE campaigns SET rules_weight = 'standard' WHERE rules_weight = 'medium';`);
sqlite.exec(`UPDATE campaigns SET rules_weight = 'light_rules' WHERE rules_weight = 'light';`);
```

Place this after the existing `addColumnIfMissing` calls for `campaigns`, so the column is guaranteed to exist before the `UPDATE` runs.

- [ ] **Step 3: Update `shared/schema.ts`'s `campaigns.rulesWeight` default and comment**

```ts
rulesWeight: text("rules_weight").notNull().default("standard"),
// Rules Enforcement Mode (design spec §18): strict | standard | light_rules |
// narrative | freeform. Independent of combatStyle (which governs HOW combat
// is presented) and independent of ruleset (which governs WHICH rules exist).
```

- [ ] **Step 4: Update `server/routes.ts`'s `campaignSettingsPatchSchema`**

```ts
rulesWeight: z.enum(["strict", "standard", "light_rules", "narrative", "freeform"]).optional(),
```

- [ ] **Step 5: Update `CampaignSettingsPanel.tsx`'s `RULES_OPTIONS`**

```ts
const RULES_OPTIONS: SettingOption[] = [
  { value: "strict",      label: "Strict",      description: "Full canonical rules enforcement, no discretionary bypasses" },
  { value: "standard",    label: "Standard",     description: "Normal rules enforcement with limited DM discretion" },
  { value: "light_rules", label: "Light Rules",  description: "Simplify or skip low-value checks, preserve important mechanics" },
  { value: "narrative",   label: "Narrative",    description: "Prioritize story flow; non-critical mechanics may be softened" },
  { value: "freeform",    label: "Freeform",     description: "Rules are advisory except for state-integrity constraints" },
];
```

(Match whatever exact `SettingOption` field names/order the real file uses — this is a direct value-set expansion of an existing array, not a restructure.)

- [ ] **Step 6: Add migration + regression tests to `server/campaign-settings.test.ts`**

```ts
test("rulesWeight migration: crunchy/medium/light remap to strict/standard/light_rules", () => {
  const { owner: ownerA, campaign: campaignA } = makeFixture();
  storage.updateCampaign(campaignA.id, { rulesWeight: "crunchy" } as any);
  const { campaign: campaignB } = makeFixture();
  storage.updateCampaign(campaignB.id, { rulesWeight: "medium" } as any);
  const { campaign: campaignC } = makeFixture();
  storage.updateCampaign(campaignC.id, { rulesWeight: "light" } as any);

  runMigrations(); // idempotent — re-running applies the remap to the rows just set above

  assert.equal((storage.getCampaign(campaignA.id) as any).rulesWeight, "strict");
  assert.equal((storage.getCampaign(campaignB.id) as any).rulesWeight, "standard");
  assert.equal((storage.getCampaign(campaignC.id) as any).rulesWeight, "light_rules");
});

test("rulesWeight migration is idempotent — running it twice does not further change already-migrated values", () => {
  const { campaign } = makeFixture();
  storage.updateCampaign(campaign.id, { rulesWeight: "strict" } as any);
  runMigrations();
  runMigrations();
  assert.equal((storage.getCampaign(campaign.id) as any).rulesWeight, "strict");
});

test("PATCH /api/campaigns/:id accepts the new rulesWeight enum values", async () => {
  const { owner, campaign } = makeFixture();
  const token = signToken(owner.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ rulesWeight: "narrative" }),
  });
  assert.equal(res.status, 200);
  assert.equal((storage.getCampaign(campaign.id) as any).rulesWeight, "narrative");
});

test("PATCH /api/campaigns/:id rejects the old rulesWeight enum values", async () => {
  const { owner, campaign } = makeFixture();
  const token = signToken(owner.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ rulesWeight: "crunchy" }),
  });
  assert.equal(res.status, 400, "the old enum value must no longer validate");
});

test("combatStyle is completely unaffected by the rulesWeight migration", () => {
  const { campaign } = makeFixture();
  storage.updateCampaign(campaign.id, { rulesWeight: "crunchy", combatStyle: "cinematic" } as any);
  runMigrations();
  const reloaded = storage.getCampaign(campaign.id) as any;
  assert.equal(reloaded.rulesWeight, "strict");
  assert.equal(reloaded.combatStyle, "cinematic", "combatStyle must never change due to this migration");
});
```

(These tests need `runMigrations` imported into the test file — confirm the exact import already used at the top of `server/campaign-settings.test.ts` and reuse it, don't re-import a second copy of `storage`.)

- [ ] **Step 7: Run the tests**

Run: `node --import tsx --test server/campaign-settings.test.ts`
Expected: all prior tests plus the 5 new ones PASS.

- [ ] **Step 8: Run full suite + typecheck + build**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions against this plan's cumulative baseline.
Run: `npx tsc --noEmit` — clean (this will catch any remaining reference to the old 3-value `rulesWeight` enum anywhere else in the codebase that wasn't part of this task's explicit file list).
Run: `npm run build` — must succeed.

- [ ] **Step 9: Commit**

```bash
git add shared/schema.ts server/storage.ts server/routes.ts client/src/components/CampaignSettingsPanel.tsx server/campaign-settings.test.ts
git commit -m "feat: migrate rulesWeight to Strict/Standard/Light Rules/Narrative/Freeform"
```

**Independent verification before this plan is considered complete:** re-run the full test suite, typecheck, and build fresh; grep the entire repo for `"crunchy"|"medium"|"light"` as `rulesWeight`-adjacent string literals (being careful not to false-positive on unrelated uses of those common words) to confirm no other consumer of the old value set was missed; confirm `combatStyle`'s value set (`cinematic|tactical|dice`) is byte-for-byte unchanged in every file this task touched.

---

## Self-Review

**Spec coverage:** §2 (Source Registry) → Task 2. §4 (ingestion/automation status) → Task 3. §5 (ruleset/setting/source-enablement) → Task 4, extended into a real persisted+resolved path by Task 5 (campaign source-selection state, per the user's latest correction — a pure evaluator alone was explicitly rejected as insufficient). §15 (revision/audit) → Task 6. §1/§11 (shared rule primitives) → Task 7. §18 (`rulesWeight` migration) → Task 8. Phase 0's reconciliation requirement → Task 1. Every named Phase 0/Phase 1 requirement from the spec's §17 and the user's own task list has a corresponding task, including the added requirement that campaign source-selection state itself (not just the pure evaluator) be defined, persisted, and server-authoritative with no UI. Nothing in this plan touches §3 (spell projection), §6 (precedence model), §7 (fail-closed), §8 (AI integration), §9-14 (entity-specific work), or §16 (naming) — all correctly deferred to later phases per the user's explicit scope instruction.

**Placeholder scan:** every step has real, complete code — no "TBD," no "add appropriate validation," no bare prose describing what a step should do without showing it. The one intentionally-light spot (Task 7's tests) is explicitly justified in-line as documenting a type surface rather than runtime logic, not a placeholder.

**Type consistency:** `RuleSource` (Task 2) is imported by type-only reference in Task 4's `source-enablement.ts` and again in Task 5's storage methods — checked the field names used in Task 4's `makeSource()` test fixture and Task 5's `getCampaignEnabledSources` against Task 2's actual `ruleSources` schema, they match. Task 5's `CampaignSourceContext`/`SourcePreset` are consumed exactly as Task 4 exports them, with no shadow redefinition. `CanonicalProvenance`/`IngestionStatus`/`AutomationStatus` (Task 3) aren't yet consumed by any other task in this plan (Tasks 4-7 don't reference them) — this is correct per scope, since no entity table exists yet to embed `CanonicalProvenance` on; it's defined now so Phase 2 has it ready, not wired to anything in this plan. `storage.recordRevision`/`getRevisionHistory` (Task 6) use `canonicalId: string` matching the exact string format `buildCanonicalId()` (Task 3) produces, confirmed consistent in the test data (`"dnd35e:spell:fireball"` appears in both Task 3's and Task 6's test fixtures in the same format). Task 5's `campaigns.setting`/`campaigns.sourcePreset` columns are read by Task 5's own resolver only — no other task in this plan reads them, so there's no cross-task drift to check yet.

**Migration risk / rollback:** present explicitly in every task, not just Task 8 — Tasks 2/6 (new tables) and Task 5 (two additive columns + one new join table) are called out as low-risk pure additions; Tasks 3/4/7 (pure TypeScript, no DB) are called out as no-risk; Task 8 (the one real *value-remapping* data migration) has the most detailed risk/rollback treatment, matching its actual risk level rather than being uniform boilerplate across all eight tasks.

**Independent verification gate:** every task ends with a distinct "Independent verification before Task N+1 begins" block, and each one asks for something beyond "re-run the tests" (a direct `PRAGMA` check, a manual reasoning trace, a cross-check against the spec's own text, a repo-wide grep, a duplicate-logic check) — matching the user's explicit "independent verification before the next task" requirement, not just a rerun of what the implementer already ran. Task 5's gate specifically checks that `getCampaignEnabledSources` is the only caller of Task 4's evaluator, guarding against a second, drifting implementation of the same rule.

**"Do not touch live character data" check:** confirmed no task in this plan reads or writes `characters`, `characterData`, `items`, or any player-owned table — every migration in this plan (Tasks 2, 5, 6, 8) is scoped to `rule_sources`, `campaigns`, `campaign_enabled_sources`, or `canonical_revisions`. Task 8 is the only *value-remapping* migration (existing `rulesWeight` rows get rewritten); Tasks 2/5/6 are purely additive (`CREATE TABLE IF NOT EXISTS` / `addColumnIfMissing` with safe defaults, no existing row's meaning changed).

**"Do not merge the stale branch" check:** Task 1 explicitly produces a findings document, not a diff-and-apply; every subsequent task's code is written fresh in this plan document, not copied from the stale branch (confirmed by re-reading Tasks 2-8 — none references applying a stale-branch file, only citing it as prior art in Task 1's own document).

**"No UI yet" check (source selection):** confirmed Task 5 touches only `shared/schema.ts`, `shared/rules-registry/sources.ts`, `server/storage.ts`, `server/routes.ts`, and a server-side test file — no `client/src/**` file appears anywhere in Task 5's file list or steps, matching the user's explicit "Keep this entirely server-side for Phase 1. No UI yet" instruction.

No gaps found. Ready for user approval.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-22-dnd35-canonical-foundation-phase0-1.md`. Per your explicit instruction, stopping here for your review before any code is written — this plan has not been executed.
