# Player Profile, Community Discovery & Achievements UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved UI-first player profile, achievement showcase, achievements page, and dashboard community scaffold without adding backend/social/DM wiring.

**Architecture:** Keep all new social/profile information in small allowlisted display contracts under `shared/`, then build focused React components that consume those contracts. The two new pages remain unregistered in `App.tsx`, while the existing dashboard receives only a polished, data-empty Community section. No storage schema, API route, achievement persistence, privacy persistence, or DM prompt behavior is added in this phase.

**Tech Stack:** React 18, TypeScript 5.7, Wouter conventions, TanStack Query conventions, Tailwind CSS, existing shadcn/ui primitives, lucide-react, Node test runner via `tsx`.

**Spec:** `docs/superpowers/specs/2026-08-22-player-profile-community-achievements-design.md`

## Global Constraints

- Match the existing DungeonMasterOS dashboard/account visual language: dark surfaces, restrained bronze accents, compact cards, serif headings, existing shadcn/ui primitives, and current spacing conventions.
- Public profile V1 contains only player header, achievement summary, up to three showcased achievements, and most recent character.
- Use existing username as the public profile name; do not create a second display-name concept.
- `Turns Earned` is lifetime achievement reward history, not current turn balance.
- Owner controls are UI-only affordances in this scaffold; no backend authorization or persistence is added.
- No fake users, fake achievement unlock events, fake current-character details, or fake account activity may ship.
- Hidden achievements must remain hidden until unlocked.
- No new backend/social/DM wiring: no public profile APIs, showcase persistence, activity-event tables, privacy persistence, Session Spotlight logic, or AI prompt integration.
- Do not register `/player/:username` or `/achievements` in `client/src/App.tsx` during this scaffold.
- Existing dashboard, account, campaign, billing, and achievement behavior must remain intact.

---

### Task 1: Public profile and achievement display contracts

**Files:**
- Create: `shared/player-profile.ts`
- Test: `server/player-profile-contract.test.ts`

**Interfaces:**
- Produces: `PublicAchievementSummary`, `PublicCharacterSummary`, `PublicPlayerProfileSummary`, `CommunityAchievementActivity`, `NewAdventurerSummary`, `AchievementsPageModel`, `EMPTY_ACHIEVEMENTS_PAGE_MODEL`, `visibleAchievementDefinitions()`, `calculateTurnsEarned()`, `normalizeShowcaseSelection()`.
- Consumes: `Achievement`, `AchievementCategory`, and `ACHIEVEMENTS` from `shared/achievements.ts`.

- [ ] **Step 1: Write failing contract/helper tests**

Create `server/player-profile-contract.test.ts` covering four behaviors:

