// scripts/generate-d20srd-srd-snapshot.ts
//
// Generates server/srd-manifest-snapshot-d20srd.generated.ts by running the
// real transitive-closure crawl (server/srd-d20srd-closure-crawl.ts) against
// the 44 real roots — not a one-level fetch. This is the real, exhaustive,
// generated leaf-page corpus for d20srd.org. Fail-closed: assertClosureExhaustive
// throws (and no file is written) if the crawl had ANY fetch failure — a
// snapshot generated from an incomplete crawl would silently under-report
// the real corpus, which is worse than failing loudly and re-running.
//
// Re-run with: node --import tsx scripts/generate-d20srd-srd-snapshot.ts

import { crawlD20srdClosure, assertClosureExhaustive } from "../server/srd-d20srd-closure-crawl";
import { SRD_MANIFEST_ROOTS_D20SRD } from "../server/srd-manifest-roots-d20srd";

const BASE_URL = "https://www.d20srd.org";

async function main() {
  const result = await crawlD20srdClosure(SRD_MANIFEST_ROOTS_D20SRD, BASE_URL);
  assertClosureExhaustive(result); // throws before any file is written if there were fetch failures

  const entries = Array.from(result.entries.values()).sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  const output = `// GENERATED FILE — produced by scripts/generate-d20srd-srd-snapshot.ts
// via a real transitive-closure crawl (server/srd-d20srd-closure-crawl.ts)
// starting from the 44 real roots in server/srd-manifest-roots-d20srd.ts.
// Do not hand-edit; re-run the script. Real generation run: ${result.rounds}
// closure round(s), ${result.totalLinksExamined} total links examined,
// ${result.totalExcluded} excluded (site furniture/admin/navigation/
// external/wrong-ruleset), zero fetch failures (assertClosureExhaustive
// requires this before a file is written — see server/srd-d20srd-closure-crawl.ts),
// ${entries.length} real rules-bearing leaf pages after closure, each
// classified deterministically by its own path (server/srd-d20srd-corpus-classification.ts).

import type { CorpusArea } from "@shared/rules-registry/srd-manifest";

export const SRD_MANIFEST_SOURCE_D20SRD: Array<{ corpusArea: CorpusArea; sourcePath: string; discoveredFromPath: string }> = ${JSON.stringify(entries, null, 2)};
`;

  const fs = await import("node:fs");
  fs.writeFileSync("server/srd-manifest-snapshot-d20srd.generated.ts", output);
  console.log(`Closure converged after ${result.rounds} round(s): examined ${result.totalLinksExamined} links, excluded ${result.totalExcluded}, zero fetch failures, wrote ${entries.length} real leaf pages to server/srd-manifest-snapshot-d20srd.generated.ts`);
}

main();
