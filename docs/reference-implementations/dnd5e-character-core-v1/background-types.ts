// Reference implementation only.

import type { Dnd5eAbility, Dnd5eRulesProfileId, Dnd5eSkillId } from "./domain";

export type Dnd5eBackgroundDefinition = {
  profileId: Dnd5eRulesProfileId;
  id: string;
  displayName: string;
  abilityOptions?: Dnd5eAbility[];
  fixedSkillProficiencies: Dnd5eSkillId[];
  fixedToolProficiencies?: string[];
  toolChoice?: { count: number; options: string[] | "artisan-tools" | "gaming-sets" | "source-registry" };
  languageChoiceCount?: number;
  originFeatId?: string;
  featureId?: string;
  equipment: {
    packageA?: string[];
    packageACoinGp?: number;
    alternativeGp?: number;
  };
  choices: Array<{
    choiceId: string;
    count: number;
    options: string[] | "any-language" | "source-registry";
    description: string;
  }>;
};
