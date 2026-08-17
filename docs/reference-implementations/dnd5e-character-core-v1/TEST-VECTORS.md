# D&D 5e Character Core v1 — Acceptance Vectors

Passing means the runtime writer/calculator/persistence path behaves correctly. A type, label or unused helper does not count.

## A. Profile isolation

1. Every character state has exactly one explicit profile: `dnd5e-2014` or `dnd5e-2024`.
2. A 2014 character cannot consume a 2024-only Weapon Mastery mechanic without an explicit conversion/source rule.
3. A 2024 character cannot receive 2014 racial ASIs in addition to revised background ASIs.
4. An item/effect payload tagged `dnd5e-2014` is rejected/ignored as mechanics in `dnd5e-2024`, and vice versa.
5. Migration with ambiguous edition is marked unresolved, not guessed.

## B. Shared mathematical core

6. Ability modifiers: 8 -> -1, 10 -> 0, 12 -> +1, 18 -> +4, 20 -> +5.
7. Proficiency bonus: level 1 +2, 5 +3, 9 +4, 13 +5, 17 +6.
8. Standard XP thresholds include level 2 300, level 5 6,500, level 10 64,000, level 20 355,000.
9. Standard point buy spends 27 points maximum and only buys scores 8-15 before origin adjustments.
10. Spell save DC = 8 + PB + casting ability modifier + explicit modifiers.
11. Spell attack = PB + casting ability modifier + explicit modifiers.
12. One source of Advantage plus one source of Disadvantage resolves to a normal d20 roll regardless of source count.

## C. Origin / Race / Species

13. 2014 Hill Dwarf applies CON +2, WIS +1 before level ASIs.
14. 2014 Human applies +1 to all six abilities.
15. 2014 Half-Elf applies CHA +2 and requires two different +1 non-CHA choices.
16. 2014 High Elf cantrip is an explicit player choice.
17. 2014 Dragonborn ancestry is an explicit player choice and controls breath/resistance.
18. 2024 Species does not supply the standard +2/+1 origin ASI.
19. 2024 Background ASI must be +2/+1 to two listed abilities OR +1/+1/+1 to all three listed abilities.
20. 2024 Human requires explicit size, skill and Origin feat choices.
21. 2024 Elf requires explicit lineage, lineage casting ability and Keen Senses skill choice.
22. 2024 Gnome requires lineage/casting-ability choices.
23. 2024 Tiefling requires size, legacy and casting-ability choices.
24. Missing permanent origin choices block creation; Claude does not fill them.

## D. Background profile differences

25. 2014 SRD Acolyte grants its 2014 skills/languages/feature package; it does not grant a 2024 Origin feat or background ASI.
26. 2024 Acolyte grants its revised ability options, skills/tool, Magic Initiate (Cleric) Origin feat and revised equipment package.
27. 2024 Criminal/Sage/Soldier resolve their own revised Origin feat and tool/skill packages.
28. Commercial 2014 backgrounds absent from the public SRD are loaded only from enabled owned/licensed source packs, not invented from names.

## E. Subclass timing

29. 2014 Cleric chooses domain at Cleric 1; 2024 Cleric chooses subclass at Cleric 3.
30. 2014 Sorcerer chooses origin at Sorcerer 1; 2024 Sorcerer chooses subclass at Sorcerer 3.
31. 2014 Warlock chooses patron at Warlock 1; 2024 Warlock chooses subclass at Warlock 3.
32. 2014 Wizard chooses tradition at Wizard 2; 2024 Wizard chooses subclass at Wizard 3.
33. 2014 Druid chooses circle at Druid 2; 2024 Druid chooses subclass at Druid 3.
34. A level commit with a required subclass missing fails.
35. A level commit that selects a subclass too early fails.

## F. Class progression / resources

36. Fighter Extra Attack: 2 attacks at Fighter 5, 3 at Fighter 11, 4 at Fighter 20. Multiclassing two classes with Extra Attack does not add the features together.
37. 2024 Fighter Weapon Mastery entitlements progress from class table and are explicit selections.
38. 2014 Fighter has no core Weapon Mastery entitlement.
39. 2024 Barbarian Rage uses follow revised table; 2014 level-20 unlimited Rage is represented explicitly in production, not literally as a finite 99.
40. Bard Inspiration uses derive from Charisma and correct rest refresh by class level/profile.
41. Sorcery Points equal Sorcerer level once gained.
42. Monk Ki/Focus points equal Monk level once gained; naming/profile stays edition-correct.
43. Paladin Lay on Hands pool = 5 x Paladin level.
44. 2024 Ranger free Hunter's Mark uses follow revised class table; 2014 Ranger does not receive that revised resource.
45. Warlock Pact Magic slots remain a separate pool from multiclass Spellcasting slots.
46. Resource spending changes runtime current uses, never class definitions.

