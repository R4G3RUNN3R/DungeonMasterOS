# SRD Provenance Registration (Task 1: 2026-08-23)

Three authoritative rule sources for D&D 3.5e have been registered in the rule_sources table, establishing the provenance hierarchy for corpus ingest tasks (Task 2+):

## Registered Sources

### 1. dnd35e-srd-original (id: 1)

```json
{
  "id": 1,
  "sourceKey": "dnd35e-srd-original",
  "title": "D&D 3.5 System Reference Document (original)",
  "publisher": "Wizards of the Coast",
  "ruleset": "dnd35e",
  "nativeEdition": "dnd35e",
  "setting": "generic",
  "publicationType": "core-rulebook",
  "provenanceClassification": "wotc_official",
  "licenseClassification": "srd_open",
  "publicationDate": null,
  "supersedesSourceId": null,
  "derivedFromSourceId": null,
  "pinnedRevision": null,
  "verificationMethod": "",
  "verifiedBy": "",
  "verifiedAt": null,
  "createdAt": "2026-08-23T07:53:09.463Z",
  "updatedAt": "2026-08-23T07:53:09.463Z"
}
```

**Provenance Model:** This is the authoritative original source. It has no `derivedFromSourceId` (it is not derived from another source) and no `pinnedRevision` (it is a historical publication, not a live website or versioned transport).

### 2. dnd35e-srd-olimot-mirror (id: 2)

```json
{
  "id": 2,
  "sourceKey": "dnd35e-srd-olimot-mirror",
  "title": "olimot/srd-v3.5 HTML mirror (GitHub, pinned commit faab739130921026db42b96e6adff6d3661bffbd)",
  "publisher": "olimot (compiler); underlying content Wizards of the Coast (OGL)",
  "ruleset": "dnd35e",
  "nativeEdition": "dnd35e",
  "setting": "generic",
  "publicationType": "web-enhancement",
  "provenanceClassification": "open_game_content",
  "licenseClassification": "srd_open",
  "publicationDate": null,
  "supersedesSourceId": null,
  "derivedFromSourceId": 1,
  "pinnedRevision": "faab739130921026db42b96e6adff6d3661bffbd",
  "verificationMethod": "",
  "verifiedBy": "",
  "verifiedAt": null,
  "createdAt": "2026-08-23T07:53:09.467Z",
  "updatedAt": "2026-08-23T07:53:09.467Z"
}
```

**Provenance Model:** This is a GitHub-hosted HTML mirror/transport of (1). It has `derivedFromSourceId: 1` to signal that it is a transport of the original, and `pinnedRevision: "faab739130921026db42b96e6adff6d3661bffbd"` recording the exact commit hash at which this mirror was scanned and ingested. The commit SHA is immutable — the mirror can be re-scanned at any time to detect drift, but the ingest baseline is locked to this specific version.

### 3. dnd35e-srd-hypertext-d20 (id: 3)

```json
{
  "id": 3,
  "sourceKey": "dnd35e-srd-hypertext-d20",
  "title": "The Hypertext d20 SRD (d20srd.org) — includes documented errata integration and Unearthed Arcana Variant Rules open content",
  "publisher": "BoLS Interactive LLC (compiler); underlying content Wizards of the Coast (d20 System License / OGL)",
  "ruleset": "dnd35e",
  "nativeEdition": "dnd35e",
  "setting": "generic",
  "publicationType": "web-enhancement",
  "provenanceClassification": "open_game_content",
  "licenseClassification": "srd_open",
  "publicationDate": null,
  "supersedesSourceId": null,
  "derivedFromSourceId": 1,
  "pinnedRevision": null,
  "verificationMethod": "",
  "verifiedBy": "",
  "verifiedAt": null,
  "createdAt": "2026-08-23T07:53:09.468Z",
  "updatedAt": "2026-08-23T07:53:09.468Z"
}
```

**Provenance Model:** This is also a transport of (1), but `d20srd.org` is a live, mutable website with no version control. It has `derivedFromSourceId: 1` and `pinnedRevision: null` at registration time. This `null` is intentional — it represents a placeholder indicating "a scan is pending" rather than "no scan has ever succeeded."

## The Live-Site Provenance Limitation

The distinction between (2) and (3) reflects a hard constraint of live-site provenance: where versioned transports (git commits, tagged releases) provide stable anchors, live websites offer no such guarantee. At the moment of Task 1 registration, d20srd.org has not yet been scanned, so there is no real observation to record. Any hardcoded timestamp (e.g., `"live-scan-2026-08-22"`) would misrepresent a plan-authoring-date guess as an actual scan result.

Instead, the `pinnedRevision` for `dnd35e-srd-hypertext-d20` is only ever set once, by Task 9, after both completeness gates pass on a real successful scan. It will then be stamped with the actual UTC timestamp of that scan completion (e.g., `"live-scan-2026-08-23T14:32:07.418Z"`), never a commit SHA (the source has no version control) and never a planning-date placeholder.

The per-page content hashes in `srd_manifest_entries` remain the real drift evidence; the `pinnedRevision` timestamp is a snapshot label on the source row, documenting when the live site was last observed as complete and correct, so future re-scans can detect changes relative to that baseline.

## Verification Path

All three rows start with empty `verificationMethod`, `verifiedBy`, and `verifiedAt` fields. They are populated via `storage.recordRuleSourceVerification()`, a storage-layer-only method (no HTTP route) that closes the Phase 0/1 gap where `updateRuleSource`'s partial-input shape could never reach those columns.
