// server/achievements-titles.test.ts
// Covers the two hidden title-milestone achievements added alongside
// server/titles.ts — the achievement engine itself (shared/achievements.ts)
// otherwise has no dedicated test file, so this is scoped to what changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAchievements, ACHIEVEMENT_MAP } from "@shared/achievements";

test("many_names and legend_of_many_names are hidden achievements (never player-visible pre-unlock)", () => {
  assert.equal(ACHIEVEMENT_MAP["many_names"].hidden, true);
  assert.equal(ACHIEVEMENT_MAP["legend_of_many_names"].hidden, true);
});

test("checkAchievements: character with 9 established titles does not unlock many_names", () => {
  const unlocked = checkAchievements({
    type: "dm_response",
    character: { id: 1, hp: 20, maxHp: 20, establishedTitleCount: 9 },
    unlockedIds: new Set(),
  });
  assert.ok(!unlocked.includes("many_names"));
});

test("checkAchievements: character with 10 established titles unlocks many_names exactly once", () => {
  const unlocked = checkAchievements({
    type: "dm_response",
    character: { id: 1, hp: 20, maxHp: 20, establishedTitleCount: 10 },
    unlockedIds: new Set(),
  });
  assert.ok(unlocked.includes("many_names"));
});

test("checkAchievements: many_names does not re-fire once already unlocked", () => {
  const unlocked = checkAchievements({
    type: "dm_response",
    character: { id: 1, hp: 20, maxHp: 20, establishedTitleCount: 15 },
    unlockedIds: new Set(["many_names"]),
  });
  assert.ok(!unlocked.includes("many_names"));
});

test("checkAchievements: account with 99 established titles does not unlock legend_of_many_names", () => {
  const unlocked = checkAchievements({
    type: "dm_response",
    account: { totalLevelUps: 0, establishedTitleCount: 99 },
    unlockedIds: new Set(),
  });
  assert.ok(!unlocked.includes("legend_of_many_names"));
});

test("checkAchievements: account with 100 established titles unlocks legend_of_many_names", () => {
  const unlocked = checkAchievements({
    type: "dm_response",
    account: { totalLevelUps: 0, establishedTitleCount: 100 },
    unlockedIds: new Set(),
  });
  assert.ok(unlocked.includes("legend_of_many_names"));
});

test("checkAchievements: titles achievements carry no rewardTurns (cosmetic/prestige only)", () => {
  assert.equal(ACHIEVEMENT_MAP["many_names"].rewardTurns, undefined);
  assert.equal(ACHIEVEMENT_MAP["legend_of_many_names"].rewardTurns, undefined);
});
