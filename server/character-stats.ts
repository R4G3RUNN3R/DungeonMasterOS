// server/character-stats.ts
//
// Resolves a character's real, DB-backed modifier for a roll — the
// authoritative source the dice engine compares against. Never trusts a
// number the AI proposed; only ever reads what's actually in the database.

import { modifierFor, proficiencyBonusForLevel } from "./dice-engine";
import { getRace, sizeAttackAcModifier } from "@shared/races";

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

// Map ability shorthand to full names for save proficiency checks
const ABILITY_FULL_NAMES: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

// Mirrors client/src/lib/computedStats.ts's SKILL_ABILITY so a skill label in
// a [CHECK] tag maps to the same governing ability the character sheet uses.
export const SKILL_ABILITY: Record<string, Ability> = {
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

interface StatMod {
  stat: string;
  type: "bonus" | "override" | "override_if_higher" | "advantage" | "disadvantage" | "immunity" | "resistance" | "custom";
  modifier?: number;
  overrideValue?: number;
  source?: string;
}

export interface ResolveOpts {
  skill?: string;
  isSave?: boolean;
  combatStyle?: string;
  ruleset?: string;
}

export interface ResolvedModifier {
  baseModifier: number;
  effectModifier: number;
  proficiencyBonus: number;
  sizeBonus: number;
  cinematicBonus: number;
  statUsed: string;
  total: number;
}

// ── D&D 3.5 rules (base attack bonus, class-based save progression, skill
// ranks) — an entirely separate mechanical system from 5e's proficiency
// bonus, not a variant of it. This categorization of which classes get
// "good" saves and full/3-quarter/half BAB progression is itself part of
// the SRD 3.5 (released under the OGL), the same license basis the 5e SRD
// content elsewhere in this codebase relies on.
export type BabProgression = "full" | "threeQuarter" | "half";

interface Dnd35eClassProgression {
  bab: BabProgression;
  goodSaves: Ability[]; // con=Fortitude, dex=Reflex, wis=Will
}

const DND35E_CLASS_PROGRESSIONS: Record<string, Dnd35eClassProgression> = {
  barbarian: { bab: "full", goodSaves: ["con"] },
  bard: { bab: "threeQuarter", goodSaves: ["dex", "wis"] },
  cleric: { bab: "threeQuarter", goodSaves: ["con", "wis"] },
  druid: { bab: "threeQuarter", goodSaves: ["con", "wis"] },
  fighter: { bab: "full", goodSaves: ["con"] },
  monk: { bab: "threeQuarter", goodSaves: ["con", "dex", "wis"] },
  paladin: { bab: "full", goodSaves: ["con"] },
  ranger: { bab: "full", goodSaves: ["con", "dex"] },
  rogue: { bab: "threeQuarter", goodSaves: ["dex"] },
  sorcerer: { bab: "half", goodSaves: ["wis"] },
  wizard: { bab: "half", goodSaves: ["wis"] },
};

// DMOS character creation is freeform (any genre, any concept) — a class
// name that isn't one of the 3.5e core eleven still needs playable math.
const DND35E_DEFAULT_PROGRESSION: Dnd35eClassProgression = { bab: "threeQuarter", goodSaves: ["con"] };

function getDnd35eProgression(charClass: string | undefined): Dnd35eClassProgression {
  const key = (charClass || "").trim().toLowerCase();
  return DND35E_CLASS_PROGRESSIONS[key] ?? DND35E_DEFAULT_PROGRESSION;
}

interface ClassLevelEntry {
  charClass: string;
  level: number;
}

// Multiclass characters store their split as free text ("Fighter 1 / Rogue 1").
// Splits the string into per-class levels: explicit trailing numbers are
// honored as-is; classes without one share whatever character level is left
// over evenly (remainder to the earliest-listed class), so "Fighter / Rogue"
// at character level 2 resolves to Fighter 1 / Rogue 1.
function parseClassLevels(charClass: string | undefined, totalLevel: number): ClassLevelEntry[] {
  const raw = (charClass || "").trim();
  if (!raw) return [{ charClass: "", level: totalLevel }];

  const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return [{ charClass: raw, level: totalLevel }];
  }

  const parsed = parts.map((part) => {
    const match = part.match(/^(.*?)(\d+)$/);
    if (match) {
      const level = parseInt(match[2], 10);
      return { charClass: match[1].trim(), level: Number.isFinite(level) ? level : null };
    }
    return { charClass: part, level: null as number | null };
  });

  const specifiedTotal = parsed.reduce((sum, e) => sum + (e.level ?? 0), 0);
  const unspecified = parsed.filter((e) => e.level === null);
  if (unspecified.length === 0) {
    return parsed.map((e) => ({ charClass: e.charClass, level: e.level as number }));
  }

  const remaining = Math.max(0, totalLevel - specifiedTotal);
  const base = Math.floor(remaining / unspecified.length);
  let extra = remaining - base * unspecified.length;
  return parsed.map((e) => {
    if (e.level !== null) return { charClass: e.charClass, level: e.level };
    const level = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    return { charClass: e.charClass, level };
  });
}

