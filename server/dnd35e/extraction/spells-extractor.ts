// server/dnd35e/extraction/spells-extractor.ts
//
// Deterministic, regex-based extractor for a real
// d20srd.org/srd/spells/*.htm individual spell-description page. Pure
// function: no network, no DB. First implemented and verified against
// Magic Missile (a simple no-save attack spell), Fireball (an area/Reflex-
// half spell with a real "Area" row instead of "Target(s)"), and Cure
// Light Wounds (a "Target" [singular] touch spell with a real multi-class/
// domain Level row and "(harmless); see text" qualifiers on Saving Throw
// and Spell Resistance).
//
// Design note: every real spell page's "statBlock" table follows the same
// real row-label convention (Level/Components/Casting Time/Range/
// [Target|Targets|Area|Effect]/Duration/Saving Throw/Spell Resistance), so
// this pass scans every real <tr><th>Label:</th><td>Value</td></tr> row
// generically and maps recognized labels to typed fields — an unrecognized
// row label is disclosed via extractionNotes, not silently dropped, and
// does not fail the whole page (real page-to-page label variance, like the
// Target/Targets/Area/Effect row, is expected and handled without forcing
// a fixed row set).

import { buildCanonicalId } from "@shared/rules-registry/canonical-id";
import type { Dnd35eSpellClassLevel, Dnd35eSpellDefinition, Dnd35eSpellTargetKind } from "@shared/rules-registry/dnd35e/spells";
import { stripTags, kebabCase } from "./html-utils";

const NAME_RE = /<h1>([^<]+)<\/h1>/;
const SCHOOL_HEADING_RE = /<h4>([\s\S]*?)<\/h4>/;
const ROW_RE = /<tr>\s*<th>([\s\S]*?)<\/th>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g;
const STAT_BLOCK_TABLE_RE = /<table class="statBlock"[^>]*>([\s\S]*?)<\/table>/;
const PARAGRAPH_RE = /<p[^>]*>([\s\S]*?)<\/p>/g;
const LEVEL_ENTRY_ANCHOR_RE = /<a[^>]*>([^<]+)<\/a>/g;
// Real, deliberate d20srd convention for Greater/Mass/Lesser-style variant
// spells: the description states which named base spell the omitted fields
// are inherited from. Confirmed real phrasing varies page to page — "This
// spell functions like <a>bull's strength</a>, except..." (Bull's Strength,
// Mass), "This spell functions like a <a>fly</a> spell, except..." (Overland
// Flight, with an inserted article), and "Mass bear's endurance works like
// <a>bear's endurance</a>, except..." (Bear's Endurance, Mass) are all real,
// all confirmed against live pages. A handful of spells (e.g. Confusion,
// Lesser's "See the confusion spell, above, to determine...", or Geas/Quest's
// real two-variants-in-one-page layout) use a genuinely different, one-off
// real cross-reference convention this pattern does not attempt to cover —
// those remain honestly unresolved rather than force-matched.
const REFERENCE_VARIANT_RE = /(?:functions like|works like)\s+(?:an?\s+)?<a[^>]*>([^<]+)<\/a>/i;

const TARGET_KIND_LABELS: Record<string, Dnd35eSpellTargetKind> = {
  target: "target",
  targets: "targets",
  area: "area",
  effect: "effect",
};

function parseSchoolHeading(headingHtml: string): { school: string; subschool: string | null; descriptors: string[] } {
  const text = stripTags(headingHtml).trim();
  // Real forms: "Evocation [Force]", "Conjuration (Healing)", or (real,
  // less common) "Conjuration (Calling) [Evil]" — subschool paren always
  // precedes descriptor bracket when both are present.
  const match = /^([A-Za-z]+)(?:\s*\(([^)]+)\))?(?:\s*\[([^\]]+)\])?/.exec(text);
  if (!match) return { school: text, subschool: null, descriptors: [] };
  const descriptors = match[3] ? match[3].split(",").map((d) => d.trim()).filter((d) => d.length > 0) : [];
  return { school: match[1], subschool: match[2] ?? null, descriptors };
}

function parseLevelEntry(raw: string, entries: Dnd35eSpellClassLevel[]): void {
  const parsed = /^(.+?)\s+(\d+)$/.exec(raw.trim());
  if (!parsed) return;
  const level = Number(parsed[2]);
  for (const label of parsed[1].split("/")) {
    entries.push({ classOrDomainLabel: label.trim(), level });
  }
}

function parseLevelCell(cellHtml: string): Dnd35eSpellClassLevel[] {
  const entries: Dnd35eSpellClassLevel[] = [];
  const anchorMatches = [...cellHtml.matchAll(LEVEL_ENTRY_ANCHOR_RE)];
  if (anchorMatches.length > 0) {
    for (const m of anchorMatches) parseLevelEntry(m[1], entries);
  } else {
    // Real page-format variance (e.g. "Mage's Lucubration"'s real Level
    // cell: plain text "Wiz 6" with no <a> wrapper at all — most spell-list
    // links are anchored, but not every real page anchors a single-class
    // entry). Fall back to the plain cell text, comma-split for the rare
    // real case of an unanchored multi-entry cell.
    for (const raw of stripTags(cellHtml).split(",")) parseLevelEntry(raw, entries);
  }
  return entries;
}

