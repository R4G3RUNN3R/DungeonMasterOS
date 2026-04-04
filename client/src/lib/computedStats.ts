/**
 * computedStats.ts
 *
 * The full D&D 5e attribute cascade engine.
 *
 * Takes a character's base ability scores + all active effects + equipped items
 * and produces a fully computed stat block where everything that should be
 * derived is derived:
 *
 *   STR → Athletics, carrying capacity, melee atk/dmg, Str save
 *   DEX → Acrobatics, Sleight of Hand, Stealth, Initiative, AC (light/no armour), Dex save
 *   CON → HP per level (note only), Con save, concentration checks
 *   INT → Arcana, History, Investigation, Nature, Religion, Int save
 *   WIS → Animal Handling, Insight, Medicine, Perception, Survival, Wis save
 *   CHA → Deception, Intimidation, Performance, Persuasion, Cha save
 *
 * Supports:
 *   - "bonus" type: +N to a stat (Ring of Protection +1 AC)
 *   - "override" type: replaces score (Belt of Giant Strength → STR = 21)
 *   - "override_if_higher": replaces only if higher (Headband of Intellect → INT = 19 if > current)
 *   - "advantage"/"disadvantage": tracked per skill/save
 *   - "immunity"/"resistance": tracked as string labels
 *
 * Each computed value carries a "breakdown" array so the UI can show
 * "STR 21 = 10 base + 11 (Belt of Giant Strength)" as a tooltip.
 */

import type { ActiveEffect, Item, StatMod } from "@shared/schema";

// ── Ability score names ────────────────────────────────────────────────────
export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = typeof ABILITIES[number];

// ── Skill → governing ability mapping ─────────────────────────────────────
export const SKILL_ABILITY: Record<string, Ability> = {
  "Acrobatics":     "dex",
  "Animal Handling":"wis",
  "Arcana":         "int",
  "Athletics":      "str",
  "Deception":      "cha",
  "History":        "int",
  "Insight":        "wis",
  "Intimidation":   "cha",
  "Investigation":  "int",
  "Medicine":       "wis",
  "Nature":         "int",
  "Perception":     "wis",
  "Performance":    "cha",
  "Persuasion":     "cha",
  "Religion":       "int",
  "Sleight of Hand":"dex",
  "Stealth":        "dex",
  "Survival":       "wis",
};

export const SKILLS = Object.keys(SKILL_ABILITY);

// ── Save names ────────────────────────────────────────────────────────────
export const SAVE_ABILITY: Record<string, Ability> = {
  "Strength Save":     "str",
  "Dexterity Save":    "dex",
  "Constitution Save": "con",
  "Intelligence Save": "int",
  "Wisdom Save":       "wis",
  "Charisma Save":     "cha",
};

// ── Breakdown entry ────────────────────────────────────────────────────────
export interface BreakdownEntry {
  label: string;   // "Base score", "Belt of Giant Strength", "Bless", etc.
  value: number;
  type: "base" | "override" | "bonus" | "item" | "effect";
  color?: string;  // for highlight in UI
}

export interface ComputedValue {
  total: number;
  base: number;
  breakdown: BreakdownEntry[];
  overridden: boolean; // true if an override replaced the base
  hasBonus: boolean;   // true if any bonus is active
}

export interface AdvantageState {
  advantage: string[];    // sources of advantage
  disadvantage: string[]; // sources of disadvantage
}

// ── Main computed stat block ───────────────────────────────────────────────
export interface ComputedStats {
  // Ability scores (with full breakdown)
  abilities: Record<Ability, ComputedValue>;

  // Derived modifiers (floor((score-10)/2))
  modifiers: Record<Ability, number>;

  // Combat stats
  ac: ComputedValue;
  initiative: ComputedValue;
  speed: ComputedValue;
  proficiencyBonus: number;
  attackBonus: ComputedValue;
  spellSaveDC: ComputedValue;
  spellAttackBonus: ComputedValue;
  tempHp: number;

  // Skills (total bonus = ability mod + proficiency if proficient + bonuses)
  skills: Record<string, ComputedValue & { ability: Ability; proficient: boolean; advantage: AdvantageState }>;

