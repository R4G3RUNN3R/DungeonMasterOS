# In-Game Options / Settings System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two independent settings domains — Personal Options (hybrid local-first + server-synced presentation preferences) and Campaign Settings (owner-controlled, server-authoritative, audited, suggestion-based) — reusing all existing infrastructure (broadcast, migration mechanism, Dialog primitive) and adding zero unsupported/fake toggles.

**Architecture:** Server-side foundation (schema, migrations, a single consolidated `getCampaignAuthority()` ownership helper) lands first since every later task depends on it. Campaign Settings routes extend the existing `PATCH /api/campaigns/:id` and add validation, locking, suggestions, and history on top of the existing `broadcastToCampaign` mechanism. Personal Options gets a brand-new `user_preferences` table and a client module that fully replaces `gameLayoutPreferences.ts`. The UI layer resurrects the orphaned `CampaignSettingsPanel.tsx`, adds two small new components for suggestions/history, and ties everything together in a new `OptionsDialog` wired to the header's already-stubbed Settings button.

**Tech Stack:** Express + better-sqlite3 + Drizzle ORM (SQLite dialect), the hand-rolled `runMigrations()` migration mechanism (not drizzle-kit push), `ws` WebSocket server, React + TanStack Query, Radix/shadcn `Dialog`, Zod validation, `node --import tsx --test` + `node:assert/strict` for server tests.

## Global Constraints

- No untyped `rulesetSettings` field anywhere in this pass — omit entirely from every type/schema; do not add even as a stub or comment placeholder.
- `settingsLocked` gates only `PATCH /api/campaigns/:id` (direct changes) and suggestion-acceptance. It never gates viewing settings, viewing history, submitting a suggestion, or declining a suggestion. The lock-toggle route itself is exempt from its own gate. Both locking and unlocking write a `campaign_settings_history` row.
- The client never computes campaign ownership itself. `viewerAuthority` is computed server-side via `getCampaignAuthority()` and returned on `GET /api/campaigns/:id`. Every mutation route re-checks authority server-side regardless of what the client displays — UI hiding is convenience only, never the security boundary.
- Personal-preference sync uses a client-stamped `updatedAt` string + a local `dirty` boolean flag. The server stores whatever `updatedAt` it is sent, verbatim, with no server-side clock guard. A `GET` response must never overwrite local state when local is `dirty` or has a newer `updatedAt` than the server row.
- `ruleset` stays outside the campaign settings-PATCH whitelist, exactly as today. This feature does not add ruleset-change capability.
- `client/src/lib/gameLayoutPreferences.ts` is deleted once `client/src/lib/personalPreferences.ts` fully replaces it and `CampaignGameShell.tsx` is migrated to the new hook — the two must never coexist as parallel systems.
- No Playwright/e2e client test infrastructure exists in this repo. Client-side tasks are verified via (a) `node --import tsx --test` unit tests for any pure-TS logic extracted for testability, and (b) documented manual local-dev-server browser verification steps — never a fabricated automated UI test.
- All new server tables use `CREATE TABLE IF NOT EXISTS`; all new columns on existing tables use `addColumnIfMissing()`. Both live in `server/storage.ts`'s `runMigrations()`, matching the existing mechanism — never `drizzle-kit push`.
- Every new/extended route reuses the single `getCampaignAuthority()` helper from Task 1. No task may introduce a second, divergent ownership check.

---

## File Structure

**Server — new:**
- `server/campaign-settings.test.ts` — e2e tests for ownership, validation, lock, suggestions, history.
- `server/user-preferences.test.ts` — e2e tests for personal preferences isolation/validation/sync semantics.

**Server — modified:**
- `shared/schema.ts` — add `campaignSettingsHistory`, `campaignSettingSuggestions`, `userPreferences` Drizzle table definitions; add `settingsLocked` to the `campaigns` table definition.
- `server/storage.ts` — add migration blocks (`CREATE TABLE IF NOT EXISTS` ×3, `addColumnIfMissing` ×1) to `runMigrations()`; add storage CRUD methods for the three new tables.
- `server/routes.ts` — add `getCampaignAuthority()`; extend `PATCH /api/campaigns/:id` with Zod validation, lock gate, and history write; add `PATCH /api/campaigns/:id/settings/lock`, `POST /api/campaigns/:id/settings/suggestions`, `GET /api/campaigns/:id/settings/suggestions`, `PATCH /api/campaigns/:id/settings/suggestions/:suggestionId`, `GET /api/campaigns/:id/settings/history`; extend `GET /api/campaigns/:id` to include `viewerAuthority`; add `GET /api/user/preferences`, `PATCH /api/user/preferences`.

**Client — new:**
- `client/src/lib/personalPreferences.ts` — the new canonical preferences module (replaces `gameLayoutPreferences.ts`).
- `client/src/lib/personalPreferences.test.ts` — pure-TS unit tests for the sync/merge decision logic.
- `client/src/components/game/CampaignSuggestions.tsx` — suggestion list + submit form (players) + accept/decline (owner).
- `client/src/components/game/CampaignSettingsHistory.tsx` — read-only audit history list.
- `client/src/components/game/OptionsDialog.tsx` — the Personal/Campaign tabbed dialog tying everything together.

**Client — modified:**
- `client/src/components/CampaignSettingsPanel.tsx` — restyled onto the `Dialog` convention, `isHost` replaced by server-sourced authority.
- `client/src/components/game/CampaignGameHeader.tsx` — Settings button enabled, `onOpenOptions` prop added.
- `client/src/components/game/CampaignGameShell.tsx` — migrated off `gameLayoutPreferences`, `optionsOpen` state added, `OptionsDialog` rendered.

**Client — deleted:**
- `client/src/lib/gameLayoutPreferences.ts` (Task 7, once nothing imports it).

---

### Task 1: Schema, migrations, storage CRUD, and `getCampaignAuthority()`

**Files:**
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Modify: `server/routes.ts`
- Create: `server/campaign-settings.test.ts`

**Interfaces:**
- Produces: `getCampaignAuthority(req: Request, campaign: Campaign): "owner" | "player" | "none"` (exported from `server/routes.ts` for later tasks/tests to import — if `routes.ts` doesn't currently export helpers, add `export` to this one function's declaration only).
- Produces: `storage.createCampaignSettingsHistory(entry: {campaignId: number; settingKey: string; oldValue: string | null; newValue: string; changedByUserId: number | null; source: "owner-direct" | "accepted-suggestion" | "system"; suggestionId?: number; note?: string}): void`
- Produces: `storage.getCampaignSettingsHistory(campaignId: number): CampaignSettingsHistoryRow[]`
- Produces: `storage.createCampaignSettingSuggestion(entry: {campaignId: number; settingKey: string; currentValue: string; proposedValue: string; submittedByUserId: number; reason?: string}): CampaignSettingSuggestionRow`
- Produces: `storage.getCampaignSettingSuggestions(campaignId: number): CampaignSettingSuggestionRow[]`
- Produces: `storage.getCampaignSettingSuggestion(suggestionId: number): CampaignSettingSuggestionRow | undefined`
- Produces: `storage.updateCampaignSettingSuggestion(suggestionId: number, updates: Partial<CampaignSettingSuggestionRow>): void`
- Produces: `storage.getUserPreferences(userId: number): {data: string; updatedAt: string} | undefined`
- Produces: `storage.upsertUserPreferences(userId: number, data: string, updatedAt: string): void`

**Step 1: Read the exact current shape of the files this task touches**

Before writing anything, read:
- `shared/schema.ts` in full, to match its exact `sqliteTable` conventions, import style, and where the `campaigns` table and `turnLedger` table are defined.
- `server/storage.ts`'s `runMigrations()` function in full, to see the exact `addColumnIfMissing`/`CREATE TABLE IF NOT EXISTS` call sequence and where to append new ones without disturbing existing calls.
- `server/routes.ts` lines ~119-140 (`broadcastToCampaign`/`broadcastToUser`/`campaignClients`) and ~277-281 (`canManageCampaign`) and ~1804-1845 (the current `PATCH /api/campaigns/:id` handler), to confirm the exact current code before adding `getCampaignAuthority` near `canManageCampaign` and before Task 2 modifies the PATCH handler.

**Step 2: Add the three new table definitions and the `settingsLocked` column to `shared/schema.ts`**

Add near the existing `campaigns`/`turnLedger` table definitions, following the exact `sqliteTable` pattern already used there:

```ts
export const campaignSettingsHistory = sqliteTable("campaign_settings_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  settingKey: text("setting_key").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  changedByUserId: integer("changed_by_user_id"),
  source: text("source").notNull(), // 'owner-direct' | 'accepted-suggestion' | 'system'
  suggestionId: integer("suggestion_id"),
  note: text("note"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const campaignSettingSuggestions = sqliteTable("campaign_setting_suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  settingKey: text("setting_key").notNull(),
  currentValue: text("current_value").notNull(),
  proposedValue: text("proposed_value").notNull(),
  submittedByUserId: integer("submitted_by_user_id").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending | accepted | declined | withdrawn
  ownerResponse: text("owner_response"),
  resolvedByUserId: integer("resolved_by_user_id"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const userPreferences = sqliteTable("user_preferences", {
  userId: integer("user_id").primaryKey(),
  data: text("data").notNull().default("{}"),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export type CampaignSettingsHistoryRow = typeof campaignSettingsHistory.$inferSelect;
export type CampaignSettingSuggestionRow = typeof campaignSettingSuggestions.$inferSelect;
export type UserPreferencesRow = typeof userPreferences.$inferSelect;
```

Add `settingsLocked: integer("settings_locked", { mode: "boolean" }).notNull().default(false),` to the existing `campaigns` table definition, placed with the other boolean flags (`storyMode`, `epicMode`).

**Step 3: Add migrations to `runMigrations()` in `server/storage.ts`**

Append (do not reorder existing calls):

