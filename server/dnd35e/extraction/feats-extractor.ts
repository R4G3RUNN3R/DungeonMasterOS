// server/dnd35e/extraction/feats-extractor.ts
//
// Deterministic, regex-based extractor for the real d20srd.org/srd/feats.htm
// page. Pure function: no network, no DB. Parses every real <h3 id="slug">
// Name [Type]</h3> block and its <h5> subsections (Prerequisites/Benefit/
// Normal/Special) into a Dnd35eFeatDefinition.
//
// Design note on "honest partial extraction": this file recognizes a small,
// fixed set of clean, whole-field prose patterns for prerequisites and
// benefits. The real page is far messier than any fixed pattern set can
// fully cover (mixed prerequisite clauses, reversed skill-rank phrasing,
// multi-paragraph Special sections, etc.) — see feats-extractor.test.ts and
// the task report for the real, counted breakdown. Anything that doesn't
// cleanly match becomes `special` / `unresolved` rather than a forced,
// silently-wrong structured value.

import { buildCanonicalId } from "@shared/rules-registry/canonical-id";
import type {
  Dnd35eFeatDefinition,
  Dnd35eFeatEffect,
  Dnd35eFeatPrerequisite,
  Dnd35eFeatType,
} from "@shared/rules-registry/dnd35e/feats";

// --- small text helpers -----------------------------------------------

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Converts a real d20srd anchor id (camelCase, e.g. "armorProficiencyHeavy")
// into a kebab-case canonical-id slug ("armor-proficiency-heavy"). Also
// handles plain lowercase words ("acrobatic" -> "acrobatic") and skill/ability
// display names with spaces ("Handle Animal" -> "handle-animal").
function kebabCase(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const FEAT_TYPE_MAP: Record<string, Dnd35eFeatType> = {
  general: "general",
  fighter: "fighter",
  "item creation": "item-creation",
  metamagic: "metamagic",
  special: "special",
};

// --- <h3> block discovery ----------------------------------------------
//
// Real observed pattern: <h3 id="slug">Name [Type]</h3>, but at least one
// real feat (Lightning Reflexes, line ~1935 of the captured fixture) carries
// an extra style="clear:right" attribute before the closing '>' — so the id
// group must tolerate trailing attributes, not just an exact `id="...">`.
//
// The page also has three non-feat <h3> section headers with no bracketed
// type at all (Fighter Bonus Feats, Item Creation Feats, Metamagic Feats),
// which this regex naturally excludes by requiring the bracket. The one
// real bracketed <h3> that is NOT an actual feat is the format-legend row
// ("Feat Name [Type Of Feat]", id="featNameTypeOfFeat") that introduces the
// "Feat Descriptions" section — its bracket text "Type Of Feat" doesn't map
// to any real feat-type vocabulary, so it's filtered out below rather than
// hard-coding its id.
const H3_BLOCK_RE = /<h3 id="([a-zA-Z0-9]+)"[^>]*>([^<]+?)\s*\[([^\]]+)\]<\/h3>/g;

// Within a block, up to the next <h3>: each <h5>Heading</h5> immediately
// followed by a single <p>...</p>. Real page headings vary between singular
// and plural ("Prerequisite" vs "Prerequisites", "Benefit" vs "Benefits");
// only the first <p> after a heading is captured (real Benefit, Special, and
// occasionally other sections run to a second or third <p> — that overflow
// is intentionally not captured by this pass, matching the deterministic,
// minimal-parsing design). For the Benefit section specifically, this
// truncation is not silent: see countBenefitParagraphs below, which detects
// the real paragraph count and records an honest extractionNotes entry when
// content is being dropped.
const H5_SECTION_RE = /<h5[^>]*>([^<]+)<\/h5>\s*<p>\s*([\s\S]*?)\s*<\/p>/g;

function normalizeHeading(raw: string): "prerequisites" | "benefit" | "normal" | "special" | null {
  const t = raw.trim();
  if (/^Prerequisites?$/.test(t)) return "prerequisites";
  if (/^Benefits?$/.test(t)) return "benefit";
  if (/^Normal$/.test(t)) return "normal";
  if (/^Special$/.test(t)) return "special";
  return null;
}

// --- prerequisite parsing ------------------------------------------------

const FEAT_ANCHOR_RE = /<a href="#([a-zA-Z0-9]+)">([^<]*)<\/a>/g;
const BAB_WHOLE_RE = /^Base attack bonus \+(\d+)\.?$/;
const ABILITY_WHOLE_RE = /^(Str|Dex|Con|Int|Wis|Cha) (\d+)\.?$/;
const SKILL_RANKS_WHOLE_RE = /^(\d+) ranks? in ([A-Za-z ]+?)\.?$/;

type AbilityCode = "str" | "dex" | "con" | "int" | "wis" | "cha";

const ABILITY_CODE: Record<string, AbilityCode> = {
  Str: "str",
  Dex: "dex",
  Con: "con",
  Int: "int",
  Wis: "wis",
  Cha: "cha",
};

