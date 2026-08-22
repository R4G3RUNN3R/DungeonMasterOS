# Phase 2A — D&D 3.5e SRD Corpus Manifest & Ingestion Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the machinery to prove what 3.5e SRD *source pages* have been discovered, fetched, hashed, and source-verified across the full approved "ALL rules-bearing d20srd.org material" scope — before any of it is parsed into real game data. This phase produces a queryable, honest, scope-labeled answer to "we discovered N source pages; N are accounted for, X changed since last scan, Y source-verified, Z failed" — and nothing that touches gameplay, AI resolution, canonical entity data, or a UI.

**Revision note (this document supersedes the version reviewed 2026-08-22):** the prior draft conflated an ingestion mirror (`olimot/srd-v3.5`) with the authoritative Wizards source, scoped "ALL" down to whatever one convenient mirror happened to contain, gave source *pages* canonical *entity* IDs, reused the canonical `discovered→extracted→structured→verified` vocabulary in a way that could be misread as claiming individual rules were verified, left the real network run optional, hardcoded a manually-transcribed file list with no immutable pin, exposed a verification writer with no stated access boundary, and force-fed Phase 0/1's `canonical_revisions` table a caller that didn't actually fit its contract. Every one of those is corrected below; see "Resolved Design Decisions" for the reasoning behind each.

**Architecture:** Three `rule_sources` rows separate authoritative provenance from ingestion transport: the original Wizards 3.5e SRD (an identity/citation row — no live fetchable URL), and two independently pinned *derived* transports that are actually fetched — a GitHub-hosted HTML mirror (`olimot/srd-v3.5`, pinned to an exact commit SHA) and the Hypertext d20 SRD (`d20srd.org`, a live site with documented errata integration and, critically, the open-content Unearthed Arcana Variant Rules section neither olimot nor a "core SRD only" scope would otherwise cover). Underneath those sit `srd_manifest_entries` — one row per discovered *source page*, identified by a `sourcePageKey` that is deliberately **not** a canonical entity ID (a page is not a spell, and a repository reorganizing its files must never rename Fireball). Page-processing status uses its own vocabulary (`discovered → fetched → hashed → parsed → source_verified`) — never Phase 0/1's `IngestionStatus`, so a coverage report about pages can never be misread as a claim about individually-verified game rules. A separate, dedicated `srd_source_page_revisions` table tracks page-level change history — `canonical_revisions` stays reserved for actual canonical rules entities, which don't exist until Phase 2B.

**Tech Stack:** Drizzle ORM (SQLite dialect), the existing `runMigrations()` mechanism in `server/storage.ts`, Node's built-in `crypto.createHash("sha256")`, `fetch()` (jsDelivr for the GitHub-hosted mirror, direct HTTPS for `d20srd.org` — see the real-source-structure section for why d20srd.org needed the Claude Browser tool, not `WebFetch`, to inspect during planning), `node --import tsx --test` + `node:assert/strict`.

## Global Constraints

- **No Library UI, no gameplay/AI-resolution wiring, no licensed Google Drive book ingestion, no 5e data merge, no Bestiary/Grimoire/Feat Codex presentation work, no Phase 2B canonical-entity extraction.**
- **Source *pages* are never given canonical entity IDs.** `srd_manifest_entries` has no `canonicalId` column and never calls `buildCanonicalId`/`isValidCanonicalId`/`recordRevision` from `canonical-id.ts`/`revisions.ts`. Those Phase 0/1 exports are reserved for real canonical rules entities (Phase 2B+).
- **Page-processing status is never Phase 0/1's `IngestionStatus`.** This plan defines its own `PageProcessingStatus` type. Nothing in this plan imports `IngestionStatus` from `provenance.ts` for a manifest-entry field. Any report or log line describing page-level counts states its scope explicitly (`reportScope: "source-page-coverage"`) so it can never be read as canonical-rules coverage.
- **Every row this pipeline creates is explicitly `ruleset: "dnd35e"`, never inferred or caller-supplied** — `CreateSrdManifestEntryInput` has no `ruleset` field; the storage method hardcodes the literal.
- **Every fetched transport source is pinned to an immutable identifier.** The GitHub-hosted mirror is pinned to a full 40-character commit SHA, fetched via that SHA (never `@master`/`@main`). The live-website source has no git-equivalent pin; its "revision" is the documented scan timestamp of the verification performed while writing this plan, with content-hash change detection as the primary drift-safeguard — this asymmetry is stated explicitly, not smoothed over.
- **The frozen page list for the GitHub-hosted mirror is a generated artifact, not a hand-transcribed one.** Task 5 writes and runs a real script against the pinned commit's tree API and commits its literal output — because two independent manual transcription passes performed while researching this plan produced different file counts for the same directories (documented below), proving by direct demonstration that hand-transcription is unreliable enough to disqualify it as this plan's source of truth.
- **The full approved "ALL rules-bearing d20srd.org material" scope is covered by *multiple* source manifests, not scoped down to whichever mirror is most convenient.** `olimot/srd-v3.5` supplies core/epic/psionics/divine; it has no Unearthed Arcana Variant Rules content at all. `d20srd.org` supplies core/epic/psionics/divine *and* the six-category Variant Rules (Unearthed Arcana open content) section, verified live during planning (see below) — this is the only one of the two sources that closes the Variant Rules gap.
- **Verification write paths are storage-layer only, never client-reachable.** `recordRuleSourceVerification` and `recordSourcePageVerification` have no HTTP route anywhere in this plan. If a future admin surface needs one, it must be gated by this codebase's existing admin-authority pattern (`role === "dungeon_master"` / `isAdmin`, as already used elsewhere in `server/routes.ts`) — never a bare authenticated-user route. This plan adds zero routes.
- **`canonical_revisions` (Phase 0/1 Task 6) is not touched by this plan.** Page-level change history uses its own dedicated table, `srd_source_page_revisions`. `canonical_revisions`'s first real caller remains a genuine Phase 2B canonical-entity table.
- **Phase 2A is not complete until a real network run has produced real coverage evidence.** Task 8's execution is isolated from the TDD unit-test suite (Tasks 1-7 remain 100% network-free with an injectable fetcher) but is not optional or deferrable as a whole task — an empty, fully-tested manifest *framework* is not a corpus manifest.
- **Do not touch live character data.** Nothing in this plan reads or writes `characters`/`characterData`/player-owned `items`.
- **Every task includes:** files/components affected, expected behavior, tests required, migration risk, rollback consideration, and an independent-verification gate before the next task begins.
- New tables/columns use `CREATE TABLE IF NOT EXISTS` / `addColumnIfMissing` inside `runMigrations()`. Never `sqlite.prepare()` at module top level.
- **Network calls in tests use an injectable fetcher, never the real network.** Every function in `server/srd-manifest-discovery.ts` accepts a `fetchImpl` parameter defaulting to the real global `fetch`.

## Real Source Structure (verified 2026-08-22 — read before Task 5)

### Source 1: the original Wizards 3.5e SRD (authoritative, no live fetchable URL of its own)

Registered as a citation/identity `rule_sources` row. Wizards no longer hosts the 3.5e SRD at a single canonical live URL; both transports below are independently-maintained derivations of it. This is normal archival practice, not a gap — an authoritative-source row does not require a directly fetchable URL, only a real identity other rows can point at via `derivedFromSourceId`.

### Source 2: `github.com/olimot/srd-v3.5` — GitHub-hosted HTML mirror, pinned commit `faab739130921026db42b96e6adff6d3661bffbd`

Verified directly via the GitHub API at that exact commit (`GET /repos/olimot/srd-v3.5/git/trees/faab739...?recursive=1`): **106 total tree entries, not truncated, 99 `.html` files**, one HTML file at repo root (`index.html`, administrative — not rules-bearing), the rest under 7 directories: `basic-rules-and-legal/`, `divine/`, `epic/`, `magic-items/`, `monsters/`, `psionics/`, `spells/`.

**A discrepancy worth stating outright, because it is the direct justification for this plan's "generated snapshot, not hand-transcribed" constraint:** two independent manual research passes performed while writing this plan (one via the GitHub contents API per-directory, one via the recursive tree API) produced *different* per-directory counts for the same pinned commit — `basic-rules-and-legal` came back as 22 in one pass and 24 in the other; `monsters` as 18 vs. 19; `epic` as 11 vs. 10; `spells` as 12 vs. 11; `divine` and `magic-items` agreed (4 and 6). Both passes went through a summarizing fetch tool rather than parsing raw JSON directly — that's almost certainly the source of the drift, not the underlying data changing (the commit is immutable). **The resolution is not to pick whichever number looks more confident** — it's Task 5's real script, parsing the raw tree API response programmatically with no summarization step in between, committing whatever that exact response says as the frozen manifest. `legal-information.html` (administrative OGL boilerplate, not rules-bearing) is the one deliberate exclusion regardless of the exact final count.

**Coverage this source provides:** core rules, epic, psionics, divine. **Zero Unearthed Arcana Variant Rules content** — confirmed by directory listing; no such directory exists in this repository.

### Source 3: `d20srd.org` — the Hypertext d20 SRD (live website, documented errata/update integration, and the source that actually covers Variant Rules)

`WebFetch` returned HTTP 403 for every URL on this domain (root and deep-linked pages alike) — the site appears to block that tool's request signature. Verified instead via the Claude Browser tool (a real browser), which loaded the site successfully. Its own front page states it is "The Hypertext d20 SRD (v3.5 d20 System Reference Document)," run by BoLS Interactive LLC under the d20 System License, with a documented "Changes from the Official d20 SRD" page (`/changes.htm`) — i.e. it is explicitly, self-documented as a derivation with tracked deltas from the base SRD, matching exactly the "documented official errata/update integration" characterization this plan's provenance model requires.

Its real top-level navigation (read via `read_page` against the live, loaded site) has **40 real index pages** under `/indexes/*.htm`, organized into four sections that map directly onto this plan's corpus-area vocabulary (Core Rules, Epic Rules, Psionic Rules, Divine Rules) — **plus a fifth section absent from every olimot directory**:

```
Variant Rules
  "open content from Unearthed Arcana"
  Races                /indexes/variantRaces.htm
  Classes              /indexes/variantClasses.htm
  Building Characters  /indexes/variantBuildingCharacters.htm
  Adventuring          /indexes/variantAdventuring.htm
  Magic                /indexes/variantMagic.htm
  Campaigns            /indexes/variantCampaigns.htm
```

This is the real, live-verified answer to "official open Unearthed Arcana Variant Rules" — the one piece of the approved "ALL" scope the original olimot-only draft silently dropped. The full 40-URL index-page list (all real, all verified via `read_page` against the live site, reproduced in full in Task 5) is this plan's discovery granularity for `d20srd.org` — **each index page is one manifest entry**, not a further recursive crawl into every individual leaf spell/monster/feat page each index links to. That deeper crawl is real per-entity extraction work, out of scope for the same reason `spells-a-b.html`'s internal spell list isn't split in this phase — see "Resolved Design Decisions" below.

**`d20srd.org` has no git-equivalent immutable pin.** Its "revision" for this plan's purposes is the verification timestamp above (2026-08-22, via the method just described) plus per-page content-hash change detection on every future re-scan — the honest substitute for a commit SHA on a source with no version control, stated explicitly rather than implied to be equivalent to one.

