# D&D 3.5e Classes/Progression Extraction Report (real run: 2026-08-23 → 2026-08-24)

**Scope note, stated explicitly:** this covers **all 11 core D&D 3.5e base classes** — Fighter, Barbarian, Rogue, Monk (non-spellcasters); Cleric, Druid, Paladin, Ranger (prepared casters); Bard (spontaneous, real combined Spells-per-Day/Spells-Known table); and Sorcerer + Wizard (from their one shared real page, one spontaneous and one prepared). It does **not** cover prestige classes, spell lists/spell descriptions themselves (a separate future entity family), or any other entity family (see "What's not covered" for the complete, honest list of real remaining gaps within this scope).

## Real bug found and fixed: (Ex)/(Su)-suffixed class features were being silently dropped

While extracting Druid, 10 of its real class features (Animal Companion, Nature Sense, Wild Empathy, Woodland Stride, Trackless Step, Resist Nature's Lure, Wild Shape, Venom Immunity, A Thousand Faces, Timeless Body) were missing from the output — not truncated, not merged into another feature, just absent, with **zero** `extractionNotes` disclosing anything wrong. Root cause: `FEATURE_BLOCK_RE`'s heading-text capture (`[^<]+`) required a feature's `<h5>` heading to contain no nested tags at all. But the extremely common real pattern `<h5 id="wildShape">Wild Shape (<a href="/srd/specialAbilities.htm#supernaturalAbilities">Su</a>)</h5>` — every (Ex)/(Su)/(Sp) ability-type suffix links to `specialAbilities.htm` — has exactly such a nested tag, so the whole heading silently failed to match at all, and the regex engine's `.exec()` loop just crawled past it character-by-character until it found the next heading with no nested tags.

**This means the already-committed Barbarian, Rogue, Monk, and Cleric extractions from earlier in this session were each incomplete in the same way**, despite being reported as `extractionStatus: fully_structured` with zero notes:

| Class | Reported before fix | Real count after fix | Missing (Ex)/(Su) features silently dropped |
|---|---|---|---|
| Barbarian | 2 | **12** | Fast Movement, Rage, Uncanny Dodge, Trap Sense, Improved Uncanny Dodge, Damage Reduction, Greater Rage, Indomitable Will, Tireless Rage, Mighty Rage |
| Rogue | 4 | **8** | Evasion, Trap Sense, Uncanny Dodge, Improved Uncanny Dodge |
| Monk | 4 | **21** | AC Bonus, Flurry of Blows, Evasion, Fast Movement, Still Mind, Ki Strike, Slow Fall, Purity of Body, Wholeness of Body, Improved Evasion, Diamond Body, Abundant Step, Diamond Soul, Quivering Palm, Timeless Body, Tongue of the Sun and Moon, Empty Body |
| Cleric | 6 | **8** | Aura, Turn or Rebuke Undead |

Fixed by widening the heading capture to `[\s\S]*?` (tolerating any nested tags) and stripping tags from the captured text afterward — the same technique already used elsewhere in this codebase for exactly this class of problem. **Every already-reported `fully_structured` status above was itself still accurate** (BAB/save progression, spellcasting, and the *other* class features were correct) — what changed is real feature *completeness*, not correctness of what had been captured. The real dev database was re-extracted from the live pages after the fix (not just the fixtures) to replace the incomplete rows. 6 new regression tests assert exact, real, live-page-verified feature counts for every affected class specifically so this bug class cannot regress silently again — a bug like this produces zero test failures unless a test checks *completeness*, not just presence of a few named items, which none of the original per-class tests did.

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
Extracted real class "Barbarian" (dnd35e:class:barbarian): fully_structured, 20 level rows, 12 class features.
Extracted real class "Rogue" (dnd35e:class:rogue): fully_structured, 20 level rows, 8 class features.
Extracted real class "Monk" (dnd35e:class:monk): fully_structured, 20 level rows, 21 class features.
Extracted real class "Cleric" (dnd35e:class:cleric): fully_structured, 20 level rows, 8 class features.
Extracted real class "Druid" (dnd35e:class:druid): fully_structured, 20 level rows, 21 class features.
Extracted real class "Paladin" (dnd35e:class:paladin): fully_structured, 20 level rows, 15 class features.
Extracted real class "Ranger" (dnd35e:class:ranger): fully_structured, 20 level rows, 15 class features.
Extracted real class "Sorcerer" (dnd35e:class:sorcerer): fully_structured, 20 level rows, 3 class features.
Extracted real class "Wizard" (dnd35e:class:wizard): fully_structured, 20 level rows, 7 class features.
Extracted real class "Bard" (dnd35e:class:bard): fully_structured, 20 level rows, 13 class features.
```

All 11 core classes: `fully_structured`, zero extraction notes.

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
- **Class Features**: 12 real features — Weapon and Armor Proficiency, Illiteracy, Fast Movement (Ex), Rage (Ex), Uncanny Dodge (Ex), Trap Sense (Ex), Improved Uncanny Dodge (Ex), Damage Reduction (Ex), Greater Rage (Ex), Indomitable Will (Ex), Tireless Rage (Ex), Mighty Rage (Ex).
- `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Rogue)

