# Audit Reconciliation — GitHub `main`

This file records what was verified directly against `main` before creating the reference implementation. It exists because the supplied audit contains useful findings, but also several material false negatives. Claude must re-check production rather than assuming either document is perfectly current.

## Audit finding: active effects do not exist

**Correction: false on current `main`.**

`shared/schema.ts` defines `active_effects` with:

- campaign / character ownership
- source and icon
- debuff flag
- duration type
- total duration
- rounds remaining
- concentration
- structured `statMods`
- description / appliedBy

`server/storage.ts` implements:

- get by character/campaign/id
- create/update/delete
- concentration replacement
- round ticking and expiry

`server/routes.ts` exposes character-effect read/create/delete routes and ticks round-based effects after player actions.

**Decision:** reuse and improve this system. Do not create a second temporary-effect store.

## Audit finding: achievements are design-only / no unlock wiring

**Correction: false on current `main`.**

`shared/achievements.ts` already contains an achievement catalogue, hidden achievements, event contexts, deterministic checks and a narration-text scanner.

`shared/schema.ts` defines `user_achievements`.

`server/storage.ts` implements achievement reads, idempotency checks and inserts.

`server/routes.ts` calls achievement checks on campaign/settings/ability/DM-response events and broadcasts unlocks.

**Important weakness:** the current narration scanner relies heavily on regex over prose. It can be useful as a fallback signal, but future roleplay XP, titles and serious progression should prefer validated structured events rather than treating wording as proof that something happened.

**Decision:** extend the existing achievement pipeline where possible. Do not create another independent user-achievement system.

## Audit finding: AI only narrates and no mechanical persistence exists

**Correction: partly false.**

The main DM system is mechanically thin, but `server/routes.ts` already performs post-narration extraction for:

- newly granted items
- newly granted abilities
- world-state updates
- achievement signals
- active-effect expiry

The AI itself still receives very poor character context from `server/dm-engine.ts`: party members are effectively represented as `name (race class)` plus campaign world state. The reference implementation therefore focuses on a trusted compact character-context adapter rather than pretending no AI-state integration exists at all.

## Audit finding: inventory has three competing representations

**Confirmed, with nuance.**

- `items` is the real structured inventory system and should remain authoritative.
- `characters.inventory` is explicitly legacy compatibility storage.
- `Dnd35CharacterSheetData.equipment` is a read-model shape and should be treated as a projection, not another store.

**Decision:** the target architecture is not three synchronized writers. It is one item store plus a sheet projector.

## Audit finding: no ability-score writer / 3.5e sheet mostly has no writer

**Confirmed on GitHub `main`.**

The current campaign creation form collects name, race, class, traits, backstory, level, HP, max HP, speed, attacks/round and arbitrary character data. It does not run a D&D 3.5e creation workflow or persist authoritative base ability scores.

The popup can read `characterData.dnd35Sheet` and legacy `rulesProfile`, but current live GitHub creation does not populate a complete `dnd35Sheet`.

**Decision:** add one canonical D&D 3.5e state and project the sheet from it. Do not make the sheet object itself the mutable rules engine.

## Audit finding: no level-up / XP flow on GitHub `main`

**Substantially confirmed for the D&D 3.5e character core.**

`characters.level` is present, while the current GitHub character core lacks a proper D&D 3.5e progression ledger that records class-at-each-level, HP gain, skill-point allocation, feat choices, ability increases and spell/class choices.

The live VPS reportedly has newer XP/leveling behavior. Claude must compare that implementation before porting this reference progression ledger.

## Audit finding: 5e contamination in `computedStats.ts`

**Confirmed.**

The file explicitly calls itself a D&D 5e cascade engine and includes 5e-specific mechanics such as:

- proficiency bonus
- 18-skill 5e mapping
- six ability saving throws
- 8 + proficiency + ability spell save DC
- 5e-style carrying capacity

It is currently isolated/dead enough not to corrupt the new popup, but it must never be wired into D&D 3.5e creation or sheet calculation.

**Decision:** do not modify it into a confused hybrid. Keep ruleset engines separate. The reference implementation supplies pure 3.5e mechanics.

## Audit finding: starter presets are dead/unreachable

**Confirmed as an integration gap.**

The presets are useful source data but not a canonical state model. If production already has a character picker, adapt them into that flow. Otherwise, they can seed the D&D 3.5e creation process later.

**Decision:** presets are inputs/templates. They are not a fourth rules-state format.

## Audit finding: currency system absent

**Nuanced.**

The schema/storage layer includes campaign/character currency concepts, but some routes on current `main` intentionally return empty arrays as frontend-safe placeholders. Claude should compare production before implementing new currency persistence because the live server may already have the real route behavior.

## Audit finding: snapshots/save points exist

**Confirmed.**

The schema/storage/routes contain campaign snapshot concepts. Any production integration of canonical D&D state must ensure snapshots include or restore that state consistently.

## Confirmed high-priority GitHub gaps

1. no authoritative D&D 3.5e character rules state
2. no complete D&D 3.5e character-creation writer
3. no proper core race registry with mechanical racial rules
4. no clean D&D 3.5e mechanics engine replacing the dormant 5e engine for 3.5e campaigns
5. no deterministic D&D 3.5e level-up ledger on GitHub `main`
6. sheet projection is mixed with UI fallback logic instead of coming from one server/domain projector
7. AI character context is far too thin
8. equipment/effects are not evaluated with D&D 3.5e typed-bonus stacking rules
9. class/race free-text compatibility fields have no stable rules identifiers
10. `characterData` contains multiple historical shapes without a strict authority policy

## Reconciliation rule for Claude

For every subsystem:

1. inspect the live-server source first;
2. identify its canonical storage and runtime writers;
3. compare behavior with this reference implementation;
4. keep production if it is equal or stronger;
5. port the reference implementation if production is missing or weaker;
6. merge complementary ideas when they have one clear source of truth;
7. never keep two authoritative implementations merely to avoid deciding.

The objective is not to make production resemble this folder. The objective is to end with the strongest single implementation.