// server/combat-engine.ts
//
// The server-authoritative combat state machine: encounter creation, and
// (added in Task 8) the turn-advancement loop. NPC stats are always clamped
// against the campaign's powerLevel before being persisted; PC stats are
// always read from the real characters table, never from the AI's tag.

import { clampNpcStats, breakInitiativeTies, resolveD20, resolveDamage, modifierFor, type Rng } from "./dice-engine";
import { resolveCharacterModifier, iterativeAttackBonuses } from "./character-stats";
import { extractCombatStartTag, extractAttackTag, extractSurrenderTag } from "./mechanics-tags";
import { xpAwardForDefeatedNpc } from "./leveling";
import type { Encounter } from "@shared/schema";

export interface EncounterParticipant {
  id: string;
  type: "character" | "npc";
  name: string;
  initiative: number;
  currentHp: number;
  maxHp: number;
  ac: number;
  attackBonus: number;
  // 3.5e iterative attacks: additional swings this turn beyond the first,
  // each at a lower bonus (BAB +11 -> primary attackBonus at +11, then
  // extraAttackBonuses [+6, +1]). Empty/undefined for 5e and NPCs, which
  // only ever make one attack per turn in DMOS's model.
  extraAttackBonuses?: number[];
  damageDice: string;
  isDefeated: boolean;
  fled: boolean;
  characterId?: number;
}

interface CharacterRow {
  id: number;
  name: string;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  ac: number;
  damageDice: string;
  attackAbility: string;
  charClass: string;
  level: number;
  hp: number;
  maxHp: number;
  proficiencies: string;
}

interface StorageLike {
  getCharactersByCampaign(campaignId: number): CharacterRow[];
  createEncounter(data: any): Encounter;
  createRollLogEntry(entry: any): any;
  getActiveEffectsByCharacter(characterId: number): Array<{ statMods: string }>;
  getItemsByCharacter?(characterId: number): Array<{ equipped: boolean; statMods: string; slot: string | null; name: string; weaponDamageDice?: string | null }>;
  getEncounter(id: number): Encounter | undefined;
  tickEffects(characterId: number): unknown[];
  createMessage(message: any): any;
  // Optional: only needed for victory-XP awarding. Left optional so existing
  // turn-loop test stubs (which don't care about XP) don't need to implement
  // them — awardVictoryXp no-ops when any of these is missing.
  getCampaign?(campaignId: number): { powerLevel: string } | undefined;
  getCharacter?(id: number): { xp: number } | undefined;
  updateCharacter?(id: number, updates: any): void;
}

export interface StartEncounterParams {
  campaignId: number;
  rawResponse: string;
  powerLevel: string;
  combatStyle?: string;
  ruleset?: string;
  storage: StorageLike;
  rng: Rng;
}

