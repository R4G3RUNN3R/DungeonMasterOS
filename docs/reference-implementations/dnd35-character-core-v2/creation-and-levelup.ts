// Reference implementation only.
// This module plans and validates player-owned choices. It intentionally does
// not choose feats, skills, languages, classes, spells or ability increases.

import type {
  CoreClassId,
  CoreRaceId,
  Dnd35Ability,
  Dnd35CharacterState,
  Dnd35FeatAcquisition,
  Dnd35LevelRecord,
  Dnd35SkillPurchase,
} from "./domain";
import { featuresGrantedAtClassLevel, getCoreClass } from "./classes";
import { getCoreRace } from "./races";
import {
  abilityModifier,
  canGainAnotherLevel,
  characterLevel,
  classLevelAtCharacterLevel,
  effectivePermanentAbilities,
  getsAbilityIncreaseAtCharacterLevel,
  getsGeneralFeatAtCharacterLevel,
  nextLevelExperience,
  skillPointBudgetForLevel,
  validateLevelRecordBasics,
  validateSkillPurchases,
} from "./mechanics";

export type ChoiceRequirement = {
  id: string;
  label: string;
  type:
    | "feat"
    | "ability_increase"
    | "skill_allocation"
    | "bonus_language"
    | "class_choice"
    | "spell_choice"
    | "hp_roll";
  count?: number;
  source: string;
  hidden?: boolean;
  notes?: string;
};

export type CreationPlan = {
  raceId: CoreRaceId;
  classId: CoreClassId;
  effectiveAbilityScores: ReturnType<typeof effectivePermanentAbilities>;
  firstLevelSkillPointBudget: number;
  automaticLanguages: string[];
  bonusLanguageChoices: number;
  requirements: ChoiceRequirement[];
  firstLevelHitPointsBeforeConstitution: number;
};

export type LevelUpPlan = {
  fromCharacterLevel: number;
  toCharacterLevel: number;
  classId: CoreClassId;
  resultingClassLevel: number;
  xpRequired: number;
  skillPointBudget: number;
  hitDie: number;
  requirements: ChoiceRequirement[];
};

const ALIGNMENTS = [
  "lawful good", "neutral good", "chaotic good",
  "lawful neutral", "true neutral", "neutral", "chaotic neutral",
  "lawful evil", "neutral evil", "chaotic evil",
] as const;

function normalizedAlignment(value: string | undefined): string {
  return String(value || "").trim().toLowerCase();
}

/** Core class alignment gates only. Deity-specific cleric restrictions belong in a deity/source registry. */
export function validateCoreClassAlignment(classId: string, alignment: string | undefined): string[] {
  const a = normalizedAlignment(alignment);
  if (!a) return [];
  if (!ALIGNMENTS.includes(a as any)) return [`Unknown alignment: ${alignment}`];

  const isLawful = a.startsWith("lawful");
  const isChaotic = a.startsWith("chaotic");
  const isNeutralAxis = a.includes("neutral") && a !== "neutral good" && a !== "neutral evil" && a !== "lawful neutral" && a !== "chaotic neutral";

  if (classId === "barbarian" && isLawful) return ["Barbarian requires a nonlawful alignment."];
  if (classId === "bard" && isLawful) return ["Bard requires a nonlawful alignment."];
  if (classId === "monk" && !isLawful) return ["Monk requires a lawful alignment."];
  if (classId === "paladin" && a !== "lawful good") return ["Paladin requires lawful good alignment under the core rules."];
  if (classId === "druid") {
    const neutralComponent = a === "true neutral" || a === "neutral" || a === "neutral good" || a === "neutral evil" || a === "lawful neutral" || a === "chaotic neutral";
    if (!neutralComponent) return ["Druid requires at least one neutral alignment component under the core rules."];
  }

  return [];
}

function classChoiceRequirements(classId: string, classLevel: number): ChoiceRequirement[] {
  return featuresGrantedAtClassLevel(classId, classLevel)
    .filter((feature) => feature.choiceRequired)
    .map((feature) => ({
      id: feature.featureId,
      label: feature.label,
      type: feature.choiceType === "feat" ? "feat" : "class_choice",
      count: 1,
      source: feature.featureId,
      notes: "Permanent choice. The player must select this explicitly.",
    }));
}

