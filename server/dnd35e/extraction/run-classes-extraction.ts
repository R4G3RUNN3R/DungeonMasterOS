// server/dnd35e/extraction/run-classes-extraction.ts
//
// Real, committed, re-runnable extraction script for the classes entity
// family — mirrors run-feats-extraction.ts / run-races-extraction.ts (same
// content-hash fail-closed discipline, same real-network/real-DB shape,
// same exclusion from the automated test suite via package.json's
// *.test.ts glob).
//
// Currently extracts Fighter, Barbarian, Rogue, Monk (non-spellcasters) and
// Cleric (the first real prepared-caster, verified against its real "Spells
// per Day" table). The remaining 6 core classes (Bard, Druid, Paladin,
// Ranger, Sorcerer, Wizard) still need real per-page verification — Sorcerer
// and Bard are spontaneous casters and need a real "Spells Known" table this
// extractor doesn't parse yet. See classes.ts and the extraction report for
// the explicit scope gap this leaves. Structured as a list so extending to
// more class pages is a one-line addition once each is real-verified, not a
// rewrite.
//
// Re-run with: node --import tsx server/dnd35e/extraction/run-classes-extraction.ts
// Targets the real dev database (server/storage.ts's default DATABASE_URL,
// data.db) unless DATABASE_URL is overridden. Do NOT point this at the live
// VPS database.

import { createHash } from "node:crypto";
import { storage, runMigrations } from "../../storage";
import { extractClassFromHtml } from "./classes-extractor";

const CLASS_SOURCE_PAGE_KEYS = [
  "dnd35e-srd-hypertext-d20::/srd/classes/fighter.htm",
  "dnd35e-srd-hypertext-d20::/srd/classes/barbarian.htm",
  "dnd35e-srd-hypertext-d20::/srd/classes/rogue.htm",
  "dnd35e-srd-hypertext-d20::/srd/classes/monk.htm",
  "dnd35e-srd-hypertext-d20::/srd/classes/cleric.htm",
  "dnd35e-srd-hypertext-d20::/srd/classes/druid.htm",
  "dnd35e-srd-hypertext-d20::/srd/classes/paladin.htm",
  "dnd35e-srd-hypertext-d20::/srd/classes/ranger.htm",
];

async function runClassExtraction(sourcePageKey: string): Promise<void> {
  const manifestEntry = storage.getSrdManifestEntry(sourcePageKey);
  if (!manifestEntry) {
    throw new Error(
      `SRD manifest entry "${sourcePageKey}" not found. Run Phase 2A's acceptance scan first: ` +
        `node --import tsx scripts/run-srd-manifest-acceptance-scan.ts`,
    );
  }
  if (!manifestEntry.contentHash) {
    throw new Error(
      `SRD manifest entry "${sourcePageKey}" has no recorded contentHash — it has not been ` +
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
      `Content hash drift detected for "${sourcePageKey}". ` +
        `Manifest recorded contentHash=${manifestEntry.contentHash}, but a fresh fetch just now hashed to ${freshHash}. ` +
        `The live page has changed since Phase 2A's scan — refusing to extract from unverified content. ` +
        `Re-run Phase 2A's acceptance scan to re-pin, then re-run this script.`,
    );
  }
  console.log("Content hash verified — extracting from confirmed-current content.");

  const cls = extractClassFromHtml(html);
  storage.upsertDnd35eClassDefinition(cls, { kind: "open_canonical", sourcePageKey });
  console.log(`Extracted real class "${cls.name}" (${cls.canonicalId}): ${cls.extractionStatus}, ${cls.levelProgression.length} level rows, ${cls.classFeatures.length} class features.`);
}

async function main() {
  runMigrations();
  for (const sourcePageKey of CLASS_SOURCE_PAGE_KEYS) {
    await runClassExtraction(sourcePageKey);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