export function extractSpellFromHtml(html: string): Dnd35eSpellDefinition {
  const nameMatch = NAME_RE.exec(html);
  if (!nameMatch) throw new Error("No real <h1>Name</h1> heading found — not a real spell page.");
  const name = nameMatch[1].trim();

  const tableMatch = STAT_BLOCK_TABLE_RE.exec(html);
  if (!tableMatch) throw new Error(`No real "statBlock" table found for spell "${name}".`);

  const schoolMatch = SCHOOL_HEADING_RE.exec(html);
  const { school, subschool, descriptors } = schoolMatch ? parseSchoolHeading(schoolMatch[1]) : { school: "", subschool: null, descriptors: [] };

  const notes: string[] = [];
  if (!schoolMatch) notes.push("No real school <h4> heading found.");

  let classLevels: Dnd35eSpellClassLevel[] = [];
  let components: string[] = [];
  let castingTime: string | null = null;
  let range: string | null = null;
  let targetOrAreaOrEffect: Dnd35eSpellDefinition["targetOrAreaOrEffect"] = null;
  let duration: string | null = null;
  let savingThrow: string | null = null;
  let spellResistance: string | null = null;

  ROW_RE.lastIndex = 0;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = ROW_RE.exec(tableMatch[1]))) {
    const label = stripTags(rowMatch[1]).replace(/:$/, "").trim();
    const valueHtml = rowMatch[2];
    const valueText = stripTags(valueHtml).trim();
    const normalizedLabel = label.toLowerCase();

    if (normalizedLabel === "level") {
      classLevels = parseLevelCell(valueHtml);
    } else if (normalizedLabel === "components") {
      components = valueText.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
    } else if (normalizedLabel === "casting time") {
      castingTime = valueText;
    } else if (normalizedLabel === "range") {
      range = valueText;
    } else if (normalizedLabel in TARGET_KIND_LABELS) {
      targetOrAreaOrEffect = { kind: TARGET_KIND_LABELS[normalizedLabel], text: valueText };
    } else if (normalizedLabel === "duration") {
      duration = valueText;
    } else if (normalizedLabel === "saving throw") {
      savingThrow = valueText;
    } else if (normalizedLabel === "spell resistance") {
      spellResistance = valueText;
    } else {
      notes.push(`Unrecognized statBlock row label "${label}" with real value "${valueText}" — not mapped to any typed field.`);
    }
  }

  const descriptionHtml = html.slice(tableMatch.index! + tableMatch[0].length);
  const footerIndex = descriptionHtml.indexOf('<div class="footer">');
  const descriptionScope = footerIndex === -1 ? descriptionHtml : descriptionHtml.slice(0, footerIndex);
  const description = [...descriptionScope.matchAll(PARAGRAPH_RE)].map((p) => stripTags(p[1])).join(" ");

  const referenceMatch = REFERENCE_VARIANT_RE.exec(descriptionScope);
  const inheritsFromName = referenceMatch ? stripTags(referenceMatch[1]).trim() : null;
  const inheritsFromCanonicalId = inheritsFromName ? buildCanonicalId("dnd35e", "spell", kebabCase(inheritsFromName)) : null;

  // Real 3.5e rule: a Personal-range spell only ever affects its own caster,
  // so the SRD never prints a Saving Throw or Spell Resistance row for one —
  // confirmed against the real "Blink" page (Range: Personal, Target: You,
  // no Saving Throw/Spell Resistance rows at all). Their absence here is the
  // correct real answer, not a gap.
  // Real page variance: some Personal-range spells append a real qualifier,
  // e.g. Mirror Image's real Range value "Personal; see text" (the spell
  // also creates images that exist independently of the caster, which the
  // qualifier flags) — still a real Personal-range spell for this purpose.
  const isPersonalRange = range === "Personal" || (range?.startsWith("Personal;") ?? false);

  if (classLevels.length === 0) notes.push("No real class/domain level entries were parsed from the Level row.");
  if (description.length === 0) notes.push("No real description paragraphs were captured.");

  const missingCoreFields: string[] = [];
  if (!castingTime) missingCoreFields.push("Casting Time");
  if (!range) missingCoreFields.push("Range");
  if (!duration) missingCoreFields.push("Duration");
  if (!savingThrow && !isPersonalRange) missingCoreFields.push("Saving Throw");
  if (!spellResistance && !isPersonalRange) missingCoreFields.push("Spell Resistance");

  if (missingCoreFields.length > 0) {
    if (inheritsFromCanonicalId) {
      notes.push(
        `Real reference-based variant spell: the missing field(s) [${missingCoreFields.join(", ")}] are not independently stated on this page — per the real "This spell functions like ${inheritsFromName}, except..." text, they are inherited unchanged from the base spell "${inheritsFromName}" (${inheritsFromCanonicalId}), which this extraction pass does not resolve.`,
      );
    } else {
      for (const field of missingCoreFields) notes.push(`No real ${field} row found.`);
    }
  }

  const coreFieldsPresent =
    classLevels.length > 0 && description.length > 0 && (missingCoreFields.length === 0 || !!inheritsFromCanonicalId);
  const extractionStatus: Dnd35eSpellDefinition["extractionStatus"] = coreFieldsPresent && notes.length === 0 ? "fully_structured" : coreFieldsPresent ? "partially_structured" : "unresolved";

  return {
    canonicalId: buildCanonicalId("dnd35e", "spell", kebabCase(name)),
    name,
    school,
    subschool,
    descriptors,
    classLevels,
    components,
    castingTime: castingTime ?? "",
    range: range ?? "",
    targetOrAreaOrEffect,
    duration: duration ?? "",
    savingThrow,
    spellResistance,
    inheritsFromCanonicalId,
    description,
    extractionStatus,
    extractionNotes: notes,
  };
}
