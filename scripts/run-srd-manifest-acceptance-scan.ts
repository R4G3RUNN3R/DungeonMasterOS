// scripts/run-srd-manifest-acceptance-scan.ts
//
// Task 9's real, mandatory acceptance run: discovers both pinned sources'
// full leaf-page lists into the real dev database, runs both blocking
// completeness gates, and — only if both pass — stamps
// dnd35e-srd-hypertext-d20's pinnedRevision with the real UTC timestamp of
// this run's completion. Real network calls throughout; not part of the
// automated test suite. See docs/superpowers/notes/2026-08-22-srd-manifest-acceptance-report.md
// for the real output of the run this script produced.
//
// Registers the three real rule_sources rows (idempotently, via
// scripts/register-srd-sources.ts's registerSrdSources()) before running
// discovery, so a fresh checkout with an empty/fresh database can run this
// script end-to-end with no separate manual registration step.
//
// Re-run with: node --import tsx scripts/run-srd-manifest-acceptance-scan.ts
// Targets the real dev database (server/storage.ts's default DATABASE_URL,
// data.db) unless DATABASE_URL is overridden. Do NOT point this at the live
// VPS database.

import { storage, runMigrations } from "../server/storage";
import { registerSrdSources } from "./register-srd-sources";
import { runSrdManifestDiscovery } from "../server/srd-manifest-discovery";
import { SRD_MANIFEST_SOURCE_OLIMOT } from "../server/srd-manifest-snapshot-olimot.generated";
import { SRD_MANIFEST_SOURCE_D20SRD } from "../server/srd-manifest-snapshot-d20srd.generated";
import { SRD_MANIFEST_ROOTS_D20SRD } from "../server/srd-manifest-roots-d20srd";
import { crawlD20srdClosure, assertClosureExhaustive } from "../server/srd-d20srd-closure-crawl";

interface D20srdGateResult {
  pathAdditions: string[];
  pathRemovals: string[];
  classificationMismatches: Array<{ sourcePath: string; committedArea: string; freshArea: string }>;
  discoveredFromMismatches: Array<{ sourcePath: string; committedRoot: string; freshRoot: string }>;
}

async function runDiscoveryScan() {
  const olimot = storage.getRuleSource("dnd35e-srd-olimot-mirror");
  const hypertextD20 = storage.getRuleSource("dnd35e-srd-hypertext-d20");
  if (!olimot || !hypertextD20) throw new Error("Run Task 1 Step 6 first.");

  console.log(`olimot.pinnedRevision: ${olimot.pinnedRevision}`);
  console.log(`hypertextD20.pinnedRevision (before this run): ${hypertextD20.pinnedRevision}`);
  console.log(`olimot entries: ${SRD_MANIFEST_SOURCE_OLIMOT.length}`);
  console.log(`d20srd entries: ${SRD_MANIFEST_SOURCE_D20SRD.length}`);

  const startedAt = Date.now();
  const result = await runSrdManifestDiscovery([
    { sourceId: olimot.id, baseUrl: `https://cdn.jsdelivr.net/gh/olimot/srd-v3.5@${olimot.pinnedRevision}/`, entries: SRD_MANIFEST_SOURCE_OLIMOT, concurrency: 8, delayMs: 0 },
    { sourceId: hypertextD20.id, baseUrl: "https://www.d20srd.org", entries: SRD_MANIFEST_SOURCE_D20SRD, concurrency: 5, delayMs: 50 },
  ]);
  const elapsedMs = Date.now() - startedAt;

  console.log("Discovery run result:", JSON.stringify(result));
  console.log(`Elapsed: ${elapsedMs}ms (${(elapsedMs / 1000).toFixed(1)}s)`);
  const coverage = storage.getSourcePageCoverageReport();
  console.log("Coverage report:", JSON.stringify(coverage, null, 2));
  const duplicates = storage.findDuplicateSourcePages();
  console.log(`Duplicates: ${duplicates.length}`);
  if (duplicates.length > 0) console.log(JSON.stringify(duplicates, null, 2));

  const allEntries = storage.listSrdManifestEntries();
  const failedEntries = allEntries.filter((e) => e.lastError !== null);
  console.log(`Failed entries: ${failedEntries.length}`);
  for (const e of failedEntries) console.log(`  FAILURE: ${e.sourcePath} (source ${e.sourceId}) -- ${e.lastError}`);
}

