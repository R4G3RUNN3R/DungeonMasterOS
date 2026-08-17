# D&D 5e Full Character Sheet UI Contract

The 5e sheet is a READ-ONLY projection of trusted character/runtime state.

It is not a manual editor and must not become a parallel rules database.

## Route / presentation

Preferred production behavior mirrors the existing 3.5e sheet approach:

- separate resizable character-sheet window/panel
- live refresh from authoritative state
- print-friendly
- no modification of existing campaign gameplay bars
- no permanent giant dashboard covering the narrative experience

The rules profile must be visibly identified:

- `D&D 5e (2014)`
- `D&D 5e (2024 Revised)`

This prevents players/DM from interpreting one edition's numbers under the other edition.

## Header / identity

Display:

- character name
- player name
- rules profile
- Race (2014) or Species (2024)
- subrace/lineage where relevant
- background
- classes and individual class levels
- subclass per class
- total character level
- XP
- next-level XP when XP advancement is active
- alignment/deity when recorded
- size
- inspiration / Heroic Inspiration state where the selected profile uses it

Do not invent unrecorded identity choices.

## Ability / save block

For all six abilities:

- score
- modifier
- saving throw modifier
- saving throw proficiency marker

Do not display six 5e saves on a 3.5e sheet or Fort/Ref/Will on a 5e sheet.

## Core combat block

Display:

- Armor Class
- AC source/formula name
- initiative modifier
- Initiative Advantage/Disadvantage indicators when currently applicable
- speed
- current HP
- maximum HP
- temporary HP
- death save successes/failures
- stable state
- Hit Dice / Hit Point Dice per class and spent/remaining values
- exhaustion level with the selected profile's effect summary
- current conditions

The sheet must not apply both 2014 and 2024 exhaustion/surprise rules.

## Skills

Display all 18 core skills:

- skill name
- governing default ability
- total modifier
- proficiency marker
- Expertise marker

Also display:

- Passive Perception
- Passive Investigation
- Passive Insight

The default ability/skill pairing is a sheet convenience. The rules engine must still support a GM calling for a skill proficiency with a different ability when appropriate.

## Attacks & actions

For equipped/profile-resolved weapons show:

- name
- attack bonus
- damage dice/type
- ability damage modifier
- range
- proficiency
- relevant weapon properties
- number of attacks in the Attack action

2024 only:

- weapon Mastery property
- whether the character currently has mastery selected for that weapon

Do not show a Mastery property as active merely because the weapon possesses one.

For an item without verified profile mechanics:

- show the owned item name
- show that mechanical data is unresolved
- do NOT guess attack/damage from prose/name

## Proficiencies

Display grouped:

- armor training/proficiency
- shield training
- weapon proficiencies
- tools
- languages

Expertise remains attached to the relevant skill/tool proficiency rather than becoming a generic `+PB` modifier.

## Features

Group by source:

### Race/Species

All currently acquired racial/species/lineage features.

### Background

Origin/background feat/feature and tool/skill benefits.

### Class

Feature name + granting class level.

### Subclass

Feature name + subclass level.

### Feats

Acquired feats with source/acquisition level.

Permanent choices remain visible as the player's actual selection, not a recommendation.

## Resources

Show limited-use resources with current/max values where they have a count:

Examples:

- Rage
- Bardic Inspiration
- Channel Divinity
- Wild Shape
- Second Wind
- Action Surge
- Indomitable
- Ki / Focus Points
- Lay on Hands
- Sorcery Points
- Innate Sorcery
- Pact Magic slots
- source-pack feature resources

Refresh information may be shown concisely.

For revised resources with partial Short Rest recovery, do not show/implement a misleading generic `refreshes on short rest` label. Example: some features regain ONE use on Short Rest and all on Long Rest.

## Spellcasting

Separate each spellcasting class.

For each block show:

- casting class
- casting ability
- Spell Save DC
- spell attack bonus
- class level / relevant caster level context
- cantrips
- spell slots by level and usage
- Pact Magic separately from multiclass Spellcasting
- prepared spells
- known spells where profile/class uses known spells
- Wizard spellbook
- always-prepared/domain/oath/subclass spells
- concentration marker for the currently concentrated spell/effect

Do not merge all classes into one spell list merely because multiclass spell slots are shared.

## Inventory / equipment

Use the REAL item system.

Display:

- item name
- quantity
- identified status
- equipped status
- weight when mechanically known
- attunement status
- attunement requirement when known

Show carrying:

- current verified weight
- carrying capacity
- push/drag/lift capacity

2014 optional variant encumbrance should appear only when enabled by campaign rules.

## Attunement

Display current attuned items and used/default available slots.

Do not allow the sheet itself to toggle attunement unless a separate explicit gameplay action/route is intentionally added later.

## Conditions / active effects

Display current conditions and effects with:

- name
- source
- duration/rounds if known
- concentration status
- short concise mechanical summary

The existing `active_effects` system should remain the duration authority.

## Unresolved data

Use a neutral unresolved marker such as `—`.

Never fill missing:

- subclass
- feat
- spell
- skill proficiency
- background choice
- ancestry option
- weapon mastery
- tool/language choice

merely because the UI has an empty box.

## Profile differences visible where useful

Do not bombard players with implementation detail, but expose enough identity to avoid edition confusion.

Examples:

- Race label vs Species label
- Ki vs Focus Points where profile class terminology differs
- 2014 known Ranger spells vs revised prepared Ranger spells
- Weapon Mastery only for revised profile

## Error / validation state

If trusted resolution produces a warning, the sheet may show a small `Rules data needs review` indicator and a diagnostic panel for the owner/GM.

Do not silently hide:

- cross-profile item mechanics
- unresolved migrated choices
- illegal attunement count
- missing required subclass
- untrained armor casting restriction

The diagnostic panel contains factual state/validation results, never chain-of-thought.

## Print

Print layout should include the mechanical sheet but may omit interactive diagnostics and runtime refresh controls.
