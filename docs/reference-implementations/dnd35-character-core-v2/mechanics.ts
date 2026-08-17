// Reference implementation only.
// Pure D&D 3.5e mechanics. No React, Express, database or AI dependencies.

import type {
  Dnd35AbilityScores,
  Dnd35CharacterState,
  Dnd35ClassTotals,
  Dnd35LevelRecord,
  Dnd35Save,
  Dnd35Size,
} from "./domain";
import { getCoreClass } from "./classes";
import { applyRacialAbilityAdjustments, getCoreRace } from "./races";
import { getSkillDefinition, isClassSkill } from "./skills";

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function characterLevel(state: Pick<Dnd35CharacterState, "levels">): number {
  return state.levels.length;
}

export function classTotals(levels: Dnd35LevelRecord[]): Dnd35ClassTotals {
  const totals: Dnd35ClassTotals = {};
  for (const level of levels) totals[level.classId] = (totals[level.classId] ?? 0) + 1;
  return totals;
}

export function classLevelAtCharacterLevel(
  levels: Dnd35LevelRecord[],
  classId: string,
  throughCharacterLevel?: number,
): number {
  const cutoff = throughCharacterLevel ?? levels.length;
  return levels.filter((level) => level.characterLevel <= cutoff && level.classId === classId).length;
}

export function baseAttackForClassLevel(progression: "good" | "medium" | "poor", level: number): number {
  if (level <= 0) return 0;
  if (progression === "good") return level;
  if (progression === "medium") return Math.floor((3 * level) / 4);
  return Math.floor(level / 2);
}

export function baseSaveForClassLevel(progression: "good" | "poor", level: number): number {
  if (level <= 0) return 0;
  return progression === "good" ? 2 + Math.floor(level / 2) : Math.floor(level / 3);
}

/** Calculate each class table separately, then add the results. */
export function multiclassBaseAttack(levels: Dnd35LevelRecord[]): number {
  return Object.entries(classTotals(levels)).reduce((total, [classId, level]) => {
    const cls = getCoreClass(classId);
    return total + (cls ? baseAttackForClassLevel(cls.bab, level) : 0);
  }, 0);
}

export function multiclassBaseSaves(levels: Dnd35LevelRecord[]): Record<Dnd35Save, number> {
  const result: Record<Dnd35Save, number> = { fortitude: 0, reflex: 0, will: 0 };
  for (const [classId, level] of Object.entries(classTotals(levels))) {
    const cls = getCoreClass(classId);
    if (!cls) continue;
    for (const save of ["fortitude", "reflex", "will"] as const) {
      result[save] += baseSaveForClassLevel(cls.saves[save], level);
    }
  }
  return result;
}

/** Full-attack BAB sequence before ability, weapon and situational modifiers. */
export function iterativeBaseAttacks(baseAttackBonus: number): number[] {
  if (baseAttackBonus <= 0) return [baseAttackBonus];
  const attacks: number[] = [];
  for (let attack = baseAttackBonus; attack > 0 && attacks.length < 4; attack -= 5) attacks.push(attack);
  return attacks;
}

export function experienceRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return 500 * level * (level - 1);
}

export function nextLevelExperience(currentCharacterLevel: number): number {
  return experienceRequiredForLevel(currentCharacterLevel + 1);
}

export function canGainAnotherLevel(state: Pick<Dnd35CharacterState, "experiencePoints" | "levels">): boolean {
  return state.experiencePoints >= nextLevelExperience(state.levels.length);
}

export function getsGeneralFeatAtCharacterLevel(level: number): boolean {
  return level === 1 || (level > 1 && level % 3 === 0);
}

export function getsAbilityIncreaseAtCharacterLevel(level: number): boolean {
  return level > 0 && level % 4 === 0;
}

export function effectivePermanentAbilities(state: Dnd35CharacterState): Dnd35AbilityScores {
  const race = getCoreRace(state.race.raceId);
  let scores: Dnd35AbilityScores = { ...state.baseAbilityScores };
  if (race) scores = applyRacialAbilityAdjustments(scores, race);
  for (const level of state.levels) {
    if (level.abilityIncrease) scores[level.abilityIncrease] += 1;
  }
  return scores;
}

export type SizeModifiers = {
  attackAndAc: number;
  grapple: number;
  hide: number;
  carryingMultiplier: number;
};

