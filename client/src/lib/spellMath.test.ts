// client/src/lib/spellMath.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { spellSaveDcFor3e, resolveCastingAbilityScore } from "./spellMath";

test("spellSaveDcFor3e: DC = 10 + spell level + ability modifier", () => {
  assert.equal(spellSaveDcFor3e(0, 3), 13); // cantrip/0-level, +3 mod
  assert.equal(spellSaveDcFor3e(3, 3), 16); // 3rd-level spell, +3 mod
  assert.equal(spellSaveDcFor3e(9, 5), 24); // 9th-level spell, +5 mod
});

test("spellSaveDcFor3e: a negative ability modifier still lowers the DC correctly", () => {
  assert.equal(spellSaveDcFor3e(1, -1), 10);
});

test("resolveCastingAbilityScore: finds the real ability score/modifier by 3-letter key", () => {
  const abilities = {
    str: { score: 10, modifier: 0 },
    dex: { score: 12, modifier: 1 },
    con: { score: 14, modifier: 2 },
    int: { score: 18, modifier: 4 },
    wis: { score: 16, modifier: 3 },
    cha: { score: 8, modifier: -1 },
  };
  assert.deepEqual(resolveCastingAbilityScore(abilities, "INT"), { score: 18, modifier: 4 });
  assert.deepEqual(resolveCastingAbilityScore(abilities, "wis"), { score: 16, modifier: 3 });
});

test("resolveCastingAbilityScore: returns null for a non-ability casting-ability value (e.g. 'Custom')", () => {
  const abilities = {
    str: { score: 10, modifier: 0 }, dex: { score: 10, modifier: 0 }, con: { score: 10, modifier: 0 },
    int: { score: 10, modifier: 0 }, wis: { score: 10, modifier: 0 }, cha: { score: 10, modifier: 0 },
  };
  assert.equal(resolveCastingAbilityScore(abilities, "Custom"), null);
});
