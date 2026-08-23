import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyD20srdCorpusArea } from "./srd-d20srd-corpus-classification";

test("real path-family prefixes classify correctly (each verified against a real fetch during this revision's research)", () => {
  const cases: Array<[string, string]> = [
    ["/srd/spells/fireball.htm", "spells"],
    ["/srd/spellLists/clericSpells.htm", "spells"],
    ["/srd/monsters/aboleth.htm", "monsters"],
    ["/srd/classes/barbarian.htm", "classes"],
    ["/srd/npcClasses/adept.htm", "classes"],
    ["/srd/prestigeClasses/archmage.htm", "prestige-classes"],
    ["/srd/skills/appraise.htm", "skills"],
    ["/srd/magicItems/rings.htm", "items-equipment"],
    ["/srd/equipment/armor.htm", "items-equipment"],
    ["/srd/combat/initiative.htm", "combat-rules"],
    ["/srd/divine/spells/blacklight.htm", "divine"],
    ["/srd/divine/domains.htm", "divine"],
    ["/srd/epic/monsters/abomination.htm", "epic"],
    ["/srd/psionic/monsters/overview.htm", "psionics"],
    ["/srd/psionic/psionicFeats.htm", "psionics"],
    ["/srd/variant/classes/gestaltCharacters.htm", "open-variants"],
  ];
  for (const [path, expected] of cases) {
    assert.equal(classifyD20srdCorpusArea(path), expected, `"${path}" must classify as "${expected}"`);
  }
});

test("real exact-path rules classify correctly", () => {
  const cases: Array<[string, string]> = [
    ["/srd/feats.htm", "feats"],
    ["/srd/conditionSummary.htm", "conditions"],
    ["/srd/monsterFeats.htm", "monsters"],
    ["/srd/typesSubtypes.htm", "monsters"],
    ["/srd/races.htm", "races"],
  ];
  for (const [path, expected] of cases) {
    assert.equal(classifyD20srdCorpusArea(path), expected, `"${path}" must classify as "${expected}"`);
  }
});

test("the real discovered conflict case: /srd/epic/feats.htm classifies as epic, never monsters, even though a real monsters-rooted page (monsterFeats.htm) links to it", () => {
  // server/srd-manifest-roots-d20srd.ts's "monsters" root (monsterFeats) and
  // "epic" root (epicFeats) both really link to this exact page during a
  // live crawl — verified directly during this revision's research. Under
  // the OLD blind-inheritance design, reaching it via the monsters root
  // would have produced "monsters"; classifyD20srdCorpusArea must produce
  // "epic" regardless of which root asks.
  assert.equal(classifyD20srdCorpusArea("/srd/epic/feats.htm"), "epic");
});

test("a class page linking to a prestige-class page classifies as prestige-classes, not classes — the exact transitive-closure case this correction targets", () => {
  // Real chain: classes root -> /srd/classes/barbarian.htm -> /srd/prestigeClasses/prestigeClasses.htm
  // -> /srd/prestigeClasses/archmage.htm. Regardless of how many hops deep
  // the closure crawl found this page, its classification depends only on
  // its own path.
  assert.equal(classifyD20srdCorpusArea("/srd/prestigeClasses/archmage.htm"), "prestige-classes");
});

test("a Feats-rooted discovery of /srd/skills/appraise.htm still classifies as skills, never feats", () => {
  // The path alone determines the area; there is no "discoveryRootCorpusArea"
  // parameter anymore for a caller to (mis)supply.
  assert.equal(classifyD20srdCorpusArea("/srd/skills/appraise.htm"), "skills");
});

test("the same real path classified twice (simulating two unrelated roots reaching it) is identical both times — classification cannot depend on traversal order", () => {
  const first = classifyD20srdCorpusArea("/srd/epic/feats.htm");
  const second = classifyD20srdCorpusArea("/srd/epic/feats.htm");
  assert.equal(first, second);
  assert.equal(first, "epic");
});

test("a genuinely unresolved path fails loudly rather than defaulting to anything", () => {
  assert.throws(
    () => classifyD20srdCorpusArea("/srd/totallyUnknownFamily/mysteryPage.htm"),
    /Cannot deterministically classify/,
  );
});

test("an explicit override resolves a path the tables don't cover, without changing the tables", () => {
  assert.equal(
    classifyD20srdCorpusArea("/srd/totallyUnknownFamily/mysteryPage.htm", { "/srd/totallyUnknownFamily/mysteryPage.htm": "core" }),
    "core",
  );
});
