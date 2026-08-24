# D&D 5e Multi-Generation Ruleset Design

**Status:** proposed architecture; documentation only

**Design date:** 2026-08-23

**Frozen basis:** `origin/production-live-base` at `176456af5f79400bafe39836bbe01faebdfd4913`

## Evidence vocabulary

- `[REPOSITORY FACT]` is verified in the frozen DungeonMasterOS repository.
- `[OFFICIAL SOURCE]` is supported by the official URLs in the companion source and differences reports.
- `[DERIVED SOURCE]` identifies a non-authoritative ingestion transport.
- `[SECONDARY SOURCE]` is not used to settle an architectural rule.
- `[INFERENCE]` is a proposed product/engineering decision based on the evidence.
- `[OPEN QUESTION]` requires later evidence or product authority.
- `[EXECUTION ATTESTATION]` records what this documentation-only task did or did not change.

## Companion evidence

- `docs/superpowers/research/2026-08-23-dnd5e-existing-system-audit.md`
- `docs/superpowers/research/2026-08-23-dnd5e-srd-source-research.md`
- `docs/superpowers/research/2026-08-23-dnd5e-2014-vs-2024-differences.md`

Those reports are normative evidence for this proposal. This specification does not silently upgrade an inference into a repository or rules fact.

## Executive design

`[INFERENCE]` DungeonMasterOS should end with three explicit selectable mechanics rulesets—existing `dnd35e`, new `dnd5e2014`, and new `dnd5e2024`—while retaining existing bare `dnd5e` as a legacy compatibility identity for historical rows until each campaign is explicitly classified or converted. During rollout, bare `dnd5e` remains available for new campaigns under an unambiguous compatibility warning until `dnd5e2014` passes its fixed gate; one atomic server-owned selection transition then removes the legacy option and exposes `dnd5e2014`, so there is no period with no 5e creation choice.

`[INFERENCE]` The two 5e generations must have independent canonical IDs, source manifests, canonical definitions, mechanics profiles, client projections, AI context, test fixtures, and immutable releases. Shared infrastructure may execute both, but no mutable record may change its meaning based on which campaign reads it.

`[INFERENCE]` A campaign is pinned not only to a ruleset ID but to an immutable ruleset release and a versioned campaign rules snapshot. A source correction or future SRD point release creates a new release; it does not rewrite the one used by an old event.

`[INFERENCE]` Implement the 2014/SRD 5.1-compatible sibling first. The repository's historic assumptions are closer to traditional 5e than to a complete revised engine, but current `dnd5e` state is mixed and cannot be relabelled canonical 2014 without review.

## Goals

1. `[INFERENCE]` Preserve exact mechanical generation across campaign lifetime and historical replay.
2. `[INFERENCE]` Keep `dnd35e`, 2014 5e, and revised 2024 5e from leaking data or behavior into each other.
3. `[INFERENCE]` Make authoritative source, derived transport, immutable artifact, extraction, canonical revision, and runtime automation separately auditable.
4. `[INFERENCE]` Reuse the emerging 3.5 canonical foundation where it is genuinely generic without competing with Claude's active Phase 2A work.
5. `[INFERENCE]` Keep AI as narrator/intent proposer; the server validates, rolls, mutates, logs, and decides supported deterministic outcomes.
6. `[INFERENCE]` Preserve legacy campaigns, character ownership, multiplayer consistency, and billing/turn invariants.
7. `[INFERENCE]` Make corpus and automation coverage measurable rather than aspirational.

## Non-goals

- No application code, schema, migration, source registration, ingestion, prompt, UI, campaign, or character change is authorized by this specification.
- No merge, deployment, VPS access, or production-data inspection/change is part of this work.
- No closed Player's Handbook, Dungeon Master's Guide, Monster Manual, paid D&D Beyond, scan, or piracy content may be ingested.
- No promise is made to automate every SRD rule or entity merely because its text is present.
- No automatic or mandatory existing-campaign conversion is proposed.
- No hybrid 2014/revised mechanics mode is specified. It must remain unavailable until an explicit precedence policy and complete tests exist.
- No attempt is made to force 5e entities into a 3.5-specific schema.
- No existing ruleset is renamed during this task.

## Locked principles

`[INFERENCE]` These are invariants, not implementation suggestions:

1. **Exact dispatch:** every state-changing rules operation resolves an exact `MechanicalRulesetId`; a catalogue/setting ID, unknown ID, or unsupported ID fails closed.
2. **No newest-edition default:** revised rules never supersede 2014 rules merely because they are newer.
3. **Immutable meaning:** a canonical ID and revision have one ruleset meaning forever.
4. **Campaign pinning:** every campaign rules snapshot pins one ruleset release and one retained, content-addressed evaluated-corpus manifest.
5. **Historical provenance:** every deterministic event records the rules snapshot/evaluator release that produced it.
6. **Server authority:** client and AI inputs describe intent; server state supplies HP, AC, saves, proficiency, resources, ownership, and legal options.
7. **Source separation:** authoritative originals and derived transports are different records linked by many-to-many, revision/segment/record-scoped derivation evidence.
8. **Manifest evidence:** coverage is claimed only after every in-scope source segment has a verified disposition.
9. **Automation evidence:** canonical text/structure does not imply executable mechanics.
10. **Explicit conversion:** generation changes require a previewed, owner-authorized, user-reviewed, auditable transaction; one-click rollback is allowed only before later state-changing events, otherwise reversal is a new forward reconciliation.
11. **Ownership separation:** Campaign Owner is not automatically Character Owner; conversion authority respects both.
12. **No economic side effects:** ingestion, verification, migration preview, and rules re-resolution never consume AI turns or alter billing.

## Ruleset identities and names

### Internal identities

| ID | Role | New campaign selectable? | Mechanics meaning |
|---|---|---:|---|
| `dnd35e` | existing explicit ruleset | yes | Existing 3.5e behavior and future canonical corpus. Unchanged by this design. |
| `dnd5e` | existing legacy compatibility identity | no, after explicit IDs ship | Historical DungeonMasterOS 5e-shaped behavior whose intended generation is unresolved/mixed. |
| `dnd5e2014` | new explicit ruleset | yes, only after the fixed capability gate | Original 2014-era 5e mechanics with SRD 5.1 as the open canonical base. |
| `dnd5e2024` | new explicit ruleset | yes, only after the fixed capability gate | Revised 2024-era mechanics with SRD 5.2.1, verified current on 2026-08-23, as the initial open canonical base. |

`[REPOSITORY FACT]` `RulesetId` is currently a six-value product/catalogue union, although only `dnd5e` and `dnd35e` are mechanically available. Current mechanical IDs are lower-case alphanumeric strings and canonical IDs begin with the ruleset. `[INFERENCE]` Introduce a distinct `MechanicalRulesetId = "dnd35e" | "dnd5e" | "dnd5e2014" | "dnd5e2024"`; retain the broader catalogue type for setting/product presentation. The proposed IDs extend the current convention and fit the canonical grammar better than an untracked `edition` field beneath `dnd5e`.

`[INFERENCE]` A non-authoritative grouping field may expose `familyId: "dnd5e"` for search/navigation, but it must never drive mechanics or canonical uniqueness. A catalogue setting such as Ravenloft or Eberron may map through an explicit, validated `baseMechanicalRulesetId`; it cannot itself be an evaluator key, and a missing mapping fails closed. `familyId` and catalogue IDs are taxonomy/presentation; `mechanicalRulesetId` is authority.

