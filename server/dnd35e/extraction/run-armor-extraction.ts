// server/dnd35e/extraction/run-armor-extraction.ts
//
// Real, committed, re-runnable extraction script for the Armor/Shields
// entity family. Covers the single real d20srd.org "Table: Armor and
// Shields" page (21 real rows: 4 light + 4 medium + 4 heavy + 6 shields +
// 3 extras).
//
// Re-run with: node --import tsx server/dnd35e/extraction/run-armor-extraction.ts
// Targets the real dev database (server/storage.ts's default DATABASE_URL,
// data.db) unless DATABASE_URL is overridden. Do NOT point this at the live
// VPS database.

import { createHash } from "node:crypto";
import { storage, runMigrations } from "../../storage";
import { extractArmorFromHtml } from "./armor-extractor";

const PRIMARY_PAGE_KEY = "dnd35e-srd-hypertext-d20::/srd/equipment/armor.htm";

async function main() {
  runMigrations();

  const manifestEntry = storage.getSrdManifestEntry(PRIMARY_PAGE_KEY);
  if (!manifestEntry) throw new Error(`SRD manifest entry "${PRIMARY_PAGE_KEY}" not found.`);
  if (!manifestEntry.contentHash) throw new Error(`SRD manifest entry "${PRIMARY_PAGE_KEY}" has no recorded contentHash.`);

  console.log("Fetching and verifying the real armor page...");
  const res = await fetch(manifestEntry.sourceUrl);
  if (!res.ok) throw new Error(`Failed to re-fetch ${manifestEntry.sourceUrl}: HTTP ${res.status}`);
  const html = await res.text();
  const freshHash = createHash("sha256").update(html).digest("hex");
  if (freshHash !== manifestEntry.contentHash) {
    throw new Error(`Content hash drift for "${PRIMARY_PAGE_KEY}". Manifest recorded ${manifestEntry.contentHash}, fresh fetch hashed to ${freshHash}.`);
  }

  const { armor, notes } = extractArmorFromHtml(html);
  console.log(`Extracted ${armor.length} real armor/shield entries.`);
  if (notes.length > 0) console.log("Table-level notes:", notes);

  for (const item of armor) {
    storage.upsertDnd35eArmorDefinition(item, { kind: "open_canonical", sourcePageKey: PRIMARY_PAGE_KEY });
  }

  const counts: Record<string, number> = {};
  for (const item of armor) counts[item.extractionStatus] = (counts[item.extractionStatus] ?? 0) + 1;
  console.log("\nReal armor extractionStatus summary:");
  for (const [status, count] of Object.entries(counts)) console.log(`  ${status}: ${count}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
