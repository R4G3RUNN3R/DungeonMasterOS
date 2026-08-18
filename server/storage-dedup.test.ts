// server/storage-dedup.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const dbPath = path.join(os.tmpdir(), `dmos-storage-dedup-test-${Date.now()}.db`);
process.env.DATABASE_URL = dbPath;

const { storage, runMigrations } = await import("./storage");
runMigrations();

test("getMessageBySubmissionId: finds an existing message by campaign + submission id", async () => {
  const campaign = storage.createCampaign({ userId: 1, name: "Test", inviteCode: `test-invite-${Date.now()}`, hostVisitorId: "visitor-1", tone: "grim", rulesWeight: "light", powerLevel: "standard", worldType: "fantasy", combatStyle: "tactical", storyMode: false, worldGenStyle: "guided" } as any);

  const { message } = storage.createMessageIdempotent({
    campaignId: campaign.id,
    sender: "Kira",
    senderType: "player",
    content: "I attack",
    messageType: "action",
    clientSubmissionId: "sub-abc",
  });

  const found = storage.getMessageBySubmissionId(campaign.id, "sub-abc");
  assert.equal(found?.id, message.id);

  const notFound = storage.getMessageBySubmissionId(campaign.id, "sub-does-not-exist");
  assert.equal(notFound, undefined);
});

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
