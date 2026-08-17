// Reference implementation only. Core PHB/SRD race mechanics.

import type { CoreRaceId, Dnd35Ability, Dnd35AbilityScores, Dnd35Size } from "./domain";

export type RacialSense =
  | { type: "darkvision"; rangeFt: number }
  | { type: "low_light"; multiplier: number };

export type ConditionalRacialModifier = {
  target: string;
  value: number;
  bonusType: "racial" | "dodge" | "morale" | "size" | "untyped";
  condition: string;
};

export type RacialSkillModifier = {
  skillId: string;
  value: number;
  bonusType: "racial" | "size";
  condition?: string;
};

export type RacialSpellLikeAbility = {
  id: string;
  name: string;
  usesPerDay: number;
  casterLevel: number;
  spellLevel: number;
  requiresMinimumCharisma?: number;
  saveDc?: "10_plus_cha_plus_spell_level";
  restriction?: string;
};

export type Dnd35RaceDefinition = {
  id: CoreRaceId;
  displayName: string;
  size: Dnd35Size;
  baseLandSpeed: number;
  abilityAdjustments: Partial<Record<Dnd35Ability, number>>;
  favoredClass: string;
  automaticLanguages: string[];
  bonusLanguages: string[] | "any_non_secret";
  senses: RacialSense[];
  rules: {
    extraFeatAtLevelOne?: number;
    extraSkillPointsAtLevelOne?: number;
    extraSkillPointsPerAdditionalLevel?: number;
    armorDoesNotReduceLandSpeed?: boolean;
    loadDoesNotReduceLandSpeed?: boolean;
    automaticSecretDoorSearch?: boolean;
    magicalSleepImmunity?: boolean;
    countsAsRaces?: string[];
    minimumStartingIntelligence?: number;
    illusionSaveDcBonus?: number;
  };
  weaponProficiencies: string[];
  weaponFamiliarities: string[];
  skillModifiers: RacialSkillModifier[];
  conditionalModifiers: ConditionalRacialModifier[];
  spellLikeAbilities: RacialSpellLikeAbility[];
  specialTraits: string[];
};

const race = (definition: Dnd35RaceDefinition) => definition;

