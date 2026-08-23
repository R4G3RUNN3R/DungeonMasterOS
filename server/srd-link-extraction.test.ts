import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLinks, classifyD20srdLink } from "./srd-link-extraction";

const BASE_URL = "https://www.d20srd.org/indexes/feats.htm";

// Real hrefs captured from the live page during planning (2026-08-22),
// one representative per category actually observed, not invented:
const REAL_FEATS_PAGE_FIXTURE_HTML = `
<link rel="stylesheet" href="/styles/index.css">
<a href="/index.htm">Home</a>
<a href="#">menu</a>
<a href="javascript:void(0);">toggle</a>
<a href="http://www.lounge.belloflostsouls.net/forumdisplay.php?175">Forum</a>
<a href="/about.htm">About</a>
<a href="/faq.htm">FAQ</a>
<a href="/changes.htm">Changes</a>
<a href="/extras/d20dicebag">Dice Bag</a>
<a href="/d20/random/">Generator</a>
<a href="/fantasy/name/">Name Gen</a>
<a href="http://5e.d20srd.org">5e SRD</a>
<a href="https://www.facebook.com/d20srd/">Facebook</a>
<a href="/srd/feats.htm#acrobatic">Acrobatic</a>
<a href="/srd/feats.htm#agile">Agile</a>
<a href="/srd/feats.htm#dodge">Dodge</a>
<a href="/indexes/skills.htm">Skills index</a>
`;

test("extractLinks pulls every href out of a real captured page fixture", () => {
  const links = extractLinks(REAL_FEATS_PAGE_FIXTURE_HTML);
  assert.equal(links.length, 17);
});

test("every real extracted link is either included, or excluded with a real reason — none silently dropped", () => {
  const links = extractLinks(REAL_FEATS_PAGE_FIXTURE_HTML);
  for (const href of links) {
    const result = classifyD20srdLink(href, BASE_URL);
    assert.ok(
      result.included === true || (result.included === false && typeof result.reason === "string" && result.reason.length > 0),
      `link "${href}" must be classified with a real reason, not silently unaccounted for`,
    );
  }
});

test("real anchor-only feats links collapse to the one real leaf page after fragment stripping", () => {
  const results = ["/srd/feats.htm#acrobatic", "/srd/feats.htm#agile", "/srd/feats.htm#dodge"]
    .map((href) => classifyD20srdLink(href, BASE_URL));
  for (const r of results) {
    assert.equal(r.included, true);
    if (r.included) assert.equal(r.url, "https://www.d20srd.org/srd/feats.htm");
  }
});

test("a real index-page cross-link (Feats root -> /indexes/skills.htm) is excluded as navigation, never treated as a leaf rules page", () => {
  const result = classifyD20srdLink("/indexes/skills.htm", BASE_URL);
  assert.equal(result.included, false, "/indexes/*.htm pages are discovery roots, not leaf content, even when linked from another root");
  if (!result.included) assert.match(result.reason, /navigation|discovery-root/);
});

test("a real leaf rules page under /srd/ is included — inclusion carries no corpus-area opinion at all", () => {
  const result = classifyD20srdLink("/srd/skills/appraise.htm", BASE_URL);
  assert.equal(result.included, true);
  if (result.included) assert.equal(result.url, "https://www.d20srd.org/srd/skills/appraise.htm");
});

test("5e.d20srd.org is excluded as wrong-ruleset, not silently treated as same-family content", () => {
  const result = classifyD20srdLink("http://5e.d20srd.org", BASE_URL);
  assert.equal(result.included, false);
  if (!result.included) assert.match(result.reason, /5e\.d20srd\.org/);
});

test("real site-tooling and administrative links are excluded with distinct, real reasons", () => {
  const cases: Array<[string, RegExp]> = [
    ["/styles/index.css", /tooling|asset/],
    ["/about.htm", /administrative/],
    ["/faq.htm", /administrative/],
    ["/extras/d20dicebag", /tooling/],
    ["/d20/random/", /tooling/],
    ["/fantasy/name/", /tooling/],
    ["javascript:void(0);", /javascript/],
    ["#", /fragment/],
  ];
  for (const [href, reasonPattern] of cases) {
    const result = classifyD20srdLink(href, BASE_URL);
    assert.equal(result.included, false, `"${href}" must be excluded`);
    if (!result.included) assert.match(result.reason, reasonPattern, `"${href}"'s exclusion reason must be specific`);
  }
});

test("external non-d20srd hosts (forum, facebook) are excluded as external, not silently included", () => {
  for (const href of ["http://www.lounge.belloflostsouls.net/forumdisplay.php?175", "https://www.facebook.com/d20srd/"]) {
    const result = classifyD20srdLink(href, BASE_URL);
    assert.equal(result.included, false);
    if (!result.included) assert.match(result.reason, /external host/);
  }
});
