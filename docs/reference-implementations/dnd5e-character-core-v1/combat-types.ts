// Reference implementation only.

import type { Dnd5eAbilityScores, Dnd5eDeathState, Dnd5eRulesProfileId, Dnd5eSize } from "./domain";

export type InitiativeResolution = {
  modifier: number;
  advantageSources: string[];
  disadvantageSources: string[];
  profileNote: string;
};

export type GrappleAttempt = {
  profileId: Dnd5eRulesProfileId;
  legal: boolean;
  attackerCheck?: { skill: "athletics"; ability: "str" };
  defenderContestOptions?: Array<{ skill: "athletics" | "acrobatics"; ability: "str" | "dex" }>;
  saveDc?: number;
  defenderSaveOptions?: Array<"str" | "dex">;
  onFailure: "grappled";
  notes: string[];
};

export type ShoveAttempt = {
  profileId: Dnd5eRulesProfileId;
  legal: boolean;
  attackerCheck?: { skill: "athletics"; ability: "str" };
  defenderContestOptions?: Array<{ skill: "athletics" | "acrobatics"; ability: "str" | "dex" }>;
  saveDc?: number;
  defenderSaveOptions?: Array<"str" | "dex">;
  effects: Array<"prone" | "push-5ft">;
};

export type DamageAtZeroResult = {
  instantDeath: boolean;
  deathFailuresAdded: number;
};

export type DeathSaveResult = {
  next: Dnd5eDeathState;
  regainedHp: number;
  dead: boolean;
};

export type CombatantCore = {
  size: Dnd5eSize;
  abilities: Dnd5eAbilityScores;
  proficiencyBonus: number;
};
