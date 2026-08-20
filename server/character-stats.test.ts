// server/character-stats.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCharacterModifier, babForLevel, iterativeAttackBonuses, computeFullCharacterSheet } from "./character-stats";
import { getRace, applyRacialAdjustments, racesForRuleset } from "@shared/races";

function fakeStorage(overrides: Partial<Record<string, any>> = {}) {
  return {
    getCharacter: (id: number) => ({
      id,
      level: 5,
      str: 14,
      dex: 16,
      con: 12,
      int: 10,
      wis: 10,
      cha: 8,
      proficiencies: JSON.stringify(["Stealth", "Constitution Save"]),
      charClass: "Fighter",
      ...overrides,
    }),
    getActiveEffectsByCharacter: (_id: number) => overrides.effects ?? [],
    getItemsByCharacter: (_id: number) => overrides.items ?? [],
  };
}

test("resolveCharacterModifier: base ability modifier only, no proficiency", () => {
  const result = resolveCharacterModifier(1, "str", {}, fakeStorage() as any);
  assert.equal(result.baseModifier, 2); // str 14 -> +2
  assert.equal(result.proficiencyBonus, 0);
  assert.equal(result.effectModifier, 0);
  assert.equal(result.total, 2);
  assert.equal(result.statUsed, "str");
});

test("resolveCharacterModifier: skill proficiency adds proficiency bonus and derives ability from the skill", () => {
  const result = resolveCharacterModifier(1, "wis", { skill: "Stealth" }, fakeStorage() as any);
  // Stealth is governed by DEX per SKILL_ABILITY, even though "wis" was passed —
  // the skill map wins, closing the gap where the AI's ability field would otherwise be trusted.
  assert.equal(result.statUsed, "dex.stealth");
  assert.equal(result.baseModifier, 3); // dex 16 -> +3
  assert.equal(result.proficiencyBonus, 3); // level 5 -> +3, and "Stealth" is in proficiencies
  assert.equal(result.total, 6);
});

test("resolveCharacterModifier: save proficiency", () => {
  const result = resolveCharacterModifier(1, "con", { isSave: true }, fakeStorage() as any);
  assert.equal(result.statUsed, "con.save");
  assert.equal(result.baseModifier, 1); // con 12 -> +1
  assert.equal(result.proficiencyBonus, 3); // "Constitution Save" is in proficiencies, level 5 -> +3
  assert.equal(result.total, 4);
});

test("resolveCharacterModifier: unrecognized skill falls back to the supplied ability with no proficiency", () => {
  const result = resolveCharacterModifier(1, "int", { skill: "Made Up Skill" }, fakeStorage() as any);
  assert.equal(result.statUsed, "int");
  assert.equal(result.proficiencyBonus, 0);
});

test("resolveCharacterModifier: active-effect ability-score statMods raise the score, then the modifier is recomputed from that — not added as a flat roll bonus", () => {
  const storage = fakeStorage({
    effects: [
      { statMods: JSON.stringify([{ stat: "str", type: "bonus", modifier: 3, source: "Bless" }]) },
      { statMods: JSON.stringify([{ stat: "dex", type: "bonus", modifier: -1, source: "Encumbered" }]) },
    ],
  });
  const result = resolveCharacterModifier(1, "str", {}, storage as any);
  // str 14 -> 17 (+3 from Bless) -> modifierFor(17) = +3, not the old (and
  // mechanically wrong) "+2 base, then a flat +3 tacked on" = +5 total.
  assert.equal(result.baseModifier, 3);
  assert.equal(result.effectModifier, 0);
  assert.equal(result.total, 3);
});

test("resolveCharacterModifier: equipped item ability-score override replaces the score (Belt of Giant Strength)", () => {
  const storage = fakeStorage({
    items: [
      { equipped: true, statMods: JSON.stringify([{ stat: "str", type: "override", overrideValue: 21, source: "Belt of Giant Strength" }]) },
    ],
  });
  const result = resolveCharacterModifier(1, "str", {}, storage as any);
  assert.equal(result.baseModifier, 5); // modifierFor(21)
});

test("resolveCharacterModifier: an unequipped item's statMods do not apply", () => {
  const storage = fakeStorage({
    items: [
      { equipped: false, statMods: JSON.stringify([{ stat: "str", type: "override", overrideValue: 21, source: "Belt of Giant Strength" }]) },
    ],
  });
  const result = resolveCharacterModifier(1, "str", {}, storage as any);
  assert.equal(result.baseModifier, 2); // str 14, unaffected — item isn't worn
});

