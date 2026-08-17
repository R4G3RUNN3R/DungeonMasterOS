export const DEFAULT_CHARACTER_SYSTEM = "D&D 3.5e" as const;
export const DEFAULT_CHARACTER_SCOPE = "PHB/SRD core" as const;

export type CoreAbility = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type AbilityScores = Record<CoreAbility, number>;

export type SavingThrows = {
  fort: number;
  ref: number;
  will: number;
};

export type DefaultStartingItem = {
  name: string;
  description: string;
  itemType: "weapon" | "armor" | "consumable" | "gear" | "tool" | "magic" | "misc";
  quantity?: number;
  equipped?: boolean;
  consumable?: boolean;
  locationNote?: string;
};

export type DefaultSpellcasting = {
  ability: "int" | "wis" | "cha";
  notes: string;
  cantrips?: string[];
  levelOneSpells?: string[];
  spellbook?: string[];
};

export type DefaultCharacterPreset = {
  id: string;
  system: typeof DEFAULT_CHARACTER_SYSTEM;
  sourceScope: typeof DEFAULT_CHARACTER_SCOPE;
  name: string;
  race: string;
  charClass: string;
  role: string;
  alignment: string;
  level: 1;
  hp: number;
  maxHp: number;
  speed: number;
  attacksPerRound: number;
  armorClass: number;
  initiative: number;
  baseAttackBonus: number;
  abilityScores: AbilityScores;
  saves: SavingThrows;
  feats: string[];
  racialTraits: string[];
  classFeatures: string[];
  skills: string[];
  spellcasting?: DefaultSpellcasting;
  companion?: string;
  combatNotes: string[];
  traits: string;
  backstory: string;
  startingItems: DefaultStartingItem[];
  progressionGuide: string[];
  higherLevelChoices: string[];
};

const p = (character: DefaultCharacterPreset): DefaultCharacterPreset => character;

/**
 * Ten deliberately distinct level-1 starter characters for the initial D&D 3.5e
 * character picker. They are original characters using core PHB/SRD mechanics.
 *
 * D&D 3.5e has eleven PHB base classes. Sorcerer is the one not represented in
 * this first ten-character set because Wizard already covers a full arcane-caster
 * starter while Monk adds a mechanically different play style. A Sorcerer preset
 * can be added later without changing this data contract.
 */
