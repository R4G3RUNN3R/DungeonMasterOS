import { test } from "node:test";
import assert from "node:assert/strict";
import { requiresRightsReview } from "./evidence";
import type { EvidenceSourceKind } from "./evidence";

const ALL_KINDS: EvidenceSourceKind[] = [
  "open_canonical", "licensed_local_reference", "licensed_digital_reference",
  "official_public_reference", "external_read_only_reference", "third_party_reference",
  "homebrew", "requires_rights_review",
];

test("requiresRightsReview is true only for requires_rights_review", () => {
  for (const kind of ALL_KINDS) {
    assert.equal(requiresRightsReview(kind), kind === "requires_rights_review", `mismatch for ${kind}`);
  }
});

test("all 8 evidence kinds are distinct strings (no accidental alias collision)", () => {
  assert.equal(new Set(ALL_KINDS).size, 8);
});
