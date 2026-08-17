# D&D 3.5 Character Core v2 — Reference Status

Status: **READY FOR LIVE-SERVER COMPARISON / SELECTIVE PORT**

This does NOT mean production should merge the branch wholesale.

## Implemented in the isolated reference

- versioned canonical D&D 3.5e character state
- ordered class-level progression history
- explicit permanent player-choice records
- seven core PHB races and racial mechanics
- eleven core PHB base classes and class progression metadata
- class restrictions and player-choice hooks
- core skill registry, costs and rank caps
- multiclass BAB and base saves
- standard XP thresholds
- favored-class multiclass XP-penalty reference
- size rules
- carrying/encumbrance rules
- armor/load movement rules
- racial movement handling
- HP recalculation from Hit Dice history and Constitution
- typed 3.5e modifier stacking
- core spell-slot progressions
- Bard/Sorcerer spells-known progressions
- bonus spells and ability requirements
- spell-choice/spellbook entitlements
- class-derived daily resources and automatic class modifiers
- class/racial proficiency metadata
- class-aware language rules
- item/effect ruleset adapters
- read-only sheet projection contract
- compact trusted AI character context
- composed rules-engine facade
- server-authoritative XP/level transaction pattern
- persistence/schema proposal
- live-vs-reference Claude handoff
- audit corrections
- extensive acceptance vectors
- multi-ruleset/setting expansion pipeline

## Intentionally not merged into application runtime

The reference lives outside `tsconfig.json` and on a separate branch because the live VPS reportedly has newer systems not present on GitHub `main`.

Claude must compare the live implementation before porting.

## Source-pack work intentionally outside `dnd35-core`

The following are NOT supposed to be hard-coded into core simply to inflate a completeness number:

- Complete-series classes/options
- prestige classes from supplements/DMG
- expanded races/subraces/templates
- psionics
- Tome of Battle-style subsystems
- every feat from every owned book
- every spell from every owned book
- every magic item from every owned book
- campaign-setting-specific mechanics

Those should be campaign-enabled source packs with explicit provenance and prerequisites.

## Known integration work for Claude

During live-server reconciliation Claude still must:

1. select the winning production persistence model;
2. port/adapt the reference rules modules into build-included application code;
3. connect the real character-creation UI;
4. connect actual player dice rolls;
5. connect the live XP/level-up implementation;
6. map real production item mechanics to ruleset-tagged payloads;
7. feed active effects through the selected 3.5e modifier resolver;
8. replace UI fallback math with the server/domain sheet projection;
9. feed trusted character context to the live DM engine;
10. make snapshots include the winning canonical character state;
11. run migrations/backups on real production data;
12. run typecheck/build/runtime tests.

## Verification limitation in this environment

The local execution/container facility failed with `ClientResponseError`, so this isolated reference could not be compiled or executed locally here.

That limitation is why `TEST-VECTORS.md` is deliberately detailed. Claude must run the implementation against those vectors on the real/live codebase before reporting success.

Do not convert "reference code exists" into "production feature works" without tracing the real writer, persistence layer, calculation path and reader.