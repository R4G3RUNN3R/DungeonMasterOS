# D&D 3.5 Character Core v2 — Reference Implementation

Status: candidate architecture for comparison and selective porting
Branch: `reference/dnd35-character-core-v2`
Base: `main` at `c22bb3dd081f3ddb371671efc4d9c97e4e4b120c`

## Why this exists

The current GitHub `main` and the live VPS have evolved separately. This directory is intentionally isolated from the application build so it can serve as a clean comparison target. Claude should compare each subsystem here with the live-server implementation and keep the stronger design or implementation. Do not replace a working production subsystem merely because a reference implementation exists here.

The reference implementation focuses on the character-system gaps that are genuinely present on GitHub `main`:

- a canonical D&D 3.5e character rules state
- stable race and class identifiers instead of free-text-only mechanics
- core PHB/SRD race mechanics
- core class progression metadata
- D&D 3.5e ability/BAB/save/skill/size/XP/carrying calculations
- deterministic creation and level-up entitlements
- one-way projection into the existing read-only D&D 3.5e character sheet
- real `items` and `active_effects` as external authoritative sources instead of duplicating them into the sheet
- compact trusted AI character context
- a migration/reconciliation contract for Claude

## Critical rule

`Dnd35CharacterSheetData` is a READ MODEL. It is not the authoritative character database.

The character sheet should be projected from canonical character rules state plus authoritative runtime systems such as items, active effects and currency. Player choices must be stored at the point they are made. Missing choices must stay missing. Claude must never invent permanent choices to make a sheet look complete.

## Existing GitHub systems that SHOULD be reused

The audit supplied for this work under-reported several systems already present on `main`. Current code confirms these exist and should not be recreated blindly:

- `items` table and storage APIs
- `active_effects` table, duration tracking and storage APIs
- `user_achievements` table and achievement unlock helpers
- campaign snapshots/save points
- world-state extraction
- AI item/ability extraction from narration
- WebSocket campaign broadcasts
- the read-only 3.5e popup and `shared/dnd35-character-sheet.ts`

See `AUDIT-RECONCILIATION.md` for the exact corrections.

## Recommended source-of-truth split

### Universal character row

Keep the existing `characters` row for values the rest of DungeonMasterOS already needs quickly:

- id / campaign / owner
- display name
- display race/class for compatibility
- current HP / max HP / temp HP
- current speed
- current attacks-per-round
- status

For a D&D 3.5e campaign these compatibility fields should be updated transactionally from the D&D rules state. They must not become independent sources of truth.

### D&D 3.5e rules state

Use one canonical, versioned D&D 3.5e state per character. The exact persistence mechanism can be chosen after comparison with production. Preferred options, in order:

1. reuse production's existing canonical rules-state storage if it is already stronger;
2. a dedicated `character_rule_state` / `dnd35_character_state` row keyed by character;
3. as a transitional fallback only, a clearly versioned `characterData.dnd35State` object.

Do not make both dedicated columns and a second JSON state independently writable.

### Authoritative external systems

Do not duplicate these into canonical character state:

- inventory/equipment ownership: existing `items` table
- temporary timed effects: existing `active_effects` table
- currency: existing character/campaign currency tables where implemented
- campaign/NPC/world state: campaign/entity systems

The D&D character projector consumes those systems and calculates the sheet.

## File map

- `CLAUDE-HANDOFF.md` — exact compare/merge instructions for Claude
- `AUDIT-RECONCILIATION.md` — verified GitHub findings and audit corrections
- `domain.ts` — canonical D&D 3.5e domain types and progression ledger
- `races.ts` — seven core race definitions and racial rule hooks
- `classes.ts` — eleven PHB base-class metadata and progression hooks
- `modifiers.ts` — D&D 3.5e typed bonus/penalty stacking model
- `mechanics.ts` — pure core mechanics and derived calculations
- `creation-and-levelup.ts` — deterministic player-choice entitlements and validation helpers
- `sheet-projector.ts` — projection contract into the existing sheet type
- `ai-context.ts` — compact, trusted character context model for Claude
- `schema-proposal.ts` — persistence proposal and migration rules, not a drop-in migration
- `TEST-VECTORS.md` — acceptance cases Claude should run against whichever implementation wins

## Non-goals

This reference area does NOT:

- change the current campaign UI
- change existing gameplay bars
- wire the candidate into routes
- replace the production/live server
- add a new spell database
- choose feats, skills, languages, spells or multiclass levels for players
- create a second inventory/effects/achievement subsystem
- treat D&D 5e `computedStats.ts` as reusable 3.5e mechanics

## Integration philosophy

Claude should port capabilities, not blindly copy files. If the live server already has a stronger ruleset registry, XP engine, combat engine, ability-score storage, achievement system or level-up flow, keep it and adapt the useful pieces here around it.

Conversely, if production is missing a capability or has a weaker implementation, use this reference as the replacement design.

The target end state is one canonical D&D 3.5e rules engine, one authoritative item system, one authoritative effects system and one character-sheet projector. Anything else is how software acquires folklore.