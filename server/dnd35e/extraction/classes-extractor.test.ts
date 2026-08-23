// server/dnd35e/extraction/classes-extractor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractClassFromHtml } from "./classes-extractor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, "fighter-fixture.html"), "utf-8");

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