## Resolved Design Decisions (stated explicitly per the plan's own instructions and the review's 10 correction points)

**1. Provenance vs. transport are three separate `rule_sources` rows, linked by a new `derivedFromSourceId` column** (a self-referential integer, sibling to the existing `supersedesSourceId` — errata/replacement and derivation are different relationships, so they get different columns, not one overloaded field). The original SRD is the authoritative identity; the olimot mirror and `d20srd.org` are both `derivedFromSourceId`-linked to it, each carrying its own `pinnedRevision` (the commit SHA for olimot, the scan-timestamp string for `d20srd.org`). Every `srd_manifest_entries` row's `sourceId` points at whichever *transport* it was actually fetched from — never at the original-SRD identity row, since that row is never fetched.

**2. "ALL" means both sources, not the more convenient one.** Corpus-area coverage after this plan: core (both sources), epic (both), psionics (both), divine (both), Unearthed Arcana Variant Rules (`d20srd.org` only — olimot has none). Any `d20srd.org` page beyond the pure base-SRD-with-errata (i.e. anything under `/indexes/variant*.htm`) is classified into its own real `open-variants` corpus area at discovery time (Task 5) — never silently folded into `"core"` just because it shares a `sourceId` with core-SRD pages from the same site.

**3. `sourcePageKey`, not a canonical ID.** `srd_manifest_entries.sourcePageKey = "${source.sourceKey}::${sourcePath}"` (e.g. `"dnd35e-srd-olimot-mirror::spells/spells-a-b.html"`) — a plain, stable, human-readable string, never run through `buildCanonicalId`/`parseCanonicalId`/`isValidCanonicalId`. If `d20srd.org` reorganizes `/indexes/spells.htm` to a different path next year, that changes *a manifest row's key*, not any future `dnd35e:spell:fireball` canonical entity — the two ID spaces are structurally disjoint, not just conventionally kept separate.

**4. `PageProcessingStatus`, not `IngestionStatus`.** A dedicated 5-value type: `"discovered" | "fetched" | "hashed" | "parsed" | "source_verified"`. This plan's automated pipeline (Task 6) only ever drives a row from `"discovered"` to `"hashed"` (fetch and hash happen as one atomic step in this implementation — there is no separately-observable "fetched but not yet hashed" moment worth persisting, though the vocabulary keeps `"fetched"` available for a future streaming/chunked-fetch implementation that would need to distinguish the two). `"parsed"` and `"source_verified"` are reachable only via Task 7's deliberate hand-advanced sample row, exactly mirroring how the prior draft's `"structured"`/`"verified"` were reachable only by hand — the renaming doesn't change *how much* real automated progress this phase makes, only removes the risk of that progress being misread as canonical-entity progress. `"source_verified"` means "we confirmed this fetched page genuinely reflects the pinned upstream at the time of the check" — a transport-fidelity claim, never a claim about the correctness of any individual rule described on the page.

**5. Coverage reports are scope-labeled, structurally.** `getSourcePageCoverageReport()`'s return type carries a literal `reportScope: "source-page-coverage"` field — not just a name choice, an actual value present in every report object, so a consumer reading the data (not just the function name) cannot mistake it for canonical-entity coverage. Field names avoid `verifiedCount` in favor of `sourceVerifiedCount` for the same reason. This report answers "how much of the *source material* have we discovered and processed"; a future, structurally separate `getCanonicalEntityCoverageReport()` (Phase 2B+, not built here) will answer "how many *game rules* are structured/verified" — the two are never the same function, the same field names, or the same table.