`[INFERENCE]` Do not introduce `dnd5e52` or encode the current point release into the mechanics ID. Rules behavior generation and source revision are different dimensions. `dnd5e2024` can receive immutable ruleset releases backed by 5.2.1, a later 5.2.2, or an explicitly retained older release without changing campaign identity.

### Player-facing names

| Context | Label | Supporting text |
|---|---|---|
| New 2014 campaign | **D&D 5e (2014)** | Original fifth-edition rules; open core source SRD 5.1. |
| New revised campaign | **D&D 5e Revised (2024)** | Also commonly labelled 5.5e; open core source SRD 5.2.1. |
| Existing unresolved campaign | **D&D 5e (Legacy campaign)** | Rules generation has not been classified; no silent conversion will occur. |
| Existing 3.5 campaign | **D&D 3.5e** | Existing identity and behavior. |

`[OFFICIAL SOURCE]` D&D Beyond currently uses 5e for 2014 and 5.5e for revised rules, while SRD versions remain 5.1 and 5.2.1. `[INFERENCE]` The proposed labels lead with year/revision clarity and retain 5.5e as explanatory text rather than the only player-visible identity.

## Isolation model

```text
Campaign
  -> catalogue/setting identity (presentation only, where applicable)
  -> exact MechanicalRulesetId
  -> immutable RulesetRelease
       -> mechanics evaluator bundle version
       -> exact semantic corpus revisions
       -> exact canonical entity revisions
  -> CampaignRulesSnapshot
       -> immutable EvaluatedCorpusManifest
            -> exact canonical + homebrew revision IDs and hashes
            -> source-policy and evaluator artifact hashes
  -> state-changing command
       -> server authorization and validation
       -> ruleset-specific evaluator
       -> transaction + append-only event/roll provenance
       -> WebSocket state-version broadcast
```

### Dispatch invariant

`[INFERENCE]` All mechanics entry points accept a resolved `RulesContext`, not a nullable/free-text ruleset:

```ts
interface RulesContext {
  campaignId: number;
  mechanicalRulesetId: MechanicalRulesetId;
  rulesetReleaseId: string;
  campaignRulesSnapshotId: string;
  evaluatedCorpusManifestId: string;
  evaluatedCorpusManifestHash: string;
  evaluatorBundleArtifactSha256: string;
  campaignStateVersion: number;
}
```

`[INFERENCE]` Only a server-owned resolver constructs this context from persisted campaign state. Requests may carry a claimed ruleset/snapshot as an optimistic-concurrency assertion, but the claim never overrides the database.

`[INFERENCE]` `getRuleset`, class lookup, client adapter lookup, compendium resolution, prompt construction, and mechanics dispatch must reject unknown IDs. No “all non-3.5 means 5e” and no “first registry entry” fallback survives the multi-ruleset boundary.

### Ruleset release and campaign snapshot

`[INFERENCE]` Separate the semantic rules corpus from its legal/document wrappers, then pin the exact evaluated set. A PDF, HTML page, or Git blob is a `SourceArtifactSnapshot`; a `SemanticCorpusRevision` is the normalized rules body proven from one or more artifacts. Campaigns select the semantic corpus, never whichever PDF wrapper happened to be parsed.

```ts
interface SemanticCorpusRevision {
  id: string;
  mechanicalRulesetId: MechanicalRulesetId;
  semanticVersion: string;
  sourceArtifactBindingIds: readonly string[];
  normalizedBodyHash: string;
  rightsDecisionId: string;
  verifiedAt: string;
}

interface RulesetRelease {
  id: string;
  mechanicalRulesetId: MechanicalRulesetId;
  releaseNumber: number;
  semanticCorpusRevisionIds: readonly string[];
  evaluatorBundleArtifactSha256: string;
  canonicalRevisionSetHash: string;
  publishedAt: string;
  revisesReleaseId: string | null;
}

interface EvaluatedCorpusManifest {
  id: string;
  mechanicalRulesetId: MechanicalRulesetId;
  rulesetReleaseId: string;
  semanticCorpusRevisionIds: readonly string[];
  canonicalRevisionIds: readonly string[];
  homebrewRevisionIds: readonly string[];
  sourcePolicyRevisionIds: readonly string[];
  canonicalRevisionSetHash: string;
  evaluatorBundleArtifactSha256: string;
  manifestHash: string;
}

interface CampaignRulesSnapshot {
  id: string;
  campaignId: number;
  rulesetReleaseId: string;
  evaluatedCorpusManifestId: string;
  evaluatedCorpusManifestHash: string;
  createdAt: string;
  createdByActor:
    | { kind: "user"; userId: number }
    | { kind: "system_migration"; migrationId: string };
  revisesSnapshotId: string | null;
}
```

`[INFERENCE]` `RulesetRelease` is the platform-published deterministic base. `EvaluatedCorpusManifest` is a content-addressed, sorted manifest of every source, canonical, homebrew, policy, and evaluator input that can affect results. `CampaignRulesSnapshot` pins that manifest and its hash. The database must retain the manifest bytes and every referenced immutable revision; a source-selection or policy change creates a new manifest and snapshot. Old events keep the old snapshot ID. A mere list of enabled sources is not replay evidence—because apparently determinism enjoys receipts.

`[INFERENCE]` SRD 5.1 CC and OGL PDFs may bind to one `SemanticCorpusRevision` only after a reproducible normalized-body comparison proves semantic equivalence and records excluded front/back legal matter. Until then they remain separate artifacts/corpus candidates. `revises*` records currentness lineage; it never revokes, deletes, or invalidates historical rights or replay evidence.

`[INFERENCE]` Campaigns do not automatically adopt new releases. An owner may later accept a compatible point-release update through a diff/preview flow. A cross-generation change always uses the conversion workflow.

## Canonical identity and revision model

### Canonical ID

`[INFERENCE]` Retain the existing `<ruleset>:<entity-type>:<slug>` shape and make the ruleset segment exact:

```text
dnd5e2014:race:elf
dnd5e2024:species:elf
dnd5e2014:spell:cure-wounds
dnd5e2024:spell:cure-wounds
dnd5e2014:condition:grappled
dnd5e2024:condition:grappled
dnd35e:spell:cure-light-wounds
```

Same slug in two rulesets creates two unrelated canonical identities unless an explicit mapping says otherwise. A resolver must never strip the prefix or search another generation on a miss.

### Canonical envelope

`[INFERENCE]` Every typed entity should share a small provenance/identity envelope while keeping ruleset-specific payload schemas:

```ts
interface CanonicalEntityEnvelope {
  canonicalId: CanonicalId;
  mechanicalRulesetId: MechanicalRulesetId;
  entityType: string;
  slug: string;
  displayName: string;
  canonicalRevisionId: string;
  sourceEvidenceLinkIds: readonly string[];
  extractionStatus: "discovered" | "extracted" | "structured";
  semanticVerificationStatus: "unverified" | "verified" | "rejected" | "quarantined";
  rightsVerificationStatus: "unknown" | "verified_open" | "closed";
  automationStatus: "reference_only" | "partially_executable" | "executable";
  payloadSchemaVersion: string;
  payloadHash: string;
  revisesCanonicalRevisionId: string | null;
}
```

`[REPOSITORY FACT]` The ingestion/automation status concepts and append-only revision intent already exist. `[INFERENCE]` Concrete field/table names are provisional until Phase 2A lands:

> **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION**

### Cross-edition mapping is metadata, never inheritance

