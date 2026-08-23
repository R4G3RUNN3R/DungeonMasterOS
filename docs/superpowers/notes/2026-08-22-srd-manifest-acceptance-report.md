# SRD Manifest Acceptance Report (Task 9, real run: 2026-08-23)

**Scope note, stated explicitly per this plan's own requirement: every count in this report is a source-*page* count.** Nothing here is a claim about canonical rules entities, spells, feats, monsters, or any other game-data object — those don't exist yet and remain explicitly out of scope for Phase 2A (Phase 2B's job). This report's coverage data carries the literal `reportScope: "source-page-coverage"` field for exactly this reason.

## Headline evidence line

```
discovered 1643 source pages → accounted for 1643 → fetch failures 0 → changed 0 (first-ever scan, not yet applicable) → duplicates 0
```

## Step 1: Fetch connectivity re-confirmed from the real execution environment

```
$ node -e "fetch('https://www.d20srd.org/index.htm').then(r => console.log('status:', r.status))"
status: 200
$ node -e "fetch('https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739130921026db42b96e6adff6d3661bffbd/index.html').then(r => console.log('status:', r.status))"
status: 200
```

Both real, both 200, from the actual environment this task ran in. No network-strategy issue.

## Step 2: Real discovery scan — full run output

```
olimot.pinnedRevision: faab739130921026db42b96e6adff6d3661bffbd
hypertextD20.pinnedRevision (before this run): null
olimot entries: 85
d20srd entries: 1558
Discovery run result: {"succeeded":1643,"failed":0}
Elapsed: 82628ms (82.6s)
```

Real `runSrdManifestDiscovery` call against both pinned sources' full leaf-page lists — olimot at `concurrency: 8, delayMs: 0` (jsDelivr, a real CDN, no pacing needed), d20srd.org at `concurrency: 5, delayMs: 50` (the conservative, considerate-citizen paced default, enforced by the real shared `claimStartSlot` scheduler).

### Coverage report (real, `storage.getSourcePageCoverageReport()` output)

```json
{
  "reportScope": "source-page-coverage",
  "totalDiscovered": 1643,
  "byProcessingStatus": {
    "discovered": 0,
    "fetched": 0,
    "hashed": 1643,
    "parsed": 0,
    "source_verified": 0
  },
  "byCorpusArea": {
    "core": 17,
    "combat-rules": 12,
    "classes": 19,
    "items-equipment": 29,
    "prestige-classes": 17,
    "races": 2,
    "feats": 2,
    "conditions": 3,
    "skills": 41,
    "divine": 19,
    "monsters": 272,
    "epic": 153,
    "psionics": 375,
    "spells": 633,
    "open-variants": 49
  },
  "bySource": {
    "dnd35e-srd-olimot-mirror": 85,
    "dnd35e-srd-hypertext-d20": 1558
  },
  "sourceVerifiedCount": 0,
  "failedCount": 0
}
```

Every count in `byProcessingStatus` and `byCorpusArea` sums to `totalDiscovered` (1643): `byProcessingStatus` is entirely `"hashed"` (0 `"discovered"`/`"fetched"`/`"parsed"`/`"source_verified"`) — exactly correct, since this task performs page-level discovery only and never advances a row past `"hashed"` itself; the two rows that reached `"parsed"`/`"source_verified"` anywhere in this plan are Task 8's own deliberate hand-advanced sample rows, in a different database context (its own temp test DB), not this real scan. `bySource` sums 85 + 1558 = 1643. `byCorpusArea` sums 17+12+19+29+17+2+2+3+41+19+272+153+375+633+49 = 1643. All 15 corpus areas are represented.

### Fetch failures: 0 (named individually, per the plan's requirement — none to name)

```
Failed entries: 0
```

Zero `sourcePath`+`lastError` pairs to report — every one of the 1643 real fetches succeeded on the first attempt (or after `fetchWithBackoff`'s transparent retry, which never surfaced as a discovery-level failure).

### Duplicates: 0

```
Duplicates: 0
```

`storage.findDuplicateSourcePages()` found zero groups of 2+ entries sharing a `contentHash` — no accidental cross-source or cross-page content collisions.

### `changed`: not yet applicable (first-ever scan)

This is the first real discovery scan ever run against this manifest. There is no prior scan to diff against for a "changed" count, so it is explicitly `0`/not-yet-applicable, stated here rather than omitted.

## Step 3: Both completeness gates — real output

```
Olimot coverage gate PASSED.
Fresh d20srd.org re-crawl elapsed: 200.7s, rounds: 2, failures: 0
d20srd.org completeness gate PASSED: committed snapshot and fresh live crawl agree on every path and every classification.
Summary: pathAdditions=0 pathRemovals=0 classificationMismatches=0 discoveredFromMismatches=0
BOTH_GATES_PASSED
```

**Olimot gate: PASSED.** A real, fresh query of the pinned GitHub tree API, diffed against `SRD_MANIFEST_SOURCE_OLIMOT`: zero missing, zero extra. The pinned commit is immutable, so this gate's role is confirming the committed manifest still accurately reflects that pinned commit's real tree — confirmed.

**d20srd.org gate: PASSED, on the first attempt — no regenerate/rerun cycle was needed.** The fresh re-crawl itself first passed `assertClosureExhaustive` (zero fetch failures across its own 2 rounds), confirming it is trustworthy for diffing at all. The diff against the committed `SRD_MANIFEST_SOURCE_D20SRD` snapshot (generated during Task 6, several hours before this real acceptance run) found:
- `pathAdditions: 0` — no new real leaf page appeared on the live site since Task 6's generation.
- `pathRemovals: 0` — no committed page disappeared from the live site.
- `classificationMismatches: 0` — every real path's `corpusArea`, independently re-derived by this fresh crawl, agrees exactly with the committed snapshot's classification (confirming `classifyD20srdCorpusArea`'s determinism holds in practice, not just in unit tests).
- `discoveredFromMismatches: 0` (informational only, would not have blocked even if non-zero) — every real path's recorded originating root also agrees exactly between the two independent crawls.

Since both blocking gates passed cleanly with zero discrepancy on the first attempt, no snapshot regeneration or re-run was required.

## Step 4: Real scan revision stamped

```
Stamped dnd35e-srd-hypertext-d20.pinnedRevision = "live-scan-2026-08-23T12:46:11.371Z"
```

`storage.recordSourceScanRevision("dnd35e-srd-hypertext-d20", "live-scan-2026-08-23T12:46:11.371Z")` — called exactly once, after both gates passed, with the real UTC timestamp this run actually completed at (not the plan's authoring date, not a placeholder). This is the identical value now persisted on the `dnd35e-srd-hypertext-d20` row's `pinnedRevision` column in the real dev database. The per-page content hashes recorded in `srd_manifest_entries` during Step 2 remain the real drift evidence for this source; this timestamp is an observation/snapshot label on the source row, not a claim that `d20srd.org` became immutable.

## Independent verification checklist (per the plan's own requirements)

- `discovered` count (1643) equals `SRD_MANIFEST_SOURCE_OLIMOT.length + SRD_MANIFEST_SOURCE_D20SRD.length` exactly: 85 + 1558 = 1643. ✓ (both real, generated numbers from Task 6, not an estimate)
- Zero rows reached `"parsed"`/`"source_verified"` from this real scan itself — confirmed by `byProcessingStatus` above (0 in both fields); the only rows anywhere in this plan that ever reach those statuses are Task 8's own deliberate hand-advanced sample rows in that task's own isolated test database, never this real scan's rows.
- `reportScope: "source-page-coverage"` is present and correct in the real captured output (see Step 2's JSON above).
- Both blocking gate results explicitly show zero `pathAdditions`/`pathRemovals`/`classificationMismatches`; the non-blocking `discoveredFromMismatches` (also zero) is disclosed rather than omitted.
- The fresh live crawl used for the d20srd.org gate genuinely called `assertClosureExhaustive` before diffing (see `server/srd-d20srd-closure-crawl.ts`'s `assertClosureExhaustive`, called unconditionally before the diff logic runs in the gate script) — confirmed by the real "failures: 0" log line preceding the diff, which is only reachable if the assert did not throw.
