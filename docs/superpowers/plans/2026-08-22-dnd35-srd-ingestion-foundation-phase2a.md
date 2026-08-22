# Phase 2A — D&D 3.5e SRD Corpus Manifest & Ingestion Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the machinery to prove what 3.5e SRD *source pages* have been discovered, fetched, hashed, and source-verified across the full approved "ALL rules-bearing d20srd.org material" scope — before any of it is parsed into real game data. This phase produces a queryable, honest, scope-labeled answer to "we discovered N source pages; N are accounted for, X fetch failures, X changed since last scan, X duplicates" — and nothing that touches gameplay, AI resolution, canonical entity data, or a UI.

**Revision note 2 (this document supersedes the version pushed as `2f224f9`):** that version treated `d20srd.org`'s 40 real top-level index pages *as the entire manifest*, deferring "crawling the leaf pages" to Phase 2B. On review, that under-satisfies "ALL rules-bearing d20srd.org material" — an index page's own internal navigation links (e.g. `/indexes/spells.htm` → `/srd/spells/fireball.htm`) are still Phase 2A discovery work, not Phase 2B entity extraction; discovering a URL and canonicalizing a game entity are different operations, and only the second one is out of scope here. This revision adds a real one-level link-extraction crawl (Tasks 5-7 below), grounded in real data pulled from the live site while writing this revision: the 40 index pages are actually **44** (a second real counting correction this plan has now produced on its own — see "Real Source Structure"), and following their real internal links yields roughly **~1,560 real leaf pages** (spells alone: 608; psionic powers: 287; monsters: 249) — not "thousands," but genuinely exhaustive, and genuinely larger than a hand-maintained list could be trusted to stay accurate for the same reason the olimot list is generated rather than transcribed. This revision also verifies the planned fetch strategy directly: Node's built-in `fetch()` (not the `WebFetch` tool that returned 403) gets a clean `200` from `d20srd.org`, confirmed by direct test — see "Fetch Strategy Verification" below.

**Architecture:** Three `rule_sources` rows separate authoritative provenance from ingestion transport: the original Wizards 3.5e SRD (an identity/citation row — no live fetchable URL), and two independently pinned *derived* transports that are actually fetched — a GitHub-hosted HTML mirror (`olimot/srd-v3.5`, pinned to an exact commit SHA) and the Hypertext d20 SRD (`d20srd.org`, a live site with documented errata integration and, critically, the open-content Unearthed Arcana Variant Rules section neither olimot nor a "core SRD only" scope would otherwise cover). Underneath those sit `srd_manifest_entries` — one row per discovered *source page*, identified by a `sourcePageKey` that is deliberately **not** a canonical entity ID. For olimot, every leaf page is directly enumerated from the pinned commit tree (no crawl needed — the mirror is already flat). For `d20srd.org`, 44 real index pages are **discovery roots**, not the corpus itself: a real one-level link-extraction step (fetch each root, extract every `href`, normalize, classify as included-with-corpus-area or excluded-with-reason, dedupe) turns those 44 roots into the real leaf-page manifest. Page-processing status uses its own vocabulary (`discovered → fetched → hashed → parsed → source_verified`) — never Phase 0/1's `IngestionStatus`. A separate, dedicated `srd_source_page_revisions` table tracks page-level change history — `canonical_revisions` stays reserved for actual canonical rules entities, which don't exist until Phase 2B.

**Tech Stack:** Drizzle ORM (SQLite dialect), the existing `runMigrations()` mechanism in `server/storage.ts`, Node's built-in `crypto.createHash("sha256")`, `fetch()` (jsDelivr for the GitHub-hosted mirror, direct HTTPS for `d20srd.org` — verified working, see below), `node --import tsx --test` + `node:assert/strict`.

## Global Constraints

- **No Library UI, no gameplay/AI-resolution wiring, no licensed Google Drive book ingestion, no 5e data merge, no Bestiary/Grimoire/Feat Codex presentation work, no Phase 2B canonical-entity extraction.** Discovering `/srd/spells/fireball.htm` is real Phase 2A work; creating `dnd35e:spell:fireball` is not.
- **Source *pages* are never given canonical entity IDs.** `srd_manifest_entries` has no `canonicalId` column and never calls `buildCanonicalId`/`isValidCanonicalId`/`recordRevision` from `canonical-id.ts`/`revisions.ts`. Those Phase 0/1 exports are reserved for real canonical rules entities (Phase 2B+).
- **Page-processing status is never Phase 0/1's `IngestionStatus`.** This plan defines its own `PageProcessingStatus` type. Any report or log line describing page-level counts states its scope explicitly (`reportScope: "source-page-coverage"`) so it can never be read as canonical-rules coverage.
- **Every row this pipeline creates is explicitly `ruleset: "dnd35e"`, never inferred or caller-supplied** — `CreateSrdManifestEntryInput` has no `ruleset` field; the storage method hardcodes the literal.
- **Every fetched transport source is pinned to an immutable identifier.** The GitHub-hosted mirror is pinned to a full 40-character commit SHA. The live-website source has no git-equivalent pin; its "revision" is the documented scan timestamp, with content-hash change detection as the primary drift-safeguard.
- **Both sources' leaf-page lists are generated artifacts, not hand-transcribed.** Olimot's from a script parsing the pinned tree API's raw response (Task 5). `d20srd.org`'s from a script that crawls the 44 real, hand-verified index-page *roots* and extracts+classifies+dedupes their real links (Task 6) — the 44 roots themselves are the one list in this plan that is necessarily hand-verified (no tree API exists for a live website), and this plan has already demonstrated, twice, on two different sources, that a hand-count is exactly the kind of number that needs a generation step checking it (see "Real Source Structure").
- **The full approved "ALL rules-bearing d20srd.org material" scope is real leaf-page discovery, not root-page discovery.** Treating the 44 index pages as the manifest (the prior revision's approach) under-satisfies this requirement; treating them as crawl roots whose real internal links are extracted, classified, and persisted satisfies it.
- **The fetch strategy is verified, not assumed.** `WebFetch` (a different tool/client) returned HTTP 403 against `d20srd.org`; Node's own `fetch()` — the actual API `server/srd-manifest-discovery.ts` uses — was tested directly against the live site during planning and returned `200` with real content. This plan does not build a mandatory acceptance gate around a fetch method already known to fail; see "Fetch Strategy Verification."
- **A real crawl against a small, volunteer-run site must be a considerate citizen.** The d20srd.org leaf-page fetch step (Task 7) caps concurrency and paces requests — not because the site is known to rate-limit, but because sending ~1,560 simultaneous requests to a non-CDN-fronted site is inconsiderate regardless, and is exactly the kind of behavior that could turn a currently-working fetch strategy into a blocked one.
- **Verification write paths are storage-layer only, never client-reachable.** `recordRuleSourceVerification` and `recordSourcePageVerification` have no HTTP route anywhere in this plan. If a future admin surface needs one, it must be gated by this codebase's existing admin-authority pattern (`role === "dungeon_master"` / `isAdmin`) — never a bare authenticated-user route. This plan adds zero routes.
- **`canonical_revisions` (Phase 0/1 Task 6) is not touched by this plan.** Page-level change history uses its own dedicated table, `srd_source_page_revisions`.
- **Phase 2A is not complete until a real network run has produced real coverage evidence.** Task 9's execution is isolated from the TDD unit-test suite (Tasks 1-8 remain 100% network-free with an injectable fetcher) but is not optional or deferrable as a whole task.
- **Do not touch live character data.** Nothing in this plan reads or writes `characters`/`characterData`/player-owned `items`.
- **Every task includes:** files/components affected, expected behavior, tests required, migration risk, rollback consideration, and an independent-verification gate before the next task begins.
- New tables/columns use `CREATE TABLE IF NOT EXISTS` / `addColumnIfMissing` inside `runMigrations()`. Never `sqlite.prepare()` at module top level.
- **Network calls in tests use an injectable fetcher, never the real network.** Every function in `server/srd-manifest-discovery.ts` accepts a `fetchImpl` parameter defaulting to the real global `fetch`.

## Fetch Strategy Verification (performed while writing this revision — read before Task 7)

The prior revision flagged that `WebFetch` returned HTTP 403 against every `d20srd.org` URL, and this revision's correction explicitly requires verifying the actual production fetch strategy before locking in a mandatory acceptance gate around it. Tested directly, from this environment, using the exact API the pipeline will use:

```
$ curl -sS -o /dev/null -w "HTTP %{http_code}\n" "https://www.d20srd.org/index.htm"
HTTP 200
$ node -e "fetch('https://www.d20srd.org/index.htm').then(r => console.log('status:', r.status))"
status: 200
```

Node's built-in `fetch()` — the literal function `server/srd-manifest-discovery.ts` calls — succeeds with a real `200` and real content (confirmed the response body contains the expected `/indexes/feats.htm` link). `WebFetch`'s 403 was specific to that tool's own client signature, not a general block on automated non-browser requests. **This does not guarantee the VPS's production network will see the same result** — different IP, different datacenter, possibly different treatment by any bot-protection `d20srd.org` runs. Task 9 (the mandatory real run) must re-confirm connectivity from wherever it actually executes before treating a wave of failures as a real coverage gap rather than a network-strategy problem; `recordSrdManifestDiscoveryFailure`'s existing loud-failure design (Task 3) is the safety net either way — a blocked fetch becomes a logged failure with a real error message, never a silent gap.

## Real Source Structure (verified 2026-08-22 — read before Task 5)

### Source 1: the original Wizards 3.5e SRD (authoritative, no live fetchable URL of its own)

Registered as a citation/identity `rule_sources` row. Wizards no longer hosts the 3.5e SRD at a single canonical live URL; both transports below are independently-maintained derivations of it.

### Source 2: `github.com/olimot/srd-v3.5` — GitHub-hosted HTML mirror, pinned commit `faab739130921026db42b96e6adff6d3661bffbd`

Verified directly via the GitHub API at that exact commit: **106 total tree entries, not truncated, 99 `.html` files**, one HTML file at repo root (`index.html`, administrative), the rest under 7 directories: `basic-rules-and-legal/`, `divine/`, `epic/`, `magic-items/`, `monsters/`, `psionics/`, `spells/`.

**A discrepancy that directly justifies this plan's "generated, not hand-transcribed" constraint:** two independent manual research passes performed while writing the prior revision produced *different* per-directory counts for the same pinned commit (`basic-rules-and-legal`: 22 vs. 24; `monsters`: 18 vs. 19; `epic`: 11 vs. 10; `spells`: 12 vs. 11). Task 5's real script, parsing the raw tree API response with no summarization step in between, resolves this. `legal-information.html` is the one deliberate exclusion.

**Coverage this source provides:** core, epic, psionics, divine. **Zero Unearthed Arcana Variant Rules content.**

### Source 3: `d20srd.org` — the Hypertext d20 SRD (live website; 44 real discovery roots, not 40; the source that covers Variant Rules)

`WebFetch` returned HTTP 403 for every URL on this domain; verified instead via the Claude Browser tool (a real browser). Its front page states it is "The Hypertext d20 SRD (v3.5 d20 System Reference Document)," run by BoLS Interactive LLC, with a documented "Changes from the Official d20 SRD" page (`/changes.htm`) — self-documented as a derivation with tracked deltas, matching this plan's "documented errata/update integration" requirement.

**A second real counting correction, on top of olimot's:** the prior revision counted "40 real index pages." Recounting the same real navigation directly (Core Rules 22 + Epic 6 + Psionic 7 + Divine 3 + Variant 6 = **44**) shows the true count is 44, not 40 — a hand-tally error in the *previous revision of this very plan*, caught only by recounting rather than trusting the earlier prose. This is now the second independent demonstration (after olimot's directory-count discrepancy) that a manually-stated number in this document needs a generation/verification step before it can be trusted, and is exactly why Task 6's leaf-page list is generated by a script, not hand-extended from this section's prose.

