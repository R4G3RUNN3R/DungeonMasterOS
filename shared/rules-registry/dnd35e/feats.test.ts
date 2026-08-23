import { test } from "node:test";
import assert from "node:assert/strict";
import { describeFeatPrerequisite } from "./feats";
import type { Dnd35eFeatPrerequisite } from "./feats";

test("describeFeatPrerequisite: null means no prerequisites", () => {
  assert.equal(describeFeatPrerequisite(null), "None");
});

test("describeFeatPrerequisite: ability", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "ability", ability: "str", minimum: 13 };
  assert.equal(describeFeatPrerequisite(p), "Str 13");
});

test("describeFeatPrerequisite: bab", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "bab", minimum: 6 };
  assert.equal(describeFeatPrerequisite(p), "Base attack bonus +6");
});

test("describeFeatPrerequisite: skill_ranks", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "skill_ranks", skillCanonicalId: "dnd35e:skill:tumble", ranks: 5 };
  assert.equal(describeFeatPrerequisite(p), "5 ranks in dnd35e:skill:tumble");
});

test("describeFeatPrerequisite: feat", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "feat", featCanonicalId: "dnd35e:feat:dodge" };
  assert.equal(describeFeatPrerequisite(p), "dnd35e:feat:dodge");
});

test("describeFeatPrerequisite: all joins with commas", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "all",
    requirements: [
      { kind: "feat", featCanonicalId: "dnd35e:feat:dodge" },
      { kind: "bab", minimum: 6 },
    ],
  };
  assert.equal(describeFeatPrerequisite(p), "dnd35e:feat:dodge, Base attack bonus +6");
});

test("describeFeatPrerequisite: any joins with 'or'", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "any",
    requirements: [
      { kind: "ability", ability: "str", minimum: 13 },
      { kind: "ability", ability: "dex", minimum: 13 },
    ],
  };
  assert.equal(describeFeatPrerequisite(p), "Str 13 or Dex 13");
});

test("describeFeatPrerequisite: special returns its own real description verbatim", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "special", description: "Wild shape class feature" };
  assert.equal(describeFeatPrerequisite(p), "Wild shape class feature");
});

test("describeFeatPrerequisite: class_level", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "class_level", classCanonicalId: "dnd35e:class:fighter", minimum: 8 };
  assert.equal(describeFeatPrerequisite(p), "dnd35e:class:fighter level 8");
});

test("describeFeatPrerequisite: character_level", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "character_level", minimum: 6 };
  assert.equal(describeFeatPrerequisite(p), "Character level 6");
});

test("describeFeatPrerequisite: caster_level", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "caster_level", minimum: 3 };
  assert.equal(describeFeatPrerequisite(p), "Caster level 3");
});

test("describeFeatPrerequisite: manifester_level (new)", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "manifester_level", minimum: 5 };
  assert.equal(describeFeatPrerequisite(p), "Manifester level 5");
});

test("describeFeatPrerequisite: proficiency (new) returns its own real description verbatim", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "proficiency", description: "Proficiency with selected weapon" };
  assert.equal(describeFeatPrerequisite(p), "Proficiency with selected weapon");
});

test("describeFeatPrerequisite: class_feature (new) returns its own real description verbatim", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "class_feature", description: "Ability to turn or rebuke creatures" };
  assert.equal(describeFeatPrerequisite(p), "Ability to turn or rebuke creatures");
});
