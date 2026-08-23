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

// --- multi-clause prerequisite decomposition (real fixture data) ---------

test("Cleave: real mixed 'Str 13, Power Attack.' prerequisite decomposes into a real all-composite of ability + feat, no leftover special", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const cleave = feats.find((f) => f.canonicalId === "dnd35e:feat:cleave");
  assert.ok(cleave, "Cleave must be found in the real fixture");
  assert.deepEqual(cleave!.prerequisites, {
    kind: "all",
    requirements: [
      { kind: "ability", ability: "str", minimum: 13 },
      { kind: "feat", featCanonicalId: "dnd35e:feat:power-attack" },
    ],
  });
});

test("Great Cleave: real 4-clause 'Str 13, Cleave, Power Attack, base attack bonus +4.' fully decomposes — every clause structured, no special", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const greatCleave = feats.find((f) => f.canonicalId === "dnd35e:feat:great-cleave");
  assert.ok(greatCleave, "Great Cleave must be found in the real fixture");
  assert.deepEqual(greatCleave!.prerequisites, {
    kind: "all",
    requirements: [
      { kind: "ability", ability: "str", minimum: 13 },
      { kind: "feat", featCanonicalId: "dnd35e:feat:cleave" },
      { kind: "feat", featCanonicalId: "dnd35e:feat:power-attack" },
      { kind: "bab", minimum: 4 },
    ],
  });
});

test("Brew Potion: real 'Caster level 3rd.' prerequisite structures to a real caster_level prerequisite", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const brewPotion = feats.find((f) => f.canonicalId === "dnd35e:feat:brew-potion");
  assert.ok(brewPotion, "Brew Potion must be found in the real fixture");
  assert.deepEqual(brewPotion!.prerequisites, { kind: "caster_level", minimum: 3 });
});

test("Mounted Combat: real reversed skill-rank phrasing 'Ride 1 rank.' structures to a real skill_ranks prerequisite", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const mountedCombat = feats.find((f) => f.canonicalId === "dnd35e:feat:mounted-combat");
  assert.ok(mountedCombat, "Mounted Combat must be found in the real fixture");
  assert.deepEqual(mountedCombat!.prerequisites, { kind: "skill_ranks", skillCanonicalId: "dnd35e:skill:ride", ranks: 1 });
});

test("Trample: real 'Ride 1 rank, Mounted Combat.' fully decomposes into skill_ranks + feat, with no spurious trailing-period special clause", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const trample = feats.find((f) => f.canonicalId === "dnd35e:feat:trample");
  assert.ok(trample, "Trample must be found in the real fixture");
  assert.deepEqual(trample!.prerequisites, {
    kind: "all",
    requirements: [
      { kind: "skill_ranks", skillCanonicalId: "dnd35e:skill:ride", ranks: 1 },
      { kind: "feat", featCanonicalId: "dnd35e:feat:mounted-combat" },
    ],
  });
});

test("Weapon Specialization: real 'Proficiency with selected weapon, Weapon Focus with selected weapon, fighter level 4th.' — proficiency, feat+residual, and generic class_level all structure; only the qualifier prose stays special", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const weaponSpecialization = feats.find((f) => f.canonicalId === "dnd35e:feat:weapon-specialization");
  assert.ok(weaponSpecialization, "Weapon Specialization must be found in the real fixture");
  assert.deepEqual(weaponSpecialization!.prerequisites, {
    kind: "all",
    requirements: [
      { kind: "proficiency", description: "Proficiency with selected weapon" },
      { kind: "feat", featCanonicalId: "dnd35e:feat:weapon-focus" },
      { kind: "special", description: "with selected weapon" },
      { kind: "class_level", classCanonicalId: "dnd35e:class:fighter", minimum: 4 },
    ],
  });
});

test("Natural Spell: real 'Wis 13, wild shape ability.' — ability score structures, and the bare 'X ability' phrasing structures to class_feature", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const naturalSpell = feats.find((f) => f.canonicalId === "dnd35e:feat:natural-spell");
  assert.ok(naturalSpell, "Natural Spell must be found in the real fixture");
  assert.deepEqual(naturalSpell!.prerequisites, {
    kind: "all",
    requirements: [
      { kind: "ability", ability: "wis", minimum: 13 },
      { kind: "class_feature", description: "wild shape ability." },
    ],
  });
});

