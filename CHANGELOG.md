# Changelog

## 2026-08-18
- D&D 3.5 rules corpus: created the initial shared rules foundation for the Grimoire, Holy Tome, and Feat Codex on an isolated feature branch.
- Rules contracts: added normalized spell definitions, class/domain access, components, targeting, delivery, durations, saves, spell resistance, scaling, structured effects, feat categories, machine-readable prerequisites, metamagic transformations, character casting state, magic-item spell access, and cast-resolution output.
- Source provenance: added a manifest that separates public SRD/open rules from private official-book reference sources so copyrighted sourcebooks can validate records without being reproduced wholesale in the public repository.
- Metamagic: added executable core definitions for Empower, Enlarge, Extend, Heighten, Maximize, Quicken, Silent, Still, and Widen Spell, including slot adjustments and the properties each feat modifies.
- Item creation feats: added core definitions for Brew Potion, Craft Magic Arms and Armor, Craft Rod, Craft Staff, Craft Wand, Craft Wondrous Item, Forge Ring, and Scribe Scroll with deterministic caster-level prerequisites.
- Spellcasting feats: added structured magic-facing core feats including Augment Summoning, Combat Casting, Eschew Materials, Improved Counterspell, Spell Focus, Greater Spell Focus, Spell Penetration, Greater Spell Penetration, Spell Mastery, and Natural Spell.
- Feat qualification: added a deterministic prerequisite evaluator for abilities, BAB, skills, class/character level, caster level, accessible spell level, feats, race, alignment, proficiencies, and explicit special-rule flags.
- Cast preflight: added deterministic checks for class-list access, spell level, casting ability, known/spellbook/prepared state, spell-slot availability, prohibited schools, selected metamagic, verbal/somatic availability, antimagic, line of effect/sight, arcane spell failure, save DC, spell resistance, item charges, and component/focus/XP availability.
- Metamagic safety: the canonical guarded preflight filters the loaded metamagic catalogue to only feats explicitly selected for the requested cast, preventing unrelated loaded feat definitions from modifying the spell.
- Corpus validation: added duplicate-ID, edition, provenance, class-access, component-cost, structured-effect, and executable-metamagic validation checks for future bulk imports.
- Seed spells: added representative structured SRD records for Magic Missile, Fireball, Cure Light Wounds, and Dispel Magic to exercise arcane, divine, touch, area, save, spell-resistance, scaling, healing, undead interaction, and dispel/counterspell cases.
- Rules query layer: added direct spell/feat lookup, class and domain spell lists, category filtering, text search, and separate Grimoire/Holy Tome views over one canonical spell corpus.
- Expected impact: establishes a deterministic D&D 3.5 adjudication layer that the Dungeon Master AI can query instead of inventing spell/feat mechanics from prose or model memory.
- Risk: moderate and isolated. The work is not wired into live campaign resolution yet; bulk SRD spell/feat ingestion and broader tests remain before merge.

## 2026-08-17
- Character sheet: added a dedicated read-only D&D 3.5e character sheet popup page that opens separately from the live campaign and leaves all existing campaign bars untouched.
- Character sheet data: added `shared/dnd35-character-sheet.ts` as the canonical structured sheet contract for identity, class levels, ability scores, HP, movement, AC/touch/flat-footed AC, initiative, BAB, grapple, saves, skills, feats, special abilities, proficiencies, languages, weapons, armor, equipment, wealth, encumbrance, spellcasting, physical details, XP, backstory, contacts, enemies, and campaign notes.
- Character sheet projection: existing preset `rulesProfile` data is used as a safe fallback while future character-creation and level-up flows can progressively fill `characterData.dnd35Sheet`; missing values remain visibly unknown instead of being invented.
- Character sheet skills: the popup includes the full core D&D 3.5e skill list with class-skill, trained-only, ranks, ability modifier, miscellaneous modifier, total, and armor-check-penalty columns.
- Character sheet spells: caster class/level, casting ability, save DC by spell level, spells per day, bonus spells, known/prepared spell records, domains, specialization, prohibited schools, and notes are supported without using the repo's unrelated 5e proficiency-bonus cascade.
- Character sheet live data: HP, inventory, equipment, wealth endpoints, feats, abilities, and other recorded character data refresh while the popup remains open; a print-friendly view is included.
- Campaign UI: added a compact `Character Sheet` launcher while inside a campaign. It opens `/#/character-sheet/:campaignId` in a separate resizable browser window and does not replace or resize the existing gameplay layout.
- Characters: added eleven original level-1 D&D 3.5e PHB/SRD starter presets covering all eleven PHB base classes: Fighter, Cleric, Barbarian, Bard, Druid, Monk, Paladin, Ranger, Rogue, Wizard, and Sorcerer.
- Sorcerer: added Neris Tallow, a Half-Elf spontaneous arcane caster with proper level-1 sorcerer spells known, spell slots, saves, equipment, familiar, and progression guidance distinct from the Wizard preset.
- Catalogue: added `shared/default-character-catalogue.ts` as the growing canonical preset export, combining the original ten presets with the Sorcerer while preserving the original array for backwards compatibility.
- Character data: each preset includes core ability scores, HP, speed, AC, initiative, BAB, saves, feats, racial traits, class features, skills, spellcasting where relevant, combat notes, personality, backstory, and starting gear definitions.
- AI progression: each preset carries bounded Claude scaling guidance that preserves the character concept, follows core 3.5e class progression, and flags permanent player choices instead of silently making them.
- Inventory: starter equipment is represented separately from the flexible character-data blob so it can be seeded into the real item system when the character picker is wired into creation.
- Expected impact: DungeonMasterOS now has a reusable starter option for every core 3.5e PHB class and a complete live character-record surface ready to be populated by the character builder and level-up choices.
- Risk: low-to-moderate. The sheet is isolated to a new route/data contract plus a launcher button; no existing gameplay bars or campaign-state contracts were replaced.

## 2026-04-18
- Routes: applied the uploaded `server/routes.ts` visitor identity patch shape directly to `main` while preserving the rest of the newer route file.
- Behavior: logged-in players resolve to `user-{id}` before any `x-visitor-id` or anonymous fallback is used.
- Expected impact: stable character ownership and campaign identity for signed-in users, which supports Enter the World and character import flows.
- Risk: low. Narrow route-level change only.
- Deployment: added a fresh commit to force Railway to redeploy current `main`.
- Auth/routes: confirmed `server/routes.ts` already uses stable logged-in visitor identity (`user-{id}`) before falling back to `x-visitor-id` or anonymous IDs.
- Expected impact: logged-in users keep a stable character/campaign identity, which unblocks Enter the World and character import flows after redeploy.
- Risk: low. No gameplay logic changes in this commit beyond triggering a fresh deployment of the already-fixed route code.

## 2026-04-17
- Auth: production now fails fast when `JWT_SECRET` is missing instead of silently falling back to the known development secret. This closes a session-forgery risk and makes misconfiguration obvious during deploy/startup.
