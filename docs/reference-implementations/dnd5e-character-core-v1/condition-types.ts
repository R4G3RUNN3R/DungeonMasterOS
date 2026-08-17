// Reference implementation only.

import type { Dnd5eRulesProfileId } from "./domain";

export type Dnd5eConditionEffect = {
  kind:
    | "advantage"
    | "disadvantage"
    | "automatic-failure"
    | "speed"
    | "action-lock"
    | "reaction-lock"
    | "concentration-break"
    | "critical-hit"
    | "visibility"
    | "damage-resistance"
    | "damage-immunity"
    | "condition-immunity"
    | "d20-penalty"
    | "max-hp"
    | "other";
  target?: string;
  value?: string | number | boolean;
  condition?: string;
};

export type Dnd5eConditionDefinition = {
  profileId: Dnd5eRulesProfileId;
  id: string;
  displayName: string;
  effects: Dnd5eConditionEffect[];
  includesConditions?: string[];
  removedBy?: string[];
};

export type ExhaustionResolution = {
  level: number;
  dead: boolean;
  d20TestPenalty?: number;
  speedPenaltyFt?: number;
  disadvantageAbilityChecks?: boolean;
  speedMultiplier?: number;
  disadvantageAttacks?: boolean;
  disadvantageSaves?: boolean;
  maxHpMultiplier?: number;
  speedZero?: boolean;
};
