// Reference implementation only.
// This is the boundary between authoritative D&D state and the existing read-only sheet.

import type {
  Dnd35CharacterSheetData,
  Dnd35SkillEntry,
  Dnd35WeaponEntry,
  Dnd35ArmorEntry,
  Dnd35GearEntry,
  Dnd35SpecialAbilityEntry,
} from "../../../shared/dnd35-character-sheet";
import type { Dnd35CharacterState, Dnd35EquipmentSnapshot } from "./domain";
import type { Dnd35Modifier } from "./modifiers";
import { totalForTarget } from "./modifiers";
import { getCoreClass, featuresGrantedAtClassLevel } from "./classes";
import { getCoreRace } from "./races";
import { CORE_SKILLS, getSkillDefinition } from "./skills";
import { mergedClassProficiencies } from "./proficiencies";
import {
  abilityModifier,
  aggregateSkillRanks,
  armorCheckPenaltyForSkill,
  carryingCapacity,
  characterLevel,
  classTotals,
  derivedLandSpeed,
  effectivePermanentAbilities,
  iterativeBaseAttacks,
  loadArmorCheckPenalty,
  loadCategory,
  loadMaxDex,
  maxSkillRanks,
  multiclassBaseAttack,
  multiclassBaseSaves,
  nextLevelExperience,
  permanentSize,
  sizeModifiers,
} from "./mechanics";

export type SheetProjectorRuntime = {
  playerName?: string;
  characterName: string;
  currentHp: number;
  tempHp: number;
  nonlethalDamage?: number;
  status?: string;
  traits?: string;
  backstory?: string;
  equipment: Dnd35EquipmentSnapshot[];
  modifiers: Dnd35Modifier[];
  currencies: Array<{ code: string; name?: string; symbol?: string; amount: number }>;
  physical?: {
    age?: string | number;
    gender?: string;
    height?: string;
    weight?: string;
    eyes?: string;
    hair?: string;
    skin?: string;
  };
  movement?: { fly?: number; swim?: number; climb?: number; burrow?: number; notes?: string };
  spellResistance?: number | string;
  damageReduction?: string;
  notes?: { alliesAndContacts?: string; enemies?: string; campaignNotes?: string };
};

function modifierTotal(runtime: SheetProjectorRuntime, target: string, bonusTypes?: string[]): number {
  const relevant = bonusTypes
    ? runtime.modifiers.filter((modifier) => bonusTypes.includes(modifier.bonusType))
    : runtime.modifiers;
  return totalForTarget(relevant, target).total;
}

function equipped(runtime: SheetProjectorRuntime): Dnd35EquipmentSnapshot[] {
  return runtime.equipment.filter((item) => item.equipped);
}

function carriedWeight(runtime: SheetProjectorRuntime): number {
  return runtime.equipment.reduce(
    (total, item) => total + (item.rules?.weightLb ?? 0) * Math.max(1, item.quantity || 1),
    0,
  );
}

function armorSnapshot(runtime: SheetProjectorRuntime) {
  const equippedArmor = equipped(runtime).filter((item) => !!item.rules?.armor);
  const body = equippedArmor.find((item) => item.rules?.armor?.category !== "shield");
  const shield = equippedArmor.find((item) => item.rules?.armor?.category === "shield");
  const bodyRule = body?.rules?.armor;
  const shieldRule = shield?.rules?.armor;
  const maxDexCandidates = [bodyRule?.maxDexBonus, shieldRule?.maxDexBonus].filter(
    (value): value is number => typeof value === "number",
  );

  return {
    category: bodyRule?.category ?? "none",
    armorBonus: (bodyRule?.armorBonus ?? 0) + (bodyRule?.enhancementBonus ?? 0),
    shieldBonus: (shieldRule?.shieldBonus ?? shieldRule?.armorBonus ?? 0) + (shieldRule?.enhancementBonus ?? 0),
    maxDex: maxDexCandidates.length ? Math.min(...maxDexCandidates) : null,
    armorCheckPenalty: (bodyRule?.armorCheckPenalty ?? 0) + (shieldRule?.armorCheckPenalty ?? 0),
  };
}