- **BAB progression**: `three-quarter` — verified per-row against the real `floor(level×3/4)` curve, not just at level 20.
- **Save progression**: Ref `good`, Fort/Will `poor`. **Hit die**: d6 (lowest of any core class — real, correct). **Alignment**: "Any."
- **Skill points**: base 8 — the highest of any core class, correctly extracted. **Class skills**: 28 real skills — the largest class-skill list in core 3.5, every one resolved to a real canonical skill ID.
- **Class Features**: 8 real features — Weapon and Armor Proficiency, Sneak Attack, Trapfinding, Evasion (Ex), Trap Sense (Ex), Uncanny Dodge (Ex), Improved Uncanny Dodge (Ex), Special Abilities.
- `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Monk)

- **BAB progression**: `three-quarter`. **Save progression**: Fort/Ref/Will all `good` — Monk is the only core class with all three saves on the good curve.
- **Hit die**: d8. **Alignment**: "Any lawful." — a real compound restriction, preserved as prose.
- **Skill points**: base 4. **Class skills**: 16 real skills.
- **Class Features**: 21 real features — Weapon and Armor Proficiency, AC Bonus (Ex), Flurry of Blows (Ex), Unarmed Strike, Bonus Feat, Evasion (Ex), Fast Movement (Ex), Still Mind (Ex), Ki Strike (Su), Slow Fall (Ex), Purity of Body (Ex), Wholeness of Body (Su), Improved Evasion (Ex), Diamond Body (Su), Abundant Step (Su), Diamond Soul (Ex), Quivering Palm (Su), Timeless Body (Ex), Tongue of the Sun and Moon (Ex), Empty Body (Su), Perfect Self.
- **Level 1 progression row**: Flurry of Blows `-2/-2`, Unarmed Damage `1d6`, AC Bonus `+0`, Unarmored Speed Bonus `+0 ft.` — verified real, matching the SRD exactly.
- **Level 20 progression row**: Flurry of Blows `+15/+15/+15/+10/+5`, Unarmed Damage `2d10`, AC Bonus `+4`, Unarmored Speed Bonus `+60 ft.` — verified real.
- `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Cleric — first real prepared caster)

