// server/dnd35e/extraction/class-spell-lists-extractor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractClassSpellListFromHtml } from "./class-spell-lists-extractor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLERIC_SPELLS_HTML = fs.readFileSync(path.join(__dirname, "cleric-spells-list-fixture.html"), "utf-8");

test("Cleric spell list: real substantial extraction (231 real spell entries across 10 real spell levels 0-9), fully_structured, zero notes", () => {
  const list = extractClassSpellListFromHtml(CLERIC_SPELLS_HTML, "dnd35e:class:cleric", "cleric");
  assert.equal(list.classCanonicalId, "dnd35e:class:cleric");
  assert.equal(list.extractionStatus, "fully_structured");
  assert.deepEqual(list.extractionNotes, []);
  assert.equal(list.entries.length, 231);
  const levels = new Set(list.entries.map((e) => e.level));
  assert.deepEqual([...levels].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("Cleric spell list: real single-spell entry (Create Water, 0-level, no component markers) structures cleanly", () => {
  const list = extractClassSpellListFromHtml(CLERIC_SPELLS_HTML, "dnd35e:class:cleric", "cleric");
  const createWater = list.entries.find((e) => e.spellCanonicalId === "dnd35e:spell:create-water");
  assert.deepEqual(createWater, {
    spellCanonicalId: "dnd35e:spell:create-water",
    name: "Create Water",
    level: 0,
    componentMarkers: [],
    summary: "Creates 2 gallons/level of pure water.",
  });
});

test("Cleric spell list: real component markers are captured — Bless Water (M) and Augury (M and F, two distinct real markers)", () => {
  const list = extractClassSpellListFromHtml(CLERIC_SPELLS_HTML, "dnd35e:class:cleric", "cleric");
  const blessWater = list.entries.find((e) => e.spellCanonicalId === "dnd35e:spell:bless-water");
  const augury = list.entries.find((e) => e.spellCanonicalId === "dnd35e:spell:augury");
  assert.deepEqual(blessWater?.componentMarkers, ["M"]);
  assert.deepEqual(augury?.componentMarkers, ["M", "F"]);
});

test("Cleric spell list: real combined multi-spell <li> ('Detect Chaos/Evil/Good/Law' — 4 real distinct spell pages sharing one summary line) yields 4 separate entries, all sharing the same level and summary", () => {
  const list = extractClassSpellListFromHtml(CLERIC_SPELLS_HTML, "dnd35e:class:cleric", "cleric");
  const chaos = list.entries.find((e) => e.spellCanonicalId === "dnd35e:spell:detect-chaos");
  const evil = list.entries.find((e) => e.spellCanonicalId === "dnd35e:spell:detect-evil");
  const good = list.entries.find((e) => e.spellCanonicalId === "dnd35e:spell:detect-good");
  const law = list.entries.find((e) => e.spellCanonicalId === "dnd35e:spell:detect-law");
  assert.ok(chaos && evil && good && law, "all 4 real distinct spell pages must produce their own entry");
  assert.equal(chaos!.name, "Detect Chaos", "the first anchor in a combined entry keeps its full real display text");
  assert.equal(evil!.name, "Evil", "subsequent anchors in a combined entry keep their own real (shorthand) display text, not a guessed/reconstructed full name");
  assert.equal(evil!.summary, chaos!.summary, "all spells sharing one real <li> share that li's real summary text");
  assert.equal(evil!.level, 1);
});

test("extractClassSpellListFromHtml on a page with no real spell-level headings reports unresolved with a real note, not silently empty", () => {
  const list = extractClassSpellListFromHtml("<html><body>not a spell list page</body></html>", "dnd35e:class:cleric", "cleric");
  assert.equal(list.extractionStatus, "unresolved");
  assert.equal(list.entries.length, 0);
  assert.ok(list.extractionNotes.length > 0);
});
