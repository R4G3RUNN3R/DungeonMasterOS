// Reference implementation only. SRD 5.1 combat rules that materially differ by profile.

import type { CombatantCore, DamageAtZeroResult, DeathSaveResult, GrappleAttempt, InitiativeResolution, ShoveAttempt } from "./combat-types";
import type { Dnd5eDeathState, Dnd5eSize } from "./domain";
import { abilityModifier } from "./core-tables";

const SIZE_ORDER: Dnd5eSize[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const noMoreThanOneSizeLarger = (attacker: Dnd5eSize, target: Dnd5eSize) => SIZE_ORDER.indexOf(target) <= SIZE_ORDER.indexOf(attacker) + 1;

export function initiative2014(dexterity: number, surprised: boolean): InitiativeResolution {
  return {
    modifier: abilityModifier(dexterity),
    advantageSources: [],
    disadvantageSources: [],
    profileNote: surprised
      ? "Surprised: cannot move or take an action on the first turn and cannot take a reaction until that turn ends. Surprise does not impose Initiative disadvantage in the 2014 profile."
      : "Normal 2014 Initiative Dexterity check.",
  };
}

export function grapple2014(attacker: CombatantCore, targetSize: Dnd5eSize, hasFreeHand: boolean, inReach: boolean): GrappleAttempt {
  const legal = hasFreeHand && inReach && noMoreThanOneSizeLarger(attacker.size, targetSize);
  return {
    profileId: "dnd5e-2014",
    legal,
    attackerCheck: legal ? { skill: "athletics", ability: "str" } : undefined,
    defenderContestOptions: legal ? [
      { skill: "athletics", ability: "str" },
      { skill: "acrobatics", ability: "dex" },
    ] : undefined,
    onFailure: "grappled",
    notes: [
      "Replaces one attack of the Attack action.",
      "Escape uses an action and a contested Athletics or Acrobatics check against the grappler's Athletics.",
      "Moving a grappled creature halves speed unless it is two or more sizes smaller.",
    ],
  };
}

export function shove2014(attacker: CombatantCore, targetSize: Dnd5eSize, inReach: boolean): ShoveAttempt {
  const legal = inReach && noMoreThanOneSizeLarger(attacker.size, targetSize);
  return {
    profileId: "dnd5e-2014",
    legal,
    attackerCheck: legal ? { skill: "athletics", ability: "str" } : undefined,
    defenderContestOptions: legal ? [
      { skill: "athletics", ability: "str" },
      { skill: "acrobatics", ability: "dex" },
    ] : undefined,
    effects: ["prone", "push-5ft"],
  };
}

export function damageAtZero2014(damage: number, maxHp: number, criticalHit: boolean): DamageAtZeroResult {
  return {
    instantDeath: damage >= maxHp,
    deathFailuresAdded: criticalHit ? 2 : 1,
  };
}

export function resolveDeathSave2014(
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
