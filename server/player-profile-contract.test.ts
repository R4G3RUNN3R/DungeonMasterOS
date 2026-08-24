import test from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS } from "@shared/achievements";
import {
  calculateTurnsEarned,
  normalizeShowcaseSelection,
  visibleAchievementDefinitions,
} from "@shared/player-profile";

test("calculateTurnsEarned sums reward-bearing unlocked achievements only", () => {
  assert.equal(calculateTurnsEarned(["scars_of_experience", "first_blood"]), 100);
});

test("normalizeShowcaseSelection keeps order, removes duplicates, and caps at three", () => {
  assert.deepEqual(normalizeShowcaseSelection(["a", "b", "a", "c", "d"]), ["a", "b", "c"]);
});

test("normalizeShowcaseSelection removes empty achievement IDs", () => {
  assert.deepEqual(normalizeShowcaseSelection(["", "a", "  ", "b"]), ["a", "b"]);
});

test("visibleAchievementDefinitions excludes locked hidden achievements", () => {
  const visible = visibleAchievementDefinitions(new Set());
  assert.ok(visible.every((achievement) => !achievement.hidden));
});

test("visibleAchievementDefinitions includes a hidden achievement after unlock", () => {
  const hidden = ACHIEVEMENTS.find((achievement) => achievement.hidden);
  assert.ok(hidden);
  const visible = visibleAchievementDefinitions(new Set([hidden!.id]));
  assert.ok(visible.some((achievement) => achievement.id === hidden!.id));
});
