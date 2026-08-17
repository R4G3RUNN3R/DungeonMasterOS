// Reference implementation only. SRD 5.2.1 species mechanics.

import type { Dnd5eAncestryDefinition } from "./species-types";

const species = (value: Dnd5eAncestryDefinition) => value;

export const DND5E_2024_SPECIES: Record<string, Dnd5eAncestryDefinition> = {
  dragonborn: species({
    profileId: "dnd5e-2024",
    id: "dragonborn",
    displayName: "Dragonborn",
    model: "species",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 30,
    features: [
      { featureId: "dragonborn:breath", label: "Breath Weapon", kind: "action", choiceRequired: true, rules: { actionReplacement: "one-attack", shapes: ["15-ft-cone", "30-ft-5-ft-wide-line"], save: "dex", saveDc: "8+con+pb", damage: "1d10; 2d10@5; 3d10@11; 4d10@17", uses: "pb", refresh: "long-rest" } },
      { featureId: "dragonborn:resistance", label: "Damage Resistance", kind: "resistance", choiceRequired: true },
      { featureId: "dragonborn:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 60 } },
      { featureId: "dragonborn:flight", label: "Draconic Flight", level: 5, kind: "resource", rules: { activation: "bonus-action", durationMinutes: 10, flySpeed: "speed", uses: 1, refresh: "long-rest" } },
    ],
    choices: [{
      choiceId: "dragonborn:ancestry",
      count: 1,
      options: ["black:acid", "blue:lightning", "brass:fire", "bronze:lightning", "copper:acid", "gold:fire", "green:poison", "red:fire", "silver:cold", "white:cold"],
      description: "Choose Draconic Ancestry; it sets Breath Weapon damage type and resistance.",
    }],
  }),

  dwarf: species({
    profileId: "dnd5e-2024",
    id: "dwarf",
    displayName: "Dwarf",
    model: "species",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 30,
    features: [
      { featureId: "dwarf:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 120 } },
      { featureId: "dwarf:resilience", label: "Dwarven Resilience", kind: "advantage", rules: { poisonResistance: true, advantageAvoidEndPoisoned: true } },
      { featureId: "dwarf:toughness", label: "Dwarven Toughness", kind: "hp", rules: { extraMaxHpPerCharacterLevel: 1 } },
      { featureId: "dwarf:stonecunning", label: "Stonecunning", kind: "resource", rules: { activation: "bonus-action", tremorsenseFt: 60, durationMinutes: 10, requiresStoneContact: true, uses: "pb", refresh: "long-rest" } },
    ],
    choices: [],
  }),

  elf: species({
    profileId: "dnd5e-2024",
    id: "elf",
    displayName: "Elf",
    model: "species",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 30,
    variants: ["drow", "high-elf", "wood-elf"],
    features: [
      { featureId: "elf:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 60 } },
      { featureId: "elf:lineage", label: "Elven Lineage", kind: "spell", choiceRequired: true, rules: { chooseCastingAbility: ["int", "wis", "cha"], freeCastHigherSpellRefresh: "long-rest", higherSpellsAlwaysPrepared: true } },
      { featureId: "elf:fey-ancestry", label: "Fey Ancestry", kind: "advantage", rules: { advantageAvoidEndCharmed: true } },
      { featureId: "elf:keen-senses", label: "Keen Senses", kind: "proficiency", choiceRequired: true, rules: { chooseOneSkill: ["insight", "perception", "survival"] } },
      { featureId: "elf:trance", label: "Trance", kind: "passive", rules: { sleepNotRequired: true, magicCannotSleep: true, longRestMeditationHours: 4 } },
    ],
    choices: [
      { choiceId: "elf:lineage", count: 1, options: ["drow", "high-elf", "wood-elf"], description: "Choose Drow, High Elf, or Wood Elf lineage." },
      { choiceId: "elf:lineage-casting-ability", count: 1, options: ["int", "wis", "cha"], description: "Choose the casting ability for lineage spells." },
      { choiceId: "elf:keen-senses", count: 1, options: ["insight", "perception", "survival"], description: "Choose the Keen Senses skill proficiency." },
    ],
  }),

  gnome: species({
    profileId: "dnd5e-2024",
    id: "gnome",
    displayName: "Gnome",
    model: "species",
    creatureType: "humanoid",
    sizeOptions: ["small"],
    speedFt: 30,
    variants: ["forest-gnome", "rock-gnome"],
    features: [
      { featureId: "gnome:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 60 } },
      { featureId: "gnome:cunning", label: "Gnomish Cunning", kind: "advantage", rules: { saveAbilities: ["int", "wis", "cha"] } },
      { featureId: "gnome:lineage", label: "Gnomish Lineage", kind: "spell", choiceRequired: true, rules: { chooseCastingAbility: ["int", "wis", "cha"] } },
    ],
    choices: [
      { choiceId: "gnome:lineage", count: 1, options: ["forest-gnome", "rock-gnome"], description: "Choose Forest Gnome or Rock Gnome lineage." },
      { choiceId: "gnome:lineage-casting-ability", count: 1, options: ["int", "wis", "cha"], description: "Choose the lineage spellcasting ability." },
    ],
  }),

  goliath: species({
    profileId: "dnd5e-2024",
    id: "goliath",
    displayName: "Goliath",
    model: "species",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 35,
    features: [
      { featureId: "goliath:giant-ancestry", label: "Giant Ancestry", kind: "resource", choiceRequired: true, rules: { uses: "pb", refresh: "long-rest" } },
      { featureId: "goliath:large-form", label: "Large Form", level: 5, kind: "resource", rules: { activation: "bonus-action", durationMinutes: 10, temporarySize: "large", strengthCheckAdvantage: true, speedBonusFt: 10, uses: 1, refresh: "long-rest" } },
      { featureId: "goliath:powerful-build", label: "Powerful Build", kind: "passive", rules: { advantageEndGrappledCheck: true, carryingSizeSteps: 1 } },
    ],
    choices: [{
      choiceId: "goliath:giant-ancestry",
      count: 1,
      options: ["clouds-jaunt", "fires-burn", "frosts-chill", "hills-tumble", "stones-endurance", "storms-thunder"],
      description: "Choose one Giant Ancestry boon. It has PB uses per Long Rest.",
    }],
  }),

  halfling: species({
    profileId: "dnd5e-2024",
    id: "halfling",
    displayName: "Halfling",
    model: "species",
    creatureType: "humanoid",
    sizeOptions: ["small"],
    speedFt: 30,
    features: [
      { featureId: "halfling:brave", label: "Brave", kind: "advantage", rules: { advantageAvoidEndFrightened: true } },
      { featureId: "halfling:nimbleness", label: "Halfling Nimbleness", kind: "movement", rules: { moveThroughLargerCreatureSpaces: true, cannotStopThere: true } },
      { featureId: "halfling:luck", label: "Luck", kind: "reroll", rules: { rerollNaturalOneOnD20Test: true, mustUseNewRoll: true } },
      { featureId: "halfling:naturally-stealthy", label: "Naturally Stealthy", kind: "other", rules: { canHideWhenObscuredOnlyByLargerCreature: true } },
    ],
    choices: [],
  }),

  human: species({
    profileId: "dnd5e-2024",
    id: "human",
    displayName: "Human",
    model: "species",
    creatureType: "humanoid",
    sizeOptions: ["small", "medium"],
    speedFt: 30,
    features: [
      { featureId: "human:resourceful", label: "Resourceful", kind: "resource", rules: { heroicInspirationAfterLongRest: true } },
      { featureId: "human:skillful", label: "Skillful", kind: "proficiency", choiceRequired: true, rules: { chooseSkills: 1 } },
      { featureId: "human:versatile", label: "Versatile", kind: "other", choiceRequired: true, rules: { originFeatChoices: 1 } },
    ],
    choices: [
      { choiceId: "human:size", count: 1, options: ["small", "medium"], description: "Choose Small or Medium size." },
      { choiceId: "human:skill", count: 1, options: "any-skill", description: "Choose one skill proficiency." },
      { choiceId: "human:origin-feat", count: 1, options: "any-origin-feat", description: "Choose one legal Origin feat." },
    ],
  }),

  orc: species({
    profileId: "dnd5e-2024",
    id: "orc",
    displayName: "Orc",
    model: "species",
    creatureType: "humanoid",
    sizeOptions: ["medium"],
    speedFt: 30,
    features: [
      { featureId: "orc:adrenaline-rush", label: "Adrenaline Rush", kind: "resource", rules: { activation: "bonus-action-dash", temporaryHp: "pb", uses: "pb", refresh: "short-or-long-rest" } },
      { featureId: "orc:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 120 } },
      { featureId: "orc:relentless-endurance", label: "Relentless Endurance", kind: "resource", rules: { zeroHpToOne: true, uses: 1, refresh: "long-rest" } },
    ],
    choices: [],
  }),

  tiefling: species({
    profileId: "dnd5e-2024",
    id: "tiefling",
    displayName: "Tiefling",
    model: "species",
    creatureType: "humanoid",
    sizeOptions: ["small", "medium"],
    speedFt: 30,
    variants: ["abyssal", "chthonic", "infernal"],
    features: [
      { featureId: "tiefling:darkvision", label: "Darkvision", kind: "passive", rules: { rangeFt: 60 } },
      { featureId: "tiefling:fiendish-legacy", label: "Fiendish Legacy", kind: "spell", choiceRequired: true, rules: { chooseCastingAbility: ["int", "wis", "cha"], higherSpellsAlwaysPrepared: true, freeCastEach: "long-rest" } },
      { featureId: "tiefling:otherworldly-presence", label: "Otherworldly Presence", kind: "spell", rules: { cantrip: "thaumaturgy", castingAbility: "same-as-fiendish-legacy" } },
    ],
    choices: [
      { choiceId: "tiefling:size", count: 1, options: ["small", "medium"], description: "Choose Small or Medium size." },
      { choiceId: "tiefling:legacy", count: 1, options: ["abyssal", "chthonic", "infernal"], description: "Choose a Fiendish Legacy." },
      { choiceId: "tiefling:legacy-casting-ability", count: 1, options: ["int", "wis", "cha"], description: "Choose the spellcasting ability for Fiendish Legacy and Otherworldly Presence." },
    ],
  }),
};

export const DND5E_2024_ELVEN_LINEAGES = {
  drow: { level1: ["darkvision-120", "dancing-lights"], level3: ["faerie-fire"], level5: ["darkness"] },
  "high-elf": { level1: ["prestidigitation-or-replaceable-wizard-cantrip"], level3: ["detect-magic"], level5: ["misty-step"] },
  "wood-elf": { level1: ["speed-35", "druidcraft"], level3: ["longstrider"], level5: ["pass-without-trace"] },
} as const;

export const DND5E_2024_GNOME_LINEAGES = {
  "forest-gnome": { cantrips: ["minor-illusion"], alwaysPrepared: ["speak-with-animals"], freeUses: "pb-per-long-rest" },
  "rock-gnome": { cantrips: ["mending", "prestidigitation"], clockworkDevicesMaximum: 3, deviceDurationHours: 8 },
} as const;

export const DND5E_2024_TIEFLING_LEGACIES = {
  abyssal: { resistance: "poison", cantrip: "poison-spray", level3: "ray-of-sickness", level5: "hold-person" },
  chthonic: { resistance: "necrotic", cantrip: "chill-touch", level3: "false-life", level5: "ray-of-enfeeblement" },
  infernal: { resistance: "fire", cantrip: "fire-bolt", level3: "hellish-rebuke", level5: "darkness" },
} as const;

export function get2024Species(id: string): Dnd5eAncestryDefinition | undefined {
  return DND5E_2024_SPECIES[id];
}
