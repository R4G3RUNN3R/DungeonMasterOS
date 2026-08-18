import type { Dnd35SourceRef } from "./types";

export type Dnd35ItemCategory =
  | "weapon"
  | "armor"
  | "shield"
  | "ammunition"
  | "gear"
  | "tool"
  | "potion"
  | "oil"
  | "scroll"
  | "wand"
  | "staff"
  | "ring"
  | "rod"
  | "wondrous"
  | "magic-weapon"
  | "magic-armor"
  | "cursed"
  | "artifact"
  | "other";

export type Dnd35Price = {
  amount: number;
  currency: "cp" | "sp" | "gp" | "pp";
  modifier?: boolean;
  text: string;
};

export type Dnd35WeaponStats = {
  proficiency: "simple" | "martial" | "exotic" | "special";
  usage: "unarmed" | "light" | "one-handed" | "two-handed" | "ranged" | "special";
  damageSmall?: string;
  damageMedium?: string;
  critical?: string;
  rangeIncrementFeet?: number;
  damageTypes: string[];
  doubleWeapon?: boolean;
  reach?: boolean;
  thrown?: boolean;
  projectile?: boolean;
};

export type Dnd35ArmorStats = {
  armorClass: "light" | "medium" | "heavy" | "shield" | "special";
  armorOrShieldBonus?: number;
  maximumDexBonus?: number | null;
  armorCheckPenalty?: number | null;
  arcaneSpellFailurePercent?: number | null;
  speed30Feet?: number | null;
  speed20Feet?: number | null;
};

export type Dnd35MagicItemStats = {
  casterLevel?: number;
  aura?: string;
  activation?: string;
  charges?: number;
  spellIds?: string[];
  prerequisites?: string[];
  creationCostGp?: number;
  creationXp?: number;
  bodySlot?: string;
};

export type Dnd35ItemDefinition = {
  id: string;
  name: string;
  edition: "3.5e";
  category: Dnd35ItemCategory;
  subcategory?: string;
  price?: Dnd35Price;
  weightLb?: number;
  consumable?: boolean;
  weapon?: Dnd35WeaponStats;
  armor?: Dnd35ArmorStats;
  magic?: Dnd35MagicItemStats;
  rulesSummary: string;
  rulesText?: string;
  executionStatus: "structured" | "reference" | "executable";
  sources: Dnd35SourceRef[];
  tags: string[];
};
