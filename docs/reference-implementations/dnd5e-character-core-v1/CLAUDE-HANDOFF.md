# Claude Handoff — Compare Live Server vs Fresh D&D 5e Core v1

## Reference location

Branch:

`reference/dnd5e-character-core-v1`

Folder:

`docs/reference-implementations/dnd5e-character-core-v1/`

Base used when the branch was created:

`main` at `c22bb3dd081f3ddb371671efc4d9c97e4e4b120c`

## Mission

Compare the LIVE VPS implementation against this fresh reference system.

This reference deliberately does not assume GitHub `main` is newer than production. Production reportedly contains newer combat, ability-score, XP/leveling, ruleset and achievement work.

For EVERY subsystem choose exactly one:

- `KEEP_PRODUCTION`
- `PORT_REFERENCE`
- `MERGE_TO_ONE`
- `DEFER_WITH_BLOCKER`

Keep production if it is stronger and profile-correct.
Port the reference if production is absent/weaker.
Merge complementary pieces into ONE authority.
Never keep two authoritative implementations because deciding is inconvenient.

## Non-negotiable rules

1. 2014 and revised 2024/5.5e are distinct rules profiles.
2. Never silently fall back across profiles.
3. Player owns permanent choices and important rolls.
4. Claude may recommend/explain; Claude does not silently select permanent options.
5. AI narration is not a database write.
6. Server validates every permanent/mechanical mutation.
7. Character sheet is a read-only projection.
8. Existing campaign gameplay bars are not redesigned.
9. Existing item/effect/currency/snapshot/achievement systems are reused when stronger rather than recreated.
10. Public SRD core and private owned/licensed source packs remain separate.

## Compare production first

Trace the actual runtime writer and reader for:

- campaign ruleset/profile selection
- source-book/source-pack policy
- ability generation/storage
- race/species
- background
- classes/subclasses
- feats/ASIs
- skill/save/tool/weapon/armor proficiencies
- weapon mastery
- XP/milestone progression
- HP/Hit Dice/death state
- class resources
- spellcasting/preparation/known/spellbook/Pact Magic
- multiclassing
- combat/action economy
- attacks/AC
- conditions/exhaustion
- concentration
- rests
- inventory/equipment
- attunement
- active effects
- character sheet
- AI character context
- proposed/validated state changes
- snapshots/rewind

Do not count an interface/file as implemented until you trace a live writer and reader.

## Existing repo file to treat carefully

`client/src/lib/computedStats.ts`

It is an old client-side 5e cascade, not the new authority.

Useful ideas may be kept, but do NOT make it the canonical engine because it:

- parses free-text characterData
- is client-side
- has no explicit 2014/2024 profile boundary
- cannot own permanent choices
- is incomplete for creation/leveling/combat/source packs

The target is a server/domain rules engine with thin UI projection helpers.

## Public core vs owned source packs

Public reference mechanics come from SRD 5.1 and SRD 5.2.1 under CC BY 4.0.

The product may support additional user-owned/licensed books through private/source-pack data.

Do NOT copy proprietary commercial rulebook prose/options wholesale into the public repository.

If production already has a lawful private source-index/provider system, keep it and integrate the `source-packs.ts` contract around it.

## Canonical state decision

The reference recommends one versioned canonical rules state plus ordered level acquisition records.

Document ONE authority for:

- profile id
- origin/race/species/background
- assigned abilities
- ability adjustments
- class level history
- subclass choices
- feat/ASI acquisition
- proficiency choices
- XP
- HP-level history
- permanent spell choices
- runtime slots/preparation/resources
- attunement

`state.levels[].featChoices` is the reference authority for feat acquisition. Any top-level feat list in the isolated draft is transitional projection only and must not be a second writer.

Do not leave calculated PB/skills/saves/AC/spell DC independently editable.

## Character sheet target flow

canonical rules state
+ authoritative items/equipment
+ authoritative active effects/conditions
+ authoritative runtime resources/spell use/death state
+ currencies where displayed
→ selected D&D 5e rules profile
→ character sheet read model
→ UI

The UI formats. It does not determine legality.

## Required profile differences to preserve

At minimum verify all of these against `TEST-VECTORS.md`:

- 2014 Race ASIs vs 2024 Background ASIs
- 2014 varied subclass timing vs 2024 level-3 subclass timing
- Ranger/Paladin spellcasting start/progression changes
- 2014 known-spell vs revised prepared-spell models
- 2014 vs 2024 multiclass half-caster rounding
- no Weapon Mastery in 2014; explicit Weapon Mastery in 2024
- 2014 surprise vs 2024 Initiative Disadvantage
- 2014 grapple contests vs 2024 Unarmed Strike saves
- 2014 vs 2024 exhaustion
- profile-specific weapons/equipment
- profile-specific subclass features
- profile-specific feat/source policy

## AI context

The live DM should receive compact trusted mechanical state built by `ai-context.ts` or a stronger production equivalent.

Do not dump raw `characterData` as trusted mechanics.

Every mechanical context block includes the profile id.

Claude may propose structured events such as HP damage, condition application, resource spend or item grant. The server validates/commits them.

## Migration process

1. Backup live database.
2. Inventory live schemas/routes/runtime writers.
3. Determine profile for each campaign/character from reliable explicit evidence.
4. Build migration mapping per authoritative field.
5. Preserve every recorded player choice exactly.
6. Leave missing permanent choices unresolved.
7. Migrate generic item/effect mechanics only after their edition/source is verified.
8. Compare old/new sheet and combat numbers on representative characters.
9. Switch writers before readers where possible.
10. Keep rollback/snapshot path.
11. Retire old duplicate writers after parity.

## Verification

Run `TEST-VECTORS.md` plus production tests.

Also run:

- typecheck
- build
- database migration dry run/copy
- creation flow for both profiles
- level-up for both profiles
- multiclass test
- caster/noncaster tests
- equipment/effects tests
- snapshot/rewind test
- AI action/state mutation test

Do not report success because reference files exist.

## Final report format

Provide:

| Subsystem | Production | Reference | Decision | Winning files | Migration notes |

Then list:

1. production code kept;
2. reference pieces ported;
3. merged systems;
4. duplicate writers retired/deprecated;
5. schema/migrations;
6. tests/build/typecheck results;
7. unresolved source-pack gaps;
8. remaining risks.
