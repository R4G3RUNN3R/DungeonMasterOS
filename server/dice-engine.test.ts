// server/dice-engine.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  modifierFor,
  proficiencyBonusForLevel,
  parseDiceNotation,
  rollDice,
  resolveD20,
  resolveDamage,
  clampNpcStats,
  breakInitiativeTies,
} from "./dice-engine";

test("modifierFor follows the standard d20 curve", () => {
  assert.equal(modifierFor(10), 0);
  assert.equal(modifierFor(11), 0);
  assert.equal(modifierFor(12), 1);
  assert.equal(modifierFor(13), 1);
  assert.equal(modifierFor(8), -1);
  assert.equal(modifierFor(9), -1);
  assert.equal(modifierFor(20), 5);
  assert.equal(modifierFor(1), -5);
});

test("proficiencyBonusForLevel matches the 5e table used in computedStats.ts", () => {
  assert.equal(proficiencyBonusForLevel(1), 2);
  assert.equal(proficiencyBonusForLevel(4), 2);
  assert.equal(proficiencyBonusForLevel(5), 3);
  assert.equal(proficiencyBonusForLevel(8), 3);
  assert.equal(proficiencyBonusForLevel(9), 4);
  assert.equal(proficiencyBonusForLevel(12), 4);
  assert.equal(proficiencyBonusForLevel(13), 5);
  assert.equal(proficiencyBonusForLevel(16), 5);
  assert.equal(proficiencyBonusForLevel(17), 6);
  assert.equal(proficiencyBonusForLevel(20), 6);
});

test("parseDiceNotation accepts valid notation and rejects invalid", () => {
  assert.deepEqual(parseDiceNotation("1d4"), { count: 1, sides: 4 });
  assert.deepEqual(parseDiceNotation("2d6"), { count: 2, sides: 6 });
  assert.deepEqual(parseDiceNotation("10d12"), { count: 10, sides: 12 });
  assert.equal(parseDiceNotation("1d7"), null);
  assert.equal(parseDiceNotation("d6"), null);
  assert.equal(parseDiceNotation("2x6"), null);
  assert.equal(parseDiceNotation(""), null);
});

test("rollDice uses the injected RNG deterministically", () => {
  const scripted = [0.0, 0.99, 0.5];
  let i = 0;
  const rng = () => scripted[i++];
  const results = rollDice(3, 6, rng);
  assert.deepEqual(results, [1, 6, 4]);
});

test("resolveD20: normal success/failure vs a target", () => {
  const rngFor = (value: number) => () => (value - 1) / 20;
  const success = resolveD20({ rng: rngFor(15), modifier: 3, target: 17, kind: "check" });
  assert.equal(success.diceResult, 15);
  assert.equal(success.total, 18);
  assert.equal(success.outcome, "success");
  assert.equal(success.isCritical, false);
  assert.equal(success.isFumble, false);

  const failure = resolveD20({ rng: rngFor(10), modifier: 1, target: 17, kind: "check" });
  assert.equal(failure.outcome, "failure");
});

test("resolveD20: attack ties go to the attacker", () => {
  const rngFor = (value: number) => () => (value - 1) / 20;
  const result = resolveD20({ rng: rngFor(14), modifier: 3, target: 17, kind: "attack" });
  assert.equal(result.total, 17);
  assert.equal(result.outcome, "hit");
});

test("resolveD20: natural 20 is an automatic success/hit regardless of modifier", () => {
  const rngFor = (value: number) => () => (value - 1) / 20;
  const result = resolveD20({ rng: rngFor(20), modifier: -10, target: 30, kind: "attack" });
  assert.equal(result.outcome, "hit");
  assert.equal(result.isCritical, true);
  assert.equal(result.isFumble, false);
});

test("resolveD20: natural 1 is an automatic failure/miss regardless of modifier", () => {
  const rngFor = (value: number) => () => (value - 1) / 20;
  const result = resolveD20({ rng: rngFor(1), modifier: 10, target: 5, kind: "check" });
  assert.equal(result.outcome, "failure");
  assert.equal(result.isFumble, true);
  assert.equal(result.isCritical, false);
});

test("resolveDamage: normal hit rolls the dice once, floors at 1 minimum", () => {
  const scripted = [0.0]; // rolls a 1 on 1d4
  let i = 0;
  const rng = () => scripted[i++];
  const dmg = resolveDamage({ damageDice: "1d4", modifier: -10, isCritical: false, rng });
  assert.equal(dmg, 1); // 1 (die) + -10 (modifier) would be -9, floored to minimum 1
});

test("resolveDamage: critical hit doubles the dice, not the flat modifier", () => {
  const scripted = [0.99, 0.99]; // two max rolls on 1d6 -> 6, 6
  let i = 0;
  const rng = () => scripted[i++];
  const dmg = resolveDamage({ damageDice: "1d6", modifier: 2, isCritical: true, rng });
  assert.equal(dmg, 14); // 6 + 6 (doubled dice) + 2 (modifier, not doubled)
});

test("clampNpcStats clamps out-of-range proposals to the powerLevel tier bounds", () => {
  const clamped = clampNpcStats(
    { hp: 9999, ac: 99, attackBonus: 99, damageDice: "10d12" },
    "low",
  );
  assert.equal(clamped.hp, 20);
  assert.equal(clamped.ac, 14);
  assert.equal(clamped.attackBonus, 3);
  assert.equal(clamped.damageDice, "1d6"); // tier default, since 10d12 exceeds the max-total ceiling
});

test("clampNpcStats leaves in-range proposals untouched", () => {
  const clamped = clampNpcStats(
    { hp: 15, ac: 13, attackBonus: 2, damageDice: "1d6" },
    "low",
  );
  assert.deepEqual(clamped, { hp: 15, ac: 13, attackBonus: 2, damageDice: "1d6" });
});

test("clampNpcStats replaces malformed dice notation with the tier default", () => {
  const clamped = clampNpcStats(
    { hp: 15, ac: 13, attackBonus: 2, damageDice: "not-dice" },
    "standard",
  );
  assert.equal(clamped.damageDice, "2d6");
});

test("breakInitiativeTies: higher DEX modifier wins a tie, then lower id", () => {
  const result = breakInitiativeTies([
    { id: 3, initiative: 15, dexModifier: 1 },
    { id: 1, initiative: 15, dexModifier: 2 },
    { id: 2, initiative: 15, dexModifier: 2 },
    { id: 4, initiative: 18, dexModifier: 0 },
  ]);
  assert.deepEqual(result.map((p) => p.id), [4, 1, 2, 3]);
});
