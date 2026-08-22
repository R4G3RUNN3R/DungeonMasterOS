# D&D 3.5e Canonical Rules Library — Architectural Spec

## Overview

DungeonMasterOS's AI Dungeon Master and deterministic game engine currently invent D&D mechanics from model memory. Nothing canonical backs any of it — confirmed by direct inspection: the live 5e Item Compendium (`server/compendium.ts`) is real and browsable but wired to nothing at runtime; spells, monsters, feats, and prestige classes have zero structured data anywhere in production.

This spec defines a canonical D&D 3.5e rules corpus that is the single authoritative source consumed by three things: the deterministic game engine, the AI's context/retrieval pipeline, and a player/DM-facing Library UI. One source of truth, multiple consumers — never a decorative catalogue that diverges from what the engine actually uses.

**This is not a five-table feature.** The canonical corpus covers the full 3.5e rules surface — classes, races, skills, conditions, combat mechanics, movement, saves, BAB/iterative attacks, grappling, spellcasting rules, XP/advancement, multiclassing, templates, domains, special abilities, equipment rules, crafting, environmental rules, setting-specific rules, and the non-spell power systems (psionics, invocations, martial maneuvers, incarnum, binding, shadow magic, truenaming, and others as they're identified). The six Library books (Item Compendium, Grimoire, Holy Tome, Bestiary, Feat Codex, Paths of Prestige) are *projections* into that corpus for specific entity types — not the corpus itself, and not the only things the corpus contains.

## Locked Architectural Decisions

These are non-negotiable per explicit user direction; any implementation-phase deviation must stop and report the conflict, not route around it.

1. **Ruleset is a hard filter, always first.** `dnd35e:spell:fireball` and `dnd5e:spell:fireball` are different entities. No query ever spans rulesets and lets the AI or a human "pick the right one" after the fact.
2. **Setting isolation is a hard filter, second.** A campaign's active setting scopes which non-generic content is visible by default. Setting-specific content does not leak across settings merely because both are D&D 3.5e.
3. **Setting content is additive by default, not an override.** Most setting books add races/feats/classes/spells/deities/systems on top of core. Where a setting genuinely changes a general rule, that's modeled through the precedence/specificity system (§6), never through an implicit "Eberron overrides Core" rule.
4. **The AI never decides rule precedence.** Precedence resolution is deterministic, server-side, before the AI sees an outcome.
5. **Missing canonical data fails closed as a technical stop, never as in-fiction failure.** A character who legitimately knows Fireball does not fail to cast it because a database row is missing. The system halts the mechanical adjudication, preserves state, and surfaces the gap — it does not let the AI narrate a spell fizzling because DMOS's data is incomplete.
6. **Ingestion status and automation status are independent dimensions**, not one linear enum. A rule can be fully verified and structured while remaining `reference_only`.
7. **The Grimoire and Holy Tome are projections of one spell corpus, never separate databases.** A spell that appears on both an arcane and a divine list is one canonical record with multiple list memberships.
8. **The existing 5e Item Compendium is untouched and stays 5e.** The 3.5e corpus is isolated from 5e SRD data, procedurally-generated items, VoidSmith homebrew, and campaign homebrew — these source pools coexist in the same architecture but are never merged into one undifferentiated pool.
9. **No claim of "complete" without an audited manifest.** Coverage is proven against a source manifest and comparison, never asserted from folder inspection.
10. **No blanket legal conclusion is baked into the architecture.** Copyright/licensing reasoning informs per-source content-policy classification; it is not a permission the ingestion pipeline assumes on your behalf.
11. **Every canonical record is versioned and auditable.** No silent edits underneath a running campaign.
12. **Rules Enforcement Mode is orthogonal to ruleset and never weakens state integrity.** Ruleset defines which rules exist; enforcement mode defines how strictly they're applied. No enforcement mode ever bypasses ownership, inventory consistency, HP/state persistence, permissions, campaign synchronization, authentication/authorization, or billing/entitlement checks — see §18.

## 1. The Canonical Rules Corpus

Two conceptual layers, both under the same source-registry/provenance/status model:

**Rule Primitives** — the mechanical systems themselves, largely already partially represented in code today (ability modifiers, saves, BAB progression, skill ranks, XP tables) but currently hardcoded per-ruleset in `character-stats.ts`/`leveling.ts` rather than data-driven. This spec does not propose ripping out that working code; it proposes that primitives which *reference* canonical entities (e.g. "grappling interacts with size category and specific monster special attacks") get canonical representation where the entity layer needs to point at them, while pure formula logic (how a save DC is computed) can remain code — the corpus's job is the *data* those formulas consume, not reimplementing arithmetic that already works. Primitives in scope: conditions, actions, movement rules, combat actions (attacks of opportunity, critical hits, concealment, cover), death/dying, healing, spellcasting rules (preparation vs. spontaneous, metamagic, arcane spell failure, components), domains, magic item creation rules, crafting, environmental rules, templates, and the distinct non-spell power systems (psionics, invocations, martial maneuvers/stances, incarnum/soulmelds, binding/vestiges, shadow magic, truenaming) — each gets its own `powerSystem` identity, never folded into "spell" by default.

**Canonical Entities** — discrete, individually-referenceable records: items, spells, feats, monsters, prestige classes, base classes, races. These are what the Library books project and what deterministic resolution looks up by key.

Both layers share the same Source Registry, provenance model, ingestion/automation status pair, and versioning scheme described below — there is one architectural shape, applied consistently, not a bespoke design per content type.

## 2. Source Registry

A first-class `sources` table, referenced by every canonical entity via `sourceId` + page/reference — never duplicated inline.

```
Source
  id                        stable canonical ID
  title                     "Player's Guide to Faerûn"
  publisher                 "Wizards of the Coast"
  ruleset                   dnd35e | dnd5e | ...
  nativeEdition             dnd3e | dnd35e | ...    (what the book was actually written for)
  setting                   generic | forgotten-realms | eberron | dragonlance | ravenloft | ...
  publicationType           core-rulebook | splatbook | setting-book | adventure |
                             magazine | web-enhancement | errata
  provenanceClassification  wotc_official | wotc_licensed | open_game_content |
                             ogl_third_party | homebrew
  licenseClassification     srd_open | ogl_licensed | all_rights_reserved | unknown
  publicationDate
  supersedes / supersededBy references to other Source rows (errata/update chains)
  verificationMetadata      { method, verifiedBy, verifiedAt }
```

A canonical entity's `sourceReferences` is an array, not a single field — one record can legitimately cite the Rules Compendium, its original sourcebook, and an errata document simultaneously. Each reference in the array carries its own page number, since the same rule can appear (and be corrected) across multiple sources.

This directly answers the "don't duplicate `sourceTitle`/`sourcePublisher`/`sourceLicense` across thousands of rows" concern — `item_definitions` today inlines those fields per-row; the new corpus normalizes them into `sources` and stores only `sourceId` (+ page) on each entity.

## 3. Spell Projection Model

One `spell_definitions` table. A spell's class/list access is a separate join table, `spell_list_memberships`:

```
spell_list_memberships
  spellDefinitionKey
  tradition            arcane | divine | psionic | ... (matches powerSystem for non-spell lists)
  list                 wizard | sorcerer | cleric | cleric-domain:war | druid | ...
  listLevel             the spell's level on THIS list (can differ across lists)
```

The Grimoire renders `spell_definitions` filtered to `tradition = arcane` (via its list memberships). The Holy Tome renders `tradition = divine`, including domain-spell memberships. A spell known to both a wizard and a cleric-via-domain is one row in `spell_definitions` with two rows in `spell_list_memberships` — never two spell records. Non-spell power systems (psionic powers, invocations, maneuvers, incarnum, etc.) get their own `tradition`/list values under the same join structure rather than a parallel schema, since they're structurally the same problem (one canonical power, multiple list/class access paths) — but they are *presented* as their own Library sections when that becomes a separate volume, never silently folded into "spell."

## 4. Ingestion Status vs. Automation Status

Two independent fields on every canonical entity, not one linear pipeline:

```
ingestionStatus:   discovered → extracted → structured → verified
automationStatus:  reference_only → partially_executable → executable
```

`ingestionStatus` describes how far the record has come from raw source material to trustworthy structured data. `automationStatus` describes whether the deterministic engine acts on it. A record can be `verified` + `reference_only` indefinitely (fully correct data the engine doesn't yet enforce) — this is the expected steady-state for most of the corpus for a long time, not a bug. A record is never `partially_executable`/`executable` while `ingestionStatus` is below `verified` — automation status can only advance on top of verified data, never ahead of it.

Verification metadata accompanies every status change: `{ method: "ai_cross_check" | "human_review" | "srd_direct_import", verifiedBy, verifiedAt, notes }`.

## 5. Ruleset → Setting → Source Enablement → Power System → Entity

```
RULESET               (dnd35e)
   ↓
CAMPAIGN SETTING       (generic | forgotten-realms | eberron | dragonlance | ravenloft | ...)
   ↓
ENABLED SOURCES        (which Source rows this campaign can see)
   ↓
POWER/RULE SYSTEM      (spell | feat | psionic power | maneuver | ...)
   ↓
CANONICAL ENTITY
```

**"All Official Sources" (the default) means:** all official sources whose `ruleset` matches the campaign's ruleset AND whose `setting` is either `generic` or matches the campaign's active setting. It does **not** mean every officially-published 3.5e source regardless of setting — an Eberron campaign on "All Official Sources" sees generic 3.5e content plus Eberron-setting content; it does not automatically see Forgotten Realms deities, regional feats, or setting-specific prestige classes. **"Core Only"** restricts to sources classified `core-rulebook`. **"Custom"** is an explicit, frozen source selection that can deliberately cross setting boundaries (e.g. a homebrew Eberron/Forgotten Realms crossover campaign) — that crossing is always an explicit owner choice, never an accidental default.

This hierarchy is evaluated on every canonical lookup, not cached/assumed — a campaign's setting or source selection can change mid-campaign (subject to the existing Campaign Settings lock mechanism already shipped), and the next lookup reflects the current state.

## 6. Precedence / Effective-Rule Model

When multiple sources speak to the same rule, resolution order is fixed and deterministic:

```
official errata
   → official revision/update document
      → later specific official rule
         → sourcebook rule
            → older/superseded rule
```

"Specific beats general" is evaluated by matching scope: a setting-specific rule that legitimately modifies a general one wins for content tagged to that setting, without requiring every setting book to be modeled as blanket-overriding core — most setting content simply adds new entities (a new feat, a new prestige class) that never conflict with anything, and needs no precedence resolution at all. Precedence machinery exists for the genuine conflict case (an errata changing a spell's wording, a later sourcebook restating a rule), and it is computed server-side into an `effectiveRecord` before either the engine or the AI ever sees a result. The AI is never handed two contradictory sources and asked to pick.

## 7. Fail-Closed Behavior (Corrected)

When a deterministic action requires canonical data that doesn't exist or isn't yet `executable`, the system returns a distinct, explicit signal — **not** a narrated in-fiction failure:

```
{ status: "canonical_data_incomplete", action: "cast_spell", spellName: "Fireball", ruleset: "dnd35e" }
```

Game state is preserved exactly as it was before the action was attempted. The AI is told the technical situation and instructed to acknowledge the limitation out of character (or defer/ask for DM discretion), never to narrate the character's Fireball fizzling, misfiring, or otherwise failing *in the fiction* because DMOS's data is incomplete. This is a hard distinction: a legitimate in-fiction failure (a failed saving throw, a miscast from insufficient resources) is narrated normally; a *data-gap* is a system limitation surfaced honestly, structurally separate from any narrative outcome.

## 8. AI Integration — Two Paths

**Path A — Deterministic Action Resolution** (extends the existing tag-resolution pattern already proven in production for checks/saves/attacks):

```
player action → structured action intent → canonical lookup →
prerequisite/state validation → deterministic resolution →
atomic state mutation → AI narration (of the already-known outcome)
```

New tags (`[SPELL_CAST]`, `[FEAT_CHECK]`, `[PRESTIGE_QUALIFY]`, etc.) follow the same shape `[CHECK]`/`[ATTACK]` already use today: the AI proposes the *intent* (what the player is attempting), the server resolves the *mechanics* deterministically against canonical data and character state, and a final AI call narrates only the fixed outcome — mirroring the existing instruction pattern ("do not restate the numbers; narrate only the consequence") already working in `combat-engine.ts`/`mechanics-resolver.ts`.

**Path B — Rules/Context Retrieval** (new, does not require tool-calling):

```
campaign + current situation → ruleset + setting + enabled sources →
relevant canonical records compiled server-side → compact AI context →
narration/reasoning
```

This becomes a new stage inside the existing `buildSystemPrompt()` pipeline in `dm-engine.ts`, not a new AI-facing mechanism. Before each turn, the server determines what's *contextually relevant* (the active characters' known spells/feats/class features, monsters currently in the scene, applicable setting rules) and compiles a compact, already-filtered summary of canonical facts into the system prompt — the AI reasons with real data available up front rather than needing to ask for it. This keeps the existing free-text-chat-completion architecture intact (no tool-calling required) while still grounding the AI's narration in canonical fact rather than memory for anything the context compiler determines is relevant. Path A and Path B are complementary: B keeps ambient narration grounded; A adjudicates the mechanical outcome when an action is actually taken.

## 18. Rules Enforcement Mode

Genuinely orthogonal to ruleset, added per explicit direction mid-spec and integrated with the Campaign Settings system already shipped this session (`campaigns.rulesWeight`, `combatStyle`, and the rest of that architecture — settings lock, audit history, suggestions). **Ruleset defines which rules exist. Rules Enforcement Mode defines how strictly DungeonMasterOS enforces them, for the same ruleset and the same canonical corpus.**

**This evolves the existing `campaigns.rulesWeight` field rather than adding a parallel one.** `rulesWeight` already means "how strictly rules apply" — it was always this concept, just with a coarser 3-value enum. Its value set expands:

```
Strict      — full canonical enforcement, no discretionary bypasses
Standard    — normal rules enforcement with limited DM discretion
Light Rules — simplify/skip low-value checks while preserving important mechanics
Narrative   — prioritize story flow; non-critical mechanics may be softened/bypassed
Freeform    — rules are advisory except for state-integrity/safety constraints
```

`combatStyle` (`cinematic | tactical | dice`) is explicitly untouched and remains conceptually separate: it governs *how combat is presented/narrated* (dice-visible vs. prose-only), while enforcement mode governs *whether a rule's outcome is authoritatively enforced at all*. A campaign can be Strict enforcement with Cinematic combat presentation — full canonical enforcement happening behind cinematic prose — these are independent axes by design, confirmed non-overlapping: one is a display/narration choice, the other is an authority choice.

**Migration for the ~19 existing production campaigns:** `crunchy → Strict`, `medium → Standard`, `light → Light Rules` — a one-time value remap on the existing `rules_weight` column, not a schema shape change, run through the same migration mechanism (`server/storage.ts`'s `runMigrations()`) already used for this codebase's other schema evolution.

**Position in the hierarchy** (orthogonal insert into §5's diagram — applies to every canonical lookup and every resolver invocation, independent of the ruleset/setting/source chain):

```
RULESET  →  CAMPAIGN SETTING  →  ENABLED SOURCES  →  POWER/RULE SYSTEM  →  CANONICAL ENTITY
                                                                                    ↑
                                              RULES ENFORCEMENT MODE (independent axis, always applied)
```

**Every deterministic resolver call receives the canonical entity/rule and the active enforcement mode**, and classifies the specific check being performed as one of:

- **`required`** — authoritatively enforced regardless of narrative convenience. Under Strict, nearly everything is `required`. Under Freeform, only state-integrity-class checks remain `required`.
- **`soft`** — the mechanical result is computed and available, but the mode permits the AI/DM to narratively de-emphasize or contextualize it (e.g. a minor skill check's exact DC under Light Rules is still real, just less foregrounded in narration).
- **`bypassable`** — the mode permits skipping the check entirely, resolved deterministically as "not evaluated," never silently assumed to succeed or invented by the AI.

**Absolute floor, never softened or bypassed by any enforcement mode:** ownership checks, inventory/item consistency, HP and character-state persistence, campaign membership/permissions, multiplayer/WebSocket synchronization, authentication/authorization, and billing/entitlement checks. These are platform state-integrity concerns, not D&D rules — Freeform mode changes how strictly *game mechanics* are enforced; it has zero authority over who can write to what or whether state stays consistent. This is the same category of "never" already established elsewhere in this codebase (the Options/Settings lock mechanism, the campaign-authority checks) — Rules Enforcement Mode inherits that boundary, it doesn't get to redraw it.

**AI context integration (Path B, §8):** the active enforcement mode is compiled into the per-turn system prompt alongside the campaign settings already injected today (tone, combatStyle, `rulesWeight` itself, powerLevel) — additive to existing prompt construction (`buildSystemPrompt()` in `dm-engine.ts`), not a new mechanism.

**The AI must never secretly override a mandatory rule.** Where a resolver marks a check `required`, the AI's narration is constrained to the resolver's already-computed outcome — exactly the existing "narrate the consequence, not the numbers" pattern already working for checks/attacks today. There is no path for the AI to soften a `required` result on its own initiative. Where a check is `soft` or `bypassable`, the AI has real narrative latitude — but that latitude is explicitly granted by the resolver's classification, never assumed unprompted.

**Interaction with fail-closed behavior (§7):** enforcement mode governs strictness of *rules*, never completeness of *data*. Freeform mode does not cause the system to fabricate a canonical record that doesn't exist — a missing spell definition still fails closed exactly as described in §7, regardless of enforcement mode. The two concerns are independent: enforcement mode decides whether an existing rule is enforced strictly; fail-closed governs what happens when a rule can't be resolved at all because the data isn't there.

**Testing requirement (carried into the implementation plan):** a test running the identical action (same character, same check, same DC) through the resolver under both Strict and Narrative/Light-Rules modes, ruleset held constant, asserting the enforcement classification differs (`required` vs. `soft`/`bypassable`) while the underlying canonical rule data does not change — proving the two axes are genuinely independent, not asserting any particular narrative outcome.

## 9. Prestige Classes as Real Progression Entities

`prestige_class_definitions` includes a structured `prerequisites` array where each entry has a `type` and is independently evaluable or explicitly not:

```
prerequisiteTypes (deterministically evaluable against existing character state):
  ability_score, base_attack_bonus, save, skill_rank, feat,
  race, alignment, spell_level_access, caster_level, manifester_level,
  class_feature, specific_spell_known

prerequisiteTypes (requires state DMOS does not yet model — reference_only until it does):
  deity, organization_membership, quest_completed, special_ritual,
  setting_specific_requirement
```

The qualification evaluator runs every deterministic-type prerequisite against the character's already-computed `FullCharacterSheet` (the existing, correct output of `character-stats.ts`) and returns `qualified | not_qualified` with the specific missing prerequisites named. Prerequisites in the second group are surfaced as **visible but unverified** — "this prestige class also requires [organization membership], which DMOS cannot currently check" — never silently treated as satisfied, and never silently hidden. A prestige class's overall `automationStatus` reflects the weakest link: if any prerequisite is `reference_only`, the class as a whole cannot be `executable` for automatic qualification, even if every other prerequisite is fully deterministic.

## 10. Feat Codex Prerequisite Graph

Feats are not independent rows. `feat_definitions.prerequisites` mirrors the same typed-prerequisite shape as prestige classes (ability score, BAB, skill rank, other feats by key, class features, spellcasting requirements). Feat-to-feat prerequisites form an explicit directed graph (`feat_prerequisite_edges: {feat, requiresFeat}`), enabling the actual queries requested:

- **Can I take this now?** — evaluate all prerequisite edges/typed-checks against current character state.
- **Why not?** — return the specific unmet prerequisites, not a bare boolean.
- **What's missing?** — same data, framed as a gap list.
- **What chain leads there?** — traverse the graph backward from a target feat to find the prerequisite path.
- **What becomes available next level?** — evaluate the same graph against the character's *projected* state after a hypothetical level-up (using the already-existing level-up computation in `leveling.ts`), without committing the level-up.

All of this queries authoritative character state (`FullCharacterSheet`), never a client-side guess.

## 11. Bestiary — Shared Primitives First

The Bestiary is explicitly **not** designed as an isolated schema. Before any monster import work begins, the shared canonical primitives it depends on must already exist and be stable: feats (creatures have feats), spells/spell-like/supernatural/extraordinary abilities (creatures cast and use abilities from the same corpus players draw from), skills, conditions, special-ability effect vocabulary, templates (a template modifies a base creature using the same primitive system, not a bespoke one), creature types/subtypes (a controlled vocabulary, not free text), weapons/attacks (reusing item/weapon primitives where a monster wields a real weapon), and monster advancement (HD-by-size scaling rules as data, not re-derived per creature). `monster_definitions` references these shared primitives by key rather than re-encoding "this creature is immune to fire" as bespoke monster-only text distinct from how a spell or item's fire-immunity effect is represented elsewhere in the corpus. This is why Bestiary work is sequenced after the shared primitive layer is proven (via items/spells/feats first), not before.

## 12. 5e Item Compendium — Preserved, Isolated

`item_definitions` (existing, live, 5e-only today) is untouched by this work. The 3.5e corpus's item entities are new rows in the *same table shape* (reusing the existing `item_definitions` schema, since it's already ruleset-namespaced via the `ruleset` column) but sourced from 3.5e content, with `ruleset = "dnd35e"` and their own `sourceId` references into the new Source Registry. The existing `sourceKind` enum (`canonical_srd | third_party_open | voidsmith_homebrew | campaign_homebrew`) gains one new value, `wotc_official_non_srd`, for splatbook-sourced 3.5e content that isn't part of the open SRD. Four source pools — 5e SRD, procedurally-generated 5e homebrew, 3.5e SRD, 3.5e splatbook content, campaign homebrew — coexist in one table, always distinguishable by `ruleset` + `sourceKind`, never queried without that filter, never silently blended in a response.

## 13. Drive Collection — Manifest, Not a Completeness Claim

No claim of completeness is made in this spec. What's confirmed by direct inspection: your Drive's "D&D 3.5e" folder contains a substantial library across Core Rules, Monsters & Creatures, Magic/Spells/Items, Character Options, Campaign & Environment, Forgotten Realms, Eberron, Dragonlance, Ravenloft, and 3.0-Compatible/Updated sources. Before any coverage claim is made, the implementation phases (§16) call for building an explicit **source manifest** — a definitive list of official 3.5e publications (books, magazines, web enhancements, errata) cross-referenced against what's both in the Drive and already ingested — and a **coverage matrix** comparing the two. "Complete" becomes a provable statement against that manifest, not an inference from folder contents.

## 14. Copyright / Provenance / Content-Policy Boundaries

The ingestion pipeline separates four distinct things per canonical record, never conflating them:

- **Canonical mechanical data** — structured facts (a spell's level/range/duration/effect parameters, a feat's numeric benefit, a monster's stat block values). This is the corpus's actual payload.
- **Derived summaries** — a short, independently-written description of what a record does, generated during extraction, not copied from source prose.
- **Source provenance** — the Source Registry reference (§2): which book, page, publisher, license classification.
- **Verbatim/open text** — only ever stored or displayed where the `licenseClassification` on the referenced Source explicitly permits it (SRD-open content). For anything not classified `srd_open`, the pipeline extracts mechanical data and writes a derived summary; it does not copy book sentences.

This spec does not assert a legal conclusion about what extraction is permissible — that determination is encoded per-source via `licenseClassification` and `provenanceClassification`, decided deliberately (by you, informed by whatever counsel you choose to consult) per source, not assumed globally by the architecture. The ingestion pipeline enforces whatever boundary is set per source; it does not set that boundary itself.

## 15. Versioning and Auditability

Every canonical entity carries:

```
canonicalId          stable, never reused even if the record is later corrected/retired
currentRevision       monotonic revision number
revisionHistory        [{ revision, changedAt, changedBy, changeReason, diffSummary }]
sourceRevision         which revision of the referenced Source this record reflects
verification           { method, verifiedBy, verifiedAt }
supersededBy / supersedes   links between an old and corrected/updated record
```

Corrections, errata application, source supersession, prerequisite fixes, and automation-status changes are all revisions with a recorded reason — never in-place silent edits. A campaign referencing a canonical record references it by `canonicalId`; if that record is later revised, the campaign's prior resolved outcomes (already-cast spells, already-qualified prestige classes) are not retroactively altered — only future lookups see the new revision. This is what "do not silently edit rules underneath campaigns" requires structurally, not just as a policy statement.

## 16. Approved Working Names

- **Item Compendium**
- **The Grimoire** — Arcane spells
- **The Holy Tome** — Divine spells
- **The Bestiary**
- **The Feat Codex**
- **Paths of Prestige** — Prestige Classes

## 17. Phased Plan

**Phase 0 — Reconcile architecture.** Inspect current production and the stale Library branch (`feature/library-of-knowledge`) in full; document exactly what's reusable as reference (data-layer shapes, the feat-eligibility evaluator pattern, the `rules-tome.tsx`-on-`CompendiumBook` presentation pattern) vs. what must be re-implemented fresh against current production (the branch is 32 commits stale, including missing the entire Options/Settings system and the character-sheet/Codex consolidation, and self-documents as never verified/deployed). Finalize concrete schemas/contracts from this spec. No merge of the stale branch.

**Phase 1 — Rules Source Registry + canonical foundations.** Build ruleset isolation, setting applicability, the Source Registry, provenance model, canonical IDs, the ingestion/automation status pair, the source-enablement model (ruleset → setting → enabled sources), the revision/audit model, and the shared rule primitives the Bestiary and other entities will depend on. No content imported yet — this phase proves the architecture with a minimal seed, not volume. **The Rules Enforcement Mode migration (§18) is independent of the canonical corpus and can land here or earlier** — it's an evolution of the already-shipped `rulesWeight` field and doesn't depend on any canonical data existing.

**Phase 2 — Complete open 3.5e SRD baseline.** Ingest and verify the legal/open SRD corpus: core rules, races, classes, skills, feats, spells, items, monsters, conditions, epic rules, psionics, divine rules, official open variants. This becomes the baseline that proves the architecture at real scale, entirely on legally clean, already-structured content (`olimot/srd-v3.5` or equivalent) before any splatbook extraction begins.

**Phase 3 — Engine + AI canonical retrieval.** Wire authoritative lookup and deterministic resolution (§8, both paths) into runtime. Make the AI use canonical information rather than model memory for anything the corpus covers. Implement fail-closed behavior (§7) for real. **Wire Rules Enforcement Mode (§18) into every resolver here** — this is where resolvers first exist to receive the mode and classify checks as `required`/`soft`/`bypassable`; include the Strict-vs-Narrative differential test from §18 as an exit criterion for this phase.

**Phase 4 — Library UI.** Build the six player/DM-facing projections, reusing `CompendiumBook` and the stale branch's presentation patterns where they hold up against current code, re-implemented rather than merged.

**Phase 5 — Character progression.** Wire feat qualification, prestige-class qualification, source restrictions, level-up choices, and prerequisite explanations into `LevelUpWizard` and character creation.

**Phase 6 — Official sourcebook ingestion.** Import your owned official books progressively — generic 3.5e first, then Forgotten Realms, Eberron, Dragonlance, Ravenloft, and additional sources — each through the full pipeline: source registration → extraction → structured candidate → independent verification → canonical publication → optional deterministic implementation. Ordered by what's already confirmed available in your Drive.

**Phase 7 — Coverage and hardening.** Produce the full Rules Coverage Matrix. Verify: no cross-edition leakage, no cross-setting leakage, source restrictions actually work, missing records fail closed correctly, the AI cannot silently invent official mechanics, deterministic systems genuinely use canonical data, and the Library UI reads from the same canonical records the engine uses — not a parallel copy.

## Self-Review

**Ruleset isolation:** every entity is ruleset-namespaced (`canonicalId` includes ruleset), every lookup filters by ruleset first (§5), the 5e Item Compendium is explicitly preserved and untouched (§12). Consistent throughout — no section proposes a cross-ruleset query.

**Setting isolation:** the hierarchy in §5 is the single authority for what a campaign can see; §6 clarifies this doesn't require setting books to override each other, only to be scoped correctly. No section contradicts this — §11 (Bestiary) and §9/§10 (prestige/feat prerequisites) all operate within whatever the enabled-sources filter already resolved, they don't introduce a second setting-scoping mechanism.

**Source precedence:** §6 is the only precedence authority; §2 (Source Registry)'s `supersedes`/`supersededBy` links are the data §6's resolution reads, not a competing mechanism. §15's revision model is orthogonal (it's about a *record* changing over time) and doesn't conflict with §6 (which is about *multiple sources* disagreeing at a point in time) — verified these are genuinely separate concerns, not two overlapping precedence systems.

**Source enablement:** §5 defines it once (ruleset+setting-scoped "All Official Sources," "Core Only," "Custom"); no other section redefines or narrows it differently. §12's new `wotc_official_non_srd` sourceKind is a classification value consumed by source enablement, not a parallel enablement mechanism.

**Canonical ownership:** every entity type (items, spells, feats, monsters, prestige classes, base classes, races, and rule primitives) shares one shape — Source Registry reference, provenance, dual status, revision history (§2–4, §15) — applied uniformly rather than redesigned per content type. §3's spell-projection model is the one deliberate structural exception (a join table instead of direct fields) and is scoped precisely to the arcane/divine-list-sharing problem it solves, not a general pattern change.

**Library vs. engine authority:** §0/Overview states the principle once — Library projects the same canonical records the engine uses. §4's automation-status field is what makes this literally true rather than aspirational: a record's Library presentation and its engine-executability are two different fields on the *same row*, so they cannot silently diverge into "the Library shows it, the engine ignores it" the way the current 5e Item Compendium does today (confirmed broken in the investigation).

**AI retrieval vs. deterministic resolution:** §8 names these as two explicitly separate paths (A: action resolution, B: context retrieval) precisely because conflating them was the original mistake in the first draft of this proposal (treating tag-extension as sufficient for all AI integration). No other section blurs them — §7's fail-closed behavior applies specifically to Path A (an attempted action), while Path B degrades gracefully by simply omitting unavailable context rather than needing a fail-closed signal at all (there's no "action" to fail in ambient context compilation).

**Ingestion status vs. execution status:** §4 defines both as independent fields; §9's prestige-class prerequisite typing and §10's feat graph both explicitly reference `automationStatus` as capable of staying at `reference_only` even when `ingestionStatus` is `verified` — consistent application, not just defined once and ignored elsewhere.

**Copyright/provenance boundaries:** §14 explicitly avoids asserting a legal conclusion, deferring the actual permission boundary to a per-source classification field (§2's `licenseClassification`) that the ingestion pipeline reads and enforces rather than reasons about independently. No other section (including §13's Drive manifest discussion) asserts a redistribution right.

**Backward compatibility with existing 5e/live characters:** §12 explicitly isolates 5e from this work. Existing 3.5e characters' free-text feat/spell entries (`characterData.sections`, `SpellSheet.tsx`'s freeform `SpellEntry` records) are not migrated or invalidated by this spec — canonical backing is additive; Phase 5 (character progression) governs *new* choices going forward, and nothing in this spec proposes rewriting already-recorded character data to match canonical records retroactively. This should be made explicit as a stated non-goal in the implementation plan, since this spec establishes the principle but the plan is where a migration could accidentally be scoped in — flagging this as the one thing worth double-checking isn't accidentally introduced at the planning stage.

No contradictions found in the ten named risk areas. The one item worth carrying forward as an explicit constraint into the implementation plan (not a spec defect, but a plan-time reminder): existing free-text character data must be explicitly declared out of scope for any migration, not just implicitly assumed safe.

**Rules Enforcement Mode (§18), added mid-spec — checked against the same risk areas:**

- **Does not weaken ruleset isolation** — enforcement mode is a pure orthogonal axis (§18's hierarchy diagram), never a filter on which ruleset's data is visible.
- **Does not create a second settings system** — it's an explicit evolution of the already-shipped `campaigns.rulesWeight` field, with a defined migration for existing values, not a new column or a parallel mechanism. `combatStyle` is explicitly confirmed non-overlapping (presentation vs. authority) rather than assumed non-overlapping.
- **Does not weaken fail-closed behavior** — §18 states explicitly that enforcement mode governs rule strictness, never data completeness; a missing canonical record fails closed identically in every mode. Checked this doesn't quietly contradict §7 — it doesn't; §7 is about data availability, §18 is about rule authority, and §18 says so directly rather than leaving the boundary implicit.
- **Does not weaken state integrity** — the "absolute floor" list in §18 (ownership, inventory consistency, HP/state persistence, permissions, sync, auth, billing) is checked against this codebase's actual existing hard boundaries (the Options/Settings lock semantics, campaign-authority checks built earlier this session) and inherits them rather than restating a weaker version.
- **AI retrieval vs. deterministic resolution** — enforcement mode is consumed by both paths from §8 (Path A: resolvers receive it and classify checks; Path B: it's compiled into AI context) without blurring which path is authoritative — Path A's classification is still what the AI's narration is constrained by, Path B is still just ambient context, unchanged by adding this dimension.

No contradictions found between §18 and the rest of the spec.
