// Reference implementation only.
// This is the intended composition boundary for production adapters.

import type { Dnd35CharacterSheetData } from "../../../shared/dnd35-character-sheet";
import type { Dnd35CharacterState, Dnd35ResourceState } from "./domain";
import type { Dnd35Modifier } from "./modifiers";
import { deriveClassMechanics } from "./class-derivations";
import { buildTrustedAiCharacterContext, renderTrustedAiCharacterContext, type AiContextRuntime, type TrustedAiCharacterContext } from "./ai-context";
import { projectDnd35CharacterSheet, type SheetProjectorRuntime } from "./sheet-projector";
import { allKnownLanguages } from "./languages";
import { classTotals, effectivePermanentAbilities, carryingCapacity, loadCategory, permanentSize } from "./mechanics";
import { CORE_SPELL_PROGRESSION, domainSlotsForCleric, totalSlotsForClassLevel } from "./spellcasting";

export type Dnd35ResolvedSpellcasting = Array<{
  classId: string;
  casterLevel: number;
  slots: Record<string, number>;
  usedSlots: Record<string, number>;
  known: string[];
  prepared: string[];
  spellbook: string[];
  domains: string[];
}>;

export type Dnd35ResolvedCharacter = {
  sheet: Dnd35CharacterSheetData;
  aiContext: TrustedAiCharacterContext;
  aiPromptBlock: string;
  resources: Dnd35ResourceState[];
  spellcasting: Dnd35ResolvedSpellcasting;
  warnings: string[];
};

function mergeResources(
  stored: Dnd35ResourceState[],
  derived: Dnd35ResourceState[],
): Dnd35ResourceState[] {
  const storedById = new Map(stored.map((resource) => [resource.resourceId, resource]));
  return derived.map((definition) => {
    const prior = storedById.get(definition.resourceId);
    if (!prior) return definition;
    return {
      ...definition,
      current: Math.min(definition.maximum, Math.max(0, prior.current)),
    };
  });
}

function monkAcEligible(state: Dnd35CharacterState, runtime: SheetProjectorRuntime): boolean {
  if (!(classTotals(state.levels).monk > 0)) return false;
  const equippedArmor = runtime.equipment.filter((item) => item.equipped && !!item.rules?.armor);
  if (equippedArmor.length > 0) return false;
  const weight = runtime.equipment.reduce(
    (sum, item) => sum + (item.rules?.weightLb ?? 0) * Math.max(1, item.quantity || 1),
    0,
  );
  const capacity = carryingCapacity(effectivePermanentAbilities(state).str, permanentSize(state));
  const load = loadCategory(weight, capacity);
  if (load !== "light") return false;
  const status = String(runtime.status || "").toLowerCase();
  return !status.includes("immobilized") && !status.includes("helpless");
}

function resolveContextualClassModifiers(
  state: Dnd35CharacterState,
  runtime: SheetProjectorRuntime,
  modifiers: Dnd35Modifier[],
): Dnd35Modifier[] {
  const monkEligible = monkAcEligible(state, runtime);
  return modifiers
    .filter((modifier) => {
      if (modifier.condition?.requiresCustomFlag === "monkAcEligible") return monkEligible;
      return true;
    })
    .map((modifier) => {
      if (modifier.condition?.requiresCustomFlag === "monkAcEligible" && monkEligible) {
        return { ...modifier, condition: undefined };
      }
      return modifier;
    });
}

