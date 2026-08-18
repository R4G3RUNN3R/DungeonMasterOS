// server/mechanics-resolver.ts
//
// Wires the pure dice engine, character stat resolution, and tag parsing
// together into the request -> roll -> narrate flow described in the design
// doc. This module is the only place that calls resolveCharacterModifier +
// resolveD20 in response to a [CHECK] tag from the DM's first AI call.

import { resolveD20, type Rng } from "./dice-engine";
import { resolveCharacterModifier, type Ability } from "./character-stats";
import { extractCheckTag } from "./mechanics-tags";
import { dnd35RecordedSkillRanks, getDnd35Skill } from "@shared/dnd35-skills";

export interface RollDisplayData {
  rollType: "check";
  statUsed: string;
  diceResult: number;
  total: number;
  targetValue: number;
  outcome: "success" | "failure";
  isCritical: boolean;
  isFumble: boolean;
}

interface CharacterLike {
  id: number;
  name?: string;
  level: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  proficiencies: string;
  charClass?: string;
  characterData?: string;
}

interface StorageLike {
  getCharacterByName(campaignId: number, name: string): CharacterLike | undefined;
  createRollLogEntry(entry: any): any;
  getActiveEffectsByCharacter?(characterId: number): Array<{ statMods: string }>;
  getItemsByCharacter?(characterId: number): Array<{ equipped: boolean; statMods: string }>;
}

export interface ResolveCheckParams {
  campaignId: number;
  rawResponse: string;
  storage: StorageLike;
  rng: Rng;
  narrate: (prompt: string) => Promise<string>;
  combatStyle?: string;
  ruleset?: string;
}

export type ResolveCheckResult = { cleanContent: string; rollData: RollDisplayData | null };

function buildNarratePrompt(statUsed: string, roll: ReturnType<typeof resolveD20>, dc: number): string {
  const label = roll.outcome === "success" ? "SUCCESS" : "FAILURE";
  return `${statUsed} check: rolled ${roll.diceResult} + modifier = ${roll.total} vs DC ${dc} → ${label}. Narrate this outcome in 2-4 sentences, following the established style rules. Do not restate the numbers.`;
}

function fallbackNarration(outcome: "success" | "failure"): string {
  return outcome === "success"
    ? "The attempt lands cleanly, the moment resolving in your favor."
    : "The attempt falls short — this particular effort doesn't pay off, at least not yet.";
}

function buildUntrainedNarratePrompt(characterName: string, skillName: string) {
  return `${characterName} attempted ${skillName}, but under D&D 3.5e this is a trained-only skill and the character has 0 recorded ranks. No d20 roll is made. Narrate briefly that the character lacks the trained technique or knowledge to complete this specific skilled attempt. Do not invent a roll or numeric result.`;
}

function dnd35SkillRankModifier(character: CharacterLike, skillName: string) {
  const definition = getDnd35Skill(skillName);
  if (!definition || !definition.ability) return null;
  const ranks = dnd35RecordedSkillRanks(character.characterData || "{}", skillName);
  return {
    definition,
    ranks,
    effectiveRanks: Math.floor(ranks),
  };
}

export async function resolveCheckTag(params: ResolveCheckParams): Promise<ResolveCheckResult | null> {
  const tag = extractCheckTag(params.rawResponse);
  if (!tag) return null;

  const character = params.storage.getCharacterByName(params.campaignId, tag.character);
  if (!character) return null;

  const dnd35Skill =
    params.ruleset === "dnd35e" && tag.skill && tag.skill !== "attack" && !tag.isSave
      ? dnd35SkillRankModifier(character, tag.skill)
      : null;

  if (dnd35Skill?.definition.trainedOnly && dnd35Skill.ranks < 1) {
    let cleanContent: string;
    try {
      cleanContent = await params.narrate(buildUntrainedNarratePrompt(character.name || tag.character, dnd35Skill.definition.name));
    } catch {
      cleanContent = `${tag.character} does not have the training required to attempt ${dnd35Skill.definition.name} in this way.`;
    }
    return { cleanContent, rollData: null };
  }

  const modifierStorage = {
    getCharacter: (_id: number) => character,
    getActiveEffectsByCharacter: (characterId: number) =>
      params.storage.getActiveEffectsByCharacter?.(characterId) ?? [],
    getItemsByCharacter: (characterId: number) =>
      params.storage.getItemsByCharacter?.(characterId) ?? [],
  };

  const requestedAbility = (dnd35Skill?.definition.ability || tag.ability || "str") as Ability;
  const resolved = resolveCharacterModifier(
    character.id,
    requestedAbility,
    { skill: tag.skill, isSave: tag.isSave, combatStyle: params.combatStyle, ruleset: params.ruleset },
    modifierStorage,
  );

  if (dnd35Skill) {
    resolved.total = resolved.total - resolved.proficiencyBonus + dnd35Skill.effectiveRanks;
    resolved.proficiencyBonus = dnd35Skill.effectiveRanks;
    resolved.statUsed = `${dnd35Skill.definition.ability}.${dnd35Skill.definition.id}`;
  }

  const roll = resolveD20({
    rng: params.rng,
    modifier: resolved.total,
    target: tag.dc,
    kind: tag.isSave ? "save" : "check",
  });

  params.storage.createRollLogEntry({
    campaignId: params.campaignId,
    encounterId: null,
    characterId: character.id,
    participantId: null,
    rollType: tag.isSave ? "save" : "check",
    statUsed: resolved.statUsed,
    baseModifier: resolved.baseModifier,
    effectModifier: resolved.effectModifier,
    proficiencyBonus: resolved.proficiencyBonus,
    diceResult: roll.diceResult,
    total: roll.total,
    targetValue: tag.dc,
    isCritical: roll.isCritical,
    isFumble: roll.isFumble,
    outcome: roll.outcome,
    turnKey: null,
  });

  const outcome = roll.outcome as "success" | "failure";

  let cleanContent: string;
  try {
    cleanContent = await params.narrate(buildNarratePrompt(resolved.statUsed, roll, tag.dc));
  } catch {
    cleanContent = fallbackNarration(outcome);
  }

  return {
    cleanContent,
    rollData: {
      rollType: "check",
      statUsed: resolved.statUsed,
      diceResult: roll.diceResult,
      total: roll.total,
      targetValue: tag.dc,
      outcome,
      isCritical: roll.isCritical,
      isFumble: roll.isFumble,
    },
  };
}
