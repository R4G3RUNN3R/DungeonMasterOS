# D&D 3.5 Character Core v2 — Acceptance Vectors

These vectors are intentionally implementation-agnostic. Claude should run them against the LIVE implementation and the REFERENCE implementation, then keep the stronger/correct behavior.

A type or UI label does not count as passing. The runtime calculation/persistence path must produce the expected result.

## 1. Ability modifiers

- score 3 -> -4
- score 8 -> -1
- score 9 -> -1
- score 10 -> 0
- score 11 -> 0
- score 12 -> +1
- score 18 -> +4

## 2. Core racial adjustments

Starting base scores: STR 14, DEX 12, CON 14, INT 10, WIS 10, CHA 10.

Dwarf final permanent scores before level increases:

- STR 14
- DEX 12
- CON 16
- INT 10
- WIS 10
- CHA 8

Half-Orc with base INT 3:

- STR +2
- INT would mathematically become 1, but starting INT must remain 3
- CHA -2

Human:

- no ability adjustment
- one extra 1st-level feat entitlement
- +4 skill points at character level 1
- +1 skill point at later character levels

No automatic feat may be chosen by Claude.

## 3. Small size

A Small Gnome/Halfling before other effects:

- attack size modifier +1
- AC size modifier +1
- grapple size modifier -4
- Hide size modifier +4
- biped carrying multiplier x0.75

These must be mechanics, not descriptive text.

## 4. Multiclass BAB

Fighter 2 / Rogue 2:

- Fighter 2 BAB = +2
- Rogue 2 BAB = +1
- total BAB = +3

Fighter 6 / Rogue 6:

- Fighter 6 BAB = +6
- Rogue 6 BAB = +4
- total BAB = +10
- base full-attack iteratives = +10/+5

Do not use one combined fractional progression unless the campaign explicitly enables a variant rule.

## 5. Multiclass base saves

Fighter 2 / Rogue 2 core base saves:

- Fortitude +3
- Reflex +3
- Will +0

Each class progression is calculated separately and summed.

## 6. Standard XP thresholds

Expected cumulative XP:

- level 1: 0
- level 2: 1,000
- level 3: 3,000
- level 4: 6,000
- level 5: 10,000
- level 10: 45,000
- level 20: 190,000

A level-up transaction must reject a new level when the character does not have enough XP unless an explicit admin/migration override exists.

## 7. Skill-point budgets

Human Fighter 1 with INT 12:

- Fighter base = 2
- INT modifier = +1
- 3 points/level
- first level x4 = 12
- Human first-level bonus = +4
- total = 16

Dwarf Fighter 1 with INT 12:

- total = 12

At later Human Fighter levels with the same INT:

- 2 base +1 INT +1 Human = 4 points

Minimum skill points from class+INT before racial bonus is 1 per level, or 4 at first level.

## 8. Skill costs and caps

Character level 1:

- class-skill cap = 4 ranks
- cross-class cap = 2 ranks
- class skill costs 1 point per rank
- cross-class skill costs 2 points per rank

If a skill is a class skill for ANY class the character possesses, use the class-skill maximum-rank cap even when a later purchasing class treats it as cross-class. Cost for that level still depends on the class being advanced.

Swim:

- Armor Check Penalty applies twice.

## 9. HP and Constitution propagation

Fighter 2:

- level 1 Hit Die result = 10
- level 2 player HP roll = 6
- CON 14, modifier +2
- max HP = 12 + 8 = 20

If a permanent ability increase/effect later changes permanent CON to 16, modifier becomes +3 and max HP becomes:

- 13 + 9 = 22

The increase applies per Hit Die/character level. It is not only applied to future levels.

Temporary Constitution effects must follow their own effect rules and must not rewrite the historical HP rolls.

## 10. Carrying capacity

STR 10 Medium biped:

- light 33 lb.
- medium 66 lb.
- heavy 100 lb.
- lift off ground 200 lb.
- push/drag 500 lb.

STR 10 Small biped:

- heavy 75 lb.

STR 10 Large biped:

- heavy 200 lb.

Do NOT use 5e `STR x 15` carrying capacity for a 3.5e campaign.