The 44 real roots, organized into five sections:

```
Core Rules (22)         /indexes/basicsRacesDescription.htm, classes.htm, skills.htm, feats.htm,
                         magicItems.htm, equipment.htm, combat.htm, conditions.htm,
                         specialAbilities.htm, magicOverview.htm, spellLists.htm, spells.htm,
                         monsters.htm, typesSubtypes.htm, improvingMonsters.htm, monsterFeats.htm,
                         monstersAsRaces.htm, carryingMovementExploration.htm,
                         wildernessWeatherEnvironment.htm, traps.htm, treasure.htm, planes.htm
Epic Rules (6)           epicBasicsAndClasses.htm, epicSkills.htm, epicFeats.htm, epicSpells.htm,
                         epicMagicItems.htm, epicMonstersAndObstacles.htm
Psionic Rules (7)        psionicRacesClassesSkillsSpells.htm, psionicFeats.htm,
                         psionicPowersOverview.htm, psionicPowerList.htm, psionicPowers.htm,
                         psionicItems.htm, psionicMonsters.htm
Divine Rules (3)         divineRanksPowers.htm, divineAbilitiesFeats.htm, divineMinionsDomainsSpells.htm
Variant Rules (6)        "open content from Unearthed Arcana" — variantRaces.htm, variantClasses.htm,
                         variantBuildingCharacters.htm, variantAdventuring.htm, variantMagic.htm,
                         variantCampaigns.htm
```

(All under `/indexes/*.htm`; the full, exact list with real hrefs is reproduced verbatim in Task 6.)

