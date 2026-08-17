// Reference implementation only.
// Bonus-language legality depends on both race and class in core 3.5e.

import type { Dnd35CharacterState } from "./domain";
import { classTotals, effectivePermanentAbilities, abilityModifier } from "./mechanics";
import { getCoreRace } from "./races";

export const CLASS_BONUS_LANGUAGE_ADDITIONS: Record<string, string[]> = {
  cleric: ["Abyssal", "Celestial", "Infernal"],
  druid: ["Sylvan"],
  wizard: ["Draconic"],
};

export const CLASS_AUTOMATIC_LANGUAGES: Record<string, string[]> = {
  druid: ["Druidic"],
};

export function automaticLanguages(state: Dnd35CharacterState): string[] {
  const race = getCoreRace(state.race.raceId);
  const languages = new Set<string>(race?.automaticLanguages ?? []);

  for (const classId of Object.keys(classTotals(state.levels))) {
    for (const language of CLASS_AUTOMATIC_LANGUAGES[classId] ?? []) languages.add(language);
  }

  return [...languages];
}

export function legalBonusLanguages(state: Dnd35CharacterState, prospectiveFirstClassId?: string): "any_non_secret" | string[] {
  const race = getCoreRace(state.race.raceId);
  if (!race) return [];
  if (race.bonusLanguages === "any_non_secret") return "any_non_secret";

  const legal = new Set<string>(race.bonusLanguages);
  const classes = new Set(Object.keys(classTotals(state.levels)));
  if (prospectiveFirstClassId) classes.add(prospectiveFirstClassId);

  for (const classId of classes) {
    for (const language of CLASS_BONUS_LANGUAGE_ADDITIONS[classId] ?? []) legal.add(language);
  }

  return [...legal];
}

export function bonusLanguageEntitlementCount(state: Dnd35CharacterState): number {
  return Math.max(0, abilityModifier(effectivePermanentAbilities(state).int));
}

export function chosenBonusLanguages(state: Dnd35CharacterState): string[] {
  const chosen = state.race.choices.bonusLanguages;
  return Array.isArray(chosen) ? chosen : chosen ? [chosen] : [];
}

export function allKnownLanguages(state: Dnd35CharacterState): string[] {
  return [...new Set([
    ...automaticLanguages(state),
    ...chosenBonusLanguages(state),
    ...state.persistentChoices.languages,
  ])];
}

export function validateBonusLanguages(state: Dnd35CharacterState, prospectiveFirstClassId?: string): string[] {
  const errors: string[] = [];
  const expected = bonusLanguageEntitlementCount(state);
  const chosen = chosenBonusLanguages(state);

  if (chosen.length !== expected) errors.push(`Expected ${expected} bonus language choice(s); got ${chosen.length}.`);
  if (new Set(chosen.map((language) => language.toLowerCase())).size !== chosen.length) errors.push("Duplicate bonus language choices are not legal.");

  const legal = legalBonusLanguages(state, prospectiveFirstClassId);
  if (legal !== "any_non_secret") {
    const legalSet = new Set(legal.map((language) => language.toLowerCase()));
    const invalid = chosen.filter((language) => !legalSet.has(language.toLowerCase()));
    if (invalid.length) errors.push(`Illegal bonus language choice(s): ${invalid.join(", ")}.`);
  }

  return errors;
}