  // Saving throws
  saves: Record<Ability, ComputedValue & { proficient: boolean; advantage: AdvantageState }>;

  // Carrying capacity (STR × 15 lbs, or STR × 7.5 kg)
  carryCapacity: number;

  // Passive perception (10 + WIS mod + proficiency if proficient)
  passivePerception: number;

  // Immunities and resistances (list of labels)
  immunities: string[];
  resistances: string[];

  // Custom ability labels granted by effects
  grantedAbilities: string[];

  // Effects that modified something (for the "what changed" banner)
  activeModifiers: Array<{ source: string; stat: string; description: string; color: string }>;
}

// ── Helper: parse StatMod JSON ─────────────────────────────────────────────
function parseStatMods(json: string): StatMod[] {
  try { return JSON.parse(json) || []; } catch { return []; }
}

// ── Helper: collect all StatMods from effects + equipped items ─────────────
function collectMods(effects: ActiveEffect[], items: Item[]): StatMod[] {
  const mods: StatMod[] = [];

  for (const e of effects) {
    const eMods = parseStatMods(e.statMods || "[]");
    for (const m of eMods) {
      mods.push({ ...m, source: e.name });
    }
  }

  for (const item of items) {
    if (!item.equipped) continue; // only equipped items contribute to stats
    // Items store stat mods in description if structured, but we also support
    // a dedicated statMods field we added to the schema
    const iMods = parseStatMods((item as any).statMods || "[]");
    for (const m of iMods) {
      mods.push({ ...m, source: item.name });
    }
  }

  return mods;
}

// ── Helper: extract base ability scores from characterData sections ────────
function extractBaseAbilities(characterData: string): Record<Ability, number> {
  const defaults: Record<Ability, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  try {
    const cd = JSON.parse(characterData || "{}");
    const sections: Array<{ label: string; entries: Array<{ key: string; value: string }> }> = cd.sections || [];

    const abilitySection = sections.find(s => {
      const keys = s.entries.map(e => e.key.toLowerCase().replace(/[^a-z]/g,""));
      return keys.filter(k => ["str","dex","con","int","wis","cha","strength","dexterity","constitution","intelligence","wisdom","charisma"].some(a => k.startsWith(a))).length >= 3;
    });

    if (!abilitySection) return defaults;

    for (const entry of abilitySection.entries) {
      const k = entry.key.toLowerCase().replace(/[^a-z]/g,"");
      const val = parseInt(entry.value.match(/\d+/)?.[0] ?? "10") || 10;
      if (k.startsWith("str")) defaults.str = val;
      else if (k.startsWith("dex")) defaults.dex = val;
      else if (k.startsWith("con")) defaults.con = val;
      else if (k.startsWith("int")) defaults.int = val;
      else if (k.startsWith("wis")) defaults.wis = val;
      else if (k.startsWith("cha")) defaults.cha = val;
    }
  } catch {}
  return defaults;
}

// ── Helper: extract skill proficiencies from characterData sections ─────────
function extractProficiencies(characterData: string): Set<string> {
  const proficient = new Set<string>();
  try {
    const cd = JSON.parse(characterData || "{}");
    const sections: Array<{ label: string; entries: Array<{ key: string; value: string }> }> = cd.sections || [];
    const skillSection = sections.find(s => s.label.toLowerCase().includes("skill"));
    if (skillSection) {
      for (const e of skillSection.entries) {
        // If value contains a + (e.g. "+7") the character is proficient
        if (e.value && (e.value.includes("+") || e.value.toLowerCase().includes("prof"))) {
          proficient.add(e.key);
        }
      }
    }
  } catch {}
  return proficient;
}

