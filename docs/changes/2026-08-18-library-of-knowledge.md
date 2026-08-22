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
- Added pinned Revised 3.5 SRD importers for the full readable spell and feat corpora. Imports fail closed: a suspiciously partial/failed source load falls back to the curated executable foundation instead of presenting an incomplete corpus as canonical.
- Curated spell records override their imported SRD counterparts for executable mechanics while retaining pinned open-SRD rules text/provenance.
- Expanded the curated executable spell foundation with Grease, Sleep, Mage Armor, Shield, Burning Hands, Scorching Ray, Lightning Bolt, Haste, Slow, Invisibility, Hold Person, and Web, in addition to the original Magic Missile, Fireball, Cure Light Wounds, and Dispel Magic records.
- Added executable core metamagic, item-creation, and magic-facing feat records plus deterministic prerequisite evaluation.
- Reconciled the feat/metamagic TypeScript contract with the richer executable records already used by the corpus: plural prerequisites, parameter kinds, repeat rules, modifier IDs, allow/replace operations, variable Heighten slots, spontaneous-casting metadata, and ordering notes are now first-class rather than undeclared ad-hoc fields.
- Added canonical knowledge APIs for Library shelves, D&D 3.5e spells, feats, and character feat eligibility.
- Added character-backed D&D 3.5e spell preflight for class access, known/prepared state, spell slots, components/foci, armour spell failure, metamagic, save DC, spell resistance, and prohibited schools.
- Corrected 3.5 component handling: `M/DF` and `F/DF` are tradition-dependent alternatives, not cumulative requirements. Ordinary negligible-cost focus components can come from a real spell component pouch; costly foci remain explicit inventory requirements.
- Split Eschew Materials from physical component-pouch ownership. Eschew can satisfy eligible material components but never satisfies focus or divine-focus requirements.
- Unsupported caster models fail closed. Core Wizard/Sorcerer/Bard and Cleric/Druid/Paladin/Ranger casting modes are executable; imported prestige/NPC-class spell lists do not bypass preparation/known-spell rules until their casting models are explicitly encoded.
- Successful catalogued spell casts consume the persisted spell slot/prepared use only after the action turn completes successfully; duplicate, fallback, or AI-unavailable responses do not consume resources.
- Added AI prompt grounding so relevant catalogued spell/feat records explicitly override model memory for D&D 3.5e narration.
- Added reward reconciliation: newly AI-granted items are matched against the campaign ruleset's item corpus; canonical matches replace invented mechanics, while unmatched rewards are marked `dm-homebrew-unverified:<ruleset>` instead of masquerading as rulebook items.
- Corrected the universal D&D 3.5e level-up schedules in the Library guard layer: +1 to one ability every 4 levels, general feat every 3 levels, and both when schedules coincide.
- Reworked the level-up UI for D&D 3.5e to choose feats from the canonical Feat Codex, display eligibility/prerequisite failures, collect feat parameters, and persist canonical feat rules into the character sheet/data.
- Constitution increases that change the modifier recalculate hit points across the character's hit dice/levels.
- Added regression tests for edition isolation, Grimoire/Holy Tome projection, metamagic rules, feat prerequisites, AI canonical context, character-backed spell preflight/resource consumption, the expanded executable spell pack, and material/focus/divine-focus component alternatives.
- Added a non-deploying GitHub verification workflow for the draft branch (`npm ci`, tests, typecheck, production build). GitHub has not started a run in the current repository configuration, so this is not treated as successful verification.

## Deliberately incomplete / blocked from pretending otherwise

- The readable core SRD spell corpus can be imported from a pinned revision, but only curated records are authoritative for deterministic execution. The executable subset is being expanded spell-by-spell; imported structured/reference records must not silently mutate game state beyond what their executable rules encode.
- D&D 3.5 mundane equipment has its own pinned SRD importer. Magic items, potions, scrolls, staves, wands and wondrous-item mechanics still need the native 3.5 item corpus completed before that volume is comprehensive.
- The D&D 3.5 Bestiary corpus is still being prepared; the Bestiary volume remains disabled until canonical creature records exist.
- The full SRD feat chapter is readable/catalogued through the pinned importer, but many general/fighter feats remain reference-only until their prerequisites/modifiers are encoded and wired into the character/combat systems. Class-specific bonus-feat schedules still belong in the broader class-progression corpus.
- Cleric/domain spell access is represented in canonical spell records, but the character sheet currently has no explicit domain-slot pool. Domain-only casting must remain non-executable until the dedicated domain slot/preparation resource is represented and consumed correctly; do not spend an ordinary cleric slot as a fake substitute.
- Full deterministic spell-effect resolution against combat/world targets (area selection, creature saves, spell-resistance checks, damage/healing application, conditions, movement, summons, environmental effects, etc.) remains a subsequent mechanics layer. Cast legality/resource use and canonical facts are ahead of effect execution.
- NPC/prestige-class spellcasting remains pending structured caster-state support. Imported spell-list membership alone is not enough authority to infer preparation mode, casting ability, known spells, slots or components.
- Public navigation outside the Compendium/tome surfaces still contains some legacy `Compendium` links. `/compendiums` is implemented, but the full-site label migration should be completed when the production shell navigation is reconciled.
- The execution sandbox used during this pass could not clone the repository, and GitHub Actions did not start the newly added branch workflow. This branch therefore remains draft-only until tests/typecheck/build run successfully in an allowed repository or production-like environment.

## Source / copyright boundary

- Public/open SRD mechanics may be represented canonically where their license permits.
- User-owned official sourcebooks are private verification/provenance sources.
- Closed-source prose or page layouts are not reproduced wholesale. Player-facing tome pages use DungeonMasterOS-authored summaries and structured facts with source references.

## Risk

Moderate. The Library UI is additive and isolated, while action/level-up guards sit in front of existing production routes to preserve the campaign engine, achievements, websocket flow, XP/class updates, and other live systems. Spell legality is increasingly authoritative, but deterministic effect execution and several resource models are deliberately still gated. This branch is not deployed or merge-ready until compilation/tests and the remaining mechanical gates pass.
