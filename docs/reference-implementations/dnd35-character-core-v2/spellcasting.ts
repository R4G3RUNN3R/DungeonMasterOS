// Reference implementation only.
// Core PHB/SRD spell-slot progressions for the seven spellcasting base classes.

import type { CoreClassId, Dnd35Ability } from "./domain";
import { abilityModifier } from "./mechanics";

export type SpellLevelSlots = Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, number>>;

export type ClassSpellProgression = {
  classId: CoreClassId;
  castingAbility: Dnd35Ability;
  prepared: boolean;
  spontaneous: boolean;
  maxSpellLevel: number;
  baseSlotsByClassLevel: Record<number, SpellLevelSlots>;
  spellsKnownByClassLevel?: Record<number, SpellLevelSlots>;
  domainSlotPerAvailableLevel?: boolean;
  casterLevel: (classLevel: number) => number;
};

const row = (...values: Array<number | null>): SpellLevelSlots => {
  const result: SpellLevelSlots = {};
  values.forEach((value, level) => {
    if (value !== null) result[level as keyof SpellLevelSlots] = value;
  });
  return result;
};

const fullCasterRows: Record<number, SpellLevelSlots> = {
  1: row(3, 1, null, null, null, null, null, null, null, null),
  2: row(4, 2, null, null, null, null, null, null, null, null),
  3: row(4, 2, 1, null, null, null, null, null, null, null),
  4: row(4, 3, 2, null, null, null, null, null, null, null),
  5: row(4, 3, 2, 1, null, null, null, null, null, null),
  6: row(4, 3, 3, 2, null, null, null, null, null, null),
  7: row(4, 4, 3, 2, 1, null, null, null, null, null),
  8: row(4, 4, 3, 3, 2, null, null, null, null, null),
  9: row(4, 4, 4, 3, 2, 1, null, null, null, null),
  10: row(4, 4, 4, 3, 3, 2, null, null, null, null),
  11: row(4, 4, 4, 4, 3, 2, 1, null, null, null),
  12: row(4, 4, 4, 4, 3, 3, 2, null, null, null),
  13: row(4, 4, 4, 4, 4, 3, 2, 1, null, null),
  14: row(4, 4, 4, 4, 4, 3, 3, 2, null, null),
  15: row(4, 4, 4, 4, 4, 4, 3, 2, 1, null),
  16: row(4, 4, 4, 4, 4, 4, 3, 3, 2, null),
  17: row(4, 4, 4, 4, 4, 4, 4, 3, 2, 1),
  18: row(4, 4, 4, 4, 4, 4, 4, 3, 3, 2),
  19: row(4, 4, 4, 4, 4, 4, 4, 4, 3, 3),
  20: row(4, 4, 4, 4, 4, 4, 4, 4, 4, 4),
};

const druidRows: Record<number, SpellLevelSlots> = {
  1: row(3, 1, null, null, null, null, null, null, null, null),
  2: row(4, 2, null, null, null, null, null, null, null, null),
  3: row(4, 2, 1, null, null, null, null, null, null, null),
  4: row(5, 3, 2, null, null, null, null, null, null, null),
  5: row(5, 3, 2, 1, null, null, null, null, null, null),
  6: row(5, 3, 3, 2, null, null, null, null, null, null),
  7: row(6, 4, 3, 2, 1, null, null, null, null, null),
  8: row(6, 4, 3, 3, 2, null, null, null, null, null),
  9: row(6, 4, 4, 3, 2, 1, null, null, null, null),
  10: row(6, 4, 4, 3, 3, 2, null, null, null, null),
  11: row(6, 5, 4, 4, 3, 2, 1, null, null, null),
  12: row(6, 5, 4, 4, 3, 3, 2, null, null, null),
  13: row(6, 5, 5, 4, 4, 3, 2, 1, null, null),
  14: row(6, 5, 5, 4, 4, 3, 3, 2, null, null),
  15: row(6, 5, 5, 5, 4, 4, 3, 2, 1, null),
  16: row(6, 5, 5, 5, 4, 4, 3, 3, 2, null),
  17: row(6, 5, 5, 5, 5, 4, 4, 3, 2, 1),
  18: row(6, 5, 5, 5, 5, 4, 4, 3, 3, 2),
  19: row(6, 5, 5, 5, 5, 5, 4, 4, 3, 3),
  20: row(6, 5, 5, 5, 5, 5, 4, 4, 4, 4),
};

