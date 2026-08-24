// server/dnd35e/extraction/run-spells-extraction.ts
//
// Real, committed, re-runnable extraction script for the individual spell-
// description entity family — mirrors the other run-*-extraction.ts
// scripts (same content-hash fail-closed discipline, same real-network/
// real-DB shape, same exclusion from the automated test suite via
// package.json's *.test.ts glob).
//
// Covers every real individual spell page already discovered in the SRD
// manifest's "spells" corpus area (608 real pages, all with a real
// contentHash recorded by Phase 2A's acceptance scan). A small real delay
// between requests (matching the discovery script's own considerate-
// crawling precedent) avoids hammering the live site across ~600 real
// sequential fetches.
//
// Re-run with: node --import tsx server/dnd35e/extraction/run-spells-extraction.ts
// Targets the real dev database (server/storage.ts's default DATABASE_URL,
// data.db) unless DATABASE_URL is overridden. Do NOT point this at the live
// VPS database.

import { createHash } from "node:crypto";
import { storage, runMigrations } from "../../storage";
import { extractSpellFromHtml } from "./spells-extractor";

const DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOne(sourcePageKey: string): Promise<{ status: string } | { error: string }> {
  const manifestEntry = storage.getSrdManifestEntry(sourcePageKey);
  if (!manifestEntry) return { error: `SRD manifest entry "${sourcePageKey}" not found.` };
  if (!manifestEntry.contentHash) return { error: `SRD manifest entry "${sourcePageKey}" has no recorded contentHash.` };

  const res = await fetch(manifestEntry.sourceUrl);
  if (!res.ok) return { error: `Failed to re-fetch ${manifestEntry.sourceUrl}: HTTP ${res.status}` };
  const html = await res.text();
  const freshHash = createHash("sha256").update(html).digest("hex");
  if (freshHash !== manifestEntry.contentHash) {
    return { error: `Content hash drift for "${sourcePageKey}". Manifest recorded ${manifestEntry.contentHash}, fresh fetch hashed to ${freshHash}.` };
  }

  try {
    const spell = extractSpellFromHtml(html);
    storage.upsertDnd35eSpellDefinition(spell, { kind: "open_canonical", sourcePageKey });
    return { status: spell.extractionStatus };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  runMigrations();
  const allEntries = storage.listSrdManifestEntries();
  const spellPageKeys = allEntries.filter((e) => e.sourcePath.startsWith("/srd/spells/")).map((e) => e.sourcePageKey);
  console.log(`Found ${spellPageKeys.length} real individual spell pages in the manifest.`);

  const counts: Record<string, number> = {};
  const errors: string[] = [];
  let processed = 0;
  for (const sourcePageKey of spellPageKeys) {
    const result = await runOne(sourcePageKey);
    processed++;
    if ("error" in result) {
      errors.push(`${sourcePageKey}: ${result.error}`);
      console.error(`FAILED (${processed}/${spellPageKeys.length}): ${sourcePageKey}: ${result.error}`);
    } else {
      counts[result.status] = (counts[result.status] ?? 0) + 1;
      if (processed % 25 === 0 || processed === spellPageKeys.length) {
        console.log(`Progress: ${processed}/${spellPageKeys.length} (${errors.length} errors so far)`);
      }
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nTotal real spells extracted: ${spellPageKeys.length - errors.length} of ${spellPageKeys.length}`);
  for (const [status, count] of Object.entries(counts)) {
    console.log(`  ${status}: ${count}`);
  }
  if (errors.length > 0) {
    console.error(`\n${errors.length} real failures (not silently swallowed):`);
    for (const e of errors) console.error(`  ${e}`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
