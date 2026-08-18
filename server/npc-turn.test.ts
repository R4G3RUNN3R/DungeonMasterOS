// server/npc-turn.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNpcTurn } from "./npc-turn";

function fakeStorageWithEncounter(participants: any[], overrides: any = {}) {
  const store = { id: 1, campaignId: 9, status: "active", round: 1, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
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

const goblin = { id: "npc-0", type: "npc", name: "Goblin", currentHp: 11, maxHp: 11, ac: 13, attackBonus: 3, damageDice: "1d6", isDefeated: false, fled: false };
const kira = { id: "char-1", type: "character", name: "Kira", currentHp: 20, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", isDefeated: false, fled: false, characterId: 1 };
const doran = { id: "char-2", type: "character", name: "Doran", currentHp: 5, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", isDefeated: false, fled: false, characterId: 2 };

test("resolveNpcTurn: valid AI-proposed attack on a valid target resolves normally", async () => {
  const storage = fakeStorageWithEncounter([goblin, kira]); // goblin's turn (index 0)
  const generateNpcAction = async () => '[ATTACK]{"attacker":"Goblin","target":"Kira"}[/ATTACK]';
  const result = await resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 19 / 20, generateNpcAction, narrate: async () => "The goblin lunges." });
  assert.equal(result.attacker, "Goblin");
  assert.equal(result.target, "Kira");
});

test("resolveNpcTurn: AI proposes an invalid/dead target -> falls back to lowest-HP living PC", async () => {
  const storage = fakeStorageWithEncounter([goblin, kira, doran]);
  const generateNpcAction = async () => '[ATTACK]{"attacker":"Goblin","target":"Nonexistent Ghost"}[/ATTACK]';
  const result = await resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 19 / 20, generateNpcAction, narrate: async () => "The goblin strikes." });
  assert.equal(result.target, "Doran"); // lower HP than Kira
});

test("resolveNpcTurn: malformed AI response -> falls back to lowest-HP living PC", async () => {
  const storage = fakeStorageWithEncounter([goblin, kira, doran]);
  const generateNpcAction = async () => "The goblin snarls menacingly."; // no tag at all
  const result = await resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 19 / 20, generateNpcAction, narrate: async () => "x" });
  assert.equal(result.target, "Doran");
});

test("resolveNpcTurn: AI call throwing -> falls back to lowest-HP living PC, does not throw", async () => {
  const storage = fakeStorageWithEncounter([goblin, kira, doran]);
  const generateNpcAction = async () => { throw new Error("model unavailable"); };
  const result = await resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 19 / 20, generateNpcAction, narrate: async () => "x" });
  assert.equal(result.target, "Doran");
});

test("resolveNpcTurn: advances the turn afterward", async () => {
  const storage = fakeStorageWithEncounter([goblin, kira]);
  const generateNpcAction = async () => '[ATTACK]{"attacker":"Goblin","target":"Kira"}[/ATTACK]';
  await resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 1 / 20, generateNpcAction, narrate: async () => "x" }); // fumble, no damage
  assert.equal(storage._store.turnIndex, 1); // moved to Kira's turn
});

test("resolveNpcTurn: throws if the current turn is not actually an NPC's turn", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]); // turnIndex 0 -> Kira, a PC
  const generateNpcAction = async () => '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  await assert.rejects(
    () => resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 0.5, generateNpcAction, narrate: async () => "x" }),
    /not an NPC/,
  );
});
