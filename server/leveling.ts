// server/leveling.ts
//
// XP, level thresholds, and level-up math — the single source of truth for
// "how much XP is level N" and "how much HP do you gain leveling up",
// mirroring how character-stats.ts is the one place ruleset combat math
// lives. Standard 5e/3.5e XP tables and hit-die-by-class are SRD-derived
// numeric game data (open content), not reproduced book text — no PHB
// feat lists or flavor text live here. Level-up "features" are free text
// the player enters, same as backstory/traits elsewhere in this codebase,
// which keeps this working for any ruleset or freeform character concept
// instead of requiring a fixed picklist tied to one specific rulebook.

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

// Standard D&D 5e XP-to-level table (index 0 = level 1's threshold).
const XP_THRESHOLDS_5E = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

// Standard D&D 3.5 XP formula: total XP to reach level N = 500 * N * (N-1).
function xpThreshold35e(level: number): number {
  return 500 * level * (level - 1);
}

export function xpForLevel(level: number, ruleset: string): number {
  if (ruleset === "dnd35e") return xpThreshold35e(level);
  const idx = Math.max(0, Math.min(level, XP_THRESHOLDS_5E.length) - 1);
  return XP_THRESHOLDS_5E[idx];
}

export const MAX_LEVEL = 20;

export function levelForXp(xp: number, ruleset: string): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1, ruleset)) {
    level += 1;
  }
  return level;
}

// null at the level cap — there's no "next" threshold to show once a
// character can't level further, so the sheet should say so rather than
// display a fabricated number.
export function xpForNextLevel(currentLevel: number, ruleset: string): number | null {
  if (currentLevel >= MAX_LEVEL) return null;
  return xpForLevel(currentLevel + 1, ruleset);
}

// A flat XP award per defeated NPC, scaled by campaign power level — DMOS
// doesn't track individual challenge ratings, so this is a simple,
// consistent stand-in rather than per-monster math.
const XP_PER_NPC_BY_POWER_LEVEL: Record<string, number> = {
  low: 25,
  standard: 50,
  high: 150,
  godtier: 400,
};

export function xpAwardForDefeatedNpc(powerLevel: string): number {
  return XP_PER_NPC_BY_POWER_LEVEL[powerLevel] ?? XP_PER_NPC_BY_POWER_LEVEL.standard;
}

// Average hit die value by class (die average, rounded up, per standard
// rules) — used for HP gained on level-up. Same "known class -> real
// value, unknown/freeform class -> sensible default" pattern already used
// for 3.5e BAB progressions in character-stats.ts.
const HIT_DIE_AVERAGE_5E: Record<string, number> = {
  barbarian: 7, // d12
  fighter: 6, paladin: 6, ranger: 6, // d10
  bard: 5, cleric: 5, druid: 5, monk: 5, rogue: 5, warlock: 5, // d8
  sorcerer: 4, wizard: 4, // d6
};
const HIT_DIE_AVERAGE_35E: Record<string, number> = {
  barbarian: 7, // d12
  fighter: 6, paladin: 6, ranger: 6, // d10
  bard: 5, cleric: 5, druid: 5, monk: 5, rogue: 5, // d8
  sorcerer: 3, wizard: 3, // d4
};

export function hitDieAverageForClass(charClass: string, ruleset: string): number {
  const key = (charClass || "").trim().toLowerCase();
  const table = ruleset === "dnd35e" ? HIT_DIE_AVERAGE_35E : HIT_DIE_AVERAGE_5E;
  return table[key] ?? 5; // default: d8 average, a reasonable mid-point for freeform classes
}

// Actual die size, for players who'd rather roll than take the average.
const HIT_DIE_SIZE_5E: Record<string, number> = {
  barbarian: 12,
  fighter: 10, paladin: 10, ranger: 10,
  bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
  sorcerer: 6, wizard: 6,
};
const HIT_DIE_SIZE_35E: Record<string, number> = {
  barbarian: 12,
  fighter: 10, paladin: 10, ranger: 10,
  bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8,
  sorcerer: 4, wizard: 4,
};

export function hitDieSizeForClass(charClass: string, ruleset: string): number {
  const key = (charClass || "").trim().toLowerCase();
  const table = ruleset === "dnd35e" ? HIT_DIE_SIZE_35E : HIT_DIE_SIZE_5E;
  return table[key] ?? 8;
}

// Ability Score Improvement levels — 5e: most classes at 4/8/12/16/19.
// 3.5e: every 4th level (4/8/12/16/20), a flat +1 to one ability score.
export function isAsiLevel(level: number, ruleset: string): boolean {
  if (ruleset === "dnd35e") return level % 4 === 0;
  return [4, 8, 12, 16, 19].includes(level);
}

export interface LevelUpResult {
  newLevel: number;
  hpGained: number;
  hpRoll: number | null; // the raw die result, or null when the average was taken
}

// `charClass` here is the single class actually gaining this level (already
// resolved from a multiclass string by the caller) — not the character's
// full charClass field, which may contain "Fighter 1 / Rogue 1".
export function computeLevelUp(
  currentLevel: number,
  charClass: string,
  ruleset: string,
  conModifier: number,
  opts: { roll?: boolean; rng?: () => number } = {},
): LevelUpResult {
  const newLevel = currentLevel + 1;

  if (opts.roll) {
    const rng = opts.rng ?? Math.random;
    const dieSize = hitDieSizeForClass(charClass, ruleset);
    const hpRoll = 1 + Math.floor(rng() * dieSize);
    return { newLevel, hpGained: Math.max(1, hpRoll + conModifier), hpRoll };
  }

  const hitDieAvg = hitDieAverageForClass(charClass, ruleset);
  return { newLevel, hpGained: Math.max(1, hitDieAvg + conModifier), hpRoll: null };
}