function staticRacialSkillBonus(state: Dnd35CharacterState, skillId: string): number {
  const race = getCoreRace(state.race.raceId);
  return (race?.skillModifiers ?? [])
    .filter((entry) => entry.skillId === skillId && !entry.condition)
    .reduce((sum, entry) => sum + entry.value, 0);
}

function staticRacialAllSaveBonus(state: Dnd35CharacterState): number {
  const race = getCoreRace(state.race.raceId);
  return (race?.conditionalModifiers ?? [])
    .filter((entry) => entry.target === "save:any" && entry.condition === "all saving throws")
    .reduce((sum, entry) => sum + entry.value, 0);
}

function classFeatureEntries(state: Dnd35CharacterState): Dnd35SpecialAbilityEntry[] {
  const entries: Dnd35SpecialAbilityEntry[] = [];
  for (const [classId, total] of Object.entries(classTotals(state.levels))) {
    const cls = getCoreClass(classId);
    if (!cls) continue;
    for (let classLevel = 1; classLevel <= total; classLevel += 1) {
      for (const feature of featuresGrantedAtClassLevel(classId, classLevel)) {
        entries.push({ name: feature.label, source: `${cls.displayName} ${classLevel}` });
      }
    }
  }
  return entries;
}

function racialFeatureEntries(state: Dnd35CharacterState): Dnd35SpecialAbilityEntry[] {
  const race = getCoreRace(state.race.raceId);
  if (!race) return [];

  const entries: Dnd35SpecialAbilityEntry[] = race.specialTraits.map((name) => ({ name, source: race.displayName }));
  for (const sense of race.senses) {
    entries.push({
      name: sense.type === "darkvision" ? `Darkvision ${sense.rangeFt} ft.` : `Low-light vision x${sense.multiplier}`,
      source: race.displayName,
    });
  }
  for (const ability of race.spellLikeAbilities) {
    entries.push({
      name: `${ability.name} ${ability.usesPerDay}/day`,
      source: race.displayName,
      description: ability.restriction,
    });
  }
  for (const conditional of race.conditionalModifiers) {
    entries.push({
      name: `${conditional.value >= 0 ? "+" : ""}${conditional.value} ${conditional.bonusType} ${conditional.target}`,
      source: race.displayName,
      description: conditional.condition,
    });
  }
  return entries;
}

function weaponRows(state: Dnd35CharacterState, runtime: SheetProjectorRuntime): Dnd35WeaponEntry[] {
  const abilities = effectivePermanentAbilities(state);
  const bab = multiclassBaseAttack(state.levels);
  const sizeAttack = sizeModifiers(permanentSize(state)).attackAndAc;

  return runtime.equipment
    .filter((item) => item.itemType === "weapon" || !!item.rules?.weapon)
    .map((item) => {
      const rules = item.rules?.weapon;
      if (!rules) return { name: item.name, notes: item.equipped ? "Equipped; no D&D 3.5e weapon rules payload yet" : undefined };

      const attackAbility = rules.attackAbility ?? "str";
      const damageAbility = rules.damageAbility ?? (attackAbility === "str" ? "str" : undefined);
      const enhancement = rules.enhancementBonus ?? 0;
      const attackMisc = modifierTotal(runtime, "attack");
      const attackAbilityModifier = abilityModifier(abilities[attackAbility]);
      const attacks = iterativeBaseAttacks(bab).map(
        (base) => base + attackAbilityModifier + sizeAttack + enhancement + attackMisc,
      );
      const damageModifier =
        (damageAbility ? abilityModifier(abilities[damageAbility]) : 0) +
        enhancement +
        modifierTotal(runtime, "damage");

      return {
        name: item.name,
        attackBonus: attacks.map((value) => (value >= 0 ? `+${value}` : `${value}`)).join("/"),
        damage: rules.damage
          ? `${rules.damage}${damageModifier === 0 ? "" : damageModifier > 0 ? `+${damageModifier}` : damageModifier}`
          : undefined,
        critical: rules.critical,
        range: rules.rangeFt ? `${rules.rangeFt} ft.` : undefined,
        damageType: rules.damageType,
        size: rules.size,
        weight: item.rules?.weightLb !== undefined ? `${item.rules.weightLb} lb.` : undefined,
        notes: item.equipped ? "Equipped" : undefined,
      };
    });
}

