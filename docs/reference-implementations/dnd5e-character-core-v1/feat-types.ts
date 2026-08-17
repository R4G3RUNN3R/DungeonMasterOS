// Reference implementation only.

import type { Dnd5eAbility, Dnd5eRulesProfileId, Dnd5eSkillId } from "./domain";

export type Dnd5eFeatCategory = "origin" | "general" | "fighting-style" | "epic-boon" | "2014-feat" | "source-pack";

export type Dnd5eFeatPrerequisite =
  | { type: "minimum-level"; level: number }
  | { type: "ability-minimum"; ability: Dnd5eAbility; minimum: number }
  | { type: "ability-one-of-minimum"; abilities: Dnd5eAbility[]; minimum: number }
  | { type: "proficiency"; kind: "weapon" | "armor" | "shield" | "skill" | "tool"; id: string }
  | { type: "spellcasting" }
  | { type: "fighting-style-feature" }
  | { type: "other"; ruleId: string };

export type Dnd5eFeatChoice = {
  choiceId: string;
  count: number;
  options:
    | string[]
    | "any-ability"
    | "any-skill"
    | "any-tool"
    | "any-language"
    | "any-origin-feat"
    | "damage-type"
    | "spell-list"
    | "source-registry";
  distinct?: boolean;
};

export type Dnd5eFeatRule = {
  kind:
    | "ability-increase"
    | "proficiency"
    | "expertise"
    | "advantage"
    | "disadvantage"
    | "reroll"
    | "resource"
    | "action"
    | "bonus-action"
    | "reaction"
    | "movement"
    | "damage"
    | "healing"
    | "spell"
    | "initiative"
    | "armor"
    | "weapon"
    | "mastery"
    | "save"
    | "condition"
    | "rest"
    | "other";
  data: Record<string, string | number | boolean | string[]>;
};

export type Dnd5eFeatDefinition = {
  profileId: Dnd5eRulesProfileId;
  id: string;
  displayName: string;
  category: Dnd5eFeatCategory;
  repeatable?: boolean;
  prerequisites: Dnd5eFeatPrerequisite[];
  choices: Dnd5eFeatChoice[];
  rules: Dnd5eFeatRule[];
  /** Concise original implementation note, not copied sourcebook prose. */
  notes?: string[];
};

export type AbilityIncreaseRule = {
  abilities: Dnd5eAbility[] | "any";
  amount: number;
  maximum: number;
};

export const ALL_SKILL_IDS: Dnd5eSkillId[] = [
  "acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation",
  "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival",
];