const clericRows: Record<number, SpellLevelSlots> = {
  1: row(3, 1, null, null, null, null, null, null, null, null),
  2: row(4, 2, null, null, null, null, null, null, null, null),
  3: row(4, 2, 1, null, null, null, null, null, null, null),
  4: row(5, 3, 2, null, null, null, null, null, null, null),
  5: row(5, 3, 2, 1, null, null, null, null, null, null),
  6: row(5, 3, 3, 2, null, null, null, null, null, null),
  7: row(6, 4, 3, 2, 1, null, null, null, null, null),
  8: row(6, 4, 3, 3, 2, null, null, null, null, null),
  9: row(6, 4, 4, 3, 2, 1, null, null, null, null),
  10: row(6, 4, 4, 3, 3, 2, null, null, null, null),
  11: row(6, 5, 4, 4, 3, 2, 1, null, null, null),
  12: row(6, 5, 4, 4, 3, 3, 2, null, null, null),
  13: row(6, 5, 5, 4, 4, 3, 2, 1, null, null),
  14: row(6, 5, 5, 4, 4, 3, 3, 2, null, null),
  15: row(6, 5, 5, 5, 4, 4, 3, 2, 1, null),
  16: row(6, 5, 5, 5, 4, 4, 3, 3, 2, null),
  17: row(6, 5, 5, 5, 5, 4, 4, 3, 2, 1),
  18: row(6, 5, 5, 5, 5, 4, 4, 3, 3, 2),
  19: row(6, 5, 5, 5, 5, 5, 4, 4, 3, 3),
  20: row(6, 5, 5, 5, 5, 5, 4, 4, 4, 4),
};

const sorcererRows: Record<number, SpellLevelSlots> = {
  1: row(5, 3, null, null, null, null, null, null, null, null),
  2: row(6, 4, null, null, null, null, null, null, null, null),
  3: row(6, 5, null, null, null, null, null, null, null, null),
  4: row(6, 6, 3, null, null, null, null, null, null, null),
  5: row(6, 6, 4, null, null, null, null, null, null, null),
  6: row(6, 6, 5, 3, null, null, null, null, null, null),
  7: row(6, 6, 6, 4, null, null, null, null, null, null),
  8: row(6, 6, 6, 5, 3, null, null, null, null, null),
  9: row(6, 6, 6, 6, 4, null, null, null, null, null),
  10: row(6, 6, 6, 6, 5, 3, null, null, null, null),
  11: row(6, 6, 6, 6, 6, 4, null, null, null, null),
  12: row(6, 6, 6, 6, 6, 5, 3, null, null, null),
  13: row(6, 6, 6, 6, 6, 6, 4, null, null, null),
  14: row(6, 6, 6, 6, 6, 6, 5, 3, null, null),
  15: row(6, 6, 6, 6, 6, 6, 6, 4, null, null),
  16: row(6, 6, 6, 6, 6, 6, 6, 5, 3, null),
  17: row(6, 6, 6, 6, 6, 6, 6, 6, 4, null),
  18: row(6, 6, 6, 6, 6, 6, 6, 6, 5, 3),
  19: row(6, 6, 6, 6, 6, 6, 6, 6, 6, 4),
  20: row(6, 6, 6, 6, 6, 6, 6, 6, 6, 6),
};

const sorcererKnown: Record<number, SpellLevelSlots> = {
  1: row(4, 2, null, null, null, null, null, null, null, null),
  2: row(5, 2, null, null, null, null, null, null, null, null),
  3: row(5, 3, null, null, null, null, null, null, null, null),
  4: row(6, 3, 1, null, null, null, null, null, null, null),
  5: row(6, 4, 2, null, null, null, null, null, null, null),
  6: row(7, 4, 2, 1, null, null, null, null, null, null),
  7: row(7, 5, 3, 2, null, null, null, null, null, null),
  8: row(8, 5, 3, 2, 1, null, null, null, null, null),
  9: row(8, 5, 4, 3, 2, null, null, null, null, null),
  10: row(9, 5, 4, 3, 2, 1, null, null, null, null),
  11: row(9, 5, 5, 4, 3, 2, null, null, null, null),
  12: row(9, 5, 5, 4, 3, 2, 1, null, null, null),
  13: row(9, 5, 5, 4, 4, 3, 2, null, null, null),
  14: row(9, 5, 5, 4, 4, 3, 2, 1, null, null),
  15: row(9, 5, 5, 4, 4, 4, 3, 2, null, null),
  16: row(9, 5, 5, 4, 4, 4, 3, 2, 1, null),
  17: row(9, 5, 5, 4, 4, 4, 3, 3, 2, null),
  18: row(9, 5, 5, 4, 4, 4, 3, 3, 2, 1),
  19: row(9, 5, 5, 4, 4, 4, 3, 3, 3, 2),
  20: row(9, 5, 5, 4, 4, 4, 3, 3, 3, 3),
};

