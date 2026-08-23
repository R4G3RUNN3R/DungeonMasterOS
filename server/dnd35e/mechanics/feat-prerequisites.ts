// server/dnd35e/mechanics/feat-prerequisites.ts
//
// Pure, deterministic feat-prerequisite evaluation. The server determines
// legal selections (Player Agency requirement) — this is that determination,
// real and callable, not inert data. A "special" (unstructured) prerequisite
// always fails: the server cannot mechanically verify prose it couldn't
// parse, and silently passing it would let a permanent character-development
// choice go unvalidated. That is a real, deliberate fail-closed default, not
// an oversight — matches "failures must fail honestly."

import { describeFeatPrerequisite } from "../../../shared/rules-registry/dnd35e/feats";
import type { Dnd35eFeatPrerequisite } from "../../../shared/rules-registry/dnd35e/feats";

export interface Dnd35eCharacterQualificationState {
  abilities: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>;
  baseAttackBonus: number;
  characterLevel: number;
  classLevels: Record<string, number>;
  skillRanks: Record<string, number>;
  featCanonicalIds: string[];
  casterLevel: number;
  manifesterLevel: number;
}

export interface Dnd35eFeatQualificationResult {
  qualified: boolean;
  failureReasons: string[];
}

export function evaluateFeatPrerequisite(
  prerequisite: Dnd35eFeatPrerequisite | null,
  state: Dnd35eCharacterQualificationState,
): Dnd35eFeatQualificationResult {
  if (prerequisite === null) return { qualified: true, failureReasons: [] };

  switch (prerequisite.kind) {
    case "all": {
      if (prerequisite.requirements.length === 0) {
        return { qualified: false, failureReasons: ["Malformed prerequisite: 'all' with no requirements"] };
      }
      const results = prerequisite.requirements.map((req) => evaluateFeatPrerequisite(req, state));
      return {
        qualified: results.every((r) => r.qualified),
        failureReasons: results.filter((r) => !r.qualified).flatMap((r) => r.failureReasons),
      };
    }
    case "any": {
      if (prerequisite.requirements.length === 0) {
        return { qualified: false, failureReasons: ["Malformed prerequisite: 'any' with no requirements"] };
      }
      const results = prerequisite.requirements.map((req) => evaluateFeatPrerequisite(req, state));
      if (results.some((r) => r.qualified)) return { qualified: true, failureReasons: [] };
      return { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    }
    case "ability": {
      const actual = state.abilities[prerequisite.ability];
      return actual >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    }
    case "bab":
      return state.baseAttackBonus >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "skill_ranks":
      return (state.skillRanks[prerequisite.skillCanonicalId] ?? 0) >= prerequisite.ranks
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "feat":
      return state.featCanonicalIds.includes(prerequisite.featCanonicalId)
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "class_level":
      return (state.classLevels[prerequisite.classCanonicalId] ?? 0) >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "character_level":
      return state.characterLevel >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "caster_level":
      return state.casterLevel >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "manifester_level":
      return state.manifesterLevel >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "proficiency":
      // No canonical weapon/armor/shield entity family exists yet to check
      // proficiency against, so — like `special` — this always fails and
      // requires manual confirmation. Kept as its own kind (not folded into
      // `special`) so a future UI pass can group and explain it distinctly.
      return { qualified: false, failureReasons: [`Requires manual confirmation (proficiency): ${prerequisite.description}`] };
    case "class_feature":
      // Same reasoning as `proficiency`: no canonical class-feature entity
      // family exists yet to check against.
      return { qualified: false, failureReasons: [`Requires manual confirmation (class feature): ${prerequisite.description}`] };
    case "special":
      // Never silently qualifies — see module header.
      return { qualified: false, failureReasons: [`Requires manual confirmation: ${prerequisite.description}`] };
    default: {
      // Defense against genuinely malformed runtime data: server/storage.ts's
      // mapDnd35eFeatDefinitionRow does JSON.parse(row.prerequisites_json) with
      // zero runtime validation before typing the result as
      // Dnd35eFeatPrerequisite | null, so an unrecognized `kind` really can
      // reach here at runtime even though the type system considers every
      // branch above exhaustive. Fail closed rather than falling through the
      // switch with no matching case (which would otherwise return `undefined`).
      const _exhaustiveCheck: never = prerequisite;
      const malformed = _exhaustiveCheck as unknown;
      return {
        qualified: false,
        failureReasons: [`Unrecognized prerequisite structure: ${JSON.stringify(malformed)}`],
      };
    }
  }
}
