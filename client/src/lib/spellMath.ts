// client/src/lib/spellMath.ts
//
// 3.5e-specific spell math, extracted so it's independently testable
// without React. 3.5e has no single flat "spell save DC" the way 5e
// does — every spell level has its own DC (design spec 2026-08-20).
// 5e's flat-DC logic stays where it already lives, in SpellSheet.tsx,
// untouched — this file only ever backs the dnd35e path.

import type { Ability } from "./characterSheetTypes";

export function spellSaveDcFor3e(spellLevel: number, abilityModifier: number): number {
  return 10 + spellLevel + abilityModifier;
}

const ABILITY_KEYS: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

export function resolveCastingAbilityScore(
  abilities: Record<Ability, { score: number; modifier: number }>,
  castingAbility: string,
): { score: number; modifier: number } | null {
  const normalized = castingAbility.trim().slice(0, 3).toLowerCase();
  const match = ABILITY_KEYS.find((k) => k === normalized);
  return match ? abilities[match] : null;
}