**6. `srd_source_page_revisions`, not `canonical_revisions`.** A new, dedicated, append-only table scoped to `sourcePageKey` (not `canonicalId`) — structurally identical in spirit to `canonical_revisions` (append-only, `changeReason`, `changedBy`) but a distinct table, because forcing page-level bookkeeping through `canonical_revisions` would require either fabricating a canonical ID for a page (reintroducing correction #3's exact problem) or redefining what `entityType` means for that table in a way Phase 0/1 never intended. `canonical_revisions` remains untouched, unwired, and correctly waiting for its first genuine canonical-entity caller in Phase 2B.

**7. Both fetched sources get real, generated (not hand-maintained) frozen manifests.** Olimot's via a committed script parsing the raw pinned-tree API response (Task 5). `d20srd.org`'s via the 40-URL list verified live during planning (reproduced in full in Task 5, with its verification method and timestamp stated) — the best available equivalent for a source with no tree API, with the asymmetry stated rather than hidden.

**8. Task 8 (the real network run) is mandatory for Phase 2A completion, isolated but not deferrable**, producing the literal evidence format the review specified: *discovered N source pages → accounted for N → fetch failures X → changed X (on a second scan) → duplicates X*.

## File Structure

```
shared/rules-registry/
  sources.ts                    Modified: adds derivedFromSourceId, pinnedRevision columns to
                                 ruleSources; CreateRuleSourceInput gains matching optional fields
                                 (Task 1).
  srd-manifest.ts                New: CorpusArea vocabulary, PageProcessingStatus vocabulary,
                                 srdManifestEntries table (sourcePageKey, not canonicalId),
                                 srdSourcePageRevisions table, isValidSourcePageVerification(),
                                 buildSourcePageKey() (Task 2).
  srd-manifest.test.ts            Unit tests for the pure helpers (Task 2).

server/storage.ts                Modified: runMigrations() gains the new columns + 2 new tables;
                                 IStorage/DatabaseStorage gain recordRuleSourceVerification (Task 1),
                                 full srd_manifest_entries + srd_source_page_revisions CRUD (Task 3),
                                 getSourcePageCoverageReport/findDuplicateSourcePages (Task 4),
                                 recordSourcePageVerification (Task 7).

server/srd-manifest-snapshot-olimot.generated.ts   New: the generated (not hand-written) frozen
                                                     page list for the pinned olimot commit, produced
                                                     by scripts/generate-olimot-srd-snapshot.ts (Task 5).
scripts/generate-olimot-srd-snapshot.ts             New: one-time/re-runnable generation script,
                                                     real network call against the pinned tree API,
                                                     writes the .generated.ts file above (Task 5).
server/srd-manifest-snapshot-d20srd.ts              New: the verified-during-planning frozen 40-URL
                                                      list for d20srd.org, hand-written with its
                                                      verification method/timestamp documented inline
                                                      since no tree API exists for this source (Task 5).

server/srd-manifest-discovery.ts                    New: discoverSourcePage()/runSrdManifestDiscovery()
                                                      for both sources, injectable fetcher, loud
                                                      failures, srd_source_page_revisions wiring (Task 6).

server/rules-registry.test.ts                       Modified: Task 1's recordRuleSourceVerification
                                                       tests appended to the existing Phase 0/1 file.
server/srd-manifest-storage.test.ts                 New: CRUD + coverage-report + duplicate-detection
                                                       tests (Tasks 3-4).
server/srd-manifest-discovery.test.ts               New: discovery pipeline tests against injected
                                                       fake fetchers for both sources (Task 6).
server/srd-manifest-lifecycle.test.ts               New: the sample discovered->fetched->hashed->
                                                       parsed->source_verified progression proof,
                                                       wired through srd_source_page_revisions (Task 7).

docs/superpowers/notes/2026-08-22-srd-provenance-registration.md   New: Task 1's real registered rows.
docs/superpowers/notes/2026-08-22-srd-manifest-acceptance-report.md   New: Task 8's real run evidence,
                                                                        the literal N/X/X/X format.
```

---

### Task 1: Provenance/transport separation in `rule_sources` + register all three real sources

**Files:**
- Modify: `shared/rules-registry/sources.ts` (add `derivedFromSourceId`, `pinnedRevision` columns)
- Modify: `server/storage.ts` (`addColumnIfMissing` calls; add `recordRuleSourceVerification`)
- Modify: `server/rules-registry.test.ts` (append tests)
- Create: `docs/superpowers/notes/2026-08-22-srd-provenance-registration.md`

**Interfaces:**
- Consumes: `RuleSource`, `CreateRuleSourceInput`, `storage.createRuleSource`, `storage.getRuleSource`, `storage.getRuleSourceById` (all Phase 0/1 Task 2, extended not replaced).
- Produces: `ruleSources.derivedFromSourceId: integer | null`, `ruleSources.pinnedRevision: text | null` columns; `CreateRuleSourceInput` gains `derivedFromSourceId?: number` and `pinnedRevision?: string`; `storage.recordRuleSourceVerification(sourceKey: string, metadata: VerificationMetadata): void` (imported from `@shared/rules-registry/provenance`, unchanged type).

**Expected behavior:** Three real rows exist after this task, in this exact relationship:
1. `sourceKey: "dnd35e-srd-original"` — `derivedFromSourceId: null`, `pinnedRevision: null` (no live URL, no version to pin).
2. `sourceKey: "dnd35e-srd-olimot-mirror"` — `derivedFromSourceId:` (1)'s id, `pinnedRevision: "faab739130921026db42b96e6adff6d3661bffbd"`.
3. `sourceKey: "dnd35e-srd-hypertext-d20"` — `derivedFromSourceId:` (1)'s id, `pinnedRevision: "live-scan-2026-08-22"`.

`recordRuleSourceVerification` writes `verificationMethod`/`verifiedBy`/`verifiedAt` onto a `rule_sources` row (closing the Phase 0/1 gap where `updateRuleSource`'s `Partial<CreateRuleSourceInput>` typing could never reach those columns) — a storage-layer method with no HTTP route in this plan.

**Migration risk:** Low — two new nullable columns via `addColumnIfMissing`, no existing row's meaning changed, no existing column altered.

**Rollback consideration:** Dropping the two new columns (if ever needed) only affects the 3 rows this task creates plus any later manifest rows referencing them via `sourceId` — nothing in Phase 0/1 reads `derivedFromSourceId`/`pinnedRevision`, so no other feature is affected.

- [ ] **Step 1: Write the failing tests in `server/rules-registry.test.ts`**

Append after the existing Task-2 tests:

```ts
test("createRuleSource accepts derivedFromSourceId and pinnedRevision, both nullable by default", () => {
  const original = storage.createRuleSource({
    sourceKey: "dnd35e-srd-original-test",
    title: "Original SRD Test",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "srd_open",
  });
  assert.equal(original.derivedFromSourceId, null);
  assert.equal(original.pinnedRevision, null);

  const mirror = storage.createRuleSource({
    sourceKey: "dnd35e-srd-mirror-test",
    title: "Mirror Test",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "web-enhancement",
    provenanceClassification: "open_game_content",
    licenseClassification: "srd_open",
    derivedFromSourceId: original.id,
    pinnedRevision: "abc123",
  });
  assert.equal(mirror.derivedFromSourceId, original.id);
  assert.equal(mirror.pinnedRevision, "abc123");
});

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
    notes: "confirmed registration matches the intended provenance model",
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
Expected: FAIL — `derivedFromSourceId`/`pinnedRevision` don't exist on the returned row; `storage.recordRuleSourceVerification` is not a function.

- [ ] **Step 3: Extend `shared/rules-registry/sources.ts`**

```ts
// Added: derivedFromSourceId distinguishes "this source is a transport/mirror
// of that source" from supersedesSourceId (which means "this errata/update
// replaces that source") — deliberately separate relationships, separate
// columns. pinnedRevision records the immutable snapshot identifier a
// fetched transport was ingested at (a commit SHA for a git-hosted mirror;
// a documented scan-timestamp string for a live website with no version
// control). Both nullable — the authoritative-original row has neither.
derivedFromSourceId: integer("derived_from_source_id"),
pinnedRevision: text("pinned_revision"),
```

Add these two lines to the `ruleSources` table definition (alongside the existing `supersedesSourceId`), and extend `CreateRuleSourceInput`:

```ts
derivedFromSourceId?: number;
pinnedRevision?: string;
```

- [ ] **Step 4: Add the migration + `recordRuleSourceVerification` to `server/storage.ts`**

Migration, placed with the existing `rule_sources`-adjacent `addColumnIfMissing` calls (there are none yet for this table since it was created whole in Phase 0/1 — add these as the first `addColumnIfMissing` entries for `rule_sources`):

```ts
addColumnIfMissing("rule_sources", "derived_from_source_id", "INTEGER");
addColumnIfMissing("rule_sources", "pinned_revision", "TEXT");
```

`IStorage`:

```ts
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

Also update `createRuleSource`'s implementation to pass through the two new optional input fields (`derivedFromSourceId: entry.derivedFromSourceId ?? null`, `pinnedRevision: entry.pinnedRevision ?? null`) — read the method's current body first and extend it, don't rewrite it.

Add `import type { VerificationMetadata } from "@shared/rules-registry/provenance";` if not already present.

- [ ] **Step 5: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/rules-registry.test.ts` — expect 8/8 (5 existing + 3 new).
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions against the 312-test baseline.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 6: Register the three real rows against the real dev database**

```ts
import { storage } from "./server/storage";

const original = storage.createRuleSource({
  sourceKey: "dnd35e-srd-original",
  title: "D&D 3.5 System Reference Document (original)",
  publisher: "Wizards of the Coast",
  ruleset: "dnd35e",
  nativeEdition: "dnd35e",
  setting: "generic",
  publicationType: "core-rulebook",
  provenanceClassification: "wotc_official",
  licenseClassification: "srd_open",
});

const olimotMirror = storage.createRuleSource({
  sourceKey: "dnd35e-srd-olimot-mirror",
  title: "olimot/srd-v3.5 HTML mirror (GitHub, pinned commit faab739130921026db42b96e6adff6d3661bffbd)",
  publisher: "olimot (compiler); underlying content Wizards of the Coast (OGL)",
  ruleset: "dnd35e",
  nativeEdition: "dnd35e",
  setting: "generic",
  publicationType: "web-enhancement",
  provenanceClassification: "open_game_content",
  licenseClassification: "srd_open",
  derivedFromSourceId: original.id,
  pinnedRevision: "faab739130921026db42b96e6adff6d3661bffbd",
});

const hypertextD20 = storage.createRuleSource({
  sourceKey: "dnd35e-srd-hypertext-d20",
  title: "The Hypertext d20 SRD (d20srd.org) — includes documented errata integration and Unearthed Arcana Variant Rules open content",
  publisher: "BoLS Interactive LLC (compiler); underlying content Wizards of the Coast (d20 System License / OGL)",
  ruleset: "dnd35e",
  nativeEdition: "dnd35e",
  setting: "generic",
  publicationType: "web-enhancement",
  provenanceClassification: "open_game_content",
  licenseClassification: "srd_open",
  derivedFromSourceId: original.id,
  pinnedRevision: "live-scan-2026-08-22",
});

console.log({ original, olimotMirror, hypertextD20 });
```

Write the exact output (all three real rows, including assigned `id`s) into `docs/superpowers/notes/2026-08-22-srd-provenance-registration.md`, plus one paragraph explaining `dnd35e-srd-hypertext-d20`'s `pinnedRevision` is a scan-timestamp string, not a commit SHA, because the source is a live website with no version control — stated as a limitation, not glossed over.

- [ ] **Step 7: Commit**

```bash
git add shared/rules-registry/sources.ts server/storage.ts server/rules-registry.test.ts docs/superpowers/notes/2026-08-22-srd-provenance-registration.md
git commit -m "feat: separate SRD provenance from transport, register original/olimot-mirror/hypertext-d20 sources"
```

**Independent verification before Task 2 begins:** re-run tests fresh; confirm via the real Step 6 output that both derived rows' `derivedFromSourceId` genuinely equals the original row's real `id` (not a hardcoded guess); confirm `dnd35e-srd-original` has no `pinnedRevision` (a non-null value there would be a real modeling error — it has nothing to pin).

---

### Task 2: `shared/rules-registry/srd-manifest.ts` — page-scoped schema and vocabulary

**Files:**
- Create: `shared/rules-registry/srd-manifest.ts`
- Create: `shared/rules-registry/srd-manifest.test.ts`

**Interfaces:**
- Consumes: nothing from `provenance.ts`/`canonical-id.ts` at the type level (deliberately — see correction #3/#4). `VerificationMetadata` is consumed by storage methods in Task 7, not by this file.
- Produces: `CorpusArea` (15-value union, unchanged from the prior draft — `"core" | "monsters" | "spells" | "feats" | "items-equipment" | "classes" | "prestige-classes" | "races" | "skills" | "conditions" | "combat-rules" | "epic" | "psionics" | "divine" | "open-variants"`), `PageProcessingStatus` (`"discovered" | "fetched" | "hashed" | "parsed" | "source_verified"`), `srdManifestEntries` table, `SrdManifestEntry` type, `CreateSrdManifestEntryInput` (no `ruleset` field), `srdSourcePageRevisions` table, `SrdSourcePageRevision` type, `RecordSourcePageRevisionInput`, `buildSourcePageKey(sourceKey: string, sourcePath: string): string`, `isValidSourcePageVerification(status: PageProcessingStatus, hasVerification: boolean): boolean`.

**Expected behavior:** `buildSourcePageKey("dnd35e-srd-olimot-mirror", "spells/spells-a-b.html")` returns `"dnd35e-srd-olimot-mirror::spells/spells-a-b.html"` — a plain string, never validated against or built from `canonical-id.ts`'s grammar. `isValidSourcePageVerification` mirrors the shape of Phase 0/1's `isValidStatusPair` but for this table's real two axes: verification metadata is only valid once `status === "source_verified"`.

**Migration risk:** None — pure TypeScript in this task; the `CREATE TABLE` for both tables happens in Task 3.

**Rollback consideration:** None; nothing outside this file imports these exports until Task 3.

- [ ] **Step 1: Write `shared/rules-registry/srd-manifest.ts`**

```ts
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
```

- [ ] **Step 2: Write `shared/rules-registry/srd-manifest.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSourcePageKey, isValidSourcePageVerification } from "./srd-manifest";
import { isValidCanonicalId } from "./canonical-id";

test("buildSourcePageKey combines sourceKey and sourcePath with a plain, non-canonical separator", () => {
  assert.equal(
    buildSourcePageKey("dnd35e-srd-olimot-mirror", "spells/spells-a-b.html"),
    "dnd35e-srd-olimot-mirror::spells/spells-a-b.html",
  );
});

test("buildSourcePageKey output is deliberately NOT a valid canonical ID", () => {
  const key = buildSourcePageKey("dnd35e-srd-hypertext-d20", "/indexes/variantClasses.htm");
  assert.equal(
    isValidCanonicalId(key),
    false,
    "a source page key must never accidentally satisfy the canonical-entity-ID grammar — pages and entities are structurally disjoint ID spaces",
  );
});

test("isValidSourcePageVerification: verification metadata is valid only once processingStatus is source_verified", () => {
  for (const status of ["discovered", "fetched", "hashed", "parsed"] as const) {
    assert.equal(isValidSourcePageVerification(status, true), false);
  }
  assert.equal(isValidSourcePageVerification("source_verified", true), true);
});

test("isValidSourcePageVerification: no verification metadata is valid at any processingStatus", () => {
  for (const status of ["discovered", "fetched", "hashed", "parsed", "source_verified"] as const) {
    assert.equal(isValidSourcePageVerification(status, false), true);
  }
});
```

- [ ] **Step 3: Run the tests**

Run: `node --import tsx --test shared/rules-registry/srd-manifest.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 4: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add shared/rules-registry/srd-manifest.ts shared/rules-registry/srd-manifest.test.ts
git commit -m "feat: add page-scoped SRD manifest schema (sourcePageKey, PageProcessingStatus — not canonical entity types)"
```

**Independent verification before Task 3 begins:** re-run tests fresh; grep this file and confirm it imports nothing from `canonical-id.ts` or `provenance.ts` — a structural check that the deliberate separation from those Phase 0/1 modules actually holds, not just that the test asserting it passes.

---

### Task 3: `server/storage.ts` — migration + CRUD for both new tables

**Files:**
- Modify: `server/storage.ts`
- Create: `server/srd-manifest-storage.test.ts`

**Interfaces:**
- Consumes: `srdManifestEntries`, `srdSourcePageRevisions`, `SrdManifestEntry`, `SrdSourcePageRevision`, `CreateSrdManifestEntryInput`, `RecordSourcePageRevisionInput`, `CorpusArea`, `PageProcessingStatus`, `buildSourcePageKey` (Task 2).
- Produces: `storage.createSrdManifestEntry(input): SrdManifestEntry`, `storage.upsertSrdManifestEntry(input & {contentHash: string}): SrdManifestEntry` (idempotent — same hash on re-scan is a no-op; different hash resets `processingStatus` to `"discovered"` and records a `srd_source_page_revisions` row), `storage.updateSrdManifestEntryProcessingStatus(sourcePageKey, status): void`, `storage.recordSrdManifestDiscoveryFailure(input, errorMessage): SrdManifestEntry`, `storage.getSrdManifestEntry(sourcePageKey): SrdManifestEntry | undefined`, `storage.listSrdManifestEntries(filter?: {corpusArea?, sourceId?}): SrdManifestEntry[]`, `storage.recordSourcePageRevision(input: RecordSourcePageRevisionInput): SrdSourcePageRevision`, `storage.getSourcePageRevisionHistory(sourcePageKey): SrdSourcePageRevision[]`.

**Expected behavior:** `createSrdManifestEntry` always writes `ruleset: "dnd35e"` literally. `upsertSrdManifestEntry` matches by `sourcePageKey` (built from `input.sourceId`'s owning source's `sourceKey` + `input.sourcePath` — the method looks up the source row to get its `sourceKey`, since callers only supply `sourceId`): no existing row → insert at `"discovered"`; identical `contentHash` → no-op (no false "changed" signal); different `contentHash` → update the hash, reset to `"discovered"`, and call `recordSourcePageRevision` (never `canonical_revisions`).

**Migration risk:** Low — two new `CREATE TABLE IF NOT EXISTS` additions, no existing table touched.

**Rollback consideration:** Dropping either table has zero impact on any other table in this plan or Phase 0/1 — no foreign keys declared (matching this codebase's existing app-level-referential-integrity convention).

- [ ] **Step 1: Add the migration block**

Placed after the existing Phase 0/1 `canonical_revisions` index:

```ts
sqlite.exec(`CREATE TABLE IF NOT EXISTS srd_manifest_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_page_key TEXT NOT NULL UNIQUE,
  ruleset TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  corpus_area TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  source_path TEXT NOT NULL,
  content_hash TEXT,
  processing_status TEXT NOT NULL DEFAULT 'discovered',
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
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_srd_manifest_entries_source_id
  ON srd_manifest_entries(source_id);`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS srd_source_page_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_page_key TEXT NOT NULL,
  revision INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL DEFAULT '',
  change_reason TEXT NOT NULL,
  old_content_hash TEXT,
  new_content_hash TEXT
);`);

sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_srd_source_page_revisions_key
  ON srd_source_page_revisions(source_page_key);`);