// 3.5e multiclass rule: BAB and saves are computed separately per class
// (using that class's own progression at that class's own level), then
// summed — not looked up from a single combined key.
function combinedDnd35eBab(charClass: string | undefined, totalLevel: number): number {
  return parseClassLevels(charClass, totalLevel).reduce(
    (sum, entry) => sum + babForLevel(getDnd35eProgression(entry.charClass).bab, entry.level),
    0,
  );
}

function combinedDnd35eSaveBonus(charClass: string | undefined, totalLevel: number, ability: Ability): number {
  return parseClassLevels(charClass, totalLevel).reduce((sum, entry) => {
    const progression = getDnd35eProgression(entry.charClass);
    return sum + dnd35eSaveBonus(progression.goodSaves.includes(ability), entry.level);
  }, 0);
}

export function babForLevel(progression: BabProgression, level: number): number {
  if (progression === "full") return level;
  if (progression === "threeQuarter") return Math.floor((level * 3) / 4);
  return Math.floor(level / 2);
}

// Iterative attacks: a character makes an additional attack (at a
// cumulative -5 to each) for every full +5 of BAB at or above +6.
export function iterativeAttackBonuses(bab: number): number[] {
  const bonuses = [bab];
  let remaining = bab - 5;
  while (remaining >= 1) {
    bonuses.push(remaining);
    remaining -= 5;
  }
  return bonuses;
}

function dnd35eSaveBonus(isGoodSave: boolean, level: number): number {
  return isGoodSave ? 2 + Math.floor(level / 2) : Math.floor(level / 3);
}

// "Cinematic" campaigns still roll real dice server-side for every action —
// attacks, skill checks, saves, all of it. This is not a mode that skips
// rolling in favor of narration; it only shifts the odds in the player's
// favor with a flat bonus applied here, to whatever roll is being resolved.
// A natural 1 is still a fumble and a natural 20 is still a critical hit
// regardless of this bonus, because resolveD20 (dice-engine.ts) checks the
// raw die result before the modifier is ever added.
export const CINEMATIC_ROLL_BONUS = 20;

interface StorageLike {
  getCharacter(id: number): { level: number; str: number; dex: number; con: number; int: number; wis: number; cha: number; proficiencies: string; charClass?: string; attackAbility?: string; race?: string } | undefined;
  getActiveEffectsByCharacter(characterId: number): Array<{ statMods: string }>;
  getItemsByCharacter?(characterId: number): Array<{ equipped: boolean; statMods: string }>;
}

// Every StatMod source that can affect a roll: active effects (buffs/debuffs)
// and equipped items. Collected once so ability-score overrides and the
// generic "bonus to a stat" pool both draw from the same combined list —
// exactly one place decides what a StatMod does, regardless of where it
// came from.
function collectStatMods(characterId: number, storage: StorageLike): StatMod[] {
  const mods: StatMod[] = [];
  for (const effect of storage.getActiveEffectsByCharacter(characterId)) {
    mods.push(...parseStatMods(effect.statMods));
  }
  const items = storage.getItemsByCharacter?.(characterId) ?? [];
  for (const item of items) {
    if (!item.equipped) continue;
    mods.push(...parseStatMods(item.statMods));
  }
  return mods;
}

// Ability score after item/effect overrides and bonuses — overrides apply
// first (a Belt of Giant Strength replaces the score outright), then
// bonuses stack on top of whatever that landed on.
function resolveAbilityScore(baseScore: number, ability: Ability, mods: StatMod[]): number {
  let score = baseScore;
  for (const mod of mods) {
    if (mod.stat !== ability) continue;
    if (mod.type === "override" && typeof mod.overrideValue === "number") {
      score = mod.overrideValue;
    } else if (mod.type === "override_if_higher" && typeof mod.overrideValue === "number" && mod.overrideValue > score) {
      score = mod.overrideValue;
    }
  }
  for (const mod of mods) {
    if (mod.stat === ability && mod.type === "bonus" && typeof mod.modifier === "number") {
      score += mod.modifier;
    }
  }
  return score;
}

