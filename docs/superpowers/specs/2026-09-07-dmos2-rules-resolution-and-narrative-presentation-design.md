# DungeonMasterOS 2.0 Rules Resolution & Narrative Presentation Architecture

**Date:** 2026-09-07  
**Status:** APPROVED ARCHITECTURE DECISION; documentation only; implementation not yet authorized  
**Basis:** `production-live-base` at `8fe5f71ce98a55c1d32f45d10c1db0a7c3cf3a46`

## Executive decision

DungeonMasterOS 2.0 will deliberately separate **mechanical truth** from **dramatic presentation**.

The authoritative Rules & Resolution layer determines legality, rolls, modifiers, resources, conditions, damage, healing, state transitions, death/dying and other mechanical outcomes. The AI Dungeon Master receives the fixed result only after authoritative resolution and spends its reasoning/context budget on narration, pacing, dialogue, sensory detail, characterization, continuity and memorable scene presentation.

> **The engine decides what happened. The Dungeon Master decides what it felt like.**

This consolidates and extends the architecture already established by:

- `2026-08-11-dice-mechanics-engine-design.md`
- `2026-08-22-dnd35-canonical-rules-library-design.md`
- `2026-08-23-dnd5e-multi-generation-ruleset-design.md`

Those documents already establish server-authoritative mechanics, canonical source isolation, deterministic precedence, exact ruleset dispatch, provenance, immutable rules releases and AI-as-intent-proposer/narrator. This spec promotes those ideas into a DMOS 2.0 core boundary and adds a dedicated narrative-presentation layer.

## 1. Goals

1. Remove arithmetic and deterministic rules adjudication from the LLM wherever executable rules coverage exists.
2. Make each ruleset/version independently authoritative and incapable of silently leaking mechanics into another ruleset.
3. Give the AI DM more effective token/reasoning budget for presentation rather than calculation.
4. Produce richer, less repetitive, more scene-aware narration without sacrificing mechanical truth.
5. Reduce and stabilize latency through bounded context, concurrent module reads and deterministic pre-resolution.
6. Make every mechanical outcome replayable, auditable, testable and attributable to an exact ruleset release.
7. Keep AI providers replaceable. Changing the narration model must not change campaign mechanics.
8. Support future rulesets through explicit adapters/modules, not cross-edition conditionals scattered throughout the codebase.
9. Preserve product/module sovereignty: modules consume contracts, never another module's persistence directly.
10. Preserve licensing/provenance boundaries. "Official" does not automatically mean redistributable.

## 2. Non-goals

- No live migration, production deployment, database migration, Caddy change or backend rewrite is authorized by this document.
- No ingestion of closed/paid rulebook content without appropriate rights.
- No microservice requirement. Target architecture is a C# modular monolith first.
- No requirement for one physical database per module on day one.
- No assumption that every verified rule is executable immediately.
- No permission for narration to create state-changing facts absent from the authoritative result.

## 3. Core authority model

Conceptual C# shape:

```text
DungeonMasterOS.Host
DungeonMasterOS.Kernel
DungeonMasterOS.Contracts

DungeonMasterOS.Modules.Rules
DungeonMasterOS.Modules.Rules.Dnd35e
DungeonMasterOS.Modules.Rules.Dnd5e2014
DungeonMasterOS.Modules.Rules.Dnd5e2024
DungeonMasterOS.Modules.Characters
DungeonMasterOS.Modules.Items
DungeonMasterOS.Modules.Spells
DungeonMasterOS.Modules.Monsters
DungeonMasterOS.Modules.NPCs
DungeonMasterOS.Modules.World
DungeonMasterOS.Modules.Encounters
DungeonMasterOS.Modules.Combat
DungeonMasterOS.Modules.Campaigns.Official
DungeonMasterOS.Modules.Campaigns.Custom
DungeonMasterOS.Modules.Memory
DungeonMasterOS.Modules.Audio
DungeonMasterOS.Modules.AI
DungeonMasterOS.Modules.NarrativePresentation
DungeonMasterOS.Modules.ContentProvenance
DungeonMasterOS.Modules.Safety
DungeonMasterOS.Modules.Search
```

Exact project boundaries are implementation-plan detail. The following invariants are architecture decisions:

> **A module may know another module's contract. It may never know another module's database.**

> **The AI may request information and propose actions. It may never directly mutate authoritative game state.**

> **Every piece of game knowledge has an owner, ruleset, source, version, visibility and provenance.**

## 4. Rules & Resolution Authority

The Rules & Resolution Authority is a deterministic game-physics layer, not a four-function calculator.

It owns or coordinates executable rules for the selected mechanical ruleset, including where supported:

- action legality and action economy;
- initiative and turn order;
- attacks, saves and checks;
- damage, healing, critical rules and damage interactions;
- advantage/disadvantage or edition-specific equivalents;
- conditions, durations and concentration;
- spell/resource costs;
- movement and positioning abstractions;
- reactions/attacks of opportunity;
- death, dying, stabilization and recovery;
- class/race/species features;
- feats, equipment interactions and monster abilities;
- environmental effects;
- encounter transitions;
- advancement where applicable;
- edition-specific systems such as 3.5e BAB, iterative attacks, grappling and other executable rule families;
- campaign homebrew only through explicit, versioned, authorized rule overlays.

DMOS must distinguish **reference coverage** from **automation coverage**. A rule may be verified and searchable while remaining `reference_only`. Stored prose never masquerades as executable logic.

## 5. Exact ruleset isolation

Every state-changing rules operation receives an exact server-owned rules context, conceptually:

```text
RulesContext
  campaignId
  mechanicalRulesetId
  rulesetReleaseId
  campaignRulesSnapshotId
  evaluatedCorpusManifestId
  evaluatorBundleVersion/hash
  campaignStateVersion
```

Examples of distinct identities:

```text
dnd35e
dnd5e2014
dnd5e2024
```

No resolver searches another edition as a fallback. "Newest" never means "correct." Campaigns remain pinned to immutable releases/snapshots until an explicit authorized transition.

Future rulesets use the same outer contract but get their own evaluator modules and canonical identity spaces.

## 6. Definition authority vs runtime state

Definition modules and runtime modules have separate responsibilities.

- Monster Authority knows the Goblin definition. Encounter/World State knows `Goblin-32` currently has 2 HP and is frightened.
- Item Authority knows what `Longsword +1` means. Character/Campaign state knows who owns item instance `Item-8831`.
- Spell Authority knows Fireball for the exact ruleset release. Character state knows whether Hennet knows/prepared it and has the resources to cast it.
- NPC Authority knows the source definition/provenance of Strahd. Campaign Runtime/World State knows this campaign's current Strahd state, goals, injuries, relationships and knowledge.

Definition catalogues never become backdoor runtime state stores.

## 7. Player-action pipeline

```text
PLAYER ACTION
    |
    v
AI intent interpreter / structured command parser
    |
    v
Context Broker
    |---- Character Authority
    |---- Item Authority
    |---- Spell Authority
    |---- Monster/NPC Authority
    |---- Encounter/World State
    |---- Campaign rules snapshot
    v
RULES & RESOLUTION AUTHORITY
    |
    | validates legality
    | resolves deterministic mechanics
    | produces rolls/results
    | produces state delta
    v
COMMAND/AUTHORITY LAYER
    |
    | auth/capability checks
    | concurrency/version checks
    | invariant validation
    | atomic mutation
    | audit/history/outbox
    v
AUTHORITATIVE RESULT PACKET
    |
    v
NARRATIVE PRESENTATION LAYER
    |
    v
AI DUNGEON MASTER
    |
    v
STREAMED PLAYER-FACING NARRATION
```

The AI may infer intent from natural language, but state mutation only occurs through validated domain commands.

## 8. Authoritative result packet

The narration model receives a compact result envelope rather than an unbounded database dump.

Illustrative payload:

```text
ActionType: MeleeAttack
Actor: Hennet
Target: Beast-17
Weapon: Dagger-04
Ruleset: dnd5e2024
Legality: Legal
AttackOutcome: Hit
Critical: false
DamageType: Piercing
DamageApplied: 8
TargetHpBefore: 6
TargetHpAfter: 0
TargetState: Dead
ConditionsAdded: []
ConditionsRemoved: []
ResourcesConsumed: [Action]
TriggeredReactions: []
OutcomeSeverity: Decisive
NarrativeFreedom: High
```

Numbers can be hidden from player prose depending on campaign presentation settings while remaining available to the UI/audit layer.

### Narrative freedom

- **Low:** presentation stays very close to explicit facts. Used when survival/state is narrow, location/anatomy is uncertain, or mechanical ambiguity is high.
- **Medium:** enrich movement, emotion, sensory detail and pacing without inventing consequential facts.
- **High:** decisive terminal outcomes permit broad cinematic treatment, provided continuity, anatomy, tone and campaign facts remain respected.

Narrative freedom never grants mechanical authority.

## 9. Mechanical truth firewall

Narration is subordinate to authoritative output.

- `Miss` cannot become a wound.
- `0 damage` cannot become factual burns, broken bones or HP loss.
- `TargetHpAfter = 1` cannot become death, incapacitation or dismemberment.
- `Dead` may be narrated as a death consistent with attack, anatomy, tone and content settings.

