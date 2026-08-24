// server/dnd35e/extraction/spells-extractor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractSpellFromHtml } from "./spells-extractor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAGIC_MISSILE_HTML = fs.readFileSync(path.join(__dirname, "spell-magic-missile-fixture.html"), "utf-8");
const FIREBALL_HTML = fs.readFileSync(path.join(__dirname, "spell-fireball-fixture.html"), "utf-8");
const CURE_LIGHT_WOUNDS_HTML = fs.readFileSync(path.join(__dirname, "spell-cure-light-wounds-fixture.html"), "utf-8");
const BLINK_HTML = fs.readFileSync(path.join(__dirname, "spell-blink-fixture.html"), "utf-8");
const BULLS_STRENGTH_MASS_HTML = fs.readFileSync(path.join(__dirname, "spell-bulls-strength-mass-fixture.html"), "utf-8");
const MIRROR_IMAGE_HTML = fs.readFileSync(path.join(__dirname, "spell-mirror-image-fixture.html"), "utf-8");
const BEARS_ENDURANCE_MASS_HTML = fs.readFileSync(path.join(__dirname, "spell-bears-endurance-mass-fixture.html"), "utf-8");
const MAGES_LUCUBRATION_HTML = fs.readFileSync(path.join(__dirname, "spell-mages-lucubration-fixture.html"), "utf-8");
const OVERLAND_FLIGHT_HTML = fs.readFileSync(path.join(__dirname, "spell-overland-flight-fixture.html"), "utf-8");
const GEAS_QUEST_HTML = fs.readFileSync(path.join(__dirname, "spell-geas-quest-fixture.html"), "utf-8");

test("Magic Missile: real school+descriptor ('Evocation [Force]'), real 'Sor/Wiz 1' Level row splits into two real classLevels entries, real 'Targets' row, fully_structured", () => {
  const spell = extractSpellFromHtml(MAGIC_MISSILE_HTML);
  assert.equal(spell.canonicalId, "dnd35e:spell:magic-missile");
  assert.equal(spell.school, "Evocation");
  assert.equal(spell.subschool, null);
  assert.deepEqual(spell.descriptors, ["Force"]);
  assert.deepEqual(spell.classLevels, [
    { classOrDomainLabel: "Sor", level: 1 },
    { classOrDomainLabel: "Wiz", level: 1 },
  ]);
  assert.deepEqual(spell.targetOrAreaOrEffect, { kind: "targets", text: "Up to five creatures, no two of which can be more than 15 ft. apart" });
  assert.equal(spell.savingThrow, "None");
  assert.equal(spell.extractionStatus, "fully_structured");
  assert.deepEqual(spell.extractionNotes, []);
});

test("Fireball: real 'Area' row (not Target/Targets), real components V/S/M, real Reflex-half saving throw, real multi-paragraph description ending with the real material-component sentence", () => {
  const spell = extractSpellFromHtml(FIREBALL_HTML);
  assert.deepEqual(spell.targetOrAreaOrEffect, { kind: "area", text: "20-ft.-radius spread" });
  assert.deepEqual(spell.components, ["V", "S", "M"]);
  assert.equal(spell.savingThrow, "Reflex half");
  assert.match(spell.description, /A tiny ball of bat guano and sulfur\.$/);
  assert.equal(spell.extractionStatus, "fully_structured");
});

test("Cure Light Wounds: real school+subschool ('Conjuration (Healing)', no descriptors), real singular 'Target' row, real 6-entry multi-class/domain Level row including a real domain label ('Healing') alongside real classes, real '(harmless); see text' qualifiers preserved verbatim", () => {
  const spell = extractSpellFromHtml(CURE_LIGHT_WOUNDS_HTML);
  assert.equal(spell.school, "Conjuration");
  assert.equal(spell.subschool, "Healing");
  assert.deepEqual(spell.descriptors, []);
  assert.deepEqual(spell.targetOrAreaOrEffect, { kind: "target", text: "Creature touched" });
  assert.deepEqual(spell.classLevels, [
    { classOrDomainLabel: "Brd", level: 1 },
    { classOrDomainLabel: "Clr", level: 1 },
    { classOrDomainLabel: "Drd", level: 1 },
    { classOrDomainLabel: "Healing", level: 1 },
    { classOrDomainLabel: "Pal", level: 1 },
    { classOrDomainLabel: "Rgr", level: 2 },
  ]);
  assert.equal(spell.savingThrow, "Will half (harmless); see text");
  assert.equal(spell.spellResistance, "Yes (harmless); see text");
  assert.equal(spell.extractionStatus, "fully_structured");
});

test("Blink: real Range 'Personal' spell has no real Saving Throw/Spell Resistance rows on its own page — null, not a gap, still fully_structured with zero notes", () => {
  const spell = extractSpellFromHtml(BLINK_HTML);
  assert.equal(spell.range, "Personal");
  assert.equal(spell.savingThrow, null);
  assert.equal(spell.spellResistance, null);
  assert.equal(spell.inheritsFromCanonicalId, null);
  assert.equal(spell.extractionStatus, "fully_structured");
  assert.deepEqual(spell.extractionNotes, []);
});

