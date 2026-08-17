import {
  DEFAULT_CHARACTER_SCOPE,
  DEFAULT_CHARACTER_SYSTEM,
  type DefaultCharacterPreset,
} from "./default-characters";

/**
 * Sorcerer counterpart to the original ten D&D 3.5e starter presets.
 * Kept as a separate module so the initial preset file remains stable while
 * the catalogue can grow without turning one file into a small rules landfill.
 */
export const DEFAULT_SORCERER: DefaultCharacterPreset = {
  id: "neris-tallow-sorcerer",
  system: DEFAULT_CHARACTER_SYSTEM,
  sourceScope: DEFAULT_CHARACTER_SCOPE,
  name: "Neris Tallow",
  race: "Half-Elf",
  charClass: "Sorcerer",
  role: "Spontaneous arcane caster focused on flexible repeat casting and social utility",
  alignment: "Chaotic Good",
  level: 1,
  hp: 5,
  maxHp: 5,
  speed: 30,
  attacksPerRound: 1,
  armorClass: 12,
  initiative: 2,
  baseAttackBonus: 0,
  abilityScores: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
  saves: { fort: 1, ref: 2, will: 2 },
  feats: ["Combat Casting"],
  racialTraits: [
    "Low-light vision",
    "Immunity to magical sleep and +2 racial bonus on saves against enchantment spells or effects",
    "+1 racial bonus on Listen, Search, and Spot",
    "+2 racial bonus on Diplomacy and Gather Information",
    "Elven blood",
  ],
  classFeatures: [
    "Spontaneous arcane spellcasting: cast any known spell of an available level without preparing it ahead of time",
    "Summon Familiar",
    "Simple weapon proficiency and no armour proficiency",
  ],
  skills: [
    "Concentration 4 ranks",
    "Spellcraft 4 ranks",
    "Bluff 4 ranks",
  ],
  spellcasting: {
    ability: "cha",
    notes: "At Sorcerer 1, Neris knows four 0-level spells and two 1st-level spells. Charisma 15 grants one bonus 1st-level spell slot, for four 1st-level spells per day total under the normal 3.5e sorcerer table. Unlike a wizard, Neris does not prepare individual spells before adventuring; any known spell can be cast using an available slot of the appropriate level.",
    cantrips: ["Detect Magic", "Mage Hand", "Prestidigitation", "Acid Splash"],
    levelOneSpells: ["Mage Armor", "Magic Missile"],
  },
  companion: "Thimble, a cat familiar",
  combatNotes: [
    "Unarmoured AC is 12 from Dexterity. Mage Armor raises AC to 16 while it lasts.",
    "Magic Missile is the reliable level-1 combat spell because it does not require an attack roll and has no saving throw; conserve slots when mundane weapons will do.",
    "The sorcerer's advantage over the wizard is flexible spontaneous casting, not a larger spell list. Do not let Neris cast spells that are not actually known.",
    "Arcane spell failure from armour matters if Neris later wears armour, even if some other source grants proficiency.",
  ],
  traits: "Warm, irreverent, and unnervingly calm when magic misbehaves. Neris treats supernatural accidents like kitchen spills: identify what is burning, move anything valuable, then decide whether screaming would contribute anything.",
  backstory: "Neris grew up helping in a candle-maker's shop where strange little effects followed strong emotions: flames leaning toward whispered arguments, wax cooling into symbols nobody carved, and once an entire shelf relighting itself after closing. A travelling mage offered to test whether Neris had studied sorcery. Neris pointed out that studying was rather clearly not the problem. After a warehouse fire that was technically only half magical, travelling became the sensible option.",
  startingItems: [
    {
      name: "Light Crossbow",
      description: "A simple ranged weapon for conserving spell slots when magic would be excessive.",
      itemType: "weapon",
      equipped: true,
      locationNote: "Hand or pack",
    },
    {
      name: "Crossbow Bolt",
      description: "Bolts for the light crossbow.",
      itemType: "weapon",
      quantity: 20,
      locationNote: "Bolt case",
    },
    {
      name: "Dagger",
      description: "A plain utility dagger that doubles as an emergency weapon.",
      itemType: "weapon",
      locationNote: "Belt sheath",
    },
    {
      name: "Spell Component Pouch",
      description: "Mundane material components and focuses used for arcane spellcasting.",
      itemType: "gear",
      equipped: true,
      locationNote: "Belt",
    },
    {
      name: "Charcoal-Stained Scarf",
      description: "A singed travelling scarf from Neris's former candle shop. It has no magical properties despite several confident rumours.",
      itemType: "gear",
      locationNote: "Worn",
    },
  ],
  progressionGuide: [
    "Levels 2-3: continue Sorcerer and add spells known only according to the normal 3.5e sorcerer progression. Present new-spell choices to the player because known-spell selection is a lasting build decision.",
    "Level 3: choose the normal character feat with the player. Improved Initiative, Spell Focus for a chosen school, or a metamagic feat are reasonable core directions depending on how Neris is being played.",
    "Level 4: Charisma is the default ability-score increase, bringing it to 16. Sorcerers gain access to 2nd-level spells at this level, so the first 2nd-level spell known should always be a player-facing choice.",
    "Levels 5-10: preserve the spontaneous-caster identity. Sorcerers gain new spell levels later than wizards but can cast known spells more freely; never compensate by inventing extra spells known.",
    "Levels 11-20: keep full Sorcerer casting progression by default and treat every spell-known addition or legal spell replacement as an explicit player choice.",
  ],
  higherLevelChoices: [
    "spells known",
    "legal spell replacements",
    "general feats",
    "metamagic direction",
    "ability-score increases",
    "familiar changes if permitted",
    "multiclassing only if requested",
  ],
};
