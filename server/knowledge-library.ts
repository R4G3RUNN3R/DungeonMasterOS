import type { Character } from "@shared/schema";
import {
  DND35_CORE_FEATS,
  DND35_SPELLS,
  getDnd35Feat,
  getDnd35Grimoire,
  getDnd35HolyTome,
  getDnd35Spell,
  listDnd35FeatsByCategory,
  searchDnd35Rules,
} from "@shared/dnd35-rules/catalogue";
import { DND35_SOURCE_MANIFEST } from "@shared/dnd35-rules/sources";
import { evaluateDnd35FeatPrerequisites, type Dnd35FeatQualificationState } from "@shared/dnd35-rules/feat-prerequisites";
import type { Dnd35FeatDefinition, Dnd35SpellDefinition, Dnd35SpellTradition } from "@shared/dnd35-rules/types";
import { resolveCharacterModifier } from "./character-stats";
import { searchItemDefinitions } from "./compendium";

export type KnowledgeVolumeKind = "items" | "bestiary" | "grimoire" | "holy-tome" | "feat-codex";
export type KnowledgeVolumeStatus = "available" | "foundation" | "cataloguing";

export type KnowledgeVolume = {
  id: string;
  kind: KnowledgeVolumeKind;
  title: string;
  subtitle: string;
  href?: string;
  status: KnowledgeVolumeStatus;
  recordCount?: number;
  note?: string;
};

export type KnowledgeShelf = {
  id: string;
  ruleset: string;
  editionLabel: string;
  title: string;
  active: boolean;
  volumes: KnowledgeVolume[];
};

const sourceById = new Map(DND35_SOURCE_MANIFEST.map((source) => [source.id, source]));

export function getKnowledgeShelves(): KnowledgeShelf[] {
  const arcaneCount = getDnd35Grimoire().length;
  const divineCount = getDnd35HolyTome().length;
  return [
    {
      id: "dnd35",
      ruleset: "dnd35e",
      editionLabel: "3.5 Edition",
      title: "Dungeons & Dragons 3.5",
      active: true,
      volumes: [
        { id: "dnd35-items", kind: "items", title: "The Item Compendium", subtitle: "Arms, armour, equipment, potions and wondrous things", status: "cataloguing", note: "The existing live item catalogue is 5e data. A true 3.5 item corpus must be ingested before this volume can become authoritative." },
        { id: "dnd35-bestiary", kind: "bestiary", title: "The Bestiary", subtitle: "Creatures, monsters and encounter records", status: "cataloguing", note: "The 3.5 bestiary corpus is still being prepared." },
        { id: "dnd35-grimoire", kind: "grimoire", title: "The Grimoire", subtitle: "Arcane spells and their exact workings", href: "/compendiums/dnd35/grimoire", status: "foundation", recordCount: arcaneCount, note: "The canonical schema is live; the full SRD spell corpus is still being expanded." },
        { id: "dnd35-holy-tome", kind: "holy-tome", title: "The Holy Tome", subtitle: "Divine spells, domains and sacred workings", href: "/compendiums/dnd35/holy-tome", status: "foundation", recordCount: divineCount, note: "The canonical schema is live; the full SRD spell corpus is still being expanded." },
        { id: "dnd35-feat-codex", kind: "feat-codex", title: "The Feat Codex", subtitle: "Feats, prerequisites, metamagic and item creation", href: "/compendiums/dnd35/feat-codex", status: "foundation", recordCount: DND35_CORE_FEATS.length, note: "Core magic-facing feats are executable; the full PHB feat corpus is still being expanded." },
      ],
    },
    {
      id: "dnd5e",
      ruleset: "dnd5e",
      editionLabel: "5th Edition",
      title: "Dungeons & Dragons 5th Edition",
      active: true,
      volumes: [
        { id: "dnd5e-items", kind: "items", title: "The Item Compendium", subtitle: "The existing SRD and DungeonMasterOS item catalogue", href: "/compendium", status: "available" },
      ],
    },
  ];
}