test("Bull's Strength, Mass: real reference-based variant spell — shorter real stat block (only Level/Range/Targets), real 'functions like bull's strength, except...' text resolves inheritsFromCanonicalId and produces one consolidated note instead of five generic failure notes, partially_structured not unresolved", () => {
  const spell = extractSpellFromHtml(BULLS_STRENGTH_MASS_HTML);
  assert.equal(spell.canonicalId, "dnd35e:spell:bulls-strength-mass");
  assert.equal(spell.range, "Close (25 ft. + 5 ft./2 levels)");
  assert.deepEqual(spell.targetOrAreaOrEffect, {
    kind: "targets",
    text: "One creature/level, no two of which can be more than 30 ft. apart",
  });
  assert.equal(spell.castingTime, "");
  assert.equal(spell.duration, "");
  assert.equal(spell.savingThrow, null);
  assert.equal(spell.spellResistance, null);
  assert.equal(spell.inheritsFromCanonicalId, "dnd35e:spell:bulls-strength");
  assert.equal(spell.extractionStatus, "partially_structured");
  assert.equal(spell.extractionNotes.length, 1);
  assert.match(spell.extractionNotes[0], /Casting Time.*Duration.*Saving Throw.*Spell Resistance/s);
  assert.match(spell.extractionNotes[0], /bull’s strength/);
});

test("Mirror Image: real Range 'Personal; see text' (not the bare literal 'Personal') is still recognized as a real Personal-range spell — no Saving Throw/Spell Resistance notes, fully_structured", () => {
  const spell = extractSpellFromHtml(MIRROR_IMAGE_HTML);
  assert.equal(spell.range, "Personal; see text");
  assert.equal(spell.savingThrow, null);
  assert.equal(spell.spellResistance, null);
  assert.equal(spell.extractionStatus, "fully_structured");
  assert.deepEqual(spell.extractionNotes, []);
});

test("Bear's Endurance, Mass: real 'Mass bear's endurance works like <a>bear's endurance</a>, except...' phrasing (not 'This spell functions like') still resolves inheritsFromCanonicalId", () => {
  const spell = extractSpellFromHtml(BEARS_ENDURANCE_MASS_HTML);
  assert.equal(spell.inheritsFromCanonicalId, "dnd35e:spell:bears-endurance");
  assert.equal(spell.extractionStatus, "partially_structured");
});

test("Overland Flight: real 'This spell functions like a <a>fly</a> spell, except...' phrasing (inserted article 'a' before the anchor) still resolves inheritsFromCanonicalId; this page is also real Range 'Personal', so its null Saving Throw/Spell Resistance come from that rule, not the reference-inheritance note", () => {
  const spell = extractSpellFromHtml(OVERLAND_FLIGHT_HTML);
  assert.equal(spell.inheritsFromCanonicalId, "dnd35e:spell:fly");
  assert.equal(spell.range, "Personal");
  assert.equal(spell.duration.length > 0, true);
  // Only Casting Time is genuinely missing (inherited from "fly") — the
  // consolidated note should name just that one field, not five.
  assert.equal(spell.extractionNotes.length, 1);
  assert.match(spell.extractionNotes[0], /\[Casting Time\]/);
});

test("Mage's Lucubration: real un-anchored plain-text Level cell ('Wiz 6' with no real <a> wrapper) still parses via the plain-text fallback", () => {
  const spell = extractSpellFromHtml(MAGES_LUCUBRATION_HTML);
  assert.deepEqual(spell.classLevels, [{ classOrDomainLabel: "Wiz", level: 6 }]);
  assert.equal(spell.extractionStatus, "fully_structured");
});

test("Geas/Quest: a real, singular compound-name page with no Range/Duration row at all and a real reference phrasing this pass does not attempt to cover — stays honestly unresolved rather than force-matched", () => {
  const spell = extractSpellFromHtml(GEAS_QUEST_HTML);
  assert.equal(spell.inheritsFromCanonicalId, null);
  assert.equal(spell.extractionStatus, "unresolved");
  assert.ok(spell.extractionNotes.some((n) => n.includes("Range")));
  assert.ok(spell.extractionNotes.some((n) => n.includes("Duration")));
});

test("extractSpellFromHtml throws on a page with no real <h1> name (fail-closed, never silently returns a garbage definition)", () => {
  assert.throws(() => extractSpellFromHtml("<html><body>not a spell page</body></html>"));
});

test("extractSpellFromHtml throws on a page with a real name but no real statBlock table", () => {
  assert.throws(() => extractSpellFromHtml("<html><body><h1>Fake Spell</h1></body></html>"));
});
