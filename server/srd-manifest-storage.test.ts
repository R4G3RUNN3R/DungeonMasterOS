import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-srd-manifest-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("./storage");
runMigrations();

let sourceId: number;
let sourceKey: string;
test("setup: register a source for manifest rows to reference", () => {
  sourceKey = "dnd35e-srd-storage-test";
  const source = storage.createRuleSource({
    sourceKey,
    title: "Storage Test Source",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "web-enhancement",
    provenanceClassification: "open_game_content",
    licenseClassification: "srd_open",
  });
  sourceId = source.id;
});

test("createSrdManifestEntry always writes ruleset dnd35e and a plain sourcePageKey", () => {
  const entry = storage.createSrdManifestEntry({
    sourceId,
    corpusArea: "spells",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739130921026db42b96e6adff6d3661bffbd/spells/spells-a-b.html",
    sourcePath: "spells/spells-a-b.html",
  });
  assert.equal(entry.ruleset, "dnd35e");
  assert.equal(entry.sourcePageKey, `${sourceKey}::spells/spells-a-b.html`);
  assert.equal(entry.processingStatus, "discovered");
});

test("upsertSrdManifestEntry is a no-op when the content hash hasn't changed", () => {
  const first = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-b-c.html",
    sourcePath: "monsters/monsters-b-c.html",
    contentHash: "abc123",
  });
  storage.updateSrdManifestEntryProcessingStatus(first.sourcePageKey, "hashed");

  const second = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-b-c.html",
    sourcePath: "monsters/monsters-b-c.html",
    contentHash: "abc123",
  });
  assert.equal(second.processingStatus, "hashed", "unchanged hash must not reset processing progress");
});

test("upsertSrdManifestEntry resets processingStatus to discovered and records a revision when the content hash changes", () => {
  const first = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-d-de.html",
    sourcePath: "monsters/monsters-d-de.html",
    contentHash: "hash-v1",
  });
  storage.updateSrdManifestEntryProcessingStatus(first.sourcePageKey, "parsed");

  const second = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-d-de.html",
    sourcePath: "monsters/monsters-d-de.html",
    contentHash: "hash-v2",
  });
  assert.equal(second.contentHash, "hash-v2");
  assert.equal(second.processingStatus, "discovered", "a changed hash must flag the row for re-processing");

  const history = storage.getSourcePageRevisionHistory(first.sourcePageKey);
  assert.equal(history.length, 1);
  assert.equal(history[0].oldContentHash, "hash-v1");
  assert.equal(history[0].newContentHash, "hash-v2");
});

test("upsertSrdManifestEntry: successive real hash changes (v1 -> v2 -> v3) produce strictly increasing revision numbers 1, then 2, never a collision", () => {
  const first = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-revision-order-test.html",
    sourcePath: "monsters/monsters-revision-order-test.html",
    contentHash: "hash-v1",
  });
  // Deliberately do NOT trigger any recordSrdManifestDiscoveryFailure call in
  // between — attemptCount stays 0 throughout this test, which is exactly
  // the scenario that would have produced a duplicate revision number under
  // the old (buggy) `revision: existing.attemptCount + 1` logic.
  storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-revision-order-test.html",
    sourcePath: "monsters/monsters-revision-order-test.html",
    contentHash: "hash-v2",
  });
  storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../monsters/monsters-revision-order-test.html",
    sourcePath: "monsters/monsters-revision-order-test.html",
    contentHash: "hash-v3",
  });

  const history = storage.getSourcePageRevisionHistory(first.sourcePageKey);
  assert.equal(history.length, 2, "two hash changes (v1->v2, v2->v3) must produce exactly two revision rows");
  // getSourcePageRevisionHistory returns newest-first.
  assert.equal(history[1].revision, 1, "the v1->v2 change must be revision 1");
  assert.equal(history[1].oldContentHash, "hash-v1");
  assert.equal(history[1].newContentHash, "hash-v2");
  assert.equal(history[0].revision, 2, "the v2->v3 change must be revision 2, not a duplicate of revision 1");
  assert.equal(history[0].oldContentHash, "hash-v2");
  assert.equal(history[0].newContentHash, "hash-v3");
});

test("upsertSrdManifestEntry clears a stale lastError on a successful re-fetch even when the content hash is unchanged (success -> failure -> success-same-hash)", () => {
  const first = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://www.d20srd.org/srd/monsters/flaky-then-fine.htm",
    sourcePath: "/srd/monsters/flaky-then-fine.htm",
    contentHash: "stable-hash",
  });
  assert.equal(first.lastError, null);

  storage.recordSrdManifestDiscoveryFailure(
    {
      sourceId,
      corpusArea: "monsters",
      sourceUrl: "https://www.d20srd.org/srd/monsters/flaky-then-fine.htm",
      sourcePath: "/srd/monsters/flaky-then-fine.htm",
    },
    "HTTP 503",
  );
  const afterFailure = storage.getSrdManifestEntry(first.sourcePageKey);
  assert.equal(afterFailure?.lastError, "HTTP 503");

  const afterRecovery = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://www.d20srd.org/srd/monsters/flaky-then-fine.htm",
    sourcePath: "/srd/monsters/flaky-then-fine.htm",
    contentHash: "stable-hash",
  });
  assert.equal(afterRecovery.lastError, null, "a successful fetch — even one with an identical, unchanged hash — must clear a stale lastError from an earlier failed attempt");
});