export function publicDnd35Spell(spell: Dnd35SpellDefinition) {
  return {
    ...spell,
    sources: spell.sources.map((source) => ({
      ...source,
      title: sourceById.get(source.sourceId)?.title ?? source.sourceId,
      abbreviation: sourceById.get(source.sourceId)?.abbreviation ?? source.sourceId,
      privateReference: source.sourceKind === "official-book-private-reference",
      url: source.sourceKind === "official-book-private-reference" ? undefined : source.url,
    })),
  };
}

export function publicDnd35Feat(feat: Dnd35FeatDefinition) {
  return {
    ...feat,
    sources: feat.sources.map((source) => ({
      ...source,
      title: sourceById.get(source.sourceId)?.title ?? source.sourceId,
      abbreviation: sourceById.get(source.sourceId)?.abbreviation ?? source.sourceId,
      privateReference: source.sourceKind === "official-book-private-reference",
      url: source.sourceKind === "official-book-private-reference" ? undefined : source.url,
    })),
  };
}

export function listPublicDnd35Spells(params: { tradition?: Dnd35SpellTradition; query?: string }) {
  const base = params.query?.trim()
    ? searchDnd35Rules(params.query).spells
    : params.tradition === "arcane"
      ? getDnd35Grimoire()
      : params.tradition === "divine"
        ? getDnd35HolyTome()
        : DND35_SPELLS;
  return base.map(publicDnd35Spell);
}

