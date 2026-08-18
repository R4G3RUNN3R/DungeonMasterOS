export const DND35_RULES_VERSION = 1 as const;

export type Dnd35RuleConfidence = "verified" | "cross_checked" | "provisional" | "homebrew";
export type Dnd35SourceKind =
  | "srd-open"
  | "official-book-private-reference"
  | "official-errata"
  | "third-party-open"
  | "homebrew";

export type Dnd35SourceRef = {
  sourceId: string;
  sourceKind: Dnd35SourceKind;
  page?: number;
  section?: string;
  url?: string;
  confidence: Dnd35RuleConfidence;
  notes?: string;
};

export type Dnd35SpellTradition = "arcane" | "divine" | "other";
export type Dnd35SpellLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Dnd35SpellSchool =
  | "abjuration"
  | "conjuration"
  | "divination"
  | "enchantment"
  | "evocation"
  | "illusion"
  | "necromancy"
  | "transmutation"
  | "universal";

export type Dnd35SpellClassAccess = {
  classId: string;
  level: Dnd35SpellLevel;
  tradition: Dnd35SpellTradition;
  source: Dnd35SourceRef;
  variant?: string;
};

export type Dnd35SpellDomainAccess = {
  domainId: string;
  level: Dnd35SpellLevel;
  source: Dnd35SourceRef;
};

export type Dnd35ComponentKind = "V" | "S" | "M" | "F" | "DF" | "XP";
export type Dnd35SpellComponent = {
  kind: Dnd35ComponentKind;
  required: boolean;
  consumed?: boolean;
  description?: string;
  gpCost?: number;
  xpCost?: number;
  quantity?: number;
  itemTags?: string[];
  appliesToTradition?: Dnd35SpellTradition;
  alternativeGroup?: string;
};

export type Dnd35CastingTime = {
  kind:
    | "free"
    | "swift"
    | "immediate"
    | "standard"
    | "move"
    | "full_round"
    | "rounds"
    | "minutes"
    | "hours"
    | "reaction_like"
    | "special";
  amount?: number;
  text?: string;
};

export type Dnd35SpellRange = {
  kind: "personal" | "touch" | "close" | "medium" | "long" | "fixed" | "unlimited" | "special";
  feet?: number;
  feetPerCasterLevel?: number;
  baseFeet?: number;
  text?: string;
};

export type Dnd35DeliveryMode =
  | "personal"
  | "target"
  | "melee_touch"
  | "ranged_touch"
  | "ray"
  | "area"
  | "effect"
  | "emanation"
  | "burst"
  | "spread"
  | "line"
  | "cone"
  | "cylinder"
  | "sphere"
  | "special";

export type Dnd35SpellTargeting = {
  delivery: Dnd35DeliveryMode[];
  targetText?: string;
  effectText?: string;
  areaText?: string;
  maxTargets?: number;
  maxTargetsPerCasterLevel?: number;
  radiusFeet?: number;
  lengthFeet?: number;
  widthFeet?: number;
  heightFeet?: number;
  lineOfEffectRequired?: boolean;
  lineOfSightRequired?: boolean;
  creatureTypes?: string[];
  objectAllowed?: boolean;
  willingOnly?: boolean;
};

export type Dnd35SpellDuration = {
  kind:
    | "instantaneous"
    | "rounds"
    | "rounds_per_level"
    | "minutes"
    | "minutes_per_level"
    | "ten_minutes_per_level"
    | "hours"
    | "hours_per_level"
    | "days"
    | "days_per_level"
    | "permanent"
    | "concentration"
    | "concentration_plus"
    | "until_discharged"
    | "special";
  amount?: number;
  dismissible?: boolean;
  concentration?: boolean;
  dischargeEnds?: boolean;
  text?: string;
};

export type Dnd35SavingThrow = {
  type: "none" | "fortitude" | "reflex" | "will" | "special";
  outcome?: "negates" | "half" | "partial" | "disbelief" | "object" | "harmless" | "special";
  harmless?: boolean;
  object?: boolean;
  repeated?: boolean;
  text?: string;
};

export type Dnd35SpellResistance = {
  applies: boolean | "special";
  harmless?: boolean;
  object?: boolean;
  text?: string;
};

