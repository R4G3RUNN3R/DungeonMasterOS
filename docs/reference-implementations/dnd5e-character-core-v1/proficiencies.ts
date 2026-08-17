// Reference implementation only.

import type { Dnd5eCharacterState, Dnd5eProficiencyRef } from "./domain";
import { originProficiencies } from "./origin";
import { classDefinition, classTotals } from "./state-helpers";
import { isActuallyMulticlassing, multiclassProficiencyGrants } from "./multiclass";

function key(proficiency: Dnd5eProficiencyRef): string {
  return `${proficiency.kind}:${proficiency.id}`;
}

export function dedupeProficiencies(proficiencies: Dnd5eProficiencyRef[]): Dnd5eProficiencyRef[] {
  const byKey = new Map<string,Dnd5eProficiencyRef>();
  for (const proficiency of proficiencies) {
    const existing = byKey.get(key(proficiency));
    if (!existing || proficiency.multiplier > existing.multiplier) byKey.set(key(proficiency), proficiency);
  }
  return [...byKey.values()];
}

export function aggregateProficiencies(state: Dnd5eCharacterState): Dnd5eProficiencyRef[] {
  const result: Dnd5eProficiencyRef[] = [
    ...originProficiencies(state),
    ...state.proficiencies,
    ...state.levels.flatMap((level) => level.proficiencyChoices),
  ];

  const firstLevel = state.levels[0];
  if (firstLevel) {
    const firstClass = classDefinition(state, firstLevel.classId);
    if (firstClass) {
      const source = { sourceId:firstClass.id, sourceType:"class" as const, label:firstClass.displayName };
      firstClass.traits.saveProficiencies.forEach((ability) => result.push({ kind:"save", id:ability, multiplier:1, source }));
      firstClass.traits.weaponProficiencies.forEach((id) => result.push({ kind:"weapon", id, multiplier:1, source }));
      firstClass.traits.armorTraining.forEach((id) => result.push({ kind:id === "shields" ? "shield" : "armor", id, multiplier:1, source }));
      firstClass.traits.toolProficiencies?.forEach((id) => result.push({ kind:"tool", id, multiplier:1, source }));
    }
  }

  // A new multiclass grants only the explicit multiclass package, never the full level-1 package.
  const seen = new Set<string>();
  for (const level of state.levels) {
    if (seen.has(level.classId)) continue;
    if (level.characterLevel === 1) {
      seen.add(level.classId);
      continue;
    }
    const before = { ...state, levels: state.levels.filter((entry) => entry.characterLevel < level.characterLevel) };
    if (isActuallyMulticlassing(before, level.classId)) {
      const grants = multiclassProficiencyGrants(before, level.classId);
      const cls = classDefinition(state, level.classId);
      const source = { sourceId:`${level.classId}:multiclass`, sourceType:"class" as const, label:`${cls?.displayName ?? level.classId} multiclass` };
      grants?.weaponProficiencies?.forEach((id) => result.push({ kind:"weapon", id, multiplier:1, source }));
      grants?.armorTraining?.forEach((id) => result.push({ kind:id === "shields" ? "shield" : "armor", id, multiplier:1, source }));
      grants?.toolProficiencies?.forEach((id) => result.push({ kind:"tool", id, multiplier:1, source }));
    }
    seen.add(level.classId);
  }

  return dedupeProficiencies(result);
}

export function proficiencyMultiplier(state: Dnd5eCharacterState, kind: Dnd5eProficiencyRef["kind"], id: string): 0|1|2 {
  return aggregateProficiencies(state).find((entry) => entry.kind === kind && entry.id === id)?.multiplier ?? 0;
}

export function hasArmorTraining(state: Dnd5eCharacterState, category: "light"|"medium"|"heavy"|"shield"): boolean {
  const proficiencies = aggregateProficiencies(state);
  if (category === "shield") return proficiencies.some((entry) => entry.kind === "shield");
  return proficiencies.some((entry) => entry.kind === "armor" && (entry.id === category || entry.id === "all-armor"));
}

export function hasWeaponProficiency(state: Dnd5eCharacterState, weaponCategoryOrId: string): boolean {
  const proficiencies = aggregateProficiencies(state);
  return proficiencies.some((entry) => entry.kind === "weapon" && [weaponCategoryOrId,"simple","martial"].includes(entry.id));
}

export function classList(state: Dnd5eCharacterState): string[] {
  return Object.keys(classTotals(state.levels));
}
