// Reference implementation only.

import type { CoreClassId } from "./domain";

export type ClassProficiencies = {
  weapons: string[];
  armor: string[];
  shields: string[];
  restrictions?: string[];
};

export const CORE_CLASS_PROFICIENCIES: Record<CoreClassId, ClassProficiencies> = {
  barbarian: {
    weapons: ["all simple weapons", "all martial weapons"],
    armor: ["light armor", "medium armor"],
    shields: ["shields except tower shields"],
  },
  bard: {
    weapons: ["all simple weapons", "longsword", "rapier", "sap", "short sword", "shortbow", "whip"],
    armor: ["light armor"],
    shields: ["shields except tower shields"],
    restrictions: ["Bard spells avoid normal arcane spell failure in light armor; shields still impose arcane spell failure when applicable."],
  },
  cleric: {
    weapons: ["all simple weapons"],
    armor: ["light armor", "medium armor", "heavy armor"],
    shields: ["shields except tower shields"],
  },
  druid: {
    weapons: ["club", "dagger", "dart", "quarterstaff", "scimitar", "sickle", "shortspear", "sling", "spear", "natural attacks of wild-shape forms"],
    armor: ["light armor", "medium armor"],
    shields: ["shields except tower shields"],
    restrictions: ["Core druid armor must satisfy the class's nonmetal restriction; shields must be wooden unless a specific rule permits otherwise."],
  },
  fighter: {
    weapons: ["all simple weapons", "all martial weapons"],
    armor: ["light armor", "medium armor", "heavy armor"],
    shields: ["all shields including tower shields"],
  },
  monk: {
    weapons: ["club", "light crossbow", "heavy crossbow", "dagger", "handaxe", "javelin", "kama", "nunchaku", "quarterstaff", "sai", "shuriken", "siangham", "sling"],
    armor: [],
    shields: [],
    restrictions: ["Several monk class features require being unarmored and unencumbered."],
  },
  paladin: {
    weapons: ["all simple weapons", "all martial weapons"],
    armor: ["light armor", "medium armor", "heavy armor"],
    shields: ["shields except tower shields"],
  },
  ranger: {
    weapons: ["all simple weapons", "all martial weapons"],
    armor: ["light armor"],
    shields: ["shields except tower shields"],
  },
  rogue: {
    weapons: ["all simple weapons", "hand crossbow", "rapier", "sap", "shortbow", "short sword"],
    armor: ["light armor"],
    shields: [],
  },
  sorcerer: {
    weapons: ["all simple weapons"],
    armor: [],
    shields: [],
  },
  wizard: {
    weapons: ["club", "dagger", "heavy crossbow", "light crossbow", "quarterstaff"],
    armor: [],
    shields: [],
  },
};

export function mergedClassProficiencies(classIds: string[]): ClassProficiencies {
  const weapons = new Set<string>();
  const armor = new Set<string>();
  const shields = new Set<string>();
  const restrictions = new Set<string>();

  for (const id of classIds) {
    const entry = CORE_CLASS_PROFICIENCIES[id as CoreClassId];
    if (!entry) continue;
    entry.weapons.forEach((value) => weapons.add(value));
    entry.armor.forEach((value) => armor.add(value));
    entry.shields.forEach((value) => shields.add(value));
    entry.restrictions?.forEach((value) => restrictions.add(value));
  }

  return {
    weapons: [...weapons],
    armor: [...armor],
    shields: [...shields],
    restrictions: [...restrictions],
  };
}