export function listPublicDnd35Feats(params: { category?: Dnd35FeatDefinition["categories"][number]; query?: string }) {
  const base = params.query?.trim()
    ? searchDnd35Rules(params.query).feats
    : params.category
      ? listDnd35FeatsByCategory(params.category)
      : DND35_CORE_FEATS;
  return base.map(publicDnd35Feat);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function slug(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function parseClassLevels(charClass: string, totalLevel: number): Array<{ classId: string; level: number }> {
  const parts = charClass.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return [{ classId: slug(charClass), level: totalLevel }];
  const parsed = parts.map((part) => {
    const match = part.match(/^(.*?)(\d+)$/);
    return { classId: slug(match ? match[1] : part), level: match ? Number(match[2]) : null as number | null };
  });
  const fixed = parsed.reduce((sum, entry) => sum + (entry.level ?? 0), 0);
  const open = parsed.filter((entry) => entry.level == null).length;
  let remaining = Math.max(0, totalLevel - fixed);
  return parsed.map((entry) => {
    if (entry.level != null) return { classId: entry.classId, level: entry.level };
    const level = open > 0 ? Math.ceil(remaining / open) : 0;
    remaining -= level;
    return { classId: entry.classId, level };
  });
}

export type StoredDnd35FeatSelection = {
  featId: string;
  name: string;
  parameters?: Record<string, string | string[]>;
  sourceIds: string[];
  rulesSummary: string;
  modifiers: Dnd35FeatDefinition["modifiers"];
  metamagic?: Dnd35FeatDefinition["metamagic"];
  selectedAtLevel?: number;
};

export function readStoredDnd35FeatSelections(character: Pick<Character, "characterData">): StoredDnd35FeatSelection[] {
  const data = parseJson<any>(character.characterData, {});
  return Array.isArray(data.dnd35Feats) ? data.dnd35Feats.filter((entry: any) => entry && typeof entry.featId === "string") : [];
}

function recordedSpellcastingState(character: Pick<Character, "characterData">) {
  const data = parseJson<any>(character.characterData, {});
  const blocks = Array.isArray(data?.dnd35Sheet?.spellcasting) ? data.dnd35Sheet.spellcasting : [];
  const casterLevels: Partial<Record<Dnd35SpellTradition, number>> = {};
  const maximumSpellLevel: Partial<Record<Dnd35SpellTradition, 0|1|2|3|4|5|6|7|8|9>> = {};
  const arcane = new Set(["wizard", "sorcerer", "bard"]);
  const divine = new Set(["cleric", "druid", "paladin", "ranger"]);
  for (const block of blocks) {
    const classId = slug(String(block?.casterClass || ""));
    const tradition: Dnd35SpellTradition = arcane.has(classId) ? "arcane" : divine.has(classId) ? "divine" : "other";
    const casterLevel = Number(block?.casterLevel || 0);
    casterLevels[tradition] = Math.max(casterLevels[tradition] ?? 0, Number.isFinite(casterLevel) ? casterLevel : 0);
    let maxLevel = 0;
    const pools = [block?.spellsPerDay, block?.bonusSpells];
    for (const pool of pools) {
      if (!pool || typeof pool !== "object") continue;
      for (const [key, value] of Object.entries(pool)) {
        const level = Number(key);
        const amount = Number(value);
        if (Number.isFinite(level) && level >= 0 && level <= 9 && Number.isFinite(amount) && amount > 0) maxLevel = Math.max(maxLevel, level);
      }
    }
    if (Array.isArray(block?.spells)) {
      for (const spell of block.spells) {
        const level = Number(spell?.level);
        if (Number.isFinite(level) && level >= 0 && level <= 9) maxLevel = Math.max(maxLevel, level);
      }
    }
    maximumSpellLevel[tradition] = Math.max(maximumSpellLevel[tradition] ?? 0, maxLevel) as 0|1|2|3|4|5|6|7|8|9;
  }
  return { casterLevels, maximumSpellLevel };
}

export function buildDnd35FeatQualificationState(character: Character, storage: any): Dnd35FeatQualificationState {
  const classEntries = parseClassLevels(character.charClass || "", character.level);
  const classLevels = Object.fromEntries(classEntries.map((entry) => [entry.classId, entry.level]));
  const storedFeats = readStoredDnd35FeatSelections(character);
  const data = parseJson<any>(character.characterData, {});
  const sheet = data?.dnd35Sheet ?? {};
  const skillRanks: Record<string, number> = {};
  if (Array.isArray(sheet.skills)) {
    for (const skill of sheet.skills) {
      const name = slug(String(skill?.name || ""));
      const ranks = Number(skill?.ranks);
      if (name && Number.isFinite(ranks)) skillRanks[name] = ranks;
    }
  }
  const proficiencies = parseJson<string[]>(character.proficiencies, []);
  for (const proficiency of proficiencies) {
    const id = slug(proficiency);
    if (id && skillRanks[id] == null) skillRanks[id] = character.level + 3;
  }
  const specialFlags = Array.isArray(sheet.specialAbilities)
    ? sheet.specialAbilities.map((ability: any) => slug(String(ability?.name || ""))).filter(Boolean)
    : [];
  const casting = recordedSpellcastingState(character);
  const attack = resolveCharacterModifier(character.id, "str", { skill: "attack", ruleset: "dnd35e" }, storage);
  return {
    abilities: { str: character.str, dex: character.dex, con: character.con, int: character.int, wis: character.wis, cha: character.cha },
    baseAttackBonus: attack.proficiencyBonus,
    characterLevel: character.level,
    classLevels,
    skillRanks,
    featIds: storedFeats.map((feat) => feat.featId),
    featSelections: storedFeats.flatMap((feat) => {
      const values = Object.values(feat.parameters ?? {}).flatMap((value) => Array.isArray(value) ? value : [value]);
      return values.length ? values.map((parameter) => ({ featId: feat.featId, parameter: String(parameter) })) : [{ featId: feat.featId }];
    }),
    casterLevels: casting.casterLevels,
    maximumSpellLevel: casting.maximumSpellLevel,
    races: [slug(character.race || "")].filter(Boolean),
    alignment: normalize(String(sheet?.identity?.alignment || "")),
    proficiencies: proficiencies.map(slug),
    specialFlags,
  };
}

export function evaluateCharacterForDnd35Feat(character: Character, feat: Dnd35FeatDefinition, storage: any) {
  const state = buildDnd35FeatQualificationState(character, storage);
  const result = evaluateDnd35FeatPrerequisites(feat.prerequisites, state);
  const stored = readStoredDnd35FeatSelections(character);
  const alreadySelected = stored.some((selection) => selection.featId === feat.id);
  if (alreadySelected && !feat.repeatable) {
    return { qualified: false, failures: [`${feat.name} is already selected and is not repeatable.`] };
  }
  return result;
}

export function recordDnd35FeatSelection(
  character: Character,
  feat: Dnd35FeatDefinition,
  parameters: Record<string, string | string[]> | undefined,
  selectedAtLevel: number,
  storage: any,
) {
  const data = parseJson<any>(character.characterData, {});
  if (!Array.isArray(data.dnd35Feats)) data.dnd35Feats = [];
  const record: StoredDnd35FeatSelection = {
    featId: feat.id,
    name: feat.name,
    parameters,
    sourceIds: feat.sources.map((source) => source.sourceId),
    rulesSummary: feat.rulesSummary,
    modifiers: feat.modifiers,
    metamagic: feat.metamagic,
    selectedAtLevel,
  };
  data.dnd35Feats.push(record);
  if (!data.dnd35Sheet || typeof data.dnd35Sheet !== "object") data.dnd35Sheet = { version: 1, system: "D&D 3.5e" };
  if (!Array.isArray(data.dnd35Sheet.feats)) data.dnd35Sheet.feats = [];
  if (!data.dnd35Sheet.feats.some((entry: any) => normalize(String(entry?.name || "")) === normalize(feat.name))) {
    data.dnd35Sheet.feats.push({ name: feat.name, source: feat.sources.map((source) => source.sourceId).join(", "), description: feat.rulesSummary });
  }
  storage.updateCharacter(character.id, { characterData: JSON.stringify(data) } as any);
  return record;
}

function includesRuleName(text: string, name: string) {
  return normalize(text).includes(normalize(name));
}

export function buildCanonicalRulesContext(ruleset: string, actionText: string, characters: Character[] = []) {
  if (ruleset !== "dnd35e") return "";
  const spells = DND35_SPELLS.filter((spell) => includesRuleName(actionText, spell.name));
  const feats = DND35_CORE_FEATS.filter((feat) => includesRuleName(actionText, feat.name));
  const activeFeatRecords = characters.flatMap(readStoredDnd35FeatSelections);
  if (!spells.length && !feats.length && !activeFeatRecords.length) return "";

  const spellLines = spells.map((spell) => {
    const access = spell.classAccess.map((entry) => `${entry.classId} ${entry.level}`).join(", ");
    const components = spell.components.filter((component) => component.required).map((component) => component.kind).join(", ") || "none";
    return `SPELL ${spell.name}: ${spell.rulesSummary} | School ${spell.school}${spell.subschool ? ` (${spell.subschool})` : ""} | Lists ${access} | Components ${components} | Range ${spell.range.kind} | Save ${spell.savingThrow.type}${spell.savingThrow.outcome ? ` ${spell.savingThrow.outcome}` : ""} | SR ${String(spell.spellResistance.applies)}.`;
  });
  const featLines = feats.map((feat) => `FEAT ${feat.name}: ${feat.rulesSummary}${feat.prerequisiteSummary ? ` | Prerequisite: ${feat.prerequisiteSummary}` : ""}.`);
  const characterFeatLines = activeFeatRecords.map((feat) => `CHARACTER FEAT ${feat.name}: ${feat.rulesSummary}`);

  return [
    "CANONICAL RULES LIBRARY — D&D 3.5e SOURCE OF TRUTH:",
    "When a record below applies, its mechanics override model memory and freeform narration. Do not silently substitute a different-edition rule.",
    ...spellLines,
    ...featLines,
    ...characterFeatLines,
  ].join("\n");
}

export function resolveCanonicalItemDefinition(ruleset: string, name: string) {
  const needle = normalize(name);
  if (!needle) return undefined;
  return searchItemDefinitions(name, 20).find((row: any) => normalize(String(row.name || "")) === needle && String(row.ruleset || "") === ruleset);
}

export { getDnd35Feat, getDnd35Spell };
