# DungeonMasterOS Existing D&D 5e System Audit

**Audit date:** 2026-08-23

**Frozen repository basis:** `origin/production-live-base` at `176456af5f79400bafe39836bbe01faebdfd4913`

**Research branch:** `feature/dnd5e-ruleset-research`

**Scope:** repository inspection only; no application code, schema, data, prompt, deployment, or live state was changed

## Evidence vocabulary

- `[REPOSITORY FACT]` is verified directly in the frozen DungeonMasterOS source, tests, schema, or checked-in plans.
- `[OFFICIAL SOURCE]`, `[DERIVED SOURCE]`, and `[SECONDARY SOURCE]` are reserved for the companion source-research reports. This repository audit does not use external rules text to classify an implementation as mechanically correct.
- `[INFERENCE]` is an engineering conclusion drawn from stated repository facts.
- `[OPEN QUESTION]` identifies a decision or fact the frozen repository cannot establish.
- `[AUDIT METHOD]` records how the repository inspection was performed; it is not a product fact.
- `[EXECUTION ATTESTATION]` records what this documentation-only task did or did not change.

Line references in this report refer to the frozen basis above. They are evidence coordinates, not promises that the same lines will exist after the parallel 3.5e work lands.

## Executive conclusion

`[REPOSITORY FACT]` DungeonMasterOS has one persisted 5e ruleset identity, `dnd5e`. It does **not** have separate mechanical identities for the 2014/SRD 5.1 generation and the revised 2024/SRD 5.2.x generation. `shared/rulesets.ts:14-35`, `shared/schema.ts:145-175`, and `shared/schema.ts:768-779` establish the single ID and make it the campaign default.

`[REPOSITORY FACT]` The item compendium deliberately imports records labelled `2014` and `2024`, but assigns both groups to `ruleset: "dnd5e"`. The persisted item keys retain their generation (`dnd5e-2014:<record>` and `dnd5e-2024:<record>`), while the campaign and canonical-rules layers cannot express that distinction. See `server/compendium.ts:68-113` and `server/compendium.ts:459-462`.

`[INFERENCE]` The current 5e system is **mixed/contaminated and partly unclear**, not safely classifiable as either a 2014 engine or a revised-2024 engine. Its class list, level table, proficiency model, six saves, and common combat vocabulary look like a legacy 5e baseline, but none is version-pinned. Its compendium contains both generations. Several behaviors are custom DungeonMasterOS policy, and several rules paths are incomplete or erroneous. Existing `dnd5e` campaigns therefore cannot be relabelled `2024`, or even asserted to be strictly canonical `2014`, without silently inventing history.

`[REPOSITORY FACT]` The emerging canonical architecture provides reusable source, provenance, source-enablement, canonical-ID, and append-only revision concepts. It is not yet connected to the legacy item compendium. The checked-in 3.5e Phase 2A ingestion work is a plan, not an implemented interface, on this frozen branch.

`[INFERENCE]` The safest future boundary is three explicit runtime identities: a non-selectable legacy compatibility identity for existing `dnd5e` state, plus new `dnd5e2014` and `dnd5e2024` identities. New campaigns must select an explicit generation. Conversion must be a user-controlled, audited operation; a deployment must never reinterpret old rows merely because revised content becomes available.

## Audit method and repository coverage

`[AUDIT METHOD]` The audit searched `shared/`, `server/`, `client/src/`, migrations, tests, and `docs/superpowers/` for ruleset IDs and for indirect mechanics vocabulary including proficiency, saves, rests, attacks, spells, conditions, advancement, compendium, canonical sources, prompts, and campaign source enablement. More than 1,400 textual matches were triaged; filenames that did not mention 5e were included.

`[REPOSITORY FACT]` Baseline verification on the frozen worktree completed before documentation work:

```text
npm test          289 tests; 288 passed; 1 skipped; 0 failed
npm run typecheck passed
git status        clean
```

`[REPOSITORY FACT]` `*.db` is ignored and the frozen commit contains no tracked `data.db`; database contents are therefore not frozen-repository evidence. `[LOCAL AUDIT OBSERVATION]` The ignored local `data.db` inspected during this audit had no tables or records. This report describes repository behavior and migration risk; it does not claim to describe production database contents.

## Classification summary