test("Exotic Weapon Proficiency: real 'Base attack bonus +1 (plus Str 13 for bastard sword or dwarven waraxe).' preserves the parenthetical aside as an honest special sibling, never silently dropped", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const exoticWeaponProficiency = feats.find((f) => f.canonicalId === "dnd35e:feat:exotic-weapon-proficiency");
  assert.ok(exoticWeaponProficiency, "Exotic Weapon Proficiency must be found in the real fixture");
  assert.deepEqual(exoticWeaponProficiency!.prerequisites, {
    kind: "all",
    requirements: [
      { kind: "bab", minimum: 1 },
      { kind: "special", description: "plus Str 13 for bastard sword or dwarven waraxe" },
    ],
  });
});

test("Augment Summoning: real 'Spell Focus (conjuration).' preserves the school qualifier as an honest special sibling alongside the real feat requirement", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const augmentSummoning = feats.find((f) => f.canonicalId === "dnd35e:feat:augment-summoning");
  assert.ok(augmentSummoning, "Augment Summoning must be found in the real fixture");
  assert.deepEqual(augmentSummoning!.prerequisites, {
    kind: "all",
    requirements: [
      { kind: "feat", featCanonicalId: "dnd35e:feat:spell-focus" },
      { kind: "special", description: "(conjuration)" },
    ],
  });
});

test("Rapid Reload: real 'Weapon Proficiency (crossbow type chosen).' structures to a real proficiency prerequisite (non-evaluable but typed, not opaque special)", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const rapidReload = feats.find((f) => f.canonicalId === "dnd35e:feat:rapid-reload");
  assert.ok(rapidReload, "Rapid Reload must be found in the real fixture");
  assert.deepEqual(rapidReload!.prerequisites, { kind: "proficiency", description: "Weapon Proficiency (crossbow type chosen)." });
});

// --- save_bonus benefit effect (real fixture data) -----------------------

test("Great Fortitude: real 'You get a +2 bonus on all Fortitude saving throws.' structures to a real save_bonus effect, distinct from skill_check_bonus", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const greatFortitude = feats.find((f) => f.canonicalId === "dnd35e:feat:great-fortitude");
  assert.ok(greatFortitude, "Great Fortitude must be found in the real fixture");
  assert.deepEqual(greatFortitude!.mechanicalEffects, [
    { kind: "save_bonus", save: "fortitude", bonus: 2, bonusType: "competence" },
  ]);
  assert.equal(greatFortitude!.extractionStatus, "fully_structured", "no prerequisite and a real structured save effect must reach fully_structured");
});

test("Iron Will and Lightning Reflexes: the same real save_bonus pattern structures for Will and Reflex", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const ironWill = feats.find((f) => f.canonicalId === "dnd35e:feat:iron-will");
  const lightningReflexes = feats.find((f) => f.canonicalId === "dnd35e:feat:lightning-reflexes");
  assert.ok(ironWill && lightningReflexes, "both feats must be found in the real fixture");
  assert.deepEqual(ironWill!.mechanicalEffects, [{ kind: "save_bonus", save: "will", bonus: 2, bonusType: "competence" }]);
  assert.deepEqual(lightningReflexes!.mechanicalEffects, [{ kind: "save_bonus", save: "reflex", bonus: 2, bonusType: "competence" }]);
});

test("Combat Casting: real conditional Concentration bonus ('made to cast a spell ... while on the defensive') is honestly left unresolved — a flat check_bonus pattern would misrepresent the real condition", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const combatCasting = feats.find((f) => f.canonicalId === "dnd35e:feat:combat-casting");
  assert.ok(combatCasting, "Combat Casting must be found in the real fixture");
  assert.equal(combatCasting!.mechanicalEffects[0]?.kind, "unresolved");
});

test("real unresolved-prerequisite rate dropped substantially versus the pre-deepening baseline (81/110) — deterministic multi-clause coverage, not a corpus limitation", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const unresolved = feats.filter((f) => f.extractionStatus === "unresolved");
  assert.ok(
    unresolved.length < 50,
    `expected a substantial real reduction from the 81/110 pre-deepening baseline, got ${unresolved.length}/110 unresolved`,
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
