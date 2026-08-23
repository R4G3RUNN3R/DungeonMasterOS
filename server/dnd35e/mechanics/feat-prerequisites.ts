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
      const results = prerequisite.requirements.map((req) => evaluateFeatPrerequisite(req, state));
      return {
        qualified: results.every((r) => r.qualified),
        failureReasons: results.filter((r) => !r.qualified).flatMap((r) => r.failureReasons),
      };
    }
    case "any": {
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
    case "special":
      // Never silently qualifies — see module header.
      return { qualified: false, failureReasons: [`Requires manual confirmation: ${prerequisite.description}`] };
  }
}