| Existing area | Classification | Repository evidence | Principal risk | Recommended future handling |
|---|---|---|---|---|
| SRD-labelled equipment and magic items with `edition: "2014"` | definitely 2014 / SRD 5.1-era | `server/compendium.ts:68-86` | Campaign source policy does not constrain visibility; identity is outside the canonical registry. | Preserve existing versioned keys; map them additively to 2014 canonical definitions and authoritative provenance. |
| SRD-labelled equipment, magic items, and poisons with `edition: "2024"` | definitely revised 2024 / SRD 5.2-era | `server/compendium.ts:88-113` | Records coexist under bare `dnd5e`; startup may skip their import. | Preserve keys; register under an explicit revised ruleset and source version after source verification. |
| Persisted campaign `ruleset: "dnd5e"` | mixed/contaminated and historically ambiguous | `shared/schema.ts:145-175`; `server/storage.ts:423-437` | A default migration can silently rewrite campaign meaning. | Retain a legacy compatibility identity/state until an owner explicitly converts or an evidence-backed policy is approved. |
| Proficiency bonus, six saves, level XP, hit dice, and ASI levels | unclear legacy 5e | `server/character-stats.ts:308-314,401-404`; `server/leveling.ts:15-19,68-112` | Any non-3.5 ID inherits these values; no source/version provenance exists. | Move behind explicit registered adapters; validate each table against its generation source. |
| 5e class roster and stat-generation UI | unclear legacy 5e | `shared/classes.ts:8-20,60-65`; `client/src/components/StatGenWizard.tsx:2-6,38-40` | Revised progression and origin construction cannot be represented by a shared name list. | Give each ruleset versioned class/progression/origin definitions; fail closed for unknown IDs. |
| Server roll logging, tag validation, turn/idempotency mechanics | edition-neutral infrastructure | `server/dice-engine.ts:1-5`; `server/mechanics-tags.ts:21-35,53-130`; `shared/schema.ts:449-472` | Generic plumbing can still execute an incorrect global rules policy. | Reuse audit/event infrastructure; dispatch evaluators through the campaign's exact ruleset. |
| NPC bounds, fixed XP awards, cinematic roll `+20` | homebrew/custom DungeonMasterOS behavior | `server/dice-engine.ts:120-145`; `server/leveling.ts:50-62`; `server/character-stats.ts:191-198` | Custom policy may be mistaken for an SRD rule. | Name and provenance as platform policy; keep separate from canonical-source claims. |
| Generated DMOS compendium items | homebrew/custom DungeonMasterOS behavior | `server/compendium.ts:641-680` | Generated records are tagged `dnd5e` and `edition: "compatible"`, so their actual compatibility is not mechanically proven. | Give homebrew explicit author/source provenance and an allowed-ruleset declaration; do not mark it official. |
| Canonical source/provenance/revision primitives | edition-neutral design, currently 3.5-led | `shared/rules-registry/*.ts` | Current canonical ID grammar cannot distinguish the two 5e generations under bare `dnd5e`. | Reuse concepts after Phase 2A revalidation; assign generation-specific ruleset IDs. |
| 3.5 BAB, saves, races, spell DC, and encumbrance | deliberately 3.5-specific | `server/character-stats.ts:71-189,383-400`; `shared/races.ts`; `client/src/lib/spellMath.ts`; `shared/encumbrance.ts` | Generalizing these formulas into a universal D&D model would leak 3.5 behavior. | Retain behind the `dnd35e` adapter and share only neutral orchestration. |

## Ruleset identity and campaign ownership

`[REPOSITORY FACT]` `RulesetId` in `shared/rulesets.ts:14-20` is a six-value product/catalog union: `dnd5e`, `dnd35e`, `ravenloft`, `eberron`, `vampire-dark-fantasy`, and `post-apocalyptic`. Only `dnd5e` and `dnd35e` are currently marked mechanically available, and `createCampaignFormSchema` permits those two. Ravenloft and Eberron are coming-soon catalogue entries whose descriptors declare `baseRuleset: "dnd5e"`; neither expresses a 5e generation.

`[INFERENCE]` Future code should distinguish a mechanics-selectable ID from the broader product/catalog ID. A coming-soon setting ID may resolve presentation metadata or an explicit base-ruleset relationship, but it must never be accepted directly as a mechanics evaluator key.

`[REPOSITORY FACT]` `campaigns.ruleset` is a text column with default `dnd5e`. The insert schema accepts only `dnd5e` and `dnd35e`. `server/storage.ts:423-437` also supplies `dnd5e` while normalizing older rows.

`[REPOSITORY FACT]` Campaign-owned routing is already the correct high-level authority boundary. Character sheet and combat/leveling routes obtain the campaign and pass `campaign.ruleset` into server mechanics (`server/routes.ts:2763,3440-3454`).

`[REPOSITORY FACT]` `getRuleset(id)` in `shared/rulesets.ts:71-76` silently returns the first registry entry—currently `dnd5e`—when the ID is unknown. `classesForRuleset()` in `shared/classes.ts:18-20` similarly returns 5e classes for every value other than `dnd35e`.

`[INFERENCE]` Silent fallback is incompatible with replayable multi-generation campaigns. A misspelled, retired, or not-yet-loaded ruleset must produce an explicit unsupported-state error, not reinterpret the campaign as whatever happens to be first in an array.

`[OPEN QUESTION]` The frozen repository cannot establish which real production campaigns intended strict 2014 behavior, custom DMOS behavior, or an informal mixture. A future migration must inventory production rows and record the migration basis without reading or changing live data during this research task.

## Character model and character creation

`[REPOSITORY FACT]` Character rows in `shared/schema.ts:307-350` store free-text race and class fields, six ability scores, raw armor class, damage dice, proficiency strings, and an untyped `characterData` JSON object. They have no ruleset ID, SRD generation, canonical class/species/background reference, source revision, or conversion provenance.