```ts
sqlite.exec(`CREATE TABLE IF NOT EXISTS campaign_settings_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by_user_id INTEGER,
  source TEXT NOT NULL,
  suggestion_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL
);`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS campaign_setting_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  setting_key TEXT NOT NULL,
  current_value TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  submitted_by_user_id INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  owner_response TEXT,
  resolved_by_user_id INTEGER,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);`);

addColumnIfMissing("campaigns", "settings_locked", "INTEGER NOT NULL DEFAULT 0");
```

**Step 4: Add storage CRUD methods in `server/storage.ts`**

Add to the storage object/class (match whatever export pattern — object literal or class methods — the file already uses for `updateCampaign`/`updateWorldState`):

```ts
createCampaignSettingsHistory(entry: {
  campaignId: number; settingKey: string; oldValue: string | null; newValue: string;
  changedByUserId: number | null; source: "owner-direct" | "accepted-suggestion" | "system";
  suggestionId?: number; note?: string;
}): void {
  db.insert(campaignSettingsHistory).values({
    campaignId: entry.campaignId,
    settingKey: entry.settingKey,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    changedByUserId: entry.changedByUserId,
    source: entry.source,
    suggestionId: entry.suggestionId ?? null,
    note: entry.note ?? null,
  }).run();
},

getCampaignSettingsHistory(campaignId: number): CampaignSettingsHistoryRow[] {
  return db.select().from(campaignSettingsHistory)
    .where(eq(campaignSettingsHistory.campaignId, campaignId))
    .orderBy(desc(campaignSettingsHistory.id)).all();
},

createCampaignSettingSuggestion(entry: {
  campaignId: number; settingKey: string; currentValue: string; proposedValue: string;
  submittedByUserId: number; reason?: string;
}): CampaignSettingSuggestionRow {
  const [row] = db.insert(campaignSettingSuggestions).values({
    campaignId: entry.campaignId,
    settingKey: entry.settingKey,
    currentValue: entry.currentValue,
    proposedValue: entry.proposedValue,
    submittedByUserId: entry.submittedByUserId,
    reason: entry.reason ?? null,
  }).returning().all();
  return row;
},

getCampaignSettingSuggestions(campaignId: number): CampaignSettingSuggestionRow[] {
  return db.select().from(campaignSettingSuggestions)
    .where(eq(campaignSettingSuggestions.campaignId, campaignId))
    .orderBy(desc(campaignSettingSuggestions.id)).all();
},

getCampaignSettingSuggestion(suggestionId: number): CampaignSettingSuggestionRow | undefined {
  return db.select().from(campaignSettingSuggestions)
    .where(eq(campaignSettingSuggestions.id, suggestionId)).get();
},

updateCampaignSettingSuggestion(suggestionId: number, updates: Partial<CampaignSettingSuggestionRow>): void {
  db.update(campaignSettingSuggestions).set(updates as any)
    .where(eq(campaignSettingSuggestions.id, suggestionId)).run();
},

getUserPreferences(userId: number): { data: string; updatedAt: string } | undefined {
  const row = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  return row ? { data: row.data, updatedAt: row.updatedAt } : undefined;
},

upsertUserPreferences(userId: number, data: string, updatedAt: string): void {
  const existing = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
  if (existing) {
    db.update(userPreferences).set({ data, updatedAt }).where(eq(userPreferences.userId, userId)).run();
  } else {
    db.insert(userPreferences).values({ userId, data, updatedAt }).run();
  }
},
```

Add corresponding method signatures to the `StorageLike`/storage interface if one exists (mirror however `updateCampaign` is declared there). Import `desc` from `drizzle-orm` alongside the existing `eq` import if not already imported. Import the three new table symbols and `CampaignSettingsHistoryRow`/`CampaignSettingSuggestionRow` type from `@shared/schema` (match the existing relative/alias import style in this file).

**Step 5: Add `getCampaignAuthority()` in `server/routes.ts`**

Add directly after the existing `canManageCampaign` helper (do not modify or remove `canManageCampaign` — other routes still use it and this task doesn't touch those):

```ts
export type CampaignAuthority = "owner" | "player" | "none";

export function getCampaignAuthority(req: Request, campaign: Campaign): CampaignAuthority {
  if (req.user?.isAdmin || req.user?.role === "dungeon_master") return "owner";
  if (req.user?.id && campaign.userId === req.user.id) return "owner";
  if (campaign.hostVisitorId === getVisitorId(req)) return "owner";
  const hasCharacter = storage.getCharactersByCampaign(campaign.id)
    .some((c) => c.userId === req.user?.id || c.visitorId === getVisitorId(req));
  return hasCharacter ? "player" : "none";
}
```

**Step 6: Write the foundation tests**

Create `server/campaign-settings.test.ts`. Follow the e2e fixture pattern from `server/items-use-auth.test.ts` exactly: temp sqlite path set via `process.env.DATABASE_URL` before the dynamic import, `runMigrations()`, real `express()` + `createServer()` + `registerRoutes()`, `httpServer.listen(0, "127.0.0.1")`, real `fetch()`, `signToken(userId)` + `cookie: dmos_session=...` for auth simulation, `after()` cleanup removing the temp db files.

```ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-campaign-settings-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("./storage");
const { getCampaignAuthority } = await import("./routes");
const { signToken } = await import("./auth");
import express from "express";
import { createServer } from "node:http";

runMigrations();

let fixtureCounter = 0;
function makeFixture() {
  fixtureCounter += 1;
  const owner = storage.createUser({
    email: `owner-${fixtureCounter}@test.dev`,
    username: `owner${fixtureCounter}`,
    passwordHash: "x",
  } as any);
  const player = storage.createUser({
    email: `player-${fixtureCounter}@test.dev`,
    username: `player${fixtureCounter}`,
    passwordHash: "x",
  } as any);
  const outsider = storage.createUser({
    email: `outsider-${fixtureCounter}@test.dev`,
    username: `outsider${fixtureCounter}`,
    passwordHash: "x",
  } as any);
  const campaign = storage.createCampaign({
    name: `Campaign ${fixtureCounter}`,
    inviteCode: `INV${fixtureCounter}`,
    hostVisitorId: `user-${owner.id}`,
    userId: owner.id,
  } as any);
  storage.createCharacter({
    campaignId: campaign.id,
    userId: player.id,
    name: "Player Char",
  } as any);
  return { owner, player, outsider, campaign };
}

test("getCampaignAuthority: owner via userId match returns owner", () => {
  const { owner, campaign } = makeFixture();
  const req: any = { user: { id: owner.id }, headers: {} };
  assert.equal(getCampaignAuthority(req, campaign as any), "owner");
});

test("getCampaignAuthority: player with a character returns player", () => {
  const { player, campaign } = makeFixture();
  const req: any = { user: { id: player.id }, headers: {} };
  assert.equal(getCampaignAuthority(req, campaign as any), "player");
});

test("getCampaignAuthority: unrelated user returns none", () => {
  const { outsider, campaign } = makeFixture();
  const req: any = { user: { id: outsider.id }, headers: {} };
  assert.equal(getCampaignAuthority(req, campaign as any), "none");
});

test("storage: campaign settings history round-trips", () => {
  const { owner, campaign } = makeFixture();
  storage.createCampaignSettingsHistory({
    campaignId: campaign.id, settingKey: "tone", oldValue: "heroic", newValue: "dark",
    changedByUserId: owner.id, source: "owner-direct",
  });
  const rows = storage.getCampaignSettingsHistory(campaign.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].newValue, "dark");
});

