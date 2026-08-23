import { test } from "node:test";
import assert from "node:assert/strict";
import { crawlD20srdClosure, assertClosureExhaustive } from "./srd-d20srd-closure-crawl";

const BASE_URL = "https://www.d20srd.org";

function fakeFetch(pages: Record<string, string>): typeof fetch {
  return (async (url: string) => {
    const path = new URL(url).pathname;
    if (pages[path] === undefined) return new Response("not found", { status: 404 });
    return new Response(pages[path], { status: 200 });
  }) as typeof fetch;
}

test("crawlD20srdClosure discovers a page linked only from another leaf page, and classifies it by its own path — not the root's declared area", async () => {
  const pages = {
    "/indexes/classes.htm": `<a href="/srd/classes/barbarian.htm">Barbarian</a>`,
    "/srd/classes/barbarian.htm": `<a href="/srd/prestigeClasses/prestigeClasses.htm">Prestige Classes</a>`,
    "/srd/prestigeClasses/prestigeClasses.htm": `<a href="/srd/prestigeClasses/archmage.htm">Archmage</a>`,
    "/srd/prestigeClasses/archmage.htm": `no further links here`,
  };
  const result = await crawlD20srdClosure(
    [{ corpusArea: "classes", sourcePath: "/indexes/classes.htm" }],
    BASE_URL,
    fakeFetch(pages),
  );
  assert.ok(result.rounds > 1, "discovering archmage.htm (two links deep from the root) requires more than one closure round");
  assert.equal(result.entries.get("/srd/classes/barbarian.htm")?.corpusArea, "classes");
  assert.equal(
    result.entries.get("/srd/prestigeClasses/archmage.htm")?.corpusArea,
    "prestige-classes",
    "archmage.htm must classify as prestige-classes by its own path, even though it was reached transitively via the 'classes' root — the exact traversal-order bug this round's correction fixes",
  );
});

test("crawlD20srdClosure records the originating root, not the intermediate leaf, as discoveredFromPath", async () => {
  const pages = {
    "/indexes/classes.htm": `<a href="/srd/classes/barbarian.htm">Barbarian</a>`,
    "/srd/classes/barbarian.htm": `<a href="/srd/prestigeClasses/archmage.htm">Archmage</a>`,
    "/srd/prestigeClasses/archmage.htm": `no further links`,
  };
  const result = await crawlD20srdClosure(
    [{ corpusArea: "classes", sourcePath: "/indexes/classes.htm" }],
    BASE_URL,
    fakeFetch(pages),
  );
  const archmage = result.entries.get("/srd/prestigeClasses/archmage.htm");
  assert.equal(
    archmage?.discoveredFromPath,
    "/indexes/classes.htm",
    "discoveredFromPath must trace back to the real root, not to barbarian.htm (the intermediate leaf that happened to link to it)",
  );
});

test("crawlD20srdClosure stops when a round discovers zero new in-scope pages", async () => {
  const pages = {
    "/indexes/feats.htm": `<a href="/srd/feats.htm#acrobatic">Acrobatic</a><a href="/srd/feats.htm#agile">Agile</a>`,
    "/srd/feats.htm": `no further links`,
  };
  const result = await crawlD20srdClosure(
    [{ corpusArea: "feats", sourcePath: "/indexes/feats.htm" }],
    BASE_URL,
    fakeFetch(pages),
  );
  assert.equal(result.entries.size, 1, "both feats.htm#acrobatic and #agile collapse to the single real page /srd/feats.htm");
  assert.ok(result.rounds <= 3, `expected the crawl to converge quickly (root -> feats.htm -> no new links), got ${result.rounds} rounds`);
});