export async function startEncounter(params: StartEncounterParams): Promise<Encounter | null> {
  const tag = extractCombatStartTag(params.rawResponse);
  if (!tag) return null;

  const allCharacters = params.storage.getCharactersByCampaign(params.campaignId);
  const involvedCharacters = tag.participants
    ? allCharacters.filter((c) => tag.participants!.includes(c.name))
    : allCharacters;

  // resolveCharacterModifier (Task 3) needs a storage-like object exposing
  // getCharacter(id). We already have the full character rows in hand from
  // getCharactersByCampaign above, so we adapt them into a lookup here
  // instead of requiring a separate getCharacter method on StorageLike (and
  // avoid a redundant fetch per character).
  const characterById = new Map(allCharacters.map((c) => [c.id, c]));
  const statsStorage = {
    getCharacter: (id: number) => characterById.get(id),
    getActiveEffectsByCharacter: (id: number) => params.storage.getActiveEffectsByCharacter(id),
    getItemsByCharacter: (id: number) => params.storage.getItemsByCharacter?.(id) ?? [],
  };

  const pcParticipants: EncounterParticipant[] = involvedCharacters.map((c) => {
    const attackAbility = (["str", "dex", "int"].includes(c.attackAbility) ? c.attackAbility : "str") as "str" | "dex" | "int";
    const attackResolved = resolveCharacterModifier(c.id, attackAbility, { skill: "attack", combatStyle: params.combatStyle, ruleset: params.ruleset }, statsStorage);

    // 3.5e full attack: the BAB portion of the total (proficiencyBonus, in
    // dnd35e mode) determines the iterative sequence; everything else in
    // the total (ability mod, effects, cinematic bonus) applies unchanged
    // to every swing in that sequence.
    let attackBonus = attackResolved.total;
    let extraAttackBonuses: number[] | undefined;
    if (params.ruleset === "dnd35e") {
      const nonBabPortion = attackResolved.total - attackResolved.proficiencyBonus;
      const sequence = iterativeAttackBonuses(attackResolved.proficiencyBonus).map((bab) => nonBabPortion + bab);
      attackBonus = sequence[0];
      extraAttackBonuses = sequence.slice(1);
    }

    // Damage dice come from whatever's actually equipped in mainHand, not a
    // fixed column that never changes when a character swaps weapons. Falls
    // back to the character's base damageDice (unarmed/innate) when nothing's
    // equipped there or the equipped item didn't specify weapon dice.
    const items = params.storage.getItemsByCharacter?.(c.id) ?? [];
    const equippedWeapon = items.find((item: any) => item.equipped && item.slot === "mainHand" && item.weaponDamageDice);
    const damageDice = (equippedWeapon as any)?.weaponDamageDice || c.damageDice;

    return {
      id: `char-${c.id}`,
      type: "character",
      name: c.name,
      initiative: 0, // set below
      currentHp: c.hp,
      maxHp: c.maxHp,
      ac: c.ac,
      attackBonus,
      extraAttackBonuses,
      damageDice,
      isDefeated: c.hp <= 0,
      fled: false,
      characterId: c.id,
    };
  });

  const npcParticipants: EncounterParticipant[] = tag.npcs.map((npc, index) => {
    const clamped = clampNpcStats(npc, params.powerLevel);
    return {
      id: `npc-${index}-${npc.name.toLowerCase().replace(/\s+/g, "-")}`,
      type: "npc",
      name: npc.name,
      initiative: 0,
      currentHp: clamped.hp,
      maxHp: clamped.hp,
      ac: clamped.ac,
      attackBonus: clamped.attackBonus,
      damageDice: clamped.damageDice,
      isDefeated: false,
      fled: false,
    };
  });

  const encounter = params.storage.createEncounter({
    campaignId: params.campaignId,
    status: "active",
    round: 1,
    turnIndex: 0,
    participants: "[]", // placeholder, updated below once initiative is rolled
  });

  const allParticipants = [...pcParticipants, ...npcParticipants];
  const withInitiative = allParticipants.map((participant) => {
    const dexModifier =
      participant.type === "character"
        ? resolveCharacterModifier(participant.characterId!, "dex", { combatStyle: params.combatStyle, ruleset: params.ruleset }, statsStorage).total
        : modifierFor(10); // NPCs don't have a full ability block; initiative parity with an average DEX

    const roll = resolveD20({ rng: params.rng, modifier: dexModifier, target: 0, kind: "initiative" });

    params.storage.createRollLogEntry({
      campaignId: params.campaignId,
      encounterId: encounter.id,
      characterId: participant.characterId ?? null,
      participantId: participant.id,
      rollType: "initiative",
      statUsed: "dex",
      baseModifier: dexModifier,
      effectModifier: 0,
      proficiencyBonus: 0,
      diceResult: roll.diceResult,
      total: roll.total,
      targetValue: 0,
      isCritical: roll.isCritical,
      isFumble: roll.isFumble,
      outcome: roll.outcome,
      turnKey: "0:0",
    });

    return { ...participant, initiative: roll.total, dexModifier };
  });

  const ordered = breakInitiativeTies(withInitiative);
  const finalParticipants: EncounterParticipant[] = ordered.map(({ dexModifier, ...p }) => p);

  const updatedEncounter: Encounter = { ...encounter, participants: JSON.stringify(finalParticipants) };
  (params.storage as any).updateEncounter?.(encounter.id, { participants: JSON.stringify(finalParticipants) });

  return updatedEncounter;
}

export interface AdvanceTurnResult {
  encounter: Encounter;
  currentParticipant: EncounterParticipant | null;
  xpAwarded?: { total: number; perCharacter: number; characterIds: number[] };
}

