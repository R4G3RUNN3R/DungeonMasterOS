// shared/rules-registry/dnd35e/spells.ts
//
// D&D 3.5e-specific individual spell-description schema. Deliberately NOT
// in a shared/edition-neutral file — the school/subschool/descriptor model,
// the Vancian components/casting-time/range/target-area-effect/duration/
// saving-throw/spell-resistance "stat block" shape, and 3.5's specific
// spell list are 3.5 concepts (5e's spell block is meaningfully different —
// e.g. no separate spell resistance line, no subschools). A parallel 5e
// implementation has its own, unrelated spell model.

// Real per-class (or per-domain) level a spell appears at, e.g. "Sor/Wiz 1"
// on the source page decomposes into two real entries: {classOrDomainLabel:
// "Sor", level: 1} and {classOrDomainLabel: "Wiz", level: 1}. Domains (e.g.
// "Healing 1") appear in the same real row and are preserved the same way —
// this pass does not attempt to resolve a label to a canonical class or
// domain ID; it's a real, literal cross-reference class-spell-lists.ts's
// per-class extraction already covers that resolution for the 6 core
// casting classes independently.
export interface Dnd35eSpellClassLevel {
  classOrDomainLabel: string;
  level: number;
}

export type Dnd35eSpellTargetKind = "target" | "targets" | "area" | "effect";

export interface Dnd35eSpellDefinition {
  canonicalId: string;
  name: string;
  school: string;
  subschool: string | null;
  descriptors: string[];
  classLevels: Dnd35eSpellClassLevel[];
  components: string[];
  castingTime: string;
  range: string;
  targetOrAreaOrEffect: { kind: Dnd35eSpellTargetKind; text: string } | null;
  duration: string;
  // null (rather than "") means the real page has no Saving Throw / Spell
  // Resistance row at all — either because the spell's real Range is
  // "Personal" (3.5e rule: a personal-range spell only ever affects its own
  // caster, so the SRD never prints these rows for one) or because the spell
  // is a real reference-based variant (see inheritsFromCanonicalId) whose
  // real page never restates them. Neither case is an extraction failure.
  savingThrow: string | null;
  spellResistance: string | null;
  // Set when the real description contains the literal real SRD convention
  // "This spell functions like <base spell>, except...", used by Greater/
  // Mass/Lesser-style variant spells whose real page prints only the stat-
  // block rows that differ from a named base spell (confirmed via the real
  // "Bull's Strength, Mass" page: only Level/Range/Targets rows exist, with
  // Components/Casting Time/Duration/Saving Throw/Spell Resistance all
  // deliberately omitted and left to the referenced base spell). This pass
  // does not resolve/inherit those fields' real values — it records which
  // base spell they come from so a later pass can.
  inheritsFromCanonicalId: string | null;
  description: string;
  extractionStatus: "fully_structured" | "partially_structured" | "unresolved";
  extractionNotes: string[];
}
