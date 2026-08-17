// Reference implementation only.
// Calculates entitlements; it never chooses permanent options for the player.

import type { Dnd5eAbility, Dnd5eCharacterState, Dnd5eLevelRecord, Dnd5eRulesProfileId } from "./domain";
import type { Dnd5eClassFeatureGrant } from "./class-types";
import { ancestryDefinition, backgroundDefinition, validateOriginAbilityChoices } from "./origin";
import { classDefinition, classLevel, characterLevel, effectiveAbilities, canGainAnotherLevel } from "./state-helpers";
import { nextLevelExperience } from "./core-tables";
import { validateMulticlassInto, isActuallyMulticlassing } from "./multiclass";
import { cantripCount, preparedOrKnownCount, pactMagic, wizardSpellbookEntitlement } from "./spellcasting";

export type Dnd5eChoiceEntitlement = {
  id: string;
  category:
    | "ability-generation"
    | "origin-ability"
    | "ancestry"
    | "background"
    | "language"
    | "skill"
    | "tool"
    | "class"
    | "subclass"
    | "feat-or-asi"
    | "feat"
    | "ability-increase"
    | "fighting-style"
    | "weapon-mastery"
    | "spell"
    | "invocation"
    | "metamagic"
    | "class-feature"
    | "hp-roll"
    | "equipment";
  count?: number;
  source: string;
  description: string;
  options?: string[] | "source-registry" | "any-skill" | "any-language" | "any-tool" | "any-ability";
  optional?: boolean;
};

export type Dnd5eCreationPlan = {
  profileId: Dnd5eRulesProfileId;
  entitlements: Dnd5eChoiceEntitlement[];
  automatic: string[];
  errors: string[];
};

export type Dnd5eLevelUpPlan = {
  profileId: Dnd5eRulesProfileId;
  fromCharacterLevel: number;
  toCharacterLevel: number;
  targetClassId: string;
  resultingClassLevel: number;
  entitlements: Dnd5eChoiceEntitlement[];
  automatic: string[];
  blockers: string[];
};

export type Dnd5eCampaignProgressionPolicy = {
  featsEnabled2014: boolean;
  advancementMode: "xp" | "milestone";
  allowMulticlass: boolean;
};

function featureToEntitlement(feature: Dnd5eClassFeatureGrant, profile: Dnd5eRulesProfileId): Dnd5eChoiceEntitlement | undefined {
  if (!feature.choiceRequired) return undefined;
  switch (feature.choiceKind) {
    case "subclass": return { id:feature.id, category:"subclass", count:1, source:feature.id, description:"Choose a legal subclass from enabled sources.", options:"source-registry" };
    case "fighting-style": return { id:feature.id, category:"fighting-style", count:1, source:feature.id, description:"Choose a legal Fighting Style.", options:"source-registry" };
    case "weapon-mastery": return { id:feature.id, category:"weapon-mastery", count:Number(feature.rules?.choices ?? feature.rules?.totalChoices ?? 1), source:feature.id, description:"Choose legal mastered weapons. Weapon Mastery is profile/source specific.", options:"source-registry" };
    case "skill": return { id:feature.id, category:"skill", count:Number(feature.rules?.choices ?? 1), source:feature.id, description:`Resolve the player choice for ${feature.label}.`, options:"source-registry" };
    case "invocation": return { id:feature.id, category:"invocation", count:Number(feature.rules?.extraChoices ?? feature.rules?.choices ?? 1), source:feature.id, description:"Choose/replace legal Eldritch Invocations as granted by this level.", options:"source-registry" };
    case "metamagic": return { id:feature.id, category:"metamagic", count:Number(feature.rules?.extraChoices ?? feature.rules?.choices ?? 1), source:feature.id, description:"Choose legal Metamagic options.", options:"source-registry" };
    case "spell": return { id:feature.id, category:"spell", count:Number(feature.rules?.choices ?? 1), source:feature.id, description:`Resolve player-owned spell choices for ${feature.label}.`, options:"source-registry" };
    case "feat": return profile === "dnd5e-2024"
      ? { id:feature.id, category:"feat", count:1, source:feature.id, description: feature.id === "epic-boon" ? "Choose a legal Epic Boon feat." : "Choose Ability Score Improvement or another legal feat granted by this class feature.", options:"source-registry" }
      : { id:feature.id, category:"feat-or-asi", count:1, source:feature.id, description:"Choose an Ability Score Improvement, or a legal feat if the campaign uses the optional 2014 feat rule.", options:"source-registry" };
    default: return { id:feature.id, category:"class-feature", count:1, source:feature.id, description:`Resolve the permanent choice for ${feature.label}.`, options:"source-registry" };
  }
}

