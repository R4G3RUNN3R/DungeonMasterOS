import type { Character, Item } from "@shared/schema";
import { DND35_CORE_FEATS } from "@shared/dnd35-rules/catalogue";
import { resolveDnd35CastPreflight } from "@shared/dnd35-rules/cast-preflight-guarded";
import type { Dnd35CastResolution, Dnd35SpellDefinition, Dnd35SpellLevel, Dnd35SpellcastingMode, Dnd35SpellcastingState } from "@shared/dnd35-rules/types";
import { listCanonicalDnd35Spells, readStoredDnd35FeatSelections } from "./knowledge-library";
import { getDnd35Item } from "./dnd35-item-library";

const ARCANE = new Set(["wizard", "sorcerer", "bard"]);
const DIVINE = new Set(["cleric", "druid", "paladin", "ranger"]);

function normalize(value: string) { return value.trim().toLowerCase(); }
function slug(value: string) { return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function parseJson<T>(value: unknown, fallback: T): T { if (typeof value !== "string") return fallback; try { return JSON.parse(value) as T; } catch { return fallback; } }
function numberFromPool(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }
  return 0;
}
function traditionForClass(classId: string): "arcane" | "divine" | "other" { return ARCANE.has(classId) ? "arcane" : DIVINE.has(classId) ? "divine" : "other"; }
function castingAbilityForClass(classId: string): "int" | "wis" | "cha" { if (classId === "wizard") return "int"; if (DIVINE.has(classId)) return "wis"; return "cha"; }
function modeForClass(classId: string): Dnd35SpellcastingMode | undefined {
  if (classId === "wizard") return "prepared_spellbook";
  if (DIVINE.has(classId)) return "prepared_divine";
  if (classId === "sorcerer" || classId === "bard") return "spontaneous_known";
  return undefined;
}

export function findDnd35CastSpell(actionText: string): Dnd35SpellDefinition | undefined {
  if (!/\b(cast|casts|casting|invoke|invokes|invoking)\b/i.test(actionText)) return undefined;
  const normalizedAction = normalize(actionText);
  const matches = listCanonicalDnd35Spells().filter((spell) => normalizedAction.includes(normalize(spell.name)));
  matches.sort((a, b) => b.name.length - a.name.length);
  if (!matches.length) return undefined;
  if (matches.length > 1 && matches[0].name.length === matches[1].name.length) return undefined;
  return matches[0];
}

function parseSpellcastingBlocks(character: Character) {
  const data = parseJson<any>(character.characterData, {});
  return Array.isArray(data?.dnd35Sheet?.spellcasting) ? data.dnd35Sheet.spellcasting : [];
}

function findCastingBlock(character: Character, spell: Dnd35SpellDefinition) {
  const blocks = parseSpellcastingBlocks(character);
  return blocks.find((block: any) => {
    const classId = slug(String(block?.casterClass || ""));
    return spell.classAccess.some((access) => access.classId === classId);
  });
}

function poolForBlock(block: any, expendedKey: string) {
  const result: Dnd35SpellcastingState["spellSlots"] = {};
  for (let level = 0; level <= 9; level++) {
    const maximum = numberFromPool(block?.spellsPerDay?.[String(level)] ?? block?.spellsPerDay?.[level]);
    if (!maximum) continue;
    const explicit = Number(block?.[expendedKey]?.[String(level)] ?? block?.[expendedKey]?.[level]);
    const fallback = Array.isArray(block?.spells)
      ? block.spells.filter((entry: any) => Number(entry?.slotLevel ?? entry?.level) === level).reduce((sum: number, entry: any) => sum + Math.max(0, Number(entry?.used || 0)), 0)
      : 0;
    result[level as Dnd35SpellLevel] = { maximum, expended: Number.isFinite(explicit) ? Math.max(0, explicit) : fallback };
  }
  return result;
}

function bonusPoolForBlock(block: any) {
  const result: Dnd35SpellcastingState["bonusSpellSlots"] = {};
  for (let level = 0; level <= 9; level++) {
    const maximum = numberFromPool(block?.bonusSpells?.[String(level)] ?? block?.bonusSpells?.[level]);
    if (maximum) result[level as Dnd35SpellLevel] = { maximum, expended: 0 };
  }
  return result;
}

