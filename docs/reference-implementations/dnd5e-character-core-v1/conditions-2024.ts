// Reference implementation only. SRD 5.2.1 conditions.

import type { Dnd5eConditionDefinition, ExhaustionResolution } from "./condition-types";

const c = (id: string, displayName: string, effects: Dnd5eConditionDefinition["effects"], includesConditions?: string[]): Dnd5eConditionDefinition => ({
  profileId: "dnd5e-2024", id, displayName, effects, includesConditions,
});

export const DND5E_2024_CONDITIONS: Record<string, Dnd5eConditionDefinition> = {
  blinded: c("blinded", "Blinded", [
    { kind: "visibility", target: "self", value: "cannot-see; auto-fail-sight-checks" },
    { kind: "advantage", target: "attacks-against-self" },
    { kind: "disadvantage", target: "own-attacks" },
  ]),
  charmed: c("charmed", "Charmed", [
    { kind: "other", target: "attacks", value: "cannot-attack-charmer" },
    { kind: "other", target: "hostile-effects", value: "cannot-target-charmer" },
    { kind: "advantage", target: "charmer-social-interaction-checks" },
  ]),
  deafened: c("deafened", "Deafened", [{ kind: "automatic-failure", target: "checks-that-require-hearing" }]),
  frightened: c("frightened", "Frightened", [
    { kind: "disadvantage", target: "ability-checks-and-attacks", condition: "while fear source is in line of sight" },
    { kind: "other", target: "movement", value: "cannot-willingly-move-closer-to-source" },
  ]),
  grappled: c("grappled", "Grappled", [
    { kind: "speed", target: "self", value: 0 },
    { kind: "disadvantage", target: "own-attacks-against-targets-other-than-grappler" },
    { kind: "other", target: "movement-by-grappler", value: "costs-extra-movement" },
  ]),
  incapacitated: c("incapacitated", "Incapacitated", [
    { kind: "action-lock", target: "self", value: "no-action-or-bonus-action" },
    { kind: "reaction-lock", target: "self", value: true },
    { kind: "concentration-break", target: "self", value: true },
    { kind: "other", target: "speech", value: "cannot-speak" },
  ]),
  invisible: c("invisible", "Invisible", [
    { kind: "advantage", target: "initiative" },
    { kind: "visibility", target: "self", value: "concealed-unless-observer-can-see-invisible" },
    { kind: "advantage", target: "own-attacks", condition: "unless target can see attacker" },
    { kind: "disadvantage", target: "attacks-against-self", condition: "unless attacker can see self" },
  ]),
  paralyzed: c("paralyzed", "Paralyzed", [
    { kind: "speed", target: "self", value: 0 },
    { kind: "automatic-failure", target: "str-dex-saves" },
    { kind: "advantage", target: "attacks-against-self" },
    { kind: "critical-hit", target: "attacks-within-5ft-that-hit" },
  ], ["incapacitated"]),
  petrified: c("petrified", "Petrified", [
    { kind: "speed", target: "self", value: 0 },
    { kind: "automatic-failure", target: "str-dex-saves" },
    { kind: "advantage", target: "attacks-against-self" },
    { kind: "damage-resistance", target: "all-damage", value: true },
    { kind: "condition-immunity", target: "poisoned", value: true },
    { kind: "damage-immunity", target: "poison", value: true },
  ], ["incapacitated"]),
  poisoned: c("poisoned", "Poisoned", [
    { kind: "disadvantage", target: "ability-checks-and-attacks" },
  ]),
  prone: c("prone", "Prone", [
    { kind: "other", target: "movement", value: "crawl-or-spend-half-speed-to-stand" },
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
    { kind: "advantage", target: "attacks-against-self" },
    { kind: "automatic-failure", target: "str-dex-saves" },
    { kind: "critical-hit", target: "attacks-within-5ft-that-hit" },
    { kind: "other", target: "held-items", value: "drop" },
  ], ["incapacitated", "prone"]),
};

export function exhaustion2024(level: number): ExhaustionResolution {
  const clamped = Math.max(0, Math.min(6, Math.floor(level)));
  return {
    level: clamped,
    dead: clamped >= 6,
    d20TestPenalty: clamped * 2,
    speedPenaltyFt: clamped * 5,
  };
}
