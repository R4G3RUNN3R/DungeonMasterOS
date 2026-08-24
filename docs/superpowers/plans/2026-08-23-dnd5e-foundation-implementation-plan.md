# D&D 5e Canonical Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver independently versioned, legally evidenced, server-authoritative D&D 5e 2014 and 2024 foundations without changing the meaning of existing bare `dnd5e` or `dnd35e` campaigns.

**Architecture:** Separate the product/catalogue `RulesetId` from `MechanicalRulesetId`, and construct an exact server-owned `RulesContext` from immutable releases, semantic-corpus revisions, and an evaluated-corpus manifest. Preserve source artifacts and semantic rules bodies as different records with many-to-many lineage and scoped rights obligations. Build every 2014 entity family, verification report, and fixed-selectability capability before starting its independent 2024 equivalent; conversion is a complete-state snapshot transition with a constrained rollback policy.

**Tech Stack:** TypeScript, Node.js, Drizzle ORM with SQLite, `runMigrations()` / `addColumnIfMissing`, Node `crypto.createHash`, `node --import tsx --test`, existing WebSocket server, Vite/React.

**Spec:** `docs/superpowers/specs/2026-08-23-dnd5e-multi-generation-ruleset-design.md`

## Global Constraints

- **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** at the beginning of every phase. Read the landed Phase 2A interfaces and replace only provisional plan names by a reviewed documentation update before coding against them.
- `RulesetId` remains the six-value catalogue/product type. `MechanicalRulesetId` is exactly `"dnd35e" | "dnd5e" | "dnd5e2014" | "dnd5e2024"`; catalogue settings require an explicit `baseMechanicalRulesetId` and cannot dispatch mechanics.
- `dnd5e` is the legacy mechanical identity. Existing rows retain it and receive captured legacy evidence; no campaign is silently relabelled 2014 or 2024. Until Task 15 publishes a gated 2014 replacement, new-campaign selection retains it behind an explicit legacy/unpinned compatibility warning; Task 15 atomically swaps that option for `dnd5e2014`, and gate rollback restores the warned fallback rather than leaving users with no 5e creation path.
- Every state-changing command resolves a server-owned exact context; unknown/catalog-only/missing/quarantined/cross-ruleset input fails closed. No first-registry default, `non-dnd35e` fallback, or AI-supplied number/outcome survives on mechanics paths.
- An immutable `SourceArtifactSnapshot` stores bytes/evidence. An immutable `SemanticCorpusRevision` stores normalized rules meaning. Their many-to-many bindings, source segment/record lineage, rights decisions, and obligation-set revisions are retained. A derived transport is never authoritative merely because it is reproducible.
- A published release and every `CampaignRulesSnapshot` pin one immutable, retained `EvaluatedCorpusManifest`: sorted semantic-corpus, canonical, homebrew, source-policy, evaluator-artifact, and hash inputs. Old manifests, revisions, and artifacts are never overwritten or deleted for a newer release.
- Content rights are scoped, structured evidence. `verified_open` is required for each included segment; CC BY and OGL obligations retain their own immutable notice/link/attribution/change-indication or Section 15/Product Identity/Open Game Content evidence. `unknown`/`closed` remains bibliographic or quarantined.
- Normal application startup and campaign actions are offline from source acquisition. Network acquisition is an internal/admin-only ingestion tool using allowlisted HTTPS and injected fetches in tests; no test uses the network.
- Preserve player text, `characterData`, inventory payloads, legacy keys, old encounter/message/roll data, and original XP/level evidence. Every unknown historical mechanics input is explicitly `unreplayable`, never reconstructed from a later ruleset.
- Backfill `dnd35e` source role, verification, rights, and currentness values before activating the stricter source resolver; regression fixtures must prove its previous effective selections remain unchanged unless a reviewed waiver says otherwise.
- State mutation, exact provenance event, idempotency record, state-version advance, and durable outbox entry occur in one transaction. WebSocket sends occur after commit and always carry event ID, snapshot ID, manifest hash, and state version.
- The fixed new-campaign gate requires creation; checks/saves/initiative/combat/death; action/resources; short/long rest; spell known/prepared/slot/concentration/casting transaction; honest adjudication; exact adapter/source/prompt/outbox/billing proof. It cannot be weakened by a local green subset.
- Conversion requires Campaign Owner authority, each resolved Character Owner review, exact source availability, no in-flight state, complete pre-conversion snapshot, and a reviewed draft. One-click rollback is legal only where no later state-changing lineage event exists; otherwise create a reviewed forward reconciliation.

---

## File map

| Path | Responsibility |
|---|---|
| `shared/rulesets.ts`, `shared/rules-context.ts` | Catalogue/mechanical identity boundary and immutable context contracts. |
| `shared/rules-registry/*.ts` | Source artifacts, semantic corpora, rights/obligation evidence, manifests, canonical revisions, and capabilities. |
| `shared/schema.ts`, `server/storage.ts` | Additive migrations, immutable persistence, transactions, and rollback-safe read paths. |
| `server/rules-context-resolver.ts`, `server/rules-command-service.ts`, `server/rules-outbox.ts` | Exact dispatch, atomic mutation/event/outbox, and post-commit delivery. |
| `server/source-artifact-service.ts`, `script/*` | Internal immutable acquisition, verification, page manifests, and offline acceptance scans. |
| `server/dnd5e2014/*`, `server/dnd5e2024/*` | Generation-isolated family extractors, verifiers, policies, capabilities, and release gates. |
| `server/legacy-*`, `server/campaign-conversion-service.ts` | Legacy capture, crosswalk audit, ownership, conversion, rollback/reconciliation. |
| `client/src/lib/rulesAdapters/*`, `server/dm-engine.ts` | Exact client and AI projections from server-resolved context. |

## Phase 0 — Revalidate and freeze integration ownership

### Task 1: Record the current base and Phase 2A contract

**Files:**
- Create: `docs/superpowers/reports/2026-08-23-dnd5e-foundation-preflight.md`
- Test: `docs/superpowers/reports/2026-08-23-dnd5e-foundation-preflight.md`

**Interfaces:**
- Consumes: current `origin/production-live-base`, `docs/superpowers/plans/2026-08-22-dnd35-srd-ingestion-foundation-phase2a.md`, `shared/rulesets.ts`, `shared/schema.ts`, and `server/storage.ts`.
- Produces: a cited preflight record containing base SHA, landed Phase 2A names, migration owner, script root (`script/`), and unambiguous substitutions for this plan.

- [ ] **Step 1: Gather the baseline.**

  Run: `git fetch origin production-live-base && git rev-parse origin/production-live-base && git status --short && rg -n "SemanticCorpusRevision|SourceArtifactSnapshot|EvaluatedCorpusManifest|srd_manifest|runMigrations|export type RulesetId" shared server script docs/superpowers`

  Expected: the report records the exact fetched SHA and distinguishes landed code from design-only files.

- [ ] **Step 2: Write the failing integration checklist.**

  Add checked lines for `six catalogue IDs confirmed`, `MechanicalRulesetId absent/present`, `Phase 2A migration ownership`, `artifact/manifest interfaces`, `anonymous visitor ownership`, `script root confirmed`, and `no production data read`.

- [ ] **Step 3: Verify the checklist.**

  Run: `rg -n "ravenloft|eberron|hostVisitorId|visitorId|userId|runMigrations" shared/rulesets.ts shared/schema.ts server/storage.ts`

  Expected: every line has an exact repository citation; an unlanded Phase 2A dependency blocks its later task.

- [ ] **Step 4: Commit.**

  Run: `git add docs/superpowers/reports/2026-08-23-dnd5e-foundation-preflight.md && git commit -m "docs: record dnd5e foundation preflight"`

  Expected: one documentation-only commit. **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 2.

## Phase 1 — Identity, immutable evidence, legacy state, and commands

### Task 2: Split catalogue and mechanical identity

**Files:**
- Modify: `shared/rulesets.ts`
- Modify: `shared/schema.ts`
- Modify: `server/routes.ts`
- Create: `shared/rulesets.test.ts`
- Modify: `server/campaign-settings.test.ts`
- Test: `shared/rulesets.test.ts`, `server/campaign-settings.test.ts`

**Interfaces:**
- Consumes: existing six-value `RulesetId` and campaign ruleset column.
- Produces:

  ```ts
  type MechanicalRulesetId = "dnd35e" | "dnd5e" | "dnd5e2014" | "dnd5e2024";
  type ExplicitMechanicalRulesetCandidateId = "dnd35e" | "dnd5e2014" | "dnd5e2024";
  function isMechanicalRulesetId(value: string): value is MechanicalRulesetId;
  function getMechanicalRulesetOrThrow(value: string): MechanicalRulesetDefinition;
  ```

- [ ] **Step 1: Write failing identity tests.**

  Assert each mechanical ID validates; `ravenloft`, `eberron`, `vampire-dark-fantasy`, `post-apocalyptic`, and arbitrary text reject; display catalogue lookup may work without evaluator lookup. Assert `dnd5e2014` and `dnd5e2024` are recognized candidates but cannot be submitted. Snapshot the pre-task new-campaign selector/route behavior and prove this identity-only commit still accepts exactly the existing `dnd35e` and bare `dnd5e` choices—no release-backed descriptor is introduced before Tasks 3–4 can persist one.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test shared/rulesets.test.ts`

  Expected: FAIL because the product catalogue currently doubles as the only type boundary.

- [ ] **Step 3: Implement the boundary.**

  Retain `RulesetId` for catalogue display. Add explicit `baseMechanicalRulesetId` for settings and reject its absence at context resolution. Recognize the two explicit 5e candidates without exposing them, but preserve the current selector and create-route choices unchanged in this commit. Release-backed selectable descriptors and the warned legacy label belong to Task 4, after their persistence exists.

- [ ] **Step 4: Prove green.**

  Run: `node --import tsx --test shared/rulesets.test.ts server/campaign-settings.test.ts && npm run typecheck`

  Expected: PASS; no catalogue ID or ungated explicit 5e candidate can be submitted as mechanics, while the existing two new-campaign choices and legacy reads remain unchanged.

- [ ] **Step 5: Commit.**

  Run: `git add shared/rulesets.ts shared/schema.ts server/routes.ts shared/rulesets.test.ts server/campaign-settings.test.ts && git commit -m "feat: separate mechanical ruleset identity"`

  Expected: one identity-only commit. **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 3.

### Task 3: Persist source artifact, semantic corpus, rights, lineage, and exact evaluated manifest

**Files:**
- Create: `shared/rules-registry/source-artifacts.ts`
- Create: `shared/rules-registry/semantic-corpora.ts`
- Create: `shared/rules-registry/rights.ts`
- Create: `shared/rules-context.ts`
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Create: `server/rules-evidence-storage.test.ts`
- Modify: `server/integrity-checks.test.ts`
- Test: `server/rules-evidence-storage.test.ts`, `server/integrity-checks.test.ts`

**Interfaces:**
- Consumes: Task 2 `MechanicalRulesetId` and landed Phase 2A generic revision APIs.
- Produces:

  ```ts
  type ContentRightsStatus = "verified_open" | "closed" | "unknown";
  interface SourceArtifactBlob { sha256: string; mediaType: string; byteLength: number; bytes: Uint8Array; createdAt: string; }
  interface ObligationRecord { kind: "attribution" | "source_link" | "license_link_or_text" | "modification_notice" | "ogl_section_15" | "product_identity_exclusion" | "open_game_content_scope"; value: string; evidenceSnapshotId: string; rightsScopeHash: string; required: boolean; }
  interface LicenseObligationSetRevision { id: string; licenseFamily: "cc_by_4" | "ogl_1_0a" | "other"; obligationRecords: readonly ObligationRecord[]; appliesToRightsScopeHash: string; }
  interface ContentRightsDecision { id: string; contentRightsStatus: ContentRightsStatus; rightsScope: readonly { artifactSnapshotId: string; segmentKeys: readonly string[] }[]; obligationSetRevisionId: string | null; }
  interface SourceArtifactSnapshot { id: string; sourceRole: "authoritative_original" | "derived_transport" | "bibliographic_evidence"; publisher: string; requestedUrl: string; finalUrl: string; redirectChain: readonly string[]; acquiredAt: string; mediaType: string; sha256: string; byteLength: number; httpEtag: string | null; httpLastModified: string | null; webEvidenceSnapshotIds: readonly string[]; authenticityStatus: "unverified" | "verified" | "rejected" | "quarantined"; integrityStatus: "unverified" | "hash_verified" | "drifted" | "quarantined"; semanticReconciliationStatus: "unreconciled" | "reconciled" | "conflicting" | "quarantined"; currentness: "current" | "historical" | "withdrawn"; rightsDecisionId: string; revisesArtifactSnapshotId: string | null; }
  interface SemanticCorpusRevision { id: string; mechanicalRulesetId: MechanicalRulesetId; normalizedBodyHash: string; rightsDecisionId: string; revisesCorpusRevisionId: string | null; }
  interface SourceArtifactBinding { semanticCorpusRevisionId: string; sourceArtifactSnapshotId: string; segmentKeys: readonly string[]; normalizedBodyHash: string; }
  interface DerivedLineageEdge { derivedRecordOrSegmentLocator: string; semanticCorpusRevisionId: string; sourceArtifactSnapshotId: string; officialSourceLocatorIds: readonly string[]; contentLicenseEvidenceId: string; reconciliationStatus: "unverified" | "sampled" | "record_reconciled"; }
  interface EvaluatedCorpusManifest { id: string; mechanicalRulesetId: MechanicalRulesetId; rulesetReleaseId: string; semanticCorpusRevisionIds: readonly string[]; canonicalRevisionIds: readonly string[]; homebrewRevisionIds: readonly string[]; sourcePolicyRevisionIds: readonly string[]; evaluatorBundleArtifactSha256: string; canonicalRevisionSetHash: string; manifestHash: string; }
  ```

- [ ] **Step 1: Write failing evidence tests.**

  Assert a semantic corpus cannot cross mechanics IDs; one semantic corpus can bind multiple PDF artifacts; one artifact/segment can supply multiple canonical records; every derived record needs its own source/rights lineage edge; a `verified_open` decision covers every selected segment; CC and OGL obligation sets retain different structured requirements; publication rejects unsorted or hash-mismatched manifests. Assert BLOB writes deduplicate by SHA-256, reject a mismatched declared length/hash, recompute integrity on read, and cannot delete bytes referenced by an artifact, evidence record, corpus, manifest, release, snapshot, or historical event.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/rules-evidence-storage.test.ts`

  Expected: FAIL because current source rows flatten artifact, corpus, and rights concepts.

