// Reference implementation only. SRD 5.1 conditions.

import type { Dnd5eConditionDefinition, ExhaustionResolution } from "./condition-types";

const c = (id: string, displayName: string, effects: Dnd5eConditionDefinition["effects"], includesConditions?: string[]): Dnd5eConditionDefinition => ({
  profileId: "dnd5e-2014", id, displayName, effects, includesConditions,
});

export const DND5E_2014_CONDITIONS: Record<string, Dnd5eConditionDefinition> = {
  blinded: c("blinded", "Blinded", [
    { kind: "automatic-failure", target: "checks-that-require-sight" },
    { kind: "advantage", target: "attacks-against-self" },
    { kind: "disadvantage", target: "own-attacks" },
  ]),
  charmed: c("charmed", "Charmed", [
    { kind: "other", target: "attacks", value: "cannot-attack-charmer-or-target-charmer-with-harmful-effects" },
    { kind: "advantage", target: "charmer-social-interaction-checks" },
  ]),
  deafened: c("deafened", "Deafened", [{ kind: "automatic-failure", target: "checks-that-require-hearing" }]),
  frightened: c("frightened", "Frightened", [
    { kind: "disadvantage", target: "ability-checks-and-attacks", condition: "while fear source is in line of sight" },
    { kind: "other", target: "movement", value: "cannot-willingly-move-closer-to-source" },
  ]),
  grappled: c("grappled", "Grappled", [
    { kind: "speed", target: "self", value: 0 },
    { kind: "other", target: "ends-if-grappler-incapacitated-or-target-moved-out-of-reach", value: true },
  ]),
  incapacitated: c("incapacitated", "Incapacitated", [
    { kind: "action-lock", target: "self", value: "no-actions" },
    { kind: "reaction-lock", target: "self", value: true },
  ]),
  invisible: c("invisible", "Invisible", [
    { kind: "visibility", target: "self", value: "impossible-to-see-without-magic-or-special-sense; heavily-obscured-for-hiding" },
    { kind: "advantage", target: "own-attacks" },
    { kind: "disadvantage", target: "attacks-against-self" },
  ]),
  paralyzed: c("paralyzed", "Paralyzed", [
    { kind: "automatic-failure", target: "str-dex-saves" },
    { kind: "advantage", target: "attacks-against-self" },
    { kind: "critical-hit", target: "attacks-within-5ft-that-hit" },
  ], ["incapacitated"]),
  petrified: c("petrified", "Petrified", [
    { kind: "speed", target: "self", value: 0 },
    { kind: "automatic-failure", target: "str-dex-saves" },
    { kind: "advantage", target: "attacks-against-self" },
    { kind: "damage-resistance", target: "all-damage", value: true },
    { kind: "damage-immunity", target: "poison", value: true },
    { kind: "condition-immunity", target: "poisoned", value: true },
  ], ["incapacitated"]),
  poisoned: c("poisoned", "Poisoned", [{ kind: "disadvantage", target: "ability-checks-and-attacks" }]),
  prone: c("prone", "Prone", [
    { kind: "other", target: "movement", value: "crawl-or-spend-half-movement-to-stand" },
    { kind: "disadvantage", target: "own-attacks" },
    { kind: "advantage", target: "attacks-against-self", condition: "attacker-within-5ft" },
    { kind: "disadvantage", target: "attacks-against-self", condition: "attacker-farther-than-5ft" },
  ]),
  restrained: c("restrained", "Restrained", [
    { kind: "speed", target: "self", value: 0 },
    { kind: "advantage", target: "attacks-against-self" },
    { kind: "disadvantage", target: "own-attacks" },
    { kind: "disadvantage", target: "dex-saves" },
  ]),
  stunned: c("stunned", "Stunned", [
    { kind: "automatic-failure", target: "str-dex-saves" },
    { kind: "advantage", target: "attacks-against-self" },
  ], ["incapacitated"]),
  unconscious: c("unconscious", "Unconscious", [
    { kind: "speed", target: "self", value: 0 },
    { kind: "other", target: "held-items", value: "drop" },
    { kind: "automatic-failure", target: "str-dex-saves" },
    { kind: "advantage", target: "attacks-against-self" },
    { kind: "critical-hit", target: "attacks-within-5ft-that-hit" },
  ], ["incapacitated", "prone"]),
};

export function exhaustion2014(level: number): ExhaustionResolution {
  const clamped = Math.max(0, Math.min(6, Math.floor(level)));
  return {
    level: clamped,
    dead: clamped >= 6,
    disadvantageAbilityChecks: clamped >= 1,
    speedMultiplier: clamped >= 5 ? 0 : clamped >= 2 ? 0.5 : 1,
    disadvantageAttacks: clamped >= 3,
    disadvantageSaves: clamped >= 3,
    maxHpMultiplier: clamped >= 4 ? 0.5 : 1,
    speedZero: clamped >= 5,
  };
}