**These are discovery roots, not the corpus.** Real sample crawls performed while writing this revision (fetching each root, extracting every `href`, normalizing away URL fragments, counting unique real leaf pages) found genuinely different structures per root — some collapse to a single real content page via same-page anchors (`feats.htm`'s ~280 `href`s are all `#fragment` links into the one page `/srd/feats.htm`), others link to hundreds of genuinely distinct pages (`spells.htm` → **608** distinct `/srd/spells/*.htm` pages; `monsters.htm` → **249**; `psionicPowers.htm` → **287**; `epicSpells.htm` → **74**; `epicMonstersAndObstacles.htm` → **41**; `classes.htm` → **32**). Summing real counts across all 44 roots: **≈1,560 real leaf pages** — the actual size of "ALL rules-bearing d20srd.org material" at this discovery granularity. This is real, sampled, verified data, not an estimate from folder inspection — see Task 6 for the full per-root breakdown and the generation script that turns it into a committed artifact.

**`d20srd.org` has no git-equivalent immutable pin.** Its "revision" is the documented scan timestamp plus per-page content-hash change detection on every future re-scan.

## Resolved Design Decisions (stated explicitly per the plan's own instructions and both rounds of correction)

**1. Provenance vs. transport are three separate `rule_sources` rows, linked by a new `derivedFromSourceId` column.** Unchanged from the prior revision.

**2. "ALL" means both sources, exhaustively discovered, not root-level sampled.** Corpus-area coverage after this plan: core (both sources), epic (both), psionics (both), divine (both), Unearthed Arcana Variant Rules (`d20srd.org` only). The correction in this revision: `d20srd.org`'s coverage is now its real ~1,560 leaf pages reachable from the 44 roots, not the 44 roots themselves — closing the gap between "we know the topic areas exist" and "we discovered every real page in them."

**3. `sourcePageKey`, not a canonical ID.** Unchanged from the prior revision — still applies identically to leaf pages discovered via the new crawl step.

**4. `PageProcessingStatus`, not `IngestionStatus`.** Unchanged.

**5. Coverage reports are scope-labeled, structurally.** Unchanged.

**6. `srd_source_page_revisions`, not `canonical_revisions`.** Unchanged.

**7. Both fetched sources get real, generated (not hand-maintained) leaf-page manifests.** Extended in this revision: olimot's generation script (Task 5) is unchanged in shape; `d20srd.org` now also gets a real generation script (Task 6) rather than a hand-written list — because this revision's own research demonstrated a second hand-counting error (44 vs. the prior "40"), the same "generate, don't transcribe" discipline now applies to both sources consistently, not just the one with a convenient tree API.

**8. Task 9 (the real network run) is mandatory for Phase 2A completion**, producing the literal evidence format: *discovered N source pages → accounted for N → fetch failures X → changed X → duplicates X* — now with N in the low thousands, reflecting real leaf-page discovery.

**9. Leaf pages preserve a pointer back to their discovery root.** `srd_manifest_entries.discoveredFromPath` (nullable — set for every `d20srd.org` leaf page discovered via link extraction, null for olimot's directly-enumerated pages, which have no crawl-root concept) records which of the 44 real index pages a leaf was found from, for auditability — not a many-to-many relationship (a page found via more than one root in this phase simply records its first-seen root; re-establishing full multi-root provenance is a reasonable Phase 2B refinement if it ever matters, not required here).

**10. Every real link extracted from every real crawled root is accounted for — included with a corpus area, or excluded with a real reason.** No link is silently dropped. `classifyD20srdLink()` (Task 5) returns one of exactly those two outcomes for every input, and Task 5's tests assert this against the complete real `href` list from a real captured root page, not a curated subset.

## File Structure

```
shared/rules-registry/
  sources.ts                    Modified: adds derivedFromSourceId, pinnedRevision columns to
                                 ruleSources; CreateRuleSourceInput gains matching optional fields
                                 (Task 1).
  srd-manifest.ts                New: CorpusArea vocabulary, PageProcessingStatus vocabulary,
                                 srdManifestEntries table (sourcePageKey + discoveredFromPath, not
                                 canonicalId), srdSourcePageRevisions table,
                                 isValidSourcePageVerification(), buildSourcePageKey() (Task 2).
  srd-manifest.test.ts            Unit tests for the pure helpers (Task 2).

server/storage.ts                Modified: runMigrations() gains the new columns + 2 new tables;
                                 IStorage/DatabaseStorage gain recordRuleSourceVerification (Task 1),
                                 full srd_manifest_entries + srd_source_page_revisions CRUD (Task 3),
                                 getSourcePageCoverageReport/findDuplicateSourcePages (Task 4),
                                 recordSourcePageVerification (Task 8).

server/srd-link-extraction.ts                       New: extractLinks()/classifyD20srdLink() — pure,
                                                      tested against real captured href data, no
                                                      network (Task 5).
server/srd-link-extraction.test.ts                  New: tests proving every real link from a real
                                                      captured root is included-with-area or
                                                      excluded-with-reason (Task 5).

server/srd-manifest-snapshot-olimot.generated.ts    New: generated frozen leaf-page list for the
                                                      pinned olimot commit (Task 6).
scripts/generate-olimot-srd-snapshot.ts             New: generation script, real network call
                                                      against the pinned tree API (Task 6).
server/srd-manifest-roots-d20srd.ts                 New: the 44 real, hand-verified discovery-root
                                                      paths for d20srd.org (Task 6).
server/srd-manifest-snapshot-d20srd.generated.ts    New: generated frozen leaf-page list for
                                                      d20srd.org, produced by crawling the 44 roots
                                                      and running Task 5's classifier (Task 6).
scripts/generate-d20srd-srd-snapshot.ts             New: generation script — fetches the 44 roots
                                                      only (not the ~1,560 leaves), extracts+
                                                      classifies+dedupes their real links (Task 6).
server/srd-manifest-snapshot.test.ts                New: sanity tests on both generated snapshots
                                                      (Task 6).

server/srd-manifest-discovery.ts                    New: discoverSourcePage()/runSrdManifestDiscovery()
                                                      for both sources' full leaf-page lists,
                                                      injectable fetcher, loud failures, concurrency
                                                      cap for the d20srd.org leg, srd_source_page_
                                                      revisions wiring (Task 7).

server/rules-registry.test.ts                       Modified: Task 1's recordRuleSourceVerification
                                                       tests appended to the existing Phase 0/1 file.
server/srd-manifest-storage.test.ts                 New: CRUD + coverage-report + duplicate-detection
                                                       tests (Tasks 3-4).
server/srd-manifest-discovery.test.ts               New: discovery pipeline tests against injected
                                                       fake fetchers for both sources (Task 7).
server/srd-manifest-lifecycle.test.ts               New: the sample discovered->fetched->hashed->
                                                       parsed->source_verified progression proof,
                                                       wired through srd_source_page_revisions (Task 8).

docs/superpowers/notes/2026-08-22-srd-provenance-registration.md   New: Task 1's real registered rows.
docs/superpowers/notes/2026-08-22-srd-manifest-acceptance-report.md   New: Task 9's real run evidence,
                                                                        the literal N/X/X/X format,
                                                                        with real leaf-page counts.
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
  discovered_from_path TEXT,
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
    discoveredFromPath: input.discoveredFromPath ?? null,
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
      discoveredFromPath: input.discoveredFromPath ?? null,
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

### Task 5: Link extraction and classification module (pure, no network)

**Files:**
- Create: `server/srd-link-extraction.ts`
- Create: `server/srd-link-extraction.test.ts`

**Interfaces:**
- Consumes: `CorpusArea` (Task 2).
- Produces: `extractLinks(html: string): string[]` (every raw `href` attribute value found in a fetched page), `classifyD20srdLink(rawHref: string, baseUrl: string, discoveryRootCorpusArea: CorpusArea): {included: true; url: string; corpusArea: CorpusArea} | {included: false; reason: string}`.

**Expected behavior:** `classifyD20srdLink` returns exactly one of the two outcomes for every possible input — never throws, never silently returns `undefined`. `included: true` only for a same-host (`d20srd.org`/`www.d20srd.org`) `.htm`/`.html` path under `/srd/` or `/indexes/`, with the URL fragment (`#...`) stripped so anchor-only links collapse to their real page. Every real exclusion category found while researching this plan gets a real, specific reason string: `javascript:` pseudo-links, bare `#` fragments, external hosts (including `5e.d20srd.org` — same family, **wrong ruleset**), site tooling (`/styles/`, `/extras/`, `/d20/`, `/fantasy/`), and administrative/legal pages (`/`, `/index.htm`, `/about.htm`, `/faq.htm`, `/changes.htm`, `/ogl.htm`, `/landing.php`). `corpusArea` for an included link is inherited directly from the discovery root that linked to it — the classifier does not independently re-guess a leaf page's topic from its URL shape.

**Migration risk:** None — pure functions, no DB, no network.

**Rollback consideration:** None; nothing outside this file and its own test consumes these exports until Task 6.

- [ ] **Step 1: Write `server/srd-link-extraction.ts`**

```ts
// server/srd-link-extraction.ts
//
// Pure link extraction and classification for d20srd.org's discovery-root
// crawl (Phase 2A, corrected per review: the 44 index pages are crawl
// roots, not the manifest itself). No network call in this file — it
// operates on already-fetched HTML strings, so it is fully unit-testable
// against real captured href data with zero network dependency.

import type { CorpusArea } from "@shared/rules-registry/srd-manifest";

const HREF_PATTERN = /href\s*=\s*["']([^"']+)["']/gi;

export function extractLinks(html: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(HREF_PATTERN);
  while ((match = pattern.exec(html)) !== null) {
    links.push(match[1]);
  }
  return links;
}

const ALLOWED_HOSTS = new Set(["www.d20srd.org", "d20srd.org"]);

const EXCLUDED_EXACT_PATHS = new Set([
  "/", "/index.htm", "/about.htm", "/faq.htm", "/changes.htm", "/ogl.htm", "/landing.php",
]);

const EXCLUDED_PATH_PREFIXES = ["/styles/", "/extras/", "/d20/", "/fantasy/"];

export function classifyD20srdLink(
  rawHref: string,
  baseUrl: string,
  discoveryRootCorpusArea: CorpusArea,
): { included: true; url: string; corpusArea: CorpusArea } | { included: false; reason: string } {
  if (rawHref.startsWith("javascript:")) {
    return { included: false, reason: "javascript pseudo-link" };
  }
  if (rawHref === "#" || rawHref.startsWith("#")) {
    return { included: false, reason: "bare fragment / same-page anchor with no page path" };
  }

  let url: URL;
  try {
    url = new URL(rawHref, baseUrl);
  } catch {
    return { included: false, reason: "unparseable URL" };
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return { included: false, reason: `external host (${url.hostname}), not d20srd.org — includes wrong-ruleset subdomains like 5e.d20srd.org` };
  }

  const path = url.pathname;

  if (EXCLUDED_EXACT_PATHS.has(path)) {
    return { included: false, reason: "site administrative/legal page" };
  }
  if (EXCLUDED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return { included: false, reason: "site tooling/generator/asset path" };
  }
  if (!path.startsWith("/srd/") && !path.startsWith("/indexes/")) {
    return { included: false, reason: "outside the /srd/ and /indexes/ rules-content namespaces" };
  }
  if (!path.endsWith(".htm") && !path.endsWith(".html")) {
    return { included: false, reason: "not an HTML page" };
  }

  return { included: true, url: `${url.origin}${path}`, corpusArea: discoveryRootCorpusArea };
}
```

- [ ] **Step 2: Write `server/srd-link-extraction.test.ts`, against real captured href data**

The `href` list below is real — a compact fixture built from the exact hrefs found when fetching `https://www.d20srd.org/indexes/feats.htm` directly (`node -e "fetch(...).then(...)"`) while researching this revision, trimmed to one representative example per real exclusion category plus real rules-bearing links, not synthesized:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLinks, classifyD20srdLink } from "./srd-link-extraction";

const BASE_URL = "https://www.d20srd.org/indexes/feats.htm";

// Real hrefs captured from the live page during planning (2026-08-22),
// one representative per category actually observed, not invented:
const REAL_FEATS_PAGE_FIXTURE_HTML = `
<link rel="stylesheet" href="/styles/index.css">
<a href="/index.htm">Home</a>
<a href="#">menu</a>
<a href="javascript:void(0);">toggle</a>
<a href="http://www.lounge.belloflostsouls.net/forumdisplay.php?175">Forum</a>
<a href="/about.htm">About</a>
<a href="/faq.htm">FAQ</a>
<a href="/changes.htm">Changes</a>
<a href="/extras/d20dicebag">Dice Bag</a>
<a href="/d20/random/">Generator</a>
<a href="/fantasy/name/">Name Gen</a>
<a href="http://5e.d20srd.org">5e SRD</a>
<a href="https://www.facebook.com/d20srd/">Facebook</a>
<a href="/srd/feats.htm#acrobatic">Acrobatic</a>
<a href="/srd/feats.htm#agile">Agile</a>
<a href="/srd/feats.htm#dodge">Dodge</a>
<a href="/indexes/skills.htm">Skills index</a>
`;

test("extractLinks pulls every href out of a real captured page fixture", () => {
  const links = extractLinks(REAL_FEATS_PAGE_FIXTURE_HTML);
  assert.equal(links.length, 16);
});

test("every real extracted link is either included with a corpus area, or excluded with a real reason — none silently dropped", () => {
  const links = extractLinks(REAL_FEATS_PAGE_FIXTURE_HTML);
  for (const href of links) {
    const result = classifyD20srdLink(href, BASE_URL, "feats");
    assert.ok(
      result.included === true || (result.included === false && typeof result.reason === "string" && result.reason.length > 0),
      `link "${href}" must be classified with a real reason, not silently unaccounted for`,
    );
  }
});

test("real anchor-only feats links collapse to the one real leaf page after fragment stripping", () => {
  const results = ["/srd/feats.htm#acrobatic", "/srd/feats.htm#agile", "/srd/feats.htm#dodge"]
    .map((href) => classifyD20srdLink(href, BASE_URL, "feats"));
  for (const r of results) {
    assert.equal(r.included, true);
    if (r.included) assert.equal(r.url, "https://www.d20srd.org/srd/feats.htm");
  }
});

test("a real index-page cross-link is included and inherits the calling root's corpus area, not a re-guessed one", () => {
  const result = classifyD20srdLink("/indexes/skills.htm", BASE_URL, "feats");
  assert.equal(result.included, true);
  if (result.included) assert.equal(result.corpusArea, "feats", "corpusArea is inherited from the discovery root, not re-derived from the linked path");
});

test("5e.d20srd.org is excluded as wrong-ruleset, not silently treated as same-family content", () => {
  const result = classifyD20srdLink("http://5e.d20srd.org", BASE_URL, "feats");
  assert.equal(result.included, false);
  if (!result.included) assert.match(result.reason, /5e\.d20srd\.org/);
});

test("real site-tooling and administrative links are excluded with distinct, real reasons", () => {
  const cases: Array<[string, RegExp]> = [
    ["/styles/index.css", /tooling|asset/],
    ["/about.htm", /administrative/],
    ["/faq.htm", /administrative/],
    ["/extras/d20dicebag", /tooling/],
    ["/d20/random/", /tooling/],
    ["/fantasy/name/", /tooling/],
    ["javascript:void(0);", /javascript/],
    ["#", /fragment/],
  ];
  for (const [href, reasonPattern] of cases) {
    const result = classifyD20srdLink(href, BASE_URL, "feats");
    assert.equal(result.included, false, `"${href}" must be excluded`);
    if (!result.included) assert.match(result.reason, reasonPattern, `"${href}"'s exclusion reason must be specific`);
  }
});

test("external non-d20srd hosts (forum, facebook) are excluded as external, not silently included", () => {
  for (const href of ["http://www.lounge.belloflostsouls.net/forumdisplay.php?175", "https://www.facebook.com/d20srd/"]) {
    const result = classifyD20srdLink(href, BASE_URL, "feats");
    assert.equal(result.included, false);
    if (!result.included) assert.match(result.reason, /external host/);
  }
});
```

- [ ] **Step 3: Run the tests**

Run: `node --import tsx --test server/srd-link-extraction.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 4: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add server/srd-link-extraction.ts server/srd-link-extraction.test.ts
git commit -m "feat: add d20srd.org link extraction/classification (real fixture-tested, every link included-or-excluded-with-reason)"
```

**Independent verification before Task 6 begins:** re-run tests fresh; manually re-fetch `https://www.d20srd.org/indexes/feats.htm` for real (`node -e "fetch(...)..."`) and confirm the fixture's 16-link sample is still representative of the real page's actual structure — a live spot-check that the fixture wasnraft from real data, not invented after the fact.

---

### Task 6: Generated frozen leaf-page manifests for both sources

**Files:**
- Create: `scripts/generate-olimot-srd-snapshot.ts`
- Create: `server/srd-manifest-snapshot-olimot.generated.ts` (output of the script above, committed)
- Create: `server/srd-manifest-roots-d20srd.ts` (the 44 real, hand-verified discovery roots)
- Create: `scripts/generate-d20srd-srd-snapshot.ts`
- Create: `server/srd-manifest-snapshot-d20srd.generated.ts` (output of the script above, committed)
- Create: `server/srd-manifest-snapshot.test.ts`

**Interfaces:**
- Consumes: `extractLinks`, `classifyD20srdLink` (Task 5), `CorpusArea` (Task 2).
- Produces: `SRD_MANIFEST_SOURCE_OLIMOT: Array<{ corpusArea: CorpusArea; sourcePath: string }>` (generated, unchanged mechanism from the prior revision), `SRD_MANIFEST_ROOTS_D20SRD: Array<{ corpusArea: CorpusArea; sourcePath: string }>` (the 44 real roots, hand-verified — this is the one list in this plan that cannot be generated, since no tree API exists for a live website), `SRD_MANIFEST_SOURCE_D20SRD: Array<{ corpusArea: CorpusArea; sourcePath: string; discoveredFromPath: string }>` (generated by crawling the 44 roots and classifying their real links — this is the ~1,560-entry leaf-page list, consumed by Task 7).

**Expected behavior:** `scripts/generate-olimot-srd-snapshot.ts` is a real, re-runnable script — not a one-off shell command — that fetches `https://api.github.com/repos/olimot/srd-v3.5/git/trees/faab739130921026db42b96e6adff6d3661bffbd?recursive=1` directly, parses the raw JSON response programmatically (no summarizing intermediary), filters to `.html` paths under the 7 known directories, excludes `legal-information.html` and the root `index.html` explicitly by name, infers each entry's `CorpusArea` via a lookup table keyed by filename (a page's *directory* alone is insufficient, since `basic-rules-and-legal/` mixes core/feats/classes/races/skills/etc.), and writes the resulting array as literal TypeScript into `server/srd-manifest-snapshot-olimot.generated.ts`. Running the script twice against the same pinned SHA must produce byte-identical output.

