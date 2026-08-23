// server/dnd35e/extraction/classes-extractor.ts
//
// Deterministic, regex-based extractor for a real d20srd.org/srd/classes/*
// class page. Pure function: no network, no DB. First implemented and
// verified against the real Fighter page (server/dnd35e/extraction/
// fighter-fixture.html) — a non-spellcasting class, deliberately chosen as
// the simplest real vertical slice. See classes.ts for the explicit
// spellcasting-progression scope gap this leaves for casting classes.
//
// Design note on "honest partial extraction" (same discipline as
// feats/races extractors): the 20-row level-progression table, hit die,
// alignment, skill points, and class-skill list all follow one exact,
// consistent real page format across every core class, so this pass
// extracts them deterministically and fails closed (throws) if a page's
// table header ever doesn't match the expected column order, rather than
// silently mis-mapping columns. Class Features are captured as full,
// un-truncated multi-paragraph text (no single-effect-pattern structuring
// attempted this pass) — the honest, real description, preserved verbatim.

import { buildCanonicalId } from "@shared/rules-registry/canonical-id";
import type {
  Dnd35eAbilityCode,
  Dnd35eBabProgression,
  Dnd35eClassDefinition,
  Dnd35eClassFeature,
  Dnd35eClassLevelProgressionRow,
  Dnd35eClassSkill,
  Dnd35eSaveProgression,
} from "@shared/rules-registry/dnd35e/classes";
import { stripTags, kebabCase } from "./html-utils";

const EXPECTED_HEADERS = ["Level", "Base Attack Bonus", "Fort Save", "Ref Save", "Will Save", "Special"];

const TABLE_RE = /<table id="tableThe[a-zA-Z]+"[^>]*>([\s\S]*?)<\/table>/;
// Real page inconsistency: most classes' header cells are bare <th>Level</th>,
// but some (e.g. Barbarian, Rogue) use <th align="left">Base<br />Attack
// Bonus</th> — attributes on the tag and a <br /> splitting the label across
// two lines. Tolerant of both; header text is normalized below.
const TH_RE = /<th[^>]*>([\s\S]*?)<\/th>/g;
const TR_RE = /<tr>([\s\S]*?)<\/tr>/g;
const TD_RE = /<td[^>]*>([\s\S]*?)<\/td>/g;

function normalizeHeaderText(raw: string): string {
  return stripTags(raw.replace(/<br\s*\/?>/gi, " "));
}

// Real page inconsistency: most classes use <h1>Name</h1>, but at least one
// (Rogue) uses <h2 id="slug">Name</h2> instead. Tolerant of both.
const CLASS_NAME_RE = /<h1>([^<]+)<\/h1>|<h2 id="[a-zA-Z]+">([^<]+)<\/h2>/;
const ALIGNMENT_RE = /<h5>Alignment<\/h5>\s*<p>\s*([\s\S]*?)\s*<\/p>/;
const HIT_DIE_RE = /<h5>Hit Die<\/h5>\s*<p>\s*d(\d+)\.?\s*<\/p>/i;
const CLASS_SKILLS_SECTION_RE = /<h4>Class Skills<\/h4>\s*<p>([\s\S]*?)<\/p>/;
const CLASS_SKILL_ENTRY_RE = /<a href="\/srd\/skills\/[^"]+">([^<]+)<\/a>\s*\((Str|Dex|Con|Int|Wis|Cha)\)/g;
const SKILL_POINTS_RE = /<h5>Skill Points at Each Additional Level<\/h5>\s*<p>\s*(\d+)\s*\+\s*Int modifier\.?\s*<\/p>/i;
const CLASS_FEATURES_SECTION_RE = /<h4>Class Features<\/h4>([\s\S]*?)(?=<div class="footer">|$)/;
const FEATURE_BLOCK_RE = /<h5(?:\s+id="([a-zA-Z0-9]+)")?[^>]*>([^<]+)<\/h5>([\s\S]*?)(?=<h5|$)/g;
const PARAGRAPH_RE = /<p[^>]*>([\s\S]*?)<\/p>/g;
const SPECIAL_CELL_ANCHOR_RE = /href="#([a-zA-Z0-9]+)"/g;

const ABILITY_ABBR_TO_CODE: Record<string, Dnd35eAbilityCode> = {
  Str: "str",
  Dex: "dex",
  Con: "con",
  Int: "int",
  Wis: "wis",
  Cha: "cha",
};

function classifyBabProgression(level20Bab: number): Dnd35eBabProgression {
  if (level20Bab === 20) return "full";
  if (level20Bab === 15) return "three-quarter";
  if (level20Bab === 10) return "half";
  throw new Error(`Unrecognized BAB progression: level 20 base attack bonus is +${level20Bab}, expected +20/+15/+10`);
}

function classifySaveProgression(level20Save: number): Dnd35eSaveProgression {
  if (level20Save === 12) return "good";
  if (level20Save === 6) return "poor";
  throw new Error(`Unrecognized save progression: level 20 save is +${level20Save}, expected +12 (good) or +6 (poor)`);
}

