// server/combat-engine-end.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyNpcSurrender, fleeEncounter } from "./combat-engine";

function fakeStorageWithEncounter(participants: any[], overrides: any = {}) {
  const store = { id: 1, campaignId: 9, status: "active", round: 1, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
  const messages: any[] = [];
  return {
    getEncounter: (_id: number) => ({ ...store }),
    updateEncounter: (_id: number, updates: any) => Object.assign(store, updates),
    tickEffects: (_characterId: number) => [],
    createRollLogEntry: (_entry: any) => {},
    createMessage: (message: any) => { const msg = { id: messages.length + 1, ...message }; messages.push(msg); return msg; },
    _store: store,
    _messages: messages,
  };
}

const kira = { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 };
const goblin1 = { id: "npc-0", type: "npc", name: "Goblin 1", isDefeated: false, fled: false };
const goblin2 = { id: "npc-1", type: "npc", name: "Goblin 2", isDefeated: false, fled: false };

test("applyNpcSurrender: no tag present -> not applied, no mutation", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const result = applyNpcSurrender(1, "just narration", storage as any);
  assert.equal(result.applied, false);
  assert.deepEqual(result.surrenderedNames, []);
  assert.equal(storage._messages.length, 0);
});

test("applyNpcSurrender: a nonexistent NPC name is dropped, not mutated", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const tag = '[SURRENDER]{"npcNames":["Nonexistent Ghost"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.equal(result.applied, true);
  assert.deepEqual(result.surrenderedNames, []);
  const updated = JSON.parse(storage._store.participants).find((p: any) => p.name === "Goblin 1");
  assert.equal(updated.isDefeated, false);
});

test("applyNpcSurrender: an already-defeated NPC name is dropped", () => {
  const defeatedGoblin = { ...goblin1, isDefeated: true };
  const storage = fakeStorageWithEncounter([kira, defeatedGoblin]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.deepEqual(result.surrenderedNames, []);
});

test("applyNpcSurrender: an already-fled NPC name is dropped", () => {
  const fledGoblin = { ...goblin1, fled: true };
  const storage = fakeStorageWithEncounter([kira, fledGoblin]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.deepEqual(result.surrenderedNames, []);
});

test("applyNpcSurrender: a PC name in npcNames never mutates the PC", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const tag = '[SURRENDER]{"npcNames":["Kira"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.deepEqual(result.surrenderedNames, []);
  const updatedKira = JSON.parse(storage._store.participants).find((p: any) => p.name === "Kira");
  assert.equal(updatedKira.isDefeated, false);
});

test("applyNpcSurrender: a mix of one valid and one invalid name only mutates the valid one", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1, goblin2]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1","Nonexistent Ghost"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.deepEqual(result.surrenderedNames, ["Goblin 1"]);
  const participants = JSON.parse(storage._store.participants);
  assert.equal(participants.find((p: any) => p.name === "Goblin 1").isDefeated, true);
  assert.equal(participants.find((p: any) => p.name === "Goblin 2").isDefeated, false);
});

test("applyNpcSurrender: reason content is never parsed/branched on — any reason string produces the same effect", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1"],"reason":"they simply vanish"}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.deepEqual(result.surrenderedNames, ["Goblin 1"]);
});

test("applyNpcSurrender: all NPCs surrendering ends the encounter via the deterministic victory check", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1, goblin2]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1","Goblin 2"],"reason":"they throw down their weapons"}[/SURRENDER]';
  applyNpcSurrender(1, tag, storage as any);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "victory");
});

test("applyNpcSurrender: creates an explicit System message naming who surrendered", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1, goblin2]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1","Goblin 2"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.equal(result.message?.senderType, "system");
  assert.match(result.message!.content, /Goblin 1/);
  assert.match(result.message!.content, /Goblin 2/);
});

test("applyNpcSurrender: an inactive encounter is a no-op", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1], { status: "ended" });
  const tag = '[SURRENDER]{"npcNames":["Goblin 1"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.equal(result.applied, true);
  assert.deepEqual(result.surrenderedNames, []);
  assert.equal(storage._messages.length, 0);
});

test("fleeEncounter: marks the named participant fled and removes them from turn order consideration", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const result = fleeEncounter(1, "Kira", storage as any);
  assert.equal(result.fled, true);
  const updated = JSON.parse(storage._store.participants).find((p: any) => p.name === "Kira");
  assert.equal(updated.fled, true);
});

test("fleeEncounter: all PCs fleeing ends the encounter with all_fled", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const result = fleeEncounter(1, "Kira", storage as any);
  assert.equal(result.encounterEnded, true);
  assert.equal(storage._store.outcome, "all_fled");
});

test("fleeEncounter: unknown participant name returns fled: false, no mutation", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const result = fleeEncounter(1, "Nobody", storage as any);
  assert.equal(result.fled, false);
});

test("fleeEncounter: rejects a non-active encounter without mutation", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1], { status: "ended" });
  const result = fleeEncounter(1, "Kira", storage as any);
  assert.equal(result.fled, false);
  const updated = JSON.parse(storage._store.participants).find((p: any) => p.name === "Kira");
  assert.equal(updated.fled, false);
});
