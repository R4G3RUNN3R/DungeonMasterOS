// server/srd-d20srd-closure-crawl.ts
//
// Transitive-closure crawl for d20srd.org. A one-level fetch of the 44 real
// roots only proves every root's DIRECT links are accounted for — it does
// not prove every real rules-bearing page is discovered, since a leaf page
// can itself link to further in-scope pages no root directly references.
// This crawls the 44 roots, then repeats extraction/inclusion-checking
// against every newly-discovered leaf page's own links, in rounds, until a
// round finds zero new in-scope paths — a real fixed-point closure, still
// only discovering URLs and classifying them by corpus area, never parsing
// page content into game rules (Phase 2B remains untouched).
//
// Corpus-area classification is deterministic and path-only (see
// srd-d20srd-corpus-classification.ts) — a page's area no longer depends on
// which root's traversal reached it first, closing the misclassification
// bug where a "monsters"-rooted page like monsterFeats.htm could leak its
// area onto a genuinely "epic" page (/srd/epic/feats.htm) it happens to
// link to.
//
// Fetch failures (root or leaf) are collected in `failures`, never silently
// dropped and never aborting the rest of the crawl — a broken page can't
// mask the real state of every other page. Completeness is a SEPARATE,
// explicit gate: assertClosureExhaustive() below, which callers must invoke
// before trusting a result as exhaustive.

import { extractLinks, classifyD20srdLink } from "./srd-link-extraction";
import { classifyD20srdCorpusArea } from "./srd-d20srd-corpus-classification";
import type { CorpusArea } from "@shared/rules-registry/srd-manifest";

export interface ClosureCrawlResult {
  entries: Map<string, { corpusArea: CorpusArea; sourcePath: string; discoveredFromPath: string }>;
  totalLinksExamined: number;
  totalExcluded: number;
  failures: Array<{ url: string; reason: string }>;
  rounds: number;
}

interface FrontierItem {
  url: string;
  originRootPath: string;
}

const MAX_ROUNDS = 12; // safety valve against a pathological cycle; real d20srd.org
                        // content is not expected to ever approach this depth.

export async function crawlD20srdClosure(
  roots: Array<{ corpusArea: CorpusArea; sourcePath: string }>,
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  corpusAreaOverrides: Record<string, CorpusArea> = {},
): Promise<ClosureCrawlResult> {
  const seen = new Map<string, { corpusArea: CorpusArea; sourcePath: string; discoveredFromPath: string }>();
  const failures: Array<{ url: string; reason: string }> = [];
  let frontier: FrontierItem[] = roots.map((root) => ({
    url: `${baseUrl}${root.sourcePath}`,
    originRootPath: root.sourcePath,
  }));
  let totalLinksExamined = 0;
  let totalExcluded = 0;
  let round = 0;

  while (frontier.length > 0) {
    round++;
    if (round > MAX_ROUNDS) {
      throw new Error(
        `d20srd.org closure crawl did not converge within ${MAX_ROUNDS} rounds — this almost certainly indicates a bug (e.g. a cyclic-link mishandling) rather than genuine real content depth. Investigate before trusting this run.`,
      );
    }

    const nextFrontier: FrontierItem[] = [];
    for (const item of frontier) {
      let res: Response;
      try {
        res = await fetchImpl(item.url);
      } catch (err) {
        failures.push({ url: item.url, reason: err instanceof Error ? err.message : String(err) });
        continue;
      }
      if (!res.ok) {
        failures.push({ url: item.url, reason: `HTTP ${res.status}` });
        continue;
      }
      const html = await res.text();
      const links = extractLinks(html);
      totalLinksExamined += links.length;

      for (const href of links) {
        const result = classifyD20srdLink(href, item.url);
        if (!result.included) {
          totalExcluded++;
          continue;
        }
        const path = new URL(result.url).pathname;
        if (seen.has(path)) continue; // same page reached again — ordinary dedup.
                                       // Classification is a pure function of
                                       // path, so a repeat can never conflict.

        const corpusArea = classifyD20srdCorpusArea(path, corpusAreaOverrides);
        seen.set(path, { corpusArea, sourcePath: path, discoveredFromPath: item.originRootPath });
        nextFrontier.push({ url: result.url, originRootPath: item.originRootPath });
      }
    }
    frontier = nextFrontier;
  }

  return { entries: seen, totalLinksExamined, totalExcluded, failures, rounds: round };
}

/**
 * Fail-closed completeness gate: a closure crawl with ANY fetch failure
 * cannot be considered exhaustive — a failed root or leaf page might have
 * linked to real content nothing else reaches. Both generation
 * (scripts/generate-d20srd-srd-snapshot.ts) and Task 9's real acceptance
 * gate must call this before trusting a crawl result's completeness.
 */
export function assertClosureExhaustive(result: ClosureCrawlResult): void {
  if (result.failures.length > 0) {
    const list = result.failures.map((f) => `  - ${f.url}: ${f.reason}`).join("\n");
    throw new Error(
      `d20srd.org closure crawl had ${result.failures.length} fetch failure(s) — cannot be considered exhaustive, ` +
      `since a failed page might have linked to real content nothing else reaches. Re-run the crawl (transient ` +
      `network/site issues are the common cause) until it completes with zero failures before trusting this ` +
      `result for generation or the acceptance gate:\n${list}`,
    );
  }
}