function buildCastingState(character: Character, spell: Dnd35SpellDefinition): Dnd35SpellcastingState | undefined {
  const block = findCastingBlock(character, spell);
  if (!block) return undefined;
  const classId = slug(String(block.casterClass || ""));
  const mode = modeForClass(classId);
  if (!mode) return undefined;
  const ability = (block.castingAbility === "int" || block.castingAbility === "wis" || block.castingAbility === "cha") ? block.castingAbility : castingAbilityForClass(classId);
  const spells = Array.isArray(block.spells) ? block.spells : [];
  const spellIds = spells.map((entry: any) => slug(String(entry?.name || ""))).filter(Boolean);
  const preparedSpells = spells.filter((entry: any) => Number(entry?.prepared || 0) > 0).map((entry: any) => ({
    spellId: slug(String(entry.name || "")),
    slotLevel: Number(entry.slotLevel ?? entry.level ?? 0) as Dnd35SpellLevel,
    metamagicFeatIds: Array.isArray(entry.metamagicFeatIds) ? entry.metamagicFeatIds : undefined,
    preparedCount: Math.max(0, Number(entry.prepared || 0)),
    expendedCount: Math.max(0, Number(entry.used || 0)),
  }));
  const knownSpellIds = spells.filter((entry: any) => entry.known !== false).map((entry: any) => slug(String(entry.name || ""))).filter(Boolean);
  return {
    classId,
    classLevel: Number(block.classLevel || character.level),
    casterLevel: Number(block.casterLevel || character.level),
    tradition: traditionForClass(classId),
    castingAbility: ability,
    castingAbilityScore: Number((character as any)[ability] || 0),
    mode,
    spellbookSpellIds: classId === "wizard" ? spellIds : undefined,
    knownSpellIds,
    preparedSpells,
    spellSlots: poolForBlock(block, "spellSlotsExpended"),
    bonusSpellSlots: bonusPoolForBlock(block),
    domains: Array.isArray(block.domains) ? block.domains.map(slug) : undefined,
    specialization: block.specialization,
    prohibitedSchools: Array.isArray(block.prohibitedSchools) ? block.prohibitedSchools.map((school: string) => normalize(school)) : undefined,
  };
}

function itemWords(item: Item) {
  return [item.name, item.trueName, item.description, item.trueDescription].filter(Boolean).join(" ").toLowerCase();
}

function componentAccess(character: Character, items: Item[]) {
  const feats = readStoredDnd35FeatSelections(character);
  const names = items.map(itemWords);
  const tags = items.flatMap((item) => [slug(item.name), slug(item.trueName || "")]).filter(Boolean);
  return {
    hasSpellComponentPouch: names.some((text) => text.includes("spell component pouch") || text.includes("component pouch")),
    canEschewOrdinaryMaterials: feats.some((feat) => feat.featId === "eschew-materials"),
    hasDivineFocus: names.some((text) => text.includes("holy symbol") || text.includes("divine focus") || text.includes("sacred focus")),
    itemTags: tags,
    availableXp: character.xp,
  };
}

function canonicalDnd35ItemFromInventory(item: Item) {
  const source = String(item.source || "");
  const prefix = "knowledge:dnd35:";
  if (!source.startsWith(prefix)) return undefined;
  return getDnd35Item(source.slice(prefix.length));
}

function arcaneFailurePercent(character: Character, items: Item[]) {
  const equipped = items.filter((item) => item.equipped);
  const countedNames = new Set<string>();
  let total = 0;

  for (const item of equipped) {
    const canonical = canonicalDnd35ItemFromInventory(item);
    const asf = canonical?.armor?.arcaneSpellFailurePercent;
    if (typeof asf === "number") {
      total += asf;
      countedNames.add(normalize(item.name));
    }
  }

  const data = parseJson<any>(character.characterData, {});
  const armor = Array.isArray(data?.dnd35Sheet?.equipment?.armor) ? data.dnd35Sheet.equipment.armor : [];
  const equippedNames = new Set(equipped.map((item) => normalize(item.name)));
  for (const entry of armor) {
    const name = normalize(String(entry?.name || ""));
    if (!equippedNames.has(name) || countedNames.has(name)) continue;
    const match = String(entry?.arcaneSpellFailure || "").match(/(\d+)/);
    if (match) total += Number(match[1]);
  }
  return total;
}

function requestedMetamagic(character: Character, actionText: string) {
  const owned = new Set(readStoredDnd35FeatSelections(character).map((feat) => feat.featId));
  return DND35_CORE_FEATS.filter((feat) => feat.categories.includes("metamagic") && owned.has(feat.id) && normalize(actionText).includes(normalize(feat.name))).map((feat) => feat.id);
}