const bardRows: Record<number, SpellLevelSlots> = {
  1: row(2, null, null, null, null, null, null),
  2: row(3, 0, null, null, null, null, null),
  3: row(3, 1, null, null, null, null, null),
  4: row(3, 2, 0, null, null, null, null),
  5: row(3, 3, 1, null, null, null, null),
  6: row(3, 3, 2, null, null, null, null),
  7: row(3, 3, 2, 0, null, null, null),
  8: row(3, 3, 3, 1, null, null, null),
  9: row(3, 3, 3, 2, null, null, null),
  10: row(3, 3, 3, 2, 0, null, null),
  11: row(3, 3, 3, 3, 1, null, null),
  12: row(3, 3, 3, 3, 2, null, null),
  13: row(3, 3, 3, 3, 2, 0, null),
  14: row(4, 3, 3, 3, 3, 1, null),
  15: row(4, 4, 3, 3, 3, 2, null),
  16: row(4, 4, 4, 3, 3, 2, 0),
  17: row(4, 4, 4, 4, 3, 3, 1),
  18: row(4, 4, 4, 4, 4, 3, 2),
  19: row(4, 4, 4, 4, 4, 4, 3),
  20: row(4, 4, 4, 4, 4, 4, 4),
};

const bardKnown: Record<number, SpellLevelSlots> = {
  1: row(4, null, null, null, null, null, null),
  2: row(5, 2, null, null, null, null, null),
  3: row(6, 3, null, null, null, null, null),
  4: row(6, 3, 2, null, null, null, null),
  5: row(6, 4, 3, null, null, null, null),
  6: row(6, 4, 3, null, null, null, null),
  7: row(6, 4, 4, 2, null, null, null),
  8: row(6, 4, 4, 3, null, null, null),
  9: row(6, 4, 4, 3, null, null, null),
  10: row(6, 4, 4, 4, 2, null, null),
  11: row(6, 4, 4, 4, 3, null, null),
  12: row(6, 4, 4, 4, 3, null, null),
  13: row(6, 4, 4, 4, 4, 2, null),
  14: row(6, 4, 4, 4, 4, 3, null),
  15: row(6, 4, 4, 4, 4, 3, null),
  16: row(6, 5, 4, 4, 4, 4, 2),
  17: row(6, 5, 5, 4, 4, 4, 3),
  18: row(6, 5, 5, 5, 4, 4, 3),
  19: row(6, 5, 5, 5, 5, 4, 4),
  20: row(6, 5, 5, 5, 5, 5, 4),
};

const paladinRows: Record<number, SpellLevelSlots> = {
  1: {}, 2: {}, 3: {}, 4: { 1: 0 }, 5: { 1: 0 },
  6: { 1: 1 }, 7: { 1: 1 }, 8: { 1: 1, 2: 0 }, 9: { 1: 1, 2: 0 },
  10: { 1: 1, 2: 1 }, 11: { 1: 1, 2: 1, 3: 0 }, 12: { 1: 1, 2: 1, 3: 1 },
  13: { 1: 1, 2: 1, 3: 1 }, 14: { 1: 2, 2: 1, 3: 1, 4: 0 }, 15: { 1: 2, 2: 1, 3: 1, 4: 1 },
  16: { 1: 2, 2: 2, 3: 1, 4: 1 }, 17: { 1: 2, 2: 2, 3: 2, 4: 1 }, 18: { 1: 3, 2: 2, 3: 2, 4: 1 },
  19: { 1: 3, 2: 3, 3: 3, 4: 2 }, 20: { 1: 3, 2: 3, 3: 3, 4: 3 },
};

const rangerRows: Record<number, SpellLevelSlots> = {
  1: {}, 2: {}, 3: {}, 4: { 1: 0 }, 5: { 1: 0 },
  6: { 1: 1 }, 7: { 1: 1 }, 8: { 1: 1, 2: 0 }, 9: { 1: 1, 2: 0 },
  10: { 1: 1, 2: 1 }, 11: { 1: 1, 2: 1, 3: 0 }, 12: { 1: 1, 2: 1, 3: 1 },
  13: { 1: 1, 2: 1, 3: 1 }, 14: { 1: 2, 2: 1, 3: 1, 4: 0 }, 15: { 1: 2, 2: 1, 3: 1, 4: 1 },
  16: { 1: 2, 2: 2, 3: 1, 4: 1 }, 17: { 1: 2, 2: 2, 3: 2, 4: 1 }, 18: { 1: 3, 2: 2, 3: 2, 4: 1 },
  19: { 1: 3, 2: 3, 3: 3, 4: 2 }, 20: { 1: 3, 2: 3, 3: 3, 4: 3 },
};

