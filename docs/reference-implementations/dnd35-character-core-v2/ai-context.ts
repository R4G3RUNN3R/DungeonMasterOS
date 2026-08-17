// Reference implementation only.
// Builds compact, trusted facts for the DM. It deliberately excludes raw characterData.

import type { Dnd35CharacterState, Dnd35EquipmentSnapshot } from "./domain";
import type { Dnd35Modifier } from "./modifiers";
import { getCoreClass } from "./classes";
import { getCoreRace } from "./races";
import {
  abilityModifier,
  aggregateSkillRanks,
  characterLevel,
  classTotals,
  effectivePermanentAbilities,
  iterativeBaseAttacks,
  multiclassBaseAttack,
  multiclassBaseSaves,
  permanentSize,
  sizeModifiers,
} from "./mechanics";
import { totalForTarget } from "./modifiers";

export type TrustedAiCharacterContext = {
  characterId: number;
  name: string;
  ruleset: "D&D 3.5e";
  race: string;
  classes: Array<{ classId: string; name: string; level: number }>;
  characterLevel: number;
  alignment?: string;
  deity?: string;
  xp: number;
  hp: { current: number; maximum: number; temporary: number; status?: string };
  abilities: Record<string, { score: number; modifier: number }>;
  combat: {
    baseAttackBonus: number;
    iterativeBaseAttacks: number[];
    grappleBase: number;
    size: string;
    speed: number;
  };
  saves: { fortitude: number; reflex: number; will: number };
  trainedSkills: Array<{ skillId: string; ranks: number }>;
  feats: string[];
  racialFeatures: string[];
  classFeatures: string[];
  equippedItems: string[];
  activeEffects: Array<{ name: string; roundsRemaining?: number | null }>;
  languages: string[];
  spellcasting: Array<{
    classId: string;
    casterLevel?: number;
    slots?: Record<string, number>;
    usedSlots?: Record<string, number>;
    known?: string[];
    prepared?: string[];
  }>;
};

export type AiContextRuntime = {
  name: string;
  currentHp: number;
  maximumHp: number;
  tempHp: number;
  status?: string;
  speed: number;
  equipment: Dnd35EquipmentSnapshot[];
  modifiers: Dnd35Modifier[];
  effects: Array<{ name: string; roundsRemaining?: number | null }>;
};

function classFeatureNames(state: Dnd35CharacterState): string[] {
  const totals = classTotals(state.levels);
  const result: string[] = [];
  for (const [classId, level] of Object.entries(totals)) {
    const cls = getCoreClass(classId);
    if (!cls) continue;
    result.push(...cls.features.filter((feature) => feature.level <= level).map((feature) => feature.label));
  }
  return [...new Set(result)];
}

export function buildTrustedAiCharacterContext(
  state: Dnd35CharacterState,
  runtime: AiContextRuntime,
): TrustedAiCharacterContext {
  const abilities = effectivePermanentAbilities(state);
  const totals = classTotals(state.levels);
  const race = getCoreRace(state.race.raceId);
  const bab = multiclassBaseAttack(state.levels);
  const baseSaves = multiclassBaseSaves(state.levels);
  const size = permanentSize(state);
  const sizeMod = sizeModifiers(size);
  const allSaveBonus = totalForTarget(runtime.modifiers, "save:any").total;
  const skills = aggregateSkillRanks(state);

  return {
    characterId: state.characterId,
    name: runtime.name,
    ruleset: "D&D 3.5e",
    race: race?.displayName ?? state.race.raceId,
    classes: Object.entries(totals).map(([classId, level]) => ({
      classId,
      name: getCoreClass(classId)?.displayName ?? classId,
      level,
    })),
    characterLevel: characterLevel(state),
    alignment: state.persistentChoices.alignment,
    deity: state.persistentChoices.deity,
    xp: state.experiencePoints,
    hp: {
      current: runtime.currentHp,
      maximum: runtime.maximumHp,
      temporary: runtime.tempHp,
      status: runtime.status,
    },
    abilities: Object.fromEntries(
      Object.entries(abilities).map(([key, score]) => [key, { score, modifier: abilityModifier(score) }]),
    ),
    combat: {
      baseAttackBonus: bab,
      iterativeBaseAttacks: iterativeBaseAttacks(bab),
      grappleBase: bab + abilityModifier(abilities.str) + sizeMod.grapple + totalForTarget(runtime.modifiers, "grapple").total,
      size,
      speed: runtime.speed,
    },
    saves: {
      fortitude: baseSaves.fortitude + abilityModifier(abilities.con) + allSaveBonus + totalForTarget(runtime.modifiers, "save:fortitude").total,
      reflex: baseSaves.reflex + abilityModifier(abilities.dex) + allSaveBonus + totalForTarget(runtime.modifiers, "save:reflex").total,
      will: baseSaves.will + abilityModifier(abilities.wis) + allSaveBonus + totalForTarget(runtime.modifiers, "save:will").total,
    },
    trainedSkills: Object.entries(skills)
      .filter(([, ranks]) => ranks > 0)
      .map(([skillId, ranks]) => ({ skillId, ranks })),
    feats: state.levels.flatMap((level) => level.featChoices.map((feat) => feat.name)),
    racialFeatures: [
      ...(race?.specialTraits ?? []),
      ...(race?.senses.map((sense) => sense.type === "darkvision" ? `Darkvision ${sense.rangeFt} ft.` : `Low-light vision x${sense.multiplier}`) ?? []),
    ],
    classFeatures: classFeatureNames(state),
    equippedItems: runtime.equipment.filter((item) => item.equipped).map((item) => item.name),
    activeEffects: runtime.effects.map((effect) => ({ name: effect.name, roundsRemaining: effect.roundsRemaining })),
    languages: [...new Set(state.persistentChoices.languages)],
    spellcasting: state.spellcasting.map((block) => ({
      classId: block.classId,
      casterLevel: block.casterLevel,
      slots: block.slots,
      usedSlots: block.usedSlots,
      known: block.known?.map((spell) => spell.name),
      prepared: block.prepared?.map((spell) => spell.name),
    })),
  };
}