async function runOlimotGate() {
  const PINNED_SHA = "faab739130921026db42b96e6adff6d3661bffbd";
  const res = await fetch(`https://api.github.com/repos/olimot/srd-v3.5/git/trees/${PINNED_SHA}?recursive=1`);
  const data = (await res.json()) as { tree: Array<{ path: string; type: string }> };
  const realHtmlPaths = new Set(
    data.tree
      .filter((e) => e.type === "blob" && e.path.endsWith(".html"))
      .filter((e) => !["legal-information.html", "index.html"].includes(e.path.split("/").pop()!))
      .map((e) => e.path),
  );
  const manifestPaths = new Set(SRD_MANIFEST_SOURCE_OLIMOT.map((e) => e.sourcePath));
  const missingFromManifest = [...realHtmlPaths].filter((p) => !manifestPaths.has(p));
  const extraInManifest = [...manifestPaths].filter((p) => !realHtmlPaths.has(p));
  if (missingFromManifest.length > 0 || extraInManifest.length > 0) {
    throw new Error(`Olimot coverage gate FAILED. Missing: ${JSON.stringify(missingFromManifest)}. Extra: ${JSON.stringify(extraInManifest)}`);
  }
  console.log("Olimot coverage gate PASSED.");
}

async function runD20srdCompletenessGate(): Promise<D20srdGateResult> {
  const startedAt = Date.now();
  const fresh = await crawlD20srdClosure(SRD_MANIFEST_ROOTS_D20SRD, "https://www.d20srd.org");
  console.log(`Fresh d20srd.org re-crawl elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s, rounds: ${fresh.rounds}, failures: ${fresh.failures.length}`);
  // Fail-closed: a fresh re-crawl with its own fetch failures cannot certify
  // completeness. This call must succeed (not throw) before any diffing
  // below is trustworthy — every downstream diff assumes zero failures.
  assertClosureExhaustive(fresh);

  const freshByPath = fresh.entries;
  const committedByPath = new Map(SRD_MANIFEST_SOURCE_D20SRD.map((e) => [e.sourcePath, e]));

  const pathAdditions = [...freshByPath.keys()].filter((p) => !committedByPath.has(p));
  const pathRemovals = [...committedByPath.keys()].filter((p) => !freshByPath.has(p));

  const classificationMismatches: D20srdGateResult["classificationMismatches"] = [];
  const discoveredFromMismatches: D20srdGateResult["discoveredFromMismatches"] = [];
  for (const [sourcePath, committed] of committedByPath) {
    const freshEntry = freshByPath.get(sourcePath);
    if (!freshEntry) continue;
    if (committed.corpusArea !== freshEntry.corpusArea) {
      classificationMismatches.push({ sourcePath, committedArea: committed.corpusArea, freshArea: freshEntry.corpusArea });
    }
    if (committed.discoveredFromPath !== freshEntry.discoveredFromPath) {
      discoveredFromMismatches.push({ sourcePath, committedRoot: committed.discoveredFromPath, freshRoot: freshEntry.discoveredFromPath });
    }
  }

  return { pathAdditions, pathRemovals, classificationMismatches, discoveredFromMismatches };
}

async function runBothGates() {
  await runOlimotGate();

  const gateResult = await runD20srdCompletenessGate();

  if (gateResult.discoveredFromMismatches.length > 0) {
    console.warn(`d20srd.org gate: ${gateResult.discoveredFromMismatches.length} discoveredFromPath mismatch(es) — informational only: ${JSON.stringify(gateResult.discoveredFromMismatches)}`);
  }

  if (gateResult.pathAdditions.length > 0 || gateResult.pathRemovals.length > 0 || gateResult.classificationMismatches.length > 0) {
    console.error("GATE_RESULT_FAILED");
    console.error(JSON.stringify(gateResult, null, 2));
    throw new Error(
      `d20srd.org completeness gate FAILED. Path additions (${gateResult.pathAdditions.length}), ` +
      `Path removals (${gateResult.pathRemovals.length}), Classification mismatches (${gateResult.classificationMismatches.length}).`,
    );
  }
  console.log("d20srd.org completeness gate PASSED: committed snapshot and fresh live crawl agree on every path and every classification.");
  console.log(`Summary: pathAdditions=${gateResult.pathAdditions.length} pathRemovals=${gateResult.pathRemovals.length} classificationMismatches=${gateResult.classificationMismatches.length} discoveredFromMismatches=${gateResult.discoveredFromMismatches.length}`);
  console.log("BOTH_GATES_PASSED");
}

async function stampScanRevision() {
  const scanCompletedAt = new Date().toISOString();
  storage.recordSourceScanRevision("dnd35e-srd-hypertext-d20", `live-scan-${scanCompletedAt}`);
  const reloaded = storage.getRuleSource("dnd35e-srd-hypertext-d20");
  console.log(`Stamped dnd35e-srd-hypertext-d20.pinnedRevision = "${reloaded?.pinnedRevision}"`);
}

async function main() {
  runMigrations();
  await registerSrdSources();
  await runDiscoveryScan();
  // Both gates must pass — runBothGates throws on any blocking discrepancy —
  // before the scan revision is stamped. Stamping only happens on success.
  await runBothGates();
  await stampScanRevision();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
