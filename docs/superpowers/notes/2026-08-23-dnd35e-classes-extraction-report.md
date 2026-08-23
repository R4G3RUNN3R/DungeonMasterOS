# D&D 3.5e Classes/Progression Extraction Report (real run: 2026-08-23)

**Scope note, stated explicitly:** this is the first vertical slice for the Classes entity family — **one real class (Fighter)**, chosen deliberately as the simplest non-spellcasting class to validate the architecture before extending to the other 9. It does not cover spellcasting progression (Wizard/Sorcerer/Cleric/Druid/Bard/Ranger/Paladin all need a real spells-per-day/spells-known table this schema doesn't model yet), and it does not cover any other entity family.

## Architecture

New files, following the exact pattern Feats and Races established:

- `shared/rules-registry/dnd35e/classes.ts` — `Dnd35eClassDefinition`: `babProgression` (`full`/`three-quarter`/`half`), `saveProgression` per save (`good`/`poor`), `hitDie`, `skillPointsBase`, `classSkills` (skill + key ability), the full 20-row `levelProgression` table (BAB/Fort/Ref/Will/special-feature-slugs per level), and `classFeatures` (slug/name/full description).
- `server/dnd35e/extraction/classes-extractor.ts` — pure, regex-based `extractClassFromHtml(html)`, parsing a real `d20srd.org/srd/classes/*` page's level-progression table, Alignment/Hit Die/Class Skills/Skill Points sections, and Class Features blocks.
- `server/dnd35e/extraction/fighter-fixture.html` — the real, captured `/srd/classes/fighter.htm` page, committed as a test fixture.
- `server/storage.ts` — `upsertDnd35eClassDefinition`/`getDnd35eClassDefinition`/`listDnd35eClassDefinitions` on a new `dnd35e_class_definitions` table, structurally identical to the feat/race-definition storage.
- `server/dnd35e/extraction/run-classes-extraction.ts` — real, committed, content-hash-verified extraction script. Structured as a list of source-page keys so extending to the other 9 class pages is a one-line addition once each is real-verified, not a rewrite.

## Design notes

**BAB/save progression are derived, not asserted.** Rather than hand-labeling each class's progression rate, `classifyBabProgression`/`classifySaveProgression` read the real level-20 row of the extracted table (BAB 20/15/10 → full/three-quarter/half; save 12/6 → good/poor) and fail closed (throw) if a table's level-20 value doesn't match one of the two/three known real 3.5 curves — so the label can never silently drift out of sync with the literal table data it's derived from.

**Header-order verification is fail-closed.** Before parsing any row, the table's real `<th>` cells are checked against the expected `[Level, Base Attack Bonus, Fort Save, Ref Save, Will Save, Special]` order; a mismatch throws rather than silently mis-mapping columns to the wrong fields.

**Class Features capture full, un-truncated multi-paragraph text.** Unlike Feats' Benefit-section handling (which captures only the first paragraph, with a disclosure note for the rest — a lesson from that entity family's Task 3 review), this extractor joins every real `<p>` within a feature block into one description from the start, so there is no truncation to disclose. No single-effect-pattern structuring is attempted for class features this pass (mirrors Races' `special_ability` catch-all philosophy) — the full real text is preserved, not force-fit into a mechanical shape.

## Content-hash verification (fail-closed drift check)

```
Content hash verified — extracting from confirmed-current content.
```

Zero drift against Phase 2A's real acceptance-scan hash for `/srd/classes/fighter.htm`.

## Headline evidence line

```
Extracted real class "Fighter" (dnd35e:class:fighter): fully_structured, 20 level rows, 2 class features.
```

## Real verified facts (Fighter)

- **BAB progression**: `full` — verified per-row, not just at level 20: every one of the 20 real rows has `baseAttackBonus === level`.
- **Save progression**: Fort `good` (real curve `floor(level/2)+2`, verified per-row against the exact real table values), Ref `poor`, Will `poor`.
- **Hit die**: d10. **Alignment**: "Any."
- **Skill points**: base 2 (`2 + Int modifier` per level; `(2 + Int modifier) ×4` at 1st, per the real page).
- **Class skills**: 7 real skills with correct key abilities (Climb/Str, Craft/Int, Handle Animal/Cha, Intimidate/Cha, Jump/Str, Ride/Dex, Swim/Str), each resolved to a real `dnd35e:skill:*` canonical ID.
- **Bonus Feats**: the real Special-column cross-reference correctly appears at exactly levels 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 — matching the class feature text's own stated grant schedule.
- **Class Features**: 2 real features extracted — "Weapon and Armor Proficiency" (no real page `id`, so kebab-cased from its name) and "Bonus Feats" (`id="bonusFeats"`, a real 2-paragraph description, both paragraphs captured in full).
- `extractionStatus: fully_structured`, zero extraction notes — every real section on the page matched a known pattern.

## What's not covered (explicit follow-on work, not implied by this report)

1. **The other 9 core classes** — Barbarian, Bard, Cleric, Druid, Monk, Paladin, Ranger, Rogue, Sorcerer, Wizard (Sorcerer and Wizard share one real page, `sorcererWizard.htm`). Barbarian, Monk, and Rogue are non-spellcasters and should extract cleanly with the current extractor as-is (real, cheap next wins). The remaining 7 are full or partial spellcasters and need real schema/extractor work first (see next point).
2. **Spellcasting progression** — no `spellsPerDay`/`spellsKnown` table exists in `Dnd35eClassDefinition` yet. This is real, separate, necessarily bigger work (the real per-class tables have a different shape: spell level columns instead of a flat Special column, prepared-vs-known casting distinctions, bonus spells from high ability scores) — deliberately not guessed or stubbed ahead of doing it for real against an actual caster page.
3. **Prestige classes** are entirely out of scope for this pass (core base classes only, per the design doc's Phase 2B-1 scope boundary carried forward).
4. **No runtime consumer yet** — like Races, there is no character-sheet/progression-application code wired to this table yet; that's real, separate future integration work (steps 15-18 of the 21-step order).

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
