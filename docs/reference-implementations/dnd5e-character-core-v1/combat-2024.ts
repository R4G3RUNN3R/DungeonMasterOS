// Reference implementation only. SRD 5.2.1 combat rules that materially differ by profile.

import type { CombatantCore, DamageAtZeroResult, DeathSaveResult, GrappleAttempt, InitiativeResolution, ShoveAttempt } from "./combat-types";
import type { Dnd5eDeathState, Dnd5eSize } from "./domain";
import { abilityModifier } from "./core-tables";

const SIZE_ORDER: Dnd5eSize[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const noMoreThanOneSizeLarger = (attacker: Dnd5eSize, target: Dnd5eSize) => SIZE_ORDER.indexOf(target) <= SIZE_ORDER.indexOf(attacker) + 1;

export function initiative2024(dexterity: number, surprised: boolean): InitiativeResolution {
  return {
    modifier: abilityModifier(dexterity),
    advantageSources: [],
    disadvantageSources: surprised ? ["surprise"] : [],
    profileNote: surprised
      ? "Revised Surprise imposes Disadvantage on the Initiative roll. It does not use the 2014 no-action/no-reaction first-turn package."
      : "Normal revised Initiative Dexterity check.",
  };
}

export function unarmedStrikeDc2024(attacker: CombatantCore, useDexterityInsteadOfStrength = false): number {
  const ability = useDexterityInsteadOfStrength ? attacker.abilities.dex : attacker.abilities.str;
  return 8 + abilityModifier(ability) + attacker.proficiencyBonus;
}

export function grapple2024(
  attacker: CombatantCore,
  targetSize: Dnd5eSize,
  hasFreeHand: boolean,
  inReach: boolean,
  useDexterityInsteadOfStrength = false,
): GrappleAttempt {
  const legal = hasFreeHand && inReach && noMoreThanOneSizeLarger(attacker.size, targetSize);
  return {
    profileId: "dnd5e-2024",
    legal,
    saveDc: legal ? unarmedStrikeDc2024(attacker, useDexterityInsteadOfStrength) : undefined,
    defenderSaveOptions: legal ? ["str", "dex"] : undefined,
    onFailure: "grappled",
    notes: [
      "Grapple is one option of an Unarmed Strike, not the 2014 Athletics contest.",
      "The target chooses Strength or Dexterity for the saving throw.",
      "The standard DC uses Strength; a rule such as Monk Martial Arts can allow Dexterity.",
      "Escape attempts use the same escape DC through the Grappled condition/action rules.",
    ],
  };
}

export function shove2024(
  attacker: CombatantCore,
  targetSize: Dnd5eSize,
  inReach: boolean,
  useDexterityInsteadOfStrength = false,
): ShoveAttempt {
  const legal = inReach && noMoreThanOneSizeLarger(attacker.size, targetSize);
  return {
    profileId: "dnd5e-2024",
    legal,
    saveDc: legal ? unarmedStrikeDc2024(attacker, useDexterityInsteadOfStrength) : undefined,
    defenderSaveOptions: legal ? ["str", "dex"] : undefined,
    effects: ["prone", "push-5ft"],
  };
}

export function damageAtZero2024(damage: number, maxHp: number, criticalHit: boolean): DamageAtZeroResult {
  return {
    instantDeath: damage >= maxHp,
    deathFailuresAdded: criticalHit ? 2 : 1,
  };
}

export function resolveDeathSave2024(
  state: Dnd5eDeathState,
  naturalRoll: number,
): DeathSaveResult {
  const next = { ...state };
  let regainedHp = 0;

  if (naturalRoll === 20) {
    regainedHp = 1;
    return {
      next: { deathSaveSuccesses: 0, deathSaveFailures: 0, stable: false },
      regainedHp,
      dead: false,
    };
  }

  if (naturalRoll === 1) next.deathSaveFailures += 2;
  else if (naturalRoll >= 10) next.deathSaveSuccesses += 1;
  else next.deathSaveFailures += 1;

  if (next.deathSaveSuccesses >= 3) {
    next.deathSaveSuccesses = 0;
    next.deathSaveFailures = 0;
    next.stable = true;
  }

  return { next, regainedHp, dead: next.deathSaveFailures >= 3 };
}