test("storage: campaign setting suggestion round-trips", () => {
  const { player, campaign } = makeFixture();
  const row = storage.createCampaignSettingSuggestion({
    campaignId: campaign.id, settingKey: "tone", currentValue: "heroic",
    proposedValue: "dark", submittedByUserId: player.id, reason: "too cheerful",
  });
  assert.equal(row.status, "pending");
  const fetched = storage.getCampaignSettingSuggestion(row.id);
  assert.equal(fetched?.proposedValue, "dark");
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

**Step 7: Run the tests**

Run: `node --import tsx --test server/campaign-settings.test.ts`
Expected: all 5 tests PASS.

**Step 8: Run the full existing suite to confirm no regression**

Run: `node --import tsx --test server/**/*.test.ts`
Expected: all previously-passing tests still PASS (this task only adds code and one new export; it modifies no existing route behavior).

**Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

**Step 10: Commit**

```bash
git add shared/schema.ts server/storage.ts server/routes.ts server/campaign-settings.test.ts
git commit -m "feat: add campaign settings/preferences schema, storage CRUD, getCampaignAuthority"
```

---

### Task 2: Campaign Settings PATCH — validation, lock gate, history write

**Files:**
- Modify: `server/routes.ts` (the existing `PATCH /api/campaigns/:id` handler, ~line 1804-1845)
- Modify: `server/campaign-settings.test.ts`

**Interfaces:**
- Consumes: `getCampaignAuthority` (Task 1), `storage.createCampaignSettingsHistory` (Task 1).
- Produces: extended `PATCH /api/campaigns/:id` behavior — validated values, lock gate, history writes. No new route path.

**Step 1: Read the current handler exactly**

Re-read `server/routes.ts`'s current `PATCH /api/campaigns/:id` handler in full before editing (it was quoted in the design spec's investigation, but confirm line numbers and exact surrounding code haven't drifted since Task 1's edits).

**Step 2: Write the Zod validation schema**

Add near the top of the route-registration function or in a small helper block just above the route, sourcing the enum value lists from `client/src/components/CampaignSettingsPanel.tsx`'s `TONE_OPTIONS`/`COMBAT_OPTIONS`/`RULES_OPTIONS`/`POWER_OPTIONS` constants (read that file to get the exact current `value` strings — do not guess):

```ts
const campaignSettingsPatchSchema = z.object({
  tone: z.enum(["dark", "heroic", "comedic", "realistic"]).optional(),
  combatStyle: z.enum(["cinematic", "tactical", "dice"]).optional(),
  rulesWeight: z.enum(["light", "medium", "crunchy"]).optional(),
  powerLevel: z.enum(["low", "standard", "high", "godtier"]).optional(),
  storyMode: z.boolean().optional(),
  epicMode: z.boolean().optional(),
  worldGenStyle: z.string().optional(),
  animeWorldSource: z.string().optional(),
  animeWorldMode: z.string().optional(),
  name: z.string().min(1).optional(),
}).strict();
```

(If the actual `TONE_OPTIONS` etc. values read in Step 1 differ from the placeholders above, use the real values — this is exactly the kind of value that must come from the real file, not be invented.)

**Step 3: Rewrite the handler**

Replace the existing whitelist-copy body with:

```ts
app.patch("/api/campaigns/:id", (req, res) => {
  const visitorId = getVisitorId(req);
  const campaignId = Number(req.params.id);
  const campaign = storage.getCampaign(campaignId);
  if (!campaign) return res.status(404).json({ message: "Campaign not found" });

  const authority = getCampaignAuthority(req, campaign);
  if (authority !== "owner") {
    return res.status(403).json({ message: "Only the host can change campaign settings" });
  }

  if ((campaign as any).settingsLocked) {
    return res.status(409).json({ message: "Campaign settings are locked. Unlock them before making changes." });
  }

  const parsed = campaignSettingsPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid campaign settings", errors: parsed.error.flatten() });
  }
  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  for (const [key, newValue] of Object.entries(updates)) {
    const oldValue = (campaign as any)[key];
    if (oldValue !== newValue) {
      storage.createCampaignSettingsHistory({
        campaignId, settingKey: key,
        oldValue: oldValue === undefined || oldValue === null ? null : String(oldValue),
        newValue: String(newValue),
        changedByUserId: req.user?.id ?? null,
        source: "owner-direct",
      });
    }
  }

  storage.updateCampaign(campaignId, updates as any);
  const updated = storage.getCampaign(campaignId);
  broadcastToCampaign(campaignId, { type: "campaign_updated", campaign: updated });

  if (req.user) {
    const unlockedIds = storage.getUnlockedAchievementIds(req.user.id);
    tryUnlockAchievements(req.user.id, campaignId, null, {
      type: "settings_change",
      campaign: { /* keep whatever shape the existing call already builds here — read it in Step 1 and preserve verbatim */ },
      unlockedIds,
    });
  }

  return res.json(updated);
});
```

Keep the existing `tryUnlockAchievements` call's payload shape exactly as found in Step 1 — this task does not change achievement-unlock behavior, only the validation/lock/history logic above it.

**Step 4: Add tests to `server/campaign-settings.test.ts`**

```ts
test("PATCH /api/campaigns/:id: owner can change a valid setting and it is audited", async () => {
  const { owner, campaign } = makeFixture();
  const token = signToken(owner.id);
  const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ tone: "dark" }),
  });
  assert.equal(res.status, 200, "owner change should succeed");
  const history = storage.getCampaignSettingsHistory(campaign.id);
  assert.equal(history[0].settingKey, "tone");
  assert.equal(history[0].newValue, "dark");
});

test("PATCH /api/campaigns/:id: non-owner is rejected", async () => {
  const { player, campaign } = makeFixture();
  const token = signToken(player.id);
  const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ tone: "dark" }),
  });
  assert.equal(res.status, 403);
});

test("PATCH /api/campaigns/:id: invalid enum value is rejected, not written", async () => {
  const { owner, campaign } = makeFixture();
  const token = signToken(owner.id);
  const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ tone: "banana" }),
  });
  assert.equal(res.status, 400);
  const reloaded = storage.getCampaign(campaign.id);
  assert.notEqual((reloaded as any).tone, "banana");
});

test("PATCH /api/campaigns/:id: locked campaign rejects owner-direct change", async () => {
  const { owner, campaign } = makeFixture();
  storage.updateCampaign(campaign.id, { settingsLocked: true } as any);
  const token = signToken(owner.id);
  const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ tone: "dark" }),
  });
  assert.equal(res.status, 409);
});
```

This requires the test file to have a running `httpServer`/`baseUrl` set up — add that scaffolding (mirroring `items-use-auth.test.ts`) in a `before()` block if Task 1 didn't already add it (Task 1's tests were storage/function-level and didn't need a live server; this task's do).

**Step 5: Run and verify**

Run: `node --import tsx --test server/campaign-settings.test.ts`
Expected: all tests (Task 1's + Task 2's new ones) PASS.

**Step 6: Full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts` — expect no regressions.
Run: `npx tsc --noEmit` — expect no new errors.

**Step 7: Commit**

```bash
git add server/routes.ts server/campaign-settings.test.ts
git commit -m "feat: validate, lock-gate, and audit campaign settings PATCH"
```

---

### Task 3: Settings lock toggle route

**Files:**
- Modify: `server/routes.ts`
- Modify: `server/campaign-settings.test.ts`

**Interfaces:**
- Consumes: `getCampaignAuthority`, `storage.createCampaignSettingsHistory`, `storage.updateCampaign`, `broadcastToCampaign` (all existing/Task 1).
- Produces: `PATCH /api/campaigns/:id/settings/lock`

**Step 1: Add the route**

Add near the extended PATCH handler from Task 2:

```ts
app.patch("/api/campaigns/:id/settings/lock", (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = storage.getCampaign(campaignId);
  if (!campaign) return res.status(404).json({ message: "Campaign not found" });

  const authority = getCampaignAuthority(req, campaign);
  if (authority !== "owner") {
    return res.status(403).json({ message: "Only the host can change the settings lock" });
  }

  const parsed = z.object({ locked: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body" });

  const oldValue = (campaign as any).settingsLocked;
  storage.updateCampaign(campaignId, { settingsLocked: parsed.data.locked } as any);
  storage.createCampaignSettingsHistory({
    campaignId, settingKey: "settingsLocked",
    oldValue: String(oldValue), newValue: String(parsed.data.locked),
    changedByUserId: req.user?.id ?? null, source: "owner-direct",
  });

  const updated = storage.getCampaign(campaignId);
  broadcastToCampaign(campaignId, { type: "campaign_updated", campaign: updated });
  return res.json(updated);
});
```

Note this route deliberately has **no** `settingsLocked` gate check — it is the route that changes that value, so it must never be blocked by its own current state (Global Constraints).

**Step 2: Add tests**

```ts
test("lock route: owner can lock and unlock; unlock is not blocked by the lock", async () => {
  const { owner, campaign } = makeFixture();
  const token = signToken(owner.id);

  const lockRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/lock`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ locked: true }),
  });
  assert.equal(lockRes.status, 200);
  assert.equal((await lockRes.json()).settingsLocked, true);

  const unlockRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/lock`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ locked: false }),
  });
  assert.equal(unlockRes.status, 200, "owner must always be able to unlock even while locked");
  assert.equal((await unlockRes.json()).settingsLocked, false);

  const history = storage.getCampaignSettingsHistory(campaign.id);
  const lockEvents = history.filter((h) => h.settingKey === "settingsLocked");
  assert.equal(lockEvents.length, 2, "both lock and unlock must be audited");
});