export const DEFAULT_CHARACTERS: DefaultCharacterPreset[] = [
  p({
    id: "tamsin-rook-fighter",
    system: DEFAULT_CHARACTER_SYSTEM,
    sourceScope: DEFAULT_CHARACTER_SCOPE,
    name: "Tamsin Rook",
    race: "Human",
    charClass: "Fighter",
    role: "Armoured front-line weapon specialist",
    alignment: "Lawful Neutral",
    level: 1,
    hp: 12,
    maxHp: 12,
    speed: 30,
    attacksPerRound: 1,
    armorClass: 17,
    initiative: 1,
    baseAttackBonus: 1,
    abilityScores: { str: 15, dex: 13, con: 14, int: 12, wis: 10, cha: 8 },
    saves: { fort: 4, ref: 1, will: 0 },
    feats: ["Power Attack", "Cleave", "Weapon Focus (longsword)"],
    racialTraits: ["Human bonus feat", "Extra human skill points"],
    classFeatures: ["Fighter bonus feat at 1st level", "Proficient with all simple and martial weapons, all armour, and shields except tower shields"],
    skills: ["Climb 4 ranks", "Jump 4 ranks", "Ride 4 ranks"],
    combatNotes: [
      "Longsword is the primary weapon. Base melee attack before situational modifiers is +3.",
      "Power Attack trades melee accuracy for damage; Cleave can grant a follow-up attack after dropping a foe.",
      "Chain shirt and heavy wooden shield produce AC 17 while keeping a 30 ft. speed.",
    ],
    traits: "Practical, watchful, and almost impossible to impress. Tamsin checks doors, straps, exits, and other people's plans in roughly that order.",
    backstory: "Tamsin spent six years guarding river barges where an 'easy run' usually meant someone had lied about the cargo. After surviving a mutiny with nothing but a cracked shield and stubbornness, Tamsin stopped hiring onto other people's disasters and began choosing them personally.",
    startingItems: [
      { name: "Longsword", description: "A well-balanced martial blade kept meticulously sharp.", itemType: "weapon", equipped: true, locationNote: "Belt scabbard" },
      { name: "Chain Shirt", description: "Light interlocking mail offering solid protection without sacrificing mobility.", itemType: "armor", equipped: true, locationNote: "Worn" },
      { name: "Heavy Wooden Shield", description: "A broad reinforced wooden shield, scarred from prior work.", itemType: "armor", equipped: true, locationNote: "Off hand" },
      { name: "Javelin", description: "A simple throwing spear for enemies sensible enough to stay away.", itemType: "weapon", quantity: 3, locationNote: "Back sling" },
      { name: "Backpack", description: "A plain adventurer's pack for food, tools, and whatever survives the first dungeon.", itemType: "gear", locationNote: "Back" },
    ],
    progressionGuide: [
      "Level 2: continue Fighter; choose a fighter bonus feat matching the player's preferred combat style. Combat Reflexes is a clean default for this build.",
      "Level 3: choose the normal character feat; Improved Initiative is the simple all-purpose recommendation if the player has no preference.",
      "Level 4: put the ability increase into Strength by default and consider Weapon Specialization (longsword) as the fighter bonus feat.",
      "Levels 5-8: keep the longsword-and-shield identity unless the player asks to pivot; Improved Critical becomes attractive once prerequisites are met.",
      "Levels 9-20: favour feats that deepen the chosen weapon style rather than silently rebuilding Tamsin into a different archetype.",
    ],
    higherLevelChoices: ["fighter bonus feats", "general feats", "ability-score increases", "weapon specialisation direction"],
  }),

  p({
    id: "bera-nine-nails-cleric",
    system: DEFAULT_CHARACTER_SYSTEM,
    sourceScope: DEFAULT_CHARACTER_SCOPE,
    name: "Bera Nine-Nails",
    race: "Dwarf",
    charClass: "Cleric",
    role: "Armoured divine support, healing, and undead control",
    alignment: "Neutral Good",
    level: 1,
    hp: 11,
    maxHp: 11,
    speed: 20,
    attacksPerRound: 1,
    armorClass: 15,
    initiative: -1,
    baseAttackBonus: 0,
    abilityScores: { str: 13, dex: 8, con: 16, int: 10, wis: 15, cha: 10 },
    saves: { fort: 5, ref: -1, will: 4 },
    feats: ["Combat Casting"],
    racialTraits: [
      "Darkvision 60 ft.",
      "Stonecunning and stability",
      "+2 racial bonus on saves against poison",
      "+2 racial bonus on saves against spells and spell-like effects",
      "Dwarven weapon familiarity",
    ],
    classFeatures: [
      "Turn Undead 3/day",
      "Spontaneously converts prepared non-domain spells into cure spells of the same level",
      "Healing domain: healing spells are cast at +1 caster level",
      "Sun domain: greater turning 1/day",
    ],
    skills: ["Concentration 4 ranks", "Heal 4 ranks", "Knowledge (religion) 4 ranks"],
    spellcasting: {
      ability: "wis",
      notes: "At level 1 with Wisdom 15, the default preparation assumes the normal cleric slots plus the Wisdom bonus slot and one domain slot. Re-prepare after rest as the situation demands.",
      cantrips: ["Detect Magic", "Guidance", "Light"],
      levelOneSpells: ["Bless", "Shield of Faith", "Cure Light Wounds (Healing domain slot)"],
    },
    combatNotes: [
      "Bera is a support cleric first and a mace-and-shield combatant second.",
      "The listed Fortitude, Reflex, and Will values do not bake in every situational dwarf racial bonus; apply those when relevant.",
      "Scale mail, heavy wooden shield, and Dexterity -1 produce AC 15.",
    ],
    traits: "Dry, dutiful, and mildly offended by avoidable injuries. Bera keeps a private count of every person who ignored sensible advice and later requested healing.",
    backstory: "Bera served in a roadside shrine built over an older dwarven waystation. When grave robbers broke through the crypt floor and found something that stood back up, Bera discovered that temple work occasionally required a mace. The nickname came from repairing the shrine doors with nine iron spikes while the dead hammered from the other side.",
    startingItems: [
      { name: "Heavy Mace", description: "A practical iron-headed mace suitable for both armour and old bones.", itemType: "weapon", equipped: true, locationNote: "Belt loop" },
      { name: "Scale Mail", description: "Overlapping metal scales over leather backing.", itemType: "armor", equipped: true, locationNote: "Worn" },
      { name: "Heavy Wooden Shield", description: "A stout shield bearing a simple sunburst painted by hand.", itemType: "armor", equipped: true, locationNote: "Off hand" },
      { name: "Wooden Holy Symbol", description: "A small sun-marked holy symbol used as Bera's divine focus.", itemType: "gear", locationNote: "Neck cord" },
      { name: "Healer's Satchel", description: "Bandages, clean cloth, needles, and mundane supplies for injuries too boring to spend magic on.", itemType: "gear", locationNote: "Pack" },
    ],
    progressionGuide: [
      "Levels 2-3: continue Cleric. Let the player choose feats and daily prepared spells; Extra Turning or Extend Spell are sensible core directions depending on play style.",
      "Level 4: Wisdom is the default ability-score increase, bringing Wisdom to 16 and strengthening spellcasting.",
      "Levels 5-10: expand battlefield support, condition removal, divination, and anti-undead tools while preserving the Healing/Sun identity.",
      "Levels 11-20: remain a full Cleric unless the player explicitly wants multiclassing; do not trade away caster progression by accident.",
    ],
    higherLevelChoices: ["daily prepared spells", "general feats", "ability-score increases", "turn-undead feat support", "multiclassing only if requested"],
  }),

  p({
    id: "marn-vask-barbarian",
    system: DEFAULT_CHARACTER_SYSTEM,
    sourceScope: DEFAULT_CHARACTER_SCOPE,
    name: "Marn Vask",
    race: "Half-Orc",
    charClass: "Barbarian",
    role: "Fast two-handed melee bruiser",
    alignment: "Chaotic Neutral",
    level: 1,
    hp: 14,
    maxHp: 14,
    speed: 40,
    attacksPerRound: 1,
    armorClass: 14,
    initiative: 1,
    baseAttackBonus: 1,
    abilityScores: { str: 17, dex: 13, con: 14, int: 8, wis: 12, cha: 6 },
    saves: { fort: 4, ref: 1, will: 1 },
    feats: ["Power Attack"],
    racialTraits: ["Darkvision 60 ft.", "Orc blood"],
    classFeatures: [
      "Fast Movement: +10 ft. while not wearing heavy armour and not carrying a heavy load",
      "Rage 1/day: temporarily gains +4 Strength, +4 Constitution, +2 Will saves, and -2 AC",
      "Illiteracy unless literacy is gained later",
    ],
    skills: ["Climb 4 ranks", "Jump 4 ranks", "Listen 4 ranks", "Survival 4 ranks"],
    combatNotes: [
      "Greataxe is the default weapon; Power Attack is most useful when accuracy is already comfortable.",
      "Studded leather is light armour, so Marn keeps the full 40 ft. fast-movement speed.",
      "At level 1, raging raises Strength to 21 and Constitution to 18 before other effects, and lowers AC to 12 while rage lasts.",
    ],
    traits: "Quiet until a decision is needed, then alarmingly decisive. Marn hates boasting, complicated contracts, and people who mistake poor manners for poor judgment.",
    backstory: "Marn grew up loading stone at a quarry where strength was common and patience was valuable. A foreman tried to frame him for stolen payroll, expecting the half-orc to flee or start a fight. Marn instead found the real thief, returned the money, broke the foreman's desk, and decided employment was overrated.",
    startingItems: [
      { name: "Greataxe", description: "A heavy two-handed axe with a plain ash haft and no decorative nonsense.", itemType: "weapon", equipped: true, locationNote: "Hands or back loop" },
      { name: "Studded Leather", description: "Flexible leather reinforced with metal studs; light enough for fast movement.", itemType: "armor", equipped: true, locationNote: "Worn" },
      { name: "Shortbow", description: "A compact bow for problems that refuse to enter axe range.", itemType: "weapon", locationNote: "Back" },
      { name: "Arrow", description: "Standard arrows for the shortbow.", itemType: "weapon", quantity: 20, locationNote: "Quiver" },
      { name: "Whetstone", description: "A small stone for maintaining the greataxe edge.", itemType: "gear", locationNote: "Belt pouch" },
    ],
    progressionGuide: [
      "Level 2: continue Barbarian for Uncanny Dodge.",
      "Level 3: Cleave is the default general feat if the player wants to lean into heavy melee; otherwise ask before choosing.",
      "Level 4: Strength is the default ability-score increase; Rage also improves with additional daily use as the class advances.",
      "Levels 5-10: preserve the mobile two-handed bruiser identity and add core feats that reward high Strength and full base attack bonus.",
      "Levels 11-20: continue Barbarian by default, improving rage and damage reduction rather than silently converting Marn into a different build.",
    ],
    higherLevelChoices: ["general feats", "ability-score increases", "weapon direction", "multiclassing only if requested"],
  }),

  p({
    id: "della-quince-bard",
    system: DEFAULT_CHARACTER_SYSTEM,
    sourceScope: DEFAULT_CHARACTER_SCOPE,
    name: "Della Quince",
    race: "Half-Elf",
    charClass: "Bard",
    role: "Face, support caster, knowledge broker, and skill specialist",
    alignment: "Chaotic Good",
    level: 1,
    hp: 7,
    maxHp: 7,
    speed: 30,
    attacksPerRound: 1,
    armorClass: 14,
    initiative: 2,
    baseAttackBonus: 0,
    abilityScores: { str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 15 },
    saves: { fort: 1, ref: 4, will: 2 },
    feats: ["Skill Focus (Perform [oratory])"],
    racialTraits: [
      "Low-light vision",
      "Immunity to magical sleep and +2 racial bonus on saves against enchantment spells or effects",
      "+1 racial bonus on Listen, Search, and Spot",
      "+2 racial bonus on Diplomacy and Gather Information",
      "Elven blood",
    ],
    classFeatures: [
      "Bardic Music 1/day",
      "Inspire Courage +1",
      "Countersong",
      "Fascinate",
      "Bardic Knowledge +2 before situational modifiers",
    ],
    skills: [
      "Perform (oratory) 4 ranks; +9 with Charisma and Skill Focus",
      "Diplomacy 4 ranks",
      "Bluff 4 ranks",
      "Use Magic Device 4 ranks",
      "Tumble 4 ranks",
      "Spellcraft 4 ranks",
      "Gather Information 4 ranks",
    ],
    spellcasting: {
      ability: "cha",
      notes: "Della knows four 0-level spells and two 1st-level spells. At Bard 1 the base table grants no 1st-level spell slot, but Charisma 15 supplies a bonus 1st-level slot, so Della can cast one 1st-level spell per day before other effects.",
      cantrips: ["Detect Magic", "Ghost Sound", "Light", "Prestidigitation"],
      levelOneSpells: ["Cure Light Wounds", "Sleep"],
    },
    combatNotes: [
      "Open difficult fights with Inspire Courage when the party will benefit from the buff for several rounds.",
      "Rapier and shortbow are backup tools; Della's main value is control, support, social leverage, and broad skills.",
      "Leather armour does not interfere with bard spells in the same way heavier armour would.",
    ],
    traits: "Curious, sociable, and shameless about asking the question everyone else is pretending not to have. Della collects rumours the way other people collect coins, except rumours are lighter and cause more trouble.",
    backstory: "Della once made a living announcing cargo auctions, marriages, duels, funerals, and one extremely disputed goat race. A noble's clerk tried to pay her to alter a public proclamation; she read the bribe aloud instead. The resulting chase convinced her that travelling audiences are safer than permanent employers.",
    startingItems: [
      { name: "Rapier", description: "A narrow thrusting sword carried more for emergencies than heroics.", itemType: "weapon", equipped: true, locationNote: "Belt scabbard" },
      { name: "Leather Armour", description: "Supple light armour suitable for a bard who expects to move and cast.", itemType: "armor", equipped: true, locationNote: "Worn" },
      { name: "Shortbow", description: "A light bow for contributing from behind sturdier people.", itemType: "weapon", locationNote: "Back" },
      { name: "Arrow", description: "Standard arrows for the shortbow.", itemType: "weapon", quantity: 20, locationNote: "Quiver" },
      { name: "Handbell and Speaking Cards", description: "A small bell and a battered stack of prompt cards used for performances, announcements, and distractions.", itemType: "gear", locationNote: "Satchel" },
    ],
    progressionGuide: [
      "Levels 2-3: continue Bard, expanding spells known and bardic music. At level 3, ask whether the player wants social, mobility, archery, or spell-focused feat support before choosing the normal feat.",
      "Level 4: Charisma is the default ability-score increase, bringing it to 16.",
      "Levels 5-10: prefer support, enchantment, illusion, utility, and social spells unless the player pushes Della toward a different specialty.",
      "Levels 11-20: keep full Bard spell and music progression by default; never replace known spells or choose permanent spell swaps without telling the player.",
    ],
    higherLevelChoices: ["spells known", "spell swaps", "general feats", "ability-score increases", "skill ranks"],
  }),

  p({
    id: "tobbin-mosskettle-druid",
    system: DEFAULT_CHARACTER_SYSTEM,
    sourceScope: DEFAULT_CHARACTER_SCOPE,
    name: "Tobbin Mosskettle",
    race: "Gnome",
    charClass: "Druid",
    role: "Battlefield control, wilderness utility, healing, and animal companion",
    alignment: "Neutral",
    level: 1,
    hp: 11,
    maxHp: 11,
    speed: 20,
    attacksPerRound: 1,
    armorClass: 15,
    initiative: 1,
    baseAttackBonus: 0,
    abilityScores: { str: 6, dex: 13, con: 16, int: 12, wis: 15, cha: 10 },
    saves: { fort: 5, ref: 1, will: 4 },
    feats: ["Spell Focus (Conjuration)"],
    racialTraits: [
      "Small size: +1 AC and +1 attack bonus, plus the usual Small-creature modifiers",
      "Low-light vision",
      "+2 racial bonus on saves against illusions",
      "+1 to the save DC of illusion spells cast",
      "Gnome spell-like abilities when Charisma requirements are met",
    ],
    classFeatures: ["Animal Companion", "Nature Sense", "Wild Empathy"],
    skills: ["Concentration 4 ranks", "Handle Animal 4 ranks", "Knowledge (nature) 4 ranks", "Survival 4 ranks", "Listen 4 ranks"],
    spellcasting: {
      ability: "wis",
      notes: "The default level-1 preparation uses the base druid slots plus the Wisdom 15 bonus 1st-level slot. Druids prepare from the full druid list available to them, so these choices can be changed after rest.",
      cantrips: ["Detect Magic", "Guidance", "Know Direction"],
      levelOneSpells: ["Entangle", "Obscuring Mist"],
    },
    companion: "Bracken, a wolf animal companion",
    combatNotes: [
      "Entangle is the default encounter-control spell when terrain allows it; Obscuring Mist is the escape and sight-line tool.",
      "Leather armour and a light wooden shield are non-metal gear and keep Tobbin within normal druid restrictions.",
      "AC 15 includes Dexterity, Small size, leather armour, and the light wooden shield.",
    ],
    traits: "Patient with animals, suspicious of architecture, and fascinated by anything that grows where it plainly should not. Tobbin speaks softly until someone damages a living tree for convenience.",
    backstory: "Tobbin was raised among orchard keepers who treated weather, wolves, and tax collectors as equally natural hazards. He left after tracing a sickness in the roots to waste dumped by a nearby alchemist. The alchemist moved; the orchard recovered; Tobbin discovered travelling solved more problems than complaining at village meetings.",
    startingItems: [
      { name: "Scimitar", description: "A curved druid-proficient blade sized for a gnome.", itemType: "weapon", equipped: true, locationNote: "Belt sheath" },
      { name: "Leather Armour", description: "Non-metal light armour made from treated hide.", itemType: "armor", equipped: true, locationNote: "Worn" },
      { name: "Light Wooden Shield", description: "A small wooden shield that avoids the druid taboo on metal armour.", itemType: "armor", equipped: true, locationNote: "Off hand" },
      { name: "Sling", description: "A simple ranged weapon well suited to a small traveller.", itemType: "weapon", locationNote: "Belt" },
      { name: "Sling Bullet", description: "Smooth lead sling ammunition.", itemType: "weapon", quantity: 10, locationNote: "Pouch" },
      { name: "Holly and Mistletoe", description: "Natural divine focus used for druid spellcasting.", itemType: "gear", locationNote: "Herb pouch" },
    ],
    progressionGuide: [
      "Levels 2-3: continue Druid. Augment Summoning is the default level-3 feat because Spell Focus (Conjuration) already satisfies its prerequisite.",
      "Level 4: Wisdom is the default ability-score increase.",
      "Level 5: Wild Shape comes online; explain its rules and let the player choose preferred forms rather than assuming one permanent tactic.",
      "Levels 6-10: keep full Druid spellcasting and animal-companion progression while broadening summoning, control, healing, and shapechanging options.",
      "Levels 11-20: preserve full caster progression unless the player explicitly requests multiclassing.",
    ],
    higherLevelChoices: ["daily prepared spells", "general feats", "ability-score increases", "wild-shape tactics", "animal companion changes"],
  }),

  p({
    id: "corva-pell-monk",
    system: DEFAULT_CHARACTER_SYSTEM,
    sourceScope: DEFAULT_CHARACTER_SCOPE,
    name: "Corva Pell",
    race: "Human",
    charClass: "Monk",
    role: "Mobile unarmoured skirmisher and control fighter",
    alignment: "Lawful Neutral",
    level: 1,
    hp: 9,
    maxHp: 9,
    speed: 30,
    attacksPerRound: 1,
    armorClass: 14,
    initiative: 6,
    baseAttackBonus: 0,
    abilityScores: { str: 13, dex: 14, con: 12, int: 10, wis: 15, cha: 8 },
    saves: { fort: 3, ref: 4, will: 4 },
    feats: ["Dodge", "Improved Initiative", "Stunning Fist (monk bonus feat)"],
    racialTraits: ["Human bonus feat", "Extra human skill points"],
    classFeatures: [
      "Improved Unarmed Strike",
      "Unarmed strike damage 1d6",
      "Flurry of Blows: two attacks as a full attack at -2/-2 at Monk 1",
      "AC Bonus: Wisdom bonus applies to AC while unarmoured and unencumbered",
      "Stunning Fist 1/day at Monk 1",
    ],
    skills: ["Balance 4 ranks", "Jump 4 ranks", "Listen 4 ranks", "Tumble 4 ranks", "Spot 4 ranks"],
    combatNotes: [
      "The attacks-per-round field stays at 1 because that is Corva's normal baseline; Flurry of Blows conditionally produces two attacks during a full attack.",
      "AC 14 comes from Dexterity +2 and Wisdom +2 while unarmoured.",
      "Use Stunning Fist when denying an enemy's next turn is more valuable than saving the daily attempt.",
    ],
    traits: "Methodical, plain-spoken, and deeply unimpressed by theatrical intimidation. Corva believes most arguments improve when everyone sits down, although she is flexible about how they get there.",
    backstory: "Corva trained at a hospice-monastery that took in caravan guards too injured to work and pilgrims too broke to pay. She learned discipline from the monks and practical violence from patients who had made every possible mistake on the road. She now travels to discover which lessons survive outside controlled practice.",
    startingItems: [
      { name: "Quarterstaff", description: "A plain hardwood staff suitable for travel, defence, and leverage.", itemType: "weapon", equipped: true, locationNote: "Hand" },
      { name: "Shuriken", description: "Small thrown monk weapons carried for short-range emergencies.", itemType: "weapon", quantity: 10, locationNote: "Sleeve pouch" },
      { name: "Sling", description: "A simple ranged option for targets that refuse to cooperate with martial philosophy.", itemType: "weapon", locationNote: "Belt" },
      { name: "Traveller's Wraps", description: "Simple clothing and hand wraps; not armour.", itemType: "gear", equipped: true, locationNote: "Worn" },
    ],
    progressionGuide: [
      "Level 2: continue Monk; Evasion arrives naturally. Let the player choose the level-2 monk bonus feat rather than silently locking the build.",
      "Level 3: Fast Movement and Still Mind arrive; choose the normal level-3 feat based on whether the player wants defence, mobility, grappling, or offence.",
      "Level 4: Wisdom is the default ability-score increase; Ki Strike (magic) and Slow Fall improve the monk toolkit.",
      "Levels 5-10: preserve the mobile unarmed-control identity while explaining Flurry, special attacks, and defensive features as they appear.",
      "Levels 11-20: continue Monk by default; multiclassing can alter several monk assumptions and should only happen after the player chooses it.",
    ],
    higherLevelChoices: ["monk bonus feats", "general feats", "ability-score increases", "combat style emphasis", "multiclassing only if requested"],
  }),

  p({
    id: "hadrik-cenn-paladin",
    system: DEFAULT_CHARACTER_SYSTEM,
    sourceScope: DEFAULT_CHARACTER_SCOPE,
    name: "Hadrik Cenn",
    race: "Human",
    charClass: "Paladin",
    role: "Armoured defender with divine anti-evil tools",
    alignment: "Lawful Good",
    level: 1,
    hp: 11,
    maxHp: 11,
    speed: 20,
    attacksPerRound: 1,
    armorClass: 16,
    initiative: 0,
    baseAttackBonus: 1,
    abilityScores: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 },
    saves: { fort: 3, ref: 0, will: 1 },
    feats: ["Power Attack", "Weapon Focus (longsword)"],
    racialTraits: ["Human bonus feat", "Extra human skill points"],
    classFeatures: [
      "Aura of Good",
      "Detect Evil at will",
      "Smite Evil 1/day: add Charisma bonus to the attack roll and Paladin level to damage against a valid evil target",
      "Paladin code of conduct and alignment restrictions apply",
    ],
    skills: ["Diplomacy 4 ranks", "Ride 4 ranks"],
    combatNotes: [
      "Longsword and shield are the default stance; Power Attack is optional when extra damage matters more than accuracy.",
      "Scale mail and a heavy wooden shield produce AC 16 and reduce the normal 30 ft. human land speed to 20 ft.",
      "Do not grant Divine Grace or Lay on Hands early; both begin at Paladin 2 in 3.5e.",
    ],
    traits: "Earnest without being naive, polite without being soft, and allergic to excuses that begin with 'technically'. Hadrik would rather keep a promise the hard way than explain why breaking it was efficient.",
    backstory: "Hadrik was a courthouse runner in a town where law and justice were distant cousins who rarely visited. He exposed a magistrate selling verdicts, then spent a month protecting the same witnesses everyone else suddenly forgot. A travelling knight sponsored his training after deciding stubbornness this expensive ought to be put to useful work.",
    startingItems: [
      { name: "Longsword", description: "A serviceable knightly blade with a leather-wrapped grip.", itemType: "weapon", equipped: true, locationNote: "Belt scabbard" },
      { name: "Scale Mail", description: "Medium armour made from overlapping metal scales.", itemType: "armor", equipped: true, locationNote: "Worn" },
      { name: "Heavy Wooden Shield", description: "A reinforced wooden shield painted with a simple white line rather than heraldry.", itemType: "armor", equipped: true, locationNote: "Off hand" },
      { name: "Javelin", description: "A throwing spear for opening a fight before closing distance.", itemType: "weapon", quantity: 3, locationNote: "Back sling" },
      { name: "Wooden Holy Symbol", description: "A modest holy symbol used for prayer and later divine abilities.", itemType: "gear", locationNote: "Neck cord" },
    ],
    progressionGuide: [
      "Level 2: continue Paladin; Divine Grace and Lay on Hands come online. Apply Charisma to saves only from this level onward.",
      "Level 3: Aura of Courage and Divine Health arrive; ask the player before choosing the normal level-3 feat.",
      "Level 4: Strength is the default ability-score increase; Turn Undead and 1st-level Paladin spellcasting begin if Wisdom is sufficient.",
      "Level 5: Special Mount becomes available; ask what kind of mount relationship the player wants within core rules.",
      "Levels 6-20: preserve the defensive holy-warrior identity and core Paladin progression unless the player requests a different path.",
    ],
    higherLevelChoices: ["general feats", "ability-score increases", "daily paladin spells", "special mount", "multiclassing only if compatible and requested"],
  }),

  p({
    id: "rusk-fenner-ranger",
    system: DEFAULT_CHARACTER_SYSTEM,
    sourceScope: DEFAULT_CHARACTER_SCOPE,
    name: "Rusk Fenner",
    race: "Human",
    charClass: "Ranger",
    role: "Archer, scout, tracker, and wilderness striker",
    alignment: "Neutral Good",
    level: 1,
    hp: 9,
    maxHp: 9,
    speed: 30,
    attacksPerRound: 1,
    armorClass: 15,
    initiative: 2,
    baseAttackBonus: 1,
    abilityScores: { str: 14, dex: 15, con: 13, int: 10, wis: 12, cha: 8 },
    saves: { fort: 3, ref: 4, will: 1 },
    feats: ["Point Blank Shot", "Precise Shot", "Track (ranger bonus feat)"],
    racialTraits: ["Human bonus feat", "Extra human skill points"],
    classFeatures: [
      "Favored Enemy (goblinoids) +2",
      "Track as a bonus feat",
      "Wild Empathy",
    ],
    skills: ["Survival 4 ranks", "Spot 4 ranks", "Listen 4 ranks", "Hide 4 ranks", "Move Silently 4 ranks", "Knowledge (nature) 4 ranks"],
    combatNotes: [
      "Longbow is the primary weapon. Precise Shot prevents the normal penalty for firing into melee, which makes the starter much less irritating to play.",
      "Favored Enemy (goblinoids) grants the normal 3.5e ranger bonuses when interacting with or fighting valid goblinoid targets.",
      "Studded leather and Dexterity +2 produce AC 15 without slowing Rusk.",
    ],
    traits: "Reserved, observant, and prone to answering long questions with distances. Rusk trusts footprints more than witnesses and considers 'probably safe' a phrase invented by people walking behind him.",
    backstory: "Rusk mapped timber routes for merchants who cared more about missing wagons than missing woodcutters. Following one abandoned cart led him to a goblin raiding camp and three prisoners everyone had already written off. He brought the prisoners back, quit the merchants, and kept the maps.",
    startingItems: [
      { name: "Longbow", description: "A sturdy hunting and war bow used as Rusk's primary weapon.", itemType: "weapon", equipped: true, locationNote: "Hand or back" },
      { name: "Arrow", description: "Standard longbow arrows.", itemType: "weapon", quantity: 20, locationNote: "Quiver" },
      { name: "Longsword", description: "A reliable melee fallback for enemies that cross the shooting lane.", itemType: "weapon", locationNote: "Belt scabbard" },
      { name: "Studded Leather", description: "Light leather armour reinforced with metal studs.", itemType: "armor", equipped: true, locationNote: "Worn" },
      { name: "Trail Kit", description: "Cord, chalk, tinder, a small knife, and waxed scraps for marking routes without advertising them.", itemType: "gear", locationNote: "Pack" },
    ],
    progressionGuide: [
      "Level 2: choose the Archery combat style by default, granting Rapid Shot without needing to meet its normal prerequisites; confirm if the player wants two-weapon combat instead.",
      "Level 3: Endurance arrives as a ranger bonus feat; choose the normal level-3 feat only after checking whether the player wants pure archery, stealth, or mobility.",
      "Level 4: Dexterity is the default ability-score increase. Ranger spellcasting and the animal companion begin here under normal 3.5e rules.",
      "Level 6: the Archery style normally advances to Manyshot if that style was kept.",
      "Levels 7-20: keep improving favored enemies, scouting, archery, and ranger spell utility while asking the player at every new favored-enemy choice.",
    ],
    higherLevelChoices: ["combat style", "favored enemies", "general feats", "ability-score increases", "animal companion", "daily ranger spells"],
  }),

  p({
    id: "marda-quick-rogue",
    system: DEFAULT_CHARACTER_SYSTEM,
    sourceScope: DEFAULT_CHARACTER_SCOPE,
    name: "Marda Quick",
    race: "Halfling",
    charClass: "Rogue",
    role: "Trap specialist, infiltrator, scout, and precision striker",
    alignment: "Chaotic Neutral",
    level: 1,
    hp: 7,
    maxHp: 7,
    speed: 20,
    attacksPerRound: 1,
    armorClass: 16,
    initiative: 7,
    baseAttackBonus: 0,
    abilityScores: { str: 6, dex: 17, con: 12, int: 14, wis: 10, cha: 13 },
    saves: { fort: 2, ref: 6, will: 1 },
    feats: ["Improved Initiative"],
    racialTraits: [
      "Small size: +1 AC and +1 attack bonus, plus the usual Small-creature modifiers",
      "+1 racial bonus on all saving throws",
      "+2 morale bonus on saves against fear, stacking with the halfling save bonus",
      "+2 racial bonus on Climb, Jump, Listen, and Move Silently",
      "+1 racial bonus with thrown weapons and slings",
    ],
    classFeatures: ["Sneak Attack +1d6", "Trapfinding"],
    skills: [
      "Disable Device 4 ranks",
      "Open Lock 4 ranks",
      "Search 4 ranks",
      "Hide 4 ranks",
      "Move Silently 4 ranks",
      "Tumble 4 ranks",
      "Spot 4 ranks",
      "Listen 4 ranks",
      "Use Magic Device 4 ranks",
      "Bluff 4 ranks",
    ],
    combatNotes: [
      "AC 16 includes leather armour, Dexterity +3, and the halfling +1 size bonus.",
      "Initiative +7 includes Dexterity +3 and Improved Initiative +4.",
      "The listed saving throws include the halfling +1 racial bonus to all saves, but not the extra situational fear bonus.",
      "Use Sneak Attack only when the normal 3.5e conditions are satisfied; being a rogue is not a magical licence to add 1d6 to every hit.",
    ],
    traits: "Cheerful under pressure, nosy by profession, and offended by locks that think too highly of themselves. Marda has a habit of narrating obvious traps in a disappointed whisper.",
    backstory: "Marda repaired counting-room locks for merchants until she realised she was being paid less to secure doors than thieves were paid to open them. She never joined the thieves. She did, however, start charging merchants enough to make the comparison less insulting, and eventually took field work where the locks are older and the owners are usually dead.",
    startingItems: [
      { name: "Short Sword", description: "A light blade sized for a halfling and suited to close work.", itemType: "weapon", equipped: true, locationNote: "Belt sheath" },
      { name: "Light Crossbow", description: "A compact crossbow for attacking from a safer distance.", itemType: "weapon", locationNote: "Pack or hand" },
      { name: "Crossbow Bolt", description: "Bolts for the light crossbow.", itemType: "weapon", quantity: 20, locationNote: "Bolt case" },
      { name: "Leather Armour", description: "Light armour that preserves the mobility needed for rogue work.", itemType: "armor", equipped: true, locationNote: "Worn" },
      { name: "Thieves' Tools", description: "Picks, tension tools, probes, and small implements for locks and traps.", itemType: "tool", locationNote: "Inner tool roll" },
    ],
    progressionGuide: [
      "Level 2: continue Rogue for Evasion and more skill ranks.",
      "Level 3: Weapon Finesse becomes a strong default feat once the base attack prerequisite is satisfied, letting Dexterity support suitable melee attacks.",
      "Level 4: Dexterity is the default ability-score increase, bringing it to 18.",
      "Levels 5-9: preserve high Search, Disable Device, Open Lock, Hide, Move Silently, Tumble, and Use Magic Device investment unless the player changes priorities.",
      "Level 10 and beyond: Rogue special abilities are permanent meaningful choices; always present the legal options rather than choosing one invisibly.",
    ],
    higherLevelChoices: ["skill ranks", "general feats", "ability-score increases", "rogue special abilities from level 10 onward"],
  }),

  p({
    id: "orsai-inkhand-wizard",
    system: DEFAULT_CHARACTER_SYSTEM,
    sourceScope: DEFAULT_CHARACTER_SCOPE,
    name: "Orsai Inkhand",
    race: "Elf",
    charClass: "Wizard",
    role: "Arcane control, utility, knowledge, and flexible prepared casting",
    alignment: "Neutral",
    level: 1,
    hp: 4,
    maxHp: 4,
    speed: 30,
    attacksPerRound: 1,
    armorClass: 13,
    initiative: 3,
    baseAttackBonus: 0,
    abilityScores: { str: 8, dex: 16, con: 11, int: 15, wis: 12, cha: 10 },
    saves: { fort: 0, ref: 3, will: 3 },
    feats: ["Spell Focus (Conjuration)", "Scribe Scroll (wizard bonus feat)"],
    racialTraits: [
      "Low-light vision",
      "Immunity to magical sleep and +2 racial bonus on saves against enchantment spells or effects",
      "Elven weapon proficiencies",
      "+2 racial bonus on Listen, Search, and Spot",
      "Automatic Search check for nearby secret or concealed doors",
    ],
    classFeatures: ["Summon Familiar", "Scribe Scroll as a 1st-level wizard bonus feat"],
    skills: ["Concentration 4 ranks", "Knowledge (arcana) 4 ranks", "Knowledge (dungeoneering) 4 ranks", "Spellcraft 4 ranks"],
    spellcasting: {
      ability: "int",
      notes: "Generalist Wizard. The spellbook contains the normal 0-level wizard spells plus the listed five 1st-level starters. With Intelligence 15, Orsai prepares two 1st-level spells per day at level 1: one base slot plus one bonus slot.",
      cantrips: ["Detect Magic", "Light", "Mage Hand"],
      levelOneSpells: ["Mage Armor", "Sleep"],
      spellbook: ["Mage Armor", "Magic Missile", "Sleep", "Grease", "Color Spray"],
    },
    companion: "Ravel, a raven familiar",
    combatNotes: [
      "Unarmoured AC is 13 from Dexterity. Mage Armor raises this to 17 while it lasts.",
      "Sleep and Grease are control tools; Magic Missile is reliable damage; Color Spray is dangerous at close range but requires positioning.",
      "Do not treat every spell in the spellbook as simultaneously prepared. Prepared slots and known spellbook contents are separate in 3.5e.",
    ],
    traits: "Precise, distractible, and incapable of leaving a marginal note unwritten. Orsai is much better at remembering a theorem than the name of the person who explained it.",
    backstory: "Orsai copied legal records in an elven archive where most mistakes could be corrected sometime in the next century. He was dismissed after proving that several 'ancient originals' had been forged within the same decade. Rather than apologise for being right, Orsai packed the ink, the evidence, and a raven that had learned three rude phrases.",
    startingItems: [
      { name: "Quarterstaff", description: "A simple wooden staff serving as walking stick and emergency weapon.", itemType: "weapon", equipped: true, locationNote: "Hand" },
      { name: "Light Crossbow", description: "A mundane ranged option for preserving spell slots.", itemType: "weapon", locationNote: "Pack or hand" },
      { name: "Crossbow Bolt", description: "Bolts for the light crossbow.", itemType: "weapon", quantity: 20, locationNote: "Bolt case" },
      { name: "Spellbook", description: "Orsai's working spellbook, full of cramped annotations and aggressively corrected margins.", itemType: "gear", locationNote: "Waterproof wrap in pack" },
      { name: "Spell Component Pouch", description: "Organised mundane components used for arcane spellcasting.", itemType: "gear", equipped: true, locationNote: "Belt" },
    ],
    progressionGuide: [
      "Level 2: continue Wizard and add two new wizard spells to the spellbook under normal class progression; let the player choose them or present a short core-only recommendation list.",
      "Level 3: Augment Summoning is the default feat recommendation because Spell Focus (Conjuration) already satisfies its prerequisite, but ask before committing.",
      "Level 4: Intelligence is the default ability-score increase, bringing it to 16; continue adding two spells to the spellbook each wizard level.",
      "Level 5: choose the wizard bonus feat with the player. Craft Wondrous Item is a flexible core suggestion if item creation fits the campaign.",
      "Levels 6-20: preserve full Wizard spell progression and keep spellbook growth explicit. Never pretend a spell is prepared merely because it is written in the book.",
    ],
    higherLevelChoices: ["new spellbook spells every wizard level", "prepared spells each day", "general feats", "wizard bonus feats", "ability-score increases", "familiar changes if permitted"],
  }),
];

