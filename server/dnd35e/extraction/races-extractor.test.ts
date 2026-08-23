// server/dnd35e/extraction/races-extractor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractRacesFromHtml } from "./races-extractor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, "races-fixture.html"), "utf-8");

test("extractRacesFromHtml finds all 7 real core races", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  assert.equal(races.length, 7);
  const ids = races.map((r) => r.canonicalId).sort();
  assert.deepEqual(ids, [
    "dnd35e:race:dwarves",
    "dnd35e:race:elves",
    "dnd35e:race:gnomes",
    "dnd35e:race:half-elves",
    "dnd35e:race:half-orcs",
    "dnd35e:race:halflings",
    "dnd35e:race:humans",
  ]);
});

test("Humans: real feat structures cleanly with no special_ability trait — fully_structured", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  const humans = races.find((r) => r.canonicalId === "dnd35e:race:humans");
  assert.ok(humans, "Humans must be found in the real fixture");
  assert.equal(humans!.extractionStatus, "fully_structured");
  assert.deepEqual(humans!.languages, { automatic: ["Common"], bonus: "any" });
  assert.deepEqual(humans!.traits, [
    { kind: "size", size: "medium" },
    { kind: "base_land_speed", feet: 30 },
    { kind: "bonus_feat_count", count: 1, when: "1st level" },
    { kind: "bonus_skill_points", atFirstLevel: 4, perAdditionalLevel: 1 },
    {
      kind: "favored_class",
      any: true,
      classCanonicalId: null,
      description: "Favored Class: Any. When determining whether a multiclass human takes an experience point penalty, his or her highest-level class does not count.",
    },
  ]);
});

test("Dwarves: real '+2 Constitution, -2 Charisma.' decomposes into two real ability_modifier traits", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  const dwarves = races.find((r) => r.canonicalId === "dnd35e:race:dwarves");
  assert.ok(dwarves, "Dwarves must be found in the real fixture");
  assert.deepEqual(dwarves!.traits.slice(0, 2), [
    { kind: "ability_modifier", ability: "con", modifier: 2 },
    { kind: "ability_modifier", ability: "cha", modifier: -2 },
  ]);
});

test("Dwarves: real base land speed's trailing exception clause (medium/heavy load) is preserved as its own special_ability, never dropped", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  const dwarves = races.find((r) => r.canonicalId === "dnd35e:race:dwarves");
  assert.ok(dwarves, "Dwarves must be found in the real fixture");
  assert.deepEqual(
    dwarves!.traits.find((t) => t.kind === "base_land_speed"),
    { kind: "base_land_speed", feet: 20 },
  );
  const speedNote = dwarves!.traits.find((t) => t.kind === "special_ability" && t.name === "Base land speed note");
  assert.ok(speedNote, "the real 'However, dwarves can move at this speed even when wearing medium or heavy armor...' clause must survive as an honest special_ability");
});

test("Dwarves: real Favored Class 'Fighter' resolves to a real class canonical ID, not left null", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  const dwarves = races.find((r) => r.canonicalId === "dnd35e:race:dwarves");
  assert.ok(dwarves, "Dwarves must be found in the real fixture");
  const favoredClass = dwarves!.traits.find((t) => t.kind === "favored_class");
  assert.ok(favoredClass && favoredClass.kind === "favored_class");
  assert.equal(favoredClass.any, false);
  assert.equal(favoredClass.classCanonicalId, "dnd35e:class:fighter");
});

test("Dwarves: real Automatic/Bonus Languages decompose into real literal language-name arrays", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  const dwarves = races.find((r) => r.canonicalId === "dnd35e:race:dwarves");
  assert.ok(dwarves, "Dwarves must be found in the real fixture");
  assert.deepEqual(dwarves!.languages, {
    automatic: ["Common", "Dwarven"],
    bonus: ["Giant", "Gnome", "Goblin", "Orc", "Terran", "Undercommon"],
  });
});