function parseProficiencies(json: string): Set<string> {
  try {
    const arr = JSON.parse(json);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function parseStatMods(json: string): StatMod[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function resolveCharacterModifier(
  characterId: number,
  requestedAbility: Ability,
  opts: ResolveOpts,
  storage: StorageLike,
): ResolvedModifier {
  const character = storage.getCharacter(characterId);
  if (!character) {
    throw new Error(`resolveCharacterModifier: character ${characterId} not found`);
  }

  // The skill map wins over an AI-supplied ability when the skill is recognized —
  // this is what "ability" being AI-supplied actually means: it's overridden
  // whenever we have real game data to derive it from instead.
  let ability = requestedAbility;
  let statUsed: string = requestedAbility;

  if (opts.skill && opts.skill !== "attack" && SKILL_ABILITY[opts.skill]) {
    ability = SKILL_ABILITY[opts.skill];
    statUsed = `${ability}.${opts.skill.toLowerCase().replace(/\s+/g, "")}`;
  } else if (opts.isSave) {
    statUsed = `${ability}.save`;
  }

  const statMods = collectStatMods(characterId, storage);
  const effectiveScore = resolveAbilityScore(character[ability], ability, statMods);
  const baseModifier = modifierFor(effectiveScore);
  const proficiencies = parseProficiencies(character.proficiencies);
  const fullAbilityName = ABILITY_FULL_NAMES[ability];

  let proficiencyBonus: number;

  if (opts.ruleset === "dnd35e") {
    if (opts.skill === "attack") {
      proficiencyBonus = combinedDnd35eBab(character.charClass, character.level);
    } else if (opts.isSave) {
      proficiencyBonus = combinedDnd35eSaveBonus(character.charClass, character.level, ability);
    } else {
      // Skill ranks: DMOS tracks "trained or not" (the proficiencies list),
      // not individually-spent skill points. A trained skill is assumed to
      // sit at its maximum rank (character level + 3) — the common
      // simplification for skills that aren't being tracked point-by-point.
      const isTrained = !!opts.skill && proficiencies.has(opts.skill);
      proficiencyBonus = isTrained ? character.level + 3 : 0;
    }
  } else {
    const isProficient =
      opts.skill === "attack" || // always proficient in one's own basic attack
      (opts.skill && opts.skill !== "attack" && proficiencies.has(opts.skill)) ||
      (opts.isSave && proficiencies.has(`${fullAbilityName} Save`));
    proficiencyBonus = isProficient ? proficiencyBonusForLevel(character.level) : 0;
  }

  // "attack"/save/skill bonuses from items and effects — separate from the
  // ability-score bonuses already folded into baseModifier above. A StatMod
  // targets either an ability ("str") or a roll type ("attack"), never both,
  // so this reuses the same combined statMods list without double-counting.
  let effectModifier = 0;
  for (const mod of statMods) {
    if (mod.type !== "bonus" || typeof mod.modifier !== "number") continue;
    const targetsThisRoll =
      mod.stat === ability ||
      (opts.skill === "attack" && mod.stat === "attack") ||
      (opts.isSave && mod.stat === "save") ||
      (opts.skill && opts.skill !== "attack" && mod.stat === opts.skill);
    if (targetsThisRoll && mod.stat !== ability) {
      // Ability-targeted bonuses were already applied via resolveAbilityScore
      // above (they change baseModifier); only non-ability-targeted bonuses
      // (attack/save/skill-specific) land here.
      effectModifier += mod.modifier;
    }
  }

  const cinematicBonus = opts.combatStyle === "cinematic" ? CINEMATIC_ROLL_BONUS : 0;

  // Size affects attack rolls (SRD size-modifier table) — only wired in for
  // 3.5e attack rolls so far. AC/Hide/carrying-capacity/weapon-sizing are
  // real SRD size effects too but have no derived-formula home yet (AC is
  // still a stored raw column, not computed here), so they're deliberately
  // left for a later pass rather than half-implemented.
  const sizeBonus =
    opts.ruleset === "dnd35e" && opts.skill === "attack"
      ? sizeAttackAcModifier(getRace(opts.ruleset, character.race || "")?.size ?? "medium")
      : 0;

  return {
    baseModifier,
    effectModifier,
    proficiencyBonus,
    sizeBonus,
    cinematicBonus,
    statUsed,
    total: baseModifier + effectModifier + proficiencyBonus + sizeBonus + cinematicBonus,
  };
}

export interface SaveEntry {
  key: string;
  label: string;
  total: number;
  proficient: boolean;
}

export interface FullCharacterSheet {
  ruleset: string;
  abilities: Record<Ability, { score: number; modifier: number }>;
  skills: Array<{ name: string; ability: Ability; total: number; proficient: boolean }>;
  saves: SaveEntry[];
  attack: { total: number; extraAttackBonuses: number[] };
}

// 3.5e has exactly three saving throws — Fortitude (Con), Reflex (Dex), and
// Will (Wis) — never one per ability. Str/Int/Cha have no corresponding
// 3.5e save at all, so they're not computed here, not padded in as zeros.
// Every ruleset that genuinely uses six ability-based saves (5e) keeps that
// shape via the fallback branch in buildSaves below.
const DND35E_SAVES: Array<{ key: string; label: string; ability: Ability }> = [
  { key: "fortitude", label: "Fortitude", ability: "con" },
  { key: "reflex", label: "Reflex", ability: "dex" },
  { key: "will", label: "Will", ability: "wis" },
];

function buildSaves(characterId: number, ruleset: string | undefined, storage: StorageLike): SaveEntry[] {
  if (ruleset === "dnd35e") {
    return DND35E_SAVES.map(({ key, label, ability }) => {
      const resolved = resolveCharacterModifier(characterId, ability, { isSave: true, ruleset }, storage);
      return { key, label, total: resolved.total, proficient: resolved.proficiencyBonus > 0 };
    });
  }
  return (["str", "dex", "con", "int", "wis", "cha"] as Ability[]).map((ab) => {
    const resolved = resolveCharacterModifier(characterId, ab, { isSave: true, ruleset }, storage);
    return { key: ab, label: ABILITY_FULL_NAMES[ab].slice(0, 3).toUpperCase(), total: resolved.total, proficient: resolved.proficiencyBonus > 0 };
  });
}

// The single computed sheet the Character Sheet modal (and anywhere else
// that needs "everything about this character, computed") reads from.
// Deliberately just a loop over resolveCharacterModifier — no separate
// formulas live here, so the sheet can never disagree with what combat
// actually rolls against.
export function computeFullCharacterSheet(
  characterId: number,
  opts: { ruleset?: string; combatStyle?: string },
  storage: StorageLike,
): FullCharacterSheet {
  const character = storage.getCharacter(characterId);
  if (!character) {
    throw new Error(`computeFullCharacterSheet: character ${characterId} not found`);
  }

  const statMods = collectStatMods(characterId, storage);
  const abilities = {} as FullCharacterSheet["abilities"];
  for (const ab of ["str", "dex", "con", "int", "wis", "cha"] as Ability[]) {
    const score = resolveAbilityScore(character[ab], ab, statMods);
    abilities[ab] = { score, modifier: modifierFor(score) };
  }

  const skills = Object.entries(SKILL_ABILITY).map(([name, ability]) => {
    const resolved = resolveCharacterModifier(characterId, ability, { skill: name, ruleset: opts.ruleset }, storage);
    return { name, ability, total: resolved.total, proficient: resolved.proficiencyBonus > 0 };
  });

  const saves = buildSaves(characterId, opts.ruleset, storage);

  const attackAbility = (["str", "dex", "int"].includes(character.attackAbility || "") ? character.attackAbility : "str") as Ability;
  const attackResolved = resolveCharacterModifier(characterId, attackAbility, { skill: "attack", ruleset: opts.ruleset, combatStyle: opts.combatStyle }, storage);
  const extraAttackBonuses: number[] =
    opts.ruleset === "dnd35e"
      ? iterativeAttackBonuses(attackResolved.proficiencyBonus)
          .slice(1)
          .map((bab) => attackResolved.total - attackResolved.proficiencyBonus + bab)
      : [];

  return {
    ruleset: opts.ruleset || "dnd5e",
    abilities,
    skills,
    saves,
    attack: { total: attackResolved.total, extraAttackBonuses },
  };
}
