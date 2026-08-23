// server/srd-manifest-discovery.ts
//
// Fetches both pinned SRD source transports' full real leaf-page lists,
// hashes content, and persists via server/storage.ts's page-scoped CRUD
// (Task 3) — never canonical entity tables, never canonical-id.ts, never
// IngestionStatus. Concurrency-capped AND time-staggered per source group,
// with 429/503 backoff: d20srd.org's real scale (~1,560 leaf pages) makes
// an unbounded, unpaced fetch loop inconsiderate against a small,
// volunteer-run, non-CDN-fronted site.

import { createHash } from "crypto";
import { storage } from "./storage";
import type { CorpusArea, SrdManifestEntry } from "@shared/rules-registry/srd-manifest";

/**
 * Parses a real Retry-After header value in either legal RFC 7231 form:
 * an integer delay-seconds value ("120"), or an HTTP-date value
 * ("Wed, 21 Oct 2015 07:28:00 GMT"). Returns milliseconds to wait, or null
 * if the header is absent or doesn't parse as either legal form — callers
 * fall back to their own backoff schedule in that case, never to zero.
 */
const HTTP_DATE_RE = /^[A-Za-z]{3},\s\d{2}\s[A-Za-z]{3}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT$/;

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return seconds >= 0 ? seconds * 1000 : null;
  }
  // Only trust Date.parse on a string that actually has the RFC 7231
  // IMF-fixdate shape ("Wed, 21 Oct 2015 07:28:00 GMT"). Date.parse itself
  // is far more lenient than the HTTP spec and will happily "parse" garbage
  // like "-5", "+5", "1.5", or "1 2 3" as some past date, which would
  // otherwise silently produce a deltaMs <= 0 and return 0 — zero backoff
  // against a server that is actively asking us to slow down. Reject
  // anything that isn't shaped like a real HTTP-date up front instead.
  if (!HTTP_DATE_RE.test(trimmed)) return null;
  const parsedDateMs = Date.parse(trimmed);
  if (Number.isNaN(parsedDateMs)) return null;
  const deltaMs = parsedDateMs - Date.now();
  return deltaMs > 0 ? deltaMs : 0;
}

/**
 * Retries a fetch on 429/503 responses, respecting a real Retry-After
 * header when the server sends one — in either legal format — else
 * backing off exponentially (500ms, 1000ms, 2000ms). Every other outcome
 * (2xx, any 4xx other than 429, any 5xx other than 503, or a thrown
 * network error) returns/throws immediately on the first attempt — this
 * is politeness against rate-limiting, not a general retry-everything
 * policy.
 */
// Cap on how long any single retry wait is allowed to sleep for, regardless
// of source (Retry-After or exponential fallback). 30s is long enough to be
// genuinely polite to a rate-limiting server, but short enough that one
// page's retry loop can't stall a whole concurrency slot — and by extension
// a real 1,560-page crawl — for an unreasonable amount of time. This also
// guards against a malicious/malformed Retry-After like
// "99999999999999999999": without a clamp that value would overflow
// setTimeout's 32-bit signed delay argument and fire almost immediately,
// which is the exact opposite of the intended backoff.
const MAX_RETRY_WAIT_MS = 30_000;

async function fetchWithBackoff(url: string, fetchImpl: typeof fetch, maxRetries = 3): Promise<Response> {
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchImpl(url);
    if (res.status !== 429 && res.status !== 503) return res;
    lastResponse = res;
    if (attempt === maxRetries) break;
    const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"));
    const rawWaitMs = retryAfterMs !== null ? retryAfterMs : 2 ** attempt * 500;
    const waitMs = Math.min(Math.max(rawWaitMs, 0), MAX_RETRY_WAIT_MS);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return lastResponse!;
}