function featEntitlements(characterLevelValue: number, raceId: string, classId: string, classLevel: number): ChoiceRequirement[] {
  const requirements: ChoiceRequirement[] = [];

  if (getsGeneralFeatAtCharacterLevel(characterLevelValue)) {
    requirements.push({
      id: `general-feat:${characterLevelValue}`,
      label: "General Feat",
      type: "feat",
      count: 1,
      source: "character-level",
      notes: "Player choice; feat prerequisites must be validated by the feat registry.",
    });
  }

  if (characterLevelValue === 1 && raceId === "human") {
    requirements.push({
      id: "human:bonus-feat",
      label: "Human Bonus Feat",
      type: "feat",
      count: 1,
      source: "race:human",
      notes: "Player choice; never auto-select this feat.",
    });
  }

  for (const requirement of classChoiceRequirements(classId, classLevel)) {
    if (requirement.type === "feat") requirements.push(requirement);
  }

  return requirements;
}

export function buildCreationPlan(state: Dnd35CharacterState, classId: CoreClassId): CreationPlan {
  if (state.levels.length !== 0) throw new Error("Creation plan requires a state with no committed class levels.");

  const race = getCoreRace(state.race.raceId);
  const cls = getCoreClass(classId);
  if (!race) throw new Error(`Unknown core race: ${state.race.raceId}`);
  if (!cls) throw new Error(`Unknown core class: ${classId}`);

  const effectiveAbilityScores = effectivePermanentAbilities(state);
  const firstLevelSkillPointBudget = skillPointBudgetForLevel(classId, effectiveAbilityScores.int, 1, race.id);
  const bonusLanguageChoices = Math.max(0, abilityModifier(effectiveAbilityScores.int));

  const requirements: ChoiceRequirement[] = [
    {
      id: "skills:1",
      label: "Spend 1st-level skill points",
      type: "skill_allocation",
      count: firstLevelSkillPointBudget,
      source: `class:${classId}`,
      notes: "Class skills cost 1 point/rank; cross-class skills cost 2 points/rank. Rank caps still apply.",
    },
    ...featEntitlements(1, race.id, classId, 1),
    ...classChoiceRequirements(classId, 1).filter((requirement) => requirement.type !== "feat"),
  ];

  if (bonusLanguageChoices > 0) {
    requirements.push({
      id: "race:bonus-languages",
      label: "Choose bonus languages",
      type: "bonus_language",
      count: bonusLanguageChoices,
      source: `race:${race.id}`,
      notes: race.bonusLanguages === "any_non_secret" ? "Choose legal non-secret languages." : `Choose from: ${race.bonusLanguages.join(", ")}.`,
    });
  }

  if (cls.spellcasting) {
    requirements.push({
      id: `spell-setup:${classId}:1`,
      label: "Resolve 1st-level spellcasting choices",
      type: "spell_choice",
      source: `class:${classId}`,
      notes: "Use the class spell progression/source registry. Prepared, known, spellbook, domain and specialist choices remain player-owned where applicable.",
    });
  }

  return {
    raceId: race.id,
    classId,
    effectiveAbilityScores,
    firstLevelSkillPointBudget,
    automaticLanguages: [...race.automaticLanguages],
    bonusLanguageChoices,
    requirements,
    firstLevelHitPointsBeforeConstitution: cls.hitDie,
  };
}

