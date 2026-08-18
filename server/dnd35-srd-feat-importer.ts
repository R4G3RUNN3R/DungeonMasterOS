import type {
  Dnd35FeatCategory,
  Dnd35FeatDefinition,
  Dnd35Prerequisite,
  Dnd35SourceRef,
} from "@shared/dnd35-rules/types";
import {
  DND35_SRD_SOURCE_REPOSITORY,
  DND35_SRD_SOURCE_REVISION,
} from "./dnd35-srd-spell-importer";

export const DND35_SRD_FEATS_PATH = "basic-rules-and-legal/feats.md";

export type Dnd35ImportedFeat = Dnd35FeatDefinition & {
  rulesText: string;
  benefitText: string;
  normalText?: string;
  specialText?: string;
  executionStatus: "reference";
  importedFrom: {
    repository: typeof DND35_SRD_SOURCE_REPOSITORY;
    revision: typeof DND35_SRD_SOURCE_REVISION;
    path: typeof DND35_SRD_FEATS_PATH;
  };
};

export type Dnd35SrdFeatImportResult = {
  ok: boolean;
  feats: Dnd35ImportedFeat[];
  sourceRevision: string;
  errors: string[];
};

const slug = (value: string) => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const clean = (value: string) => value
  .replace(/\r/g, "")
  .replace(/<[^>]+>/g, "")
  .replace(/[_*`]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const sourceUrl = () => `https://raw.githubusercontent.com/${DND35_SRD_SOURCE_REPOSITORY}/${DND35_SRD_SOURCE_REVISION}/${DND35_SRD_FEATS_PATH}`;

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

function categoriesFrom(typeText: string, body: string): Dnd35FeatCategory[] {
  const types = typeText.split(/\s*,\s*|\s+or\s+/i).map((entry) => entry.trim().toLowerCase());
  const categories = new Set<Dnd35FeatCategory>();
  for (const type of types) {
    if (type.includes("metamagic")) categories.add("metamagic");
    else if (type.includes("item creation")) categories.add("item_creation");
    else if (type.includes("general")) categories.add("general");
    else if (type.includes("fighter")) categories.add("fighter_bonus");
    else if (type.includes("epic")) categories.add("epic");
    else if (type) categories.add("other");
  }
  if (/fighter may select|fighter can select|fighter bonus feat/i.test(body)) categories.add("fighter_bonus");
  if (!categories.size) categories.add("general");
  return Array.from(categories);
}

function ordinalNumber(text: string) {
  const match = text.match(/(\d+)(?:st|nd|rd|th)?/i);
  return match ? Number(match[1]) : undefined;
}

function parseOnePrerequisite(raw: string): Dnd35Prerequisite {
  const text = clean(raw).replace(/[.;]+$/, "");
  let match = text.match(/^(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)$/i);
  if (match) return { kind: "ability", ability: match[1].toLowerCase() as any, minimum: Number(match[2]) };

  match = text.match(/^base attack bonus\s*\+?(\d+)$/i);
  if (match) return { kind: "bab", minimum: Number(match[1]) };

  match = text.match(/^caster level\s+(\d+)(?:st|nd|rd|th)?$/i);
  if (match) return { kind: "caster_level", minimum: Number(match[1]) };

  match = text.match(/^(.+?)\s+(\d+)\s+ranks?$/i);
  if (match) return { kind: "skill", skillId: slug(match[1]), ranks: Number(match[2]) };

  match = text.match(/^(.+?)\s+class level\s+(\d+)(?:st|nd|rd|th)?$/i);
  if (match) return { kind: "class_level", classId: slug(match[1]), minimum: Number(match[2]) };

  match = text.match(/^(.+?)\s+level\s+(\d+)(?:st|nd|rd|th)?$/i);
  if (match && /fighter|monk|paladin|ranger|rogue|wizard|sorcerer|bard|cleric|druid|barbarian/i.test(match[1])) {
    return { kind: "class_level", classId: slug(match[1]), minimum: Number(match[2]) };
  }

  match = text.match(/^ability to cast\s+(\d+)(?:st|nd|rd|th)-level\s+(arcane|divine)?\s*spells?$/i);
  if (match) return {
    kind: "spell_level",
    minimum: Number(match[1]) as any,
    tradition: match[2]?.toLowerCase() as any,
  };

  // Parameterized Spell Focus is common enough to encode without guessing.
  match = text.match(/^Spell Focus\s*\(([^)]+)\)$/i);
  if (match) return { kind: "feat", featId: "spell-focus", parameter: slug(match[1]) };

  // A plain title-cased prerequisite without mechanical prose is usually
  // another feat. Conservatively reject sentence-like clauses below.
  if (/^[A-Z][A-Za-z' -]+(?:\s*\([^)]+\))?$/.test(text) && !/\b(ability|proficiency|feature|special|spell|weapon|armor|armour|creature|turn|rebuke|wild shape)\b/i.test(text)) {
    return { kind: "feat", featId: slug(text) };
  }

  return { kind: "special", rule: slug(text) || text.toLowerCase() };
}

function parsePrerequisites(text: string | undefined): Dnd35Prerequisite | undefined {
  if (!text?.trim()) return undefined;
  // SRD prerequisite lists are normally comma-separated and conjunctive.
  // Clauses containing explicit alternatives are retained as a special flag
  // instead of being mis-parsed as an AND or OR by guesswork.
  const parts = text.split(/\s*,\s*/).map((entry) => entry.trim()).filter(Boolean);
  const requirements = parts.map(parseOnePrerequisite);
  return requirements.length === 1 ? requirements[0] : { kind: "all", requirements };
}

function extractField(body: string, label: "Prerequisite" | "Prerequisites" | "Benefit" | "Normal" | "Special") {
  const pattern = new RegExp(`\\*\\*${label}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\n\\*\\*(?:Prerequisite|Prerequisites|Benefit|Normal|Special):\\*\\*|$)`, "i");
  const match = body.match(pattern);
  return match ? match[1].trim() : undefined;
}

function summaryFor(benefit: string) {
  const paragraph = benefit.split(/\n\s*\n/).map(clean).find(Boolean) || "See the canonical SRD feat entry.";
  return paragraph.length <= 420 ? paragraph : `${paragraph.slice(0, 417).trimEnd()}...`;
}

function inferParameters(name: string) {
  const id = slug(name);
  if (["spell-focus", "greater-spell-focus"].includes(id)) {
    return [{
      id: "school",
      kind: "spell_school" as const,
      required: true,
      allowedValues: ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"],
    }];
  }
  if (["skill-focus"].includes(id)) return [{ id: "skill", kind: "skill" as const, required: true }];
  if ([
    "weapon-focus",
    "greater-weapon-focus",
    "weapon-specialization",
    "greater-weapon-specialization",
    "exotic-weapon-proficiency",
    "martial-weapon-proficiency",
    "improved-critical",
  ].includes(id)) return [{ id: "weapon", kind: "weapon" as const, required: true }];
  return undefined;
}

function repeatability(name: string, specialText: string | undefined) {
  const id = slug(name);
  const repeatableByIdentity = new Set([
    "spell-focus",
    "greater-spell-focus",
    "skill-focus",
    "weapon-focus",
    "greater-weapon-focus",
    "weapon-specialization",
    "greater-weapon-specialization",
    "exotic-weapon-proficiency",
    "martial-weapon-proficiency",
    "improved-critical",
  ]);
  return repeatableByIdentity.has(id) || /can gain this feat multiple times|may be selected multiple times|choose this feat multiple times/i.test(specialText || "");
}

export function parseDnd35SrdFeatDocument(markdown: string): Dnd35ImportedFeat[] {
  const featSection = markdown.split(/\n##\s+Feat Descriptions\s*\n/i)[1];
  if (!featSection) return [];

  const sections = featSection.split(/\n(?=###\s+)/g);
  const feats: Dnd35ImportedFeat[] = [];

  for (const rawSection of sections) {
    if (!rawSection.startsWith("### ")) continue;
    const lines = rawSection.split("\n");
    const heading = lines.shift()!.replace(/^###\s+/, "").trim();
    const headingMatch = heading.match(/^(.*?)\s*<small>\[([^\]]+)\]<\/small>\s*$/i);
    if (!headingMatch) continue;

    const name = clean(headingMatch[1]);
    const typeText = clean(headingMatch[2]);
    const body = lines.join("\n").trim();
    const prerequisiteText = extractField(body, "Prerequisites") ?? extractField(body, "Prerequisite");
    const benefitText = extractField(body, "Benefit");
    if (!name || !benefitText) continue;
    const normalText = extractField(body, "Normal");
    const specialText = extractField(body, "Special");
    const rulesText = [
      prerequisiteText ? `Prerequisite: ${clean(prerequisiteText)}` : "",
      `Benefit: ${clean(benefitText)}`,
      normalText ? `Normal: ${clean(normalText)}` : "",
      specialText ? `Special: ${clean(specialText)}` : "",
    ].filter(Boolean).join("\n\n");

    const repeatable = repeatability(name, specialText);
    const id = slug(name);
    feats.push({
      id,
      name,
      edition: "3.5e",
      categories: categoriesFrom(typeText, body),
      prerequisites: parsePrerequisites(prerequisiteText),
      prerequisiteSummary: prerequisiteText ? clean(prerequisiteText) : undefined,
      parameters: inferParameters(name),
      repeatable: repeatable || undefined,
      repeatRule: repeatable && specialText ? clean(specialText) : undefined,
      modifiers: [],
      rulesSummary: summaryFor(benefitText),
      specialRules: [normalText ? `Normal: ${clean(normalText)}` : "", specialText ? `Special: ${clean(specialText)}` : ""].filter(Boolean),
      sources: [sourceRef(name)],
      tags: ["srd", "feat", ...categoriesFrom(typeText, body)],
      rulesText,
      benefitText: clean(benefitText),
      normalText: normalText ? clean(normalText) : undefined,
      specialText: specialText ? clean(specialText) : undefined,
      executionStatus: "reference",
      importedFrom: {
        repository: DND35_SRD_SOURCE_REPOSITORY,
        revision: DND35_SRD_SOURCE_REVISION,
        path: DND35_SRD_FEATS_PATH,
      },
    });
  }

  return feats;
}

export async function loadDnd35SrdFeatCorpus(fetcher: typeof fetch = fetch): Promise<Dnd35SrdFeatImportResult> {
  const errors: string[] = [];
  try {
    const response = await fetcher(sourceUrl(), { headers: { "User-Agent": "DungeonMasterOS/knowledge-library" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseDnd35SrdFeatDocument(await response.text());
    const byId = new Map<string, Dnd35ImportedFeat>();
    for (const feat of parsed) {
      if (byId.has(feat.id)) errors.push(`Duplicate feat id ${feat.id}.`);
      else byId.set(feat.id, feat);
    }
    // The core SRD feat chapter contains far more than the magic-facing seed.
    // Fail closed rather than publishing a suspiciously truncated Codex.
    if (byId.size < 90) errors.push(`SRD feat import produced only ${byId.size} unique records; refusing partial corpus.`);
    return {
      ok: errors.length === 0,
      feats: errors.length ? [] : Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)),
      sourceRevision: DND35_SRD_SOURCE_REVISION,
      errors,
    };
  } catch (error: any) {
    errors.push(`${DND35_SRD_FEATS_PATH}: ${error?.message || String(error)}`);
    return { ok: false, feats: [], sourceRevision: DND35_SRD_SOURCE_REVISION, errors };
  }
}