```

- [ ] **Step 2: Write the failing test file `server/srd-manifest-storage.test.ts`**

```ts
import { test, after } from "node:test";
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
let sourceKey: string;
test("setup: register a source for manifest rows to reference", () => {
  sourceKey = "dnd35e-srd-storage-test";
  const source = storage.createRuleSource({
    sourceKey,
    title: "Storage Test Source",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "web-enhancement",
    provenanceClassification: "open_game_content",
    licenseClassification: "srd_open",
  });
  sourceId = source.id;
});

test("createSrdManifestEntry always writes ruleset dnd35e and a plain sourcePageKey", () => {
  const entry = storage.createSrdManifestEntry({
    sourceId,
    corpusArea: "spells",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739130921026db42b96e6adff6d3661bffbd/spells/spells-a-b.html",
    sourcePath: "spells/spells-a-b.html",
  });
  assert.equal(entry.ruleset, "dnd35e");
  assert.equal(entry.sourcePageKey, `${sourceKey}::spells/spells-a-b.html`);
  assert.equal(entry.processingStatus, "discovered");
});

test("upsertSrdManifestEntry is a no-op when the content hash hasn't changed", () => {
  const first = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-b-c.html",
    sourcePath: "monsters/monsters-b-c.html",
    contentHash: "abc123",
  });
  storage.updateSrdManifestEntryProcessingStatus(first.sourcePageKey, "hashed");

  const second = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-b-c.html",
    sourcePath: "monsters/monsters-b-c.html",
    contentHash: "abc123",
  });
  assert.equal(second.processingStatus, "hashed", "unchanged hash must not reset processing progress");
});

test("upsertSrdManifestEntry resets processingStatus to discovered and records a revision when the content hash changes", () => {
  const first = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-d-de.html",
    sourcePath: "monsters/monsters-d-de.html",
    contentHash: "hash-v1",
  });
  storage.updateSrdManifestEntryProcessingStatus(first.sourcePageKey, "parsed");

  const second = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-d-de.html",
    sourcePath: "monsters/monsters-d-de.html",
    contentHash: "hash-v2",
  });
  assert.equal(second.contentHash, "hash-v2");
  assert.equal(second.processingStatus, "discovered", "a changed hash must flag the row for re-processing");

  const history = storage.getSourcePageRevisionHistory(first.sourcePageKey);
  assert.equal(history.length, 1);
  assert.equal(history[0].oldContentHash, "hash-v1");
  assert.equal(history[0].newContentHash, "hash-v2");
});

