# In-Game Options / Settings System — Design Spec

## Overview

Two independent, never-conflated settings domains:

- **Personal Options** — belongs to the user. Presentation-only. Never affects campaign mechanics or other players. Hybrid local-first + server-synced.
- **Campaign Settings** — belongs to the campaign. Owner-controlled, server-authoritative, auditable, and ruleset-isolated as a permanent principle — though v1 ships no ruleset-specific fields at all (see Non-Goals), so there is nothing to namespace yet. Players may view and suggest; only the owner (or an accepted suggestion) changes a value.

Locked architecture decisions (do not revisit without stopping to report a conflict first):

1. Personal Options use hybrid local-first + server-backed sync: local cache renders instantly, server value is fetched and wins on conflict, changes apply locally immediately and persist asynchronously, sync failure never blocks gameplay.
2. Campaign Settings UI is the resurrection and extension of the existing orphaned `client/src/components/CampaignSettingsPanel.tsx`, not a parallel new component.
3. v1 ships only settings backed by real, already-existing mechanics or infrastructure. No toggle is exposed that the server does not actually enforce. Everything else gets a documented extension point, not a placeholder control.

## Non-Goals / Explicitly Deferred

Each of these is deferred because the system it would control does not exist yet. Building the toggle without the system would violate decision #3 above.

| Area | Why deferred | Extension point left |
|---|---|---|
| Audio (volume sliders, mute) | No audio engine exists anywhere in the codebase | `PersonalPreferencesV1` is versioned/extensible; a future `audio` top-level key requires no migration of existing keys |
| Controls / keybinding remapping | No keybinding registry exists; building one is its own project | none in v1 — out of scope entirely, not stubbed |
| Narration length/perspective/dialogue-placement | The DM AI prompt builder does not currently consume any narration-style parameter from personal settings; wiring this touches prompt generation, a materially different and riskier change than a settings UI | none in v1 |
| Content preferences (gore/horror/etc.) | No moderation/content-safety infrastructure exists to enforce them | none in v1 |
| Spectator role / multiplayer visibility settings | No campaign membership/role table exists at all; campaign participation today is inferred from `characters.campaignId`. Building this is a data-modeling project, not a settings toggle | `campaign_setting_suggestions`/`campaign_settings_history` are keyed by arbitrary setting `key` strings, so a future `multiplayer.*` key needs no schema change |
| Ruleset-specific mechanical Rules toggles (encumbrance, ammo tracking, material components, spell-prep strictness, crafting cost/XP, death/dying detail, resurrection rules) | None of these have server enforcement today — confirmed absent from `shared/schema.ts`, `server/routes.ts`, and `server/combat-engine.ts` | **none.** No `rulesetSettings` field of any kind is added to the campaign settings type in v1 — not even a placeholder. Ruleset isolation is a permanent architectural rule, not a v1 scoping convenience, so this must never become a generic `Record<string, unknown>` dumping ground. When the first real, server-enforced ruleset-specific setting exists, it is added then as a typed, discriminated-by-ruleset structure — conceptually `rulesetSettings: { dnd35e?: Dnd35CampaignSettings; dnd5e?: Dnd5CampaignSettings }`, each member itself a fully-typed interface with real fields, populated only once its mechanic is actually implemented. Adding the container type is future work done alongside that first real setting, not now. |
| Rules Enforcement Presets (Relaxed/Standard/Strict/Custom) | These only make sense once there are ≥2 real underlying mechanical toggles to map to preset combinations; today there's nothing to preset | none — revisit once the first ruleset-specific toggle ships |
| DM narrative-style sliders beyond the existing `tone`/`combatStyle`/`worldGenStyle`/`homebrewRules`/`customWorldPrompt` | These five fields already are the DM-style parameters that reach the AI prompt; adding more requires investigating the prompt builder's actual consumption of campaign fields, which is out of scope for this pass | none — the existing free-text `homebrewRules`/`customWorldPrompt` fields remain the escape hatch for anything not covered by the five enums |
| Session-boundary-aware settings lock ("Between Sessions Only") | No reliable session-boundary concept exists server-side | only the "Explicitly Locked" tier ships (a plain boolean) |
| Notifications beyond achievement-unlock toasts | No other notification-worthy server event currently fires a client-visible signal (confirmed via WebSocket message-type audit) | `notifications` schema key takes a style enum today scoped to the one real event; new event types add enum values, not new keys |

## Personal Options

### Schema

