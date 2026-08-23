// shared/rules-registry/dnd35e/classes.ts
//
// D&D 3.5e-specific class/progression schema. Deliberately NOT in a
// shared/edition-neutral file — BAB progression rate, the good/poor
// save-progression curve, and skill-points-per-level are 3.5 concepts (5e
// has a flat proficiency bonus and no per-class save-progression curve at
// all). A parallel 5e implementation has its own, unrelated class model.
//
// Scope note: this schema currently models the non-spellcasting parts of a
// class (BAB/save progression, hit die, skill points, class skills, class
// features) — every field here was verified against the real Fighter page,
// the first class implemented. Spellcasting classes (Wizard, Sorcerer,
// Cleric, Druid, Bard, Ranger, Paladin) will need a real spellsPerDay/
// spellsKnown progression table added when they're extracted — deliberately
// not guessed or stubbed here ahead of that real work.

export type Dnd35eAbilityCode = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type Dnd35eBabProgression = "full" | "three-quarter" | "half";
export type Dnd35eSaveProgression = "good" | "poor";

export interface Dnd35eClassLevelProgressionRow {
  level: number;
  baseAttackBonus: number;
  fortSave: number;
  refSave: number;
  willSave: number;
  // Real #slug anchor references from the table's Special column — cross-
  // references classFeatures[].slug. Empty when the row's Special cell is
  // blank (most rows).
  specialFeatureSlugs: string[];
  // Monk-specific extra progression columns — undefined for every other
  // class. Monk's real table has 4 extra columns beyond the standard 6;
  // rather than a separate parallel row type, these are modeled as optional
  // fields here so levelProgression stays one uniform array.
  flurryOfBlowsAttackBonus?: string; // e.g. "-2/-2" — real multi-attack penalty notation, not one reducible number the way normal iterative BAB is
  unarmedDamage?: string; // e.g. "1d6" — a real dice expression, not a flat number
  acBonus?: number;
  unarmoredSpeedBonus?: number; // feet
}

export interface Dnd35eClassSkill {
  skillCanonicalId: string;
  keyAbility: Dnd35eAbilityCode;
}

export interface Dnd35eClassFeature {
  slug: string;
  name: string;
  description: string;
}

export type Dnd35eSpellcastingType = "prepared" | "spontaneous";

export interface Dnd35eSpellsPerDayEntry {
  spellLevel: number;
  base: number | null; // null = not yet available at this class level (the real page's "—")
  // A real, class-specific bonus slot notation, e.g. Cleric's "+1" domain
  // spell (always exactly 1, every level once domain spells are available).
  // 0 when the real cell has no "+N" suffix.
  bonusSlots: number;
}

export interface Dnd35eSpellsPerDayRow {
  level: number;
  entries: Dnd35eSpellsPerDayEntry[];
}

export interface Dnd35eClassSpellcasting {
  spellcastingAbility: Dnd35eAbilityCode;
  // "prepared" (Cleric/Druid/Wizard/Paladin/Ranger — chooses spells from a
  // known list before the day begins) vs "spontaneous" (Sorcerer/Bard — casts
  // from a fixed, smaller repertoire and needs a real Spells Known table,
  // not modeled here yet — see the extraction report's scope note).
  type: Dnd35eSpellcastingType;
  spellsPerDay: Dnd35eSpellsPerDayRow[];
}

export interface Dnd35eClassDefinition {
  canonicalId: string;
  name: string;
  // Real prose, not force-enumerated: 3.5 core classes phrase alignment
  // restriction inconsistently ("Any", "Any lawful", "Any nonlawful",
  // "Lawful good, lawful neutral, or lawful evil" for the Monk) — flattening
  // that into a fixed set of literal values would misrepresent the real
  // compound restrictions some classes have.
  alignment: string;
  hitDie: number;
  babProgression: Dnd35eBabProgression;
  saveProgression: { fort: Dnd35eSaveProgression; ref: Dnd35eSaveProgression; will: Dnd35eSaveProgression };
  skillPointsBase: number;
  classSkills: Dnd35eClassSkill[];
  levelProgression: Dnd35eClassLevelProgressionRow[];
  classFeatures: Dnd35eClassFeature[];
  // null for non-spellcasting classes (Fighter, Barbarian, Rogue, Monk).
  spellcasting: Dnd35eClassSpellcasting | null;
  extractionStatus: "fully_structured" | "partially_structured" | "unresolved";
  extractionNotes: string[];
}