export function resolveSpellcasting(state: Dnd35CharacterState): Dnd35ResolvedSpellcasting {
  const totals = classTotals(state.levels);
  const abilities = effectivePermanentAbilities(state);

  return Object.entries(totals).flatMap(([classId, classLevel]) => {
    const progression = CORE_SPELL_PROGRESSION[classId as keyof typeof CORE_SPELL_PROGRESSION];
    if (!progression || classLevel < 1) return [];

    const abilityScore = abilities[progression.castingAbility];
    const calculated = totalSlotsForClassLevel(progression.classId, classLevel, abilityScore);
    const slots: Record<string, number> = Object.fromEntries(
      Object.entries(calculated).map(([level, value]) => [level, Number(value)]),
    );

    if (classId === "cleric") {
      for (const [spellLevel, value] of Object.entries(domainSlotsForCleric(classLevel, abilityScore))) {
        slots[`domain:${spellLevel}`] = Number(value);
      }
    }

    const stored = state.spellcasting.find((entry) => entry.classId === classId);
    return [{
      classId,
      casterLevel: progression.casterLevel(classLevel),
      slots,
      usedSlots: stored?.usedSlots ?? {},
      known: stored?.known?.map((spell) => spell.name) ?? [],
      prepared: stored?.prepared?.map((spell) => spell.name) ?? [],
      spellbook: stored?.spellbook?.map((spell) => spell.name) ?? [],
      domains: stored?.domains ?? [],
    }];
  });
}

function stateWithResolvedSpellcasting(state: Dnd35CharacterState, spellcasting: Dnd35ResolvedSpellcasting): Dnd35CharacterState {
  return {
    ...state,
    spellcasting: spellcasting.map((resolved) => {
      const prior = state.spellcasting.find((entry) => entry.classId === resolved.classId);
      return {
        classId: resolved.classId,
        casterLevel: resolved.casterLevel,
        slots: resolved.slots,
        usedSlots: resolved.usedSlots,
        prepared: prior?.prepared ?? [],
        known: prior?.known ?? [],
        spellbook: prior?.spellbook ?? [],
        domains: prior?.domains,
        specialization: prior?.specialization,
        prohibitedSchools: prior?.prohibitedSchools,
      };
    }),
  };
}

export function resolveDnd35Character(
  state: Dnd35CharacterState,
  sheetRuntime: SheetProjectorRuntime,
  aiRuntime: Omit<AiContextRuntime, "modifiers">,
): Dnd35ResolvedCharacter {
  const classDerived = deriveClassMechanics(state);
  const classModifiers = resolveContextualClassModifiers(state, sheetRuntime, classDerived.modifiers);
  const modifiers = [...sheetRuntime.modifiers, ...classModifiers];
  const spellcasting = resolveSpellcasting(state);
  const resolvedState = stateWithResolvedSpellcasting(state, spellcasting);
  const resources = mergeResources(state.resources, classDerived.resources);

  const sheet = projectDnd35CharacterSheet(resolvedState, {
    ...sheetRuntime,
    modifiers,
  });
  sheet.languages = allKnownLanguages(state);
  sheet.specialAbilities = [
    ...(sheet.specialAbilities ?? []),
    ...resources.map((resource) => ({
      name: `${resource.label}: ${resource.current}/${resource.maximum}`,
      source: resource.source.label ?? resource.source.sourceId,
      description: `Refresh: ${resource.refresh}`,
    })),
  ];

  const aiContext = buildTrustedAiCharacterContext(resolvedState, {
    ...aiRuntime,
    modifiers,
  });
  aiContext.languages = allKnownLanguages(state);
  aiContext.spellcasting = spellcasting.map((entry) => ({
    classId: entry.classId,
    casterLevel: entry.casterLevel,
    slots: entry.slots,
    usedSlots: entry.usedSlots,
    known: entry.known,
    prepared: entry.prepared,
  }));

  const warnings: string[] = [...classDerived.notes];
  for (const block of spellcasting) {
    for (const [level, used] of Object.entries(block.usedSlots)) {
      const maximum = block.slots[level] ?? 0;
      if (used > maximum) warnings.push(`${block.classId}: used ${used} slot(s) at ${level}, but calculated maximum is ${maximum}.`);
    }
  }

  return {
    sheet,
    aiContext,
    aiPromptBlock: renderTrustedAiCharacterContext(aiContext),
    resources,
    spellcasting,
    warnings,
  };
}
