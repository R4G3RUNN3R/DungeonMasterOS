# In-Game Options / Settings System — Design Spec

## Overview

Two independent, never-conflated settings domains:

- **Personal Options** — belongs to the user. Presentation-only. Never affects campaign mechanics or other players. Hybrid local-first + server-synced.
- **Campaign Settings** — belongs to the campaign. Owner-controlled, server-authoritative, ruleset-namespaced, auditable. Players may view and suggest; only the owner (or an accepted suggestion) changes a value.

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
| Ruleset-specific mechanical Rules toggles (encumbrance, ammo tracking, material components, spell-prep strictness, crafting cost/XP, death/dying detail, resurrection rules) | None of these have server enforcement today — confirmed absent from `shared/schema.ts`, `server/routes.ts`, and `server/combat-engine.ts` | a reserved, currently-empty `rulesetSettings?: Record<string, unknown>` field on the campaign settings type (see below) — populated the day a real mechanic exists to back a toggle |
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

- `GET /api/user/preferences` → returns stored row parsed, or `{version: 1, ...defaults}` if no row exists yet (no migration needed for existing users — absence is a valid state).
- `PATCH /api/user/preferences` → validates the full incoming object against a Zod schema mirroring `PersonalPreferencesV1` (reject unknown top-level keys, reject invalid enum values), upserts the row, returns the stored value.

No WebSocket broadcast — personal settings changes are never campaign-wide events, per your explicit requirement.

### Sync algorithm (client)

1. On mount: read `localStorage` synchronously (key `dmos.personalPreferences.v1`), render immediately with that value (or defaults).
2. Fire `GET /api/user/preferences` in the background. On response, if the server value differs from local, server value wins; update local state and localStorage.
3. On any change: apply to local state + localStorage immediately (UI never waits on the network). Fire `PATCH /api/user/preferences` with the full updated object. On failure, log and leave local state as the source of truth until the next successful sync — never block or roll back the UI change.
4. One-time migration: if `dmos.gameLayoutPreferences.v1` exists in localStorage and `dmos.personalPreferences.v1` does not, read the old key, map its 3 fields into the new schema's defaults-filled shape, write the new key, leave the old key in place untouched (cheap, avoids any data-loss risk; it simply becomes dead storage).

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

### Routes

- `PATCH /api/campaigns/:id` (existing route, extended): authority must be `"owner"`; if `settingsLocked` is true, reject with 423-equivalent (409 + message, matching existing error-shape conventions) unless the request is specifically unlocking; on success, write a `campaign_settings_history` row per changed key (`source: "owner-direct"`) in addition to the existing `broadcastToCampaign`.
- `POST /api/campaigns/:id/settings/suggestions` — authority must be `"player"` or `"owner"`; body `{settingKey, proposedValue, reason?}`; server snapshots `currentValue` itself (never trusts a client-sent current value); inserts row.
- `GET /api/campaigns/:id/settings/suggestions` — authority `"player"` or `"owner"`; owner sees all, player sees their own (matches "players suggest, never see others' free-text reasons" — no stated requirement either way, so scope to what's simplest and safe: owner sees all, submitter sees their own).
- `PATCH /api/campaigns/:id/settings/suggestions/:suggestionId` — authority must be `"owner"`; body `{action: "accept"|"decline", ownerResponse?}`. On accept: re-read the setting's current value; if it no longer matches the suggestion's stored `current_value`, mark status transition rejected and return a "stale" error instead of applying — owner must re-review, not silently overridden. On successful accept: apply via the same validated update path as the direct-PATCH route, write history with `source: "accepted-suggestion"`, `suggestion_id` set, mark suggestion `accepted`. On decline: mark `declined`, store `owner_response`, no mechanical change.
- `GET /api/campaigns/:id/settings/history` — authority `"player"` or `"owner"` (view-only for both, matching your explicit "OTHER CAMPAIGN PLAYERS — View campaign settings" requirement).
- `PATCH /api/campaigns/:id/settings/lock` — authority must be `"owner"`; body `{locked: boolean}`.

All new routes reuse `getCampaignAuthority`; none introduce a fourth ownership-check implementation.

### Broadcast

Unchanged pattern, reused: every state-changing route above calls `broadcastToCampaign(campaignId, {type: "campaign_updated", campaign: updated})` on direct changes, and a new `{type: "campaign_setting_suggestion", ...}` event on suggestion create/resolve so an open Options dialog can invalidate its suggestions query live without a poll. Personal preference changes never broadcast.

## UI

- `CampaignGameHeader.tsx`: the existing disabled `StubHeaderButton icon={MoreHorizontal} label="Settings"` becomes a real enabled button, `onClick={onOpenOptions}`, mirroring how `onBack` is already threaded as a prop.
- `CampaignGameShell.tsx`: new `optionsOpen` local state (sibling to `inventoryOpen`/`codexOpen`/`overviewOpen`), passed down as `onOpenOptions={() => setOptionsOpen(true)}`. Renders a new `OptionsDialog` using the same `Dialog`/`DialogContent` primitive as `CodexOverlay`/`InventoryOverlay` — not the old inline-style pattern.
- New `client/src/components/game/OptionsDialog.tsx`: two top-level tabs, **Personal** and **Campaign**, visually distinguished (the existing `.dm-shell` parchment/leather tokens for Campaign, since it's the authoritative/mechanical side; a cleaner neutral treatment for Personal). Personal tab renders Display/Interface/Mechanical Transparency/Notifications sections reading/writing `usePersonalPreferences()`. Campaign tab embeds the resurrected `CampaignSettingsPanel` (restyled onto `Dialog` internals, `isHost` now computed from a real `authority` value fetched/derived client-side rather than trusted as a caller-supplied prop) plus new Suggestions and History sub-views. Non-owner campaign fields render read-only with a "Suggest Change" action per field, opening a small inline form (current → proposed + reason) that posts to the suggestions route.

## Testing

- `server/campaign-settings.test.ts` (e2e style, matching `items-use-auth.test.ts`): owner can change; non-owner 403s; invalid enum value 400s; locked campaign rejects owner-direct change; suggestion accept applies + writes history; suggestion decline does not apply; stale suggestion (setting changed after submission) rejected on accept; suggestion from a user with no character in the campaign rejected; cross-campaign suggestion-id tampering rejected.
- `server/user-preferences.test.ts`: one user's preferences invisible to/unaffected by another user's PATCH; default returned for a user with no row; invalid shape (unknown key, bad enum) rejected with 400; persistence round-trips.
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