export type Dnd35ScalingRule = {
  field: string;
  operation: "add" | "multiply" | "set" | "dice" | "cap" | "step" | "special";
  perCasterLevels?: number;
  value?: number;
  dice?: string;
  minimum?: number;
  maximum?: number;
  text?: string;
};

export type Dnd35RuleEffect = {
  effectId: string;
  kind:
    | "damage"
    | "healing"
    | "condition"
    | "modifier"
    | "movement"
    | "summon"
    | "create"
    | "transform"
    | "dispel"
    | "counterspell"
    | "detect"
    | "control"
    | "teleport"
    | "resource"
    | "special";
  damageType?: string;
  dice?: string;
  flatValue?: number;
  conditionId?: string;
  modifierType?: string;
  targetStat?: string;
  value?: number;
  scaling?: Dnd35ScalingRule[];
  durationOverride?: Dnd35SpellDuration;
  saveApplies?: boolean;
  spellResistanceApplies?: boolean;
  tags?: string[];
  rulesNote?: string;
};

export type Dnd35SpellDefinition = {
  id: string;
  name: string;
  edition: "3.5e";
  school: Dnd35SpellSchool;
  subschool?: string;
  descriptors?: string[];
  classAccess: Dnd35SpellClassAccess[];
  domainAccess?: Dnd35SpellDomainAccess[];
  castingTime: Dnd35CastingTime;
  components: Dnd35SpellComponent[];
  range: Dnd35SpellRange;
  targeting: Dnd35SpellTargeting;
  duration: Dnd35SpellDuration;
  savingThrow: Dnd35SavingThrow;
  spellResistance: Dnd35SpellResistance;
  attackRoll?: "none" | "melee_touch" | "ranged_touch" | "ranged_attack" | "special";
  effects: Dnd35RuleEffect[];
  counterspells?: string[];
  permanencyEligible?: boolean;
  metamagicTags?: string[];
  rulesSummary: string;
  specialRules?: string[];
  sources: Dnd35SourceRef[];
  tags: string[];
};

export type Dnd35FeatCategory =
  | "general"
  | "fighter_bonus"
  | "metamagic"
  | "item_creation"
  | "divine"
  | "tactical"
  | "reserve"
  | "heritage"
  | "racial"
  | "monstrous"
  | "exalted"
  | "vile"
  | "epic"
  | "special"
  | "other";

export type Dnd35Prerequisite =
  | { kind: "all"; requirements: Dnd35Prerequisite[] }
  | { kind: "any"; requirements: Dnd35Prerequisite[] }
  | { kind: "ability"; ability: "str" | "dex" | "con" | "int" | "wis" | "cha"; minimum: number }
  | { kind: "bab"; minimum: number }
  | { kind: "skill"; skillId: string; ranks: number }
  | { kind: "feat"; featId: string; parameter?: string }
  | { kind: "class_level"; classId: string; minimum: number }
  | { kind: "character_level"; minimum: number }
  | { kind: "caster_level"; minimum: number; tradition?: Dnd35SpellTradition }
  | { kind: "spell_level"; minimum: Dnd35SpellLevel; tradition?: Dnd35SpellTradition }
  | { kind: "spellcasting"; requirement: string }
  | { kind: "race"; raceId: string }
  | { kind: "alignment"; allowed: string[]; forbidden?: string[] }
  | { kind: "proficiency"; proficiencyId: string }
  | { kind: "special"; rule: string };

export type Dnd35FeatParameter = {
  id: string;
  kind?: "spell_school" | "spell" | "weapon" | "skill" | "energy_type" | "other";
  label?: string;
  required: boolean;
  multiple?: boolean;
  allowedValues?: string[];
  sameAsPrerequisiteParameter?: string;
  notes?: string;
};

export type Dnd35FeatModifier = {
  modifierId: string;
  target: string;
  operation: "add" | "multiply" | "set" | "minimum" | "maximum" | "grant" | "remove" | "allow" | "special";
  value?: number | string | boolean;
  bonusType?: string;
  condition?: string;
  stackingKey?: string;
  rulesNote?: string;
  notes?: string;
};

export type Dnd35MetamagicTransformation = {
  modifierId: string;
  target: string;
  operation: "add" | "multiply" | "set" | "replace" | "remove" | "minimum" | "special";
  value?: number | string | boolean;
  condition?: string;
  rulesNote?: string;
  notes?: string;
};

