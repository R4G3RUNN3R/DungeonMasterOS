import { DND35_CORE_ITEM_CREATION_FEATS } from "./feats/core-item-creation";
import { DND35_CORE_METAMAGIC_FEATS } from "./feats/core-metamagic";
import { DND35_CORE_SPELLCASTING_FEATS } from "./feats/core-spellcasting";
import { DND35_CORE_SRD_SAMPLE_SPELLS } from "./spells/core-srd-samples";
import type { Dnd35FeatDefinition, Dnd35SpellDefinition, Dnd35SpellTradition } from "./types";

export const DND35_CORE_FEATS: Dnd35FeatDefinition[] = [
  ...DND35_CORE_METAMAGIC_FEATS,
  ...DND35_CORE_ITEM_CREATION_FEATS,
  ...DND35_CORE_SPELLCASTING_FEATS,
];

export const DND35_SPELLS: Dnd35SpellDefinition[] = [...DND35_CORE_SRD_SAMPLE_SPELLS];

const normalize = (value: string) => value.trim().toLocaleLowerCase();

const spellById = new Map(DND35_SPELLS.map((spell) => [spell.id, spell]));
const spellByName = new Map(DND35_SPELLS.map((spell) => [normalize(spell.name), spell]));
const featById = new Map(DND35_CORE_FEATS.map((feat) => [feat.id, feat]));
const featByName = new Map(DND35_CORE_FEATS.map((feat) => [normalize(feat.name), feat]));

export const getDnd35Spell = (idOrName: string) => spellById.get(idOrName) ?? spellByName.get(normalize(idOrName));
export const getDnd35Feat = (idOrName: string) => featById.get(idOrName) ?? featByName.get(normalize(idOrName));

export function listDnd35SpellsForClass(classId: string) {
  return DND35_SPELLS
    .flatMap((spell) =>
      spell.classAccess
        .filter((access) => access.classId === classId)
        .map((access) => ({ spell, level: access.level, tradition: access.tradition })),
    )
    .sort((a, b) => a.level - b.level || a.spell.name.localeCompare(b.spell.name));
}

export function listDnd35SpellsForDomain(domainId: string) {
  return DND35_SPELLS
    .flatMap((spell) =>
      (spell.domainAccess ?? [])
        .filter((access) => access.domainId === domainId)
        .map((access) => ({ spell, level: access.level })),
    )
    .sort((a, b) => a.level - b.level || a.spell.name.localeCompare(b.spell.name));
}

export function listDnd35SpellsByTradition(tradition: Dnd35SpellTradition) {
  return DND35_SPELLS.filter((spell) => spell.classAccess.some((access) => access.tradition === tradition));
}

/** Arcane-facing view over the shared canonical spell records. */
export const getDnd35Grimoire = () => listDnd35SpellsByTradition("arcane");

/** Divine-facing view over the same canonical spell records, avoiding duplicated spell facts. */
export const getDnd35HolyTome = () => listDnd35SpellsByTradition("divine");

export function listDnd35FeatsByCategory(category: Dnd35FeatDefinition["categories"][number]) {
  return DND35_CORE_FEATS.filter((feat) => feat.categories.includes(category)).sort((a, b) => a.name.localeCompare(b.name));
}

export function searchDnd35Rules(query: string) {
  const needle = normalize(query);
  if (!needle) return { spells: [], feats: [] };
  return {
    spells: DND35_SPELLS.filter((spell) =>
      [spell.id, spell.name, spell.school, ...spell.tags, spell.rulesSummary].some((value) => normalize(value).includes(needle)),
    ),
    feats: DND35_CORE_FEATS.filter((feat) =>
      [feat.id, feat.name, ...feat.categories, ...feat.tags, feat.rulesSummary].some((value) => normalize(value).includes(needle)),
    ),
  };
}