```ts
type MappingKind =
  | "display_alias"
  | "exact_equivalent"
  | "renamed_and_revised"
  | "semantic_split"
  | "semantic_merge"
  | "replacement"
  | "no_equivalent"
  | "manual_review";

interface CanonicalEntityMapping {
  fromCanonicalId: CanonicalId;
  toCanonicalId: CanonicalId | null;
  mappingKind: MappingKind;
  evidenceLocatorIds: readonly string[];
  reviewerUserId: number;
  reviewedAt: string;
  notes: string;
}
```

`[INFERENCE]` A mapping can propose a conversion candidate. It never causes the target record to inherit the source mechanics and never lets one ruleset resolve the other's canonical ID.

## Canonical entity families

The families below are derived from both official SRD structures and current DungeonMasterOS needs. They are not a copy of the 3.5 model.

| Family | Separate canonical entities | Required structured fields | Prose/reference boundary | Initial automation target |
|---|---|---|---|---|
| Rules and actions | `rule`, `action`, `condition`, `hazard`, `environment_rule` | semantic key, prerequisites, action cost, timing, target/area, duration, effects, termination, source locators | Explanatory/adjudicative prose stays source-linked; unsupported nuance remains reference-only. | Deterministic core actions/conditions one capability at a time; hazards initially reference-only/AI-assisted. |
| Character origins | 2014 `race`; revised `species`; `background`; `language`; `skill`; `proficiency` | traits, size/Speed, ability ownership/options, languages, skills/tools, equipment package, origin-feat ref | Flavor/personality text can remain referenced; rules-bearing choices structured. | Deterministic creation validation and derived-state projection. |
| Classes | `class`, `subclass`, `class_feature`, `progression_table`, `resource_definition` | level grants, prerequisites, choices, hit die, proficiencies, resources, spell progression, multiclass data | Feature prose stays alongside typed effect/capability records; never parse at runtime. | Deterministic level/choice eligibility first; feature effects incrementally executable. |
| Feats/features/traits | `feat`, reusable `feature`, `trait` | category, prerequisites, repeatability, grants, modifiers, actions, resources | Complex exceptions may be reference-only until an evaluator exists. | Eligibility deterministic; effect capability tracked per feature. |
| Spells | `spell`, `spell_list_membership` | level, school, casting time/action, Ritual, range, components, duration/concentration, targets, typed area shape, mobile origin/origin-inclusion choice, save/attack, scaling, effects | Description retained with page provenance; typed fields do not claim complete execution. | Catalogue/selection first; casting transaction, Emanation targeting, and individual effects separately enabled. |
| Equipment | `weapon`, `armor`, `equipment`, `tool`, `vehicle`, `magic_item`, `poison` | category, cost/weight, damage/AC, properties, Mastery, charges, rarity, attunement, activation, effects | Flavor and non-mechanical description stays referenced. | Inventory/equip/attunement/action cost deterministic; effects per definition. |
| Creatures | `monster` with source category such as `animal`/`npc` | abilities, AC/HP, displayed save modifiers, distinct save-proficiency/source records, skills, Speed, senses, CR, defenses, gear, actions/bonus actions/reactions, spell refs | Tactics/lore remain reference-only; action prose requires typed evaluator before automation. | Stat-block rendering first; attack/save/effect actions incrementally executable. |
| Reference structures | `table`, `rule_section`, source manifest segments | columns/rows or normalized reference keys, section hierarchy, source anchors | Legal/index/art/flavor may be explicitly non-canonical. | Reference-only unless a named evaluator consumes it. |

### Entity-design rules

`[INFERENCE]`

- 2014 `race` and revised `species` remain distinct entity types because feature ownership differs; a neutral UI “ancestry option” may group them without flattening their schema.
- Spell list membership is a versioned many-to-many entity, not an array copied into a mutable spell or class row.
- Class progression tables are structured, revisioned data; the server does not infer grants from prose.
- Conditions share engine plumbing but have ruleset-specific effect bundles.
- Monster native source structure is preserved alongside a neutral runtime projection; a 2014 block is never reshaped and presented as revised authority.
- A displayed creature save modifier is not proof of save proficiency. Revised blocks can display all six modifiers; proficiency is a separate nullable record with its own source locator. Parser and evaluator tests must prove that field presence alone never grants proficiency.
- Area shapes are typed. A revised Emanation carries a mobile creature/object origin and an authorized origin-inclusion choice; it is not flattened into a stationary sphere.
- Item instances point to exact canonical revisions. Same-name equipment can coexist and old inventory remains resolvable.
- Legal pages, indexes, artwork, and out-of-scope closed references receive manifest dispositions rather than fake canonical entities.

## Source and provenance architecture

### Source roles

`[INFERENCE]` “Published by Wizards” proves origin, not permission to ingest or republish. Extend the source model with separate role, authenticity, integrity, semantic, and rights decisions:

```ts
type RuleSourceRole =
  | "authoritative_original"
  | "derived_transport"
  | "third_party_open"
  | "campaign_homebrew"
  | "platform_homebrew"
  | "bibliographic_only";

type ContentRightsStatus = "verified_open" | "closed" | "unknown";

interface ContentRightsDecision {
  id: string;
  contentRightsStatus: ContentRightsStatus;
  rightsScope: readonly { artifactSnapshotId: string; segmentKeys: readonly string[] }[];
  licenseEvidenceSnapshotIds: readonly string[];
  obligationSetRevisionId: string | null;
  verifiedByUserId: number | null;
  verifiedAt: string | null;
}

interface SourcePolicyRevision {
  id: string;
  sourceRole: RuleSourceRole;
  mechanicalRulesetId: MechanicalRulesetId | null;
  currentness: "current" | "historical" | "withdrawn";
  campaignSelectableCandidate: boolean;
  authenticityStatus: "unverified" | "verified" | "rejected" | "quarantined";
  integrityStatus: "unverified" | "hash_verified" | "drifted" | "quarantined";
  semanticStatus: "unreconciled" | "reconciled" | "conflicting" | "quarantined";
  rightsDecisionId: string;
}
```

`[REPOSITORY FACT]` Current `all_official` enablement filters by ruleset/setting applicability but does not independently enforce an authoritative provenance role. `[INFERENCE]` Future source selection must require exact mechanical ruleset, permitted role, all three verification axes, and a `verified_open` rights decision whose scope covers every selected segment. A field named `all_official` is not itself provenance, and neither fame nor a handsome PDF grants a license.

`[INFERENCE]` Legal obligations are immutable structured evidence, not one `attributionText` string:

```ts
interface LicenseObligationSetRevision {
  id: string;
  licenseCode: "CC-BY-4.0" | "OGL-1.0a" | "author_terms";
  fullLicenseArtifactSnapshotId: string;
  requiredCredit: readonly string[];
  requiredSourceLinks: readonly string[];
  modificationNoticeRequired: boolean;
  oglSection15Components: readonly string[];
  appliesToRightsScopeHash: string;
}
```

For CC BY 4.0, exports preserve creator credit, source, license link/text, and modification indication as applicable. For OGL 1.0a, exports preserve the full license and assembled Section 15 entries for every Open Game Content dependency. Software-repository licenses and underlying game-content licenses are different evidence records.

`[INFERENCE]` Provenance is many-to-many and revision/segment scoped:

```ts
interface SourceDerivationLink {
  derivedEvidenceRevisionId: string;
  parentEvidenceRevisionId: string;
  scope: { kind: "revision" | "segment" | "record"; key: string };
  transformationName: string;
  transformationArtifactSha256: string;
}
```

A derived JSON record can combine several official segments, and one official segment can generate several records. A single nullable `derivedFromSourceId` cannot represent that without quietly losing evidence.

### Proposed sources

