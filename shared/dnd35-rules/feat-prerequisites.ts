import type { Dnd35Prerequisite, Dnd35SpellLevel, Dnd35SpellTradition } from "./types";

export type Dnd35FeatQualificationState = {
  abilities: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
  baseAttackBonus?: number;
  characterLevel?: number;
  classLevels?: Record<string, number>;
  skillRanks?: Record<string, number>;
  featIds?: string[];
  featSelections?: Array<{ featId: string; parameter?: string }>;
  casterLevels?: Partial<Record<Dnd35SpellTradition, number>>;
  maximumSpellLevel?: Partial<Record<Dnd35SpellTradition, Dnd35SpellLevel>>;
  races?: string[];
  alignment?: string;
  proficiencies?: string[];
  specialFlags?: string[];
};

export type Dnd35PrerequisiteResult = { qualified: boolean; failures: string[] };

function evaluateOne(requirement: Dnd35Prerequisite, state: Dnd35FeatQualificationState): Dnd35PrerequisiteResult {
  const fail = (message: string): Dnd35PrerequisiteResult => ({ qualified: false, failures: [message] });
  const pass = (): Dnd35PrerequisiteResult => ({ qualified: true, failures: [] });

  switch (requirement.kind) {
    case "all": {
      const results = requirement.requirements.map((child) => evaluateOne(child, state));
      return { qualified: results.every((result) => result.qualified), failures: results.flatMap((result) => result.failures) };
    }
    case "any": {
      const results = requirement.requirements.map((child) => evaluateOne(child, state));
      if (results.some((result) => result.qualified)) return pass();
      return { qualified: false, failures: [`Requires at least one of: ${results.flatMap((result) => result.failures).join("; ")}`] };
    }
    case "ability": {
      const actual = state.abilities[requirement.ability] ?? 0;
      return actual >= requirement.minimum ? pass() : fail(`${requirement.ability.toUpperCase()} ${requirement.minimum} required; recorded ${actual}.`);
    }
    case "bab": {
      const actual = state.baseAttackBonus ?? 0;
      return actual >= requirement.minimum ? pass() : fail(`Base attack bonus +${requirement.minimum} required; recorded +${actual}.`);
    }
    case "skill": {
      const actual = state.skillRanks?.[requirement.skillId] ?? 0;
      return actual >= requirement.ranks ? pass() : fail(`${requirement.skillId} ${requirement.ranks} ranks required; recorded ${actual}.`);
    }
    case "feat": {
      const simpleMatch = state.featIds?.includes(requirement.featId) ?? false;
      const selectedMatch = state.featSelections?.some((selection) => selection.featId === requirement.featId && (requirement.parameter === undefined || selection.parameter === requirement.parameter)) ?? false;
      return simpleMatch || selectedMatch ? pass() : fail(`Feat ${requirement.featId}${requirement.parameter ? ` (${requirement.parameter})` : ""} required.`);
    }
    case "class_level": {
      const actual = state.classLevels?.[requirement.classId] ?? 0;
      return actual >= requirement.minimum ? pass() : fail(`${requirement.classId} level ${requirement.minimum} required; recorded ${actual}.`);
    }
    case "character_level": {
      const actual = state.characterLevel ?? 0;
      return actual >= requirement.minimum ? pass() : fail(`Character level ${requirement.minimum} required; recorded ${actual}.`);
    }
    case "caster_level": {
      if (requirement.tradition) {
        const actual = state.casterLevels?.[requirement.tradition] ?? 0;
        return actual >= requirement.minimum ? pass() : fail(`${requirement.tradition} caster level ${requirement.minimum} required; recorded ${actual}.`);
      }
      const actual = Math.max(0, ...Object.values(state.casterLevels ?? {}).filter((value): value is number => typeof value === "number"));
      return actual >= requirement.minimum ? pass() : fail(`Caster level ${requirement.minimum} required; highest recorded ${actual}.`);
    }
    case "spell_level": {
      if (requirement.tradition) {
        const actual = state.maximumSpellLevel?.[requirement.tradition] ?? 0;
        return actual >= requirement.minimum ? pass() : fail(`Ability to cast level ${requirement.minimum} ${requirement.tradition} spells required; recorded maximum ${actual}.`);
      }
      const actual = Math.max(0, ...Object.values(state.maximumSpellLevel ?? {}).filter((value): value is number => typeof value === "number"));
      return actual >= requirement.minimum ? pass() : fail(`Ability to cast level ${requirement.minimum} spells required; recorded maximum ${actual}.`);
    }
    case "race": return state.races?.includes(requirement.raceId) ? pass() : fail(`Race ${requirement.raceId} required.`);
    case "alignment": return state.alignment && requirement.allowed.includes(state.alignment) ? pass() : fail(`Alignment must be one of: ${requirement.allowed.join(", ")}.`);
    case "proficiency": return state.proficiencies?.includes(requirement.proficiencyId) ? pass() : fail(`Proficiency ${requirement.proficiencyId} required.`);
    case "spellcasting":
    case "special": {
      const rule = requirement.kind === "spellcasting" ? requirement.requirement : requirement.rule;
      return state.specialFlags?.includes(rule) ? pass() : fail(`Special prerequisite requires explicit rule flag: ${rule}.`);
    }
  }
}

export function evaluateDnd35FeatPrerequisites(prerequisite: Dnd35Prerequisite | undefined, state: Dnd35FeatQualificationState): Dnd35PrerequisiteResult {
  return prerequisite ? evaluateOne(prerequisite, state) : { qualified: true, failures: [] };
}
