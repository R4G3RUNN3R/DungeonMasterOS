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
//
// The real page overwhelmingly phrases multi-part prerequisites as a
// top-level comma-separated list ("Str 13, Power Attack.", "Dex 13, Wis 13,
// Improved Unarmed Strike, base attack bonus +8."). This pass splits on
// those top-level commas (respecting paren nesting, since one real clause —
// Exotic Weapon Proficiency's BAB clause — embeds its own parenthetical
// aside), classifies each clause independently against an expanded pattern
// set, and composes the results into a real `{kind:"all", requirements:[...]}`
// instead of one opaque `special` blob for the whole field. A clause that
// still doesn't match anything becomes its own per-clause `special` — never
// silently dropped, never guessed — so a partially-mixed field now yields
// real structured facts for its recognizable parts and honest `special` only
// for the genuinely unrecognized remainder.
//
// No real "any"/OR-alternative prerequisite was observed on this page (only
// AND-composition via comma lists), so this pass does not attempt to detect
// OR phrasing — the evaluator already supports `any`, this extractor simply
// has nothing real to feed it yet.

const FEAT_ANCHOR_RE = /<a href="#([a-zA-Z0-9]+)">([^<]*)<\/a>/g;
// Case-insensitive: "Base attack bonus" is only capitalized when it opens
// the whole field. Mid-field, after a comma-split, the real page has it
// lowercase ("Proficient with weapon, base attack bonus +8.").
const BAB_WHOLE_RE = /^base attack bonus \+(\d+)\.?$/i;
// Exotic Weapon Proficiency's real clause: "Base attack bonus +1 (plus Str
// 13 for bastard sword or dwarven waraxe)." — a BAB value plus a genuine
// parenthetical aside that must not be silently dropped.
const BAB_TRAILING_RE = /^base attack bonus \+(\d+)\s*\(([^)]*)\)\.?$/i;
const ABILITY_WHOLE_RE = /^(Str|Dex|Con|Int|Wis|Cha) (\d+)\.?$/;
// Original phrasing: "N ranks in <skill>."
const SKILL_RANKS_WHOLE_RE = /^(\d+) ranks? in ([A-Za-z ]+?)\.?$/;
// Reversed phrasing, the real page's actual style for this ("Ride 1 rank.").
// Requires the literal "rank(s)" keyword so it can't collide with the
// ability-score pattern (which is checked first anyway).
const SKILL_RANKS_REVERSED_RE = /^([A-Za-z][A-Za-z ]*?) (\d+) ranks?\.?$/;
const CASTER_LEVEL_RE = /^caster level (\d+)(?:st|nd|rd|th)?\.?$/i;
const CHARACTER_LEVEL_RE = /^character level (\d+)(?:st|nd|rd|th)?\.?$/i;
const MANIFESTER_LEVEL_RE = /^manifester level (\d+)(?:st|nd|rd|th)?\.?$/i;
// Generic "<Class> level Nth." — checked only after the three specific
// level kinds above, so it never swallows "Caster level 3rd." as a class
// named "Caster". stripTags already removes the real page's <a
// href="/srd/classes/...">Fighter</a> wrapper, leaving plain "fighter level
// 8th." for this to match.
const CLASS_LEVEL_RE = /^([A-Za-z][A-Za-z '-]*?) level (\d+)(?:st|nd|rd|th)?\.?$/i;
// Real page phrasings: "Proficiency with selected weapon", "Proficient with
// weapon", "Weapon Proficiency (crossbow type chosen)." — broad substring
// match is deliberate; every real observed variant contains "proficien".
const PROFICIENCY_RE = /proficien(t|cy)/i;

type AbilityCode = "str" | "dex" | "con" | "int" | "wis" | "cha";

const ABILITY_CODE: Record<string, AbilityCode> = {
  Str: "str",
  Dex: "dex",
  Con: "con",
  Int: "int",
  Wis: "wis",
  Cha: "cha",
};

// Splits raw prerequisite HTML on top-level commas — commas not nested
// inside parentheses. This must operate on the raw HTML (not stripped text)
// so per-clause classification can still see <a href="#slug"> feat anchors.
function splitTopLevelClauses(rawHtml: string): string[] {
  const clauses: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of rawHtml) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      clauses.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) clauses.push(current);
  return clauses.map((c) => c.trim()).filter((c) => c.length > 0);
}