`[REPOSITORY FACT]` The same rows require a legacy `visitorId` and allow nullable `userId` (`shared/schema.ts:307-313`). Character authorization checks in `server/routes.ts` are not uniform: some compare only `visitorId`, while others also accept `character.userId === req.user?.id` (for example `server/routes.ts:2647-2688`). `[INFERENCE]` Conversion cannot treat “Character Owner” as already normalized; account linking, anonymous ownership, orphaning, merge, and transfer need an explicit authority model first.

`[REPOSITORY FACT]` Server character creation limits the class list through the campaign ruleset (`server/routes.ts:2435-2457`). `shared/classes.ts` contains a conventional 5e name roster and default hit-die/proficiency data but does not distinguish 2014 from revised progression. Only the 3.5 path has a structured race registry (`shared/races.ts`). The 5e path remains free text.

`[REPOSITORY FACT]` The campaign UI mirrors that asymmetry in `client/src/pages/campaign.tsx:727-742,884-931`: it presents registered 3.5 races but does not resolve a generation-specific canonical 5e ancestry/origin model.

`[REPOSITORY FACT]` `SpellSheet` stores spell and resource structures inside `characterData`. For non-3.5 characters it calculates a flat proficiency-based spell save DC and attack bonus in the client (`client/src/components/SpellSheet.tsx:761-771`). It has no canonical spell reference or server-side casting resolver. Rest buttons mutate character spell/resource state through generic UI operations without an edition-specific recovery manifest.

`[INFERENCE]` Existing character JSON must be preserved as historical player state. A future canonical layer can add explicit references and derived projections, but should not destructively replace free-text values until a user-reviewed mapping exists.

`[INFERENCE]` A campaign ruleset alone is necessary but insufficient provenance. Characters, imported item instances, active effects, queued actions, and historical roll/event records need either their own immutable ruleset reference or a guaranteed immutable link to the campaign ruleset snapshot under which they were created.

## Deterministic mechanics inventory

| Path / symbol | Current behavior | Classification | Future boundary |
|---|---|---|---|
| `server/character-stats.ts` — `computeCharacterStats`, save/stat projections | The `dnd35e` branch applies BAB, three-save, size, and 3.5 skill behavior. Every other ruleset receives a proficiency-based, six-save projection. | 3.5-specific branch plus unclear legacy-5e fallback | Register an explicit evaluator for every ruleset. Unknown IDs must fail closed. Validate 2014 and 2024 formulas separately even where results match. |
| `server/character-stats.ts:191-198` — `CINEMATIC_ROLL_BONUS` | A cinematic roll path adds `20`. | homebrew/custom | Preserve only as named campaign/platform policy; never attribute to an SRD. |
| `server/dice-engine.ts:13-20` — proficiency table | Uses one familiar level-to-proficiency table for all 5e-shaped behavior. | unclear legacy 5e | Version the source even if both 5e generations prove identical; share the table only through an explicit equivalence test. |
| `server/dice-engine.ts` — `resolveD20` | Applies natural-20 automatic success and natural-1 automatic failure generically across check, attack, save, and initiative kinds. | mixed/custom and mechanically unsafe | Automatic outcomes must be selected by roll kind and exact ruleset; ordinary modifier arithmetic can remain shared. |
| `server/dice-engine.ts` — advantage/disadvantage | Resolves a roll mode and records rolls/results server-side. | edition-neutral mechanism | Share the roller, but let generation-specific rules decide when a mode applies and when a post-roll reroll is permitted. |
| `server/combat-engine.ts:416-420` plus `server/dice-engine.ts:95-100` | The same aggregate attack bonus used to hit is passed as the damage modifier. | implementation defect; cross-ruleset | Future attack profiles must separate ability, proficiency/BAB, enhancement, situational attack modifiers, and damage modifiers. Documented here; not fixed in this branch. |
| `server/leveling.ts:15-19,68-112` | One 5e XP table, hit-die lookup, and ASI level list (`4,8,12,16,19`) applies to all non-3.5 rulesets. Fixed XP awards are DMOS policy. | unclear legacy 5e plus homebrew awards | Put progression and feature grants in versioned class/ruleset definitions; keep award policy independent. |
| `shared/schema.ts` — `active_effects` / stat modifiers | Models concentration and modifier records; modifier kinds include advantage/disadvantage. | neutral storage intent, incomplete automation | Ruleset-specific condition/effect evaluators must consume these records. Current character-stat calculation does not enforce all declared modifier kinds. |
| `server/mechanics-tags.ts` and `server/mechanics-resolver.ts` | AI-proposed checks/attacks are schema-validated, DCs are clamped, server rolls, state changes and results are logged. | edition-neutral authority pattern | Retain exactly this authority split; enrich intents with canonical/ruleset context without accepting AI-supplied authoritative totals. |
| `shared/schema.ts:449-472` — roll log fields | Persists roll type, inputs, outputs, and context. | edition-neutral audit infrastructure | Add immutable evaluator/ruleset revision provenance before multi-generation mechanics rely on historical replay. |

`[REPOSITORY FACT]` The mechanics resolver treats AI output as a proposal rather than authority. Check tags are parsed and bounded, server state supplies character statistics, the server rolls, and outcomes are persisted. That is the strongest existing seam for adding generation-specific adjudicators.