| Ruleset | Evidence/source | Role | Can contribute to a selectable semantic corpus? | License |
|---|---|---|---:|---|
| `dnd5e2014` | Wizards SRD 5.1 CC PDF artifact | authoritative original; semantic corpus candidate | yes only after all gates | CC BY 4.0; verified scope/obligations required |
| `dnd5e2014` | Wizards SRD 5.1 OGL PDF artifact | authoritative alternate legal artifact; separate until body equivalence is proven | no by default | OGL 1.0a; full license and Section 15 required |
| `dnd5e2024` | Wizards SRD 5.2.1 CC PDF artifact | authoritative original; initial semantic corpus candidate | yes only after all gates | CC BY 4.0; verified scope/obligations required |
| `dnd5e2024` | Wizards SRD 5.2.0 CC PDF artifact | authoritative historical artifact | no for new campaigns | CC BY 4.0; verified scope/obligations required |
| migration | official conversion guide | bibliographic/migration evidence | no | reuse rights remain `unknown` unless explicit license evidence proves scope; do not assume the SRD license covers it |
| either exact generation | pinned `5e-bits`, Open5e, or other verified JSON snapshot | derived transport | never | record software and content claims separately |
| exact campaign/ruleset | owner-authored homebrew | campaign homebrew | only its authorized campaign | author declaration/terms |

### Artifact snapshots

`[INFERENCE]` Preserve for every fetched source artifact:

- original source ID, publisher, exact SRD version, generation, and license;
- source role and all revision/segment/record-scoped derivation-link IDs;
- original URL and immutable upstream revision when one exists;
- acquired-at UTC timestamp, byte length, SHA-256, HTTP ETag/Last-Modified;
- content-addressed snapshot locator;
- linked rights decision, immutable license evidence, and structured obligation-set revision;
- parser/extractor/schema version;
- source-page/segment manifest revision;
- independent authenticity, integrity, semantic-reconciliation, and rights validation reports with verifier identity/time.

`[INFERENCE]` Also snapshot the official hub, release/update article, FAQ/license page, changelog, and license-code pages used to establish publisher, version/currentness, and permission. Store URL, fetched bytes/text, hash, timestamp, locator, and claim-to-evidence links. A binary alone cannot prove what the publisher page said on acquisition day.

`[INFERENCE]` A versioned Wizards URL has a known limitation: Wizards still controls the bytes. DungeonMasterOS therefore stores the retrieved bytes by content hash and quarantines same-version drift rather than fabricating upstream immutability.

`[INFERENCE]` On this SQLite deployment, the initial fallback persistence contract is a content-addressed `source_artifact_blobs` table in the same database: SHA-256 primary key, media type, byte length, immutable BLOB bytes, and creation time. `SourceArtifactSnapshot.sha256` references that key; reads recompute both length and hash; identical bytes deduplicate; and no referenced blob is deleted. This keeps source bytes inside the same backup/restore boundary as manifests and campaign snapshots. If Claude's landed Phase 2A already provides an artifact store with equivalent retention, integrity, transactional-reference, and backup semantics, reuse it instead of creating the fallback table. Moving bytes to object storage later would require a separately reviewed, copy-verify-switch migration that retains the SQLite bytes until every reference and backup restore is proven.

`[DERIVED SOURCE]` A Git commit makes a mirror snapshot reproducible. It does not make the mirror authoritative or repair incomplete license metadata. Every accepted transport record needs commit-permalinked evidence plus record/segment lineage to the verified official corpus; a repository's MIT software license does not license its embedded game content.

## Source manifest and corpus coverage

`[INFERENCE]` Use one independent semantic manifest per exact `SemanticCorpusRevision`, with evidence locators into one or more immutable artifacts. Maintain a separate artifact inventory so two legally different wrappers are not mistaken for two copies of a rule—or merged before equivalence is proven. Do not build a “5e manifest” that combines generations.

```ts
interface SourceManifestSegment {
  semanticCorpusRevisionId: string;
  segmentKey: string;
  locator: {
    artifactSnapshotId: string;
    artifactSha256: string;
    physicalPdfPageIndexStart: number; // zero-based PDF page index
    physicalPdfPageIndexEnd: number;
    printedPageLabelStart: string | null;
    printedPageLabelEnd: string | null;
    headingPath: readonly string[];
    evidenceSpanHash: string;
  };
  expectedFamily: string | null;
  acquisitionStatus: "discovered" | "fetched" | "hash_verified" | "drifted";
  extractionStatus: "unparsed" | "parsed" | "structured" | "failed";
  semanticVerificationStatus: "unverified" | "verified" | "rejected" | "quarantined";
  rightsVerificationStatus: ContentRightsStatus;
  disposition:
    | "canonical"
    | "reference_only"
    | "legal"
    | "index"
    | "out_of_scope"
    | "manual_review";
  canonicalRevisionIds: readonly string[];
}
```

`[INFERENCE]` SRD 5.1 needs a generated/reviewed heading-page map because its official PDF lacks a TOC. SRD 5.2.1 can seed top-level boundaries from its official TOC. Both still require page-anchored entity discovery and duplicate detection.

`[INFERENCE]` Artifact integrity, extraction, semantic correctness, rights, canonical ingestion, and automation are independent axes. They must never be rolled into one jaunty `complete = true`; checkmarks are not a data model.

### Coverage gates

A corpus release may be marked complete only when:

1. every source page/segment has an explicit reviewed disposition;
2. every in-scope canonical candidate has exactly one generation-qualified identity or a documented duplicate relationship;
3. every canonical revision has physical-PDF and printed-page anchors, matching source artifact hash, evidence-span hash, and revision/segment lineage;
4. all expected entity-family counts are generated from the authoritative manifest, not a community API;
5. orphan, duplicate, cross-ruleset, and unverified-transport counts are zero or explicitly waived with evidence;
6. rights status is `verified_open` for every included segment and immutable license/obligation artifacts are present;
7. a second verification pass reproduces the normalized payload hashes;
8. no closed-content source supplied missing prose/mechanics.

## Campaign source enablement

`[INFERENCE]` Resolve source visibility and mechanics from the same server-owned policy:

- `core_only`: the campaign release's exact verified-open semantic core corpus revisions and immutable evaluated manifest;
- `all_official`: authenticated, integrity-verified, semantically reconciled, `verified_open`, campaign-selectable authoritative corpus revisions for the exact mechanical ruleset and applicable setting only;
- `custom`: owner-selected corpus/homebrew revisions that pass exact-mechanical-ruleset, role, setting, publication, rights-scope, and permission checks;
- `campaign_homebrew`: only revisioned content owned/authorized for that campaign and declared compatible with its exact ruleset.

`[INFERENCE]` Derived transports, rights-unknown/closed content, quarantined evidence, bibliographic records, other-generation sources, and cross-setting sources fail closed. Compendium browsing may expose a global library view, but adding/resolving an entity in a campaign must use the campaign source resolver and the pinned evaluated manifest.

`[INFERENCE]` The additive source-policy migration must explicitly backfill existing `dnd35e` official/third-party/homebrew rows with reviewed role, verification, rights, and currentness values before the stricter resolver activates. It must prove existing 3.5 campaign selections retain their prior effective set; a new fail-closed predicate that accidentally returns zero sources is not a triumphant security improvement.

`[INFERENCE]` A future hybrid-content option is not equivalent to `all_official`. It would need explicit cross-ruleset definition selection and mechanics precedence and remains a non-goal.

## Mechanics architecture

### Registry and profile decomposition

`[INFERENCE]` Avoid one giant switch and avoid a bag of global helpers. Register an exact ruleset definition whose policy modules implement typed contracts:

```ts
interface RulesetDefinition {
  id: MechanicalRulesetId;
  familyId: string;
  generation: "3.5" | "legacy-5e" | "2014" | "2024";
  uiLabel: string;
  selectableForNewCampaigns: boolean;
  characterCreation: CharacterCreationPolicy;
  advancement: AdvancementPolicy;
  rolls: RollPolicy;
  combat: CombatPolicy;
  conditions: ConditionPolicy;
  environment: EnvironmentPolicy;
  rests: RestPolicy;
  spellcasting: SpellcastingPolicy;
  equipment: EquipmentPolicy;
  creatures: CreaturePolicy;
}
```

Neutral services own dice generation, transactions, logs, target/LOS calculations, inventory persistence, timers, and WebSocket publication. Policy modules own every differing rule described in the difference matrix.

### Required policy boundaries

`[INFERENCE]`

- `CharacterCreationPolicy`: origin construction, allowed class/race/species/background/feat definitions, ability allocation, languages, and initial resources.
- `AdvancementPolicy`: XP/level thresholds, class/subclass grants, ASI/feat choices, multiclass validation, resource maxima, and post-level behavior.
- `RollPolicy`: D20 kind, automatic outcome rules, proficiency/expertise, tool-and-skill relevance, single-proficiency-bonus application, Advantage/Disadvantage sources, rerolls, target-authorized voluntary save failure, and exhaustion/condition modifiers.
- `CombatPolicy`: surprise, initiative, action semantics, Attack sequences, unarmed/grapple/shove, opportunity attacks, simultaneous multi-target damage grouping, damage/critical handling, Speed-zero restrictions on voluntarily becoming Prone, melee-versus-ranged underwater weapon handling, movement, death/knockout (including revised rest/HP/first-aid termination), and encounter transitions.
- `ConditionPolicy`: versioned condition effects, source/target links, stacking, duration, termination, and derived state. Revised Invisible and Incapacitated have explicit initiative, concentration, speech, Bonus Action, targeting, and observer-visibility semantics; they are not vague condition-name flags.
- `EnvironmentPolicy`: `breath_expired | choking` suffocation onset, breath/round/end-of-turn timers, ruleset-specific terminal/recovery effects, falling and liquid-impact reactions, underwater context, hazards, and source-linked adjudication when a procedure is not executable.
- `RestPolicy`: prerequisites, time, interruption, resumption, hit-die spending, resource recovery, exhaustion, and last-rest constraints.
- `SpellcastingPolicy`: spell preparation/known state, list membership, action/slot restrictions, rituals, concentration, typed target/area shapes including mobile Emanations and origin inclusion, and effect capability dispatch.
- `EquipmentPolicy`: equip/unequip, weapon properties/Mastery, armor-category training, separately evaluated shield training/AC benefit, item activation, attunement, charges, crafting, and consumables.
- `CreaturePolicy`: native stat-block projection, displayed save modifiers kept separate from save proficiency/source, CR/proficiency derivation, action validation, monster-at-zero policy, and canonical monster references.

`[INFERENCE]` `dnd5e2014` and `dnd5e2024` may point to the same neutral helper for proven-identical behavior, but the registry must still make that decision explicit. Tests must exercise both IDs; an untested shared default is merely leakage with excellent posture.

`[INFERENCE]` Revised-only contracts require explicit authority and grouping metadata. A `declineSave` intent is valid only from the affected character's resolved owner or the DM for a DM-controlled target, is recorded as an audit event, and is never inferred by AI. A simultaneous effect records whether damage is one shared roll for multiple saving-throw targets or separate per attack/target under the selected generation. Revised tool-plus-skill Advantage records both proficiencies and the adjudicated relevance source while applying proficiency bonus only once. Armor-category penalties and shield AC eligibility are separate evaluators.

## Character, item, and event provenance

`[INFERENCE]` Future persisted rules-bearing instances need:

```ts
interface RulesBearingInstanceProvenance {
  mechanicalRulesetId: MechanicalRulesetId;
  campaignRulesSnapshotId: string;
  canonicalEntityId: CanonicalId | null;
  canonicalRevisionId: string | null;
  createdBy: "canonical" | "campaign_homebrew" | "platform_homebrew" | "legacy";
  conversionLineageId: string | null;
}
```

`[INFERENCE]` Apply equivalent provenance to characters, item instances, prepared spell selections, active effects, encounter participants, queued actions, rule-resolution events, and roll logs as appropriate. Avoid duplicating fields where an immutable foreign key already proves them, but do not rely on a campaign field that can later change without snapshot history.

`[INFERENCE]` Player-owned free text and `characterData` remain untouched during additive provenance backfill. Canonical references are optional/unresolved until an explicit mapping is accepted.

`[INFERENCE]` Historical state needs an explicit replay classification. The backfill attaches an exact captured legacy release/snapshot to records whose enclosing state proves it, preserves raw inputs/outputs, and marks older events/effects/encounters `legacy_unreplayable` when evaluator/source evidence is insufficient. Conversion never reinterprets such history under the target generation; it starts a new lineage boundary while retaining the old bytes and classification.

### Character ownership identity

`[REPOSITORY FACT]` Character rows have required `visitorId` and nullable `userId`, while routes use both identities in different combinations. `[INFERENCE]` Before conversion, define one server-resolved `CharacterOwnershipRecord` with immutable ownership revisions and states `resolved_user`, `resolved_visitor`, `orphaned`, `conflicting`, `transfer_pending`, and `merged`. Authenticated account linking, anonymous visitor continuity, account merge, transfer, and orphan remediation each require explicit authorization/evidence and audit tests. A conversion draft may be created for unresolved characters, but it cannot be approved or committed until every affected character has exactly one authorized reviewer or an audited DM-owned-NPC disposition.

## Legacy `dnd5e` strategy

### Classification state

`[INFERENCE]` Existing bare `dnd5e` campaigns backfill to `legacy_unresolved`, not `dnd5e2014` or `dnd5e2024`:

```ts
type RulesetResolutionState =
  | "explicit"
  | "legacy_unresolved"
  | "conversion_draft"
  | "conversion_review"
  | "conversion_committed";
```

`[REPOSITORY FACT]` The frozen engine and compendium contain unclear/custom behavior and both item generations. `[INFERENCE]` No trustworthy column proves original intent, so silently assigning an edition would manufacture provenance.

### Legacy compatibility release

`[INFERENCE]` Before changing 5e mechanics, capture a tested legacy compatibility release describing existing intended behavior and known defects. Existing campaigns continue resolving through `dnd5e` until explicitly classified. Until the first explicit `dnd5e2014` release passes its fixed gate, new campaigns may still select this captured legacy release only through a visibly labelled **D&D 5e (Legacy compatibility; generation not pinned)** option and an acknowledgement warning. Publishing the first selectable 2014 release atomically replaces that option with `dnd5e2014`; disabling or rolling back that release gate restores the warned legacy option without relabelling any campaign. After that transition, bare `dnd5e` is not ordinarily selectable.

`[INFERENCE]` The first schema migration creates exactly one content-addressed legacy evaluator artifact, `dnd5e` semantic-corpus placeholder, ruleset release, evaluated-corpus manifest, and campaign snapshot for each current legacy policy/source combination. Backfill is additive and idempotent, stores its classification basis, and exposes `pending`, `complete`, and `repair_required` states. Rollback is operational: disable new exact-context writers/read projections as necessary and restore the warned legacy creation selector, while retaining every backfill link, nullable column, evidence row, artifact byte, manifest, release, and snapshot for audit/re-entry. It never deletes or rewrites campaign, character, item, effect, encounter, roll, or message payloads. Re-running after interruption repairs the same deterministic IDs rather than minting alternatives.

