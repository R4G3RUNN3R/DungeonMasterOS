# Library of Knowledge — 2026-08-18

Branch: `feature/library-of-knowledge`
Base: production-aligned Task #130 branch

## Implemented

- Added an edition-isolated `Library of Knowledge` architecture with D&D 3.5e and 5e shelves.
- Added `/compendiums` dusty-library landing UI with worn edition plaques and interactive tome objects.
- Preserved the existing live Item Compendium at `/compendium`; it is correctly classified under 5e because its current seeded corpus is SRD 2014/2024 data.
- Added player-facing D&D 3.5e Grimoire, Holy Tome, and Feat Codex readers using the existing two-page `CompendiumBook` interaction.
- Generalized `CompendiumBook` so new volumes can share its cover/open/page-turn behavior without duplicating the book engine.
- Added canonical D&D 3.5e spell/feat/source contracts and source provenance rules.
- Added executable core metamagic, item-creation, and magic-facing feat records plus deterministic prerequisite evaluation.
- Added canonical knowledge APIs for Library shelves, D&D 3.5e spells, feats, and character feat eligibility.
- Added character-backed D&D 3.5e spell preflight for class access, known/prepared state, spell slots, components/foci, armour spell failure, metamagic, save DC, spell resistance, and prohibited schools.
- Successful catalogued spell casts consume the persisted spell slot/prepared use only after the action turn completes successfully; duplicate, fallback, or AI-unavailable responses do not consume resources.
- Added AI prompt grounding so relevant catalogued spell/feat records explicitly override model memory for D&D 3.5e narration.
- Added reward reconciliation: newly AI-granted items are matched against the campaign ruleset's item corpus; canonical matches replace invented mechanics, while unmatched rewards are marked `dm-homebrew-unverified:<ruleset>` instead of masquerading as rulebook items.
- Corrected the universal D&D 3.5e level-up schedules in the Library guard layer: +1 to one ability every 4 levels, general feat every 3 levels, and both when schedules coincide.
- Reworked the level-up UI for D&D 3.5e to choose feats from the canonical Feat Codex, display eligibility/prerequisite failures, collect feat parameters, and persist canonical feat rules into the character sheet/data.
- Constitution increases that change the modifier recalculate hit points across the character's hit dice/levels.
- Added regression tests for edition isolation, Grimoire/Holy Tome projection, metamagic rules, feat prerequisites, AI canonical context, and character-backed spell preflight/resource consumption.

## Deliberately incomplete / blocked from pretending otherwise

- The D&D 3.5e spell corpus is still a foundation subset (currently representative records including Magic Missile, Fireball, Cure Light Wounds, and Dispel Magic). The full SRD/verified corpus must be ingested before the Grimoire/Holy Tome is considered complete.
- The D&D 3.5e item corpus is not yet ingested. The 3.5 Item Compendium remains disabled in the Library rather than exposing 5e item records under the wrong edition.
- The D&D 3.5e Bestiary corpus is still being prepared; the Bestiary volume remains disabled until canonical creature records exist.
- Class-specific bonus-feat schedules (for example Fighter bonus feats and Wizard bonus selections) still belong in the broader class-progression corpus. This pass corrects universal 3.5 feat/ability schedules only.
- Full deterministic spell-effect resolution against combat targets (damage areas, creature saves/SR, effect application) remains a subsequent mechanics layer. This pass makes cast legality/resource use canonical and supplies the canonical spell facts to the AI, but does not claim that every spell effect in the edition is already executable.
- NPC spellcasting remains pending structured Bestiary/NPC spellcasting data. The current NPC combat turn system does not have a canonical spellcasting state to adjudicate against and must not fabricate one.
- Public navigation outside the Compendium/tome surfaces still contains some legacy `Compendium` links. `/compendiums` is implemented, but the full-site label migration should be completed when the production shell navigation is reconciled.

## Source / copyright boundary

- Public/open SRD mechanics may be represented canonically where their license permits.
- User-owned official sourcebooks are private verification/provenance sources.
- Closed-source prose or page layouts are not reproduced wholesale. Player-facing tome pages use DungeonMasterOS-authored summaries and structured facts with source references.

## Risk

Moderate. The new Library UI is additive and isolated, while the action/level-up guards sit in front of existing production routes to preserve the tested campaign engine, achievements, websocket flow, XP/class updates, and other live systems. This branch is intentionally not deployed or merged until compilation/tests and corpus-expansion checks are complete.
