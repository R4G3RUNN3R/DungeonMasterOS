// Reference implementation only.
// Explicitly documents/normalizes source-of-truth decisions inside the draft state shape.

import type { Dnd5eCharacterState, Dnd5eFeatChoice, Dnd5eProficiencyRef } from "./domain";

/**
 * Permanent feat acquisition is authoritative in ordered level records.
 * The draft `state.feats` field is retained only as a transitional projection so
 * this isolated reference can compare cleanly with live production. Production
 * should remove or make that field generated/read-only rather than independently writable.
 */
export function acquiredFeats(state:Dnd5eCharacterState):Dnd5eFeatChoice[]{
  return state.levels.flatMap(level=>level.featChoices);
}

export function acquiredLevelProficiencies(state:Dnd5eCharacterState):Dnd5eProficiencyRef[]{
  return state.levels.flatMap(level=>level.proficiencyChoices);
}

/** Feed old helpers a synchronized projection without creating a second writer. */
export function withCanonicalProjections(state:Dnd5eCharacterState):Dnd5eCharacterState{
  return {...state,feats:acquiredFeats(state)};
}

export const DND5E_AUTHORITIES={
  rulesProfile:"state.rulesProfileId",
  origin:"state.origin",
  assignedAbilityScores:"state.assignedAbilityScores",
  levelHistory:"state.levels",
  feats:"state.levels[].featChoices",
  classFeatureChoices:"state.levels[].classChoices",
  proficiencyChoices:"state.levels[].proficiencyChoices",
  permanentSpellChoices:"state.levels[].spellChoices",
  xp:"state.experiencePoints",
  runtimeSpellUse:"state.spellcasting",
  runtimeClassResources:"state.resources",
  attunement:"state.attunement",
  inventoryOwnership:"existing items table",
  equippedState:"existing items table",
  timedEffects:"existing active_effects table",
  currency:"existing currency tables",
  sheet:"generated projection only",
  aiContext:"generated projection only",
} as const;

export const FORBIDDEN_DUPLICATE_WRITERS=[
  "Do not independently edit both a level feat record and a top-level feat array.",
  "Do not store calculated proficiency bonus, skill totals, save totals or spell DC as independently editable canonical fields.",
  "Do not duplicate item ownership into character rules JSON.",
  "Do not duplicate active-effect duration into character rules JSON.",
  "Do not make the character sheet itself the rules database.",
] as const;