function armorRows(runtime: SheetProjectorRuntime): Dnd35ArmorEntry[] {
  return runtime.equipment
    .filter((item) => item.itemType === "armor" || !!item.rules?.armor)
    .map((item) => {
      const rules = item.rules?.armor;
      return {
        name: item.name,
        type: rules?.category,
        armorBonus: rules?.category === "shield" ? rules.shieldBonus ?? rules.armorBonus : rules?.armorBonus,
        maxDexBonus: rules?.maxDexBonus === null ? "—" : rules?.maxDexBonus,
        armorCheckPenalty: rules?.armorCheckPenalty,
        arcaneSpellFailure: rules?.arcaneSpellFailurePercent !== undefined ? `${rules.arcaneSpellFailurePercent}%` : undefined,
        speed:
          rules?.speed30 !== undefined || rules?.speed20 !== undefined
            ? `30→${rules.speed30 ?? "—"}, 20→${rules.speed20 ?? "—"}`
            : undefined,
        weight: item.rules?.weightLb !== undefined ? `${item.rules.weightLb} lb.` : undefined,
        notes: item.equipped ? "Equipped" : undefined,
      };
    });
}

function gearRows(runtime: SheetProjectorRuntime): Dnd35GearEntry[] {
  return runtime.equipment
    .filter((item) => item.itemType !== "weapon" && item.itemType !== "armor" && !item.rules?.weapon && !item.rules?.armor)
    .map((item) => ({
      name: item.name,
      quantity: item.quantity,
      weight: item.rules?.weightLb !== undefined ? `${item.rules.weightLb} lb.` : undefined,
    }));
}

