import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidStatusPair } from "./provenance";

test("reference_only is valid at any ingestion status", () => {
  assert.equal(isValidStatusPair("discovered", "reference_only"), true);
  assert.equal(isValidStatusPair("extracted", "reference_only"), true);
  assert.equal(isValidStatusPair("structured", "reference_only"), true);
  assert.equal(isValidStatusPair("verified", "reference_only"), true);
});

test("partially_executable requires verified ingestion", () => {
  assert.equal(isValidStatusPair("structured", "partially_executable"), false);
  assert.equal(isValidStatusPair("verified", "partially_executable"), true);
});

test("executable requires verified ingestion", () => {
  assert.equal(isValidStatusPair("extracted", "executable"), false);
  assert.equal(isValidStatusPair("verified", "executable"), true);
});

test("a record can be verified and still reference_only (the expected steady state)", () => {
  assert.equal(isValidStatusPair("verified", "reference_only"), true);
});