test("resolveCharacterModifier: item attack-specific bonus lands in effectModifier, not baseModifier", () => {
  const storage = fakeStorage({
    items: [
      { equipped: true, statMods: JSON.stringify([{ stat: "attack", type: "bonus", modifier: 2, source: "+2 Sword" }]) },
    ],
  });
  const result = resolveCharacterModifier(1, "str", { skill: "attack" }, storage as any);
  assert.equal(result.baseModifier, 2); // str 14, unaffected — this bonus targets "attack", not "str"
  assert.equal(result.effectModifier, 2);
});

test("resolveCharacterModifier: character always proficient in their own attack", () => {
  const result = resolveCharacterModifier(1, "str", { skill: "attack" }, fakeStorage() as any);
  assert.equal(result.proficiencyBonus, 3); // level 5, always-proficient regardless of the proficiencies list
});

test("resolveCharacterModifier: no cinematic bonus outside cinematic combat style", () => {
  const dice = resolveCharacterModifier(1, "str", {}, fakeStorage() as any);
  assert.equal(dice.cinematicBonus, 0);
  const tactical = resolveCharacterModifier(1, "str", { combatStyle: "tactical" }, fakeStorage() as any);
  assert.equal(tactical.cinematicBonus, 0);
});

test("resolveCharacterModifier: cinematic combat style adds a flat +20 to every roll type", () => {
  const attack = resolveCharacterModifier(1, "str", { skill: "attack", combatStyle: "cinematic" }, fakeStorage() as any);
  assert.equal(attack.cinematicBonus, 20);
  assert.equal(attack.total, attack.baseModifier + attack.effectModifier + attack.proficiencyBonus + 20);

  const check = resolveCharacterModifier(1, "wis", { skill: "Perception", combatStyle: "cinematic" }, fakeStorage() as any);
  assert.equal(check.cinematicBonus, 20);

  const save = resolveCharacterModifier(1, "con", { isSave: true, combatStyle: "cinematic" }, fakeStorage() as any);
  assert.equal(save.cinematicBonus, 20);
  assert.equal(save.total, 1 + 0 + 3 + 20); // con +1, no active effects, proficient save +3, cinematic +20
});

test("babForLevel: full/threeQuarter/half progressions", () => {
  assert.equal(babForLevel("full", 10), 10);
  assert.equal(babForLevel("threeQuarter", 10), 7); // floor(10 * 3/4)
  assert.equal(babForLevel("half", 10), 5);
  assert.equal(babForLevel("threeQuarter", 5), 3); // floor(5 * 3/4) = 3
});

test("iterativeAttackBonuses: extra attacks kick in every full +5 of BAB at or above +6", () => {
  assert.deepEqual(iterativeAttackBonuses(5), [5]);
  assert.deepEqual(iterativeAttackBonuses(6), [6, 1]);
  assert.deepEqual(iterativeAttackBonuses(11), [11, 6, 1]);
  assert.deepEqual(iterativeAttackBonuses(16), [16, 11, 6, 1]);
});

test("resolveCharacterModifier: dnd35e attack uses base attack bonus, not proficiency bonus", () => {
  // Fighter (full BAB) at level 5 -> BAB +5
  const fighterAttack = resolveCharacterModifier(
    1, "str", { skill: "attack", ruleset: "dnd35e" }, fakeStorage({ charClass: "Fighter" }) as any,
  );
  assert.equal(fighterAttack.proficiencyBonus, 5);
  assert.equal(fighterAttack.total, 2 + 5); // str 14 -> +2, BAB +5

  // Wizard (half BAB) at level 5 -> BAB +2
  const wizardAttack = resolveCharacterModifier(
    1, "str", { skill: "attack", ruleset: "dnd35e" }, fakeStorage({ charClass: "Wizard" }) as any,
  );
  assert.equal(wizardAttack.proficiencyBonus, 2);
});

test("resolveCharacterModifier: dnd35e saves use class-based good/poor progression, not proficiency bonus", () => {
  // Fighter's only good save is Fortitude (con). Level 5.
  const goodSave = resolveCharacterModifier(
    1, "con", { isSave: true, ruleset: "dnd35e" }, fakeStorage({ charClass: "Fighter" }) as any,
  );
  assert.equal(goodSave.proficiencyBonus, 2 + Math.floor(5 / 2)); // good save formula = 4

  const poorSave = resolveCharacterModifier(
    1, "wis", { isSave: true, ruleset: "dnd35e" }, fakeStorage({ charClass: "Fighter" }) as any,
  );
  assert.equal(poorSave.proficiencyBonus, Math.floor(5 / 3)); // poor save formula = 1
});

