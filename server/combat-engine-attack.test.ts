// server/combat-engine-attack.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAttack } from "./combat-engine";

function fakeStorageWithEncounter(participants: any[], overrides: any = {}) {
  const store = { id: 1, status: "active", round: 1, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
  const rollLog: any[] = [];
  return {
    getEncounter: (_id: number) => ({ ...store }),
    updateEncounter: (_id: number, updates: any) => Object.assign(store, updates),
    createRollLogEntry: (entry: any) => { rollLog.push(entry); return entry; },
    tickEffects: (_characterId: number) => [],
    _store: store,
    _rollLog: rollLog,
  };
}

const kira = { id: "char-1", type: "character", name: "Kira", currentHp: 20, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", isDefeated: false, fled: false, characterId: 1 };
const goblin = { id: "npc-0", type: "npc", name: "Goblin", currentHp: 11, maxHp: 11, ac: 13, attackBonus: 3, damageDice: "1d6", isDefeated: false, fled: false };

test("resolveAttack: no tag returns no_tag error", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]);
  const result = await resolveAttack({ encounterId: 1, rawResponse: "just narration", storage: storage as any, rng: () => 0.5, narrate: async () => "x" });
  assert.equal((result as any).error, "no_tag");
});

test("resolveAttack: rejects an attack from a participant who isn't the current turn", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin], { turnIndex: 1 }); // it's the goblin's turn
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const result = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => 0.5, narrate: async () => "x" });
  assert.equal((result as any).error, "not_your_turn");
});

test("resolveAttack: rejects an attack on an invalid/defeated target without consuming a roll", async () => {
  const defeatedGoblin = { ...goblin, isDefeated: true };
  const storage = fakeStorageWithEncounter([kira, defeatedGoblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const result = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => 0.5, narrate: async () => "x" });
  assert.equal((result as any).error, "invalid_target");
  assert.equal(storage._rollLog.length, 0);
});

test("resolveAttack: hit applies damage and logs the roll with real stats", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  // rng sequence: to-hit roll first (14/20 -> 15), then damage roll (3/8 -> 4)
  const values = [14 / 20, 3 / 8];
  let i = 0;
  const rng = () => values[i++];

  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng, narrate: async () => "The blade connects." });

  assert.equal(result.outcome, "hit");
  const updatedGoblin = JSON.parse(storage._store.participants).find((p: any) => p.name === "Goblin");
  assert.equal(updatedGoblin.currentHp, 11 - (4 + 5)); // 15+5=20 >= AC13 -> hit; damage 1d8+5... wait, damage uses ATTACKER's damage dice/modifier
});

test("resolveAttack: natural 20 is an automatic hit with doubled damage dice", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const values = [19 / 20, 0.99, 0.99]; // nat 20 to-hit, two max damage-die rolls (crit doubles 1d8 -> 2d8)
  let i = 0;
  const rng = () => values[i++];

  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng, narrate: async () => "A devastating blow!" });

  assert.equal(result.isCritical, true);
  assert.equal(result.outcome, "hit");
});

test("resolveAttack: natural 1 is an automatic miss, no damage roll, target HP unchanged", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => 0, narrate: async () => "The strike goes wide." });

  assert.equal(result.isFumble, true);
  assert.equal(result.outcome, "miss");
  const updatedGoblin = JSON.parse(storage._store.participants).find((p: any) => p.name === "Goblin");
  assert.equal(updatedGoblin.currentHp, 11); // unchanged
});

test("resolveAttack: defeating the last NPC ends the encounter as victory via the turn loop", async () => {
  const nearDeadGoblin = { ...goblin, currentHp: 1 };
  const storage = fakeStorageWithEncounter([kira, nearDeadGoblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  // rng 19/20 is a natural 20 (crit), so damage doubles the dice (1d8 -> 2d8) and needs two damage rolls, not one
  const values = [19 / 20, 0.5, 0.5];
  let i = 0;
  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => values[i++], narrate: async () => "The goblin falls." });

  assert.equal(result.encounterEnded, true);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "victory");
});

// 3.5e full attack: a high-BAB fighter with extraAttackBonuses makes every
// swing in the sequence in one turn.
const highBabFighter = { ...kira, id: "char-2", name: "Bram", attackBonus: 11, extraAttackBonuses: [6, 1] };

