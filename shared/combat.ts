// shared/combat.ts
//
// Client-shared type contract for Phase 4 combat UX (design spec §10).
// Mirrors the encounters/combatants schema in shared/schema.ts exactly —
// see server/combat-engine.ts for why armorClass/attackBonus are
// simplified, level-derived numbers rather than full 3.5e BAB/AC math.

export type CombatantKind = "player" | "npc";

export interface CombatantView {
  id: number;
  encounterId: number;
  kind: CombatantKind;
  characterId: number | null;
  name: string;
  hp: number;
  maxHp: number;
  attackBonus: number;
  armorClass: number;
  damageDie: string;
  initiative: number;
  turnOrder: number;
  isDefeated: boolean;
  hasFled: boolean;
}

export interface EncounterView {
  id: number;
  campaignId: number;
  status: "active" | "ended";
  round: number;
  currentTurnIndex: number;
  endReason: string | null;
}

export interface EncounterState {
  encounter: EncounterView | null;
  combatants: CombatantView[];
}

// Derives the display-safe pieces a Context Panel/action-deck component
// actually needs, without either side re-deriving "whose turn is it"
// logic independently.
export function activeCombatants(combatants: CombatantView[]): CombatantView[] {
  return combatants.filter((c) => !c.isDefeated && !c.hasFled);
}

export function currentTurnCombatant(state: EncounterState): CombatantView | null {
  if (!state.encounter || state.encounter.status !== "active") return null;
  const active = activeCombatants(state.combatants);
  if (active.length === 0) return null;
  return active[state.encounter.currentTurnIndex % active.length] ?? null;
}

export function isMyTurn(state: EncounterState, myCharacterId: number | undefined): boolean {
  if (!myCharacterId) return false;
  const current = currentTurnCombatant(state);
  return !!current && current.kind === "player" && current.characterId === myCharacterId;
}
