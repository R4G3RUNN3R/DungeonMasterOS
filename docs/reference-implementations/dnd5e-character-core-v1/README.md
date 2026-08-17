# D&D 5e Character Core v1 — Fresh Reference Implementation

Status: active independent reference implementation
Branch: `reference/dnd5e-character-core-v1`
Base: GitHub `main` at `c22bb3dd081f3ddb371671efc4d9c97e4e4b120c`

## Why this exists

This is a fresh D&D 5e rules implementation for DungeonMasterOS.

It is NOT a refactor of `client/src/lib/computedStats.ts`.

That legacy file is useful audit evidence, but it mixes assumptions, parses arbitrary character text, and represents only part of one 5e rules generation. This reference starts from first-party rules sources and designs a server-authoritative rules engine from the ground up.

## Two explicit rules profiles

The engine supports two separate profiles:

- `dnd5e-2014` — 2014-era fifth edition, grounded in SRD 5.1 plus campaign-enabled lawful sources.
- `dnd5e-2024` — revised fifth edition, grounded in SRD 5.2.x plus campaign-enabled lawful sources.

These profiles are NOT interchangeable.

Every rules-bearing character state must record which profile it uses. A calculation that depends on a profile must never silently fall back to the other profile.

Examples of meaningful differences include:

- character origin and ability-score adjustments
- species/race structure
- class feature progression
- subclass timing
- weapon mastery
- exhaustion
- surprise
- grappling/unarmed-strike resolution
- several spells/features/conditions

## Product principles

1. The AI is the narrator/adjudicator interface, not the database.
2. Permanent choices are player-owned.
3. Derived mechanics are calculated and server-validated.
4. The character sheet is a read model, not an independently editable rules store.
5. Existing `items`, `active_effects`, currency and campaign-state systems should be reused through ruleset-aware adapters.
6. Existing campaign gameplay bars are not redesigned as part of this reference.
7. Source packs are campaign-controlled. Core does not mean every commercially published option.
8. The 2014 and 2024 profiles may share infrastructure only where rules genuinely match.

## Intended source-of-truth split

### Canonical character rules state

Owns permanent player choices and progression:

- rules profile
- base/assigned abilities
- origin/species/background choices
- ordered class-level history
- subclass choices
- feats / ASIs
- skill/tool/save proficiency choices
- spell choices
- permanent class/species/background choices
- XP
- Hit Dice / HP-level history
- attunement choices when relevant

### Existing authoritative runtime systems

Keep external systems authoritative for their own domains:

- item ownership/equipped state: existing `items`
- timed effects/conditions: existing `active_effects`
- currency: existing currency tables
- campaign/world/NPC state: campaign systems

### Read projections

Character sheet, sidebar summaries and AI context are projections built from canonical rules state plus authoritative runtime systems.

## Planned files

- `SOURCES.md` — lawful primary source inventory
- `PROFILE-DIFFERENCES.md` — explicit 2014 vs 2024 divergence map
- `AUDIT-RECONCILIATION.md` — legacy repo code vs fresh design
- `CLAUDE-HANDOFF.md` — live-server comparison instructions
- `domain.ts` — versioned profile-aware canonical state
- `core-tables.ts` — shared XP/proficiency/ability math
- `skills.ts`
- `species-2014.ts`
- `species-2024.ts`
- `backgrounds-2014.ts`
- `backgrounds-2024.ts`
- `classes-2014.ts`
- `classes-2024.ts`
- `subclasses.ts`
- `feats.ts`
- `proficiencies.ts`
- `combat.ts`
- `conditions.ts`
- `equipment.ts`
- `spellcasting.ts`
- `creation.ts`
- `levelup.ts`
- `multiclass.ts`
- `modifiers.ts`
- `runtime-adapters.ts`
- `sheet-model.ts`
- `sheet-projector.ts`
- `ai-context.ts`
- `state-transactions.ts`
- `schema-proposal.ts`
- `TEST-VECTORS.md`

## Non-goals

This reference does not:

- copy protected book prose
- treat 2014 and 2024 as one blended ruleset
- create fake 5e prestige classes merely because 3.5e has them
- silently select feats, subclasses, spells, skills, tools, languages, multiclass levels or ASIs for the player
- make the current 5e `computedStats.ts` authoritative
- merge itself into production without comparison

## Prestige-class note

Standard fifth-edition character progression primarily uses subclasses/archetypes rather than the 3.5e prestige-class model.

If a campaign-enabled legitimate source contains an actual prestige-class or prestige-like optional system, it belongs in a source-specific extension with explicit prerequisites. The core engine does not invent one.
