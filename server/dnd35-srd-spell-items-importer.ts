import type { Dnd35ItemDefinition, Dnd35ItemCategory, Dnd35Price } from "@shared/dnd35-rules/items";
import type { Dnd35SourceRef, Dnd35SpellTradition } from "@shared/dnd35-rules/types";
import { DND35_SRD_SOURCE_REPOSITORY, DND35_SRD_SOURCE_REVISION } from "./dnd35-srd-spell-importer";

export const DND35_SRD_POTION_PATH = "magic-items/magic-items-iii-potions-rings-and-rods.md";
export const DND35_SRD_SCROLL_WAND_STAFF_PATH = "magic-items/magic-items-iv-scrolls-staffs-and-wands.md";

export type Dnd35SrdSpellItemImportResult = {
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

function sourceUrl(path: string) {
  return `https://raw.githubusercontent.com/${DND35_SRD_SOURCE_REPOSITORY}/${DND35_SRD_SOURCE_REVISION}/${path}`;
}

function sourceRef(path: string, section: string): Dnd35SourceRef {
  return {
    sourceId: "srd-35",
    sourceKind: "srd-open",
    section,
    url: sourceUrl(path),
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

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function parsePrice(text: string): Dnd35Price | undefined {
  const normalized = text.replace(/,/g, "").trim();
  if (!normalized || normalized === "—") return undefined;
  let gp = 0;
  let found = false;
  for (const match of normalized.matchAll(/(\d+(?:\.\d+)?)\s*(pp|gp|sp|cp)\b/gi)) {
    found = true;
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    gp += unit === "pp" ? value * 10 : unit === "gp" ? value : unit === "sp" ? value / 10 : value / 100;
  }
  return found ? { amount: gp, currency: "gp", text: text.trim() } : undefined;
}

function canonicalSpellLabel(raw: string) {
  return cleanCell(raw)
    .replace(/\s+\((?:\d+)(?:st|nd|rd|th)\)\s*$/i, "")
    .replace(/\s+\+\d+\s*$/i, "")
    .replace(/\s+\d+\/magic\s*$/i, "")
    .replace(/\s+\(type\)\s*\d*\s*$/i, "")
    .replace(/\s+\d+\s*$/i, "")
    .trim();
}

function spellIdFromLabel(raw: string) {
  return slug(canonicalSpellLabel(raw));
}

function explicitCasterLevel(raw: string) {
  const match = cleanCell(raw).match(/\((\d+)(?:st|nd|rd|th)\)\s*$/i);
  return match ? Number(match[1]) : undefined;
}

function standardCasterLevelForSpellLevel(level: number) {
  return level <= 1 ? 1 : level * 2 - 1;
}

function makeSpellItem(params: {
  id: string;
  name: string;
  category: Dnd35ItemCategory;
  price?: Dnd35Price;
  spellId: string;
  tradition?: Dnd35SpellTradition;
  casterLevel?: number;
  spellLevel?: number;
  charges: number;
  consumesOnUse: boolean;
  activation: "use-activated" | "spell-completion" | "spell-trigger";
  rulesSummary: string;
  rulesText?: string;
  sourcePath: string;
  sourceSection: string;
  tags?: string[];
}): Dnd35ItemDefinition {
  return {
    id: params.id,
    name: params.name,
    edition: "3.5e",
    category: params.category,
    price: params.price,
    consumable: params.consumesOnUse,
    magic: {
      casterLevel: params.casterLevel,
      activation: params.activation,
      charges: params.charges,
      consumesOnUse: params.consumesOnUse,
      spellIds: [params.spellId],
      spellUses: [{
        spellId: params.spellId,
        tradition: params.tradition,
        charges: 1,
        casterLevel: params.casterLevel,
        spellLevel: params.spellLevel,
      }],
    },
    rulesSummary: params.rulesSummary,
    rulesText: params.rulesText,
    executionStatus: "structured",
    sources: [sourceRef(params.sourcePath, params.sourceSection)],
    tags: ["srd", "magic-item", params.category, params.activation, ...(params.tags ?? [])],
  };
}

function parsePotions(markdown: string) {
  const rows = tableRows(extractTable(markdown, "Table: Potions and Oils"));
  const items: Dnd35ItemDefinition[] = [];
  for (const cells of rows) {
    if (cells.length < 5 || cells[3] === "Potion or Oil") continue;
    const raw = cells[3];
    const mediumMatch = raw.match(/\((potion|oil|potion or oil)\)\s*$/i);
    if (!mediumMatch) continue;
    const spellLabel = raw.slice(0, mediumMatch.index).trim();
    const mediums = mediumMatch[1].toLowerCase() === "potion or oil" ? ["potion", "oil"] : [mediumMatch[1].toLowerCase()];
    for (const medium of mediums) {
      const category = medium as "potion" | "oil";
      const spellId = spellIdFromLabel(spellLabel);
      const name = `${titleCase(medium)} of ${titleCase(spellLabel)}`;
      items.push(makeSpellItem({
        id: `${category}:${slug(spellLabel)}`,
        name,
        category,
        price: parsePrice(cells[4]),
        spellId,
        charges: 1,
        consumesOnUse: true,
        activation: "use-activated",
        rulesSummary: medium === "potion"
          ? `Single-use potion duplicating the effect of ${canonicalSpellLabel(spellLabel)} when drunk.`
          : `Single-use magic oil applying the effect of ${canonicalSpellLabel(spellLabel)} to an appropriate object or target.`,
        rulesText: medium === "potion"
          ? "Drinking a potion is a standard action, takes effect immediately, and provokes attacks of opportunity. A standard potion uses the minimum caster level needed for the stored spell unless otherwise specified."
          : "Applying an oil is a standard action, takes effect immediately, and provokes attacks of opportunity. A standard oil uses the minimum caster level needed for the stored spell unless otherwise specified.",
        sourcePath: DND35_SRD_POTION_PATH,
        sourceSection: `Table: Potions and Oils — ${spellLabel}`,
      }));
    }
  }
  return items;
}

function parseScrolls(markdown: string, caption: string, tradition: Dnd35SpellTradition) {
  const rows = tableRows(extractTable(markdown, caption));
  const items: Dnd35ItemDefinition[] = [];
  let spellLevel: number | undefined;
  for (const cells of rows) {
    if (cells.length === 1) {
      const levelMatch = cells[0].match(/(\d+)(?:st|nd|rd|th)?-Level\s+(?:Arcane|Divine)\s+Spells/i);
      if (levelMatch) spellLevel = Number(levelMatch[1]);
      continue;
    }
    if (cells.length < 3 || cells[1] === "Spell" || spellLevel === undefined) continue;
    const spellLabel = cells[1];
    if (!spellLabel || !cells[2]) continue;
    const spellId = spellIdFromLabel(spellLabel);
    const casterLevel = standardCasterLevelForSpellLevel(spellLevel);
    const traditionLabel = tradition === "arcane" ? "Arcane" : "Divine";
    items.push(makeSpellItem({
      id: `scroll:${tradition}:${spellLevel}:${slug(spellLabel)}`,
      name: `Scroll of ${titleCase(spellLabel)} (${traditionLabel})`,
      category: "scroll",
      price: parsePrice(cells[2]),
      spellId,
      tradition,
      casterLevel,
      spellLevel,
      charges: 1,
      consumesOnUse: true,
      activation: "spell-completion",
      rulesSummary: `Single-use ${tradition} spell-completion item containing ${spellLabel} at spell level ${spellLevel}.`,
      rulesText: "A scroll must first be deciphered. Activation requires the correct arcane/divine type, the spell on the user's class list, and the requisite ability score. If the user's caster level is below the scroll's caster level, a caster-level check is required. The writing disappears when activated.",
      sourcePath: DND35_SRD_SCROLL_WAND_STAFF_PATH,
      sourceSection: `${caption} — ${spellLabel}`,
      tags: [tradition, `spell-level-${spellLevel}`],
    }));
  }
  return items;
}

function parseWands(markdown: string) {
  const rows = tableRows(extractTable(markdown, "Table: Wands"));
  const items: Dnd35ItemDefinition[] = [];
  for (const cells of rows) {
    if (cells.length < 5 || cells[3] === "Wand") continue;
    const spellLabel = cells[3];
    if (!spellLabel || spellLabel === "—") continue;
    const spellId = spellIdFromLabel(spellLabel);
    const casterLevel = explicitCasterLevel(spellLabel);
    items.push(makeSpellItem({
      id: `wand:${slug(spellLabel)}`,
      name: `Wand of ${titleCase(spellLabel)}`,
      category: "wand",
      price: parsePrice(cells[4]),
      spellId,
      casterLevel,
      charges: 50,
      consumesOnUse: false,
      activation: "spell-trigger",
      rulesSummary: `Fifty-charge spell-trigger wand containing ${canonicalSpellLabel(spellLabel)}.`,
      rulesText: "A wand contains one spell of 4th level or lower and has 50 charges when created. Activating it uses the spell-trigger method and normally takes a standard action unless the stored spell has a longer casting time.",
      sourcePath: DND35_SRD_SCROLL_WAND_STAFF_PATH,
      sourceSection: `Table: Wands — ${spellLabel}`,
    }));
  }
  return items;
}

function parseStaffDescriptions(markdown: string) {
  const staffSection = markdown.match(/## Staff Descriptions\s*([\s\S]*?)(?=\n## Wands\b)/i)?.[1] ?? "";
  const sections = staffSection.split(/\n(?=\*\*[^*\n]+:\*\*)/g);
  const items: Dnd35ItemDefinition[] = [];

  for (const rawSection of sections) {
    const heading = rawSection.match(/^\*\*([^*\n]+):\*\*\s*/);
    if (!heading) continue;
    const shortName = cleanCell(heading[1]);
    const body = rawSection.slice(heading[0].length).trim();
    const statLine = body.match(/([^\n]+?);\s*CL\s+(\d+)(?:st|nd|rd|th);\s*([\s\S]*?);\s*Price\s+([\d,]+\s+gp)\.?\s*$/i);
    if (!statLine) continue;
    const aura = cleanCell(statLine[1]);
    const casterLevel = Number(statLine[2]);
    const prerequisites = cleanCell(statLine[3]).split(/\s*,\s*/).filter(Boolean);
    const spellUses = Array.from(body.matchAll(/^-\s+_([^_]+)_\s+(?:\(([^)]*)\)\s*)?\((\d+)\s+charges?\)/gmi)).map((match) => ({
      spellId: spellIdFromLabel(match[1]),
      charges: Number(match[3]),
      casterLevel,
      notes: match[2] ? cleanCell(match[2]) : undefined,
    }));
    if (!spellUses.length) continue;
    const firstParagraph = cleanCell(body.split(/\n\s*\n/)[0]);
    const name = `Staff of ${titleCase(shortName)}`;
    items.push({
      id: `staff:${slug(shortName)}`,
      name,
      edition: "3.5e",
      category: "staff",
      price: parsePrice(statLine[4]),
      weightLb: 5,
      magic: {
        casterLevel,
        aura,
        activation: "spell-trigger",
        activationText: "Spell trigger; normally a standard action unless the selected spell takes longer.",
        charges: 50,
        consumesOnUse: false,
        spellIds: spellUses.map((use) => use.spellId),
        spellUses,
        prerequisites,
      },
      rulesSummary: firstParagraph || `${name} stores several spells and begins with 50 charges.`,
      rulesText: body,
      executionStatus: "structured",
      sources: [sourceRef(DND35_SRD_SCROLL_WAND_STAFF_PATH, `Staff Descriptions — ${shortName}`)],
      tags: ["srd", "magic-item", "staff", "spell-trigger"],
    });
  }
  return items;
}

export function parseDnd35SrdSpellItems(potionMarkdown: string, scrollWandStaffMarkdown: string) {
  const items = [
    ...parsePotions(potionMarkdown),
    ...parseScrolls(scrollWandStaffMarkdown, "Table: Arcane Spell Scrolls", "arcane"),
    ...parseScrolls(scrollWandStaffMarkdown, "Table: Divine Spell Scrolls", "divine"),
    ...parseWands(scrollWandStaffMarkdown),
    ...parseStaffDescriptions(scrollWandStaffMarkdown),
  ];
  const byId = new Map<string, Dnd35ItemDefinition>();
  for (const item of items) byId.set(item.id, item);
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadDnd35SrdSpellItemCorpus(fetcher: typeof fetch = fetch): Promise<Dnd35SrdSpellItemImportResult> {
  const errors: string[] = [];
  const paths = [DND35_SRD_POTION_PATH, DND35_SRD_SCROLL_WAND_STAFF_PATH] as const;
  const documents = await Promise.all(paths.map(async (path) => {
    try {
      const response = await fetcher(sourceUrl(path), { headers: { "User-Agent": "DungeonMasterOS/knowledge-library" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error: any) {
      errors.push(`${path}: ${error?.message || String(error)}`);
      return null;
    }
  }));
  if (errors.length || documents.some((document) => document == null)) {
    return { ok: false, items: [], sourceRevision: DND35_SRD_SOURCE_REVISION, errors };
  }

  const items = parseDnd35SrdSpellItems(documents[0]!, documents[1]!);
  const counts = {
    potionOil: items.filter((item) => item.category === "potion" || item.category === "oil").length,
    scroll: items.filter((item) => item.category === "scroll").length,
    wand: items.filter((item) => item.category === "wand").length,
    staff: items.filter((item) => item.category === "staff").length,
  };
  if (counts.potionOil < 50) errors.push(`Spell-item import produced only ${counts.potionOil} potion/oil records.`);
  if (counts.scroll < 250) errors.push(`Spell-item import produced only ${counts.scroll} scroll records.`);
  if (counts.wand < 30) errors.push(`Spell-item import produced only ${counts.wand} wand records.`);
  if (counts.staff < 15) errors.push(`Spell-item import produced only ${counts.staff} staff records.`);

  return {
    ok: errors.length === 0,
    items: errors.length ? [] : items,
    sourceRevision: DND35_SRD_SOURCE_REVISION,
    errors,
  };
}
