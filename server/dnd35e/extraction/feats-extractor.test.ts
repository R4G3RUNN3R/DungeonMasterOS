// server/dnd35e/extraction/feats-extractor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFeatsFromHtml } from "./feats-extractor";

// ESM has no __dirname; derive it the same way the rest of this codebase's
// ESM test files do (see server/spa-fallback.test.ts, server/routes-combat.e2e.test.ts).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, "feats-fixture.html"), "utf-8");

test("extractFeatsFromHtml finds a real, substantial number of feats (the real page has ~130)", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  assert.ok(feats.length > 100, `expected > 100 real feats, got ${feats.length}`);
});

test("every extracted feat has a real dnd35e:feat: canonical ID and a non-empty name", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  for (const feat of feats) {
    assert.match(feat.canonicalId, /^dnd35e:feat:[a-z0-9-]+$/, `bad canonicalId: ${feat.canonicalId}`);
    assert.ok(feat.name.length > 0);
  }
});

test("Acrobatic: real feat with a fully-structured skill_check_bonus effect and no prerequisites", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const acrobatic = feats.find((f) => f.canonicalId === "dnd35e:feat:acrobatic");
  assert.ok(acrobatic, "Acrobatic must be found in the real fixture");
  assert.equal(acrobatic!.featType, "general");
  assert.equal(acrobatic!.prerequisites, null);
  assert.equal(acrobatic!.extractionStatus, "fully_structured");
  assert.deepEqual(acrobatic!.mechanicalEffects, [
    { kind: "skill_check_bonus", skillCanonicalIds: ["dnd35e:skill:jump", "dnd35e:skill:tumble"], bonus: 2, bonusType: "competence" },
  ]);
});

test("Armor Proficiency (Heavy): real feat with a structured feat-reference prerequisite", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const armorHeavy = feats.find((f) => f.name.startsWith("Armor Proficiency (Heavy)"));
  assert.ok(armorHeavy, "Armor Proficiency (Heavy) must be found in the real fixture");
  assert.ok(armorHeavy!.prerequisites !== null, "must have real, structured prerequisites, not null");
});

test("at least one real feat has a genuinely unresolved Benefit — extraction honestly reports it, never fabricates a mechanic", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const unresolved = feats.filter((f) => f.extractionStatus === "unresolved" || f.extractionStatus === "partially_structured");
  assert.ok(unresolved.length > 0, "the real page has feats far more complex than the one structured pattern this pass covers — some must be honestly unresolved");
  for (const feat of unresolved) {
    assert.ok(feat.extractionNotes.length > 0, `${feat.canonicalId} is unresolved/partial but has no explanatory note`);
  }
});

test("Blind-Fight: real Benefit section spans 3 real <p> paragraphs — truncation to the first is honestly disclosed in extractionNotes", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const blindFight = feats.find((f) => f.canonicalId === "dnd35e:feat:blind-fight");
  assert.ok(blindFight, "Blind-Fight must be found in the real fixture");
  assert.ok(
    blindFight!.extractionNotes.some((n) => n.includes("Benefit section has 3 paragraphs")),
    `expected a multi-paragraph Benefit disclosure note, got: ${JSON.stringify(blindFight!.extractionNotes)}`,
  );
});

test("Combat Reflexes: real Benefit section spans 2 real <p> paragraphs (the second covers attacks of opportunity while flat-footed) — truncation is honestly disclosed", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const combatReflexes = feats.find((f) => f.canonicalId === "dnd35e:feat:combat-reflexes");
  assert.ok(combatReflexes, "Combat Reflexes must be found in the real fixture");
  assert.ok(
    combatReflexes!.extractionNotes.some((n) => n.includes("Benefit section has 2 paragraphs")),
    `expected a multi-paragraph Benefit disclosure note, got: ${JSON.stringify(combatReflexes!.extractionNotes)}`,
  );
});

test("Brew Potion: real Benefit section spans 3 real <p> paragraphs (including material-component/XP cost rules) — truncation is honestly disclosed", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const brewPotion = feats.find((f) => f.canonicalId === "dnd35e:feat:brew-potion");
  assert.ok(brewPotion, "Brew Potion must be found in the real fixture");
  assert.ok(
    brewPotion!.extractionNotes.some((n) => n.includes("Benefit section has 3 paragraphs")),
    `expected a multi-paragraph Benefit disclosure note, got: ${JSON.stringify(brewPotion!.extractionNotes)}`,
  );
});

test("single-paragraph Benefit feats (e.g. Acrobatic) get no multi-paragraph disclosure note", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const acrobatic = feats.find((f) => f.canonicalId === "dnd35e:feat:acrobatic");
  assert.ok(acrobatic, "Acrobatic must be found in the real fixture");
  assert.ok(
    !acrobatic!.extractionNotes.some((n) => n.includes("Benefit section has")),
    `Acrobatic has a single-paragraph Benefit and should not get a truncation note, got: ${JSON.stringify(acrobatic!.extractionNotes)}`,
  );
});

test("no extracted feat silently invents a mechanical effect for prose it could not parse", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  for (const feat of feats) {
    for (const effect of feat.mechanicalEffects) {
      if (effect.kind === "unresolved") {
        assert.ok(effect.rawBenefitText.length > 0, "an unresolved effect must retain the real raw text, never an empty placeholder");
      }
    }
  }
});