- [ ] **Step 3: Implement additive immutable tables and APIs.**

  Reuse Claude's landed artifact-byte store only if Task 1 proves equivalent retention, integrity, reference, and backup semantics. Otherwise add `source_artifact_blobs` through `runMigrations()` with SHA-256 primary key, media type, byte length, immutable SQLite BLOB bytes, and creation time; `source_artifact_snapshots.sha256` is a retained reference to that key. Add `source_artifact_snapshots`, `semantic_corpus_revisions`, `semantic_corpus_artifact_bindings`, `source_derivation_edges`, `content_rights_decisions`, `license_obligation_set_revisions`, `evaluated_corpus_manifests`, `ruleset_releases`, and `campaign_rules_snapshots`. Hash and length are recomputed at write/read boundaries, identical bytes deduplicate, and ordinary database backup/restore retains bytes with manifests. Store immutable sorted JSON manifest bytes in the same content-addressed store. Provide insert-only APIs; publication validates exact IDs/hashes and retained referenced rows.

- [ ] **Step 4: Define migration rollback.**

  Test migration reruns are idempotent, old campaign/character/item/roll fields are unchanged, and operational rollback disables new readers while retaining all new evidence and BLOB tables. Exercise a database backup/restore fixture and prove every artifact/manifest hash resolves afterward. Never use destructive schema reversal. Any later object-store migration must copy, verify, and switch references before it may retire unreferenced SQLite bytes; that migration is outside this foundation.

- [ ] **Step 5: Run green.**

  Run: `node --import tsx --test server/rules-evidence-storage.test.ts server/integrity-checks.test.ts && npm run typecheck`

  Expected: PASS; a campaign snapshot can prove all evaluator and content inputs, not merely its source list.

- [ ] **Step 6: Commit.**

  Run: `git add shared/rules-registry/source-artifacts.ts shared/rules-registry/semantic-corpora.ts shared/rules-registry/rights.ts shared/rules-context.ts shared/schema.ts server/storage.ts server/rules-evidence-storage.test.ts server/integrity-checks.test.ts && git commit -m "feat: persist immutable rules evidence"`

  Expected: one additive evidence commit. **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 4.

### Task 4: Capture legacy rules and historical provenance without invention

**Files:**
- Create: `server/legacy-rules-backfill.ts`
- Create: `server/legacy-rules-backfill.test.ts`
- Modify: `shared/rulesets.ts`
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Modify: `server/routes.ts`
- Modify: `client/src/pages/home.tsx`
- Modify: `client/src/pages/campaign.tsx`
- Create: `client/src/lib/campaignRulesetOptions.ts`
- Create: `client/src/lib/campaignRulesetOptions.test.ts`
- Modify: `server/routes-combat.e2e.test.ts`
- Modify: `server/campaign-settings.test.ts`
- Test: `server/legacy-rules-backfill.test.ts`, `server/routes-combat.e2e.test.ts`, `server/campaign-settings.test.ts`

**Interfaces:**
- Consumes: Task 2 identity boundary, Task 3 immutable release/manifest APIs, and bare legacy campaign rows.
- Produces: `backfillLegacyRulesState(): LegacyBackfillReport`, `historicalProvenanceStatus: "captured" | "unreplayable"`, resolution states `pending | complete | repair_required`, and—only after successful capture—the release-backed selection contract:

  ```ts
  interface RulesetSelectionGateSnapshot { legacyReleaseId: string; dnd35eReleaseId: string | null; dnd5e2014ReleaseId: string | null; dnd5e2024ReleaseId: string | null; }
  type SelectableMechanicalRuleset =
    | { id: "dnd35e"; mode: "existing"; releaseId: string | null }
    | { id: "dnd5e"; mode: "legacy_compatibility"; warningKey: "legacy_generation_unpinned"; releaseId: string }
    | { id: "dnd5e2014" | "dnd5e2024"; mode: "explicit"; releaseId: string };
  function listSelectableMechanicalRulesets(gates: RulesetSelectionGateSnapshot): readonly SelectableMechanicalRuleset[];
  ```

- [ ] **Step 1: Write red legacy fixtures.**

  Include bare `dnd5e` campaigns with character data, legacy inventory JSON, null/keyed item instances, effect, encounter participant, queued action, message, and roll log. Assert one deterministic legacy evaluator artifact, semantic-corpus placeholder, release, exact manifest, and snapshot per policy/source combination; assert historic rows without inputs get `unreplayable`. Before capture completes, the Task 2 selector remains unchanged. After an idempotent successful capture, one persisted activation switches both creation surfaces/routes to release-backed descriptors: warned bare `dnd5e` carries the exact captured release and a client-supplied alternative or missing acknowledgement rejects. Injected backfill/activation failure leaves the old selector intact, never an empty 5e choice.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/legacy-rules-backfill.test.ts client/src/lib/campaignRulesetOptions.test.ts server/campaign-settings.test.ts`

  Expected: FAIL because existing rows have no snapshot/provenance model.

- [ ] **Step 3: Implement additive, idempotent capture.**

  Backfill a captured legacy evaluator/version with explicit known-defect identifiers and classification basis, never a 2014/2024 assertion. Give every affected state row a snapshot/provenance link when evidence exists; otherwise persist exact `unreplayable` reason. After the capture transaction is complete, activate the server-owned descriptor route and both client renderers with the explicit legacy warning; do not make Task 2 depend on not-yet-created releases. Interrupted reruns repair the same deterministic IDs. Pre-activation rollback leaves the Task 2 selector; post-activation operational rollback disables new release-backed writes but retains capture rows and never rewrites legacy payloads.

- [ ] **Step 4: Prove historical isolation.**

  Test that later target-generation conversion leaves pre-conversion roll, encounter, message, and effect views tied to their old snapshot or visibly unreplayable; no historical read uses the new campaign snapshot.

- [ ] **Step 5: Run green and commit.**

  Run: `node --import tsx --test server/legacy-rules-backfill.test.ts server/routes-combat.e2e.test.ts server/campaign-settings.test.ts client/src/lib/campaignRulesetOptions.test.ts && npm run typecheck && npm run build`

  Expected: PASS; legacy campaigns and warned creation remain usable through the exact captured behavior, and uncertainty is recorded. Commit with `git add server/legacy-rules-backfill.ts server/legacy-rules-backfill.test.ts shared/rulesets.ts shared/schema.ts server/storage.ts server/routes.ts client/src/pages/home.tsx client/src/pages/campaign.tsx client/src/lib/campaignRulesetOptions.ts client/src/lib/campaignRulesetOptions.test.ts server/routes-combat.e2e.test.ts server/campaign-settings.test.ts && git commit -m "feat: preserve legacy rules provenance"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 5.

### Task 5: Resolve exact context and add atomic event/outbox commands

**Files:**
- Create: `server/rules-context-resolver.ts`
- Create: `server/rules-command-service.ts`
- Create: `server/rules-outbox.ts`
- Create: `server/rules-command-service.test.ts`
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Modify: `server/routes.ts`
- Modify: `server/routes-combat.e2e.test.ts`
- Test: `server/rules-command-service.test.ts`, `server/routes-combat.e2e.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4 exact IDs, manifests, and legacy capture.
- Produces:

  ```ts
  interface RulesContext { campaignId: number; mechanicalRulesetId: MechanicalRulesetId; rulesetReleaseId: string; campaignRulesSnapshotId: string; evaluatedCorpusManifestId: string; evaluatedCorpusManifestHash: string; evaluatorBundleArtifactSha256: string; campaignStateVersion: number; }
  type RulesActor = { kind: "user"; userId: number } | { kind: "visitor"; visitorId: string } | { kind: "system_migration"; migrationId: string };
  interface SnapshotAssertion { campaignRulesSnapshotId: string; campaignStateVersion: number; }
  interface RulesCommandInput<TIntent> { campaignId: number; actor: RulesActor; idempotencyKey: string; intentType: string; intent: TIntent; assertion: SnapshotAssertion; }
  interface RulesCommandResult<TResult> { result: TResult; eventId: string; campaignRulesSnapshotId: string; evaluatedCorpusManifestHash: string; previousCampaignStateVersion: number; campaignStateVersion: number; idempotentReplay: boolean; }
  interface RulesEventPayload { intentType: string; normalizedIntent: unknown; normalizedResult: unknown; rulesetReleaseId: string; semanticCorpusRevisionIds: readonly string[]; canonicalRevisionIds: readonly string[]; sourceArtifactSnapshotIds: readonly string[]; evaluatorBundleArtifactSha256: string; }
  interface EventCursor { campaignStateVersion: number; eventId: string | null; }
  interface OutboxEvent { id: string; campaignId: number; eventId: string; campaignRulesSnapshotId: string; evaluatedCorpusManifestHash: string; campaignStateVersion: number; payloadSchemaVersion: string; payload: RulesEventPayload; payloadHash: string; committedAt: string; deliveryStatus: "pending" | "leased" | "delivered"; }
  function resolveRulesContextForMutation(campaignId: number, assertion?: SnapshotAssertion): RulesContext;
  function executeRulesCommand<TIntent, TResult>(input: RulesCommandInput<TIntent>): Promise<RulesCommandResult<TResult>>;
  function listCommittedCampaignEventsAfter(campaignId: number, cursor: EventCursor): readonly OutboxEvent[];
  ```

**Provisional additive migration contract — REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION:**

- `campaign_state_versions`: `campaign_id INTEGER PRIMARY KEY REFERENCES campaigns(id) ON DELETE RESTRICT`, `state_version INTEGER NOT NULL CHECK (state_version >= 0)`, and `updated_at TEXT NOT NULL`. Backfill exactly one row per campaign at version 0; `UPDATE ... WHERE state_version = :asserted` is the compare-and-swap boundary.
- `rules_command_idempotency`: `command_id TEXT PRIMARY KEY`, `campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT`, `actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user','visitor','system_migration'))`, `actor_scope_key TEXT NOT NULL`, `idempotency_key TEXT NOT NULL`, `request_sha256 TEXT NOT NULL CHECK (length(request_sha256) = 64)`, `intent_type TEXT NOT NULL`, `normalized_intent_json TEXT NOT NULL`, `result_json TEXT NOT NULL`, `result_sha256 TEXT NOT NULL CHECK (length(result_sha256) = 64)`, `asserted_snapshot_id TEXT NOT NULL REFERENCES campaign_rules_snapshots(id) ON DELETE RESTRICT`, `asserted_state_version INTEGER NOT NULL`, `resulting_state_version INTEGER NOT NULL CHECK (resulting_state_version = asserted_state_version + 1)`, and `created_at TEXT NOT NULL`; `UNIQUE(campaign_id, actor_kind, actor_scope_key, idempotency_key)`. The actor scope uses `user:<id>`, a keyed digest of a visitor credential, or `migration:<id>`—never an unscoped client key. Reuse with a different request hash rejects rather than replaying the first result.
- `rules_events`: `event_id TEXT PRIMARY KEY`, `command_id TEXT NOT NULL UNIQUE REFERENCES rules_command_idempotency(command_id) ON DELETE RESTRICT`, `campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT`, `previous_state_version INTEGER NOT NULL`, `state_version INTEGER NOT NULL CHECK (state_version = previous_state_version + 1)`, `campaign_rules_snapshot_id TEXT NOT NULL REFERENCES campaign_rules_snapshots(id) ON DELETE RESTRICT`, `evaluated_manifest_id TEXT NOT NULL REFERENCES evaluated_corpus_manifests(id) ON DELETE RESTRICT`, `evaluated_manifest_sha256 TEXT NOT NULL CHECK (length(evaluated_manifest_sha256) = 64)`, `payload_schema_version TEXT NOT NULL`, `payload_json TEXT NOT NULL`, `payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64)`, and `committed_at TEXT NOT NULL`; `UNIQUE(campaign_id, state_version)` establishes the replay order.
- `rules_outbox`: `outbox_id TEXT PRIMARY KEY`, `event_id TEXT NOT NULL UNIQUE REFERENCES rules_events(event_id) ON DELETE RESTRICT`, `campaign_id INTEGER NOT NULL`, `state_version INTEGER NOT NULL`, `campaign_rules_snapshot_id TEXT NOT NULL`, `evaluated_manifest_sha256 TEXT NOT NULL CHECK (length(evaluated_manifest_sha256) = 64)`, `payload_schema_version TEXT NOT NULL`, `payload_json TEXT NOT NULL`, `payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64)`, `committed_at TEXT NOT NULL`, `delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending','leased','delivered'))`, `attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0)`, `lease_owner TEXT`, `lease_expires_at TEXT`, `next_attempt_at TEXT`, `delivered_at TEXT`, and `last_error TEXT`; composite foreign key `(campaign_id, state_version) REFERENCES rules_events(campaign_id, state_version) ON DELETE RESTRICT`, plus indexes `(delivery_status, next_attempt_at, committed_at)` and `(campaign_id, state_version, outbox_id)`.
- Insert the command, rules event, state-version advance, and outbox payload in the same SQLite transaction. Add `BEFORE UPDATE`/`BEFORE DELETE` guards for immutable command/event columns and outbox identity/payload columns; only outbox lease/delivery fields may update through a compare-and-swap storage method. Retain command/event/outbox rows for at least as long as any campaign snapshot or replay evidence references them; this foundation defines no pruning job. Migration rollback is operational: disable new writers/publishers while retaining tables and readers, never `DROP`, delete, or decrement state versions.

