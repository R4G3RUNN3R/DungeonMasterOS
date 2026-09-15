# DungeonMasterOS V1 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish and verify the existing DungeonMasterOS V1 as a stable commercial product without importing, anticipating, or coupling to the future DMOS V2 architecture.

**Architecture:** Preserve the current React/Vite + Express + WebSocket + SQLite + Anthropic + Stripe application. Harden existing boundaries instead of redesigning the product. All work is developed and verified in `/srv/voidsmith/dungeonmasteros/testing/repo`; production remains untouched until an identified release candidate passes the complete gate and has a rollback path.

**Tech Stack:** React 18, TypeScript, Vite 6, Express 4, WebSocket (`ws`), SQLite/better-sqlite3, Drizzle ORM, Anthropic SDK, Stripe.

**Spec:** Existing V1 repository behavior, `DEPLOYMENT.md`, `CHANGELOG.md`, Voidsmith doctrine, and this completion plan. DMOS V2 is explicitly out of scope.

## Global Constraints

- Security first, performance second, ease of use third.
- Preserve current V1 player/campaign behavior unless a verified defect requires change.
- No production edits in place. Test first, then promote an identified release.
- No V2 architecture, schema, feature model, or speculative V2 compatibility work in this programme.
- Protected authority is server-side and fails closed.
- Campaign, character, inventory, WebSocket, billing and AI state must remain isolated between users/campaigns.
- Stripe webhook processing must be idempotent.
- AI failures must not corrupt campaign state, duplicate charges/turns, or fabricate successful state transitions.
- Every production-sensitive change requires regression evidence and rollback readiness.

---

### Task 1: Stabilize the build and authentication baseline

**Files:**
- Modify: `server/auth.ts`
- Modify: `client/src/pages/character-sheet.tsx`
- Modify: `package.json`
- Create: `package-lock.json`
- Create: `test/auth-regression.test.mjs`
- Modify: `CHANGELOG.md`

**Produces:** deterministic dependency resolution, production JWT fail-closed behavior, restored DungeonMaster role helpers, strict TypeScript buildability.

- [x] Reproduce current TypeScript/auth failures.
- [x] Add failing tests for production JWT-secret enforcement and required DungeonMaster exports.
- [x] Restore the verified pre-regression auth implementation.
- [x] Fix D&D 3.5e feat read-model typing.
- [x] Upgrade runtime `drizzle-orm` to the patched 0.45.2 line and lock dependencies.
- [x] Verify auth tests, typecheck, build, storage smoke, and production dependency audit.

### Task 2: Secure real-time campaign subscriptions

**Files:**
- Modify: `server/routes.ts`
- Create: `test/websocket-auth.test.mjs`

**Produces:** authenticated WebSocket upgrades and server-authoritative campaign subscription identity.

- [x] Write E2E regression proving an authenticated outsider can currently subscribe to another campaign.
- [x] Verify the test fails because the outsider receives `subscribed`.
- [x] Authenticate `/ws` from the signed session cookie.
- [x] Derive user identity server-side and ignore client-provided user IDs.
- [x] Allow subscriptions only for campaign owners or authenticated users with a character in the campaign.
- [x] Verify owner success and outsider policy-close (`1008`).

### Task 3: Lock HTTP campaign/member authorization without breaking invite joining

**Files:**
- Modify: `server/routes.ts`
- Modify: `client/src/pages/dashboard.tsx`
- Modify: `client/src/pages/campaign.tsx`
- Test: `test/campaign-access.test.mjs`

**Produces:** one explicit V1 authorization contract for campaign metadata, messages, characters, items, effects and joining.

- [x] Write E2E tests proving an unrelated authenticated account cannot read another campaign's messages, character inventory/effects, or mutate campaign state.
- [x] Write E2E tests preserving the valid invite-code join flow for an authenticated account.
- [x] Introduce a bounded server-side invite/join authorization path; do not rely on campaign ID knowledge as join authority.
- [x] Add reusable campaign owner/member authorization helpers/middleware.
- [x] Protect private campaign/message/character/item/effect reads and writes while leaving only the minimum safe invite projection public or authenticated-as-designed.
- [x] Re-run campaign creation, host entry, invite join, character creation, reload and WebSocket subscription E2E.

### Task 4: Make Stripe billing idempotent and entitlement-safe

**Files:**
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Modify: `server/routes.ts`
- Test: `test/stripe-webhook.test.mjs`

