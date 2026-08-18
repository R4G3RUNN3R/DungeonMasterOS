// shared/classes.ts
//
// Canonical class lists for D&D rulesets — used by both the character
// creation form (client) and the mechanics engine (server, character-stats.ts)
// so the class a player picks always matches a key the engine actually
// understands. Standard SRD class rosters, not copyrighted book text.

export const DND5E_CLASSES = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk",
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard",
] as const;

export const DND35E_CLASSES = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk",
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Wizard",
] as const;

export function classesForRuleset(ruleset: string): readonly string[] {
  return ruleset === "dnd35e" ? DND35E_CLASSES : DND5E_CLASSES;
}

// Mirrors server/character-stats.ts's SKILL_ABILITY exactly — same skill
// list drives both what the player can pick as "trained" here and what the
// engine actually resolves checks against.
export const SKILL_ABILITY: Record<string, "str" | "dex" | "con" | "int" | "wis" | "cha"> = {
  Acrobatics: "dex",
  "Animal Handling": "wis",
  Arcana: "int",
  Athletics: "str",
  Deception: "cha",
  History: "int",
  Insight: "wis",
  Intimidation: "cha",
  Investigation: "int",
  Medicine: "wis",
  Nature: "int",
  Perception: "wis",
  Performance: "cha",
  Persuasion: "cha",
  Religion: "int",
  "Sleight of Hand": "dex",
  Stealth: "dex",
  Survival: "wis",
};

// Skill-training budgets at character creation. DMOS tracks skills as
// trained/untrained rather than individually-spent points (see
// character-stats.ts's resolveCharacterModifier), so these counts are how
// many skills a player gets to mark trained, not a point pool to spend.
//
// 3.5e: SRD base skill points per level by class, general/well-known
// mechanical fact (not book text) — the same basis used for BAB/save
// progressions elsewhere in this codebase.
const DND35E_SKILL_POINTS_BASE: Record<string, number> = {
  barbarian: 4, bard: 6, cleric: 2, druid: 4, fighter: 2, monk: 4,
  paladin: 2, ranger: 6, rogue: 8, sorcerer: 2, wizard: 2,
};
const DND35E_DEFAULT_SKILL_POINTS_BASE = 4;

// 5e: number of skills chosen from the class's skill list at 1st level.
const DND5E_SKILL_CHOICE_COUNT: Record<string, number> = {
  barbarian: 2, bard: 3, cleric: 2, druid: 2, fighter: 2, monk: 2,
  paladin: 2, ranger: 3, rogue: 4, sorcerer: 2, warlock: 2, wizard: 2,
};
const DND5E_DEFAULT_SKILL_CHOICE_COUNT = 2;

// How many skills a player should mark trained at creation for the given
// class/ruleset. For 3.5e this approximates the real "base points + INT mod"
// formula (without the ×4 first-level multiplier, since DMOS doesn't track
// discrete ranks) — more INT means more trained skills, same as the real game.
export function startingSkillCount(ruleset: string, charClass: string, intModifier: number): number {
  const key = (charClass || "").trim().toLowerCase();
  if (ruleset === "dnd35e") {
    const base = DND35E_SKILL_POINTS_BASE[key] ?? DND35E_DEFAULT_SKILL_POINTS_BASE;
    return Math.max(1, base + intModifier);
  }
  return DND5E_SKILL_CHOICE_COUNT[key] ?? DND5E_DEFAULT_SKILL_CHOICE_COUNT;
}

// Starting feat slots. 3.5e grants a feat at 1st level and every 3 levels
// thereafter (1st, 3rd, 6th, 9th...). 5e doesn't grant a feat at creation by
// default (feats there are an optional trade-in for an ability score
// increase, handled at level-up, not creation) — feats are optional and
// freeform there.
export function startingFeatSlots(ruleset: string, level: number): number {
  if (ruleset === "dnd35e") return 1 + Math.floor(Math.max(1, level) / 3);
  return 0;
}
