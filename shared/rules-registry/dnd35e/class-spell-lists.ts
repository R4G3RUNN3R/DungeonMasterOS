// shared/rules-registry/dnd35e/class-spell-lists.ts
//
// D&D 3.5e class spell-list membership — which real spells a given class
// can cast, and at what spell level. Deliberately scoped narrower than a
// full spell definition: the SRD's ~621 individual spell-description pages
// (range, duration, saving throw, spell resistance, full mechanical text)
// are a much larger, separate, real future entity family (see the Spells
// extraction report's explicit scope note). This schema covers only the 8
// real, much cheaper "class spell list" summary pages
// (/srd/spellLists/*Spells.htm), each of which already gives every spell's
// real name, canonical link, level, component markers, and a one-line
// summary — genuine, structured, useful data on its own, and the natural
// index a future spell-description extractor would resolve against.

export interface Dnd35eClassSpellListEntry {
  spellCanonicalId: string;
  name: string;
  level: number;
  // Real component-requirement markers from the source page's own <sup>
  // links, e.g. "M" (material), "F" (focus), "DF" (divine focus), "XP" (XP
  // cost) — preserved as the page's own literal marker text, not
  // re-interpreted into a richer components model (that belongs to the
  // future full spell-description entity family).
  componentMarkers: string[];
  // The real one-line summary from the list page itself — not the full
  // spell description (a separate, future, per-spell page).
  summary: string;
}

export interface Dnd35eClassSpellList {
  // This record's own canonical ID (entityType "class-spell-list", e.g.
  // "dnd35e:class-spell-list:cleric") — distinct from classCanonicalId
  // below, which references the real class entity this list belongs to.
  canonicalId: string;
  classCanonicalId: string;
  entries: Dnd35eClassSpellListEntry[];
  extractionStatus: "fully_structured" | "partially_structured" | "unresolved";
  extractionNotes: string[];
}
