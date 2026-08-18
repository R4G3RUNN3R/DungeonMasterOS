import assert from "node:assert/strict";
import test from "node:test";
import { getKnowledgeShelves } from "./knowledge-library";
import { evaluateDnd35FeatPrerequisites } from "@shared/dnd35-rules/feat-prerequisites";
import { getDnd35Feat, getDnd35Grimoire, getDnd35HolyTome } from "@shared/dnd35-rules/catalogue";

test("Library of Knowledge keeps 3.5 and 5e item shelves mechanically separate", () => {
  const shelves = getKnowledgeShelves();
  const dnd35 = shelves.find((shelf) => shelf.ruleset === "dnd35e");
  const dnd5e = shelves.find((shelf) => shelf.ruleset === "dnd5e");

  assert.ok(dnd35, "expected a D&D 3.5 shelf");
  assert.ok(dnd5e, "expected a D&D 5e shelf");

  const dnd35Items = dnd35.volumes.find((volume) => volume.kind === "items");
  const dnd5eItems = dnd5e.volumes.find((volume) => volume.kind === "items");

  assert.equal(dnd35Items?.status, "cataloguing");
  assert.equal(dnd35Items?.href, undefined, "5e item data must never be exposed as the 3.5 Item Compendium");
  assert.equal(dnd5eItems?.status, "available");
  assert.equal(dnd5eItems?.href, "/compendium");
});

test("Grimoire and Holy Tome are projections over one canonical spell corpus", () => {
  const grimoireIds = new Set(getDnd35Grimoire().map((spell) => spell.id));
  const holyIds = new Set(getDnd35HolyTome().map((spell) => spell.id));

  assert.ok(grimoireIds.has("fireball"));
  assert.ok(grimoireIds.has("cure-light-wounds"), "bard access makes Cure Light Wounds part of the arcane projection");
  assert.ok(holyIds.has("cure-light-wounds"));
  assert.ok(holyIds.has("dispel-magic"));
  assert.ok(!holyIds.has("fireball"));
});

test("core metamagic definitions expose executable slot rules", () => {
  const empower = getDnd35Feat("empower-spell");
  const heighten = getDnd35Feat("heighten-spell");
  const still = getDnd35Feat("still-spell");

  assert.equal(empower?.metamagic?.slotAdjustment, 2);
  assert.equal(heighten?.metamagic?.slotAdjustment, "variable");
  assert.equal(heighten?.metamagic?.effectiveSpellLevel, "slot_level");
  assert.ok(still?.metamagic?.transformations.some((rule) => rule.target === "spell.components.S" && rule.operation === "remove"));
});

test("feat prerequisites reject characters that do not meet canonical requirements", () => {
  const naturalSpell = getDnd35Feat("natural-spell");
  assert.ok(naturalSpell?.prerequisites);

  const failed = evaluateDnd35FeatPrerequisites(naturalSpell!.prerequisites, {
    abilities: { wis: 12 },
    characterLevel: 5,
    specialFlags: [],
  });
  assert.equal(failed.qualified, false);
  assert.ok(failed.failures.some((failure) => failure.includes("WIS 13")));
  assert.ok(failed.failures.some((failure) => failure.includes("wild-shape")));

  const passed = evaluateDnd35FeatPrerequisites(naturalSpell!.prerequisites, {
    abilities: { wis: 14 },
    characterLevel: 5,
    specialFlags: ["wild-shape"],
  });
  assert.equal(passed.qualified, true);
});
