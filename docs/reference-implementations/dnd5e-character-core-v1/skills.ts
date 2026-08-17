// Reference implementation only.

import type { Dnd5eAbility, Dnd5eRulesProfileId, Dnd5eSkillId } from "./domain";
import { abilityModifier, proficiencyBonus } from "./core-tables";

export type Dnd5eSkillDefinition = {
  id: Dnd5eSkillId;
  displayName: string;
  defaultAbility: Dnd5eAbility;
};

export const DND5E_SKILL_DEFINITIONS: Record<Dnd5eSkillId, Dnd5eSkillDefinition> = {
  acrobatics: { id: "acrobatics", displayName: "Acrobatics", defaultAbility: "dex" },
  "animal-handling": { id: "animal-handling", displayName: "Animal Handling", defaultAbility: "wis" },
  arcana: { id: "arcana", displayName: "Arcana", defaultAbility: "int" },
  athletics: { id: "athletics", displayName: "Athletics", defaultAbility: "str" },
  deception: { id: "deception", displayName: "Deception", defaultAbility: "cha" },
  history: { id: "history", displayName: "History", defaultAbility: "int" },
  insight: { id: "insight", displayName: "Insight", defaultAbility: "wis" },
  intimidation: { id: "intimidation", displayName: "Intimidation", defaultAbility: "cha" },
  investigation: { id: "investigation", displayName: "Investigation", defaultAbility: "int" },
  medicine: { id: "medicine", displayName: "Medicine", defaultAbility: "wis" },
  nature: { id: "nature", displayName: "Nature", defaultAbility: "int" },
  perception: { id: "perception", displayName: "Perception", defaultAbility: "wis" },
  performance: { id: "performance", displayName: "Performance", defaultAbility: "cha" },
  persuasion: { id: "persuasion", displayName: "Persuasion", defaultAbility: "cha" },
  religion: { id: "religion", displayName: "Religion", defaultAbility: "int" },
  "sleight-of-hand": { id: "sleight-of-hand", displayName: "Sleight of Hand", defaultAbility: "dex" },
  stealth: { id: "stealth", displayName: "Stealth", defaultAbility: "dex" },
  survival: { id: "survival", displayName: "Survival", defaultAbility: "wis" },
};

export function skillModifier(input: {
  characterLevel: number;
  abilityScore: number;
  proficiencyMultiplier: 0 | 1 | 2;
  misc?: number;
}): number {
  return abilityModifier(input.abilityScore) +
    proficiencyBonus(input.characterLevel) * input.proficiencyMultiplier +
    (input.misc ?? 0);
}

export function savingThrowModifier(input: {
  characterLevel: number;
  abilityScore: number;
  proficient: boolean;
  misc?: number;
}): number {
  return abilityModifier(input.abilityScore) +
    (input.proficient ? proficiencyBonus(input.characterLevel) : 0) +
    (input.misc ?? 0);
}

/**
 * Both profiles can pair different abilities with skills when the GM calls for it.
 * The default ability is a convenience, not a permanent binding in the data model.
 */
export function abilityCheckModifier(input: {
  characterLevel: number;
  abilityScore: number;
  proficiencyMultiplier?: 0 | 1 | 2;
  misc?: number;
}): number {
  return abilityModifier(input.abilityScore) +
    proficiencyBonus(input.characterLevel) * (input.proficiencyMultiplier ?? 0) +
    (input.misc ?? 0);
}

export type ToolCheckResolution = {
  modifier: number;
  advantageSources: string[];
};

/** Revised 2024 tool rule: tool proficiency adds PB; if a relevant skill proficiency also applies, gain Advantage. */
export function toolCheck2024(input: {
  characterLevel: number;
  abilityScore: number;
  toolProficient: boolean;
  relevantSkillProficient: boolean;
  misc?: number;
}): ToolCheckResolution {
  return {
    modifier: abilityModifier(input.abilityScore) +
      (input.toolProficient ? proficiencyBonus(input.characterLevel) : 0) +
      (input.misc ?? 0),
    advantageSources: input.toolProficient && input.relevantSkillProficient ? ["tool-and-skill-proficiency"] : [],
  };
}

export function skillRulesProfileNote(profile: Dnd5eRulesProfileId): string {
  return profile === "dnd5e-2024"
    ? "Use revised D20 Test/glossary and explicit tool-skill Advantage interactions."
    : "Use 2014 ability-check, skill and tool proficiency rules and any enabled variant ability/skill pairings.";
}