`server/srd-manifest-roots-d20srd.ts` is hand-written — the one list in this plan that is, because no tree API exists for a live website to generate it from. It is the 44 real index-page root paths (corrected count — the prior revision said 40; recounting the real navigation directly gives 44, documented in "Real Source Structure" above), verified via the Claude Browser tool.

`scripts/generate-d20srd-srd-snapshot.ts` is a real, re-runnable script that fetches **only the 44 real roots** (not the ~1,560 leaves), extracts every real `href` from each via Task 5's `extractLinks`, classifies each via Task 5's `classifyD20srdLink` (inheriting that root's own `corpusArea`), globally deduplicates by normalized URL (keeping the first root a page was seen from as its `discoveredFromPath`), and writes the resulting leaf-page list to `server/srd-manifest-snapshot-d20srd.generated.ts`. This is the real generation step that replaces the prior revision's hand-written 40/44-entry list with the actual, exhaustive, generated leaf-page corpus.

**Migration risk:** None — no schema, no DB.

**Rollback consideration:** All files are pure data or a pure generation script; regenerating or correcting any of them has no effect on Tasks 1-4's already-migrated schema.

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

- [ ] **Step 3: Write `server/srd-manifest-roots-d20srd.ts`, the 44 real, hand-verified discovery roots**

```ts
// server/srd-manifest-roots-d20srd.ts
//
// The 44 real d20srd.org discovery ROOTS — not the corpus itself. Verified
// via the Claude Browser tool against the live site on 2026-08-22 (WebFetch
// returned HTTP 403 for every URL on this domain). This is the one list in
// this plan that is necessarily hand-verified rather than generated, since
// no tree API exists for a live website's site map. The prior revision of
// this plan miscounted this same real navigation as 40 — recounting it
// directly here gives the correct 44, the second real hand-count error this
// plan has now caught and corrected on its own (the first was olimot's
// directory counts). scripts/generate-d20srd-srd-snapshot.ts crawls exactly
// these 44 roots to generate the real leaf-page manifest (Step 4 below).

import type { CorpusArea } from "@shared/rules-registry/srd-manifest";

export const SRD_MANIFEST_ROOTS_D20SRD: Array<{ corpusArea: CorpusArea; sourcePath: string }> = [
  // Core Rules (22)
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

  // Epic Rules (6)
  { corpusArea: "epic", sourcePath: "/indexes/epicBasicsAndClasses.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicSkills.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicFeats.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicSpells.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicMagicItems.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicMonstersAndObstacles.htm" },

  // Psionic Rules (7)
  { corpusArea: "psionics", sourcePath: "/indexes/psionicRacesClassesSkillsSpells.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicFeats.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicPowersOverview.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicPowerList.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicPowers.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicItems.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicMonsters.htm" },

  // Divine Rules (3)
  { corpusArea: "divine", sourcePath: "/indexes/divineRanksPowers.htm" },
  { corpusArea: "divine", sourcePath: "/indexes/divineAbilitiesFeats.htm" },
  { corpusArea: "divine", sourcePath: "/indexes/divineMinionsDomainsSpells.htm" },

  // Variant Rules (6) — "open content from Unearthed Arcana". The one
  // corpus area olimot/srd-v3.5 has zero coverage of.
  { corpusArea: "open-variants", sourcePath: "/indexes/variantRaces.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantClasses.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantBuildingCharacters.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantAdventuring.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantMagic.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantCampaigns.htm" },
];
```

- [ ] **Step 4: Write `scripts/generate-d20srd-srd-snapshot.ts`, crawling exactly the 44 real roots**

```ts
// scripts/generate-d20srd-srd-snapshot.ts
//
// Generates server/srd-manifest-snapshot-d20srd.generated.ts by fetching
// ONLY the 44 real roots in server/srd-manifest-roots-d20srd.ts (not the
// ~1,560 real leaves those roots link to — that fetch is Task 7's job),
// extracting and classifying every real link via server/srd-link-extraction.ts,
// and deduplicating globally by normalized URL. This is the real, generated
// leaf-page corpus for d20srd.org — replacing the prior revision's
// treatment of the 44 roots as the corpus itself.
//
// Re-run with: node --import tsx scripts/generate-d20srd-srd-snapshot.ts

import { extractLinks, classifyD20srdLink } from "../server/srd-link-extraction";
import { SRD_MANIFEST_ROOTS_D20SRD } from "../server/srd-manifest-roots-d20srd";

const BASE_URL = "https://www.d20srd.org";

async function main() {
  const seen = new Map<string, { corpusArea: string; sourcePath: string; discoveredFromPath: string }>();
  let totalLinksExamined = 0;
  let totalExcluded = 0;

  for (const root of SRD_MANIFEST_ROOTS_D20SRD) {
    const rootUrl = `${BASE_URL}${root.sourcePath}`;
    const res = await fetch(rootUrl);
    if (!res.ok) throw new Error(`Failed to fetch root ${rootUrl}: HTTP ${res.status}`);
    const html = await res.text();
    const links = extractLinks(html);
    totalLinksExamined += links.length;

    for (const href of links) {
      const result = classifyD20srdLink(href, rootUrl, root.corpusArea);
      if (!result.included) {
        totalExcluded++;
        continue;
      }
      const path = new URL(result.url).pathname;
      if (!seen.has(path)) {
        seen.set(path, { corpusArea: result.corpusArea, sourcePath: path, discoveredFromPath: root.sourcePath });
      }
    }
  }

  const entries = Array.from(seen.values()).sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  const output = `// GENERATED FILE — produced by scripts/generate-d20srd-srd-snapshot.ts
// by crawling the 44 real roots in server/srd-manifest-roots-d20srd.ts and
// classifying their real links via server/srd-link-extraction.ts. Do not
// hand-edit; re-run the script. Real generation run: ${totalLinksExamined}
// total links examined across 44 roots, ${totalExcluded} excluded (site
// furniture/admin/external/wrong-ruleset), ${entries.length} real rules-bearing
// leaf pages remain after global deduplication.

import type { CorpusArea } from "@shared/rules-registry/srd-manifest";

export const SRD_MANIFEST_SOURCE_D20SRD: Array<{ corpusArea: CorpusArea; sourcePath: string; discoveredFromPath: string }> = ${JSON.stringify(entries, null, 2)};
`;

  const fs = await import("node:fs");
  fs.writeFileSync("server/srd-manifest-snapshot-d20srd.generated.ts", output);
  console.log(`Examined ${totalLinksExamined} links across 44 roots, excluded ${totalExcluded}, wrote ${entries.length} real leaf pages to server/srd-manifest-snapshot-d20srd.generated.ts`);
}

main();
```

Run it for real: `node --import tsx scripts/generate-d20srd-srd-snapshot.ts`. Cross-check the real output count against this plan's "Real Source Structure" section's real per-root sample counts (spells: 608, monsters: 249, psionic powers: 287, epic spells: 74, epic monsters: 41, classes: 32, etc. — summing to roughly 1,560 before global dedup, so the real generated count should land in that neighborhood; if it's wildly different, investigate before committing rather than accepting either number blindly, same discipline as olimot's Step 2).

- [ ] **Step 5: Write `server/srd-manifest-snapshot.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SRD_MANIFEST_SOURCE_OLIMOT } from "./srd-manifest-snapshot-olimot.generated";
import { SRD_MANIFEST_ROOTS_D20SRD } from "./srd-manifest-roots-d20srd";
import { SRD_MANIFEST_SOURCE_D20SRD } from "./srd-manifest-snapshot-d20srd.generated";

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

test("SRD_MANIFEST_ROOTS_D20SRD has exactly 44 real roots", () => {
  assert.equal(SRD_MANIFEST_ROOTS_D20SRD.length, 44);
});

test("SRD_MANIFEST_ROOTS_D20SRD has exactly 6 open-variants roots — the Unearthed Arcana Variant Rules section", () => {
  assert.equal(SRD_MANIFEST_ROOTS_D20SRD.filter((e) => e.corpusArea === "open-variants").length, 6);
});

test("SRD_MANIFEST_SOURCE_D20SRD's generated leaf-page count is genuinely exhaustive, not root-level (must be much larger than 44)", () => {
  assert.ok(
    SRD_MANIFEST_SOURCE_D20SRD.length > 500,
    `expected the real generated crawl to find hundreds of real leaf pages (spells alone yields 608), got ${SRD_MANIFEST_SOURCE_D20SRD.length}`,
  );
});

test("SRD_MANIFEST_SOURCE_D20SRD has real open-variants leaf pages, not just the 6 root index pages", () => {
  const variantLeaves = SRD_MANIFEST_SOURCE_D20SRD.filter((e) => e.corpusArea === "open-variants");
  assert.ok(variantLeaves.length >= 6, "the real Variant Rules leaf pages (e.g. /srd/variant/classes/*.htm) must be discovered, not just their 6 index roots");
});

test("every d20srd leaf entry records a real discoveredFromPath that is one of the 44 real roots", () => {
  const rootPaths = new Set(SRD_MANIFEST_ROOTS_D20SRD.map((r) => r.sourcePath));
  for (const entry of SRD_MANIFEST_SOURCE_D20SRD) {
    assert.ok(rootPaths.has(entry.discoveredFromPath), `"${entry.sourcePath}"'s discoveredFromPath "${entry.discoveredFromPath}" must be a real root`);
  }
});