test("resolveCharacterModifier: dnd35e skill ranks apply only when trained, capped at level+3", () => {
  const trained = resolveCharacterModifier(
    1, "dex", { skill: "Stealth", ruleset: "dnd35e" }, fakeStorage({ charClass: "Rogue" }) as any,
  );
  assert.equal(trained.proficiencyBonus, 5 + 3); // level 5, trained (Stealth is in proficiencies)

  const untrained = resolveCharacterModifier(
    1, "int", { skill: "Arcana", ruleset: "dnd35e" }, fakeStorage({ charClass: "Rogue" }) as any,
  );
  assert.equal(untrained.proficiencyBonus, 0); // not in proficiencies list
});

test("computeFullCharacterSheet: assembles abilities, all 18 skills, all 6 saves, and attack — all agreeing with resolveCharacterModifier", () => {
  const sheet = computeFullCharacterSheet(1, { ruleset: "dnd5e" }, fakeStorage() as any);

  assert.equal(sheet.abilities.str.score, 14);
  assert.equal(sheet.abilities.str.modifier, 2);
  assert.equal(sheet.skills.length, 18);
  assert.equal(sheet.saves.length, 6);
  assert.deepEqual(sheet.saves.map((s) => s.key).sort(), ["cha", "con", "dex", "int", "str", "wis"]);

  const stealthSkill = sheet.skills.find((s) => s.name === "Stealth")!;
  const stealthResolved = resolveCharacterModifier(1, "dex", { skill: "Stealth" }, fakeStorage() as any);
  assert.equal(stealthSkill.total, stealthResolved.total);
  assert.equal(stealthSkill.proficient, true); // "Stealth" is in fakeStorage's proficiencies list
});

test("computeFullCharacterSheet: item ability-score overrides show up in the sheet's ability scores", () => {
  const storage = fakeStorage({
    items: [{ equipped: true, statMods: JSON.stringify([{ stat: "str", type: "override", overrideValue: 21, source: "Belt of Giant Strength" }]) }],
  });
  const sheet = computeFullCharacterSheet(1, { ruleset: "dnd5e" }, storage as any);
  assert.equal(sheet.abilities.str.score, 21);
  assert.equal(sheet.abilities.str.modifier, 5);
});

test("computeFullCharacterSheet: dnd35e ruleset includes iterative attack bonuses on the sheet", () => {
  // Fighter (full BAB), level 12 -> BAB +12 -> attacks at +12/+7/+2
  const sheet = computeFullCharacterSheet(1, { ruleset: "dnd35e" }, fakeStorage({ level: 12, charClass: "Fighter" }) as any);
  assert.equal(sheet.attack.extraAttackBonuses.length, 2);
});

test("computeFullCharacterSheet: a dnd35e Fighter exposes exactly Fortitude/Reflex/Will, never six ability saves", () => {
  const sheet = computeFullCharacterSheet(1, { ruleset: "dnd35e" }, fakeStorage({ charClass: "Fighter" }) as any);
  assert.deepEqual(sheet.saves.map((s) => s.key), ["fortitude", "reflex", "will"]);
  assert.deepEqual(sheet.saves.map((s) => s.label), ["Fortitude", "Reflex", "Will"]);
});

test("computeFullCharacterSheet: a dnd35e Rogue also exposes exactly Fortitude/Reflex/Will", () => {
  const sheet = computeFullCharacterSheet(1, { ruleset: "dnd35e" }, fakeStorage({ charClass: "Rogue" }) as any);
  assert.deepEqual(sheet.saves.map((s) => s.key), ["fortitude", "reflex", "will"]);
});

test("computeFullCharacterSheet: dnd35e save totals agree exactly with resolveCharacterModifier — same authoritative mechanics, not a second formula", () => {
  const storage = fakeStorage({ level: 8, charClass: "Cleric" }) as any; // Cleric: good Fort+Will, poor Reflex
  const sheet = computeFullCharacterSheet(1, { ruleset: "dnd35e" }, storage);

  const fort = resolveCharacterModifier(1, "con", { isSave: true, ruleset: "dnd35e" }, storage);
  const ref = resolveCharacterModifier(1, "dex", { isSave: true, ruleset: "dnd35e" }, storage);
  const will = resolveCharacterModifier(1, "wis", { isSave: true, ruleset: "dnd35e" }, storage);

  assert.equal(sheet.saves.find((s) => s.key === "fortitude")!.total, fort.total);
  assert.equal(sheet.saves.find((s) => s.key === "reflex")!.total, ref.total);
  assert.equal(sheet.saves.find((s) => s.key === "will")!.total, will.total);
  // Fortitude and Will are Cleric's good saves — must be strictly higher than
  // Reflex, its poor save, at the same level. This is the regression a
  // "just relabel three of the six ability saves" fix would silently miss.
  assert.ok(fort.total > ref.total);
  assert.ok(will.total > ref.total);
});

