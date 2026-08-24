// server/dnd35e/extraction/weapons-extractor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractWeaponsFromHtml } from "./weapons-extractor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEAPONS_HTML = fs.readFileSync(path.join(__dirname, "weapons-table-fixture.html"), "utf-8");

test("extractWeaponsFromHtml: real total counts — 73 weapons + 10 ammunition from 83 real data rows (verified against the live page; catches silently-dropped rows the way the earlier Classes <sup>-in-heading bug was caught)", () => {
  const result = extractWeaponsFromHtml(WEAPONS_HTML);
  assert.equal(result.weapons.length, 73);
  assert.equal(result.ammunition.length, 10);
  assert.deepEqual(result.notes, []);
});

test("extractWeaponsFromHtml: real per-category/group breakdown matches the live page exactly", () => {
  const result = extractWeaponsFromHtml(WEAPONS_HTML);
  const counts: Record<string, number> = {};
  for (const w of result.weapons) {
    const key = `${w.proficiencyCategory}:${w.weaponGroup}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  assert.deepEqual(counts, {
    "simple:unarmed": 2,
    "simple:light-melee": 5,
    "simple:one-handed-melee": 4,
    "simple:two-handed-melee": 3,
    "simple:ranged": 5,
    "martial:light-melee": 10,
    "martial:one-handed-melee": 10,
    "martial:two-handed-melee": 11,
    "martial:ranged": 4,
    "exotic:light-melee": 4,
    "exotic:one-handed-melee": 3,
    "exotic:two-handed-melee": 6,
    "exotic:ranged": 6,
  });
});

test("Dagger: real light melee weapon with a real 'or' damage-type join, real 19-20/x2 critical, real 10 ft. range increment (it's also throwable), fully_structured", () => {
  const spell = extractWeaponsFromHtml(WEAPONS_HTML).weapons.find((w) => w.name === "Dagger")!;
  assert.equal(spell.canonicalId, "dnd35e:weapon:dagger");
  assert.equal(spell.proficiencyCategory, "simple");
  assert.deepEqual(spell.cost, { display: "2 gp", copperPieces: 200 });
  assert.equal(spell.damageSmall, "1d3");
  assert.equal(spell.damageMedium, "1d4");
  assert.equal(spell.criticalThreatRangeLow, 19);
  assert.equal(spell.criticalMultiplier, 2);
  assert.equal(spell.rangeIncrementFt, 10);
  assert.equal(spell.weightLb, 1);
  assert.deepEqual(spell.damageTypes, ["Piercing", "slashing"]);
  assert.equal(spell.damageTypeJoin, "or");
  assert.equal(spell.extractionStatus, "fully_structured");
});

test("Net: a real weapon with no damage/critical/type at all (it entangles rather than damaging) — distinct from ammunition because it still has a real Range Increment", () => {
  const net = extractWeaponsFromHtml(WEAPONS_HTML).weapons.find((w) => w.name === "Net")!;
  assert.equal(net.damageSmall, null);
  assert.equal(net.damageMedium, null);
  assert.equal(net.criticalThreatRangeLow, null);
  assert.equal(net.criticalMultiplier, null);
  assert.equal(net.rangeIncrementFt, 10);
  assert.deepEqual(net.damageTypes, []);
  assert.equal(net.extractionStatus, "fully_structured");
});

test("Hammer, gnome hooked: a real <sup> footnote marker on the name resolves cleanly (no leaked digit in the display name), and a real dual-multiplier critical ('x3/x4', a double weapon's two ends) is honestly disclosed rather than force-parsed", () => {
  const hammer = extractWeaponsFromHtml(WEAPONS_HTML).weapons.find((w) => w.name.includes("gnome hooked"))!;
  assert.equal(hammer.name, "Hammer, gnome hooked");
  assert.deepEqual(hammer.footnotes, ["Double weapon."]);
  assert.equal(hammer.criticalThreatRangeLow, null);
  assert.equal(hammer.extractionStatus, "partially_structured");
  assert.match(hammer.extractionNotes[0], /×3\/×4/);
});

test("Shield, light / Spiked armor / Spiked shield (light & heavy) / Shield, heavy: real 'special' Cost and Weight values (they double as a shield/armor piece whose own cost/weight isn't repeated here) are disclosed with a clear, non-alarming note distinct from a real parse failure", () => {
  const result = extractWeaponsFromHtml(WEAPONS_HTML);
  const specialNamed = ["Shield, light", "Spiked armor", "Spiked shield, light", "Shield, heavy", "Spiked shield, heavy"];
  for (const name of specialNamed) {
    const w = result.weapons.find((x) => x.name === name)!;
    assert.ok(w, `expected to find real weapon "${name}"`);
    assert.equal(w.cost.copperPieces, null);
    assert.equal(w.weightLb, null);
    assert.equal(w.extractionStatus, "partially_structured");
    assert.ok(w.extractionNotes.some((n) => n.includes("special")));
  }
});

test("Longspear: real footnote-4 'Reach weapon.' resolved onto the weapon, Quarterstaff: real footnote-5 'Double weapon.' resolved", () => {
  const result = extractWeaponsFromHtml(WEAPONS_HTML);
  assert.deepEqual(result.weapons.find((w) => w.name === "Longspear")!.footnotes, ["Reach weapon."]);
  assert.deepEqual(result.weapons.find((w) => w.name === "Quarterstaff")!.footnotes, ["Double weapon."]);
});

test("Arrows: real ammunition — quantityPerPurchase parsed from the real '(20)' suffix, name has the suffix stripped, fully_structured; duplicate real rows across different bows (Longbow/Composite Longbow/Shortbow/Composite Shortbow all reference 'Arrows (20)') are extracted once per real row, not deduplicated at extraction time", () => {
  const result = extractWeaponsFromHtml(WEAPONS_HTML);
  const arrowRows = result.ammunition.filter((a) => a.name === "Arrows");
  assert.equal(arrowRows.length, 4);
  for (const a of arrowRows) {
    assert.equal(a.canonicalId, "dnd35e:ammunition:arrows");
    assert.equal(a.quantityPerPurchase, 20);
    assert.equal(a.weightLb, 3);
    assert.equal(a.extractionStatus, "fully_structured");
  }
});

test("extractWeaponsFromHtml throws on a page with no real weapons table (fail-closed)", () => {
  assert.throws(() => extractWeaponsFromHtml("<html><body>not a weapons page</body></html>"));
});
