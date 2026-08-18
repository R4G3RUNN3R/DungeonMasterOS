// server/combat-engine.ts
//
// Server-authoritative dice resolution for the Phase 4 combat UX (design
// spec §10). The server owns every roll and HP change; the AI narrates
// but never decides an outcome directly (see dm-engine.ts's structured
// [COMBAT_START]/[ATTACK]/[SURRENDER] tags).
//
// IMPORTANT SCOPE NOTE: this branch's character schema has no ability
// scores, AC, or BAB (confirmed: `characters` has only name/race/
// charClass/level/hp/maxHp/speed/attacksPerRound — see shared/schema.ts).
// A faithful D&D 3.5e mechanical engine would require porting that whole
// substrate first (the kind of work already done separately on the VPS
// codebase this session). Rather than fabricate ability scores that don't
// exist, this engine uses simplified, level-derived attack bonus and
// armor class defaults. They are real numbers the server actually rolls
// against — not narrative flavor — but they are NOT 3.5e-canonical BAB/AC
// math. This is a deliberate, documented scope boundary.

export interface AttackResult {
  attackRoll: number; // raw d20, 1-20
  attackTotal: number; // attackRoll + attackBonus
  hit: boolean;
  critical: boolean; // natural 20
  fumble: boolean; // natural 1
  damage: number; // 0 if the attack missed
}

export function rollD20(): number {
  return 1 + Math.floor(Math.random() * 20);
}

export function rollDie(sides: number): number {
  return 1 + Math.floor(Math.random() * Math.max(1, sides));
}

// Parses simple dice notation: "1d6", "2d8+3", "1d4-1". Falls back to a
// flat 1 if the string doesn't parse, so a malformed AI-suggested damage
// die can never throw or roll zero/negative damage.
export function rollDamageDie(notation: string): number {
  const match = /^(\d+)d(\d+)\s*([+-]\s*\d+)?$/i.exec(notation.trim());
  if (!match) return 1;
  const count = Math.max(1, Math.min(20, Number(match[1])));
  const sides = Math.max(2, Math.min(100, Number(match[2])));
  const modifier = match[3] ? Number(match[3].replace(/\s+/g, "")) : 0;
  let total = modifier;
  for (let i = 0; i < count; i++) total += rollDie(sides);
  return Math.max(1, total);
}

// Simplified, deliberately-not-3.5e-canonical level scaling (see file
// header). Used only as a default when [COMBAT_START] doesn't specify an
// explicit attackBonus/armorClass for a combatant.
export function defaultAttackBonusForLevel(level: number): number {
  return Math.max(0, Math.round(level * 0.75));
}

export function defaultArmorClassForLevel(level: number): number {
  return 10 + Math.floor(Math.max(1, level) / 2);
}

export function resolveAttack(attackBonus: number, targetArmorClass: number, damageDie: string): AttackResult {
  const attackRoll = rollD20();
  const critical = attackRoll === 20;
  const fumble = attackRoll === 1;
  const attackTotal = attackRoll + attackBonus;
  const hit = !fumble && (critical || attackTotal >= targetArmorClass);

  let damage = 0;
  if (hit) {
    damage = rollDamageDie(damageDie);
    if (critical) damage *= 2;
  }

  return { attackRoll, attackTotal, hit, critical, fumble, damage };
}
