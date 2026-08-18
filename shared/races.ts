// shared/races.ts
//
// Canonical D&D 3.5e race registry — Phase 1 of turning "race" from an
// arbitrary free-text string into real rules data (ability adjustments,
// size, speed, senses), the same pattern already used for classesForRuleset
// and the BAB/save progression tables in character-stats.ts. Standard SRD
// mechanical facts (ability adjustments, size, speed, favored class), not
// reproduced book prose — same copyright basis as the rest of this codebase.
//
// Scope note: traits[] below is deliberately a flat, descriptive reference
// list rather than a fully mechanically-resolved effect system. Stonecunning,
// weapon familiarity, spell-like abilities, and conditional bonuses (e.g.
// "+2 vs poison") are recorded as real structured data so a future pass can
// wire them into resolveCharacterModifier, but aren't auto-applied yet —
// only ability adjustments, size, and speed are. This mirrors how feats are
// intentionally free text elsewhere in this codebase: don't force a giant
// mechanical engine into existence before it's actually needed.

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type CreatureSize = "small" | "medium";

export interface RacialTrait {
  name: string;
  description: string;
}

export interface RaceDefinition {
  id: string;
  displayName: string;
  sourceId: string; // e.g. "dnd35e-phb" — which rules source this comes from
  abilityAdjustments: Partial<Record<Ability, number>>;
  size: CreatureSize;
  speed: number;
  vision: string[]; // e.g. ["darkvision-60"], ["low-light"]
  favoredClass: string;
  traits: RacialTrait[];
}

// Size modifier applied to attack rolls and AC (SRD size-modifier table,
// Medium baseline). Only attack is currently wired in (see
// character-stats.ts) — AC has no derived-formula home yet since character.ac
// is still a stored raw column, not computed. Documented here so the next
// pass that gives AC a real formula has a single source for this number.
const SIZE_ATTACK_AC_MODIFIER: Record<CreatureSize, number> = {
  small: 1,
  medium: 0,
};

export function sizeAttackAcModifier(size: CreatureSize): number {
  return SIZE_ATTACK_AC_MODIFIER[size] ?? 0;
}