`[INFERENCE]` Known defects—3.5 client adapter fallback, aggregate attack bonus added to damage, generic natural-1/20 outcomes, incomplete source synchronization—must not be celebrated as sacred rules. Each needs separately authorized remediation, regression evidence, release notes, and a decision about whether behavior-changing fixes require campaign opt-in.

### Legacy compendium

`[INFERENCE]`

- Preserve `dnd5e-2014:<record>` and `dnd5e-2024:<record>` keys exactly.
- Add alias/crosswalk rows to generation-qualified canonical revisions; do not rewrite inventory foreign keys in place.
- Audit and disposition null, malformed, deleted-target, duplicate, custom/homebrew, and cross-generation keys. Preserve the original key/payload and attach `mapped`, `ambiguous`, `unmapped`, `invalid`, or `cross_generation` status plus evidence; no malformed row is silently dropped.
- Preserve custom DMOS items as homebrew/platform definitions with explicit ruleset compatibility claims and provenance.
- Quarantine ambiguous or conflicting mappings for manual review.
- Keep old revisions resolvable even if the current catalogue hides them or marks a later revision current.
- Never let an aggregate item count stand in for source synchronization or manifest completeness.

## Explicit campaign conversion workflow

`[OFFICIAL SOURCE]` Wizards' campaign guidance recommends group agreement, duplicating the old sheet, retaining the legacy sheet, and rebuilding/reviewing character choices. `[INFERENCE]` DungeonMasterOS should encode at least that much caution.

```text
Owner requests conversion draft
  -> server checks campaign is not in combat/in-flight rules state
  -> immutable pre-conversion rules snapshot plus complete conversion-state snapshot
  -> one draft projection per character/item/effect
  -> deterministic exact mappings applied only to the draft
  -> unresolved player/DM choices listed
  -> each Character Owner reviews their character changes
  -> Campaign Owner reviews campaign/encounter/source policy
  -> server revalidates source revisions + optimistic versions
  -> atomic commit creates new rules snapshot and conversion lineage
  -> WebSocket broadcasts one versioned conversion event
  -> if no later state-changing event exists, rollback restores complete pre-conversion state through a new audited event
  -> otherwise rollback is refused and a previewed forward conversion/reconciliation is required
```

### Conversion preconditions

`[INFERENCE]` Fail closed if:

- an encounter is active;
- a turn, reaction window, spell cast, rest, death-save sequence, suffocation episode, falling/liquid-impact reaction, knockout rest/first-aid window, or other mechanics transaction is in progress;
- any affected character lacks a resolvable owner/review state;
- an anonymous, orphaned, conflicting, merged, or transferred character identity lacks an explicit resolved ownership revision;
- a required canonical revision/source snapshot is missing or quarantined;
- the campaign state version changed after preview;
- a mapping remains marked `manual_review` without an explicit authorized disposition;
- source enablement would cross rulesets or include unauthorized content;
- a requested one-click rollback has any later state-changing event in its lineage.

### Automated versus reviewed changes

`[INFERENCE]` Automation may preserve narrative data and currency, create choice slots, apply proven display aliases, and recalculate derived values only after approved choices. Original XP and level remain immutable source evidence; any target level/progression is a reviewed proposal, never an in-place overwrite. Legacy species ASI contributions may be removed automatically only when stored provenance separates those contributions from base scores, later ASIs, effects, tomes, and manual edits. Otherwise all six target ability scores remain unresolved for player review, matching the rebuild posture of the official guidance.

`[INFERENCE]` Each inventory instance receives exactly one reviewed target disposition: `mapped_replacement` to an exact target-generation canonical revision, `retained_inert_reference` with no executable effects, `authorized_target_homebrew`, or `removed_from_target_draft_but_preserved_in_legacy_snapshot`. Strict rulesets never execute the source generation's item definition through a preserved legacy key. Automation may propose candidates but may not choose class/subclass/background/feat/species/spells/Mastery, reinterpret active conditions/resources, or replace monsters/items solely by name.

`[INFERENCE]` Conversion never consumes an AI/DM turn. AI may explain a diff after deterministic generation, but it cannot approve choices, set authoritative numbers, or commit state.

## AI / DM integration

`[REPOSITORY FACT]` The current prompt receives campaign settings, party identity, world state/memory, currencies, and authoritative inventory. Its **only ruleset-specific context** is the raw `campaign.ruleset`; it receives no generation-specific release, source/canonical revisions, or deterministic capability map. Intent tags and server resolution already establish an authority seam.

`[INFERENCE]` Build prompt context from the server-resolved snapshot:

```ts
interface ResolvedRulesPromptContext {
  mechanicalRulesetId: MechanicalRulesetId;
  playerFacingName: string;
  rulesetReleaseId: string;
  campaignRulesSnapshotId: string;
  enabledCorpusSummaries: readonly {
    semanticCorpusRevisionId: string;
    displayName: string;
    role: RuleSourceRole;
  }[];
  deterministicCapabilities: readonly string[];
  relevantCanonicalFacts: readonly {
    canonicalRevisionId: string;
    fact: string;
  }[];
  unsupportedAdjudications: readonly string[];
}
```

`[INFERENCE]` Prompt rules:

- state the exact generation and never ask the model to infer it;
- include only server-resolved, campaign-enabled canonical facts;
- source prose is quoted/data context, never system instruction;
- model outputs typed intent with canonical IDs where supported;
- target-owned choices such as revised voluntary save failure require a separately authenticated user/DM intent; the model cannot infer or submit consent;
- server ignores AI-supplied HP, AC, proficiency, save DC, damage modifier, resource count, ownership, or outcome when authoritative state exists;
- server rejects IDs from another ruleset/source snapshot;
- unsupported mechanics produce an explicit `requires_adjudication` result without silent mutation;
- narration occurs after deterministic outcome and cannot rewrite it.

## Automation maturity and capability tracking

`[REPOSITORY FACT]` The canonical architecture already distinguishes ingestion from automation. `[INFERENCE]` Retain that separation and add per-capability evidence instead of treating one aggregate flag as proof of full execution.

| Entity/rule family | First safe milestone | Later deterministic milestone | Must remain explicit |
|---|---|---|---|
| Source artifacts/manifests | hashed, page-mapped, source-verified | deterministic drift/completeness checks | No gameplay automation claim. |
| Character origins | structured options/choices | server validates exact creation package | Narrative/personality remains player-authored. |
| Class/progression | structured level grants | level-up and resource maxima enforced | Each feature effect has its own capability. |
| Feats/features | structured prerequisites/grants | eligibility plus supported effects | Complex exceptions stay reference-only until tested. |
| Spells | searchable verified records/lists | casting transaction plus selected spell effects | Presence never implies range/target/save/concentration/scaling enforcement. |
| Conditions/actions | structured definitions | deterministic application/termination for named set | Unsupported nuance returns adjudication request. |
| Equipment/items | verified catalogue and instance links | equip, property, attunement, action cost, selected effects | Same-name versions never merge. |
| Monsters | verified native stat blocks | supported attacks/saves/effects through exact actions | Lore/tactics and unsupported actions remain reference/AI-assisted. |
| Travel/hazards/GM rules | source-linked reference | selected deterministic procedures | DM adjudication remains first-class where rules require it. |

`[INFERENCE]` A canonical revision may be `verified` and `reference_only`. An entity may be `partially_executable` only when its executable capability IDs and tests are enumerated. `executable` requires all declared rules-bearing fields for that contract to have deterministic, ruleset-paired acceptance evidence.