export type Dnd35MetamagicRule = {
  slotAdjustment: number | "variable";
  effectiveSpellLevel?: "unchanged" | "slot_level";
  preparationTiming: "prepared_with_spell" | "spontaneous_at_cast" | "either" | "special";
  spontaneousCastingTimeAdjustment?: "normal_metamagic_rule" | "unchanged" | "special";
  canApplyToSpontaneous?: boolean | "special";
  transformations: Dnd35MetamagicTransformation[];
  restrictions?: string[];
  orderNotes?: string[];
};

export type Dnd35FeatDefinition = {
  id: string;
  name: string;
  edition: "3.5e";
  categories: Dnd35FeatCategory[];
  prerequisites?: Dnd35Prerequisite;
  /** Deprecated singular alias retained for migration compatibility. */
  prerequisite?: Dnd35Prerequisite;
  prerequisiteSummary?: string;
  parameters?: Dnd35FeatParameter[];
  repeatable?: boolean;
  repeatRule?: string;
  stacking?: "stacks" | "does_not_stack" | "special";
  actionType?: "free" | "swift" | "immediate" | "move" | "standard" | "full_round" | "passive" | "special";
  uses?: { kind: "unlimited" | "per_day" | "per_encounter" | "resource" | "special"; amount?: number; resourceId?: string; text?: string };
  modifiers: Dnd35FeatModifier[];
  metamagic?: Dnd35MetamagicRule;
  rulesSummary: string;
  specialRules?: string[];
  sources: Dnd35SourceRef[];
  tags: string[];
};

export type Dnd35SpellSlotPool = { level: Dnd35SpellLevel; maximum: number; expended: number };
export type Dnd35PreparedSpellEntry = { spellId: string; slotLevel: Dnd35SpellLevel; metamagicFeatIds?: string[]; preparedCount: number; expendedCount: number };
export type Dnd35SpellcastingMode = "prepared_spellbook" | "spontaneous_known" | "prepared_divine" | "item_only";

export type Dnd35SpellcastingState = {
  classId: string;
  classLevel: number;
  casterLevel: number;
  tradition: Dnd35SpellTradition;
  castingAbility: "int" | "wis" | "cha";
  castingAbilityScore: number;
  mode: Dnd35SpellcastingMode;
  spellbookSpellIds?: string[];
  knownSpellIds?: string[];
  preparedSpells?: Dnd35PreparedSpellEntry[];
  spellSlots: Partial<Record<Dnd35SpellLevel, Dnd35SpellSlotPool>>;
  bonusSpellSlots?: Partial<Record<Dnd35SpellLevel, Dnd35SpellSlotPool>>;
  domains?: string[];
  specialization?: string;
  prohibitedSchools?: string[];
};

export type Dnd35ItemSpellAccess = {
  itemId: string;
  itemName: string;
  spellId?: string;
  spellLevel?: Dnd35SpellLevel;
  casterLevel: number;
  activation: "spell_completion" | "spell_trigger" | "command_word" | "use_activated" | "potion" | "special";
  requiresClassList?: boolean;
  requiresUseMagicDevice?: boolean;
  chargesRemaining?: number;
};

export type Dnd35CastRequest = {
  spellId: string;
  castingClassId?: string;
  metamagicFeatIds?: string[];
  itemAccess?: Dnd35ItemSpellAccess;
  environment: {
    canSpeak: boolean;
    hasSomaticFreedom: boolean;
    lineOfEffect?: boolean;
    lineOfSight?: boolean;
    antimagic?: boolean;
    arcaneSpellFailurePercent?: number;
  };
};

export type Dnd35RuleDecision = { code: string; passed: boolean; blocking: boolean; message: string };
export type Dnd35CastResolution = {
  legal: boolean;
  baseSpellLevel?: Dnd35SpellLevel;
  slotLevel?: Dnd35SpellLevel;
  effectiveSpellLevel?: Dnd35SpellLevel;
  casterLevel: number;
  saveDc?: number;
  attackRoll?: Dnd35SpellDefinition["attackRoll"];
  spellResistanceCheckRequired: boolean;
  arcaneSpellFailureCheckRequired: boolean;
  decisions: Dnd35RuleDecision[];
};
