// server/dnd35e/extraction/classes-extractor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractClassFromHtml } from "./classes-extractor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, "fighter-fixture.html"), "utf-8");
const BARBARIAN_HTML = fs.readFileSync(path.join(__dirname, "barbarian-fixture.html"), "utf-8");
const ROGUE_HTML = fs.readFileSync(path.join(__dirname, "rogue-fixture.html"), "utf-8");
const MONK_HTML = fs.readFileSync(path.join(__dirname, "monk-fixture.html"), "utf-8");
const CLERIC_HTML = fs.readFileSync(path.join(__dirname, "cleric-fixture.html"), "utf-8");
const DRUID_HTML = fs.readFileSync(path.join(__dirname, "druid-fixture.html"), "utf-8");
const PALADIN_HTML = fs.readFileSync(path.join(__dirname, "paladin-fixture.html"), "utf-8");
const RANGER_HTML = fs.readFileSync(path.join(__dirname, "ranger-fixture.html"), "utf-8");

test("Fighter: real canonical ID, name, alignment, hit die", () => {
  const fighter = extractClassFromHtml(FIXTURE_HTML);
  assert.equal(fighter.canonicalId, "dnd35e:class:fighter");
  assert.equal(fighter.name, "Fighter");
  assert.equal(fighter.alignment, "Any.");
  assert.equal(fighter.hitDie, 10);
});

test("Fighter: real full BAB progression and good-Fort/poor-Ref/poor-Will save progression, derived from the real level-20 row", () => {
  const fighter = extractClassFromHtml(FIXTURE_HTML);
  assert.equal(fighter.babProgression, "full");
  assert.deepEqual(fighter.saveProgression, { fort: "good", ref: "poor", will: "poor" });
});

test("Fighter: real 20-row level-progression table, every row's BAB equal to its level (full progression, verified per-row not just at level 20)", () => {
  const fighter = extractClassFromHtml(FIXTURE_HTML);
  assert.equal(fighter.levelProgression.length, 20);
  for (const row of fighter.levelProgression) {
    assert.equal(row.baseAttackBonus, row.level, `level ${row.level} should have BAB equal to level for full progression`);
  }
});

test("Fighter: real good-save progression matches the exact floor(level/2)+2 curve at every level", () => {
  const fighter = extractClassFromHtml(FIXTURE_HTML);
  for (const row of fighter.levelProgression) {
    assert.equal(row.fortSave, Math.floor(row.level / 2) + 2, `level ${row.level} Fort save`);
  }
});

