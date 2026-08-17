// Reference implementation only. Public SRD spell progression and multiclass slot rules.

import type { Dnd5eCharacterState, Dnd5eRulesProfileId } from "./domain";
import { classTotals } from "./state-helpers";
import { get2014Class } from "./classes-2014";
import { get2024Class } from "./classes-2024";
import { abilityModifier, proficiencyBonus, spellAttackBonus, spellSaveDc } from "./core-tables";

export type SpellSlots = Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, number>>;

const SLOTS_BY_CASTER_LEVEL: Record<number, SpellSlots> = {
  1: { 1: 2 }, 2: { 1: 3 }, 3: { 1: 4, 2: 2 }, 4: { 1: 4, 2: 3 },
  5: { 1: 4, 2: 3, 3: 2 }, 6: { 1: 4, 2: 3, 3: 3 }, 7: { 1: 4, 2: 3, 3: 3, 4: 1 },
  8: { 1: 4, 2: 3, 3: 3, 4: 2 }, 9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, 11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, 13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, 15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
};

const HALF_CASTER_SLOTS_2014: Record<number, SpellSlots> = {
  1: {}, 2: { 1: 2 }, 3: { 1: 3 }, 4: { 1: 3 }, 5: { 1: 4, 2: 2 }, 6: { 1: 4, 2: 2 },
  7: { 1: 4, 2: 3 }, 8: { 1: 4, 2: 3 }, 9: { 1: 4, 2: 3, 3: 2 }, 10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 }, 12: { 1: 4, 2: 3, 3: 3 }, 13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 1 }, 15: { 1: 4, 2: 3, 3: 3, 4: 2 }, 16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, 20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
};

const HALF_CASTER_SLOTS_2024: Record<number, SpellSlots> = {
  1: { 1: 2 }, 2: { 1: 2 }, 3: { 1: 3 }, 4: { 1: 3 }, 5: { 1: 4, 2: 2 }, 6: { 1: 4, 2: 2 },
  7: { 1: 4, 2: 3 }, 8: { 1: 4, 2: 3 }, 9: { 1: 4, 2: 3, 3: 2 }, 10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 }, 12: { 1: 4, 2: 3, 3: 3 }, 13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 1 }, 15: { 1: 4, 2: 3, 3: 3, 4: 2 }, 16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, 18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, 20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
};

export const PREPARED_COUNTS_2024: Record<string, number[]> = {
  bard: [4,5,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22],
  cleric: [4,5,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22],
  druid: [4,5,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22],
  paladin: [2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15],
  ranger: [2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15],
  sorcerer: [2,4,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22],
  warlock: [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15],
  wizard: [4,5,6,7,9,10,11,12,14,15,16,16,17,18,19,21,22,23,24,25],
};

export const CANTRIP_COUNTS_2024: Record<string, number[]> = {
  bard: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  cleric: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
  druid: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  sorcerer: [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6],
  warlock: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  wizard: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
};

export const SPELLS_KNOWN_2014: Partial<Record<string, number[]>> = {
  bard: [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22],
  ranger: [0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11],
  sorcerer: [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15],
  warlock: [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15],
};

export const CANTRIP_COUNTS_2014: Partial<Record<string, number[]>> = {
  bard: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  cleric: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
  druid: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  sorcerer: [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6],
  warlock: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  wizard: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
};

export const WARLOCK_PACT_2024 = {
  slots: [1,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4],
  slotLevel: [1,1,2,2,3,3,4,4,5,5,5,5,5,5,5,5,5,5,5,5],
  invocations: [1,3,3,3,5,5,6,6,7,7,7,8,8,8,9,9,9,10,10,10],
} as const;

export const WARLOCK_PACT_2014 = {
  slots: [1,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4],
  slotLevel: [1,1,2,2,3,3,4,4,5,5,5,5,5,5,5,5,5,5,5,5],
  invocations: [0,2,2,2,3,3,4,4,5,5,5,6,6,6,7,7,7,8,8,8],
} as const;

