import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSourcePageKey, isValidSourcePageVerification } from "./srd-manifest";
import { isValidCanonicalId } from "./canonical-id";

test("buildSourcePageKey combines sourceKey and sourcePath with a plain, non-canonical separator", () => {
  assert.equal(
    buildSourcePageKey("dnd35e-srd-olimot-mirror", "spells/spells-a-b.html"),
    "dnd35e-srd-olimot-mirror::spells/spells-a-b.html",
  );
});

test("buildSourcePageKey output is deliberately NOT a valid canonical ID", () => {
  const key = buildSourcePageKey("dnd35e-srd-hypertext-d20", "/indexes/variantClasses.htm");
  assert.equal(
    isValidCanonicalId(key),
    false,
    "a source page key must never accidentally satisfy the canonical-entity-ID grammar — pages and entities are structurally disjoint ID spaces",
  );
});

test("isValidSourcePageVerification: verification metadata is valid only once processingStatus is source_verified", () => {
  for (const status of ["discovered", "fetched", "hashed", "parsed"] as const) {
    assert.equal(isValidSourcePageVerification(status, true), false);
  }
  assert.equal(isValidSourcePageVerification("source_verified", true), true);
});

test("isValidSourcePageVerification: no verification metadata is valid at any processingStatus", () => {
  for (const status of ["discovered", "fetched", "hashed", "parsed", "source_verified"] as const) {
    assert.equal(isValidSourcePageVerification(status, false), true);
  }
});