test("lock route: non-owner is rejected", async () => {
  const { player, campaign } = makeFixture();
  const token = signToken(player.id);
  const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/lock`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ locked: true }),
  });
  assert.equal(res.status, 403);
});
```

**Step 3: Run, verify, typecheck**

Run: `node --import tsx --test server/campaign-settings.test.ts` — all PASS.
Run: `npx tsc --noEmit` — no new errors.

**Step 4: Commit**

```bash
git add server/routes.ts server/campaign-settings.test.ts
git commit -m "feat: add campaign settings lock/unlock route with audit"
```

---

### Task 4: Suggestions routes (submit, list, accept/decline with stale + lock protection)

**Files:**
- Modify: `server/routes.ts`
- Modify: `server/campaign-settings.test.ts`

**Interfaces:**
- Consumes: `getCampaignAuthority`, `storage.createCampaignSettingSuggestion`, `storage.getCampaignSettingSuggestions`, `storage.getCampaignSettingSuggestion`, `storage.updateCampaignSettingSuggestion`, `storage.createCampaignSettingsHistory`, `campaignSettingsPatchSchema` (Task 2, reused for the accept-path value validation), `broadcastToCampaign`.
- Produces: `POST /api/campaigns/:id/settings/suggestions`, `GET /api/campaigns/:id/settings/suggestions`, `PATCH /api/campaigns/:id/settings/suggestions/:suggestionId`.

**Step 1: Submit route**

```ts
app.post("/api/campaigns/:id/settings/suggestions", (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = storage.getCampaign(campaignId);
  if (!campaign) return res.status(404).json({ message: "Campaign not found" });

  const authority = getCampaignAuthority(req, campaign);
  if (authority === "none") return res.status(403).json({ message: "Not a participant in this campaign" });
  if (!req.user) return res.status(401).json({ message: "Login required to suggest a change" });

  const parsed = z.object({
    settingKey: z.enum(["tone", "combatStyle", "rulesWeight", "powerLevel", "storyMode", "epicMode"]),
    proposedValue: z.union([z.string(), z.boolean()]),
    reason: z.string().max(500).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid suggestion" });

  const currentValue = String((campaign as any)[parsed.data.settingKey]);
  const row = storage.createCampaignSettingSuggestion({
    campaignId, settingKey: parsed.data.settingKey, currentValue,
    proposedValue: String(parsed.data.proposedValue),
    submittedByUserId: req.user.id, reason: parsed.data.reason,
  });
  broadcastToCampaign(campaignId, { type: "campaign_setting_suggestion", suggestion: row });
  return res.status(201).json(row);
});
```

**Step 2: List route**

```ts
app.get("/api/campaigns/:id/settings/suggestions", (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = storage.getCampaign(campaignId);
  if (!campaign) return res.status(404).json({ message: "Campaign not found" });

  const authority = getCampaignAuthority(req, campaign);
  if (authority === "none") return res.status(403).json({ message: "Not a participant in this campaign" });

  const all = storage.getCampaignSettingSuggestions(campaignId);
  const visible = authority === "owner" ? all : all.filter((s) => s.submittedByUserId === req.user?.id);
  return res.json(visible);
});
```

**Step 3: Accept/decline route**

```ts
app.patch("/api/campaigns/:id/settings/suggestions/:suggestionId", (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = storage.getCampaign(campaignId);
  if (!campaign) return res.status(404).json({ message: "Campaign not found" });

  const authority = getCampaignAuthority(req, campaign);
  if (authority !== "owner") return res.status(403).json({ message: "Only the host can resolve suggestions" });

  const suggestion = storage.getCampaignSettingSuggestion(Number(req.params.suggestionId));
  if (!suggestion || suggestion.campaignId !== campaignId) {
    return res.status(404).json({ message: "Suggestion not found" });
  }
  if (suggestion.status !== "pending") {
    return res.status(409).json({ message: "Suggestion already resolved" });
  }

  const parsed = z.object({
    action: z.enum(["accept", "decline"]),
    ownerResponse: z.string().max(500).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid body" });

  if (parsed.data.action === "decline") {
    storage.updateCampaignSettingSuggestion(suggestion.id, {
      status: "declined", ownerResponse: parsed.data.ownerResponse ?? null,
      resolvedByUserId: req.user?.id ?? null, resolvedAt: new Date().toISOString(),
    });
    broadcastToCampaign(campaignId, { type: "campaign_setting_suggestion", suggestionId: suggestion.id, status: "declined" });
    return res.json({ status: "declined" });
  }

  // accept
  if ((campaign as any).settingsLocked) {
    return res.status(409).json({ message: "Campaign settings are locked; cannot accept a suggestion until unlocked" });
  }
  const liveValue = String((campaign as any)[suggestion.settingKey]);
  if (liveValue !== suggestion.currentValue) {
    return res.status(409).json({ message: "Stale suggestion: the setting has changed since this was proposed", status: "stale" });
  }

  const fieldSchema = (campaignSettingsPatchSchema.shape as any)[suggestion.settingKey];
  const coerced = fieldSchema?._def?.typeName === "ZodBoolean" ? suggestion.proposedValue === "true" : suggestion.proposedValue;
  const validation = campaignSettingsPatchSchema.safeParse({ [suggestion.settingKey]: coerced });
  if (!validation.success) {
    return res.status(400).json({ message: "Suggested value is no longer valid" });
  }

  storage.createCampaignSettingsHistory({
    campaignId, settingKey: suggestion.settingKey, oldValue: liveValue,
    newValue: String(coerced), changedByUserId: req.user?.id ?? null,
    source: "accepted-suggestion", suggestionId: suggestion.id,
  });
  storage.updateCampaign(campaignId, { [suggestion.settingKey]: coerced } as any);
  storage.updateCampaignSettingSuggestion(suggestion.id, {
    status: "accepted", ownerResponse: parsed.data.ownerResponse ?? null,
    resolvedByUserId: req.user?.id ?? null, resolvedAt: new Date().toISOString(),
  });

  const updated = storage.getCampaign(campaignId);
  broadcastToCampaign(campaignId, { type: "campaign_updated", campaign: updated });
  broadcastToCampaign(campaignId, { type: "campaign_setting_suggestion", suggestionId: suggestion.id, status: "accepted" });
  return res.json({ status: "accepted", campaign: updated });
});
```

**Step 4: Tests**

```ts
test("suggestions: player can submit, owner sees it, player sees own only", async () => {
  const { owner, player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const submitRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark", reason: "too cheerful" }),
  });
  assert.equal(submitRes.status, 201);

  const ownerToken = signToken(owner.id);
  const ownerList = await (await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions`, {
    headers: { cookie: `dmos_session=${ownerToken}` },
  })).json();
  assert.equal(ownerList.length, 1);

  const playerList = await (await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions`, {
    headers: { cookie: `dmos_session=${playerToken}` },
  })).json();
  assert.equal(playerList.length, 1);
});

test("suggestions: accept applies the change and writes history", async () => {
  const { owner, player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const submitRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  const suggestion = await submitRes.json();

  const ownerToken = signToken(owner.id);
  const acceptRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions/${suggestion.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerToken}` },
    body: JSON.stringify({ action: "accept" }),
  });
  assert.equal(acceptRes.status, 200);
  const reloaded = storage.getCampaign(campaign.id);
  assert.equal((reloaded as any).tone, "dark");
  const history = storage.getCampaignSettingsHistory(campaign.id);
  assert.ok(history.some((h) => h.source === "accepted-suggestion"));
});

test("suggestions: decline does not apply the change", async () => {
  const { owner, player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const submitRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  const suggestion = await submitRes.json();
  const ownerToken = signToken(owner.id);
  await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions/${suggestion.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerToken}` },
    body: JSON.stringify({ action: "decline", ownerResponse: "not now" }),
  });
  const reloaded = storage.getCampaign(campaign.id);
  assert.notEqual((reloaded as any).tone, "dark");
});

test("suggestions: stale suggestion is rejected on accept", async () => {
  const { owner, player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const submitRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  const suggestion = await submitRes.json();
  const ownerToken = signToken(owner.id);
  // owner changes the setting directly before reviewing the suggestion
  await fetch(`${baseUrl}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerToken}` },
    body: JSON.stringify({ tone: "comedic" }),
  });
  const acceptRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions/${suggestion.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerToken}` },
    body: JSON.stringify({ action: "accept" }),
  });
  assert.equal(acceptRes.status, 409);
  const reloaded = storage.getCampaign(campaign.id);
  assert.equal((reloaded as any).tone, "comedic", "stale accept must not overwrite the owner's newer direct change");
});

test("suggestions: locked campaign rejects accepting a pending suggestion", async () => {
  const { owner, player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const submitRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  const suggestion = await submitRes.json();
  storage.updateCampaign(campaign.id, { settingsLocked: true } as any);
  const ownerToken = signToken(owner.id);
  const acceptRes = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions/${suggestion.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerToken}` },
    body: JSON.stringify({ action: "accept" }),
  });
  assert.equal(acceptRes.status, 409);
});

test("suggestions: cross-campaign suggestion-id tampering is rejected", async () => {
  const fixtureA = makeFixture();
  const fixtureB = makeFixture();
  const playerToken = signToken(fixtureA.player.id);
  const submitRes = await fetch(`${baseUrl}/api/campaigns/${fixtureA.campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  const suggestion = await submitRes.json();
  const ownerBToken = signToken(fixtureB.owner.id);
  const res = await fetch(`${baseUrl}/api/campaigns/${fixtureB.campaign.id}/settings/suggestions/${suggestion.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerBToken}` },
    body: JSON.stringify({ action: "accept" }),
  });
  assert.equal(res.status, 404, "a suggestion must not be resolvable through a different campaign's URL");
});

test("suggestions: a user with no character in the campaign cannot submit", async () => {
  const { outsider, campaign } = makeFixture();
  const token = signToken(outsider.id);
  const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  assert.equal(res.status, 403);
});
```

**Step 5: Run, verify, typecheck**

Run: `node --import tsx --test server/campaign-settings.test.ts` — all PASS.
Run: `npx tsc --noEmit` — no new errors.

**Step 6: Commit**

```bash
git add server/routes.ts server/campaign-settings.test.ts
git commit -m "feat: add campaign settings suggestion submit/list/accept/decline routes"
```

---

### Task 5: History route + `viewerAuthority` on `GET /api/campaigns/:id`

**Files:**
- Modify: `server/routes.ts`
- Modify: `server/campaign-settings.test.ts`

**Interfaces:**
- Consumes: `getCampaignAuthority`, `storage.getCampaignSettingsHistory`.
- Produces: `GET /api/campaigns/:id/settings/history`; `GET /api/campaigns/:id` response gains `viewerAuthority`.

**Step 1: History route**

```ts
app.get("/api/campaigns/:id/settings/history", (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = storage.getCampaign(campaignId);
  if (!campaign) return res.status(404).json({ message: "Campaign not found" });

  const authority = getCampaignAuthority(req, campaign);
  if (authority === "none") return res.status(403).json({ message: "Not a participant in this campaign" });

  return res.json(storage.getCampaignSettingsHistory(campaignId));
});
```

**Step 2: Extend the existing `GET /api/campaigns/:id` handler**

Read the existing handler first (find its current return statement). Add `viewerAuthority` to the response object it already builds:

```ts
return res.json({ ...campaign, viewerAuthority: getCampaignAuthority(req, campaign) });
```

(Match whatever the existing handler's exact response shape is — if it already spreads/wraps `campaign` differently, add the field to that existing shape rather than replacing it.)

**Step 3: Tests**

```ts
test("history route: returns rows in reverse-chronological order, viewable by owner and player", async () => {
  const { owner, player, campaign } = makeFixture();
  const ownerToken = signToken(owner.id);
  await fetch(`${baseUrl}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerToken}` },
    body: JSON.stringify({ tone: "dark" }),
  });
  const playerToken = signToken(player.id);
  const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/settings/history`, {
    headers: { cookie: `dmos_session=${playerToken}` },
  });
  assert.equal(res.status, 200);
  const rows = await res.json();
  assert.equal(rows[0].settingKey, "tone");
});

test("GET /api/campaigns/:id: viewerAuthority is correct for owner, player, and unrelated user", async () => {
  const { owner, player, outsider, campaign } = makeFixture();
  for (const [user, expected] of [[owner, "owner"], [player, "player"], [outsider, "none"]] as const) {
    const token = signToken(user.id);
    const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}`, { headers: { cookie: `dmos_session=${token}` } });
    const body = await res.json();
    assert.equal(body.viewerAuthority, expected);
  }
});
```

**Step 4: Run, verify, typecheck**

Run: `node --import tsx --test server/campaign-settings.test.ts` — all PASS.
Run: `node --import tsx --test server/**/*.test.ts` — no regressions (this touches a shared existing route, so run the full suite carefully).
Run: `npx tsc --noEmit` — no new errors.

**Step 5: Commit**

```bash
git add server/routes.ts server/campaign-settings.test.ts
git commit -m "feat: add campaign settings history route and viewerAuthority on campaign fetch"
```

---

### Task 6: User preferences table + routes

**Files:**
- Create: `server/user-preferences.test.ts`
- Modify: `server/routes.ts`

**Interfaces:**
- Consumes: `storage.getUserPreferences`, `storage.upsertUserPreferences` (Task 1), `requireAuth` (existing).
- Produces: `GET /api/user/preferences`, `PATCH /api/user/preferences`.

**Step 1: Write the Zod schema mirroring `PersonalPreferencesV1`**

```ts
const personalPreferencesSchema = z.object({
  version: z.literal(1),
  display: z.object({
    layoutPreset: z.enum(["wide", "reading", "cinematic"]),
    textSize: z.enum(["sm", "md", "lg"]),
    contextCollapsed: z.boolean(),
    reducedMotion: z.boolean(),
  }),
  interface: z.object({
    hudPreset: z.enum(["minimal", "standard", "tactical", "immersive", "custom"]),
    hudOverrides: z.record(z.boolean()),
  }),
  mechanicalTransparency: z.enum(["narrative", "balanced", "ruleslawyer"]),
  notifications: z.object({
    achievementToasts: z.enum(["full", "compact", "off"]),
  }),
}).strict();

