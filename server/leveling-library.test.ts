import assert from "node:assert/strict";
import test from "node:test";
import { abilityIncreasePointsForLevel, isAsiLevel, isGeneralFeatLevel } from "./leveling";

test("D&D 3.5 general feats occur every third character level", () => {
  const featLevels = Array.from({ length: 20 }, (_, index) => index + 1).filter((level) => isGeneralFeatLevel(level, "dnd35e"));
  assert.deepEqual(featLevels, [3, 6, 9, 12, 15, 18]);
});

test("D&D 3.5 universal ability increases are +1 every fourth level", () => {
  const abilityLevels = Array.from({ length: 20 }, (_, index) => index + 1).filter((level) => isAsiLevel(level, "dnd35e"));
  assert.deepEqual(abilityLevels, [4, 8, 12, 16, 20]);
  for (const level of abilityLevels) assert.equal(abilityIncreasePointsForLevel(level, "dnd35e"), 1);
  assert.equal(abilityIncreasePointsForLevel(3, "dnd35e"), 0);
});

test("D&D 3.5 level 12 grants both universal benefits", () => {
  assert.equal(isGeneralFeatLevel(12, "dnd35e"), true);
  assert.equal(isAsiLevel(12, "dnd35e"), true);
  assert.equal(abilityIncreasePointsForLevel(12, "dnd35e"), 1);
});

test("5e keeps its existing ASI schedule and has no universal separate feat schedule", () => {
  assert.equal(isAsiLevel(4, "dnd5e"), true);
  assert.equal(abilityIncreasePointsForLevel(4, "dnd5e"), 2);
  assert.equal(isGeneralFeatLevel(4, "dnd5e"), false);
});
