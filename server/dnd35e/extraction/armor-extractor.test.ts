// server/dnd35e/extraction/armor-extractor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractArmorFromHtml } from "./armor-extractor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARMOR_HTML = fs.readFileSync(path.join(__dirname, "armor-table-fixture.html"), "utf-8");

test("extractArmorFromHtml: real total count and per-category breakdown matches the live page exactly (4 light + 4 medium + 4 heavy + 6 shields + 3 extras = 21)", () => {
  const result = extractArmorFromHtml(ARMOR_HTML);
  assert.equal(result.armor.length, 21);
  assert.deepEqual(result.notes, []);
  const counts: Record<string, number> = {};
  for (const a of result.armor) counts[a.category] = (counts[a.category] ?? 0) + 1;
  assert.deepEqual(counts, { light: 4, medium: 4, heavy: 4, shield: 6, extra: 3 });
});

test("Chainmail: real medium armor, full structured shape, fully_structured", () => {
  const chainmail = extractArmorFromHtml(ARMOR_HTML).armor.find((a) => a.name === "Chainmail")!;
  assert.equal(chainmail.canonicalId, "dnd35e:armor:chainmail");
  assert.deepEqual(chainmail.cost, { display: "150 gp", copperPieces: 15000 });
  assert.equal(chainmail.armorOrShieldBonus, 5);
  assert.equal(chainmail.maxDexBonus, 2);
  assert.equal(chainmail.armorCheckPenalty, -5);
  assert.equal(chainmail.arcaneSpellFailureChancePercent, 30);
  assert.equal(chainmail.speedAt30FtBaseFt, 20);
  assert.equal(chainmail.speedAt20FtBaseFt, 15);
  assert.equal(chainmail.weightLb, 40);
  assert.equal(chainmail.extractionStatus, "fully_structured");
});

test("Full plate: real comma-thousands cost ('1,500 gp' -> 150000 copper), real footnote-2 'triple speed' resolved on both real Speed cells (only captured once in the deduped footnotes array)", () => {
  const fullPlate = extractArmorFromHtml(ARMOR_HTML).armor.find((a) => a.name === "Full plate")!;
  assert.deepEqual(fullPlate.cost, { display: "1,500 gp", copperPieces: 150000 });
  assert.deepEqual(fullPlate.footnotes, ["When running in heavy armor, you move only triple your speed, not quadruple."]);
});

test("Shield, tower: real footnote-3 'cover' resolved; shields have null speed (they never reduce movement)", () => {
  const tower = extractArmorFromHtml(ARMOR_HTML).armor.find((a) => a.name === "Shield, tower")!;
  assert.deepEqual(tower.footnotes, ["A tower shield can instead grant you cover."]);
  assert.equal(tower.speedAt30FtBaseFt, null);
  assert.equal(tower.speedAt20FtBaseFt, null);
  assert.equal(tower.armorCheckPenalty, -10);
});

test("Gauntlet, locked: real 'Special' Armor Check Penalty is a distinct, disclosed third state — not folded into the same null as a real '—' cell, and not a parse failure", () => {
  const gauntlet = extractArmorFromHtml(ARMOR_HTML).armor.find((a) => a.name === "Gauntlet, locked")!;
  assert.equal(gauntlet.armorCheckPenalty, null);
  assert.equal(gauntlet.extractionStatus, "partially_structured");
  assert.match(gauntlet.extractionNotes[0], /Special/);
  assert.deepEqual(gauntlet.footnotes, ["Hand not free to cast spells."]);
});

test("Armor spikes / Shield spikes: real '+N gp'/'+N lb.' additive cost and weight (add-ons to a base armor/shield piece) parse to their real positive numeric value with the '+' preserved in display text", () => {
  const result = extractArmorFromHtml(ARMOR_HTML);
  const spikes = result.armor.find((a) => a.name === "Armor spikes")!;
  assert.deepEqual(spikes.cost, { display: "+50 gp", copperPieces: 5000 });
  assert.equal(spikes.weightLb, 10);
  assert.equal(spikes.category, "extra");
  const shieldSpikes = result.armor.find((a) => a.name === "Shield spikes")!;
  assert.deepEqual(shieldSpikes.cost, { display: "+10 gp", copperPieces: 1000 });
  assert.equal(shieldSpikes.weightLb, 5);
});

test("extractArmorFromHtml throws on a page with no real armor table (fail-closed)", () => {
  assert.throws(() => extractArmorFromHtml("<html><body>not an armor page</body></html>"));
});