const userPreferencesPatchSchema = z.object({
  data: personalPreferencesSchema,
  updatedAt: z.string(),
});
```

**Step 2: Routes**

```ts
app.get("/api/user/preferences", requireAuth, (req, res) => {
  const row = storage.getUserPreferences(req.user!.id);
  if (!row) {
    return res.json({ data: null, updatedAt: null });
  }
  return res.json({ data: JSON.parse(row.data), updatedAt: row.updatedAt });
});

app.patch("/api/user/preferences", requireAuth, (req, res) => {
  const parsed = userPreferencesPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid preferences", errors: parsed.error.flatten() });
  }
  storage.upsertUserPreferences(req.user!.id, JSON.stringify(parsed.data.data), parsed.data.updatedAt);
  return res.json({ data: parsed.data.data, updatedAt: parsed.data.updatedAt });
});
```

**Step 3: Write `server/user-preferences.test.ts`**

Same fixture/server-bootstrap pattern as `server/campaign-settings.test.ts` (Task 1/2 established it — copy the `before()`/imports/cleanup scaffolding, adjust the db filename to `dmos-user-preferences-test-${Date.now()}.sqlite`).

```ts
const VALID_PREFS = {
  version: 1,
  display: { layoutPreset: "wide", textSize: "md", contextCollapsed: false, reducedMotion: false },
  interface: { hudPreset: "standard", hudOverrides: {} },
  mechanicalTransparency: "balanced",
  notifications: { achievementToasts: "full" },
};

test("GET returns null data for a user with no row yet", async () => {
  const user = storage.createUser({ email: "a@test.dev", username: "a1", passwordHash: "x" } as any);
  const token = signToken(user.id);
  const res = await fetch(`${baseUrl}/api/user/preferences`, { headers: { cookie: `dmos_session=${token}` } });
  const body = await res.json();
  assert.equal(body.data, null);
});

test("PATCH validates and upserts; GET returns exactly what was sent", async () => {
  const user = storage.createUser({ email: "b@test.dev", username: "b1", passwordHash: "x" } as any);
  const token = signToken(user.id);
  const updatedAt = "2026-08-21T00:00:00.000Z";
  const patchRes = await fetch(`${baseUrl}/api/user/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ data: VALID_PREFS, updatedAt }),
  });
  assert.equal(patchRes.status, 200);
  const getRes = await fetch(`${baseUrl}/api/user/preferences`, { headers: { cookie: `dmos_session=${token}` } });
  const body = await getRes.json();
  assert.deepEqual(body.data, VALID_PREFS);
  assert.equal(body.updatedAt, updatedAt);
});

test("invalid shape (unknown key) is rejected with 400", async () => {
  const user = storage.createUser({ email: "c@test.dev", username: "c1", passwordHash: "x" } as any);
  const token = signToken(user.id);
  const res = await fetch(`${baseUrl}/api/user/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ data: { ...VALID_PREFS, extraField: true }, updatedAt: "2026-08-21T00:00:00.000Z" }),
  });
  assert.equal(res.status, 400);
});

test("invalid shape (bad enum) is rejected with 400", async () => {
  const user = storage.createUser({ email: "d@test.dev", username: "d1", passwordHash: "x" } as any);
  const token = signToken(user.id);
  const res = await fetch(`${baseUrl}/api/user/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ data: { ...VALID_PREFS, mechanicalTransparency: "chaotic" }, updatedAt: "2026-08-21T00:00:00.000Z" }),
  });
  assert.equal(res.status, 400);
});

test("one user's preferences are isolated from another's", async () => {
  const userA = storage.createUser({ email: "e@test.dev", username: "e1", passwordHash: "x" } as any);
  const userB = storage.createUser({ email: "f@test.dev", username: "f1", passwordHash: "x" } as any);
  const tokenA = signToken(userA.id);
  await fetch(`${baseUrl}/api/user/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${tokenA}` },
    body: JSON.stringify({ data: { ...VALID_PREFS, mechanicalTransparency: "ruleslawyer" }, updatedAt: "2026-08-21T00:00:00.000Z" }),
  });
  const tokenB = signToken(userB.id);
  const res = await fetch(`${baseUrl}/api/user/preferences`, { headers: { cookie: `dmos_session=${tokenB}` } });
  const body = await res.json();
  assert.equal(body.data, null, "user B must not see user A's preferences");
});

test("unauthenticated request is rejected", async () => {
  const res = await fetch(`${baseUrl}/api/user/preferences`);
  assert.equal(res.status, 401);
});
```

**Step 4: Run, verify, typecheck**

Run: `node --import tsx --test server/user-preferences.test.ts` — all PASS.
Run: `node --import tsx --test server/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — no new errors.

**Step 5: Commit**

```bash
git add server/routes.ts server/user-preferences.test.ts
git commit -m "feat: add user preferences GET/PATCH routes"
```

---

### Task 7: Client `personalPreferences.ts` module (replaces `gameLayoutPreferences.ts`)

**Files:**
- Create: `client/src/lib/personalPreferences.ts`
- Create: `client/src/lib/personalPreferences.test.ts`
- Modify: `client/src/components/game/CampaignGameShell.tsx`
- Delete: `client/src/lib/gameLayoutPreferences.ts`

**Interfaces:**
- Consumes: `GET/PATCH /api/user/preferences` (Task 6).
- Produces: `usePersonalPreferences()` hook returning `{preferences: PersonalPreferencesV1, setLayoutPreset, setTextSize, toggleContextCollapsed, setReducedMotion, setHudPreset, setHudOverride, setMechanicalTransparency, setAchievementToastStyle}`; exported pure functions `shouldAdoptServerValue(local: StoredPreferences, server: {data: PersonalPreferencesV1 | null; updatedAt: string | null}): boolean` and `migrateFromLayoutPreferences(old: {preset: string; hudWidthPct: number; contextWidthPct: number; contextCollapsed: boolean; textSize: string}): PersonalPreferencesV1` for testability.

**Step 1: Read `gameLayoutPreferences.ts` and `CampaignGameShell.tsx`'s current usage in full**

Confirm the exact current `LAYOUT_PRESETS` values (`hudWidthPct`/`contextWidthPct` per preset) and the exact call sites (`preferences.hudWidthPct`, `preferences.contextWidthPct`, `setPreset`) before writing the replacement, so the new module's derived values match exactly and the shell migration doesn't change any visible layout math.

**Step 2: Write `client/src/lib/personalPreferences.ts`**

```ts
export const PERSONAL_PREFERENCES_VERSION = 1 as const;

export type LayoutPreset = "wide" | "reading" | "cinematic";
export type TextSize = "sm" | "md" | "lg";
export type HudPreset = "minimal" | "standard" | "tactical" | "immersive" | "custom";
export type MechanicalTransparency = "narrative" | "balanced" | "ruleslawyer";
export type NotificationStyle = "full" | "compact" | "off";

export const LAYOUT_PRESETS: Record<LayoutPreset, { hudWidthPct: number; contextWidthPct: number }> = {
  wide: { hudWidthPct: 18, contextWidthPct: 20 },
  reading: { hudWidthPct: 15, contextWidthPct: 15 },
  cinematic: { hudWidthPct: 13, contextWidthPct: 13 },
};
// If Step 1 found different real numbers in gameLayoutPreferences.ts, use those exact numbers here instead.

export interface HudFieldOverrides { [fieldKey: string]: boolean | undefined; }

export interface PersonalPreferencesV1 {
  version: 1;
  display: { layoutPreset: LayoutPreset; textSize: TextSize; contextCollapsed: boolean; reducedMotion: boolean };
  interface: { hudPreset: HudPreset; hudOverrides: HudFieldOverrides };
  mechanicalTransparency: MechanicalTransparency;
  notifications: { achievementToasts: NotificationStyle };
}

export const DEFAULT_PREFERENCES: PersonalPreferencesV1 = {
  version: 1,
  display: { layoutPreset: "wide", textSize: "md", contextCollapsed: false, reducedMotion: false },
  interface: { hudPreset: "standard", hudOverrides: {} },
  mechanicalTransparency: "balanced",
  notifications: { achievementToasts: "full" },
};

interface StoredPreferences {
  data: PersonalPreferencesV1;
  updatedAt: string;
  dirty: boolean;
}

const STORAGE_KEY = "dmos.personalPreferences.v1";
const OLD_LAYOUT_KEY = "dmos.gameLayoutPreferences.v1";

export function migrateFromLayoutPreferences(old: {
  preset: LayoutPreset; contextCollapsed: boolean; textSize: TextSize;
}): PersonalPreferencesV1 {
  return {
    ...DEFAULT_PREFERENCES,
    display: {
      layoutPreset: old.preset,
      textSize: old.textSize,
      contextCollapsed: old.contextCollapsed,
      reducedMotion: false,
    },
  };
}

export function shouldAdoptServerValue(
  local: StoredPreferences,
  server: { data: PersonalPreferencesV1 | null; updatedAt: string | null },
): boolean {
  if (!server.data || !server.updatedAt) return false;
  if (local.dirty) return false;
  return new Date(server.updatedAt).getTime() > new Date(local.updatedAt).getTime();
}

function loadLocal(): StoredPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredPreferences;
  } catch {}
  try {
    const oldRaw = window.localStorage.getItem(OLD_LAYOUT_KEY);
    if (oldRaw) {
      const old = JSON.parse(oldRaw);
      const migrated: StoredPreferences = {
        data: migrateFromLayoutPreferences(old),
        updatedAt: new Date().toISOString(),
        dirty: true,
      };
      saveLocal(migrated);
      return migrated;
    }
  } catch {}
  return { data: DEFAULT_PREFERENCES, updatedAt: new Date(0).toISOString(), dirty: false };
}

function saveLocal(stored: StoredPreferences) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch {}
}