export const DEFAULT_CHARACTER_BY_ID: Record<string, DefaultCharacterPreset> =
  Object.fromEntries(DEFAULT_CHARACTERS.map((character) => [character.id, character]));

export function getDefaultCharacterPreset(id: string | null | undefined): DefaultCharacterPreset | undefined {
  if (!id) return undefined;
  return DEFAULT_CHARACTER_BY_ID[id];
}

function abilityLine(scores: AbilityScores): string {
  return `STR ${scores.str}, DEX ${scores.dex}, CON ${scores.con}, INT ${scores.int}, WIS ${scores.wis}, CHA ${scores.cha}`;
}

function savesLine(saves: SavingThrows): string {
  const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);
  return `Fort ${signed(saves.fort)}, Ref ${signed(saves.ref)}, Will ${signed(saves.will)}`;
}

function entry(id: string, key: string, value: string) {
  return { id, key, name: key, value, description: value };
}

/**
 * Converts a preset into the flexible characterData JSON already consumed by
 * CharacterSheetView and SidebarCharacterSheet. The rulesProfile and
 * claudeScaling objects are intentionally structured so the DM prompt can later
 * read a bounded, trusted summary without ingesting arbitrary raw player text.
 */
export function buildDefaultCharacterData(character: DefaultCharacterPreset): string {
  const spellEntries = character.spellcasting
    ? [
        entry(`${character.id}-spell-note`, "Casting", character.spellcasting.notes),
        ...(character.spellcasting.cantrips?.length
          ? [entry(`${character.id}-cantrips`, "0-level", character.spellcasting.cantrips.join(", "))]
          : []),
        ...(character.spellcasting.levelOneSpells?.length
          ? [entry(`${character.id}-level-one`, "1st-level", character.spellcasting.levelOneSpells.join(", "))]
          : []),
        ...(character.spellcasting.spellbook?.length
          ? [entry(`${character.id}-spellbook`, "Spellbook", character.spellcasting.spellbook.join(", "))]
          : []),
      ]
    : [];

  const sections = [
    {
      id: `${character.id}-rules`,
      label: "D&D 3.5e Rules",
      type: "notes",
      entries: [
        entry(`${character.id}-alignment`, "Alignment", character.alignment),
        entry(`${character.id}-abilities`, "Ability Scores", abilityLine(character.abilityScores)),
        entry(`${character.id}-ac`, "Armor Class", String(character.armorClass)),
        entry(`${character.id}-initiative`, "Initiative", character.initiative >= 0 ? `+${character.initiative}` : String(character.initiative)),
        entry(`${character.id}-bab`, "Base Attack Bonus", character.baseAttackBonus >= 0 ? `+${character.baseAttackBonus}` : String(character.baseAttackBonus)),
        entry(`${character.id}-saves`, "Saving Throws", savesLine(character.saves)),
        entry(`${character.id}-role`, "Party Role", character.role),
      ],
    },
    {
      id: `${character.id}-abilities-section`,
      label: "Granted Abilities",
      type: "abilities",
      entries: [
        ...character.classFeatures.map((feature, index) =>
          entry(`${character.id}-class-${index}`, feature.split(":")[0], feature),
        ),
        ...character.feats.map((feat, index) =>
          entry(`${character.id}-feat-${index}`, feat, `Feat: ${feat}`),
        ),
        ...character.racialTraits.map((trait, index) =>
          entry(`${character.id}-race-${index}`, `Racial: ${trait.split(":")[0]}`, trait),
        ),
      ],
    },
    {
      id: `${character.id}-skills`,
      label: "Skills",
      type: "notes",
      entries: character.skills.map((skill, index) =>
        entry(`${character.id}-skill-${index}`, `Skill ${index + 1}`, skill),
      ),
    },
    ...(spellEntries.length
      ? [{ id: `${character.id}-spells`, label: "Spells", type: "notes", entries: spellEntries }]
      : []),
    ...(character.companion
      ? [{
          id: `${character.id}-companion`,
          label: "Companion",
          type: "notes",
          entries: [entry(`${character.id}-companion-entry`, "Companion", character.companion)],
        }]
      : []),
    {
      id: `${character.id}-combat`,
      label: "Combat Notes",
      type: "notes",
      entries: character.combatNotes.map((note, index) =>
        entry(`${character.id}-combat-${index}`, `Note ${index + 1}`, note),
      ),
    },
    {
      id: `${character.id}-progression`,
      label: "Progression Guide",
      type: "notes",
      entries: character.progressionGuide.map((step, index) =>
        entry(`${character.id}-progress-${index}`, `Guidance ${index + 1}`, step),
      ),
    },
  ];

  return JSON.stringify({
    system: character.system,
    sourceScope: character.sourceScope,
    presetId: character.id,
    rulesProfile: {
      role: character.role,
      alignment: character.alignment,
      abilityScores: character.abilityScores,
      armorClass: character.armorClass,
      initiative: character.initiative,
      baseAttackBonus: character.baseAttackBonus,
      saves: character.saves,
      feats: character.feats,
      racialTraits: character.racialTraits,
      classFeatures: character.classFeatures,
      skills: character.skills,
      spellcasting: character.spellcasting ?? null,
      companion: character.companion ?? null,
      combatNotes: character.combatNotes,
      progressionGuide: character.progressionGuide,
    },
    claudeScaling: {
      baselineLevel: 1,
      ruleset: character.system,
      sourceScope: character.sourceScope,
      preserveConcept: true,
      askBeforePermanentChoices: character.higherLevelChoices,
      instructions: [
        "Use normal D&D 3.5e PHB/SRD class progression to reach the requested target level.",
        "Preserve this preset's role, race, class, and build direction unless the player asks to change them.",
        "Explain permanent choices before applying them, especially feats, spells known, ability-score increases, favored enemies, companions, and other branch points.",
        "Do not grant class features earlier than their normal 3.5e level.",
        "For target levels above 20, stop and explain that epic progression is outside the initial PHB-only scope unless the campaign explicitly enables epic rules.",
      ],
    },
    sections,
    raw: "",
  });
}

