// server/dnd35e/extraction/skills-extractor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractSkillFromHtml } from "./skills-extractor";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIMB_HTML = fs.readFileSync(path.join(__dirname, "skill-climb-fixture.html"), "utf-8");
const JUMP_HTML = fs.readFileSync(path.join(__dirname, "skill-jump-fixture.html"), "utf-8");
const DISABLE_DEVICE_HTML = fs.readFileSync(path.join(__dirname, "skill-disabledevice-fixture.html"), "utf-8");

test("Climb: real canonical ID, Str key ability, real armor check penalty flag, no trained-only flag", () => {
  const climb = extractSkillFromHtml(CLIMB_HTML);
  assert.equal(climb.canonicalId, "dnd35e:skill:climb");
  assert.equal(climb.name, "Climb");
  assert.equal(climb.keyAbility, "str");
  assert.equal(climb.armorCheckPenalty, true);
  assert.equal(climb.trainedOnly, false);
});

test("Climb: real 4 sections (Check, Action, Special, Synergy) captured with real non-empty text", () => {
  const climb = extractSkillFromHtml(CLIMB_HTML);
  assert.equal(climb.sections.length, 4);
  const headings = climb.sections.map((s) => s.heading);
  assert.deepEqual(headings, ["Check", "Action", "Special", "Synergy"]);
  for (const section of climb.sections) {
    assert.ok(section.text.length > 0, `${section.heading} must have real captured text`);
  }
});

test("Climb: real embedded DC-lookup table in the Check section is honestly disclosed via extractionNotes, not silently dropped — partially_structured, not fully_structured", () => {
  const climb = extractSkillFromHtml(CLIMB_HTML);
  assert.equal(climb.extractionStatus, "partially_structured");
  assert.ok(climb.extractionNotes.some((n) => n.includes("Check") && n.includes("reference table")));
});

test("Jump: real Synergy section is captured from a <ul><li> list, not left empty — the extractor must recognize <li> content, not just <p>", () => {
  const jump = extractSkillFromHtml(JUMP_HTML);
  const synergy = jump.sections.find((s) => s.heading === "Synergy");
  assert.ok(synergy);
  assert.ok(synergy!.text.length > 0, "Synergy's real <li> content must not be silently empty");
  assert.match(synergy!.text, /Tumble/);
});

test("Disable Device: real 'Int; Trained Only' heading flags correctly set keyAbility=int, trainedOnly=true, armorCheckPenalty=false", () => {
  const disableDevice = extractSkillFromHtml(DISABLE_DEVICE_HTML);
  assert.equal(disableDevice.keyAbility, "int");
  assert.equal(disableDevice.trainedOnly, true);
  assert.equal(disableDevice.armorCheckPenalty, false);
});

test("Disable Device: real 10 sections including the h4-level 'Other Ways To Beat A Trap' deep-dive and its 4 real h5 children (Ranged/Melee Attack Traps, Pits, Magic Traps), all captured as flat named sections", () => {
  const disableDevice = extractSkillFromHtml(DISABLE_DEVICE_HTML);
  assert.equal(disableDevice.sections.length, 10);
  const headings = disableDevice.sections.map((s) => s.heading);
  assert.deepEqual(headings, [
    "Check",
    "Action",
    "Try Again",
    "Special",
    "Restriction",
    "Other Ways To Beat A Trap",
    "Ranged Attack Traps",
    "Melee Attack Traps",
    "Pits",
    "Magic Traps",
  ]);
  const restriction = disableDevice.sections.find((s) => s.heading === "Restriction")!;
  assert.doesNotMatch(restriction.text, /Other Ways To Beat A Trap/, "Restriction's captured text must stop before the next real heading (h4 or h5), not swallow it");
});

test("extractSkillFromHtml throws on a page with no real skill heading (fail-closed, never silently returns a garbage definition)", () => {
  assert.throws(() => extractSkillFromHtml("<html><body>not a skill page</body></html>"));
});
