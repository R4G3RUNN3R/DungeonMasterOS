# D&D 5e Character Core v1 — Reference Status

Status: **ENGINE CORE READY FOR LIVE-SERVER COMPARISON / SELECTIVE PORT**

This does not mean the branch should be merged wholesale. It is intentionally isolated from production and from the current TypeScript build.

## Profiles implemented

- `dnd5e-2014` — SRD 5.1-era fifth edition
- `dnd5e-2024` — revised SRD 5.2.1 fifth edition

The engine explicitly separates profile-divergent mechanics.

## Implemented reference architecture

- versioned canonical character state
- explicit rules profile
- ordered class-level acquisition history
- player-owned permanent choice records
- source-pack/source-policy architecture
- standard XP/proficiency/ability math
- point buy / standard array support contract
- 2014 SRD race registry
- 2024 SRD species/lineage registry
- 2014/2024 origin/background split
- all twelve core classes for both profiles
- correct profile-specific subclass timing architecture
- the public SRD subclass for all twelve classes in both profiles
- skills/saves/proficiency/expertise architecture
- multiclass prerequisites and limited proficiency grants
- 2014 vs 2024 multiclass spellcaster rounding
- full-caster/half-caster/Pact Magic progression
- 2014 known-spell and revised prepared-spell progression tables
- Wizard spellbook acquisition entitlements
- concentration rules
- class resource derivation
- 2014 and 2024 condition models
- 2014 and 2024 exhaustion models
- 2014 and 2024 surprise rules
- 2014 grapple/shove contests
- revised grapple/shove Unarmed Strike save model
- death save/damage-at-zero helpers
- profile-specific armor/weapon catalogues
- revised Weapon Mastery assignments/properties
- profile-safe modifier model
- origin/general/fighting-style public revised feat architecture
- 2014 public Grappler feat with source-pack hooks for commercial options
- armor/AC/unarmored-defense resolution
- weapon attack/proficiency/heavy/finesse/mastery resolution
- Extra Attack resolution
- carrying/movement
- rests
- attunement constraints
- item/effect rules-profile adapters
- read-only full 5e sheet model/projector
- trusted compact AI character context
- canonical-authority rules
- pure rules-engine facade
- server-authoritative XP/level transaction pattern
- persistence/schema proposal
- live-vs-reference Claude handoff
- 145 acceptance vectors
- post-5e multi-ruleset/setting pipeline

## Important public-core/content distinction

The public GitHub reference is deliberately based on lawfully distributable SRD mechanics.

It does NOT copy all commercial Player's Handbook/Tasha/Xanathar/etc. subclasses, feats, spells or proprietary descriptive text into a public repo.

Full owned/licensed campaign options belong in `Dnd5eRulesSourcePack` implementations backed by:

- user-owned sources
- licensed providers
- lawful public/open sources
- explicit homebrew packs

This is a content/source boundary, not a limitation of the rules engine architecture.

## Prestige-class clarification

Standard 5e core does not use the D&D 3.5e prestige-class progression model. The equivalent core specialization layer is subclasses/archetypes.

If a legitimate enabled 5e source defines a prestige-class-like optional subsystem, it should register as a source-pack extension with its actual prerequisites/progression. Core must not invent prestige classes for symmetry with 3.5e.

## Known draft cleanup for production port

The isolated domain draft retains a top-level `state.feats` field for transitional comparison, but `state.levels[].featChoices` is the declared canonical acquisition authority. `canonical-authority.ts` synchronizes the projection. Production should remove or make the top-level field generated/read-only rather than maintaining two writers.

Equipment adapters should use stable catalogue/rule ids from production item metadata. Name normalization in the isolated projector is fallback demonstration only and must not become the permanent production identity mechanism.

The rules engine intentionally leaves full proprietary content packs outside public core.

## Live integration work Claude must still perform

1. Compare live production's ruleset/XP/combat/character systems against the reference.
2. Select one persistence authority.
3. Port the winning engine modules into build-included server/shared code.
4. Wire actual character creation and dice/choice UI.
5. Wire actual production items/effects using stable rules ids.
6. Wire live XP/milestone/level-up transactions.
7. Wire spells/source providers.
8. Wire the read-only 5e sheet UI.
9. Replace legacy client-side authoritative calculations with server/domain projections.
10. Feed trusted profile-aware context to the DM engine.
11. Extend snapshot/rewind to canonical rules state.
12. Migrate existing characters safely.
13. Run typecheck/build/database/runtime test suite.

## Verification limitation here

The local container/execution facility has been failing with `ClientResponseError`, so this isolated reference could not be compiled/run locally in this environment.

Claude/live production must execute `TEST-VECTORS.md` and normal typecheck/build/migration verification before reporting the engine as production-ready.

## Definition of done for production

A 5e implementation is not done because a sheet renders.

It is done when both profiles can:

- create a legal character from explicit player choices
- level/multiclass legally
- calculate mechanics deterministically
- maintain HP/resources/spells/items/effects
- resolve profile-correct combat state
- project a complete read-only sheet
- supply trusted DM context
- survive save/snapshot/rewind
- reject cross-profile contamination
- pass the acceptance vectors
