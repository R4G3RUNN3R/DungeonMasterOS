// server/npc-turn-orchestrate.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceAndResolveTurns } from "./npc-turn";

function fakeStorageWithEncounter(participants: any[], overrides: any = {}) {
  const store = { id: 1, campaignId: 9, status: "active", round: 1, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
  const messages: any[] = [];
  return {
    getEncounter: (_id: number) => ({ ...store }),
    updateEncounter: (_id: number, updates: any) => Object.assign(store, updates),
    createRollLogEntry: (_entry: any) => {},
    tickEffects: (_characterId: number) => [],
    createMessage: (message: any) => { const msg = { id: messages.length + 1, ...message }; messages.push(msg); return msg; },
    _store: store,
    _messages: messages,
  };
}

function deps(generateNpcAction: any) {
  return {
    generateNpcAction,
    narrate: async () => "Narration.",
    rng: () => 1 / 20, // fumble on every d20 -> misses, no damage, keeps fixtures simple/deterministic
    currentScene: "A tense standoff.",
    broadcast: () => {},
  };
}

const kira = { id: "char-1", type: "character", name: "Kira", currentHp: 20, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", isDefeated: false, fled: false, characterId: 1 };
const goblin1 = { id: "npc-0", type: "npc", name: "Goblin 1", currentHp: 11, maxHp: 11, ac: 13, attackBonus: 3, damageDice: "1d6", isDefeated: false, fled: false };
const goblin2 = { id: "npc-1", type: "npc", name: "Goblin 2", currentHp: 11, maxHp: 11, ac: 13, attackBonus: 3, damageDice: "1d6", isDefeated: false, fled: false };

test("advanceAndResolveTurns: stops immediately on a living PC's turn without calling the NPC-action callback", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]); // turnIndex 0 -> Kira
  let called = false;
  const messages = await advanceAndResolveTurns(1, storage as any, deps(async () => { called = true; return "x"; }));
  assert.equal(called, false);
  assert.deepEqual(messages, []);
});

test("advanceAndResolveTurns: resolves a single NPC turn and stops on the next PC", async () => {
  const storage = fakeStorageWithEncounter([goblin1, kira]); // turnIndex 0 -> Goblin 1
  const generateNpcAction = async (npcName: string, _notes: string, _scene: string, validTargets: string[]) => {
    assert.equal(npcName, "Goblin 1");
    assert.deepEqual(validTargets, ["Kira"]);
    return `[ATTACK]{"attacker":"Goblin 1","target":"Kira"}[/ATTACK]`;
  };
  const messages = await advanceAndResolveTurns(1, storage as any, deps(generateNpcAction));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].senderType, "dm");
  assert.equal(storage._store.turnIndex, 1); // landed back on Kira's turn
});

test("advanceAndResolveTurns: resolves a chain of multiple consecutive NPC turns", async () => {
  const storage = fakeStorageWithEncounter([goblin1, goblin2, kira]); // turnIndex 0 -> Goblin 1, then Goblin 2
  const generateNpcAction = async () => "The goblin snarls."; // no tag -> deterministic fallback targets Kira both times
  const messages = await advanceAndResolveTurns(1, storage as any, deps(generateNpcAction));
  assert.equal(messages.length, 2);
  assert.equal(storage._store.turnIndex, 2); // landed on Kira's turn
});

test("advanceAndResolveTurns: stops when the encounter ends mid-chain", async () => {
  const nearDeadKira = { ...kira, currentHp: 1 };
  const storage = fakeStorageWithEncounter([goblin1, nearDeadKira]);
  const generateNpcAction = async () => `[ATTACK]{"attacker":"Goblin 1","target":"Kira"}[/ATTACK]`;
  const messages = await advanceAndResolveTurns(1, storage as any, {
    ...deps(generateNpcAction),
    rng: () => 19 / 20, // guaranteed hit
  });
  assert.equal(messages.length, 1);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "defeat");
});

test("advanceAndResolveTurns: no-ops on an already-ended encounter", async () => {
  const storage = fakeStorageWithEncounter([goblin1, kira], { status: "ended", outcome: "victory" });
  const messages = await advanceAndResolveTurns(1, storage as any, deps(async () => "x"));
  assert.deepEqual(messages, []);
});

test("advanceAndResolveTurns: returns created messages in resolution order", async () => {
  const storage = fakeStorageWithEncounter([goblin1, goblin2, kira]);
  const generateNpcAction = async () => "The goblin snarls.";
  const messages = await advanceAndResolveTurns(1, storage as any, deps(generateNpcAction));
  assert.equal(messages[0].id, 1);
  assert.equal(messages[1].id, 2);
});