If generated prose contradicts a hard fact, DMOS rejects/regenerates/corrects the prose. It never mutates state to make the hallucination true.

## 10. Narrative Presentation Authority

The AI gains expressive freedom precisely because it loses mechanical authority.

The Narrative Presentation module owns compact, relevant presentation context such as:

- campaign narration profile;
- genre and tone;
- violence/detail level;
- humour/seriousness;
- pacing preference;
- viewpoint/person;
- dialogue density/style;
- sensory emphasis;
- scene vocabulary palettes;
- environmental/combat/emotional/architectural/cultural vocabulary;
- character voice profiles;
- banned/cliche phrase lists;
- recent-phrase/repetition memory;
- scene rhythm and paragraph-length preferences;
- public/private knowledge constraints;
- safety/content constraints.

## 11. Character voice continuity

NPC dialogue is **character-owned**, not merely scene-owned.

A dwarf innkeeper, high-elven bard, frightened peasant, veteran mercenary and ancient lich must not collapse into one generic fantasy register.

Each established speaker can have a compact `CharacterVoiceProfile` derived from canonical character/NPC state and approved campaign history. It may include:

```text
culture / region
ancestry/species where narratively relevant
age and generation
education and literacy
profession / social role
social class or court exposure
formality level
vocabulary range
sentence length/rhythm
accent/dialect guidance where appropriate
idioms and cultural references
temperament
humour style
confidence
speech habits
taboos / words avoided
forms of address
relationship to current listener
current emotional state
known languages
established quotations / speech fingerprints
```

The profile must avoid caricature. Culture, ancestry and profession inform voice but do not deterministically dictate intelligence, morality or personality.

### Voice precedence

Dialogue generation should resolve guidance in this order:

```text
Established speaker canon/history
  -> current emotional/physical state
  -> relationship to listener
  -> culture/region/social context
  -> profession/education
  -> scene tone
  -> general vocabulary palette
```

Scene style can colour a voice but cannot replace it.

### Continuity rule

Once a character has an established speech pattern, later narration should preserve it unless an in-fiction change explains the difference. A frightened dwarf may become terse; he does not suddenly become a lyrical elven court poet because the current scene is dramatic.

## 12. Large vocabulary without large prompts

DMOS should not attach an enormous thesaurus/style corpus to every AI call. That wastes tokens, adds latency and dilutes relevance.

Instead, Narrative Presentation maintains a large reusable vocabulary/style library and performs **small contextual retrieval**.

Example:

```text
Scene tags:
  combat
  beast
  close-quarters
  dagger
  lethal
  stone-floor
  desperate

Retrieved presentation palette:
  12-30 relevant verbs
  8-20 sensory descriptors
  5-10 impact/motion descriptors
  3-6 pacing cues
  speaker-specific voice constraints
  recent phrase exclusions
```

The palette is guidance, not mandatory wording. The model should generate naturally rather than stitch synonyms mechanically.

## 13. Repetition control

The presentation layer maintains a short rolling fingerprint of recent narration, including:

- repeated openings;
- repeated sentence structures;
- repeated high-salience verbs/adjectives;
- repeated metaphors;
- repeated sensory motifs;
- repeated death descriptions;
- repeated NPC reaction patterns;
- repeated dialogue mannerisms outside a speaker's intentional signature.

It returns compact exclusions/preferences to the next narration request. Initial implementation can use deterministic lexical/n-gram checks and lightweight semantic fingerprints. A separate vector service is not required initially.

## 14. Presentation profiles and player choice

Narrative presentation is independent from rules enforcement.

Example:

```text
Rules Enforcement: Strict
Combat Presentation: Cinematic
Narrative Detail: Rich
Violence Detail: Moderate
Dialogue Density: High
Pacing: Deliberate
```

A campaign can therefore enforce every 3.5e mechanic strictly while presenting combat as flowing cinematic prose without visible arithmetic.

## 15. Context Broker requirements

The Context Broker is responsible for asking only the modules needed for the current action/scene and constructing the minimum safe context envelope.

Requirements:

- concurrent independent reads where safe;
- strict campaign/ruleset/visibility scoping;
- explicit provenance on retrieved rules/content;
- token/size budgets;
- no direct cross-module database access;
- no hidden fallback to unrelated editions/sources;
- no private player knowledge leaked into public narration;
- deterministic ordering for stable replay/debugging where relevant.

## 16. Latency requirements

Architecture must improve player-perceived latency rather than add ceremony.

Targets for later benchmarking/planning:

```text
Non-AI API operations:          <100 ms typical
Mechanical turn resolution:    <150 ms typical
Context assembly:              <100 ms typical
AI dispatch after action:      <250 ms target
Narration:                     stream first token as provider permits
```

