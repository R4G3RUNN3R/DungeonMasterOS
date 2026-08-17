// Reference implementation only. SRD 5.1 race/subrace mechanics.

import type { Dnd5eAncestryDefinition } from "./species-types";

const race = (value: Dnd5eAncestryDefinition) => value;

export const DND5E_2014_RACES: Record<string, Dnd5eAncestryDefinition> = {
  "hill-dwarf": race({
    profileId: "dnd5e-2014",
    id: "hill-dwarf",
    displayName: "Hill Dwarf",
    model: "race",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 25,
    fixedAbilityAdjustments: { con: 2, wis: 1 },
    automaticLanguages: ["Common", "Dwarvish"],
    features: [
      { featureId: "dwarf:armor-speed", label: "Dwarven Speed", kind: "movement", rules: { heavyArmorDoesNotReduceSpeed: true } },
      { featureId: "dwarf:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 60 } },
      { featureId: "dwarf:resilience", label: "Dwarven Resilience", kind: "advantage", rules: { saveVsPoisonAdvantage: true, poisonResistance: true } },
      { featureId: "dwarf:combat-training", label: "Dwarven Combat Training", kind: "proficiency", rules: { weapons: ["battleaxe", "handaxe", "light-hammer", "warhammer"] } },
      { featureId: "dwarf:stonecunning", label: "Stonecunning", kind: "passive", rules: { historyStoneworkProficiencyMultiplier: 2 } },
      { featureId: "hill-dwarf:toughness", label: "Dwarven Toughness", kind: "hp", rules: { extraMaxHpPerCharacterLevel: 1 } },
    ],
    choices: [
      { choiceId: "dwarf:artisan-tool", count: 1, options: ["smith-tools", "brewer-supplies", "mason-tools"], description: "Choose one Dwarven tool proficiency." },
    ],
  }),

  "high-elf": race({
    profileId: "dnd5e-2014",
    id: "high-elf",
    displayName: "High Elf",
    model: "race",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 30,
    fixedAbilityAdjustments: { dex: 2, int: 1 },
    automaticLanguages: ["Common", "Elvish"],
    languageChoiceCount: 1,
    features: [
      { featureId: "elf:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 60 } },
      { featureId: "elf:keen-senses", label: "Keen Senses", kind: "proficiency", rules: { skill: "perception" } },
      { featureId: "elf:fey-ancestry", label: "Fey Ancestry", kind: "advantage", rules: { charmSaveAdvantage: true, magicCannotSleep: true } },
      { featureId: "elf:trance", label: "Trance", kind: "passive", rules: { longRestMeditationHours: 4 } },
      { featureId: "high-elf:weapon-training", label: "Elf Weapon Training", kind: "proficiency", rules: { weapons: ["longsword", "shortsword", "shortbow", "longbow"] } },
      { featureId: "high-elf:cantrip", label: "High Elf Cantrip", kind: "spell", choiceRequired: true, rules: { list: "wizard", level: 0, castingAbility: "int" } },
    ],
    choices: [
      { choiceId: "high-elf:cantrip", count: 1, options: "source-registry", description: "Choose one legal Wizard cantrip." },
      { choiceId: "high-elf:extra-language", count: 1, options: "any-language", description: "Choose one extra language." },
    ],
  }),

  "lightfoot-halfling": race({
    profileId: "dnd5e-2014",
    id: "lightfoot-halfling",
    displayName: "Lightfoot Halfling",
    model: "race",
    creatureType: "humanoid",
    sizeOptions: ["small"],
    speedFt: 25,
    fixedAbilityAdjustments: { dex: 2, cha: 1 },
    automaticLanguages: ["Common", "Halfling"],
    features: [
      { featureId: "halfling:lucky", label: "Lucky", kind: "reroll", rules: { rerollNaturalOneOnAttackCheckSave: true, mustUseNewRoll: true } },
      { featureId: "halfling:brave", label: "Brave", kind: "advantage", rules: { frightenedSaveAdvantage: true } },
      { featureId: "halfling:nimbleness", label: "Halfling Nimbleness", kind: "movement", rules: { moveThroughLargerCreatureSpaces: true } },
      { featureId: "lightfoot:naturally-stealthy", label: "Naturally Stealthy", kind: "other", rules: { canHideBehindLargerCreature: true } },
    ],
    choices: [],
  }),

  human: race({
    profileId: "dnd5e-2014",
    id: "human",
    displayName: "Human",
    model: "race",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 30,
    fixedAbilityAdjustments: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    automaticLanguages: ["Common"],
    languageChoiceCount: 1,
    features: [],
    choices: [{ choiceId: "human:language", count: 1, options: "any-language", description: "Choose one extra language." }],
  }),

  dragonborn: race({
    profileId: "dnd5e-2014",
    id: "dragonborn",
    displayName: "Dragonborn",
    model: "race",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 30,
    fixedAbilityAdjustments: { str: 2, cha: 1 },
    automaticLanguages: ["Common", "Draconic"],
    features: [
      { featureId: "dragonborn:breath", label: "Breath Weapon", kind: "action", choiceRequired: true, rules: { saveDc: "8+con+pb", damage: "2d6; 3d6@6; 4d6@11; 5d6@16", recharge: "short-or-long-rest" } },
      { featureId: "dragonborn:resistance", label: "Damage Resistance", kind: "resistance", choiceRequired: true },
    ],
    choices: [{
      choiceId: "dragonborn:ancestry",
      count: 1,
      options: ["black-acid-line-dex", "blue-lightning-line-dex", "brass-fire-line-dex", "bronze-lightning-line-dex", "copper-acid-line-dex", "gold-fire-cone-dex", "green-poison-cone-con", "red-fire-cone-dex", "silver-cold-cone-con", "white-cold-cone-con"],
      description: "Choose Draconic Ancestry; it sets breath damage/shape/save and resistance.",
    }],
  }),

  "rock-gnome": race({
    profileId: "dnd5e-2014",
    id: "rock-gnome",
    displayName: "Rock Gnome",
    model: "race",
    creatureType: "humanoid",
    sizeOptions: ["small"],
    speedFt: 25,
    fixedAbilityAdjustments: { int: 2, con: 1 },
    automaticLanguages: ["Common", "Gnomish"],
    features: [
      { featureId: "gnome:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 60 } },
      { featureId: "gnome:cunning", label: "Gnome Cunning", kind: "advantage", rules: { mentalSavesAgainstMagicAdvantage: true } },
      { featureId: "rock-gnome:artificers-lore", label: "Artificer's Lore", kind: "passive", rules: { historyMagicAlchemyTechProficiencyMultiplier: 2 } },
      { featureId: "rock-gnome:tinker", label: "Tinker", kind: "other", rules: { tool: "tinker-tools" } },
    ],
    choices: [],
  }),

  "half-elf": race({
    profileId: "dnd5e-2014",
    id: "half-elf",
    displayName: "Half-Elf",
    model: "race",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 30,
    flexibleAbilityAdjustment: {
      fixed: { cha: 2 },
      choose: [{ count: 2, amount: 1, excluded: ["cha"] }],
    },
    automaticLanguages: ["Common", "Elvish"],
    languageChoiceCount: 1,
    features: [
      { featureId: "half-elf:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 60 } },
      { featureId: "half-elf:fey-ancestry", label: "Fey Ancestry", kind: "advantage", rules: { charmSaveAdvantage: true, magicCannotSleep: true } },
      { featureId: "half-elf:skill-versatility", label: "Skill Versatility", kind: "proficiency", choiceRequired: true, rules: { skillChoices: 2 } },
    ],
    choices: [
      { choiceId: "half-elf:ability-increases", count: 2, options: ["str", "dex", "con", "int", "wis"], description: "Choose two different non-Charisma abilities to increase by 1." },
      { choiceId: "half-elf:skills", count: 2, options: "any-skill", description: "Choose two skill proficiencies." },
      { choiceId: "half-elf:language", count: 1, options: "any-language", description: "Choose one extra language." },
    ],
  }),

  "half-orc": race({
    profileId: "dnd5e-2014",
    id: "half-orc",
    displayName: "Half-Orc",
    model: "race",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 30,
    fixedAbilityAdjustments: { str: 2, con: 1 },
    automaticLanguages: ["Common", "Orc"],
    features: [
      { featureId: "half-orc:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 60 } },
      { featureId: "half-orc:menacing", label: "Menacing", kind: "proficiency", rules: { skill: "intimidation" } },
      { featureId: "half-orc:relentless-endurance", label: "Relentless Endurance", kind: "resource", rules: { uses: 1, refresh: "long-rest", zeroHpToOne: true } },
      { featureId: "half-orc:savage-attacks", label: "Savage Attacks", kind: "passive", rules: { extraWeaponDieOnMeleeCritical: 1 } },
    ],
    choices: [],
  }),

  tiefling: race({
    profileId: "dnd5e-2014",
    id: "tiefling",
    displayName: "Tiefling",
    model: "race",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 30,
    fixedAbilityAdjustments: { int: 1, cha: 2 },
    automaticLanguages: ["Common", "Infernal"],
    features: [
      { featureId: "tiefling:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 60 } },
      { featureId: "tiefling:hellish-resistance", label: "Hellish Resistance", kind: "resistance", rules: { damageType: "fire" } },
      { featureId: "tiefling:infernal-legacy", label: "Infernal Legacy", kind: "spell", rules: { castingAbility: "cha", cantrip: "thaumaturgy", level3: "hellish-rebuke@2", level5: "darkness", freeCastEach: "long-rest" } },
    ],
    choices: [],
  }),
};

export function get2014Race(id: string): Dnd5eAncestryDefinition | undefined {
  return DND5E_2014_RACES[id];
}