export const CORE_SPELL_PROGRESSION: Partial<Record<CoreClassId, ClassSpellProgression>> = {
  bard: {
    classId: "bard", castingAbility: "cha", prepared: false, spontaneous: true, maxSpellLevel: 6,
    baseSlotsByClassLevel: bardRows, spellsKnownByClassLevel: bardKnown, casterLevel: (level) => level,
  },
  cleric: {
    classId: "cleric", castingAbility: "wis", prepared: true, spontaneous: false, maxSpellLevel: 9,
    baseSlotsByClassLevel: clericRows, domainSlotPerAvailableLevel: true, casterLevel: (level) => level,
  },
  druid: {
    classId: "druid", castingAbility: "wis", prepared: true, spontaneous: false, maxSpellLevel: 9,
    baseSlotsByClassLevel: druidRows, casterLevel: (level) => level,
  },
  paladin: {
    classId: "paladin", castingAbility: "wis", prepared: true, spontaneous: false, maxSpellLevel: 4,
    baseSlotsByClassLevel: paladinRows, casterLevel: (level) => level < 4 ? 0 : Math.floor(level / 2),
  },
  ranger: {
    classId: "ranger", castingAbility: "wis", prepared: true, spontaneous: false, maxSpellLevel: 4,
    baseSlotsByClassLevel: rangerRows, casterLevel: (level) => level < 4 ? 0 : Math.floor(level / 2),
  },
  sorcerer: {
    classId: "sorcerer", castingAbility: "cha", prepared: false, spontaneous: true, maxSpellLevel: 9,
    baseSlotsByClassLevel: sorcererRows, spellsKnownByClassLevel: sorcererKnown, casterLevel: (level) => level,
  },
  wizard: {
    classId: "wizard", castingAbility: "int", prepared: true, spontaneous: false, maxSpellLevel: 9,
    baseSlotsByClassLevel: fullCasterRows, casterLevel: (level) => level,
  },
};

export function bonusSpellsPerDay(abilityScore: number, spellLevel: number): number {
  if (spellLevel <= 0 || spellLevel > 9) return 0;
  const modifier = abilityModifier(abilityScore);
  if (modifier < spellLevel) return 0;
  return Math.floor((modifier - spellLevel) / 4) + 1;
}

export function canCastSpellLevel(abilityScore: number, spellLevel: number): boolean {
  return spellLevel === 0 || abilityScore >= 10 + spellLevel;
}

export function totalSlotsForClassLevel(
  classId: CoreClassId,
  classLevel: number,
  castingAbilityScore: number,
): SpellLevelSlots {
  const progression = CORE_SPELL_PROGRESSION[classId];
  if (!progression) return {};
  const base = progression.baseSlotsByClassLevel[classLevel] ?? {};
  const result: SpellLevelSlots = {};

  for (let spellLevel = 0; spellLevel <= progression.maxSpellLevel; spellLevel += 1) {
    const baseValue = base[spellLevel as keyof SpellLevelSlots];
    if (baseValue === undefined) continue;
    if (!canCastSpellLevel(castingAbilityScore, spellLevel)) {
      result[spellLevel as keyof SpellLevelSlots] = 0;
      continue;
    }
    const bonus = spellLevel === 0 ? 0 : bonusSpellsPerDay(castingAbilityScore, spellLevel);
    result[spellLevel as keyof SpellLevelSlots] = baseValue + bonus;
  }

  return result;
}

export function domainSlotsForCleric(classLevel: number, wisdomScore: number): SpellLevelSlots {
  const base = clericRows[classLevel] ?? {};
  const result: SpellLevelSlots = {};
  for (let spellLevel = 1; spellLevel <= 9; spellLevel += 1) {
    if (base[spellLevel as keyof SpellLevelSlots] !== undefined && canCastSpellLevel(wisdomScore, spellLevel)) {
      result[spellLevel as keyof SpellLevelSlots] = 1;
    }
  }
  return result;
}

export function spellsKnownEntitlement(classId: CoreClassId, classLevel: number): SpellLevelSlots | undefined {
  return CORE_SPELL_PROGRESSION[classId]?.spellsKnownByClassLevel?.[classLevel];
}