These are design targets, not current production claims.

Every stage should be instrumented separately so a slow turn can attribute time to auth, context, storage, rules, provider latency, post-processing and streaming.

## 17. Failure behaviour

### Missing executable rule data

Fail closed as a **technical adjudication gap**, not an in-fiction failure. Preserve state and surface that automation coverage is incomplete.

### Ambiguous player intent

Prefer a non-mutating clarification or safe intent classification path. Never guess a state-changing target/resource when multiple materially different interpretations exist.

### Narration failure

Mechanical state remains committed only according to the authoritative command transaction. Narration may retry independently and must be idempotently associated with the resolved event.

### Provider outage

The game should retain the authoritative mechanical event and permit later narration/recovery without rerolling or replaying the mechanical command.

### Concurrent submissions

Use idempotency keys and campaign/state version checks. A retry cannot produce a second attack, duplicated resource spend or duplicated loot.

## 18. Testing requirements

Each ruleset evaluator requires deterministic unit and property-style tests for supported mechanics.

Required test classes include:

- legality and invalid-command tests;
- exact edition isolation;
- canonical precedence;
- damage/healing boundary conditions;
- resource consumption;
- conditions/durations;
- combat turn ordering;
- replay equivalence;
- idempotent command handling;
- concurrent submission protection;
- fail-closed missing-data behaviour;
- narration contradiction tests;
- character voice continuity tests;
- information-visibility tests;
- context-size/token-budget tests;
- performance regression benchmarks.

Architecture tests must prevent forbidden direct module/storage references.

## 19. Relationship to existing designs

### Dice/Mechanics Engine (2026-08-11)

Retained principle: AI requests/proposes; server rolls and resolves; AI narrates. DMOS 2.0 generalizes this beyond a limited d20/combat resolver into exact ruleset-specific authorities.

### 3.5e Canonical Rules Library (2026-08-22)

Retained principles: ruleset-first isolation, deterministic precedence, fail-closed data gaps, canonical/versioned records, reference-vs-executable status, source provenance. DMOS 2.0 treats this corpus as input to a dedicated 3.5e resolution adapter/module rather than AI memory.

### 5e Multi-Generation Ruleset Design (2026-08-23)

Retained principles: `dnd5e2014` and `dnd5e2024` are separate mechanical identities; immutable rules releases/snapshots; server authority; exact dispatch; no newest-edition fallback.

## 20. Security and trust boundary

The LLM is an untrusted reasoning/presentation component.

It cannot directly:

- write HP;
- spend spell slots/resources;
- create inventory;
- alter ownership;
- change conditions;
- end encounters;
- grant XP/levels;
- alter campaign membership;
- override permissions;
- select a different ruleset release;
- write canonical rules/content;
- bypass source/licensing policy.

All such operations require authorized domain commands validated by module authority.

## 21. Deployment shape

Preferred DMOS 2.0 target remains a C# modular monolith aligned with the proven engineering direction of Nexis 2.0.

Do not split each module into a network service merely because a module boundary exists. In-process contracts preserve isolation without paying unnecessary network latency. Extract services only when independent scaling/failure/security needs later justify them.

Likewise, do not prematurely extract a giant `Voidsmith.Common`. Common infrastructure should be extracted only after equivalent patterns are proven independently in Nexis and DMOS.

## 22. Acceptance criteria for the architecture

The design is considered faithfully implemented only when:

1. a supported mechanical action can be fully resolved without asking the LLM to calculate the outcome;
2. the exact ruleset/release/snapshot used is auditable;
3. the AI cannot mutate authoritative state directly;
4. narration cannot override mechanics;
5. ruleset leakage tests fail any cross-edition fallback;
6. character voice remains consistent across scenes and is distinct from generic scene tone;
7. vocabulary enrichment is context-retrieved and bounded rather than injected wholesale;
8. repetition controls demonstrably reduce recurring stock phrases;
9. provider replacement does not change deterministic outcomes;
10. latency and per-stage timing are measurable;
11. current production DMOS remains untouched until separately authorized migration/implementation plans are approved.

## 23. Deferred implementation decisions

The implementation plan must later determine, against the then-current codebase:

- exact C# project/package boundaries;
- physical persistence split and transaction boundaries;
- migration/strangler sequence from current Node/TypeScript DMOS;
- concrete Context Broker protocol;
- concrete result packet schema/versioning;
- narrator/provider abstraction;
- voice-profile persistence and derivation rules;
- vocabulary palette storage/retrieval implementation;
- telemetry stack and performance budgets;
- exact automation coverage gates for each ruleset;
- controlled rollout/feature flags;
- compatibility strategy for existing campaigns.

None of these deferred implementation choices weakens the authority boundaries established above.