export function usePersonalPreferences() {
  const [stored, setStored] = React.useState<StoredPreferences>(() => loadLocal());

  const syncToServer = React.useCallback((toSend: StoredPreferences) => {
    fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: toSend.data, updatedAt: toSend.updatedAt }),
    }).then((res) => {
      if (!res.ok) return;
      setStored((current) => {
        if (current.updatedAt !== toSend.updatedAt) return current; // a newer local edit happened mid-flight
        const confirmed = { ...current, dirty: false };
        saveLocal(confirmed);
        return confirmed;
      });
    }).catch(() => { /* leave dirty: true, retried on next natural trigger */ });
  }, []);

  React.useEffect(() => {
    fetch("/api/user/preferences").then((r) => r.json()).then((server) => {
      setStored((local) => {
        if (shouldAdoptServerValue(local, server)) {
          const adopted = { data: server.data, updatedAt: server.updatedAt, dirty: false };
          saveLocal(adopted);
          return adopted;
        }
        if (local.dirty) syncToServer(local);
        return local;
      });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible" && stored.dirty) syncToServer(stored); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [stored, syncToServer]);

  const commit = React.useCallback((updater: (data: PersonalPreferencesV1) => PersonalPreferencesV1) => {
    setStored((current) => {
      const next: StoredPreferences = { data: updater(current.data), updatedAt: new Date().toISOString(), dirty: true };
      saveLocal(next);
      syncToServer(next);
      return next;
    });
  }, [syncToServer]);

  return {
    preferences: stored.data,
    setLayoutPreset: (preset: LayoutPreset) => commit((d) => ({ ...d, display: { ...d.display, layoutPreset: preset } })),
    setTextSize: (size: TextSize) => commit((d) => ({ ...d, display: { ...d.display, textSize: size } })),
    toggleContextCollapsed: () => commit((d) => ({ ...d, display: { ...d.display, contextCollapsed: !d.display.contextCollapsed } })),
    setReducedMotion: (on: boolean) => commit((d) => ({ ...d, display: { ...d.display, reducedMotion: on } })),
    setHudPreset: (preset: HudPreset) => commit((d) => ({ ...d, interface: { ...d.interface, hudPreset: preset, hudOverrides: {} } })),
    setHudOverride: (field: string, value: boolean) => commit((d) => ({
      ...d, interface: { hudPreset: "custom", hudOverrides: { ...d.interface.hudOverrides, [field]: value } },
    })),
    setMechanicalTransparency: (v: MechanicalTransparency) => commit((d) => ({ ...d, mechanicalTransparency: v })),
    setAchievementToastStyle: (v: NotificationStyle) => commit((d) => ({ ...d, notifications: { achievementToasts: v } })),
  };
}
```

(`React` must be imported at the top — `import * as React from "react";` or match whatever import style the rest of `client/src/lib/` uses; check an existing hook file for the convention before finalizing.)

**Step 3: Write `client/src/lib/personalPreferences.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldAdoptServerValue, migrateFromLayoutPreferences, DEFAULT_PREFERENCES } from "./personalPreferences";

test("shouldAdoptServerValue: server wins when newer and local is not dirty", () => {
  const local = { data: DEFAULT_PREFERENCES, updatedAt: "2026-08-01T00:00:00.000Z", dirty: false };
  const server = { data: DEFAULT_PREFERENCES, updatedAt: "2026-08-02T00:00:00.000Z" };
  assert.equal(shouldAdoptServerValue(local, server), true);
});

test("shouldAdoptServerValue: local wins when dirty, even if server timestamp is newer", () => {
  const local = { data: DEFAULT_PREFERENCES, updatedAt: "2026-08-01T00:00:00.000Z", dirty: true };
  const server = { data: DEFAULT_PREFERENCES, updatedAt: "2026-08-02T00:00:00.000Z" };
  assert.equal(shouldAdoptServerValue(local, server), false);
});

test("shouldAdoptServerValue: local wins when local timestamp is newer", () => {
  const local = { data: DEFAULT_PREFERENCES, updatedAt: "2026-08-03T00:00:00.000Z", dirty: false };
  const server = { data: DEFAULT_PREFERENCES, updatedAt: "2026-08-02T00:00:00.000Z" };
  assert.equal(shouldAdoptServerValue(local, server), false);
});

test("shouldAdoptServerValue: no server row yet returns false", () => {
  const local = { data: DEFAULT_PREFERENCES, updatedAt: "2026-08-01T00:00:00.000Z", dirty: false };
  assert.equal(shouldAdoptServerValue(local, { data: null, updatedAt: null }), false);
});

test("migrateFromLayoutPreferences: carries the 3 old fields into the new schema shape", () => {
  const migrated = migrateFromLayoutPreferences({ preset: "reading", contextCollapsed: true, textSize: "lg" });
  assert.equal(migrated.display.layoutPreset, "reading");
  assert.equal(migrated.display.contextCollapsed, true);
  assert.equal(migrated.display.textSize, "lg");
  assert.equal(migrated.display.reducedMotion, false);
});
```

**Step 4: Migrate `CampaignGameShell.tsx`'s call site**

Replace `import { useGameLayoutPreferences } from "@/lib/gameLayoutPreferences";` with `import { usePersonalPreferences, LAYOUT_PRESETS } from "@/lib/personalPreferences";`. Replace `const { preferences, setPreset } = useGameLayoutPreferences();` with:

```ts
const { preferences: personalPreferences, setLayoutPreset } = usePersonalPreferences();
const layoutDims = LAYOUT_PRESETS[personalPreferences.display.layoutPreset];
```

Update the CSS-var-setting code (currently reading `preferences.hudWidthPct`/`preferences.contextWidthPct`) to read `layoutDims.hudWidthPct`/`layoutDims.contextWidthPct`, and update the Wide/Reading/Cinematic button row's `onClick={() => setPreset(key)}` to `onClick={() => setLayoutPreset(key)}`, and its active-state check to compare against `personalPreferences.display.layoutPreset`.

**Step 5: Delete `gameLayoutPreferences.ts`**

Confirm no other file imports it (`grep -rn "gameLayoutPreferences" client/src`), then delete it.

**Step 6: Run tests**

Run: `node --import tsx --test client/src/lib/personalPreferences.test.ts`
Expected: all 5 tests PASS.

**Step 7: Typecheck and build**

Run: `npx tsc --noEmit` — no new errors (this is the step that will catch any mismatch between the plan's guessed `LAYOUT_PRESETS` numbers and the real ones if Step 1 wasn't followed carefully).
Run: `npm run build` — must succeed.

**Step 8: Manual browser verification**

Start the dev server, open a campaign, confirm: the Wide/Reading/Cinematic pill still works exactly as before (same visual widths), reload the page and confirm the layout preset persists, open browser devtools → Application → Local Storage and confirm `dmos.personalPreferences.v1` exists and `dmos.gameLayoutPreferences.v1` is gone from active use (old key may still be present as inert dead storage per the migration design — that's expected, not a bug).

**Step 9: Commit**

```bash
git add client/src/lib/personalPreferences.ts client/src/lib/personalPreferences.test.ts client/src/components/game/CampaignGameShell.tsx
git rm client/src/lib/gameLayoutPreferences.ts
git commit -m "feat: replace gameLayoutPreferences with hybrid-synced personalPreferences module"
```

---

### Task 8: Resurrect and restyle `CampaignSettingsPanel.tsx`

**Files:**
- Modify: `client/src/components/CampaignSettingsPanel.tsx`

**Interfaces:**
- Consumes: `Dialog`/`DialogContent`/`DialogTitle` from `@/components/ui/dialog`; `viewerAuthority` (passed in as a prop from the parent `OptionsDialog`, Task 10 — not fetched independently here).
- Produces: `<CampaignSettingsPanel campaign={campaign} viewerAuthority={authority} campaignId={campaignId} />` — same `TONE_OPTIONS`/`COMBAT_OPTIONS`/`RULES_OPTIONS`/`POWER_OPTIONS` constants and `SettingRow`/`ConfirmModal` internal structure, restyled.

**Step 1: Read the full current file**

Read `client/src/components/CampaignSettingsPanel.tsx` in full (already quoted extensively in the design-spec investigation, but re-confirm before editing since this task rewrites significant portions).

**Step 2: Replace the `isHost` prop with `viewerAuthority`**

Change the `Props` interface:

```ts
interface Props {
  campaign: Campaign;
  viewerAuthority: "owner" | "player" | "none";
  campaignId: number;
}
```

Replace every internal use of `isHost` with `viewerAuthority === "owner"` (a local `const isHost = viewerAuthority === "owner";` at the top of the component keeps the rest of the file's logic unchanged — this is a rename, not a logic rewrite).

**Step 3: Replace the hand-rolled `ConfirmModal` fixed-overlay with `Dialog`**

Replace the `ConfirmModal` function's `position: "fixed", inset: 0, ...` wrapper with:

```tsx
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function ConfirmModal({ settingLabel, oldValue, newValue, level, onConfirm, onCancel }: ConfirmProps) {
  const w = WARN_TEXT[level];
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-sm bg-gradient-to-br from-[#1a1108] to-[#0d0b06] border-2" style={{ borderColor: w.border }}>
        <DialogTitle className="sr-only">Change {settingLabel}?</DialogTitle>
        {/* keep the existing icon/title/change-summary/warning-text/buttons JSX exactly as-is below this line — only the outer wrapper changes */}
      </DialogContent>
    </Dialog>
  );
}
```

Keep all inner JSX (icon circle, title text, change-summary row, warning-text block, Cancel/Confirm buttons) exactly as the current file has it — only the outer `position: fixed` div is replaced by `Dialog`/`DialogContent`.

**Step 4: Remove the outer collapsible-accordion wrapper**

The current top-level export is a collapsible `<div>` with its own `open`/`setOpen` toggle button (`Campaign Settings` header row with `ChevronUp`/`ChevronDown`). Since this component will now be embedded directly inside a `Campaign` tab of `OptionsDialog` (Task 10), which is already a `Dialog`, remove the outer collapse/expand wrapper — the component should render its content directly (still keep the internal `SettingRow`s, warning color key, etc., just without the extra accordion shell around the whole panel):

```tsx
export default function CampaignSettingsPanel({ campaign, viewerAuthority, campaignId }: Props) {
  const isHost = viewerAuthority === "owner";
  const [pending, setPending] = useState<PendingChange | null>(null);
  // ... existing patchMutation, handleRequest, handleConfirm, `c` alias unchanged ...

  return (
    <div>
      {pending && (
        <ConfirmModal
          settingLabel={pending.key.replace(/([A-Z])/g, ' $1').trim()}
          oldValue={pending.oldLabel}
          newValue={pending.newLabel}
          level={pending.level}
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}
      {!isHost && (
        <div className="text-xs italic mb-2" style={{ color: "#8a6830" }}>view only — suggest changes below</div>
      )}
      {/* existing SettingRow block for storyMode/epicMode/tone/combatStyle/rulesWeight/powerLevel, unchanged */}
      {/* existing warning colour key, unchanged */}
    </div>
  );
}
```

**Step 5: Wire the mutation's `settingsLocked` awareness**

The existing `patchMutation` PATCHes `/api/campaigns/:id` directly — this already goes through Task 2's extended handler, so a locked campaign will now correctly 409. Add a lightweight error surface: in `patchMutation`'s `onError`, show `pending`'s `ConfirmModal` state cleared and a toast (`useToast()`, matching whatever toast hook the rest of the app uses — check `CampaignSuggestions.tsx`'s sibling usage in Task 9, or an existing overlay like `InventoryOverlay.tsx`, for the exact import) reading "Campaign settings are locked" when the response status is 409.

**Step 6: Typecheck**

Run: `npx tsc --noEmit` — no new errors.

**Step 7: Manual browser verification**

Deferred to Task 10 (this component isn't reachable from any UI until `OptionsDialog` renders it) — note in the commit message that verification happens end-to-end in Task 10.

**Step 8: Commit**

```bash
git add client/src/components/CampaignSettingsPanel.tsx
git commit -m "refactor: restyle CampaignSettingsPanel onto Dialog, replace isHost with server-sourced viewerAuthority"
```

---

### Task 9: `CampaignSuggestions.tsx` and `CampaignSettingsHistory.tsx`

**Files:**
- Create: `client/src/components/game/CampaignSuggestions.tsx`
- Create: `client/src/components/game/CampaignSettingsHistory.tsx`

**Interfaces:**
- Consumes: `GET/POST/PATCH /api/campaigns/:id/settings/suggestions`, `GET /api/campaigns/:id/settings/history` (Tasks 4/5); `viewerAuthority` prop from parent.
- Produces: `<CampaignSuggestions campaignId={id} viewerAuthority={authority} />`, `<CampaignSettingsHistory campaignId={id} />`.

**Step 1: `CampaignSuggestions.tsx`**

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

interface Suggestion {
  id: number; settingKey: string; currentValue: string; proposedValue: string;
  submittedByUserId: number; reason: string | null; status: string;
}

const SUGGESTABLE_KEYS = ["tone", "combatStyle", "rulesWeight", "powerLevel", "storyMode", "epicMode"] as const;

export default function CampaignSuggestions({ campaignId, viewerAuthority }: { campaignId: number; viewerAuthority: "owner" | "player" | "none" }) {
  const qc = useQueryClient();
  const isHost = viewerAuthority === "owner";
  const { data: suggestions = [] } = useQuery<Suggestion[]>({
    queryKey: ["/api/campaigns", campaignId, "settings", "suggestions"],
    queryFn: async () => (await apiRequest("GET", `/api/campaigns/${campaignId}/settings/suggestions`)).json(),
  });

  const [settingKey, setSettingKey] = useState<typeof SUGGESTABLE_KEYS[number]>("tone");
  const [proposedValue, setProposedValue] = useState("");
  const [reason, setReason] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/campaigns/${campaignId}/settings/suggestions`, { settingKey, proposedValue, reason })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "settings", "suggestions"] });
      setProposedValue(""); setReason("");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "accept" | "decline" }) =>
      (await apiRequest("PATCH", `/api/campaigns/${campaignId}/settings/suggestions/${id}`, { action })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "settings", "suggestions"] });
      qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
    },
  });

  const pending = suggestions.filter((s) => s.status === "pending");

  return (
    <div className="space-y-3">
      {pending.length === 0 && <p className="text-xs italic text-muted-foreground">No pending suggestions.</p>}
      {pending.map((s) => (
        <div key={s.id} className="border rounded-md p-2 text-xs">
          <div className="font-semibold">{s.settingKey}: {s.currentValue} → {s.proposedValue}</div>
          {s.reason && <div className="italic text-muted-foreground">"{s.reason}"</div>}
          {isHost && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => resolveMutation.mutate({ id: s.id, action: "accept" })} className="text-green-600">Accept</button>
              <button onClick={() => resolveMutation.mutate({ id: s.id, action: "decline" })} className="text-red-600">Decline</button>
            </div>
          )}
        </div>
      ))}
      {!isHost && viewerAuthority === "player" && (
        <div className="border-t pt-3 space-y-2">
          <select value={settingKey} onChange={(e) => setSettingKey(e.target.value as any)}>
            {SUGGESTABLE_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input value={proposedValue} onChange={(e) => setProposedValue(e.target.value)} placeholder="Proposed value" />
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
          <button onClick={() => submitMutation.mutate()} disabled={!proposedValue}>Suggest Change</button>
        </div>
      )}
    </div>
  );
}
```

(Confirm `apiRequest`'s exact signature from `@/lib/queryClient` before finalizing — it's already used by `CampaignSettingsPanel.tsx`'s existing `patchMutation`, so match that call shape exactly.)

**Step 2: `CampaignSettingsHistory.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface HistoryRow {
  id: number; settingKey: string; oldValue: string | null; newValue: string;
  source: string; createdAt: string;
}

