// Reference implementation only.
// Preferred entitlement planner. It composes race, class, language, skill and spell rules.

import type { CoreClassId, Dnd35CharacterState } from "./domain";
import { featuresGrantedAtClassLevel, getCoreClass } from "./classes";
import {
  canGainAnotherLevel,
  characterLevel,
  classLevelAtCharacterLevel,
  effectivePermanentAbilities,
  getsAbilityIncreaseAtCharacterLevel,
  getsGeneralFeatAtCharacterLevel,
  nextLevelExperience,
  skillPointBudgetForLevel,
} from "./mechanics";
import {
  automaticLanguages,
  bonusLanguageEntitlementCount,
  legalBonusLanguages,
} from "./languages";
import { spellEntitlementsForNewClassLevel } from "./spell-entitlements";

export type PlayerChoiceEntitlement = {
  id: string;
  category:
    | "class"
    | "hp_roll"
    | "skill_points"
    | "feat"
    | "ability_increase"
    | "language"
    | "class_feature"
    | "spell"
    | "alignment"
    | "deity";
  count?: number;
  source: string;
  description: string;
  optionsHint?: string[] | "source_registry" | "any_legal";
  optional?: boolean;
};

export type Dnd35ChoicePlan = {
  characterLevel: number;
  chosenClassId: CoreClassId;
  resultingClassLevel: number;
  automatic: {
    languages: string[];
    hitDie: number;
    firstLevelMaxHitDie?: number;
  };
  entitlements: PlayerChoiceEntitlement[];
  blockingReasons: string[];
};

function classFeatureEntitlements(classId: string, classLevel: number): PlayerChoiceEntitlement[] {
  return featuresGrantedAtClassLevel(classId, classLevel)
    .filter((feature) => feature.choiceRequired)
    .map((feature) => ({
      id: feature.featureId,
      category: feature.choiceType === "feat" ? "feat" : "class_feature",
      count: 1,
      source: feature.featureId,
      description: `Choose ${feature.label}.`,
      optionsHint: "source_registry",
    }));
}

function featEntitlements(characterLevelValue: number, raceId: string): PlayerChoiceEntitlement[] {
  const result: PlayerChoiceEntitlement[] = [];
  if (getsGeneralFeatAtCharacterLevel(characterLevelValue)) {
    result.push({
      id: `feat:general:${characterLevelValue}`,
      category: "feat",
      count: 1,
      source: "character-level",
      description: "Choose one legal general feat.",
      optionsHint: "source_registry",
    });
  }
  if (characterLevelValue === 1 && raceId === "human") {
    result.push({
      id: "feat:human-bonus",
      category: "feat",
      count: 1,
      source: "race:human",
      description: "Choose the Human bonus feat.",
      optionsHint: "source_registry",
    });
  }
  return result;
}

export function planDnd35LevelChoices(
  state: Dnd35CharacterState,
  chosenClassId: CoreClassId,
): Dnd35ChoicePlan {
  const cls = getCoreClass(chosenClassId);
  if (!cls) throw new Error(`Unknown class ${chosenClassId}`);

  const currentLevel = characterLevel(state);
  const targetLevel = currentLevel + 1;
  const resultingClassLevel = classLevelAtCharacterLevel(state.levels, chosenClassId) + 1;
  const blockingReasons: string[] = [];

  if (currentLevel >= 1 && !canGainAnotherLevel(state)) {
    blockingReasons.push(`Need ${nextLevelExperience(currentLevel)} XP for character level ${targetLevel}.`);
  }

  const abilitiesBeforeLevel = effectivePermanentAbilities(state);
  const provisionalSkillBudget = skillPointBudgetForLevel(
    chosenClassId,
    abilitiesBeforeLevel.int,
    targetLevel,
    state.race.raceId,
  );

  const entitlements: PlayerChoiceEntitlement[] = [];

  if (currentLevel === 0) {
    entitlements.push({
      id: "identity:alignment",
      category: "alignment",
      count: 1,
      source: "character-creation",
      description: "Choose alignment before class restrictions are committed.",
      optionsHint: "source_registry",
    });
  } else {
    entitlements.push({
      id: `hp:${targetLevel}`,
      category: "hp_roll",
      count: 1,
      source: `class:${chosenClassId}`,
      description: `Roll the player's d${cls.hitDie} Hit Die and store the actual result.`,
    });
  }

  entitlements.push({
    id: `skills:${targetLevel}`,
    category: "skill_points",
    count: provisionalSkillBudget,
    source: `class:${chosenClassId}`,
    description:
      currentLevel === 0
        ? `Spend ${provisionalSkillBudget} 1st-level skill points using 3.5e class/cross-class costs and rank caps.`
        : `Spend the level's skill points. Recalculate if this level's ability increase is assigned to Intelligence.`,
    optionsHint: "source_registry",
  });

  entitlements.push(...featEntitlements(targetLevel, state.race.raceId));
  entitlements.push(...classFeatureEntitlements(chosenClassId, resultingClassLevel));

  if (getsAbilityIncreaseAtCharacterLevel(targetLevel)) {
    entitlements.push({
      id: `ability-increase:${targetLevel}`,
      category: "ability_increase",
      count: 1,
      source: "character-level",
      description: "Choose one ability score to increase by 1.",
      optionsHint: ["str", "dex", "con", "int", "wis", "cha"],
    });
  }

  if (targetLevel === 1) {
    const languageCount = bonusLanguageEntitlementCount(state);
    if (languageCount > 0) {
      const legal = legalBonusLanguages(state, chosenClassId);
      entitlements.push({
        id: "languages:bonus",
        category: "language",
        count: languageCount,
        source: `race:${state.race.raceId}`,
        description: `Choose ${languageCount} legal bonus language${languageCount === 1 ? "" : "s"}.`,
        optionsHint: legal === "any_non_secret" ? "any_legal" : legal,
      });
    }
  }

  for (const spell of spellEntitlementsForNewClassLevel(state, chosenClassId)) {
    entitlements.push({
      id: spell.id,
      category: "spell",
      count: spell.count,
      source: `class:${chosenClassId}`,
      description: spell.notes,
      optionsHint: "source_registry",
      optional: spell.count === 0,
    });
  }

  return {
    characterLevel: targetLevel,
    chosenClassId,
    resultingClassLevel,
    automatic: {
      languages: currentLevel === 0 ? automaticLanguages(state) : [],
      hitDie: cls.hitDie,
      firstLevelMaxHitDie: currentLevel === 0 ? cls.hitDie : undefined,
    },
    entitlements,
    blockingReasons,
  };
}

export const PLAYER_AGENCY_RULES = [
  "Entitlements may be calculated automatically; choices may not.",
  "Claude may explain legal options but cannot commit a permanent selection without explicit player input.",
  "A creation/level-up transaction remains pending until all non-optional entitlements are satisfied.",
  "Random choices are allowed only when the player explicitly chooses a random-selection option and the roll/result is recorded.",
] as const;
