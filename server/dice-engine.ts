// server/dice-engine.ts
//
// Pure dice/resolution math for the mechanics engine. No DB, no AI, no I/O —
// every function here is deterministic given its inputs, so the RNG is always
// injected (never Math.random() directly) to keep this testable.

export type Rng = () => number; // must return a float in [0, 1)

export function modifierFor(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonusForLevel(level: number): number {
  // Copied verbatim from client/src/lib/computedStats.ts's profBonus calculation
  // so the server and the character-sheet display never disagree.
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

const VALID_DIE_SIDES = new Set([4, 6, 8, 10, 12]);

export function parseDiceNotation(notation: string): { count: number; sides: number } | null {
  const match = /^(\d+)d(\d+)$/.exec(notation.trim());
  if (!match) return null;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (!Number.isInteger(count) || count < 1) return null;
  if (!VALID_DIE_SIDES.has(sides)) return null;
  return { count, sides };
}

function rollOneDie(sides: number, rng: Rng): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollDice(count: number, sides: number, rng: Rng): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) results.push(rollOneDie(sides, rng));
  return results;
}

export type D20RollKind = "check" | "attack" | "save" | "initiative";
export type D20Outcome = "success" | "failure" | "hit" | "miss";

export interface ResolveD20Params {
  rng: Rng;
  modifier: number; // baseModifier + effectModifier + proficiencyBonus, already summed
  target: number; // DC for check/save, target AC for attack
  kind: D20RollKind;
}

export interface ResolveD20Result {
  diceResult: number;
  total: number;
  outcome: D20Outcome;
  isCritical: boolean;
  isFumble: boolean;
}

function outcomeFor(kind: D20RollKind, success: boolean): D20Outcome {
  if (kind === "attack") return success ? "hit" : "miss";
  return success ? "success" : "failure";
}

export function resolveD20(params: ResolveD20Params): ResolveD20Result {
  const diceResult = rollOneDie(20, params.rng);
  const total = diceResult + params.modifier;
  const isCritical = diceResult === 20;
  const isFumble = diceResult === 1;

  let success: boolean;
  if (isCritical) success = true;
  else if (isFumble) success = false;
  else success = total >= params.target; // ties go to the attacker/actor

  return {
    diceResult,
    total,
    outcome: outcomeFor(params.kind, success),
    isCritical,
    isFumble,
  };
}

export interface ResolveDamageParams {
  damageDice: string;
  modifier: number;
  isCritical: boolean;
  rng: Rng;
}

export function resolveDamage(params: ResolveDamageParams): number {
  const parsed = parseDiceNotation(params.damageDice);
  const { count, sides } = parsed || { count: 1, sides: 4 }; // defense-in-depth; callers should validate upstream
  const diceCount = params.isCritical ? count * 2 : count; // double the dice on a crit, never the flat modifier
  const rolled = rollDice(diceCount, sides, params.rng).reduce((sum, n) => sum + n, 0);
  return Math.max(1, rolled + params.modifier); // a hit always deals at least 1 damage
}

export interface ProposedNpcStats {
  hp: number;
  ac: number;
  attackBonus: number;
  damageDice: string;
}

export type PowerLevel = "low" | "standard" | "high" | "godtier";

interface PowerLevelBounds {
  hp: [number, number];
  ac: [number, number];
  attackBonus: [number, number];
  maxDamageTotal: number;
  defaultDamageDice: string;
}

const POWER_LEVEL_BOUNDS: Record<PowerLevel, PowerLevelBounds> = {
  low: { hp: [1, 20], ac: [8, 14], attackBonus: [-1, 3], maxDamageTotal: 12, defaultDamageDice: "1d6" },
  standard: { hp: [1, 40], ac: [8, 16], attackBonus: [0, 5], maxDamageTotal: 18, defaultDamageDice: "2d6" },
  high: { hp: [1, 80], ac: [8, 18], attackBonus: [2, 8], maxDamageTotal: 24, defaultDamageDice: "2d8" },
  godtier: { hp: [1, 200], ac: [8, 22], attackBonus: [4, 12], maxDamageTotal: 40, defaultDamageDice: "3d8" },
};

function clampNumber(value: number, [min, max]: [number, number]): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function clampNpcStats(proposed: ProposedNpcStats, powerLevel: string): ProposedNpcStats {
  const bounds = POWER_LEVEL_BOUNDS[powerLevel as PowerLevel] || POWER_LEVEL_BOUNDS.standard;

  const parsed = parseDiceNotation(proposed.damageDice);
  const maxPossible = parsed ? parsed.count * parsed.sides : Infinity;
  const damageDice = parsed && maxPossible <= bounds.maxDamageTotal ? proposed.damageDice : bounds.defaultDamageDice;

  return {
    hp: clampNumber(proposed.hp, bounds.hp),
    ac: clampNumber(proposed.ac, bounds.ac),
    attackBonus: clampNumber(proposed.attackBonus, bounds.attackBonus),
    damageDice,
  };
}

export function breakInitiativeTies<
  T extends { id: number | string; initiative: number; dexModifier: number },
>(participants: T[]): T[] {
  return [...participants].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    if (b.dexModifier !== a.dexModifier) return b.dexModifier - a.dexModifier;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
}