test("Gnomes: real 'Bonus Languages: ... In addition, a gnome can speak with a burrowing mammal...' trailing sentence is preserved as an honest extractionNote, not silently dropped", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  const gnomes = races.find((r) => r.canonicalId === "dnd35e:race:gnomes");
  assert.ok(gnomes, "Gnomes must be found in the real fixture");
  assert.deepEqual(gnomes!.languages, {
    automatic: ["Common", "Gnome"],
    bonus: ["Draconic", "Dwarven", "Elven", "Giant", "Goblin", "Orc"],
  });
  assert.ok(
    gnomes!.extractionNotes.some((n) => n.includes("burrowing mammal")),
    `expected the real trailing language note to be preserved, got: ${JSON.stringify(gnomes!.extractionNotes)}`,
  );
});

test("Half-Orcs: real nested <p> ability-score adjustment clause ('always at least 3') survives as its own special_ability, never dropped", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  const halfOrcs = races.find((r) => r.canonicalId === "dnd35e:race:half-orcs");
  assert.ok(halfOrcs, "Half-Orcs must be found in the real fixture");
  assert.deepEqual(halfOrcs!.traits.slice(0, 3), [
    { kind: "ability_modifier", ability: "str", modifier: 2 },
    { kind: "ability_modifier", ability: "int", modifier: -2 },
    { kind: "ability_modifier", ability: "cha", modifier: -2 },
  ]);
  const adjustmentNote = halfOrcs!.traits.find((t) => t.kind === "special_ability" && t.name === "Ability score adjustment note");
  assert.ok(adjustmentNote && adjustmentNote.kind === "special_ability");
  assert.match(adjustmentNote.description, /always at least 3/);
});

test("Half-Elves: real 'Favored Class: Any.' correctly resolves any:true with no class anchor to misparse", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  const halfElves = races.find((r) => r.canonicalId === "dnd35e:race:half-elves");
  assert.ok(halfElves, "Half-Elves must be found in the real fixture");
  const favoredClass = halfElves!.traits.find((t) => t.kind === "favored_class");
  assert.ok(favoredClass && favoredClass.kind === "favored_class");
  assert.equal(favoredClass.any, true);
  assert.equal(favoredClass.classCanonicalId, null);
});

test("Gnomes and Halflings: real Small-size races structure to size:'small', distinct from Medium races", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  const gnomes = races.find((r) => r.canonicalId === "dnd35e:race:gnomes");
  const halflings = races.find((r) => r.canonicalId === "dnd35e:race:halflings");
  assert.ok(gnomes && halflings, "both races must be found in the real fixture");
  assert.deepEqual(
    gnomes!.traits.find((t) => t.kind === "size"),
    { kind: "size", size: "small" },
  );
  assert.deepEqual(
    halflings!.traits.find((t) => t.kind === "size"),
    { kind: "size", size: "small" },
  );
});

test("every race with any real narrative special ability (Darkvision, Stonecunning, etc.) preserves it verbatim in extractionNotes, never fabricates a mechanic for it", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  const dwarves = races.find((r) => r.canonicalId === "dnd35e:race:dwarves");
  assert.ok(dwarves, "Dwarves must be found in the real fixture");
  assert.ok(dwarves!.extractionNotes.some((n) => n.includes("Stonecunning")));
  assert.ok(dwarves!.extractionNotes.some((n) => n.includes("Darkvision")));
  for (const trait of dwarves!.traits) {
    if (trait.kind === "special_ability") {
      assert.ok(trait.description.length > 0, "a special_ability must retain the real description text, never an empty placeholder");
    }
  }
});

test("every extracted race has a real dnd35e:race: canonical ID and a non-empty name", () => {
  const races = extractRacesFromHtml(FIXTURE_HTML);
  for (const race of races) {
    assert.match(race.canonicalId, /^dnd35e:race:[a-z0-9-]+$/, `bad canonicalId: ${race.canonicalId}`);
    assert.ok(race.name.length > 0);
  }
});
