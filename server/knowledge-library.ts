import type { Character } from "@shared/schema";
import {
  DND35_CORE_FEATS as DND35_CURATED_FEATS,
  DND35_SPELLS as DND35_CURATED_SPELLS,
  listDnd35FeatsByCategory as listStaticDnd35FeatsByCategory,
} from "@shared/dnd35-rules/catalogue";
import { DND35_SOURCE_MANIFEST } from "@shared/dnd35-rules/sources";
import { evaluateDnd35FeatPrerequisites, type Dnd35FeatQualificationState } from "@shared/dnd35-rules/feat-prerequisites";
import type { Dnd35FeatDefinition, Dnd35SpellDefinition, Dnd35SpellTradition } from "@shared/dnd35-rules/types";
import { resolveCharacterModifier } from "./character-stats";
import { searchItemDefinitions } from "./compendium";
import {
  DND35_SRD_SOURCE_REVISION,
  loadDnd35SrdSpellCorpus,
  type Dnd35ImportedSpell,
} from "./dnd35-srd-spell-importer";
import {
  loadDnd35SrdFeatCorpus,
  type Dnd35ImportedFeat,
} from "./dnd35-srd-feat-importer";

export type KnowledgeVolumeKind = "items" | "bestiary" | "grimoire" | "holy-tome" | "feat-codex";
export type KnowledgeVolumeStatus = "available" | "foundation" | "cataloguing";
export type Dnd35SpellCorpusStatus = "foundation" | "srd-complete" | "srd-fallback";
export type Dnd35FeatCorpusStatus = "foundation" | "srd-complete" | "srd-fallback";

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

export type Dnd35KnowledgeStatus = {
  spellCorpusStatus: Dnd35SpellCorpusStatus;
  featCorpusStatus: Dnd35FeatCorpusStatus;
  totalSpells: number;
  arcaneSpells: number;
  divineSpells: number;
  totalFeats: number;
  executableFeats: number;
  sourceRevision: string;
  spellErrors: string[];
  featErrors: string[];
  errors: string[];
};

const sourceById = new Map(DND35_SOURCE_MANIFEST.map((source) => [source.id, source]));

let runtimeDnd35Spells: Dnd35SpellDefinition[] = [...DND35_CURATED_SPELLS];
let runtimeSpellById = new Map(runtimeDnd35Spells.map((spell) => [spell.id, spell]));
let runtimeSpellByName = new Map(runtimeDnd35Spells.map((spell) => [spell.name.trim().toLowerCase(), spell]));
let runtimeDnd35Feats: Dnd35FeatDefinition[] = [...DND35_CURATED_FEATS];
let runtimeFeatById = new Map(runtimeDnd35Feats.map((feat) => [feat.id, feat]));
let runtimeFeatByName = new Map(runtimeDnd35Feats.map((feat) => [feat.name.trim().toLowerCase(), feat]));
let spellCorpusStatus: Dnd35SpellCorpusStatus = "foundation";
let featCorpusStatus: Dnd35FeatCorpusStatus = "foundation";
let spellCorpusErrors: string[] = [];
let featCorpusErrors: string[] = [];

function replaceRuntimeSpells(spells: Dnd35SpellDefinition[]) {
  runtimeDnd35Spells = [...spells].sort((a, b) => a.name.localeCompare(b.name));
  runtimeSpellById = new Map(runtimeDnd35Spells.map((spell) => [spell.id, spell]));
  runtimeSpellByName = new Map(runtimeDnd35Spells.map((spell) => [spell.name.trim().toLowerCase(), spell]));
}

function replaceRuntimeFeats(feats: Dnd35FeatDefinition[]) {
  runtimeDnd35Feats = [...feats].sort((a, b) => a.name.localeCompare(b.name));
  runtimeFeatById = new Map(runtimeDnd35Feats.map((feat) => [feat.id, feat]));
  runtimeFeatByName = new Map(runtimeDnd35Feats.map((feat) => [feat.name.trim().toLowerCase(), feat]));
}

function mergeImportedWithCurated(imported: Dnd35ImportedSpell[]) {
  const byId = new Map<string, Dnd35SpellDefinition>(imported.map((spell) => [spell.id, spell]));
  for (const curated of DND35_CURATED_SPELLS) {
    const sourceRecord = byId.get(curated.id) as Dnd35ImportedSpell | undefined;
    byId.set(curated.id, {
      ...(sourceRecord ?? {}),
      ...curated,
      ...(sourceRecord?.rulesText ? { rulesText: sourceRecord.rulesText } : {}),
      ...(sourceRecord?.importedFrom ? { importedFrom: sourceRecord.importedFrom } : {}),
      executionStatus: "executable",
    } as Dnd35SpellDefinition);
  }
  return Array.from(byId.values());
}