- [ ] **Step 1: Write red transaction tests.**

  Assert catalog/unknown/missing/mismatched/quarantined/cross-ruleset context rejects without mutation; duplicate idempotency returns the original event/result; stale state rolls back; injected event/outbox failure rolls back; no broadcast occurs before commit; send failure retains a pending row; retry/duplicate delivery is idempotent; reconnect after a cursor replays committed events once in campaign-state-version order; payload contains event, snapshot, manifest hash, and state version.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/rules-command-service.test.ts`

  Expected: FAIL because routes currently mutate and use direct in-memory broadcast.

- [ ] **Step 3: Implement resolver, transaction, and outbox.**

  Add the exact provisional state-version, idempotency, resolution-event, and outbox schema above through `runMigrations()`/idempotent table-and-index creation. Reload campaign/ownership/context in one transaction; verify version; mutate; append normalized inputs/outputs/canonical/source/release provenance; advance state; enqueue outbox. Send only committed outbox rows, retain failures for retry, mark delivery idempotently, and expose ordered cursor-based reconnect catch-up. Move one existing deterministic roll/attack route through the service.

- [ ] **Step 4: Prove forward-only migration rollback.**

  Put the new command reader/writer and outbox publisher behind one server-side release gate that remains disabled for new 5e releases until acceptance. Test that disabling it restores the prior legacy/dnd35 route and direct-broadcast read behavior without dropping committed command/event/outbox rows, replaying a mutation, decrementing billing, or exposing a 5e candidate. Retain additive columns/tables; never reverse a migration or delete queued evidence. A rollout that has already emitted command events must keep their audit/read projection available even while new writes are disabled.

- [ ] **Step 5: Run green and commit.**

  Run: `node --import tsx --test server/rules-command-service.test.ts server/routes-combat.e2e.test.ts && npm run typecheck`

  Expected: PASS; no double roll/damage/resource charge or unsourced multiplayer projection. Commit with `git add server/rules-context-resolver.ts server/rules-command-service.ts server/rules-outbox.ts server/rules-command-service.test.ts shared/schema.ts server/storage.ts server/routes.ts server/routes-combat.e2e.test.ts && git commit -m "feat: add atomic rules command delivery"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Phase 2.

## Phase 2 — Source policy, offline acquisition, and generic canonical extraction

### Task 6: Backfill source policy with structured rights and protect dnd35e

**Files:**
- Modify: `shared/rules-registry/sources.ts`
- Modify: `shared/rules-registry/source-enablement.ts`
- Modify: `server/storage.ts`
- Create: `server/source-policy-migration.test.ts`
- Modify: `shared/rules-registry/source-enablement.test.ts`
- Modify: `server/campaign-source-selection.test.ts`
- Test: `server/source-policy-migration.test.ts`, `server/campaign-source-selection.test.ts`

**Interfaces:**
- Consumes: Task 3 rights/corpus/artifact/lineage records.
- Produces: `resolveEnabledCorpusRevisions(context: RulesContext): readonly SemanticCorpusRevision[]`.

- [ ] **Step 1: Write red policy fixtures.**

  Assert `core_only` uses exact release corpus; `all_official` requires authentic, integrity-verified, semantically reconciled, `verified_open`, selectable exact-generation corpus segments; custom requires role/setting/rights/permission; derived, closed, unknown, quarantined, other-generation data rejects. Serialize current dnd35 generic/Eberron/core/custom effective IDs for equality after backfill.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/source-policy-migration.test.ts shared/rules-registry/source-enablement.test.ts`

  Expected: FAIL because current source selection is ruleset/setting-only.

- [ ] **Step 3: Implement additive policy migration.**

  Backfill each current dnd35 row with reviewed role, authenticity, integrity, semantic, rights, currentness, and obligation evidence; persist any reviewed waiver. Activate the strict resolver only after fixture equality passes. Do not collapse CC/OGL obligations into `attributionText` or create duplicate selectable semantics for legal wrappers.

- [ ] **Step 4: Prove resolver rollback without deleting evidence.**

  Keep strict policy resolution behind a server-side gate until the serialized dnd35 parity report passes. Test that disabling the gate restores the captured dnd35 resolver result exactly, never yields an accidental empty source set, and leaves every backfill/right/waiver row intact; explicit 5e rulesets remain non-selectable while the strict resolver is disabled. Roll forward by repairing evidence and rerunning the same idempotent migration, not by deleting rows.

- [ ] **Step 5: Run green and commit.**

  Run: `node --import tsx --test server/source-policy-migration.test.ts shared/rules-registry/source-enablement.test.ts server/campaign-source-selection.test.ts && npm run typecheck`

  Expected: PASS; dnd35 effective selection is unchanged and 5e selection is scope/rights-correct. Commit with `git add shared/rules-registry/sources.ts shared/rules-registry/source-enablement.ts server/storage.ts server/source-policy-migration.test.ts shared/rules-registry/source-enablement.test.ts server/campaign-source-selection.test.ts && git commit -m "feat: enforce rights-scoped source policy"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 7.

### Task 7: Acquire and verify artifacts internally; keep runtime offline

**Files:**
- Create: `server/source-artifact-service.ts`
- Create: `server/source-artifact-service.test.ts`
- Create: `server/compendium.test.ts`
- Create: `script/acquire-dnd5e-source-artifact.ts`
- Modify: `server/compendium.ts`
- Modify: `server/index.ts`
- Test: `server/source-artifact-service.test.ts`, `server/compendium.test.ts`

**Interfaces:**
- Consumes: Task 3 artifact/rights persistence.
- Produces: `acquireArtifact(input, fetchImpl): Promise<SourceArtifactSnapshot>`, `quarantineArtifactCandidate`, `getRetainedArtifactBytes(sha256)`.

- [ ] **Step 1: Write red acquisition/runtime tests.**

  Use injected fetches to assert allowlisted TLS host, redirect/private-address rejection, time/byte/content-type limits, SHA-256/ETag/Last-Modified capture, web-evidence snapshot capture, obligation evidence capture, same-version hash drift quarantine, and no `fetch` from startup or campaign action.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/source-artifact-service.test.ts server/compendium.test.ts`

  Expected: FAIL because current compendium startup can fetch mutable `@main` JSON.

- [ ] **Step 3: Implement internal-only acquisition.**

  Persist raw bytes content-addressably and record official hub/rights/changelog evidence snapshots separately from PDF data. Expose `script/acquire-dnd5e-source-artifact.ts` only to admin/internal execution. Replace startup/campaign-triggered network synchronization with reads/imports from pre-acquired retained snapshots; existing persisted compendium rows remain untouched. A fresh startup with no retained artifact reports unavailable unpublished data rather than retrieving it.

- [ ] **Step 4: Prove retention and rollback.**

  Test revised/historical/quarantined candidate bytes remain auditable but cannot enable a new snapshot; restoration creates a new snapshot referencing retained old bytes, never an in-place update.

- [ ] **Step 5: Run green and commit.**

  Run: `node --import tsx --test server/source-artifact-service.test.ts server/compendium.test.ts && npm run typecheck`

  Expected: PASS; gameplay and startup are offline from ingestion. Commit with `git add server/source-artifact-service.ts server/source-artifact-service.test.ts script/acquire-dnd5e-source-artifact.ts server/compendium.ts server/index.ts server/compendium.test.ts && git commit -m "feat: isolate immutable source acquisition"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 8.

### Task 8: Create generic page-anchored extractor and verifier contracts

**Files:**
- Create: `server/canonical-extraction-service.ts`
- Create: `server/canonical-extraction-service.test.ts`
- Create: `server/canonical-family-verifier.ts`
- Create: `server/canonical-family-verifier.test.ts`
- Modify: `shared/rules-registry/revisions.ts`
- Test: `server/canonical-extraction-service.test.ts`, `server/canonical-family-verifier.test.ts`

**Interfaces:**
- Consumes: verified artifact snapshot, semantic corpus revision, rights scope, and manifest segments.
- Produces:

  ```ts
  type ManifestDisposition = "canonical" | "reference_only" | "legal" | "index" | "out_of_scope" | "manual_review";
  interface SourceManifestSegment { segmentKey: string; semanticCorpusRevisionId: string; sourceArtifactSnapshotId: string; artifactSha256: string; physicalPdfPageIndexStart: number; physicalPdfPageIndexEnd: number; printedPageLabelStart: string | null; printedPageLabelEnd: string | null; headingPath: readonly string[]; evidenceSpanHash: string; expectedFamily: string | null; ownerExtractorKey: string | null; disposition: ManifestDisposition; }
  interface SourceManifest { id: string; mechanicalRulesetId: MechanicalRulesetId; semanticCorpusRevisionId: string; segmentIds: readonly string[]; sortedManifestBytesSha256: string; parserVersion: string; createdAt: string; }
  interface ExtractionIssue { code: "missing_anchor" | "duplicate_identity" | "cross_ruleset_id" | "rights_not_verified_open" | "derived_only" | "payload_invalid"; segmentKey: string; candidateCanonicalId: string | null; evidence: string; }
  interface ExtractionReport { mechanicalRulesetId: MechanicalRulesetId; semanticCorpusRevisionId: string; sourceManifestId: string; family: string; extractorVersion: string; candidateCount: number; acceptedRevisionIds: readonly string[]; issues: readonly ExtractionIssue[]; reportHash: string; }
  interface FamilyVerificationReport { mechanicalRulesetId: MechanicalRulesetId; semanticCorpusRevisionId: string; sourceManifestId: string; family: string; expectedSegmentKeys: readonly string[]; dispositionCounts: Readonly<Record<ManifestDisposition, number>>; canonicalRevisionIds: readonly string[]; duplicateCanonicalIds: readonly string[]; crossRulesetCanonicalIds: readonly string[]; missingEvidenceSegmentKeys: readonly string[]; verified: boolean; reportHash: string; }
  interface ExtractCanonicalFamilyInput { mechanicalRulesetId: MechanicalRulesetId; semanticCorpusRevisionId: string; sourceManifestId: string; sourceArtifactSnapshotIds: readonly string[]; family: string; extractorVersion: string; sourceNativeSchemaVersion: string; normalizedPayloadSchemaVersion: string; }
  interface VerifyCanonicalFamilyInput { extractionReport: ExtractionReport; sourceManifestId: string; expectedSegmentKeys: readonly string[]; requiredRightsDecisionIds: readonly string[]; }
  interface PublishFamilyRevisionSetInput { extractionReport: ExtractionReport; verificationReport: FamilyVerificationReport; expectedMechanicalRulesetId: MechanicalRulesetId; reviewerUserId: number; }
  function extractCanonicalFamily(input: ExtractCanonicalFamilyInput): ExtractionReport;
  function verifyCanonicalFamily(input: VerifyCanonicalFamilyInput): FamilyVerificationReport;
  function publishFamilyRevisionSet(input: PublishFamilyRevisionSetInput): readonly CanonicalRevisionId[];
  ```

- [ ] **Step 1: Write red generic extraction tests.**

  Assert every canonical revision has exact MechanicalRulesetId, semantic corpus revision, physical page index, printed label, span hash, source lineage edge, rights scope, payload hash/schema version, and automation status. Assert every canonical/reference segment has exactly one `ownerExtractorKey`; a duplicate owner, missing owner, missing page, duplicate identity, cross-generation ID, `unknown` rights, or a derived-only record rejects.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/canonical-extraction-service.test.ts server/canonical-family-verifier.test.ts`

  Expected: FAIL because current canonical revisions do not carry this full family-proof contract.

- [ ] **Step 3: Implement generic contract.**

  Reuse landed Phase 2A generic structures where compatible; otherwise make one additive generic schema, not a 5e-only parallel. Store source-native payload plus typed normalized payload, use manifest-generated expected counts, and keep extraction/semantic/right/automation axes independent.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/canonical-extraction-service.test.ts server/canonical-family-verifier.test.ts && npm run typecheck`

  Expected: PASS; each later family task can fail on missing evidence rather than a row count. Commit with `git add server/canonical-extraction-service.ts server/canonical-extraction-service.test.ts server/canonical-family-verifier.ts server/canonical-family-verifier.test.ts shared/rules-registry/revisions.ts && git commit -m "feat: verify canonical family evidence"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Phase 3.

## Phase 3 — Complete 2014 SRD 5.1 corpus before 2024 begins

### Task 9: Register and manifest the 2014 semantic corpus

**Files:**
- Create: `server/dnd5e2014/corpus.ts`
- Create: `server/dnd5e2014/corpus.test.ts`
- Create: `script/verify-dnd5e2014-manifest.ts`
- Test: `server/dnd5e2014/corpus.test.ts`

**Interfaces:**
- Consumes: Task 7 retained SRD 5.1 CC snapshot and Task 8 extraction contracts.
- Produces: `getDnd5e2014Corpus(): SemanticCorpusRevision`, `getDnd5e2014Manifest(): SourceManifest`.

- [ ] **Step 1: Write red manifest tests.**

  Assert the corpus binds the verified-open SRD 5.1 CC artifact, requires every page/segment disposition, retains source/page hashes, treats the OGL PDF as an alternate artifact candidate only after normalized-body equivalence proof, and cannot import a Basic Rules page or derived transport as canonical. Assign every `canonical` or `reference_only` segment to exactly one Task 10–13 extractor key; legal/index/out-of-scope/manual-review segments have no extractor owner.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2014/corpus.test.ts`

  Expected: FAIL because there is no 2014 semantic corpus/manifest.

- [ ] **Step 3: Implement corpus registration.**

  Create the 2014 `SemanticCorpusRevision`, rights decision/obligation bindings, page/section manifest, and artifact lineage. Generate expected family ranges from the stored PDF and mark every segment `canonical`, `reference_only`, `legal`, `index`, `out_of_scope`, or `manual_review`.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx script/verify-dnd5e2014-manifest.ts && node --import tsx --test server/dnd5e2014/corpus.test.ts`

  Expected: manifest verifier exits 0 only with no undispositioned in-scope segment. Commit with `git add server/dnd5e2014/corpus.ts server/dnd5e2014/corpus.test.ts script/verify-dnd5e2014-manifest.ts && git commit -m "feat: register dnd5e2014 semantic corpus"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 10.