export const SIZE_MODIFIERS: Record<Dnd35Size, SizeModifiers> = {
  fine: { attackAndAc: 8, grapple: -16, hide: 16, carryingMultiplier: 1 / 8 },
  diminutive: { attackAndAc: 4, grapple: -12, hide: 12, carryingMultiplier: 1 / 4 },
  tiny: { attackAndAc: 2, grapple: -8, hide: 8, carryingMultiplier: 1 / 2 },
  small: { attackAndAc: 1, grapple: -4, hide: 4, carryingMultiplier: 3 / 4 },
  medium: { attackAndAc: 0, grapple: 0, hide: 0, carryingMultiplier: 1 },
  large: { attackAndAc: -1, grapple: 4, hide: -4, carryingMultiplier: 2 },
  huge: { attackAndAc: -2, grapple: 8, hide: -8, carryingMultiplier: 4 },
  gargantuan: { attackAndAc: -4, grapple: 12, hide: -12, carryingMultiplier: 8 },
  colossal: { attackAndAc: -8, grapple: 16, hide: -16, carryingMultiplier: 16 },
};

export function sizeModifiers(size: Dnd35Size): SizeModifiers {
  return SIZE_MODIFIERS[size];
}

export function permanentSize(state: Dnd35CharacterState): Dnd35Size {
  return getCoreRace(state.race.raceId)?.size ?? "medium";
}

const CARRYING: Record<number, { light: number; medium: number; heavy: number }> = {
  1: { light: 3, medium: 6, heavy: 10 }, 2: { light: 6, medium: 13, heavy: 20 },
  3: { light: 10, medium: 20, heavy: 30 }, 4: { light: 13, medium: 26, heavy: 40 },
  5: { light: 16, medium: 33, heavy: 50 }, 6: { light: 20, medium: 40, heavy: 60 },
  7: { light: 23, medium: 46, heavy: 70 }, 8: { light: 26, medium: 53, heavy: 80 },
  9: { light: 30, medium: 60, heavy: 90 }, 10: { light: 33, medium: 66, heavy: 100 },
  11: { light: 38, medium: 76, heavy: 115 }, 12: { light: 43, medium: 86, heavy: 130 },
  13: { light: 50, medium: 100, heavy: 150 }, 14: { light: 58, medium: 116, heavy: 175 },
  15: { light: 66, medium: 133, heavy: 200 }, 16: { light: 76, medium: 153, heavy: 230 },
  17: { light: 86, medium: 173, heavy: 260 }, 18: { light: 100, medium: 200, heavy: 300 },
  19: { light: 116, medium: 233, heavy: 350 }, 20: { light: 133, medium: 266, heavy: 400 },
  21: { light: 153, medium: 306, heavy: 460 }, 22: { light: 173, medium: 346, heavy: 520 },
  23: { light: 200, medium: 400, heavy: 600 }, 24: { light: 233, medium: 466, heavy: 700 },
  25: { light: 266, medium: 533, heavy: 800 }, 26: { light: 306, medium: 613, heavy: 920 },
  27: { light: 346, medium: 693, heavy: 1040 }, 28: { light: 400, medium: 800, heavy: 1200 },
  29: { light: 466, medium: 933, heavy: 1400 },
};

export type CarryingCapacity = {
  light: number;
  medium: number;
  heavy: number;
  liftOffGround: number;
  pushOrDrag: number;
};

export function carryingCapacity(strength: number, size: Dnd35Size, quadruped = false): CarryingCapacity {
  if (strength < 1) return { light: 0, medium: 0, heavy: 0, liftOffGround: 0, pushOrDrag: 0 };

  let tableStrength = Math.min(strength, 29);
  let tremendousMultiplier = 1;
  if (strength > 29) {
    const tensAboveTwenty = Math.floor((strength - 20) / 10);
    tableStrength = 20 + ((strength - 20) % 10);
    tremendousMultiplier = Math.pow(4, tensAboveTwenty);
  }

  const row = CARRYING[tableStrength];
  if (!row) throw new Error(`No carrying-capacity row for Strength ${strength}`);

  const quadrupedMultiplier: Record<Dnd35Size, number> = {
    fine: 1 / 4, diminutive: 1 / 2, tiny: 3 / 4, small: 1, medium: 1.5,
    large: 3, huge: 6, gargantuan: 12, colossal: 24,
  };
  const sizeMultiplier = quadruped ? quadrupedMultiplier[size] : SIZE_MODIFIERS[size].carryingMultiplier;
  const multiplier = tremendousMultiplier * sizeMultiplier;
  const light = row.light * multiplier;
  const medium = row.medium * multiplier;
  const heavy = row.heavy * multiplier;
  return { light, medium, heavy, liftOffGround: heavy * 2, pushOrDrag: heavy * 5 };
}

export type LoadCategory = "light" | "medium" | "heavy" | "overloaded";

