// Reference implementation only.
// 5e is not a 3.5-style typed-bonus engine. Advantage/Disadvantage are state,
// Proficiency is constrained, and repeated copies of the same named effect must
// not become an accidental numeric-stacking scheme.

import type { Dnd5eRulesProfileId } from "./domain";
import { normalizeAdvantageState } from "./core-tables";

export type Dnd5eModifierTarget =
  | "ac"
  | "initiative"
  | "speed"
  | "max-hp"
  | "attack"
  | "damage"
  | "spell-save-dc"
  | "spell-attack"
  | `ability:${"str" | "dex" | "con" | "int" | "wis" | "cha"}`
  | `save:${"str" | "dex" | "con" | "int" | "wis" | "cha"}`
  | `skill:${string}`
  | (string & {});

export type Dnd5eNumericModifier = {
  id: string;
  profileId: Dnd5eRulesProfileId;
  target: Dnd5eModifierTarget;
  amount: number;
  sourceId: string;
  sourceLabel: string;
  stackingKey?: string;
  condition?: string;
};

export type Dnd5eRollStateModifier = {
  id: string;
  profileId: Dnd5eRulesProfileId;
  target: string;
  state: "advantage" | "disadvantage";
  sourceId: string;
  sourceLabel: string;
  condition?: string;
};

export type ResolvedD20State = {
  state: "normal" | "advantage" | "disadvantage";
  advantageSources: Dnd5eRollStateModifier[];
  disadvantageSources: Dnd5eRollStateModifier[];
};

/** Remove duplicate emission of the same feature/effect source. */
export function dedupeNumericModifiers(modifiers: Dnd5eNumericModifier[]): Dnd5eNumericModifier[] {
  const seen = new Set<string>();
  return modifiers.filter((modifier) => {
    const key = `${modifier.profileId}|${modifier.id}|${modifier.sourceId}|${modifier.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Optional stackingKey expresses a rule-specific non-stacking family. If present,
 * only the highest positive and most severe negative member of that family apply.
 * Do NOT globally invent 3.5-style bonus types for 5e.
 */
export function sumNumericModifiers(modifiers: Dnd5eNumericModifier[]): number {
  const deduped = dedupeNumericModifiers(modifiers);
  const free: Dnd5eNumericModifier[] = [];
  const grouped = new Map<string, Dnd5eNumericModifier[]>();

  for (const modifier of deduped) {
    if (!modifier.stackingKey) free.push(modifier);
    else grouped.set(modifier.stackingKey, [...(grouped.get(modifier.stackingKey) ?? []), modifier]);
  }

  let total = free.reduce((sum, modifier) => sum + modifier.amount, 0);
  for (const group of grouped.values()) {
    const positives = group.filter((modifier) => modifier.amount > 0);
    const negatives = group.filter((modifier) => modifier.amount < 0);
    if (positives.length) total += Math.max(...positives.map((modifier) => modifier.amount));
    if (negatives.length) total += Math.min(...negatives.map((modifier) => modifier.amount));
  }
  return total;
}

export function resolveD20State(
  modifiers: Dnd5eRollStateModifier[],
  target: string,
): ResolvedD20State {
  const relevant = modifiers.filter((modifier) => modifier.target === target);
  const advantageSources = relevant.filter((modifier) => modifier.state === "advantage");
  const disadvantageSources = relevant.filter((modifier) => modifier.state === "disadvantage");
  return {
    state: normalizeAdvantageState(advantageSources.length, disadvantageSources.length),
    advantageSources,
    disadvantageSources,
  };
}

export function validateModifierProfile(
  expectedProfile: Dnd5eRulesProfileId,
  modifiers: Array<Dnd5eNumericModifier | Dnd5eRollStateModifier>,
): string[] {
  return modifiers
    .filter((modifier) => modifier.profileId !== expectedProfile)
    .map((modifier) => `Modifier ${modifier.id} belongs to ${modifier.profileId}, not ${expectedProfile}.`);
}
