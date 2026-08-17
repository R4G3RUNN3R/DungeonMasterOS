// Reference implementation only.
// Existing item/effect rows remain authoritative for ownership/equipped/duration state.
// Mechanical payloads must explicitly identify the 5e rules profile that created them.

import type {
  Dnd5eActiveEffectSnapshot,
  Dnd5eEquipmentSnapshot,
  Dnd5eRulesProfileId,
} from "./domain";
import type { Dnd5eNumericModifier, Dnd5eRollStateModifier } from "./modifiers";

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
  concentration?: boolean;
  statMods?: string;
};

export type Dnd5eItemRulesPayload = {
  rulesProfileId: Dnd5eRulesProfileId;
  version: number;
  weightLb?: number;
  weapon?: NonNullable<Dnd5eEquipmentSnapshot["rules"]>["weapon"];
  armor?: NonNullable<Dnd5eEquipmentSnapshot["rules"]>["armor"];
  attunementRequired?: boolean;
};

export type Dnd5eEffectRulesPayload = {
  rulesProfileId: Dnd5eRulesProfileId;
  version: number;
  numericModifiers: Dnd5eNumericModifier[];
  rollStateModifiers: Dnd5eRollStateModifier[];
  conditions?: string[];
};

function safeJson<T>(raw: string | null | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as T : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Transitional envelope. Production may already have a better generic rules-data
 * shape. If it does, keep that one and adapt this contract to it.
 */
export type RulesDataEnvelope = {
  rulesProfileId?: string;
  version?: number;
  dnd5e2014?: Dnd5eItemRulesPayload | Dnd5eEffectRulesPayload;
  dnd5e2024?: Dnd5eItemRulesPayload | Dnd5eEffectRulesPayload;
  [key: string]: unknown;
};

function profileKey(profile: Dnd5eRulesProfileId): "dnd5e2014" | "dnd5e2024" {
  return profile === "dnd5e-2024" ? "dnd5e2024" : "dnd5e2014";
}

export function readItemRules(
  expectedProfile: Dnd5eRulesProfileId,
  raw: string | null | undefined,
): Dnd5eItemRulesPayload | undefined {
  const parsed = safeJson<RulesDataEnvelope | Dnd5eItemRulesPayload>(raw);
  if (!parsed) return undefined;
  if ((parsed as Dnd5eItemRulesPayload).rulesProfileId === expectedProfile) {
    return parsed as Dnd5eItemRulesPayload;
  }
  const nested = (parsed as RulesDataEnvelope)[profileKey(expectedProfile)];
  if (nested && "rulesProfileId" in nested && nested.rulesProfileId === expectedProfile && ! ("numericModifiers" in nested)) {
    return nested as Dnd5eItemRulesPayload;
  }
  return undefined;
}

export function readEffectRules(
  expectedProfile: Dnd5eRulesProfileId,
  raw: string | null | undefined,
): Dnd5eEffectRulesPayload | undefined {
  const parsed = safeJson<RulesDataEnvelope | Dnd5eEffectRulesPayload>(raw);
  if (!parsed) return undefined;
  if ((parsed as Dnd5eEffectRulesPayload).rulesProfileId === expectedProfile && "numericModifiers" in parsed) {
    return parsed as Dnd5eEffectRulesPayload;
  }
  const nested = (parsed as RulesDataEnvelope)[profileKey(expectedProfile)];
  if (nested && "rulesProfileId" in nested && nested.rulesProfileId === expectedProfile && "numericModifiers" in nested) {
    return nested as Dnd5eEffectRulesPayload;
  }
  return undefined;
}

export function adaptItem(
  profile: Dnd5eRulesProfileId,
  row: ExistingItemRow,
  rulesDataRaw?: string | null,
): Dnd5eEquipmentSnapshot {
  const payload = readItemRules(profile, rulesDataRaw);
  return {
    itemId: row.id,
    name: row.name,
    itemType: row.itemType,
    quantity: row.quantity,
    equipped: row.equipped,
    identified: row.identified,
    rulesProfileId: payload?.rulesProfileId,
    rules: payload ? {
      weightLb: payload.weightLb,
      weapon: payload.weapon,
      armor: payload.armor,
      attunementRequired: payload.attunementRequired,
    } : undefined,
  };
}

export function adaptEffect(
  profile: Dnd5eRulesProfileId,
  row: ExistingActiveEffectRow,
  rulesDataRaw?: string | null,
): Dnd5eActiveEffectSnapshot & {
  numericModifiers: Dnd5eNumericModifier[];
  rollStateModifiers: Dnd5eRollStateModifier[];
  conditions: string[];
} {
  const payload = readEffectRules(profile, rulesDataRaw);
  return {
    effectId: row.id,
    name: row.name,
    source: row.source,
    durationType: row.durationType,
    roundsRemaining: row.roundsRemaining,
    concentration: row.concentration,
    rulesProfileId: payload?.rulesProfileId,
    modifiers: [...(payload?.numericModifiers ?? []), ...(payload?.rollStateModifiers ?? [])],
    numericModifiers: payload?.numericModifiers ?? [],
    rollStateModifiers: payload?.rollStateModifiers ?? [],
    conditions: payload?.conditions ?? [],
  };
}

export function assertProfileSafeRuntime(
  profile: Dnd5eRulesProfileId,
  equipment: Dnd5eEquipmentSnapshot[],
  effects: Dnd5eActiveEffectSnapshot[],
): string[] {
  const warnings: string[] = [];
  for (const item of equipment) {
    if (item.rules && item.rulesProfileId !== profile) warnings.push(`Item ${item.name} has mechanics for ${item.rulesProfileId ?? "an untagged profile"}, not ${profile}.`);
  }
  for (const effect of effects) {
    if (effect.modifiers.length && effect.rulesProfileId !== profile) warnings.push(`Effect ${effect.name} has mechanics for ${effect.rulesProfileId ?? "an untagged profile"}, not ${profile}.`);
  }
  return warnings;
}

export const LEGACY_RULE =
  "Never interpret untagged legacy statMods as authoritative 5e mechanics. Migrate known rows to an explicit rules-profile payload after verifying their source edition.";