function parsePrerequisites(rawHtml: string): Dnd35eFeatPrerequisite {
  const text = stripTags(rawHtml);

  // Pattern 1: a pure comma/period-separated list of #slug feat-anchor
  // links, with no other real prose content in the field.
  const anchors: { slug: string }[] = [];
  let anchorMatch: RegExpExecArray | null;
  FEAT_ANCHOR_RE.lastIndex = 0;
  while ((anchorMatch = FEAT_ANCHOR_RE.exec(rawHtml))) {
    anchors.push({ slug: anchorMatch[1] });
  }
  if (anchors.length > 0) {
    const remainder = stripTags(rawHtml.replace(FEAT_ANCHOR_RE, ""));
    // FEAT_ANCHOR_RE has the /g flag; replace() with a global regex and no
    // lastIndex dependency is safe here since we're not using exec() on it.
    if (/^[,.\s]*$/.test(remainder)) {
      const requirements: Dnd35eFeatPrerequisite[] = anchors.map((a) => ({
        kind: "feat",
        featCanonicalId: buildCanonicalId("dnd35e", "feat", kebabCase(a.slug)),
      }));
      return requirements.length === 1 ? requirements[0] : { kind: "all", requirements };
    }
  }

  // Pattern 2: a bare "Base attack bonus +N." field, nothing else.
  const babMatch = BAB_WHOLE_RE.exec(text);
  if (babMatch) {
    return { kind: "bab", minimum: Number(babMatch[1]) };
  }

  // Pattern 3: a bare "Xyz N." ability-score field, nothing else.
  const abilityMatch = ABILITY_WHOLE_RE.exec(text);
  if (abilityMatch) {
    return { kind: "ability", ability: ABILITY_CODE[abilityMatch[1]], minimum: Number(abilityMatch[2]) };
  }

  // Pattern 4: a bare "N ranks in <skill>." field, nothing else. (Note: the
  // real fixture's skill-rank prerequisites are all phrased the opposite
  // way — "<Skill> N rank(s)", e.g. "Ride 1 rank" — which this pattern does
  // not match; those honestly fall through to `special` below rather than
  // being force-matched by a pattern this plan didn't actually observe.)
  const skillMatch = SKILL_RANKS_WHOLE_RE.exec(text);
  if (skillMatch) {
    return {
      kind: "skill_ranks",
      skillCanonicalId: buildCanonicalId("dnd35e", "skill", kebabCase(skillMatch[2].trim())),
      ranks: Number(skillMatch[1]),
    };
  }

  // Anything else — including every mixed clause like "Str 13, Power
  // Attack." or "Base attack bonus +1 (plus Str 13 for bastard sword...)."
  // — is real prose this pass doesn't force into a wrong structured shape.
  return { kind: "special", description: text };
}

// --- benefit / effect parsing --------------------------------------------

const SKILL_CHECK_BONUS_RE =
  /You get a \+(\d+) bonus on all <a[^>]*>([^<]+)<\/a> checks and <a[^>]*>([^<]+)<\/a> checks/;

function parseBenefitEffect(rawHtml: string): Dnd35eFeatEffect {
  const match = SKILL_CHECK_BONUS_RE.exec(rawHtml);
  if (match) {
    const bonus = Number(match[1]);
    const skillCanonicalIds = [
      buildCanonicalId("dnd35e", "skill", kebabCase(match[2].trim())),
      buildCanonicalId("dnd35e", "skill", kebabCase(match[3].trim())),
    ];
    return { kind: "skill_check_bonus", skillCanonicalIds, bonus, bonusType: "competence" };
  }
  return {
    kind: "unresolved",
    rawBenefitText: stripTags(rawHtml),
    reason: "no matching structured-effect pattern",
  };
}

// --- benefit multi-paragraph detection -----------------------------------
//
// H5_SECTION_RE above only captures a heading's first <p>...</p> block, by
// design (see the comment above H5_SECTION_RE). For the Benefit section
// specifically — since it's the one this pass structures effects from, and
// rawBenefitText/benefitSummary are meant to be a reliable "preservation of
// record" for anything an unresolved/partially_structured feat couldn't be
// structured — silently dropping extra paragraphs would hide real content
// rather than fail honestly. This helper finds the true paragraph count of
// the real Benefit section (between its <h5> heading and the next <h5>, or
// the end of the block) so the caller can record an honest extractionNotes
// entry whenever more than one paragraph is being truncated.
const H5_HEADING_ONLY_RE = /<h5[^>]*>([^<]+)<\/h5>/g;

function countBenefitParagraphs(blockHtml: string): number {
  const headings: { key: ReturnType<typeof normalizeHeading>; start: number; end: number }[] = [];
  let headingMatch: RegExpExecArray | null;
  H5_HEADING_ONLY_RE.lastIndex = 0;
  while ((headingMatch = H5_HEADING_ONLY_RE.exec(blockHtml))) {
    headings.push({ key: normalizeHeading(headingMatch[1]), start: headingMatch.index, end: H5_HEADING_ONLY_RE.lastIndex });
  }
  const benefitIndex = headings.findIndex((h) => h.key === "benefit");
  if (benefitIndex === -1) return 0;
  const sectionStart = headings[benefitIndex].end;
  const sectionEnd = benefitIndex + 1 < headings.length ? headings[benefitIndex + 1].start : blockHtml.length;
  const section = blockHtml.slice(sectionStart, sectionEnd);
  const paragraphMatches = section.match(/<p[^>]*>/g);
  return paragraphMatches ? paragraphMatches.length : 0;
}