### Task 10: Extract and verify 2014 origins, classes, and progression

**Files:**
- Create: `server/dnd5e2014/extract-origins.ts`
- Create: `server/dnd5e2014/extract-classes.ts`
- Create: `server/dnd5e2014/origins-classes.test.ts`
- Create: `script/verify-dnd5e2014-origins-classes.ts`
- Test: `server/dnd5e2014/origins-classes.test.ts`

**Interfaces:**
- Consumes: Task 9 manifest/extractor.
- Produces: versioned `race`, `background`, `language`, `skill`, `proficiency`, `class`, `subclass`, `class_feature`, `progression_table`, `resource_definition`, and `feat` revisions.

- [ ] **Step 1: Write red family tests.**

  Assert 2014 race-owned ASI/language traits, background feature/equipment, class/subclass timing, hit die/proficiency/resource grants, XP/level table, feats, and 2014 spell progression are source-anchored. Reject a 2024 species/background/origin feat or an unanchored parsed choice.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2014/origins-classes.test.ts`

  Expected: FAIL because these structured 2014 family revisions do not exist.

- [ ] **Step 3: Implement extractor and verifier.**

  Extract only source-evidenced fields; preserve prose/source-native payloads; model choices/grants as revisioned relations rather than display text. Mark effects `reference_only` until a mechanics capability names them.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx script/verify-dnd5e2014-origins-classes.ts && node --import tsx --test server/dnd5e2014/origins-classes.test.ts`

  Expected: PASS with manifest counts, no orphan/duplicate/cross-generation identity, and page anchors for every family row. Commit with `git add server/dnd5e2014/extract-origins.ts server/dnd5e2014/extract-classes.ts server/dnd5e2014/origins-classes.test.ts script/verify-dnd5e2014-origins-classes.ts && git commit -m "feat: extract dnd5e2014 origins and classes"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 11.

### Task 11: Extract and verify 2014 rules, actions, conditions, and equipment

**Files:**
- Create: `server/dnd5e2014/extract-rules-equipment.ts`
- Create: `server/dnd5e2014/rules-equipment.test.ts`
- Create: `script/verify-dnd5e2014-rules-equipment.ts`
- Test: `server/dnd5e2014/rules-equipment.test.ts`

**Interfaces:**
- Consumes: Task 9 manifest/extractor.
- Produces: `rule`, `action`, `condition`, `weapon`, `armor`, `equipment`, `tool`, `vehicle`, and `magic_item` revisions from manifest segments owned only by the rules/equipment extractor.

- [ ] **Step 1: Write red family tests.**

  Assert 2014 action terminology, surprise, grapple/shove contests, conditions including Exhaustion/Incapacitated/Invisible/Prone, opportunity/underwater movement rules, short/long rest procedures, weapon/armor/shield rules, potion action cost, attunement, and source anchors. Assert no revised Mastery, Armor Training, Heroic Inspiration, Emanation, or 2024 item is introduced.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2014/rules-equipment.test.ts`

  Expected: FAIL because 2014 rules/equipment are still flat or mixed compendium records.

- [ ] **Step 3: Implement family extraction.**

  Persist typed effects/action costs/termination fields and source-native prose separately. Keep complex item/rule effects reference-only where no named evaluator exists; do not turn a PDF sentence into runtime code. Reject any segment owned by the Task 13 GM/adventure/reference extractor.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx script/verify-dnd5e2014-rules-equipment.ts && node --import tsx --test server/dnd5e2014/rules-equipment.test.ts`

  Expected: PASS with all in-scope entries dispositioned and each executable claim linked to a capability. Commit with `git add server/dnd5e2014/extract-rules-equipment.ts server/dnd5e2014/rules-equipment.test.ts script/verify-dnd5e2014-rules-equipment.ts && git commit -m "feat: extract dnd5e2014 rules and equipment"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 12.

### Task 12: Extract and verify 2014 spells and spell lists

**Files:**
- Create: `server/dnd5e2014/extract-spells.ts`
- Create: `server/dnd5e2014/spells.test.ts`
- Create: `script/verify-dnd5e2014-spells.ts`
- Test: `server/dnd5e2014/spells.test.ts`

**Interfaces:**
- Consumes: Task 9 manifest/extractor and Task 10 class revisions.
- Produces: `spell` and versioned many-to-many `spell_list_membership` revisions, typed area/effect/slot/concentration fields.

- [ ] **Step 1: Write red spell tests.**

  Assert every 2014 spell/list relation is source-anchored, known/prepared eligibility is distinct, ritual/concentration/action/slot fields are typed, existing same-name 2024 spell is not resolved, and unsupported effects remain `reference_only`.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2014/spells.test.ts`

  Expected: FAIL because no generation-qualified spell/list corpus exists.

- [ ] **Step 3: Implement spell extraction.**

  Store canonical spell revisions and list membership as immutable relations, not mutable arrays. Preserve page spans, target/area forms, scaling, and effect capability identifiers; never infer 2024 Emanation semantics for legacy area text.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx script/verify-dnd5e2014-spells.ts && node --import tsx --test server/dnd5e2014/spells.test.ts`

  Expected: PASS with no same-name collision and exact list-membership count evidence. Commit with `git add server/dnd5e2014/extract-spells.ts server/dnd5e2014/spells.test.ts script/verify-dnd5e2014-spells.ts && git commit -m "feat: extract dnd5e2014 spells"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 13.

### Task 13: Extract and verify 2014 monsters and GM/adventure/reference material

**Files:**
- Create: `server/dnd5e2014/extract-monsters-reference.ts`
- Create: `server/dnd5e2014/monsters-reference.test.ts`
- Create: `script/verify-dnd5e2014-monsters-reference.ts`
- Test: `server/dnd5e2014/monsters-reference.test.ts`

**Interfaces:**
- Consumes: Task 9 manifest/extractor.
- Produces: source-native `monster` revisions, monster action relations, and `poison`, `hazard`, `environment_rule`, `table`, and `rule_section` records for the 5.1 GM/adventure/encounter/travel/reference segments assigned only to this extractor. “Gameplay Toolbox” is not used as a publisher section name for SRD 5.1.

- [ ] **Step 1: Write red creature/toolbox tests.**

  Assert 2014 blocks preserve selected Saving Throws versus normal ability modifiers, actions/traits, defenses, CR, and provenance; assert a 2024 all-six displayed-save layout cannot be parsed as six proficiencies. Assert manifest-derived expected counts and unique ownership for every assigned monster, poison, hazard, environment, GM/adventure/encounter/travel, table, and reference segment, including exact source records for legacy suffocation and falling. These remain reference-only unless a capability is named.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2014/monsters-reference.test.ts`

  Expected: FAIL because the source-native monster and GM/adventure/reference corpus is absent.

- [ ] **Step 3: Implement extraction.**

  Persist source-native monster layout plus neutral runtime projection, distinct save-proficiency records, action/bonus/reaction relations, and page anchors. Do not create a revised monster by reshaping a 2014 record.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx script/verify-dnd5e2014-monsters-reference.ts && node --import tsx --test server/dnd5e2014/monsters-reference.test.ts`

  Expected: PASS with manifest-derived family counts, one extractor owner per segment, and no executable monster action absent a capability record. Commit with `git add server/dnd5e2014/extract-monsters-reference.ts server/dnd5e2014/monsters-reference.test.ts script/verify-dnd5e2014-monsters-reference.ts && git commit -m "feat: extract dnd5e2014 monsters and gm reference"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 14A.

### Task 14A: Implement 2014 character creation and advancement policy

**Files:**
- Create: `server/dnd5e2014/character-policy.ts`
- Create: `server/dnd5e2014/character-policy.test.ts`
- Modify: `server/character-stats.ts`
- Modify: `server/leveling.ts`
- Modify: `server/routes.ts`
- Modify: `server/rules-command-service.ts`
- Modify: `client/src/pages/campaign.tsx`
- Modify: `server/character-stats.test.ts`
- Create: `server/dnd5e-creation-advancement-routes.test.ts`
- Create: `client/src/pages/campaign.test.tsx`
- Test: `server/dnd5e2014/character-policy.test.ts`, `server/character-stats.test.ts`, `server/dnd5e-creation-advancement-routes.test.ts`, `client/src/pages/campaign.test.tsx`

**Interfaces:**
- Consumes: Task 10 origin/class/progression revisions, `RulesContext`, and Task 5 command service.
- Produces: `Dnd5e2014CharacterCreationPolicy`, `Dnd5e2014AdvancementPolicy`, and capability evidence for `character.create` and `character.advance`.

- [ ] **Step 1: Write red creation/advancement tests.**

  Require server validation of six abilities and their recorded generation method, 2014 race-owned ASIs/languages, background/class/subclass choices, starting equipment, HP/AC/proficiency/saves/initiative, level/XP grants, ownership, and exact canonical/source/snapshot provenance. Reject revised species, background ASIs, Origin feats, Mastery, cross-generation IDs, and client/AI-supplied derived totals. Exercise the current campaign creation form plus every creation/level-up handler in `server/routes.ts` and `server/leveling.ts`: crafted HTTP bodies and stale client projections cannot bypass the policy, while a bare legacy fixture retains its captured form and progression behavior.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2014/character-policy.test.ts`

  Expected: FAIL because legacy creation is free-text and advancement is not generation-pinned.

- [ ] **Step 3: Implement the two policies.**

  Read exact 2014 revisions through the evaluated manifest, validate all choices server-side, compute derived values from stored source choices, and commit through Task 5. Replace the current non-3.5 fallback in `server/leveling.ts`; make every relevant `server/routes.ts` handler resolve `RulesContext` and call the policy; make `client/src/pages/campaign.tsx` render server-supplied choices and submit intent only. Preserve bare-legacy behavior on its captured evaluator; do not repair it incidentally.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/dnd5e2014/character-policy.test.ts server/character-stats.test.ts server/dnd5e-creation-advancement-routes.test.ts client/src/pages/campaign.test.tsx && npm run typecheck && npm run build`

  Expected: PASS with no 2024/3.5 lookup and no creation/advancement bypass. Commit with `git add server/dnd5e2014/character-policy.ts server/dnd5e2014/character-policy.test.ts server/character-stats.ts server/leveling.ts server/routes.ts server/rules-command-service.ts client/src/pages/campaign.tsx server/character-stats.test.ts server/dnd5e-creation-advancement-routes.test.ts client/src/pages/campaign.test.tsx && git commit -m "feat: add dnd5e2014 character policies"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 14B.

### Task 14B: Implement 2014 checks, combat, death, and core conditions

**Files:**
- Create: `server/dnd5e2014/roll-combat-policy.ts`
- Create: `server/dnd5e2014/roll-combat-policy.test.ts`
- Modify: `server/dice-engine.ts`
- Modify: `server/combat-engine.ts`
- Modify: `server/rules-command-service.ts`
- Modify: `server/dice-engine.test.ts`
- Modify: `server/combat-engine-attack.test.ts`
- Test: `server/dnd5e2014/roll-combat-policy.test.ts`, `server/dice-engine.test.ts`, `server/combat-engine-attack.test.ts`

**Interfaces:**
- Consumes: Task 11 actions/conditions/equipment revisions, Task 13 environment/reference records, Task 14A character projection, and Task 5 atomic commands.
- Produces: `Dnd5e2014CheckSavePolicy`, `Dnd5e2014CombatPolicy`, `Dnd5e2014ConditionPolicy`, `Dnd5e2014EnvironmentPolicy`, and named capability evidence.

- [ ] **Step 1: Write red roll/combat tests.**

  Cover ability checks, six saves, initiative, attack/hit/miss, critical damage, damage ability modifier kept separate from aggregate attack bonus, action/Bonus Action/Reaction resources, opportunity attacks, surprise, grapple/shove, movement, core conditions, HP mutation, death saves, and the platform rule that 0 HP is incapacitated and never dead. Pair the exact 2014 underwater named-melee-weapon exemption with its ranged range/miss rule; apply the 2014 falling procedure with no invented liquid-impact Reaction; record `breath_expired | choking` suffocation onset, the 2014 round countdown, 0-HP/dying and no-healing/no-stabilization source behavior under the platform zero-HP policy; and prove a 2014 knockout never receives revised first-aid/rest termination. Natural 1/20 automatic outcome is attack-only except death-save rules; AI-proposed DCs clamp 5–25 and AI numbers/outcomes are ignored.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2014/roll-combat-policy.test.ts`

  Expected: FAIL on generic natural-roll behavior, damage-modifier leakage, and absent generation policy.

- [ ] **Step 3: Implement the named combat surface.**

  Keep neutral dice/target/environment/transaction helpers, but dispatch every outcome/effect through the exact 2014 policy and canonical revision. Persist breath/fall/underwater/knockout inputs and source behavior separately from platform zero-HP overrides. Do not change the captured legacy or dnd35 profiles; return a generation-specific, source-linked `requires_adjudication` record without mutation for any environment or effect contract that is not made executable in this commit.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/dnd5e2014/roll-combat-policy.test.ts server/dice-engine.test.ts server/combat-engine-attack.test.ts && npm run typecheck`

  Expected: PASS with roll/event/outbox provenance. Commit with `git add server/dnd5e2014/roll-combat-policy.ts server/dnd5e2014/roll-combat-policy.test.ts server/dice-engine.ts server/combat-engine.ts server/rules-command-service.ts server/dice-engine.test.ts server/combat-engine-attack.test.ts && git commit -m "feat: add dnd5e2014 combat policies"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 14C.

### Task 14C: Implement 2014 rest, spellcasting, equipment, and release evidence