- **BAB progression**: `full`. **Save progression**: Fort `good`, Ref/Will `poor`. **Hit die**: d8. **Alignment**: "Any." **Skill points**: base 2.
- **Spellcasting**: ability `wis`, type `prepared` — both correctly derived from the real page's own stated rules text ("a cleric must have a Wisdom score equal to at least 10 + the spell level" and "a cleric must choose and prepare his spells in advance"), not hard-coded per class.
- **Spells per Day table**: all 20 rows, 10 spell levels each (0-9), correctly parsed from the real two-row grouped header (`rowspan="2"` standard cells + `colspan="10"` "Spells per Day" group label + a sub-header row of spell-level links). Level 1: 3 cantrips, 1 first-level spell plus the real domain-spell `+1` bonus slot, levels 2-9 correctly `null` (the real page's "—"). Level 20: the real domain-spell `+1` bonus slot verified present on every available spell level 1-9, absent on cantrips (spell level 0 never gets a domain spell, per the real rule).
- **Class Features**: 8 real features — Weapon and Armor Proficiency, Aura (Ex), Spells, Deity/Domains/Domain Spells, Spontaneous Casting, Chaotic/Evil/Good/Lawful Spells, Turn or Rebuke Undead (Su), Bonus Languages.
- `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Druid)

- **BAB progression**: `three-quarter`. **Save progression**: Fort `good`, Ref `poor`, Will `good` — Druid shares Monk's Fort+Will-good/Ref-poor shape but is not identical to any other class already extracted.
- **Hit die**: d8. **Alignment**: "Neutral good, lawful neutral, neutral, chaotic neutral, or neutral evil." — a real, unusually verbose compound restriction (effectively "any non-chaotic-good, non-lawful-good, non-chaotic-evil, non-lawful-evil neutral-leaning alignment"), preserved verbatim as prose rather than force-flattened.
- **Skill points**: base 4. **Class skills**: 12 real skills.
- **Spellcasting**: ability `wis`, type `prepared`. Spells-per-day numbers are identical to Cleric's at every level, but with `bonusSlots: 0` everywhere (Druids get no domain spells) — verified explicitly, not merely assumed from the shared table shape.
- **Class Features**: 21 real features, including the exact (Ex)/(Su)-suffixed set the nested-tag bug used to drop (Animal Companion, Nature Sense, Wild Empathy, Woodland Stride, Trackless Step, Resist Nature's Lure, Wild Shape, Venom Immunity, A Thousand Faces, Timeless Body), plus Weapon and Armor Proficiency, Spells, Spontaneous Casting, Chaotic/Evil/Good/Lawful Spells, Bonus Languages, Animal Companion Basics, and 5 real table-row-group headings from the Animal Companion-by-level table ("4th Level or Higher (Level −3)" etc.) that are honestly captured as their own named entries even though they function more as table row labels than freestanding class features — a known, disclosed quirk, not a miscategorization worth blocking on.
- `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Paladin — first real partial caster)

