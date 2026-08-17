// Reference implementation only.
// Adapts the existing generic item/effect rows into D&D 3.5e rule inputs.
// Legacy untagged StatMod JSON is intentionally NOT assumed to be 3.5e-safe.

import type { Dnd35ActiveEffectSnapshot, Dnd35EquipmentSnapshot, Dnd35Size } from "./domain";
import type { Dnd35BonusType, Dnd35Modifier, Dnd35ModifierTarget } from "./modifiers";

export type ExistingItemRow = {
  id: number;
  name: string;
  itemType: string;
  quantity: number;
  equipped: boolean;
  identified: boolean;
  statMods?: string;
};

export type ExistingActiveEffectRow = {
  id: number;
  name: string;
  source?: string;
  durationType?: string;
  roundsRemaining?: number | null;
  statMods?: string;
};

export type Dnd35ItemRulesPayload = NonNullable<Dnd35EquipmentSnapshot["rules"]> & {
  rulesetId: "dnd35-core";
  version: number;
};

export type Dnd35EffectRulesPayload = {
  rulesetId: "dnd35-core";
  version: number;
  modifiers: Dnd35Modifier[];
};

export type RulePayloadEnvelope = {
  rulesetId?: string;
  version?: number;
  dnd35?: Dnd35ItemRulesPayload | Dnd35EffectRulesPayload;
  [key: string]: unknown;
};

function safeJson<T>(raw: string | null | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value as T : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Preferred future payload format for an item/effect mechanics JSON field:
 *
 * {
 *   "rulesetId": "dnd35-core",
 *   "version": 1,
 *   "dnd35": { ... }
 * }
 *
 * Production may already have a stronger ruleset-data envelope. If so, keep it.
 */
export function readDnd35ItemRules(raw: string | null | undefined): Dnd35ItemRulesPayload | undefined {
  const parsed = safeJson<RulePayloadEnvelope | Dnd35ItemRulesPayload>(raw);
  if (!parsed) return undefined;

  if ((parsed as Dnd35ItemRulesPayload).rulesetId === "dnd35-core") {
    return parsed as Dnd35ItemRulesPayload;
  }

  const nested = (parsed as RulePayloadEnvelope).dnd35;
  if (nested && "rulesetId" in nested && nested.rulesetId === "dnd35-core") {
    return nested as Dnd35ItemRulesPayload;
  }

  return undefined;
}

export function readDnd35EffectRules(raw: string | null | undefined): Dnd35EffectRulesPayload | undefined {
  const parsed = safeJson<RulePayloadEnvelope | Dnd35EffectRulesPayload>(raw);
  if (!parsed) return undefined;

  if ((parsed as Dnd35EffectRulesPayload).rulesetId === "dnd35-core" && "modifiers" in parsed) {
    return parsed as Dnd35EffectRulesPayload;
  }

  const nested = (parsed as RulePayloadEnvelope).dnd35;
  if (nested && "modifiers" in nested && nested.rulesetId === "dnd35-core") {
    return nested as Dnd35EffectRulesPayload;
  }

  return undefined;
}

export function adaptItem(
  row: ExistingItemRow,
  rulesPayloadRaw?: string | null,
): Dnd35EquipmentSnapshot {
  const rules = readDnd35ItemRules(rulesPayloadRaw);
  return {
    itemId: row.id,
    name: row.name,
    itemType: row.itemType,
    quantity: row.quantity,
    equipped: row.equipped,
    identified: row.identified,
    rules: rules
      ? {
          weightLb: rules.weightLb,
          weapon: rules.weapon,
          armor: rules.armor,
        }
      : undefined,
  };
}

export function adaptEffect(
  row: ExistingActiveEffectRow,
  rulesPayloadRaw?: string | null,
): Dnd35ActiveEffectSnapshot & { modifiers: Dnd35Modifier[] } {
  const rules = readDnd35EffectRules(rulesPayloadRaw);
  return {
    effectId: row.id,
    name: row.name,
    source: row.source,
    durationType: row.durationType,
    roundsRemaining: row.roundsRemaining,
    modifiers: rules?.modifiers ?? [],
  };
}

/**
 * Transitional helper for manually migrating a KNOWN 3.5e legacy modifier.
 * Never run this across arbitrary existing `statMods`; those may encode 5e logic.
 */
export function makeDnd35Modifier(
  sourceId: string,
  sourceLabel: string,
  target: Dnd35ModifierTarget,
  amount: number,
  bonusType: Dnd35BonusType,
): Dnd35Modifier {
  return {
    id: `${sourceId}:${target}:${bonusType}`,
    sourceId,
    sourceLabel,
    target,
    amount,
    bonusType,
  };
}

export function weaponRules(input: {
  weightLb?: number;
  damage: string;
  critical?: string;
  rangeFt?: number;
  damageType?: string;
  size?: Dnd35Size;
  enhancementBonus?: number;
}): Dnd35ItemRulesPayload {
  return {
    rulesetId: "dnd35-core",
    version: 1,
    weightLb: input.weightLb,
    weapon: {
      attackAbility: "str",
      damageAbility: "str",
      damage: input.damage,
      critical: input.critical,
      rangeFt: input.rangeFt,
      damageType: input.damageType,
      size: input.size,
      enhancementBonus: input.enhancementBonus,
    },
  };
}

export function armorRules(input: {
  weightLb?: number;
  category: "light" | "medium" | "heavy" | "shield";
  armorBonus?: number;
  shieldBonus?: number;
  maxDexBonus?: number | null;
  armorCheckPenalty?: number;
  arcaneSpellFailurePercent?: number;
  speed30?: number;
  speed20?: number;
  enhancementBonus?: number;
}): Dnd35ItemRulesPayload {
  return {
    rulesetId: "dnd35-core",
    version: 1,
    weightLb: input.weightLb,
    armor: { ...input },
  };
}
