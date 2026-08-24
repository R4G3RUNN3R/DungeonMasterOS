// server/dnd35e/extraction/class-spell-lists-extractor.ts
//
// Deterministic, regex-based extractor for a real
// d20srd.org/srd/spellLists/*Spells.htm class spell-list page. Pure
// function: no network, no DB. First implemented and verified against the
// real Cleric spells list.
//
// Real page shape: a real <h3 id="...">N-Level ClassName Spells...</h3>
// per spell level (0-Level for cantrips, using ordinal suffixes 1st/2nd/...
// beyond that), each followed by a <ul> of <li> entries. Each <li> is
// <strong><a class="spell" href="/srd/spells/slug.htm">Name</a>
// [<sup><a ...>M</a></sup> ...]:</strong> one-line summary. A single <li>
// sometimes lists MULTIPLE real, distinct spells sharing one summary line
// (e.g. "Detect Chaos/Evil/Good/Law" is 4 real spell pages) — every real
// spell anchor in the header is captured as its own entry, all sharing
// that <li>'s level and summary, rather than only the first.

import { buildCanonicalId } from "@shared/rules-registry/canonical-id";
import type { Dnd35eClassSpellList, Dnd35eClassSpellListEntry } from "@shared/rules-registry/dnd35e/class-spell-lists";
import { stripTags, kebabCase } from "./html-utils";

const LEVEL_HEADING_RE = /<h3(?:\s+id="[a-zA-Z0-9]+")?[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|<div class="footer">|$)/g;
const LEVEL_NUMBER_RE = /^(\d+)(?:st|nd|rd|th)?-Level/i;
const LI_RE = /<li>([\s\S]*?)<\/li>/g;
const STRONG_BLOCK_RE = /<strong>([\s\S]*?)<\/strong>/;
const SPELL_ANCHOR_RE = /<a class="spell" href="\/srd\/spells\/([a-zA-Z0-9]+)\.htm">([^<]*)<\/a>/g;
const COMPONENT_MARKER_RE = /<sup>\s*<a[^>]*>([A-Za-z]+)<\/a>\s*<\/sup>/g;

function parseSpellListLi(liHtml: string): { spells: { slug: string; name: string }[]; componentMarkers: string[]; summary: string } | null {
  const strongMatch = STRONG_BLOCK_RE.exec(liHtml);
  if (!strongMatch) return null;
  const headerHtml = strongMatch[1];
  const spells = [...headerHtml.matchAll(SPELL_ANCHOR_RE)].map((m) => ({ slug: m[1], name: m[2].trim() }));
  const componentMarkers = [...headerHtml.matchAll(COMPONENT_MARKER_RE)].map((m) => m[1]);
  const summaryHtml = liHtml.slice(strongMatch.index! + strongMatch[0].length);
  const summary = stripTags(summaryHtml).replace(/^:\s*/, "").trim();
  return { spells, componentMarkers, summary };
}

export function extractClassSpellListFromHtml(html: string, classCanonicalId: string, classSlug: string): Dnd35eClassSpellList {
  const entries: Dnd35eClassSpellListEntry[] = [];
  const notes: string[] = [];

  let levelMatch: RegExpExecArray | null;
  LEVEL_HEADING_RE.lastIndex = 0;
  let anyLevelHeadingFound = false;
  while ((levelMatch = LEVEL_HEADING_RE.exec(html))) {
    const headingText = stripTags(levelMatch[1]).trim();
    const levelNumberMatch = LEVEL_NUMBER_RE.exec(headingText);
    if (!levelNumberMatch) continue; // a real non-spell-level h3 elsewhere on the page (none observed on Cleric's page, but not assumed impossible)
    anyLevelHeadingFound = true;
    const level = Number(levelNumberMatch[1]);

    let liMatch: RegExpExecArray | null;
    LI_RE.lastIndex = 0;
    while ((liMatch = LI_RE.exec(levelMatch[2]))) {
      const parsed = parseSpellListLi(liMatch[1]);
      if (!parsed || parsed.spells.length === 0) {
        notes.push(`Level ${level}: a real <li> entry did not match the expected "<strong><a class="spell">Name</a>...:</strong> summary" pattern — real text: "${stripTags(liMatch[1]).slice(0, 120)}"`);
        continue;
      }
      for (const spell of parsed.spells) {
        entries.push({
          spellCanonicalId: buildCanonicalId("dnd35e", "spell", kebabCase(spell.slug)),
          name: spell.name,
          level,
          componentMarkers: parsed.componentMarkers,
          summary: parsed.summary,
        });
      }
    }
  }

  if (!anyLevelHeadingFound) notes.push("No real spell-level <h3> heading was recognized on this page.");
  if (entries.length === 0) notes.push("No real spell entries were extracted.");

  const extractionStatus: Dnd35eClassSpellList["extractionStatus"] =
    entries.length > 0 && notes.length === 0 ? "fully_structured" : entries.length > 0 ? "partially_structured" : "unresolved";

  return {
    canonicalId: buildCanonicalId("dnd35e", "class-spell-list", kebabCase(classSlug)),
    classCanonicalId,
    entries,
    extractionStatus,
    extractionNotes: notes,
  };
}
