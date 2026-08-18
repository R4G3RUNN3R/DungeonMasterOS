import assert from "node:assert/strict";
import test from "node:test";
import { parseDnd35SrdFeatDocument } from "./dnd35-srd-feat-importer";

const source = `# FEATS\n\n## Feat Descriptions\n\n### Acrobatic <small>[General]</small>\n\n**Benefit:** You get a +2 bonus on all Jump checks and Tumble checks.\n\n### Augment Summoning <small>[General]</small>\n\n**Prerequisite:** Spell Focus (conjuration).\n\n**Benefit:** Each creature you conjure with any summon spell gains a +4 enhancement bonus to Strength and Constitution for the duration of the spell that summoned it.\n\n### Cleave <small>[General]</small>\n\n**Prerequisites:** Str 13, Power Attack.\n\n**Benefit:** If you deal a creature enough damage to make it drop, you get an immediate extra melee attack against another creature within reach.\n\n**Special:** A fighter may select Cleave as one of his fighter bonus feats.\n\n### Natural Spell <small>[General]</small>\n\n**Prerequisites:** Wis 13, wild shape ability.\n\n**Benefit:** You can complete the verbal and somatic components of spells while in a wild shape.\n`;

test("SRD feat parser creates readable canonical feat records", () => {
  const feats = parseDnd35SrdFeatDocument(source);
  const acrobatic = feats.find((feat) => feat.id === "acrobatic");
  assert.ok(acrobatic);
  assert.deepEqual(acrobatic.categories, ["general"]);
  assert.equal(acrobatic.executionStatus, "reference");
  assert.match(acrobatic.rulesText, /Benefit:/);
  assert.match(acrobatic.rulesSummary, /Jump checks/);
});

test("SRD feat parser turns simple requirements into machine prerequisites", () => {
  const feats = parseDnd35SrdFeatDocument(source);
  const cleave = feats.find((feat) => feat.id === "cleave")!;
  assert.ok(cleave.categories.includes("fighter_bonus"));
  assert.equal(cleave.prerequisites?.kind, "all");
  const requirements = cleave.prerequisites?.kind === "all" ? cleave.prerequisites.requirements : [];
  assert.ok(requirements.some((requirement) => requirement.kind === "ability" && requirement.ability === "str" && requirement.minimum === 13));
  assert.ok(requirements.some((requirement) => requirement.kind === "feat" && requirement.featId === "power-attack"));
});

test("SRD feat parser preserves parameterized and uncertain prerequisites conservatively", () => {
  const feats = parseDnd35SrdFeatDocument(source);
  const augment = feats.find((feat) => feat.id === "augment-summoning")!;
  assert.deepEqual(augment.prerequisites, { kind: "feat", featId: "spell-focus", parameter: "conjuration" });

  const natural = feats.find((feat) => feat.id === "natural-spell")!;
  assert.equal(natural.prerequisites?.kind, "all");
  const requirements = natural.prerequisites?.kind === "all" ? natural.prerequisites.requirements : [];
  assert.ok(requirements.some((requirement) => requirement.kind === "ability" && requirement.ability === "wis" && requirement.minimum === 13));
  assert.ok(requirements.some((requirement) => requirement.kind === "special" && requirement.rule === "wild-shape-ability"));
});