```ts
import test from "node:test";
import assert from "node:assert/strict";
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
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```bash
node --import tsx --test server/player-profile-contract.test.ts
```

Expected: FAIL because `@shared/player-profile` does not exist.

- [ ] **Step 3: Implement the minimal shared contracts/helpers**

Create `shared/player-profile.ts` with small display-only interfaces. `calculateTurnsEarned()` must map unlocked IDs to the canonical achievement catalogue and sum only positive `rewardTurns`. `normalizeShowcaseSelection()` must preserve first-seen order, remove empty/duplicate IDs, and return at most three. `visibleAchievementDefinitions()` must expose non-hidden achievements plus hidden achievements whose IDs are unlocked.

`AchievementsPageModel` must contain only:

```ts
export interface AchievementsPageModel {
  unlockedAchievementIds: string[];
  showcasedAchievementIds: string[];
  turnsEarned: number;
  viewerIsOwner: boolean;
}
```

`EMPTY_ACHIEVEMENTS_PAGE_MODEL` must use empty arrays, zero turns, and `viewerIsOwner: false`.

- [ ] **Step 4: Run targeted test and verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Run full server tests**

Run:

```bash
npm test
```

Expected: all existing tests plus the new contract tests pass.

- [ ] **Step 6: Commit**

```bash
git add shared/player-profile.ts server/player-profile-contract.test.ts
git commit -m "feat: add public profile display contracts"
```

---

### Task 2: Reusable profile achievement components

**Files:**
- Create: `client/src/components/profile/AchievementMedalCard.tsx`
- Create: `client/src/components/profile/AchievementShowcase.tsx`
- Create: `client/src/components/profile/AchievementShowcaseSelector.tsx`

**Interfaces:**
- Consumes: `PublicAchievementSummary` from `@shared/player-profile`.
- Produces: reusable medal card, three-slot showcase, and owner showcase selector.

- [ ] **Step 1: Build `AchievementMedalCard` as a pure presentational component**

Required props:

```ts
type AchievementMedalCardProps = {
  achievement: PublicAchievementSummary;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
};
```

Render icon/emblem, name, description when non-compact, earned/locked state, and `+N Turns` only when `rewardTurns > 0`. Use restrained bronze borders and dark inset surfaces; no rarity colors or animated loot effects.

- [ ] **Step 2: Build `AchievementShowcase`**

Required props:

```ts
type AchievementShowcaseProps = {
  achievements: PublicAchievementSummary[];
  editable?: boolean;
  onEdit?: () => void;
};
```

Render at most three medals and, when `editable`, a discreet `Edit Showcase` button. If no achievements are selected, render a polished empty state rather than fake badges.

- [ ] **Step 3: Build `AchievementShowcaseSelector`**

Use the existing Dialog primitives. Required props:

```ts
type AchievementShowcaseSelectorProps = {
  open: boolean;
  achievements: PublicAchievementSummary[];
  selectedIds: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (selectedIds: string[]) => void;
};
```

Selection rules are purely client-side scaffolding: 0-3 items, no duplicates, selected medals highlighted, fourth selection prevented until one is removed. `Save` returns the selected IDs; it does not persist them.

- [ ] **Step 4: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/profile
git commit -m "feat: add achievement showcase components"
```

---

### Task 3: Minimal player profile page scaffold

**Files:**
- Create: `client/src/components/profile/MostRecentCharacterCard.tsx`
- Create: `client/src/pages/player-profile.tsx`

**Interfaces:**
- Consumes: `PublicPlayerProfileSummary`, `PublicCharacterSummary`, and reusable achievement components.
- Produces: unregistered `PlayerProfilePage` scaffold suitable for Claude to connect later.

- [ ] **Step 1: Build `MostRecentCharacterCard`**

Render only portrait, character name, identity label, and progression label/value. No class, campaign, HP, inventory, location, currency, quests, or sheet data.

- [ ] **Step 2: Build `PlayerProfilePage`**

Use a prop-driven page so it can exist without a backend endpoint:

```ts
type PlayerProfilePageProps = {
  profile?: PublicPlayerProfileSummary | null;
};
```

When `profile` is absent, render a finished-looking empty/unwired state. When present, render exactly:

1. player avatar + username + optional member-since year;
2. achievement count + `Turns Earned`;
3. showcased achievements;
4. most recent character.

If `viewerIsOwner` is true, show `Edit Profile` and `Edit Showcase` controls. The edit-profile dialog may expose username/avatar fields and return local edits inside the component only; it must not call an API. The showcase selector may update local page state only; it must not persist.

- [ ] **Step 3: Confirm the page is not routed**

Inspect `client/src/App.tsx` and make no modifications. `/player/:username` must remain unregistered.

