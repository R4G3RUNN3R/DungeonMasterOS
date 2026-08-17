// Reference implementation only. SRD 5.2.1 public subclasses.

import type { Dnd5eSubclassDefinition } from "./class-types";

const sub = (value: Dnd5eSubclassDefinition) => value;
const feature = (
  level: number,
  id: string,
  label: string,
  rules?: Record<string, string | number | boolean | string[]>,
) => ({ level, id, label, rules });

export const DND5E_2024_SUBCLASSES: Record<string, Dnd5eSubclassDefinition> = {
  "path-of-the-berserker": sub({
    profileId: "dnd5e-2024", id: "path-of-the-berserker", classId: "barbarian", displayName: "Path of the Berserker", sourceId: "srd-5.2.1",
    features: [
      feature(3, "berserker:frenzy", "Frenzy", { extraDamageDice: "rage-damage-dice", oncePerTurnRecklessHit: true }),
      feature(6, "berserker:mindless-rage", "Mindless Rage", { immuneCharmedFrightenedWhileRaging: true }),
      feature(10, "berserker:retaliation", "Retaliation", { reactionAttackWhenDamagedWithin5Ft: true }),
      feature(14, "berserker:intimidating-presence", "Intimidating Presence", { action: "frighten-nearby", save: "wis", dc: "8+str+pb" }),
    ],
  }),

  "college-of-lore": sub({
    profileId: "dnd5e-2024", id: "college-of-lore", classId: "bard", displayName: "College of Lore", sourceId: "srd-5.2.1",
    features: [
      feature(3, "lore:bonus-proficiencies", "Bonus Proficiencies", { skillChoices: 3 }),
      feature(3, "lore:cutting-words", "Cutting Words", { spendsBardicInspiration: true, reaction: true }),
      feature(6, "lore:magical-discoveries", "Magical Discoveries", { spellChoices: 2, replaceOnBardLevel: true }),
      feature(14, "lore:peerless-skill", "Peerless Skill", { spendBardicInspirationOnFailedAbilityCheck: true }),
    ],
  }),

  "life-domain": sub({
    profileId: "dnd5e-2024", id: "life-domain", classId: "cleric", displayName: "Life Domain", sourceId: "srd-5.2.1",
    features: [
      feature(3, "life:disciple-of-life", "Disciple of Life", { healingBonus: "2+spell-slot-level" }),
      feature(3, "life:domain-spells", "Life Domain Spells", { alwaysPrepared: ["aid", "bless", "cure-wounds", "lesser-restoration", "mass-healing-word", "revivify", "aura-of-life", "death-ward", "greater-restoration", "mass-cure-wounds"] }),
      feature(3, "life:preserve-life", "Preserve Life", { channelDivinity: true }),
      feature(6, "life:blessed-healer", "Blessed Healer", { selfHealWhenHealingOther: "2+spell-slot-level" }),
      feature(17, "life:supreme-healing", "Supreme Healing", { maximizeHealingDice: true }),
    ],
  }),

  "circle-of-the-land": sub({
    profileId: "dnd5e-2024", id: "circle-of-the-land", classId: "druid", displayName: "Circle of the Land", sourceId: "srd-5.2.1",
    features: [
      feature(3, "land:circle-spells", "Circle of the Land Spells", { landChoiceEachLongRest: true, landOptions: ["arid", "polar", "temperate", "tropical"] }),
      feature(3, "land:lands-aid", "Land's Aid", { spendsWildShape: true, damageAndHealing: "2d6;3d6@10;4d6@14" }),
      feature(6, "land:natural-recovery", "Natural Recovery", { freeCircleSpellOncePerLongRest: true, recoverSlotsOnShortRest: "half-druid-level-round-up-max5", oncePerLongRest: true }),
      feature(10, "land:natures-ward", "Nature's Ward", { immunePoisoned: true, resistanceByCurrentLand: true }),
      feature(14, "land:natures-sanctuary", "Nature's Sanctuary", { spendsWildShape: true, durationMinutes: 1, halfCoverForAllies: true, sharesLandResistance: true }),
    ],
  }),

  champion: sub({
    profileId: "dnd5e-2024", id: "champion", classId: "fighter", displayName: "Champion", sourceId: "srd-5.2.1",
    features: [
      feature(3, "champion:improved-critical", "Improved Critical", { criticalRange: 19 }),
      feature(3, "champion:remarkable-athlete", "Remarkable Athlete", { initiativeAdvantage: true, athleticsAdvantage: true, longJumpBonusFt: "str-mod" }),
      feature(7, "champion:additional-fighting-style", "Additional Fighting Style", { fightingStyleChoice: 1 }),
      feature(10, "champion:heroic-warrior", "Heroic Warrior", { heroicInspirationAtTurnStartInCombatIfNone: true }),
      feature(15, "champion:superior-critical", "Superior Critical", { criticalRange: 18 }),
      feature(18, "champion:survivor", "Survivor", { deathSaveAdvantage: true, heroicRallyBelowHalfHp: true }),
    ],
  }),

  "warrior-of-the-open-hand": sub({
    profileId: "dnd5e-2024", id: "warrior-of-the-open-hand", classId: "monk", displayName: "Warrior of the Open Hand", sourceId: "srd-5.2.1",
    features: [
      feature(3, "open-hand:technique", "Open Hand Technique", { flurryOptions: ["addle", "push", "topple"] }),
      feature(6, "open-hand:wholeness-of-body", "Wholeness of Body", { bonusAction: true, healing: "martial-arts-die+wis", uses: "max-1-wis", refresh: "long-rest" }),
      feature(11, "open-hand:fleet-step", "Fleet Step", { stepOfWindAfterOtherBonusAction: true }),
      feature(17, "open-hand:quivering-palm", "Quivering Palm", { focusCost: 4, save: "con", damage: "10d12-force", durationDays: "monk-level" }),
    ],
  }),

  "oath-of-devotion": sub({
    profileId: "dnd5e-2024", id: "oath-of-devotion", classId: "paladin", displayName: "Oath of Devotion", sourceId: "srd-5.2.1",
    features: [
      feature(3, "devotion:oath-spells", "Oath of Devotion Spells", { alwaysPrepared: true }),
      feature(3, "devotion:sacred-weapon", "Sacred Weapon", { channelDivinity: true, bonusAction: true, attackBonus: "cha-mod", damageTypeOption: "radiant" }),
      feature(7, "devotion:aura", "Aura of Devotion", { charmedImmunityAura: true }),
      feature(15, "devotion:smite-of-protection", "Smite of Protection", { afterDivineSmiteGrantHalfCoverAura: true }),
      feature(20, "devotion:holy-nimbus", "Holy Nimbus", { activation: "bonus-action", durationMinutes: 1, radiantAura: true }),
    ],
  }),

  hunter: sub({
    profileId: "dnd5e-2024", id: "hunter", classId: "ranger", displayName: "Hunter", sourceId: "srd-5.2.1",
    features: [
      feature(3, "hunter:hunters-lore", "Hunter's Lore", { revealsImmunitiesResistancesVulnerabilitiesOnHuntersMark: true }),
      feature(3, "hunter:hunters-prey", "Hunter's Prey", { chooseEachShortOrLongRest: ["colossus-slayer", "horde-breaker"] }),
      feature(7, "hunter:defensive-tactics", "Defensive Tactics", { chooseEachShortOrLongRest: ["escape-the-horde", "multiattack-defense"] }),
      feature(11, "hunter:superior-hunters-prey", "Superior Hunter's Prey", { gainsBothHuntersPreyOptions: true }),
      feature(15, "hunter:superior-hunters-defense", "Superior Hunter's Defense", { gainsBothDefensiveTacticsOptions: true }),
    ],
  }),

  thief: sub({
    profileId: "dnd5e-2024", id: "thief", classId: "rogue", displayName: "Thief", sourceId: "srd-5.2.1",
    features: [
      feature(3, "thief:fast-hands", "Fast Hands", { cunningActionOptions: ["sleight-of-hand", "use-object"] }),
      feature(3, "thief:second-story-work", "Second-Story Work", { climbSpeedEqualsSpeed: true, dexLongJump: true }),
      feature(9, "thief:supreme-sneak", "Supreme Sneak", { cunningStealthAdvantage: true }),
      feature(13, "thief:use-magic-device", "Use Magic Device", { extraAttunementSlot: 1, chargeRetentionChance: true, scrollUse: true }),
      feature(17, "thief:thiefs-reflexes", "Thief's Reflexes", { extraTurnFirstCombatRound: true }),
    ],
  }),

  "draconic-sorcery": sub({
    profileId: "dnd5e-2024", id: "draconic-sorcery", classId: "sorcerer", displayName: "Draconic Sorcery", sourceId: "srd-5.2.1",
    features: [
      feature(3, "draconic:resilience", "Draconic Resilience", { baseAc: "10+dex+cha", maxHpPerSorcererLevel: 1 }),
      feature(3, "draconic:spells", "Draconic Spells", { alwaysPreparedByLevel: true }),
      feature(6, "draconic:elemental-affinity", "Elemental Affinity", { chooseDamageType: ["acid", "cold", "fire", "lightning", "poison"], addChaDamageOncePerTurn: true, temporaryResistanceViaSorceryPoint: true }),
      feature(14, "draconic:dragon-wings", "Dragon Wings", { activation: "bonus-action", flySpeed: 60 }),
      feature(18, "draconic:dragon-companion", "Dragon Companion", { castSummonDragonWithoutMaterialOncePerLongRest: true }),
    ],
  }),

  "fiend-patron": sub({
    profileId: "dnd5e-2024", id: "fiend-patron", classId: "warlock", displayName: "Fiend Patron", sourceId: "srd-5.2.1",
    features: [
      feature(3, "fiend:dark-ones-blessing", "Dark One's Blessing", { tempHpOnEnemyZero: "cha+warlock-level-min1", allyKillWithin10FtAlsoTriggers: true }),
      feature(3, "fiend:spells", "Fiend Spells", { alwaysPreparedByWarlockLevel: true }),
      feature(6, "fiend:dark-ones-own-luck", "Dark One's Own Luck", { add: "1d10", appliesTo: ["ability-check", "saving-throw"], uses: "max-1-cha", refresh: "long-rest" }),
      feature(10, "fiend:fiendish-resilience", "Fiendish Resilience", { chooseDamageResistanceAfterShortOrLongRest: true, excludesForce: true }),
      feature(14, "fiend:hurl-through-hell", "Hurl Through Hell", { save: "cha", damage: "8d10-psychic-nonfiend", incapacitatedUntilEndNextTurn: true, freeUseRefresh: "long-rest", rechargeWithPactSlot: true }),
    ],
  }),

  evoker: sub({
    profileId: "dnd5e-2024", id: "evoker", classId: "wizard", displayName: "Evoker", sourceId: "srd-5.2.1",
    features: [
      feature(3, "evoker:evocation-savant", "Evocation Savant", { freeEvocationSpellsAt3: 2, extraEvocationSpellWhenNewSlotLevel: 1 }),
      feature(3, "evoker:potent-cantrip", "Potent Cantrip", { halfDamageOnMissOrSuccessfulSave: true }),
      feature(6, "evoker:sculpt-spells", "Sculpt Spells", { protectTargets: "1+spell-level", autoSaveAndNoHalfDamage: true }),
      feature(10, "evoker:empowered-evocation", "Empowered Evocation", { addIntToOneDamageRoll: true }),
      feature(14, "evoker:overchannel", "Overchannel", { maxDamageSlotLevels: "1-5", firstFreePerLongRest: true, repeatNecroticCost: true }),
    ],
  }),
};

export function get2024Subclass(id: string): Dnd5eSubclassDefinition | undefined {
  return DND5E_2024_SUBCLASSES[id];
}
