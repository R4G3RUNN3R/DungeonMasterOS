// Reference implementation only.

import type { Dnd5eAbility, Dnd5eCharacterState } from "./domain";
import type { Dnd5eClassDefinition, Dnd5eMulticlassGrant } from "./class-types";
import { effectiveAbilities, classDefinition, classTotals, characterLevel } from "./state-helpers";
import { multiclassSpellSlots, multiclassSpellcasterLevel, pactMagic } from "./spellcasting";

export type MulticlassValidation = {
  legal: boolean;
  errors: string[];
  targetClassId: string;
  targetClassLevel: number;
  grants?: Dnd5eMulticlassGrant;
};

function meetsPrerequisites(state: Dnd5eCharacterState, cls: Dnd5eClassDefinition): string[] {
  const abilities = effectiveAbilities(state);
  const errors: string[] = [];

  for (const requirement of cls.multiclassPrerequisites) {
    if ("ability" in requirement) {
      if (abilities[requirement.ability] < requirement.minimum) {
        errors.push(`${cls.displayName} requires ${requirement.ability.toUpperCase()} ${requirement.minimum} to multiclass.`);
      }
      continue;
    }
    const passesEither = requirement.either.some((option) => abilities[option.ability] >= option.minimum);
    if (!passesEither) {
      errors.push(`${cls.displayName} multiclass prerequisite requires one of: ${requirement.either.map((option) => `${option.ability.toUpperCase()} ${option.minimum}`).join(" or ")}.`);
    }
  }

  return errors;
}

/**
 * 5e requires the prerequisites of BOTH the current class(es) being left and the
 * new class. Validate every class already held plus the target class.
 */
export function validateMulticlassInto(state: Dnd5eCharacterState, targetClassId: string): MulticlassValidation {
  const target = classDefinition(state, targetClassId);
  if (!target) return { legal:false, errors:[`Unknown class ${targetClassId}.`], targetClassId, targetClassLevel:0 };

  const errors: string[] = [];
  const heldClasses = Object.keys(classTotals(state.levels));
  for (const heldClassId of heldClasses) {
    const held = classDefinition(state, heldClassId);
    if (held) errors.push(...meetsPrerequisites(state, held));
  }
  errors.push(...meetsPrerequisites(state, target));

  return {
    legal: errors.length === 0,
    errors,
    targetClassId,
    targetClassLevel: (classTotals(state.levels)[targetClassId] ?? 0) + 1,
    grants: target.multiclassGrant,
  };
}

export function isActuallyMulticlassing(state: Dnd5eCharacterState, targetClassId: string): boolean {
  const classes = Object.keys(classTotals(state.levels));
  return characterLevel(state) > 0 && !classes.includes(targetClassId);
}

export function combinedSpellcastingSummary(state: Dnd5eCharacterState) {
  const totals = classTotals(state.levels);
  return {
    combinedCasterLevel: multiclassSpellcasterLevel(state),
    combinedSpellSlots: multiclassSpellSlots(state),
    pactMagic: totals.warlock ? pactMagic(state.rulesProfileId, totals.warlock) : undefined,
    notes: [
      "Pact Magic slots remain separate from the multiclass Spellcasting slot table.",
      state.rulesProfileId === "dnd5e-2024"
        ? "Revised profile rounds Paladin/Ranger contributions up when calculating multiclass spellcaster level."
        : "2014 profile rounds Paladin/Ranger contributions down when calculating multiclass spellcaster level.",
      "Spell preparation/known legality remains class-specific even when slots are shared.",
    ],
  };
}

export function multiclassProficiencyGrants(state: Dnd5eCharacterState, targetClassId: string): Dnd5eMulticlassGrant | undefined {
  if (!isActuallyMulticlassing(state, targetClassId)) return undefined;
  return classDefinition(state, targetClassId)?.multiclassGrant;
}

export function abilityMeets(state: Dnd5eCharacterState, ability: Dnd5eAbility, minimum: number): boolean {
  return effectiveAbilities(state)[ability] >= minimum;
}
