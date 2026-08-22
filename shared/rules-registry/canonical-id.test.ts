import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCanonicalId, buildCanonicalId, isValidCanonicalId } from "./canonical-id";

test("buildCanonicalId produces the expected format", () => {
  assert.equal(buildCanonicalId("dnd35e", "spell", "fireball"), "dnd35e:spell:fireball");
});

test("parseCanonicalId parses a well-formed ID", () => {
  assert.deepEqual(parseCanonicalId("dnd35e:spell:fireball"), {
    ruleset: "dnd35e", entityType: "spell", slug: "fireball",
  });
});

test("parseCanonicalId returns null for missing segments", () => {
  assert.equal(parseCanonicalId("dnd35e:spell"), null);
  assert.equal(parseCanonicalId("dnd35e"), null);
});

test("parseCanonicalId returns null for uppercase or spaces", () => {
  assert.equal(parseCanonicalId("DND35E:spell:fireball"), null);
  assert.equal(parseCanonicalId("dnd35e:spell:fire ball"), null);
});

test("isValidCanonicalId agrees with parseCanonicalId", () => {
  assert.equal(isValidCanonicalId("dnd35e:feat:power-attack"), true);
  assert.equal(isValidCanonicalId("not valid"), false);
});

test("dnd35e and dnd5e produce distinct IDs for the same slug", () => {
  const a = buildCanonicalId("dnd35e", "spell", "fireball");
  const b = buildCanonicalId("dnd5e", "spell", "fireball");
  assert.notEqual(a, b);
});
