import type { Dnd35SourceRef } from "@shared/dnd35-rules/types";
import type {
  Dnd35ArmorStats,
  Dnd35ItemCategory,
  Dnd35ItemDefinition,
  Dnd35Price,
  Dnd35WeaponStats,
} from "@shared/dnd35-rules/items";
import {
  DND35_SRD_SOURCE_REPOSITORY,
  DND35_SRD_SOURCE_REVISION,
} from "./dnd35-srd-spell-importer";

export const DND35_SRD_EQUIPMENT_PATH = "basic-rules-and-legal/equipment.md";

export type Dnd35SrdEquipmentImportResult = {
  ok: boolean;
  items: Dnd35ItemDefinition[];
  sourceRevision: string;
  errors: string[];
};

const slug = (value: string) => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const sourceUrl = () => `https://raw.githubusercontent.com/${DND35_SRD_SOURCE_REPOSITORY}/${DND35_SRD_SOURCE_REVISION}/${DND35_SRD_EQUIPMENT_PATH}`;

function sourceRef(section: string): Dnd35SourceRef {
  return {
    sourceId: "srd-35",
    sourceKind: "srd-open",
    section,
    url: sourceUrl(),
    confidence: "verified",
    notes: `Imported from pinned SRD revision ${DND35_SRD_SOURCE_REVISION}.`,
  };
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—");
}