`[REPOSITORY FACT]` The NPC proposal contract in `server/mechanics-tags.ts:74-115` accepts bounded name/HP/AC/attack/damage fields. It does not accept or resolve a canonical monster ID or source revision.

`[INFERENCE]` A canonical monster corpus will not automatically make encounters rules-enforced. The resolver still needs explicit canonical-reference intents, source authorization, stat-block projections, action evaluators, and audit metadata.

## Severe existing behaviors discovered (documented, not fixed)

### 1. The client rules adapter falls back to 3.5e for 5e campaigns

`[REPOSITORY FACT]` `client/src/lib/rulesAdapters/index.ts:5-16` registers only the 3.5e adapter and returns it as the fallback. Both observed live callers omit a campaign ruleset: `client/src/components/game/CampaignGameShell.tsx:216` and `client/src/pages/CharacterSheetPage.tsx:122-125`. A nearby comment says campaigns lack a ruleset column, which conflicts with `shared/schema.ts:164`.

`[INFERENCE]` A 5e HUD/sheet projection can read `characterData.dnd35Sheet` and apply 3.5 display assumptions. This is a high-severity ruleset-leakage defect and a warning against any future “default adapter” behavior. It remains unchanged because this branch is documentation-only.

### 2. Combat damage reuses the aggregate attack bonus

`[REPOSITORY FACT]` `server/combat-engine.ts:416-420` supplies the attack `bonus` to both the to-hit resolver and `resolveDamage`. `server/dice-engine.ts:95-100` adds the supplied modifier to the damage roll.

`[INFERENCE]` Aggregate proficiency/BAB and situational to-hit modifiers can therefore become damage. This is not a faithful universal rule for either 5e generation or 3.5e. It must be addressed as a separately reviewed gameplay defect, not smuggled into the future corpus implementation.

### 3. Revised compendium sources can be skipped after a prior 2014 import

`[REPOSITORY FACT]` Compendium startup in `server/compendium.ts:905-926` decides whether to synchronize all configured sources from an aggregate canonical-item count threshold (`< 50`) unless a force flag is set. It does not require a successful sync record for each configured source.

`[INFERENCE]` A database with enough older 2014 rows can skip later-added 2024 sources indefinitely. Source completeness must be measured per immutable source/version/manifest, never inferred from a global row count.

### 4. Campaign source selection does not govern the legacy compendium

`[REPOSITORY FACT]` Canonical campaign source selection is resolved through `shared/rules-registry/source-enablement.ts` and `server/storage.ts:1694-1715`. Legacy compendium records are not joined to those source IDs. Public compendium routes filter publication state and exclude campaign-homebrew records but do not require campaign membership or enabled-source authorization (`server/compendium-routes.ts:86-225`). Ruleset and edition filters are optional request filters (`server/compendium-routes.ts:157-164`).

`[INFERENCE]` A campaign can claim `core_only` or a custom source set while users still browse records outside that set. Future 5e integration must join catalogue visibility and mechanical resolution to the same server-owned source policy.

## Compendium and provenance audit

`[REPOSITORY FACT]` `server/compendium.ts` configures five external data groups:

- 2014 equipment;
- 2014 magic items;
- 2024 equipment;
- 2024 magic items;
- 2024 poisons.

Every group is assigned `ruleset: "dnd5e"`. Each is labelled with an `edition`, source name, provider, URL, and license in a legacy inline model (`server/compendium.ts:15-52,68-113,151-223`). The transport URLs point through jsDelivr at `5e-bits/5e-database@main`, a mutable branch reference rather than an immutable commit.

`[REPOSITORY FACT]` The importer constructs generation-bearing durable keys (`dnd5e-${edition}:${recordId}`) at `server/compendium.ts:459-462`. Those keys prevent a same-slug 2014 and 2024 item from colliding today.

`[REPOSITORY FACT]` DMOS-generated items are stored as `ruleset: "dnd5e"`, `edition: "compatible"`, with a homebrew source kind (`server/compendium.ts:641-680`). Open-source imports and custom content therefore share the same table and broad ruleset while relying on inline provenance fields for distinction.

`[REPOSITORY FACT]` The legacy records have no `rule_sources.id`, canonical entity ID, source snapshot ID, campaign source-enablement join, or `canonical_revisions` record. The newer registry's provenance and verification model does not govern them.

`[INFERENCE]` Existing item keys are the best preservation seam and should not be renamed. Future migration should create aliases/crosswalks from those keys to immutable generation-specific canonical definitions. Existing campaign inventory references remain unchanged while resolution gains an additive canonical link.

`[INFERENCE]` The existing transport's `@main` locator is unsuitable as a reproducible provenance revision. Future ingestion must record the upstream commit SHA, fetched content hash, acquisition time, parser version, original official SRD, and the fact that the GitHub dataset is a derived transport—not Wizards itself.

`[OPEN QUESTION]` Production may contain imported rows, custom edits, generated items, or old references not represented by the empty checked-in database. A read-only production inventory and backup strategy will be required in a separately authorized implementation phase.

