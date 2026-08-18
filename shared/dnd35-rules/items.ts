import type { Dnd35SourceRef, Dnd35SpellTradition } from "./types";

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
  /** Price normalized to this currency. Multi-denomination SRD prices use gp. */
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

export type Dnd35MagicItemSpellUse = {
  spellId: string;
  tradition?: Dnd35SpellTradition;
  charges: number;
  casterLevel?: number;
  spellLevel?: number;
  notes?: string;
};

export type Dnd35MagicItemStats = {
  casterLevel?: number;
  aura?: string;
  activation?: "use-activated" | "spell-completion" | "spell-trigger" | "command-word" | "continuous" | "special";
  activationText?: string;
  charges?: number;
  consumesOnUse?: boolean;
  spellIds?: string[];
  spellUses?: Dnd35MagicItemSpellUse[];
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
