// Reference implementation only.
// D&D 3.5e bonuses of the same type generally do not stack. This file makes
// that rule explicit instead of treating every `+N` JSON entry as additive.

export type Dnd35BonusType =
  | "armor"
  | "shield"
  | "enhancement"
  | "deflection"
  | "natural_armor"
  | "dodge"
  | "circumstance"
  | "competence"
  | "insight"
  | "luck"
  | "morale"
  | "profane"
  | "racial"
  | "resistance"
  | "sacred"
  | "size"
  | "untyped"
  | "penalty";

export type Dnd35ModifierTarget =
  | "ac"
  | "touch-ac"
  | "flat-footed-ac"
  | "initiative"
  | "attack"
  | "damage"
  | "grapple"
  | "speed"
  | "max-hp"
  | "caster-level"
  | `ability:${"str" | "dex" | "con" | "int" | "wis" | "cha"}`
  | `save:${"fortitude" | "reflex" | "will" | "any"}`
  | `skill:${string}`
  | `spell-dc:${string}`
  | (string & {});

export type Dnd35RuleContext = {
  targetCreatureTypes?: string[];
  targetCreatureSubtypes?: string[];
  sourceTags?: string[];
  actionTags?: string[];
  damageTypes?: string[];
  isFlatFooted?: boolean;
  customFlags?: Record<string, boolean | string | number>;
};

export type Dnd35ModifierCondition = {
  /** Optional machine-readable tags. Prefer these over natural-language conditions. */
  requiresTargetType?: string;
  requiresTargetSubtype?: string;
  requiresActionTag?: string;
  requiresSourceTag?: string;
  requiresCustomFlag?: string;
  /** Documentation/fallback only; never parse this string for authoritative rules. */
  description?: string;
};

export type Dnd35Modifier = {
  id: string;
  target: Dnd35ModifierTarget;
  amount: number;
  bonusType: Dnd35BonusType;
  sourceId: string;
  sourceLabel: string;
  condition?: Dnd35ModifierCondition;
  /** Explicit override for rare rules where a bonus that normally would not stack is allowed to. */
  stacksWithSameType?: boolean;
};

export type AppliedModifierGroup = {
  total: number;
  applied: Dnd35Modifier[];
  suppressed: Dnd35Modifier[];
};

const ALWAYS_STACKING_TYPES = new Set<Dnd35BonusType>([
  "dodge",
  "circumstance",
  "untyped",
  "penalty",
]);

export function conditionMatches(condition: Dnd35ModifierCondition | undefined, context: Dnd35RuleContext): boolean {
  if (!condition) return true;

  if (condition.requiresTargetType && !context.targetCreatureTypes?.includes(condition.requiresTargetType)) return false;
  if (condition.requiresTargetSubtype && !context.targetCreatureSubtypes?.includes(condition.requiresTargetSubtype)) return false;
  if (condition.requiresActionTag && !context.actionTags?.includes(condition.requiresActionTag)) return false;
  if (condition.requiresSourceTag && !context.sourceTags?.includes(condition.requiresSourceTag)) return false;
  if (condition.requiresCustomFlag && !context.customFlags?.[condition.requiresCustomFlag]) return false;

  return true;
}

/**
 * Remove duplicate emissions of the same rule source before stacking.
 * This blocks a common persistence/UI bug where one equipped item is adapted
 * twice and its bonus accidentally doubles.
 */
export function dedupeModifiers(modifiers: Dnd35Modifier[]): Dnd35Modifier[] {
  const seen = new Set<string>();
  const result: Dnd35Modifier[] = [];

  for (const modifier of modifiers) {
    const key = `${modifier.id}|${modifier.target}|${modifier.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(modifier);
  }

  return result;
}

/**
 * Apply D&D 3.5e-style typed stacking for one target.
 *
 * - dodge/circumstance/untyped bonuses stack after duplicate-source removal
 * - penalties stack after duplicate-source removal
 * - positive bonuses of the same non-stacking type use only the highest value
 * - a modifier may explicitly opt into same-type stacking for a specific rule
 */
export function stackModifiers(
  modifiers: Dnd35Modifier[],
  context: Dnd35RuleContext = {},
): AppliedModifierGroup {
  const eligible = dedupeModifiers(modifiers).filter((modifier) => conditionMatches(modifier.condition, context));

  const applied: Dnd35Modifier[] = [];
  const suppressed: Dnd35Modifier[] = [];
  const grouped = new Map<Dnd35BonusType, Dnd35Modifier[]>();

  for (const modifier of eligible) {
    if (modifier.amount <= 0 || ALWAYS_STACKING_TYPES.has(modifier.bonusType) || modifier.stacksWithSameType) {
      applied.push(modifier);
      continue;
    }

    const group = grouped.get(modifier.bonusType) ?? [];
    group.push(modifier);
    grouped.set(modifier.bonusType, group);
  }

  for (const group of grouped.values()) {
    group.sort((a, b) => b.amount - a.amount || a.sourceId.localeCompare(b.sourceId));
    const [winner, ...losers] = group;
    if (winner) applied.push(winner);
    suppressed.push(...losers);
  }

  return {
    total: applied.reduce((sum, modifier) => sum + modifier.amount, 0),
    applied,
    suppressed,
  };
}

export function totalForTarget(
  allModifiers: Dnd35Modifier[],
  target: Dnd35ModifierTarget,
  context: Dnd35RuleContext = {},
): AppliedModifierGroup {
  return stackModifiers(allModifiers.filter((modifier) => modifier.target === target), context);
}

export function modifier(
  id: string,
  target: Dnd35ModifierTarget,
  amount: number,
  bonusType: Dnd35BonusType,
  sourceId: string,
  sourceLabel: string,
  condition?: Dnd35ModifierCondition,
): Dnd35Modifier {
  return { id, target, amount, bonusType, sourceId, sourceLabel, condition };
}