test("computeFullCharacterSheet: a non-3.5 ruleset is not accidentally forced into Fortitude/Reflex/Will", () => {
  const sheet = computeFullCharacterSheet(1, { ruleset: "dnd5e" }, fakeStorage() as any);
  assert.deepEqual(sheet.saves.map((s) => s.key).sort(), ["cha", "con", "dex", "int", "str", "wis"]);
  assert.ok(!sheet.saves.some((s) => s.key === "fortitude" || s.key === "reflex" || s.key === "will"));
});

test("shared/races: racesForRuleset(dnd35e) returns exactly the 7 core PHB races", () => {
  assert.equal(racesForRuleset("dnd35e").length, 7);
});

test("shared/races: applyRacialAdjustments applies a Dwarf's +2 CON / -2 CHA correctly", () => {
  const base = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 };
  const dwarf = getRace("dnd35e", "Dwarf");
  const adjusted = applyRacialAdjustments(base, dwarf);
  assert.equal(adjusted.con, 16); // matches the doc's own worked example (14 -> 16)
  assert.equal(adjusted.cha, 8);
  assert.equal(adjusted.str, 10); // untouched ability stays untouched
});

test("shared/races: applyRacialAdjustments clamps a penalized score at 1, never goes negative", () => {
  const base = { str: 2, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const halfling = getRace("dnd35e", "Halfling"); // -2 STR
  const adjusted = applyRacialAdjustments(base, halfling);
  assert.equal(adjusted.str, 1);
});

test("shared/races: applyRacialAdjustments is a no-op when no race is given", () => {
  const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  assert.deepEqual(applyRacialAdjustments(base, undefined), base);
});

test("shared/races: getRace matches case-insensitively by display name", () => {
  assert.equal(getRace("dnd35e", "half-elf")?.id, "half-elf");
  assert.equal(getRace("dnd35e", "HALF-ELF")?.id, "half-elf");
  assert.equal(getRace("dnd35e", "Nonexistent Race"), undefined);
});

test("resolveCharacterModifier: dnd35e small race gets +1 size bonus on attack rolls", () => {
  const result = resolveCharacterModifier(
    1, "str", { skill: "attack", ruleset: "dnd35e" }, fakeStorage({ race: "Halfling" }) as any,
  );
  assert.equal(result.sizeBonus, 1);
});

test("resolveCharacterModifier: dnd35e medium race gets no size bonus", () => {
  const result = resolveCharacterModifier(
    1, "str", { skill: "attack", ruleset: "dnd35e" }, fakeStorage({ race: "Dwarf" }) as any,
  );
  assert.equal(result.sizeBonus, 0);
});

test("resolveCharacterModifier: size bonus only applies to attack rolls, not skills or saves", () => {
  const skillResult = resolveCharacterModifier(
    1, "dex", { skill: "Stealth", ruleset: "dnd35e" }, fakeStorage({ race: "Halfling" }) as any,
  );
  assert.equal(skillResult.sizeBonus, 0);
});

test("resolveCharacterModifier: unrecognized/freeform race defaults to medium size, no bonus", () => {
  const result = resolveCharacterModifier(
    1, "str", { skill: "attack", ruleset: "dnd35e" }, fakeStorage({ race: "Space Marine" }) as any,
  );
  assert.equal(result.sizeBonus, 0);
});

test("resolveCharacterModifier: 5e ruleset never applies the 3.5e size bonus, even for a small race name", () => {
  const result = resolveCharacterModifier(
    1, "str", { skill: "attack", ruleset: "dnd5e" }, fakeStorage({ race: "Halfling" }) as any,
  );
  assert.equal(result.sizeBonus, 0);
});

test("resolveCharacterModifier: dnd35e falls back to a sensible default progression for freeform/homebrew class names", () => {
  const result = resolveCharacterModifier(
    1, "str", { skill: "attack", ruleset: "dnd35e" }, fakeStorage({ charClass: "cyberpunk mercenary" }) as any,
  );
  assert.equal(result.proficiencyBonus, babForLevel("threeQuarter", 5)); // default progression
});
