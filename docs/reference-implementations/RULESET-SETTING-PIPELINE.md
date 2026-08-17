# DungeonMasterOS Ruleset & Setting Expansion Pipeline

Status: locked queue after D&D 3.5e and D&D 5e reference cores

## Critical distinction

A **rules engine** defines character/mechanical truth.
A **setting overlay/source pack** defines compatible world/content rules on top of a specific engine/profile.

Examples:

- D&D 3.5e = rules engine
- D&D 5e 2014 = rules profile
- revised D&D 5e 2024 = distinct rules profile
- Ravenloft = D&D setting/source overlay tied to a specific edition
- Pathfinder 1e = rules engine
- Pathfinder 2e = separate rules engine
- Call of Cthulhu = separate edition-specific rules engine
- Vampire: The Masquerade = separate edition-specific rules engine
- Werewolf: The Apocalypse = separate edition-specific rules engine

Never mix editions because names look related.

## Source discovery order

For every new engine/setting:

1. Search the user's connected Google Drive for owned books/files.
2. Use official publisher SRD/Creative Commons/ORC/OGL/open rules sources.
3. Use official publisher rules, errata, FAQ and lawful public previews.
4. Use licensed databases/providers where available.
5. Use reputable secondary/community references only to corroborate gaps, cross-checked against primary/open sources.

Do not bypass paywalls or use cracked/pirated book dumps. Missing local books do not block lawful online research.

Each implementation gets a `SOURCES.md` recording edition/version, publisher, source type, mechanics used, licensing/provenance and errata decisions.

## Standard reference branch/folder pattern

Branch:
`reference/<ruleset-id>-core-v1`

Folder:
`docs/reference-implementations/<ruleset-id>-core-v1/`

Every rules-engine reference should contain equivalents of:

- README / source inventory / edition-difference guardrails
- canonical domain state
- creation
- advancement
- permanent player-choice entitlements
- races/species/ancestries/backgrounds/classes/archetypes as applicable
- skills/attributes/defenses
- combat
- health/damage/death
- equipment
- conditions/effects
- powers/spells/resources
- multiclass/archetype/prestige progression when that system actually uses it
- read-only sheet model/projector
- trusted AI context
- item/effect adapters
- server transactions/idempotency
- schema/migration proposal
- exhaustive test vectors
- Claude live-server reconciliation instructions

## Queue

### 1. D&D 3.5e core

Branch: `reference/dnd35-character-core-v2`

Then optional source packs for owned 3.5e books:

- prestige classes
- extra base classes
- races/subraces/templates
- feats/spells/domains
- equipment/magic items
- psionics/alternate subsystems
- campaign settings

Prestige classes remain first-class 3.5e progression with prerequisites. Do not transplant them into 5e merely for symmetry.

### 2. D&D 5e

Branch: `reference/dnd5e-character-core-v1`

Profiles:
- `dnd5e-2014`
- `dnd5e-2024`

Commercial/non-SRD owned options use private/licensed source packs rather than public-repo copying.

### 3. D&D setting overlays

Inventory Drive and online lawful sources for each edition-specific setting, including when available:

- Ravenloft / Domains of Dread
- Forgotten Realms
- Eberron
- Greyhawk
- Planescape
- Spelljammer
- Dragonlance
- Dark Sun
- Plane Shift settings such as Innistrad
- any other D&D settings found in owned files

Each overlay explicitly declares compatible D&D profile(s) and can contribute setting character options, factions, religions, languages, calendars, locations, monsters, equipment, horror/corruption/domain mechanics, and source-policy constraints.

### 4. Pathfinder

#### Pathfinder 1e

Separate engine, not `D&D 3.5 + patches`.

Research/build:
- races
- classes
- archetypes
- prestige classes
- favored class bonuses
- skills
- feats
- traits
- BAB/saves
- CMB/CMD
- spells
- equipment
- conditions
- XP/advancement
- full sheet/AI/runtime integration

Use Paizo's lawful open rules ecosystem and owned books.

#### Pathfinder 2e

Separate engine/profile.

Research/build its actual mechanics:
- ancestry/heritage
- background
- class
- archetypes
- ancestry/class/general/skill feats
- proficiency ranks
- four degrees of success
- three-action economy
- conditions
- dying/wounded
- spell traditions
- remaster/source-version distinctions

Never use PF1 mechanics as fallback.

### 5. Call of Cthulhu

Identify exact owned/target edition first.

Implement its actual engine, including as applicable:
- characteristics
- percentile skills
- regular/hard/extreme success
- bonus/penalty dice
- pushed rolls
- Luck
- Sanity/Mythos
- bouts/insanity
- occupations/credit rating
- HP/damage
- fighting back/dodge
- firearms
- chases
- investigator improvement
- magic
- investigator sheet and AI context

Do not reuse D&D level/class/AC assumptions.

### 6. World of Darkness / Storyteller-family games

Inventory each game and edition separately.

Potential lines if found/targeted:
- Vampire: The Masquerade
- Werewolf: The Apocalypse
- Mage
- Hunter
- Wraith
- Changeling
- other related systems present in owned files

Edition identity is mandatory. For example:
- Vampire V20 != Vampire V5
- Werewolf W20 != Werewolf W5

Build the actual edition's dice pools, attributes/skills, supernatural traits/resources, advancement, damage/willpower, morality/humanity/renown systems and character sheet rather than forcing them into D&D-shaped fields.

### 7. Everything else found in Drive

Run a systematic library inventory after the named queue.

For every probable RPG book:
1. title
2. game line
3. edition/version
4. publisher
5. type: core rules / expansion / setting / adventure / bestiary / equipment / lore
6. duplicate/older edition grouping
7. lawful online/open reference availability
8. implementation priority

Possible examples include Warhammer RPG lines, Cyberpunk, Shadowrun, Star Wars RPGs, superhero systems, generic systems, or other titles actually present in the user's library.

Do not add a system only because we recognize its name. Add it when source inventory or product goals establish it.

## Universal DungeonMasterOS layer

Only extract abstractions that are genuinely common after multiple engines exist:

- RulesetProfile
- CharacterRulesState
- CharacterChoiceEntitlement
- CharacterSheetProjection
- RulesSourcePolicy
- RulesEvent / RulesTransaction
- Item/Effect adapter
- AI character context
- validation result

Do NOT assume every game has:
- classes
- levels
- AC
- six D&D abilities
- d20 checks
- spell slots

The shared interface must allow those concepts not to exist.

## Product systems that remain ruleset-independent

These live above the mechanical engines and should work across games:

- persistent canon/memory
- NPC knowledge
- relationships/reputation
- emergent titles
- achievements/account rewards
- journals/recaps
- factions/world time
- secrets/player visibility
- validated state-change transactions
- multiplayer/campaign ownership

The selected rules engine owns mechanics. The shared campaign platform owns persistent world continuity.
