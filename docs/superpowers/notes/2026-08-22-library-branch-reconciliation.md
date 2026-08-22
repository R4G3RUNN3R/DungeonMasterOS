# Library Branch Reconciliation

Phase 0 investigation for the D&D 3.5e canonical rules library plan
(`docs/superpowers/plans/2026-08-22-dnd35-canonical-foundation-phase0-1.md`).
Read-only; no schema or code changes in this task. All hashes below are real,
verified against this repository on 2026-08-22 with `production-live-base` at
`fab994d` (also `HEAD` at investigation time).

## Branches involved

- `origin/feature/library-of-knowledge` — tip `a4a4824`. Merge-base with
  `production-live-base` is `594c6f8` (`git merge-base production-live-base
  origin/feature/library-of-knowledge`).
  - `git log --oneline production-live-base ^origin/feature/library-of-knowledge | wc -l` → **35**
    (production commits since the fork that the stale branch does not have).
  - `git log --oneline origin/feature/library-of-knowledge ^production-live-base | wc -l` → **90**
    (the stale branch's own commits since the fork).
  - Note: the task brief's Step 2 stated an expected value of 32 for both the
    production-ahead and stale-branch-ahead counts. The production-ahead count
    (35) is consistent with "32 or higher." The stale-branch-ahead count is
    **90, not 32** — a real discrepancy from the brief's expectation, most
    likely because the brief's number was recorded in an earlier session and
    more commits have since landed on one or both refs, or the earlier count
    used different ref state. Recorded here as measured, not adjusted to match
    the brief.
- `origin/feature/dnd35-grimoire-holy-tome-feat-codex` — tip `204a2f7`.
  Independently diverged from `production-live-base`, not an ancestor:
  `git merge-base --is-ancestor origin/feature/dnd35-grimoire-holy-tome-feat-codex production-live-base`
  exits 1 (false). Its merge-base with `production-live-base` is `c22bb3d`
  (a different, earlier fork point than the Library branch's `594c6f8`).
  `git log --oneline production-live-base ^origin/feature/dnd35-grimoire-holy-tome-feat-codex | wc -l` → 73;
  the reverse count → 16.

## Safe-to-reference patterns (re-implement fresh, never copy-paste)

- `server/knowledge-library.ts` (present on `origin/feature/library-of-knowledge`,
  not on `production-live-base`) — its `KnowledgeVolumeKind` model informs
  Phase 4's Library UI. Not part of this plan (Phase 0/1); recorded for the
  later plan that will build the Library feature.
- `shared/dnd35-rules/types.ts` (present on `origin/feature/library-of-knowledge`)
  — compare field-for-field against this plan's Task 2/3 schemas once both
  exist, and note any field the stale branch identified that this plan's
  schema is missing. Not diffed in this task; flagged for a later task's
  review step.
- `client/src/pages/rules-tome.tsx` reusing `CompendiumBook.tsx` (both present
  on `origin/feature/library-of-knowledge`) — validates that the existing
  Volume-I UI shell generalizes to a second rules volume. Informs Phase 4, not
  this plan.

## Do-not-touch / high-risk areas

- `POST /api/campaigns/:id/action` (`server/routes.ts`, production line 3680;
  same handler on the stale branch at line 3333 — the line-number shift is
  from unrelated earlier-file edits, not a change to this handler).
  **Characterization: the two branches are byte-for-byte identical from this
  handler's `app.post(...)` line through end-of-file.** Verified directly:
  `diff <(git show production-live-base:server/routes.ts | sed -n '3680,$p') <(git show origin/feature/library-of-knowledge:server/routes.ts | sed -n '3333,$p')`
  produces zero output. Independently confirmed by the unified diff
  (`git diff production-live-base origin/feature/library-of-knowledge --
  server/routes.ts`, 450 lines total across 8 hunks): the last hunk touching
  `server/routes.ts` is anchored at production line 3390 (`@@ -3390,16
  +3051,8 @@`), which is inside the earlier `POST
  /api/campaigns/:id/encounter/flee` handler (starts at production line
  3249), not inside `/action`. No hunk exists anywhere near line 3680.
  **Implication for Phase 3 (a later plan):** because the stale branch never
  touched this route, there is no structural rewrite to reconcile — Phase 3
  can treat the current production `/action` handler as the sole baseline and
  layer new logic around it without needing to merge two divergent
  implementations of this route. The stale branch's divergence from
  production (450 lines of diff in `server/routes.ts`) is entirely
  concentrated in other routes/helpers earlier in the file (e.g. an 8-hunk
  spread with anchors at lines 1, 14, 281, 1692, 1856, 1869, 1955, 2654, and
  3390 — several of these are large one-sided deletions, e.g. `@@ -1955,219
  +1843,6 @@` and `@@ -1692,56 +0,0 @@`-shaped hunks, meaning production has
  ~200+ lines in that region the stale branch never had, consistent with
  production having grown substantially past the fork point).
- Anything predating commit `bed28cd` (character-sheet/Codex consolidation:
  "Consolidate duplicate old/new character UI: fix 3.5e saves, one canonical
  Inventory/Codex/Sheet", 2026-08-20) or commit `4a54bfc` (Options/Settings
  system completion: "feat: wire OptionsDialog into the game header,
  completing the Options/Settings system", 2026-08-21). Both are verified
  ancestors of `production-live-base` (`git merge-base --is-ancestor <hash>
  production-live-base` → true for both) and verified **not** ancestors of
  `origin/feature/library-of-knowledge` (`git merge-base --is-ancestor <hash>
  origin/feature/library-of-knowledge` → false for both) — i.e. the stale
  branch forked before either landed.
  - `bed28cd` is a single commit, not a range; its message explicitly states:
    "Deleted now-fully-superseded legacy components: InventoryModal,
    CodexModal, CharacterSheetModal, AchievementsPanel,
    CharacterProfileDialog, openCharacterSheetPopup.ts." Verified these files
    still exist on the stale branch and do not exist on production:
    `client/src/components/game/CharacterProfileDialog.tsx` is present via
    `git grep -l CharacterProfileDialog origin/feature/library-of-knowledge`
    but absent from an equivalent `git grep` against `production-live-base`
    (production's only hits are in `docs/`, not `client/src/`);
    `client/src/lib/openCharacterSheetPopup.ts` is present on the stale
    branch and absent from production (production's only hits are in
    `CHANGELOG.md` history and the plan doc, not the source tree).
  - `4a54bfc` is the completion commit of a genuinely multi-commit feature,
    not a single isolated change — it is cited here as the boundary marker
    ("Options/Settings system is done as of this commit"), not as the
    entirety of the feature. The full feature range, verified via `git log
    --oneline --reverse d5a1dba^..cb87c9d`, is 18 commits from `d5a1dba`
    ("Add design spec for Options/Settings system") through `cb87c9d` ("fix:
    harden settings validation and extend reduced-motion beyond Dialog"),
    all confirmed ancestors of `production-live-base`.
  - Treat the stale branch's presence of `CharacterProfileDialog` and
    `openCharacterSheetPopup` as evidence its client-side assumptions predate
    both consolidations and are stale — not as something to restore or merge
    forward.

## Explicit scope decision for THIS plan (Phase 0/1)

This plan builds the canonical foundation layer fresh, informed by but not
copied from the stale branch's `shared/dnd35-rules/` shape. No file from
`origin/feature/library-of-knowledge` or
`origin/feature/dnd35-grimoire-holy-tome-feat-codex` is merged,
cherry-picked, or diffed-and-applied in any task in this plan. References to
the stale branch in this document are pattern citations (file path + what it
does) for a human or a later task to independently re-implement, never code
to copy.
