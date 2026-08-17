// Reference implementation only.

import type { Dnd5eAbility, Dnd5eAbilityScores, Dnd5eRulesProfileId, Dnd5eSize } from "./domain";

export const STANDARD_XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(characterLevel: number): number {
  if (characterLevel < 1) return 0;
  return Math.min(6, 2 + Math.floor((characterLevel - 1) / 4));
}

export function experienceRequiredForLevel(level: number): number {
  return STANDARD_XP_THRESHOLDS[level] ?? Number.POSITIVE_INFINITY;
}

export function nextLevelExperience(characterLevel: number): number {
  return experienceRequiredForLevel(characterLevel + 1);
}

export function validatePointBuy(scores: Dnd5eAbilityScores, budget = 27): string[] {
  const errors: string[] = [];
  let spent = 0;
  for (const [ability, score] of Object.entries(scores) as Array<[Dnd5eAbility, number]>) {
    const cost = POINT_BUY_COSTS[score];
    if (cost === undefined) {
      errors.push(`${ability.toUpperCase()} ${score} is outside the core point-buy range 8-15.`);
      continue;
    }
    spent += cost;
  }
  if (spent > budget) errors.push(`Point buy spends ${spent}; maximum is ${budget}.`);
  return errors;
}

export type OriginAbilityAdjustment = Partial<Record<Dnd5eAbility, number>>;

export function validate2024BackgroundAbilityAdjustment(
  adjustment: OriginAbilityAdjustment,
  allowedAbilities: Dnd5eAbility[],
): string[] {
  const entries = Object.entries(adjustment)
    .filter(([, value]) => value && value !== 0) as Array<[Dnd5eAbility, number]>;
  const errors: string[] = [];

  if (entries.some(([ability]) => !allowedAbilities.includes(ability))) {
    errors.push("Background ability adjustment uses an ability not granted by that background.");
  }

  const values = entries.map(([, value]) => value).sort((a, b) => b - a);
  const validPattern =
    (values.length === 2 && values[0] === 2 && values[1] === 1) ||
    (values.length === 3 && values.every((value) => value === 1));

  if (!validPattern) {
    errors.push("2024 background ASI must be +2/+1 to two listed abilities or +1/+1/+1 to all three listed abilities.");
  }

  return errors;
}

export function applyAbilityAdjustments(
  base: Dnd5eAbilityScores,
  adjustments: OriginAbilityAdjustment[],
  normalMaximum = 20,
): Dnd5eAbilityScores {
  const result = { ...base };
  for (const adjustment of adjustments) {
    for (const [ability, value] of Object.entries(adjustment) as Array<[Dnd5eAbility, number]>) {
      result[ability] = Math.min(normalMaximum, result[ability] + (value ?? 0));
    }
  }
  return result;
}

export type CarryingCapacity = {
  carryingLb: number;
  pushDragLiftLb: number;
};

const SIZE_MULTIPLIER_2024: Record<Dnd5eSize, number> = {
  tiny: 0.5,
  small: 1,
  medium: 1,
  large: 2,
  huge: 4,
  gargantuan: 8,
};

const SIZE_MULTIPLIER_2014: Record<Dnd5eSize, number> = {
  tiny: 0.5,
  small: 1,
  medium: 1,
  large: 2,
  huge: 4,
  gargantuan: 8,
};

export function carryingCapacity(
  profile: Dnd5eRulesProfileId,
  strength: number,
  size: Dnd5eSize,
): CarryingCapacity {
  const multiplier = profile === "dnd5e-2024" ? SIZE_MULTIPLIER_2024[size] : SIZE_MULTIPLIER_2014[size];
  return {
    carryingLb: strength * 15 * multiplier,
    pushDragLiftLb: strength * 30 * multiplier,
  };
}

export type VariantEncumbrance2014 = {
  encumberedAtLb: number;
  heavilyEncumberedAtLb: number;
  maximumCarryLb: number;
};

export function variantEncumbrance2014(strength: number, size: Dnd5eSize): VariantEncumbrance2014 {
  const multiplier = SIZE_MULTIPLIER_2014[size];
  return {
    encumberedAtLb: strength * 5 * multiplier,
    heavilyEncumberedAtLb: strength * 10 * multiplier,
    maximumCarryLb: strength * 15 * multiplier,
  };
}

export function spellSaveDc(proficiency: number, spellcastingAbilityScore: number, miscellaneous = 0): number {
  return 8 + proficiency + abilityModifier(spellcastingAbilityScore) + miscellaneous;
}

export function spellAttackBonus(proficiency: number, spellcastingAbilityScore: number, miscellaneous = 0): number {
  return proficiency + abilityModifier(spellcastingAbilityScore) + miscellaneous;
}

export function passiveScore(abilityScore: number, proficiency: number, proficiencyMultiplier: 0 | 1 | 2 = 0, misc = 0): number {
  return 10 + abilityModifier(abilityScore) + proficiency * proficiencyMultiplier + misc;
}

export function normalizeAdvantageState(advantageSources: number, disadvantageSources: number): "normal" | "advantage" | "disadvantage" {
  if (advantageSources > 0 && disadvantageSources > 0) return "normal";
  if (advantageSources > 0) return "advantage";
  if (disadvantageSources > 0) return "disadvantage";
  return "normal";
}