## G. Multiclassing

47. To multiclass, validate prerequisites for BOTH currently held class(es) and target class.
48. First class grants full starting proficiencies; a new multiclass grants only the multiclass package.
49. 2014 Paladin/Ranger levels contribute floor(classLevel/2) to multiclass caster level.
50. 2024 Paladin/Ranger levels contribute ceil(classLevel/2) to multiclass caster level.
51. Warlock Pact Magic does not contribute slots to the combined Spellcasting table.
52. Source-pack one-third casters register their contribution explicitly; core never guesses based on class name.

## H. Spellcasting

53. 2014 Ranger spellcasting starts at Ranger 2 and uses known spells.
54. 2024 Ranger spellcasting starts at Ranger 1 and uses revised prepared-spell progression.
55. 2014 Paladin spellcasting starts at Paladin 2; 2024 starts at Paladin 1.
56. 2014 Bard/Sorcerer/Warlock use known-spell progressions from their profile.
57. Revised 2024 Bard/Sorcerer/Warlock use revised prepared counts as defined by their class tables.
58. Wizard 1 receives a spellbook entitlement for six level-1 spells; later Wizard levels add two legal spells.
59. Prepared spell state and spell slots are different state. Spending a slot does not remove a prepared spell.
60. A spell not legal for the class/profile/enabled source is rejected even if Claude suggests it.
61. Concentration damage save DC is max(10, floor(damage/2)).
62. Becoming Incapacitated ends concentration.
63. Starting concentration on another effect ends the prior concentration effect.

## I. Armor / AC

64. Unarmored baseline AC = 10 + DEX mod.
65. Light armor uses full DEX; medium caps at +2 by default; heavy ignores DEX; shield adds +2.
66. Barbarian Unarmored Defense = 10 + DEX + CON and can use shield.
67. Monk Unarmored Defense = 10 + DEX + WIS and requires no armor/shield.
68. 2014 Draconic Bloodline unarmored AC = 13 + DEX.
69. 2024 Draconic Sorcery unarmored AC = 10 + DEX + CHA.
70. Multiple AC formulas do not stack; choose one valid formula, then add legal modifiers such as shield only when that formula allows it.
71. Wearing armor without required training/proficiency prevents spellcasting and imposes the selected profile's correct D20 penalties.
72. Heavy armor Strength requirement reduces speed by 10 ft. when unmet.

## J. Weapons / attacks

73. Melee normally uses STR; ranged normally uses DEX; Finesse chooses the better legal STR/DEX; thrown uses the weapon's normal attack ability.
74. Proficient weapon attack includes PB; unproficient does not.
75. 2014 Small creature using Heavy weapon has Disadvantage.
76. 2024 Heavy melee weapon requires STR 13 for normal attack rolls; Heavy ranged weapon requires DEX 13.
77. 2024 mastery property does nothing unless the character has selected mastery for that weapon.
78. 2014 weapon records do not have revised mastery properties.
79. 2014 Lance is 1d12; revised 2024 Lance is 1d10 and uses its revised properties.
80. Revised 2024 Trident is 1d8/1d10 versatile; 2014 Trident is 1d6/1d8.
81. Weapon/profile catalogue mismatch does not silently reinterpret by name.

## K. Revised Weapon Mastery

82. Cleave, Graze, Nick, Push, Sap, Slow, Topple and Vex remain distinct rule hooks.
83. Nick moves the Light property's extra attack into the Attack action and remains once per turn under its rule.
84. Slow penalties from repeated Slow mastery do not stack.
85. Topple uses its revised Constitution saving throw DC formula.
86. A mastery change is a player choice made only when a class/feat/source permits it.

## L. Surprise

87. 2014 surprise: surprised creature cannot move or take an action on first turn and cannot take a reaction until that turn ends. It does NOT impose revised Initiative Disadvantage.
88. 2024 surprise: Disadvantage on Initiative. It does NOT use the 2014 first-turn action lock.

## M. Grapple / shove

89. 2014 grapple uses STR (Athletics) contested by target STR (Athletics) or DEX (Acrobatics), requires free hand/reach/size legality.
90. 2014 shove uses the corresponding Athletics contest.
91. 2024 grapple is an Unarmed Strike option using a STR/DEX save against DC 8 + attack ability modifier + PB.
92. 2024 shove uses the revised Unarmed Strike save model.
93. Monk/source features that legally substitute Dexterity into the revised Unarmed Strike DC do so explicitly; generic characters do not.

## N. Exhaustion