export const DND35E_RACES: RaceDefinition[] = [
  {
    id: "human",
    displayName: "Human",
    sourceId: "dnd35e-phb",
    abilityAdjustments: {},
    size: "medium",
    speed: 30,
    vision: [],
    favoredClass: "Any",
    traits: [
      { name: "Bonus Feat", description: "An extra feat at 1st level, chosen by the player." },
      { name: "Skilled", description: "4 extra skill points at 1st level, plus 1 extra skill point at every level thereafter." },
    ],
  },
  {
    id: "dwarf",
    displayName: "Dwarf",
    sourceId: "dnd35e-phb",
    abilityAdjustments: { con: 2, cha: -2 },
    size: "medium",
    speed: 20,
    vision: ["darkvision-60"],
    favoredClass: "Fighter",
    traits: [
      { name: "Stonecunning", description: "+2 on checks to notice unusual stonework; treated as actively searching for it when within 10 feet." },
      { name: "Stability", description: "+4 bonus to resist being bull rushed or tripped while standing on the ground." },
      { name: "Weapon Familiarity", description: "Treats the dwarven waraxe and dwarven urgrosh as martial weapons." },
      { name: "Hardy Saves", description: "+2 on saving throws against poison, and +2 on saving throws against spells and spell-like effects." },
      { name: "Orc/Goblinoid Foes", description: "+1 on attack rolls against orcs and goblinoids." },
      { name: "Giant Foes", description: "+4 dodge bonus to AC against monsters of the giant type." },
      { name: "Stone and Metal Sense", description: "+2 on Appraise checks for stone or metal items, and +2 on Craft checks related to stone or metal." },
      { name: "Unhindered Movement", description: "Speed is never reduced by armor or heavy loads." },
    ],
  },
  {
    id: "elf",
    displayName: "Elf",
    sourceId: "dnd35e-phb",
    abilityAdjustments: { dex: 2, con: -2 },
    size: "medium",
    speed: 30,
    vision: ["low-light"],
    favoredClass: "Wizard",
    traits: [
      { name: "Sleep Immunity", description: "Immune to magic sleep effects." },
      { name: "Enchantment Resistance", description: "+2 on saving throws against enchantment spells or effects." },
      { name: "Weapon Proficiency", description: "Proficient with longsword, rapier, longbow (and composite longbow), and shortbow (and composite shortbow)." },
      { name: "Keen Senses", description: "+2 on Listen, Search, and Spot checks; automatically gets a Search check when passing within 5 feet of a secret or concealed door." },
    ],
  },
  {
    id: "gnome",
    displayName: "Gnome",
    sourceId: "dnd35e-phb",
    abilityAdjustments: { con: 2, str: -2 },
    size: "small",
    speed: 20,
    vision: ["low-light"],
    favoredClass: "Bard",
    traits: [
      { name: "Weapon Familiarity", description: "Treats the gnome hooked hammer as a martial weapon." },
      { name: "Illusion Resistance", description: "+2 on saving throws against illusion spells or effects." },
      { name: "Illusion Affinity", description: "+1 to the save DC of any illusion spell the gnome casts." },
      { name: "Giant Foes", description: "+4 dodge bonus to AC against monsters of the giant type." },
      { name: "Kobold/Goblinoid Foes", description: "+1 on attack rolls against kobolds and goblinoids." },
      { name: "Keen Hearing", description: "+2 on Listen checks." },
      { name: "Alchemy", description: "+2 on Craft (alchemy) checks." },
      { name: "Spell-Like Abilities", description: "1/day: speak with animals (burrowing mammals only, duration 1 minute); with Cha 10+, also 1/day each of dancing lights, ghost sound, and prestidigitation." },
    ],
  },
  {
    id: "half-elf",
    displayName: "Half-Elf",
    sourceId: "dnd35e-phb",
    abilityAdjustments: {},
    size: "medium",
    speed: 30,
    vision: ["low-light"],
    favoredClass: "Any",
    traits: [
      { name: "Sleep Immunity", description: "Immune to magic sleep effects." },
      { name: "Enchantment Resistance", description: "+2 on saving throws against enchantment spells or effects." },
      { name: "Keen Senses", description: "+1 on Listen, Search, and Spot checks." },
      { name: "Diplomatic", description: "+2 on Diplomacy and Gather Information checks." },
      { name: "Elven Blood", description: "Counts as an elf for any effect related to race." },
    ],
  },
  {
    id: "half-orc",
    displayName: "Half-Orc",
    sourceId: "dnd35e-phb",
    abilityAdjustments: { str: 2, int: -2, cha: -2 },
    size: "medium",
    speed: 30,
    vision: ["darkvision-60"],
    favoredClass: "Barbarian",
    traits: [
      { name: "Orc Blood", description: "Counts as an orc for any effect related to race." },
    ],
  },
  {
    id: "halfling",
    displayName: "Halfling",
    sourceId: "dnd35e-phb",
    abilityAdjustments: { dex: 2, str: -2 },
    size: "small",
    speed: 20,
    vision: [],
    favoredClass: "Rogue",
    traits: [
      { name: "Sure-Footed", description: "+2 on Climb, Jump, and Move Silently checks." },
      { name: "Keen Hearing", description: "+2 on Listen checks." },
      { name: "Fearless", description: "+1 on all saving throws, plus an additional +2 on saving throws against fear (stacking with the +1)." },
      { name: "Skilled Thrower", description: "+1 on attack rolls with thrown weapons and with slings." },
    ],
  },
];

export function racesForRuleset(ruleset: string): readonly RaceDefinition[] {
  return ruleset === "dnd35e" ? DND35E_RACES : [];
}

export function getRace(ruleset: string, raceId: string): RaceDefinition | undefined {
  const key = (raceId || "").trim().toLowerCase();
  return racesForRuleset(ruleset).find((r) => r.id === key || r.displayName.toLowerCase() === key);
}

// Applies a race's ability adjustments to a base score block, clamping at 1
// (can't go below 1 even after a -2 racial penalty on a very low roll).
export function applyRacialAdjustments<T extends Record<Ability, number>>(
  baseScores: T,
  race: RaceDefinition | undefined,
): T {
  if (!race) return baseScores;
  const adjusted = { ...baseScores };
  for (const [ability, delta] of Object.entries(race.abilityAdjustments) as Array<[Ability, number]>) {
    adjusted[ability] = Math.max(1, adjusted[ability] + delta) as T[Ability];
  }
  return adjusted;
}
