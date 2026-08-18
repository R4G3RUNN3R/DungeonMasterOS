// shared/encumbrance.ts
//
// Pure encumbrance calculation (design spec §16 / Phase 6). Isomorphic —
// no DB access — same pattern as shared/combat.ts, consumed by the client
// rules adapter (client/src/lib/rulesAdapters/dnd35.ts) so the HUD's real
// Carry Weight can be derived from real data instead of a fabricated
// number.
//
// Carrying capacity is ruleset-native (spec §16: "For D&D 3.5e, Strength
// ... must drive carrying thresholds") when a Strength score is known.
// When it isn't — this branch's characters table has no ability scores of
// its own; only characters with a populated characterData.dnd35Sheet carry
// one — a documented, simplified level-derived fallback is used instead,
// mirroring the precedent set in server/combat-engine.ts for the same gap.
//
// Container/Bag-of-Holding-specific capacity logic is explicitly out of
// scope here per spec §16 ("require their own capacity/container logic
// rather than simply deleting encumbrance from the game") — deferred.

export type EncumbranceTier = "light" | "medium" | "heavy" | "overloaded";

export type LoadCapacity = {
  light: number;
  medium: number;
  heavy: number;
  source: "strength" | "level-default";
};

export type EncumbranceEffects = {
  speedPenaltyFt: number;
  maxDexBonus: number | null;
  checkPenalty: number;
};

export type EncumbranceState = {
  totalWeight: number;
  capacity: LoadCapacity;
  tier: EncumbranceTier;
  effects: EncumbranceEffects;
};

type CarriedItemLike = {
  weight?: number | null;
  quantity?: number | null;
  carried?: boolean | null;
};

// D&D 3.5e SRD Table 9-1 (Carrying Capacity), Strength 1-20. Index 0 is
// unused so the Strength score can index directly.
const STR_1_TO_20: Array<{ light: number; medium: number; heavy: number }> = [
  { light: 0, medium: 0, heavy: 0 }, // unused (Str 0)
  { light: 3, medium: 6, heavy: 10 },
  { light: 6, medium: 13, heavy: 20 },
  { light: 10, medium: 20, heavy: 30 },
  { light: 13, medium: 26, heavy: 40 },
  { light: 16, medium: 33, heavy: 50 },
  { light: 20, medium: 40, heavy: 60 },
  { light: 23, medium: 46, heavy: 70 },
  { light: 26, medium: 53, heavy: 80 },
  { light: 30, medium: 60, heavy: 90 },
  { light: 33, medium: 66, heavy: 100 },
  { light: 38, medium: 76, heavy: 115 },
  { light: 43, medium: 86, heavy: 130 },
  { light: 50, medium: 100, heavy: 150 },
  { light: 58, medium: 116, heavy: 175 },
  { light: 66, medium: 133, heavy: 200 },
  { light: 76, medium: 153, heavy: 230 },
  { light: 86, medium: 173, heavy: 260 },
  { light: 100, medium: 200, heavy: 300 },
  { light: 116, medium: 233, heavy: 350 },
  { light: 133, medium: 266, heavy: 400 },
];

/**
 * Real D&D 3.5e carrying capacity by Strength score. Strength scores above
 * 20 are approximated by doubling the Strength-20 capacity for every full
 * 10 points beyond 20 (the commonly used simplification of the SRD's
 * Strength-over-20 multiplier table) — exact only up to Str 20.
 */
export function carryingCapacityForStrength(strength: number): LoadCapacity {
  const str = Math.max(1, Math.round(strength));
  if (str <= 20) {
    const row = STR_1_TO_20[str];
    return { ...row, source: "strength" };
  }
  const overBy = str - 20;
  const doublings = Math.floor(overBy / 10) + (overBy % 10 > 0 ? 1 : 0);
  const multiplier = 2 ** doublings;
  const base = STR_1_TO_20[20];
  return {
    light: base.light * multiplier,
    medium: base.medium * multiplier,
    heavy: base.heavy * multiplier,
    source: "strength",
  };
}

/**
 * Simplified, explicitly non-canonical fallback for characters with no
 * Strength score on record. Scales with level only, at roughly the rate a
 * STR 10-14 character would see across levels 1-20 — good enough to make
 * the HUD's Carry stat meaningful without inventing a fake ability score.
 */
export function defaultCarryingCapacityForLevel(level: number): LoadCapacity {
  const lvl = Math.max(1, Math.round(level));
  const medium = 60 + lvl * 6;
  return { light: Math.round(medium * 0.5), medium, heavy: medium * 2, source: "level-default" };
}

export function totalCarriedWeight(items: CarriedItemLike[]): number {
  return items.reduce((sum, item) => {
    if (item.carried === false) return sum;
    const weight = typeof item.weight === "number" && Number.isFinite(item.weight) ? item.weight : 0;
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
    return sum + weight * quantity;
  }, 0);
}

export function encumbranceTier(totalWeight: number, capacity: LoadCapacity): EncumbranceTier {
  if (totalWeight <= capacity.light) return "light";
  if (totalWeight <= capacity.medium) return "medium";
  if (totalWeight <= capacity.heavy) return "heavy";
  return "overloaded";
}

/** Standard 3.5e load penalties (SRD Table 9-4), same effects a medium/heavy armor imposes. */
export function encumbranceEffects(tier: EncumbranceTier): EncumbranceEffects {
  switch (tier) {
    case "light":
      return { speedPenaltyFt: 0, maxDexBonus: null, checkPenalty: 0 };
    case "medium":
      return { speedPenaltyFt: 10, maxDexBonus: 3, checkPenalty: 3 };
    case "heavy":
      return { speedPenaltyFt: 10, maxDexBonus: 1, checkPenalty: 6 };
    case "overloaded":
      // Can't move under an overloaded load until weight is dropped.
      return { speedPenaltyFt: Number.POSITIVE_INFINITY, maxDexBonus: 0, checkPenalty: 6 };
  }
}

export function computeEncumbrance(items: CarriedItemLike[], capacity: LoadCapacity): EncumbranceState {
  const totalWeight = totalCarriedWeight(items);
  const tier = encumbranceTier(totalWeight, capacity);
  return { totalWeight, capacity, tier, effects: encumbranceEffects(tier) };
}