### Fixed new-campaign selectability gate

`[INFERENCE]` `dnd5e2014` or `dnd5e2024` remains server-disabled and absent from the new-campaign picker until its release independently proves all of the following in a machine-readable acceptance report:

1. exact `MechanicalRulesetId` registry, API validation, server dispatch, and exact client adapter; unknown, catalogue-only, legacy, and other-generation IDs fail closed with no fallback;
2. a retained, `verified_open`, complete semantic core-corpus manifest with canonical identity/rights/lineage gates passing and no runtime/startup network dependency;
3. generation-correct character creation for abilities, race/species, background, class, starting feat where applicable, equipment, HP, AC, proficiency, saves, initiative, and persisted ownership/provenance;
4. server-authoritative core D20 checks/saves, initiative, attack/hit/damage/critical/zero-HP/death-save flow, action/resource accounting, short/long rests, spell preparation/known state, slot/concentration/casting transaction, and honest `requires_adjudication` behavior for every non-executable feature/spell/monster action;
5. campaign-scoped Library/compendium resolution and AI prompt context use only the pinned evaluated corpus; same-slug cross-generation lookups and source-policy bypasses fail;
6. state/snapshot optimistic concurrency, transactional outbox, duplicate/reconnect handling, ownership authorization, and proof that deterministic/source/conversion operations do not alter billing or AI-turn counters;
7. the release has an explicit disposition for every companion-matrix difference: each executable capability has the applicable generation assertion (and, once both siblings exist, a paired assertion), while non-executable behavior is source-linked and returns `requires_adjudication`; existing `dnd35e` plus legacy `dnd5e` regression suites pass unchanged or under an explicitly versioned compatibility decision.

Searchable spells/monsters may remain honestly labelled `reference_only` or `partially_executable`, but the acceptance report lists every supported evaluator capability and the UI must not offer an unsupported action as automatic. This gate is fixed by the present design; changing it requires a reviewed specification revision, not a conveniently green subset of tests.

## Integration map against the emerging 3.5 architecture

### A. Reuse as generic

- `[REPOSITORY FACT]` `rule_sources`, provenance/license metadata, campaign source selection, canonical ID namespacing, append-only revisions, and separate ingestion/automation status exist as Phase 0/1 foundations.
- `[INFERENCE]` Reuse those concepts, server-owned source resolution, immutable revisions, intent/validation/logging, and rules-adapter presentation contracts.
- `[INFERENCE]` Reuse source-page/artifact evidence, hashing, status transitions, and drift concepts once their implemented Phase 2A contracts are verified.

### B. Generalize after revalidation

- `[INFERENCE]` Allow exact generation ruleset IDs and fail-closed registries.
- `[INFERENCE]` Add source roles, many-to-many segment/record transport lineage, and explicit campaign selectability.
- `[INFERENCE]` Generalize manifest locators beyond HTML pages to PDF artifacts/page ranges.
- `[INFERENCE]` Connect legacy compendium/canonical entities to the shared source resolver.
- `[INFERENCE]` Add immutable ruleset releases/campaign snapshots and rules-bearing instance provenance.
- `[INFERENCE]` Scope action/condition/creature primitives when meanings differ rather than declaring 3.5 vocabulary universal.

### C. Keep deliberately 3.5-specific

- BAB/iterative attacks, three saves and good/poor save progressions;
- 3.5 race/size/skill-rank formulas, spell DC, and carrying capacity;
- d20srd/olimot source seeds, closure classification, and `dnd35e` manifest restrictions;
- 3.5 entity fields not supported by actual 5e source structure.

### D. Unsafe until Phase 2A lands

`[REPOSITORY FACT]` The frozen branch contains a Phase 2A plan, not its proposed manifest/snapshot/storage implementation.

The following concepts are design dependencies but all concrete names, imports, schemas, migrations, repositories, status transitions, and scripts carry:

> **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION**

- source-derivation storage and rule-source migration shape;
- source manifest entry types/tables;
- page/artifact processing status and transition APIs;
- source-page/artifact revision storage;
- discovery/classification services and evidence reports;
- verification permissions and internal routes;
- snapshot storage and hashing contracts;
- acceptance-scan/report formats.

`[INFERENCE]` Reuse the landed architecture rather than creating parallel 5e-only tables if the landed interfaces preserve these invariants. If they remain HTML/3.5-specific, generalize them in a small prerequisite phase before adding 5e data.

## Security and state integrity

### Authorization

`[INFERENCE]`

- Only Campaign Owners may change campaign rules/source policy or initiate/commit campaign conversion.
- Character Owners approve choices and conversions for their characters; campaign ownership alone does not silently grant character ownership.
- Server reloads ownership and campaign membership inside the mutation transaction.
- Source ingestion/verification endpoints are internal/admin-only; no public route accepts arbitrary URLs or marks sources verified.
- Compendium reads used for campaign actions require campaign access and server-resolved source scope.

### Ingestion safety

`[INFERENCE]`

- Allowlist official source hosts and approved transport repositories; block arbitrary redirects/private-network targets.
- Enforce TLS, response-size/time limits, content type, PDF parser limits, and deterministic extraction versions.
- Treat PDFs, HTML, and JSON as untrusted input; escape/sanitize rendered content and prevent formula/script execution.
- Quarantine hash drift, malformed records, cross-ruleset IDs, missing licenses, duplicate identities, and source-page mismatches.
- Never place source prose into system prompts as instructions.
- Preserve attribution/license metadata in exports and record transformations/modifications.
- Run network acquisition only through a separately invoked internal/admin ingestion workflow. Application startup, request handling, campaign creation, mechanics resolution, and published-release reads never fetch upstream sources; they consume retained content-addressed artifacts, semantic corpora, canonical revisions, and evaluated manifests only.

### Transaction and multiplayer integrity

`[INFERENCE]`

- Use idempotency keys for state-changing rules commands and conversion commits.
- Lock/read campaign rules snapshot and character/encounter versions in the same transaction as mutation.
- Reject stale snapshot/state versions and duplicate events.
- `[REPOSITORY FACT]` The frozen repository broadcasts directly through an in-memory WebSocket registry; no established transactional outbox was found.
- Add a durable, versioned transactional outbox as an explicit prerequisite to conversion and new multi-generation mutations. Commit state, roll/event provenance, and the outbox row in one database transaction; publish only committed rows.
- Prove commit-before-broadcast, broadcast failure/retry, duplicate delivery, reconnect/catch-up, idempotent consumer, and ordered campaign-state-version behavior before relying on one multiplayer outcome.
- Broadcast exact `campaignRulesSnapshotId`, state version, and event ID so every client projects the same rules generation.
- Never charge billing/turn economy for ingestion, verification, source selection, migration preview/commit, or deterministic retry.

## Failure behavior

| Failure | Required behavior |
|---|---|
| Unknown ruleset ID | Explicit unsupported error; no fallback. |
| Missing ruleset release/snapshot | Stop mutation; expose repair state to authorized users. |
| Canonical ID from another ruleset | Reject and audit; never cross-resolve by slug. |
| Missing/unverified canonical revision | No deterministic effect; return reference/manual adjudication state. |
| Derived transport disagrees with official snapshot | Quarantine candidate and retain both evidence records. |
| Source version drift | Create candidate snapshot/diff; do not overwrite or enable automatically. |
| Unsupported mechanic | No invented state; structured `requires_adjudication` outcome. |
| Stale multiplayer request | Conflict/retry without double roll, double damage, double resource spend, or billing. |
| Conversion loses ownership/source/state precondition | Abort atomically; preserve original and draft evidence. |

