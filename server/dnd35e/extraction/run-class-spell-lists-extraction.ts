// server/dnd35e/extraction/run-class-spell-lists-extraction.ts
//
// Real, committed, re-runnable extraction script for the class-spell-list
// entity family — mirrors the other run-*-extraction.ts scripts (same
// content-hash fail-closed discipline, same real-network/real-DB shape,
// same exclusion from the automated test suite via package.json's
// *.test.ts glob).
//
// Covers all 6 real casting classes' spell-list pages: Bard, Cleric,
// Druid, Paladin, Ranger each have their own page; Sorcerer and Wizard
// share one real page (sorcererWizardSpells.htm — they draw from the same
// spell list in 3.5e) and are extracted as two separate real class-spell-
// list records from that one fetch, mirroring how they share one class
// page but get separate Dnd35eClassDefinition records.
//
// Deliberately excludes clericDomains.htm (a different real structure —
// domain-to-spell mapping, not a level-organized class spell list) and
// spellLists.htm (a legend/index page, not spell data itself) — both real,
// separate, named follow-on work, not silently claimed as covered.
//
// Re-run with: node --import tsx server/dnd35e/extraction/run-class-spell-lists-extraction.ts
// Targets the real dev database (server/storage.ts's default DATABASE_URL,
// data.db) unless DATABASE_URL is overridden. Do NOT point this at the live
// VPS database.

import { createHash } from "node:crypto";
import { storage, runMigrations } from "../../storage";
import { extractClassSpellListFromHtml } from "./class-spell-lists-extractor";

const SINGLE_CLASS_PAGES: { path: string; classSlug: string; classCanonicalId: string }[] = [
  { path: "bardSpells", classSlug: "bard", classCanonicalId: "dnd35e:class:bard" },
  { path: "clericSpells", classSlug: "cleric", classCanonicalId: "dnd35e:class:cleric" },
  { path: "druidSpells", classSlug: "druid", classCanonicalId: "dnd35e:class:druid" },
  { path: "paladinSpells", classSlug: "paladin", classCanonicalId: "dnd35e:class:paladin" },
  { path: "rangerSpells", classSlug: "ranger", classCanonicalId: "dnd35e:class:ranger" },
];
const SORCERER_WIZARD_SOURCE_PAGE_KEY = "dnd35e-srd-hypertext-d20::/srd/spellLists/sorcererWizardSpells.htm";

async function fetchHashVerifiedHtml(sourcePageKey: string): Promise<string> {
  const manifestEntry = storage.getSrdManifestEntry(sourcePageKey);
  if (!manifestEntry) throw new Error(`SRD manifest entry "${sourcePageKey}" not found.`);
  if (!manifestEntry.contentHash) throw new Error(`SRD manifest entry "${sourcePageKey}" has no recorded contentHash.`);

  console.log(`Re-fetching ${manifestEntry.sourceUrl} to verify content hash before extracting...`);
  const res = await fetch(manifestEntry.sourceUrl);
  if (!res.ok) throw new Error(`Failed to re-fetch ${manifestEntry.sourceUrl}: HTTP ${res.status}`);
  const html = await res.text();
  const freshHash = createHash("sha256").update(html).digest("hex");
  if (freshHash !== manifestEntry.contentHash) {
    throw new Error(
      `Content hash drift detected for "${sourcePageKey}". Manifest recorded ${manifestEntry.contentHash}, fresh fetch hashed to ${freshHash}. Refusing to extract from unverified content.`,
    );
  }
  console.log("Content hash verified — extracting from confirmed-current content.");
  return html;
}

function save(html: string, classCanonicalId: string, classSlug: string, sourcePageKey: string): void {
  const list = extractClassSpellListFromHtml(html, classCanonicalId, classSlug);
  storage.upsertDnd35eClassSpellList(list, { kind: "open_canonical", sourcePageKey });
  console.log(`Extracted real class spell list "${list.canonicalId}": ${list.extractionStatus}, ${list.entries.length} entries.`);
}

async function main() {
  runMigrations();

  for (const { path, classSlug, classCanonicalId } of SINGLE_CLASS_PAGES) {
    const sourcePageKey = `dnd35e-srd-hypertext-d20::/srd/spellLists/${path}.htm`;
    const html = await fetchHashVerifiedHtml(sourcePageKey);
    save(html, classCanonicalId, classSlug, sourcePageKey);
  }

  const sorcererWizardHtml = await fetchHashVerifiedHtml(SORCERER_WIZARD_SOURCE_PAGE_KEY);
  save(sorcererWizardHtml, "dnd35e:class:sorcerer", "sorcerer", SORCERER_WIZARD_SOURCE_PAGE_KEY);
  save(sorcererWizardHtml, "dnd35e:class:wizard", "wizard", SORCERER_WIZARD_SOURCE_PAGE_KEY);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