function mergeImportedFeatsWithCurated(imported: Dnd35ImportedFeat[]) {
  const byId = new Map<string, Dnd35FeatDefinition>(imported.map((feat) => [feat.id, feat]));
  for (const curated of DND35_CURATED_FEATS) {
    const sourceRecord = byId.get(curated.id) as Dnd35ImportedFeat | undefined;
    byId.set(curated.id, {
      ...(sourceRecord ?? {}),
      ...curated,
      ...(sourceRecord?.rulesText ? { rulesText: sourceRecord.rulesText } : {}),
      ...(sourceRecord?.benefitText ? { benefitText: sourceRecord.benefitText } : {}),
      ...(sourceRecord?.normalText ? { normalText: sourceRecord.normalText } : {}),
      ...(sourceRecord?.specialText ? { specialText: sourceRecord.specialText } : {}),
      ...(sourceRecord?.importedFrom ? { importedFrom: sourceRecord.importedFrom } : {}),
      executionStatus: "executable",
    } as Dnd35FeatDefinition);
  }
  return Array.from(byId.values());
}

export async function initializeDnd35KnowledgeLibrary() {
  const [spells, feats] = await Promise.all([
    loadDnd35SrdSpellCorpus(),
    loadDnd35SrdFeatCorpus(),
  ]);

  if (spells.ok) {
    replaceRuntimeSpells(mergeImportedWithCurated(spells.spells));
    spellCorpusStatus = "srd-complete";
    spellCorpusErrors = [];
  } else {
    replaceRuntimeSpells(DND35_CURATED_SPELLS);
    spellCorpusStatus = "srd-fallback";
    spellCorpusErrors = spells.errors.length ? spells.errors : ["Pinned SRD spell import failed without a reported source error."];
  }

  if (feats.ok) {
    replaceRuntimeFeats(mergeImportedFeatsWithCurated(feats.feats));
    featCorpusStatus = "srd-complete";
    featCorpusErrors = [];
  } else {
    replaceRuntimeFeats(DND35_CURATED_FEATS);
    featCorpusStatus = "srd-fallback";
    featCorpusErrors = feats.errors.length ? feats.errors : ["Pinned SRD feat import failed without a reported source error."];
  }

  return getDnd35KnowledgeStatus();
}

export function listCanonicalDnd35Spells() {
  return runtimeDnd35Spells;
}

export function listCanonicalDnd35Feats() {
  return runtimeDnd35Feats;
}

export function getDnd35Spell(idOrName: string) {
  return runtimeSpellById.get(idOrName) ?? runtimeSpellByName.get(idOrName.trim().toLowerCase());
}

export function getDnd35Feat(idOrName: string) {
  return runtimeFeatById.get(idOrName) ?? runtimeFeatByName.get(idOrName.trim().toLowerCase());
}

export function getDnd35Grimoire() {
  return runtimeDnd35Spells.filter((spell) => spell.classAccess.some((access) => access.tradition === "arcane"));
}

export function getDnd35HolyTome() {
  return runtimeDnd35Spells.filter((spell) => spell.classAccess.some((access) => access.tradition === "divine"));
}

export function getDnd35KnowledgeStatus(): Dnd35KnowledgeStatus {
  const executableFeats = runtimeDnd35Feats.filter((feat) => (feat as any).executionStatus !== "reference").length;
  return {
    spellCorpusStatus,
    featCorpusStatus,
    totalSpells: runtimeDnd35Spells.length,
    arcaneSpells: getDnd35Grimoire().length,
    divineSpells: getDnd35HolyTome().length,
    totalFeats: runtimeDnd35Feats.length,
    executableFeats,
    sourceRevision: DND35_SRD_SOURCE_REVISION,
    spellErrors: [...spellCorpusErrors],
    featErrors: [...featCorpusErrors],
    errors: [...spellCorpusErrors, ...featCorpusErrors],
  };
}

function searchRuntimeSpells(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return runtimeDnd35Spells.filter((spell) => [
    spell.id,
    spell.name,
    spell.school,
    ...spell.tags,
    spell.rulesSummary,
    String((spell as any).rulesText ?? ""),
  ].some((value) => String(value).toLowerCase().includes(needle)));
}

function searchRuntimeFeats(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return runtimeDnd35Feats.filter((feat) => [
    feat.id,
    feat.name,
    ...feat.categories,
    ...feat.tags,
    feat.rulesSummary,
    feat.prerequisiteSummary ?? "",
    String((feat as any).rulesText ?? ""),
  ].some((value) => String(value).toLowerCase().includes(needle)));
}

function listRuntimeDnd35FeatsByCategory(category: Dnd35FeatDefinition["categories"][number]) {
  if (featCorpusStatus === "foundation" || featCorpusStatus === "srd-fallback") {
    return listStaticDnd35FeatsByCategory(category);
  }
  return runtimeDnd35Feats.filter((feat) => feat.categories.includes(category)).sort((a, b) => a.name.localeCompare(b.name));
}