function spellLevelEntitlements(state: Dnd5eCharacterState, classId: string, newClassLevel: number): Dnd5eChoiceEntitlement[] {
  const cls = classDefinition(state, classId);
  if (!cls?.spellcasting || newClassLevel < cls.spellcasting.startsAtClassLevel) return [];
  const abilities = effectiveAbilities(state);
  const currentCount = preparedOrKnownCount(state.rulesProfileId, classId, newClassLevel, abilities[cls.spellcasting.ability]);
  const previousCount = newClassLevel <= 1 ? 0 : preparedOrKnownCount(state.rulesProfileId, classId, newClassLevel - 1, abilities[cls.spellcasting.ability]) ?? 0;
  const cantripsNow = cantripCount(state.rulesProfileId, classId, newClassLevel) ?? 0;
  const cantripsBefore = newClassLevel <= 1 ? 0 : cantripCount(state.rulesProfileId, classId, newClassLevel - 1) ?? 0;
  const result: Dnd5eChoiceEntitlement[] = [];

  if (cantripsNow > cantripsBefore) {
    result.push({
      id:`${classId}:cantrips:${newClassLevel}`,
      category:"spell",
      count:cantripsNow-cantripsBefore,
      source:`class:${classId}`,
      description:`Choose ${cantripsNow-cantripsBefore} new legal cantrip${cantripsNow-cantripsBefore === 1 ? "" : "s"}.`,
      options:"source-registry",
    });
  }

  if (classId === "wizard") {
    const book = wizardSpellbookEntitlement(state.rulesProfileId, newClassLevel);
    if (book) result.push({
      id:`wizard:spellbook:${newClassLevel}`,
      category:"spell",
      count:book.spellsAdded,
      source:"class:wizard",
      description:`Choose ${book.spellsAdded} legal Wizard spells to add to the spellbook from spell levels currently available.`,
      options:"source-registry",
    });
    // Prepared Wizard spells are runtime choices based on the profile's prepared limit.
    return result;
  }

  if (currentCount !== undefined && currentCount > previousCount) {
    result.push({
      id:`${classId}:spell-count:${newClassLevel}`,
      category:"spell",
      count:currentCount-previousCount,
      source:`class:${classId}`,
      description: state.rulesProfileId === "dnd5e-2024"
        ? `Increase ${cls.displayName} prepared-spell capacity by ${currentCount-previousCount}; resolve legal prepared choices under the class rules.`
        : cls.spellcasting.preparationModel === "known-list"
          ? `Choose ${currentCount-previousCount} new ${cls.displayName} spell${currentCount-previousCount === 1 ? "" : "s"} known.`
          : `Prepared-spell capacity increases under ${cls.displayName} rules; preparation remains a rest/runtime choice.`,
      options:"source-registry",
    });
  }

  if (classId === "warlock") {
    const pact = pactMagic(state.rulesProfileId, newClassLevel);
    if (pact) result.push({
      id:`warlock:pact-state:${newClassLevel}`,
      category:"spell",
      count:0,
      source:"class:warlock",
      description:`Pact Magic updates to ${pact.slots} slot(s) of level ${pact.slotLevel}. This is automatic slot state, not a spell choice.`,
      optional:true,
    });
  }

  return result;
}

