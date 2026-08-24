// server/dnd35e/extraction/run-weapons-extraction.ts
//
// Real, committed, re-runnable extraction script for the Weapons/
// Ammunition entity families. Unlike the per-page-per-entity families
// (Spells, Feats, ...), this covers exactly ONE real primary page
// (d20srd.org's "Table: Weapons", holding all 83 real weapon/ammunition
// rows) plus a real cross-transport reconciliation pass against the
// olimot/srd-v3.5 mirror's overlapping real weapons table.
//
// Re-run with: node --import tsx server/dnd35e/extraction/run-weapons-extraction.ts
// Targets the real dev database (server/storage.ts's default DATABASE_URL,
// data.db) unless DATABASE_URL is overridden. Do NOT point this at the live
// VPS database.

import { createHash } from "node:crypto";
import { storage, runMigrations } from "../../storage";
import { extractWeaponsFromHtml } from "./weapons-extractor";
import { extractOlimotWeaponRows } from "./weapons-crosscheck-olimot";
import { reconcileWeapon } from "./weapons-crosscheck-reconciliation";

const PRIMARY_PAGE_KEY = "dnd35e-srd-hypertext-d20::/srd/equipment/weapons.htm";
const CROSS_CHECK_PAGE_KEY = "dnd35e-srd-olimot-mirror::basic-rules-and-legal/equipment.html";

async function fetchAndVerify(sourcePageKey: string): Promise<string> {
  const manifestEntry = storage.getSrdManifestEntry(sourcePageKey);
  if (!manifestEntry) throw new Error(`SRD manifest entry "${sourcePageKey}" not found.`);
  if (!manifestEntry.contentHash) throw new Error(`SRD manifest entry "${sourcePageKey}" has no recorded contentHash.`);
  const res = await fetch(manifestEntry.sourceUrl);
  if (!res.ok) throw new Error(`Failed to re-fetch ${manifestEntry.sourceUrl}: HTTP ${res.status}`);
  const html = await res.text();
  const freshHash = createHash("sha256").update(html).digest("hex");
  if (freshHash !== manifestEntry.contentHash) {
    throw new Error(`Content hash drift for "${sourcePageKey}". Manifest recorded ${manifestEntry.contentHash}, fresh fetch hashed to ${freshHash}.`);
  }
  return html;
}

async function main() {
  runMigrations();

  console.log("Fetching and verifying the primary transport (d20srd.org)...");
  const primaryHtml = await fetchAndVerify(PRIMARY_PAGE_KEY);
  const { weapons, ammunition, notes } = extractWeaponsFromHtml(primaryHtml);
  console.log(`Extracted ${weapons.length} real weapons and ${ammunition.length} real ammunition entries.`);
  if (notes.length > 0) console.log("Table-level notes:", notes);

  for (const weapon of weapons) {
    storage.upsertDnd35eWeaponDefinition(weapon, { kind: "open_canonical", sourcePageKey: PRIMARY_PAGE_KEY });
  }
  for (const ammo of ammunition) {
    storage.upsertDnd35eAmmunitionDefinition(ammo, { kind: "open_canonical", sourcePageKey: PRIMARY_PAGE_KEY });
  }

  console.log("Fetching and verifying the cross-check transport (olimot/srd-v3.5 mirror)...");
  const crossCheckHtml = await fetchAndVerify(CROSS_CHECK_PAGE_KEY);
  const crossCheckRows = extractOlimotWeaponRows(crossCheckHtml);
  console.log(`Extracted ${crossCheckRows.length} real cross-check rows.`);

  const tally: Record<string, number> = {};
  for (const weapon of weapons) {
    const result = reconcileWeapon(weapon, crossCheckRows);
    storage.recordDnd35eWeaponCrossCheckResult({
      canonicalId: result.canonicalId,
      primarySourcePageKey: PRIMARY_PAGE_KEY,
      crossCheckSourcePageKey: CROSS_CHECK_PAGE_KEY,
      agreementStatus: result.agreementStatus,
      conflictingFields: result.conflictingFields,
    });
    tally[result.agreementStatus] = (tally[result.agreementStatus] ?? 0) + 1;
    if (result.agreementStatus === "conflicts") {
      console.log(`  CONFLICT ${result.canonicalId}: ${result.conflictingFields.join(", ")}`);
    }
  }

  console.log("\nReal cross-check reconciliation summary:");
  for (const [status, count] of Object.entries(tally)) console.log(`  ${status}: ${count}`);

  const weaponStatusCounts: Record<string, number> = {};
  for (const w of weapons) weaponStatusCounts[w.extractionStatus] = (weaponStatusCounts[w.extractionStatus] ?? 0) + 1;
  console.log("\nReal weapon extractionStatus summary:");
  for (const [status, count] of Object.entries(weaponStatusCounts)) console.log(`  ${status}: ${count}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