export function loadCategory(weightLb: number, capacity: CarryingCapacity): LoadCategory {
  if (weightLb <= capacity.light) return "light";
  if (weightLb <= capacity.medium) return "medium";
  if (weightLb <= capacity.heavy) return "heavy";
  return "overloaded";
}

export function loadMaxDex(category: LoadCategory): number | null {
  if (category === "medium") return 3;
  if (category === "heavy") return 1;
  if (category === "overloaded") return 0;
  return null;
}

export function loadArmorCheckPenalty(category: LoadCategory): number {
  if (category === "medium") return -3;
  if (category === "heavy") return -6;
  return 0;
}

const ENCUMBERED_SPEED: Record<number, number> = {
  20: 15, 30: 20, 40: 30, 50: 35, 60: 40, 70: 50, 80: 55, 90: 60, 100: 70,
};

export function reduceSpeedForArmorOrLoad(speed: number): number {
  if (speed <= 5) return speed;
  const exact = ENCUMBERED_SPEED[speed];
  if (exact !== undefined) return exact;
  return Math.max(5, Math.floor((speed * 2) / 3 / 5) * 5);
}

export type SpeedContext = {
  armorCategory?: "none" | "light" | "medium" | "heavy";
  loadCategory?: LoadCategory;
  speedBonus?: number;
  unarmored?: boolean;
};

export function derivedLandSpeed(state: Dnd35CharacterState, context: SpeedContext = {}): number {
  const race = getCoreRace(state.race.raceId);
  const raceBase = race?.baseLandSpeed ?? 30;
  const totals = classTotals(state.levels);
  const armor = context.armorCategory ?? "none";
  const load = context.loadCategory ?? "light";
  const heavyArmor = armor === "heavy";
  const mediumOrHeavyLoad = load === "medium" || load === "heavy" || load === "overloaded";
  const heavyLoad = load === "heavy" || load === "overloaded";

  let bonus = context.speedBonus ?? 0;

  // Barbarian Fast Movement: +10 while not in heavy armor and not carrying a heavy load.
  if ((totals.barbarian ?? 0) >= 1 && !heavyArmor && !heavyLoad) bonus += 10;

  // Monk Fast Movement is an enhancement bonus and requires no armor and no medium/heavy load.
  const monkLevel = totals.monk ?? 0;
  const monkUnarmored = context.unarmored ?? armor === "none";
  if (monkLevel >= 3 && monkUnarmored && !mediumOrHeavyLoad) {
    bonus += Math.min(60, Math.floor(monkLevel / 3) * 10);
  }

  const modifiedBase = raceBase + bonus;
  if (load === "overloaded") return 5;

  const armorWouldReduce = armor === "medium" || armor === "heavy";
  const loadWouldReduce = load === "medium" || load === "heavy";
  if (!armorWouldReduce && !loadWouldReduce) return modifiedBase;

  // Dwarves retain their base land speed under armor and medium/heavy encumbrance.
  if (race?.rules.armorDoesNotReduceLandSpeed && race.rules.loadDoesNotReduceLandSpeed) return modifiedBase;
  if (race?.rules.armorDoesNotReduceLandSpeed && armorWouldReduce && !loadWouldReduce) return modifiedBase;
  if (race?.rules.loadDoesNotReduceLandSpeed && loadWouldReduce && !armorWouldReduce) return modifiedBase;

  return reduceSpeedForArmorOrLoad(modifiedBase);
}

export function maximumHitPoints(state: Dnd35CharacterState): number {
  const conMod = abilityModifier(effectivePermanentAbilities(state).con);
  return state.levels.reduce((total, level) => total + Math.max(1, level.hitPointRoll + conMod), 0);
}

export function classSkillAtAnyLevel(state: Dnd35CharacterState, skillId: string): boolean {
  return Object.keys(classTotals(state.levels)).some((classId) => {
    const cls = getCoreClass(classId);
    return !!cls && isClassSkill(cls.classSkills, skillId);
  });
}

export function maxSkillRanks(characterLevelValue: number, classSkillForAnyClass: boolean): number {
  const classMax = characterLevelValue + 3;
  return classSkillForAnyClass ? classMax : classMax / 2;
}

export function aggregateSkillRanks(state: Dnd35CharacterState): Record<string, number> {
  const ranks: Record<string, number> = {};
  for (const level of state.levels) {
    for (const purchase of level.skillPurchases) {
      ranks[purchase.skillId] = (ranks[purchase.skillId] ?? 0) + purchase.ranksPurchased;
    }
  }
  return ranks;
}

export function skillPointCostForRanks(ranks: number, classSkillForPurchasedLevel: boolean): number {
  return ranks * (classSkillForPurchasedLevel ? 1 : 2);
}