test("recordSrdManifestDiscoveryFailure creates a row even though no content was ever fetched", () => {
  const entry = storage.recordSrdManifestDiscoveryFailure(
    {
      sourceId,
      corpusArea: "epic",
      sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../epic/does-not-exist.html",
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
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../epic/flaky.html",
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
});

test("recordSourcePageRevision + getSourcePageRevisionHistory round-trip, newest first", () => {
  storage.recordSourcePageRevision({
    sourcePageKey: "manual-test::page.html", revision: 1, changeReason: "initial discovery",
  });
  storage.recordSourcePageRevision({
    sourcePageKey: "manual-test::page.html", revision: 2, changeReason: "content changed on re-scan",
    oldContentHash: "h1", newContentHash: "h2",
  });
  const history = storage.getSourcePageRevisionHistory("manual-test::page.html");
  assert.equal(history.length, 2);
  assert.equal(history[0].revision, 2);
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --import tsx --test server/srd-manifest-storage.test.ts`
Expected: FAIL — `storage.createSrdManifestEntry is not a function`.

- [ ] **Step 4: Add CRUD methods to `IStorage`/`DatabaseStorage`**

`IStorage`:

```ts
// SRD source-page manifest (Phase 2A). Page-scoped, never entity-scoped —
// see shared/rules-registry/srd-manifest.ts's header comment. ruleset is
// never a parameter: createSrdManifestEntry always writes "dnd35e" internally.
createSrdManifestEntry(input: CreateSrdManifestEntryInput): SrdManifestEntry;
upsertSrdManifestEntry(input: CreateSrdManifestEntryInput & { contentHash: string }): SrdManifestEntry;
updateSrdManifestEntryProcessingStatus(sourcePageKey: string, status: PageProcessingStatus): void;
recordSrdManifestDiscoveryFailure(input: CreateSrdManifestEntryInput, errorMessage: string): SrdManifestEntry;
getSrdManifestEntry(sourcePageKey: string): SrdManifestEntry | undefined;
listSrdManifestEntries(filter?: { corpusArea?: CorpusArea; sourceId?: number }): SrdManifestEntry[];
recordSourcePageRevision(input: RecordSourcePageRevisionInput): SrdSourcePageRevision;
getSourcePageRevisionHistory(sourcePageKey: string): SrdSourcePageRevision[];
```

`DatabaseStorage`:

```ts
createSrdManifestEntry(input: CreateSrdManifestEntryInput): SrdManifestEntry {
  const source = this.getRuleSourceById(input.sourceId);
  if (!source) throw new Error(`Rule source ${input.sourceId} not found`);
  const sourcePageKey = buildSourcePageKey(source.sourceKey, input.sourcePath);
  const now = new Date().toISOString();
  return db.insert(srdManifestEntries).values({
    sourcePageKey,
    ruleset: "dnd35e",
    sourceId: input.sourceId,
    corpusArea: input.corpusArea,
    sourceUrl: input.sourceUrl,
    sourcePath: input.sourcePath,
    processingStatus: "discovered",
    attemptCount: 0,
    discoveredAt: now,
    updatedAt: now,
  }).returning().get();
},

upsertSrdManifestEntry(input: CreateSrdManifestEntryInput & { contentHash: string }): SrdManifestEntry {
  const source = this.getRuleSourceById(input.sourceId);
  if (!source) throw new Error(`Rule source ${input.sourceId} not found`);
  const sourcePageKey = buildSourcePageKey(source.sourceKey, input.sourcePath);
  const existing = db.select().from(srdManifestEntries)
    .where(eq(srdManifestEntries.sourcePageKey, sourcePageKey)).get();

  if (!existing) {
    const now = new Date().toISOString();
    return db.insert(srdManifestEntries).values({
      sourcePageKey,
      ruleset: "dnd35e",
      sourceId: input.sourceId,
      corpusArea: input.corpusArea,
      sourceUrl: input.sourceUrl,
      sourcePath: input.sourcePath,
      contentHash: input.contentHash,
      processingStatus: "discovered",
      attemptCount: 0,
      discoveredAt: now,
      updatedAt: now,
    }).returning().get();
  }

  if (existing.contentHash === input.contentHash) {
    return existing;
  }

  db.update(srdManifestEntries)
    .set({ contentHash: input.contentHash, processingStatus: "discovered", updatedAt: new Date().toISOString() })
    .where(eq(srdManifestEntries.sourcePageKey, sourcePageKey))
    .run();

  this.recordSourcePageRevision({
    sourcePageKey,
    revision: existing.attemptCount + 1,
    changeReason: "content hash changed on re-scan, processingStatus reset to discovered",
    changedBy: "srd-manifest-discovery",
    oldContentHash: existing.contentHash ?? undefined,
    newContentHash: input.contentHash,
  });

  return db.select().from(srdManifestEntries).where(eq(srdManifestEntries.sourcePageKey, sourcePageKey)).get()!;
},

updateSrdManifestEntryProcessingStatus(sourcePageKey: string, status: PageProcessingStatus): void {
  db.update(srdManifestEntries)
    .set({ processingStatus: status, updatedAt: new Date().toISOString() })
    .where(eq(srdManifestEntries.sourcePageKey, sourcePageKey))
    .run();
},

recordSrdManifestDiscoveryFailure(input: CreateSrdManifestEntryInput, errorMessage: string): SrdManifestEntry {
  const source = this.getRuleSourceById(input.sourceId);
  if (!source) throw new Error(`Rule source ${input.sourceId} not found`);
  const sourcePageKey = buildSourcePageKey(source.sourceKey, input.sourcePath);
  const now = new Date().toISOString();
  const existing = db.select().from(srdManifestEntries)
    .where(eq(srdManifestEntries.sourcePageKey, sourcePageKey)).get();

  if (!existing) {
    return db.insert(srdManifestEntries).values({
      sourcePageKey,
      ruleset: "dnd35e",
      sourceId: input.sourceId,
      corpusArea: input.corpusArea,
      sourceUrl: input.sourceUrl,
      sourcePath: input.sourcePath,
      processingStatus: "discovered",
      lastError: errorMessage,
      lastAttemptAt: now,
      attemptCount: 1,
      discoveredAt: now,
      updatedAt: now,
    }).returning().get();
  }

  db.update(srdManifestEntries)
    .set({ lastError: errorMessage, lastAttemptAt: now, attemptCount: existing.attemptCount + 1, updatedAt: now })
    .where(eq(srdManifestEntries.sourcePageKey, sourcePageKey))
    .run();
  return db.select().from(srdManifestEntries).where(eq(srdManifestEntries.sourcePageKey, sourcePageKey)).get()!;
},

getSrdManifestEntry(sourcePageKey: string): SrdManifestEntry | undefined {
  return db.select().from(srdManifestEntries).where(eq(srdManifestEntries.sourcePageKey, sourcePageKey)).get();
},

listSrdManifestEntries(filter?: { corpusArea?: CorpusArea; sourceId?: number }): SrdManifestEntry[] {
  const conditions = [];
  if (filter?.corpusArea) conditions.push(eq(srdManifestEntries.corpusArea, filter.corpusArea));
  if (filter?.sourceId) conditions.push(eq(srdManifestEntries.sourceId, filter.sourceId));
  if (conditions.length === 0) return db.select().from(srdManifestEntries).all();
  return db.select().from(srdManifestEntries).where(and(...conditions)).all();
},

recordSourcePageRevision(input: RecordSourcePageRevisionInput): SrdSourcePageRevision {
  return db.insert(srdSourcePageRevisions).values({
    sourcePageKey: input.sourcePageKey,
    revision: input.revision,
    changedBy: input.changedBy ?? "",
    changeReason: input.changeReason,
    oldContentHash: input.oldContentHash ?? null,
    newContentHash: input.newContentHash ?? null,
  }).returning().get();
},

getSourcePageRevisionHistory(sourcePageKey: string): SrdSourcePageRevision[] {
  return db.select().from(srdSourcePageRevisions)
    .where(eq(srdSourcePageRevisions.sourcePageKey, sourcePageKey))
    .orderBy(desc(srdSourcePageRevisions.revision))
    .all();
},
```

Add imports for `srdManifestEntries`, `srdSourcePageRevisions`, types, `buildSourcePageKey` from `@shared/rules-registry/srd-manifest`.

- [ ] **Step 5: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/srd-manifest-storage.test.ts` — expect 8/8.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 6: Commit**

```bash
git add server/storage.ts server/srd-manifest-storage.test.ts
git commit -m "feat: add srd_manifest_entries + srd_source_page_revisions CRUD (page-scoped, not canonical-entity-scoped)"
```

**Independent verification before Task 4 begins:** re-run tests fresh; confirm `upsertSrdManifestEntry`'s hash-change branch genuinely calls `this.recordSourcePageRevision` (not `this.recordRevision`, Phase 0/1's canonical-entity method) by reading the code, not just trusting a passing test; confirm `createSrdManifestEntry`'s `ruleset: "dnd35e"` literal is truly unconditional by reading the full method body.

---

### Task 4: Source-page coverage report (scope-labeled) and duplicate detection

**Files:**
- Modify: `server/storage.ts`
- Modify: `server/srd-manifest-storage.test.ts`

**Interfaces:**
- Produces: `storage.getSourcePageCoverageReport(): SourcePageCoverageReport` where
  ```ts
  interface SourcePageCoverageReport {
    reportScope: "source-page-coverage"; // literal — never confusable with canonical-entity coverage
    totalDiscovered: number;
    byProcessingStatus: Record<PageProcessingStatus, number>;
    byCorpusArea: Record<string, number>;
    bySource: Record<string, number>; // sourceKey -> count
    sourceVerifiedCount: number;      // NOT "verifiedCount" — deliberately named to avoid implying canonical verification
    failedCount: number;
  }
  ```
  and `storage.findDuplicateSourcePages(): Array<{ contentHash: string; entries: SrdManifestEntry[] }>`.

**Expected behavior:** This is the literal deliverable the review specified: *"discovered N source pages → accounted for N → fetch failures X → changed X → duplicates X"* becomes real, tested arithmetic. `reportScope` is present in the actual returned object, not just documented in a comment — a consumer inspecting the data at runtime (a log line, a JSON dump) sees the scope without reading any source code.

**Migration risk:** None — read-only queries.

**Rollback consideration:** None.

- [ ] **Step 1: Write the failing tests, appended to `server/srd-manifest-storage.test.ts`**

```ts
test("getSourcePageCoverageReport carries an explicit, literal scope label", () => {
  const report = storage.getSourcePageCoverageReport();
  assert.equal(report.reportScope, "source-page-coverage");
});

test("getSourcePageCoverageReport computes correct arithmetic against constructed fixture data", () => {
  const report = storage.getSourcePageCoverageReport();
  const all = storage.listSrdManifestEntries();
  const expectedByStatus: Record<string, number> = { discovered: 0, fetched: 0, hashed: 0, parsed: 0, source_verified: 0 };
  let expectedFailed = 0;
  for (const entry of all) {
    expectedByStatus[entry.processingStatus] = (expectedByStatus[entry.processingStatus] ?? 0) + 1;
    if (entry.lastError) expectedFailed++;
  }
  assert.equal(report.totalDiscovered, all.length);
  assert.equal(report.sourceVerifiedCount, expectedByStatus.source_verified);
  assert.equal(report.failedCount, expectedFailed);
  for (const status of ["discovered", "fetched", "hashed", "parsed", "source_verified"] as const) {
    assert.equal(report.byProcessingStatus[status], expectedByStatus[status]);
  }
});

test("getSourcePageCoverageReport's byCorpusArea and bySource both sum to totalDiscovered", () => {
  const report = storage.getSourcePageCoverageReport();
  assert.equal(Object.values(report.byCorpusArea).reduce((a, b) => a + b, 0), report.totalDiscovered);
  assert.equal(Object.values(report.bySource).reduce((a, b) => a + b, 0), report.totalDiscovered);
});

test("findDuplicateSourcePages surfaces two rows sharing a content hash", () => {
  storage.upsertSrdManifestEntry({
    sourceId, corpusArea: "core",
    sourceUrl: "https://example.test/dup-a.html", sourcePath: "basic-rules-and-legal/dup-a.html",
    contentHash: "duplicate-hash-xyz",
  });
  storage.upsertSrdManifestEntry({
    sourceId, corpusArea: "core",
    sourceUrl: "https://example.test/dup-b.html", sourcePath: "basic-rules-and-legal/dup-b.html",
    contentHash: "duplicate-hash-xyz",
  });
  const duplicates = storage.findDuplicateSourcePages();
  const match = duplicates.find((d) => d.contentHash === "duplicate-hash-xyz");
  assert.ok(match);
  assert.equal(match!.entries.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test server/srd-manifest-storage.test.ts`
Expected: FAIL — `storage.getSourcePageCoverageReport is not a function`.

- [ ] **Step 3: Add the two methods**

`IStorage`:

```ts
getSourcePageCoverageReport(): {
  reportScope: "source-page-coverage";
  totalDiscovered: number;
  byProcessingStatus: Record<PageProcessingStatus, number>;
  byCorpusArea: Record<string, number>;
  bySource: Record<string, number>;
  sourceVerifiedCount: number;
  failedCount: number;
};
findDuplicateSourcePages(): Array<{ contentHash: string; entries: SrdManifestEntry[] }>;
```

`DatabaseStorage`:

```ts
getSourcePageCoverageReport() {
  const all = db.select().from(srdManifestEntries).all();
  const byProcessingStatus: Record<PageProcessingStatus, number> = {
    discovered: 0, fetched: 0, hashed: 0, parsed: 0, source_verified: 0,
  };
  const byCorpusArea: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let failedCount = 0;

  for (const entry of all) {
    const status = entry.processingStatus as PageProcessingStatus;
    byProcessingStatus[status] = (byProcessingStatus[status] ?? 0) + 1;
    byCorpusArea[entry.corpusArea] = (byCorpusArea[entry.corpusArea] ?? 0) + 1;
    const source = this.getRuleSourceById(entry.sourceId);
    const key = source?.sourceKey ?? `unknown-source-${entry.sourceId}`;
    bySource[key] = (bySource[key] ?? 0) + 1;
    if (entry.lastError) failedCount++;
  }

  return {
    reportScope: "source-page-coverage" as const,
    totalDiscovered: all.length,
    byProcessingStatus,
    byCorpusArea,
    bySource,
    sourceVerifiedCount: byProcessingStatus.source_verified,
    failedCount,
  };
},

findDuplicateSourcePages(): Array<{ contentHash: string; entries: SrdManifestEntry[] }> {
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

- [ ] **Step 4: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/srd-manifest-storage.test.ts` — expect 12/12.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add server/storage.ts server/srd-manifest-storage.test.ts
git commit -m "feat: add scope-labeled source-page coverage report and duplicate detection"
```

**Independent verification before Task 5 begins:** re-run tests fresh; deliberately rename `reportScope`'s literal value locally to something else and confirm the "carries an explicit, literal scope label" test fails — proving the test is load-bearing, not decorative; revert. Deliberately break `sourceVerifiedCount`'s arithmetic (hardcode `0`) and confirm the arithmetic test fails; revert.

---

### Task 5: Generated frozen manifests for both pinned sources

**Files:**
- Create: `scripts/generate-olimot-srd-snapshot.ts`
- Create: `server/srd-manifest-snapshot-olimot.generated.ts` (output of the script above, committed)
- Create: `server/srd-manifest-snapshot-d20srd.ts` (hand-written, since no tree API exists — see below)
- Create: `server/srd-manifest-snapshot.test.ts`

**Interfaces:**
- Produces: `SRD_MANIFEST_SOURCE_OLIMOT: Array<{ corpusArea: CorpusArea; sourcePath: string }>` (generated), `SRD_MANIFEST_SOURCE_D20SRD: Array<{ corpusArea: CorpusArea; sourcePath: string }>` (hand-written from live verification), both consumed by Task 6.

**Expected behavior:** `scripts/generate-olimot-srd-snapshot.ts` is a real, re-runnable script — not a one-off shell command — that fetches `https://api.github.com/repos/olimot/srd-v3.5/git/trees/faab739130921026db42b96e6adff6d3661bffbd?recursive=1` directly, parses the raw JSON response programmatically (no summarizing intermediary), filters to `.html` paths under the 7 known directories, excludes `legal-information.html` and the root `index.html` explicitly by name (not by directory alone, since a filter that's only "under these 7 directories" wouldn't need to explain the root exclusion — name both real exclusions), infers each entry's `CorpusArea` via a lookup table keyed by filename (the mapping below, derived from real content inspection during planning — a page's *directory* alone is insufficient, since `basic-rules-and-legal/` mixes core/feats/classes/races/skills/etc.), and writes the resulting array as literal TypeScript into `server/srd-manifest-snapshot-olimot.generated.ts`. Running the script twice against the same pinned SHA must produce byte-identical output (the commit is immutable) — this is the test of the script's own determinism, not of the upstream data.

`server/srd-manifest-snapshot-d20srd.ts` is hand-written because `d20srd.org` has no tree API to generate from — it is the 40 real index-page URLs verified via the Claude Browser tool while writing this plan (reproduced below), with the verification method and date stated in the file's header comment as the honest substitute for a generated artifact's provenance.

**Migration risk:** None — no schema, no DB.

**Rollback consideration:** Both files are pure data; regenerating or hand-correcting either has no effect on Tasks 1-4's already-migrated schema.

- [ ] **Step 1: Write `scripts/generate-olimot-srd-snapshot.ts`**

```ts
// scripts/generate-olimot-srd-snapshot.ts
//
// Generates server/srd-manifest-snapshot-olimot.generated.ts from the real,
// pinned GitHub tree API response — never hand-transcribed. Two independent
// manual transcription passes performed while planning Phase 2A produced
// different file counts for the same pinned commit (documented in the plan's
// "Real Source Structure" section); this script exists specifically to
// remove that failure mode by parsing the raw API response programmatically.
//
// Re-run with: node --import tsx scripts/generate-olimot-srd-snapshot.ts

const PINNED_SHA = "faab739130921026db42b96e6adff6d3661bffbd";
const TREE_URL = `https://api.github.com/repos/olimot/srd-v3.5/git/trees/${PINNED_SHA}?recursive=1`;

// Directory -> default CorpusArea. Overridden per-filename below for
// basic-rules-and-legal/, which mixes multiple real corpus areas in one
// directory (confirmed by direct content inspection during planning).
const DIRECTORY_DEFAULT_AREA: Record<string, string> = {
  "spells": "spells",
  "monsters": "monsters",
  "magic-items": "items-equipment",
  "divine": "divine",
  "epic": "epic",
  "psionics": "psionics",
};

const FILENAME_AREA_OVERRIDES: Record<string, string> = {
  "character-classes-i.html": "classes",
  "character-classes-ii.html": "classes",
  "npc-classes.html": "classes",
  "combat-i-basics.html": "combat-rules",
  "combat-ii-movement-modifiers-and-special-actions.html": "combat-rules",
  "equipment.html": "items-equipment",
  "special-materials.html": "items-equipment",
  "treasure.html": "items-equipment",
  "feats.html": "feats",
  "prestige-classes.html": "prestige-classes",
  "races.html": "races",
  "skills-i.html": "skills",
  "skills-ii.html": "skills",
  "special-abilities-and-conditions.html": "conditions",
  "types-subtypes-and-special-abilities.html": "monsters",
};

const EXCLUDED_FILENAMES = new Set(["legal-information.html", "index.html"]);

interface TreeEntry { path: string; type: string; }
interface TreeResponse { tree: TreeEntry[]; truncated: boolean; }

async function main() {
  const res = await fetch(TREE_URL);
  if (!res.ok) throw new Error(`GitHub tree API returned ${res.status}`);
  const data = (await res.json()) as TreeResponse;
  if (data.truncated) throw new Error("Tree response was truncated — cannot trust this as a complete listing");

  const entries: Array<{ corpusArea: string; sourcePath: string }> = [];
  for (const item of data.tree) {
    if (item.type !== "blob") continue;
    if (!item.path.endsWith(".html")) continue;
    const filename = item.path.split("/").pop()!;
    if (EXCLUDED_FILENAMES.has(filename)) continue;
    const directory = item.path.split("/")[0];
    const corpusArea = FILENAME_AREA_OVERRIDES[filename] ?? DIRECTORY_DEFAULT_AREA[directory] ?? "core";
    entries.push({ corpusArea, sourcePath: item.path });
  }

  entries.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  const output = `// GENERATED FILE — produced by scripts/generate-olimot-srd-snapshot.ts
// against pinned commit ${PINNED_SHA}. Do not hand-edit; re-run the script.
// legal-information.html and the repo-root index.html are deliberately excluded.

import type { CorpusArea } from "@shared/rules-registry/srd-manifest";

export const SRD_MANIFEST_SOURCE_OLIMOT: Array<{ corpusArea: CorpusArea; sourcePath: string }> = ${JSON.stringify(entries, null, 2)};
`;

  const fs = await import("node:fs");
  fs.writeFileSync("server/srd-manifest-snapshot-olimot.generated.ts", output);
  console.log(`Wrote ${entries.length} entries to server/srd-manifest-snapshot-olimot.generated.ts`);
}

main();
```

- [ ] **Step 2: Run the script for real, against the real pinned commit, and commit its literal output**

```bash
node --import tsx scripts/generate-olimot-srd-snapshot.ts
```

Read the generated `server/srd-manifest-snapshot-olimot.generated.ts` output. Cross-check its entry count against this plan's own "Real Source Structure" section (99 total `.html` files at this pinned commit, minus `index.html` and `legal-information.html` → 97 expected entries — if the script's real output doesn't match this number, that is itself informative: either this plan's manual count was one of the two that drifted, or the script has a bug; investigate and resolve before proceeding, do not silently accept either number without reconciling the discrepancy).

- [ ] **Step 3: Write `server/srd-manifest-snapshot-d20srd.ts`, hand-written from the live verification already performed**

```ts
// server/srd-manifest-snapshot-d20srd.ts
//
// d20srd.org has no git tree API to generate this list from — it is a live
// website, not a version-controlled repository. This list is the 40 real
// top-level index pages verified via the Claude Browser tool (a real
// browser; WebFetch returned HTTP 403 for every URL on this domain) against
// the live site on 2026-08-22, reading the real navigation's href attributes
// directly (not summarized). This is this plan's discovery granularity for
// d20srd.org — each index page is one manifest entry, not a further
// recursive crawl into every leaf spell/monster/feat page each index links
// to (that split is Phase 2B entity-extraction work, same boundary as the
// olimot mirror's alphabetically-batched pages).
//
// "open-variants" entries are the Variant Rules / Unearthed Arcana section —
// the one corpus area olimot has zero coverage of.

import type { CorpusArea } from "@shared/rules-registry/srd-manifest";

export const SRD_MANIFEST_SOURCE_D20SRD: Array<{ corpusArea: CorpusArea; sourcePath: string }> = [
  // Core Rules
  { corpusArea: "core", sourcePath: "/indexes/basicsRacesDescription.htm" },
  { corpusArea: "classes", sourcePath: "/indexes/classes.htm" },
  { corpusArea: "skills", sourcePath: "/indexes/skills.htm" },
  { corpusArea: "feats", sourcePath: "/indexes/feats.htm" },
  { corpusArea: "items-equipment", sourcePath: "/indexes/magicItems.htm" },
  { corpusArea: "items-equipment", sourcePath: "/indexes/equipment.htm" },
  { corpusArea: "combat-rules", sourcePath: "/indexes/combat.htm" },
  { corpusArea: "conditions", sourcePath: "/indexes/conditions.htm" },
  { corpusArea: "conditions", sourcePath: "/indexes/specialAbilities.htm" },
  { corpusArea: "spells", sourcePath: "/indexes/magicOverview.htm" },
  { corpusArea: "spells", sourcePath: "/indexes/spellLists.htm" },
  { corpusArea: "spells", sourcePath: "/indexes/spells.htm" },
  { corpusArea: "monsters", sourcePath: "/indexes/monsters.htm" },
  { corpusArea: "monsters", sourcePath: "/indexes/typesSubtypes.htm" },
  { corpusArea: "monsters", sourcePath: "/indexes/improvingMonsters.htm" },
  { corpusArea: "monsters", sourcePath: "/indexes/monsterFeats.htm" },
  { corpusArea: "monsters", sourcePath: "/indexes/monstersAsRaces.htm" },
  { corpusArea: "core", sourcePath: "/indexes/carryingMovementExploration.htm" },
  { corpusArea: "core", sourcePath: "/indexes/wildernessWeatherEnvironment.htm" },
  { corpusArea: "core", sourcePath: "/indexes/traps.htm" },
  { corpusArea: "items-equipment", sourcePath: "/indexes/treasure.htm" },
  { corpusArea: "core", sourcePath: "/indexes/planes.htm" },

  // Epic Rules
  { corpusArea: "epic", sourcePath: "/indexes/epicBasicsAndClasses.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicSkills.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicFeats.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicSpells.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicMagicItems.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicMonstersAndObstacles.htm" },

  // Psionic Rules
  { corpusArea: "psionics", sourcePath: "/indexes/psionicRacesClassesSkillsSpells.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicFeats.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicPowersOverview.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicPowerList.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicPowers.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicItems.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicMonsters.htm" },

  // Divine Rules
  { corpusArea: "divine", sourcePath: "/indexes/divineRanksPowers.htm" },
  { corpusArea: "divine", sourcePath: "/indexes/divineAbilitiesFeats.htm" },
  { corpusArea: "divine", sourcePath: "/indexes/divineMinionsDomainsSpells.htm" },

  // Variant Rules — "open content from Unearthed Arcana". The one corpus
  // area olimot/srd-v3.5 has zero coverage of.
  { corpusArea: "open-variants", sourcePath: "/indexes/variantRaces.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantClasses.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantBuildingCharacters.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantAdventuring.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantMagic.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantCampaigns.htm" },
];
```

- [ ] **Step 4: Write `server/srd-manifest-snapshot.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SRD_MANIFEST_SOURCE_OLIMOT } from "./srd-manifest-snapshot-olimot.generated";
import { SRD_MANIFEST_SOURCE_D20SRD } from "./srd-manifest-snapshot-d20srd";

const VALID_AREAS = new Set([
  "core", "monsters", "spells", "feats", "items-equipment", "classes",
  "prestige-classes", "races", "skills", "conditions", "combat-rules",
  "epic", "psionics", "divine", "open-variants",
]);

test("SRD_MANIFEST_SOURCE_OLIMOT has no zero-length list (the generation step actually ran)", () => {
  assert.ok(SRD_MANIFEST_SOURCE_OLIMOT.length > 50);
});

test("SRD_MANIFEST_SOURCE_OLIMOT deliberately excludes legal-information.html and index.html", () => {
  assert.ok(!SRD_MANIFEST_SOURCE_OLIMOT.some((e) => e.sourcePath.includes("legal-information")));
  assert.ok(!SRD_MANIFEST_SOURCE_OLIMOT.some((e) => e.sourcePath === "index.html"));
});

test("SRD_MANIFEST_SOURCE_OLIMOT has zero open-variants entries — olimot has no Unearthed Arcana content", () => {
  assert.equal(SRD_MANIFEST_SOURCE_OLIMOT.filter((e) => e.corpusArea === "open-variants").length, 0);
});

test("SRD_MANIFEST_SOURCE_D20SRD has exactly 6 open-variants entries — the Unearthed Arcana Variant Rules section", () => {
  assert.equal(SRD_MANIFEST_SOURCE_D20SRD.filter((e) => e.corpusArea === "open-variants").length, 6);
});

test("every entry across both sources has a real corpus area", () => {
  for (const entry of [...SRD_MANIFEST_SOURCE_OLIMOT, ...SRD_MANIFEST_SOURCE_D20SRD]) {
    assert.ok(VALID_AREAS.has(entry.corpusArea), `"${entry.corpusArea}" (${entry.sourcePath}) must be a real corpus area`);
  }
});

test("no sourcePath is duplicated within either source's own list", () => {
  for (const list of [SRD_MANIFEST_SOURCE_OLIMOT, SRD_MANIFEST_SOURCE_D20SRD]) {
    const paths = list.map((e) => e.sourcePath);
    assert.equal(new Set(paths).size, paths.length, "a source's own frozen manifest must have no internal duplicate paths");
  }
});
```

- [ ] **Step 5: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/srd-manifest-snapshot.test.ts` — expect 6/6.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-olimot-srd-snapshot.ts server/srd-manifest-snapshot-olimot.generated.ts server/srd-manifest-snapshot-d20srd.ts server/srd-manifest-snapshot.test.ts
git commit -m "feat: generate frozen olimot manifest from pinned tree API, hand-verify d20srd.org's 40 real index pages"
```

**Independent verification before Task 6 begins:** re-run tests fresh; re-run the generation script a second time and diff its output against the committed file byte-for-byte — must be identical (proving the pinned commit genuinely makes this deterministic); manually cross-check 5 random entries from `SRD_MANIFEST_SOURCE_D20SRD` against this plan's "Real Source Structure" section's own href list — every path must trace back to a real, verified `read_page` result, not an invented one.

---

### Task 6: Discovery/fetch pipeline for both sources

**Files:**
- Create: `server/srd-manifest-discovery.ts`
- Create: `server/srd-manifest-discovery.test.ts`

**Interfaces:**
- Consumes: `SRD_MANIFEST_SOURCE_OLIMOT`, `SRD_MANIFEST_SOURCE_D20SRD` (Task 5), `storage.upsertSrdManifestEntry`, `storage.recordSrdManifestDiscoveryFailure` (Task 3).
- Produces: `discoverSourcePage(sourceId: number, baseUrl: string, entry: {corpusArea, sourcePath}, fetchImpl?): Promise<SrdManifestEntry>`, `runSrdManifestDiscovery(sources: Array<{sourceId: number; baseUrl: string; entries: Array<{corpusArea, sourcePath}>}>, fetchImpl?): Promise<{succeeded: number; failed: number}>`.

**Expected behavior:** `discoverSourcePage` builds the real fetch URL as `${baseUrl}${entry.sourcePath}` (the caller supplies `baseUrl` per-source, since olimot's is a jsDelivr-pinned-SHA URL and `d20srd.org`'s is a plain `https://www.d20srd.org` prefix — two different transports, two different URL-construction rules, made explicit rather than hardcoded inside the discovery function itself), fetches via `fetchImpl`, hashes on success via `upsertSrdManifestEntry`, and calls `recordSrdManifestDiscoveryFailure` on any non-OK response or thrown error — never propagating the failure to abort sibling pages. `runSrdManifestDiscovery` accepts a list of `{sourceId, baseUrl, entries}` groups (one per real source) so both olimot and `d20srd.org` run through the exact same pipeline code, not two parallel implementations.

**Migration risk:** None.

**Rollback consideration:** No callers outside its own tests until Task 8.

- [ ] **Step 1: Write `server/srd-manifest-discovery.ts`**

```ts
// server/srd-manifest-discovery.ts
//
// Fetches both pinned SRD source transports, hashes content, and persists
// via server/storage.ts's page-scoped CRUD (Task 3) — never canonical
// entity tables, never canonical-id.ts, never IngestionStatus.

import { createHash } from "crypto";
import { storage } from "./storage";
import type { CorpusArea, SrdManifestEntry } from "@shared/rules-registry/srd-manifest";

export async function discoverSourcePage(
  sourceId: number,
  baseUrl: string,
  entry: { corpusArea: CorpusArea; sourcePath: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SrdManifestEntry> {
  const sourceUrl = `${baseUrl}${entry.sourcePath}`;
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
    const result = storage.upsertSrdManifestEntry({
      sourceId, corpusArea: entry.corpusArea, sourceUrl, sourcePath: entry.sourcePath, contentHash,
    });
    storage.updateSrdManifestEntryProcessingStatus(result.sourcePageKey, "hashed");
    return storage.getSrdManifestEntry(result.sourcePageKey)!;
  } catch (err) {
    return storage.recordSrdManifestDiscoveryFailure(
      { sourceId, corpusArea: entry.corpusArea, sourceUrl, sourcePath: entry.sourcePath },
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function runSrdManifestDiscovery(
  sources: Array<{ sourceId: number; baseUrl: string; entries: Array<{ corpusArea: CorpusArea; sourcePath: string }> }>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ succeeded: number; failed: number }> {
  const allCalls = sources.flatMap((source) =>
    source.entries.map((entry) => discoverSourcePage(source.sourceId, source.baseUrl, entry, fetchImpl)),
  );
  const results = await Promise.allSettled(allCalls);
  let succeeded = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === "fulfilled" && !result.value.lastError) succeeded++;
    else failed++;
  }
  return { succeeded, failed };
}
```

- [ ] **Step 2: Write `server/srd-manifest-discovery.test.ts`, entirely against injected fake fetchers**

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
const { discoverSourcePage, runSrdManifestDiscovery } = await import("./srd-manifest-discovery");

let olimotSourceId: number;
let d20srdSourceId: number;
before(() => {
  olimotSourceId = storage.createRuleSource({
    sourceKey: "dnd35e-srd-olimot-discovery-test", title: "Olimot Discovery Test",
    ruleset: "dnd35e", setting: "generic", publicationType: "web-enhancement",
    provenanceClassification: "open_game_content", licenseClassification: "srd_open",
  }).id;
  d20srdSourceId = storage.createRuleSource({
    sourceKey: "dnd35e-srd-d20-discovery-test", title: "d20srd Discovery Test",
    ruleset: "dnd35e", setting: "generic", publicationType: "web-enhancement",
    provenanceClassification: "open_game_content", licenseClassification: "srd_open",
  }).id;
});

function fakeFetchOk(body: string) { return async () => new Response(body, { status: 200 }); }
function fakeFetch404() { return async () => new Response("not found", { status: 404 }); }
function fakeFetchThrows(message: string) { return async () => { throw new Error(message); }; }

test("discoverSourcePage writes a hashed row on success", async () => {
  const entry = await discoverSourcePage(
    olimotSourceId, "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../",
    { corpusArea: "spells", sourcePath: "spells/spells-a-b.html" },
    fakeFetchOk("<html>fake page</html>"),
  );
  assert.equal(entry.processingStatus, "hashed");
  assert.equal(entry.contentHash!.length, 64);
});

test("discoverSourcePage records a loud failure (never throws) on a 404", async () => {
  const entry = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "open-variants", sourcePath: "/indexes/does-not-exist.htm" },
    fakeFetch404(),
  );
  assert.equal(entry.lastError, "HTTP 404");
});