// Splits a flat per-NPC XP award (scaled by campaign power level) evenly
// across the surviving party when an encounter ends in victory. A no-op
// whenever the caller's storage doesn't implement the character/campaign
// methods (e.g. turn-loop unit tests that don't exercise XP at all).
function awardVictoryXp(
  encounter: Encounter,
  participants: EncounterParticipant[],
  storage: StorageLike,
): AdvanceTurnResult["xpAwarded"] {
  if (!storage.getCampaign || !storage.getCharacter || !storage.updateCharacter) return undefined;

  const defeatedNpcCount = participants.filter((p) => p.type === "npc" && p.isDefeated).length;
  if (defeatedNpcCount === 0) return undefined;

  const livingPcs = participants.filter(
    (p): p is EncounterParticipant & { characterId: number } =>
      p.type === "character" && !p.isDefeated && !p.fled && typeof p.characterId === "number",
  );
  if (livingPcs.length === 0) return undefined;

  const campaign = storage.getCampaign(encounter.campaignId);
  const totalXp = defeatedNpcCount * xpAwardForDefeatedNpc(campaign?.powerLevel || "standard");
  const perCharacter = Math.max(1, Math.floor(totalXp / livingPcs.length));

  const characterIds: number[] = [];
  for (const pc of livingPcs) {
    const character = storage.getCharacter(pc.characterId);
    if (!character) continue;
    storage.updateCharacter(pc.characterId, { xp: (character.xp || 0) + perCharacter });
    characterIds.push(pc.characterId);
  }
  if (characterIds.length === 0) return undefined;

  return { total: perCharacter * characterIds.length, perCharacter, characterIds };
}

function checkDeterministicEnd(participants: EncounterParticipant[]): "victory" | "defeat" | "all_fled" | "aborted" | null {
  const livingNpcs = participants.filter((p) => p.type === "npc" && !p.isDefeated && !p.fled);
  const livingPcs = participants.filter((p) => p.type === "character" && !p.isDefeated && !p.fled);

  if (livingNpcs.length === 0 && livingPcs.length === 0) return "aborted";
  if (livingNpcs.length === 0) return "victory";
  if (livingPcs.length === 0) {
    // No living PCs remain, but that can happen two ways: they were all
    // defeated, or some/all simply fled. A defeated ally is treated as the
    // more severe state even if others also fled — only when EVERY missing
    // PC left purely by fleeing (none defeated) is this "all_fled".
    const anyPcDefeated = participants.some((p) => p.type === "character" && p.isDefeated);
    return anyPcDefeated ? "defeat" : "all_fled";
  }
  return null;
}

export function advanceToNextActionableTurn(
  encounterId: number,
  storage: StorageLike & { getEncounter(id: number): Encounter | undefined; tickEffects(characterId: number): unknown[] },
): AdvanceTurnResult {
  let encounter = storage.getEncounter(encounterId)!;
  if (encounter.status !== "active") {
    return { encounter, currentParticipant: null };
  }

  let participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  const endOutcome = checkDeterministicEnd(participants);
  if (endOutcome) {
    (storage as any).updateEncounter(encounterId, { status: "ended", outcome: endOutcome, endedAt: new Date().toISOString() });
    const xpAwarded = endOutcome === "victory" ? awardVictoryXp(encounter, participants, storage) : undefined;
    return { encounter: { ...encounter, status: "ended", outcome: endOutcome }, currentParticipant: null, xpAwarded };
  }

  let turnIndex = encounter.turnIndex;
  let round = encounter.round;
  let guard = 0;

  while (guard < participants.length * 2 + 2) {
    guard += 1;

    // Wrap (and tick effects) is checked at the TOP of the loop, before
    // indexing into participants. This lets turnIndex legitimately arrive
    // here already at or past participants.length (meaning "the last
    // participant's turn just finished, find the next one"), which is how
    // the turn-resolution callers (Task 9/10) hand off to this function.
    if (turnIndex >= participants.length) {
      turnIndex = 0;
      round += 1;
      for (const p of participants) {
        if (p.type === "character" && p.characterId) storage.tickEffects(p.characterId);
      }
    }

    const candidate = participants[turnIndex];

    if (!candidate.isDefeated && !candidate.fled) {
      (storage as any).updateEncounter(encounterId, { turnIndex, round });
      return {
        encounter: { ...encounter, turnIndex, round },
        currentParticipant: candidate,
      };
    }

    turnIndex += 1;

    const outcomeAfterSkip = checkDeterministicEnd(participants);
    if (outcomeAfterSkip) {
      (storage as any).updateEncounter(encounterId, { status: "ended", outcome: outcomeAfterSkip, endedAt: new Date().toISOString(), turnIndex, round });
      const xpAwarded = outcomeAfterSkip === "victory" ? awardVictoryXp(encounter, participants, storage) : undefined;
      return { encounter: { ...encounter, status: "ended", outcome: outcomeAfterSkip, turnIndex, round }, currentParticipant: null, xpAwarded };
    }
  }

  // Every participant defeated/fled but checkDeterministicEnd somehow didn't
  // catch it (defense-in-depth against an inconsistent snapshot) — abort
  // rather than looping forever.
  (storage as any).updateEncounter(encounterId, { status: "ended", outcome: "aborted", endedAt: new Date().toISOString() });
  return { encounter: { ...encounter, status: "ended", outcome: "aborted" }, currentParticipant: null };
}

