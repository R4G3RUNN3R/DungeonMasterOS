# D&D 3.5e Feats Extraction Report (Phase 2B-1, real run: 2026-08-23)

**Scope note, stated explicitly:** every number in this report is a *feat-page* extraction count from one real SRD page. Nothing here claims full mechanical coverage of the D&D 3.5e feat system, and nothing here claims coverage of any other entity family (races, classes, spells, monsters, etc.) — those remain unstarted, per the Phase 2B-1 design doc's explicit scope boundary.

## Headline evidence line

```
extracted 110 real feats from https://www.d20srd.org/srd/feats.htm → 15 fully_structured → 14 partially_structured → 81 unresolved
```

## Content-hash verification (fail-closed drift check)

Before extracting, the real page was re-fetched and its SHA-256 compared against the hash Phase 2A's real acceptance scan recorded for this exact page in `srd_manifest_entries` (`dnd35e-srd-hypertext-d20::/srd/feats.htm`):

```
Content hash verified — extracting from confirmed-current content.
```

Zero drift since Phase 2A's real scan (2026-08-23, earlier the same day) — the page has not changed. Had the hash not matched, extraction would have stopped and reported the drift rather than silently extracting from unverified content, per this whole project's established discipline.

## Real counts

| Metric | Count |
|---|---|
| Total real feats extracted | 110 |
| `fully_structured` (real, computable mechanical effect + no unstructured prerequisite) | 15 |
| `partially_structured` (real, computable mechanical effect exists, but the Benefit text also contains real content the extractor couldn't structure, OR structured prerequisites but an unstructured Benefit) | 14 |
| `unresolved` (no structured mechanical effect could be derived at all) | 81 |
| Real duplicate canonical IDs | 0 |
| Real dangling feat-reference prerequisites (a `{kind:"feat", featCanonicalId:...}` pointing at an ID not itself extracted) | 0 |

**This 86% unresolved/partial rate is the intended, honest result of a deliberately narrow first pass** — this pass structures exactly one mechanical-effect pattern (`"You get a +N bonus on all X checks and Y checks"`, the skill-check-bonus family) and one prerequisite-pattern set (feat references, BAB, ability scores). Every real feat whose Benefit or Prerequisites prose doesn't match those specific patterns is honestly recorded as `unresolved`/`partially_structured` with its real source text preserved in `extractionNotes` — never dropped, never guessed. See "What's needed to close these gaps" below for what a future pass would add.

## Full real gap list (every non-`fully_structured` feat, by name and reason — never just a count)

The complete list below is real data pulled directly from the dev database after the real extraction run — 95 feats, each with its real, honest `extractionNotes`.

<details>
<summary>Click to expand the full 95-feat gap list (canonical ID, status, real reason(s))</summary>

1. **Armor Proficiency (Heavy)** (`partially_structured`) — Benefit is "See Armor Proficiency (light)" (a cross-reference, not a self-contained mechanic).
2. **Armor Proficiency (Light)** (`unresolved`) — real armor-check-penalty mechanic, no pattern covers it.
3. **Armor Proficiency (Medium)** (`partially_structured`) — same cross-reference pattern as Heavy.
4. **Augment Summoning** (`unresolved`) — Prerequisites "Spell Focus (conjuration)" not a covered pattern; Benefit is a real +4 enhancement-bonus mechanic, no covered pattern.
5. **Blind-Fight** (`unresolved`) — real miss-chance-reroll mechanic; Benefit section genuinely has 3 real paragraphs, only the first parsed (disclosed).
6. **Brew Potion** (`unresolved`) — Prerequisites "Caster level 3rd" not covered; real item-creation mechanic across 3 real paragraphs, only first parsed (disclosed).
7. **Cleave** (`unresolved`) — Prerequisites "Str 13, Power Attack" (mixed ability+feat clause, not covered); real extra-attack mechanic not covered.
8. **Combat Casting** (`unresolved`) — real +4 Concentration-check mechanic, not the covered skill-bonus pattern (targets a check type, not two named skills).
9. **Combat Expertise** (`partially_structured`) — real AC-tradeoff mechanic, not covered.
10. **Combat Reflexes** (`unresolved`) — real Dex-bonus-additional-AoO mechanic; 2 real paragraphs, only first parsed (disclosed).
11. **Craft Magic Arms And Armor** (`unresolved`) — "Caster level 5th" prereq not covered; real item-creation mechanic, 3 paragraphs (disclosed).
12. **Craft Rod** (`unresolved`) — "Caster level 9th" not covered; 2 paragraphs (disclosed).
13. **Craft Staff** (`unresolved`) — "Caster level 12th" not covered; 3 paragraphs (disclosed).
14. **Craft Wand** (`unresolved`) — "Caster level 5th" not covered; 2 paragraphs (disclosed).
15. **Craft Wondrous Item** (`unresolved`) — "Caster level 3rd" not covered; 3 paragraphs (disclosed).
16. **Deflect Arrows** (`unresolved`) — "Dex 13, Improved Unarmed Strike" mixed clause not covered; 2 paragraphs (disclosed).
17. **Diehard** (`partially_structured`) — real stabilization mechanic; 3 paragraphs (disclosed).
18. **Dodge** (`partially_structured`) — real +1 dodge-vs-designated-opponent mechanic; 2 paragraphs (disclosed).
19. **Empower Spell** (`unresolved`) — real metamagic mechanic; 2 paragraphs (disclosed).
20. **Endurance** (`unresolved`) — real multi-check bonus mechanic spanning 7 different check/save types, not the covered two-skill pattern.
21. **Enlarge Spell** (`unresolved`) — real metamagic range-doubling mechanic; 2 paragraphs (disclosed).
22. **Eschew Materials** (`unresolved`) — real material-component-waiver mechanic.
23. **Exotic Weapon Proficiency** (`unresolved`) — "Base attack bonus +1 (plus Str 13 for...)" conditional prereq not covered.
24. **Extend Spell** (`unresolved`) — real metamagic duration-doubling mechanic.
25. **Extra Turning** (`unresolved`) — "Ability to turn or rebuke creatures" prereq not covered; 2 paragraphs (disclosed).
26. **Far Shot** (`partially_structured`) — real range-increment mechanic.
27. **Forge Ring** (`unresolved`) — "Caster level 12th" not covered; 3 paragraphs (disclosed).
28. **Great Cleave** (`unresolved`) — 4-clause mixed prereq not covered; cross-references Cleave.
29. **Great Fortitude** (`unresolved`) — real +2 Fortitude-save mechanic — a single-skill-family save bonus, not the covered two-*skill* pattern (saves are a different check family in this pass's scope).
30. **Greater Spell Focus** (`unresolved`) — real DC-bonus mechanic.
31. **Greater Spell Penetration** (`partially_structured`) — real caster-level-check bonus mechanic.
32. **Greater Two-Weapon Fighting** (`unresolved`) — 4-clause mixed prereq not covered.
33. **Greater Weapon Focus** (`unresolved`) — 3-clause mixed prereq (proficiency/feat/class-level) not covered.
34. **Greater Weapon Specialization** (`unresolved`) — 5-clause mixed prereq not covered.
35. **Heighten Spell** (`unresolved`) — real metamagic level-increase mechanic.
36. **Improved Bull Rush** (`unresolved`) — "Str 13, Power Attack" not covered.
37. **Improved Counterspell** (`unresolved`) — real counterspell-school mechanic.
38. **Improved Critical** (`unresolved`) — "Proficient with weapon, base attack bonus +8" mixed clause not covered.
39. **Improved Disarm** (`unresolved`) — "Int 13, Combat Expertise" not covered.
40. **Improved Familiar** (`unresolved`) — real multi-condition prereq ("Ability to acquire..., compatible alignment, sufficiently high level") not covered; 3 paragraphs (disclosed).
41. **Improved Feint** (`unresolved`) — "Int 13, Combat Expertise" not covered.
42. **Improved Grapple** (`unresolved`) — "Dex 13, Improved Unarmed Strike" not covered.
43. **Improved Initiative** (`unresolved`) — real +4 initiative mechanic (a single-roll-type bonus, not the covered two-skill pattern).
44. **Improved Overrun** (`unresolved`) — "Str 13, Power Attack" not covered.
45. **Improved Precise Shot** (`unresolved`) — "Dex 19, Point Blank Shot, Precise Shot, base attack bonus +11" not covered; 2 paragraphs (disclosed).
46. **Improved Shield Bash** (`partially_structured`) — real shield-bash-AC mechanic.
47. **Improved Sunder** (`unresolved`) — "Str 13, Power Attack" not covered; 2 paragraphs (disclosed).
48. **Improved Trip** (`unresolved`) — "Int 13, Combat Expertise" not covered; 2 paragraphs (disclosed).
49. **Improved Turning** (`unresolved`) — "Ability to turn or rebuke creatures" not covered.
50. **Improved Two-Weapon Fighting** (`unresolved`) — "Dex 17, Two-Weapon Fighting, base attack bonus +6" not covered.
51. **Improved Unarmed Strike** (`unresolved`) — real armed-when-unarmed mechanic; 2 paragraphs (disclosed).
52. **Iron Will** (`unresolved`) — real +2 Will-save mechanic (same single-save-type gap as Great Fortitude).
53. **Leadership** (`unresolved`) — "Character level 6th" not covered; real cohort/follower-table mechanic not covered.
54. **Lightning Reflexes** (`unresolved`) — real +2 Reflex-save mechanic (same single-save-type gap).
55. **Manyshot** (`unresolved`) — "Dex 17, Point Blank Shot, Rapid Shot, base attack bonus +6" not covered; 3 paragraphs (disclosed).
56. **Martial Weapon Proficiency** (`unresolved`) — real attack-roll-normally mechanic.
57. **Maximize Spell** (`unresolved`) — real metamagic maximize mechanic; 2 paragraphs (disclosed).
58. **Mobility** (`unresolved`) — "Dex 13, Dodge" not covered; 2 paragraphs (disclosed).
59. **Mounted Archery** (`unresolved`) — "Ride 1 rank, Mounted Combat" (reversed skill-rank phrasing, a known, deliberately-left-unstructured pattern — see design notes) not covered.
60. **Mounted Combat** (`unresolved`) — "Ride 1 rank" (same reversed phrasing) not covered.
61. **Natural Spell** (`unresolved`) — "Wis 13, wild shape ability" mixed clause not covered; 2 paragraphs (disclosed).
62. **Point Blank Shot** (`unresolved`) — real ranged attack/damage bonus mechanic.
63. **Power Attack** (`partially_structured`) — real attack-for-damage tradeoff mechanic.
64. **Precise Shot** (`partially_structured`) — real melee-penalty-waiver mechanic.
65. **Quick Draw** (`partially_structured`) — real free-action-draw mechanic; 2 paragraphs (disclosed).
66. **Quicken Spell** (`unresolved`) — real metamagic swift-action mechanic.
67. **Rapid Reload** (`unresolved`) — "Weapon Proficiency (crossbow type chosen)" not covered; 2 paragraphs (disclosed).
68. **Rapid Shot** (`unresolved`) — "Dex 13, Point Blank Shot" not covered.
69. **Ride-By Attack** (`unresolved`) — "Ride 1 rank, Mounted Combat" not covered.
70. **Run** (`unresolved`) — real multi-clause speed mechanic.
71. **Scribe Scroll** (`unresolved`) — "Caster level 1st" not covered; 2 paragraphs (disclosed).
72. **Shield Proficiency** (`unresolved`) — real standard-penalty mechanic.
73. **Shot On The Run** (`unresolved`) — 5-clause mixed prereq not covered.
74. **Silent Spell** (`unresolved`) — real metamagic no-verbal-component mechanic.
75. **Simple Weapon Proficiency** (`unresolved`) — real attack-roll-normally mechanic.
76. **Skill Focus** (`unresolved`) — real +3 single-skill mechanic (targets one skill, not the covered two-skill pattern).
77. **Snatch Arrows** (`unresolved`) — "Dex 15, Deflect Arrows, Improved Unarmed Strike" not covered; 2 paragraphs (disclosed).
78. **Spell Focus** (`unresolved`) — real DC-bonus mechanic.
79. **Spell Mastery** (`unresolved`) — "Wizard level 1st" not covered; real spellbook-independence mechanic.
80. **Spell Penetration** (`unresolved`) — real caster-level-check mechanic.
81. **Spirited Charge** (`unresolved`) — "Ride 1 rank, Mounted Combat, Ride-By Attack" not covered.
82. **Spring Attack** (`unresolved`) — "Dex 13, Dodge, Mobility, base attack bonus +4" not covered; 2 paragraphs (disclosed).
83. **Still Spell** (`unresolved`) — real metamagic no-somatic-component mechanic; 2 paragraphs (disclosed).
84. **Stunning Fist** (`unresolved`) — 4-clause mixed prereq not covered; real complex stun-save mechanic.
85. **Toughness** (`unresolved`) — real +3 hit-point mechanic (a resource grant, not the covered skill-check-bonus pattern).
86. **Tower Shield Proficiency** (`partially_structured`) — real standard-penalty mechanic.
87. **Track** (`unresolved`) — real Survival-check mechanic (a check *procedure*, not a flat bonus — not covered); 2 paragraphs (disclosed).
88. **Trample** (`unresolved`) — "Ride 1 rank, Mounted Combat" not covered.
89. **Two-Weapon Defense** (`unresolved`) — "Dex 15, Two-Weapon Fighting" not covered; 2 paragraphs (disclosed).
90. **Two-Weapon Fighting** (`partially_structured`) — real penalty-reduction mechanic.
91. **Weapon Finesse** (`partially_structured`) — real ability-substitution mechanic.
92. **Weapon Focus** (`unresolved`) — "Proficiency with selected weapon, base attack bonus +1" not covered.
93. **Weapon Specialization** (`unresolved`) — "Proficiency with selected weapon, Weapon Focus with selected weapon, fighter level 4th" not covered.
94. **Whirlwind Attack** (`unresolved`) — 7-clause mixed prereq not covered; 2 paragraphs (disclosed).
95. **Widen Spell** (`unresolved`) — real metamagic area-increase mechanic; 5 real paragraphs, only first parsed (disclosed).

</details>

## What's needed to close these gaps (explicit follow-on work, not implied by this report)

Reading the real gap list above, the highest-value next structured-effect patterns (by how many real feats they'd resolve) are:
1. **Single-named-skill/save bonus** (`"You get a +N bonus on <check type>"` with one target, not two) — would resolve Great Fortitude, Iron Will, Lightning Reflexes, Improved Initiative, Skill Focus, and similar (~6+ feats).
2. **Clean caster-level/character-level/class-level prerequisites** (`"Caster level Nth."`, `"Character level Nth."`, `"Wizard level Nth."`) — the type union already models `caster_level`/`character_level`/`class_level`; this pass's regex set simply didn't include them (a real, cheap next-pass win, ~10 feats).
3. **Multi-clause `all`-prerequisite composition** (comma-separated mixed ability/feat/BAB clauses like "Str 13, Power Attack.") — the schema already supports `{kind:"all", requirements:[...]}`; this pass only structured single-clause and pure-feat-reference-list prerequisites.
4. **The reversed skill-rank phrasing** (`"Ride 1 rank."` instead of `"1 rank in Ride"`) — deliberately left unstructured this pass (see the implementer's real judgment call, confirmed by review against the live page) rather than guessed; a real, cheap fix once prioritized.
5. **Resource-grant effects** (Toughness's flat HP grant) and **metamagic-specific effects** (the 9 real Metamagic feats, all currently `unresolved`) are each their own real effect-pattern family, not yet attempted.

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