## 11. Movement

Human with 30-ft. speed wearing medium/heavy armor:

- reduced core movement = 20 ft. where applicable

Dwarf base speed:

- 20 ft.
- remains 20 ft. under armor and medium/heavy encumbrance under the dwarf racial movement rule

Human Barbarian 1, light armor, light load:

- speed 40 ft.

Human Barbarian 1, medium armor, light load:

- Fast Movement still exists because armor is not heavy
- modified 40-ft. speed is subject to medium-armor movement reduction -> 30 ft.

Human Monk 3, no armor, light load:

- speed 40 ft.

Human Monk 3, no armor, medium load:

- monk Fast Movement is lost
- normal medium-load movement applies -> 20 ft.

## 12. Dwarf conditional rules

Do NOT put these permanently into unconditional totals:

- +2 racial Fortitude/save bonus against poison
- +2 racial save bonus against spells/spell-like abilities
- +1 attack against appropriate orc/goblinoid targets
- +4 dodge AC against creatures of the Giant type
- +4 stability against bull rush/trip while grounded

The resolver must receive the relevant rule context.

## 13. Halfling saves/fear

Halfling unconditional saving throws:

- +1 racial bonus to all saves

Against fear:

- additional +2 morale bonus

The fear-only bonus must not be baked into normal saves.

## 14. Typed bonus stacking

Two active effects:

- Cloak A: +1 resistance Fortitude
- Spell B: +2 resistance Fortitude

Expected resistance contribution:

- +2, not +3

Two dodge bonuses:

- +1 dodge AC
- +2 dodge AC

Expected dodge contribution:

- +3

Two penalties from independent sources:

- -1
- -2

Expected total penalty:

- -3

The same item/effect adapted twice must be deduplicated by stable source/modifier identity.

## 15. Spell DC

1st-level spell with casting ability 16:

- ability modifier +3
- save DC = 10 + 1 + 3 = 14 before other modifiers

Never use the 5e `8 + proficiency + ability` formula in 3.5e.

## 16. Bonus spells

Casting ability 16, modifier +3:

- +1 bonus 1st-level slot
- +1 bonus 2nd-level slot
- +1 bonus 3rd-level slot
- no bonus 4th-level slot

Character must still meet the minimum ability score of 10 + spell level to cast that spell level.

## 17. Wizard 1

Wizard 1, INT 16:

- base 0-level slots 3
- base 1st-level slots 1
- bonus 1st-level slot +1
- total 1st-level slots 2

Spellbook entitlement:

- all legal 0-level wizard spells except prohibited schools
- 3 chosen 1st-level spells
- +3 additional chosen 1st-level spells from INT bonus
- total chosen starting 1st-level spellbook entries = 6

The player chooses those spells.

## 18. Bard/Sorcerer known-spell replacement

Sorcerer optional replacement is offered at class level 4 and each even Sorcerer class level thereafter.

Bard optional replacement is offered at class level 5 and every third Bard class level thereafter.

It is optional and player-controlled.

## 19. Paladin derived mechanics

Paladin 2, CHA 14:

- Divine Grace adds +2 to Fortitude, Reflex and Will
- Lay on Hands daily pool = 2 x 2 = 4 hp

Paladin 4, CHA 14:

- Turn Undead uses/day = 3 + CHA mod = 5
- effective cleric level for turning = 1

Paladin class/alignment/code restrictions must be validated independently of roleplay-XP rewards.

## 20. Monk AC

Monk 5, WIS 16, no armor, no shield, light load:

- Wisdom contribution +3
- Monk class AC bonus +1
- both apply to normal AC, touch AC and flat-footed AC under the class rule

The bonuses must be disabled when the monk is not eligible, including armor/shield or medium/heavy load.

## 21. Daily class resources

Barbarian Rage uses/day:

- Barbarian 1 = 1
- Barbarian 4 = 2
- Barbarian 8 = 3
- Barbarian 12 = 4
- Barbarian 16 = 5
- Barbarian 20 = 6

Bard Bardic Music uses/day:

- equals Bard class level

Cleric Turn/Rebuke Undead uses/day:

- 3 + positive CHA modifier

Druid Wild Shape uses/day follows the class table and elemental uses are tracked separately when gained.

Resources are runtime state. Spending a use must not rewrite the class definition.

## 22. Rage is temporary

Activating Barbarian Rage must create/apply temporary combat/effect state.

It must NOT permanently change:

- base STR
- base CON
- permanent max HP history
- permanent Will save
- permanent AC

Ending Rage removes the temporary modifiers and applies any required post-rage state through the effect/combat system.

## 23. Languages

Race automatic languages are automatic.

High-INT bonus languages are explicit player choices.

Core class expansions must be recognized:

- Cleric may add Abyssal, Celestial, Infernal to legal bonus-language choices
- Druid may add Sylvan
- Wizard may add Draconic
- Druid gains Druidic automatically from the class

Claude must not invent bonus languages.

## 24. Item/effect ruleset isolation

An existing generic `statMods` blob with no D&D 3.5e ruleset tag must NOT be silently interpreted as 3.5e mechanics merely because it contains `stat: ac` or `stat: str`.

A ruleset-tagged D&D 3.5e payload may be adapted.

Ownership/equipped state remains authoritative in the real item table.

Duration/concentration remains authoritative in the real active-effects table.

## 25. Sheet projection

Given complete canonical state plus authoritative runtime item/effect/currency inputs:

- the full D&D 3.5e sheet is populated without manual duplicate editing
- UI does not become the rules authority
- missing permanent player choices remain blank/unresolved
- legacy `rulesProfile` may be used only as migration/fallback evidence

## 26. AI context

Claude receives trusted compact facts such as:

- race/classes/level/XP
- HP
- ability scores/modifiers
- BAB/iteratives/grapple
- saves
- trained skills/ranks
- feats
- class/racial features
- equipped items
- active effects
- spell/resource state

Claude does NOT receive raw arbitrary `characterData` as if it were mechanically trusted.

## 27. Level-up agency

At level-up the engine may calculate entitlements but must not choose:

- next class/multiclass level
- HP roll
- feat
- skill ranks
- ability increase
- domains
- favored enemy
- combat style
- companion/familiar details
- known spells
- wizard spellbook additions
- any other permanent option

A level commit with missing required choices must fail.

## 28. Multiclass XP penalty

Core favored-class behavior must be supported as a campaign rules policy.

Examples:

- Dwarf Fighter 5 / Wizard 1: Fighter is favored and ignored for the imbalance check; no penalty from that pair.
- Human Fighter 5 / Rogue 1: highest class can act as favored under the Human `Any` rule; no penalty from that pair.
- Elf Fighter 5 / Rogue 1 with neither class favored: the under-level class is out of balance and produces the applicable core penalty.

Prestige classes/source-pack classes must carry explicit metadata for whether they participate in this check.

## 29. Idempotent XP and level transactions

Sending the same validated XP event twice with the same `eventKey`:

- must award XP exactly once

Retrying the same level commit:

- must not create a duplicate level
- must not grant duplicate feats/spells/HP

This requires persistence-level uniqueness/revision checks, not just UI disabling.

## 30. Snapshot / rewind

After a campaign snapshot:

1. award XP
2. gain a level
3. choose a feat
4. gain an item
5. apply a temporary effect
6. restore the earlier snapshot

The restored campaign must not retain orphaned post-snapshot progression, inventory or effects unless the snapshot policy explicitly says those systems are excluded.

Test the live implementation's actual snapshot scope before migration.

## 31. 5e contamination guard

For a `dnd35-core` campaign, the execution path must never call the old 5e `computedStats.ts` cascade for authoritative values.

A test should fail if a 3.5e character receives:

- proficiency bonus
- 5e six-ability saving-throw proficiency logic
- 5e 18-skill mapping
- 5e carrying capacity STR x15
- 5e spell-save DC formula

## 32. No silent legacy guessing

Import a legacy character with race/class/HP but no recorded feat choice.

Expected:

- migration preserves known facts
- missing feat remains unresolved
- migration log records the missing permanent choice

Forbidden:

- Claude picks a feat to make the sheet complete