## AI / DM prompt and intent audit

`[REPOSITORY FACT]` `server/dm-engine.ts:122-159` supplies campaign settings, homebrew text, currencies, party identity, world state/memory, and authoritative inventory context. Its only ruleset-specific field is the raw campaign string (`Ruleset: ${campaign.ruleset}`). It does not supply a 2014/revised generation, selected source IDs, source revisions, canonical spell/item/monster definitions, or an engine capability map.

`[REPOSITORY FACT]` The same prompt describes generic ability checks with DCs bounded from 5 to 25 and supplies structured tags for checks, combat start, and attacks (`server/dm-engine.ts:189-219`). It does not contain a complete, generation-specific account of advantage, exhaustion, rests, spell preparation, origin construction, conditions, or revised action terminology.

`[REPOSITORY FACT]` `server/mechanics-tags.ts` validates the tag vocabulary and bounds; `server/mechanics-resolver.ts` retrieves server state and adjudicates supported tags. Unsupported rules are therefore generally left to prose or absent rather than backed by a comprehensive 5e rules engine.

| Prompt/mechanics concern | Current classification | Future handling |
|---|---|---|
| Raw `dnd5e` in system context | mixed/ambiguous | Supply an exact registered ruleset ID, immutable rules snapshot, enabled sources, and supported deterministic capabilities. |
| Suggested DC range and check tag | custom platform policy over neutral infrastructure | Keep validation server-side. If rulesets share a DC policy, prove and register that equivalence rather than asking the model to remember it. |
| Advantage/disadvantage narration | unclear / not a complete prompt contract | AI may propose circumstances; the selected evaluator must determine legal mechanical application and log it. |
| NPC stats supplied in an AI tag | custom and non-canonical | Permit homebrew proposals only under explicit policy; prefer canonical monster references when one is selected. Server continues to validate all numeric bounds. |
| Rest, spell, condition, origin, and progression behavior | mostly absent from deterministic prompt contract | Implement as versioned data/evaluators. Prompts should describe available actions and narrative consequences, never serve as the source of truth. |
| Rules precedence/source selection | absent from model context | Resolve on the server before prompting. AI must not choose which edition or source wins. |

`[INFERENCE]` The prompt is not the main source of detailed 5e leakage; the more serious issue is insufficient context combined with incomplete deterministic coverage. The correct remedy is not a longer encyclopedic prompt. It is explicit ruleset dispatch, canonical context retrieval, constrained intents, and server-owned adjudication.

## Client rules adapters and presentation

`[REPOSITORY FACT]` `client/src/lib/rulesAdapters/types.ts` defines a useful neutral projection interface: display-focused character HUD/sheet data can be nullable, while persistence remains server-authoritative.

`[REPOSITORY FACT]` Only a 3.5 adapter is registered. The resolver's fallback and callers described above mean the interface currently violates its own intended ruleset boundary.

`[REPOSITORY FACT]` `client/src/lib/computedStats.ts` describes a “full D&D 5e cascade,” including proficiency and advantage/disadvantage-related structures. Active UI code imports types/constants from it, but the audit found no active component invoking its full stat computation as the authoritative character calculation.

`[INFERENCE]` Keep projection adapters, but require an exact ruleset ID and return an explicit unsupported state when an adapter is absent. The client may display server-computed facts; it must not become a second rules engine with divergent 2014/2024 formulas.

## Multiplayer publication and replay boundary

`[REPOSITORY FACT]` `server/routes.ts:120-140` keeps connected clients in an in-memory `Map<number, Set<WebSocket>>` and sends broadcasts directly. The frozen schema/audit found no durable transactional outbox that commits state and publication intent together.

`[INFERENCE]` Multi-generation conversion and state-changing rules work cannot assume an “established outbox.” A durable versioned event/outbox prerequisite must prove commit-before-broadcast, retry after send failure, duplicate delivery, reconnect/catch-up, ordering, and idempotent client projection. Existing direct broadcasts remain a compatibility surface to revalidate, not evidence of atomic multiplayer delivery.

## Existing canonical-rules architecture

### Generic pieces already present

`[REPOSITORY FACT]` `shared/rules-registry/sources.ts` models a rule source with ruleset, native edition, setting applicability, publication metadata, provenance/license, supersession, and verification fields.

`[REPOSITORY FACT]` `shared/rules-registry/provenance.ts` separates ingestion state (`discovered`, `extracted`, `structured`, `verified`) from automation state (`reference_only`, `partially_executable`, `executable`). This prevents “we stored text” from becoming “the server enforces it.”

`[REPOSITORY FACT]` `shared/rules-registry/canonical-id.ts` namespaces canonical entities as `<ruleset>:<entity-type>:<slug>`. `shared/rules-registry/revisions.ts` defines append-only canonical revision metadata.

`[REPOSITORY FACT]` `shared/rules-registry/source-enablement.ts` resolves campaign source presets and custom source choices server-side.

### Gaps to generalize

`[REPOSITORY FACT]` The canonical ruleset segment accepts `dnd5e` or `dnd35e`; it cannot represent two 5e definitions with the same entity type and slug if both remain under bare `dnd5e`.