test("the real discovered case: two different roots (monsters and epic) both link to /srd/epic/feats.htm — deterministic classification means they can never disagree", async () => {
  // Real chain observed during this round's research: the "monsters" root
  // (monsterFeats.htm) and the "epic" root (epicFeats.htm) both link to
  // this exact real page. Under the OLD inheritance design this could
  // classify as "monsters" or "epic" depending on traversal order, or
  // throw a conflict if both roots were crawled. Path-based classification
  // structurally removes that race: it is always "epic".
  const pages = {
    "/indexes/monsterFeats.htm": `<a href="/srd/epic/feats.htm">Epic Feats</a>`,
    "/indexes/epicFeats.htm": `<a href="/srd/epic/feats.htm">Epic Feats</a>`,
    "/srd/epic/feats.htm": `no further links`,
  };
  const result = await crawlD20srdClosure(
    [
      { corpusArea: "monsters", sourcePath: "/indexes/monsterFeats.htm" },
      { corpusArea: "epic", sourcePath: "/indexes/epicFeats.htm" },
    ],
    BASE_URL,
    fakeFetch(pages),
  );
  assert.equal(
    result.entries.get("/srd/epic/feats.htm")?.corpusArea,
    "epic",
    "classified by its own path (epic), never by whichever root's declared area happened to reach it — monsters, in this real case",
  );
});

test("crawlD20srdClosure excludes /indexes/*.htm cross-links between roots, never treats a discovery root as a leaf page", async () => {
  const pages = {
    "/indexes/feats.htm": `<a href="/indexes/skills.htm">Skills index</a><a href="/srd/feats.htm">Feats</a>`,
    "/indexes/skills.htm": `no further links`,
    "/srd/feats.htm": `no further links`,
  };
  const result = await crawlD20srdClosure(
    [{ corpusArea: "feats", sourcePath: "/indexes/feats.htm" }],
    BASE_URL,
    fakeFetch(pages),
  );
  assert.ok(!result.entries.has("/indexes/skills.htm"), "an /indexes/ cross-link must never enter the leaf-page manifest");
  assert.ok(result.entries.has("/srd/feats.htm"));
});

test("a failed root fetch is collected in failures, not silently skipped — the crawl still returns the other roots' real results", async () => {
  const pages = {
    "/indexes/feats.htm": `<a href="/srd/feats.htm">Feats</a>`,
    "/srd/feats.htm": `no further links`,
    // "/indexes/skills.htm" intentionally absent from `pages` -> fakeFetch returns 404
  };
  const result = await crawlD20srdClosure(
    [
      { corpusArea: "feats", sourcePath: "/indexes/feats.htm" },
      { corpusArea: "skills", sourcePath: "/indexes/skills.htm" },
    ],
    BASE_URL,
    fakeFetch(pages),
  );
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].url, /indexes\/skills\.htm/);
  assert.ok(result.entries.has("/srd/feats.htm"), "the working root's real discoveries are still returned even though a sibling root failed");
});

test("a failed leaf fetch (not just a failed root) is also collected in failures", async () => {
  const pages = {
    "/indexes/feats.htm": `<a href="/srd/feats.htm">Feats</a>`,
    // "/srd/feats.htm" intentionally absent -> 404 when the crawl fetches this leaf for its own links
  };
  const result = await crawlD20srdClosure(
    [{ corpusArea: "feats", sourcePath: "/indexes/feats.htm" }],
    BASE_URL,
    fakeFetch(pages),
  );
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].url, /srd\/feats\.htm/);
});

test("assertClosureExhaustive throws when the crawl result has any failures — completeness cannot be claimed", () => {
  const resultWithFailure = {
    entries: new Map(),
    totalLinksExamined: 0,
    totalExcluded: 0,
    failures: [{ url: "https://www.d20srd.org/srd/feats.htm", reason: "HTTP 500" }],
    rounds: 1,
  };
  assert.throws(() => assertClosureExhaustive(resultWithFailure), /cannot be considered exhaustive/);
});

test("assertClosureExhaustive does not throw when the crawl result has zero failures", () => {
  const cleanResult = { entries: new Map(), totalLinksExamined: 0, totalExcluded: 0, failures: [], rounds: 1 };
  assert.doesNotThrow(() => assertClosureExhaustive(cleanResult));
});