test("Fighter: real 'Bonus feat' Special-column entries appear at exactly the real levels (1, 2, then every 2 levels)", () => {
  const fighter = extractClassFromHtml(FIXTURE_HTML);
  const bonusFeatLevels = fighter.levelProgression.filter((r) => r.specialFeatureSlugs.includes("bonusFeats")).map((r) => r.level);
  assert.deepEqual(bonusFeatLevels, [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
});

test("Fighter: real 7 class skills with correct key abilities, resolved to real canonical skill IDs", () => {
  const fighter = extractClassFromHtml(FIXTURE_HTML);
  assert.deepEqual(fighter.classSkills, [
    { skillCanonicalId: "dnd35e:skill:climb", keyAbility: "str" },
    { skillCanonicalId: "dnd35e:skill:craft", keyAbility: "int" },
    { skillCanonicalId: "dnd35e:skill:handle-animal", keyAbility: "cha" },
    { skillCanonicalId: "dnd35e:skill:intimidate", keyAbility: "cha" },
    { skillCanonicalId: "dnd35e:skill:jump", keyAbility: "str" },
    { skillCanonicalId: "dnd35e:skill:ride", keyAbility: "dex" },
    { skillCanonicalId: "dnd35e:skill:swim", keyAbility: "str" },
  ]);
});

test("Fighter: real skillPointsBase of 2 (matches '2 + Int modifier' on the real page)", () => {
  const fighter = extractClassFromHtml(FIXTURE_HTML);
  assert.equal(fighter.skillPointsBase, 2);
});

test("Fighter: real 2 class features, including the multi-paragraph Bonus Feats description captured in full (not truncated to the first paragraph)", () => {
  const fighter = extractClassFromHtml(FIXTURE_HTML);
  assert.equal(fighter.classFeatures.length, 2);
  const weaponProf = fighter.classFeatures.find((f) => f.slug === "weapon-and-armor-proficiency");
  const bonusFeats = fighter.classFeatures.find((f) => f.slug === "bonusFeats");
  assert.ok(weaponProf, "Weapon and Armor Proficiency (no real page id, kebab-cased from its name) must be found");
  assert.ok(bonusFeats, "Bonus Feats (real page id='bonusFeats') must be found");
  assert.match(bonusFeats!.description, /bonus combat-oriented feat/);
  assert.match(bonusFeats!.description, /not limited to the list of fighter bonus feats/, "the real second paragraph must be captured, not truncated");
});

test("Fighter: fully_structured with zero extraction notes — every real section on this page matched", () => {
  const fighter = extractClassFromHtml(FIXTURE_HTML);
  assert.equal(fighter.extractionStatus, "fully_structured");
  assert.deepEqual(fighter.extractionNotes, []);
});

test("extractClassFromHtml throws on a page with no real class name (fail-closed, never silently returns a garbage definition)", () => {
  assert.throws(() => extractClassFromHtml("<html><body>not a class page</body></html>"));
});

// --- Barbarian: real header cells with attributes and <br/>-split labels --

test("Barbarian: real <th align=\"left\">Base<br />Attack Bonus</th> header cells (attributes + line-break-split labels) are normalized and don't trip the fail-closed header check", () => {
  const barbarian = extractClassFromHtml(BARBARIAN_HTML);
  assert.equal(barbarian.canonicalId, "dnd35e:class:barbarian");
  assert.equal(barbarian.extractionStatus, "fully_structured");
  assert.equal(barbarian.levelProgression.length, 20);
});

test("Barbarian: real d12 hit die, full BAB, good Fort / poor Ref+Will, 'Any nonlawful' alignment (a real compound restriction, not force-flattened)", () => {
  const barbarian = extractClassFromHtml(BARBARIAN_HTML);
  assert.equal(barbarian.hitDie, 12);
  assert.equal(barbarian.babProgression, "full");
  assert.deepEqual(barbarian.saveProgression, { fort: "good", ref: "poor", will: "poor" });
  assert.equal(barbarian.alignment, "Any nonlawful.");
  assert.equal(barbarian.skillPointsBase, 4);
});

// --- Rogue: real <h2 id> class name (not <h1>) ----------------------------

test("Rogue: real <h2 id=\"rogue\">Rogue</h2> class name (this page uses h2, not h1, like every other class) is still resolved correctly", () => {
  const rogue = extractClassFromHtml(ROGUE_HTML);
  assert.equal(rogue.canonicalId, "dnd35e:class:rogue");
  assert.equal(rogue.name, "Rogue");
  assert.equal(rogue.extractionStatus, "fully_structured");
});

test("Rogue: real d6 hit die, three-quarter BAB, good Ref / poor Fort+Will, 8+Int skill points, 28 real class skills (the largest class skill list in core 3.5)", () => {
  const rogue = extractClassFromHtml(ROGUE_HTML);
  assert.equal(rogue.hitDie, 6);
  assert.equal(rogue.babProgression, "three-quarter");
  assert.deepEqual(rogue.saveProgression, { fort: "poor", ref: "good", will: "poor" });
  assert.equal(rogue.skillPointsBase, 8);
  assert.equal(rogue.classSkills.length, 28);
});

test("Rogue: real three-quarter BAB progression matches the exact floor(level*3/4) curve at every level", () => {
  const rogue = extractClassFromHtml(ROGUE_HTML);
  for (const row of rogue.levelProgression) {
    assert.equal(row.baseAttackBonus, Math.floor((row.level * 3) / 4), `level ${row.level} BAB`);
  }
});

test("Rogue: real Sneak Attack and Trapfinding class features are present with real descriptions", () => {
  const rogue = extractClassFromHtml(ROGUE_HTML);
  const sneakAttack = rogue.classFeatures.find((f) => f.slug === "sneakAttack");
  const trapfinding = rogue.classFeatures.find((f) => f.slug === "trapfinding");
  assert.ok(sneakAttack && sneakAttack.description.length > 0);
  assert.ok(trapfinding && trapfinding.description.length > 0);
});

// --- Monk: real 10-column table (4 unique extra columns) ------------------

test("Monk: real <th>Unarmed<br />Damage<sup>1</sup></th> footnote-marker header is stripped correctly, and the real 10-column table is recognized (not rejected by the fail-closed header check)", () => {
  const monk = extractClassFromHtml(MONK_HTML);
  assert.equal(monk.canonicalId, "dnd35e:class:monk");
  assert.equal(monk.extractionStatus, "fully_structured");
  assert.equal(monk.levelProgression.length, 20);
});

test("Monk: real d8 hit die, three-quarter BAB, all three saves good (Monk is the only core class with all-good saves), 'Any lawful' alignment", () => {
  const monk = extractClassFromHtml(MONK_HTML);
  assert.equal(monk.hitDie, 8);
  assert.equal(monk.babProgression, "three-quarter");
  assert.deepEqual(monk.saveProgression, { fort: "good", ref: "good", will: "good" });
  assert.equal(monk.alignment, "Any lawful.");
  assert.equal(monk.skillPointsBase, 4);
});

test("Monk: real tfoot footnote row (a single <td colspan=\"10\"> cell) is correctly skipped, not mistaken for a data row", () => {
  const monk = extractClassFromHtml(MONK_HTML);
  const levels = monk.levelProgression.map((r) => r.level);
  assert.deepEqual(levels, Array.from({ length: 20 }, (_, i) => i + 1), "every level 1-20 must appear exactly once, with no extra row from the footnote");
});

test("Monk: real level 1 and level 20 rows have the correct real Flurry of Blows / Unarmed Damage / AC Bonus / Unarmored Speed Bonus values", () => {
  const monk = extractClassFromHtml(MONK_HTML);
  const level1 = monk.levelProgression.find((r) => r.level === 1);
  const level20 = monk.levelProgression.find((r) => r.level === 20);
  assert.deepEqual(
    { flurry: level1?.flurryOfBlowsAttackBonus, damage: level1?.unarmedDamage, ac: level1?.acBonus, speed: level1?.unarmoredSpeedBonus },
    { flurry: "-2/-2", damage: "1d6", ac: 0, speed: 0 },
  );
  assert.deepEqual(
    { flurry: level20?.flurryOfBlowsAttackBonus, damage: level20?.unarmedDamage, ac: level20?.acBonus, speed: level20?.unarmoredSpeedBonus },
    { flurry: "+15/+15/+15/+10/+5", damage: "2d10", ac: 4, speed: 60 },
  );
});

test("Monk: real non-Monk classes never populate the Monk-specific optional progression fields", () => {
  const fighter = extractClassFromHtml(FIXTURE_HTML);
  for (const row of fighter.levelProgression) {
    assert.equal(row.flurryOfBlowsAttackBonus, undefined);
    assert.equal(row.unarmedDamage, undefined);
    assert.equal(row.acBonus, undefined);
    assert.equal(row.unarmoredSpeedBonus, undefined);
  }
});

// --- Cleric: real two-row "Spells per Day" grouped-header table -----------

test("non-spellcasting classes (Fighter/Barbarian/Rogue/Monk) all have spellcasting: null", () => {
  for (const html of [FIXTURE_HTML, BARBARIAN_HTML, ROGUE_HTML, MONK_HTML]) {
    const cls = extractClassFromHtml(html);
    assert.equal(cls.spellcasting, null);
  }
});

test("Cleric: real two-row grouped 'Spells per Day' header (rowspan-2 standard cells + colspan-10 group label + 10 spell-level sub-headers) is recognized, not rejected by the fail-closed header check", () => {
  const cleric = extractClassFromHtml(CLERIC_HTML);
  assert.equal(cleric.canonicalId, "dnd35e:class:cleric");
  assert.equal(cleric.extractionStatus, "fully_structured");
  assert.equal(cleric.levelProgression.length, 20);
});

test("Cleric: real spellcasting ability (Wisdom) and type (prepared) are correctly detected from the real page's own stated rules text", () => {
  const cleric = extractClassFromHtml(CLERIC_HTML);
  assert.ok(cleric.spellcasting);
  assert.equal(cleric.spellcasting!.spellcastingAbility, "wis");
  assert.equal(cleric.spellcasting!.type, "prepared");
});

test("Cleric: real level-1 Spells per Day row — 3 cantrips, 1 first-level spell plus the real +1 domain-spell bonus slot, nothing at 2nd level or higher (real '—' cells)", () => {
  const cleric = extractClassFromHtml(CLERIC_HTML);
  const level1 = cleric.spellcasting!.spellsPerDay.find((r) => r.level === 1);
  assert.ok(level1);
  assert.deepEqual(level1!.entries[0], { spellLevel: 0, base: 3, bonusSlots: 0 });
  assert.deepEqual(level1!.entries[1], { spellLevel: 1, base: 1, bonusSlots: 1 });
  for (let i = 2; i <= 9; i++) {
    assert.deepEqual(level1!.entries[i], { spellLevel: i, base: null, bonusSlots: 0 }, `level 1 spell-level ${i} must be unavailable ("—")`);
  }
});

test("Cleric: real level-20 Spells per Day row has the real domain-spell +1 bonus slot on every available spell level 1-9", () => {
  const cleric = extractClassFromHtml(CLERIC_HTML);
  const level20 = cleric.spellcasting!.spellsPerDay.find((r) => r.level === 20);
  assert.ok(level20);
  for (let i = 1; i <= 9; i++) {
    assert.equal(level20!.entries[i].bonusSlots, 1, `level 20 spell-level ${i} should carry the real domain-spell bonus slot`);
  }
  assert.equal(level20!.entries[0].bonusSlots, 0, "cantrips (spell level 0) never get a domain-spell bonus slot");
});

// --- real bug regression: <h5> headings with a nested (Ex)/(Su) tag -------
//
// Found on Druid: FEATURE_BLOCK_RE originally required a heading's text to
// contain no nested tags at all (`[^<]+`). A heading like
// <h5 id="wildShape">Wild Shape (<a href="...">Su</a>)</h5> — a real,
// extremely common 3.5 class-feature pattern (every (Ex)/(Su)/(Sp)-tagged
// ability-type suffix links to specialAbilities.htm) — silently failed to
// match at all. Not truncated, not swallowed into a neighboring feature's
// description: just invisible, with zero extractionNotes disclosing the
// loss. This silently dropped 10 of Druid's real features, and (discovered
// only once this was fixed) had already been silently dropping real
// features from every already-extracted class with an (Ex)/(Su) feature:
// Barbarian (10 of 12 features), Rogue (5 of 8), Monk (16 of 21), and
// Cleric (2 of 8). These tests assert real, exact, verified-against-the-
// live-page feature counts so this exact bug class can never regress
// silently again.

test("Druid: real 21 class features, including every (Ex)/(Su)-suffixed feature (Animal Companion, Nature Sense, Wild Empathy, Woodland Stride, Trackless Step, Resist Nature's Lure, Wild Shape, Venom Immunity, A Thousand Faces, Timeless Body) that the nested-tag bug used to drop silently", () => {
  const druid = extractClassFromHtml(DRUID_HTML);
  assert.equal(druid.classFeatures.length, 21);
  const wildShape = druid.classFeatures.find((f) => f.slug === "wildShape");
  assert.ok(wildShape);
  assert.equal(wildShape!.name, "Wild Shape (Su)");
  assert.ok(wildShape!.description.length > 100, "Wild Shape's real description must be captured, not empty");
  const animalCompanion = druid.classFeatures.find((f) => f.slug === "animalCompanion");
  assert.ok(animalCompanion);
  assert.equal(animalCompanion!.name, "Animal Companion (Ex)");
});

test("Druid: real full BAB/save/spellcasting facts — three-quarter BAB, good Fort+Will (poor Ref), Wisdom/prepared spellcasting with no domain-spell bonus slots (unlike Cleric)", () => {
  const druid = extractClassFromHtml(DRUID_HTML);
  assert.equal(druid.babProgression, "three-quarter");
  assert.deepEqual(druid.saveProgression, { fort: "good", ref: "poor", will: "good" });
  assert.ok(druid.spellcasting);
  assert.equal(druid.spellcasting!.spellcastingAbility, "wis");
  assert.equal(druid.spellcasting!.type, "prepared");
  const level20 = druid.spellcasting!.spellsPerDay.find((r) => r.level === 20)!;
  assert.ok(level20.entries.every((e) => e.bonusSlots === 0), "Druids get no domain-spell bonus slots, unlike Cleric");
});

test("Barbarian: real 12 class features (the nested-tag bug used to only see 2)", () => {
  const barbarian = extractClassFromHtml(BARBARIAN_HTML);
  assert.equal(barbarian.classFeatures.length, 12);
  assert.ok(barbarian.classFeatures.find((f) => f.slug === "rage" && f.name === "Rage (Ex)"));
});

test("Rogue: real 8 class features (the nested-tag bug used to only see 4)", () => {
  const rogue = extractClassFromHtml(ROGUE_HTML);
  assert.equal(rogue.classFeatures.length, 8);
  assert.ok(rogue.classFeatures.find((f) => f.slug === "rogueEvasion" && f.name === "Evasion (Ex)"));
});

test("Monk: real 21 class features (the nested-tag bug used to only see 4)", () => {
  const monk = extractClassFromHtml(MONK_HTML);
  assert.equal(monk.classFeatures.length, 21);
  assert.ok(monk.classFeatures.find((f) => f.slug === "kiStrike" && f.name === "Ki Strike (Su)"));
});

test("Cleric: real 8 class features (the nested-tag bug used to only see 6, silently dropping Aura and Turn or Rebuke Undead)", () => {
  const cleric = extractClassFromHtml(CLERIC_HTML);
  assert.equal(cleric.classFeatures.length, 8);
  assert.ok(cleric.classFeatures.find((f) => f.slug === "aura" && f.name === "Aura (Ex)"));
  assert.ok(cleric.classFeatures.find((f) => f.slug === "turnorRebukeUndead" && f.name === "Turn or Rebuke Undead (Su)"));
});

// --- Paladin: real partial-caster table (4 spell-level columns, no cantrips) ---

test("Paladin: real 4-column 'Spells per Day' table (1st-4th level only, no cantrip column) is recognized and parsed correctly — the generic prepared-caster detection needed no changes for this partial-caster shape", () => {
  const paladin = extractClassFromHtml(PALADIN_HTML);
  assert.equal(paladin.canonicalId, "dnd35e:class:paladin");
  assert.equal(paladin.extractionStatus, "fully_structured");
  assert.ok(paladin.spellcasting);
  assert.equal(paladin.spellcasting!.spellsPerDay[0].entries.length, 4);
  assert.deepEqual(paladin.spellcasting!.spellsPerDay[0].entries.map((e) => e.spellLevel), [1, 2, 3, 4]);
});

test("Paladin: real level-1-3 rows have no spellcasting at all (real '—'), level 4 has a real '0' entry (caster level high enough but base allotment is 0 — distinct from unavailable), matching the live page exactly", () => {
  const paladin = extractClassFromHtml(PALADIN_HTML);
  const level3 = paladin.spellcasting!.spellsPerDay.find((r) => r.level === 3)!;
  const level4 = paladin.spellcasting!.spellsPerDay.find((r) => r.level === 4)!;
  assert.ok(level3.entries.every((e) => e.base === null), "level 3 Paladin has no real spellcasting yet");
  assert.deepEqual(level4.entries[0], { spellLevel: 1, base: 0, bonusSlots: 0 }, "level 4 first-level spells: a real 0, not null/unavailable");
  assert.equal(level4.entries[1].base, null, "level 4 second-level spells still unavailable");
});

test("Paladin: real d10 hit die, full BAB, good Fort / poor Ref+Will, 'Lawful good' fixed alignment, real 15 class features including (Ex)/(Sp)/(Su)-suffixed ones", () => {
  const paladin = extractClassFromHtml(PALADIN_HTML);
  assert.equal(paladin.hitDie, 10);
  assert.equal(paladin.babProgression, "full");
  assert.deepEqual(paladin.saveProgression, { fort: "good", ref: "poor", will: "poor" });
  assert.equal(paladin.alignment, "Lawful good.");
  assert.equal(paladin.classFeatures.length, 15);
  assert.ok(paladin.classFeatures.find((f) => f.slug === "smiteEvil" && f.name === "Smite Evil (Su)"));
  assert.ok(paladin.classFeatures.find((f) => f.slug === "detectEvil" && f.name === "Detect Evil (Sp)"));
});

// --- Ranger: real partial-caster, real full BAB (unusual for a caster) ----

test("Ranger: real full BAB (unusual among casters — every other caster in this pass is three-quarter or full-but-non-caster), good Fort+Ref / poor Will, d8, 'Any' alignment, wis/prepared spellcasting", () => {
  const ranger = extractClassFromHtml(RANGER_HTML);
  assert.equal(ranger.canonicalId, "dnd35e:class:ranger");
  assert.equal(ranger.extractionStatus, "fully_structured");
  assert.equal(ranger.babProgression, "full");
  assert.deepEqual(ranger.saveProgression, { fort: "good", ref: "good", will: "poor" });
  assert.equal(ranger.hitDie, 8);
  assert.equal(ranger.alignment, "Any.");
  assert.ok(ranger.spellcasting);
  assert.equal(ranger.spellcasting!.spellcastingAbility, "wis");
  assert.equal(ranger.spellcasting!.type, "prepared");
});

test("Ranger: real 15 class features, including (Ex)-suffixed ones the nested-tag bug used to drop (Favored Enemy, Wild Empathy, Combat Style, Animal Companion, Evasion, Camouflage, Hide in Plain Sight)", () => {
  const ranger = extractClassFromHtml(RANGER_HTML);
  assert.equal(ranger.classFeatures.length, 15);
  assert.ok(ranger.classFeatures.find((f) => f.slug === "favoredEnemy" && f.name === "Favored Enemy (Ex)"));
  assert.ok(ranger.classFeatures.find((f) => f.slug === "rangerEvasion" && f.name === "Evasion (Ex)"));
  assert.ok(ranger.classFeatures.find((f) => f.slug === "hideinPlainSight" && f.name === "Hide in Plain Sight (Ex)"));
});
