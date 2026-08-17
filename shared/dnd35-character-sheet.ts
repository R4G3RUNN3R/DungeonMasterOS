export const DND35_SHEET_VERSION = 1 as const;
export const DND35_SYSTEM = "D&D 3.5e" as const;

export type Dnd35Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type Dnd35Save = "fortitude" | "reflex" | "will";

export type Dnd35ClassLevel = {
  className: string;
  level: number;
};

export type Dnd35AbilityEntry = {
  score?: number;
  temporaryScore?: number | null;
};

export type Dnd35ArmorClass = {
  total?: number;
  touch?: number;
  flatFooted?: number;
  armorBonus?: number;
  shieldBonus?: number;
  dexModifier?: number;
  sizeModifier?: number;
  naturalArmor?: number;
  deflectionBonus?: number;
  dodgeBonus?: number;
  miscModifier?: number;
  temporaryModifier?: number;
};

export type Dnd35Initiative = {
  total?: number;
  dexModifier?: number;
  miscModifier?: number;
};

export type Dnd35Grapple = {
  total?: number;
  baseAttackBonus?: number;
  strengthModifier?: number;
  sizeModifier?: number;
  miscModifier?: number;
};

export type Dnd35SaveEntry = {
  total?: number;
  baseSave?: number;
  abilityModifier?: number;
  magicModifier?: number;
  miscModifier?: number;
  temporaryModifier?: number;
  notes?: string;
};

export type Dnd35SkillEntry = {
  name: string;
  ability?: Dnd35Ability | "none";
  classSkill?: boolean;
  trainedOnly?: boolean;
  ranks?: number;
  abilityModifier?: number;
  miscModifier?: number;
  armorCheckPenalty?: number;
  total?: number;
  notes?: string;
};

export type Dnd35WeaponEntry = {
  name: string;
  attackBonus?: string;
  damage?: string;
  critical?: string;
  range?: string;
  damageType?: string;
  size?: string;
  weight?: string;
  ammunition?: string;
  notes?: string;
};

export type Dnd35ArmorEntry = {
  name: string;
  type?: string;
  armorBonus?: number;
  maxDexBonus?: number | string;
  armorCheckPenalty?: number;
  arcaneSpellFailure?: string;
  speed?: string;
  weight?: string;
  notes?: string;
};

export type Dnd35GearEntry = {
  name: string;
  quantity?: number;
  weight?: string;
  location?: string;
  notes?: string;
};

export type Dnd35WealthEntry = {
  code: string;
  name?: string;
  amount: number;
  symbol?: string;
};

export type Dnd35Encumbrance = {
  currentWeight?: string;
  lightLoad?: string;
  mediumLoad?: string;
  heavyLoad?: string;
  liftOverHead?: string;
  liftOffGround?: string;
  pushOrDrag?: string;
};

export type Dnd35FeatEntry = {
  name: string;
  source?: string;
  description?: string;
};

export type Dnd35SpecialAbilityEntry = {
  name: string;
  source?: string;
  description?: string;
};

export type Dnd35SpellEntry = {
  name: string;
  level: number;
  school?: string;
  prepared?: number;
  known?: boolean;
  used?: number;
  notes?: string;
};

export type Dnd35SpellcastingBlock = {
  casterClass: string;
  casterLevel?: number;
  castingAbility?: Dnd35Ability;
  domains?: string[];
  specialization?: string;
  prohibitedSchools?: string[];
  spellResistance?: number | string;
  spellSaveDcByLevel?: Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9", number>>;
  spellsPerDay?: Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9", number | string>>;
  bonusSpells?: Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9", number | string>>;
  spells?: Dnd35SpellEntry[];
  notes?: string;
};

/**
 * Canonical read model for the full D&D 3.5e character sheet popup.
 *
 * DungeonMasterOS may store this object at characterData.dnd35Sheet. Fields are
 * optional so the sheet can be shown during character creation and progressively
 * filled as dice are rolled and permanent choices are made. Missing values must
 * remain visibly blank/unknown; consumers should never invent character choices.
 */
export type Dnd35CharacterSheetData = {
  version: typeof DND35_SHEET_VERSION;
  system: typeof DND35_SYSTEM;
  identity?: {
    playerName?: string;
    characterName?: string;
    classes?: Dnd35ClassLevel[];
    race?: string;
    alignment?: string;
    deity?: string;
    size?: string;
    age?: string | number;
    gender?: string;
    height?: string;
    weight?: string;
    eyes?: string;
    hair?: string;
    skin?: string;
    experiencePoints?: number;
    nextLevelExperience?: number;
  };
  abilities?: Partial<Record<Dnd35Ability, Dnd35AbilityEntry>>;
  hitPoints?: {
    current?: number;
    maximum?: number;
    temporary?: number;
    nonlethalDamage?: number;
    hitDice?: string;
    woundsOrNotes?: string;
  };
  movement?: {
    land?: number;
    fly?: number;
    swim?: number;
    climb?: number;
    burrow?: number;
    notes?: string;
  };
  combat?: {
    armorClass?: Dnd35ArmorClass;
    initiative?: Dnd35Initiative;
    baseAttackBonus?: number;
    grapple?: Dnd35Grapple;
    spellResistance?: number | string;
    damageReduction?: string;
    attacksPerRound?: number;
    weapons?: Dnd35WeaponEntry[];
  };
  saves?: Partial<Record<Dnd35Save, Dnd35SaveEntry>>;
  skills?: Dnd35SkillEntry[];
  feats?: Dnd35FeatEntry[];
  specialAbilities?: Dnd35SpecialAbilityEntry[];
  proficiencies?: {
    weapons?: string[];
    armor?: string[];
    shields?: string[];
    other?: string[];
  };
  languages?: string[];
  equipment?: {
    armor?: Dnd35ArmorEntry[];
    gear?: Dnd35GearEntry[];
    wealth?: Dnd35WealthEntry[];
    encumbrance?: Dnd35Encumbrance;
  };
  spellcasting?: Dnd35SpellcastingBlock[];
  notes?: {
    traits?: string;
    backstory?: string;
    alliesAndContacts?: string;
    enemies?: string;
    campaignNotes?: string;
  };
};