export const CORE_RACES: Record<CoreRaceId, Dnd35RaceDefinition> = {
  human: race({
    id: "human", displayName: "Human", size: "medium", baseLandSpeed: 30,
    abilityAdjustments: {}, favoredClass: "any", automaticLanguages: ["Common"], bonusLanguages: "any_non_secret", senses: [],
    rules: { extraFeatAtLevelOne: 1, extraSkillPointsAtLevelOne: 4, extraSkillPointsPerAdditionalLevel: 1 },
    weaponProficiencies: [], weaponFamiliarities: [], skillModifiers: [], conditionalModifiers: [], spellLikeAbilities: [],
    specialTraits: ["Bonus feat entitlement at 1st level", "Additional skill points"],
  }),

  dwarf: race({
    id: "dwarf", displayName: "Dwarf", size: "medium", baseLandSpeed: 20,
    abilityAdjustments: { con: 2, cha: -2 }, favoredClass: "fighter",
    automaticLanguages: ["Common", "Dwarven"], bonusLanguages: ["Giant", "Gnome", "Goblin", "Orc", "Terran", "Undercommon"],
    senses: [{ type: "darkvision", rangeFt: 60 }],
    rules: { armorDoesNotReduceLandSpeed: true, loadDoesNotReduceLandSpeed: true },
    weaponProficiencies: [], weaponFamiliarities: ["dwarven waraxe", "dwarven urgrosh"],
    skillModifiers: [
      { skillId: "search", value: 2, bonusType: "racial", condition: "unusual stonework" },
      { skillId: "appraise", value: 2, bonusType: "racial", condition: "stone or metal items" },
      { skillId: "craft", value: 2, bonusType: "racial", condition: "stone or metal items" },
    ],
    conditionalModifiers: [
      { target: "save:fortitude", value: 2, bonusType: "racial", condition: "against poison" },
      { target: "save:any", value: 2, bonusType: "racial", condition: "against spells and spell-like abilities" },
      { target: "attack", value: 1, bonusType: "racial", condition: "against orcs and goblinoids" },
      { target: "ac", value: 4, bonusType: "dodge", condition: "against creatures of the giant type" },
      { target: "stability", value: 4, bonusType: "untyped", condition: "resist bull rush or trip while standing on the ground" },
    ],
    spellLikeAbilities: [],
    specialTraits: ["Stonecunning", "Stability", "Dwarven weapon familiarity", "Stonework trapfinding through Stonecunning"],
  }),

  elf: race({
    id: "elf", displayName: "Elf", size: "medium", baseLandSpeed: 30,
    abilityAdjustments: { dex: 2, con: -2 }, favoredClass: "wizard",
    automaticLanguages: ["Common", "Elven"], bonusLanguages: ["Draconic", "Gnoll", "Gnome", "Goblin", "Orc", "Sylvan"],
    senses: [{ type: "low_light", multiplier: 2 }],
    rules: { automaticSecretDoorSearch: true, magicalSleepImmunity: true },
    weaponProficiencies: ["longsword", "rapier", "longbow", "composite longbow", "shortbow", "composite shortbow"],
    weaponFamiliarities: [],
    skillModifiers: [
      { skillId: "listen", value: 2, bonusType: "racial" },
      { skillId: "search", value: 2, bonusType: "racial" },
      { skillId: "spot", value: 2, bonusType: "racial" },
    ],
    conditionalModifiers: [{ target: "save:any", value: 2, bonusType: "racial", condition: "against enchantment spells and effects" }],
    spellLikeAbilities: [],
    specialTraits: ["Immunity to magical sleep", "Automatic Search opportunity near secret or concealed doors"],
  }),

  gnome: race({
    id: "gnome", displayName: "Gnome", size: "small", baseLandSpeed: 20,
    abilityAdjustments: { con: 2, str: -2 }, favoredClass: "bard",
    automaticLanguages: ["Common", "Gnome"], bonusLanguages: ["Draconic", "Dwarven", "Elven", "Giant", "Goblin", "Orc"],
    senses: [{ type: "low_light", multiplier: 2 }], rules: { illusionSaveDcBonus: 1 },
    weaponProficiencies: [], weaponFamiliarities: ["gnome hooked hammer"],
    skillModifiers: [
      { skillId: "listen", value: 2, bonusType: "racial" },
      { skillId: "craft:alchemy", value: 2, bonusType: "racial" },
    ],
    conditionalModifiers: [
      { target: "save:any", value: 2, bonusType: "racial", condition: "against illusions" },
      { target: "attack", value: 1, bonusType: "racial", condition: "against kobolds and goblinoids" },
      { target: "ac", value: 4, bonusType: "dodge", condition: "against creatures of the giant type" },
    ],
    spellLikeAbilities: [
      { id: "gnome:speak-with-animals", name: "Speak with Animals", usesPerDay: 1, casterLevel: 1, spellLevel: 1, restriction: "burrowing mammals only; duration 1 minute" },
      { id: "gnome:dancing-lights", name: "Dancing Lights", usesPerDay: 1, casterLevel: 1, spellLevel: 0, requiresMinimumCharisma: 10 },
      { id: "gnome:ghost-sound", name: "Ghost Sound", usesPerDay: 1, casterLevel: 1, spellLevel: 0, requiresMinimumCharisma: 10, saveDc: "10_plus_cha_plus_spell_level" },
      { id: "gnome:prestidigitation", name: "Prestidigitation", usesPerDay: 1, casterLevel: 1, spellLevel: 0, requiresMinimumCharisma: 10 },
    ],
    specialTraits: ["Gnome weapon familiarity", "Illusion affinity"],
  }),

  "half-elf": race({
    id: "half-elf", displayName: "Half-Elf", size: "medium", baseLandSpeed: 30,
    abilityAdjustments: {}, favoredClass: "any", automaticLanguages: ["Common", "Elven"], bonusLanguages: "any_non_secret",
    senses: [{ type: "low_light", multiplier: 2 }], rules: { magicalSleepImmunity: true, countsAsRaces: ["elf"] },
    weaponProficiencies: [], weaponFamiliarities: [],
    skillModifiers: [
      { skillId: "listen", value: 1, bonusType: "racial" },
      { skillId: "search", value: 1, bonusType: "racial" },
      { skillId: "spot", value: 1, bonusType: "racial" },
      { skillId: "diplomacy", value: 2, bonusType: "racial" },
      { skillId: "gather-information", value: 2, bonusType: "racial" },
    ],
    conditionalModifiers: [{ target: "save:any", value: 2, bonusType: "racial", condition: "against enchantment spells and effects" }],
    spellLikeAbilities: [], specialTraits: ["Elven blood", "Immunity to magical sleep"],
  }),

  "half-orc": race({
    id: "half-orc", displayName: "Half-Orc", size: "medium", baseLandSpeed: 30,
    abilityAdjustments: { str: 2, int: -2, cha: -2 }, favoredClass: "barbarian",
    automaticLanguages: ["Common", "Orc"], bonusLanguages: ["Draconic", "Giant", "Gnoll", "Goblin", "Abyssal"],
    senses: [{ type: "darkvision", rangeFt: 60 }], rules: { countsAsRaces: ["orc"], minimumStartingIntelligence: 3 },
    weaponProficiencies: [], weaponFamiliarities: [], skillModifiers: [], conditionalModifiers: [], spellLikeAbilities: [],
    specialTraits: ["Orc blood"],
  }),

  halfling: race({
    id: "halfling", displayName: "Halfling", size: "small", baseLandSpeed: 20,
    abilityAdjustments: { dex: 2, str: -2 }, favoredClass: "rogue",
    automaticLanguages: ["Common", "Halfling"], bonusLanguages: ["Dwarven", "Elven", "Gnome", "Goblin", "Orc"],
    senses: [], rules: {}, weaponProficiencies: [], weaponFamiliarities: [],
    skillModifiers: [
      { skillId: "climb", value: 2, bonusType: "racial" },
      { skillId: "jump", value: 2, bonusType: "racial" },
      { skillId: "listen", value: 2, bonusType: "racial" },
      { skillId: "move-silently", value: 2, bonusType: "racial" },
    ],
    conditionalModifiers: [
      { target: "save:any", value: 1, bonusType: "racial", condition: "all saving throws" },
      { target: "save:any", value: 2, bonusType: "morale", condition: "against fear; stacks with the halfling all-saves bonus" },
      { target: "attack", value: 1, bonusType: "racial", condition: "with thrown weapons and slings" },
    ],
    spellLikeAbilities: [], specialTraits: [],
  }),
};

export function getCoreRace(raceId: string): Dnd35RaceDefinition | undefined {
  return CORE_RACES[raceId as CoreRaceId];
}

export function applyRacialAbilityAdjustments(base: Dnd35AbilityScores, raceDefinition: Dnd35RaceDefinition): Dnd35AbilityScores {
  const result = { ...base };
  for (const [ability, adjustment] of Object.entries(raceDefinition.abilityAdjustments)) {
    result[ability as Dnd35Ability] += adjustment ?? 0;
  }
  if (raceDefinition.rules.minimumStartingIntelligence) {
    result.int = Math.max(result.int, raceDefinition.rules.minimumStartingIntelligence);
  }
  return result;
}

export function humanBonusSkillPointsAtCharacterLevel(raceId: string, characterLevel: number): number {
  if (raceId !== "human" || characterLevel < 1) return 0;
  return characterLevel === 1 ? 4 : 1;
}