## Observability and audit requirements

`[INFERENCE]` Record and expose to authorized maintainers:

- mechanical ruleset ID/release and campaign snapshot on every mechanics event;
- canonical/source revision IDs used to calculate an outcome;
- evaluator capability/version and normalized inputs/outputs;
- source manifest coverage by disposition/family;
- ingestion and automation coverage separately;
- cross-ruleset lookup rejections;
- source drift/quarantine events;
- conversion draft/approval/commit/rollback lineage;
- source-selection authorization failures;
- WebSocket state-version conflicts and idempotent replays;
- proof that rules operations did not mutate billing/turn counters.

## Recommended delivery order

`[INFERENCE]`

1. Revalidate/merge-safe catalogue-versus-mechanics identity and fail-closed dispatch foundation.
2. Capture the exact legacy `dnd5e` compatibility artifact/release/snapshots and add idempotent provenance/replay classification without reinterpreting history.
3. Reuse/generalize landed Phase 2A source, artifact, semantic-corpus, rights, manifest, and verification architecture; backfill existing `dnd35e` policy before enforcing it.
4. Establish the durable transactional outbox/versioned event prerequisite.
5. Register/hash/manifest the official SRD 5.1 CC artifact and its claim-bearing web/license evidence through an offline ingestion workflow.
6. Build verified 2014 canonical definitions and read-only Library projections.
7. Introduce 2014 deterministic policies incrementally with paired `dnd35e` and legacy non-leakage tests.
8. Make new `dnd5e2014` campaigns selectable only after the fixed acceptance gate passes.
9. Register/hash/manifest SRD 5.2.1 as an independent sibling corpus.
10. Build revised canonical definitions and paired 2014/revised mechanic tests.
11. Make `dnd5e2024` selectable only after its independent fixed gate passes.
12. Add optional conversion drafts only after both source rulesets, ownership identity, event provenance, and legacy snapshots are stable.

`[INFERENCE]` The 2014-first order is supported by repository compatibility and risk, not by a claim that 2014 is universally “better” or that revised support can share unverified legacy data.

## Alternatives rejected

### One `dnd5e` plus an optional edition filter

Rejected because campaign dispatch, canonical IDs, classes, prompts, compendium resolution, and fallbacks can lose or ignore the filter. The existing repository already demonstrates this contamination mode.

### Rename `dnd5e` to `dnd5e2014` in a bulk migration

Rejected because current code/data include revised compendium records, custom behavior, and unclear semantics. The migration would assert provenance not present in stored state.

### Make revised 2024 the default for all campaigns

Rejected because it violates historical replay, official side-by-side coexistence, and the explicit requirement that old campaigns never silently change.

### One canonical spell/item/condition record with per-campaign patches

Rejected because a record would not have immutable meaning, provenance, or reproducible revision history. Same-name mechanics differ.

### Let the AI choose or explain the edition at runtime

Rejected because prompt context is not authority, results are not reliably replayable, and model output cannot substitute for campaign state or deterministic validation.

### Use community JSON as the canonical source

Rejected because mirrors are derived/mutable, can contain mixed publishers or incomplete license metadata, and do not prove official page-level correctness.

## Acceptance criteria for this architecture

The future foundation satisfies this specification only when all are true:

- The broad catalogue `RulesetId` and narrow `MechanicalRulesetId` are distinct; `dnd35e`, `dnd5e2014`, and `dnd5e2024` dispatch explicitly while catalogue-only/unknown IDs fail closed.
- Existing bare `dnd5e` campaigns remain unchanged and identifiable as legacy/unresolved until explicit action.
- Before the first explicit 2014 release, new campaign UI labels bare `dnd5e` as legacy/unpinned and requires warning acknowledgement; the persisted fixed gate later replaces it atomically with `dnd5e2014`, and gate rollback restores the warned fallback without changing existing rows.
- Same-slug 2014/revised canonical IDs and revisions coexist without collision or fallback.
- Campaign rules snapshots pin a retained, content-addressed evaluated-corpus manifest containing exact semantic corpora, canonical/homebrew/policy revisions, hashes, and evaluator artifact.
- Official artifacts, semantic corpora, claim-bearing web/license evidence, and derived transports have distinct provenance records, immutable hashes, and many-to-many segment/record lineage.
- Campaign source selection cannot enable derived, rights-unknown/closed, quarantined, other-ruleset, or unauthorized content; existing 3.5 selections survive the policy backfill.
- Legacy item keys and payloads remain resolvable unchanged with explicit mapping/disposition status for malformed, null, custom, missing, duplicate, and cross-generation cases.
- Character/item/effect/encounter/roll/event provenance survives revision currentness changes; insufficient historical evidence is preserved as `legacy_unreplayable`, never reinterpreted.
- AI cannot select ruleset/source precedence or override authoritative numbers/outcomes.
- Every automated difference has independent 2014/revised tests and no-leakage coverage against 3.5e.
- Manifest completeness and automation coverage are reported separately.
- Conversion is explicit, previewed, owner-resolved, reviewed, atomic, and blocked during transient mechanics state; one-click rollback is limited to lineages with no later state-changing event, otherwise reversal is a forward reconciliation.
- Multiplayer clients receive one versioned authoritative outcome through a durable outbox with tested retry, duplicate, ordering, and reconnect behavior.
- Billing/turn counters are unchanged by rules infrastructure and conversion operations.
- No closed or rights-unknown content is ingested into a selectable/re-distributed corpus.
- Neither generation appears for new campaigns before every item in the fixed selectability gate passes.

## Open questions

- `[OPEN QUESTION]` Which production `dnd5e` campaigns and item references exist, and what reliable creation/source evidence can classify them? This requires separately authorized read-only production inventory.
- `[OPEN QUESTION]` Should same-generation SRD point-release adoption be per-campaign opt-in, mandatory for security/data corrections only, or split by change category?
- `[OPEN QUESTION]` Will a reproducible normalized-body comparison prove the CC and OGL SRD 5.1 artifacts are two legal representations of one semantic corpus? Until it does, retain separate corpus candidates; artifact wrappers are never independently campaign-selectable.
- `[OPEN QUESTION]` What exact manifest/snapshot interfaces will Claude's Phase 2A implementation land?
- `[OPEN QUESTION]` Will Claude's landed Phase 2A provide an artifact-byte store that satisfies the retention/integrity contract above? If not, use the documented SQLite BLOB fallback; either choice still requires a production backup-and-restore rehearsal before source publication is enabled.
- `[OPEN QUESTION]` Which current DMOS custom mechanics are intentional product policy and which are defects/scaffolding?
- `[OPEN QUESTION]` Is any hybrid legacy/revised content mode desired? It needs a separate specification and cannot be inferred from official “compatibility” language.
- `[OPEN QUESTION]` How should existing campaigns opt into clear defect fixes when strict historical replay conflicts with correcting unintended mechanics?

## Revalidation boundary

This design is based on the captured SHA and deliberately does not chase Claude's in-progress branch. Before any implementation task touches shared rules, source, manifest, storage, migration, or verification contracts:

> **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION**

If Phase 2A changes names or shapes while preserving the invariants above, the implementation plan should adapt to the landed interfaces rather than recreating this document's provisional type names.

## Non-implementation confirmation

`[EXECUTION ATTESTATION]` This specification changed documentation only. It did not rename/register rulesets, alter shared architecture, write migrations, ingest SRD data, change source enablement, modify prompts/UI/mechanics, touch campaign/character data, deploy, access the VPS, merge, or modify `production-live-base`.
