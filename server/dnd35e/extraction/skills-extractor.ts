// server/dnd35e/extraction/skills-extractor.ts
//
// Deterministic, regex-based extractor for a real d20srd.org/srd/skills/*
// individual-skill page. Pure function: no network, no DB. First
// implemented and verified against Climb, Jump, and Disable Device — three
// real pages chosen to cover the real structural range this pass has to
// handle: a skill with real embedded DC-lookup tables (Climb), a simple
// skill with a Synergy section (Jump), and a Trained Only skill with a
// Restriction section plus real h4-level deep-dive subsections (Disable
// Device's "Other Ways To Beat A Trap" and its own 4 h5 children).
//
// Design note on "honest partial extraction": real skill-page prose varies
// far more than class or feat pages (Check/Action/Try Again/Special/
// Synergy/Restriction, plus skill-specific subsections) — this pass
// captures every real h5/h4 section as its own named {heading, text} entry
// rather than forcing a fixed field set. Real embedded DC-lookup tables
// (Climb's, most visibly) are NOT parsed into structured data this pass —
// their surrounding prose is captured, but the table's own rows are not,
// and a real extractionNote discloses this per section rather than
// silently losing the table's content.

import { buildCanonicalId } from "@shared/rules-registry/canonical-id";
import type { Dnd35eAbilityCode, Dnd35eSkillDefinition, Dnd35eSkillSection } from "@shared/rules-registry/dnd35e/skills";
import { stripTags, kebabCase } from "./html-utils";

// Real page pattern: <h1>Name (KeyAbility[; Trained Only][; Armor Check
// Penalty])</h1> — flags appear in either order, separated by "; " or ", ".
const SKILL_NAME_RE = /<h1>([^(<]+)\(([^)]*)\)<\/h1>/;
// Real heading flags use the same abbreviated ability codes as Classes'
// class-skill lists (e.g. "Climb (Str; Armor Check Penalty)"), not full
// ability names.
const ABILITY_NAME_RE = /(Str|Dex|Con|Int|Wis|Cha)\b/;

const ABILITY_NAME_TO_CODE: Record<string, Dnd35eAbilityCode> = {
  Str: "str",
  Dex: "dex",
  Con: "con",
  Int: "int",
  Wis: "wis",
  Cha: "cha",
};

// Real section headings appear as either <h5> or (for skill-specific
// deep-dive subsections, e.g. Disable Device's "Other Ways To Beat A Trap")
// <h4>. Both levels are captured uniformly as flat, honestly-named
// sections — this pass doesn't attempt to represent the h4/h5 nesting
// structure itself, only preserve every section's real name and text.
const SECTION_BLOCK_RE = /<h[45](?:\s+id="[a-zA-Z0-9]+")?[^>]*>([\s\S]*?)<\/h[45]>([\s\S]*?)(?=<h[45]|<div class="footer">|$)/g;
// Real page pattern, found on Jump's Synergy section: some sections use a
// <ul><li> list instead of <p> paragraphs (skill-to-skill synergy bonuses
// are almost always phrased this way). Both are captured, in document
// order, so list-only sections aren't silently left empty.
const PARAGRAPH_OR_LIST_ITEM_RE = /<(?:p|li)[^>]*>([\s\S]*?)<\/(?:p|li)>/g;
const TABLE_TAG_RE = /<table[^>]*>/;

function extractSections(html: string): Dnd35eSkillSection[] {
  const sections: Dnd35eSkillSection[] = [];
  let m: RegExpExecArray | null;
  SECTION_BLOCK_RE.lastIndex = 0;
  while ((m = SECTION_BLOCK_RE.exec(html))) {
    const heading = stripTags(m[1]).trim();
    if (heading.length === 0) continue;
    const blockHtml = m[2];
    const paragraphs = [...blockHtml.matchAll(PARAGRAPH_OR_LIST_ITEM_RE)].map((p) => stripTags(p[1]));
    let text = paragraphs.join(" ");
    if (TABLE_TAG_RE.test(blockHtml)) {
      text += " [A real DC-lookup or reference table appears in this section on the source page; its rows are not captured by this extraction pass.]";
    }
    sections.push({ heading, text });
  }
  return sections;
}

export function extractSkillFromHtml(html: string): Dnd35eSkillDefinition {
  const nameMatch = SKILL_NAME_RE.exec(html);
  if (!nameMatch) throw new Error("No real <h1>Name (KeyAbility...)</h1> heading found — not a real skill page.");
  const name = nameMatch[1].trim();
  const flags = nameMatch[2];

  const abilityMatch = ABILITY_NAME_RE.exec(flags);
  const trainedOnly = /Trained Only/i.test(flags);
  const armorCheckPenalty = /Armor Check Penalty/i.test(flags);
  const sections = extractSections(html);

  const notes: string[] = [];
  if (!abilityMatch) notes.push(`No recognized key ability found in the real heading flags: "${flags}".`);
  if (sections.length === 0) notes.push("No real section (Check/Action/Special/etc.) content was extracted.");
  for (const section of sections) {
    if (section.text.includes("[A real DC-lookup or reference table")) {
      notes.push(`"${section.heading}" section contains a real reference table this pass did not structure — see the source page for the full table.`);
    } else if (section.text.trim().length === 0) {
      notes.push(`"${section.heading}" section had no <p> or <li> content this pass recognized — its real content, if any, was not captured.`);
    }
  }

  const extractionStatus: Dnd35eSkillDefinition["extractionStatus"] =
    abilityMatch && sections.length > 0 && !notes.some((n) => n.includes("reference table")) ? "fully_structured" : abilityMatch ? "partially_structured" : "unresolved";

  return {
    canonicalId: buildCanonicalId("dnd35e", "skill", kebabCase(name)),
    name,
    keyAbility: abilityMatch ? ABILITY_NAME_TO_CODE[abilityMatch[1]] : "str",
    trainedOnly,
    armorCheckPenalty,
    sections,
    extractionStatus,
    extractionNotes: notes,
  };
}
