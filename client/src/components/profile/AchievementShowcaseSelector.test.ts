import assert from "node:assert/strict";
import test from "node:test";

import * as PlayerProfilePageModule from "@/pages/player-profile";
import * as AchievementShowcaseSelectorModule from "./AchievementShowcaseSelector";

const candidates = [
  { id: "a", name: "A", description: "", icon: "award", category: "combat" as const, unlocked: true },
  { id: "b", name: "B", description: "", icon: "award", category: "combat" as const, unlocked: true },
  { id: "c", name: "C", description: "", icon: "award", category: "combat" as const, unlocked: true },
  { id: "d", name: "D", description: "", icon: "award", category: "combat" as const, unlocked: true },
];

const profileShowcase = [
  candidates[2],
  { id: "locked", name: "Locked", description: "", icon: "award", category: "combat" as const, unlocked: false },
  candidates[1],
  candidates[0],
];

type PlayerProfileTesting = {
  initialShowcaseSelection: (
    localSelection: string[] | null,
    showcasedAchievements: typeof profileShowcase,
    unlockedCandidates: typeof candidates,
  ) => string[];
};

type SelectorTesting = {
  reconcilePendingSelection: (input: {
    wasOpen: boolean;
    open: boolean;
    pendingSelection: string[];
    selectedIds: string[];
    achievements: typeof candidates;
  }) => string[];
};

test("player profile selector starts from the curated unlocked showcase, not every candidate", () => {
  const testing = (PlayerProfilePageModule as { __testing__?: PlayerProfileTesting }).__testing__;
  assert.ok(testing, "the pure initial-selection logic must be available to this node:test regression");

  assert.deepEqual(
    testing.initialShowcaseSelection(null, profileShowcase, candidates),
    ["c", "b", "a"],
  );
  assert.deepEqual(
    testing.initialShowcaseSelection(["d"], profileShowcase, candidates),
    ["d"],
    "a saved local selection remains authoritative",
  );
});

test("showcase selector adopts fresh external selection only when it reopens", () => {
  const testing = (AchievementShowcaseSelectorModule as { __testing__?: SelectorTesting }).__testing__;
  assert.ok(testing, "the pure dialog-transition logic must be available to this node:test regression");

  assert.deepEqual(
    testing.reconcilePendingSelection({
      wasOpen: true,
      open: true,
      pendingSelection: ["d"],
      selectedIds: ["c"],
      achievements: [...candidates],
    }),
    ["d"],
    "fresh-but-equivalent array props during an active dialog must not erase the draft",
  );
  assert.deepEqual(
    testing.reconcilePendingSelection({
      wasOpen: false,
      open: true,
      pendingSelection: ["d"],
      selectedIds: ["c"],
      achievements: [...candidates],
    }),
    ["c"],
    "reopening must adopt the latest external selection",
  );
});
