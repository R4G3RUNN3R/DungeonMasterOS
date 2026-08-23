// server/dnd35e/mechanics/feat-prerequisites.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateFeatPrerequisite } from "./feat-prerequisites";
import type { Dnd35eFeatPrerequisite } from "../../../shared/rules-registry/dnd35e/feats";
import type { Dnd35eCharacterQualificationState } from "./feat-prerequisites";

const BASE_STATE: Dnd35eCharacterQualificationState = {
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  baseAttackBonus: 0,
  characterLevel: 1,
  classLevels: {},
  skillRanks: {},
  featCanonicalIds: [],
  casterLevel: 0,
};

test("null prerequisite always qualifies", () => {
  assert.deepEqual(evaluateFeatPrerequisite(null, BASE_STATE), { qualified: true, failureReasons: [] });
});

test("ability prerequisite: qualifies at exactly the minimum, fails below it", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "ability", ability: "str", minimum: 13 };
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, abilities: { ...BASE_STATE.abilities, str: 13 } }).qualified, true);
  const result = evaluateFeatPrerequisite(p, { ...BASE_STATE, abilities: { ...BASE_STATE.abilities, str: 12 } });
  assert.equal(result.qualified, false);
  assert.equal(result.failureReasons[0], "Str 13");
});

test("bab prerequisite: real boundary check", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "bab", minimum: 6 };
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, baseAttackBonus: 6 }).qualified, true);
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, baseAttackBonus: 5 }).qualified, false);
});

test("feat prerequisite: checks real featCanonicalIds membership", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "feat", featCanonicalId: "dnd35e:feat:dodge" };
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, featCanonicalIds: ["dnd35e:feat:dodge"] }).qualified, true);
  assert.equal(evaluateFeatPrerequisite(p, BASE_STATE).qualified, false);
});

test("all: qualifies only when every child qualifies, collects every real failure reason", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "all",
    requirements: [{ kind: "bab", minimum: 6 }, { kind: "ability", ability: "str", minimum: 13 }],
  };
  const result = evaluateFeatPrerequisite(p, BASE_STATE);
  assert.equal(result.qualified, false);
  assert.equal(result.failureReasons.length, 2, "both real unmet requirements must be reported, not just the first");
});

test("any: qualifies when at least one child qualifies", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "any",
    requirements: [{ kind: "ability", ability: "str", minimum: 13 }, { kind: "ability", ability: "dex", minimum: 13 }],
  };
  const result = evaluateFeatPrerequisite(p, { ...BASE_STATE, abilities: { ...BASE_STATE.abilities, dex: 13 } });
  assert.equal(result.qualified, true);
});

test("special prerequisite NEVER silently qualifies — the server cannot verify unstructured prose, so it fails closed with an explicit human-review reason", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "special", description: "Wild shape class feature" };
  const result = evaluateFeatPrerequisite(p, BASE_STATE);
  assert.equal(result.qualified, false, "an unparseable prerequisite must never be treated as automatically satisfied");
  assert.match(result.failureReasons[0], /Wild shape class feature/);
});
