// shared/rules-registry/dnd35e/races.ts
//
// D&D 3.5e-specific race/racial-traits schema. Deliberately NOT in a
// shared/edition-neutral file — ability-score racial modifiers, base land
// speed, favored class, and 3.5's specific racial-trait vocabulary
// (Stonecunning, Weapon Familiarity, Elven/Orc Blood, etc.) are 3.5
// concepts, not universal rules-engine concepts. A parallel 5e
// implementation has its own, unrelated race/species model.

export type Dnd35eAbilityCode = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type Dnd35eRaceSize = "fine" | "diminutive" | "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan" | "colossal";

// Most real racial traits genuinely are one-off narrative mechanics
// (Stonecunning, Weapon Familiarity, Spell-Like Abilities, Elven/Orc Blood)
// that don't reduce to a small, fixed set of atomic kinds without a much
// larger effects-modeling system. `special_ability` is the honest catch-all
// for these — same role `special` plays in the feats schema: a real,
// preserved fact this pass didn't force into a wrong structured shape.
export type Dnd35eRacialTrait =
  | { kind: "ability_modifier"; ability: Dnd35eAbilityCode; modifier: number }
  | { kind: "size"; size: Dnd35eRaceSize }
  | { kind: "base_land_speed"; feet: number }
  | { kind: "favored_class"; classCanonicalId: string | null; any: boolean; description: string }
  | { kind: "bonus_feat_count"; count: number; when: string }
  | { kind: "bonus_skill_points"; atFirstLevel: number; perAdditionalLevel: number }
  | { kind: "special_ability"; name: string; description: string };

export interface Dnd35eRacialLanguages {
  automatic: string[];
  bonus: string[] | "any";
}

export interface Dnd35eRaceDefinition {
  canonicalId: string;
  name: string;
  languages: Dnd35eRacialLanguages | null;
  traits: Dnd35eRacialTrait[];
  extractionStatus: "fully_structured" | "partially_structured" | "unresolved";
  extractionNotes: string[];
}