**Files:**
- Create: `server/dnd5e2014/rest-spell-equipment-policy.ts`
- Create: `server/dnd5e2014/rest-spell-equipment-policy.test.ts`
- Create: `server/dnd5e2014/capabilities.ts`
- Create: `server/dnd5e2014/release-gate.ts`
- Create: `server/dnd5e2014/release-gate.test.ts`
- Modify: `server/rules-command-service.ts`
- Modify: `server/routes.ts`
- Modify: `client/src/components/SpellSheet.tsx`
- Modify: `client/src/lib/spellMath.ts`
- Modify: `client/src/lib/spellMath.test.ts`
- Create: `server/dnd5e-rest-spell-routes.test.ts`
- Create: `client/src/components/SpellSheet.test.tsx`
- Test: `server/dnd5e2014/rest-spell-equipment-policy.test.ts`, `server/dnd5e2014/release-gate.test.ts`, `server/dnd5e-rest-spell-routes.test.ts`, `client/src/components/SpellSheet.test.tsx`, `client/src/lib/spellMath.test.ts`

**Interfaces:**
- Consumes: Tasks 11–13 equipment/spell/rest definitions and Tasks 14A–14B capability evidence.
- Produces: `Dnd5e2014RestPolicy`, `Dnd5e2014SpellcastingPolicy`, `Dnd5e2014EquipmentPolicy`, and `assertDnd5e2014Selectable(releaseId): void`.

- [ ] **Step 1: Write red rest/spell/equipment tests.**

  Require 2014 Short Rest duration/eligibility and minimum-0 Hit Die healing; Long Rest 24-hour cadence, half-spent-Hit-Dice recovery, HP restoration, legacy reduced-ability/HP-maximum behavior, Exhaustion prerequisites, and interruption/restart procedure; known/prepared eligibility, slots, rituals, action restriction, concentration start/check/end, targets and casting transaction; equip/unequip, armor/shield eligibility, weapon properties, attunement, activation and consumable action cost. Drive every current rest/resource/spell route and `SpellSheet` action: direct PATCH attempts, client-computed save DC/attack/slots, and stale resource payloads cannot mutate explicit 2014 state; `SpellSheet` renders the server projection and sends intent only. Keep `spellMath` generation-explicit and prove its 3.5/legacy callers cannot become a hidden 2014 authority. Every unimplemented feature/spell/item/monster effect must return source-linked `requires_adjudication` without mutation.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2014/rest-spell-equipment-policy.test.ts server/dnd5e2014/release-gate.test.ts`

  Expected: FAIL because current rest/spell state is client/generic and no fixed gate exists.

- [ ] **Step 3: Implement policies and aggregate evidence.**

  Execute only typed, tested fields from the 2014 manifest through Task 5. Route all current rest, resource, spell preparation/casting, equip/use, and rest-button entry points through the server policy; remove direct `SpellSheet` state patches for explicit-generation campaigns while retaining the captured bare-legacy UI path. Build a machine-readable release report requiring Tasks 9–14C, exact evaluator hash, source/right/lineage coverage, every fixed-gate capability, route/UI non-bypass evidence, and explicit adjudication dispositions; do not expose the ruleset yet.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/dnd5e2014/rest-spell-equipment-policy.test.ts server/dnd5e2014/release-gate.test.ts server/dnd5e-rest-spell-routes.test.ts client/src/components/SpellSheet.test.tsx client/src/lib/spellMath.test.ts && npm run typecheck && npm run build`

  Expected: PASS only with a complete fixed-gate evidence report and no client/route bypass. Commit with `git add server/dnd5e2014/rest-spell-equipment-policy.ts server/dnd5e2014/rest-spell-equipment-policy.test.ts server/dnd5e2014/capabilities.ts server/dnd5e2014/release-gate.ts server/dnd5e2014/release-gate.test.ts server/rules-command-service.ts server/routes.ts client/src/components/SpellSheet.tsx client/src/components/SpellSheet.test.tsx client/src/lib/spellMath.ts client/src/lib/spellMath.test.ts server/dnd5e-rest-spell-routes.test.ts && git commit -m "feat: complete dnd5e2014 release gate"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 15.

### Task 15: Add exact 2014 adapter, prompt, source, outbox, and billing proof

**Files:**
- Create: `client/src/lib/rulesAdapters/dnd5e2014.ts`
- Modify: `client/src/lib/rulesAdapters/index.ts`
- Modify: `client/src/components/game/CampaignGameShell.tsx`
- Modify: `client/src/pages/CharacterSheetPage.tsx`
- Modify: `client/src/pages/campaign.tsx`
- Modify: `client/src/lib/campaignRulesetOptions.ts`
- Modify: `client/src/lib/campaignRulesetOptions.test.ts`
- Modify: `shared/rulesets.ts`
- Modify: `server/dm-engine.ts`
- Modify: `server/routes.ts`
- Modify: `server/compendium-routes.ts`
- Modify: `client/src/pages/home.tsx`
- Create: `client/src/lib/rulesAdapters/index.test.ts`
- Create: `server/dm-engine-rules-context.test.ts`
- Create: `server/dnd5e-compendium-isolation.test.ts`
- Modify: `server/campaign-settings.test.ts`
- Modify: `server/items-use-auth.test.ts`
- Modify: `server/dnd5e2014/release-gate.test.ts`
- Test: `client/src/lib/rulesAdapters/index.test.ts`, `server/dm-engine-rules-context.test.ts`, `server/dnd5e2014/release-gate.test.ts`, `server/dnd5e-compendium-isolation.test.ts`, `server/campaign-settings.test.ts`, `server/items-use-auth.test.ts`

**Interfaces:**
- Consumes: `RulesContext`, 2014 capability/source evidence, and Task 5 outbox results.
- Produces: `getRulesAdapter(mechanicalRulesetId: MechanicalRulesetId)` and `buildResolvedRulesPromptContext(context: RulesContext)`.

- [ ] **Step 1: Write red projection tests.**

  Assert all HUD/sheet callers pass resolved mechanical ID; 2014 never uses 3.5 adapter; unknown/catalog IDs reject; prompt receives exact release/snapshot/manifest/capabilities/source summaries and only same-manifest facts; AI cannot override numbers/source precedence/outcomes; no rules infrastructure changes billing/turn counters; committed outbox payload is versioned. Assert crafted campaign creation rejects 2014 before the gate and succeeds only with the exact published release report. Before that gate, the server/UI list contains warned bare `dnd5e` but not 2014; in the same persisted gate transition, it removes bare `dnd5e` and adds 2014, never exposing both or neither. Disabling the gate restores the warned legacy option for new creation, removes 2014 from new selection, and leaves already-created 2014 and legacy campaigns pinned/readable. For a new 2014 campaign, Library lookup, inventory add, equip/use, and action resolution reject every legacy inline `dnd5e-2014:*`, `dnd5e-2024:*`, or `dmos:*` definition unless an exact target canonical revision is present in the campaign's evaluated manifest; same-slug and optional request filters cannot bypass this. A bare legacy `dnd5e` fixture retains its captured compatibility path unchanged.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test client/src/lib/rulesAdapters/index.test.ts server/dm-engine-rules-context.test.ts`

  Expected: FAIL because existing adapter callers omit ruleset and prompt rules context is raw.

- [ ] **Step 3: Implement exact projections.**

  Pass context-derived mechanics ID everywhere, add the 2014 adapter, and build prompt facts from the server resolver. Make server creation validation and both creation pickers consume one persisted dynamic release-gate snapshot; publishing 2014 atomically changes the server-owned selection set from warned bare `dnd5e` to `dnd5e2014`, while disabling that gate produces the inverse transition without rewriting campaigns. Never rely on a client-hidden option. For explicit-generation campaigns, make Library/compendium and item-use routes resolve only exact canonical revisions in the evaluated manifest; preserve the legacy inline route solely for bare captured `dnd5e` campaigns until Task 23 supplies reviewed crosswalks. Preserve non-rules prompt context such as party/inventory/world state, but never let it replace rules authority.

- [ ] **Step 4: Run the selectable 2014 gate and commit.**

  Run: `node --import tsx --test client/src/lib/rulesAdapters/index.test.ts client/src/lib/campaignRulesetOptions.test.ts server/dm-engine-rules-context.test.ts server/dnd5e2014/release-gate.test.ts server/dnd5e-compendium-isolation.test.ts server/campaign-settings.test.ts server/items-use-auth.test.ts && npm run test && npm run typecheck && npm run build`

  Expected: PASS; new 2014 campaign selection atomically replaces the warned legacy option only after the full fixed gate, with exact source scope, manifest-only compendium/item resolution, offline runtime, outbox, no-billing, and rollback-transition proofs. Commit with `git add client/src/lib/rulesAdapters/dnd5e2014.ts client/src/lib/rulesAdapters/index.ts client/src/components/game/CampaignGameShell.tsx client/src/pages/CharacterSheetPage.tsx client/src/pages/campaign.tsx client/src/lib/campaignRulesetOptions.ts client/src/lib/campaignRulesetOptions.test.ts client/src/pages/home.tsx shared/rulesets.ts server/dm-engine.ts server/routes.ts server/compendium-routes.ts client/src/lib/rulesAdapters/index.test.ts server/dm-engine-rules-context.test.ts server/dnd5e2014/release-gate.test.ts server/dnd5e-compendium-isolation.test.ts server/campaign-settings.test.ts server/items-use-auth.test.ts && git commit -m "feat: expose gated dnd5e2014 campaigns"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Phase 4. Do not start 2024 work unless Task 15 is green.

## Phase 4 — Independently complete the 2024 SRD 5.2.1 sibling

### Task 16: Register and manifest the 2024 semantic corpus

**Files:**
- Create: `server/dnd5e2024/corpus.ts`
- Create: `server/dnd5e2024/corpus.test.ts`
- Create: `script/verify-dnd5e2024-manifest.ts`
- Test: `server/dnd5e2024/corpus.test.ts`, `server/dnd5e2014/corpus.test.ts`

**Interfaces:**
- Consumes: Task 7 retained verified-open SRD 5.2.1 artifact and Task 8 generic extractor.
- Produces: `getDnd5e2024Corpus(): SemanticCorpusRevision`, independent 5.2.1 source manifest.

- [ ] **Step 1: Write red isolation tests.**

  Assert 5.2.1 creates a distinct corpus/manifest/rights binding and cannot update 2014 revisions; 5.2.0 is preserved historical evidence only; same slug gets a distinct 2024 canonical identity; no 2014 page/artifact is counted as revised coverage. Assign every `canonical` or `reference_only` segment—including the separate Magic Items and Animals sections—to exactly one Task 17–20 extractor key.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2024/corpus.test.ts`

  Expected: FAIL because revised corpus registration is absent.

- [ ] **Step 3: Implement corpus registration.**

  Register verified 5.2.1 CC artifact, semantic corpus revision, rights/obligation scope, source-page/TOC manifest, and complete segment dispositions. Do not build it by applying deltas to 5.1.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx script/verify-dnd5e2024-manifest.ts && node --import tsx --test server/dnd5e2024/corpus.test.ts server/dnd5e2014/corpus.test.ts`

  Expected: PASS; 2024 evidence is independent. Commit with `git add server/dnd5e2024/corpus.ts server/dnd5e2024/corpus.test.ts script/verify-dnd5e2024-manifest.ts && git commit -m "feat: register dnd5e2024 semantic corpus"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 17.

### Task 17: Extract and verify 2024 origins, classes, feats, and progression

**Files:**
- Create: `server/dnd5e2024/extract-origins.ts`
- Create: `server/dnd5e2024/extract-classes.ts`
- Create: `server/dnd5e2024/origins-classes.test.ts`
- Create: `script/verify-dnd5e2024-origins-classes.ts`
- Test: `server/dnd5e2024/origins-classes.test.ts`, `server/dnd5e2014/origins-classes.test.ts`

**Interfaces:**
- Consumes: Task 16 manifest and Task 8 generic extractor.
- Produces: 2024 `species`, `background`, `origin feat`, `language`, `class`, `subclass`, `feature`, `progression`, and `feat` revisions.

- [ ] **Step 1: Write red difference fixtures.**

  Assert species owns traits/size/Speed while background owns +2/+1 or +1/+1/+1 ASI, languages, Origin feat, tools/equipment; feat categories/timing are revised; subclasses start at level 3; post-20/tiers/extensions remain exact. Assert 2014 race ASI/language/background shape never appears in 2024.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2024/origins-classes.test.ts`

  Expected: FAIL because 2024 records do not exist.

- [ ] **Step 3: Implement independent extraction.**

  Extract independently from 5.2.1, including revisioned choice/provenance relations. Do not rename 2014 race rows into species or derive target ASIs from source scores.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx script/verify-dnd5e2024-origins-classes.ts && node --import tsx --test server/dnd5e2024/origins-classes.test.ts server/dnd5e2014/origins-classes.test.ts`

  Expected: PASS; all revised origins/progression have independent page anchors. Commit with `git add server/dnd5e2024/extract-origins.ts server/dnd5e2024/extract-classes.ts server/dnd5e2024/origins-classes.test.ts script/verify-dnd5e2024-origins-classes.ts && git commit -m "feat: extract dnd5e2024 origins and classes"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 18.

### Task 18: Extract and verify 2024 rules, actions, conditions, and equipment

**Files:**
- Create: `server/dnd5e2024/extract-rules-equipment.ts`
- Create: `server/dnd5e2024/rules-equipment.test.ts`
- Create: `script/verify-dnd5e2024-rules-equipment.ts`
- Test: `server/dnd5e2024/rules-equipment.test.ts`, `server/dnd5e2014/rules-equipment.test.ts`

**Interfaces:**
- Consumes: Task 16 manifest.
- Produces: 2024 `rule`, `action`, `condition`, `weapon`, `armor`, `equipment`, `tool`, and `vehicle` revisions, including typed Mastery and Armor Training relations, from segments owned only by this extractor.

- [ ] **Step 1: Write red revised-family tests.**

  Assert D20 Test terminology; voluntary save failure; tool+skill Advantage; Heroic Inspiration; revised surprise/Hide/Help/Influence/Study/Magic/Utilize; revised unarmed/grapple/shove; conditions, movement, opportunity, underwater, Prone; short/long rests; Mastery/firearms/properties; Armor Training versus shield; and ordinary Equipment-section tool/use/crafting rules. Assert legacy behavior does not leak and reject every potion definition, magic-item activation/attunement/crafting, Gameplay Toolbox, Monsters, or Animals segment owned by Task 20.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2024/rules-equipment.test.ts`

  Expected: FAIL because no revised structured family exists.