- [ ] **Step 4: Typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/profile/MostRecentCharacterCard.tsx client/src/pages/player-profile.tsx
git commit -m "feat: scaffold minimal player profile page"
```

---

### Task 4: Achievements page scaffold

**Files:**
- Create: `client/src/pages/achievements.tsx`

**Interfaces:**
- Consumes: `ACHIEVEMENTS`, shared profile helpers/contracts, `AchievementMedalCard`, and `AchievementShowcaseSelector`.
- Produces: unregistered Achievements page with filters, showcase, progress, and lifetime turns-earned presentation.

- [ ] **Step 1: Build the page around the canonical catalogue**

Accept optional model data:

```ts
type AchievementsPageProps = {
  model?: AchievementsPageModel;
};
```

Default to `EMPTY_ACHIEVEMENTS_PAGE_MODEL`. Build the visible catalogue with `visibleAchievementDefinitions()` so locked secret achievements never appear.

- [ ] **Step 2: Add summary and showcase**

Render `Achievements`, unlocked-visible count / visible-catalogue count, progress bar, lifetime `Turns Earned`, and current showcase. Owner-only `Edit Showcase` opens the reusable selector and updates local page state only.

- [ ] **Step 3: Add filters and collection grid**

Provide compact filters: `All`, `Character`, `Combat`, `Social`, `Exploration`, `Meta`. The `secret` category is not exposed as a filter because hidden entries only become visible after unlock and can simply appear under `All` when earned.

Each card receives a derived `PublicAchievementSummary` and shows reward turns only when applicable.

- [ ] **Step 4: Confirm the page is not routed**

Do not modify `client/src/App.tsx`; `/achievements` remains unregistered in this scaffold.

- [ ] **Step 5: Typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/achievements.tsx
git commit -m "feat: scaffold achievements collection page"
```

---

### Task 5: Dashboard Community section

**Files:**
- Create: `client/src/components/profile/CommunitySection.tsx`
- Modify: `client/src/pages/dashboard.tsx`

**Interfaces:**
- Consumes: `CommunityAchievementActivity[]`, `NewAdventurerSummary[]`.
- Produces: compact dashboard `Community` section with `Recent Achievements` and `New Adventurers` columns.

- [ ] **Step 1: Build `CommunitySection`**

Required props:

```ts
type CommunitySectionProps = {
  recentAchievements: CommunityAchievementActivity[];
  newAdventurers: NewAdventurerSummary[];
};
```

If either list is empty, render a concise intentional empty state in that column. Never invent placeholder usernames or events.

Rows should visually reserve a clickable identity treatment for later routing, but must not link to `/player/:username` yet because that route is deliberately unwired.

- [ ] **Step 2: Insert Community into the dashboard**

Import `CommunitySection` into `client/src/pages/dashboard.tsx` and render it after `My Campaigns` / archived campaigns and before `Quick Join`.

Pass empty arrays in this scaffold:

```tsx
<CommunitySection recentAchievements={[]} newAdventurers={[]} />
```

This deliberately exposes the polished shell without pretending social data exists.

- [ ] **Step 3: Typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/profile/CommunitySection.tsx client/src/pages/dashboard.tsx
git commit -m "feat: add dashboard community scaffold"
```

---

### Task 6: Final verification and changelog

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified UI scaffold with an operational changelog trail.

- [ ] **Step 1: Run targeted profile contract tests**

```bash
node --import tsx --test server/player-profile-contract.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run full typecheck and production build**

```bash
npm run typecheck
npm run build
```

Expected: both succeed.

- [ ] **Step 4: Inspect the final diff for wiring violations**

Confirm:

- `client/src/App.tsx` unchanged;
- no `server/routes.ts`, `server/storage.ts`, or `shared/schema.ts` changes;
- no public profile or activity API exists;
- no fake people/events were added;
- no Session Spotlight/AI behavior was added;
- dashboard change is limited to the empty Community UI shell.

- [ ] **Step 5: Update `CHANGELOG.md`**

Add a concise 2026-08-22 entry stating that the player profile, achievements collection, achievement showcase selector, and dashboard community surfaces were scaffolded for later backend/DM integration, with no new public data exposure or social persistence.

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: record profile community UI scaffold"
```

- [ ] **Step 7: Verify remote branch after push**

Compare local HEAD to the remote `feature/player-profile-community-ui` SHA. Do not claim deployment; this branch is source work only.
