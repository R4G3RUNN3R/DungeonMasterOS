import { test } from "node:test";
import assert from "node:assert/strict";
import { isLossNarration } from "./routes";

test("isLossNarration: matches the actual production narration that failed to trigger item removal (2026-08-18 Coin Purse bug)", () => {
  const narration =
    "The merchant's coin purse is not on you. You held it out, he snatched it back, and he retied it short on the inside of his own belt — you watched him do it.";
  assert.equal(isLossNarration(narration), true);
});

test("isLossNarration: matches inflected forms the old bare-word regex missed", () => {
  const cases = [
    "The guard confiscated your dagger at the gate.",
    "You return the amulet to its owner.",
    "The vial shatters against the stone floor.",
    "She stole the ring while you slept.",
    "Your pack strap breaks and the bedroll is lost in the river.",
    "The merchant discarded the broken lantern.",
    "You sold the horse for twelve gold.",
  ];
  for (const narration of cases) {
    assert.equal(isLossNarration(narration), true, `expected a loss-keyword match for: "${narration}"`);
  }
});

test("isLossNarration: ordinary narration with no item loss does not match", () => {
  const cases = [
    "The tavern is loud tonight, and the fire crackles in the hearth.",
    "You nod to the guard and continue down the road.",
    "The merchant eyes you warily but says nothing.",
  ];
  for (const narration of cases) {
    assert.equal(isLossNarration(narration), false, `expected no loss-keyword match for: "${narration}"`);
  }
});