export function planDnd5eCreation(state: Dnd5eCharacterState, firstClassId: string): Dnd5eCreationPlan {
  const errors: string[] = [];
  if (state.levels.length) errors.push("Creation plan requires a character with no committed class level.");
  const ancestry = ancestryDefinition(state);
  const background = backgroundDefinition(state);
  const cls = classDefinition(state, firstClassId);
  if (!ancestry) errors.push(`Unknown ${state.rulesProfileId === "dnd5e-2024" ? "species" : "race"}.`);
  if (!background) errors.push("Unknown background.");
  if (!cls) errors.push(`Unknown class ${firstClassId}.`);
  errors.push(...validateOriginAbilityChoices(state));

  const entitlements: Dnd5eChoiceEntitlement[] = [
    { id:"ability-generation", category:"ability-generation", source:"core", description:"Generate and assign the six ability scores using the campaign-approved method." },
  ];
  const automatic: string[] = [];

  if (state.rulesProfileId === "dnd5e-2024" && background) {
    entitlements.push({ id:"origin:background-asi", category:"origin-ability", count:1, source:`background:${background.id}`, description:"Choose the background's legal +2/+1 or +1/+1/+1 ability-score pattern.", options: background.abilityOptions ?? "source-registry" });
    if (background.originFeatId) automatic.push(`Background grants Origin feat: ${background.originFeatId}.`);
  }

  if (ancestry) {
    for (const choice of ancestry.choices) entitlements.push({ id:choice.choiceId, category:"ancestry", count:choice.count, source:`ancestry:${ancestry.id}`, description:choice.description, options:Array.isArray(choice.options) ? choice.options : choice.options === "any-language" ? "any-language" : "source-registry" });
  }
  if (background) {
    for (const choice of background.choices) entitlements.push({ id:choice.choiceId, category:choice.choiceId.includes("language") ? "language" : "background", count:choice.count, source:`background:${background.id}`, description:choice.description, options:Array.isArray(choice.options) ? choice.options : choice.options === "any-language" ? "any-language" : "source-registry" });
  }
  if (cls) {
    entitlements.push({ id:"class:skills:1", category:"skill", count:cls.traits.skillChoices.count, source:`class:${firstClassId}`, description:`Choose ${cls.traits.skillChoices.count} starting class skill proficienc${cls.traits.skillChoices.count === 1 ? "y" : "ies"}.`, options:cls.traits.skillChoices.options === "any" ? "any-skill" : cls.traits.skillChoices.options });
    if (cls.traits.toolChoice) entitlements.push({ id:"class:tools:1", category:"tool", count:cls.traits.toolChoice.count, source:`class:${firstClassId}`, description:"Choose starting class tool/instrument proficiencies.", options:"source-registry" });
    entitlements.push({ id:"class:equipment:1", category:"equipment", count:1, source:`class:${firstClassId}`, description:"Choose one legal starting-equipment package or the allowed starting-gold alternative.", options:"source-registry" });
    for (const feature of cls.features.filter((item) => item.level === 1)) {
      const entitlement = featureToEntitlement(feature, state.rulesProfileId);
      if (entitlement) entitlements.push(entitlement);
      else automatic.push(`${cls.displayName} 1 grants ${feature.label}.`);
    }
    entitlements.push(...spellLevelEntitlements(state, firstClassId, 1));
  }

  return { profileId:state.rulesProfileId, entitlements, automatic, errors };
}

