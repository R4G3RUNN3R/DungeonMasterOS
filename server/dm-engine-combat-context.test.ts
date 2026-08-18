import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCombatContext } from "./dm-engine";

function fakeEncounter(participants: any[], overrides: any = {}) {
  return { id: 1, campaignId: 9, status: "active", round: 2, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
}

test("buildCombatContext: null when no active encounter", () => {
  const result = buildCombatContext(undefined, { name: "Kira" });
  assert.equal(result, null);
});

test("buildCombatContext: correct when it IS the submitting character's turn", () => {
  const encounter = fakeEncounter([
    { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false },
    { id: "npc-0", type: "npc", name: "Goblin 1", isDefeated: false, fled: false },
    { id: "npc-1", type: "npc", name: "Goblin 2", isDefeated: true, fled: false },
  ]);
  const result = buildCombatContext(encounter as any, { name: "Kira" });
  assert.equal(result?.round, 2);
  assert.equal(result?.currentTurnName, "Kira");
  assert.equal(result?.isSubmittingPlayersTurn, true);
  assert.deepEqual(result?.validTargetNames, ["Goblin 1"]); // Goblin 2 is defeated, excluded
});

test("buildCombatContext: correct when it is NOT the submitting character's turn", () => {
  const encounter = fakeEncounter([
    { id: "npc-0", type: "npc", name: "Goblin 1", isDefeated: false, fled: false },
    { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false },
  ]);
  const result = buildCombatContext(encounter as any, { name: "Kira" });
  assert.equal(result?.currentTurnName, "Goblin 1");
  assert.equal(result?.isSubmittingPlayersTurn, false);
  assert.deepEqual(result?.validTargetNames, []);
});
