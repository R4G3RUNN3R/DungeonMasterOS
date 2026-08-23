import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-srd-discovery-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("./storage");
runMigrations();
const { discoverSourcePage, runSrdManifestDiscovery } = await import("./srd-manifest-discovery");

let olimotSourceId: number;
let d20srdSourceId: number;
before(() => {
  olimotSourceId = storage.createRuleSource({
    sourceKey: "dnd35e-srd-olimot-discovery-test", title: "Olimot Discovery Test",
    ruleset: "dnd35e", setting: "generic", publicationType: "web-enhancement",
    provenanceClassification: "open_game_content", licenseClassification: "srd_open",
  }).id;
  d20srdSourceId = storage.createRuleSource({
    sourceKey: "dnd35e-srd-d20-discovery-test", title: "d20srd Discovery Test",
    ruleset: "dnd35e", setting: "generic", publicationType: "web-enhancement",
    provenanceClassification: "open_game_content", licenseClassification: "srd_open",
  }).id;
});

function fakeFetchOk(body: string) { return async () => new Response(body, { status: 200 }); }
function fakeFetch404() { return async () => new Response("not found", { status: 404 }); }
function fakeFetchThrows(message: string) { return async () => { throw new Error(message); }; }

test("discoverSourcePage writes a hashed row on success", async () => {
  const entry = await discoverSourcePage(
    olimotSourceId, "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../",
    { corpusArea: "spells", sourcePath: "spells/spells-a-b.html" },
    fakeFetchOk("<html>fake page</html>"),
  );
  assert.equal(entry.processingStatus, "hashed");
  assert.equal(entry.contentHash!.length, 64);
});

test("discoverSourcePage records a loud failure (never throws) on a 404", async () => {
  const entry = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "open-variants", sourcePath: "/srd/variant/does-not-exist.htm" },
    fakeFetch404(),
  );
  assert.equal(entry.lastError, "HTTP 404");
});

test("discoverSourcePage records a loud failure (never throws) when fetch itself throws", async () => {
  const entry = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "core", sourcePath: "/srd/network-error.htm" },
    fakeFetchThrows("ECONNRESET"),
  );
  assert.equal(entry.lastError, "ECONNRESET");
});

test("runSrdManifestDiscovery runs both sources through the same pipeline and never aborts on one page's failure", async () => {
  const mixedFetch: typeof fetch = async (url) => {
    if (String(url).includes("spells-a-b")) return new Response("<html>ok</html>", { status: 200 });
    return new Response("gone", { status: 404 });
  };
  const result = await runSrdManifestDiscovery(
    [
      { sourceId: olimotSourceId, baseUrl: "https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@faab739.../", delayMs: 0,
        entries: [{ corpusArea: "spells", sourcePath: "spells/spells-a-b.html" }, { corpusArea: "spells", sourcePath: "spells/spells-c.html" }] },
      { sourceId: d20srdSourceId, baseUrl: "https://www.d20srd.org", delayMs: 0,
        entries: [{ corpusArea: "open-variants", sourcePath: "/srd/variant/races/strongheart.htm" }] },
    ],
    mixedFetch,
  );
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 2);
});

test("discoveredFromPath is passed through to the persisted manifest entry", async () => {
  const entry = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "spells", sourcePath: "/srd/spells/fireball.htm", discoveredFromPath: "/indexes/spells.htm" },
    fakeFetchOk("<html>fake fireball page</html>"),
  );
  const reloaded = storage.getSrdManifestEntry(entry.sourcePageKey);
  assert.equal(reloaded?.discoveredFromPath, "/indexes/spells.htm");
});

test("runSrdManifestDiscovery never runs more than the configured concurrency limit in flight at once for a source group", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const trackingFetch: typeof fetch = async (url) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    return new Response("<html>ok</html>", { status: 200 });
  };
  const manyEntries = Array.from({ length: 20 }, (_, i) => ({
    corpusArea: "spells" as const, sourcePath: `/srd/spells/concurrency-test-${i}.htm`,
  }));
  await runSrdManifestDiscovery(
    [{ sourceId: d20srdSourceId, baseUrl: "https://www.d20srd.org", entries: manyEntries, concurrency: 3, delayMs: 0 }],
    trackingFetch,
  );
  assert.ok(maxInFlight <= 3, `expected at most 3 concurrent fetches, observed ${maxInFlight}`);
});

