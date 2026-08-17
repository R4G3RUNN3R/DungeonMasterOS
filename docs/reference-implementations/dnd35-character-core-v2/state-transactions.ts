// Reference implementation only.
// Demonstrates the server-authoritative transaction boundary. Database wiring is intentionally omitted.

import type { Dnd35CharacterState, Dnd35LevelRecord } from "./domain";
import { appendValidatedLevel } from "./creation-and-levelup";
import { assessMulticlassXpPenalty } from "./multiclass-xp";
import {
  canGainAnotherLevel,
  characterLevel,
  derivedLandSpeed,
  iterativeBaseAttacks,
  maximumHitPoints,
  multiclassBaseAttack,
  nextLevelExperience,
} from "./mechanics";
import { getCoreClass } from "./classes";
import { getCoreRace } from "./races";

export type XpAwardReason = "challenge" | "roleplay" | "quest" | "story" | "admin" | "migration";

export type ValidatedXpAward = {
  eventKey: string;
  rawAmount: number;
  effectiveAmount: number;
  reason: XpAwardReason;
  summary: string;
  sourceMessageId?: number;
  multiclassPenaltyPercent: number;
};

export type CharacterCompatibilityProjection = {
  race: string;
  charClass: string;
  level: number;
  maxHp: number;
  speed: number;
  attacksPerRound: number;
};

export type TransactionResult<T> = {
  state: Dnd35CharacterState;
  event: T;
  projection: CharacterCompatibilityProjection;
};

export function projectCompatibilityFields(state: Dnd35CharacterState): CharacterCompatibilityProjection {
  const totals = state.levels.reduce<Record<string, number>>((map, record) => {
    map[record.classId] = (map[record.classId] ?? 0) + 1;
    return map;
  }, {});
  const race = getCoreRace(state.race.raceId);
  const classText = Object.entries(totals)
    .map(([classId, level]) => `${getCoreClass(classId)?.displayName ?? classId} ${level}`)
    .join(" / ");
  const bab = multiclassBaseAttack(state.levels);

  return {
    race: race?.displayName ?? state.race.raceId,
    charClass: classText || "Unresolved",
    level: characterLevel(state),
    maxHp: maximumHitPoints(state),
    speed: derivedLandSpeed(state),
    attacksPerRound: iterativeBaseAttacks(bab).length,
  };
}

/**
 * XP arrives here only after the caller validates the underlying challenge,
 * roleplay beat, quest or admin event. Persist `eventKey` under a unique
 * constraint so retries cannot duplicate awards.
 */
export function applyValidatedXpAward(
  state: Dnd35CharacterState,
  input: {
    eventKey: string;
    amount: number;
    reason: XpAwardReason;
    summary: string;
    sourceMessageId?: number;
    applyCoreMulticlassPenalty?: boolean;
  },
): TransactionResult<ValidatedXpAward> {
  if (!input.eventKey.trim()) throw new Error("XP event requires a stable idempotency key.");
  if (!Number.isInteger(input.amount) || input.amount < 0) throw new Error("XP award must be a non-negative integer.");
  if (!input.summary.trim()) throw new Error("XP award requires a human-auditable summary.");

  const assessment = input.applyCoreMulticlassPenalty === false
    ? { penaltyPercent: 0, effectiveXpAward: input.amount }
    : assessMulticlassXpPenalty(state, input.amount);

  const nextState: Dnd35CharacterState = {
    ...state,
    experiencePoints: state.experiencePoints + assessment.effectiveXpAward,
  };

  const event: ValidatedXpAward = {
    eventKey: input.eventKey,
    rawAmount: input.amount,
    effectiveAmount: assessment.effectiveXpAward,
    reason: input.reason,
    summary: input.summary,
    sourceMessageId: input.sourceMessageId,
    multiclassPenaltyPercent: assessment.penaltyPercent,
  };

  return { state: nextState, event, projection: projectCompatibilityFields(nextState) };
}

export type LevelCommitEvent = {
  eventKey: string;
  characterLevel: number;
  classId: string;
  summary: string;
};

/**
 * The level record must already contain the PLAYER'S explicit choices and HP roll.
 * The first character level is creation and requires no XP. Every later level
 * requires the canonical state to have reached the standard threshold first.
 */
export function commitValidatedLevel(
  state: Dnd35CharacterState,
  input: { eventKey: string; level: Dnd35LevelRecord },
): TransactionResult<LevelCommitEvent> {
  if (!input.eventKey.trim()) throw new Error("Level-up transaction requires a stable idempotency key.");

  if (state.levels.length >= 1 && !canGainAnotherLevel(state)) {
    throw new Error(
      `Not enough XP to gain character level ${state.levels.length + 1}. ` +
      `Need ${nextLevelExperience(state.levels.length)}, have ${state.experiencePoints}.`,
    );
  }

  const nextState = appendValidatedLevel(state, input.level);
  const event: LevelCommitEvent = {
    eventKey: input.eventKey,
    characterLevel: input.level.characterLevel,
    classId: input.level.classId,
    summary: `Committed character level ${input.level.characterLevel} as ${getCoreClass(input.level.classId)?.displayName ?? input.level.classId}.`,
  };
  return { state: nextState, event, projection: projectCompatibilityFields(nextState) };
}

export const SERVER_TRANSACTION_REQUIREMENTS = [
  "Load the current state and revision in the same server transaction.",
  "Reject a stale expected revision.",
  "Reject duplicate eventKey before mutation.",
  "Validate player ownership/DM authority before mutation.",
  "Commit canonical rules state, event ledger and compatibility projection atomically.",
  "Broadcast only after commit succeeds.",
  "Never accept client-provided derived BAB, saves, AC, skill totals, max HP or attacks-per-round as authoritative.",
] as const;
