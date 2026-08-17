// Reference implementation only. This directory is intentionally outside tsconfig include.
// Port the winning pieces into production after comparing the live server.

export const DND35_RULESET_ID = "dnd35-core" as const;
export const DND35_STATE_VERSION = 2 as const;

export const DND35_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Dnd35Ability = (typeof DND35_ABILITIES)[number];
export type Dnd35AbilityScores = Record<Dnd35Ability, number>;

export const DND35_SAVES = ["fortitude", "reflex", "will"] as const;
export type Dnd35Save = (typeof DND35_SAVES)[number];

export const DND35_SIZES = [
  "fine",
  "diminutive",
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
  "colossal",
] as const;
export type Dnd35Size = (typeof DND35_SIZES)[number];

export const CORE_RACE_IDS = [
  "human",
  "dwarf",
  "elf",
  "gnome",
  "half-elf",
  "half-orc",
  "halfling",
] as const;
export type CoreRaceId = (typeof CORE_RACE_IDS)[number];
export type Dnd35RaceId = CoreRaceId | (string & {});

export const CORE_CLASS_IDS = [
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "wizard",
] as const;
export type CoreClassId = (typeof CORE_CLASS_IDS)[number];
export type Dnd35ClassId = CoreClassId | (string & {});

export type Dnd35SourceRef = {
  sourceId: string;
  sourceType:
    | "race"
    | "class"
    | "feat"
    | "item"
    | "effect"
    | "spell"
    | "level"
    | "campaign"
    | "homebrew"
    | "legacy";
  label?: string;
};

export type Dnd35RaceSelection = {
  raceId: Dnd35RaceId;
  variantId?: string;
  /** Player-owned racial choices only. The rules engine grants the entitlement; the player supplies values. */
  choices: Record<string, string | string[]>;
};

export type Dnd35FeatAcquisition = {
  featId?: string;
  name: string;
  acquiredAtCharacterLevel: number;
  source: "general" | "human_bonus" | "fighter_bonus" | "monk_bonus" | "wizard_bonus" | "class" | "other";
  sourceDetail?: string;
  choices?: Record<string, string | string[]>;
};

export type Dnd35SkillPurchase = {
  /** Stable canonical skill key, e.g. `hide`, `knowledge:arcana`, `craft:alchemy`. */
  skillId: string;
  ranksPurchased: number;
  pointsSpent: number;
  classSkillForThisLevel: boolean;
};

export type Dnd35SpellChoice = {
  spellId?: string;
  name: string;
  spellLevel: number;
  kind: "known" | "spellbook" | "prepared" | "domain" | "other";
  classId: Dnd35ClassId;
};

export type Dnd35ClassChoice = {
  choiceId: string;
  values: string[];
};

/**
 * One immutable character-level acquisition record.
 *
 * This is intentionally more specific than `classLevels: [{ className, level }]`.
 * Multiclass BAB/saves, HP, skill-point cost and player choices depend on WHICH
 * class was taken at each character level, not just the final totals.
 */
export type Dnd35LevelRecord = {
  characterLevel: number;
  classId: Dnd35ClassId;

  /** Actual Hit Die result used for this level before current CON modifier. */
  hitPointRoll: number;
  hitDie: number;

  skillPointBudget: number;
  skillPurchases: Dnd35SkillPurchase[];

  featChoices: Dnd35FeatAcquisition[];
  abilityIncrease?: Dnd35Ability;
  classChoices: Dnd35ClassChoice[];
  spellChoices: Dnd35SpellChoice[];

  /** Synthetic records created during migration may not have complete historical detail. */
  legacyImported?: boolean;
};

export type Dnd35SpellResourceState = {
  classId: Dnd35ClassId;
  casterLevel?: number;
  /** Slots available by spell level after class/ability calculations. */
  slots?: Record<string, number>;
  /** Runtime usage, reset by the correct rest/preparation flow. */
  usedSlots?: Record<string, number>;
  prepared?: Dnd35SpellChoice[];
  known?: Dnd35SpellChoice[];
  spellbook?: Dnd35SpellChoice[];
  domains?: string[];
  specialization?: string;
  prohibitedSchools?: string[];
};

export type Dnd35ResourceState = {
  resourceId: string;
  label: string;
  current: number;
  maximum: number;
  refresh: "round" | "encounter" | "daily" | "rest" | "manual" | "other";
  source: Dnd35SourceRef;
};

export type Dnd35PersistentChoiceState = {
  alignment?: string;
  deity?: string;
  languages: string[];
  notes?: string;
};

export type Dnd35CreationProvenance = {
  abilityGenerationMethod?: "4d6_drop_lowest" | "3d6" | "point_buy" | "manual" | "imported" | "other";
  /** Optional raw rolled values. These are evidence, not final assigned scores. */
  abilityRolls?: number[];
  createdAt?: string;
  importedFrom?: string;
};