test("resolveAttack: 3.5e full attack resolves every swing in the sequence, summing damage", async () => {
  // High HP target so a crit on an early swing can't end the sequence early —
  // this test is specifically about swing count, not lethality.
  const toughGoblin = { ...goblin, currentHp: 200, maxHp: 200 };
  const storage = fakeStorageWithEncounter([highBabFighter, toughGoblin]);
  const tag = '[ATTACK]{"attacker":"Bram","target":"Goblin"}[/ATTACK]';
  // A constant 0.5 roll (diceResult 11 on a d20) never lands a natural 20/1,
  // so every swing consumes exactly one damage-die roll — no doubled-dice
  // timing to track across the sequence.
  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => 0.5, narrate: async (p) => p });

  assert.equal(result.attackRolls.length, 3);
  assert.equal(storage._rollLog.length, 3); // one logged roll per swing
  const expectedTotal = result.attackRolls.reduce((sum: number, r: any) => sum + r.damageDealt, 0);
  assert.equal(result.damageDealt, expectedTotal);
});

test("resolveAttack: 3.5e full attack stops early once the target is already defeated mid-sequence", async () => {
  const weakGoblin = { ...goblin, currentHp: 3 };
  const storage = fakeStorageWithEncounter([highBabFighter, weakGoblin]);
  const tag = '[ATTACK]{"attacker":"Bram","target":"Goblin"}[/ATTACK]';
  // First swing: nat 20 crit, huge damage roll -> drops the goblin (3 HP) immediately.
  const values = [0.99, 0.99, 0.99, 0.5, 0.5]; // extra values in case it (incorrectly) kept swinging
  let i = 0;
  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => values[i++], narrate: async () => "x" });

  assert.ok(result.attackRolls.length < 3, "should not resolve every swing once the target is already down");
  const updatedGoblin = JSON.parse(storage._store.participants).find((p: any) => p.name === "Goblin");
  assert.equal(updatedGoblin.currentHp, 0);
  assert.equal(updatedGoblin.isDefeated, true);
});

test("resolveAttack: a 5e/NPC attacker with no extraAttackBonuses behaves exactly as before (single swing)", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const values = [14 / 20, 3 / 8];
  let i = 0;
  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => values[i++], narrate: async () => "x" });

  assert.equal(result.attackRolls.length, 1);
  assert.equal(storage._rollLog.length, 1);
});

test("resolveAttack: rejects an attack against an already-ended encounter without consuming a roll", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin], { status: "ended" });
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const result = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => 0.5, narrate: async () => "x" });
  assert.equal((result as any).error, "encounter_not_active");
  assert.equal(storage._rollLog.length, 0);
});

// Regression test for final-review issue #2: an [ATTACK] naming another
// player character as the target must be rejected server-side. The server
// only ever tells the AI that NPCs are valid targets (buildCombatContext's
// validTargetNames), but resolveAttack itself had no type check — so a PC
// could be attacked, damaged, and defeated by another PC's turn with no
// server-side enforcement of that rule. Proves both the error AND that the
// victim's state (HP/isDefeated) is completely unmutated — not just that an
// error value came back.
test("resolveAttack: rejects a PC attacking another PC (PvP), and leaves the target participant completely unmutated", async () => {
  const doran = { id: "char-2", type: "character", name: "Doran", currentHp: 20, maxHp: 20, ac: 12, attackBonus: 4, damageDice: "1d8", isDefeated: false, fled: false, characterId: 2 };
  const storage = fakeStorageWithEncounter([kira, doran, goblin], { turnIndex: 0 }); // Kira's turn
  const beforeDoran = { ...JSON.parse(storage._store.participants).find((p: any) => p.name === "Doran") };

  const tag = '[ATTACK]{"attacker":"Kira","target":"Doran"}[/ATTACK]';
  const result = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => 0.99, narrate: async () => "x" });

  assert.equal((result as any).error, "invalid_target");
  assert.equal(storage._rollLog.length, 0, "no roll should have been logged for a rejected target");

  const afterDoran = JSON.parse(storage._store.participants).find((p: any) => p.name === "Doran");
  assert.deepEqual(afterDoran, beforeDoran, "Doran's participant state must be byte-for-byte unchanged");
  assert.equal(afterDoran.currentHp, 20);
  assert.equal(afterDoran.isDefeated, false);
});
