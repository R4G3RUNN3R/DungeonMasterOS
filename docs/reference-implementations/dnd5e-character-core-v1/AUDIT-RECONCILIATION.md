# D&D 5e Fresh Engine — Existing Repo Reconciliation

## Existing file: `client/src/lib/computedStats.ts`

The current repository already contains a client-side file explicitly described as a D&D 5e attribute cascade engine.

It is NOT sufficient to become the canonical fresh 5e engine.

### Useful concepts worth preserving selectively

- ability modifier derivation
- profile-independent idea of calculated-value breakdowns for UI/debugging
- proficiency bonus progression
- skill-to-ability mapping for 2014-style 18 core skills
- advantage/disadvantage as separate state rather than numeric +/- stacking
- effect/item adapters as a concept
- passive Perception as a derived concept when the selected profile/source uses it

### Problems that disqualify it as authoritative

1. It is client-side.
2. It extracts base abilities by heuristically parsing arbitrary `characterData.sections` text.
3. It infers skill proficiency from strings containing `+` or `prof`.
4. It has no explicit 2014 vs 2024 profile id.
5. It assumes one global carrying formula.
6. It assumes one global skill/save/spellcasting model.
7. It reads generic item/effect `statMods` without an edition-aware mechanical payload contract.
8. It does not represent ordered class-level history required for correct multiclass/progression decisions.
9. It does not own or validate permanent choices.
10. It does not provide a complete creation/level-up pipeline.
11. It is not a server transaction boundary.
12. It cannot safely distinguish a 2014 character from a revised 2024 character.

### Decision

Do not refactor this file into the new authority.

Build the new profile-aware engine independently. During live reconciliation Claude may:

- reuse tests/concepts that remain correct;
- replace this file with a thin client projection adapter;
- leave it temporarily for legacy characters while migration runs;
- delete it once no live path depends on it.

It must not remain an independent rules writer after migration.

## Existing item/effect systems

GitHub `main` already has structured `items` and `active_effects` persistence.

Reuse them for ownership/equipped/duration/concentration state.

Mechanical payloads must become profile/source aware. A modifier created for `dnd5e-2014` may not be assumed correct for `dnd5e-2024` or `dnd35-core`.

## Existing achievements/snapshots

These systems already exist on GitHub `main` and should be integrated, not recreated.

The fresh 5e character state must participate in snapshot/rewind consistently.

## Existing live-server divergence

The live VPS reportedly contains newer combat, XP/leveling, ability-score and ruleset behavior than GitHub `main`.

Claude must compare production against this reference before porting.

For each subsystem choose one:

- `KEEP_PRODUCTION`
- `PORT_REFERENCE`
- `MERGE_TO_ONE`
- `DEFER_WITH_BLOCKER`

The target is one authoritative implementation per profile, not an archaeological exhibit of every implementation anybody ever wrote.