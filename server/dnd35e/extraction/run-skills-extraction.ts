// server/dnd35e/extraction/run-skills-extraction.ts
//
// Real, committed, re-runnable extraction script for the skills entity
// family — mirrors run-feats-extraction.ts / run-races-extraction.ts /
// run-classes-extraction.ts (same content-hash fail-closed discipline, same
// real-network/real-DB shape, same exclusion from the automated test suite
// via package.json's *.test.ts glob).
//
// Covers all 36 real individual-skill pages from the SRD manifest's
// "skills" corpus area. Deliberately excludes the 3 real overview pages in
// that same corpus area (skillDescriptions.htm, skillsSummary.htm,
// usingSkills.htm) — those are rules essays about the skill system as a
// whole, not per-skill entity data, so they're out of scope for this
// entity family (same source-page-vs-canonical-entity distinction
// established since Phase 2A).
//
// Re-run with: node --import tsx server/dnd35e/extraction/run-skills-extraction.ts
// Targets the real dev database (server/storage.ts's default DATABASE_URL,
// data.db) unless DATABASE_URL is overridden. Do NOT point this at the live
// VPS database.

import { createHash } from "node:crypto";
import { storage, runMigrations } from "../../storage";
import { extractSkillFromHtml } from "./skills-extractor";

const SKILL_SOURCE_PAGES = [
  "appraise",
  "balance",
  "bluff",
  "climb",
  "concentration",
  "craft",
  "decipherScript",
  "diplomacy",
  "disableDevice",
  "disguise",
  "escapeArtist",
  "forgery",
  "gatherInformation",
  "handleAnimal",
  "heal",
  "hide",
  "intimidate",
  "jump",
  "knowledge",
  "listen",
  "moveSilently",
  "openLock",
  "perform",
  "profession",
  "ride",
  "search",
  "senseMotive",
  "sleightOfHand",
  "speakLanguage",
  "spellcraft",
  "spot",
  "survival",
  "swim",
  "tumble",
  "useMagicDevice",
  "useRope",
].map((path) => `dnd35e-srd-hypertext-d20::/srd/skills/${path}.htm`);

async function runSkillExtraction(sourcePageKey: string): Promise<{ status: string } | { error: string }> {
  const manifestEntry = storage.getSrdManifestEntry(sourcePageKey);
  if (!manifestEntry) {
    return { error: `SRD manifest entry "${sourcePageKey}" not found.` };
  }
  if (!manifestEntry.contentHash) {
    return { error: `SRD manifest entry "${sourcePageKey}" has no recorded contentHash.` };
  }

  const res = await fetch(manifestEntry.sourceUrl);
  if (!res.ok) {
    return { error: `Failed to re-fetch ${manifestEntry.sourceUrl}: HTTP ${res.status}` };
  }
  const html = await res.text();
  const freshHash = createHash("sha256").update(html).digest("hex");

  if (freshHash !== manifestEntry.contentHash) {
    return {
      error: `Content hash drift detected for "${sourcePageKey}". Manifest recorded ${manifestEntry.contentHash}, fresh fetch hashed to ${freshHash}. Refusing to extract from unverified content.`,
    };
  }

  // extractSkillFromHtml throws (fail-closed) on a page whose structure it
  // doesn't recognize at all — caught here so one bad page's real error is
  // collected and reported, not left to crash the whole batch run.
  try {
    const skill = extractSkillFromHtml(html);
    storage.upsertDnd35eSkillDefinition(skill, { kind: "open_canonical", sourcePageKey });
    console.log(`Extracted real skill "${skill.name}" (${skill.canonicalId}): ${skill.extractionStatus}, ${skill.sections.length} sections.`);
    return { status: skill.extractionStatus };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  runMigrations();
  const counts: Record<string, number> = {};
  const errors: string[] = [];
  for (const sourcePageKey of SKILL_SOURCE_PAGES) {
    const result = await runSkillExtraction(sourcePageKey);
    if ("error" in result) {
      errors.push(`${sourcePageKey}: ${result.error}`);
      console.error(`FAILED: ${sourcePageKey}: ${result.error}`);
    } else {
      counts[result.status] = (counts[result.status] ?? 0) + 1;
    }
  }
  console.log(`\nTotal real skills extracted: ${SKILL_SOURCE_PAGES.length - errors.length} of ${SKILL_SOURCE_PAGES.length}`);
  for (const [status, count] of Object.entries(counts)) {
    console.log(`  ${status}: ${count}`);
  }
  if (errors.length > 0) {
    console.error(`\n${errors.length} real failures (not silently swallowed):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
