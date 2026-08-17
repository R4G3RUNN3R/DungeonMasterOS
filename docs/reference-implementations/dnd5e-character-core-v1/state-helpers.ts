// Reference implementation only.

import type { Dnd5eAbilityScores, Dnd5eCharacterState, Dnd5eLevelRecord } from "./domain";
import { abilitiesAfterOrigin } from "./origin";
import { get2014Class } from "./classes-2014";
import { get2024Class } from "./classes-2024";
import { abilityModifier, nextLevelExperience, proficiencyBonus } from "./core-tables";

export function characterLevel(state: Pick<Dnd5eCharacterState, "levels">): number {
  return state.levels.length;
}

export function classTotals(levels: Dnd5eLevelRecord[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const level of levels) totals[level.classId] = (totals[level.classId] ?? 0) + 1;
  return totals;
}

export function classLevel(state: Pick<Dnd5eCharacterState, "levels">, classId: string): number {
  return state.levels.filter((level) => level.classId === classId).length;
}

export function effectiveAbilities(state: Dnd5eCharacterState): Dnd5eAbilityScores {
  const result = abilitiesAfterOrigin(state);
  for (const level of state.levels) {
    for (const [ability, amount] of Object.entries(level.abilityScoreIncreases) as Array<[keyof Dnd5eAbilityScores, number]>) {
      result[ability] = Math.min(20, result[ability] + (amount ?? 0));
    }
  }
  return result;
}

export function canGainAnotherLevel(state: Dnd5eCharacterState): boolean {
  return state.experiencePoints >= nextLevelExperience(characterLevel(state));
}

export function maximumHitPoints(state: Dnd5eCharacterState): number {
  const con = abilityModifier(effectiveAbilities(state).con);
  return state.levels.reduce((sum, level) => sum + Math.max(1, level.hitPointRoll + con), 0);
}

export function classDefinition(state: Dnd5eCharacterState, classId: string) {
  return state.rulesProfileId === "dnd5e-2024" ? get2024Class(classId) : get2014Class(classId);
}

export function totalProficiencyBonus(state: Dnd5eCharacterState): number {
  return proficiencyBonus(characterLevel(state));
}

export function maximumAttunementItems(_state: Dnd5eCharacterState): number {
  // Default core rule. Individual features/subclasses may modify this through source-pack/feature rules.
  return 3;
}

export function classHitDice(state: Dnd5eCharacterState): Array<{ classId: string; die: number; count: number }> {
  const totals = classTotals(state.levels);
  return Object.entries(totals).map(([classId, count]) => ({
    classId,
    die: classDefinition(state, classId)?.traits.hitDie ?? 0,
    count,
  }));
}
