# Claude Handoff — Compare Live Server vs D&D 3.5 Character Core v2

Use this document when reconciling the live VPS with GitHub.

## Reference location

Branch:

`reference/dnd35-character-core-v2`

Directory:

`docs/reference-implementations/dnd35-character-core-v2/`

This branch was created from GitHub `main` at `c22bb3dd081f3ddb371671efc4d9c97e4e4b120c`.

## Your mission

Compare the LIVE SERVER implementation of each subsystem against the candidate implementation and design in this directory.

Do not blindly port the candidate.

Do not blindly preserve production.

Keep the strongest implementation, provided it respects the product constraints below.

When both implementations contain useful complementary behavior, combine them into ONE authoritative subsystem rather than preserving parallel writers.

## Product constraints that override implementation preference

1. Initial ruleset is D&D 3.5e.
2. D&D 5e calculations must never leak into a 3.5e campaign.
3. Player dice rolls and permanent choices remain player-owned.
4. Claude may recommend or propose choices but must not silently select feats, skill ranks, languages, class levels, ability increases, spell choices, domains, companions or other permanent options.
5. Existing campaign gameplay bars are not to be redesigned as part of this reconciliation.
6. The full D&D 3.5e character sheet is a read-only projection of authoritative state.
7. `items` remains the inventory/equipment authority unless production has a demonstrably stronger single item system.
8. temporary effects must have one authoritative store; GitHub already has `active_effects`.
9. hidden achievement/title logic must remain hidden from players.
10. AI narration is not the database.
11. No client-only rules calculation may be trusted as authoritative.
12. Keep backwards compatibility where practical, but do not preserve contradictory authoritative sources indefinitely.

## Compare these production systems first

Before changing anything, find production equivalents of:

- character database schema
- ruleset registry / campaign ruleset
- ability-score storage
- XP storage and progression
- level-up flow
- race registry
- class registry
- character creation wizard
- dice/roll persistence
- combat engine
- items/equipment mechanics
- temporary effects/conditions
- spells/spell slots
- achievements
- AI context builder
- state-change parser/transaction engine
- snapshot/rewind behavior
- character sheet writer/projector

## For each subsystem produce a decision

Use exactly one of these outcomes:

### KEEP_PRODUCTION
Production is clearly stronger and satisfies the constraints. Keep it. Port only useful tests/types/helpers from the reference if needed.

### PORT_REFERENCE
Production is absent, weaker or structurally unsafe. Port the candidate implementation, adapted to production conventions.

### MERGE_TO_ONE
Both contain useful pieces. Merge them into one authoritative implementation and delete/deprecate the duplicate writer.

### DEFER_WITH_BLOCKER
Only when implementation would risk data loss or incompatible migration. State the concrete blocker and the safest migration prerequisite.

Do not use `DEFER_WITH_BLOCKER` merely because the change is large.

## Canonical-state decision

The reference prefers a versioned D&D 3.5e rules state separate from the sheet read model. If production already has stronger normalized columns/tables, they may remain canonical.

Whichever model wins, document one authority for each field:

- base ability score
- racial adjustment
- permanent level-based ability increase
- current effective ability score
- race id
- class-level history
- total level
- XP
- HP history/max/current/temp
- skill ranks
- feats
- languages
- class features/choices
- spell choices/resources
- size
- BAB/saves
- current equipment
- temporary effects

If a value is derived, do not make a second independently writable copy authoritative.

## Character-sheet rule

Do not write gameplay logic into the popup page.

Target flow:

canonical rules state
+ authoritative items/equipment
+ authoritative active effects
+ authoritative currencies
→ D&D 3.5e rules engine
→ Dnd35CharacterSheetData projection
→ UI

The UI may format data. It must not decide character legality.

## D&D 3.5e rules engine rule

Do not reuse `client/src/lib/computedStats.ts` for 3.5e. It is explicitly 5e.

If production already has a proper 3.5e engine, compare it with:

- `mechanics.ts`
- `modifiers.ts`
- `races.ts`
- `classes.ts`
- `creation-and-levelup.ts`

Keep whichever behavior is more correct and maintainable.

## AI context rule

Current GitHub `server/dm-engine.ts` sends very thin character data. Production may already be better.

The winning context builder should provide compact trusted facts, not raw editable character blobs and not the whole campaign database.

At minimum when relevant:

- identity/race/classes/level
- current HP and status
- ability modifiers
- AC/touch/flat-footed
- saves/BAB/grapple
- meaningful trained skills
- feats/class/racial abilities
- equipped weapons/armor
- relevant spell/resource state
- active conditions/effects

Do not include hidden information in player-visible outputs.

## Migration safety

Before migrating production character data:

1. make a backup/snapshot;
2. map old fields to the winning canonical state;
3. preserve player-selected permanent choices exactly;
4. do not infer missing feats/spells/skills merely to fill blanks;
5. log unresolved legacy fields;
6. project the old and new sheet side-by-side for test characters;
7. only retire old writers after parity is verified.

## Minimum acceptance checks

Use `TEST-VECTORS.md` plus production-specific tests.

The merged system is not done until at least these are true:

- Dwarf racial CON/CHA adjustment propagates correctly.
- Small-size attack/AC/Hide/grapple and carrying rules apply.
- Human bonus feat/skill-point entitlement is player-selected.
- multiclass BAB/saves sum correctly.
- skill-rank caps/costs are 3.5e, not 5e proficiency.
- item/effect bonuses obey typed stacking.
- character sheet is populated without manual duplication.
- level-up cannot silently choose permanent options.
- AI receives the trusted character facts needed to adjudicate.
- 5e `computedStats.ts` is not in the 3.5e execution path.
- snapshot/rewind does not orphan or duplicate progression state.

## Final report back to George

Report a table with:

SUBSYSTEM | PRODUCTION | REFERENCE | DECISION | FILES USED | MIGRATION NOTES

Then list:

1. what production kept;
2. what reference code was ported;
3. what duplicate code was retired;
4. schema/migration changes;
5. tests/typecheck/build results;
6. unresolved risks.

Do not report a feature as working merely because a type/interface/file exists. Trace the runtime writer and reader.