test("two successful identical-hash fetches both advance lastAttemptAt — a true no-op on content is still a real, stamped fetch attempt", async () => {
  const first = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "combat-rules",
    sourceUrl: "https://www.d20srd.org/srd/combat/initiative.htm",
    sourcePath: "/srd/combat/initiative.htm",
    contentHash: "unchanging-hash",
  });
  assert.equal(first.lastError, null);

  // A real, non-zero gap so two ISO timestamps captured in the same test
  // run are guaranteed distinct rather than colliding on millisecond
  // resolution.
  await new Promise((resolve) => setTimeout(resolve, 5));

  const second = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "combat-rules",
    sourceUrl: "https://www.d20srd.org/srd/combat/initiative.htm",
    sourcePath: "/srd/combat/initiative.htm",
    contentHash: "unchanging-hash",
  });
  assert.equal(second.contentHash, "unchanging-hash", "content genuinely did not change");
  assert.notEqual(
    second.lastAttemptAt,
    first.lastAttemptAt,
    "a true same-hash no-op is still a real successful fetch attempt and must advance lastAttemptAt, not just the first ever fetch of a page",
  );

  const history = storage.getSourcePageRevisionHistory(first.sourcePageKey);
  assert.equal(history.length, 0, "two identical-hash fetches must never record a content revision — nothing about the content changed");
});

test("a corrected corpusArea reconciles onto an existing row on a same-hash re-fetch, without creating a false content revision", () => {
  const original = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://www.d20srd.org/srd/epic/feats.htm",
    sourcePath: "/srd/epic/feats.htm",
    contentHash: "epic-feats-content-hash",
  });
  assert.equal(original.corpusArea, "monsters", "seeded with a deliberately WRONG corpusArea, simulating a pre-convergence Task 6 classification that later gets corrected to 'epic'");

  const corrected = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "epic",
    sourceUrl: "https://www.d20srd.org/srd/epic/feats.htm",
    sourcePath: "/srd/epic/feats.htm",
    contentHash: "epic-feats-content-hash", // content itself is unchanged — only the manifest's classification of it was corrected
  });
  assert.equal(corrected.corpusArea, "epic", "a corrected corpusArea from the current generated manifest must reconcile onto the existing row");
  assert.equal(corrected.contentHash, "epic-feats-content-hash");
  assert.equal(corrected.processingStatus, original.processingStatus, "a metadata-only correction must not disturb processingStatus — that's governed solely by content-hash change");

  const history = storage.getSourcePageRevisionHistory(original.sourcePageKey);
  assert.equal(history.length, 0, "correcting corpusArea alone — with an unchanged content hash — must never record a content revision; metadata correction and content revision are separate concepts");
});

test("a corrected sourceUrl and discoveredFromPath also reconcile onto an existing row, independent of corpusArea", () => {
  const original = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "spells",
    sourceUrl: "https://www.d20srd.org/srd/spells/oldPathBeforeSiteReorg.htm",
    sourcePath: "/srd/spells/fireball.htm",
    discoveredFromPath: "/indexes/magicOverview.htm",
    contentHash: "fireball-content-hash",
  });
  assert.equal(original.discoveredFromPath, "/indexes/magicOverview.htm");

  const reconciled = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "spells",
    sourceUrl: "https://www.d20srd.org/srd/spells/fireball.htm",
    sourcePath: "/srd/spells/fireball.htm",
    discoveredFromPath: "/indexes/spells.htm",
    contentHash: "fireball-content-hash",
  });
  assert.equal(reconciled.sourceUrl, "https://www.d20srd.org/srd/spells/fireball.htm");
  assert.equal(reconciled.discoveredFromPath, "/indexes/spells.htm");

  const history = storage.getSourcePageRevisionHistory(original.sourcePageKey);
  assert.equal(history.length, 0, "reconciling sourceUrl/discoveredFromPath with an unchanged content hash must never record a content revision");
});