- [ ] **Step 3: Implement independent extraction.**

  Store exact revised structures and source-native text; include every source locator and mark nonexecutable material reference-only. Treat a renamed term as a new revision unless an explicit proven `display_alias` mapping exists.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx script/verify-dnd5e2024-rules-equipment.ts && node --import tsx --test server/dnd5e2024/rules-equipment.test.ts server/dnd5e2014/rules-equipment.test.ts`

  Expected: PASS; no 2014 key is reused as revised authority. Commit with `git add server/dnd5e2024/extract-rules-equipment.ts server/dnd5e2024/rules-equipment.test.ts script/verify-dnd5e2024-rules-equipment.ts && git commit -m "feat: extract dnd5e2024 rules and equipment"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 19.

### Task 19: Extract and verify 2024 spells and spell lists

**Files:**
- Create: `server/dnd5e2024/extract-spells.ts`
- Create: `server/dnd5e2024/spells.test.ts`
- Create: `script/verify-dnd5e2024-spells.ts`
- Test: `server/dnd5e2024/spells.test.ts`, `server/dnd5e2014/spells.test.ts`

**Interfaces:**
- Consumes: Task 16 corpus and Task 17 class/origin revisions.
- Produces: independent 2024 spells, memberships, typed Emanation/targeting/concentration/slot effects.

- [ ] **Step 1: Write red revised-spell tests.**

  Assert revised prepared schedules/list memberships, ritual eligibility, one-slot-per-turn rule, concentration DC cap 30, revised Cure Wounds/Healing Word examples, independent conjure effects, and mobile Emanation origin/inclusion/movement. Assert 2014 Bonus Action spell and static sphere assumptions reject in revised paths.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2024/spells.test.ts`

  Expected: FAIL because revised spell/list/area records are absent.

- [ ] **Step 3: Implement independent extraction.**

  Create exact 2024 spell revisions and memberships; type Emanation origin, creator inclusion decision, movement linkage, affected-set history, and definition revision. A same-name 2014 spell is never an input or fallback.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx script/verify-dnd5e2024-spells.ts && node --import tsx --test server/dnd5e2024/spells.test.ts server/dnd5e2014/spells.test.ts`

  Expected: PASS; every revised spell/list field has page evidence. Commit with `git add server/dnd5e2024/extract-spells.ts server/dnd5e2024/spells.test.ts script/verify-dnd5e2024-spells.ts && git commit -m "feat: extract dnd5e2024 spells"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 20.

### Task 20: Extract and verify 2024 Magic Items, Gameplay Toolbox, monsters, and Animals

**Files:**
- Create: `server/dnd5e2024/extract-items-toolbox-creatures.ts`
- Create: `server/dnd5e2024/items-toolbox-creatures.test.ts`
- Create: `script/verify-dnd5e2024-items-toolbox-creatures.ts`
- Test: `server/dnd5e2024/items-toolbox-creatures.test.ts`, `server/dnd5e2014/monsters-reference.test.ts`

**Interfaces:**
- Consumes: Task 16 manifest.
- Produces: revised `magic_item`, `poison`, `hazard`, `environment_rule`, `table`, `rule_section`, `monster`, `animal`, and monster action/bonus action/reaction/gear/save-display records from the four separately manifested SRD 5.2.1 sections assigned only to this extractor.

- [ ] **Step 1: Write red creature tests.**

  Assert manifest-derived expected counts and exact page ownership independently for Magic Items, Gameplay Toolbox, Monsters, and Animals. Cover magic-item use/activation, Potion of Healing Bonus Action cost, magic-item crafting/categories/prices, attunement, and exact item definitions only from the Magic Items section. Assert revised initiative/save display preserves displayed modifier separately from save proficiency/source; all six displayed values never infer six proficiencies; combined immunities, Gear, spellcasting action headings, Bonus Actions, and revised CR metadata are source-native. Assert a reshaped 2014 block rejects and Task 18 cannot duplicate any assigned segment.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2024/items-toolbox-creatures.test.ts`

  Expected: FAIL because the four revised source sections have no independently counted canonical/reference corpus.

- [ ] **Step 3: Implement extraction.**

  Persist source-native magic-item/toolbox/monster/animal records plus neutral runtime projections and page anchors; record each rules-bearing item/action capability separately. Keep tactics/hazards/environment and unsupported item effects reference-only until their exact evaluator is added.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx script/verify-dnd5e2024-items-toolbox-creatures.ts && node --import tsx --test server/dnd5e2024/items-toolbox-creatures.test.ts server/dnd5e2014/monsters-reference.test.ts`

  Expected: PASS with separate manifest-derived Magic Items and Animals counts, no double-owned segment, and no revised creature synthesized from an old definition. Commit with `git add server/dnd5e2024/extract-items-toolbox-creatures.ts server/dnd5e2024/items-toolbox-creatures.test.ts script/verify-dnd5e2024-items-toolbox-creatures.ts && git commit -m "feat: extract dnd5e2024 items toolbox and creatures"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 21A.

### Task 21A: Implement paired 2024 character creation and advancement policy

**Files:**
- Create: `server/dnd5e2024/character-policy.ts`
- Create: `server/dnd5e2024/character-policy.test.ts`
- Create: `server/dnd5e-difference-matrix.test.ts`
- Modify: `server/character-stats.ts`
- Modify: `server/leveling.ts`
- Modify: `server/routes.ts`
- Modify: `server/rules-command-service.ts`
- Modify: `client/src/pages/campaign.tsx`
- Modify: `server/dnd5e-creation-advancement-routes.test.ts`
- Modify: `client/src/pages/campaign.test.tsx`
- Test: `server/dnd5e2024/character-policy.test.ts`, `server/dnd5e-difference-matrix.test.ts`, `server/dnd5e-creation-advancement-routes.test.ts`, `client/src/pages/campaign.test.tsx`

**Interfaces:**
- Consumes: Task 17 canonical origin/class/progression revisions, 2014 Task 14A policy, and Task 5 commands.
- Produces: `Dnd5e2024CharacterCreationPolicy`, `Dnd5e2024AdvancementPolicy`, and paired character capability results.

- [ ] **Step 1: Write red revised-character pairs.**

  Pair race versus species ownership, background ability allocation/Origin feat/tool/equipment, languages, feat categories/prerequisites, class/subclass level-three timing, progression/resources, and post-20 behavior. Require exact 2024 IDs and server-calculated HP/AC/proficiency/saves/initiative; reject 2014 race ASIs and client/AI totals. Re-run the current campaign creation form and every creation/level-up route against both explicit generations: 2024 dispatches only to the revised policy, 2014 remains unchanged, and crafted cross-generation or stale projections fail closed.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2024/character-policy.test.ts server/dnd5e-difference-matrix.test.ts`

  Expected: FAIL because no revised creation/advancement profile exists.

- [ ] **Step 3: Implement from the independent 5.2.1 manifest.**

  Resolve revised choices and derived state only through the 2024 evaluated manifest and Task 5. Update `server/leveling.ts`, every relevant `server/routes.ts` handler, and `client/src/pages/campaign.tsx` to use exact context/policy dispatch and server-supplied choices; share storage/choice orchestration where neutral, never source definitions or fallback results.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/dnd5e2024/character-policy.test.ts server/dnd5e-difference-matrix.test.ts server/dnd5e2014/character-policy.test.ts server/dnd5e-creation-advancement-routes.test.ts client/src/pages/campaign.test.tsx && npm run typecheck && npm run build`

  Expected: PASS with paired provenance and no creation/advancement bypass. Commit with `git add server/dnd5e2024/character-policy.ts server/dnd5e2024/character-policy.test.ts server/dnd5e-difference-matrix.test.ts server/character-stats.ts server/leveling.ts server/routes.ts server/rules-command-service.ts client/src/pages/campaign.tsx server/dnd5e-creation-advancement-routes.test.ts client/src/pages/campaign.test.tsx && git commit -m "feat: add paired dnd5e2024 character policies"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 21B.

### Task 21B: Implement paired 2024 checks, combat, movement, and conditions

**Files:**
- Create: `server/dnd5e2024/roll-combat-policy.ts`
- Create: `server/dnd5e2024/roll-combat-policy.test.ts`
- Modify: `server/dnd5e-difference-matrix.test.ts`
- Modify: `server/dice-engine.ts`
- Modify: `server/combat-engine.ts`
- Modify: `server/rules-command-service.ts`
- Test: `server/dnd5e2024/roll-combat-policy.test.ts`, `server/dnd5e-difference-matrix.test.ts`

**Interfaces:**
- Consumes: Task 18 rule/action/condition/equipment records, Task 20 Gameplay-Toolbox environment and creature projections, 2014 Task 14B policy, and Task 5 commands.
- Produces: revised CheckSave/Combat/Condition/Environment policies and audited `declineSave`, liquid-impact Reaction, suffocation, and knockout-termination events.

- [ ] **Step 1: Write red revised-combat pairs.**

  Pair natural-roll kinds; voluntary save controller authorization/no roll; tool-plus-skill Advantage with one PB; Heroic Inspiration; surprise; Attack weapon swap; unarmed/grapple/shove; Exhaustion; Hide/Help; Incapacitated/Invisible/Stunned; opportunity attacks; creature-space movement; voluntary Prone at Speed 0; the revised **melee-only** Piercing underwater exception plus a ranged-Piercing counter-test; falling into liquid with the authorized DC 15 Athletics/Acrobatics Reaction versus no legacy counterpart; `breath_expired | choking` onset for both suffocation profiles, with revised end-of-turn Exhaustion/add-remove flow versus the legacy round-countdown/0-HP/healing-stabilization flow; simultaneous multi-target save damage versus separate attacks; action terminology; and revised knockout at 1 HP plus all three termination exits (Short Rest completion, HP regain, or successful DC 10 Wisdom (Medicine) first aid) versus the legacy knockout. Pair displayed monster saves versus proficiency. Include DM-controlled targets and prove AI cannot submit `declineSave`, choose the falling Reaction, or perform first aid without actor authority.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2024/roll-combat-policy.test.ts server/dnd5e-difference-matrix.test.ts`

  Expected: FAIL because revised combat and authority predicates are absent.

- [ ] **Step 3: Implement exact revised dispatch.**

  Share dice, targeting, LOS, environmental timers, movement/fall events, rest/check/action primitives, and transactions only through exact profiles. Store damage-roll grouping, observer-relative visibility, condition bundle revision, save-choice controller, tool/skill relevance, underwater attack mode/range, liquid-impact choice, suffocation contribution source, knockout termination predicate, and creature save-proficiency source in each applicable event. Unsupported environmental nuance returns a generation-specific, source-linked `requires_adjudication` record without mutation.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/dnd5e2024/roll-combat-policy.test.ts server/dnd5e-difference-matrix.test.ts server/dnd5e2014/roll-combat-policy.test.ts && npm run typecheck`

  Expected: PASS with every named combat pair isolated from dnd35/legacy. Commit with `git add server/dnd5e2024/roll-combat-policy.ts server/dnd5e2024/roll-combat-policy.test.ts server/dnd5e-difference-matrix.test.ts server/dice-engine.ts server/combat-engine.ts server/rules-command-service.ts && git commit -m "feat: add paired dnd5e2024 combat policies"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 21C.

### Task 21C: Implement paired 2024 rest, spellcasting, and equipment policy

**Files:**
- Create: `server/dnd5e2024/rest-spell-equipment-policy.ts`
- Create: `server/dnd5e2024/rest-spell-equipment-policy.test.ts`
- Create: `server/dnd5e2024/capabilities.ts`
- Modify: `server/dnd5e-difference-matrix.test.ts`
- Modify: `server/rules-command-service.ts`
- Modify: `server/routes.ts`
- Modify: `client/src/components/SpellSheet.tsx`
- Modify: `client/src/components/SpellSheet.test.tsx`
- Modify: `client/src/lib/spellMath.ts`
- Modify: `client/src/lib/spellMath.test.ts`
- Modify: `server/dnd5e-rest-spell-routes.test.ts`
- Test: `server/dnd5e2024/rest-spell-equipment-policy.test.ts`, `server/dnd5e-difference-matrix.test.ts`, `server/dnd5e-rest-spell-routes.test.ts`, `client/src/components/SpellSheet.test.tsx`, `client/src/lib/spellMath.test.ts`

**Interfaces:**
- Consumes: Tasks 18–20 revised rules/equipment/spell/magic-item records, 2014 Task 14C policies, and Task 5 commands.
- Produces: revised Rest/Spellcasting/Equipment policies, complete paired-difference evidence, and fixed-gate capability report.