export function planDnd5eLevelUp(
  state: Dnd5eCharacterState,
  targetClassId: string,
  policy: Dnd5eCampaignProgressionPolicy,
): Dnd5eLevelUpPlan {
  const fromCharacterLevel = characterLevel(state);
  const toCharacterLevel = fromCharacterLevel + 1;
  const resultingClassLevel = classLevel(state, targetClassId) + 1;
  const blockers: string[] = [];
  const automatic: string[] = [];
  const entitlements: Dnd5eChoiceEntitlement[] = [];
  const cls = classDefinition(state, targetClassId);

  if (!cls) blockers.push(`Unknown class ${targetClassId}.`);
  if (toCharacterLevel > 20) blockers.push("Core character level cannot exceed 20 without a campaign extension.");
  if (policy.advancementMode === "xp" && fromCharacterLevel >= 1 && !canGainAnotherLevel(state)) blockers.push(`Need ${nextLevelExperience(fromCharacterLevel)} XP for level ${toCharacterLevel}.`);

  const multiclassing = isActuallyMulticlassing(state, targetClassId);
  if (multiclassing) {
    if (!policy.allowMulticlass) blockers.push("Campaign progression policy does not allow multiclassing.");
    const validation = validateMulticlassInto(state, targetClassId);
    blockers.push(...validation.errors);
    if (validation.grants) automatic.push(`Multiclass proficiency grants apply from ${targetClassId}; do not grant the class's full level-1 starting proficiencies.`);
  }

  if (cls) {
    entitlements.push({ id:`hp-roll:${toCharacterLevel}`, category:"hp-roll", count:1, source:`class:${targetClassId}`, description:`Roll the player's d${cls.traits.hitDie} Hit Die, or explicitly choose the campaign's fixed-average HP option. Store the chosen result.` });

    for (const feature of cls.features.filter((item) => item.level === resultingClassLevel)) {
      const entitlement = featureToEntitlement(feature, state.rulesProfileId);
      if (!entitlement) automatic.push(`${cls.displayName} ${resultingClassLevel} grants ${feature.label}.`);
      else if (state.rulesProfileId === "dnd5e-2014" && entitlement.category === "feat-or-asi" && !policy.featsEnabled2014) {
        entitlements.push({ ...entitlement, category:"ability-increase", description:"Choose the 2014 Ability Score Improvement; optional feats are disabled for this campaign.", options:"any-ability" });
      } else entitlements.push(entitlement);
    }

    entitlements.push(...spellLevelEntitlements(state, targetClassId, resultingClassLevel));
  }

  return { profileId:state.rulesProfileId, fromCharacterLevel, toCharacterLevel, targetClassId, resultingClassLevel, entitlements, automatic, blockers };
}

/**
 * Structural validation. Detailed feat/spell/mastery legality belongs in the
 * corresponding registries/source packs, but missing permanent choices must
 * still block the transaction.
 */
export function validateLevelRecordShape(stateBefore: Dnd5eCharacterState, level: Dnd5eLevelRecord): string[] {
  const errors: string[] = [];
  const expectedCharacterLevel = stateBefore.levels.length + 1;
  if (level.characterLevel !== expectedCharacterLevel) errors.push(`Expected character level ${expectedCharacterLevel}.`);
  const expectedClassLevel = classLevel(stateBefore, level.classId) + 1;
  if (level.classLevel !== expectedClassLevel) errors.push(`Expected ${level.classId} class level ${expectedClassLevel}.`);
  const cls = classDefinition(stateBefore, level.classId);
  if (!cls) return [...errors, `Unknown class ${level.classId}.`];
  if (level.hitDie !== cls.traits.hitDie) errors.push(`Expected d${cls.traits.hitDie} Hit Die.`);
  if (level.characterLevel === 1 && level.hitPointRoll !== cls.traits.hitDie) errors.push("Level 1 uses the class's maximum Hit Die result before Constitution.");
  if (level.characterLevel > 1 && (level.hitPointRoll < 1 || level.hitPointRoll > cls.traits.hitDie)) errors.push(`HP result must be 1..${cls.traits.hitDie}.`);

  const subclassFeature = cls.features.find((feature) => feature.level === level.classLevel && feature.choiceKind === "subclass");
  if (subclassFeature && !level.subclassId) errors.push(`Missing subclass choice at ${cls.displayName} ${level.classLevel}.`);
  if (!subclassFeature && level.subclassId && classLevel(stateBefore, level.classId) === 0) {
    // Imported/continuing records can repeat stored subclass for projection, but first-class-level premature choices are illegal.
    const legalSubclassLevel = Math.min(...cls.subclassLevels);
    if (level.classLevel < legalSubclassLevel) errors.push(`Subclass cannot be selected before ${cls.displayName} ${legalSubclassLevel} in this profile.`);
  }
  return errors;
}
