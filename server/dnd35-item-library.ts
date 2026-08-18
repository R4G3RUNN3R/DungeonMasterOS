import type { Dnd35ItemCategory, Dnd35ItemDefinition, Dnd35MagicItemSpellUse } from "@shared/dnd35-rules/items";
import type { Dnd35SpellDefinition, Dnd35SpellTradition } from "@shared/dnd35-rules/types";
import { DND35_SRD_SOURCE_REVISION } from "./dnd35-srd-spell-importer";
import { loadDnd35SrdEquipmentCorpus } from "./dnd35-srd-equipment-importer";
import { loadDnd35SrdSpellItemCorpus } from "./dnd35-srd-spell-items-importer";

export type Dnd35ItemCorpusStatus = "foundation" | "srd-equipment" | "srd-spell-items" | "srd-core-items" | "srd-fallback";

export type Dnd35ItemLibraryStatus = {
  corpusStatus: Dnd35ItemCorpusStatus;
  totalItems: number;
  weapons: number;
  armor: number;
  potionsAndOils: number;
  scrolls: number;
  wands: number;
  staffs: number;
  sourceRevision: string;
  errors: string[];
};

type SpellLookup = (idOrName: string) => Dnd35SpellDefinition | undefined;

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

function minimumCasterLevel(classId: string, spellLevel: number) {
  if (spellLevel <= 0) return 1;
  if (["wizard", "sorcerer", "cleric", "druid"].includes(classId)) return spellLevel <= 1 ? 1 : spellLevel * 2 - 1;
  if (classId === "bard") {
    const table = [1, 2, 4, 7, 10, 13, 16];
    return table[spellLevel] ?? Math.max(1, spellLevel * 3 - 2);
  }
  if (classId === "paladin" || classId === "ranger") {
    const table = [1, 4, 8, 11, 14];
    return table[spellLevel] ?? Math.max(4, spellLevel * 3 + 1);
  }
  return spellLevel <= 1 ? 1 : spellLevel * 2 - 1;
}

function preferredAccess(spell: Dnd35SpellDefinition, tradition?: Dnd35SpellTradition) {
  const candidates = tradition
    ? spell.classAccess.filter((access) => access.tradition === tradition)
    : spell.classAccess;
  return candidates
    .map((access) => ({ ...access, minimumCasterLevel: minimumCasterLevel(access.classId, access.level) }))
    .sort((a, b) => a.minimumCasterLevel - b.minimumCasterLevel || a.level - b.level)[0];
}

function enrichSpellUse(use: Dnd35MagicItemSpellUse, lookup?: SpellLookup): Dnd35MagicItemSpellUse {
  if (!lookup) return use;
  const spell = lookup(use.spellId);
  if (!spell) return use;
  const access = preferredAccess(spell, use.tradition);
  if (!access) return use;
  return {
    ...use,
    spellLevel: use.spellLevel ?? access.level,
    casterLevel: use.casterLevel ?? access.minimumCasterLevel,
  };
}

function enrichSpellItem(item: Dnd35ItemDefinition, lookup?: SpellLookup): Dnd35ItemDefinition {
  if (!item.magic?.spellUses?.length || !lookup) return item;
  const spellUses = item.magic.spellUses.map((use) => enrichSpellUse(use, lookup));
  const itemCasterLevel = item.magic.casterLevel ?? (spellUses.length === 1 ? spellUses[0].casterLevel : undefined);
  return {
    ...item,
    magic: {
      ...item.magic,
      casterLevel: itemCasterLevel,
      spellUses,
    },
  };
}

export async function initializeDnd35ItemLibrary(spellLookup?: SpellLookup) {
  const [equipment, spellItems] = await Promise.all([
    loadDnd35SrdEquipmentCorpus(),
    loadDnd35SrdSpellItemCorpus(),
  ]);

  const errors = [...equipment.errors, ...spellItems.errors];
  const items = [
    ...(equipment.ok ? equipment.items : []),
    ...(spellItems.ok ? spellItems.items.map((item) => enrichSpellItem(item, spellLookup)) : []),
  ];
  replaceItems(items);

  if (equipment.ok && spellItems.ok) corpusStatus = "srd-core-items";
  else if (equipment.ok) corpusStatus = "srd-equipment";
  else if (spellItems.ok) corpusStatus = "srd-spell-items";
  else corpusStatus = "srd-fallback";
  corpusErrors = errors;
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
    potionsAndOils: runtimeItems.filter((item) => item.category === "potion" || item.category === "oil").length,
    scrolls: runtimeItems.filter((item) => item.category === "scroll").length,
    wands: runtimeItems.filter((item) => item.category === "wand").length,
    staffs: runtimeItems.filter((item) => item.category === "staff").length,
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
      casterLevel: item.magic?.casterLevel,
      activation: item.magic?.activation,
      charges: item.magic?.charges,
      consumesOnUse: item.magic?.consumesOnUse,
      spellIds: item.magic?.spellIds,
      spellUses: item.magic?.spellUses,
      price: item.price,
    },
    effects: typeof acBonus === "number" ? [{ type: "stat_mod", stat: "ac", modifier: acBonus }] : [],
    sourceReference: item.sources.map((source) => source.section).filter(Boolean).join("; "),
  };
}
