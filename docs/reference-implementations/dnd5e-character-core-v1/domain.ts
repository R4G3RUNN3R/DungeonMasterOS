// Reference implementation only. This directory is outside the current app build.

export const DND5E_STATE_VERSION = 1 as const;
export const DND5E_RULES_PROFILES = ["dnd5e-2014", "dnd5e-2024"] as const;
export type Dnd5eRulesProfileId = (typeof DND5E_RULES_PROFILES)[number];

export const DND5E_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Dnd5eAbility = (typeof DND5E_ABILITIES)[number];
export type Dnd5eAbilityScores = Record<Dnd5eAbility, number>;

export const DND5E_SKILLS = [
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
] as const;
export type Dnd5eSkillId = (typeof DND5E_SKILLS)[number];

export type Dnd5eSize = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";

export type Dnd5eSourceRef = {
  sourceId: string;
  sourceType:
    | "core"
    | "species"
    | "race"
    | "background"
    | "class"
    | "subclass"
    | "feat"
    | "item"
    | "effect"
    | "spell"
    | "campaign"
    | "homebrew"
    | "legacy";
  label?: string;
};

export type Dnd5eChoiceValue = string | number | boolean | string[] | Record<string, string | number | boolean>;

export type Dnd5eOriginState = {
  /** 2014 calls this Race; 2024 calls this Species. Stable source ids prevent display-name ambiguity. */
  ancestryId: string;
  ancestryVariantId?: string;
  backgroundId: string;
  ancestryChoices: Record<string, Dnd5eChoiceValue>;
  backgroundChoices: Record<string, Dnd5eChoiceValue>;
  languages: string[];
};

export type Dnd5eProficiencyRef = {
  kind: "skill" | "save" | "weapon" | "armor" | "shield" | "tool" | "language";
  id: string;
  /** 1 = proficiency, 2 = expertise/doubled proficiency where the granting rule permits it. */
  multiplier: 1 | 2;
  source: Dnd5eSourceRef;
};

export type Dnd5eFeatChoice = {
  featId: string;
  acquiredAtCharacterLevel: number;
  source: "origin" | "class" | "asi" | "species" | "background" | "other";
  choices: Record<string, Dnd5eChoiceValue>;
};

export type Dnd5eSpellChoice = {
  spellId: string;
  name: string;
  spellLevel: number;
  classId?: string;
  source: Dnd5eSourceRef;
  mode: "known" | "prepared" | "spellbook" | "always-prepared" | "cantrip" | "ritual" | "other";
};

export type Dnd5eClassChoice = {
  choiceId: string;
  values: Dnd5eChoiceValue;
};

export type Dnd5eLevelRecord = {
  characterLevel: number;
  classId: string;
  classLevel: number;
  hitDie: number;
  /** Actual die result when rolled. Level 1 stores the full Hit Die value. */
  hitPointRoll: number;
  subclassId?: string;
  featChoices: Dnd5eFeatChoice[];
  abilityScoreIncreases: Partial<Record<Dnd5eAbility, number>>;
  classChoices: Dnd5eClassChoice[];
  proficiencyChoices: Dnd5eProficiencyRef[];
  spellChoices: Dnd5eSpellChoice[];
  legacyImported?: boolean;
};

export type Dnd5eSpellcastingRuntime = {
  classId: string;
  castingAbility: Dnd5eAbility;
  slots?: Record<string, number>;
  usedSlots?: Record<string, number>;
  pactSlots?: { maximum: number; used: number; slotLevel: number };
  prepared: Dnd5eSpellChoice[];
  known: Dnd5eSpellChoice[];
  spellbook: Dnd5eSpellChoice[];
  alwaysPrepared: Dnd5eSpellChoice[];
};

export type Dnd5eResourceState = {
  resourceId: string;
  label: string;
  current: number;
  maximum: number;
  refresh: "turn" | "short-rest" | "long-rest" | "short-or-long-rest" | "dawn" | "manual" | "other";
  source: Dnd5eSourceRef;
};

export type Dnd5eAttunementState = {
  itemId: number;
  attuned: boolean;
  source?: string;
};

export type Dnd5eCharacterState = {
  version: typeof DND5E_STATE_VERSION;
  rulesProfileId: Dnd5eRulesProfileId;
  characterId: number;

  /** Ability values before origin/species/background adjustments and later ASIs. */
  assignedAbilityScores: Dnd5eAbilityScores;
  abilityGeneration?: {
    method: "standard-array" | "4d6-drop-lowest" | "point-buy" | "manual" | "imported" | "other";
    rawRolls?: number[];
    pointBuySpent?: number;
  };

  origin: Dnd5eOriginState;
  experiencePoints: number;
  levels: Dnd5eLevelRecord[];

  persistentChoices: {
    alignment?: string;
    deity?: string;
    personalityNotes?: string;
  };

  proficiencies: Dnd5eProficiencyRef[];
  feats: Dnd5eFeatChoice[];
  spellcasting: Dnd5eSpellcastingRuntime[];
  resources: Dnd5eResourceState[];
  attunement: Dnd5eAttunementState[];

  migrationNotes?: string[];
};

export type Dnd5eEquipmentSnapshot = {
  itemId: number;
  name: string;
  itemType: string;
  quantity: number;
  equipped: boolean;
  identified: boolean;
  rulesProfileId?: Dnd5eRulesProfileId;
  rules?: {
    weightLb?: number;
    weapon?: {
      category?: "simple" | "martial";
      meleeOrRanged?: "melee" | "ranged";
      damage?: string;
      damageType?: string;
      properties?: string[];
      masteryProperty?: string;
      rangeNormalFt?: number;
      rangeLongFt?: number;
      ability?: "str" | "dex" | "best-str-dex" | "rule";
      magicalBonus?: number;
    };
    armor?: {
      category: "light" | "medium" | "heavy" | "shield";
      baseAc?: number;
      dexMode?: "full" | "max-2" | "none";
      strengthRequirement?: number;
      stealthDisadvantage?: boolean;
      magicalBonus?: number;
    };
    attunementRequired?: boolean;
  };
};

export type Dnd5eActiveEffectSnapshot = {
  effectId: number;
  name: string;
  source?: string;
  durationType?: string;
  roundsRemaining?: number | null;
  concentration?: boolean;
  rulesProfileId?: Dnd5eRulesProfileId;
  modifiers: unknown[];
};

export type Dnd5eConditionState = {
  conditionId: string;
  level?: number;
  source?: string;
  startedAt?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type Dnd5eDeathState = {
  deathSaveSuccesses: number;
  deathSaveFailures: number;
  stable: boolean;
};

export function createEmptyDnd5eState(
  characterId: number,
  rulesProfileId: Dnd5eRulesProfileId,
  assignedAbilityScores: Dnd5eAbilityScores,
  ancestryId: string,
  backgroundId: string,
): Dnd5eCharacterState {
  return {
    version: DND5E_STATE_VERSION,
    rulesProfileId,
    characterId,
    assignedAbilityScores: { ...assignedAbilityScores },
    origin: {
      ancestryId,
      backgroundId,
      ancestryChoices: {},
      backgroundChoices: {},
      languages: [],
    },
    experiencePoints: 0,
    levels: [],
    persistentChoices: {},
    proficiencies: [],
    feats: [],
    spellcasting: [],
    resources: [],
    attunement: [],
  };
}
