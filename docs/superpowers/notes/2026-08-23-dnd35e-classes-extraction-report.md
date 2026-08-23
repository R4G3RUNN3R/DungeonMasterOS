# D&D 3.5e Classes/Progression Extraction Report (real run: 2026-08-23 → 2026-08-24)

**Scope note, stated explicitly:** this covers **all 4 non-spellcasting core classes** (Fighter, Barbarian, Rogue, Monk) plus **the first real prepared spellcaster (Cleric)**. The remaining 6 core classes (Bard, Druid, Paladin, Ranger, Sorcerer, Wizard) still need real per-page verification — Sorcerer and Bard are spontaneous casters and need a real "Spells Known" table this extractor doesn't parse yet (see "What's not covered"). It does not cover any other entity family.

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
Extracted real class "Barbarian" (dnd35e:class:barbarian): fully_structured, 20 level rows, 2 class features.
Extracted real class "Rogue" (dnd35e:class:rogue): fully_structured, 20 level rows, 4 class features.
Extracted real class "Monk" (dnd35e:class:monk): fully_structured, 20 level rows, 4 class features.
Extracted real class "Cleric" (dnd35e:class:cleric): fully_structured, 20 level rows, 6 class features.
```

## Three real page-format/structure differences found and fixed during verification

Each was caught by the extractor's fail-closed design (it threw rather than silently mis-extracting) when a new class was first tried against the existing extractor:

1. **Header cell format varies.** Fighter's table uses bare `<th>Level</th>` cells; Barbarian/Rogue/Monk use `<th align="left">Base<br />Attack Bonus</th>` — an attribute on the tag and a `<br />` splitting the label across two lines. Fixed by normalizing header text (converting `<br>` to a space before stripping tags) rather than requiring an exact bare-tag match.
2. **Class-name heading tag varies.** Fighter/Barbarian/Monk use `<h1>Name</h1>`; Rogue uses `<h2 id="rogue">Rogue</h2>` instead. Fixed by accepting either real pattern.
3. **Monk's table genuinely has 4 extra columns** beyond the standard 6 (Flurry of Blows Attack Bonus, Unarmed Damage, AC Bonus, Unarmored Speed Bonus) — a real, unique-to-Monk mechanical difference, not a formatting quirk. `Dnd35eClassLevelProgressionRow` gained 4 optional fields (`flurryOfBlowsAttackBonus`, `unarmedDamage`, `acBonus`, `unarmoredSpeedBonus`) populated only when the table's real header set matches Monk's 10-column shape; every other class's rows leave them `undefined` (verified by a real regression test). Monk's header also carries a footnote marker (`<th>Unarmed<br />Damage<sup>1</sup></th>`) whose `<sup>` tag *and* digit content are stripped together, not just the tag, so the literal "1" never leaks into the compared header text. A `<tfoot>` footnote row (a single `<td colspan="10">` cell explaining the table is for Medium monks) is correctly skipped by the same cell-count check that already skips the header row — no special-casing needed.

## Real verified facts (Fighter)

- **BAB progression**: `full` — verified per-row, not just at level 20: every one of the 20 real rows has `baseAttackBonus === level`.
- **Save progression**: Fort `good` (real curve `floor(level/2)+2`, verified per-row against the exact real table values), Ref `poor`, Will `poor`.
- **Hit die**: d10. **Alignment**: "Any."
- **Skill points**: base 2 (`2 + Int modifier` per level; `(2 + Int modifier) ×4` at 1st, per the real page).
- **Class skills**: 7 real skills with correct key abilities (Climb/Str, Craft/Int, Handle Animal/Cha, Intimidate/Cha, Jump/Str, Ride/Dex, Swim/Str), each resolved to a real `dnd35e:skill:*` canonical ID.
- **Bonus Feats**: the real Special-column cross-reference correctly appears at exactly levels 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 — matching the class feature text's own stated grant schedule.
- **Class Features**: 2 real features extracted — "Weapon and Armor Proficiency" (no real page `id`, so kebab-cased from its name) and "Bonus Feats" (`id="bonusFeats"`, a real 2-paragraph description, both paragraphs captured in full).
- `extractionStatus: fully_structured`, zero extraction notes — every real section on the page matched a known pattern.

## Real verified facts (Barbarian)

- **BAB progression**: `full`. **Save progression**: Fort `good`, Ref/Will `poor`.
- **Hit die**: d12 (highest of any core class — real, correct). **Alignment**: "Any nonlawful." — a real compound restriction, preserved as prose rather than force-flattened into a single enum value.
- **Skill points**: base 4. **Class skills**: 9 real skills (Climb, Craft, Handle Animal, Intimidate, Jump, Listen, Ride, Survival, Swim).
- **Class Features**: 2 real features — "Weapon and Armor Proficiency" and "Illiteracy" (a real, distinctive Barbarian trait).
- `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Rogue)