export function buildLevelUpPlan(state: Dnd35CharacterState, chosenClassId: CoreClassId): LevelUpPlan {
  const fromCharacterLevel = characterLevel(state);
  if (fromCharacterLevel < 1) throw new Error("Use buildCreationPlan for the first character level.");
  if (!canGainAnotherLevel(state)) {
    throw new Error(`Not enough XP. Need ${nextLevelExperience(fromCharacterLevel)} XP for level ${fromCharacterLevel + 1}.`);
  }

  const cls = getCoreClass(chosenClassId);
  if (!cls) throw new Error(`Unknown core class: ${chosenClassId}`);

  const toCharacterLevel = fromCharacterLevel + 1;
  const resultingClassLevel = classLevelAtCharacterLevel(state.levels, chosenClassId) + 1;

  // The level-based ability increase is applied at the new level. If the player chooses INT,
  // the higher modifier applies to skill points gained for this new level, but not retroactively.
  const currentAbilities = effectivePermanentAbilities(state);

  const requirements: ChoiceRequirement[] = [
    {
      id: `hp-roll:${toCharacterLevel}`,
      label: `Roll d${cls.hitDie} hit points`,
      type: "hp_roll",
      count: 1,
      source: `class:${chosenClassId}`,
      notes: "Record the actual player roll. Constitution is applied by the rules engine.",
    },
  ];

  if (getsAbilityIncreaseAtCharacterLevel(toCharacterLevel)) {
    requirements.push({
      id: `ability-increase:${toCharacterLevel}`,
      label: "Choose an ability score to increase by 1",
      type: "ability_increase",
      count: 1,
      source: "character-level",
      notes: "Player choice. If Intelligence changes, calculate this level's skill budget using the resulting Intelligence score.",
    });
  }

  requirements.push(...featEntitlements(toCharacterLevel, state.race.raceId, chosenClassId, resultingClassLevel));
  requirements.push(...classChoiceRequirements(chosenClassId, resultingClassLevel).filter((requirement) => requirement.type !== "feat"));

  if (cls.spellcasting && resultingClassLevel >= cls.spellcasting.startsAtClassLevel) {
    requirements.push({
      id: `spell-setup:${chosenClassId}:${resultingClassLevel}`,
      label: "Resolve spellcasting progression",
      type: "spell_choice",
      source: `class:${chosenClassId}`,
      notes: "Only require selections the class actually grants at this level; do not invent spells to fill the sheet.",
    });
  }

  const baselineSkillPointBudget = skillPointBudgetForLevel(
    chosenClassId,
    currentAbilities.int,
    toCharacterLevel,
    state.race.raceId,
  );

  requirements.push({
    id: `skills:${toCharacterLevel}`,
    label: "Spend skill points",
    type: "skill_allocation",
    count: baselineSkillPointBudget,
    source: `class:${chosenClassId}`,
    notes: getsAbilityIncreaseAtCharacterLevel(toCharacterLevel)
      ? "Budget is provisional until any Intelligence increase is chosen."
      : undefined,
  });

  return {
    fromCharacterLevel,
    toCharacterLevel,
    classId: chosenClassId,
    resultingClassLevel,
    xpRequired: nextLevelExperience(fromCharacterLevel),
    skillPointBudget: baselineSkillPointBudget,
    hitDie: cls.hitDie,
    requirements,
  };
}

export function expectedSkillPointBudgetForCommittedLevel(stateBeforeLevel: Dnd35CharacterState, level: Dnd35LevelRecord): number {
  const before = effectivePermanentAbilities(stateBeforeLevel);
  const intelligence = before.int + (level.abilityIncrease === "int" ? 1 : 0);
  return skillPointBudgetForLevel(level.classId, intelligence, level.characterLevel, stateBeforeLevel.race.raceId);
}

function featSourceCounts(feats: Dnd35FeatAcquisition[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const feat of feats) result[feat.source] = (result[feat.source] ?? 0) + 1;
  return result;
}

/**
 * Validates the deterministic entitlements we can validate without a full feat/spell registry.
 * A production adapter must additionally validate feat prerequisites and spell legality.
 */