New client module `client/src/lib/personalPreferences.ts` **replaces** `client/src/lib/gameLayoutPreferences.ts`. This is a hard replacement, not an addition — per the "one canonical implementation" rule, the app must not end up with two competing preference systems. `CampaignGameShell.tsx`'s one call site (`useGameLayoutPreferences()`) moves to the new hook; `gameLayoutPreferences.ts` is deleted once nothing imports it.

```ts
export const PERSONAL_PREFERENCES_VERSION = 1;

export type LayoutPreset = "wide" | "reading" | "cinematic";
export type TextSize = "sm" | "md" | "lg";
export type HudPreset = "minimal" | "standard" | "tactical" | "immersive" | "custom";
export type MechanicalTransparency = "narrative" | "balanced" | "ruleslawyer";
export type NotificationStyle = "full" | "compact" | "off";

export interface HudFieldOverrides {
  // only fields the Character Overview panel actually renders today
  // (name/race/class/level/status/hp/speed/attacks/initiative/ac/xp/abilities/currency/saves)
  // each key optional; absence = use the active preset's default for that field
  [fieldKey: string]: boolean | undefined;
}

export interface PersonalPreferencesV1 {
  version: 1;
  display: {
    layoutPreset: LayoutPreset;      // migrated from gameLayoutPreferences
    textSize: TextSize;              // migrated (was unused — first real consumer)
    contextCollapsed: boolean;       // migrated (was unused — first real consumer)
    reducedMotion: boolean;          // new — gates real existing CSS transitions only
  };
  interface: {
    hudPreset: HudPreset;
    hudOverrides: HudFieldOverrides; // changing one field while on a named preset flips hudPreset to "custom"
  };
  mechanicalTransparency: MechanicalTransparency;
  notifications: {
    achievementToasts: NotificationStyle;
  };
}
```

`hudWidthPct`/`contextWidthPct` (the numeric layout math currently in `LAYOUT_PRESETS`) stay derived from `layoutPreset` exactly as today — not stored redundantly.

`reducedMotion`: confirmed real target — `client/src/components/ui/dialog.tsx` applies `data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0` (Radix state-driven Tailwind animation classes) on every `DialogOverlay`/`DialogContent` app-wide, meaning every overlay in the app (Codex, Inventory, Character Overview, the new Options dialog itself) already animates open/close. `reducedMotion` gates these — implementation applies Tailwind's `motion-reduce:` pattern or a `data-reduced-motion` attribute on a shared root that these classes key off, confirmed against the real class list above rather than invented.

`mechanicalTransparency`: pure presentation over data the server already returns (`FullCharacterSheet.attack.breakdown`, save DCs, etc. — all already computed this session for the character sheet). "Narrative" hides the breakdown/DC detail already rendered on the sheet and in narration where currently shown; "Rules Lawyer" shows it; "Balanced" matches current default behavior. No new server computation — this setting only toggles what already-fetched data renders.

### Server