export function classSlots(profile: Dnd5eRulesProfileId, classId: string, classLevel: number): SpellSlots {
  if (classLevel < 1 || classLevel > 20) return {};
  if (classId === "warlock") return {};
  const cls = profile === "dnd5e-2024" ? get2024Class(classId) : get2014Class(classId);
  if (!cls?.spellcasting) return {};
  if (cls.spellcasting.mode === "full") return { ...SLOTS_BY_CASTER_LEVEL[classLevel] };
  if (cls.spellcasting.mode === "half") {
    return { ...(profile === "dnd5e-2024" ? HALF_CASTER_SLOTS_2024[classLevel] : HALF_CASTER_SLOTS_2014[classLevel]) };
  }
  return {};
}

export function preparedOrKnownCount(profile: Dnd5eRulesProfileId, classId: string, classLevel: number, castingAbilityScore?: number): number | undefined {
  if (classLevel < 1 || classLevel > 20) return undefined;
  if (profile === "dnd5e-2024") return PREPARED_COUNTS_2024[classId]?.[classLevel - 1];

  const known = SPELLS_KNOWN_2014[classId]?.[classLevel - 1];
  if (known !== undefined) return known;

  if (castingAbilityScore === undefined) return undefined;
  const mod = abilityModifier(castingAbilityScore);
  if (["cleric", "druid", "wizard"].includes(classId)) return Math.max(1, classLevel + mod);
  if (classId === "paladin" && classLevel >= 2) return Math.max(1, Math.floor(classLevel / 2) + mod);
  return undefined;
}

export function cantripCount(profile: Dnd5eRulesProfileId, classId: string, classLevel: number): number | undefined {
  const table = profile === "dnd5e-2024" ? CANTRIP_COUNTS_2024 : CANTRIP_COUNTS_2014;
  return table[classId]?.[classLevel - 1];
}

export function pactMagic(profile: Dnd5eRulesProfileId, warlockLevel: number) {
  if (warlockLevel < 1 || warlockLevel > 20) return undefined;
  const table = profile === "dnd5e-2024" ? WARLOCK_PACT_2024 : WARLOCK_PACT_2014;
  return {
    slots: table.slots[warlockLevel - 1],
    slotLevel: table.slotLevel[warlockLevel - 1],
    invocations: table.invocations[warlockLevel - 1],
  };
}

/**
 * Combined Spellcasting caster level. Pact Magic remains separate.
 * 2014 rounds Paladin/Ranger down; 2024 rounds them up.
 */
export function multiclassSpellcasterLevel(state: Dnd5eCharacterState): number {
  const totals = classTotals(state.levels);
  let value = 0;
  for (const [classId, levels] of Object.entries(totals)) {
    if (["bard", "cleric", "druid", "sorcerer", "wizard"].includes(classId)) value += levels;
    else if (["paladin", "ranger"].includes(classId)) {
      value += state.rulesProfileId === "dnd5e-2024" ? Math.ceil(levels / 2) : Math.floor(levels / 2);
    }
    // One-third and other source-pack spellcasters register contributions through source-pack adapters.
  }
  return Math.min(20, value);
}

export function multiclassSpellSlots(state: Dnd5eCharacterState): SpellSlots {
  return { ...(SLOTS_BY_CASTER_LEVEL[multiclassSpellcasterLevel(state)] ?? {}) };
}

export function spellcastingNumbers(input: {
  characterLevel: number;
  abilityScore: number;
  miscDc?: number;
  miscAttack?: number;
}) {
  const pb = proficiencyBonus(input.characterLevel);
  return {
    saveDc: spellSaveDc(pb, input.abilityScore, input.miscDc ?? 0),
    attackBonus: spellAttackBonus(pb, input.abilityScore, input.miscAttack ?? 0),
  };
}

export function wizardSpellbookEntitlement(profile: Dnd5eRulesProfileId, wizardLevel: number) {
  if (wizardLevel < 1) return null;
  if (wizardLevel === 1) return { spellLevelMaximum: 1, spellsAdded: 6, playerChooses: true };
  const maximumSpellLevel = Math.min(9, Math.ceil(wizardLevel / 2));
  return { spellLevelMaximum: maximumSpellLevel, spellsAdded: 2, playerChooses: true, profile };
}

export function classPreparationModel(profile: Dnd5eRulesProfileId, classId: string): string | undefined {
  return (profile === "dnd5e-2024" ? get2024Class(classId) : get2014Class(classId))?.spellcasting?.preparationModel;
}
