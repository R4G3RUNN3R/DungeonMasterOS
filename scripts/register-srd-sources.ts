// scripts/register-srd-sources.ts
//
// Idempotently registers the three real D&D 3.5e SRD provenance rows
// (dnd35e-srd-original, dnd35e-srd-olimot-mirror, dnd35e-srd-hypertext-d20)
// in the rule_sources table. Task 1's real registration (see
// docs/superpowers/plans/2026-08-22-dnd35-srd-ingestion-foundation-phase2a.md
// Step 6, and docs/superpowers/notes/2026-08-22-srd-provenance-registration.md
// for the real output) only ever existed as an ad-hoc snippet run once and
// never committed as a script — this is that script, made safe to re-run
// against a database that already has the rows (checks-then-skips, never
// re-creates) or a fresh database (creates all three).
//
// The original row is created first so its real `id` is available for the
// two derived rows' `derivedFromSourceId`. `dnd35e-srd-hypertext-d20` must
// NOT be given a `pinnedRevision` at registration — it stays `null` until
// Task 9's real scan stamps it via storage.recordSourceScanRevision, after
// both completeness gates pass. This script never touches pinnedRevision
// for an already-existing row, so it cannot regress that stamp.
//
// Re-run with: node --import tsx scripts/register-srd-sources.ts
// Targets the real dev database (server/storage.ts's default DATABASE_URL,
// data.db) unless DATABASE_URL is overridden.

import { storage, runMigrations } from "../server/storage";

export async function registerSrdSources(): Promise<void> {
  const existingOriginal = storage.getRuleSource("dnd35e-srd-original");
  if (existingOriginal) {
    console.log(`dnd35e-srd-original already registered (id ${existingOriginal.id}) — skipping.`);
  } else {
    const created = storage.createRuleSource({
      sourceKey: "dnd35e-srd-original",
      title: "D&D 3.5 System Reference Document (original)",
      publisher: "Wizards of the Coast",
      ruleset: "dnd35e",
      nativeEdition: "dnd35e",
      setting: "generic",
      publicationType: "core-rulebook",
      provenanceClassification: "wotc_official",
      licenseClassification: "srd_open",
    });
    console.log(`Registered dnd35e-srd-original (id ${created.id}).`);
  }

  // Re-fetch so we have the real id whether it was just created or already existed.
  const original = storage.getRuleSource("dnd35e-srd-original");
  if (!original) throw new Error("dnd35e-srd-original registration failed — cannot proceed to derived rows.");

  const existingOlimot = storage.getRuleSource("dnd35e-srd-olimot-mirror");
  if (existingOlimot) {
    console.log(`dnd35e-srd-olimot-mirror already registered (id ${existingOlimot.id}) — skipping.`);
  } else {
    const created = storage.createRuleSource({
      sourceKey: "dnd35e-srd-olimot-mirror",
      title: "olimot/srd-v3.5 HTML mirror (GitHub, pinned commit faab739130921026db42b96e6adff6d3661bffbd)",
      publisher: "olimot (compiler); underlying content Wizards of the Coast (OGL)",
      ruleset: "dnd35e",
      nativeEdition: "dnd35e",
      setting: "generic",
      publicationType: "web-enhancement",
      provenanceClassification: "open_game_content",
      licenseClassification: "srd_open",
      derivedFromSourceId: original.id,
      pinnedRevision: "faab739130921026db42b96e6adff6d3661bffbd",
    });
    console.log(`Registered dnd35e-srd-olimot-mirror (id ${created.id}).`);
  }

  const existingHypertextD20 = storage.getRuleSource("dnd35e-srd-hypertext-d20");
  if (existingHypertextD20) {
    console.log(`dnd35e-srd-hypertext-d20 already registered (id ${existingHypertextD20.id}) — skipping.`);
  } else {
    const created = storage.createRuleSource({
      sourceKey: "dnd35e-srd-hypertext-d20",
      title: "The Hypertext d20 SRD (d20srd.org) — includes documented errata integration and Unearthed Arcana Variant Rules open content",
      publisher: "BoLS Interactive LLC (compiler); underlying content Wizards of the Coast (d20 System License / OGL)",
      ruleset: "dnd35e",
      nativeEdition: "dnd35e",
      setting: "generic",
      publicationType: "web-enhancement",
      provenanceClassification: "open_game_content",
      licenseClassification: "srd_open",
      derivedFromSourceId: original.id,
      // pinnedRevision is deliberately omitted (stays null) at registration —
      // d20srd.org is a live, mutable site, so there is no real scan to pin
      // yet. Task 9's acceptance scan calls storage.recordSourceScanRevision
      // with the real UTC timestamp of the actual final successful scan,
      // once both completeness gates pass — never a hardcoded guess, and
      // never touched by this registration script.
    });
    console.log(`Registered dnd35e-srd-hypertext-d20 (id ${created.id}).`);
  }

  const finalOriginal = storage.getRuleSource("dnd35e-srd-original");
  const finalOlimot = storage.getRuleSource("dnd35e-srd-olimot-mirror");
  const finalHypertextD20 = storage.getRuleSource("dnd35e-srd-hypertext-d20");
  console.log("Final state:");
  for (const row of [finalOriginal, finalOlimot, finalHypertextD20]) {
    console.log(
      `  id=${row?.id} sourceKey=${row?.sourceKey} derivedFromSourceId=${row?.derivedFromSourceId} pinnedRevision=${row?.pinnedRevision}`,
    );
  }
}

async function main() {
  runMigrations();
  await registerSrdSources();
}

// Only run main() when this file is executed directly, not when imported by
// scripts/run-srd-manifest-acceptance-scan.ts.
if (process.argv[1] && process.argv[1].endsWith("register-srd-sources.ts")) {
  main().catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
}