export interface ResolveAttackParams {
  encounterId: number;
  rawResponse: string;
  storage: StorageLike & { getEncounter(id: number): Encounter | undefined; tickEffects(characterId: number): unknown[]; updateEncounter(id: number, updates: any): void };
  rng: Rng;
  narrate: (prompt: string) => Promise<string>;
}

export interface SingleAttackRoll {
  outcome: "hit" | "miss";
  isCritical: boolean;
  isFumble: boolean;
  diceResult: number;
  total: number;
  damageDealt: number;
}

export interface AttackResolution {
  outcome: "hit" | "miss"; // did at least one swing in the sequence connect
  isCritical: boolean; // did any swing crit
  isFumble: boolean; // did the primary (first) swing fumble
  attacker: string;
  target: string;
  damageDealt: number; // summed across every swing in the sequence
  attackRolls: SingleAttackRoll[]; // one entry per swing, in order
  narration: string;
  encounterEnded: boolean;
  xpAwarded?: { total: number; perCharacter: number; characterIds: number[] };
}

export async function resolveAttack(
  params: ResolveAttackParams,
): Promise<AttackResolution | { error: "no_tag" | "not_your_turn" | "invalid_target" | "encounter_not_active" }> {
  const tag = extractAttackTag(params.rawResponse);
  if (!tag) return { error: "no_tag" };

  const encounter = params.storage.getEncounter(params.encounterId)!;
  if (encounter.status !== "active") return { error: "encounter_not_active" };

  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  const currentTurnParticipant = participants[encounter.turnIndex];
  if (!currentTurnParticipant || currentTurnParticipant.name !== tag.attacker) {
    return { error: "not_your_turn" };
  }

  const target = participants.find((p) => p.name === tag.target);
  if (!target || target.isDefeated || target.fled) {
    return { error: "invalid_target" };
  }
  // Final-review issue #2: the server only ever advertises NPCs as valid
  // targets to the AI (buildCombatContext's validTargetNames), but never
  // enforced it here — an [ATTACK] naming another same-type participant
  // (a PC attacking a PC) resolved fully, with real damage against another
  // player's character. Reject same-type targeting for both directions: a
  // PC cannot target a PC, and (defense in depth, since resolveNpcTurn's own
  // target selection already only offers living PCs, so this is a no-op for
  // the legitimate NPC path) an NPC cannot target an NPC.
  if (target.type === currentTurnParticipant.type) {
    return { error: "invalid_target" };
  }

  return executeAttack({ encounterId: params.encounterId, attacker: currentTurnParticipant, target, storage: params.storage, rng: params.rng, narrate: params.narrate });
}