// Classifies one clause (raw HTML, no top-level commas inside it) into one
// or more prerequisites. Almost always returns exactly one; a clause that
// pairs a real feat/BAB anchor with genuine trailing prose (a parenthetical
// aside, a "with selected weapon" qualifier) returns the structured fact
// plus a `special` sibling for the prose, so nothing real is silently lost.
function classifyClause(rawClauseHtml: string): Dnd35eFeatPrerequisite[] {
  const anchors = [...rawClauseHtml.matchAll(FEAT_ANCHOR_RE)];
  if (anchors.length === 1) {
    const featReq: Dnd35eFeatPrerequisite = {
      kind: "feat",
      featCanonicalId: buildCanonicalId("dnd35e", "feat", kebabCase(anchors[0][1])),
    };
    // Strip stray leading/trailing commas and periods (sentence-ending
    // punctuation left behind by clause-splitting, e.g. a bare "." after
    // the anchor when this was the last item in a list) before deciding
    // whether real trailing prose remains — "(conjuration)" and "with
    // selected weapon" are real content; a lone "." is not.
    const residual = stripTags(rawClauseHtml.replace(FEAT_ANCHOR_RE, ""))
      .trim()
      .replace(/^[,.]+|[,.]+$/g, "")
      .trim();
    return residual.length === 0 ? [featReq] : [featReq, { kind: "special", description: residual }];
  }

  const text = stripTags(rawClauseHtml);
  if (text.length === 0) return [];

  const babTrailing = BAB_TRAILING_RE.exec(text);
  if (babTrailing) {
    return [
      { kind: "bab", minimum: Number(babTrailing[1]) },
      { kind: "special", description: babTrailing[2].trim() },
    ];
  }

  const bab = BAB_WHOLE_RE.exec(text);
  if (bab) return [{ kind: "bab", minimum: Number(bab[1]) }];

  const ability = ABILITY_WHOLE_RE.exec(text);
  if (ability) return [{ kind: "ability", ability: ABILITY_CODE[ability[1]], minimum: Number(ability[2]) }];

  const skillForward = SKILL_RANKS_WHOLE_RE.exec(text);
  if (skillForward) {
    return [
      {
        kind: "skill_ranks",
        skillCanonicalId: buildCanonicalId("dnd35e", "skill", kebabCase(skillForward[2].trim())),
        ranks: Number(skillForward[1]),
      },
    ];
  }

  const casterLevel = CASTER_LEVEL_RE.exec(text);
  if (casterLevel) return [{ kind: "caster_level", minimum: Number(casterLevel[1]) }];

  const characterLevel = CHARACTER_LEVEL_RE.exec(text);
  if (characterLevel) return [{ kind: "character_level", minimum: Number(characterLevel[1]) }];

  const manifesterLevel = MANIFESTER_LEVEL_RE.exec(text);
  if (manifesterLevel) return [{ kind: "manifester_level", minimum: Number(manifesterLevel[1]) }];

  const classLevel = CLASS_LEVEL_RE.exec(text);
  if (classLevel) {
    return [
      {
        kind: "class_level",
        classCanonicalId: buildCanonicalId("dnd35e", "class", kebabCase(classLevel[1].trim())),
        minimum: Number(classLevel[2]),
      },
    ];
  }

  const skillReversed = SKILL_RANKS_REVERSED_RE.exec(text);
  if (skillReversed) {
    return [
      {
        kind: "skill_ranks",
        skillCanonicalId: buildCanonicalId("dnd35e", "skill", kebabCase(skillReversed[1].trim())),
        ranks: Number(skillReversed[2]),
      },
    ];
  }

  if (PROFICIENCY_RE.test(text)) {
    return [{ kind: "proficiency", description: text }];
  }

  const withoutTrailingPeriod = text.replace(/\.$/, "");
  if (/^ability to /i.test(text) || /\bability$/i.test(withoutTrailingPeriod)) {
    return [{ kind: "class_feature", description: text }];
  }

  // Real prose this pass genuinely can't normalize safely (e.g. "compatible
  // alignment" — inherently relative to another character's alignment, not
  // a flat literal value; "sufficiently high level (see below)" — points at
  // narrative table lookup, not a number). Preserved verbatim, never guessed.
  return [{ kind: "special", description: text }];
}

function parsePrerequisites(rawHtml: string): Dnd35eFeatPrerequisite {
  const clauses = splitTopLevelClauses(rawHtml);
  const requirements = clauses.flatMap(classifyClause);
  if (requirements.length === 0) return { kind: "special", description: stripTags(rawHtml) };
  return requirements.length === 1 ? requirements[0] : { kind: "all", requirements };
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
