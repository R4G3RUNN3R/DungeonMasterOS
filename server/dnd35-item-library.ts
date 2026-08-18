import type { Dnd35ItemCategory, Dnd35ItemDefinition } from "@shared/dnd35-rules/items";
import {
  DND35_SRD_SOURCE_REVISION,
} from "./dnd35-srd-spell-importer";
import { loadDnd35SrdEquipmentCorpus } from "./dnd35-srd-equipment-importer";

export type Dnd35ItemCorpusStatus = "foundation" | "srd-equipment" | "srd-fallback";

export type Dnd35ItemLibraryStatus = {
  corpusStatus: Dnd35ItemCorpusStatus;
  totalItems: number;
  weapons: number;
  armor: number;
  sourceRevision: string;
  errors: string[];
};

let runtimeItems: Dnd35ItemDefinition[] = [];
let itemById = new Map<string, Dnd35ItemDefinition>();
let itemByName = new Map<string, Dnd35ItemDefinition>();
let corpusStatus: Dnd35ItemCorpusStatus = "foundation";
let corpusErrors: string[] = [];

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function replaceItems(items: Dnd35ItemDefinition[]) {
  runtimeItems = [...items].sort((a, b) => a.name.localeCompare(b.name));
  itemById = new Map(runtimeItems.map((item) => [item.id, item]));
  itemByName = new Map(runtimeItems.map((item) => [normalize(item.name), item]));
}

export async function initializeDnd35ItemLibrary() {
  const equipment = await loadDnd35SrdEquipmentCorpus();
  if (!equipment.ok) {
    replaceItems([]);
    corpusStatus = "srd-fallback";
    corpusErrors = equipment.errors.length ? equipment.errors : ["Pinned SRD equipment import failed without a reported source error."];
    return getDnd35ItemLibraryStatus();
  }

  replaceItems(equipment.items);
  corpusStatus = "srd-equipment";
  corpusErrors = [];
  return getDnd35ItemLibraryStatus();
}

export function listDnd35Items(params: { category?: Dnd35ItemCategory; query?: string } = {}) {
  const needle = normalize(params.query || "");
  return runtimeItems.filter((item) => {
    if (params.category && item.category !== params.category) return false;
    if (!needle) return true;
    return [item.id, item.name, item.category, item.subcategory ?? "", item.rulesSummary, item.rulesText ?? "", ...item.tags]
      .some((value) => normalize(String(value)).includes(needle));
  });
}

export function getDnd35Item(idOrName: string) {
  return itemById.get(idOrName) ?? itemByName.get(normalize(idOrName));
}

export function getDnd35ItemLibraryStatus(): Dnd35ItemLibraryStatus {
  return {
    corpusStatus,
    totalItems: runtimeItems.length,
    weapons: runtimeItems.filter((item) => item.category === "weapon" || item.category === "ammunition").length,
    armor: runtimeItems.filter((item) => item.category === "armor" || item.category === "shield").length,
    sourceRevision: DND35_SRD_SOURCE_REVISION,
    errors: [...corpusErrors],
  };
}

/**
 * Adapts a native 3.5 item record into the narrow shape already consumed by
 * reward reconciliation. This is deliberately an adapter, not a conversion
 * of the canonical 3.5 record into the 5e ItemDefinition schema.
 */
export function dnd35ItemRewardAdapter(item: Dnd35ItemDefinition) {
  const acBonus = item.armor?.armorOrShieldBonus;
  return {
    definitionKey: `dnd35:${item.id}`,
    ruleset: "dnd35e",
    edition: "3.5e",
    name: item.name,
    category: item.category,
    consumable: item.consumable === true,
    weight: item.weightLb ?? null,
    description: item.rulesSummary,
    mechanics: {
      baseDamage: item.weapon?.damageMedium,
      damageDice: item.weapon?.damageMedium,
      critical: item.weapon?.critical,
      rangeIncrementFeet: item.weapon?.rangeIncrementFeet,
      damageTypes: item.weapon?.damageTypes,
      armorClass: item.armor?.armorClass,
      armorBonus: item.armor?.armorOrShieldBonus,
      maximumDexBonus: item.armor?.maximumDexBonus,
      armorCheckPenalty: item.armor?.armorCheckPenalty,
      arcaneSpellFailurePercent: item.armor?.arcaneSpellFailurePercent,
      speed30Feet: item.armor?.speed30Feet,
      speed20Feet: item.armor?.speed20Feet,
      price: item.price,
    },
    effects: typeof acBonus === "number" ? [{ type: "stat_mod", stat: "ac", modifier: acBonus }] : [],
    sourceReference: item.sources.map((source) => source.section).filter(Boolean).join("; "),
  };
}