- **BAB progression**: `three-quarter` — verified per-row against the real `floor(level×3/4)` curve, not just at level 20.
- **Save progression**: Ref `good`, Fort/Will `poor`. **Hit die**: d6 (lowest of any core class — real, correct). **Alignment**: "Any."
- **Skill points**: base 8 — the highest of any core class, correctly extracted. **Class skills**: 28 real skills — the largest class-skill list in core 3.5, every one resolved to a real canonical skill ID.
- **Class Features**: 4 real features — "Weapon and Armor Proficiency," "Sneak Attack," "Trapfinding," "Special Abilities."
- `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Monk)

- **BAB progression**: `three-quarter`. **Save progression**: Fort/Ref/Will all `good` — Monk is the only core class with all three saves on the good curve.
- **Hit die**: d8. **Alignment**: "Any lawful." — a real compound restriction, preserved as prose.
- **Skill points**: base 4. **Class skills**: 16 real skills.
- **Class Features**: 4 real features — "Weapon and Armor Proficiency," "Unarmed Strike," "Bonus Feat," "Perfect Self."
- **Level 1 progression row**: Flurry of Blows `-2/-2`, Unarmed Damage `1d6`, AC Bonus `+0`, Unarmored Speed Bonus `+0 ft.` — verified real, matching the SRD exactly.
- **Level 20 progression row**: Flurry of Blows `+15/+15/+15/+10/+5`, Unarmed Damage `2d10`, AC Bonus `+4`, Unarmored Speed Bonus `+60 ft.` — verified real.
- `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Cleric — first real prepared caster)

- **BAB progression**: `full`. **Save progression**: Fort `good`, Ref/Will `poor`. **Hit die**: d8. **Alignment**: "Any." **Skill points**: base 2.
- **Spellcasting**: ability `wis`, type `prepared` — both correctly derived from the real page's own stated rules text ("a cleric must have a Wisdom score equal to at least 10 + the spell level" and "a cleric must choose and prepare his spells in advance"), not hard-coded per class.
- **Spells per Day table**: all 20 rows, 10 spell levels each (0-9), correctly parsed from the real two-row grouped header (`rowspan="2"` standard cells + `colspan="10"` "Spells per Day" group label + a sub-header row of spell-level links). Level 1: 3 cantrips, 1 first-level spell plus the real domain-spell `+1` bonus slot, levels 2-9 correctly `null` (the real page's "—"). Level 20: the real domain-spell `+1` bonus slot verified present on every available spell level 1-9, absent on cantrips (spell level 0 never gets a domain spell, per the real rule).
- **Class Features**: 6 real features, including "Turn or Rebuke Undead."
- `extractionStatus: fully_structured`, zero extraction notes.

## New schema: `Dnd35eClassSpellcasting`

Added to `Dnd35eClassDefinition.spellcasting` (`null` for non-casters): `spellcastingAbility`, `type` (`"prepared"` vs `"spontaneous"` — detected from the page's own real stated rules text, not asserted per class), and `spellsPerDay: Dnd35eSpellsPerDayRow[]` (one row per level, each an array of `{spellLevel, base, bonusSlots}` entries — `base: null` for the real "—" cells, `bonusSlots` for real class-specific bonus notation like Cleric's domain spell). A real, simplifying discovery made while building this: the level-progression row-skip logic no longer assumes exactly one header `<tr>` to skip by position — it now relies purely on the existing cell-count check (a header row naturally has 0 `<td>` cells), which turned out to already correctly handle both the single-header-row standard/Monk tables and the two-header-row prepared-caster tables with no special-casing needed.

## What's not covered (explicit follow-on work, not implied by this report)

1. **6 remaining core classes** — Bard, Druid, Paladin, Ranger, Sorcerer, Wizard (Sorcerer and Wizard share one real page, `sorcererWizard.htm`) still need real per-page verification against the live pages. Druid and Wizard are prepared casters and should extract with the current extractor largely as-is (real, likely-cheap next wins, pending real verification — never assumed working without checking). Paladin and Ranger are partial casters (spellcasting starts at level 4, only reaches spell level 4) — their real table shape is not yet inspected. Sorcerer and Bard are spontaneous casters and need a real `spellsKnown` table (a second grouped-column section on their real page) this extractor doesn't parse yet — deliberately not guessed or stubbed ahead of doing it for real.
2. **Prestige classes** are entirely out of scope for this pass (core base classes only, per the design doc's Phase 2B-1 scope boundary carried forward).
3. **No runtime consumer yet** — like Races, there is no character-sheet/progression-application code wired to this table yet; that's real, separate future integration work (steps 15-18 of the 21-step order).
4. **Bonus spells from high ability scores** (the real, separate "bonus spell" table keyed to ability-score-to-bonus-spell mapping) are not modeled — a caster's real total spells-per-day is `spellsPerDay.base` plus this ability-score bonus, which is not yet structured anywhere in this schema.

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