// ── MAIN ENGINE ────────────────────────────────────────────────────────────
export function computeStats(
  character: {
    level: number;
    hp: number;
    maxHp: number;
    characterData: string;
  },
  effects: ActiveEffect[],
  items: Item[]
): ComputedStats {
  const baseAbilities = extractBaseAbilities(character.characterData);
  const proficiencies = extractProficiencies(character.characterData);
  const allMods = collectMods(effects, items);
  const profBonus = character.level >= 17 ? 6 : character.level >= 13 ? 5 : character.level >= 9 ? 4 : character.level >= 5 ? 3 : 2;

  // ── Compute each ability score ──────────────────────────────────────────
  const computedAbilities: Record<Ability, ComputedValue> = {} as any;

  for (const ab of ABILITIES) {
    const base = baseAbilities[ab];
    const breakdown: BreakdownEntry[] = [{ label: "Base score", value: base, type: "base" }];
    let total = base;
    let overridden = false;

    // Apply overrides first (Belt of Giant Strength replaces STR)
    const overrides = allMods.filter(m => m.stat === ab && (m.type === "override" || m.type === "override_if_higher"));
    for (const o of overrides) {
      const newVal = o.overrideValue ?? o.modifier;
      if (o.type === "override" || newVal > total) {
        total = newVal;
        overridden = true;
        breakdown.push({
          label: o.source || "Override",
          value: newVal,
          type: "override",
          color: "#b8880a",
        });
      }
    }

    // Apply bonuses on top of (possibly overridden) base
    const bonuses = allMods.filter(m => m.stat === ab && m.type === "bonus");
    for (const b of bonuses) {
      total += b.modifier;
      breakdown.push({
        label: `${b.source || "Effect"} ${b.modifier > 0 ? "+" : ""}${b.modifier}`,
        value: b.modifier,
        type: b.source ? "item" : "effect",
        color: b.modifier > 0 ? "#1a5c1a" : "#8b1a1a",
      });
    }

    computedAbilities[ab] = { total, base, breakdown, overridden, hasBonus: bonuses.length > 0 || overrides.length > 0 };
  }

  // Computed modifiers
  const modifiers: Record<Ability, number> = {} as any;
  for (const ab of ABILITIES) {
    modifiers[ab] = Math.floor((computedAbilities[ab].total - 10) / 2);
  }

  // ── AC ──────────────────────────────────────────────────────────────────
  // Base AC = 10 + DEX mod (unarmoured). Items/effects may override or add.
  let acBase = 10 + modifiers.dex;
  const acBreakdown: BreakdownEntry[] = [
    { label: "Base (10 + DEX mod)", value: acBase, type: "base" },
  ];
  let acTotal = acBase;

  const acMods = allMods.filter(m => m.stat === "ac");
  for (const m of acMods) {
    if (m.type === "override") {
      acTotal = m.overrideValue ?? m.modifier;
      acBreakdown.push({ label: m.source || "Override", value: acTotal, type: "override", color: "#b8880a" });
    } else if (m.type === "bonus") {
      acTotal += m.modifier;
      acBreakdown.push({ label: `${m.source} ${m.modifier > 0 ? "+" : ""}${m.modifier}`, value: m.modifier, type: "item", color: "#1a5c1a" });
    }
  }

  // ── Initiative ──────────────────────────────────────────────────────────
  let initTotal = modifiers.dex;
  const initBreakdown: BreakdownEntry[] = [{ label: "DEX modifier", value: modifiers.dex, type: "base" }];
  for (const m of allMods.filter(m => m.stat === "initiative" && m.type === "bonus")) {
    initTotal += m.modifier;
    initBreakdown.push({ label: `${m.source} +${m.modifier}`, value: m.modifier, type: "effect" });
  }

  // ── Speed ───────────────────────────────────────────────────────────────
  let speedTotal = 30; // default, can be overridden by race in sections
  const speedBreakdown: BreakdownEntry[] = [{ label: "Base speed", value: 30, type: "base" }];
  for (const m of allMods.filter(m => m.stat === "speed")) {
    if (m.type === "bonus") { speedTotal += m.modifier; speedBreakdown.push({ label: `${m.source} ${m.modifier > 0 ? "+" : ""}${m.modifier}`, value: m.modifier, type: "effect" }); }
    if (m.type === "override") { speedTotal = m.overrideValue ?? m.modifier; speedBreakdown.push({ label: m.source || "Override", value: speedTotal, type: "override" }); }
  }

  // ── Temp HP ─────────────────────────────────────────────────────────────
  let tempHp = 0;
  for (const m of allMods.filter(m => m.stat === "tempHp" && m.type === "bonus")) {
    tempHp = Math.max(tempHp, m.modifier); // temp HP doesn't stack, take highest
  }

  // ── Attack Bonus ────────────────────────────────────────────────────────
  const atkModsList = allMods.filter(m => m.stat === "attackBonus" && m.type === "bonus");
  let atkBase = profBonus;
  let atkTotal = atkBase;
  const atkBreakdown: BreakdownEntry[] = [{ label: "Proficiency bonus", value: profBonus, type: "base" }];
  for (const m of atkModsList) {
    atkTotal += m.modifier;
    atkBreakdown.push({ label: `${m.source} +${m.modifier}`, value: m.modifier, type: "item", color: "#1a5c1a" });
  }

  // ── Spell Save DC (base: 8 + prof + primary casting ability mod) ─────────
  // We'll use INT as default; spell sheet may have a different ability
  let sdcTotal = 8 + profBonus + modifiers.int;
  const sdcBreakdown: BreakdownEntry[] = [
    { label: "8 + Prof + INT mod", value: sdcTotal, type: "base" },
  ];
  for (const m of allMods.filter(m => m.stat === "spellSaveDC" && m.type === "bonus")) {
    sdcTotal += m.modifier;
    sdcBreakdown.push({ label: `${m.source} +${m.modifier}`, value: m.modifier, type: "item" });
  }

  // ── Spell Attack Bonus ──────────────────────────────────────────────────
  let sabTotal = profBonus + modifiers.int;
  const sabBreakdown: BreakdownEntry[] = [{ label: "Prof + INT mod", value: sabTotal, type: "base" }];
  for (const m of allMods.filter(m => m.stat === "spellAttackBonus" && m.type === "bonus")) {
    sabTotal += m.modifier;
    sabBreakdown.push({ label: `${m.source} +${m.modifier}`, value: m.modifier, type: "item" });
  }

  // ── Skills ───────────────────────────────────────────────────────────────
  const computedSkills: ComputedStats["skills"] = {} as any;
  for (const [skill, ab] of Object.entries(SKILL_ABILITY)) {
    const isProficient = proficiencies.has(skill);
    const abilityMod = modifiers[ab];
    let base = abilityMod + (isProficient ? profBonus : 0);
    const breakdown: BreakdownEntry[] = [
      { label: `${ab.toUpperCase()} modifier`, value: abilityMod, type: "base" },
      ...(isProficient ? [{ label: "Proficiency", value: profBonus, type: "base" as const }] : []),
    ];
    let total = base;

    // Direct skill bonuses
    for (const m of allMods.filter(m => m.stat === skill.toLowerCase().replace(/ /g, "") || m.stat === skill)) {
      if (m.type === "bonus") {
        total += m.modifier;
        breakdown.push({ label: `${m.source} +${m.modifier}`, value: m.modifier, type: "item", color: "#1a5c1a" });
      }
    }
    // All-skill bonuses
    for (const m of allMods.filter(m => m.stat === "allSkills" && m.type === "bonus")) {
      total += m.modifier;
      breakdown.push({ label: `${m.source} +${m.modifier}`, value: m.modifier, type: "effect", color: "#1a5c1a" });
    }

    // Advantage/disadvantage
    const adv: AdvantageState = { advantage: [], disadvantage: [] };
    for (const m of allMods.filter(m => (m.stat === skill.toLowerCase().replace(/ /g,"") || m.stat === skill || m.stat === "allSkills") && (m.type === "advantage" || m.type === "disadvantage"))) {
      if (m.type === "advantage") adv.advantage.push(m.source || "Effect");
      else adv.disadvantage.push(m.source || "Effect");
    }

    computedSkills[skill] = {
      total, base, breakdown, overridden: false,
      hasBonus: total !== base,
      ability: ab, proficient: isProficient, advantage: adv,
    };
  }

  // ── Saving Throws ────────────────────────────────────────────────────────
  const computedSaves: ComputedStats["saves"] = {} as any;
  for (const ab of ABILITIES) {
    const saveKey = `${ab}Save`;
    const isProficient = proficiencies.has(`${ab.charAt(0).toUpperCase() + ab.slice(1)} Save`);
    let total = modifiers[ab] + (isProficient ? profBonus : 0);
    const breakdown: BreakdownEntry[] = [
      { label: `${ab.toUpperCase()} modifier`, value: modifiers[ab], type: "base" },
      ...(isProficient ? [{ label: "Proficiency", value: profBonus, type: "base" as const }] : []),
    ];

    for (const m of allMods.filter(m => (m.stat === saveKey || m.stat === "allSaves") && m.type === "bonus")) {
      total += m.modifier;
      breakdown.push({ label: `${m.source} +${m.modifier}`, value: m.modifier, type: "item", color: "#1a5c1a" });
    }

    const adv: AdvantageState = { advantage: [], disadvantage: [] };
    for (const m of allMods.filter(m => (m.stat === saveKey || m.stat === "allSaves") && (m.type === "advantage" || m.type === "disadvantage"))) {
      if (m.type === "advantage") adv.advantage.push(m.source || "Effect");
      else adv.disadvantage.push(m.source || "Effect");
    }

    computedSaves[ab] = { total, base: modifiers[ab], breakdown, overridden: false, hasBonus: false, proficient: isProficient, advantage: adv };
  }

  // ── Carrying capacity (STR × 15 lbs) ────────────────────────────────────
  const carryCapacity = computedAbilities.str.total * 15;

  // ── Passive Perception ───────────────────────────────────────────────────
  const passivePerception = 10 + computedSkills["Perception"].total;

  // ── Immunities, Resistances, Granted Abilities ──────────────────────────
  const immunities = allMods.filter(m => m.type === "immunity").map(m => `${m.customLabel || m.stat} (${m.source})`);
  const resistances = allMods.filter(m => m.type === "resistance").map(m => `${m.customLabel || m.stat} (${m.source})`);
  const grantedAbilities = allMods.filter(m => m.type === "custom" && m.customLabel).map(m => `${m.customLabel} (${m.source})`);

  // ── What changed summary ─────────────────────────────────────────────────
  const activeModifiers: ComputedStats["activeModifiers"] = [];
  for (const ab of ABILITIES) {
    const cv = computedAbilities[ab];
    if (cv.hasBonus) {
      for (const b of cv.breakdown.filter(b => b.type !== "base")) {
        activeModifiers.push({
          source: b.label,
          stat: ab.toUpperCase(),
          description: b.value > 0 ? `+${b.value}` : b.type === "override" ? `= ${b.value}` : `${b.value}`,
          color: b.color || "#b8880a",
        });
      }
    }
  }
  if (acMods.length > 0) {
    for (const m of acMods) {
      activeModifiers.push({ source: m.source || "", stat: "AC", description: m.type === "override" ? `= ${m.overrideValue}` : `${m.modifier > 0 ? "+" : ""}${m.modifier}`, color: "#1a5c1a" });
    }
  }

  return {
    abilities: computedAbilities,
    modifiers,
    ac: { total: acTotal, base: acBase, breakdown: acBreakdown, overridden: false, hasBonus: acMods.length > 0 },
    initiative: { total: initTotal, base: modifiers.dex, breakdown: initBreakdown, overridden: false, hasBonus: allMods.some(m => m.stat === "initiative") },
    speed: { total: speedTotal, base: 30, breakdown: speedBreakdown, overridden: false, hasBonus: false },
    proficiencyBonus: profBonus,
    attackBonus: { total: atkTotal, base: atkBase, breakdown: atkBreakdown, overridden: false, hasBonus: atkMods.length > 0 },
    spellSaveDC: { total: sdcTotal, base: 8 + profBonus + modifiers.int, breakdown: sdcBreakdown, overridden: false, hasBonus: false },
    spellAttackBonus: { total: sabTotal, base: profBonus + modifiers.int, breakdown: sabBreakdown, overridden: false, hasBonus: false },
    tempHp,
    skills: computedSkills,
    saves: computedSaves,
    carryCapacity,
    passivePerception,
    immunities,
    resistances,
    grantedAbilities,
    activeModifiers,
  };
}

// Fix reference
const atkMods: StatMod[] = []; // forward ref fix — real value computed above in closure
