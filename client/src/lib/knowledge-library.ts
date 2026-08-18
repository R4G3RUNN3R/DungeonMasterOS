export type KnowledgeVolumeStatus = "available" | "foundation" | "cataloguing";

export type KnowledgeVolume = {
  id: string;
  kind: "items" | "bestiary" | "grimoire" | "holy-tome" | "feat-codex";
  title: string;
  subtitle: string;
  href?: string;
  status: KnowledgeVolumeStatus;
  recordCount?: number;
  note?: string;
};

export type KnowledgeShelf = {
  id: string;
  ruleset: string;
  editionLabel: string;
  title: string;
  active: boolean;
  volumes: KnowledgeVolume[];
};

export type KnowledgeLibraryResponse = {
  title: string;
  shelves: KnowledgeShelf[];
};

export type PublicDnd35Source = {
  sourceId: string;
  sourceKind: string;
  section?: string;
  page?: number;
  confidence: string;
  title: string;
  abbreviation: string;
  privateReference?: boolean;
};

export type PublicDnd35Spell = {
  id: string;
  name: string;
  edition: "3.5e";
  school: string;
  subschool?: string;
  descriptors?: string[];
  classAccess: Array<{ classId: string; level: number; tradition: string }>;
  domainAccess?: Array<{ domainId: string; level: number }>;
  castingTime: { kind: string; amount?: number; text?: string };
  components: Array<{
    kind: string;
    required: boolean;
    description?: string;
    gpCost?: number;
    xpCost?: number;
    appliesToTradition?: "arcane" | "divine" | "other";
    alternativeGroup?: string;
  }>;
  range: { kind: string; feet?: number; feetPerCasterLevel?: number; baseFeet?: number; text?: string };
  targeting: { delivery: string[]; targetText?: string; effectText?: string; areaText?: string; radiusFeet?: number };
  duration: { kind: string; amount?: number; dismissible?: boolean; text?: string };
  savingThrow: { type: string; outcome?: string; harmless?: boolean; text?: string };
  spellResistance: { applies: boolean | "special"; harmless?: boolean; text?: string };
  attackRoll?: string;
  effects: Array<Record<string, unknown>>;
  rulesSummary: string;
  rulesText?: string;
  executionStatus?: "structured" | "executable" | "reference";
  specialRules?: string[];
  sources: PublicDnd35Source[];
  tags: string[];
};

export type PublicDnd35Feat = {
  id: string;
  name: string;
  edition: "3.5e";
  categories: string[];
  prerequisiteSummary?: string;
  parameters?: Array<{ id: string; kind: string; required: boolean; allowedValues?: string[] }>;
  repeatable?: boolean;
  repeatRule?: string;
  modifiers: Array<Record<string, unknown>>;
  metamagic?: {
    slotAdjustment: number | "variable";
    effectiveSpellLevel: string;
    transformations: Array<Record<string, unknown>>;
    restrictions?: string[];
    orderNotes?: string[];
  };
  rulesSummary: string;
  rulesText?: string;
  benefitText?: string;
  normalText?: string;
  specialText?: string;
  executionStatus?: "reference" | "executable";
  specialRules?: string[];
  sources: PublicDnd35Source[];
  tags: string[];
  selected?: boolean;
  qualified?: boolean;
  failures?: string[];
};
