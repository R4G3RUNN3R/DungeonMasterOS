// server/dnd35e/extraction/html-utils.ts
//
// Small, pure HTML/text helpers shared across every dnd35e SRD extractor.
// Extracted out of feats-extractor.ts once a second extractor (races) needed
// the exact same two functions — more entity-family extractors are planned
// (per the project's 21-step implementation order), so this avoids
// re-duplicating them for each one.

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Converts a real d20srd anchor id (camelCase, e.g. "armorProficiencyHeavy")
// into a kebab-case canonical-id slug ("armor-proficiency-heavy"). Also
// handles plain lowercase words ("acrobatic" -> "acrobatic") and display
// names with spaces ("Handle Animal" -> "handle-animal").
export function kebabCase(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