- [ ] **Step 1: Write red revised rest/spell/equipment pairs.**

  Pair Bonus Action spell versus one-slot-per-turn restriction, ritual eligibility, concentration damage DC cap, Short Rest minimum-1-HP eligibility and per-die healing floor, Long Rest 24-hour-versus-16-hour cadence, half-versus-all Hit Dice, reduced-ability/HP-maximum restoration, Exhaustion recovery, and exact legacy interruption/restart versus revised triggers/Short-Rest-fallback/resumption/additional-time behavior. Also pair known/prepared/list membership, spell changes, Emanation mobile origin/inclusion, Mastery/Heavy/Light/Thrown properties, Armor Training versus shield, potion action cost, crafting, attunement, and changed item definitions. Re-run every rest/resource/spell route and `SpellSheet` action for both generations; 2024 uses only revised server projections, direct PATCH/client math cannot mutate authoritative state, and the already-green 2014 path stays identical. Require every non-executable feature/spell/item/monster action to have an explicit adjudication disposition.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2024/rest-spell-equipment-policy.test.ts server/dnd5e-difference-matrix.test.ts`

  Expected: FAIL because revised resource and equipment policies are absent.

- [ ] **Step 3: Implement and aggregate capability evidence.**

  Execute only typed 2024 revisions from the evaluated manifest. Make the existing route and `SpellSheet` entry points dispatch through revised server policy just as Task 14C did for 2014; keep `spellMath` limited to explicitly scoped presentation/legacy helpers. Preserve exact area origin/movement, slots/concentration/resources, action costs, equipped state, and item-definition revisions in events. Aggregate Tasks 21A–21C without claiming automation for reference-only corpus entries.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/dnd5e2024/rest-spell-equipment-policy.test.ts server/dnd5e-difference-matrix.test.ts server/dnd5e2014/rest-spell-equipment-policy.test.ts server/dnd5e-rest-spell-routes.test.ts client/src/components/SpellSheet.test.tsx client/src/lib/spellMath.test.ts && npm run typecheck && npm run build`

  Expected: PASS; every companion-matrix row has paired executable evidence or explicit reference/adjudication status, with no route/UI bypass. Commit with `git add server/dnd5e2024/rest-spell-equipment-policy.ts server/dnd5e2024/rest-spell-equipment-policy.test.ts server/dnd5e2024/capabilities.ts server/dnd5e-difference-matrix.test.ts server/rules-command-service.ts server/routes.ts server/dnd5e-rest-spell-routes.test.ts client/src/components/SpellSheet.tsx client/src/components/SpellSheet.test.tsx client/src/lib/spellMath.ts client/src/lib/spellMath.test.ts && git commit -m "feat: complete paired dnd5e2024 policies"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 22.

### Task 22: Expose 2024 only after its independent fixed gate

**Files:**
- Create: `client/src/lib/rulesAdapters/dnd5e2024.ts`
- Create: `server/dnd5e2024/release-gate.ts`
- Create: `server/dnd5e2024/release-gate.test.ts`
- Modify: `client/src/lib/rulesAdapters/index.ts`
- Modify: `server/routes.ts`
- Modify: `server/dm-engine-rules-context.test.ts`
- Modify: `server/dnd5e-compendium-isolation.test.ts`
- Modify: `client/src/pages/home.tsx`
- Modify: `client/src/pages/campaign.tsx`
- Modify: `client/src/lib/campaignRulesetOptions.ts`
- Modify: `client/src/lib/campaignRulesetOptions.test.ts`
- Modify: `client/src/lib/rulesAdapters/index.test.ts`
- Modify: `server/routes-combat.e2e.test.ts`
- Test: `server/dnd5e2024/release-gate.test.ts`, `client/src/lib/rulesAdapters/index.test.ts`, `server/dm-engine-rules-context.test.ts`, `server/dnd5e-compendium-isolation.test.ts`, `server/routes-combat.e2e.test.ts`

**Interfaces:**
- Consumes: Tasks 16–21C evidence/capabilities and Task 15 generic prompt/adapter/source/outbox contracts.
- Produces: `assertDnd5e2024Selectable(releaseId): void`, `dnd5e2024Adapter`.

- [ ] **Step 1: Write red independence tests.**

  Assert a green 2014 release cannot satisfy the 2024 gate. Require 2024 complete verified-open corpus, all exact fixed-gate capability evidence, paired difference suite, exact adapter/prompt/source/outbox/billing/offline tests, and dnd35/legacy regression. The prompt test must prove it carries 2024 release/manifest/capabilities and cannot retrieve 2014 same-slug facts. Re-run the Task 15 manifest-only Library/item-use contract for 2024 and reject legacy `dnd5e-2014:*`, `dnd5e-2024:*`, and `dmos:*` keys unless the campaign manifest contains an exact reviewed target revision. Both creation surfaces must derive the same 2024 option from the persisted gate while keeping the already-selectable 2014 option unchanged.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e2024/release-gate.test.ts`

  Expected: FAIL until all revised evidence exists.

- [ ] **Step 3: Implement gate/UI.**

  Add 2024 adapter and server-enforced selection; reject crafted creation while any gate assertion is missing. Do not change the selectable status of 2014 or dnd35e, do not alter existing bare legacy campaigns, and keep bare `dnd5e` absent from new-campaign selection after the Task 15 swap.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/dnd5e2024/release-gate.test.ts client/src/lib/rulesAdapters/index.test.ts client/src/lib/campaignRulesetOptions.test.ts server/dm-engine-rules-context.test.ts server/dnd5e-compendium-isolation.test.ts server/routes-combat.e2e.test.ts && npm run test && npm run typecheck && npm run build`

  Expected: PASS; revised campaigns are independently selectable only after full proof. Commit with `git add client/src/lib/rulesAdapters/dnd5e2024.ts server/dnd5e2024/release-gate.ts server/dnd5e2024/release-gate.test.ts client/src/lib/rulesAdapters/index.ts client/src/lib/campaignRulesetOptions.ts client/src/lib/campaignRulesetOptions.test.ts server/routes.ts client/src/pages/home.tsx client/src/pages/campaign.tsx client/src/lib/rulesAdapters/index.test.ts server/dm-engine-rules-context.test.ts server/dnd5e-compendium-isolation.test.ts server/routes-combat.e2e.test.ts && git commit -m "feat: expose gated dnd5e2024 campaigns"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Phase 5.

## Phase 5 — Legacy inventory, conversion, reconciliation, and final proof

### Task 23: Audit legacy keys and inventory dispositions without rewrites

**Files:**
- Create: `server/legacy-compendium-crosswalk.ts`
- Create: `server/legacy-compendium-crosswalk.test.ts`
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Modify: `server/compendium-routes.ts`
- Modify: `server/items-use-auth.test.ts`
- Test: `server/legacy-compendium-crosswalk.test.ts`, `server/items-use-auth.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 9–13, and 16–20 revision/evidence rows.
- Produces: `auditLegacyDefinitionKeys(): LegacyKeyAuditReport`, `InventoryTargetDisposition = "mapped_replacement" | "retained_inert_reference" | "authorized_target_homebrew" | "removed_from_target_draft_but_preserved_in_legacy_snapshot"`.

**Provisional additive migration contract — REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION:**

- `legacy_definition_evidence`: `evidence_id TEXT PRIMARY KEY`, `legacy_ruleset_release_id TEXT NOT NULL REFERENCES ruleset_releases(id) ON DELETE RESTRICT`, `owner_kind TEXT NOT NULL CHECK (owner_kind IN ('item','shop_item','inventory_instance','character_data'))`, `owner_row_id TEXT NOT NULL`, `source_locator_json TEXT NOT NULL`, `source_locator_sha256 TEXT NOT NULL CHECK (length(source_locator_sha256) = 64)`, `definition_key TEXT`, `payload_blob_sha256 TEXT NOT NULL REFERENCES source_artifact_blobs(sha256) ON DELETE RESTRICT`, `payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64)`, and `captured_at TEXT NOT NULL`; `UNIQUE(legacy_ruleset_release_id, owner_kind, owner_row_id, source_locator_sha256, payload_sha256)`. `source_locator_json` is canonical JSON that includes an inventory-instance ordinal when no row ID exists; the BLOB retains exact original UTF-8 bytes.
- `legacy_definition_crosswalk_revisions`: `crosswalk_revision_id TEXT PRIMARY KEY`, `evidence_id TEXT NOT NULL REFERENCES legacy_definition_evidence(evidence_id) ON DELETE RESTRICT`, `target_mechanical_ruleset_id TEXT NOT NULL CHECK (target_mechanical_ruleset_id IN ('dnd5e2014','dnd5e2024'))`, `revision_number INTEGER NOT NULL CHECK (revision_number > 0)`, `status TEXT NOT NULL CHECK (status IN ('mapped','ambiguous','unmapped','invalid','cross_generation'))`, `target_canonical_revision_id INTEGER REFERENCES canonical_revisions(id) ON DELETE RESTRICT`, `review_evidence_json TEXT NOT NULL`, `review_evidence_sha256 TEXT NOT NULL CHECK (length(review_evidence_sha256) = 64)`, `reviewer_actor_scope_key TEXT NOT NULL`, `supersedes_crosswalk_revision_id TEXT REFERENCES legacy_definition_crosswalk_revisions(crosswalk_revision_id) ON DELETE RESTRICT`, and `created_at TEXT NOT NULL`; `UNIQUE(evidence_id, target_mechanical_ruleset_id, revision_number)` and `CHECK ((status = 'mapped' AND target_canonical_revision_id IS NOT NULL) OR (status <> 'mapped' AND target_canonical_revision_id IS NULL))`.
- `legacy_definition_crosswalk_candidates`: `crosswalk_revision_id TEXT NOT NULL REFERENCES legacy_definition_crosswalk_revisions(crosswalk_revision_id) ON DELETE RESTRICT`, `candidate_canonical_revision_id INTEGER NOT NULL REFERENCES canonical_revisions(id) ON DELETE RESTRICT`, `candidate_evidence_json TEXT NOT NULL`, and `candidate_evidence_sha256 TEXT NOT NULL CHECK (length(candidate_evidence_sha256) = 64)`; primary key `(crosswalk_revision_id, candidate_canonical_revision_id)`. Index crosswalk revisions by `(evidence_id, target_mechanical_ruleset_id, revision_number DESC)` and candidates by `candidate_canonical_revision_id`.
- All three tables are append-only through `BEFORE UPDATE`/`BEFORE DELETE` guards. A correction inserts the next numbered revision; it never mutates a prior mapping. Operational rollback disables target use but retains evidence, candidates, and revisions. It never updates `items.definition_key`, `shop_items.definition_key`, character JSON, or inventory JSON.

- [ ] **Step 1: Write red crosswalk/disposition fixtures.**

  Cover 2014/2024 keys, `dmos:*`, null/malformed/deleted target/duplicate/custom/homebrew/cross-generation keys. Assert audit statuses `mapped | ambiguous | unmapped | invalid | cross_generation`; conversion draft requires exactly one reviewed target disposition per inventory instance; strict target rules never execute source-generation definition by legacy key.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/legacy-compendium-crosswalk.test.ts`

  Expected: FAIL because keys are neither complete audit records nor target dispositions.

- [ ] **Step 3: Implement append-only crosswalks.**

  Add the exact provisional evidence/crosswalk/candidate tables above via the repository migration runner. Capture immutable original-key/payload evidence, target revision, status, and reviewer revision; do not update `items.definition_key`, `shop_items.definition_key`, or inventory JSON. Scope campaign resolution to its pinned evaluated manifest.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/legacy-compendium-crosswalk.test.ts server/items-use-auth.test.ts && npm run typecheck`

  Expected: PASS; every item is explicitly retained, mapped, homebrewed, or removed only from the target draft while preserved historically. Commit with `git add server/legacy-compendium-crosswalk.ts server/legacy-compendium-crosswalk.test.ts shared/schema.ts server/storage.ts server/compendium-routes.ts server/items-use-auth.test.ts && git commit -m "feat: audit conversion inventory dispositions"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 24.

### Task 24: Resolve conversion ownership and create complete-state drafts

**Files:**
- Create: `server/conversion-ownership-service.ts`
- Create: `server/conversion-ownership-service.test.ts`
- Create: `server/campaign-conversion-service.ts`
- Create: `server/campaign-conversion-service.test.ts`
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Modify: `server/routes.ts`
- Test: `server/conversion-ownership-service.test.ts`, `server/campaign-conversion-service.test.ts`

**Interfaces:**
- Consumes: Tasks 4–5 legacy snapshots/events, Task 23 dispositions, and visitor/user identities.
- Produces: `resolveCharacterConversionOwner`, `createConversionDraft`, and `reviewConversionDraft`. Commit and reconciliation commands are deliberately deferred to Task 25.

**Provisional additive migration contract — REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION:**

