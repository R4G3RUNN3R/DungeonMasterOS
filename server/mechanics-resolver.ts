// server/mechanics-resolver.ts
//
// Wires the pure dice engine, character stat resolution, and tag parsing
// together into the request -> roll -> narrate flow described in the design
// doc. This module is the only place that calls resolveCharacterModifier +
// resolveD20 in response to a [CHECK] tag from the DM's first AI call.

import { resolveD20, type Rng } from "./dice-engine";
import { resolveCharacterModifier, type Ability } from "./character-stats";
import { extractCheckTag } from "./mechanics-tags";

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
  level: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  proficiencies: string;
  charClass?: string;
}

interface StorageLike {
  getCharacterByName(campaignId: number, name: string): CharacterLike | undefined;
  createRollLogEntry(entry: any): any;
  // Optional: the real `storage` singleton implements these (used to apply
  // active-effect and equipped-item modifiers). Not required by the test's
  // minimal fake storage — when absent we simply resolve with none applied.
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

function buildNarratePrompt(statUsed: string, roll: ReturnType<typeof resolveD20>, dc: number): string {
  const label = roll.outcome === "success" ? "SUCCESS" : "FAILURE";
  return `${statUsed} check: rolled ${roll.diceResult} + modifier = ${roll.total} vs DC ${dc} → ${label}. Narrate this outcome in 2-4 sentences, following the established style rules. Do not restate the numbers.`;
}

function fallbackNarration(outcome: "success" | "failure"): string {
  return outcome === "success"
    ? "The attempt lands cleanly, the moment resolving in your favor."
    : "The attempt falls short — this particular effort doesn't pay off, at least not yet.";
}

export async function resolveCheckTag(
  params: ResolveCheckParams,
): Promise<{ cleanContent: string; rollData: RollDisplayData } | null> {
  const tag = extractCheckTag(params.rawResponse);
  if (!tag) return null;

  const character = params.storage.getCharacterByName(params.campaignId, tag.character);
  if (!character) return null;

  // resolveCharacterModifier (Task 3) expects a storage with getCharacter()/
  // getActiveEffectsByCharacter(). We've already fetched the character by name
  // above, so adapt rather than requiring the caller's storage to separately
  // support a by-id lookup — this keeps the minimal test fake (which only
  // implements getCharacterByName) sufficient, and is exactly equivalent for
  // the real storage singleton since it's the same DB row either way.
  const modifierStorage = {
    getCharacter: (_id: number) => character,
    getActiveEffectsByCharacter: (characterId: number) =>
      params.storage.getActiveEffectsByCharacter?.(characterId) ?? [],
    getItemsByCharacter: (characterId: number) =>
      params.storage.getItemsByCharacter?.(characterId) ?? [],
  };

  const resolved = resolveCharacterModifier(
    character.id,
    (tag.ability || "str") as Ability,
    { skill: tag.skill, isSave: tag.isSave, combatStyle: params.combatStyle, ruleset: params.ruleset },
    modifierStorage,
  );

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