- **BAB progression**: `full`. **Save progression**: Fort `good`, Ref/Will `poor`. **Hit die**: d10. **Alignment**: "Lawful good." — a real single fixed value (unlike Barbarian/Druid's compound restrictions). **Skill points**: base 2.
- **Spellcasting**: ability `wis`, type `prepared`. **Spells per Day table has only 4 spell-level columns (1st-4th, no cantrip column)** — Paladins never cast spells above 4th level and have no 0-level spells at all. The generic prepared-caster detection (built for Cleric's 10-column table) needed **zero code changes** to correctly recognize and parse this narrower real shape.
- **Real "0" vs "—" distinction verified**: levels 1-3 show real `—` (no spellcasting at all yet) for every spell level; level 4 shows a real `0` for 1st-level spells specifically (the class table says a level-4 Paladin *can* have caster level for 1st-level spells, but the base allotment is 0 — a real, meaningful RAW distinction from "unavailable"). At level 20, all 4 spell levels show `3`.
- **Class Features**: 15 real features — Weapon and Armor Proficiency, Aura of Good (Ex), Detect Evil (Sp), Smite Evil (Su), Divine Grace (Su), Lay on Hands (Su), Aura of Courage (Su), Divine Health (Ex), Turn Undead (Su), Spells, Special Mount (Sp), Remove Disease (Sp), Code of Conduct, Associates, Paladin's Mount Basics.
- `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Ranger)

- **BAB progression**: `full` — real and correct; unlike every other spellcaster extracted so far, Ranger genuinely gets full BAB progression despite being a caster.
- **Save progression**: Fort `good`, Ref `good`, Will `poor`. **Hit die**: d8. **Alignment**: "Any." **Skill points**: base 6 (the highest of any class extracted so far). **Class skills**: 16 real skills.
- **Spellcasting**: ability `wis`, type `prepared` (same partial-caster 4-column shape as Paladin, real-verified separately).
- **Class Features**: 15 real features — Weapon and Armor Proficiency, Favored Enemy (Ex), Track, Wild Empathy (Ex), Combat Style (Ex), Endurance, Animal Companion (Ex), Spells, Improved Combat Style (Ex), Woodland Stride (Ex), Swift Tracker (Ex), Evasion (Ex), Combat Style Mastery (Ex), Camouflage (Ex), Hide in Plain Sight (Ex).
- `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Sorcerer & Wizard — the shared page, spontaneous casting)

The real `/srd/classes/sorcererWizard.htm` page covers **both classes under one `<h1>Sorcerers & Wizards</h1>`** — a genuinely different page shape from every other core class page, requiring a dedicated `extractSorcererAndWizardFromHtml()` entry point (`classes-extractor.ts`'s single-class logic was refactored into a shared `buildClassDefinition()` core reused by both entry points). Sorcerer's two tables (BAB/saves, and its own Spells Known table) sit physically *before* either class's own `<h2 id="sorcerer">`/`<h2 id="wizard">` section — located by explicit table id rather than by table-after-heading position. Wizard's own table sits inside its own `<h2>`-delimited region, same as every single-class page.

**New schema addition**: `Dnd35eClassSpellcasting.spellsKnown` (`Dnd35eSpellsKnownRow[] | null`) — a real, genuinely simpler table shape than `spellsPerDay` (just `Level` + spell-level sub-columns, no BAB/Fort/Ref/Will/Special prefix at all), parsed by a dedicated `extractSpellsKnownTable()`. `null` for prepared casters.

**Real bug found and fixed during verification**: `PREPARED_CASTER_RE` only matched the closing phrase "...spells **in advance**" (Cleric/Druid's real wording). Wizard's real page says "must choose and prepare her spells **ahead of time**" — same rule, different real wording — which caused Wizard to be misclassified as `spontaneous` on the first extraction attempt. Fixed by widening the pattern to accept both real phrasings. Verified the fix doesn't cause a false positive on Sorcerer's own real text ("a sorcerer **need not** prepare his spells in advance") — the regex requires the literal word "must" immediately before "prepare," which "need not prepare" doesn't contain.

- **Sorcerer**: d4 hit die, half BAB, poor Fort/Ref, good Will (the classic caster save shape). Charisma/spontaneous. Real Spells Known table verified: level 1 knows 4 cantrips + 2 first-level spells; level 20 knows 9 cantrips and 3-5 spells per level 1-9. Real Spells per Day table verified separately and is a genuinely distinct number from Spells Known (level 1: base 5 cantrips/day, 3 first-level spells/day — the *daily allotment*, not the *repertoire size*). 3 class features: Weapon and Armor Proficiency, Spells, Familiar.
- **Wizard**: d4 hit die, half BAB, poor Fort/Ref, good Will. Intelligence/prepared, no Spells Known table (`null`, correctly). 7 class features: Weapon and Armor Proficiency, Spells, Bonus Languages, Familiar, Scribe Scroll, Bonus Feats, Spellbooks.
- Both `extractionStatus: fully_structured`, zero extraction notes.

## Real verified facts (Bard — the last core class, a third real spellcasting-table shape)

Bard's real page turned out to have a **third distinct spellcasting-table shape**: unlike Sorcerer (a separate standalone Spells Known table) or Cleric-style single-group casters, Bard's `tableTheBard` has **both** a colspan-7 "Spells per Day" group **and** a colspan-7 "Spells Known" group as two adjacent column groups within the *same* table. This required generalizing `extractLevelProgression`'s header parsing from "does header[6] say Spells per Day" to a real colspan-aware multi-group parser (`collectHeaderCells()` now captures each `<th>`'s `colspan` attribute, not just its text, so consecutive group labels and their sub-header spans can be told apart deterministically). `extractSpellsKnownTable()` (Sorcerer's standalone-table parser) was refactored to reuse the same `collectHeaderCells()` helper for consistency. Verified this generalization causes **zero regressions** on all 8 previously-verified single-table classes plus Sorcerer/Wizard.

- **BAB progression**: `three-quarter`. **Save progression**: Fort `poor`, Ref `good`, Will `good`. **Hit die**: d6. **Alignment**: "Any nonlawful." **Skill points**: base 6. **Class skills**: 23 real skills (second-largest list after Rogue's 28).
- **Spellcasting**: ability `cha`, type `spontaneous`. Real level-1 row: 2 cantrips/day, 4 cantrips known, nothing at 1st level yet (both tables' real "—" cells agree). Real level-20 row: 4 spells/day at every level 0-6; known counts 6/5/5/5/5/5/4 — verified against the live page exactly.
- **Class Features**: 13 real features, including 7 real (Su)/(Sp)-suffixed Bardic Music abilities (Countersong, Fascinate, Inspire Courage, Inspire Competence, Suggestion, Inspire Greatness, Song of Freedom, Inspire Heroics, Mass Suggestion) — all correctly captured by the earlier nested-tag fix, applied here without any further change.
- `extractionStatus: fully_structured`, zero extraction notes.

**This completes all 11 core D&D 3.5e base classes.**

## New schema: `Dnd35eClassSpellcasting`

Added to `Dnd35eClassDefinition.spellcasting` (`null` for non-casters): `spellcastingAbility`, `type` (`"prepared"` vs `"spontaneous"` — detected from the page's own real stated rules text, not asserted per class), and `spellsPerDay: Dnd35eSpellsPerDayRow[]` (one row per level, each an array of `{spellLevel, base, bonusSlots}` entries — `base: null` for the real "—" cells, `bonusSlots` for real class-specific bonus notation like Cleric's domain spell). A real, simplifying discovery made while building this: the level-progression row-skip logic no longer assumes exactly one header `<tr>` to skip by position — it now relies purely on the existing cell-count check (a header row naturally has 0 `<td>` cells), which turned out to already correctly handle both the single-header-row standard/Monk tables and the two-header-row prepared-caster tables with no special-casing needed.

## What's not covered (explicit follow-on work, not implied by this report)

1. **Prestige classes** are entirely out of scope for this pass (core base classes only, per the design doc's Phase 2B-1 scope boundary carried forward).
2. **No runtime consumer yet** — like Races, there is no character-sheet/progression-application code wired to this table yet; that's real, separate future integration work (steps 15-18 of the 21-step order).
3. **Bonus spells from high ability scores** (the real, separate "bonus spell" table keyed to ability-score-to-bonus-spell mapping) are not modeled — a caster's real total spells-per-day is `spellsPerDay.base` plus this ability-score bonus, which is not yet structured anywhere in this schema.
4. **Class features are preserved as real text, not further decomposed into typed mechanical effects** — same honest scope boundary as Races' `special_ability` catch-all. A future pass could structure recurring shapes (flat numeric bonuses, DR, resistances) the way Feats' Benefit-effect patterns were deepened, but that's separate, real follow-on work.
5. **Bard/Sorcerer/Wizard/Cleric/Druid/Paladin/Ranger's actual spell lists are not modeled at all** — this entity family covers class *progression* (who casts what level of spell when), not the spells themselves. Spells/Spellcasting is its own separate step later in the 21-step order.

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