export async function executeAttack(params: {
  encounterId: number;
  attacker: EncounterParticipant;
  target: EncounterParticipant;
  storage: ResolveAttackParams["storage"];
  rng: Rng;
  narrate: (prompt: string) => Promise<string>;
}): Promise<AttackResolution> {
  const encounter = params.storage.getEncounter(params.encounterId)!;
  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  // A "full attack" sequence: the primary swing plus any 3.5e iterative
  // attacks (5e/NPCs never have extraAttackBonuses, so this is just [primary]
  // for them — identical behavior to before this feature existed). Stop
  // early if the target drops mid-sequence rather than keep hitting a
  // downed target.
  const sequence = [params.attacker.attackBonus, ...(params.attacker.extraAttackBonuses ?? [])];
  const attackRolls: SingleAttackRoll[] = [];
  let remainingTargetHp = params.target.currentHp;
  let totalDamageDealt = 0;

  for (const bonus of sequence) {
    if (remainingTargetHp <= 0) break;

    const toHit = resolveD20({ rng: params.rng, modifier: bonus, target: params.target.ac, kind: "attack" });
    let swingDamage = 0;
    if (toHit.outcome === "hit") {
      swingDamage = resolveDamage({ damageDice: params.attacker.damageDice, modifier: bonus, isCritical: toHit.isCritical, rng: params.rng });
    }
    remainingTargetHp = Math.max(0, remainingTargetHp - swingDamage);
    totalDamageDealt += swingDamage;

    attackRolls.push({
      outcome: toHit.outcome as "hit" | "miss",
      isCritical: toHit.isCritical,
      isFumble: toHit.isFumble,
      diceResult: toHit.diceResult,
      total: toHit.total,
      damageDealt: swingDamage,
    });

    (params.storage as any).createRollLogEntry({
      campaignId: (encounter as any).campaignId,
      encounterId: encounter.id,
      characterId: params.attacker.characterId ?? null,
      participantId: params.attacker.id,
      rollType: "attack",
      statUsed: "attack",
      baseModifier: bonus,
      effectModifier: 0,
      proficiencyBonus: 0,
      diceResult: toHit.diceResult,
      total: toHit.total,
      targetValue: params.target.ac,
      isCritical: toHit.isCritical,
      isFumble: toHit.isFumble,
      outcome: toHit.outcome,
      turnKey: `${encounter.round}:${encounter.turnIndex}`,
    });
  }

  const updatedParticipants = participants.map((p) => {
    if (p.id !== params.target.id) return p;
    const newHp = Math.max(0, p.currentHp - totalDamageDealt);
    return { ...p, currentHp: newHp, isDefeated: newHp === 0 };
  });

  params.storage.updateEncounter(params.encounterId, {
    participants: JSON.stringify(updatedParticipants),
    lastResolvedTurnKey: `${encounter.round}:${encounter.turnIndex}`,
    turnIndex: encounter.turnIndex + 1,
  });

  const anyHit = attackRolls.some((r) => r.outcome === "hit");
  const anyCritical = attackRolls.some((r) => r.isCritical);
  const primaryFumbled = attackRolls[0]?.isFumble ?? false;

  const narratePrompt =
    attackRolls.length === 1
      ? attackRolls[0].outcome === "hit"
        ? `${params.attacker.name} attacks ${params.target.name}: rolled ${attackRolls[0].diceResult} + ${sequence[0]} = ${attackRolls[0].total} vs AC ${params.target.ac} → HIT${attackRolls[0].isCritical ? " (CRITICAL)" : ""}, ${attackRolls[0].damageDealt} damage. Narrate this outcome in 2-4 sentences. Do not restate the numbers.`
        : `${params.attacker.name} attacks ${params.target.name}: rolled ${attackRolls[0].diceResult} + ${sequence[0]} = ${attackRolls[0].total} vs AC ${params.target.ac} → MISS${attackRolls[0].isFumble ? " (FUMBLE)" : ""}. Narrate this outcome in 2-4 sentences. Do not restate the numbers.`
      : `${params.attacker.name} makes a full attack against ${params.target.name} (${attackRolls.length} swings): ${attackRolls
          .map((r, i) => `swing ${i + 1} rolled ${r.diceResult} + ${sequence[i]} = ${r.total} vs AC ${params.target.ac} → ${r.outcome === "hit" ? `HIT${r.isCritical ? " (CRITICAL)" : ""}, ${r.damageDealt} damage` : `MISS${r.isFumble ? " (FUMBLE)" : ""}`}`)
          .join("; ")}. Total damage: ${totalDamageDealt}. Narrate this flurry of attacks as one continuous exchange in 2-4 sentences. Do not restate the numbers.`;

  let narration: string;
  try {
    narration = await params.narrate(narratePrompt);
  } catch {
    narration = anyHit
      ? `${params.attacker.name}'s attacks connect, landing solid blows against ${params.target.name}.`
      : `${params.attacker.name}'s attacks go wide, missing ${params.target.name} entirely.`;
  }

  const advanced = advanceToNextActionableTurn(params.encounterId, params.storage as any);

  return {
    outcome: (anyHit ? "hit" : "miss") as "hit" | "miss",
    isCritical: anyCritical,
    isFumble: primaryFumbled,
    attacker: params.attacker.name,
    target: params.target.name,
    damageDealt: totalDamageDealt,
    attackRolls,
    narration,
    encounterEnded: advanced.encounter.status === "ended",
    xpAwarded: advanced.xpAwarded,
  };
}

