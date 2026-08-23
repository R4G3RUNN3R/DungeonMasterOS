// server/dnd35e/extraction/run-feats-extraction.ts
//
// Task 5's real extraction run (110 real feats, hash-verified against the
// live page, written into the real dev database) was originally performed
// via a temporary, uncommitted script — this is that script, committed and
// made reproducible, matching the exact precedent Phase 2A set with
// scripts/register-srd-sources.ts and scripts/run-srd-manifest-acceptance-scan.ts
// (both committed, both real-network, both excluded from the automated test
// suite via package.json's `test` glob, which only matches *.test.ts files).
//
// Connects the two previously-isolated halves of the pipeline:
//   extractFeatsFromHtml (server/dnd35e/extraction/feats-extractor.ts, pure,
//     unit-tested in isolation) and upsertDnd35eFeatDefinition
//   (server/storage.ts, also unit-tested in isolation) — there was no
//   committed code connecting the two outside of each module's own tests.
//
// Fail-closed content-hash discipline, matching Phase 2A's established
// pattern (see scripts/run-srd-manifest-acceptance-scan.ts and
// server/srd-manifest-discovery.ts): before extracting, the real page is
// re-fetched and its SHA-256 compared against the hash Phase 2A's real
// acceptance scan recorded in srd_manifest_entries for this exact page. Any
// mismatch stops extraction rather than silently extracting from
// unverified/drifted content.
//
// This script performs a real network fetch. It is NOT part of the
// automated test suite (package.json's `test` script only globs *.test.ts
// files, which this is not) — it's a real, re-runnable one-off tool, run
// manually when a fresh checkout or a future contributor needs to
// reproduce/refresh the dnd35e_feat_definitions table from the live source.
//
// Re-run with: node --import tsx server/dnd35e/extraction/run-feats-extraction.ts
// Targets the real dev database (server/storage.ts's default DATABASE_URL,
// data.db) unless DATABASE_URL is overridden. Do NOT point this at the live
// VPS database.
//
// See docs/superpowers/notes/2026-08-23-dnd35e-feats-extraction-report.md
// for the real report this script's original ad-hoc predecessor produced.

import { createHash } from "node:crypto";
import { storage, runMigrations } from "../../storage";
import { extractFeatsFromHtml } from "./feats-extractor";

const SOURCE_PAGE_KEY = "dnd35e-srd-hypertext-d20::/srd/feats.htm";

async function runFeatsExtraction(): Promise<void> {
  const manifestEntry = storage.getSrdManifestEntry(SOURCE_PAGE_KEY);
  if (!manifestEntry) {
    throw new Error(
      `SRD manifest entry "${SOURCE_PAGE_KEY}" not found. Run Phase 2A's acceptance scan first: ` +
        `node --import tsx scripts/run-srd-manifest-acceptance-scan.ts`,
    );
  }
  if (!manifestEntry.contentHash) {
    throw new Error(
      `SRD manifest entry "${SOURCE_PAGE_KEY}" has no recorded contentHash — it has not been ` +
        `successfully hashed by discovery yet. Run Phase 2A's acceptance scan first: ` +
        `node --import tsx scripts/run-srd-manifest-acceptance-scan.ts`,
    );
  }

  console.log(`Re-fetching ${manifestEntry.sourceUrl} to verify content hash before extracting...`);
  const res = await fetch(manifestEntry.sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to re-fetch ${manifestEntry.sourceUrl}: HTTP ${res.status}`);
  }
  const html = await res.text();
  const freshHash = createHash("sha256").update(html).digest("hex");

  if (freshHash !== manifestEntry.contentHash) {
    throw new Error(
      `Content hash drift detected for "${SOURCE_PAGE_KEY}". ` +
        `Manifest recorded contentHash=${manifestEntry.contentHash}, but a fresh fetch just now hashed to ${freshHash}. ` +
        `The live page has changed since Phase 2A's scan — refusing to extract from unverified content. ` +
        `Re-run Phase 2A's acceptance scan to re-pin, then re-run this script.`,
    );
  }
  console.log("Content hash verified — extracting from confirmed-current content.");

  const feats = extractFeatsFromHtml(html);
  console.log(`Extracted ${feats.length} real feats from ${manifestEntry.sourceUrl}.`);

  const countsByStatus: Record<string, number> = {};
  for (const feat of feats) {
    storage.upsertDnd35eFeatDefinition(feat, { kind: "open_canonical", sourcePageKey: SOURCE_PAGE_KEY });
    countsByStatus[feat.extractionStatus] = (countsByStatus[feat.extractionStatus] ?? 0) + 1;
  }

  console.log(`Total real feats extracted: ${feats.length}`);
  for (const [status, count] of Object.entries(countsByStatus)) {
    console.log(`  ${status}: ${count}`);
  }
}

async function main() {
  runMigrations();
  await runFeatsExtraction();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
