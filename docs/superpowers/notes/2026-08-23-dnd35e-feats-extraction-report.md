# D&D 3.5e Feats Extraction Report (Phase 2B-1 → prerequisite-deepening pass, real run: 2026-08-23)

**Scope note, stated explicitly:** every number in this report is a *feat-page* extraction count from one real SRD page. Nothing here claims full mechanical coverage of the D&D 3.5e feat system, and nothing here claims coverage of any other entity family (races, classes, spells, monsters, etc.) — those remain unstarted, per the Phase 2B-1 design doc's explicit scope boundary.

## What changed since the original Phase 2B-1 report

The original pass (110 feats → 15 fully_structured / 14 partially_structured / 81 unresolved) structured exactly one prerequisite shape per field: a pure feat-reference list, a bare BAB value, a bare ability score, or a bare "N ranks in X." — anything mixed (`"Str 13, Power Attack."`) or differently phrased (`"Caster level 3rd."`, `"Ride 1 rank."`) fell to one opaque `special` blob for the whole field.

This pass rewrote `parsePrerequisites()` (`server/dnd35e/extraction/feats-extractor.ts`) to do real multi-clause decomposition: split each prerequisites field on top-level commas (respecting paren nesting), classify every clause independently against an expanded pattern set (ability, BAB — including a "BAB plus a genuine parenthetical aside" shape, feat reference — including "feat reference plus trailing qualifier prose" — skill ranks in both the original and the page's actual reversed phrasing, caster/character/manifester/generic-class level, proficiency, and a bare "X ability"/"Ability to X" class-feature shape), and compose the results into a real `{kind:"all", requirements:[...]}` instead of one blob. A clause that still matches nothing becomes its own **per-clause** `special` — never silently dropped, never guessed — so a partially-mixed field now yields real structured facts for its recognizable parts and honest `special` only for the genuinely unrecognized remainder.

Three new prerequisite kinds were added to the schema (`shared/rules-registry/dnd35e/feats.ts`) to support this: `manifester_level` (fully evaluable, parallels `caster_level`), and `proficiency`/`class_feature` (typed-but-not-yet-independently-evaluable — no canonical weapon/armor or class-feature entity family exists yet to check them against, so the evaluator fails them closed like `special`, but keeping them as distinct kinds lets a future pass group and explain them correctly instead of treating every unstructured requirement the same way).

No real "any"/OR-alternative prerequisite was observed on this page — only AND-composition via comma lists — so this pass did not attempt to detect OR phrasing. The evaluator already supports `any`; the extractor simply has nothing real to feed it yet.

A small Benefit-side follow-up was also added: a `save_bonus` effect kind (`{save: "fortitude"|"reflex"|"will", bonus, bonusType}`, deliberately separate from `skill_check_bonus` since saving throws are a distinct 3.5 mechanical concept from skills) structures the real "You get a +N bonus on all Fortitude/Reflex/Will saving throws." pattern — Great Fortitude, Iron Will, Lightning Reflexes. Combat Casting's superficially similar "+4 on Concentration checks" was deliberately left `unresolved`: its real text is conditional ("made to cast a spell ... while on the defensive"), and a flat bonus pattern would misrepresent that condition rather than honestly fail to structure it.

## Headline evidence line

```
extracted 110 real feats from https://www.d20srd.org/srd/feats.htm → 18 fully_structured → 57 partially_structured → 35 unresolved
```

Unresolved dropped from **81 → 35** (a 57% reduction) through real parser coverage of prerequisite forms (and one narrow Benefit pattern) that were always present on the page — not through any change to the corpus or to what counts as "resolved." `fully_structured` rose from 15 to 18 (Great Fortitude, Iron Will, Lightning Reflexes — each had no prerequisite and now has a real structured Benefit). The rest of the Benefit-effect surface (resource grants, metamagic effects, item-creation cost formulas) remains real, separate follow-on work — see "What's still needed" below.

## Content-hash verification (fail-closed drift check)

Before extracting, the real page was re-fetched and its SHA-256 compared against the hash recorded for this exact page in `srd_manifest_entries` (`dnd35e-srd-hypertext-d20::/srd/feats.htm`):

```
Content hash verified — extracting from confirmed-current content.
```

Zero drift since the original Phase 2A scan — the page has not changed. Had the hash not matched, extraction would have stopped and reported the drift rather than silently extracting from unverified content, per this whole project's established discipline.

## Real counts

| Metric | Original pass | This pass |
|---|---|---|
| Total real feats extracted | 110 | 110 |
| `fully_structured` | 15 | 18 |
| `partially_structured` | 14 | 57 |
| `unresolved` | 81 | 35 |
| Real duplicate canonical IDs | 0 | 0 |
| Real dangling feat-reference prerequisites | 0 | 0 |

## Full real gap list (every non-`fully_structured` feat, by name and reason — never just a count)

The complete list below is real data pulled directly from the dev database after this pass's real re-extraction run — 92 feats (down from 95: Great Fortitude, Iron Will, and Lightning Reflexes moved to `fully_structured` via the new `save_bonus` pattern and no longer appear here), each with its real, honest `extractionNotes`. Almost every remaining note is now Benefit-side only — prerequisite-side notes have mostly disappeared from this list.

<details>
<summary>Click to expand the full 92-feat gap list (name, status, real reason(s))</summary>

1. **Armor Proficiency (Heavy)** (`partially_structured`) — Benefit is "See Armor Proficiency (light)." (a cross-reference, not a self-contained mechanic).
2. **Armor Proficiency (Light)** (`unresolved`) — real armor-check-penalty mechanic, no Benefit pattern covers it.
3. **Armor Proficiency (Medium)** (`partially_structured`) — same cross-reference pattern as Heavy.
4. **Augment Summoning** (`unresolved`) — prerequisite now fully decomposes to `feat(spell-focus) + special("(conjuration)")` (the school qualifier, honestly preserved); Benefit's +4 enhancement-bonus mechanic still uncovered.
5. **Blind-Fight** (`unresolved`) — Benefit mechanic uncovered; 3 real paragraphs, only the first parsed (disclosed).
6. **Brew Potion** (`partially_structured`, was `unresolved`) — prerequisite "Caster level 3rd." now fully structures to `caster_level(3)`; Benefit's item-creation mechanic across 3 paragraphs still uncovered (disclosed).
7. **Cleave** (`partially_structured`, was `unresolved`) — prerequisite "Str 13, Power Attack." now fully decomposes to `all[ability(str,13), feat(power-attack)]`, no special; Benefit's extra-attack mechanic still uncovered.
8. **Combat Casting** (`unresolved`) — Benefit is a real +4 Concentration-check mechanic, not the covered two-skill pattern.
9. **Combat Expertise** (`partially_structured`) — real AC-tradeoff mechanic, not covered.
10. **Combat Reflexes** (`unresolved`) — real Dex-bonus-additional-AoO mechanic; 2 paragraphs (disclosed).
11. **Craft Magic Arms And Armor** (`partially_structured`, was `unresolved`) — "Caster level 5th." now fully structures; Benefit item-creation mechanic still uncovered, 3 paragraphs (disclosed).
12. **Craft Rod** (`partially_structured`, was `unresolved`) — "Caster level 9th." now fully structures; Benefit still uncovered, 2 paragraphs (disclosed).
13. **Craft Staff** (`partially_structured`, was `unresolved`) — "Caster level 12th." now fully structures; Benefit still uncovered, 3 paragraphs (disclosed).
14. **Craft Wand** (`partially_structured`, was `unresolved`) — "Caster level 5th." now fully structures; Benefit still uncovered, 2 paragraphs (disclosed).
15. **Craft Wondrous Item** (`partially_structured`, was `unresolved`) — "Caster level 3rd." now fully structures; Benefit still uncovered, 3 paragraphs (disclosed).
16. **Deflect Arrows** (`partially_structured`, was `unresolved`) — "Dex 13, Improved Unarmed Strike." now fully decomposes, no special; Benefit still uncovered, 2 paragraphs (disclosed).
17. **Diehard** (`partially_structured`) — real stabilization mechanic; 3 paragraphs (disclosed).
18. **Dodge** (`partially_structured`) — real +1 dodge-vs-designated-opponent mechanic; 2 paragraphs (disclosed).
19. **Empower Spell** (`unresolved`) — real metamagic mechanic; 2 paragraphs (disclosed).
20. **Endurance** (`unresolved`) — real multi-check bonus mechanic spanning 7 different check/save types, not the covered two-skill pattern.
21. **Enlarge Spell** (`unresolved`) — real metamagic range-doubling mechanic; 2 paragraphs (disclosed).
22. **Eschew Materials** (`unresolved`) — real material-component-waiver mechanic.
23. **Exotic Weapon Proficiency** (`unresolved`) — prerequisite now fully decomposes to `all[bab(1), special("plus Str 13 for bastard sword or dwarven waraxe")]` — the parenthetical aside is preserved, never dropped; Benefit still uncovered.
24. **Extend Spell** (`unresolved`) — real metamagic duration-doubling mechanic.
25. **Extra Turning** (`partially_structured`, was `unresolved`) — "Ability to turn or rebuke creatures." now structures to `class_feature`; Benefit still uncovered, 2 paragraphs (disclosed).
26. **Far Shot** (`partially_structured`) — real range-increment mechanic.
27. **Forge Ring** (`partially_structured`, was `unresolved`) — "Caster level 12th." now fully structures; Benefit still uncovered, 3 paragraphs (disclosed).
28. **Great Cleave** (`partially_structured`, was `unresolved`) — real 4-clause mixed prereq now fully decomposes to `all[ability(str,13), feat(cleave), feat(power-attack), bab(4)]`, no special left; Benefit cross-references Cleave, still uncovered.
30. **Greater Spell Focus** (`unresolved`) — real DC-bonus mechanic.
31. **Greater Spell Penetration** (`partially_structured`) — real caster-level-check bonus mechanic.
32. **Greater Two-Weapon Fighting** (`partially_structured`, was `unresolved`) — real 4-clause prereq now fully decomposes; Benefit still uncovered.
33. **Greater Weapon Focus** (`unresolved`) — prerequisite now mostly decomposes (proficiency, feat, class_level all structured); one real "with selected weapon" qualifier clause remains an honest `special` sibling (no atomic schema shape for "same choice as the referenced feat" yet); Benefit still uncovered.
34. **Greater Weapon Specialization** (`unresolved`) — same "with selected weapon" residual pattern repeated 3 times across its 5-clause prereq; Benefit still uncovered.
35. **Heighten Spell** (`unresolved`) — real metamagic level-increase mechanic.
36. **Improved Bull Rush** (`partially_structured`, was `unresolved`) — "Str 13, Power Attack." now fully decomposes; Benefit still uncovered.
37. **Improved Counterspell** (`unresolved`) — real counterspell-school mechanic.
38. **Improved Critical** (`partially_structured`, was `unresolved`) — "Proficient with weapon, base attack bonus +8." now fully decomposes to `all[proficiency, bab(8)]`, no special; Benefit still uncovered.
39. **Improved Disarm** (`partially_structured`, was `unresolved`) — "Int 13, Combat Expertise." now fully decomposes; Benefit still uncovered.
40. **Improved Familiar** (`unresolved`) — prerequisite now partially decomposes: "Ability to acquire a new familiar" structures to `class_feature`, but "compatible alignment" and "sufficiently high level (see below)" remain honest `special` clauses — genuinely relative/non-literal values this pass correctly declines to force into a flat kind; Benefit still uncovered, 3 paragraphs (disclosed).
41. **Improved Feint** (`partially_structured`, was `unresolved`) — "Int 13, Combat Expertise." now fully decomposes; Benefit still uncovered.
42. **Improved Grapple** (`partially_structured`, was `unresolved`) — "Dex 13, Improved Unarmed Strike." now fully decomposes; Benefit still uncovered.
43. **Improved Initiative** (`unresolved`) — real +4 initiative mechanic (a single-roll-type bonus, not the covered two-skill pattern).
44. **Improved Overrun** (`partially_structured`, was `unresolved`) — "Str 13, Power Attack." now fully decomposes; Benefit still uncovered.
45. **Improved Precise Shot** (`partially_structured`, was `unresolved`) — 4-clause mixed prereq now fully decomposes; Benefit still uncovered, 2 paragraphs (disclosed).
46. **Improved Shield Bash** (`partially_structured`) — real shield-bash-AC mechanic.
47. **Improved Sunder** (`partially_structured`, was `unresolved`) — "Str 13, Power Attack." now fully decomposes; Benefit still uncovered, 2 paragraphs (disclosed).
48. **Improved Trip** (`partially_structured`, was `unresolved`) — "Int 13, Combat Expertise." now fully decomposes; Benefit still uncovered, 2 paragraphs (disclosed).
49. **Improved Turning** (`partially_structured`, was `unresolved`) — "Ability to turn or rebuke creatures." now structures to `class_feature`; Benefit still uncovered.
50. **Improved Two-Weapon Fighting** (`partially_structured`, was `unresolved`) — "Dex 17, Two-Weapon Fighting, base attack bonus +6." now fully decomposes; Benefit still uncovered.
51. **Improved Unarmed Strike** (`unresolved`) — real armed-when-unarmed mechanic; 2 paragraphs (disclosed).
53. **Leadership** (`partially_structured`, was `unresolved`) — "Character level 6th." now fully structures to `character_level(6)`; real cohort/follower-table mechanic still uncovered.
55. **Manyshot** (`partially_structured`, was `unresolved`) — "Dex 17, Point Blank Shot, Rapid Shot, base attack bonus +6." now fully decomposes; Benefit still uncovered, 3 paragraphs (disclosed).
56. **Martial Weapon Proficiency** (`unresolved`) — real attack-roll-normally mechanic.
57. **Maximize Spell** (`unresolved`) — real metamagic maximize mechanic; 2 paragraphs (disclosed).
58. **Mobility** (`partially_structured`, was `unresolved`) — "Dex 13, Dodge." now fully decomposes; Benefit still uncovered, 2 paragraphs (disclosed).
59. **Mounted Archery** (`partially_structured`, was `unresolved`) — "Ride 1 rank, Mounted Combat." — the real reversed skill-rank phrasing this pass added support for — now fully decomposes to `all[skill_ranks(ride,1), feat(mounted-combat)]`, no special; Benefit still uncovered.
60. **Mounted Combat** (`partially_structured`, was `unresolved`) — "Ride 1 rank." now fully structures; Benefit still uncovered.
61. **Natural Spell** (`partially_structured`, was `unresolved`) — "Wis 13, wild shape ability." now fully decomposes to `all[ability(wis,13), class_feature("wild shape ability.")]`, no special; Benefit still uncovered, 2 paragraphs (disclosed).
62. **Point Blank Shot** (`unresolved`) — real ranged attack/damage bonus mechanic.
63. **Power Attack** (`partially_structured`) — real attack-for-damage tradeoff mechanic.
64. **Precise Shot** (`partially_structured`) — real melee-penalty-waiver mechanic.
65. **Quick Draw** (`partially_structured`) — real free-action-draw mechanic; 2 paragraphs (disclosed).
66. **Quicken Spell** (`unresolved`) — real metamagic swift-action mechanic.
67. **Rapid Reload** (`partially_structured`, was `unresolved`) — "Weapon Proficiency (crossbow type chosen)." now structures to `proficiency` (typed, non-evaluable but no longer opaque `special`); Benefit still uncovered, 2 paragraphs (disclosed).
68. **Rapid Shot** (`partially_structured`, was `unresolved`) — "Dex 13, Point Blank Shot." now fully decomposes; Benefit still uncovered.
69. **Ride-By Attack** (`partially_structured`, was `unresolved`) — "Ride 1 rank, Mounted Combat." now fully decomposes; Benefit still uncovered.
70. **Run** (`unresolved`) — real multi-clause speed mechanic.
71. **Scribe Scroll** (`partially_structured`, was `unresolved`) — "Caster level 1st." now fully structures; Benefit still uncovered, 2 paragraphs (disclosed).
72. **Shield Proficiency** (`unresolved`) — real standard-penalty mechanic.
73. **Shot On The Run** (`partially_structured`, was `unresolved`) — real 5-clause mixed prereq now fully decomposes; Benefit still uncovered.
74. **Silent Spell** (`unresolved`) — real metamagic no-verbal-component mechanic.
75. **Simple Weapon Proficiency** (`unresolved`) — real attack-roll-normally mechanic.
76. **Skill Focus** (`unresolved`) — real +3 single-skill mechanic (targets one skill, not the covered two-skill pattern).
77. **Snatch Arrows** (`partially_structured`, was `unresolved`) — "Dex 15, Deflect Arrows, Improved Unarmed Strike." now fully decomposes; Benefit still uncovered, 2 paragraphs (disclosed).
78. **Spell Focus** (`unresolved`) — real DC-bonus mechanic.
79. **Spell Mastery** (`partially_structured`) — real spellbook-independence mechanic.
80. **Spell Penetration** (`unresolved`) — real caster-level-check mechanic.
81. **Spirited Charge** (`partially_structured`, was `unresolved`) — "Ride 1 rank, Mounted Combat, Ride-By Attack." now fully decomposes to 3 clean requirements, no special; Benefit still uncovered.
82. **Spring Attack** (`partially_structured`, was `unresolved`) — "Dex 13, Dodge, Mobility, Point Blank Shot, base attack bonus +4." now fully decomposes; Benefit still uncovered, 2 paragraphs (disclosed).
83. **Still Spell** (`unresolved`) — real metamagic no-somatic-component mechanic; 2 paragraphs (disclosed).
84. **Stunning Fist** (`partially_structured`, was `unresolved`) — real 4-clause mixed prereq now fully decomposes; real complex stun-save mechanic still uncovered.
85. **Toughness** (`unresolved`) — real +3 hit-point mechanic (a resource grant, not the covered skill-check-bonus pattern).
86. **Tower Shield Proficiency** (`partially_structured`) — real standard-penalty mechanic.
87. **Track** (`unresolved`) — real Survival-check mechanic (a check *procedure*, not a flat bonus — not covered); 2 paragraphs (disclosed).
88. **Trample** (`partially_structured`, was `unresolved`) — "Ride 1 rank, Mounted Combat." now fully decomposes; Benefit still uncovered.
89. **Two-Weapon Defense** (`partially_structured`, was `unresolved`) — "Dex 15, Two-Weapon Fighting." now fully decomposes; Benefit still uncovered, 2 paragraphs (disclosed).
90. **Two-Weapon Fighting** (`partially_structured`) — real penalty-reduction mechanic.
91. **Weapon Finesse** (`partially_structured`) — real ability-substitution mechanic.
92. **Weapon Focus** (`partially_structured`, was `unresolved`) — "Proficiency with selected weapon, base attack bonus +1." now fully decomposes to `all[proficiency, bab(1)]`, no special; Benefit still uncovered.
93. **Weapon Specialization** (`unresolved`) — prerequisite now mostly decomposes (proficiency, feat, class_level structured); one "with selected weapon" residual clause remains honest `special`; Benefit still uncovered.
94. **Whirlwind Attack** (`partially_structured`, was `unresolved`) — real 7-clause mixed prereq now fully decomposes; Benefit still uncovered, 2 paragraphs (disclosed).
95. **Widen Spell** (`unresolved`) — real metamagic area-increase mechanic; 5 real paragraphs, only first parsed (disclosed).

</details>

## What's still needed (explicit follow-on work, not implied by this report)

Prerequisite decomposition is now real and substantial (81 → 35 unresolved), and one narrow Benefit pattern (`save_bonus`) is now covered too. The remaining gap is almost entirely **Benefit-side**. Reading the list above, the highest-value next structured-effect patterns (by how many real feats they'd resolve) are:

1. **Single-named-check bonus, non-conditional** (`"You get a +N bonus on <check type> checks."` with one literal target and no attached condition) — would resolve Improved Initiative (~1 feat outright); Skill Focus's target skill is a variable ("that skill"), not a literal in the Benefit text, so it needs its own small extraction (read the chosen skill from context) rather than this pattern; Combat Casting and Point Blank Shot are conditional/multi-target and are correctly excluded from this simple pattern (see below).
2. **Resource-grant effects** (Toughness's flat HP grant) and **metamagic-specific effects** (the 9 real Metamagic feats, all still `unresolved`) are each their own real effect-pattern family, not yet attempted.
3. **Cross-reference Benefits** ("See Armor Proficiency (light)", "This feat works like Cleave, except...") — a distinct real pattern (a Benefit that defers to another feat's text rather than stating its own mechanic).
4. **Item-creation Benefits** (Brew Potion, Craft Wand/Rod/Staff/Ring/Wondrous Item, Scribe Scroll) — a real, recurring cost/time-formula family (`spell level × caster level × N gp`) shared across ~7 feats.
5. Two genuinely unstructured prerequisite clauses remain by deliberate, honest design choice, not oversight: "compatible alignment" (Improved Familiar — inherently relative to another character's alignment, not a flat literal) and the "with selected weapon" qualifier (Greater Weapon Focus/Specialization, Weapon Specialization — no atomic schema shape yet for "same choice as a referenced feat's chosen weapon"). Both are preserved verbatim as `special`, never guessed.

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