test("discoverSourcePage records a loud failure (never throws) when fetch itself throws", async () => {
  const entry = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "core", sourcePath: "/indexes/network-error.htm" },
    fakeFetchThrows("ECONNRESET"),
  );
  assert.equal(entry.lastError, "ECONNRESET");
});

test("runSrdManifestDiscovery runs both sources through the same pipeline and never aborts on one page's failure", async () => {
  const mixedFetch: typeof fetch = async (url) => {
    if (String(url).includes("spells-a-b")) return new Response("<html>ok</html>", { status: 200 });
    return new Response("gone", { status: 404 });
  };
  const result = await runSrdManifestDiscovery(
    [
      { sourceId: olimotSourceId, baseUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../",
        entries: [{ corpusArea: "spells", sourcePath: "spells/spells-a-b.html" }, { corpusArea: "spells", sourcePath: "spells/spells-c.html" }] },
      { sourceId: d20srdSourceId, baseUrl: "https://www.d20srd.org",
        entries: [{ corpusArea: "open-variants", sourcePath: "/indexes/variantRaces.htm" }] },
    ],
    mixedFetch,
  );
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 2);
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

- [ ] **Step 3: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/srd-manifest-discovery.test.ts` — expect 4/4.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 4: Commit**

```bash
git add server/srd-manifest-discovery.ts server/srd-manifest-discovery.test.ts
git commit -m "feat: add discovery pipeline covering both pinned sources, injectable fetcher, loud failures"
```

**Independent verification before Task 7 begins:** re-run tests fresh; grep the test file to confirm no test omits `fetchImpl` and falls through to the real network default; confirm `discoverSourcePage` never calls `recordRevision`/`canonical-id.ts` anywhere (a structural check, same discipline as Task 2's gate).

---

### Task 7: Sample end-to-end page-processing proof + source-page verification write path

**Files:**
- Modify: `server/storage.ts` (add `recordSourcePageVerification`)
- Create: `server/srd-manifest-lifecycle.test.ts`

**Interfaces:**
- Produces: `storage.recordSourcePageVerification(sourcePageKey: string, metadata: VerificationMetadata): void` — enforces `isValidSourcePageVerification` (Task 2), storage-layer only, no HTTP route.

**Expected behavior:** One hand-advanced sample row proves `discovered → fetched → hashed → parsed → source_verified` is real and enforced end-to-end, with the guard genuinely rejecting verification attempted before `"source_verified"` — the page-level equivalent of the prior draft's Task 6, renamed and re-scoped to match this plan's real vocabulary.

**Migration risk:** None.

**Rollback consideration:** None; self-contained proof.

- [ ] **Step 1: Write the failing test**

```ts
// server/srd-manifest-lifecycle.test.ts
//
// Proves the full PageProcessingStatus progression is real and enforced,
// via one hand-advanced sample row. No entity parsing, no bulk data — a
// machinery proof, matching this plan's page-level scope exactly.

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
  sourceId = storage.createRuleSource({
    sourceKey: "dnd35e-srd-lifecycle-test", title: "Lifecycle Test Source",
    ruleset: "dnd35e", setting: "generic", publicationType: "web-enhancement",
    provenanceClassification: "open_game_content", licenseClassification: "srd_open",
  }).id;
});

