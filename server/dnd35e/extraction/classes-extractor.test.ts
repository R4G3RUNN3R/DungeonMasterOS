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