**Produces:** replay-safe billing and top-up processing.

- [x] Write failing tests proving replayed `checkout.session.completed` can currently grant top-up turns more than once.
- [x] Add a persisted Stripe event ledger keyed by unique Stripe event ID.
- [x] Process each verified event atomically at most once.
- [x] Verify subscription create/update/delete, failed payment, successful payment and top-up replay behavior.
- [x] Verify invalid signatures and missing webhook secret fail closed.
- [x] Verify cancellation state matches Stripe semantics and does not revoke paid-through-period access prematurely.

### Task 5: Harden AI turn/state transactions

**Files:**
- Modify: `server/routes.ts`
- Modify: `server/dm-engine.ts` only where evidence requires it
- Test: `test/ai-turn-integrity.test.mjs`

**Produces:** no duplicate AI turns, no partial state corruption, and bounded fallback behavior.

- [x] Reproduce action/start/item-use AI success, provider failure, timeout and malformed-response paths under deterministic test doubles.
- [x] Prove turn counters are incremented exactly once only for chargeable completed outcomes according to current V1 policy.
- [x] Prove world-state/item/message writes cannot partially duplicate on retries.
- [x] Add explicit provider timeout and bounded failure handling where missing.
- [x] Verify the user sees truthful AI-unavailable messages and campaign state remains consistent.

### Task 6: Verify gameplay persistence and multiplayer consistency

**Files:**
- Test: `test/gameplay-state.test.mjs`
- Modify existing server/client files only for reproduced defects.

**Produces:** regression coverage for the actual V1 play loop.

- [x] Test create campaign -> create character -> start -> action -> messages -> reload.
- [x] Test HP, items, effects, equipment/currency projections and character-sheet reads.
- [x] Test two authenticated campaign members receiving the same campaign broadcasts.
- [x] Test reconnect/resubscribe after WebSocket disconnect.
- [x] Test campaign archive/restore and owner-only settings mutation.
- [x] Fix only defects reproduced by these tests and keep each fix independently reviewable.

### Task 7: Production resilience and recovery

**Files:**
- Update: `DEPLOYMENT.md`
- Create project-local operational/runbook docs as needed.

**Produces:** verified backup, restore, migration, monitoring and rollback procedures.

- [x] Identify exact live deployment commit/artifact and database path without weakening filesystem permissions.
- [x] Produce a test copy of the SQLite database or synthetic equivalent and verify backup using SQLite online backup semantics.
- [x] Perform an actual restore/readback test.
- [x] Verify startup migration behavior on fresh and existing database copies.
- [x] Define health/readback checks for HTTP, auth, WebSocket, Stripe configuration and AI configuration without exposing secrets.
- [x] Document release rollback to the previous immutable application artifact/database backup.

### Task 8: Performance, client payload and release polish

**Files:**
- Modify only measured hotspots/client bundles.
- Update: `CHANGELOG.md`

**Produces:** a release candidate without material performance or UX blockers.

- [x] Measure initial JS payload and route-level loading; address the current >500 KiB client chunk warning where a safe route split materially improves startup.
- [ ] Optimize the ~1.7 MB source logo in a later non-blocking payload pass; V1 release functionality and security do not depend on this cosmetic optimization.
- [x] Resolve or document the PostCSS `from` warning after identifying the responsible plugin/config path.
- [x] Run responsive smoke at supported desktop/mobile widths.
- [x] Verify onboarding, pricing, billing errors, empty states and reconnection UX.
### Task 9: Release candidate and controlled production promotion

**Files:**
- Update: `CHANGELOG.md`
- Update project release documentation.
- Update Voidsmith website/status only after verified production release.

**Produces:** evidence-backed stable DMOS V1.

- [x] Run `npm ci` from the committed lockfile on a clean test workspace.
- [x] Run `npm test`, `npm run typecheck`, `npm run build`, storage smoke and `npm audit --omit=dev --audit-level=high`.
- [x] Run complete V1 E2E suite against an isolated test database.
- [ ] Create an identified release artifact/commit and capture rollback target.
- [ ] Back up production database/configuration through the approved path.
- [ ] Deploy through the GitHub/release path, not by editing live source.
- [ ] Verify service health, public HTTPS readback, auth, campaign play, WebSocket membership, AI and billing smoke checks.
- [ ] Roll back immediately if any release gate fails.
- [ ] After verified release, update public Voidsmith/DMOS status and durable Source-of-Truth lifecycle state if materially changed.