`[REPOSITORY FACT]` The `all_official` source-enablement branch selects applicable same-ruleset records without independently testing the stored provenance/license role. The current type lacks an explicit `authoritative_source` versus `derived_transport` campaign-selectability boundary.

`[INFERENCE]` Add an explicit source role and fail-closed `campaignSelectable` policy. Selection must require the exact mechanical ruleset, permitted role, verified authenticity and integrity, semantic reconciliation, an affirmative segment-scoped `verified_open` rights decision, and immutable license/obligation evidence. A derived JSON transport can be valid ingestion input without becoming a user-selectable rules source. “Official” proves publisher provenance, not openness; public-but-closed Basic Rules material is the obvious counterexample.

### Phase 2A status

`[REPOSITORY FACT]` `docs/superpowers/plans/2026-08-22-dnd35-srd-ingestion-foundation-phase2a.md` proposes—but this branch does not implement—`derivedFromSourceId`, source-page manifest entries, independent page-processing states, page revision history, closure crawling, deterministic corpus classification, immutable evidence snapshots, and verification gates. Proposed implementation files such as `shared/rules-registry/srd-manifest.ts`, `server/srd-manifest-discovery.ts`, and `server/srd-d20srd-corpus-classification.ts` are absent.

`[REPOSITORY FACT]` That plan deliberately hard-codes new ingestion records to `dnd35e` and excludes 5e gameplay/canonical extraction. It distinguishes source pages from canonical entities and page revisions from canonical revisions.

`[INFERENCE]` The concepts are promising integration targets, not stable code APIs. Every future 5e task that touches manifests, snapshots, page status, provenance linkage, or revision storage must carry this gate:

> **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION**

## File-by-file important findings

| File / area | Function, type, or data | Current behavior and classification | Risk and future disposition |
|---|---|---|---|
| `shared/rulesets.ts` | `RulesetId`, `RULESETS`, `getRuleset` | `[REPOSITORY FACT]` Six catalogue IDs but only one mechanically active 5e identity; unknown values fall back to it. | `[INFERENCE]` Split catalogue from mechanical identity, add explicit generation IDs, keep legacy identity non-selectable, and fail closed. |
| `shared/schema.ts` | `campaigns.ruleset`, campaign insert enum | `[REPOSITORY FACT]` Defaults/validates bare `dnd5e`. | `[INFERENCE]` Additive migration with audit provenance; never bulk reinterpret silently. |
| `shared/schema.ts` | `characters` | `[REPOSITORY FACT]` No ruleset or canonical references; substantial free text/JSON. | `[INFERENCE]` Add provenance without rewriting player-owned fields. |
| `shared/schema.ts` | roll/encounter/effect tables | `[REPOSITORY FACT]` Useful server-state/audit structures; no immutable ruleset evaluator revision on historical events. | `[INFERENCE]` Add rules snapshot/evaluator identity for replay. |
| `shared/classes.ts` | class roster, hit dice, proficiencies | `[REPOSITORY FACT]` 5e is the default for every non-3.5 ID. | `[INFERENCE]` Version class definitions/progression and reject unsupported rulesets. |
| `shared/races.ts` | 3.5 race registry | `[REPOSITORY FACT]` Deliberately 3.5-only. | `[INFERENCE]` Do not force revised species/origin semantics into this shape. |
| `shared/rules-registry/*` | sources, provenance, IDs, revisions, enablement | `[REPOSITORY FACT]` Good generic foundation; canonical identity has one 5e bucket. | `[INFERENCE]` Reuse concepts with explicit source roles and generation IDs after Phase 2A revalidation. |
| `server/storage.ts` | legacy campaign normalization; enabled sources | `[REPOSITORY FACT]` Normalizes missing ruleset to `dnd5e`; resolves canonical source selection separately. | `[INFERENCE]` Make legacy status explicit and connect all canonical/compendium reads to one resolver. |
| `server/character-stats.ts` | stat/save/check computation | `[REPOSITORY FACT]` Explicit 3.5 branch, otherwise global 5e-shaped calculation; cinematic +20 custom path. | `[INFERENCE]` Split orchestration from exact ruleset evaluators and label platform policies. |
| `server/dice-engine.ts` | d20/damage resolution | `[REPOSITORY FACT]` Audited server rolls; automatic 1/20 outcome is over-generalized. | `[INFERENCE]` Share dice generation, branch success semantics by roll kind/ruleset. |
| `server/combat-engine.ts` | attack/damage pipeline | `[REPOSITORY FACT]` Server-authoritative encounter transitions; attack bonus also becomes damage modifier. | `[INFERENCE]` Preserve authority/logging, repair with typed attack profiles in separate authorized work. |
| `server/leveling.ts` | XP, level, hit dice, ASI, awards | `[REPOSITORY FACT]` 5e-shaped fallback plus custom fixed awards. | `[INFERENCE]` Version progression content and separate award policy. |
| `server/mechanics-tags.ts` | AI intent schemas | `[REPOSITORY FACT]` Bounded proposals for checks/combat/NPC stats. | `[INFERENCE]` Extend with ruleset-qualified canonical refs; never accept authoritative totals. |
| `server/mechanics-resolver.ts` | resolution | `[REPOSITORY FACT]` Server retrieves state, adjudicates, logs. | `[INFERENCE]` This is the primary dispatch seam for edition-specific evaluators. |
| `server/dm-engine.ts` | system prompt/tag guidance | `[REPOSITORY FACT]` Sends rich campaign/state context, but only raw `dnd5e` as ruleset-specific context and no generation/source/revision capability contract. | `[INFERENCE]` Feed pre-resolved context and capability declarations; keep precedence out of the model. |
| `server/compendium.ts` | source config/importer | `[REPOSITORY FACT]` Imports both eras from mutable derived transport; inline provenance; mixed ruleset. | `[INFERENCE]` Snapshot immutably, connect to canonical sources, preserve legacy keys. |
| `server/compendium-routes.ts` | public catalogue | `[REPOSITORY FACT]` Optional ruleset/edition filters; not campaign-source-authoritative. | `[INFERENCE]` Require server-resolved campaign/source scope for campaign use. |
| `client/src/lib/rulesAdapters/*` | rules adapter registry | `[REPOSITORY FACT]` Only 3.5 exists and is the fallback. | `[INFERENCE]` Exact lookup, no fallback; add generation-specific display adapters later. |
| `client/src/components/SpellSheet.tsx` | spell state, rests, derived spell math | `[REPOSITORY FACT]` Free-form JSON and client 5e-shaped math with no canonical spell/evaluator. | `[INFERENCE]` Preserve legacy data; move authoritative casting/recovery to server ruleset handlers. |
| `client/src/pages/compendium.tsx` | item catalogue | `[REPOSITORY FACT]` Acknowledges multiple eras but does not bind results to a campaign's selected ruleset/sources. | `[INFERENCE]` Display provenance prominently and resolve selectable content server-side. |
| Phase 0/1 specs and code | canonical foundations | `[REPOSITORY FACT]` Landed generic concepts with 3.5 as first consumer. | `[INFERENCE]` Extend, do not fork a parallel provenance system. |
| Phase 2A plan | manifest/snapshot ingestion | `[REPOSITORY FACT]` Planned only and explicitly 3.5-scoped on this branch. | `[INFERENCE]` Revalidate all named paths/interfaces after Claude's work merges. |