test("every entry across all three lists has a real corpus area", () => {
  for (const entry of [...SRD_MANIFEST_SOURCE_OLIMOT, ...SRD_MANIFEST_ROOTS_D20SRD, ...SRD_MANIFEST_SOURCE_D20SRD]) {
    assert.ok(VALID_AREAS.has(entry.corpusArea), `"${entry.corpusArea}" (${entry.sourcePath}) must be a real corpus area`);
  }
});

test("no sourcePath is duplicated within any single list", () => {
  for (const list of [SRD_MANIFEST_SOURCE_OLIMOT, SRD_MANIFEST_ROOTS_D20SRD, SRD_MANIFEST_SOURCE_D20SRD]) {
    const paths = list.map((e) => e.sourcePath);
    assert.equal(new Set(paths).size, paths.length, "a generated list must have no internal duplicate paths");
  }
});
```

- [ ] **Step 6: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/srd-manifest-snapshot.test.ts` — expect 10/10.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-olimot-srd-snapshot.ts server/srd-manifest-snapshot-olimot.generated.ts server/srd-manifest-roots-d20srd.ts scripts/generate-d20srd-srd-snapshot.ts server/srd-manifest-snapshot-d20srd.generated.ts server/srd-manifest-snapshot.test.ts
git commit -m "feat: generate frozen leaf-page manifests for both sources (olimot from pinned tree, d20srd.org from a real 44-root crawl)"
```

**Independent verification before Task 7 begins:** re-run tests fresh; re-run both generation scripts a second time and diff their output against the committed files (olimot must be byte-identical, since the commit is immutable; d20srd.org's re-crawl may legitimately differ slightly if the live site changed between runs — investigate any difference rather than assuming either run is wrong); manually cross-check 5 random entries from `SRD_MANIFEST_SOURCE_D20SRD` against their `discoveredFromPath` by re-fetching that real root and confirming the leaf page's real href genuinely appears there.

---

### Task 7: Discovery/fetch pipeline for both sources' full leaf-page lists

**Files:**
- Create: `server/srd-manifest-discovery.ts`
- Create: `server/srd-manifest-discovery.test.ts`

**Interfaces:**
- Consumes: `SRD_MANIFEST_SOURCE_OLIMOT` (Task 6, ~97 entries), `SRD_MANIFEST_SOURCE_D20SRD` (Task 6, the real generated leaf-page list, ~1,560 entries, each carrying `discoveredFromPath`), `storage.upsertSrdManifestEntry`, `storage.recordSrdManifestDiscoveryFailure` (Task 3).
- Produces: `discoverSourcePage(sourceId: number, baseUrl: string, entry: {corpusArea, sourcePath, discoveredFromPath?}, fetchImpl?): Promise<SrdManifestEntry>`, `runSrdManifestDiscovery(sources: Array<{sourceId: number; baseUrl: string; entries: Array<{corpusArea, sourcePath, discoveredFromPath?}>; concurrency?: number}>, fetchImpl?): Promise<{succeeded: number; failed: number}>`.

**Expected behavior:** `discoverSourcePage` builds the real fetch URL as `${baseUrl}${entry.sourcePath}`, fetches via `fetchImpl`, hashes on success via `upsertSrdManifestEntry` (passing through `discoveredFromPath` when present), and calls `recordSrdManifestDiscoveryFailure` on any non-OK response or thrown error — never propagating the failure to abort sibling pages. `runSrdManifestDiscovery` accepts a list of `{sourceId, baseUrl, entries, concurrency?}` groups (one per real source) so both olimot's ~97 and `d20srd.org`'s ~1,560 real leaf pages run through the exact same pipeline code. **`concurrency` caps how many in-flight fetches a single source group runs at once** (default 5) — a real, considerate-citizen requirement given `d20srd.org`'s real scale is now ~1,560 pages against a small, non-CDN-fronted, volunteer-run site; olimot (jsDelivr, a real CDN built for exactly this kind of traffic) can reasonably use a higher default if desired, but this plan keeps both at the same conservative default rather than special-casing one source's politeness.

**Migration risk:** None.

**Rollback consideration:** No callers outside its own tests until Task 9.

- [ ] **Step 1: Write `server/srd-manifest-discovery.ts`**

```ts
// server/srd-manifest-discovery.ts
//
// Fetches both pinned SRD source transports' full real leaf-page lists,
// hashes content, and persists via server/storage.ts's page-scoped CRUD
// (Task 3) — never canonical entity tables, never canonical-id.ts, never
// IngestionStatus. Concurrency-capped per source group: d20srd.org's real
// scale (~1,560 leaf pages) makes an unbounded Promise.allSettled over
// every entry inconsiderate against a small, volunteer-run site.

