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
