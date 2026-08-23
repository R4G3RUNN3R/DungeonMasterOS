import { test } from "node:test";
import assert from "node:assert/strict";
import { SRD_MANIFEST_SOURCE_OLIMOT } from "./srd-manifest-snapshot-olimot.generated";
import { SRD_MANIFEST_ROOTS_D20SRD } from "./srd-manifest-roots-d20srd";
import { SRD_MANIFEST_SOURCE_D20SRD } from "./srd-manifest-snapshot-d20srd.generated";

const VALID_AREAS = new Set([
  "core", "monsters", "spells", "feats", "items-equipment", "classes",
  "prestige-classes", "races", "skills", "conditions", "combat-rules",
  "epic", "psionics", "divine", "open-variants",
]);

test("SRD_MANIFEST_SOURCE_OLIMOT has no zero-length list (the generation step actually ran)", () => {
  assert.ok(SRD_MANIFEST_SOURCE_OLIMOT.length > 50);
});

test("SRD_MANIFEST_SOURCE_OLIMOT deliberately excludes legal-information.html and index.html", () => {
  assert.ok(!SRD_MANIFEST_SOURCE_OLIMOT.some((e) => e.sourcePath.includes("legal-information")));
  assert.ok(!SRD_MANIFEST_SOURCE_OLIMOT.some((e) => e.sourcePath === "index.html"));
});

test("SRD_MANIFEST_SOURCE_OLIMOT has zero open-variants entries — olimot has no Unearthed Arcana content", () => {
  assert.equal(SRD_MANIFEST_SOURCE_OLIMOT.filter((e) => e.corpusArea === "open-variants").length, 0);
});

test("SRD_MANIFEST_ROOTS_D20SRD has exactly 44 real roots", () => {
  assert.equal(SRD_MANIFEST_ROOTS_D20SRD.length, 44);
});

test("SRD_MANIFEST_ROOTS_D20SRD has exactly 6 open-variants roots — the Unearthed Arcana Variant Rules section", () => {
  assert.equal(SRD_MANIFEST_ROOTS_D20SRD.filter((e) => e.corpusArea === "open-variants").length, 6);
});

test("SRD_MANIFEST_SOURCE_D20SRD's generated leaf-page count is genuinely exhaustive, not root-level (must be much larger than 44)", () => {
  assert.ok(
    SRD_MANIFEST_SOURCE_D20SRD.length > 500,
    `expected the real generated crawl to find hundreds of real leaf pages (spells alone yields 608), got ${SRD_MANIFEST_SOURCE_D20SRD.length}`,
  );
});

test("SRD_MANIFEST_SOURCE_D20SRD has real open-variants leaf pages, not just the 6 root index pages", () => {
  const variantLeaves = SRD_MANIFEST_SOURCE_D20SRD.filter((e) => e.corpusArea === "open-variants");
  assert.ok(variantLeaves.length >= 6, "the real Variant Rules leaf pages (e.g. /srd/variant/classes/*.htm) must be discovered, not just their 6 index roots");
});

test("every d20srd leaf entry records a real discoveredFromPath that is one of the 44 real roots", () => {
  const rootPaths = new Set(SRD_MANIFEST_ROOTS_D20SRD.map((r) => r.sourcePath));
  for (const entry of SRD_MANIFEST_SOURCE_D20SRD) {
    assert.ok(rootPaths.has(entry.discoveredFromPath), `"${entry.sourcePath}"'s discoveredFromPath "${entry.discoveredFromPath}" must be a real root`);
  }
});

test("every entry across all three lists has a real corpus area", () => {
  for (const entry of [...SRD_MANIFEST_SOURCE_OLIMOT, ...SRD_MANIFEST_ROOTS_D20SRD, ...SRD_MANIFEST_SOURCE_D20SRD]) {
    assert.ok(VALID_AREAS.has(entry.corpusArea), `"${entry.corpusArea}" (${entry.sourcePath}) must be a real corpus area`);
  }
});

test("no sourcePath is duplicated within any single list", () => {
  for (const list of [SRD_MANIFEST_SOURCE_OLIMOT, SRD_MANIFEST_ROOTS_D20SRD, SRD_MANIFEST_SOURCE_D20SRD]) {
    const paths = list.map((e) => e.sourcePath);
    assert.equal(new Set(paths).size, paths.length, "a generated list must have no internal duplicate paths");
  }
});

test("SRD_MANIFEST_SOURCE_D20SRD never contains an /indexes/*.htm path — no discovery root leaked into the leaf-page manifest", () => {
  assert.ok(
    !SRD_MANIFEST_SOURCE_D20SRD.some((e) => e.sourcePath.startsWith("/indexes/")),
    "every generated leaf entry must be a real /srd/... rules page, never one of the 44 navigation roots",
  );
});

test("SRD_MANIFEST_SOURCE_D20SRD's real count is at or above the direct-link sum sampled during planning — closure only adds pages, never removes", () => {
  // Real per-root direct-link sample counts recorded in "Real Source
  // Structure" (spells 608 + monsters 249 + psionic powers 287 + epic
  // spells 74 + epic monsters 41 + classes 32, a representative subset,
  // not the full 44-root sum) — the closure-crawled total must be at
  // least this large, since closure can only discover MORE pages beyond
  // what roots directly link to, never fewer.
  const directLinkSampleFloor = 608 + 249 + 287 + 74 + 41 + 32;
  assert.ok(
    SRD_MANIFEST_SOURCE_D20SRD.length >= directLinkSampleFloor,
    `expected at least ${directLinkSampleFloor} real leaf pages (the sampled subset's direct-link floor), got ${SRD_MANIFEST_SOURCE_D20SRD.length} — a lower count would mean the closure crawl regressed below what a simple one-level fetch already found`,
  );
});