import { createHash } from "crypto";
import { storage } from "./storage";
import type { CorpusArea, SrdManifestEntry } from "@shared/rules-registry/srd-manifest";

export async function discoverSourcePage(
  sourceId: number,
  baseUrl: string,
  entry: { corpusArea: CorpusArea; sourcePath: string; discoveredFromPath?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SrdManifestEntry> {
  const sourceUrl = `${baseUrl}${entry.sourcePath}`;
  try {
    const res = await fetchImpl(sourceUrl);
    if (!res.ok) {
      return storage.recordSrdManifestDiscoveryFailure(
        { sourceId, corpusArea: entry.corpusArea, sourceUrl, sourcePath: entry.sourcePath, discoveredFromPath: entry.discoveredFromPath },
        `HTTP ${res.status}`,
      );
    }
    const text = await res.text();
    const contentHash = createHash("sha256").update(text).digest("hex");
    const result = storage.upsertSrdManifestEntry({
      sourceId, corpusArea: entry.corpusArea, sourceUrl, sourcePath: entry.sourcePath,
      discoveredFromPath: entry.discoveredFromPath, contentHash,
    });
    storage.updateSrdManifestEntryProcessingStatus(result.sourcePageKey, "hashed");
    return storage.getSrdManifestEntry(result.sourcePageKey)!;
  } catch (err) {
    return storage.recordSrdManifestDiscoveryFailure(
      { sourceId, corpusArea: entry.corpusArea, sourceUrl, sourcePath: entry.sourcePath, discoveredFromPath: entry.discoveredFromPath },
      err instanceof Error ? err.message : String(err),
    );
  }
}

// Simple fixed-window concurrency limiter — no new dependency. Runs `items`
// through `worker` with at most `limit` in flight at once, preserving
// per-item error isolation (a rejected worker call still resolves via
// discoverSourcePage's own try/catch, so this never needs its own
// try/catch — every call it awaits already resolves, never rejects).
async function runWithConcurrencyLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function runNext(): Promise<void> {
    const index = nextIndex++;
    if (index >= items.length) return;
    results[index] = await worker(items[index]);
    return runNext();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
  return results;
}

export async function runSrdManifestDiscovery(
  sources: Array<{
    sourceId: number;
    baseUrl: string;
    entries: Array<{ corpusArea: CorpusArea; sourcePath: string; discoveredFromPath?: string }>;
    concurrency?: number;
  }>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (const source of sources) {
    const results = await runWithConcurrencyLimit(
      source.entries,
      source.concurrency ?? 5,
      (entry) => discoverSourcePage(source.sourceId, source.baseUrl, entry, fetchImpl),
    );
    for (const result of results) {
      if (!result.lastError) succeeded++;
      else failed++;
    }
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

test("discoveredFromPath is passed through to the persisted manifest entry", async () => {
  const entry = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "spells", sourcePath: "/srd/spells/fireball.htm", discoveredFromPath: "/indexes/spells.htm" },
    fakeFetchOk("<html>fake fireball page</html>"),
  );
  const reloaded = storage.getSrdManifestEntry(entry.sourcePageKey);
  assert.equal(reloaded?.discoveredFromPath, "/indexes/spells.htm");
});

test("runSrdManifestDiscovery never runs more than the configured concurrency limit in flight at once for a source group", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const trackingFetch: typeof fetch = async (url) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    return new Response("<html>ok</html>", { status: 200 });
  };
  const manyEntries = Array.from({ length: 20 }, (_, i) => ({
    corpusArea: "spells" as const, sourcePath: `/srd/spells/concurrency-test-${i}.htm`,
  }));
  await runSrdManifestDiscovery(
    [{ sourceId: d20srdSourceId, baseUrl: "https://www.d20srd.org", entries: manyEntries, concurrency: 3 }],
    trackingFetch,
  );
  assert.ok(maxInFlight <= 3, `expected at most 3 concurrent fetches, observed ${maxInFlight}`);
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

- [ ] **Step 3: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/srd-manifest-discovery.test.ts` — expect 6/6.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 4: Commit**

```bash
git add server/srd-manifest-discovery.ts server/srd-manifest-discovery.test.ts
git commit -m "feat: add discovery pipeline for both sources' full leaf-page lists, concurrency-capped, injectable fetcher, loud failures"
```

**Independent verification before Task 8 begins:** re-run tests fresh; grep the test file to confirm no test omits `fetchImpl` and falls through to the real network default; confirm `discoverSourcePage` never calls `recordRevision`/`canonical-id.ts` anywhere (a structural check, same discipline as Task 2's gate); confirm the concurrency test genuinely exercises the limiter by re-reading `runWithConcurrencyLimit`'s implementation, not just trusting the test's own timing-based assertion.

---

### Task 8: Sample end-to-end page-processing proof + source-page verification write path

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

**Independent verification before Task 9 begins:** re-run tests fresh; confirm `recordSourcePageVerification`'s guard actually calls `isValidSourcePageVerification` rather than a duplicated inline condition; confirm no HTTP route in the entire diff so far exposes either verification writer (grep `server/routes.ts` for `recordRuleSourceVerification`/`recordSourcePageVerification` — zero hits expected).

---

### Task 9 (required for Phase 2A completion) — Execute the real discovery scan and produce acceptance-gate evidence

**This task is not optional.** Tasks 1-8 are a fully tested, network-free *framework*. Phase 2A is not complete until this task runs for real and produces the evidence format below — an empty, well-tested manifest framework is not a corpus manifest. Its execution is isolated from the unit-test suite (nothing here runs inside `node --import tsx --test`), but it is a required gate, not a deferrable extra.

**Files:**
- Create: `docs/superpowers/notes/2026-08-22-srd-manifest-acceptance-report.md`

**Interfaces:**
- Consumes: `runSrdManifestDiscovery` (Task 7), `SRD_MANIFEST_SOURCE_OLIMOT`/`SRD_MANIFEST_SOURCE_D20SRD`/`SRD_MANIFEST_ROOTS_D20SRD` (Task 6), `storage.getSourcePageCoverageReport`/`findDuplicateSourcePages` (Task 4), the three real registered `rule_sources` rows (Task 1).

**Expected behavior:** A real run against both pinned sources' full real leaf-page lists (~97 olimot + ~1,560 d20srd.org), followed by two completeness gates — the pinned-tree diff for the git-hosted mirror, and a fresh re-crawl-and-diff of the 44 real d20srd.org roots against the committed generated snapshot (the closest equivalent achievable for a source with no tree API). **Before Step 1, re-confirm the fetch strategy from wherever this task actually executes** — this plan's "Fetch Strategy Verification" section confirmed Node `fetch()` works from the local dev environment; the VPS is a different network, and a wave of failures here should first be diagnosed as a possible network-strategy issue, not silently accepted as "the real coverage number." **Zero game-rule content is stored anywhere, regardless of scale.**

**Migration risk:** None — additive dev-database rows. **Do not target the live VPS database** unless the user explicitly asks for that in a later turn.

**Rollback consideration:** `DELETE FROM srd_manifest_entries; DELETE FROM srd_source_page_revisions;` — trivially reversible, zero impact elsewhere.

- [ ] **Step 1: Re-confirm fetch connectivity from the real execution environment**

```bash
node -e "fetch('https://www.d20srd.org/index.htm').then(r => console.log('status:', r.status))"
node -e "fetch('https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739130921026db42b96e6adff6d3661bffbd/index.html').then(r => console.log('status:', r.status))"
```

Both must return `status: 200` from wherever this task is actually running. If either fails here but succeeded during planning (a different environment), that is itself the finding to report — do not proceed to Step 2 and interpret the resulting failures as "the real coverage number" without first ruling out a network/strategy problem specific to this execution environment.

- [ ] **Step 2: Run the real discovery scan against both pinned sources' full leaf-page lists**

```ts
import { storage } from "./server/storage";
import { runSrdManifestDiscovery } from "./server/srd-manifest-discovery";
import { SRD_MANIFEST_SOURCE_OLIMOT } from "./server/srd-manifest-snapshot-olimot.generated";
import { SRD_MANIFEST_SOURCE_D20SRD } from "./server/srd-manifest-snapshot-d20srd.generated";

const olimot = storage.getRuleSource("dnd35e-srd-olimot-mirror");
const hypertextD20 = storage.getRuleSource("dnd35e-srd-hypertext-d20");
if (!olimot || !hypertextD20) throw new Error("Run Task 1 Step 6 first.");

const result = await runSrdManifestDiscovery([
  { sourceId: olimot.id, baseUrl: `https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@${olimot.pinnedRevision}/`, entries: SRD_MANIFEST_SOURCE_OLIMOT, concurrency: 8 },
  { sourceId: hypertextD20.id, baseUrl: "https://www.d20srd.org", entries: SRD_MANIFEST_SOURCE_D20SRD, concurrency: 5 },
]);

console.log("Discovery run result:", result);
console.log("Coverage report:", storage.getSourcePageCoverageReport());
console.log("Duplicates:", storage.findDuplicateSourcePages());
```

Given the real scale (~1,560 d20srd.org pages at concurrency 5), expect this to take real wall-clock time — minutes, not seconds. That is expected and correct for a considerate, rate-limited real crawl; do not raise the concurrency to make it finish faster without weighing that against the Global Constraint on being a considerate citizen against a small site.

- [ ] **Step 3: Run both completeness gates (real network, not a unit test)**

Olimot — pinned-tree diff, unchanged mechanism from the prior revision:

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
  throw new Error(`Olimot coverage gate FAILED. Missing: ${JSON.stringify(missingFromManifest)}. Extra: ${JSON.stringify(extraInManifest)}`);
}
console.log("Olimot coverage gate PASSED.");
```

`d20srd.org` — re-crawl the 44 real roots fresh and diff against the committed generated snapshot (the honest equivalent for a source with no tree API: re-run the same generation logic and compare, rather than trusting the committed file never went stale):

```ts
import { extractLinks, classifyD20srdLink } from "./server/srd-link-extraction";
import { SRD_MANIFEST_ROOTS_D20SRD } from "./server/srd-manifest-roots-d20srd";

const freshLeafPaths = new Set<string>();
for (const root of SRD_MANIFEST_ROOTS_D20SRD) {
  const rootRes = await fetch(`https://www.d20srd.org${root.sourcePath}`);
  const html = await rootRes.text();
  for (const href of extractLinks(html)) {
    const result = classifyD20srdLink(href, `https://www.d20srd.org${root.sourcePath}`, root.corpusArea);
    if (result.included) freshLeafPaths.add(new URL(result.url).pathname);
  }
}
const committedLeafPaths = new Set(SRD_MANIFEST_SOURCE_D20SRD.map((e) => e.sourcePath));
const newlyFound = [...freshLeafPaths].filter((p) => !committedLeafPaths.has(p));
const noLongerFound = [...committedLeafPaths].filter((p) => !freshLeafPaths.has(p));
console.log(`d20srd.org re-crawl: ${newlyFound.length} newly found, ${noLongerFound.length} no longer found (a live site can legitimately drift — this is informational, not necessarily a failure; investigate before treating either number as a bug).`);
```

If the olimot gate fails, do not proceed — regenerate `server/srd-manifest-snapshot-olimot.generated.ts` (re-run Task 6 Step 2's script) and re-run before declaring the acceptance report. A non-zero `newlyFound`/`noLongerFound` for `d20srd.org` is not automatically a failure the way olimot's is (a live site can genuinely change between planning and execution) — record it in the report either way.

- [ ] **Step 4: Write the acceptance report in the literal evidence format specified**

`docs/superpowers/notes/2026-08-22-srd-manifest-acceptance-report.md`, containing at minimum:

```
discovered N source pages → accounted for N → fetch failures X → changed X → duplicates X
```

with **real numbers from Step 2's output** — N in the low thousands (≈1,657 = ~97 olimot + ~1,560 d20srd.org, exact numbers from the real generated snapshots, not this plan's estimate), broken down per source, per corpus area, and per processing status (`byProcessingStatus`), plus the specific `sourcePath`+`lastError` for every failure (never just a bare count), plus both Step 3 gate results. `changed X` is legitimately `0`/not-yet-applicable on a first-ever scan — state that explicitly rather than omitting the field. **The report must never describe this as "X canonical rules verified" or similar — every count in it is a source-page count**, matching `reportScope: "source-page-coverage"`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/notes/2026-08-22-srd-manifest-acceptance-report.md
git commit -m "docs: capture real SRD manifest discovery scan and both completeness-gate results (real leaf-page scale)"
```

**Independent verification before Phase 2A is considered complete:** re-run the full test suite, typecheck, and build fresh; confirm the acceptance report's `discovered` count equals `SRD_MANIFEST_SOURCE_OLIMOT.length + SRD_MANIFEST_SOURCE_D20SRD.length` exactly (both real, generated numbers, not the plan's ~1,560 estimate); confirm zero rows anywhere in `srd_manifest_entries` reached `"parsed"` or `"source_verified"` from the real scan itself (those values must only exist from Task 8's deliberate sample row) — the concrete proof that Task 9 stayed within page-level discovery and never silently claimed entity-level progress it didn't earn; confirm the coverage report's `reportScope` field is present and correct in the real captured output.

---

## Self-Review

**Against this revision's specific correction — real exhaustive leaf-page discovery vs. root-page discovery:**

The prior revision (pushed as `2f224f9`) treated d20srd.org's 44 index pages as the manifest itself. This revision corrects that with a real one-level link-extraction crawl: Task 5 builds and tests (against real captured fixture data) the classifier that decides, for every real link on a real root page, whether it's included with a real corpus area or excluded with a real reason — never silently dropped. Task 6 uses that classifier in a real generation script against the real 44 roots, producing a real ~1,560-entry leaf-page list, the same "generate, don't hand-maintain" discipline already applied to olimot, now applied consistently to both sources — itself justified by this revision's own second real hand-counting error (44 real roots, not the prior revision's "40"). Task 7's discovery pipeline fetches every real leaf page from both generated lists, not just the 44 roots, with concurrency capping added specifically because the real scale (~1,560 pages against a small volunteer-run site) makes an unbounded fetch inconsiderate. Task 9's acceptance evidence now reports real leaf-page counts in the low thousands, and its d20srd.org completeness gate re-crawls the real 44 roots fresh rather than only diffing olimot's git tree — the closest achievable equivalent for a live site with no tree API. `discoveredFromPath` (`srd_manifest_entries`, Task 2) preserves the audit link from every leaf back to the root it was found from, per the review's point 7. Canonical entity extraction remains completely out of scope: nothing in Tasks 5-9 creates a `dnd35e:spell:*`-style ID or a `spell_definitions` row — every new artifact is a URL, a hash, a corpus-area classification, or a processing-status transition.