/**
 * Level-1 payload matching the current character-creation fields. Starting items
 * stay separate because DungeonMasterOS has a real items table and should seed
 * them there rather than pretending inventory is prose inside characterData.
 */
export function toLevelOneCharacterPayload(character: DefaultCharacterPreset) {
  return {
    presetId: character.id,
    name: character.name,
    race: character.race,
    charClass: character.charClass,
    traits: character.traits,
    backstory: character.backstory,
    level: 1,
    hp: character.hp,
    maxHp: character.maxHp,
    speed: character.speed,
    attacksPerRound: character.attacksPerRound,
    characterData: buildDefaultCharacterData(character),
  };
}

/**
 * Safe, short brief for Claude when a player wants to start above level 1.
 * This does not mutate the character by itself; it tells the DM exactly what
 * must be scaled and which choices must remain player-facing.
 */
export function buildHigherLevelClaudeBrief(character: DefaultCharacterPreset, targetLevel: number): string {
  const level = Math.max(1, Math.trunc(Number(targetLevel) || 1));
  const coreLevel = Math.min(level, 20);
  const epicWarning = level > 20
    ? `The requested level is ${level}. Core PHB class progression stops at 20; do not invent epic progression unless the campaign explicitly enables epic rules.`
    : "Stay inside normal PHB/SRD core progression.";

  return [
    `Scale ${character.name}, the ${character.race} ${character.charClass}, from the canonical level-1 preset to level ${coreLevel} using D&D 3.5e rules.`,
    `Preserve the role: ${character.role}.`,
    `Current level-1 abilities: ${abilityLine(character.abilityScores)}.`,
    `Use the preset progression guide as build direction: ${character.progressionGuide.join(" ")}`,
    `Before committing permanent choices, ask the player about: ${character.higherLevelChoices.join(", ")}.`,
    epicWarning,
  ].join("\n");
}