export interface SurrenderResult {
  applied: boolean;
  surrenderedNames: string[];
  message: any | null;
}

export function applyNpcSurrender(
  encounterId: number,
  rawResponse: string,
  storage: StorageLike & { getEncounter(id: number): Encounter | undefined; updateEncounter(id: number, updates: any): void; tickEffects(characterId: number): unknown[]; createMessage(message: any): any },
): SurrenderResult {
  const tag = extractSurrenderTag(rawResponse);
  if (!tag) return { applied: false, surrenderedNames: [], message: null };

  const encounter = storage.getEncounter(encounterId)!;
  if (encounter.status !== "active") return { applied: true, surrenderedNames: [], message: null };

  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  // Validate every proposed name independently: it must exist, must be an
  // NPC (never a PC, even by name collision — this is the specific hole
  // being closed), and must still be alive/present. Anything that fails is
  // silently dropped, not an error and not a partial rejection of the whole
  // proposal — a valid name elsewhere in the same array still applies.
  const validNames = new Set(
    tag.npcNames.filter((name) => {
      const participant = participants.find((p) => p.name === name);
      return !!participant && participant.type === "npc" && !participant.isDefeated && !participant.fled;
    }),
  );

  if (validNames.size === 0) return { applied: true, surrenderedNames: [], message: null };

  const updated = participants.map((p) => (validNames.has(p.name) && p.type === "npc" ? { ...p, isDefeated: true } : p));
  storage.updateEncounter(encounterId, { participants: JSON.stringify(updated) });

  const surrenderedNames = Array.from(validNames);
  const content =
    surrenderedNames.length === 1
      ? `${surrenderedNames[0]} surrenders.`
      : `${surrenderedNames.slice(0, -1).join(", ")} and ${surrenderedNames[surrenderedNames.length - 1]} surrender.`;

  const message = storage.createMessage({
    campaignId: (encounter as any).campaignId,
    sender: "System",
    senderType: "system",
    content,
    messageType: "system",
  });

  // Runs the same deterministic victory check every other mutation goes
  // through — this surrender has no authority to end the encounter itself,
  // only to change the state that check evaluates.
  advanceToNextActionableTurn(encounterId, storage as any);

  return { applied: true, surrenderedNames, message };
}

export function fleeEncounter(
  encounterId: number,
  participantName: string,
  storage: StorageLike & { getEncounter(id: number): Encounter | undefined; updateEncounter(id: number, updates: any): void; tickEffects(characterId: number): unknown[] },
): { fled: boolean; encounterEnded: boolean } {
  const encounter = storage.getEncounter(encounterId)!;
  if (encounter.status !== "active") return { fled: false, encounterEnded: false };

  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  const target = participants.find((p) => p.name === participantName);
  if (!target) return { fled: false, encounterEnded: false };

  const updated = participants.map((p) => (p.id === target.id ? { ...p, fled: true } : p));
  storage.updateEncounter(encounterId, { participants: JSON.stringify(updated) });

  const advanced = advanceToNextActionableTurn(encounterId, storage as any);

  return { fled: true, encounterEnded: advanced.encounter.status === "ended" };
}
