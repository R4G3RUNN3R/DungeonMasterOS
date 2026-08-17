// Reference implementation only. Resolves Race/Species + Background without mixing editions.

import type { Dnd5eAbility, Dnd5eAbilityScores, Dnd5eCharacterState, Dnd5eProficiencyRef } from "./domain";
import { get2014Race } from "./species-2014";
import { get2024Species } from "./species-2024";
import { get2014Background } from "./backgrounds-2014";
import { get2024Background } from "./backgrounds-2024";
import { applyAbilityAdjustments, validate2024BackgroundAbilityAdjustment } from "./core-tables";

function selectedAbilityAdjustment(value: unknown): Partial<Record<Dnd5eAbility, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Partial<Record<Dnd5eAbility, number>> = {};
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"] as const) {
    const amount = Number((value as Record<string, unknown>)[ability] ?? 0);
    if (Number.isFinite(amount) && amount !== 0) result[ability] = amount;
  }
  return result;
}

export function ancestryDefinition(state: Dnd5eCharacterState) {
  return state.rulesProfileId === "dnd5e-2024"
    ? get2024Species(state.origin.ancestryId)
    : get2014Race(state.origin.ancestryId);
}

export function backgroundDefinition(state: Dnd5eCharacterState) {
  return state.rulesProfileId === "dnd5e-2024"
    ? get2024Background(state.origin.backgroundId)
    : get2014Background(state.origin.backgroundId);
}

export function validateOriginAbilityChoices(state: Dnd5eCharacterState): string[] {
  const ancestry = ancestryDefinition(state);
  const background = backgroundDefinition(state);
  const errors: string[] = [];
  if (!ancestry) errors.push(`Unknown ${state.rulesProfileId === "dnd5e-2024" ? "species" : "race"}: ${state.origin.ancestryId}.`);
  if (!background) errors.push(`Unknown background: ${state.origin.backgroundId}.`);
  if (!ancestry || !background) return errors;

  if (state.rulesProfileId === "dnd5e-2024") {
    const adjustment = selectedAbilityAdjustment(state.origin.backgroundChoices.abilityAdjustments);
    errors.push(...validate2024BackgroundAbilityAdjustment(adjustment, background.abilityOptions ?? []));
    if (Object.keys(selectedAbilityAdjustment(state.origin.ancestryChoices.abilityAdjustments)).length) {
      errors.push("2024 core Species does not supply the standard origin ability-score adjustment; do not also apply 2014 racial ASIs.");
    }
    return errors;
  }

  const flexible = ancestry.flexibleAbilityAdjustment;
  if (flexible?.choose?.length) {
    const chosen = selectedAbilityAdjustment(state.origin.ancestryChoices.abilityAdjustments);
    for (const rule of flexible.choose) {
      const entries = Object.entries(chosen).filter(([, value]) => value === rule.amount) as Array<[Dnd5eAbility, number]>;
      if (entries.length !== rule.count) {
        errors.push(`${ancestry.displayName} requires ${rule.count} chosen ability increase(s) of +${rule.amount}.`);
      }
      const excluded = new Set(rule.excluded ?? []);
      if (entries.some(([ability]) => excluded.has(ability))) errors.push(`${ancestry.displayName} flexible ASI uses an excluded ability.`);
      if (new Set(entries.map(([ability]) => ability)).size !== entries.length) errors.push("Flexible racial ASI choices must target different abilities.");
    }
  }

  return errors;
}

export function originAbilityAdjustments(state: Dnd5eCharacterState): Array<Partial<Record<Dnd5eAbility, number>>> {
  const ancestry = ancestryDefinition(state);
  const background = backgroundDefinition(state);
  if (!ancestry || !background) return [];

  if (state.rulesProfileId === "dnd5e-2024") {
    return [selectedAbilityAdjustment(state.origin.backgroundChoices.abilityAdjustments)];
  }

  return [
    ancestry.fixedAbilityAdjustments ?? {},
    ancestry.flexibleAbilityAdjustment?.fixed ?? {},
    selectedAbilityAdjustment(state.origin.ancestryChoices.abilityAdjustments),
  ];
}

export function abilitiesAfterOrigin(state: Dnd5eCharacterState): Dnd5eAbilityScores {
  return applyAbilityAdjustments(state.assignedAbilityScores, originAbilityAdjustments(state));
}

export function originProficiencies(state: Dnd5eCharacterState): Dnd5eProficiencyRef[] {
  const ancestry = ancestryDefinition(state);
  const background = backgroundDefinition(state);
  if (!ancestry || !background) return [];
  const result: Dnd5eProficiencyRef[] = [];
  const ancestrySource = { sourceId: ancestry.id, sourceType: state.rulesProfileId === "dnd5e-2024" ? "species" as const : "race" as const, label: ancestry.displayName };
  const backgroundSource = { sourceId: background.id, sourceType: "background" as const, label: background.displayName };

  for (const feature of ancestry.features) {
    if (feature.kind !== "proficiency") continue;
    const skill = typeof feature.rules?.skill === "string" ? feature.rules.skill : undefined;
    if (skill) result.push({ kind: "skill", id: skill, multiplier: 1, source: ancestrySource });
    const weapons = Array.isArray(feature.rules?.weapons) ? feature.rules.weapons : [];
    for (const weapon of weapons) result.push({ kind: "weapon", id: String(weapon), multiplier: 1, source: ancestrySource });
  }

  for (const skill of background.fixedSkillProficiencies) result.push({ kind: "skill", id: skill, multiplier: 1, source: backgroundSource });
  for (const tool of background.fixedToolProficiencies ?? []) result.push({ kind: "tool", id: tool, multiplier: 1, source: backgroundSource });

  return result;
}

export function effectiveLanguages(state: Dnd5eCharacterState): string[] {
  const ancestry = ancestryDefinition(state);
  const automatic = ancestry?.automaticLanguages ?? [];
  return [...new Set([...automatic, ...state.origin.languages])];
}