test("recordSrdManifestDiscoveryFailure also reconciles corrected manifest metadata onto an existing row, even though the fetch itself failed", () => {
  const original = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "monsters",
    sourceUrl: "https://www.d20srd.org/srd/epic/monsters/abomination.htm",
    sourcePath: "/srd/epic/monsters/abomination.htm",
    contentHash: "abomination-content-hash",
  });
  assert.equal(original.corpusArea, "monsters");

  const afterFailedRetryWithCorrectedMetadata = storage.recordSrdManifestDiscoveryFailure(
    {
      sourceId,
      corpusArea: "epic",
      sourceUrl: "https://www.d20srd.org/srd/epic/monsters/abomination.htm",
      sourcePath: "/srd/epic/monsters/abomination.htm",
    },
    "HTTP 503",
  );
  assert.equal(
    afterFailedRetryWithCorrectedMetadata.corpusArea,
    "epic",
    "a corrected corpusArea must reconcile onto the row even when the fetch itself failed — a fetch failure says nothing about whether the manifest's own metadata is still correct",
  );
  assert.equal(afterFailedRetryWithCorrectedMetadata.contentHash, "abomination-content-hash", "content hash from before the failure must be preserved — a failure never touches content state");
});

test("upsertSrdManifestEntry's first real content acquisition after prior fetch failures is NOT a content-changed event — no revision recorded", () => {
  const failedFirst = storage.recordSrdManifestDiscoveryFailure(
    {
      sourceId,
      corpusArea: "skills",
      sourceUrl: "https://www.d20srd.org/srd/skills/fails-first-then-succeeds.htm",
      sourcePath: "/srd/skills/fails-first-then-succeeds.htm",
    },
    "HTTP 500",
  );
  assert.equal(failedFirst.contentHash, null);

  const recovered = storage.upsertSrdManifestEntry({
    sourceId,
    corpusArea: "skills",
    sourceUrl: "https://www.d20srd.org/srd/skills/fails-first-then-succeeds.htm",
    sourcePath: "/srd/skills/fails-first-then-succeeds.htm",
    contentHash: "first-real-hash",
  });
  assert.equal(recovered.contentHash, "first-real-hash");
  assert.equal(recovered.lastError, null);

  const history = storage.getSourcePageRevisionHistory(failedFirst.sourcePageKey);
  assert.equal(history.length, 0, "filling in the first-ever real hash after only-failed prior attempts must not record a revision — nothing about real content changed, since there was never a prior real hash to change from");
});

test("recordSrdManifestDiscoveryFailure creates a row even though no content was ever fetched", () => {
  const entry = storage.recordSrdManifestDiscoveryFailure(
    {
      sourceId,
      corpusArea: "epic",
      sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../epic/does-not-exist.html",
      sourcePath: "epic/does-not-exist.html",
    },
    "404 Not Found",
  );
  assert.equal(entry.lastError, "404 Not Found");
  assert.equal(entry.contentHash, null);
  assert.equal(entry.attemptCount, 1);
});

test("recordSrdManifestDiscoveryFailure preserves discoveredFromPath on a brand-new (first-fetch-failure) row", () => {
  const entry = storage.recordSrdManifestDiscoveryFailure(
    {
      sourceId,
      corpusArea: "open-variants",
      sourceUrl: "https://www.d20srd.org/srd/variant/classes/fails-on-first-fetch.htm",
      sourcePath: "/srd/variant/classes/fails-on-first-fetch.htm",
      discoveredFromPath: "/indexes/variantClasses.htm",
    },
    "HTTP 503",
  );
  assert.equal(
    entry.discoveredFromPath,
    "/indexes/variantClasses.htm",
    "a d20srd leaf that fails its very first fetch must still retain the real root it was discovered from — this was a real gap: the insert branch previously omitted discoveredFromPath entirely",
  );
});

test("recordSrdManifestDiscoveryFailure increments attemptCount on repeat failures for the same page", () => {
  const input = {
    sourceId,
    corpusArea: "epic" as const,
    sourceUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../epic/flaky.html",
    sourcePath: "epic/flaky.html",
  };
  storage.recordSrdManifestDiscoveryFailure(input, "timeout");
  const second = storage.recordSrdManifestDiscoveryFailure(input, "timeout again");
  assert.equal(second.attemptCount, 2);
  assert.equal(second.lastError, "timeout again");
});

test("listSrdManifestEntries filters by corpusArea", () => {
  const spellEntries = storage.listSrdManifestEntries({ corpusArea: "spells" });
  assert.ok(spellEntries.length > 0);
  assert.ok(spellEntries.every((e) => e.corpusArea === "spells"));
});

test("recordSourcePageRevision + getSourcePageRevisionHistory round-trip, newest first", () => {
  storage.recordSourcePageRevision({
    sourcePageKey: "manual-test::page.html", revision: 1, changeReason: "initial discovery",
  });
  storage.recordSourcePageRevision({
    sourcePageKey: "manual-test::page.html", revision: 2, changeReason: "content changed on re-scan",
    oldContentHash: "h1", newContentHash: "h2",
  });
  const history = storage.getSourcePageRevisionHistory("manual-test::page.html");
  assert.equal(history.length, 2);
  assert.equal(history[0].revision, 2);
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
