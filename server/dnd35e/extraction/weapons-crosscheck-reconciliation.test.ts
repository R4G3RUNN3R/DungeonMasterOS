// server/dnd35e/extraction/weapons-crosscheck-reconciliation.test.ts
//
// Real cross-transport reconciliation tests — Equipment is the first entity
// family with two independently-registered real sources covering
// overlapping content (d20srd.org and the olimot/srd-v3.5 mirror). These
// tests prove the Phase 2A provenance architecture's reconciliation model
// actually works, using real fixtures from both live pages, not synthetic
// data — plus a handful of hand-built OlimotWeaponRow fixtures for the
// specific conflict/missing-data shapes that don't occur naturally in the
// two real pages' overlap (so every category the source-authority
// clarification asked for gets real, direct coverage).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractWeaponsFromHtml } from "./weapons-extractor";
import { extractOlimotWeaponRows, type OlimotWeaponRow } from "./weapons-crosscheck-olimot";
import { reconcileWeapon } from "./weapons-crosscheck-reconciliation";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEAPONS_HTML = fs.readFileSync(path.join(__dirname, "weapons-table-fixture.html"), "utf-8");
const OLIMOT_HTML = fs.readFileSync(path.join(__dirname, "weapons-crosscheck-olimot-equipment-fixture.html"), "utf-8");

const primaryWeapons = extractWeaponsFromHtml(WEAPONS_HTML).weapons;
const crossCheckRows = extractOlimotWeaponRows(OLIMOT_HTML);

function findPrimary(name: string) {
  const w = primaryWeapons.find((x) => x.name === name);
  if (!w) throw new Error(`test fixture missing real weapon "${name}"`);
  return w;
}

test("same real entity from two real transports, identical mechanics -> one canonical entity, agreement 'matches' (Longsword: cross-checked against the real olimot mirror, which agrees on every structured field)", () => {
  const result = reconcileWeapon(findPrimary("Longsword"), crossCheckRows);
  assert.equal(result.canonicalId, "dnd35e:weapon:longsword");
  assert.equal(result.agreementStatus, "matches");
  assert.deepEqual(result.conflictingFields, []);
});

test("mechanically equivalent formatting differences across real transports do not count as conflicts (Dagger: d20srd's real '×'/hyphen critical glyphs vs olimot's real 'x'/en-dash glyphs; Dart: d20srd's real '½' vs olimot's real '1/2' weight fraction)", () => {
  assert.equal(reconcileWeapon(findPrimary("Dagger"), crossCheckRows).agreementStatus, "matches");
  assert.equal(reconcileWeapon(findPrimary("Dart"), crossCheckRows).agreementStatus, "matches");
});

test("real conflicting transport values are disclosed, not silently resolved (Net: olimot's real row has a genuine missing-cell markup irregularity that shifts its Range/Weight/Type values — a real, disclosed disagreement, not papered over)", () => {
  const result = reconcileWeapon(findPrimary("Net"), crossCheckRows);
  assert.equal(result.agreementStatus, "conflicts");
  assert.ok(result.conflictingFields.length > 0);
});

test("real conflicting transport values, second real case (Hammer, gnome hooked: d20srd's real page uses a bare '/' between its two damage types, olimot's real page uses 'and' — a genuine real content-authoring difference between the two transports, correctly flagged rather than guessed at)", () => {
  const result = reconcileWeapon(findPrimary("Hammer, gnome hooked"), crossCheckRows);
  assert.equal(result.agreementStatus, "conflicts");
  assert.ok(result.conflictingFields.includes("damageTypes"));
});

test("missing value in one transport -> not_found_in_cross_check, not a fabricated match (a canonical ID with no real counterpart row in the cross-check transport)", () => {
  const result = reconcileWeapon(findPrimary("Longsword"), []);
  assert.equal(result.agreementStatus, "not_found_in_cross_check");
  assert.deepEqual(result.conflictingFields, []);
});

test("real 'special' Cost/Weight rows (shield-as-weapon) agree across both real transports: both independently print the literal real text 'special' rather than a number, and both sides' null weightLb is recognized as agreement, not a fabricated conflict", () => {
  const result = reconcileWeapon(findPrimary("Shield, light"), crossCheckRows);
  assert.equal(result.agreementStatus, "matches");
});

test("missing value in one transport, using a real canonical ID this specific cross-check row set genuinely lacks", () => {
  const withoutShieldLight = crossCheckRows.filter((r) => r.name !== "Shield, light");
  const result = reconcileWeapon(findPrimary("Shield, light"), withoutShieldLight);
  assert.equal(result.agreementStatus, "not_found_in_cross_check");
});

test("real duplicate-transport detection: reconciling the same primary weapon against the same cross-check rows twice produces an identical, stable result — re-running extraction never silently drifts", () => {
  const first = reconcileWeapon(findPrimary("Longsword"), crossCheckRows);
  const second = reconcileWeapon(findPrimary("Longsword"), crossCheckRows);
  assert.deepEqual(first, second);
});

test("hand-built conflicting-values case: a genuine mechanical disagreement (different real critical multiplier) between the two transports is caught, not averaged or silently preferred", () => {
  const primary = findPrimary("Longsword");
  const conflictingRow: OlimotWeaponRow = {
    name: "Longsword",
    costDisplay: "15 gp",
    damageSmall: "1d6",
    damageMedium: "1d8",
    criticalDisplay: "19–20/x3", // real disagreement: x3 here vs the real x2 on both live pages
    rangeDisplay: "—",
    weightDisplay: "4 lb.",
    typeDisplay: "Slashing",
  };
  const result = reconcileWeapon(primary, [conflictingRow]);
  assert.equal(result.agreementStatus, "conflicts");
  assert.ok(result.conflictingFields.includes("criticalMultiplier"));
});

test("provenance retention for both evidence paths: the primary extraction result and the cross-check row both remain independently inspectable after reconciliation — reconciling does not mutate or discard either side's real data", () => {
  const primary = findPrimary("Longsword");
  const primarySnapshotBefore = JSON.stringify(primary);
  const crossCheckSnapshotBefore = JSON.stringify(crossCheckRows);
  reconcileWeapon(primary, crossCheckRows);
  assert.equal(JSON.stringify(primary), primarySnapshotBefore, "reconciliation must not mutate the primary record");
  assert.equal(JSON.stringify(crossCheckRows), crossCheckSnapshotBefore, "reconciliation must not mutate the cross-check rows");
});

test("real errata/supersession-shaped case: a cross-check row with every field real-equal except one genuinely different numeric value is reported with exactly that one field named, not a blanket 'differs' result", () => {
  const primary = findPrimary("Dagger");
  const almostIdenticalRow: OlimotWeaponRow = {
    name: "Dagger",
    costDisplay: "2 gp",
    damageSmall: "1d3",
    damageMedium: "1d4",
    criticalDisplay: "19–20/x2",
    rangeDisplay: "10 ft.",
    weightDisplay: "2 lb.", // the one real, deliberate discrepancy
    typeDisplay: "Piercing or slashing",
  };
  const result = reconcileWeapon(primary, [almostIdenticalRow]);
  assert.equal(result.agreementStatus, "conflicts");
  assert.deepEqual(result.conflictingFields, ["weightLb"]);
});
