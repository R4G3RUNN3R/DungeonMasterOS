# D&D 5e Profile Differences — 2014 vs Revised 2024

This file is a guardrail. If a rule listed here differs, no shared helper may choose a behavior without receiving an explicit profile id.

## Profile ids

- `dnd5e-2014` — SRD 5.1 generation
- `dnd5e-2024` — SRD 5.2.x revised generation

## Character origin

### 2014

- Race is a primary character-creation rules object.
- Racial traits include the ability-score adjustments provided by the selected race/subrace/source.
- Background provides skill/tool/language/equipment/feature-style benefits according to source, but is not the general core location of ability-score adjustments.

### 2024

- Origin consists of Background + Species + languages.
- Background supplies the standard ability-score adjustment choice for core character creation.
- Species supplies species traits, size and speed rather than the standard background ability adjustment.

Do not apply both 2014 racial ASIs and 2024 background ASIs to one character unless a deliberate conversion/source rule says so.

## Core ancestry catalogue shape

### 2014 SRD profile

Uses the 2014 race/subrace model.

### 2024 SRD profile

Uses the species model. SRD 5.2.1 includes:

- Dragonborn
- Dwarf
- Elf
- Gnome
- Goliath
- Halfling
- Human
- Orc
- Tiefling

Half-Elf and Half-Orc are not part of the revised SRD core species list.

## Backgrounds

### 2014 SRD

The public SRD deliberately exposes only a limited sample background. Additional owned/licensed backgrounds are source packs.

### 2024 SRD

The SRD includes multiple backgrounds and the revised background object participates directly in ability-score choices and origin feat/proficiency/equipment rules.

## Class progression and subclasses

Class tables and feature timing are profile-specific.

The 2024 rules generally standardize subclass selection at class level 3, while the 2014 rules select subclasses/archetypes at class-specific levels. Do not create one universal `subclassLevel = 3` helper for both profiles.

## Feats / ASIs

Both profiles use level-based class opportunities for ability increases/feats, but eligibility, feat categories/prerequisites and origin-feat behavior differ.

The player always chooses. The rules engine only grants and validates the entitlement.

## Proficiency

Both profiles share the familiar character-level Proficiency Bonus progression:

- levels 1-4: +2
- 5-8: +3
- 9-12: +4
- 13-16: +5
- 17-20: +6

Expertise/doubling and individual feature interactions must still use the selected profile/source.

## XP advancement

The standard cumulative XP thresholds through level 20 are shared by the SRD profiles. XP is based on total character level rather than one class's level.

## Weapon Mastery

### 2014

No revised Weapon Mastery subsystem in the core profile.

### 2024

Weapon Mastery is a first-class subsystem used by several classes and equipment entries. The rules state must track current mastery entitlements/choices separately from mere weapon proficiency.

## Grappling / shoving

### 2014

Core grappling/shoving uses special contests built from Strength (Athletics) versus the defender's Strength (Athletics) or Dexterity (Acrobatics), with the profile's size/movement restrictions.

### 2024

Grappling/shoving is integrated with the revised Unarmed Strike and saving-throw/DC framework, and the Grappled condition/glossary is rewritten.

Never call the 2014 contest resolver for a 2024 campaign.

## Surprise

### 2014

Surprise creates the 2014 turn/reaction restrictions for a surprised creature at the start of combat.

### 2024

A surprised creature has Disadvantage on Initiative rather than receiving the old 2014 surprised-turn package.

## Exhaustion

### 2014

Six cumulative levels with a different effect at each level, culminating in death at level 6.

### 2024

Six cumulative levels:

- D20 Tests receive a penalty equal to 2 x Exhaustion level.
- Speed is reduced by 5 ft. x Exhaustion level.
- level 6 means death.

The two models are mechanically incompatible.

## Carrying / encumbrance

### 2014

Default carrying capacity is Strength x 15 lb. with size scaling, plus an optional variant encumbrance subsystem.

### 2024

The core carrying table explicitly varies multipliers by size and handles pushing/dragging/lifting in the revised glossary/rules format.

Campaign configuration must state whether optional/variant encumbrance is enabled when relevant.

## Class spellcasting

Both profiles use class-specific spell preparation/known rules and shared multiclass-slot concepts, but revised class tables, prepared-spell counts, class features and several individual spell rules differ.

Prepared/known choices must remain associated with the class/profile/source that grants them.

## Multiclass spell slots

Do not reuse one formula without profile metadata. The revised profile changes some class participation/rounding details relative to older assumptions and must be implemented from its own multiclass table/rules.

## Conditions and glossary

Many familiar condition names exist in both profiles, but wording and interactions can change. Condition ids should therefore resolve through the selected rules profile rather than a single timeless global dictionary.

## Equipment and actions

The revised profile introduces/changes several action terms, item properties and mastery hooks. Equipment data must be tagged with the rules profile/source pack that defines its mechanics.

## Migration rule

A character imported from one profile into another is a conversion, not a normal load operation.

Never silently reinterpret:

- race/species
- background ASIs
- feats
- subclass timing
- class features
- spells
- weapon mastery
- conditions

under the other profile.
