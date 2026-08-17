// Reference implementation only.
// Derives automatic class mechanics/resources. Permanent class choices remain in state.

import type { Dnd35CharacterState, Dnd35ResourceState } from "./domain";
import type { Dnd35Modifier } from "./modifiers";
import { abilityModifier, classTotals, effectivePermanentAbilities } from "./mechanics";

export type Dnd35ClassDerivations = {
  modifiers: Dnd35Modifier[];
  resources: Dnd35ResourceState[];
  notes: string[];
};

function classLevel(state: Dnd35CharacterState, id: string): number {
  return classTotals(state.levels)[id] ?? 0;
}

function paladinSmiteUses(level: number): number {
  if (level >= 20) return 5;
  if (level >= 15) return 4;
  if (level >= 10) return 3;
  if (level >= 5) return 2;
  return level >= 1 ? 1 : 0;
}

function paladinRemoveDiseaseUsesPerWeek(level: number): number {
  if (level < 6) return 0;
  return Math.min(5, 1 + Math.floor((level - 6) / 3));
}

function druidWildShapeUses(level: number): number {
  if (level < 5) return 0;
  if (level >= 18) return 6;
  if (level >= 14) return 5;
  if (level >= 10) return 4;
  if (level >= 7) return 3;
  if (level >= 6) return 2;
  return 1;
}

function druidElementalWildShapeUses(level: number): number {
  if (level >= 20) return 3;
  if (level >= 18) return 2;
  if (level >= 16) return 1;
  return 0;
}

function barbarianRageUses(level: number): number {
  if (level < 1) return 0;
  if (level >= 20) return 6;
  if (level >= 16) return 5;
  if (level >= 12) return 4;
  if (level >= 8) return 3;
  if (level >= 4) return 2;
  return 1;
}

function monkAcClassBonus(level: number): number {
  return Math.floor(level / 5);
}

/**
 * Class automatic bonuses which should be fed through the 3.5 typed modifier engine.
 * Contextual class rules are emitted with machine-readable flags where possible.
 */
