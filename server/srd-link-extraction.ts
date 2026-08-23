// server/srd-link-extraction.ts
//
// Pure link extraction and inclusion/exclusion/normalization for
// d20srd.org's discovery-root crawl. Deliberately does NOT decide corpus
// area — see server/srd-d20srd-corpus-classification.ts for that, a
// genuinely separate concern (a page's topic is a property of its own URL,
// never of whichever root happened to link to it first). No network call
// in this file — it operates on already-fetched HTML strings, so it is
// fully unit-testable against real captured href data with zero network
// dependency.

const HREF_PATTERN = /href\s*=\s*["']([^"']+)["']/gi;

export function extractLinks(html: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(HREF_PATTERN);
  while ((match = pattern.exec(html)) !== null) {
    links.push(match[1]);
  }
  return links;
}

const ALLOWED_HOSTS = new Set(["www.d20srd.org", "d20srd.org"]);

const EXCLUDED_EXACT_PATHS = new Set([
  "/", "/index.htm", "/about.htm", "/faq.htm", "/changes.htm", "/ogl.htm", "/landing.php",
]);

const EXCLUDED_PATH_PREFIXES = ["/styles/", "/extras/", "/d20/", "/fantasy/"];

export function classifyD20srdLink(
  rawHref: string,
  baseUrl: string,
): { included: true; url: string } | { included: false; reason: string } {
  if (rawHref.startsWith("javascript:")) {
    return { included: false, reason: "javascript pseudo-link" };
  }
  if (rawHref === "#" || rawHref.startsWith("#")) {
    return { included: false, reason: "bare fragment / same-page anchor with no page path" };
  }

  let url: URL;
  try {
    url = new URL(rawHref, baseUrl);
  } catch {
    return { included: false, reason: "unparseable URL" };
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return { included: false, reason: `external host (${url.hostname}), not d20srd.org — includes wrong-ruleset subdomains like 5e.d20srd.org` };
  }

  const path = url.pathname;

  if (EXCLUDED_EXACT_PATHS.has(path)) {
    return { included: false, reason: "site administrative/legal page" };
  }
  if (EXCLUDED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return { included: false, reason: "site tooling/generator/asset path" };
  }
  // /indexes/*.htm pages are the 44 discovery ROOTS themselves (tracked
  // separately in SRD_MANIFEST_ROOTS_D20SRD) — navigation/table-of-contents
  // pages, not rules-bearing leaf content. Index roots frequently cross-link
  // to each other (e.g. the Feats root links to /indexes/skills.htm); those
  // cross-links must never be treated as leaf rules pages just because they
  // happen to be real, fetchable, in-scope-host URLs. Only /srd/... paths
  // are real leaf content in this classifier's inclusion set.
  if (path.startsWith("/indexes/")) {
    return { included: false, reason: "navigation/discovery-root page" };
  }
  if (!path.startsWith("/srd/")) {
    return { included: false, reason: "outside the /srd/ rules-content namespace" };
  }
  if (!path.endsWith(".htm") && !path.endsWith(".html")) {
    return { included: false, reason: "not an HTML page" };
  }

  return { included: true, url: `${url.origin}${path}` };
}