function extractLevelProgression(tableHtml: string): Dnd35eClassLevelProgressionRow[] {
  const headers: string[] = [];
  let thMatch: RegExpExecArray | null;
  TH_RE.lastIndex = 0;
  while ((thMatch = TH_RE.exec(tableHtml))) {
    headers.push(normalizeHeaderText(thMatch[1]));
  }
  if (headers.length !== EXPECTED_HEADERS.length || headers.some((h, i) => h !== EXPECTED_HEADERS[i])) {
    throw new Error(`Unexpected class progression table header order: ${JSON.stringify(headers)}, expected ${JSON.stringify(EXPECTED_HEADERS)}`);
  }

  const rows: Dnd35eClassLevelProgressionRow[] = [];
  let trMatch: RegExpExecArray | null;
  TR_RE.lastIndex = 0;
  let isFirstRow = true;
  while ((trMatch = TR_RE.exec(tableHtml))) {
    if (isFirstRow) {
      isFirstRow = false;
      continue; // header row, already consumed above via TH_RE
    }
    const cells: string[] = [];
    let tdMatch: RegExpExecArray | null;
    TD_RE.lastIndex = 0;
    while ((tdMatch = TD_RE.exec(trMatch[1]))) {
      cells.push(tdMatch[1]);
    }
    if (cells.length !== 6) continue;

    const level = Number(stripTags(cells[0]).match(/^(\d+)/)?.[1]);
    const bab = Number(stripTags(cells[1]).match(/^\+(\d+)/)?.[1]);
    const fort = Number(stripTags(cells[2]).match(/^\+(\d+)/)?.[1]);
    const ref = Number(stripTags(cells[3]).match(/^\+(\d+)/)?.[1]);
    const will = Number(stripTags(cells[4]).match(/^\+(\d+)/)?.[1]);
    const specialFeatureSlugs = [...cells[5].matchAll(SPECIAL_CELL_ANCHOR_RE)].map((m) => m[1]);

    rows.push({ level, baseAttackBonus: bab, fortSave: fort, refSave: ref, willSave: will, specialFeatureSlugs });
  }
  return rows;
}

function extractClassSkills(html: string): Dnd35eClassSkill[] {
  const sectionMatch = CLASS_SKILLS_SECTION_RE.exec(html);
  if (!sectionMatch) return [];
  return [...sectionMatch[1].matchAll(CLASS_SKILL_ENTRY_RE)].map((m) => ({
    skillCanonicalId: buildCanonicalId("dnd35e", "skill", kebabCase(m[1].trim())),
    keyAbility: ABILITY_ABBR_TO_CODE[m[2]],
  }));
}

function extractClassFeatures(html: string): Dnd35eClassFeature[] {
  const sectionMatch = CLASS_FEATURES_SECTION_RE.exec(html);
  if (!sectionMatch) return [];
  const features: Dnd35eClassFeature[] = [];
  let blockMatch: RegExpExecArray | null;
  FEATURE_BLOCK_RE.lastIndex = 0;
  while ((blockMatch = FEATURE_BLOCK_RE.exec(sectionMatch[1]))) {
    const name = blockMatch[2].trim();
    const slug = blockMatch[1] ?? kebabCase(name);
    const paragraphs = [...blockMatch[3].matchAll(PARAGRAPH_RE)].map((p) => stripTags(p[1]));
    features.push({ slug, name, description: paragraphs.join(" ") });
  }
  return features;
}

export function extractClassFromHtml(html: string): Dnd35eClassDefinition {
  const nameMatch = CLASS_NAME_RE.exec(html);
  if (!nameMatch) throw new Error("No <h1> or <h2 id> class name found on this page — not a real class page.");
  const name = (nameMatch[1] ?? nameMatch[2]).trim();

  const tableMatch = TABLE_RE.exec(html);
  if (!tableMatch) throw new Error(`No real level-progression table found for class "${name}".`);
  const levelProgression = extractLevelProgression(tableMatch[1]);
  const level20 = levelProgression.find((r) => r.level === 20);
  if (!level20) throw new Error(`No level-20 row found in the real progression table for class "${name}".`);

  const alignmentMatch = ALIGNMENT_RE.exec(html);
  const hitDieMatch = HIT_DIE_RE.exec(html);
  const skillPointsMatch = SKILL_POINTS_RE.exec(html);
  const classSkills = extractClassSkills(html);
  const classFeatures = extractClassFeatures(html);

  const notes: string[] = [];
  if (!alignmentMatch) notes.push("Alignment section did not match the expected real page pattern.");
  if (!hitDieMatch) notes.push("Hit Die section did not match the expected real page pattern.");
  if (!skillPointsMatch) notes.push("Skill Points section did not match the expected real page pattern.");
  if (classSkills.length === 0) notes.push("No class skills were extracted — Class Skills section may be absent or differently formatted.");
  if (classFeatures.length === 0) notes.push("No class features were extracted — Class Features section may be absent or differently formatted.");

  const extractionStatus: Dnd35eClassDefinition["extractionStatus"] =
    notes.length === 0 ? "fully_structured" : alignmentMatch && hitDieMatch && skillPointsMatch ? "partially_structured" : "unresolved";

  return {
    canonicalId: buildCanonicalId("dnd35e", "class", kebabCase(name)),
    name,
    alignment: alignmentMatch ? stripTags(alignmentMatch[1]) : "",
    hitDie: hitDieMatch ? Number(hitDieMatch[1]) : 0,
    babProgression: classifyBabProgression(level20.baseAttackBonus),
    saveProgression: {
      fort: classifySaveProgression(level20.fortSave),
      ref: classifySaveProgression(level20.refSave),
      will: classifySaveProgression(level20.willSave),
    },
    skillPointsBase: skillPointsMatch ? Number(skillPointsMatch[1]) : 0,
    classSkills,
    levelProgression,
    classFeatures,
    extractionStatus,
    extractionNotes: notes,
  };
}
