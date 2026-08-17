// Reference implementation only. SRD 5.1 2014-era class registry.

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
const cls = (value: Dnd5eClassDefinition) => value;

export const DND5E_2014_CLASSES: Record<string, Dnd5eClassDefinition> = {
  barbarian: cls({
    profileId: "dnd5e-2014", id: "barbarian", displayName: "Barbarian",
    traits: {
      primaryAbilities: ["str"], hitDie: 12, saveProficiencies: ["str", "con"],
      skillChoices: { count: 2, options: ["animal-handling", "athletics", "intimidation", "nature", "perception", "survival"] },
      weaponProficiencies: ["simple", "martial"], armorTraining: ["light", "medium", "shields"],
    },
    multiclassPrerequisites: [{ ability: "str", minimum: 13 }],
    multiclassGrant: { hitDie: true, weaponProficiencies: ["simple", "martial"], armorTraining: ["light", "medium", "shields"] },
    subclassLevels: [3, 6, 10, 14], publicCoreSubclassId: "path-of-the-berserker",
    features: [
      f(1, "rage", "Rage", false, undefined, { rages: 2, rageDamage: 2 }), f(1, "unarmored-defense", "Unarmored Defense", false, undefined, { formula: "10+dex+con", shieldAllowed: true }),
      f(2, "reckless-attack", "Reckless Attack"), f(2, "danger-sense", "Danger Sense"), f(3, "subclass", "Primal Path", true, "subclass"),
      asi(4), f(5, "extra-attack", "Extra Attack", false, undefined, { attacks: 2 }), f(5, "fast-movement", "Fast Movement", false, undefined, { bonusFt: 10, noHeavyArmor: true }),
      f(6, "subclass-6", "Path Feature"), f(7, "feral-instinct", "Feral Instinct"), asi(8), f(9, "brutal-critical-1", "Brutal Critical", false, undefined, { extraDice: 1 }),
      f(10, "subclass-10", "Path Feature"), f(11, "relentless-rage", "Relentless Rage"), asi(12), f(13, "brutal-critical-2", "Brutal Critical", false, undefined, { extraDice: 2 }),
      f(14, "subclass-14", "Path Feature"), f(15, "persistent-rage", "Persistent Rage"), asi(16), f(17, "brutal-critical-3", "Brutal Critical", false, undefined, { extraDice: 3 }),
      f(18, "indomitable-might", "Indomitable Might"), asi(19), f(20, "primal-champion", "Primal Champion", false, undefined, { strIncrease: 4, conIncrease: 4, maximum: 24 }),
    ],
  }),

  bard: cls({
    profileId: "dnd5e-2014", id: "bard", displayName: "Bard",
    traits: {
      primaryAbilities: ["cha"], hitDie: 8, saveProficiencies: ["dex", "cha"], skillChoices: { count: 3, options: "any" },
      weaponProficiencies: ["simple", "hand-crossbow", "longsword", "rapier", "shortsword"], armorTraining: ["light"], toolChoice: { count: 3, options: "musical-instruments" },
    },
    multiclassPrerequisites: [{ ability: "cha", minimum: 13 }],
    multiclassGrant: { hitDie: true, armorTraining: ["light"], skillChoice: { count: 1, options: "any" }, toolProficiencies: ["one-musical-instrument"] },
    spellcasting: { mode: "full", ability: "cha", startsAtClassLevel: 1, preparationModel: "known-list", ritualModel: "class-list" },
    subclassLevels: [3, 6, 14], publicCoreSubclassId: "college-of-lore",
    features: [
      f(1, "spellcasting", "Spellcasting", true, "spell"), f(1, "bardic-inspiration", "Bardic Inspiration", false, undefined, { die: "d6", uses: "cha-mod-min-1", refresh: "long-rest" }),
      f(2, "jack-of-all-trades", "Jack of All Trades"), f(2, "song-of-rest-d6", "Song of Rest d6"), f(3, "subclass", "Bard College", true, "subclass"), f(3, "expertise", "Expertise", true, "skill", { choices: 2 }),
      asi(4), f(5, "bardic-inspiration-d8", "Bardic Inspiration d8"), f(5, "font-of-inspiration", "Font of Inspiration"), f(6, "countercharm", "Countercharm"), f(6, "subclass-6", "College Feature"),
      asi(8), f(9, "song-of-rest-d8", "Song of Rest d8"), f(10, "bardic-inspiration-d10", "Bardic Inspiration d10"), f(10, "expertise-10", "Expertise", true, "skill", { choices: 2 }), f(10, "magical-secrets-10", "Magical Secrets", true, "spell", { choices: 2 }),
      asi(12), f(13, "song-of-rest-d10", "Song of Rest d10"), f(14, "magical-secrets-14", "Magical Secrets", true, "spell", { choices: 2 }), f(14, "subclass-14", "College Feature"),
      f(15, "bardic-inspiration-d12", "Bardic Inspiration d12"), asi(16), f(17, "song-of-rest-d12", "Song of Rest d12"), f(18, "magical-secrets-18", "Magical Secrets", true, "spell", { choices: 2 }),
      asi(19), f(20, "superior-inspiration", "Superior Inspiration"),
    ],
  }),

  cleric: cls({
    profileId: "dnd5e-2014", id: "cleric", displayName: "Cleric",
    traits: {
      primaryAbilities: ["wis"], hitDie: 8, saveProficiencies: ["wis", "cha"], skillChoices: { count: 2, options: ["history", "insight", "medicine", "persuasion", "religion"] },
      weaponProficiencies: ["simple"], armorTraining: ["light", "medium", "shields"],
    },
    multiclassPrerequisites: [{ ability: "wis", minimum: 13 }], multiclassGrant: { hitDie: true, armorTraining: ["light", "medium", "shields"] },
    spellcasting: { mode: "full", ability: "wis", startsAtClassLevel: 1, preparationModel: "prepared-list", ritualModel: "prepared-only" },
    subclassLevels: [1, 2, 6, 8, 17], publicCoreSubclassId: "life-domain",
    features: [
      f(1, "spellcasting", "Spellcasting", true, "spell"), f(1, "subclass", "Divine Domain", true, "subclass"),
      f(2, "channel-divinity-1", "Channel Divinity 1/rest"), f(2, "subclass-2", "Domain Feature"),
      asi(4), f(5, "destroy-undead-1-2", "Destroy Undead CR 1/2"), f(6, "channel-divinity-2", "Channel Divinity 2/rest"), f(6, "subclass-6", "Domain Feature"),
      asi(8), f(8, "destroy-undead-1", "Destroy Undead CR 1"), f(8, "subclass-8", "Domain Feature"), f(10, "divine-intervention", "Divine Intervention"),
      f(11, "destroy-undead-2", "Destroy Undead CR 2"), asi(12), f(14, "destroy-undead-3", "Destroy Undead CR 3"), asi(16),
      f(17, "destroy-undead-4", "Destroy Undead CR 4"), f(17, "subclass-17", "Domain Feature"), f(18, "channel-divinity-3", "Channel Divinity 3/rest"), asi(19), f(20, "divine-intervention-improvement", "Divine Intervention Improvement"),
    ],
  }),

  druid: cls({
    profileId: "dnd5e-2014", id: "druid", displayName: "Druid",
    traits: {
      primaryAbilities: ["wis"], hitDie: 8, saveProficiencies: ["int", "wis"], skillChoices: { count: 2, options: ["arcana", "animal-handling", "insight", "medicine", "nature", "perception", "religion", "survival"] },
      weaponProficiencies: ["club", "dagger", "dart", "javelin", "mace", "quarterstaff", "scimitar", "sickle", "sling", "spear"],
      armorTraining: ["light", "medium", "shields", "nonmetal-restriction"], toolProficiencies: ["herbalism-kit"],
    },
    multiclassPrerequisites: [{ ability: "wis", minimum: 13 }], multiclassGrant: { hitDie: true, armorTraining: ["light", "medium", "shields-nonmetal"] },
    spellcasting: { mode: "full", ability: "wis", startsAtClassLevel: 1, preparationModel: "prepared-list", ritualModel: "prepared-only" },
    subclassLevels: [2, 6, 10, 14], publicCoreSubclassId: "circle-of-the-land",
    features: [
      f(1, "druidic", "Druidic"), f(1, "spellcasting", "Spellcasting", true, "spell"),
      f(2, "wild-shape", "Wild Shape", false, undefined, { uses: 2, refresh: "short-or-long-rest" }), f(2, "subclass", "Druid Circle", true, "subclass"),
      asi(4), f(4, "wild-shape-improvement", "Wild Shape Improvement"), f(6, "subclass-6", "Circle Feature"), f(8, "wild-shape-improvement-8", "Wild Shape Improvement"), asi(8),
      f(10, "subclass-10", "Circle Feature"), asi(12), f(14, "subclass-14", "Circle Feature"), asi(16), f(18, "timeless-body", "Timeless Body"), f(18, "beast-spells", "Beast Spells"), asi(19), f(20, "archdruid", "Archdruid"),
    ],
  }),

  fighter: cls({
    profileId: "dnd5e-2014", id: "fighter", displayName: "Fighter",
    traits: {
      primaryAbilities: ["str", "dex"], hitDie: 10, saveProficiencies: ["str", "con"],
      skillChoices: { count: 2, options: ["acrobatics", "animal-handling", "athletics", "history", "insight", "intimidation", "perception", "survival"] },
      weaponProficiencies: ["simple", "martial"], armorTraining: ["all-armor", "shields"],
    },
    multiclassPrerequisites: [{ either: [{ ability: "str", minimum: 13 }, { ability: "dex", minimum: 13 }] }],
    multiclassGrant: { hitDie: true, weaponProficiencies: ["simple", "martial"], armorTraining: ["light", "medium", "shields"] },
    subclassLevels: [3, 7, 10, 15, 18], publicCoreSubclassId: "champion",
    features: [
      f(1, "fighting-style", "Fighting Style", true, "fighting-style"), f(1, "second-wind", "Second Wind", false, undefined, { uses: 1, refresh: "short-or-long-rest" }),
      f(2, "action-surge-1", "Action Surge", false, undefined, { uses: 1, refresh: "short-or-long-rest" }), f(3, "subclass", "Martial Archetype", true, "subclass"),
      asi(4), f(5, "extra-attack-1", "Extra Attack", false, undefined, { attacks: 2 }), asi(6), f(7, "subclass-7", "Archetype Feature"), asi(8), f(9, "indomitable-1", "Indomitable", false, undefined, { uses: 1 }),
      f(10, "subclass-10", "Archetype Feature"), f(11, "extra-attack-2", "Extra Attack (2)", false, undefined, { attacks: 3 }), asi(12), f(13, "indomitable-2", "Indomitable 2", false, undefined, { uses: 2 }), asi(14),
      f(15, "subclass-15", "Archetype Feature"), asi(16), f(17, "action-surge-2", "Action Surge 2", false, undefined, { uses: 2 }), f(17, "indomitable-3", "Indomitable 3", false, undefined, { uses: 3 }),
      f(18, "subclass-18", "Archetype Feature"), asi(19), f(20, "extra-attack-3", "Extra Attack (3)", false, undefined, { attacks: 4 }),
    ],
  }),

  monk: cls({
    profileId: "dnd5e-2014", id: "monk", displayName: "Monk",
    traits: {
      primaryAbilities: ["dex", "wis"], hitDie: 8, saveProficiencies: ["str", "dex"],
      skillChoices: { count: 2, options: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"] },
      weaponProficiencies: ["simple", "shortsword"], armorTraining: [], toolChoice: { count: 1, options: "source-registry" },
    },
    multiclassPrerequisites: [{ ability: "dex", minimum: 13 }, { ability: "wis", minimum: 13 }], multiclassGrant: { hitDie: true },
    subclassLevels: [3, 6, 11, 17], publicCoreSubclassId: "way-of-the-open-hand",
    features: [
      f(1, "unarmored-defense", "Unarmored Defense", false, undefined, { formula: "10+dex+wis" }), f(1, "martial-arts", "Martial Arts", false, undefined, { die: "d4" }),
      f(2, "ki", "Ki", false, undefined, { points: "monk-level", saveDc: "8+wis+pb", refresh: "short-or-long-rest-with-meditation" }), f(2, "unarmored-movement", "Unarmored Movement", false, undefined, { bonusFt: 10 }),
      f(3, "deflect-missiles", "Deflect Missiles"), f(3, "subclass", "Monastic Tradition", true, "subclass"), f(4, "slow-fall", "Slow Fall"), asi(4),
      f(5, "extra-attack", "Extra Attack", false, undefined, { attacks: 2, martialArtsDie: "d6" }), f(5, "stunning-strike", "Stunning Strike"), f(6, "ki-empowered-strikes", "Ki-Empowered Strikes"), f(6, "subclass-6", "Tradition Feature"),
      f(7, "evasion", "Evasion"), f(7, "stillness-of-mind", "Stillness of Mind"), asi(8), f(9, "unarmored-movement-improvement", "Unarmored Movement Improvement"),
      f(10, "purity-of-body", "Purity of Body"), f(11, "subclass-11", "Tradition Feature", false, undefined, { martialArtsDie: "d8" }), asi(12), f(13, "tongue-sun-moon", "Tongue of the Sun and Moon"),
      f(14, "diamond-soul", "Diamond Soul"), f(15, "timeless-body", "Timeless Body"), asi(16), f(17, "subclass-17", "Tradition Feature", false, undefined, { martialArtsDie: "d10" }),
      f(18, "empty-body", "Empty Body"), asi(19), f(20, "perfect-self", "Perfect Self"),
    ],
  }),

  paladin: cls({
    profileId: "dnd5e-2014", id: "paladin", displayName: "Paladin",
    traits: {
      primaryAbilities: ["str", "cha"], hitDie: 10, saveProficiencies: ["wis", "cha"], skillChoices: { count: 2, options: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"] },
      weaponProficiencies: ["simple", "martial"], armorTraining: ["all-armor", "shields"],
    },
    multiclassPrerequisites: [{ ability: "str", minimum: 13 }, { ability: "cha", minimum: 13 }],
    multiclassGrant: { hitDie: true, weaponProficiencies: ["simple", "martial"], armorTraining: ["light", "medium", "shields"] },
    spellcasting: { mode: "half", ability: "cha", startsAtClassLevel: 2, preparationModel: "prepared-list" },
    subclassLevels: [3, 7, 15, 20], publicCoreSubclassId: "oath-of-devotion",
    features: [
      f(1, "divine-sense", "Divine Sense"), f(1, "lay-on-hands", "Lay on Hands", false, undefined, { poolPerPaladinLevel: 5 }),
      f(2, "fighting-style", "Fighting Style", true, "fighting-style"), f(2, "spellcasting", "Spellcasting", true, "spell"), f(2, "divine-smite", "Divine Smite"),
      f(3, "divine-health", "Divine Health"), f(3, "subclass", "Sacred Oath", true, "subclass"), asi(4), f(5, "extra-attack", "Extra Attack", false, undefined, { attacks: 2 }),
      f(6, "aura-of-protection", "Aura of Protection"), f(7, "subclass-7", "Oath Feature"), asi(8), f(10, "aura-of-courage", "Aura of Courage"), f(11, "improved-divine-smite", "Improved Divine Smite"),
      asi(12), f(14, "cleansing-touch", "Cleansing Touch"), f(15, "subclass-15", "Oath Feature"), asi(16), f(18, "aura-improvements", "Aura Improvements"), asi(19), f(20, "subclass-20", "Oath Feature"),
    ],
  }),

  ranger: cls({
    profileId: "dnd5e-2014", id: "ranger", displayName: "Ranger",
    traits: {
      primaryAbilities: ["dex", "wis"], hitDie: 10, saveProficiencies: ["str", "dex"], skillChoices: { count: 3, options: ["animal-handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"] },
      weaponProficiencies: ["simple", "martial"], armorTraining: ["light", "medium", "shields"],
    },
    multiclassPrerequisites: [{ ability: "dex", minimum: 13 }, { ability: "wis", minimum: 13 }],
    multiclassGrant: { hitDie: true, weaponProficiencies: ["simple", "martial"], armorTraining: ["light", "medium", "shields"], skillChoice: { count: 1, options: "class-list" } },
    spellcasting: { mode: "half", ability: "wis", startsAtClassLevel: 2, preparationModel: "known-list" },
    subclassLevels: [3, 7, 11, 15], publicCoreSubclassId: "hunter",
    features: [
      f(1, "favored-enemy", "Favored Enemy", true, "other"), f(1, "natural-explorer", "Natural Explorer", true, "other"),
      f(2, "fighting-style", "Fighting Style", true, "fighting-style"), f(2, "spellcasting", "Spellcasting", true, "spell"), f(3, "ranger-archetype", "Ranger Archetype", true, "subclass"), f(3, "primeval-awareness", "Primeval Awareness"),
      asi(4), f(5, "extra-attack", "Extra Attack", false, undefined, { attacks: 2 }), f(6, "favored-enemy-improvement", "Favored Enemy Improvement", true, "other"), f(6, "natural-explorer-improvement", "Natural Explorer Improvement", true, "other"),
      f(7, "subclass-7", "Archetype Feature"), f(8, "lands-stride", "Land's Stride"), asi(8), f(10, "natural-explorer-improvement-10", "Natural Explorer Improvement", true, "other"), f(10, "hide-in-plain-sight", "Hide in Plain Sight"),
      f(11, "subclass-11", "Archetype Feature"), asi(12), f(14, "favored-enemy-improvement-14", "Favored Enemy Improvement", true, "other"), f(14, "vanish", "Vanish"), f(15, "subclass-15", "Archetype Feature"),
      asi(16), f(18, "feral-senses", "Feral Senses"), asi(19), f(20, "foe-slayer", "Foe Slayer"),
    ],
  }),

  rogue: cls({
    profileId: "dnd5e-2014", id: "rogue", displayName: "Rogue",
    traits: {
      primaryAbilities: ["dex"], hitDie: 8, saveProficiencies: ["dex", "int"],
      skillChoices: { count: 4, options: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight-of-hand", "stealth"] },
      weaponProficiencies: ["simple", "hand-crossbow", "longsword", "rapier", "shortsword"], armorTraining: ["light"], toolProficiencies: ["thieves-tools"],
    },
    multiclassPrerequisites: [{ ability: "dex", minimum: 13 }], multiclassGrant: { hitDie: true, armorTraining: ["light"], toolProficiencies: ["thieves-tools"], skillChoice: { count: 1, options: "class-list" } },
    subclassLevels: [3, 9, 13, 17], publicCoreSubclassId: "thief",
    features: [
      f(1, "expertise", "Expertise", true, "skill", { choices: 2 }), f(1, "sneak-attack", "Sneak Attack", false, undefined, { dice: "1d6" }), f(1, "thieves-cant", "Thieves' Cant"),
      f(2, "cunning-action", "Cunning Action"), f(3, "subclass", "Roguish Archetype", true, "subclass", { sneakAttack: "2d6" }), asi(4), f(5, "uncanny-dodge", "Uncanny Dodge", false, undefined, { sneakAttack: "3d6" }),
      f(6, "expertise-6", "Expertise", true, "skill", { choices: 2 }), f(7, "evasion", "Evasion", false, undefined, { sneakAttack: "4d6" }), asi(8), f(9, "subclass-9", "Archetype Feature", false, undefined, { sneakAttack: "5d6" }),
      asi(10), f(11, "reliable-talent", "Reliable Talent", false, undefined, { sneakAttack: "6d6" }), asi(12), f(13, "subclass-13", "Archetype Feature", false, undefined, { sneakAttack: "7d6" }),
      f(14, "blindsense", "Blindsense"), f(15, "slippery-mind", "Slippery Mind", false, undefined, { sneakAttack: "8d6" }), asi(16), f(17, "subclass-17", "Archetype Feature", false, undefined, { sneakAttack: "9d6" }),
      f(18, "elusive", "Elusive"), asi(19), f(19, "sneak-attack-10", "Sneak Attack 10d6", false, undefined, { sneakAttack: "10d6" }), f(20, "stroke-of-luck", "Stroke of Luck"),
    ],
  }),

  sorcerer: cls({
    profileId: "dnd5e-2014", id: "sorcerer", displayName: "Sorcerer",
    traits: {
      primaryAbilities: ["cha"], hitDie: 6, saveProficiencies: ["con", "cha"], skillChoices: { count: 2, options: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"] },
      weaponProficiencies: ["dagger", "dart", "sling", "quarterstaff", "light-crossbow"], armorTraining: [],
    },
    multiclassPrerequisites: [{ ability: "cha", minimum: 13 }], multiclassGrant: { hitDie: true },
    spellcasting: { mode: "full", ability: "cha", startsAtClassLevel: 1, preparationModel: "known-list" },
    subclassLevels: [1, 6, 14, 18], publicCoreSubclassId: "draconic-bloodline",
    features: [
      f(1, "spellcasting", "Spellcasting", true, "spell"), f(1, "subclass", "Sorcerous Origin", true, "subclass"),
      f(2, "font-of-magic", "Font of Magic", false, undefined, { sorceryPoints: 2 }), f(3, "metamagic", "Metamagic", true, "metamagic", { choices: 2 }), asi(4), f(6, "subclass-6", "Origin Feature"),
      asi(8), f(10, "metamagic-10", "Metamagic", true, "metamagic", { extraChoices: 1 }), asi(12), f(14, "subclass-14", "Origin Feature"), asi(16), f(17, "metamagic-17", "Metamagic", true, "metamagic", { extraChoices: 1 }),
      f(18, "subclass-18", "Origin Feature"), asi(19), f(20, "sorcerous-restoration", "Sorcerous Restoration"),
    ],
  }),

  warlock: cls({
    profileId: "dnd5e-2014", id: "warlock", displayName: "Warlock",
    traits: {
      primaryAbilities: ["cha"], hitDie: 8, saveProficiencies: ["wis", "cha"], skillChoices: { count: 2, options: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"] },
      weaponProficiencies: ["simple"], armorTraining: ["light"],
    },
    multiclassPrerequisites: [{ ability: "cha", minimum: 13 }], multiclassGrant: { hitDie: true, weaponProficiencies: ["simple"], armorTraining: ["light"] },
    spellcasting: { mode: "pact", ability: "cha", startsAtClassLevel: 1, preparationModel: "known-list" },
    subclassLevels: [1, 6, 10, 14], publicCoreSubclassId: "fiend-patron",
    features: [
      f(1, "subclass", "Otherworldly Patron", true, "subclass"), f(1, "pact-magic", "Pact Magic", true, "spell"),
      f(2, "eldritch-invocations", "Eldritch Invocations", true, "invocation", { choices: 2 }), f(3, "pact-boon", "Pact Boon", true, "other"), asi(4), f(5, "eldritch-invocations-3", "Eldritch Invocations 3", true, "invocation"),
      f(6, "subclass-6", "Patron Feature"), f(7, "eldritch-invocations-4", "Eldritch Invocations 4", true, "invocation"), asi(8), f(9, "eldritch-invocations-5", "Eldritch Invocations 5", true, "invocation"),
      f(10, "subclass-10", "Patron Feature"), f(11, "mystic-arcanum-6", "Mystic Arcanum (6th)", true, "spell"), asi(12), f(13, "mystic-arcanum-7", "Mystic Arcanum (7th)", true, "spell"),
      f(14, "subclass-14", "Patron Feature"), f(15, "mystic-arcanum-8", "Mystic Arcanum (8th)", true, "spell"), f(15, "eldritch-invocations-7", "Eldritch Invocations 7", true, "invocation"),
      asi(16), f(17, "mystic-arcanum-9", "Mystic Arcanum (9th)", true, "spell"), f(18, "eldritch-invocations-8", "Eldritch Invocations 8", true, "invocation"), asi(19), f(20, "eldritch-master", "Eldritch Master"),
    ],
  }),

  wizard: cls({
    profileId: "dnd5e-2014", id: "wizard", displayName: "Wizard",
    traits: {
      primaryAbilities: ["int"], hitDie: 6, saveProficiencies: ["int", "wis"], skillChoices: { count: 2, options: ["arcana", "history", "insight", "investigation", "medicine", "religion"] },
      weaponProficiencies: ["dagger", "dart", "sling", "quarterstaff", "light-crossbow"], armorTraining: [],
    },
    multiclassPrerequisites: [{ ability: "int", minimum: 13 }], multiclassGrant: { hitDie: true },
    spellcasting: { mode: "full", ability: "int", startsAtClassLevel: 1, preparationModel: "spellbook", ritualModel: "spellbook" },
    subclassLevels: [2, 6, 10, 14], publicCoreSubclassId: "school-of-evocation",
    features: [
      f(1, "spellcasting", "Spellcasting", true, "spell"), f(1, "arcane-recovery", "Arcane Recovery"), f(2, "subclass", "Arcane Tradition", true, "subclass"),
      asi(4), f(6, "subclass-6", "Tradition Feature"), asi(8), f(10, "subclass-10", "Tradition Feature"), asi(12), f(14, "subclass-14", "Tradition Feature"),
      asi(16), f(18, "spell-mastery", "Spell Mastery", true, "spell"), asi(19), f(20, "signature-spells", "Signature Spells", true, "spell"),
    ],
  }),
};

export function get2014Class(id: string): Dnd5eClassDefinition | undefined {
  return DND5E_2014_CLASSES[id];
}
