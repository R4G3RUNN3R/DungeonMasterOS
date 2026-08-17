// Reference implementation only.

import type { Dnd5eAbility, Dnd5eRulesProfileId, Dnd5eSize } from "./domain";

export type Dnd5eAncestryChoice = {
  choiceId: string;
  count: number;
  options: string[] | "any-skill" | "any-language" | "any-origin-feat" | "source-registry";
  description: string;
};

export type Dnd5eAncestryFeature = {
  featureId: string;
  label: string;
  level?: number;
  kind:
    | "passive"
    | "proficiency"
    | "resistance"
    | "advantage"
    | "resource"
    | "spell"
    | "movement"
    | "hp"
    | "reroll"
    | "action"
    | "other";
  rules?: Record<string, string | number | boolean | string[]>;
  choiceRequired?: boolean;
};

export type Dnd5eAncestryDefinition = {
  profileId: Dnd5eRulesProfileId;
  id: string;
  displayName: string;
  model: "race" | "species";
  creatureType: string;
  sizeOptions: Dnd5eSize[];
  speedFt: number;
  /** 2014 racial ASIs. 2024 core species normally leaves this empty. */
  fixedAbilityAdjustments?: Partial<Record<Dnd5eAbility, number>>;
  flexibleAbilityAdjustment?: {
    fixed?: Partial<Record<Dnd5eAbility, number>>;
    choose?: Array<{ count: number; amount: number; excluded?: Dnd5eAbility[] }>;
  };
  automaticLanguages?: string[];
  languageChoiceCount?: number;
  variants?: string[];
  features: Dnd5eAncestryFeature[];
  choices: Dnd5eAncestryChoice[];
};