New table (added to `server/storage.ts`'s `runMigrations()` via `CREATE TABLE IF NOT EXISTS`, matching the existing hand-rolled migration mechanism — no drizzle-kit push):

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  data TEXT NOT NULL DEFAULT '{}',   -- JSON, parsed/validated against PersonalPreferencesV1
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
```

Routes (both `requireAuth`):

- `GET /api/user/preferences` → returns `{data, updatedAt}` parsed from the stored row, or `{data: defaults, updatedAt: null}` if no row exists yet (no migration needed for existing users — absence is a valid state).
- `PATCH /api/user/preferences` → body `{data, updatedAt}`; validates `data` against a Zod schema mirroring `PersonalPreferencesV1` (reject unknown top-level keys, reject invalid enum values), stores the client-sent `updatedAt` verbatim as the row's `updated_at` (the server never generates its own timestamp for this — see Sync algorithm below for why), upserts, returns `{data, updatedAt}`.

No WebSocket broadcast — personal settings changes are never campaign-wide events, per your explicit requirement.

### Sync algorithm (client)

Conflict resolution uses a client-stamped timestamp, not wall-clock server-arrival order — this is what stops a slow-to-land GET from clobbering a newer local change. The localStorage value is a small wrapper, not the bare preferences object:

```ts
interface StoredPreferences {
  data: PersonalPreferencesV1;
  updatedAt: string;   // ISO timestamp, stamped locally at the moment of the edit
  dirty: boolean;       // true = local has changes the server has not confirmed
}
```

The server row's `updated_at` column stores exactly the `updatedAt` the client last successfully PATCHed with (not a server-generated timestamp) — the server is a deterministic last-write-wins store keyed by client-stamped time, nothing more elaborate.

1. On mount: read the `StoredPreferences` wrapper from `localStorage` (key `dmos.personalPreferences.v1`) synchronously, render `data` immediately (defaults if absent).
2. Fire `GET /api/user/preferences` in the background. Compare the server row's `updatedAt` to the local wrapper's `updatedAt`:
   - Server newer, and local is not `dirty` → adopt server `data`, update local wrapper, `dirty: false`.
   - Local newer, or local is `dirty` (a change made and not yet confirmed synced) → **do not overwrite local state.** Keep rendering local `data`, and immediately re-fire the pending `PATCH` for it (see step 3) rather than accepting the GET's older value. This is the guard against losing a recent unsynced change to a stale GET response.
3. On any change: compute new `data`, set `updatedAt = now`, `dirty: true`, write to `localStorage` and apply to UI immediately — the network is never on the critical path. Fire `PATCH /api/user/preferences` with `{data, updatedAt}`. On success, if the wrapper's `updatedAt` still equals what was just sent (no newer local edit happened while the request was in flight), mark `dirty: false`. If a newer edit happened in the meantime, leave `dirty: true` — the newest state hasn't been confirmed yet, and the next natural retry trigger covers it.
4. Retry is lightweight and best-effort, not a queue/backoff system: re-attempt the pending PATCH on the next local change, on next mount, and on the tab regaining visibility/focus. A temporary network failure never blocks gameplay and never rolls back the local value — `dirty: true` just persists in localStorage until a retry succeeds.
5. One-time migration: if `dmos.gameLayoutPreferences.v1` exists in localStorage and `dmos.personalPreferences.v1` does not, read the old key, map its 3 fields into the new schema's defaults-filled shape, write the new key with `dirty: true` (so it syncs to the server on first opportunity), leave the old key in place untouched (cheap, avoids any data-loss risk; it simply becomes dead storage).

## Campaign Settings

### Ownership consolidation

New helper in `server/routes.ts`, replacing the three divergent checks for every route this feature touches (pre-existing routes this feature doesn't touch keep their current checks unchanged — no unrelated behavior change):

```ts
type CampaignAuthority = "owner" | "player" | "none";

function getCampaignAuthority(req: Request, campaign: Campaign): CampaignAuthority {
  if (req.user?.isAdmin || req.user?.role === "dungeon_master") return "owner";
  if (req.user?.id && campaign.userId === req.user.id) return "owner";
  if (campaign.hostVisitorId === getVisitorId(req)) return "owner";
  // "player": has a character in this campaign
  const hasCharacter = storage.getCharactersByCampaign(campaign.id)
    .some(c => c.userId === req.user?.id || c.visitorId === getVisitorId(req));
  return hasCharacter ? "player" : "none";
}
```

`storage.getCharactersByCampaign(campaignId: number): Character[]` is a confirmed existing method (`server/storage.ts:618` interface, `:981` implementation) — no new storage method needed for this check.

### Validation

Existing PATCH `/api/campaigns/:id` whitelist-by-key-name becomes whitelist-by-key-and-value. Zod enum schemas built from the existing option-list constants already in `CampaignSettingsPanel.tsx` (`TONE_OPTIONS`, `COMBAT_OPTIONS`, `RULES_OPTIONS`, `POWER_OPTIONS`) plus booleans for `storyMode`/`epicMode`. Invalid value → 400, not a silent write.

### New tables

```sql
CREATE TABLE IF NOT EXISTS campaign_settings_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by_user_id INTEGER,
  source TEXT NOT NULL,              -- 'owner-direct' | 'accepted-suggestion' | 'system'
  suggestion_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_setting_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  setting_key TEXT NOT NULL,
  current_value TEXT NOT NULL,       -- snapshot at submission time, for staleness check
  proposed_value TEXT NOT NULL,
  submitted_by_user_id INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | declined | withdrawn
  owner_response TEXT,
  resolved_by_user_id INTEGER,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);