94. 2014 exhaustion level 1: Disadvantage ability checks.
95. 2014 level 2: speed halved; level 3: attacks/saves Disadvantage; level 4: max HP halved; level 5: speed 0; level 6: death.
96. 2024 exhaustion: D20 Tests receive -2 x exhaustion level, speed loses 5 ft. x level, death at level 6.
97. Never apply both exhaustion models.

## O. Death / healing / rests

98. At 0 HP, damage equal/exceeding max HP causes instant death under the core massive-damage rule.
99. Damage at 0 HP adds one failed death save; a critical hit adds two.
100. Death save natural 20 restores 1 HP; natural 1 counts as two failures; 3 successes stabilize; 3 failures kill.
101. Short Rest is at least 1 hour and permits spending available Hit Dice/Hit Point Dice.
102. 2014 Long Rest restores all HP and up to half total spent Hit Dice, minimum one.
103. Revised 2024 Long Rest restores all HP and all spent Hit Point Dice under the core revised rule.
104. Rest restores only resources whose refresh rule matches; it does not reset arbitrary limited-use effects.

## P. Carrying / movement

105. Default Medium carrying capacity = STR x 15 lb.; push/drag/lift = STR x 30 lb.
106. Size scaling is applied by profile rules.
107. 2014 optional variant encumbrance is enabled only by campaign rule policy; it is not silently always on.
108. Class speed features honor armor/eligibility restrictions.

## Q. Feats

109. 2024 Background Origin feat is a deterministic grant from the background, with any feat-internal choices remaining player-owned.
110. 2024 class ASI levels grant a feat/ASI entitlement under the revised rule; no feat is auto-selected.
111. 2014 feats are optional unless the campaign enables them; if disabled, an ASI opportunity cannot silently become a feat.
112. 2014 public core cannot pretend the SRD Grappler sample is the full commercial PHB feat catalogue.
113. Non-SRD feats load only through an enabled owned/licensed source pack.
114. Feat prerequisites are revalidated at commit time, not trusted because the UI offered the button.

## R. Equipment / attunement

115. Real `items` table remains authoritative for ownership, quantity, equipped and identified state.
116. Mechanical item data must carry matching rules profile/source metadata.
117. Default attunement maximum is 3 before feature-specific exceptions.
118. Same item cannot consume multiple attunement slots.
119. Unattuned attunement-required item does not grant its attunement-only mechanics.

## S. Sheet projection

120. Full sheet is produced from canonical rules state + authoritative items/effects/resources, with no manual duplicate sheet editing.
121. Sheet displays profile explicitly.
122. Sheet shows class/subclass level history, abilities/saves/skills/PB, AC/initiative/speed, HP/death/Hit Dice, attacks, proficiencies, equipment/carrying, features/feats/resources/conditions/exhaustion, spells and attunement.
123. Missing permanent choices remain unresolved; projector never invents them to fill blanks.
124. Current runtime HP/slots/resources/conditions do not overwrite permanent level history.

## T. AI context

125. Claude receives explicit rules profile in mechanical context.
126. Claude receives compact trusted HP/AC/saves/skills/attacks/features/resources/spells/equipment/conditions.
127. Raw arbitrary character JSON is not treated as mechanically trusted.
128. Claude may propose a state change, but server validation owns the write.
129. NPC/world secret data obeys the separate knowledge/visibility system.

## U. Transactions / idempotency

130. Same XP eventKey retried twice awards XP once.
131. Same level eventKey retried twice commits one level only.
132. Stale revision is rejected.
133. Client cannot submit a fake derived AC/PB/spell DC/max HP and make it canonical.
134. Permanent level commit with missing subclass/feat/choice is rejected.
135. XP progression requires threshold unless campaign uses validated milestone mode.
136. WebSocket broadcast occurs only after successful persistence commit.

## V. Snapshot / rewind

137. Snapshot, then gain XP/level/feat/item/effect/spell use; restore snapshot. Post-snapshot canonical/runtimes return to the snapshot policy consistently.
138. Replaying after rewind does not duplicate idempotent XP/achievement/title/rules events.

## W. Legacy migration

139. Legacy `computedStats.ts` totals are evidence, not authority.
140. Old character with no explicit edition is unresolved until reliable campaign/source evidence identifies profile.
141. Missing historical feat/subclass/spell choice is reported, never filled by AI.
142. Old untagged `statMods` are not blindly applied to the new engine.

## X. Cross-ruleset contamination

143. A D&D 3.5e character never receives 5e PB/advantage/6-save/STRx15/spell-DC mechanics.
144. A 5e character never receives 3.5e BAB, Fort/Ref/Will, skill ranks, typed 3.5 bonus stacking or prestige-class progression unless running an explicit conversion/homebrew system.
145. `rulesProfileId` is required at every authoritative mechanical boundary.
