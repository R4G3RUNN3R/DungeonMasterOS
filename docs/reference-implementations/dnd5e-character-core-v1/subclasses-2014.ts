// Reference implementation only. SRD 5.1 public subclasses.

import type { Dnd5eSubclassDefinition } from "./class-types";

const sub = (value: Dnd5eSubclassDefinition) => value;
const feature = (
  level: number,
  id: string,
  label: string,
  rules?: Record<string, string | number | boolean | string[]>,
) => ({ level, id, label, rules });

export const DND5E_2014_SUBCLASSES: Record<string, Dnd5eSubclassDefinition> = {
  "path-of-the-berserker": sub({
    profileId: "dnd5e-2014", id: "path-of-the-berserker", classId: "barbarian", displayName: "Path of the Berserker", sourceId: "srd-5.1",
    features: [
      feature(3, "berserker:frenzy", "Frenzy", { bonusActionMeleeAttackWhileFrenzying: true, exhaustionAfterRage: 1 }),
      feature(6, "berserker:mindless-rage", "Mindless Rage", { immuneCharmedFrightenedWhileRaging: true }),
      feature(10, "berserker:intimidating-presence", "Intimidating Presence", { action: "frighten", save: "wis", dc: "8+pb+cha" }),
      feature(14, "berserker:retaliation", "Retaliation", { reactionMeleeAttackWhenDamagedWithin5Ft: true }),
    ],
  }),

  "college-of-lore": sub({
    profileId: "dnd5e-2014", id: "college-of-lore", classId: "bard", displayName: "College of Lore", sourceId: "srd-5.1",
    features: [
      feature(3, "lore:bonus-proficiencies", "Bonus Proficiencies", { skillChoices: 3 }),
      feature(3, "lore:cutting-words", "Cutting Words", { reaction: true, spendsBardicInspiration: true }),
      feature(6, "lore:additional-magical-secrets", "Additional Magical Secrets", { spellChoicesFromAnyClass: 2 }),
      feature(14, "lore:peerless-skill", "Peerless Skill", { bardicInspirationOnOwnAbilityCheck: true }),
    ],
  }),

  "life-domain": sub({
    profileId: "dnd5e-2014", id: "life-domain", classId: "cleric", displayName: "Life Domain", sourceId: "srd-5.1",
    features: [
      feature(1, "life:bonus-proficiency", "Bonus Proficiency", { heavyArmor: true }),
      feature(1, "life:disciple-of-life", "Disciple of Life", { healingBonus: "2+spell-level" }),
      feature(1, "life:domain-spells", "Life Domain Spells", { alwaysPrepared: true }),
      feature(2, "life:preserve-life", "Channel Divinity: Preserve Life", { channelDivinity: true }),
      feature(6, "life:blessed-healer", "Blessed Healer", { selfHealWhenHealingOther: "2+spell-level" }),
      feature(8, "life:divine-strike", "Divine Strike", { weaponDamage: "1d8-radiant", oncePerTurn: true, becomes2d8At14: true }),
      feature(17, "life:supreme-healing", "Supreme Healing", { maximizeHealingDice: true }),
    ],
  }),

  "circle-of-the-land": sub({
    profileId: "dnd5e-2014", id: "circle-of-the-land", classId: "druid", displayName: "Circle of the Land", sourceId: "srd-5.1",
    features: [
      feature(2, "land:bonus-cantrip", "Bonus Cantrip", { druidCantripChoice: 1 }),
      feature(2, "land:natural-recovery", "Natural Recovery", { recoverSlotsOnShortRest: "half-druid-level-round-up", maxSlotLevel: 5, oncePerLongRest: true }),
      feature(3, "land:circle-spells", "Circle Spells", { landChoice: true, alwaysPrepared: true }),
      feature(6, "land:lands-stride", "Land's Stride"),
      feature(10, "land:natures-ward", "Nature's Ward", { immunePoisonDisease: true, immuneCharmedFrightenedByElementalsFey: true }),
      feature(14, "land:natures-sanctuary", "Nature's Sanctuary", { beastsPlantsMustSaveToAttack: true }),
    ],
  }),

  champion: sub({
    profileId: "dnd5e-2014", id: "champion", classId: "fighter", displayName: "Champion", sourceId: "srd-5.1",
    features: [
      feature(3, "champion:improved-critical", "Improved Critical", { criticalRange: 19 }),
      feature(7, "champion:remarkable-athlete", "Remarkable Athlete", { halfPbToUnproficientPhysicalChecks: true, runningLongJumpBonusFt: "str-mod" }),
      feature(10, "champion:additional-fighting-style", "Additional Fighting Style", { fightingStyleChoice: 1 }),
      feature(15, "champion:superior-critical", "Superior Critical", { criticalRange: 18 }),
      feature(18, "champion:survivor", "Survivor", { regenerationBelowHalfHp: "5+con-mod" }),
    ],
  }),

  "way-of-the-open-hand": sub({
    profileId: "dnd5e-2014", id: "way-of-the-open-hand", classId: "monk", displayName: "Way of the Open Hand", sourceId: "srd-5.1",
    features: [
      feature(3, "open-hand:technique", "Open Hand Technique", { flurryOptions: ["prone-dex-save", "push-str-save", "no-reactions"] }),
      feature(6, "open-hand:wholeness-of-body", "Wholeness of Body", { action: true, healing: "3x-monk-level", refresh: "long-rest" }),
      feature(11, "open-hand:tranquility", "Tranquility", { sanctuaryAfterLongRest: true }),
      feature(17, "open-hand:quivering-palm", "Quivering Palm", { kiCost: 3, setupOnUnarmedHit: true, conSave: true, failHpTo0: true, successDamage: "10d10-necrotic" }),
    ],
  }),

  "oath-of-devotion": sub({
    profileId: "dnd5e-2014", id: "oath-of-devotion", classId: "paladin", displayName: "Oath of Devotion", sourceId: "srd-5.1",
    features: [
      feature(3, "devotion:oath-spells", "Oath Spells", { alwaysPrepared: true }),
      feature(3, "devotion:sacred-weapon", "Channel Divinity: Sacred Weapon", { addChaToAttack: true, weaponMagical: true }),
      feature(3, "devotion:turn-unholy", "Channel Divinity: Turn the Unholy", { turnsFiendsUndead: true }),
      feature(7, "devotion:aura", "Aura of Devotion", { charmedImmunityAura: true }),
      feature(15, "devotion:purity-of-spirit", "Purity of Spirit", { protectionFromEvilGoodAlwaysActive: true }),
      feature(20, "devotion:holy-nimbus", "Holy Nimbus", { action: true, durationMinutes: 1, radiantAura: true, advantageVsFiendUndeadSpells: true }),
    ],
  }),

  hunter: sub({
    profileId: "dnd5e-2014", id: "hunter", classId: "ranger", displayName: "Hunter", sourceId: "srd-5.1",
    features: [
      feature(3, "hunter:hunters-prey", "Hunter's Prey", { permanentChoice: ["colossus-slayer", "giant-killer", "horde-breaker"] }),
      feature(7, "hunter:defensive-tactics", "Defensive Tactics", { permanentChoice: ["escape-the-horde", "multiattack-defense", "steel-will"] }),
      feature(11, "hunter:multiattack", "Multiattack", { permanentChoice: ["volley", "whirlwind-attack"] }),
      feature(15, "hunter:superior-hunters-defense", "Superior Hunter's Defense", { permanentChoice: ["evasion", "stand-against-the-tide", "uncanny-dodge"] }),
    ],
  }),

  thief: sub({
    profileId: "dnd5e-2014", id: "thief", classId: "rogue", displayName: "Thief", sourceId: "srd-5.1",
    features: [
      feature(3, "thief:fast-hands", "Fast Hands", { cunningActionOptions: ["sleight-of-hand", "thieves-tools", "use-object"] }),
      feature(3, "thief:second-story-work", "Second-Story Work", { climbNoExtraCost: true, runningJumpBonusFt: "dex-mod" }),
      feature(9, "thief:supreme-sneak", "Supreme Sneak", { stealthAdvantageWhileHalfSpeed: true }),
      feature(13, "thief:use-magic-device", "Use Magic Device", { ignoresClassRaceLevelMagicItemRequirements: true }),
      feature(17, "thief:thiefs-reflexes", "Thief's Reflexes", { secondTurnFirstCombatRoundAtInitiativeMinus10: true }),
    ],
  }),

  "draconic-bloodline": sub({
    profileId: "dnd5e-2014", id: "draconic-bloodline", classId: "sorcerer", displayName: "Draconic Bloodline", sourceId: "srd-5.1",
    features: [
      feature(1, "draconic:dragon-ancestor", "Dragon Ancestor", { ancestryChoice: true, languageDraconic: true, doublePbOnDragonChaChecks: true }),
      feature(1, "draconic:resilience", "Draconic Resilience", { maxHpPerSorcererLevel: 1, unarmoredAc: "13+dex" }),
      feature(6, "draconic:elemental-affinity", "Elemental Affinity", { addChaDamageToMatchingSpellOncePerCast: true, sorceryPointResistance: true }),
      feature(14, "draconic:dragon-wings", "Dragon Wings", { bonusAction: true, flySpeedEqualsSpeed: true }),
      feature(18, "draconic:draconic-presence", "Draconic Presence", { sorceryPoints: 5, auraCharmOrFear: true }),
    ],
  }),

  "fiend-patron": sub({
    profileId: "dnd5e-2014", id: "fiend-patron", classId: "warlock", displayName: "The Fiend", sourceId: "srd-5.1",
    features: [
      feature(1, "fiend:expanded-spell-list", "Expanded Spell List", { expandsWarlockChoices: true }),
      feature(1, "fiend:dark-ones-blessing", "Dark One's Blessing", { tempHpOnHostileZero: "cha+warlock-level" }),
      feature(6, "fiend:dark-ones-own-luck", "Dark One's Own Luck", { add: "1d10", appliesTo: ["ability-check", "saving-throw"], refresh: "short-or-long-rest" }),
      feature(10, "fiend:fiendish-resilience", "Fiendish Resilience", { chooseDamageResistanceAfterShortOrLongRest: true, excludesMagicalSilveredBypassRule: true }),
      feature(14, "fiend:hurl-through-hell", "Hurl Through Hell", { oncePerLongRest: true, onHit: true, damage: "10d10-psychic", fiendsImmuneToDamagePart: true }),
    ],
  }),

  "school-of-evocation": sub({
    profileId: "dnd5e-2014", id: "school-of-evocation", classId: "wizard", displayName: "School of Evocation", sourceId: "srd-5.1",
    features: [
      feature(2, "evocation:savant", "Evocation Savant", { copyCostTimeHalfForEvocation: true }),
      feature(2, "evocation:sculpt-spells", "Sculpt Spells", { protectTargets: "1+spell-level", autoSaveNoDamage: true }),
      feature(6, "evocation:potent-cantrip", "Potent Cantrip", { halfDamageOnSuccessfulSave: true }),
      feature(10, "evocation:empowered-evocation", "Empowered Evocation", { addIntToOneWizardEvocationDamageRoll: true }),
      feature(14, "evocation:overchannel", "Overchannel", { maxDamageSpellLevels: "1-5", firstFreePerLongRest: true, repeatNecroticCost: true }),
    ],
  }),
};

export function get2014Subclass(id: string): Dnd5eSubclassDefinition | undefined {
  return DND5E_2014_SUBCLASSES[id];
}