test("recordSourcePageVerification rejects verification before processingStatus reaches source_verified", () => {
  const entry = storage.createSrdManifestEntry({
    sourceId, corpusArea: "feats",
    sourceUrl: "https://www.d20srd.org/indexes/feats.htm", sourcePath: "/indexes/feats.htm",
  });
  assert.throws(() => storage.recordSourcePageVerification(entry.sourcePageKey, { method: "human_review" }));
});

test("a manifest entry can be hand-advanced through discovered -> fetched -> hashed -> parsed -> source_verified, each transition recorded", () => {
  const entry = storage.createSrdManifestEntry({
    sourceId, corpusArea: "feats",
    sourceUrl: "https://www.d20srd.org/indexes/feats-lifecycle-sample.htm", sourcePath: "/indexes/feats-lifecycle-sample.htm",
  });
  assert.equal(entry.processingStatus, "discovered");

  storage.updateSrdManifestEntryProcessingStatus(entry.sourcePageKey, "fetched");
  storage.updateSrdManifestEntryProcessingStatus(entry.sourcePageKey, "hashed");
  storage.updateSrdManifestEntryProcessingStatus(entry.sourcePageKey, "parsed");
  storage.recordSourcePageRevision({
    sourcePageKey: entry.sourcePageKey, revision: 1,
    changeReason: "manually confirmed page structure matches expected feats-index format", changedBy: "controller",
  });

  storage.updateSrdManifestEntryProcessingStatus(entry.sourcePageKey, "source_verified");
  storage.recordSourcePageVerification(entry.sourcePageKey, {
    method: "human_review", verifiedBy: "controller", verifiedAt: new Date().toISOString(),
  });

  const final = storage.getSrdManifestEntry(entry.sourcePageKey);
  assert.equal(final?.processingStatus, "source_verified");
  assert.equal(final?.verificationMethod, "human_review");

  const report = storage.getSourcePageCoverageReport();
  assert.ok(report.sourceVerifiedCount >= 1);
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

- [ ] **Step 2: Run test to verify it fails, then add `recordSourcePageVerification`**

Run: `node --import tsx --test server/srd-manifest-lifecycle.test.ts` — expect FAIL.

`IStorage`:

```ts
recordSourcePageVerification(sourcePageKey: string, metadata: VerificationMetadata): void;
```

`DatabaseStorage`:

```ts
recordSourcePageVerification(sourcePageKey: string, metadata: VerificationMetadata): void {
  const existing = this.getSrdManifestEntry(sourcePageKey);
  if (!existing) throw new Error(`SRD manifest entry "${sourcePageKey}" not found`);
  if (!isValidSourcePageVerification(existing.processingStatus as PageProcessingStatus, true)) {
    throw new Error(
      `Cannot record verification for "${sourcePageKey}": processingStatus is "${existing.processingStatus}", must be "source_verified" first`,
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
    .where(eq(srdManifestEntries.sourcePageKey, sourcePageKey))
    .run();
},
```

- [ ] **Step 3: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/srd-manifest-lifecycle.test.ts` — expect 2/2.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 4: Commit**

```bash
git add server/storage.ts server/srd-manifest-lifecycle.test.ts
git commit -m "feat: add source-page verification write path, prove full page-processing progression"
```

**Independent verification before Task 8 begins:** re-run tests fresh; confirm `recordSourcePageVerification`'s guard actually calls `isValidSourcePageVerification` rather than a duplicated inline condition; confirm no HTTP route in the entire diff so far exposes either verification writer (grep `server/routes.ts` for `recordRuleSourceVerification`/`recordSourcePageVerification` — zero hits expected).

---

### Task 8 (required for Phase 2A completion) — Execute the real discovery scan and produce acceptance-gate evidence

**This task is not optional.** Tasks 1-7 are a fully tested, network-free *framework*. Phase 2A is not complete until this task runs for real and produces the evidence format below — an empty, well-tested manifest framework is not a corpus manifest. Its execution is isolated from the unit-test suite (nothing here runs inside `node --import tsx --test`), but it is a required gate, not a deferrable extra.

**Files:**
- Create: `docs/superpowers/notes/2026-08-22-srd-manifest-acceptance-report.md`

**Interfaces:**
- Consumes: `runSrdManifestDiscovery` (Task 6), `SRD_MANIFEST_SOURCE_OLIMOT`/`SRD_MANIFEST_SOURCE_D20SRD` (Task 5), `storage.getSourcePageCoverageReport`/`findDuplicateSourcePages` (Task 4), the three real registered `rule_sources` rows (Task 1).

**Expected behavior:** A real run against both pinned sources, followed by the pinned-tree completeness check for the git-hosted mirror (the mechanism point 6 specifically asked for: an accidentally-omitted page must make this gate fail, not just look fine because the frozen list happened to be self-consistent). **Zero game-rule content is stored anywhere.**

**Migration risk:** None — additive dev-database rows. **Do not target the live VPS database** unless the user explicitly asks for that in a later turn.

**Rollback consideration:** `DELETE FROM srd_manifest_entries; DELETE FROM srd_source_page_revisions;` — trivially reversible, zero impact elsewhere.

- [ ] **Step 1: Run the real discovery scan against both pinned sources**

```ts
import { storage } from "./server/storage";
import { runSrdManifestDiscovery } from "./server/srd-manifest-discovery";
import { SRD_MANIFEST_SOURCE_OLIMOT } from "./server/srd-manifest-snapshot-olimot.generated";
import { SRD_MANIFEST_SOURCE_D20SRD } from "./server/srd-manifest-snapshot-d20srd";

const olimot = storage.getRuleSource("dnd35e-srd-olimot-mirror");
const hypertextD20 = storage.getRuleSource("dnd35e-srd-hypertext-d20");
if (!olimot || !hypertextD20) throw new Error("Run Task 1 Step 6 first.");

const result = await runSrdManifestDiscovery([
  { sourceId: olimot.id, baseUrl: `https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@${olimot.pinnedRevision}/`, entries: SRD_MANIFEST_SOURCE_OLIMOT },
  { sourceId: hypertextD20.id, baseUrl: "https://www.d20srd.org", entries: SRD_MANIFEST_SOURCE_D20SRD },
]);

console.log("Discovery run result:", result);
console.log("Coverage report:", storage.getSourcePageCoverageReport());
console.log("Duplicates:", storage.findDuplicateSourcePages());
```

- [ ] **Step 2: Run the pinned-tree completeness check (real network, not a unit test)**

```ts
const PINNED_SHA = "faab739130921026db42b96e6adff6d3661bffbd";
const res = await fetch(`https://api.github.com/repos/olimot/srd-v3.5/git/trees/${PINNED_SHA}?recursive=1`);
const data = await res.json();
const realHtmlPaths = new Set(
  data.tree
    .filter((e: any) => e.type === "blob" && e.path.endsWith(".html"))
    .filter((e: any) => !["legal-information.html", "index.html"].includes(e.path.split("/").pop()))
    .map((e: any) => e.path),
);
const manifestPaths = new Set(SRD_MANIFEST_SOURCE_OLIMOT.map((e) => e.sourcePath));
const missingFromManifest = [...realHtmlPaths].filter((p) => !manifestPaths.has(p));
const extraInManifest = [...manifestPaths].filter((p) => !realHtmlPaths.has(p));

if (missingFromManifest.length > 0 || extraInManifest.length > 0) {
  throw new Error(`Coverage gate FAILED. Missing: ${JSON.stringify(missingFromManifest)}. Extra: ${JSON.stringify(extraInManifest)}`);
}
console.log("Coverage gate PASSED: frozen manifest exactly matches the pinned tree's real .html files.");
```

If this fails, do not proceed to Step 3 — regenerate `server/srd-manifest-snapshot-olimot.generated.ts` (re-run Task 5 Step 2's script) and re-run this check before declaring the acceptance report.

- [ ] **Step 3: Write the acceptance report in the literal evidence format specified**

`docs/superpowers/notes/2026-08-22-srd-manifest-acceptance-report.md`, containing at minimum:

```
discovered N source pages → accounted for N → fetch failures X → duplicates X
```

with real numbers substituted from Step 1's output, broken down per source (olimot / d20srd.org), per corpus area, and per processing status (`byProcessingStatus`), plus the specific `sourcePath`+`lastError` for every failure (never just a bare count), plus Step 2's coverage-gate result. If the report shows `changed X` from a *second* scan (re-running Step 1 a second time and diffing against the first run's `srd_source_page_revisions` rows), include that too — a single first-ever scan has nothing to compare against for "changed," so that field is legitimately `0`/not-yet-applicable on a first run, stated as such rather than omitted silently.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/notes/2026-08-22-srd-manifest-acceptance-report.md
git commit -m "docs: capture real SRD manifest discovery + pinned-tree coverage gate results"
```

**Independent verification before Phase 2A is considered complete:** re-run the full test suite, typecheck, and build fresh; confirm the acceptance report's `discovered` count equals `SRD_MANIFEST_SOURCE_OLIMOT.length + SRD_MANIFEST_SOURCE_D20SRD.length` exactly; confirm zero rows anywhere in `srd_manifest_entries` reached `"parsed"` or `"source_verified"` from the real scan itself (those values must only exist from Task 7's deliberate sample row) — the concrete proof that Task 8 stayed within page-level discovery and never silently claimed entity-level progress it didn't earn; confirm the coverage report's `reportScope` field is present and correct in the real captured output, not just in test fixtures.

---

## Self-Review

**Against the review's 10 correction points, explicitly:**

1. **Provenance vs. transport** — Task 1 registers 3 real rows with a new `derivedFromSourceId` column distinguishing the authoritative original from its two derived transports. ✅
2. **Full "ALL" scope, multiple manifests** — Task 5 produces two frozen manifests (olimot: core/epic/psionics/divine; d20srd.org: the same four *plus* Unearthed Arcana Variant Rules, live-verified as the one section olimot lacks entirely). The corpus-area test in Task 5 explicitly asserts olimot has zero `open-variants` entries and d20srd.org has exactly 6 — the gap is proven closed, not just claimed closed. ✅
3. **No canonical IDs for pages** — `sourcePageKey` replaces `canonicalId` throughout; Task 2's test explicitly asserts a real `sourcePageKey` fails `isValidCanonicalId`. ✅
4. **Separate page-status vocabulary** — `PageProcessingStatus` (`discovered|fetched|hashed|parsed|source_verified`), never `IngestionStatus`, verified structurally (Task 2's "no import from canonical-id.ts or provenance.ts for the status type" gate) and by naming (`sourceVerifiedCount`, not `verifiedCount`). ✅
5. **Task 8 mandatory** — reframed from the prior draft's "optional, deferrable" to "required for Phase 2A completion," stated at the task's own header before its file list, with the literal evidence format the review specified as Step 3's deliverable. ✅
6. **Immutable pinning + generated (not hand-maintained) snapshot** — olimot pinned to a full 40-character commit SHA, its manifest generated by a real script parsing the raw tree API response (justified by this plan's own two-pass manual-count discrepancy, documented rather than hidden); Task 8 Step 2 re-fetches that same pinned tree and diffs it against the committed manifest as a real completeness gate that fails loudly on an omission. d20srd.org's asymmetry (no tree API, softer scan-timestamp pin) is stated explicitly rather than papered over. ✅
7. **Verification write paths stay internal** — both `recordRuleSourceVerification` and `recordSourcePageVerification` are storage-layer-only; a Global Constraint states no HTTP route may expose them without going through this codebase's existing admin-authority pattern; Task 7's own verification gate greps for zero route references. ✅
8. **`recordRevision`/`canonical_revisions` scope clarified** — not touched by this plan at all; `srd_source_page_revisions` is a new, dedicated, page-scoped table, explicitly justified in "Resolved Design Decisions" #6 as avoiding exactly the "force page bookkeeping through a game-entity abstraction" problem the review named. ✅
9. **Coverage report distinguishes layers** — `reportScope: "source-page-coverage"` is a literal field in the actual returned data, not just a naming convention; Task 4's own test deliberately breaks the field and confirms the test catches it. A structurally separate `getCanonicalEntityCoverageReport()` is named as Phase 2B+'s responsibility, not built here. ✅
10. **Everything correct kept** — injectable fetcher (Task 6), zero real-network unit tests (verified per-task), failures persisted not swallowed (`recordSrdManifestDiscoveryFailure`, tested for both non-OK responses and thrown errors), checksums/change detection (`upsertSrdManifestEntry`'s hash-compare branch), duplicate detection (Task 4), hard `ruleset: "dnd35e"` isolation (structurally enforced, no parameter to override it), no Library UI/gameplay/AI wiring/licensed-Drive-ingestion/Phase 2B entity extraction anywhere in this plan (confirmed by the same "no `*_definitions` table, no spell/monster mechanical data in any INSERT" check as the prior draft). ✅

**Placeholder scan:** every step has real, complete code. The one place real research was capped for scope reasons — a full recursive crawl of every leaf page beneath d20srd.org's 40 index pages — is stated as a deliberate granularity boundary (mirroring the olimot alphabetically-batched-page boundary), not a placeholder; the 40 index pages themselves are real, live-verified, complete data, not a sample of an unenumerated larger set.

**Type consistency:** `CreateSrdManifestEntryInput` (Task 2) is used identically across Tasks 3, 6, 7. `PageProcessingStatus` is the literal type of `processingStatus` throughout, never shadowed. `VerificationMetadata` (Phase 0/1 Task 3, unchanged) is the literal parameter type for both Task 1's and Task 7's verification writers — one shape, two call sites, matching the design spec's "one architectural shape, applied consistently" principle, now correctly scoped to not also force `IngestionStatus`/`canonicalId` onto page-level data the way the prior draft did.

**Migration risk / rollback:** stated per task; Task 3 is the only real schema migration (two new tables, purely additive); Task 1 is a low-risk two-nullable-column addition to an already-migrated table; Task 8 is flagged as reversible dev-data, explicitly not targeting production, and explicitly *not* optional as a task even though it's isolated from the automated test suite.

No gaps found against either the approved canonical-rules design or the literal "ALL rules-bearing d20srd.org material" requirement. Ready for user approval.

## Execution Handoff

Plan revised and saved to `docs/superpowers/plans/2026-08-22-dnd35-srd-ingestion-foundation-phase2a.md`. Per your explicit instruction, stopping here for your review before any code is written — this plan has not been executed, and Phase 2B/canonical-entity extraction has not been started.
