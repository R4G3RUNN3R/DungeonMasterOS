import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCurrencyChange } from "./routes";

test("resolveCurrencyChange: rejects a narration-inferred spend that would overdraw the real balance", () => {
  // 2026-08-18 production gap: a narration claiming a purchase was applied
  // unconditionally, letting AI-inferred narration invent debt/negative
  // currency instead of the purchase being rejected.
  const result = resolveCurrencyChange(0, -50);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "insufficient_balance");
});

test("resolveCurrencyChange: accepts a spend that exactly zeroes the balance", () => {
  const result = resolveCurrencyChange(10, -10);
  assert.equal(result.accepted, true);
});

test("resolveCurrencyChange: rejects a spend that would leave the balance negative by any margin", () => {
  const result = resolveCurrencyChange(10, -11);
  assert.equal(result.accepted, false);
});

test("resolveCurrencyChange: always accepts a gain", () => {
  const result = resolveCurrencyChange(0, 25);
  assert.equal(result.accepted, true);
});