test("runSrdManifestDiscovery's delayMs stagger is a real SHARED scheduler — every request start is spaced out, including within the initial concurrency-sized batch, not just requests beyond it", async () => {
  const startTimestamps: number[] = [];
  const timestampingFetch: typeof fetch = async () => {
    startTimestamps.push(Date.now());
    return new Response("<html>ok</html>", { status: 200 });
  };
  const manyEntries = Array.from({ length: 8 }, (_, i) => ({
    corpusArea: "spells" as const, sourcePath: `/srd/spells/pacing-test-${i}.htm`,
  }));
  const DELAY_MS = 20;
  await runSrdManifestDiscovery(
    [{ sourceId: d20srdSourceId, baseUrl: "https://www.d20srd.org", entries: manyEntries, concurrency: 5, delayMs: DELAY_MS }],
    timestampingFetch,
  );
  assert.equal(startTimestamps.length, 8);
  // The scheduler's real guarantee is an ABSOLUTE one: each request's start
  // time is at least i * delayMs after the very first request's start time
  // (start_i >= start_0 + i * delayMs) — not a pairwise gap between
  // consecutive starts. A late-but-still-honored reservation can make the
  // NEXT pairwise gap look artificially small even though nothing is
  // actually wrong, which made the pairwise version of this assertion flaky
  // under real contention. The cumulative/absolute property is what the
  // shared `nextAllowedStartAt` scheduler actually enforces, so assert that
  // instead.
  for (let i = 0; i < startTimestamps.length; i++) {
    const minExpectedStart = startTimestamps[0] + i * DELAY_MS;
    assert.ok(
      startTimestamps[i] >= minExpectedStart - 5, // small real-timer-jitter tolerance, not a design concession
      `request ${i} started at ${startTimestamps[i]}, expected at least ${minExpectedStart} (start_0 + ${i}*${DELAY_MS}ms) — the scheduler guarantees a real absolute floor on each request's start time relative to the first request, which is a stronger and more stable property to test than a pairwise gap (a late-but-still-honored reservation can make the NEXT pairwise gap look artificially small even when nothing is wrong)`,
    );
  }
});

test("discoverSourcePage retries a 429 response via backoff and succeeds once the server recovers", async () => {
  let callCount = 0;
  const flakyRateLimitedFetch: typeof fetch = async () => {
    callCount++;
    if (callCount < 3) return new Response("slow down", { status: 429, headers: { "Retry-After": "0" } });
    return new Response("<html>ok</html>", { status: 200 });
  };
  const entry = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "core", sourcePath: "/srd/rateLimitedThenOk.htm" },
    flakyRateLimitedFetch,
  );
  assert.equal(callCount, 3, "must have retried the 429 twice before the third attempt succeeded");
  assert.equal(entry.lastError, null);
  assert.equal(entry.processingStatus, "hashed");
});

test("discoverSourcePage's backoff parses an HTTP-date Retry-After header, not just the integer-seconds form", async () => {
  let callCount = 0;
  const httpDateRetryAfter = new Date(Date.now() + 10).toUTCString();
  const dateFormRateLimitedFetch: typeof fetch = async () => {
    callCount++;
    if (callCount < 2) return new Response("slow down", { status: 429, headers: { "Retry-After": httpDateRetryAfter } });
    return new Response("<html>ok</html>", { status: 200 });
  };
  const entry = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "core", sourcePath: "/srd/rateLimitedHttpDateForm.htm" },
    dateFormRateLimitedFetch,
  );
  assert.equal(callCount, 2, "must have retried once, honoring the HTTP-date Retry-After form, before the second attempt succeeded");
  assert.equal(entry.lastError, null);
});

test("discoverSourcePage records a real failure (never throws) after a 429 that never recovers within the retry budget", async () => {
  const alwaysRateLimitedFetch: typeof fetch = async () => new Response("slow down", { status: 429, headers: { "Retry-After": "0" } });
  const entry = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "core", sourcePath: "/srd/alwaysRateLimited.htm" },
    alwaysRateLimitedFetch,
  );
  assert.equal(entry.lastError, "HTTP 429");
});

test("discoverSourcePage never regresses a processingStatus a later pipeline stage already advanced, on a routine re-fetch of unchanged content", async () => {
  const stableFetch = fakeFetchOk("<html>already-processed page</html>");
  const first = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "skills", sourcePath: "/srd/skills/already-processed.htm" },
    stableFetch,
  );
  assert.equal(first.processingStatus, "hashed");

  storage.updateSrdManifestEntryProcessingStatus(first.sourcePageKey, "parsed");

  const second = await discoverSourcePage(
    d20srdSourceId, "https://www.d20srd.org",
    { corpusArea: "skills", sourcePath: "/srd/skills/already-processed.htm" },
    stableFetch,
  );
  assert.equal(second.processingStatus, "parsed", "a routine re-fetch with unchanged content must never regress an already-advanced processingStatus back to 'hashed'");
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
