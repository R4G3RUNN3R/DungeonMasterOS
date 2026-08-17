// Reference implementation only.

import type { Dnd5eRulesProfileId } from "./domain";

export type Dnd5eWeaponDefinition = {
  profileId: Dnd5eRulesProfileId;
  id: string;
  displayName: string;
  category: "simple" | "martial";
  kind: "melee" | "ranged";
  damage: string;
  damageType: "bludgeoning" | "piercing" | "slashing";
  weightLb: number;
  cost: string;
  properties: string[];
  normalRangeFt?: number;
  longRangeFt?: number;
  versatileDamage?: string;
  mastery?: "cleave" | "graze" | "nick" | "push" | "sap" | "slow" | "topple" | "vex";
};

export type Dnd5eArmorDefinition = {
  profileId: Dnd5eRulesProfileId;
  id: string;
  displayName: string;
  category: "light" | "medium" | "heavy" | "shield";
  baseAc: number;
  dexMode: "full" | "max-2" | "none";
  strengthRequirement?: number;
  stealthDisadvantage: boolean;
  weightLb: number;
  cost: string;
  shieldBonus?: number;
};

export type MasteryDefinition = {
  id: NonNullable<Dnd5eWeaponDefinition["mastery"]>;
  trigger: string;
  oncePerTurn?: boolean;
  save?: "con";
  saveDc?: "8+attack-ability-mod+pb";
  rules: Record<string, string | number | boolean>;
};