function cleanCell(value: string) {
  return decodeHtml(value)
    .replace(/<sup>[\s\S]*?<\/sup>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[_*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayName(value: string) {
  return value
    .trim()
    .replace(/\b([A-Za-z])([A-Za-z'-]*)/g, (_match, first, rest) => `${String(first).toUpperCase()}${String(rest).toLowerCase()}`)
    .replace(/\bOf\b/g, "of")
    .replace(/\bAnd\b/g, "and");
}

function extractTable(markdown: string, caption: string) {
  const escaped = caption.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.match(new RegExp(`<table[^>]*>\\s*<caption>${escaped}<\\/caption>([\\s\\S]*?)<\\/table>`, "i"))?.[1] ?? "";
}

function tableRows(table: string) {
  return Array.from(table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((rowMatch) =>
    Array.from(rowMatch[1].matchAll(/<(?:th|td)(?:\s[^>]*)?>([\s\S]*?)<\/(?:th|td)>/gi)).map((cell) => cleanCell(cell[1])),
  );
}

function descriptionMap(markdown: string) {
  const map = new Map<string, string>();
  const pattern = /\*\*([^*\n]+):\*\*\s*([\s\S]*?)(?=\n\s*\n\*\*[^*\n]+:\*\*|\n#{2,4}\s|$)/g;
  for (const match of markdown.matchAll(pattern)) {
    const name = cleanCell(match[1]);
    const body = match[2]
      .replace(/<sup>[\s\S]*?<\/sup>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/[_*`]/g, "")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (name && body) map.set(slug(name), body);
  }
  return map;
}

function parsePrice(text: string): Dnd35Price | undefined {
  const clean = text.replace(/,/g, "").trim();
  const match = clean.match(/^([+]?)(\d+(?:\.\d+)?)\s*(cp|sp|gp|pp)$/i);
  if (!match) return undefined;
  return {
    amount: Number(match[2]),
    currency: match[3].toLowerCase() as Dnd35Price["currency"],
    modifier: match[1] === "+" || undefined,
    text: text.trim(),
  };
}

function parseWeight(text: string) {
  const clean = text.replace(/,/g, "").trim();
  if (!clean || clean === "—" || clean === "-") return undefined;
  const fraction = clean.match(/^([+]?)\s*(\d+)\s*\/\s*(\d+)\s*lb/i);
  if (fraction) return Number(fraction[2]) / Number(fraction[3]);
  const match = clean.match(/^([+]?)\s*(\d+(?:\.\d+)?)\s*lb/i);
  return match ? Number(match[2]) : undefined;
}

function parseSigned(text: string) {
  const clean = text.replace(/−|–|—/g, "-").trim();
  const match = clean.match(/^([+-]?\d+)$/);
  return match ? Number(match[1]) : null;
}

function parseFeet(text: string) {
  const match = text.match(/(\d+)\s*ft\.?/i);
  return match ? Number(match[1]) : null;
}

function parsePercent(text: string) {
  const match = text.match(/(\d+)\s*%/);
  return match ? Number(match[1]) : null;
}

function damageTypes(text: string) {
  return text
    .toLowerCase()
    .split(/\s+(?:or|and)\s+|\s*\/\s*|\s*,\s*/)
    .map((entry) => entry.trim())
    .filter((entry) => ["bludgeoning", "piercing", "slashing"].includes(entry));
}

function firstParagraph(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const paragraph = value.split(/\n\s*\n/).map((entry) => entry.replace(/\s+/g, " ").trim()).find(Boolean) ?? fallback;
  return paragraph.length <= 420 ? paragraph : `${paragraph.slice(0, 417).trimEnd()}...`;
}

function weaponUsage(label: string): Dnd35WeaponStats["usage"] | undefined {
  const lower = label.toLowerCase();
  if (lower.includes("unarmed")) return "unarmed";
  if (lower.includes("light melee")) return "light";
  if (lower.includes("one-handed")) return "one-handed";
  if (lower.includes("two-handed")) return "two-handed";
  if (lower.includes("ranged")) return "ranged";
  return undefined;
}

function weaponProficiency(label: string): Dnd35WeaponStats["proficiency"] | undefined {
  const lower = label.toLowerCase();
  if (lower === "simple weapons") return "simple";
  if (lower === "martial weapons") return "martial";
  if (lower === "exotic weapons") return "exotic";
  return undefined;
}

function inferWeaponCategory(name: string): Dnd35ItemCategory {
  return /arrow|bolt|bullet|shuriken|ammunition/i.test(name) ? "ammunition" : "weapon";
}

function parseWeapons(markdown: string, descriptions: Map<string, string>) {
  const rows = tableRows(extractTable(markdown, "Table: Weapons"));
  const items: Dnd35ItemDefinition[] = [];
  let proficiency: Dnd35WeaponStats["proficiency"] = "special";
  let usage: Dnd35WeaponStats["usage"] = "special";

  for (const cells of rows) {
    if (!cells.length) continue;
    const first = cells[0].trim();
    const nextProficiency = weaponProficiency(first);
    if (nextProficiency) { proficiency = nextProficiency; continue; }
    const nextUsage = weaponUsage(first);
    if (nextUsage && cells.slice(1).every((cell) => !cell || cell === "—")) { usage = nextUsage; continue; }
    if (["Cost", "Dmg (S)", "Dmg (M)"].some((header) => cells.includes(header))) continue;
    if (cells.length < 8 || !first || /^\d+\s/.test(first) || /weight figures|see the description/i.test(first)) continue;

    const name = displayName(first);
    if (slug(name) === "unarmed-strike") continue;
    const description = descriptions.get(slug(name));
    const [cost, damageSmall, damageMedium, critical, range, weight, type] = cells.slice(1, 8);
    const text = description ?? "";
    const weapon: Dnd35WeaponStats = {
      proficiency,
      usage,
      damageSmall: damageSmall && damageSmall !== "—" ? damageSmall : undefined,
      damageMedium: damageMedium && damageMedium !== "—" ? damageMedium : undefined,
      critical: critical && critical !== "—" ? critical : undefined,
      rangeIncrementFeet: parseFeet(range) ?? undefined,
      damageTypes: damageTypes(type),
      doubleWeapon: /double weapon/i.test(text) || undefined,
      reach: /reach weapon|\b15-foot reach\b|\b10-foot reach\b/i.test(text) || undefined,
      thrown: /can be thrown|thrown weapon/i.test(text) || undefined,
      projectile: /projectile weapon/i.test(text) || undefined,
    };
    const category = inferWeaponCategory(name);
    const fallback = `${name}: ${weapon.damageMedium ?? "special"} damage; ${weapon.critical ?? "standard"} critical${weapon.rangeIncrementFeet ? `; ${weapon.rangeIncrementFeet}-ft. range increment` : ""}.`;

    items.push({
      id: `equipment:${slug(name)}`,
      name,
      edition: "3.5e",
      category,
      subcategory: `${proficiency} ${usage}`,
      price: parsePrice(cost),
      weightLb: parseWeight(weight),
      consumable: category === "ammunition",
      weapon,
      rulesSummary: firstParagraph(description, fallback),
      rulesText: description,
      executionStatus: "structured",
      sources: [sourceRef(`Table: Weapons — ${name}`)],
      tags: ["srd", "equipment", category, proficiency, usage, ...weapon.damageTypes],
    });
  }

  return items;
}

function armorClass(label: string): Dnd35ArmorStats["armorClass"] | undefined {
  const lower = label.toLowerCase();
  if (lower === "light armor") return "light";
  if (lower === "medium armor") return "medium";
  if (lower === "heavy armor") return "heavy";
  if (lower === "shields") return "shield";
  if (lower === "extras") return "special";
  return undefined;
}

function parseArmor(markdown: string, descriptions: Map<string, string>) {
  const rows = tableRows(extractTable(markdown, "Table: Armor and Shields"));
  const items: Dnd35ItemDefinition[] = [];
  let currentClass: Dnd35ArmorStats["armorClass"] = "special";

  for (const cells of rows) {
    if (!cells.length) continue;
    const first = cells[0].trim();
    const nextClass = armorClass(first);
    if (nextClass) { currentClass = nextClass; continue; }
    if (currentClass === "special") continue;
    if (cells.length < 9 || !first || first === "Armor") continue;

    const name = displayName(first);
    const description = descriptions.get(slug(name));
    const [cost, bonus, maxDex, checkPenalty, arcaneFailure, speed30, speed20, weight] = cells.slice(1, 9);
    const armor: Dnd35ArmorStats = {
      armorClass: currentClass,
      armorOrShieldBonus: parseSigned(bonus) ?? undefined,
      maximumDexBonus: maxDex === "—" ? null : parseSigned(maxDex),
      armorCheckPenalty: checkPenalty === "—" || /special/i.test(checkPenalty) ? null : parseSigned(checkPenalty),
      arcaneSpellFailurePercent: arcaneFailure === "—" ? null : parsePercent(arcaneFailure),
      speed30Feet: speed30 === "—" ? null : parseFeet(speed30),
      speed20Feet: speed20 === "—" ? null : parseFeet(speed20),
    };
    const category: Dnd35ItemCategory = currentClass === "shield" ? "shield" : "armor";
    const fallback = `${name}: ${armor.armorOrShieldBonus != null ? `+${armor.armorOrShieldBonus} ${category === "shield" ? "shield" : "armor"} bonus to AC` : "special armor rules"}; ${armor.arcaneSpellFailurePercent ?? 0}% arcane spell failure.`;

    items.push({
      id: `equipment:${slug(name)}`,
      name,
      edition: "3.5e",
      category,
      subcategory: currentClass,
      price: parsePrice(cost),
      weightLb: parseWeight(weight),
      armor,
      rulesSummary: firstParagraph(description, fallback),
      rulesText: description,
      executionStatus: "structured",
      sources: [sourceRef(`Table: Armor and Shields — ${name}`)],
      tags: ["srd", "equipment", category, currentClass, "arcane-spell-failure"],
    });
  }

  return items;
}

export function parseDnd35SrdEquipmentDocument(markdown: string): Dnd35ItemDefinition[] {
  const descriptions = descriptionMap(markdown);
  const items = [...parseWeapons(markdown, descriptions), ...parseArmor(markdown, descriptions)];
  const byId = new Map<string, Dnd35ItemDefinition>();
  for (const item of items) byId.set(item.id, item);
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadDnd35SrdEquipmentCorpus(fetcher: typeof fetch = fetch): Promise<Dnd35SrdEquipmentImportResult> {
  const errors: string[] = [];
  try {
    const response = await fetcher(sourceUrl(), { headers: { "User-Agent": "DungeonMasterOS/knowledge-library" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = parseDnd35SrdEquipmentDocument(await response.text());
    const weapons = items.filter((item) => item.category === "weapon" || item.category === "ammunition").length;
    const armor = items.filter((item) => item.category === "armor" || item.category === "shield").length;
    if (weapons < 45) errors.push(`Equipment import produced only ${weapons} weapon/ammunition records; refusing partial corpus.`);
    if (armor < 15) errors.push(`Equipment import produced only ${armor} armor/shield records; refusing partial corpus.`);
    return {
      ok: errors.length === 0,
      items: errors.length ? [] : items,
      sourceRevision: DND35_SRD_SOURCE_REVISION,
      errors,
    };
  } catch (error: any) {
    errors.push(`${DND35_SRD_EQUIPMENT_PATH}: ${error?.message || String(error)}`);
    return { ok: false, items: [], sourceRevision: DND35_SRD_SOURCE_REVISION, errors };
  }
}
