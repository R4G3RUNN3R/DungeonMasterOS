// Reference implementation only.

import type { Dnd5eAbility, Dnd5eRulesProfileId, Dnd5eSkillId } from "./domain";

export type Dnd5eClassFeatureGrant = {
  level: number;
  id: string;
  label: string;
  choiceRequired?: boolean;
  choiceKind?: "subclass" | "feat" | "skill" | "tool" | "fighting-style" | "weapon-mastery" | "spell" | "invocation" | "metamagic" | "other";
  repeatable?: boolean;
  rules?: Record<string, string | number | boolean | string[]>;
};

export type Dnd5eClassTraits = {
  primaryAbilities: Dnd5eAbility[];
  hitDie: 6 | 8 | 10 | 12;
  saveProficiencies: Dnd5eAbility[];
  skillChoices: { count: number; options: Dnd5eSkillId[] | "any" };
  weaponProficiencies: string[];
  armorTraining: string[];
  toolProficiencies?: string[];
  toolChoice?: { count: number; options: string[] | "artisan-tools" | "musical-instruments" | "source-registry" };
  startingEquipmentOptions?: string[][];
  startingGoldGp?: number;
};

export type Dnd5eMulticlassGrant = {
  hitDie: boolean;
  armorTraining?: string[];
  weaponProficiencies?: string[];
  toolProficiencies?: string[];
  skillChoice?: { count: number; options: Dnd5eSkillId[] | "class-list" | "any" };
};

export type Dnd5eSpellcastingClassProfile = {
  mode: "full" | "half" | "pact";
  ability: Dnd5eAbility;
  startsAtClassLevel: number;
  preparationModel: "prepared-list" | "known-list" | "spellbook" | "pact-prepared";
  ritualModel?: "prepared-only" | "spellbook" | "class-list" | "feature";
};

export type Dnd5eClassDefinition = {
  profileId: Dnd5eRulesProfileId;
  id: string;
  displayName: string;
  traits: Dnd5eClassTraits;
  multiclassPrerequisites: Array<{ ability: Dnd5eAbility; minimum: number }> | Array<{ either: Array<{ ability: Dnd5eAbility; minimum: number }> }>;
  multiclassGrant: Dnd5eMulticlassGrant;
  spellcasting?: Dnd5eSpellcastingClassProfile;
  subclassLevels: number[];
  publicCoreSubclassId: string;
  features: Dnd5eClassFeatureGrant[];
};

export type Dnd5eSubclassDefinition = {
  profileId: Dnd5eRulesProfileId;
  id: string;
  classId: string;
  displayName: string;
  sourceId: string;
  features: Dnd5eClassFeatureGrant[];
};
