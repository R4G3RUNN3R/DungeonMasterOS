// server/dnd35e/extraction/run-races-extraction.ts
//
// Real, committed, re-runnable extraction script for the races entity
// family — mirrors run-feats-extraction.ts exactly (same content-hash
// fail-closed discipline, same real-network/real-DB shape, same exclusion
// from the automated test suite via package.json's *.test.ts glob).
//
// Re-run with: node --import tsx server/dnd35e/extraction/run-races-extraction.ts
// Targets the real dev database (server/storage.ts's default DATABASE_URL,
// data.db) unless DATABASE_URL is overridden. Do NOT point this at the live
// VPS database.

import { createHash } from "node:crypto";
import { storage, runMigrations } from "../../storage";
import { extractRacesFromHtml } from "./races-extractor";

const SOURCE_PAGE_KEY = "dnd35e-srd-hypertext-d20::/srd/races.htm";

async function runRacesExtraction(): Promise<void> {
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

  const races = extractRacesFromHtml(html);
  console.log(`Extracted ${races.length} real races from ${manifestEntry.sourceUrl}.`);

  const countsByStatus: Record<string, number> = {};
  for (const race of races) {
    storage.upsertDnd35eRaceDefinition(race, { kind: "open_canonical", sourcePageKey: SOURCE_PAGE_KEY });
    countsByStatus[race.extractionStatus] = (countsByStatus[race.extractionStatus] ?? 0) + 1;
  }

  console.log(`Total real races extracted: ${races.length}`);
  for (const [status, count] of Object.entries(countsByStatus)) {
    console.log(`  ${status}: ${count}`);
  }
}

async function main() {
  runMigrations();
  await runRacesExtraction();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
