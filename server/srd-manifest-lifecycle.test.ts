import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-srd-lifecycle-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("./storage");
runMigrations();

let sourceId: number;
before(() => {
  sourceId = storage.createRuleSource({
    sourceKey: "dnd35e-srd-lifecycle-test", title: "Lifecycle Test Source",
    ruleset: "dnd35e", setting: "generic", publicationType: "web-enhancement",
    provenanceClassification: "open_game_content", licenseClassification: "srd_open",
  }).id;
});

test("recordSourcePageVerification rejects verification before processingStatus reaches source_verified", () => {
  // A real /srd/ leaf page, never a discovery-root /indexes/ path — this
  // round's correction to the round/leaf invariant established in a prior
  // review round (a discovery root is not itself a rules-bearing leaf page).
  const entry = storage.createSrdManifestEntry({
    sourceId, corpusArea: "feats",
    sourceUrl: "https://www.d20srd.org/srd/feats.htm", sourcePath: "/srd/feats.htm",
  });
  assert.throws(() => storage.recordSourcePageVerification(entry.sourcePageKey, { method: "human_review" }));
});

test("a manifest entry can be hand-advanced through discovered -> fetched -> hashed -> parsed -> source_verified, each transition recorded", () => {
  const entry = storage.createSrdManifestEntry({
    sourceId, corpusArea: "spells",
    sourceUrl: "https://www.d20srd.org/srd/spells/fireball.htm", sourcePath: "/srd/spells/fireball.htm",
  });
  assert.equal(entry.processingStatus, "discovered");

  storage.updateSrdManifestEntryProcessingStatus(entry.sourcePageKey, "fetched");
  storage.updateSrdManifestEntryProcessingStatus(entry.sourcePageKey, "hashed");
  storage.updateSrdManifestEntryProcessingStatus(entry.sourcePageKey, "parsed");
  storage.recordSourcePageRevision({
    sourcePageKey: entry.sourcePageKey, revision: 1,
    changeReason: "manually confirmed page structure matches the expected /srd/ leaf-page format", changedBy: "controller",
  });

  storage.updateSrdManifestEntryProcessingStatus(entry.sourcePageKey, "source_verified");
  storage.recordSourcePageVerification(entry.sourcePageKey, {
    method: "human_review", verifiedBy: "controller", verifiedAt: new Date().toISOString(),
  });

  const final = storage.getSrdManifestEntry(entry.sourcePageKey);
  assert.equal(final?.processingStatus, "source_verified");
  assert.equal(final?.verificationMethod, "human_review");

  const report = storage.getSourcePageCoverageReport();
  assert.ok(report.sourceVerifiedCount >= 1);
});

test("upsertSrdManifestEntry clears stale verification metadata when content hash genuinely changes on an already-verified page", () => {
  const created = storage.upsertSrdManifestEntry({
    sourceId, corpusArea: "spells",
    sourceUrl: "https://www.d20srd.org/srd/spells/magicMissile.htm", sourcePath: "/srd/spells/magicMissile.htm",
    contentHash: "original-real-hash",
  });
  storage.updateSrdManifestEntryProcessingStatus(created.sourcePageKey, "fetched");
  storage.updateSrdManifestEntryProcessingStatus(created.sourcePageKey, "hashed");
  storage.updateSrdManifestEntryProcessingStatus(created.sourcePageKey, "parsed");
  storage.updateSrdManifestEntryProcessingStatus(created.sourcePageKey, "source_verified");
  storage.recordSourcePageVerification(created.sourcePageKey, {
    method: "human_review", verifiedBy: "controller", verifiedAt: new Date().toISOString(), notes: "confirmed against the real live page",
  });

  const verified = storage.getSrdManifestEntry(created.sourcePageKey);
  assert.equal(verified?.processingStatus, "source_verified");
  assert.equal(verified?.verificationMethod, "human_review");

  const afterChange = storage.upsertSrdManifestEntry({
    sourceId, corpusArea: "spells",
    sourceUrl: "https://www.d20srd.org/srd/spells/magicMissile.htm", sourcePath: "/srd/spells/magicMissile.htm",
    contentHash: "a-genuinely-different-real-hash",
  });

  assert.equal(afterChange.processingStatus, "discovered", "genuinely changed content must fall back to unverified — it needs re-processing from scratch");
  assert.equal(afterChange.verificationMethod, null, "a verification record describing the OLD content must not survive attached to genuinely different content");
  assert.equal(afterChange.verifiedBy, null);
  assert.equal(afterChange.verifiedAt, null);
  assert.equal(afterChange.verificationNotes, null);

  const history = storage.getSourcePageRevisionHistory(created.sourcePageKey);
  assert.equal(history.length, 1);
  assert.equal(history[0].oldContentHash, "original-real-hash");
  assert.equal(history[0].newContentHash, "a-genuinely-different-real-hash");
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
