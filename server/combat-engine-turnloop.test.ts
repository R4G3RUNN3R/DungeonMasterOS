// server/combat-engine-turnloop.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceToNextActionableTurn } from "./combat-engine";

function fakeStorageWithEncounter(encounter: any) {
  const store = { ...encounter };
  const tickedCharacterIds: number[] = [];
  return {
    getEncounter: (_id: number) => ({ ...store }),
    updateEncounter: (_id: number, updates: any) => Object.assign(store, updates),
    tickEffects: (characterId: number) => { tickedCharacterIds.push(characterId); return []; },
    _tickedCharacterIds: tickedCharacterIds,
    _store: store,
  };
}

const baseParticipants = (overrides: any[]) => JSON.stringify(overrides);

test("advanceToNextActionableTurn: stops immediately on a living PC's turn", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant?.name, "Kira");
  assert.equal(storage._store.turnIndex, 0);
});

test("advanceToNextActionableTurn: skips a defeated participant and lands on the next living one", () => {
  // NOTE: the brief's literal fixture here had only one PC total (Kira) and
  // marked her defeated, which is indistinguishable from "all PCs defeated"
  // (see the defeat test below) — checkDeterministicEnd would correctly end
  // the encounter before the skip logic is ever exercised. Verified by
  // running the brief's code verbatim: it fails with currentParticipant ===
  // null instead of "Goblin". Adding a second, living PC (Elara) keeps the
  // encounter active so this test actually exercises the skip-past-defeated
  // path it's named for.
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: true, fled: false, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
      { id: "char-2", type: "character", name: "Elara", isDefeated: false, fled: false, characterId: 2 },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant?.name, "Goblin");
  assert.equal(storage._store.turnIndex, 1);
});

test("advanceToNextActionableTurn: skips a fled participant", () => {
  // Same fix as the defeated-participant test above: a lone fled PC with no
  // other living PC is indistinguishable from "all PCs defeated," so a
  // second living PC (Elara) keeps the encounter active.
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: true, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
      { id: "char-2", type: "character", name: "Elara", isDefeated: false, fled: false, characterId: 2 },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant?.name, "Goblin");
});

test("advanceToNextActionableTurn: wraps to round 2 and ticks effects for every character participant", () => {
  // NOTE: the brief's literal fixture used turnIndex: 1, which for a
  // 2-participant array still points AT Goblin (index 1), a living
  // participant — under the "stop immediately on a living candidate" rule
  // the first test establishes, that stops on Goblin at round 1 rather than
  // wrapping (verified by running the brief's code verbatim: round stayed 1
  // instead of advancing to 2). The comment's own intent ("last
  // participant's turn just finished") means the pointer should already be
  // one past the last valid index (2, i.e. participants.length), which is
  // what actually triggers the round/effect-tick wraparound.
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 2, // one past the last index — the last participant's turn just finished
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(storage._store.round, 2);
  assert.equal(result.currentParticipant?.name, "Kira");
  assert.deepEqual(storage._tickedCharacterIds, [1]);
});

test("advanceToNextActionableTurn: all NPCs defeated ends the encounter with victory", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: true, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant, null);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "victory");
});

test("advanceToNextActionableTurn: all PCs defeated ends the encounter with defeat", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: true, fled: false, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant, null);
  assert.equal(storage._store.outcome, "defeat");
});

test("advanceToNextActionableTurn: mixed defeated+fled PCs still ends in defeat, not all_fled", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: true, fled: false, characterId: 1 },
      { id: "char-2", type: "character", name: "Doran", isDefeated: false, fled: true, characterId: 2 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant, null);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "defeat");
});

test("advanceToNextActionableTurn: an already-ended encounter is a no-op", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "ended", outcome: "victory", round: 3, turnIndex: 0,
    participants: baseParticipants([{ id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 }]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant, null);
  assert.equal(storage._store.status, "ended"); // unchanged
});
