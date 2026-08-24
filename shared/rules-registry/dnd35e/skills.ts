// shared/rules-registry/dnd35e/skills.ts
//
// D&D 3.5e-specific skill schema. Deliberately NOT in a shared/edition-
// neutral file — the key-ability/trained-only/armor-check-penalty model and
// the specific skill vocabulary (Disable Device, Use Magic Device, etc.)
// are 3.5 concepts. A parallel 5e implementation has its own, unrelated
// (and much smaller) skill list.

export type Dnd35eAbilityCode = "str" | "dex" | "con" | "int" | "wis" | "cha";

// Real skill pages vary widely in which sections they have (Check, Action,
// Try Again, Special, Synergy, Restriction, and skill-specific deep-dive
// subsections like Disable Device's "Other Ways To Beat A Trap") — this is
// captured as a flat, honestly-named list rather than a fixed set of
// optional fields, the same "preserve real structure, don't force a
// universal shape" choice made for Class Features.
export interface Dnd35eSkillSection {
  heading: string;
  text: string;
}

export interface Dnd35eSkillDefinition {
  canonicalId: string;
  name: string;
  keyAbility: Dnd35eAbilityCode;
  trainedOnly: boolean;
  armorCheckPenalty: boolean;
  sections: Dnd35eSkillSection[];
  extractionStatus: "fully_structured" | "partially_structured" | "unresolved";
  extractionNotes: string[];
}
