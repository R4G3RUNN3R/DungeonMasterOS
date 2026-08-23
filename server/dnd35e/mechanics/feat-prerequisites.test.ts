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

test("skill_ranks prerequisite: qualifies at exactly the required rank count, fails one below it", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "skill_ranks", skillCanonicalId: "dnd35e:skill:tumble", ranks: 8 };
  assert.equal(
    evaluateFeatPrerequisite(p, { ...BASE_STATE, skillRanks: { "dnd35e:skill:tumble": 8 } }).qualified,
    true,
  );
  const result = evaluateFeatPrerequisite(p, { ...BASE_STATE, skillRanks: { "dnd35e:skill:tumble": 7 } });
  assert.equal(result.qualified, false);
});

test("class_level prerequisite: qualifies at exactly the required level, fails one below it, and fails when the class is absent (?? 0 default)", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "class_level", classCanonicalId: "dnd35e:class:fighter", minimum: 4 };
  assert.equal(
    evaluateFeatPrerequisite(p, { ...BASE_STATE, classLevels: { "dnd35e:class:fighter": 4 } }).qualified,
    true,
  );
  assert.equal(
    evaluateFeatPrerequisite(p, { ...BASE_STATE, classLevels: { "dnd35e:class:fighter": 3 } }).qualified,
    false,
  );
  assert.equal(
    evaluateFeatPrerequisite(p, { ...BASE_STATE, classLevels: {} }).qualified,
    false,
    "class entirely absent from classLevels must default to 0, not silently qualify",
  );
});

test("character_level prerequisite: qualifies at exactly the required level, fails one below it", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "character_level", minimum: 6 };
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, characterLevel: 6 }).qualified, true);
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, characterLevel: 5 }).qualified, false);
});

test("caster_level prerequisite: qualifies at exactly the required level, fails one below it", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "caster_level", minimum: 3 };
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, casterLevel: 3 }).qualified, true);
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, casterLevel: 2 }).qualified, false);
});

test("a special prerequisite nested inside all blocks the whole composite even when every other sibling is satisfied", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "all",
    requirements: [
      { kind: "bab", minimum: 1 },
      { kind: "special", description: "Wild shape class feature" },
    ],
  };
  const result = evaluateFeatPrerequisite(p, { ...BASE_STATE, baseAttackBonus: 1 });
  assert.equal(result.qualified, false, "an unverifiable special sibling must fail the whole all-composite, not be silently skipped");
  assert.ok(
    result.failureReasons.some((r) => r.includes("Wild shape class feature")),
    "the real special description must surface in the failure reasons",
  );
});

test("a special prerequisite nested inside any does not block the composite when a genuinely qualifying sibling exists", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "any",
    requirements: [
      { kind: "special", description: "Wild shape class feature" },
      { kind: "bab", minimum: 0 },
    ],
  };
  const result = evaluateFeatPrerequisite(p, BASE_STATE);
  assert.equal(result.qualified, true, "any only needs one qualifying branch; an unrelated special sibling must not block it");
});

test("an unrecognized prerequisite kind fails closed with a real reason, not undefined and not a throw — defends against malformed data that bypassed the type system via storage.ts's unvalidated JSON.parse", () => {
  const malformed = { kind: "proficiency", weapon: "longsword" } as unknown as Dnd35eFeatPrerequisite;
  const result = evaluateFeatPrerequisite(malformed, BASE_STATE);
  assert.notEqual(result, undefined, "must never return undefined for unrecognized input");
  assert.equal(result.qualified, false, "an unrecognized prerequisite kind must never be treated as satisfied");
  assert.equal(result.failureReasons.length, 1);
  assert.match(result.failureReasons[0], /Unrecognized prerequisite structure/);
});

test("an empty 'all' (zero requirements) fails closed instead of vacuously qualifying via Array.prototype.every", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "all", requirements: [] };
  const result = evaluateFeatPrerequisite(p, BASE_STATE);
  assert.equal(result.qualified, false, "an empty 'all' means no real requirement was ever evaluated — it must not qualify");
  assert.equal(result.failureReasons.length, 1);
  assert.match(result.failureReasons[0], /Malformed prerequisite: 'all' with no requirements/);
});

test("an empty 'any' (zero requirements) fails closed with a real, non-blank reason", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "any", requirements: [] };
  const result = evaluateFeatPrerequisite(p, BASE_STATE);
  assert.equal(result.qualified, false);
  assert.equal(result.failureReasons.length, 1);
  assert.notEqual(result.failureReasons[0], "", "the empty-any failure reason must not be a blank string");
  assert.match(result.failureReasons[0], /Malformed prerequisite: 'any' with no requirements/);
});

test("a special prerequisite nested two levels deep inside all (via an any with no other qualifying branch) still fails the whole tree", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "all",
    requirements: [
      { kind: "bab", minimum: 0 },
      { kind: "any", requirements: [{ kind: "special", description: "GM approval required" }] },
    ],
  };
  const result = evaluateFeatPrerequisite(p, BASE_STATE);
  assert.equal(
    result.qualified,
    false,
    "the inner any has no qualifying branch (its only child is special), so it fails, which must fail the outer all even though the BAB 0 sibling passes",
  );
});