export function skillPointBudgetForLevel(
  classId: string,
  intelligenceScoreAtThatLevel: number,
  characterLevelValue: number,
  raceId: string,
): number {
  const cls = getCoreClass(classId);
  if (!cls) throw new Error(`Unknown class: ${classId}`);
  const perLevel = Math.max(1, cls.skillPointsPerLevel + abilityModifier(intelligenceScoreAtThatLevel));
  const humanBonus = raceId === "human" ? (characterLevelValue === 1 ? 4 : 1) : 0;
  return (characterLevelValue === 1 ? perLevel * 4 : perLevel) + humanBonus;
}

export function validateSkillPurchases(state: Dnd35CharacterState, level: Dnd35LevelRecord): string[] {
  const errors: string[] = [];
  const cls = getCoreClass(level.classId);
  if (!cls) return [`Unknown class ${level.classId}`];

  const spent = level.skillPurchases.reduce((sum, purchase) => sum + purchase.pointsSpent, 0);
  if (spent !== level.skillPointBudget) errors.push(`Skill points spent ${spent} do not match budget ${level.skillPointBudget}.`);

  const priorLevels = state.levels.filter((entry) => entry.characterLevel < level.characterLevel);
  const previousRanks = aggregateSkillRanks({ ...state, levels: priorLevels });
  const classesHeld = new Set(priorLevels.map((entry) => entry.classId));
  classesHeld.add(level.classId);

  for (const purchase of level.skillPurchases) {
    const expectedClassSkill = isClassSkill(cls.classSkills, purchase.skillId);
    if (purchase.classSkillForThisLevel !== expectedClassSkill) {
      errors.push(`${purchase.skillId}: class-skill flag does not match ${cls.displayName}.`);
    }

    const expectedCost = skillPointCostForRanks(purchase.ranksPurchased, expectedClassSkill);
    if (Math.abs(expectedCost - purchase.pointsSpent) > 0.0001) {
      errors.push(`${purchase.skillId}: expected ${expectedCost} points, got ${purchase.pointsSpent}.`);
    }

    const everClassSkill = [...classesHeld].some((id) => {
      const heldClass = getCoreClass(id);
      return !!heldClass && isClassSkill(heldClass.classSkills, purchase.skillId);
    });
    const cap = maxSkillRanks(level.characterLevel, everClassSkill);
    const totalRanks = (previousRanks[purchase.skillId] ?? 0) + purchase.ranksPurchased;
    if (totalRanks > cap + 0.0001) errors.push(`${purchase.skillId}: ${totalRanks} ranks exceeds maximum ${cap}.`);
  }

  return errors;
}

export function armorCheckPenaltyForSkill(skillId: string, effectiveArmorCheckPenalty: number): number {
  const skill = getSkillDefinition(skillId);
  if (!skill || skill.armorCheckPenaltyMultiplier === 0) return 0;
  return effectiveArmorCheckPenalty * skill.armorCheckPenaltyMultiplier;
}

export function spellSaveDc(spellLevel: number, castingAbilityScore: number, miscellaneous = 0): number {
  return 10 + spellLevel + abilityModifier(castingAbilityScore) + miscellaneous;
}

export function baseGrappleBonus(state: Dnd35CharacterState): number {
  const abilities = effectivePermanentAbilities(state);
  return multiclassBaseAttack(state.levels) + abilityModifier(abilities.str) + sizeModifiers(permanentSize(state)).grapple;
}

export function firstLevelHitPoints(hitDie: number): number {
  return hitDie;
}

export function expectedHitDieForLevel(_levels: Dnd35LevelRecord[], classId: string): number | undefined {
  return getCoreClass(classId)?.hitDie;
}

export function validateLevelRecordBasics(state: Dnd35CharacterState, level: Dnd35LevelRecord): string[] {
  const errors: string[] = [];
  const expectedLevel = state.levels.length + 1;
  if (level.characterLevel !== expectedLevel) errors.push(`Expected character level ${expectedLevel}.`);

  const cls = getCoreClass(level.classId);
  if (!cls) return [...errors, `Unknown class ${level.classId}.`];
  if (level.hitDie !== cls.hitDie) errors.push(`Expected d${cls.hitDie} Hit Die for ${cls.displayName}.`);
  if (level.characterLevel === 1 && level.hitPointRoll !== cls.hitDie) errors.push(`First character level uses the full d${cls.hitDie} Hit Die value.`);
  if (level.characterLevel > 1 && (level.hitPointRoll < 1 || level.hitPointRoll > cls.hitDie)) {
    errors.push(`HP roll ${level.hitPointRoll} is outside 1..${cls.hitDie}.`);
  }
  return errors;
}