function applyCharacterFeatAdjustments(character: Character, spell: Dnd35SpellDefinition, resolution: Dnd35CastResolution) {
  const feats = readStoredDnd35FeatSelections(character);
  let dcBonus = 0;
  for (const selection of feats) {
    const school = selection.parameters?.school;
    if ((selection.featId === "spell-focus" || selection.featId === "greater-spell-focus") && typeof school === "string" && normalize(school) === normalize(spell.school)) dcBonus += 1;
    if (selection.featId === "spell-penetration") resolution.decisions.push({ code: "SPELL_PENETRATION", passed: true, blocking: false, message: "+2 on caster-level checks to overcome spell resistance." });
    if (selection.featId === "greater-spell-penetration") resolution.decisions.push({ code: "GREATER_SPELL_PENETRATION", passed: true, blocking: false, message: "An additional +2 on caster-level checks to overcome spell resistance." });
  }
  if (dcBonus && typeof resolution.saveDc === "number") {
    resolution.saveDc += dcBonus;
    resolution.decisions.push({ code: "SPELL_FOCUS_DC", passed: true, blocking: false, message: `Applicable Spell Focus feats add +${dcBonus} to the save DC.` });
  }
}

export type CharacterSpellPreflight = {
  spell: Dnd35SpellDefinition;
  resolution?: Dnd35CastResolution;
  unavailableReason?: string;
  metamagicFeatIds: string[];
};

export function resolveCharacterDnd35SpellCast(character: Character, spell: Dnd35SpellDefinition, actionText: string, items: Item[], effects: Array<{ name: string; description: string }>): CharacterSpellPreflight {
  const casting = buildCastingState(character, spell);
  const metamagicFeatIds = requestedMetamagic(character, actionText);
  if (!casting) return { spell, unavailableReason: `No supported structured D&D 3.5 spellcasting block for a class that can cast ${spell.name}.`, metamagicFeatIds };
  const effectText = effects.map((effect) => `${effect.name} ${effect.description}`).join(" ").toLowerCase();
  const featIds = readStoredDnd35FeatSelections(character).map((feat) => feat.featId);
  const resolution = resolveDnd35CastPreflight({
    spell,
    casting,
    characterFeatIds: featIds,
    metamagicFeats: DND35_CORE_FEATS.filter((feat) => feat.categories.includes("metamagic")),
    request: {
      spellId: spell.id,
      castingClassId: casting.classId,
      metamagicFeatIds,
      environment: {
        canSpeak: !/\b(silenced|mute|cannot speak|unable to speak)\b/.test(effectText),
        hasSomaticFreedom: !/\b(paralyzed|pinned|hands bound|unable to move)\b/.test(effectText),
        antimagic: /\bantimagic\b/.test(effectText),
        lineOfEffect: true,
        lineOfSight: true,
        arcaneSpellFailurePercent: arcaneFailurePercent(character, items),
      },
    },
    componentAccess: componentAccess(character, items),
  });
  applyCharacterFeatAdjustments(character, spell, resolution);
  return { spell, resolution, metamagicFeatIds };
}

export function consumeCharacterDnd35SpellUse(character: Character, spell: Dnd35SpellDefinition, resolution: Dnd35CastResolution, storage: any) {
  if (!resolution.legal || resolution.slotLevel === undefined) return;
  const data = parseJson<any>(character.characterData, {});
  const blocks = Array.isArray(data?.dnd35Sheet?.spellcasting) ? data.dnd35Sheet.spellcasting : [];
  const block = blocks.find((candidate: any) => {
    const classId = slug(String(candidate?.casterClass || ""));
    return spell.classAccess.some((access) => access.classId === classId);
  });
  if (!block) return;
  if (!block.spellSlotsExpended || typeof block.spellSlotsExpended !== "object") block.spellSlotsExpended = {};
  const key = String(resolution.slotLevel);
  block.spellSlotsExpended[key] = Math.max(0, Number(block.spellSlotsExpended[key] || 0)) + 1;
  const classId = slug(String(block.casterClass || ""));
  const mode = modeForClass(classId);
  if (mode === "prepared_spellbook" || mode === "prepared_divine") {
    const entry = Array.isArray(block.spells) ? block.spells.find((candidate: any) => slug(String(candidate?.name || "")) === spell.id && Number(candidate?.slotLevel ?? candidate?.level) === resolution.slotLevel && Number(candidate?.prepared || 0) > Number(candidate?.used || 0)) : undefined;
    if (entry) entry.used = Math.max(0, Number(entry.used || 0)) + 1;
  }
  storage.updateCharacter(character.id, { characterData: JSON.stringify(data) } as any);
}