export async function discoverSourcePage(
  sourceId: number,
  baseUrl: string,
  entry: { corpusArea: CorpusArea; sourcePath: string; discoveredFromPath?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SrdManifestEntry> {
  const sourceUrl = `${baseUrl}${entry.sourcePath}`;
  try {
    const res = await fetchWithBackoff(sourceUrl, fetchImpl);
    if (!res.ok) {
      return storage.recordSrdManifestDiscoveryFailure(
        { sourceId, corpusArea: entry.corpusArea, sourceUrl, sourcePath: entry.sourcePath, discoveredFromPath: entry.discoveredFromPath },
        `HTTP ${res.status}`,
      );
    }
    const text = await res.text();
    const contentHash = createHash("sha256").update(text).digest("hex");
    const result = storage.upsertSrdManifestEntry({
      sourceId, corpusArea: entry.corpusArea, sourceUrl, sourcePath: entry.sourcePath,
      discoveredFromPath: entry.discoveredFromPath, contentHash,
    });
    // Only advance a freshly-discovered row to "hashed" — never regress a
    // row already advanced further (e.g. "parsed" or "source_verified") by
    // a human or a later pipeline stage, just because a routine re-fetch
    // happened to hash identically to what's already on record.
    if (result.processingStatus === "discovered") {
      storage.updateSrdManifestEntryProcessingStatus(result.sourcePageKey, "hashed");
    }
    return storage.getSrdManifestEntry(result.sourcePageKey)!;
  } catch (err) {
    return storage.recordSrdManifestDiscoveryFailure(
      { sourceId, corpusArea: entry.corpusArea, sourceUrl, sourcePath: entry.sourcePath, discoveredFromPath: entry.discoveredFromPath },
      err instanceof Error ? err.message : String(err),
    );
  }
}

// Fixed-window concurrency limiter with a real SHARED request-start
// scheduler — no new dependency. Runs `items` through `worker` with at most
// `limit` in flight at once, AND guarantees every worker's real start time
// (across the whole call, including the initial `limit`-sized batch) is at
// least `delayMs` after the previous worker's start time.
//
// Corrected this round: an earlier design had each worker independently
// `await sleep(delayMs)` before starting once past the first `limit`
// workers. That still let the initial `limit`-sized batch fire as a burst
// (every one of those workers "slept" nothing and started immediately, in
// parallel), and didn't actually guarantee any two *later* starts were
// exactly `delayMs` apart either — each worker's sleep ran independently of
// every other worker's, so their real wall-clock start times could still
// drift arbitrarily close together. `claimStartSlot` fixes this with one
// shared `nextAllowedStartAt` timestamp that every worker call — including
// the very first `limit` of them — reads and advances before it may start.
// The read-then-advance happens synchronously (no `await` in between), and
// JavaScript's single-threaded execution model guarantees no two concurrent
// calls can interleave between the read and the write, so this needs no
// lock/mutex of its own to be race-free.
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  delayMs = 0,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let nextAllowedStartAt = 0; // shared across every call this invocation makes; 0 = no floor yet

  async function claimStartSlot(): Promise<void> {
    if (delayMs <= 0) return;
    const now = Date.now();
    const scheduledStart = Math.max(now, nextAllowedStartAt);
    nextAllowedStartAt = scheduledStart + delayMs; // reserved synchronously, before any await below
    const waitMs = scheduledStart - now;
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  async function runNext(): Promise<void> {
    const index = nextIndex++;
    if (index >= items.length) return;
    await claimStartSlot();
    results[index] = await worker(items[index]);
    return runNext();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
  return results;
}

export async function runSrdManifestDiscovery(
  sources: Array<{
    sourceId: number;
    baseUrl: string;
    entries: Array<{ corpusArea: CorpusArea; sourcePath: string; discoveredFromPath?: string }>;
    concurrency?: number;
    delayMs?: number;
  }>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  for (const source of sources) {
    const results = await runWithConcurrencyLimit(
      source.entries,
      source.concurrency ?? 5,
      (entry) => discoverSourcePage(source.sourceId, source.baseUrl, entry, fetchImpl),
      source.delayMs ?? 50,
    );
    for (const result of results) {
      if (!result.lastError) succeeded++;
      else failed++;
    }
  }
  return { succeeded, failed };
}