// --- extractionStatus / notes --------------------------------------------

function prerequisitesContainSpecial(prereq: Dnd35eFeatPrerequisite | null): boolean {
  if (prereq === null) return false;
  if (prereq.kind === "special") return true;
  if (prereq.kind === "all" || prereq.kind === "any") {
    return prereq.requirements.some(prerequisitesContainSpecial);
  }
  return false;
}

function collectPrereqSpecialDescriptions(prereq: Dnd35eFeatPrerequisite | null): string[] {
  if (prereq === null) return [];
  if (prereq.kind === "special") return [prereq.description];
  if (prereq.kind === "all" || prereq.kind === "any") {
    return prereq.requirements.flatMap(collectPrereqSpecialDescriptions);
  }
  return [];
}

// --- main entry point -----------------------------------------------------

export function extractFeatsFromHtml(html: string): Dnd35eFeatDefinition[] {
  const blocks: { slug: string; name: string; typeLabel: string; start: number; end: number }[] = [];
  let h3Match: RegExpExecArray | null;
  H3_BLOCK_RE.lastIndex = 0;
  while ((h3Match = H3_BLOCK_RE.exec(html))) {
    blocks.push({
      slug: h3Match[1],
      name: h3Match[2].trim(),
      typeLabel: h3Match[3].trim(),
      start: H3_BLOCK_RE.lastIndex,
      end: -1, // filled below
    });
  }
  for (let i = 0; i < blocks.length; i++) {
    blocks[i].end = i + 1 < blocks.length ? blocks[i + 1].start : html.length;
  }

  const feats: Dnd35eFeatDefinition[] = [];

  for (const block of blocks) {
    const featType = FEAT_TYPE_MAP[block.typeLabel.toLowerCase()];
    if (!featType) {
      // Not a real feat — the page-format legend row ("Feat Name [Type Of
      // Feat]") is the only real <h3>...[...]</h3> block on the live page
      // whose bracket text doesn't map to a real feat-type vocabulary word.
      continue;
    }

    const blockHtml = html.slice(block.start, block.end);
    const sections = new Map<string, string>();
    let h5Match: RegExpExecArray | null;
    H5_SECTION_RE.lastIndex = 0;
    while ((h5Match = H5_SECTION_RE.exec(blockHtml))) {
      const key = normalizeHeading(h5Match[1]);
      if (key && !sections.has(key)) {
        sections.set(key, h5Match[2]);
      }
    }

    const prerequisitesRaw = sections.get("prerequisites") ?? null;
    const prerequisites = prerequisitesRaw === null ? null : parsePrerequisites(prerequisitesRaw);

    const benefitRaw = sections.get("benefit") ?? null;
    const mechanicalEffects: Dnd35eFeatEffect[] = benefitRaw === null ? [] : [parseBenefitEffect(benefitRaw)];

    const notes: string[] = [];
    for (const description of collectPrereqSpecialDescriptions(prerequisites)) {
      notes.push(`Prerequisites text did not match a structured pattern: "${description}"`);
    }
    for (const effect of mechanicalEffects) {
      if (effect.kind === "unresolved") {
        notes.push(`Benefit text did not match a structured effect pattern (${effect.reason}): "${effect.rawBenefitText}"`);
      }
    }

    const benefitParagraphCount = countBenefitParagraphs(blockHtml);
    if (benefitParagraphCount > 1) {
      notes.push(
        `Benefit section has ${benefitParagraphCount} paragraphs; only the first was parsed for structured effects — see the real source page for the full text.`,
      );
    }

    const hasSpecialPrereq = prerequisitesContainSpecial(prerequisites);
    const structuredEffectCount = mechanicalEffects.filter((e) => e.kind !== "unresolved").length;
    const unresolvedEffectCount = mechanicalEffects.length - structuredEffectCount;

    let extractionStatus: Dnd35eFeatDefinition["extractionStatus"];
    if (!hasSpecialPrereq && unresolvedEffectCount === 0) {
      extractionStatus = "fully_structured";
    } else if (structuredEffectCount === 0 && (prerequisites === null || hasSpecialPrereq)) {
      extractionStatus = "unresolved";
    } else {
      extractionStatus = "partially_structured";
    }

    const benefitSummary = benefitRaw === null ? "" : stripTags(benefitRaw);

    feats.push({
      canonicalId: buildCanonicalId("dnd35e", "feat", kebabCase(block.slug)),
      name: block.name,
      featType,
      prerequisites,
      benefitSummary,
      mechanicalEffects,
      extractionStatus,
      extractionNotes: notes,
    });
  }

  return feats;
}