**Against the original 10 correction points (prior round), reconfirmed still intact after this revision:**

1. **Provenance vs. transport** — unchanged, still Task 1. ✅
2. **Full "ALL" scope** — strengthened this round from root-level to real exhaustive leaf-page discovery (~1,560 d20srd.org pages, not 44). ✅
3. **No canonical IDs for pages** — unchanged; `sourcePageKey`/`discoveredFromPath` still never touch `canonical-id.ts`. ✅
4. **Separate page-status vocabulary** — unchanged. ✅
5. **Task 9 (renumbered) mandatory** — unchanged in substance, evidence format now reflects real leaf-page scale. ✅
6. **Immutable pinning + generated snapshots** — extended this round: d20srd.org's leaf-page list is now also generated (Task 6), not hand-written; its 44 roots remain the one necessarily-hand-verified list, with this round's own 40→44 correction as direct evidence for why. ✅
7. **Verification write paths stay internal** — unchanged; still zero HTTP routes anywhere in this plan. ✅
8. **`recordRevision`/`canonical_revisions` scope** — unchanged; `srd_source_page_revisions` still the only revision table this plan touches. ✅
9. **Coverage report distinguishes layers** — unchanged; `reportScope` literal still present, and Task 9's evidence format is explicitly barred from describing counts as canonical-rules verification. ✅
10. **Fetch strategy verified, not assumed** — new this round, directly requested: Node `fetch()` tested and confirmed working against `d20srd.org` from this environment; Task 9 re-verifies from its own real execution environment before treating failures as coverage gaps rather than a network issue. ✅

**Placeholder scan:** every step has real, complete code, including the two generation scripts (both real, runnable, not pseudocode) and the real captured-fixture test data in Task 5 (explicitly labeled as real hrefs from a real fetch performed during planning, not synthesized).

**Type consistency:** `CreateSrdManifestEntryInput` now includes `discoveredFromPath?` (Task 2), threaded consistently through Task 3's CRUD, Task 7's discovery pipeline, and Task 8's lifecycle test. `extractLinks`/`classifyD20srdLink` (Task 5) are imported identically by Task 6's generation script and Task 9's real re-crawl gate — one implementation, two real call sites, never reimplemented.

**Migration risk / rollback:** unchanged in shape from the prior revision; Task 3 remains the only real schema migration.

No gaps found against the approved canonical-rules design, the literal "ALL rules-bearing d20srd.org material" requirement (now satisfied at real leaf-page granularity, not root-page granularity), or the verified-fetch-strategy requirement. Ready for user approval.

## Execution Handoff

Plan revised and saved to `docs/superpowers/plans/2026-08-22-dnd35-srd-ingestion-foundation-phase2a.md`. Per your explicit instruction, stopping here for your review before any code is written — this plan has not been executed, and Phase 2B/canonical-entity extraction has not been started.