export default function CampaignSettingsHistory({ campaignId }: { campaignId: number }) {
  const { data: rows = [] } = useQuery<HistoryRow[]>({
    queryKey: ["/api/campaigns", campaignId, "settings", "history"],
    queryFn: async () => (await apiRequest("GET", `/api/campaigns/${campaignId}/settings/history`)).json(),
  });

  if (rows.length === 0) return <p className="text-xs italic text-muted-foreground">No changes yet.</p>;

  return (
    <div className="space-y-2 text-xs">
      {rows.map((r) => (
        <div key={r.id} className="border-b pb-1">
          <div>{new Date(r.createdAt).toLocaleDateString()} — <strong>{r.settingKey}</strong>: {r.oldValue ?? "—"} → {r.newValue}</div>
          <div className="text-muted-foreground italic">{r.source === "accepted-suggestion" ? "via accepted suggestion" : "changed by host"}</div>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Typecheck**

Run: `npx tsc --noEmit` — no new errors.

**Step 4: Manual verification**

Deferred to Task 10 (not reachable from any UI until `OptionsDialog` renders them).

**Step 5: Commit**

```bash
git add client/src/components/game/CampaignSuggestions.tsx client/src/components/game/CampaignSettingsHistory.tsx
git commit -m "feat: add campaign settings suggestions and history UI components"
```

---

### Task 10: `OptionsDialog` + header/shell wiring (final integration)

**Files:**
- Create: `client/src/components/game/OptionsDialog.tsx`
- Modify: `client/src/components/game/CampaignGameHeader.tsx`
- Modify: `client/src/components/game/CampaignGameShell.tsx`

**Interfaces:**
- Consumes: `usePersonalPreferences` (Task 7), `CampaignSettingsPanel` (Task 8), `CampaignSuggestions`/`CampaignSettingsHistory` (Task 9), campaign query's `viewerAuthority` field (Task 5).
- Produces: fully wired Options entry point.

**Step 1: `CampaignGameHeader.tsx` — enable the Settings button**

Add `onOpenOptions: () => void;` to the `Props` type. Replace the `<StubHeaderButton icon={MoreHorizontal} label="Settings" />` call with a real button matching the header's existing enabled-button style (look at how `onBack`'s button is rendered for the exact classes/`Button` component usage):

```tsx
<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenOptions}>
        <MoreHorizontal className="w-4 h-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom">Options</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Step 2: `OptionsDialog.tsx`**

```tsx
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePersonalPreferences } from "@/lib/personalPreferences";
import CampaignSettingsPanel from "@/components/CampaignSettingsPanel";
import CampaignSuggestions from "./CampaignSuggestions";
import CampaignSettingsHistory from "./CampaignSettingsHistory";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
}

export default function OptionsDialog({ open, onOpenChange, campaignId }: Props) {
  const [tab, setTab] = useState<"personal" | "campaign">("personal");
  const [campaignSubTab, setCampaignSubTab] = useState<"settings" | "suggestions" | "history">("settings");
  const { preferences, setLayoutPreset, setTextSize, toggleContextCollapsed, setReducedMotion, setHudPreset, setMechanicalTransparency, setAchievementToastStyle } = usePersonalPreferences();

  const { data: campaign } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: async () => (await apiRequest("GET", `/api/campaigns/${campaignId}`)).json(),
    enabled: open,
  });
  const viewerAuthority: "owner" | "player" | "none" = campaign?.viewerAuthority ?? "none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogTitle>Options</DialogTitle>
        <div className="flex gap-2 border-b mb-4">
          <button onClick={() => setTab("personal")} className={tab === "personal" ? "font-bold" : ""}>Personal</button>
          <button onClick={() => setTab("campaign")} className={`dm-shell ${tab === "campaign" ? "font-bold" : ""}`}>Campaign</button>
        </div>

        {tab === "personal" && (
          <div className="space-y-4">
            <section>
              <h3 className="text-sm font-semibold">Display</h3>
              <label>Layout
                <select value={preferences.display.layoutPreset} onChange={(e) => setLayoutPreset(e.target.value as any)}>
                  <option value="wide">Wide</option>
                  <option value="reading">Reading</option>
                  <option value="cinematic">Cinematic</option>
                </select>
              </label>
              <label>Text Size
                <select value={preferences.display.textSize} onChange={(e) => setTextSize(e.target.value as any)}>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </label>
              <label>
                <input type="checkbox" checked={preferences.display.contextCollapsed} onChange={toggleContextCollapsed} />
                Collapse context panel
              </label>
              <label>
                <input type="checkbox" checked={preferences.display.reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
                Reduced motion
              </label>
            </section>
            <section>
              <h3 className="text-sm font-semibold">Interface</h3>
              <label>HUD Preset
                <select value={preferences.interface.hudPreset} onChange={(e) => setHudPreset(e.target.value as any)}>
                  <option value="minimal">Minimal</option>
                  <option value="standard">Standard</option>
                  <option value="tactical">Tactical</option>
                  <option value="immersive">Immersive</option>
                </select>
              </label>
            </section>
            <section>
              <h3 className="text-sm font-semibold">Mechanical Transparency</h3>
              <select value={preferences.mechanicalTransparency} onChange={(e) => setMechanicalTransparency(e.target.value as any)}>
                <option value="narrative">Narrative</option>
                <option value="balanced">Balanced</option>
                <option value="ruleslawyer">Rules Lawyer</option>
              </select>
            </section>
            <section>
              <h3 className="text-sm font-semibold">Notifications</h3>
              <label>Achievement toasts
                <select value={preferences.notifications.achievementToasts} onChange={(e) => setAchievementToastStyle(e.target.value as any)}>
                  <option value="full">Full</option>
                  <option value="compact">Compact</option>
                  <option value="off">Off</option>
                </select>
              </label>
            </section>
          </div>
        )}

        {tab === "campaign" && campaign && (
          <div className="dm-shell space-y-4">
            {viewerAuthority === "none" ? (
              <p>You are not a participant in this campaign.</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <button onClick={() => setCampaignSubTab("settings")}>Settings</button>
                  <button onClick={() => setCampaignSubTab("suggestions")}>Suggestions</button>
                  <button onClick={() => setCampaignSubTab("history")}>History</button>
                </div>
                {campaignSubTab === "settings" && (
                  <CampaignSettingsPanel campaign={campaign} viewerAuthority={viewerAuthority} campaignId={campaignId} />
                )}
                {campaignSubTab === "suggestions" && (
                  <CampaignSuggestions campaignId={campaignId} viewerAuthority={viewerAuthority} />
                )}
                {campaignSubTab === "history" && (
                  <CampaignSettingsHistory campaignId={campaignId} />
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: `CampaignGameShell.tsx` — wire it in**

Add `const [optionsOpen, setOptionsOpen] = useState(false);` alongside the existing `inventoryOpen`/`codexOpen`/`overviewOpen` state. Pass `onOpenOptions={() => setOptionsOpen(true)}` to the `<CampaignGameHeader ... />` call (which currently passes only 3 of 4 declared props — this becomes the 4th, alongside `sceneLabel` if that's also being supplied; if not, leave `sceneLabel` as-is, this task only adds `onOpenOptions`). Render `<OptionsDialog open={optionsOpen} onOpenChange={setOptionsOpen} campaignId={campaignId} />` alongside the existing `Dialog`/`CodexOverlay`/`InventoryOverlay` renders (confirm the `campaignId` variable name already in scope in this file — it's used by the existing overlays' props).

**Step 4: Typecheck and build**

Run: `npx tsc --noEmit` — no new errors.
Run: `npm run build` — must succeed.

**Step 5: Full test suite**

Run: `node --import tsx --test server/**/*.test.ts` — all PASS, no regressions.
Run: `node --import tsx --test client/src/lib/*.test.ts` — all PASS.

**Step 6: Manual end-to-end browser verification**

Using the existing `node seed-script.cjs` pattern, seed a campaign with two characters: one owned by a logged-in "owner" user (matching `campaign.userId`), one owned by a different logged-in "player" user. Then:

1. Log in as owner, open the campaign, click the header's Settings (gear/`MoreHorizontal`) button → `OptionsDialog` opens.
2. Personal tab: change layout preset, text size, reduced motion, HUD preset, mechanical transparency, notification style — confirm each persists across a page reload (localStorage) and confirm `GET /api/user/preferences` in the Network tab reflects the change shortly after.
3. Campaign tab → Settings sub-tab: confirm all six fields are editable, changing one shows the existing confirm-modal warning flow, confirms via `Dialog` (not the old fixed overlay), and the campaign updates.
4. Campaign tab → lock the campaign (via the settings-lock control — confirm this exists in the UI; if Task 8/9 didn't add a visible lock toggle button, add one now as part of this final wiring step, calling `PATCH /api/campaigns/:id/settings/lock`), then attempt a direct setting change as owner → confirm it's rejected with the "locked" message; unlock and confirm the owner action still succeeds.
5. Log out, log in as the player. Confirm Campaign → Settings renders read-only. Submit a suggestion via the Suggestions sub-tab.
6. Log back in as owner, confirm the pending suggestion appears, accept it, confirm the setting value changed and appears in History.
7. Confirm a second browser tab/session subscribed to the same campaign sees the `campaign_updated` broadcast and its own settings view refreshes without a manual reload (this exercises the existing WebSocket path, unchanged by this feature).

**Step 7: Commit**

```bash
git add client/src/components/game/OptionsDialog.tsx client/src/components/game/CampaignGameHeader.tsx client/src/components/game/CampaignGameShell.tsx
git commit -m "feat: wire OptionsDialog into the game header, completing the Options/Settings system"
```

---

## Self-Review

**Spec coverage:**
- Personal Options schema/sync/hybrid persistence → Tasks 6-7. ✓
- Campaign Settings validation/lock/suggestions/history/broadcast → Tasks 1-5. ✓
- `getCampaignAuthority` consolidation → Task 1, consumed by every later server task. ✓
- `CampaignSettingsPanel` resurrection → Task 8. ✓
- Header/shell wiring → Task 10. ✓
- No untyped `rulesetSettings` → never introduced in any task; Global Constraints calls this out explicitly. ✓
- Deferred items (audio, keybindings, narration style, content prefs, spectator role, ruleset-specific toggles, session-boundary lock) → correctly absent from every task; nothing here builds a fake control. ✓
- Testing requirements from the spec (ownership isolation, validation, stale suggestions, locking, ruleset isolation implicitly satisfied by shipping zero ruleset-specific settings) → covered across Tasks 1-6's test steps. ✓
- Changelog entries → not a code task; call out as a follow-up after Task 10 lands (matches the user's established "publish a DMOS Updates entry after every shipped change" habit — do this once the whole feature is deployed, not per-task).

**Placeholder scan:** every step has real code, real file paths, real commands. The two spots flagged as "confirm the real value before finalizing" (Task 2's Zod enum values sourced from `CampaignSettingsPanel.tsx`'s constants, Task 7's `LAYOUT_PRESETS` numbers sourced from `gameLayoutPreferences.ts`) are read-then-transcribe steps, not unresolved design gaps — the plan tells the implementer exactly which real file to read and what to copy from it, which is the correct way to handle values this plan's author hasn't directly re-verified byte-for-byte in this pass but which were already confirmed to exist during the design investigation.

**Type consistency:** `CampaignAuthority`/`getCampaignAuthority` (Task 1) used identically in Tasks 2-5 and by the client's `viewerAuthority` field (Task 5) through to `OptionsDialog`/`CampaignSettingsPanel`/`CampaignSuggestions` (Tasks 8-10). `PersonalPreferencesV1` (Task 7) used identically in Task 6's server Zod schema and Task 10's `OptionsDialog`. `campaignSettingsPatchSchema` (Task 2) reused as-is by Task 4's suggestion-accept validation. No naming drift found.

## Execution

Per your explicit direction earlier in this conversation, this plan executes via **Subagent-Driven Development**: a fresh implementer subagent per task, a task-scoped reviewer after each (spec compliance + code quality), personal verification of every diff and independent test re-run after each task (not just trusting the subagent/reviewer reports), and a whole-feature review on the most capable model at the end before declaring completion. Proceeding directly to that now.