## Reuse and integration map for the emerging 3.5 architecture

### A. Genuinely generic and reusable

`[INFERENCE]`

- Campaign-owned ruleset selection as the root authority boundary.
- AI intent tags, server validation, server dice, state-transition/idempotency seams, and persisted roll audit records.
- `rule_sources`, explicit provenance/license fields, supersession, source verification, and campaign source enablement.
- Canonical IDs namespaced by exact ruleset, immutable canonical revision records, and separate ingestion versus automation status.
- The rule-adapter interface shape for nullable presentation projections backed by server saves.
- The principle that a source manifest proves corpus coverage while deterministic evaluators prove automation coverage.

### B. Currently constrained and should be generalized

`[INFERENCE]`

- Ruleset identity must express 2014, revised 2024, and legacy 5e separately.
- All “non-3.5 means 5e” fallbacks must become explicit registry lookups with unsupported-state errors.
- Canonical entities and character/item references need exact ruleset/source/revision provenance.
- The legacy item compendium must join the canonical source resolver rather than remain a second source-control plane.
- Source records need authoritative-original versus derived-transport roles, separate authenticity/integrity/semantic checks, affirmative segment-scoped `verified_open` rights plus immutable license/obligation evidence, and an explicit campaign-selectability policy.
- AI context must include the selected generation, enabled source snapshot, and deterministic capability set.
- Rule primitives such as condition and action identifiers must be scoped or profiled by ruleset where their semantics differ.

### C. Deliberately 3.5-specific and should remain so

`[INFERENCE]`

- BAB, iterative attacks, three-save progressions, good/poor save tables, 3.5 skill ranks, size/race modifiers, 3.5 spell DC math, and 3.5 carrying capacity.
- The Phase 2A d20srd/olimot discovery seeds, corpus classification, and hard-coded `dnd35e` manifest restrictions.
- Any 3.5-specific canonical entity contract whose fields are not proven necessary by the actual 5e SRD structure.

### D. Unsafe to integrate until Phase 2A lands

`[INFERENCE]`

- Concrete `srd_manifest_entries`, page-processing, page-revision, discovery, hashing, classification, and verification APIs proposed only in the Phase 2A plan.
- Storage and migration paths for `derivedFromSourceId`, immutable source snapshots, or closure-crawl evidence that may change during Claude's implementation.
- Shared source status names or transition semantics until the landed tests define their contracts.

Every item in D carries: **REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION**.

## Legacy compatibility requirements derived from the audit