/**
 * Canonical D&D 3.5e rules state.
 *
 * Runtime inventory, currency and temporary timed effects intentionally live
 * outside this object. The sheet projector consumes them as independent trusted
 * inputs. `characters.level`, display race/class, max HP, speed and attacks/round
 * may remain compatibility projections for the existing application, but the
 * D&D state below owns the rule choices that produce them.
 */
export type Dnd35CharacterState = {
  version: typeof DND35_STATE_VERSION;
  rulesetId: typeof DND35_RULESET_ID;

  characterId: number;
  race: Dnd35RaceSelection;

  /** Scores as assigned by the player BEFORE racial adjustments and later level increases. */
  baseAbilityScores: Dnd35AbilityScores;

  /** Character XP under the configured D&D 3.5e progression policy. */
  experiencePoints: number;

  persistentChoices: Dnd35PersistentChoiceState;
  provenance: Dnd35CreationProvenance;

  /** Ordered, append-only progression history for new characters. */
  levels: Dnd35LevelRecord[];

  /** Runtime spell preparation/usage. Permanent spell choices should also be represented in level history. */
  spellcasting: Dnd35SpellResourceState[];

  /** Runtime class/racial resources such as rage/day or bardic music/day. */
  resources: Dnd35ResourceState[];

  /** Optional migration notes; never a source for mechanical values. */
  migrationNotes?: string[];
};

export type Dnd35ClassTotals = Record<string, number>;

export type Dnd35SkillState = {
  skillId: string;
  ranks: number;
  isClassSkillForAnyClass: boolean;
  ability: Dnd35Ability | null;
  trainedOnly: boolean;
  armorCheckPenaltyApplies: boolean;
};

export type Dnd35SaveBreakdown = {
  total: number;
  base: number;
  abilityModifier: number;
  misc: number;
};

export type Dnd35ArmorClassBreakdown = {
  total: number;
  touch: number;
  flatFooted: number;
  armor: number;
  shield: number;
  dexterity: number;
  size: number;
  naturalArmor: number;
  deflection: number;
  dodge: number;
  misc: number;
};

export type Dnd35DerivedCharacter = {
  characterLevel: number;
  classTotals: Dnd35ClassTotals;
  effectiveAbilities: Dnd35AbilityScores;
  abilityModifiers: Record<Dnd35Ability, number>;
  effectiveSize: Dnd35Size;
  baseAttackBonus: number;
  iterativeAttacks: number[];
  baseSaves: Record<Dnd35Save, number>;
  saves: Record<Dnd35Save, Dnd35SaveBreakdown>;
  grapple: number;
  armorClass: Dnd35ArmorClassBreakdown;
  skills: Record<string, Dnd35SkillState & { total: number; misc: number; armorCheckPenalty: number }>;
  maximumHitPoints: number;
  landSpeed: number;
  attacksPerRound: number;
  nextLevelExperience: number;
};

export type Dnd35EquipmentSnapshot = {
  itemId: number;
  name: string;
  itemType: string;
  equipped: boolean;
  quantity: number;
  identified: boolean;
  /** Adapter-populated 3.5e rule payload. The existing item row remains authoritative for ownership/equipped state. */
  rules?: {
    weightLb?: number;
    weapon?: {
      attackAbility?: Dnd35Ability;
      damageAbility?: Dnd35Ability;
      damage?: string;
      critical?: string;
      rangeFt?: number;
      damageType?: string;
      size?: Dnd35Size;
      enhancementBonus?: number;
    };
    armor?: {
      armorBonus?: number;
      shieldBonus?: number;
      maxDexBonus?: number | null;
      armorCheckPenalty?: number;
      arcaneSpellFailurePercent?: number;
      speed30?: number;
      speed20?: number;
      category?: "light" | "medium" | "heavy" | "shield";
      enhancementBonus?: number;
    };
  };
};

export type Dnd35ActiveEffectSnapshot = {
  effectId: number;
  name: string;
  source?: string;
  durationType?: string;
  roundsRemaining?: number | null;
  /** Converted from the production/main active-effect stat-mod representation by an adapter. */
  modifiers: unknown[];
};

export function createEmptyDnd35State(characterId: number, raceId: Dnd35RaceId, baseAbilityScores: Dnd35AbilityScores): Dnd35CharacterState {
  return {
    version: DND35_STATE_VERSION,
    rulesetId: DND35_RULESET_ID,
    characterId,
    race: { raceId, choices: {} },
    baseAbilityScores: { ...baseAbilityScores },
    experiencePoints: 0,
    persistentChoices: { languages: [] },
    provenance: {},
    levels: [],
    spellcasting: [],
    resources: [],
  };
}