export function projectDnd35CharacterSheet(
  state: Dnd35CharacterState,
  runtime: SheetProjectorRuntime,
): Dnd35CharacterSheetData {
  const level = characterLevel(state);
  const race = getCoreRace(state.race.raceId);
  const abilities = effectivePermanentAbilities(state);
  const classLevelTotals = classTotals(state.levels);
  const baseSaves = multiclassBaseSaves(state.levels);
  const bab = multiclassBaseAttack(state.levels);
  const size = permanentSize(state);
  const sizeMod = sizeModifiers(size);
  const armor = armorSnapshot(runtime);
  const capacity = carryingCapacity(abilities.str, size);
  const load = loadCategory(carriedWeight(runtime), capacity);
  const loadAcp = loadArmorCheckPenalty(load);
  const acp = Math.min(0, armor.armorCheckPenalty + loadAcp);
  const maxDexValues = [armor.maxDex, loadMaxDex(load)].filter((value): value is number => typeof value === "number");
  const effectiveMaxDex = maxDexValues.length ? Math.min(...maxDexValues) : null;
  const dexMod = abilityModifier(abilities.dex);
  const dexToAc = effectiveMaxDex === null ? dexMod : Math.min(dexMod, effectiveMaxDex);

  const deflection = modifierTotal(runtime, "ac", ["deflection"]);
  const dodge = modifierTotal(runtime, "ac", ["dodge"]);
  const naturalArmor = modifierTotal(runtime, "ac", ["natural_armor"]);
  const otherAc = modifierTotal(runtime, "ac", ["circumstance", "insight", "luck", "morale", "profane", "racial", "sacred", "size", "untyped", "penalty"]);

  const totalAc = 10 + armor.armorBonus + armor.shieldBonus + dexToAc + sizeMod.attackAndAc + naturalArmor + deflection + dodge + otherAc;
  const touchAc = 10 + dexToAc + sizeMod.attackAndAc + deflection + dodge + otherAc;
  const flatFootedAc = 10 + armor.armorBonus + armor.shieldBonus + sizeMod.attackAndAc + naturalArmor + deflection + otherAc;

  const ranks = aggregateSkillRanks(state);
  const skillIds = new Set(CORE_SKILLS.map((skill) => skill.id));
  Object.keys(ranks).forEach((skillId) => skillIds.add(skillId));
  const skills: Dnd35SkillEntry[] = [...skillIds].map((skillId) => {
    const definition = getSkillDefinition(skillId);
    const ability = definition?.ability ?? null;
    const abilityMod = ability ? abilityModifier(abilities[ability]) : undefined;
    const rankValue = ranks[skillId] ?? 0;
    const classSkill = Object.keys(classLevelTotals).some((classId) => {
      const cls = getCoreClass(classId);
      if (!cls) return false;
      const family = skillId.split(":")[0];
      return cls.classSkills.includes(skillId) || cls.classSkills.includes(family);
    });
    const misc =
      staticRacialSkillBonus(state, skillId) +
      (skillId === "hide" ? sizeMod.hide : 0) +
      modifierTotal(runtime, `skill:${skillId}`);
    const penalty = armorCheckPenaltyForSkill(skillId, acp);

    return {
      name: definition?.displayName ?? skillId,
      ability: ability ?? "none",
      classSkill,
      trainedOnly: definition?.trainedOnly ?? false,
      ranks: rankValue,
      abilityModifier: abilityMod,
      miscModifier: misc,
      armorCheckPenalty: penalty,
      total: skillId === "speak-language" ? undefined : rankValue + (abilityMod ?? 0) + misc + penalty,
      notes: `Max ranks ${maxSkillRanks(level, classSkill)}`,
    };
  });

  const classIds = Object.keys(classLevelTotals);
  const proficiencies = mergedClassProficiencies(classIds);
  const racialAllSaveBonus = staticRacialAllSaveBonus(state);
  const saveAbility = { fortitude: "con", reflex: "dex", will: "wis" } as const;
  const maxHp = state.levels.reduce(
    (total, record) => total + Math.max(1, record.hitPointRoll + abilityModifier(abilities.con)),
    0,
  );

  return {
    version: 1,
    system: "D&D 3.5e",
    identity: {
      playerName: runtime.playerName,
      characterName: runtime.characterName,
      classes: Object.entries(classLevelTotals).map(([classId, total]) => ({
        className: getCoreClass(classId)?.displayName ?? classId,
        level: total,
      })),
      race: race?.displayName ?? state.race.raceId,
      alignment: state.persistentChoices.alignment,
      deity: state.persistentChoices.deity,
      size: size[0].toUpperCase() + size.slice(1),
      ...runtime.physical,
      experiencePoints: state.experiencePoints,
      nextLevelExperience: nextLevelExperience(level),
    },
    abilities: Object.fromEntries(
      Object.entries(abilities).map(([ability, score]) => [ability, { score }]),
    ) as any,
    hitPoints: {
      current: runtime.currentHp,
      maximum: maxHp,
      temporary: runtime.tempHp,
      nonlethalDamage: runtime.nonlethalDamage,
      hitDice: Object.entries(classLevelTotals)
        .map(([classId, total]) => `${total}d${getCoreClass(classId)?.hitDie ?? "?"}`)
        .join(" + "),
      woundsOrNotes: runtime.status && runtime.status !== "alive" ? runtime.status : undefined,
    },
    movement: {
      land: derivedLandSpeed(state, {
        armorCategory: armor.category,
        loadCategory: load,
        unarmored: armor.category === "none",
      }),
      ...runtime.movement,
    },
    combat: {
      armorClass: {
        total: totalAc,
        touch: touchAc,
        flatFooted: flatFootedAc,
        armorBonus: armor.armorBonus,
        shieldBonus: armor.shieldBonus,
        dexModifier: dexToAc,
        sizeModifier: sizeMod.attackAndAc,
        naturalArmor,
        deflectionBonus: deflection,
        dodgeBonus: dodge,
        miscModifier: otherAc,
      },
      initiative: {
        total: dexMod + modifierTotal(runtime, "initiative"),
        dexModifier: dexMod,
        miscModifier: modifierTotal(runtime, "initiative"),
      },
      baseAttackBonus: bab,
      grapple: {
        total: bab + abilityModifier(abilities.str) + sizeMod.grapple + modifierTotal(runtime, "grapple"),
        baseAttackBonus: bab,
        strengthModifier: abilityModifier(abilities.str),
        sizeModifier: sizeMod.grapple,
        miscModifier: modifierTotal(runtime, "grapple"),
      },
      spellResistance: runtime.spellResistance,
      damageReduction: runtime.damageReduction,
      attacksPerRound: iterativeBaseAttacks(bab).length,
      weapons: weaponRows(state, runtime),
    },
    saves: Object.fromEntries(
      (Object.keys(saveAbility) as Array<keyof typeof saveAbility>).map((save) => {
        const abilityMod = abilityModifier(abilities[saveAbility[save]]);
        const misc = racialAllSaveBonus + modifierTotal(runtime, `save:${save}`) + modifierTotal(runtime, "save:any");
        return [save, {
          total: baseSaves[save] + abilityMod + misc,
          baseSave: baseSaves[save],
          abilityModifier: abilityMod,
          miscModifier: misc,
        }];
      }),
    ) as any,
    skills,
    feats: state.levels.flatMap((record) => record.featChoices.map((feat) => ({
      name: feat.name,
      source: `${feat.source.replaceAll("_", " ")} at character level ${record.characterLevel}`,
    }))),
    specialAbilities: [...racialFeatureEntries(state), ...classFeatureEntries(state)],
    proficiencies: {
      weapons: [...new Set([
        ...proficiencies.weapons,
        ...(race?.weaponProficiencies ?? []),
        ...(race?.weaponFamiliarities.map((name) => `${name} (racial familiarity)`) ?? []),
      ])],
      armor: proficiencies.armor,
      shields: proficiencies.shields,
      other: proficiencies.restrictions,
    },
    languages: [...new Set([...(race?.automaticLanguages ?? []), ...state.persistentChoices.languages])],
    equipment: {
      armor: armorRows(runtime),
      gear: gearRows(runtime),
      wealth: runtime.currencies.map((currency) => ({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        amount: currency.amount,
      })),
      encumbrance: {
        currentWeight: `${carriedWeight(runtime)} lb.`,
        lightLoad: `${capacity.light} lb.`,
        mediumLoad: `${capacity.medium} lb.`,
        heavyLoad: `${capacity.heavy} lb.`,
        liftOffGround: `${capacity.liftOffGround} lb.`,
        pushOrDrag: `${capacity.pushOrDrag} lb.`,
      },
    },
    spellcasting: state.spellcasting.map((block) => {
      const cls = getCoreClass(block.classId);
      const castingAbility = cls?.spellcasting?.ability;
      return {
        casterClass: cls?.displayName ?? block.classId,
        casterLevel: block.casterLevel,
        castingAbility,
        domains: block.domains,
        specialization: block.specialization,
        prohibitedSchools: block.prohibitedSchools,
        spellResistance: runtime.spellResistance,
        spellsPerDay: block.slots,
        spells: [
          ...(block.known ?? []),
          ...(block.prepared ?? []),
          ...(block.spellbook ?? []),
        ].map((spell) => ({
          name: spell.name,
          level: spell.spellLevel,
          prepared: spell.kind === "prepared" ? 1 : undefined,
          known: spell.kind === "known" || spell.kind === "spellbook" ? true : undefined,
        })),
      };
    }),
    notes: {
      traits: runtime.traits,
      backstory: runtime.backstory,
      alliesAndContacts: runtime.notes?.alliesAndContacts,
      enemies: runtime.notes?.enemies,
      campaignNotes: runtime.notes?.campaignNotes,
    },
  };
}