/**
 * Prompt-safe renderer. It reports facts only. It does not include private chain-of-thought,
 * arbitrary player-authored JSON or hidden DM-only world information.
 */
export function renderTrustedAiCharacterContext(context: TrustedAiCharacterContext): string {
  const abilityLine = Object.entries(context.abilities)
    .map(([ability, value]) => `${ability.toUpperCase()} ${value.score} (${value.modifier >= 0 ? "+" : ""}${value.modifier})`)
    .join(", ");
  const classLine = context.classes.map((entry) => `${entry.name} ${entry.level}`).join(" / ");

  return [
    `CHARACTER: ${context.name}`,
    `RULESET: ${context.ruleset}`,
    `RACE: ${context.race}`,
    `CLASS: ${classLine || "Unresolved"}`,
    `LEVEL/XP: ${context.characterLevel} / ${context.xp} XP`,
    context.alignment ? `ALIGNMENT: ${context.alignment}` : null,
    `HP: ${context.hp.current}/${context.hp.maximum}${context.hp.temporary ? ` +${context.hp.temporary} temp` : ""}${context.hp.status ? ` (${context.hp.status})` : ""}`,
    `ABILITIES: ${abilityLine}`,
    `COMBAT: BAB ${context.combat.baseAttackBonus >= 0 ? "+" : ""}${context.combat.baseAttackBonus}; base iteratives ${context.combat.iterativeBaseAttacks.join("/")}; grapple ${context.combat.grappleBase >= 0 ? "+" : ""}${context.combat.grappleBase}; size ${context.combat.size}; speed ${context.combat.speed} ft.`,
    `SAVES: Fort ${context.saves.fortitude >= 0 ? "+" : ""}${context.saves.fortitude}, Ref ${context.saves.reflex >= 0 ? "+" : ""}${context.saves.reflex}, Will ${context.saves.will >= 0 ? "+" : ""}${context.saves.will}`,
    context.trainedSkills.length ? `TRAINED SKILLS: ${context.trainedSkills.map((skill) => `${skill.skillId} ${skill.ranks} ranks`).join("; ")}` : null,
    context.feats.length ? `FEATS: ${context.feats.join("; ")}` : null,
    context.racialFeatures.length ? `RACIAL FEATURES: ${context.racialFeatures.join("; ")}` : null,
    context.classFeatures.length ? `CLASS FEATURES: ${context.classFeatures.join("; ")}` : null,
    context.equippedItems.length ? `EQUIPPED: ${context.equippedItems.join("; ")}` : null,
    context.activeEffects.length ? `ACTIVE EFFECTS: ${context.activeEffects.map((effect) => effect.roundsRemaining == null ? effect.name : `${effect.name} (${effect.roundsRemaining} rounds)`).join("; ")}` : null,
    context.languages.length ? `LANGUAGES: ${context.languages.join(", ")}` : null,
  ].filter(Boolean).join("\n");
}
