// shared/combat.ts
//
// Client-shared type contract for the combat UI. Mirrors server/combat-engine.ts's
// EncounterParticipant exactly — participants are a JSON snapshot stored on
// the Encounter row (`encounters.participants`), not a separate combatants
// table. turnIndex indexes directly into the participants array (in
// initiative/turn order); it does NOT skip defeated/fled entries itself —
// currentTurnParticipant below handles that.

export type ParticipantType = "character" | "npc";

export interface ParticipantView {
  id: string;
  type: ParticipantType;
  name: string;
  initiative: number;
  currentHp: number;
  maxHp: number;
  ac: number;
  attackBonus: number;
  extraAttackBonuses?: number[];
  damageDice: string;
  isDefeated: boolean;
  fled: boolean;
  characterId?: number;
}

export interface EncounterView {
  id: number;
  campaignId: number;
  status: "active" | "ended";
  round: number;
  turnIndex: number;
  outcome: string | null;
}

export interface EncounterState {
  encounter: EncounterView | null;
  participants: ParticipantView[];
}

export function activeParticipants(participants: ParticipantView[]): ParticipantView[] {
  return participants.filter((p) => !p.isDefeated && !p.fled);
}

// The participant whose turn it currently is, per combat-engine.ts's own
// invariant: turnIndex always lands on a living, non-fled participant once
// advanceToNextActionableTurn has run (it wraps/skips as needed) — so this
// indexes directly rather than re-deriving "next living entry" client-side.
export function currentTurnParticipant(state: EncounterState): ParticipantView | null {
  if (!state.encounter || state.encounter.status !== "active") return null;
  return state.participants[state.encounter.turnIndex] ?? null;
}

export function isMyTurn(state: EncounterState, myCharacterId: number | undefined): boolean {
  if (!myCharacterId) return false;
  const current = currentTurnParticipant(state);
  return !!current && current.type === "character" && current.characterId === myCharacterId;
}
