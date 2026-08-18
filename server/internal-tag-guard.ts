// server/internal-tag-guard.ts
//
// 2026-08-18 production incident: a [WORLD_STATE] block reached a player's
// chat verbatim. Root cause: the model wrapped the tag in markdown bold
// (**[WORLD_STATE]**...**[/WORLD_STATE]**), which broke the strict
// `[WORLD_STATE]...[/WORLD_STATE]` extraction regex's JSON.parse (the
// captured payload had a trailing "**" after the closing brace). The
// extractor's catch block then fell back to `cleanContent: text` — the
// ENTIRE raw, untouched response — which was persisted and shown to the
// player. That fallback ("parsing failed, so show the raw protocol text")
// is the actual defect: internal metadata must fail closed, never visible.
//
// This module is the single place every internal AI-protocol tag name is
// listed, and the one function all AI-generated text must pass through
// before it can become player-visible narration or get persisted. It is
// deliberately dependency-free (no imports from dm-engine.ts, routes.ts, or
// storage.ts) so it can be safely imported from any layer — prompt
// construction, route handling, and persistence alike — without circular
// imports, giving each layer an independent copy of the same guarantee
// rather than one shared call site that, if skipped anywhere, leaves a gap.

export const INTERNAL_TAG_NAMES = [
  "WORLD_STATE",
  "CHECK",
  "COMBAT_START",
  "ATTACK",
  "SURRENDER",
  "TITLE_CANDIDATE",
  "TITLE_WITNESS",
  "SHOP",
] as const;

// Tolerates the model wrapping a tag in markdown emphasis (*, **, _, __) —
// exactly the failure mode above — on either or both tags independently.
// Captures the inner content in group 1 (used by extractors that need the
// raw text between tags, e.g. [SHOP]'s pipe-delimited lines); non-global by
// default so `.match()` callers get a proper capture-group result. Pass
// flags: "gi" for replace-all use (see stripInternalTags below).
export function tagBlockPattern(name: string, flags = "i"): RegExp {
  return new RegExp(`[*_]{0,2}\\[${name}\\][*_]{0,2}([\\s\\S]*?)[*_]{0,2}\\[/${name}\\][*_]{0,2}`, flags);
}

const INTERNAL_TAG_DETECTOR = new RegExp(`\\[/?(?:${INTERNAL_TAG_NAMES.join("|")})\\]`, "i");

export function containsInternalTagMarker(text: string): boolean {
  return INTERNAL_TAG_DETECTOR.test(text);
}

/**
 * Strips every recognized internal protocol tag block from AI-generated
 * text. Every known tag is removed by name first; anything left over that
 * still looks like a tag marker (an unclosed tag, a format the model
 * invented, generation cut off mid-block) is treated as unrecoverable and
 * the text is truncated at that marker rather than ever being shown whole.
 * Fails closed: uncertain output is cut short, never exposed raw.
 */
export function stripInternalTags(text: string): string {
  let result = text;
  for (const name of INTERNAL_TAG_NAMES) {
    result = result.replace(tagBlockPattern(name, "gi"), "");
  }

  const leakIndex = result.search(INTERNAL_TAG_DETECTOR);
  if (leakIndex !== -1) {
    console.error(
      "[internal-tag-guard] a tag marker survived stripInternalTags — truncating before it to avoid leaking internal metadata",
      { snippet: result.slice(Math.max(0, leakIndex - 40), leakIndex + 80) },
    );
    result = result.slice(0, leakIndex);
  }

  return result.trim();
}

/**
 * Extracts the first balanced-looking {...} JSON object out of arbitrary
 * surrounding text (markdown fences, tag markers, stray trailing
 * characters) by locating the first "{" and the last "}" rather than
 * trusting the substring between two tags to be pure JSON. This is what
 * makes extraction survive the exact "**" trailing-junk case that broke
 * JSON.parse in the incident above.
 */
export function extractJsonObject(text: string): any | null {
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/m, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}