- `character_ownership_revisions`: `ownership_revision_id TEXT PRIMARY KEY`, `character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`, `revision_number INTEGER NOT NULL CHECK (revision_number > 0)`, `state TEXT NOT NULL CHECK (state IN ('resolved_user','resolved_visitor','orphaned','conflicting','transfer_pending','merged'))`, `owner_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT`, `owner_visitor_key_digest TEXT`, `candidate_evidence_blob_sha256 TEXT NOT NULL REFERENCES source_artifact_blobs(sha256) ON DELETE RESTRICT`, `candidate_evidence_sha256 TEXT NOT NULL CHECK (length(candidate_evidence_sha256) = 64)`, `supersedes_ownership_revision_id TEXT REFERENCES character_ownership_revisions(ownership_revision_id) ON DELETE RESTRICT`, `recorded_by_actor_scope_key TEXT NOT NULL`, and `created_at TEXT NOT NULL`; `UNIQUE(character_id, revision_number)`. Add checks requiring user-only for `resolved_user`, visitor-only for `resolved_visitor`, neither for `orphaned`, and both for `merged`; `conflicting`/`transfer_pending` derive candidates from the retained evidence blob and cannot authorize review.
- `campaign_conversion_drafts`: `draft_id TEXT PRIMARY KEY`, `campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT`, `source_campaign_rules_snapshot_id TEXT NOT NULL REFERENCES campaign_rules_snapshots(id) ON DELETE RESTRICT`, `source_campaign_state_version INTEGER NOT NULL`, `target_ruleset_release_id TEXT NOT NULL REFERENCES ruleset_releases(id) ON DELETE RESTRICT`, `target_evaluated_manifest_id TEXT NOT NULL REFERENCES evaluated_corpus_manifests(id) ON DELETE RESTRICT`, `complete_state_blob_sha256 TEXT NOT NULL REFERENCES source_artifact_blobs(sha256) ON DELETE RESTRICT`, `complete_state_sha256 TEXT NOT NULL CHECK (length(complete_state_sha256) = 64)`, `proposal_blob_sha256 TEXT NOT NULL REFERENCES source_artifact_blobs(sha256) ON DELETE RESTRICT`, `proposal_sha256 TEXT NOT NULL CHECK (length(proposal_sha256) = 64)`, `created_by_actor_scope_key TEXT NOT NULL`, and `created_at TEXT NOT NULL`; `UNIQUE(campaign_id, source_campaign_state_version, target_ruleset_release_id, proposal_sha256)`. The two content hashes cover canonical JSON bytes; every referenced source/canonical/manifest ID is included in those bytes.
- `campaign_conversion_draft_status_events`: `status_event_id TEXT PRIMARY KEY`, `draft_id TEXT NOT NULL REFERENCES campaign_conversion_drafts(draft_id) ON DELETE RESTRICT`, `sequence INTEGER NOT NULL CHECK (sequence > 0)`, `status TEXT NOT NULL CHECK (status IN ('draft','awaiting_review','approved','committed','cancelled','superseded'))`, `actor_scope_key TEXT NOT NULL`, `review_set_sha256 TEXT CHECK (review_set_sha256 IS NULL OR length(review_set_sha256) = 64)`, and `created_at TEXT NOT NULL`; `UNIQUE(draft_id, sequence)`. A named insert trigger permits only initial `draft`; `draft -> awaiting_review|cancelled|superseded`; `awaiting_review -> approved|cancelled|superseded`; and `approved -> committed|cancelled|superseded`. Terminal states reject later status events.
- `campaign_conversion_character_reviews`: `review_revision_id TEXT PRIMARY KEY`, `draft_id TEXT NOT NULL REFERENCES campaign_conversion_drafts(draft_id) ON DELETE RESTRICT`, `character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE RESTRICT`, `ownership_revision_id TEXT NOT NULL REFERENCES character_ownership_revisions(ownership_revision_id) ON DELETE RESTRICT`, `revision_number INTEGER NOT NULL CHECK (revision_number > 0)`, `review_state TEXT NOT NULL CHECK (review_state IN ('pending','approved','rejected'))`, `target_projection_blob_sha256 TEXT NOT NULL REFERENCES source_artifact_blobs(sha256) ON DELETE RESTRICT`, `target_projection_sha256 TEXT NOT NULL CHECK (length(target_projection_sha256) = 64)`, `reviewer_actor_scope_key TEXT NOT NULL`, and `created_at TEXT NOT NULL`; `UNIQUE(draft_id, character_id, revision_number)`.
- `campaign_conversion_inventory_dispositions`: `disposition_revision_id TEXT PRIMARY KEY`, `draft_id TEXT NOT NULL REFERENCES campaign_conversion_drafts(draft_id) ON DELETE RESTRICT`, `source_locator_sha256 TEXT NOT NULL CHECK (length(source_locator_sha256) = 64)`, `revision_number INTEGER NOT NULL CHECK (revision_number > 0)`, `disposition TEXT NOT NULL CHECK (disposition IN ('mapped_replacement','retained_inert_reference','authorized_target_homebrew','removed_from_target_draft_but_preserved_in_legacy_snapshot'))`, `target_canonical_revision_id INTEGER REFERENCES canonical_revisions(id) ON DELETE RESTRICT`, `target_homebrew_blob_sha256 TEXT REFERENCES source_artifact_blobs(sha256) ON DELETE RESTRICT`, `reviewer_actor_scope_key TEXT NOT NULL`, and `created_at TEXT NOT NULL`; `UNIQUE(draft_id, source_locator_sha256, revision_number)`. Checks require a canonical target only for `mapped_replacement`, a homebrew blob only for `authorized_target_homebrew`, and neither for the two preservation/removal dispositions.
- Add current-revision indexes on `(character_id, revision_number DESC)`, `(draft_id, character_id, revision_number DESC)`, and `(draft_id, source_locator_sha256, revision_number DESC)`, plus `(campaign_id, source_campaign_state_version)` on drafts. All payload/draft/review/disposition rows are append-only; edits create a new draft or review revision. Rollback disables conversion commands and retains every row/blob.

- [ ] **Step 1: Write red ownership/draft tests.**

  Cover user owner, visitor-only owner, null user ID, merged user/visitor identity, pending ownership transfer, completed ownership transfer, host who is not character owner, mismatch, orphan claim, active encounter/turn/reaction/cast/rest/death-save, missing/quarantined source, stale version, unresolved mapping/disposition, and unreviewed owner. Assert complete pre-conversion snapshot includes campaign, characters, items/inventory, effects, encounters/participants, queued/pending actions, rests, death state, spell preparation/concentration/resources, roll/event links, and source/policy context. In a migration fixture with `PRAGMA foreign_keys = ON`, insert a valid `users.id` ownership revision successfully, reject a nonexistent user ID, and prove an attempted parent-key update/delete is restricted.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/conversion-ownership-service.test.ts server/campaign-conversion-service.test.ts`

  Expected: FAIL because ownership and complete conversion snapshots do not exist.

- [ ] **Step 3: Implement authority and immutable draft.**

  Create the exact provisional ownership/draft/status/review/disposition tables above through the migration runner. Resolve user/visitor ownership with an immutable evidence history; Campaign Owner cannot override another Character Owner. Store source XP/level as immutable original evidence and target level/progression as reviewed proposal. Remove legacy species ASI automatically only when per-score provenance proves it is separable from base, later ASIs, effects, tomes, and manual edits; otherwise leave all six target scores unresolved. Require owner selection for class/subclass/background/feat/species/spells/Mastery and every inventory disposition.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/conversion-ownership-service.test.ts server/campaign-conversion-service.test.ts && npm run typecheck`

  Expected: PASS; conversion drafts preserve source state and expose every target choice. Commit with `git add server/conversion-ownership-service.ts server/conversion-ownership-service.test.ts server/campaign-conversion-service.ts server/campaign-conversion-service.test.ts shared/schema.ts server/storage.ts server/routes.ts && git commit -m "feat: create reviewed conversion drafts"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 25.

### Task 25: Commit, rollback, or reconcile conversion lineage safely

**Files:**
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Modify: `server/campaign-conversion-service.ts`
- Modify: `server/campaign-conversion-service.test.ts`
- Modify: `server/rules-command-service.ts`
- Modify: `server/rules-command-service.test.ts`
- Test: `server/campaign-conversion-service.test.ts`, `server/rules-command-service.test.ts`

**Interfaces:**
- Consumes: Task 24 approved complete draft and Task 5 atomic commands.
- Produces: `commitConversion(draftId, assertion)`, `rollbackConversion(lineageId, assertion)`, and `createForwardReconciliation(lineageId, draftInput)`.

**Provisional additive migration contract — REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION:**

- `campaign_conversion_lineage`: `lineage_id TEXT PRIMARY KEY`, `campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT`, `draft_id TEXT REFERENCES campaign_conversion_drafts(draft_id) ON DELETE RESTRICT`, `lineage_kind TEXT NOT NULL CHECK (lineage_kind IN ('conversion','rollback','forward_reconciliation'))`, `related_lineage_id TEXT REFERENCES campaign_conversion_lineage(lineage_id) ON DELETE RESTRICT`, `source_campaign_rules_snapshot_id TEXT NOT NULL REFERENCES campaign_rules_snapshots(id) ON DELETE RESTRICT`, `target_campaign_rules_snapshot_id TEXT NOT NULL REFERENCES campaign_rules_snapshots(id) ON DELETE RESTRICT`, `commit_event_id TEXT NOT NULL UNIQUE REFERENCES rules_events(event_id) ON DELETE RESTRICT`, `commit_state_version INTEGER NOT NULL`, `lineage_payload_blob_sha256 TEXT NOT NULL REFERENCES source_artifact_blobs(sha256) ON DELETE RESTRICT`, `lineage_payload_sha256 TEXT NOT NULL CHECK (length(lineage_payload_sha256) = 64)`, and `committed_at TEXT NOT NULL`; checks require distinct source/target snapshots, require a non-null draft and null related lineage for `conversion`, require a non-null draft and related lineage for `forward_reconciliation`, and require a null draft plus related lineage for `rollback`. A partial unique index on `draft_id WHERE draft_id IS NOT NULL` prevents draft reuse; a partial unique index on `related_lineage_id WHERE lineage_kind = 'rollback'` permits at most one direct rollback of a lineage; index `(campaign_id, commit_state_version, lineage_id)` supports later-event detection.
- Lineage and referenced snapshots/events/blobs are append-only with update/delete guards. Conversion commit inserts the lineage row, Task 24 `committed` status event, new campaign snapshot, mutation event, outbox row, and state-version advance in the same Task 5 transaction. Rollback may insert a new `rollback` lineage only when the locked current campaign state version equals the related lineage's `commit_state_version`; any later state-changing event forces a new draft and `forward_reconciliation` lineage. Operational rollback disables new conversion commands and retains every schema object and row; no reverse migration restores state or deletes history.

- [ ] **Step 1: Write red lineage tests.**

  Assert commit reloads all authority/source/state versions inside one transaction, creates target snapshot/manifest and one outbox event, and preserves pre-conversion state. Assert one-click rollback succeeds only with no subsequent state-changing lineage event and restores every snapshotted field/reference—not merely the campaign ruleset pointer—through a new audited event. If a later roll/action/resource/event exists, rollback rejects without mutation and requires a fresh reviewable forward reconciliation draft.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/campaign-conversion-service.test.ts`

  Expected: FAIL because existing rollback semantics do not inspect later events.

- [ ] **Step 3: Implement commit and constrained reversal.**

  Add the exact provisional lineage table and constraints above through the migration runner. Commit approved target projections, snapshot, and lineage in a Task 5 transaction. Rollback creates a new audited event/snapshot and atomically restores the complete retained pre-conversion campaign, character, item/inventory, effect, encounter/action, rest/death, spell/resource, and source-policy state only when lineage has no later state-changing event. Otherwise build a forward reconciliation draft over current state; never delete or overwrite old snapshots/events/drafts.

- [ ] **Step 4: Run green and commit.**

  Run: `node --import tsx --test server/campaign-conversion-service.test.ts server/rules-command-service.test.ts && npm run typecheck`

  Expected: PASS; no later play is erased by a one-click reversal. Commit with `git add shared/schema.ts server/storage.ts server/campaign-conversion-service.ts server/campaign-conversion-service.test.ts server/rules-command-service.ts server/rules-command-service.test.ts && git commit -m "feat: reconcile conversion rollback lineage"`.

  **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION** of Task 26.

### Task 26: Run the final immutable-foundation acceptance scan

**Files:**
- Create: `script/verify-dnd5e-foundation.ts`
- Create: `server/dnd5e-foundation-acceptance.test.ts`
- Create: `docs/superpowers/reports/2026-08-23-dnd5e-foundation-acceptance.md`
- Test: `server/dnd5e-foundation-acceptance.test.ts`

**Interfaces:**
- Consumes: all releases, manifests, rights/source evidence, family reports, capability results, crosswalks, commands, and conversion lineage.
- Produces: `Dnd5eFoundationAcceptanceReport` naming exact artifact/corpus/release/snapshot/manifest hashes and failed gates.

- [ ] **Step 1: Write the failing full matrix.**

  Cover six catalogue IDs, four mechanical IDs, unknown ID, legacy capture/unreplayable history, 3.5 source regression, source rights/obligations/lineage, hash drift, offline startup, 2014/2024 same slug, all fixed gate operations, all difference pairs, adapter/prompt authority, no billing mutation, duplicate/stale/outbox retry, key disposition states, visitor ownership, complete snapshot, rollback/no-later-event, and forward reconciliation.

- [ ] **Step 2: Run red.**

  Run: `node --import tsx --test server/dnd5e-foundation-acceptance.test.ts`

  Expected: FAIL until every preceding invariant is wired.

- [ ] **Step 3: Implement evidence-only scan.**

  Read retained database evidence and network-free fixtures only. Emit a Markdown report with invariant, command, result, artifact/corpus/release/snapshot/manifest identifiers, and failure reason. Exit nonzero on one failed invariant and prevent new campaign release publication.

- [ ] **Step 4: Run green verification.**

  Run: `node --import tsx script/verify-dnd5e-foundation.ts && node --import tsx --test server/dnd5e-foundation-acceptance.test.ts && npm run test && npm run typecheck && npm run build`

  Expected: all commands exit 0; the report proves independent 2014/2024 meaning, legal evidence, exact replay inputs, fixed selection gates, server authority, offline runtime, dnd35 preservation, and constrained conversion reconciliation.

- [ ] **Step 5: Commit.**

  Run: `git add script/verify-dnd5e-foundation.ts server/dnd5e-foundation-acceptance.test.ts docs/superpowers/reports/2026-08-23-dnd5e-foundation-acceptance.md && git commit -m "test: verify dnd5e foundation acceptance"`

  Expected: one evidence-only commit. Do not deploy, inspect production data, or alter production state under this plan.

## Coverage self-review

- Catalog versus `MechanicalRulesetId`, exact context, legacy capture/unreplayability, snapshots, and state events: Tasks 2–5.
- Semantic corpus versus artifact snapshot, many-to-many lineage, structured rights/obligations, dnd35 policy migration, and offline runtime: Tasks 3 and 6–8.
- Full 2014 family extraction before 2024: Tasks 9–15, including Tasks 14A–14C.
- Full independent 2024 family extraction and every named difference pair: Tasks 16–22, including Tasks 21A–21C.
- Fixed new-campaign gate: Tasks 14A–15 and 21A–22.
- Legacy key audit, complete conversion state, provenance-gated ASI, reviewed inventory/target XP, rollback/reconciliation: Tasks 23–25.
- End-to-end evidence and release prevention: Task 26.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-23-dnd5e-foundation-implementation-plan.md`. Do not execute it during the present research task. In a separately authorized future implementation session, choose one of these modes:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** — execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

Stop here for review; neither mode is authorized by this plan document alone.