```

Plus `addColumnIfMissing("campaigns", "settings_locked", "INTEGER NOT NULL DEFAULT 0")`.

Both new tables follow the `turnLedger` precedent (append-only, `reason`/`source`/`metadata`-shaped) already established in this codebase.

### Settings Lock Semantics

`settingsLocked` (boolean) gates only the *application* of a campaign-setting value change. It never gates visibility or suggestion submission, and it can never trap the owner:

- **Locked + owner attempts a direct value change** (`PATCH /api/campaigns/:id`) → rejected (409 + message). This is the entire purpose of the lock: prevent an accidental or mid-session rule change.
- **Locked + owner accepts a suggestion** (`PATCH .../suggestions/:id` with `action: "accept"`) → also rejected. Accepting a suggestion applies a value change through the exact same validated-update code path as a direct PATCH, so it is gated by the same lock check — a suggestion is not a backdoor around the lock.
- **Locked + any player views settings** (`GET /api/campaigns/:id`, `GET .../history`) → unaffected, always allowed.
- **Locked + any player submits a suggestion** (`POST .../suggestions`) → unaffected, always allowed. Suggestions can queue up while locked; they simply can't be *accepted* until unlocked.
- **Owner declines a suggestion** → unaffected by lock (declining never applies a value change).
- **Unlocking** (`PATCH .../settings/lock` with `{locked: false}`) is its own dedicated route, authority `"owner"`, and is never itself subject to the `settingsLocked` gate — the lock only gates the *other* settings-mutation routes, not the lock route itself. This is what guarantees the owner can always unlock; there is no state where the owner is unable to reach the unlock action.
- Both locking and unlocking write a `campaign_settings_history` row (`setting_key: "settingsLocked"`, old/new boolean, `source: "owner-direct"`) — lock state changes are audited exactly like any other setting change.

### Routes

- `PATCH /api/campaigns/:id` (existing route, extended): authority must be `"owner"`; if `campaign.settingsLocked` is true, reject (409 + message) — this route never itself changes lock state (see below), so there is no "unless unlocking" exception to reason about here. On success, write a `campaign_settings_history` row per changed key (`source: "owner-direct"`) in addition to the existing `broadcastToCampaign`.
- `POST /api/campaigns/:id/settings/suggestions` — authority must be `"player"` or `"owner"`; not gated by the lock (see Settings Lock Semantics); body `{settingKey, proposedValue, reason?}`; server snapshots `currentValue` itself (never trusts a client-sent current value); inserts row.
- `GET /api/campaigns/:id/settings/suggestions` — authority `"player"` or `"owner"`; owner sees all, player sees their own (matches "players suggest, never see others' free-text reasons" — no stated requirement either way, so scope to what's simplest and safe: owner sees all, submitter sees their own).
- `PATCH /api/campaigns/:id/settings/suggestions/:suggestionId` — authority must be `"owner"`; body `{action: "accept"|"decline", ownerResponse?}`. On accept: if `campaign.settingsLocked` is true, reject (409, same as a direct change — see Settings Lock Semantics: acceptance never bypasses the lock). Otherwise, re-read the setting's current value; if it no longer matches the suggestion's stored `current_value`, mark status transition rejected and return a "stale" error instead of applying — owner must re-review, not silently overridden. On successful accept: apply via the same validated update path as the direct-PATCH route, write history with `source: "accepted-suggestion"`, `suggestion_id` set, mark suggestion `accepted`. On decline: mark `declined`, store `owner_response`, no mechanical change, not gated by the lock.
- `GET /api/campaigns/:id/settings/history` — authority `"player"` or `"owner"` (view-only for both, matching your explicit "OTHER CAMPAIGN PLAYERS — View campaign settings" requirement); not gated by the lock.
- `PATCH /api/campaigns/:id/settings/lock` — authority must be `"owner"`; body `{locked: boolean}`; **exempt from the `settingsLocked` gate by definition** — this is the route that changes that value, so it cannot be blocked by its own current state in either direction. Writes a `campaign_settings_history` row as described above.
- `GET /api/campaigns/:id` (existing route, extended): response gains a `viewerAuthority: "owner" | "player" | "none"` field, computed server-side via `getCampaignAuthority(req, campaign)` on every fetch. This is how the client learns the requesting user's authority — see Client Authority below.

All new and extended routes reuse `getCampaignAuthority`; none introduce a fourth ownership-check implementation.

### Client Authority

`getCampaignAuthority()` is a server-side authorization concept and stays exactly that — the client never reproduces or guesses ownership logic. The only thing the client does is *render from* the `viewerAuthority` field the server already includes on `GET /api/campaigns/:id` (see Routes above). `CampaignSettingsPanel`'s `isHost` prop becomes `authority === "owner"`, derived from that trusted response, not computed client-side and not passed in by a caller as a bare boolean.

This distinction matters and is enforced twice, independently: the UI hiding an owner-only control (e.g. graying out "Accept/Decline" for a non-owner) is pure convenience — it makes the app pleasant to use. The server rejecting a mutation from a non-owner via `getCampaignAuthority` on every state-changing route is the actual security boundary. A non-owner who bypasses the UI entirely and calls a mutation route directly still gets a 403 from the server check, regardless of what the client believed or displayed.

### Broadcast

Unchanged pattern, reused: every state-changing route above calls `broadcastToCampaign(campaignId, {type: "campaign_updated", campaign: updated})` on direct changes, and a new `{type: "campaign_setting_suggestion", ...}` event on suggestion create/resolve so an open Options dialog can invalidate its suggestions query live without a poll. Personal preference changes never broadcast.

## UI

- `CampaignGameHeader.tsx`: the existing disabled `StubHeaderButton icon={MoreHorizontal} label="Settings"` becomes a real enabled button, `onClick={onOpenOptions}`, mirroring how `onBack` is already threaded as a prop.
- `CampaignGameShell.tsx`: new `optionsOpen` local state (sibling to `inventoryOpen`/`codexOpen`/`overviewOpen`), passed down as `onOpenOptions={() => setOptionsOpen(true)}`. Renders a new `OptionsDialog` using the same `Dialog`/`DialogContent` primitive as `CodexOverlay`/`InventoryOverlay` — not the old inline-style pattern.
- New `client/src/components/game/OptionsDialog.tsx`: two top-level tabs, **Personal** and **Campaign**, visually distinguished (the existing `.dm-shell` parchment/leather tokens for Campaign, since it's the authoritative/mechanical side; a cleaner neutral treatment for Personal). Personal tab renders Display/Interface/Mechanical Transparency/Notifications sections reading/writing `usePersonalPreferences()`. Campaign tab embeds the resurrected `CampaignSettingsPanel` (restyled onto `Dialog` internals, `isHost` prop replaced by `authority === "owner"` sourced from the campaign query's `viewerAuthority` field — see Client Authority above) plus new Suggestions and History sub-views. Non-owner campaign fields render read-only with a "Suggest Change" action per field, opening a small inline form (current → proposed + reason) that posts to the suggestions route. All mutation buttons remain server-enforced regardless of what `authority` the client currently believes.

## Testing

- `server/campaign-settings.test.ts` (e2e style, matching `items-use-auth.test.ts`): owner can change; non-owner 403s; invalid enum value 400s; locked campaign rejects owner-direct change; **locked campaign also rejects accepting a pending suggestion**; **owner can unlock while locked, and the unlock itself is not blocked by the lock**; **lock and unlock both write a `campaign_settings_history` row**; suggestion accept applies + writes history; suggestion decline does not apply and is not gated by the lock; stale suggestion (setting changed after submission) rejected on accept; suggestion from a user with no character in the campaign rejected; cross-campaign suggestion-id tampering rejected; **`GET /api/campaigns/:id` returns the correct `viewerAuthority` for an owner, a player, and an unrelated user**.
- `server/user-preferences.test.ts`: one user's preferences invisible to/unaffected by another user's PATCH; default returned for a user with no row; invalid shape (unknown key, bad enum) rejected with 400; persistence round-trips; **`GET` after `PATCH` returns exactly the `data`/`updatedAt` that was just sent** — this documents that the server is a plain last-write-wins store keyed by the client-supplied timestamp (no server-side clock guard), which is what makes the client's staleness comparison in the Sync algorithm meaningful.
- Client: no Playwright/e2e infra exists in this repo (confirmed this session) — verification is manual local-dev-server browser testing against a seeded multi-character campaign (owner + at least one non-owner player), following the existing `node seed-script.cjs` pattern.

## Migration / Backward Compatibility

- All new tables use `CREATE TABLE IF NOT EXISTS`; `settings_locked` uses `addColumnIfMissing` with a safe default (`0`/unlocked) — existing campaigns need zero interaction.
- Existing campaigns' current field values become their settings' initial state; no reinterpretation.
- Users with no `user_preferences` row get schema defaults on first `GET`; first `PATCH` creates the row.
- `gameLayoutPreferences.ts`'s localStorage key is read once for migration into the new key, then left in place (dead, harmless) rather than deleted, avoiding any risk of data loss if migration logic has a bug.
- `ruleset` remains outside the settings-PATCH whitelist, as today — this spec does not add ruleset-change capability, consistent with "ruleset changes are not implemented, so ruleset must remain locked after campaign creation."

## Changelog Entries (to publish via the DMOS Updates mechanism after ship)

- Personal Options introduced: Display, Interface (HUD presets), Mechanical Transparency, Notifications — synced across devices for logged-in users.
- Campaign Settings: validated changes, full audit history, player suggestions with owner accept/decline, explicit settings lock.
- Note on scope: mechanical rules toggles (encumbrance, material components, etc.) are not yet implemented — campaign settings currently covers tone, combat style, rules weight, power level, story mode, and epic mode, matching what the DM AI and combat engine actually use today.
