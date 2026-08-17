// Reference implementation only. SRD 5.2.1 revised class registry.

import type { Dnd5eClassDefinition, Dnd5eClassFeatureGrant } from "./class-types";

const f = (
  level: number,
  id: string,
  label: string,
  choiceRequired = false,
  choiceKind?: Dnd5eClassFeatureGrant["choiceKind"],
  rules?: Dnd5eClassFeatureGrant["rules"],
): Dnd5eClassFeatureGrant => ({ level, id, label, choiceRequired, choiceKind, rules });

const asi = (level: number) => f(level, `asi:${level}`, "Ability Score Improvement", true, "feat");
const boon = () => f(19, "epic-boon", "Epic Boon", true, "feat");
const cls = (value: Dnd5eClassDefinition) => value;

export const DND5E_2024_CLASSES: Record<string, Dnd5eClassDefinition> = {
  barbarian: cls({
    profileId: "dnd5e-2024", id: "barbarian", displayName: "Barbarian",
    traits: {
      primaryAbilities: ["str"], hitDie: 12, saveProficiencies: ["str", "con"],
      skillChoices: { count: 2, options: ["animal-handling", "athletics", "intimidation", "nature", "perception", "survival"] },
      weaponProficiencies: ["simple", "martial"], armorTraining: ["light", "medium", "shields"],
      startingEquipmentOptions: [["greataxe", "handaxe-x4", "explorers-pack", "15-gp"], ["75-gp"]], startingGoldGp: 75,
    },
    multiclassPrerequisites: [{ ability: "str", minimum: 13 }],
    multiclassGrant: { hitDie: true, weaponProficiencies: ["martial"], armorTraining: ["shields"] },
    subclassLevels: [3, 6, 10, 14], publicCoreSubclassId: "path-of-the-berserker",
    features: [
      f(1, "rage", "Rage", false, undefined, { rages: 2, rageDamage: 2, refresh: "one-short-all-long" }),
      f(1, "unarmored-defense", "Unarmored Defense", false, undefined, { formula: "10+dex+con", shieldsAllowed: true }),
      f(1, "weapon-mastery", "Weapon Mastery", true, "weapon-mastery", { choices: 2 }),
      f(2, "danger-sense", "Danger Sense"), f(2, "reckless-attack", "Reckless Attack"),
      f(3, "subclass", "Barbarian Subclass", true, "subclass"), f(3, "primal-knowledge", "Primal Knowledge", true, "skill"),
      asi(4), f(4, "weapon-mastery-3", "Weapon Mastery 3", true, "weapon-mastery"),
      f(5, "extra-attack", "Extra Attack", false, undefined, { attacks: 2 }), f(5, "fast-movement", "Fast Movement", false, undefined, { speedBonusFt: 10, noHeavyArmor: true }),
      f(6, "subclass-6", "Subclass Feature"), f(7, "feral-instinct", "Feral Instinct"), f(7, "instinctive-pounce", "Instinctive Pounce"),
      asi(8), f(9, "brutal-strike", "Brutal Strike"), f(10, "subclass-10", "Subclass Feature"), f(10, "weapon-mastery-4", "Weapon Mastery 4", true, "weapon-mastery"),
      f(11, "relentless-rage", "Relentless Rage"), asi(12), f(13, "improved-brutal-strike", "Improved Brutal Strike"),
      f(14, "subclass-14", "Subclass Feature"), f(15, "persistent-rage", "Persistent Rage"), asi(16),
      f(17, "improved-brutal-strike-17", "Improved Brutal Strike"), f(18, "indomitable-might", "Indomitable Might"), boon(),
      f(20, "primal-champion", "Primal Champion", false, undefined, { strIncrease: 4, conIncrease: 4, maximum: 25 }),
    ],
  }),

  bard: cls({
    profileId: "dnd5e-2024", id: "bard", displayName: "Bard",
    traits: {
      primaryAbilities: ["cha"], hitDie: 8, saveProficiencies: ["dex", "cha"], skillChoices: { count: 3, options: "any" },
      weaponProficiencies: ["simple"], armorTraining: ["light"], toolChoice: { count: 3, options: "musical-instruments" },
      startingEquipmentOptions: [["leather-armor", "dagger-x2", "musical-instrument", "entertainers-pack", "19-gp"], ["90-gp"]], startingGoldGp: 90,
    },
    multiclassPrerequisites: [{ ability: "cha", minimum: 13 }],
    multiclassGrant: { hitDie: true, armorTraining: ["light"], skillChoice: { count: 1, options: "any" }, toolProficiencies: ["one-musical-instrument"] },
    spellcasting: { mode: "full", ability: "cha", startsAtClassLevel: 1, preparationModel: "prepared-list" },
    subclassLevels: [3, 6, 14], publicCoreSubclassId: "college-of-lore",
    features: [
      f(1, "bardic-inspiration", "Bardic Inspiration", false, undefined, { die: "d6", uses: "max-1-cha", refresh: "long-rest" }), f(1, "spellcasting", "Spellcasting", true, "spell"),
      f(2, "expertise", "Expertise", true, "skill", { choices: 2 }), f(2, "jack-of-all-trades", "Jack of All Trades"),
      f(3, "subclass", "Bard Subclass", true, "subclass"), asi(4), f(5, "font-of-inspiration", "Font of Inspiration", false, undefined, { bardicDie: "d8", refresh: "short-or-long-rest" }),
      f(6, "subclass-6", "Subclass Feature"), f(7, "countercharm", "Countercharm"), asi(8), f(9, "expertise-9", "Expertise", true, "skill", { choices: 2 }),
      f(10, "magical-secrets", "Magical Secrets", true, "spell", { bardicDie: "d10" }), asi(12), f(14, "subclass-14", "Subclass Feature"),
      f(15, "bardic-die-d12", "Bardic Inspiration d12", false, undefined, { bardicDie: "d12" }), asi(16), f(18, "superior-inspiration", "Superior Inspiration"), boon(),
      f(20, "words-of-creation", "Words of Creation"),
    ],
  }),

  cleric: cls({
    profileId: "dnd5e-2024", id: "cleric", displayName: "Cleric",
    traits: {
      primaryAbilities: ["wis"], hitDie: 8, saveProficiencies: ["wis", "cha"],
      skillChoices: { count: 2, options: ["history", "insight", "medicine", "persuasion", "religion"] },
      weaponProficiencies: ["simple"], armorTraining: ["light", "medium", "shields"],
      startingEquipmentOptions: [["chain-shirt", "shield", "mace", "holy-symbol", "priests-pack", "7-gp"], ["110-gp"]], startingGoldGp: 110,
    },
    multiclassPrerequisites: [{ ability: "wis", minimum: 13 }],
    multiclassGrant: { hitDie: true, armorTraining: ["light", "medium", "shields"] },
    spellcasting: { mode: "full", ability: "wis", startsAtClassLevel: 1, preparationModel: "prepared-list" },
    subclassLevels: [3, 6, 17], publicCoreSubclassId: "life-domain",
    features: [
      f(1, "spellcasting", "Spellcasting", true, "spell"), f(1, "divine-order", "Divine Order", true, "other"),
      f(2, "channel-divinity", "Channel Divinity", false, undefined, { uses: 2 }), f(3, "subclass", "Cleric Subclass", true, "subclass"),
      asi(4), f(5, "sear-undead", "Sear Undead"), f(6, "subclass-6", "Subclass Feature"), f(6, "channel-divinity-3", "Channel Divinity 3", false, undefined, { uses: 3 }),
      f(7, "blessed-strikes", "Blessed Strikes", true, "other"), asi(8), f(10, "divine-intervention", "Divine Intervention"),
      asi(12), f(14, "improved-blessed-strikes", "Improved Blessed Strikes"), asi(16), f(17, "subclass-17", "Subclass Feature"),
      f(18, "channel-divinity-4", "Channel Divinity 4", false, undefined, { uses: 4 }), boon(), f(20, "greater-divine-intervention", "Greater Divine Intervention"),
    ],
  }),

  druid: cls({
    profileId: "dnd5e-2024", id: "druid", displayName: "Druid",
    traits: {
      primaryAbilities: ["wis"], hitDie: 8, saveProficiencies: ["int", "wis"],
      skillChoices: { count: 2, options: ["animal-handling", "arcana", "insight", "medicine", "nature", "perception", "religion", "survival"] },
      weaponProficiencies: ["simple"], armorTraining: ["light", "shields"], toolProficiencies: ["herbalism-kit"],
      startingEquipmentOptions: [["leather-armor", "shield", "sickle", "druidic-focus-quarterstaff", "explorers-pack", "herbalism-kit", "9-gp"], ["50-gp"]], startingGoldGp: 50,
    },
    multiclassPrerequisites: [{ ability: "wis", minimum: 13 }], multiclassGrant: { hitDie: true, armorTraining: ["light", "shields"] },
    spellcasting: { mode: "full", ability: "wis", startsAtClassLevel: 1, preparationModel: "prepared-list" },
    subclassLevels: [3, 6, 10, 14], publicCoreSubclassId: "circle-of-the-land",
    features: [
      f(1, "spellcasting", "Spellcasting", true, "spell"), f(1, "druidic", "Druidic"), f(1, "primal-order", "Primal Order", true, "other"),
      f(2, "wild-shape", "Wild Shape", false, undefined, { uses: 2 }), f(2, "wild-companion", "Wild Companion"),
      f(3, "subclass", "Druid Subclass", true, "subclass"), asi(4), f(5, "wild-resurgence", "Wild Resurgence"),
      f(6, "subclass-6", "Subclass Feature", false, undefined, { wildShapeUses: 3 }), f(7, "elemental-fury", "Elemental Fury", true, "other"), asi(8),
      f(10, "subclass-10", "Subclass Feature", false, undefined, { wildShapeUses: 4 }), asi(12), f(14, "subclass-14", "Subclass Feature"),
      f(15, "improved-elemental-fury", "Improved Elemental Fury"), asi(16), f(18, "beast-spells", "Beast Spells"), boon(), f(20, "archdruid", "Archdruid"),
    ],
  }),

  fighter: cls({
    profileId: "dnd5e-2024", id: "fighter", displayName: "Fighter",
    traits: {
      primaryAbilities: ["str", "dex"], hitDie: 10, saveProficiencies: ["str", "con"],
      skillChoices: { count: 2, options: ["acrobatics", "animal-handling", "athletics", "history", "insight", "intimidation", "perception", "persuasion", "survival"] },
      weaponProficiencies: ["simple", "martial"], armorTraining: ["light", "medium", "heavy", "shields"],
      startingEquipmentOptions: [["chain-mail", "greatsword", "flail", "javelin-x8", "dungeoneers-pack", "4-gp"], ["studded-leather", "scimitar", "shortsword", "longbow", "arrow-x20", "quiver", "dungeoneers-pack", "11-gp"], ["155-gp"]], startingGoldGp: 155,
    },
    multiclassPrerequisites: [{ either: [{ ability: "str", minimum: 13 }, { ability: "dex", minimum: 13 }] }],
    multiclassGrant: { hitDie: true, weaponProficiencies: ["martial"], armorTraining: ["light", "medium", "shields"] },
    subclassLevels: [3, 7, 10, 15, 18], publicCoreSubclassId: "champion",
    features: [
      f(1, "fighting-style", "Fighting Style", true, "fighting-style"), f(1, "second-wind", "Second Wind", false, undefined, { uses: 2 }), f(1, "weapon-mastery", "Weapon Mastery", true, "weapon-mastery", { choices: 3 }),
      f(2, "action-surge", "Action Surge", false, undefined, { uses: 1, refresh: "short-or-long-rest" }), f(2, "tactical-mind", "Tactical Mind"),
      f(3, "subclass", "Fighter Subclass", true, "subclass"), asi(4), f(4, "second-wind-3", "Second Wind 3", false, undefined, { uses: 3 }), f(4, "weapon-mastery-4", "Weapon Mastery 4", true, "weapon-mastery"),
      f(5, "extra-attack", "Extra Attack", false, undefined, { attacks: 2 }), f(5, "tactical-shift", "Tactical Shift"), asi(6), f(7, "subclass-7", "Subclass Feature"), asi(8),
      f(9, "indomitable-1", "Indomitable", false, undefined, { uses: 1 }), f(9, "tactical-master", "Tactical Master"), f(10, "subclass-10", "Subclass Feature"), f(10, "second-wind-4", "Second Wind 4", false, undefined, { uses: 4 }), f(10, "weapon-mastery-5", "Weapon Mastery 5", true, "weapon-mastery"),
      f(11, "two-extra-attacks", "Two Extra Attacks", false, undefined, { attacks: 3 }), asi(12), f(13, "indomitable-2", "Indomitable 2", false, undefined, { uses: 2 }), f(13, "studied-attacks", "Studied Attacks"),
      asi(14), f(15, "subclass-15", "Subclass Feature"), asi(16), f(16, "weapon-mastery-6", "Weapon Mastery 6", true, "weapon-mastery"),
      f(17, "action-surge-2", "Action Surge 2", false, undefined, { uses: 2 }), f(17, "indomitable-3", "Indomitable 3", false, undefined, { uses: 3 }),
      f(18, "subclass-18", "Subclass Feature"), boon(), f(20, "three-extra-attacks", "Three Extra Attacks", false, undefined, { attacks: 4 }),
    ],
  }),

  monk: cls({
    profileId: "dnd5e-2024", id: "monk", displayName: "Monk",
    traits: {
      primaryAbilities: ["dex", "wis"], hitDie: 8, saveProficiencies: ["str", "dex"],
      skillChoices: { count: 2, options: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"] },
      weaponProficiencies: ["simple", "martial-light"], armorTraining: [], toolChoice: { count: 1, options: "source-registry" },
      startingEquipmentOptions: [["spear", "dagger-x5", "selected-tool", "explorers-pack", "11-gp"], ["50-gp"]], startingGoldGp: 50,
    },
    multiclassPrerequisites: [{ ability: "dex", minimum: 13 }, { ability: "wis", minimum: 13 }], multiclassGrant: { hitDie: true },
    subclassLevels: [3, 6, 11, 17], publicCoreSubclassId: "warrior-of-the-open-hand",
    features: [
      f(1, "martial-arts", "Martial Arts", false, undefined, { die: "d6" }), f(1, "unarmored-defense", "Unarmored Defense", false, undefined, { formula: "10+dex+wis" }),
      f(2, "monks-focus", "Monk's Focus", false, undefined, { points: "monk-level", saveDc: "8+wis+pb" }), f(2, "unarmored-movement", "Unarmored Movement", false, undefined, { bonusFt: 10 }), f(2, "uncanny-metabolism", "Uncanny Metabolism"),
      f(3, "deflect-attacks", "Deflect Attacks"), f(3, "subclass", "Monk Subclass", true, "subclass"), asi(4), f(4, "slow-fall", "Slow Fall"),
      f(5, "extra-attack", "Extra Attack", false, undefined, { attacks: 2, martialArtsDie: "d8" }), f(5, "stunning-strike", "Stunning Strike"),
      f(6, "empowered-strikes", "Empowered Strikes"), f(6, "subclass-6", "Subclass Feature", false, undefined, { speedBonusFt: 15 }),
      f(7, "evasion", "Evasion"), asi(8), f(9, "acrobatic-movement", "Acrobatic Movement"),
      f(10, "heightened-focus", "Heightened Focus", false, undefined, { speedBonusFt: 20 }), f(10, "self-restoration", "Self-Restoration"),
      f(11, "subclass-11", "Subclass Feature", false, undefined, { martialArtsDie: "d10" }), asi(12), f(13, "deflect-energy", "Deflect Energy"),
      f(14, "disciplined-survivor", "Disciplined Survivor", false, undefined, { speedBonusFt: 25 }), f(15, "perfect-focus", "Perfect Focus"), asi(16),
      f(17, "subclass-17", "Subclass Feature", false, undefined, { martialArtsDie: "d12" }), f(18, "superior-defense", "Superior Defense", false, undefined, { speedBonusFt: 30 }), boon(),
      f(20, "body-and-mind", "Body and Mind", false, undefined, { dexIncrease: 4, wisIncrease: 4, maximum: 25 }),
    ],
  }),

  paladin: cls({
    profileId: "dnd5e-2024", id: "paladin", displayName: "Paladin",
    traits: {
      primaryAbilities: ["str", "cha"], hitDie: 10, saveProficiencies: ["wis", "cha"],
      skillChoices: { count: 2, options: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"] },
      weaponProficiencies: ["simple", "martial"], armorTraining: ["light", "medium", "heavy", "shields"],
      startingEquipmentOptions: [["chain-mail", "shield", "longsword", "javelin-x6", "holy-symbol", "priests-pack", "9-gp"], ["150-gp"]], startingGoldGp: 150,
    },
    multiclassPrerequisites: [{ ability: "str", minimum: 13 }, { ability: "cha", minimum: 13 }],
    multiclassGrant: { hitDie: true, weaponProficiencies: ["martial"], armorTraining: ["light", "medium", "shields"] },
    spellcasting: { mode: "half", ability: "cha", startsAtClassLevel: 1, preparationModel: "prepared-list" },
    subclassLevels: [3, 7, 15, 20], publicCoreSubclassId: "oath-of-devotion",
    features: [
      f(1, "lay-on-hands", "Lay On Hands", false, undefined, { poolPerPaladinLevel: 5 }), f(1, "spellcasting", "Spellcasting", true, "spell"), f(1, "weapon-mastery", "Weapon Mastery", true, "weapon-mastery", { choices: 2 }),
      f(2, "fighting-style", "Fighting Style", true, "fighting-style"), f(2, "paladins-smite", "Paladin's Smite"),
      f(3, "channel-divinity", "Channel Divinity", false, undefined, { uses: 2 }), f(3, "subclass", "Paladin Subclass", true, "subclass"), asi(4),
      f(5, "extra-attack", "Extra Attack", false, undefined, { attacks: 2 }), f(5, "faithful-steed", "Faithful Steed"), f(6, "aura-of-protection", "Aura of Protection"),
      f(7, "subclass-7", "Subclass Feature"), asi(8), f(9, "abjure-foes", "Abjure Foes"), f(10, "aura-of-courage", "Aura of Courage"),
      f(11, "radiant-strikes", "Radiant Strikes", false, undefined, { channelDivinityUses: 3 }), asi(12), f(14, "restoring-touch", "Restoring Touch"),
      f(15, "subclass-15", "Subclass Feature"), asi(16), f(20, "subclass-20", "Subclass Feature"), boon(),
    ],
  }),

  ranger: cls({
    profileId: "dnd5e-2024", id: "ranger", displayName: "Ranger",
    traits: {
      primaryAbilities: ["dex", "wis"], hitDie: 10, saveProficiencies: ["str", "dex"],
      skillChoices: { count: 3, options: ["animal-handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"] },
      weaponProficiencies: ["simple", "martial"], armorTraining: ["light", "medium", "shields"],
      startingEquipmentOptions: [["studded-leather", "scimitar", "shortsword", "longbow", "arrow-x20", "quiver", "druidic-focus", "explorers-pack", "7-gp"], ["150-gp"]], startingGoldGp: 150,
    },
    multiclassPrerequisites: [{ ability: "dex", minimum: 13 }, { ability: "wis", minimum: 13 }],
    multiclassGrant: { hitDie: true, weaponProficiencies: ["martial"], armorTraining: ["light", "medium", "shields"], skillChoice: { count: 1, options: "class-list" } },
    spellcasting: { mode: "half", ability: "wis", startsAtClassLevel: 1, preparationModel: "prepared-list" },
    subclassLevels: [3, 7, 11, 15], publicCoreSubclassId: "hunter",
    features: [
      f(1, "spellcasting", "Spellcasting", true, "spell"), f(1, "favored-enemy", "Favored Enemy", false, undefined, { freeHuntersMark: 2 }), f(1, "weapon-mastery", "Weapon Mastery", true, "weapon-mastery", { choices: 2 }),
      f(2, "deft-explorer", "Deft Explorer", true, "skill"), f(2, "fighting-style", "Fighting Style", true, "fighting-style"), f(3, "subclass", "Ranger Subclass", true, "subclass"),
      asi(4), f(5, "extra-attack", "Extra Attack", false, undefined, { attacks: 2, freeHuntersMark: 3 }), f(6, "roving", "Roving"), f(7, "subclass-7", "Subclass Feature"),
      asi(8), f(9, "expertise", "Expertise", true, "skill", { freeHuntersMark: 4 }), f(10, "tireless", "Tireless"), f(11, "subclass-11", "Subclass Feature"),
      asi(12), f(13, "relentless-hunter", "Relentless Hunter", false, undefined, { freeHuntersMark: 5 }), f(14, "natures-veil", "Nature's Veil"), f(15, "subclass-15", "Subclass Feature"),
      asi(16), f(17, "precise-hunter", "Precise Hunter", false, undefined, { freeHuntersMark: 6 }), f(18, "feral-senses", "Feral Senses"), boon(), f(20, "foe-slayer", "Foe Slayer"),
    ],
  }),

  rogue: cls({
    profileId: "dnd5e-2024", id: "rogue", displayName: "Rogue",
    traits: {
      primaryAbilities: ["dex"], hitDie: 8, saveProficiencies: ["dex", "int"],
      skillChoices: { count: 4, options: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "persuasion", "sleight-of-hand", "stealth"] },
      weaponProficiencies: ["simple", "martial-finesse-or-light"], armorTraining: ["light"], toolProficiencies: ["thieves-tools"],
      startingEquipmentOptions: [["leather-armor", "dagger-x2", "shortsword", "shortbow", "arrow-x20", "quiver", "thieves-tools", "burglars-pack", "8-gp"], ["100-gp"]], startingGoldGp: 100,
    },
    multiclassPrerequisites: [{ ability: "dex", minimum: 13 }],
    multiclassGrant: { hitDie: true, armorTraining: ["light"], toolProficiencies: ["thieves-tools"], skillChoice: { count: 1, options: "class-list" } },
    subclassLevels: [3, 9, 13, 17], publicCoreSubclassId: "thief",
    features: [
      f(1, "expertise", "Expertise", true, "skill", { choices: 2 }), f(1, "sneak-attack", "Sneak Attack", false, undefined, { dice: "1d6" }), f(1, "thieves-cant", "Thieves' Cant", true, "other"), f(1, "weapon-mastery", "Weapon Mastery", true, "weapon-mastery", { choices: 2 }),
      f(2, "cunning-action", "Cunning Action"), f(3, "subclass", "Rogue Subclass", true, "subclass", { sneakAttack: "2d6" }), f(3, "steady-aim", "Steady Aim"),
      asi(4), f(5, "cunning-strike", "Cunning Strike", false, undefined, { sneakAttack: "3d6" }), f(5, "uncanny-dodge", "Uncanny Dodge"),
      f(6, "expertise-6", "Expertise", true, "skill", { choices: 2 }), f(7, "evasion", "Evasion", false, undefined, { sneakAttack: "4d6" }), f(7, "reliable-talent", "Reliable Talent"),
      asi(8), f(9, "subclass-9", "Subclass Feature", false, undefined, { sneakAttack: "5d6" }), asi(10), f(11, "improved-cunning-strike", "Improved Cunning Strike", false, undefined, { sneakAttack: "6d6" }),
      asi(12), f(13, "subclass-13", "Subclass Feature", false, undefined, { sneakAttack: "7d6" }), f(14, "devious-strikes", "Devious Strikes"), f(15, "slippery-mind", "Slippery Mind", false, undefined, { sneakAttack: "8d6" }),
      asi(16), f(17, "subclass-17", "Subclass Feature", false, undefined, { sneakAttack: "9d6" }), f(18, "elusive", "Elusive"), boon(), f(19, "sneak-attack-10", "Sneak Attack 10d6", false, undefined, { sneakAttack: "10d6" }), f(20, "stroke-of-luck", "Stroke of Luck"),
    ],
  }),

  sorcerer: cls({
    profileId: "dnd5e-2024", id: "sorcerer", displayName: "Sorcerer",
    traits: {
      primaryAbilities: ["cha"], hitDie: 6, saveProficiencies: ["con", "cha"],
      skillChoices: { count: 2, options: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"] },
      weaponProficiencies: ["simple"], armorTraining: [],
      startingEquipmentOptions: [["spear", "dagger-x2", "arcane-focus-crystal", "dungeoneers-pack", "28-gp"], ["50-gp"]], startingGoldGp: 50,
    },
    multiclassPrerequisites: [{ ability: "cha", minimum: 13 }], multiclassGrant: { hitDie: true },
    spellcasting: { mode: "full", ability: "cha", startsAtClassLevel: 1, preparationModel: "prepared-list" },
    subclassLevels: [3, 6, 14, 18], publicCoreSubclassId: "draconic-sorcery",
    features: [
      f(1, "spellcasting", "Spellcasting", true, "spell"), f(1, "innate-sorcery", "Innate Sorcery", false, undefined, { uses: 2, refresh: "long-rest" }),
      f(2, "font-of-magic", "Font of Magic", false, undefined, { sorceryPoints: 2 }), f(2, "metamagic", "Metamagic", true, "metamagic", { choices: 2 }),
      f(3, "subclass", "Sorcerer Subclass", true, "subclass", { sorceryPoints: 3 }), asi(4), f(5, "sorcerous-restoration", "Sorcerous Restoration"),
      f(6, "subclass-6", "Subclass Feature"), f(7, "sorcery-incarnate", "Sorcery Incarnate"), asi(8), f(10, "metamagic-10", "Metamagic", true, "metamagic", { extraChoices: 2 }),
      asi(12), f(14, "subclass-14", "Subclass Feature"), asi(16), f(17, "metamagic-17", "Metamagic", true, "metamagic", { extraChoices: 2 }), f(18, "subclass-18", "Subclass Feature"),
      boon(), f(20, "arcane-apotheosis", "Arcane Apotheosis"),
    ],
  }),

  warlock: cls({
    profileId: "dnd5e-2024", id: "warlock", displayName: "Warlock",
    traits: {
      primaryAbilities: ["cha"], hitDie: 8, saveProficiencies: ["wis", "cha"],
      skillChoices: { count: 2, options: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"] },
      weaponProficiencies: ["simple"], armorTraining: ["light"],
      startingEquipmentOptions: [["leather-armor", "sickle", "dagger-x2", "arcane-focus-orb", "book-occult-lore", "scholars-pack", "15-gp"], ["100-gp"]], startingGoldGp: 100,
    },
    multiclassPrerequisites: [{ ability: "cha", minimum: 13 }], multiclassGrant: { hitDie: true, armorTraining: ["light"] },
    spellcasting: { mode: "pact", ability: "cha", startsAtClassLevel: 1, preparationModel: "pact-prepared" },
    subclassLevels: [3, 6, 10, 14], publicCoreSubclassId: "fiend-patron",
    features: [
      f(1, "eldritch-invocations", "Eldritch Invocations", true, "invocation", { choices: 1 }), f(1, "pact-magic", "Pact Magic", true, "spell"),
      f(2, "magical-cunning", "Magical Cunning"), f(2, "eldritch-invocations-3", "Eldritch Invocations 3", true, "invocation", { totalChoices: 3 }),
      f(3, "subclass", "Warlock Subclass", true, "subclass"), asi(4), f(5, "eldritch-invocations-5", "Eldritch Invocations 5", true, "invocation", { totalChoices: 5 }),
      f(6, "subclass-6", "Subclass Feature"), f(7, "eldritch-invocations-6", "Eldritch Invocations 6", true, "invocation", { totalChoices: 6 }), asi(8),
      f(9, "contact-patron", "Contact Patron"), f(9, "eldritch-invocations-7", "Eldritch Invocations 7", true, "invocation", { totalChoices: 7 }), f(10, "subclass-10", "Subclass Feature"),
      f(11, "mystic-arcanum-6", "Mystic Arcanum (6th)", true, "spell"), asi(12), f(13, "mystic-arcanum-7", "Mystic Arcanum (7th)", true, "spell"), f(14, "subclass-14", "Subclass Feature"),
      f(15, "mystic-arcanum-8", "Mystic Arcanum (8th)", true, "spell"), f(15, "eldritch-invocations-8", "Eldritch Invocations 8", true, "invocation", { totalChoices: 8 }), asi(16),
      f(17, "mystic-arcanum-9", "Mystic Arcanum (9th)", true, "spell"), f(18, "eldritch-invocations-9", "Eldritch Invocations 9", true, "invocation", { totalChoices: 9 }), boon(), f(20, "eldritch-master", "Eldritch Master"),
    ],
  }),

  wizard: cls({
    profileId: "dnd5e-2024", id: "wizard", displayName: "Wizard",
    traits: {
      primaryAbilities: ["int"], hitDie: 6, saveProficiencies: ["int", "wis"],
      skillChoices: { count: 2, options: ["arcana", "history", "insight", "investigation", "medicine", "nature", "religion"] },
      weaponProficiencies: ["simple"], armorTraining: [],
      startingEquipmentOptions: [["dagger-x2", "arcane-focus-quarterstaff", "robe", "spellbook", "scholars-pack", "5-gp"], ["55-gp"]], startingGoldGp: 55,
    },
    multiclassPrerequisites: [{ ability: "int", minimum: 13 }], multiclassGrant: { hitDie: true },
    spellcasting: { mode: "full", ability: "int", startsAtClassLevel: 1, preparationModel: "spellbook", ritualModel: "spellbook" },
    subclassLevels: [3, 6, 10, 14], publicCoreSubclassId: "evoker",
    features: [
      f(1, "spellcasting", "Spellcasting", true, "spell"), f(1, "ritual-adept", "Ritual Adept"), f(1, "arcane-recovery", "Arcane Recovery"),
      f(2, "scholar", "Scholar", true, "skill"), f(3, "subclass", "Wizard Subclass", true, "subclass"), asi(4), f(5, "memorize-spell", "Memorize Spell"),
      f(6, "subclass-6", "Subclass Feature"), asi(8), f(10, "subclass-10", "Subclass Feature"), asi(12), f(14, "subclass-14", "Subclass Feature"),
      asi(16), f(18, "spell-mastery", "Spell Mastery", true, "spell"), boon(), f(20, "signature-spells", "Signature Spells", true, "spell"),
    ],
  }),
};

export function get2024Class(id: string): Dnd5eClassDefinition | undefined {
  return DND5E_2024_CLASSES[id];
}