export function getKnowledgeShelves(): KnowledgeShelf[] {
  const status = getDnd35KnowledgeStatus();
  const spellVolumeStatus: KnowledgeVolumeStatus = status.spellCorpusStatus === "srd-complete" ? "available" : "foundation";
  const featVolumeStatus: KnowledgeVolumeStatus = status.featCorpusStatus === "srd-complete" ? "available" : "foundation";
  const spellNote = status.spellCorpusStatus === "srd-complete"
    ? `Pinned Revised 3.5 SRD spell corpus loaded (${status.totalSpells} canonical spell records). Hand-hardened executable records override conservative imported effect placeholders.`
    : status.spellCorpusStatus === "srd-fallback"
      ? "The pinned SRD spell corpus could not be loaded at startup. DungeonMasterOS is using its curated canonical spell foundation rather than publishing a partial import."
      : "The canonical schema is live; the pinned SRD spell corpus has not been initialized yet.";
  const featNote = status.featCorpusStatus === "srd-complete"
    ? `Pinned Revised 3.5 SRD feat corpus loaded (${status.totalFeats} readable canonical entries; ${status.executableFeats} currently wired for mechanical selection). Reference-only feats remain visible but cannot be selected until their modifiers are encoded.`
    : status.featCorpusStatus === "srd-fallback"
      ? "The pinned SRD feat corpus could not be loaded at startup. DungeonMasterOS is using its curated executable feat foundation rather than publishing a partial Codex."
      : "Core magic-facing feats are executable; the pinned SRD feat corpus has not been initialized yet.";

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
        { id: "dnd35-grimoire", kind: "grimoire", title: "The Grimoire", subtitle: "Arcane spells and their exact workings", href: "/compendiums/dnd35/grimoire", status: spellVolumeStatus, recordCount: status.arcaneSpells, note: spellNote },
        { id: "dnd35-holy-tome", kind: "holy-tome", title: "The Holy Tome", subtitle: "Divine spells, domains and sacred workings", href: "/compendiums/dnd35/holy-tome", status: spellVolumeStatus, recordCount: status.divineSpells, note: spellNote },
        { id: "dnd35-feat-codex", kind: "feat-codex", title: "The Feat Codex", subtitle: "Feats, prerequisites, metamagic and item creation", href: "/compendiums/dnd35/feat-codex", status: featVolumeStatus, recordCount: status.totalFeats, note: featNote },
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
    ? searchRuntimeSpells(params.query)
    : params.tradition === "arcane"
      ? getDnd35Grimoire()
      : params.tradition === "divine"
        ? getDnd35HolyTome()
        : runtimeDnd35Spells;
  return base.map(publicDnd35Spell);
}

export function listPublicDnd35Feats(params: { category?: Dnd35FeatDefinition["categories"][number]; query?: string }) {
  const base = params.query?.trim()
    ? searchRuntimeFeats(params.query)
    : params.category
      ? listRuntimeDnd35FeatsByCategory(params.category)
      : runtimeDnd35Feats;
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
  if ((feat as any).executionStatus === "reference") {
    return {
      qualified: false,
      failures: [`${feat.name} is catalogued from the canonical SRD, but its character-sheet mechanics are not executable yet.`],
    };
  }
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
  const spells = runtimeDnd35Spells.filter((spell) => includesRuleName(actionText, spell.name));
  const feats = runtimeDnd35Feats.filter((feat) => includesRuleName(actionText, feat.name));
  const activeFeatRecords = characters.flatMap(readStoredDnd35FeatSelections);
  if (!spells.length && !feats.length && !activeFeatRecords.length) return "";

  const spellLines = spells.map((spell) => {
    const access = spell.classAccess.map((entry) => `${entry.classId} ${entry.level}`).join(", ");
    const components = spell.components.filter((component) => component.required).map((component) => component.kind).join(", ") || "none";
    const rulesText = String((spell as any).rulesText ?? "").replace(/\s+/g, " ").trim();
    const reference = rulesText ? ` | Canonical rule: ${rulesText.slice(0, 1200)}` : "";
    return `SPELL ${spell.name}: ${spell.rulesSummary} | School ${spell.school}${spell.subschool ? ` (${spell.subschool})` : ""} | Lists ${access} | Components ${components} | Range ${spell.range.kind} | Save ${spell.savingThrow.type}${spell.savingThrow.outcome ? ` ${spell.savingThrow.outcome}` : ""} | SR ${String(spell.spellResistance.applies)}${reference}.`;
  });
  const featLines = feats.map((feat) => {
    const rulesText = String((feat as any).rulesText ?? "").replace(/\s+/g, " ").trim();
    const reference = rulesText ? ` | Canonical rule: ${rulesText.slice(0, 1000)}` : "";
    return `FEAT ${feat.name}: ${feat.rulesSummary}${feat.prerequisiteSummary ? ` | Prerequisite: ${feat.prerequisiteSummary}` : ""}${reference}.`;
  });
  const characterFeatLines = activeFeatRecords.map((feat) => `CHARACTER FEAT ${feat.name}: ${feat.rulesSummary}`);

  return [
    "CANONICAL RULES LIBRARY — D&D 3.5e SOURCE OF TRUTH:",
    "When a record below applies, its mechanics override model memory and freeform narration. Do not silently substitute a different-edition rule.",
    "If a record is marked as reference/structured rather than executable, use its canonical text to narrate faithfully but do not invent persistent mechanical mutations that the server has not resolved.",
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
