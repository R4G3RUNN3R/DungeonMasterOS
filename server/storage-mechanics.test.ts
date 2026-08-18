// server/storage-mechanics.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const dbPath = path.join(os.tmpdir(), `dmos-storage-mechanics-test-${Date.now()}.db`);
process.env.DATABASE_URL = dbPath;

const { storage, runMigrations } = await import("./storage");
runMigrations();

test.after(() => {
  // better-sqlite3 keeps its file handle open for the life of the process, and
  // on Windows an open file can't be unlinked (EPERM). Cleanup is best-effort
  // hygiene for a tmpdir file, not a correctness assertion — swallow failures
  // rather than let a locked handle fail the whole suite.
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      fs.rmSync(p, { force: true });
    } catch {
      // ignore — best-effort cleanup only
    }
  }
});

test("createEncounter + getEncounter round-trip", () => {
  const created = storage.createEncounter({
    campaignId: 1,
    status: "active",
    round: 1,
    turnIndex: 0,
    participants: JSON.stringify([{ id: "p1", type: "character", name: "Kira" }]),
  });
  assert.ok(created.id);
  const fetched = storage.getEncounter(created.id);
  assert.equal(fetched?.campaignId, 1);
  assert.equal(fetched?.status, "active");
});

test("getActiveEncounterByCampaign returns only the active one", () => {
  storage.createEncounter({ campaignId: 2, status: "ended", round: 1, turnIndex: 0, participants: "[]" });
  const active = storage.createEncounter({ campaignId: 2, status: "active", round: 1, turnIndex: 0, participants: "[]" });
  const found = storage.getActiveEncounterByCampaign(2);
  assert.equal(found?.id, active.id);
});

test("updateEncounter mutates round/turnIndex/status", () => {
  const created = storage.createEncounter({ campaignId: 3, status: "active", round: 1, turnIndex: 0, participants: "[]" });
  storage.updateEncounter(created.id, { round: 2, turnIndex: 1, status: "ended", outcome: "victory" });
  const fetched = storage.getEncounter(created.id);
  assert.equal(fetched?.round, 2);
  assert.equal(fetched?.turnIndex, 1);
  assert.equal(fetched?.status, "ended");
  assert.equal(fetched?.outcome, "victory");
});

test("createRollLogEntry + getRollLogByEncounter", () => {
  const encounter = storage.createEncounter({ campaignId: 4, status: "active", round: 1, turnIndex: 0, participants: "[]" });
  storage.createRollLogEntry({
    campaignId: 4,
    encounterId: encounter.id,
    characterId: null as any,
    participantId: "p1",
    rollType: "attack",
    statUsed: "str",
    baseModifier: 2,
    effectModifier: 0,
    proficiencyBonus: 3,
    diceResult: 15,
    total: 20,
    targetValue: 13,
    isCritical: false,
    isFumble: false,
    outcome: "hit",
    turnKey: "1:0",
  });
  const entries = storage.getRollLogByEncounter(encounter.id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].outcome, "hit");
  assert.equal(entries[0].total, 20);
});

test("createMessageIdempotent: first submission creates, duplicate is a no-op returning the original", () => {
  const first = storage.createMessageIdempotent({
    campaignId: 5,
    sender: "Kira",
    senderType: "player",
    content: "I attack the goblin",
    messageType: "action",
    clientSubmissionId: "sub-abc-123",
  });
  assert.equal(first.wasCreated, true);

  const duplicate = storage.createMessageIdempotent({
    campaignId: 5,
    sender: "Kira",
    senderType: "player",
    content: "I attack the goblin",
    messageType: "action",
    clientSubmissionId: "sub-abc-123",
  });
  assert.equal(duplicate.wasCreated, false);
  assert.equal(duplicate.message.id, first.message.id);
});

test("createMessageIdempotent: no clientSubmissionId always creates a new message", () => {
  const a = storage.createMessageIdempotent({ campaignId: 6, sender: "Kira", senderType: "player", content: "hi", messageType: "action" });
  const b = storage.createMessageIdempotent({ campaignId: 6, sender: "Kira", senderType: "player", content: "hi", messageType: "action" });
  assert.notEqual(a.message.id, b.message.id);
  assert.equal(a.wasCreated, true);
  assert.equal(b.wasCreated, true);
});
