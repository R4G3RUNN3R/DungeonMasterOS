// shared/rules-registry/dnd35e/feats.ts
//
// D&D 3.5e-specific feat schema. Deliberately NOT in a shared/edition-neutral
// file — BAB, ability-score prerequisites, and 3.5's specific feat-type
// vocabulary are 3.5 concepts, not universal rules-engine concepts. A
// parallel 5e implementation has its own, unrelated feat/feature model.

export type Dnd35eFeatType = "general" | "fighter" | "item-creation" | "metamagic" | "special";

export type Dnd35eFeatPrerequisite =
  | { kind: "all"; requirements: Dnd35eFeatPrerequisite[] }
  | { kind: "any"; requirements: Dnd35eFeatPrerequisite[] }
  | { kind: "ability"; ability: "str" | "dex" | "con" | "int" | "wis" | "cha"; minimum: number }
  | { kind: "bab"; minimum: number }
  | { kind: "skill_ranks"; skillCanonicalId: string; ranks: number }
  | { kind: "feat"; featCanonicalId: string }
  | { kind: "class_level"; classCanonicalId: string; minimum: number }
  | { kind: "character_level"; minimum: number }
  | { kind: "caster_level"; minimum: number }
  | { kind: "manifester_level"; minimum: number }
  // Typed-but-not-yet-independently-evaluable: no canonical weapon/armor or
  // class-feature entity family exists yet to check these against, so the
  // evaluator treats them like `special` (always fails, requires manual
  // confirmation) — but keeping them as their own kind, rather than folding
  // into generic `special`, means a future UI/pass can group and explain
  // them correctly instead of treating every unstructured requirement the
  // same way. This is the "explicit structured exception" middle ground
  // between "fully evaluable" and "opaque prose."
  | { kind: "proficiency"; description: string }
  | { kind: "class_feature"; description: string }
  | { kind: "special"; description: string };

export type Dnd35eFeatEffect =
  | { kind: "skill_check_bonus"; skillCanonicalIds: string[]; bonus: number; bonusType: "competence" | "untyped" }
  // Saving throws are a distinct 3.5 mechanical concept from skills — never
  // conflated into skill_check_bonus, even though the surface shape (a flat
  // untyped/competence bonus) looks similar.
  | { kind: "save_bonus"; save: "fortitude" | "reflex" | "will"; bonus: number; bonusType: "competence" | "untyped" }
  | { kind: "unresolved"; rawBenefitText: string; reason: string };

export interface Dnd35eFeatDefinition {
  canonicalId: string;
  name: string;
  featType: Dnd35eFeatType;
  prerequisites: Dnd35eFeatPrerequisite | null;
  benefitSummary: string;
  mechanicalEffects: Dnd35eFeatEffect[];
  extractionStatus: "fully_structured" | "partially_structured" | "unresolved";
  extractionNotes: string[];
}

const ABILITY_LABELS: Record<string, string> = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };

export function describeFeatPrerequisite(prereq: Dnd35eFeatPrerequisite | null): string {
  if (prereq === null) return "None";
  switch (prereq.kind) {
    case "all": return prereq.requirements.map(describeFeatPrerequisite).join(", ");
    case "any": return prereq.requirements.map(describeFeatPrerequisite).join(" or ");
    case "ability": return `${ABILITY_LABELS[prereq.ability]} ${prereq.minimum}`;
    case "bab": return `Base attack bonus +${prereq.minimum}`;
    case "skill_ranks": return `${prereq.ranks} ranks in ${prereq.skillCanonicalId}`;
    case "feat": return prereq.featCanonicalId;
    case "class_level": return `${prereq.classCanonicalId} level ${prereq.minimum}`;
    case "character_level": return `Character level ${prereq.minimum}`;
    case "caster_level": return `Caster level ${prereq.minimum}`;
    case "manifester_level": return `Manifester level ${prereq.minimum}`;
    case "proficiency": return prereq.description;
    case "class_feature": return prereq.description;
    case "special": return prereq.description;
  }
}