1. `[INFERENCE]` Keep `dnd5e` as a legacy compatibility identity for existing rows until a separately approved migration proves what should happen. Do not expose it for new campaign creation once explicit generations exist.
2. `[INFERENCE]` Add `dnd5e2014` and `dnd5e2024` rather than overloading an `edition` filter beneath one mechanical ruleset. Their shape matches current lower-case alphanumeric ID conventions and naturally keeps canonical IDs distinct.
3. `[INFERENCE]` Preserve `dnd5e-2014:<record>` and `dnd5e-2024:<record>` item keys. Add mapping records; do not rewrite inventory references in place.
4. `[INFERENCE]` Record legacy classification as `unresolved`, `owner_selected`, or an explicitly named migration assumption with timestamp/actor/evidence. Never disguise an inference as original provenance.
5. `[INFERENCE]` Snapshot the effective evaluator/source revision used for state-changing mechanics so historical rolls remain interpretable after canonical corrections.
6. `[INFERENCE]` Require explicit owner-controlled conversion with preview, player/character-owner review where their state is affected, an immutable pre-conversion snapshot, and rollback. Campaign Owner and Character Owner remain separate authorization domains.
7. `[INFERENCE]` Reject conversion during active combat, incomplete rests, or other transient ruleset-specific state unless a later conversion contract explicitly handles every state.
8. `[INFERENCE]` Never let adding 2024 sources change a 2014 campaign's source resolver, prompt context, display adapter, or mechanic dispatch.

## Automation maturity on the frozen branch

| Capability | Current maturity | Evidence-based interpretation |
|---|---|---|
| Item corpus presence | structured but legacy/partially sourced | Both generations have imported item-shaped records, but source snapshots and canonical revisions are absent. |
| Character core stats | deterministic for a broad legacy profile | Server computes several values, but the profile is not generation-pinned and active-effect coverage is incomplete. |
| D20 checks and initiative | deterministic with policy defects | Rolls and logs are authoritative; natural-roll semantics are too broad and ruleset equivalence is unproven. |
| Basic encounter attacks | partially automated | Server owns hit/damage/HP/turn state, but the damage modifier defect and incomplete attack profiles prevent rules fidelity claims. |
| Conditions/effects | structured scaffolding | Schema exists; no complete 2014 or revised condition evaluator was found. |
| Spell corpus and spellcasting | source only / AI- or player-assisted | Character JSON and client calculations exist; no canonical spell corpus or authoritative casting transaction exists. |
| Rests/recovery | partially automated client workflow | Resource mutation exists, but no versioned server recovery manifest establishes either generation's rules. |
| Class/species/background/feat progression | reference/UI scaffolding | A class name list and leveling helpers exist; canonical progression/origin definitions and validators do not. |
| Monster corpus/actions | AI-assisted/custom | AI may propose bounded NPC stats; no canonical monster records or complete action evaluator exists. |
| Campaign source selection | deterministic for the new registry only | Server ownership is sound, but compendium visibility/resolution bypasses it. |

`[INFERENCE]` “The record exists” and “the engine enforces the record” must remain independent, testable claims. Current compendium presence is not evidence of complete 5e rules support.

## Recommended implementation order from repository evidence

`[INFERENCE]` Implement the explicit 2014/SRD 5.1-compatible ruleset before the revised sibling. The existing class vocabulary, proficiency/six-save model, and historical `dnd5e` campaign expectation are closer to a traditional 2014 compatibility target than to a complete revised system, while the revised compendium records are a recent mixed addition rather than proof of a revised engine.

`[INFERENCE]` That priority does **not** justify relabelling all current state “canonical 2014.” First preserve the existing `dnd5e` behavior as legacy, build a verified 2014 corpus and evaluator beside it, then offer explicit review/migration. The revised ruleset should reuse neutral infrastructure but receive independent definitions and paired mechanic tests.

## Open questions requiring later evidence or product authority

- `[OPEN QUESTION]` Which production `dnd5e` campaigns and inventory records predate the 2024 compendium addition, and what source/version evidence exists per row?
- `[OPEN QUESTION]` Should a campaign be permanently locked to its initial ruleset, or may an owner begin an explicit versioned conversion workflow after all affected character owners review it?
- `[OPEN QUESTION]` Is mixed legacy/revised content ever a supported campaign policy? If so, which rule evaluator wins for same-name content? No default hybrid policy should be inferred.
- `[OPEN QUESTION]` Which checked-in Phase 2A manifest, snapshot, and verification interfaces will actually exist after Claude's parallel work lands?
- `[OPEN QUESTION]` Will landed Phase 2A provide an immutable byte store with the required hash, retention, reference, and backup semantics? If not, the companion design/plan specifies a content-addressed SQLite BLOB fallback; production backup/restore still needs separate verification.
- `[OPEN QUESTION]` Which custom DMOS behaviors—cinematic bonuses, NPC bounds, fixed XP awards, 0-HP policy—are intentional product rules versus temporary scaffolding?
- `[OPEN QUESTION]` What production-safe remediation sequence will address the 3.5 adapter fallback and attack-bonus-as-damage defects without changing ongoing campaign outcomes unexpectedly?

## Non-implementation confirmation

`[EXECUTION ATTESTATION]` This audit changed only documentation. It did not modify ruleset IDs, schemas, migrations, storage, routes, compendium data, source registration, prompts, UI, campaigns, characters, tests, deployment state, the VPS, or `production-live-base`.