export function deriveClassMechanics(state: Dnd35CharacterState): Dnd35ClassDerivations {
  const totals = classTotals(state.levels);
  const abilities = effectivePermanentAbilities(state);
  const modifiers: Dnd35Modifier[] = [];
  const resources: Dnd35ResourceState[] = [];
  const notes: string[] = [];

  const barbarian = totals.barbarian ?? 0;
  if (barbarian > 0) {
    resources.push({
      resourceId: "barbarian:rage",
      label: "Rage",
      current: barbarianRageUses(barbarian),
      maximum: barbarianRageUses(barbarian),
      refresh: "daily",
      source: { sourceId: "class:barbarian", sourceType: "class", label: `Barbarian ${barbarian}` },
    });
    notes.push("Rage is an activated temporary effect. Its Strength, Constitution, Will and AC changes must never be applied permanently.");
  }

  const bard = totals.bard ?? 0;
  if (bard > 0) {
    resources.push({
      resourceId: "bard:bardic-music",
      label: "Bardic Music",
      current: bard,
      maximum: bard,
      refresh: "daily",
      source: { sourceId: "class:bard", sourceType: "class", label: `Bard ${bard}` },
    });
  }

  const cleric = totals.cleric ?? 0;
  if (cleric > 0) {
    const cha = Math.max(0, abilityModifier(abilities.cha));
    resources.push({
      resourceId: "cleric:turn-rebuke-undead",
      label: "Turn/Rebuke Undead",
      current: 3 + cha,
      maximum: 3 + cha,
      refresh: "daily",
      source: { sourceId: "class:cleric", sourceType: "class", label: `Cleric ${cleric}` },
    });
    notes.push("Whether this character turns or rebukes undead is a permanent player/deity/alignment choice and must be stored explicitly.");
  }

  const druid = totals.druid ?? 0;
  if (druid >= 5) {
    resources.push({
      resourceId: "druid:wild-shape",
      label: "Wild Shape",
      current: druidWildShapeUses(druid),
      maximum: druidWildShapeUses(druid),
      refresh: "daily",
      source: { sourceId: "class:druid", sourceType: "class", label: `Druid ${druid}` },
    });
  }
  if (druid >= 16) {
    resources.push({
      resourceId: "druid:elemental-wild-shape",
      label: "Elemental Wild Shape",
      current: druidElementalWildShapeUses(druid),
      maximum: druidElementalWildShapeUses(druid),
      refresh: "daily",
      source: { sourceId: "class:druid", sourceType: "class", label: `Druid ${druid}` },
    });
  }

  const monk = totals.monk ?? 0;
  if (monk > 0) {
    const wis = Math.max(0, abilityModifier(abilities.wis));
    const classBonus = monkAcClassBonus(monk);
    const unarmoredCondition = {
      requiresCustomFlag: "monkAcEligible",
      description: "only while unarmored, unshielded, unencumbered, and not immobilized or helpless",
    };

    if (wis > 0) {
      for (const target of ["ac", "touch-ac", "flat-footed-ac"] as const) {
        modifiers.push({
          id: `monk:wis-ac:${target}`,
          target,
          amount: wis,
          bonusType: "untyped",
          sourceId: "class:monk:wis-ac",
          sourceLabel: "Monk Wisdom to AC",
          condition: unarmoredCondition,
        });
      }
    }

    if (classBonus > 0) {
      for (const target of ["ac", "touch-ac", "flat-footed-ac"] as const) {
        modifiers.push({
          id: `monk:class-ac:${target}`,
          target,
          amount: classBonus,
          bonusType: "untyped",
          sourceId: "class:monk:ac-bonus",
          sourceLabel: `Monk AC Bonus +${classBonus}`,
          condition: unarmoredCondition,
        });
      }
    }

    if (monk >= 3) {
      modifiers.push({
        id: "monk:still-mind",
        target: "save:any",
        amount: 2,
        bonusType: "untyped",
        sourceId: "class:monk:still-mind",
        sourceLabel: "Still Mind",
        condition: { requiresSourceTag: "enchantment", description: "against spells/effects from the enchantment school" },
      });
    }
  }

  const paladin = totals.paladin ?? 0;
  if (paladin > 0) {
    resources.push({
      resourceId: "paladin:smite-evil",
      label: "Smite Evil",
      current: paladinSmiteUses(paladin),
      maximum: paladinSmiteUses(paladin),
      refresh: "daily",
      source: { sourceId: "class:paladin", sourceType: "class", label: `Paladin ${paladin}` },
    });
  }

  if (paladin >= 2) {
    const cha = Math.max(0, abilityModifier(abilities.cha));
    if (cha > 0) {
      for (const save of ["fortitude", "reflex", "will"] as const) {
        modifiers.push({
          id: `paladin:divine-grace:${save}`,
          target: `save:${save}`,
          amount: cha,
          bonusType: "untyped",
          sourceId: "class:paladin:divine-grace",
          sourceLabel: "Divine Grace",
        });
      }
    }

    const layOnHands = Math.max(0, paladin * abilityModifier(abilities.cha));
    resources.push({
      resourceId: "paladin:lay-on-hands",
      label: "Lay on Hands",
      current: layOnHands,
      maximum: layOnHands,
      refresh: "daily",
      source: { sourceId: "class:paladin", sourceType: "class", label: `Paladin ${paladin}` },
    });
  }

  if (paladin >= 3) {
    modifiers.push({
      id: "paladin:aura-courage:self",
      target: "save:any",
      amount: 0,
      bonusType: "untyped",
      sourceId: "class:paladin:aura-courage",
      sourceLabel: "Aura of Courage",
      condition: { requiresSourceTag: "fear", description: "Paladin is immune to fear; allies have a separate aura bonus." },
    });
    notes.push("Aura of Courage grants the paladin fear immunity; nearby allies receive the separate core morale bonus. Model immunity and ally aura explicitly rather than as an ordinary self save bonus.");
  }

  if (paladin >= 4) {
    const cha = Math.max(0, abilityModifier(abilities.cha));
    resources.push({
      resourceId: "paladin:turn-undead",
      label: "Turn Undead",
      current: 3 + cha,
      maximum: 3 + cha,
      refresh: "daily",
      source: { sourceId: "class:paladin", sourceType: "class", label: `Effective cleric level ${paladin - 3}` },
    });
  }

  const removeDisease = paladinRemoveDiseaseUsesPerWeek(paladin);
  if (removeDisease > 0) {
    resources.push({
      resourceId: "paladin:remove-disease",
      label: "Remove Disease",
      current: removeDisease,
      maximum: removeDisease,
      refresh: "manual",
      source: { sourceId: "class:paladin", sourceType: "class", label: `Paladin ${paladin}; per week` },
    });
  }

  return { modifiers, resources, notes };
}

/** Rage template for the existing active-effects system. */
export function barbarianRageEffectTemplate(state: Dnd35CharacterState): {
  name: string;
  source: string;
  modifiers: Dnd35Modifier[];
  notes: string[];
} | null {
  const level = classLevel(state, "barbarian");
  if (!level) return null;

  const abilityBonus = level >= 20 ? 8 : level >= 11 ? 6 : 4;
  const willBonus = level >= 20 ? 4 : level >= 11 ? 3 : 2;

  return {
    name: level >= 20 ? "Mighty Rage" : level >= 11 ? "Greater Rage" : "Rage",
    source: `Barbarian ${level}`,
    modifiers: [
      { id: "rage:str", target: "ability:str", amount: abilityBonus, bonusType: "untyped", sourceId: "barbarian:rage", sourceLabel: "Rage" },
      { id: "rage:con", target: "ability:con", amount: abilityBonus, bonusType: "untyped", sourceId: "barbarian:rage", sourceLabel: "Rage" },
      { id: "rage:will", target: "save:will", amount: willBonus, bonusType: "morale", sourceId: "barbarian:rage", sourceLabel: "Rage" },
      { id: "rage:ac", target: "ac", amount: -2, bonusType: "penalty", sourceId: "barbarian:rage", sourceLabel: "Rage" },
    ],
    notes: ["Rage also has action restrictions, duration and post-rage fatigue rules that belong in the combat/effect resolver."],
  };
}
