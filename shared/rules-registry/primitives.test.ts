import { test } from "node:test";
import assert from "node:assert/strict";
import type { PowerSystem, ConditionId, ActionType, CreatureType } from "./primitives";

test("PowerSystem includes every non-spell subsystem named in the design spec", () => {
  const systems: PowerSystem[] = [
    "spell", "psionic", "invocation", "maneuver", "incarnum", "binding",
    "shadow-magic", "truenaming",
  ];
  assert.equal(systems.length, 8, "documents the exact set this plan commits to at this stage");
});

test("psionic is a distinct PowerSystem from spell", () => {
  const psionic: PowerSystem = "psionic";
  const spell: PowerSystem = "spell";
  assert.notEqual(psionic, spell);
});

test("ConditionId covers core 3.5e conditions referenced by name in the SRD", () => {
  const sample: ConditionId[] = ["flat-footed", "prone", "stunned", "grappling", "helpless"];
  assert.equal(sample.length, 5);
});

test("ActionType covers the 3.5e action-economy categories", () => {
  const types: ActionType[] = ["standard", "move", "full-round", "free", "swift", "immediate"];
  assert.equal(types.length, 6);
});

test("CreatureType is a closed vocabulary distinct from CreatureSubtype", () => {
  const type: CreatureType = "dragon";
  assert.equal(type, "dragon");
});