export function validateLevelCommit(stateBeforeLevel: Dnd35CharacterState, level: Dnd35LevelRecord): string[] {
  const errors = [...validateLevelRecordBasics(stateBeforeLevel, level)];
  const cls = getCoreClass(level.classId);
  if (!cls) return errors;

  const expectedBudget = expectedSkillPointBudgetForCommittedLevel(stateBeforeLevel, level);
  if (level.skillPointBudget !== expectedBudget) {
    errors.push(`Expected ${expectedBudget} skill points at character level ${level.characterLevel}; got ${level.skillPointBudget}.`);
  }

  errors.push(...validateSkillPurchases({ ...stateBeforeLevel, levels: [...stateBeforeLevel.levels] }, level));

  const alignmentErrors = validateCoreClassAlignment(level.classId, stateBeforeLevel.persistentChoices.alignment);
  errors.push(...alignmentErrors);

  const featCounts = featSourceCounts(level.featChoices);
  const generalRequired = getsGeneralFeatAtCharacterLevel(level.characterLevel) ? 1 : 0;
  if ((featCounts.general ?? 0) !== generalRequired) {
    errors.push(`Expected ${generalRequired} general feat choice(s) at character level ${level.characterLevel}.`);
  }

  const humanRequired = level.characterLevel === 1 && stateBeforeLevel.race.raceId === "human" ? 1 : 0;
  if ((featCounts.human_bonus ?? 0) !== humanRequired) {
    errors.push(`Expected ${humanRequired} human bonus feat choice(s).`);
  }

  const classLevel = classLevelAtCharacterLevel([...stateBeforeLevel.levels, level], level.classId, level.characterLevel);
  const classFeatRequirements = featuresGrantedAtClassLevel(level.classId, classLevel).filter(
    (feature) => feature.choiceRequired && feature.choiceType === "feat",
  ).length;

  const classFeatActual = level.featChoices.filter((feat) => ["fighter_bonus", "monk_bonus", "wizard_bonus", "class", "other"].includes(feat.source)).length;
  if (classFeatActual < classFeatRequirements) {
    errors.push(`Missing ${classFeatRequirements - classFeatActual} class-granted feat choice(s) for ${cls.displayName} ${classLevel}.`);
  }

  const requiredClassChoices = featuresGrantedAtClassLevel(level.classId, classLevel).filter(
    (feature) => feature.choiceRequired && feature.choiceType !== "feat",
  );
  for (const feature of requiredClassChoices) {
    if (!level.classChoices.some((choice) => choice.choiceId === feature.featureId && choice.values.length > 0)) {
      errors.push(`Missing player choice for ${feature.label}.`);
    }
  }

  const shouldIncreaseAbility = getsAbilityIncreaseAtCharacterLevel(level.characterLevel);
  if (shouldIncreaseAbility !== !!level.abilityIncrease) {
    errors.push(shouldIncreaseAbility ? "Missing level-based ability-score increase." : "Unexpected ability-score increase on this level.");
  }

  return errors;
}

export function validateCreationLanguages(state: Dnd35CharacterState): string[] {
  const race = getCoreRace(state.race.raceId);
  if (!race) return [`Unknown race ${state.race.raceId}.`];

  const abilities = effectivePermanentAbilities(state);
  const requiredBonusLanguages = Math.max(0, abilityModifier(abilities.int));
  const chosen = state.race.choices.bonusLanguages;
  const chosenList = Array.isArray(chosen) ? chosen : chosen ? [chosen] : [];

  if (chosenList.length !== requiredBonusLanguages) {
    return [`Expected ${requiredBonusLanguages} bonus language choice(s); got ${chosenList.length}.`];
  }

  if (race.bonusLanguages !== "any_non_secret") {
    const legal = new Set(race.bonusLanguages.map((language) => language.toLowerCase()));
    const invalid = chosenList.filter((language) => !legal.has(language.toLowerCase()));
    if (invalid.length) return [`Illegal bonus language choice(s) for ${race.displayName}: ${invalid.join(", ")}.`];
  }

  return [];
}

export function appendValidatedLevel(state: Dnd35CharacterState, level: Dnd35LevelRecord): Dnd35CharacterState {
  const errors = validateLevelCommit(state, level);
  if (errors.length) throw new Error(`Cannot commit D&D 3.5e level:\n- ${errors.join("\n- ")}`);

  return {
    ...state,
    levels: [...state.levels, level],
  };
}
