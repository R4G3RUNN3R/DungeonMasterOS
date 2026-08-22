// client/src/lib/personalPreferences.ts
//
// Player-controlled personal preferences for the immersive game shell
// (design spec §7 and the in-game Options/Settings system). Supersedes
// gameLayoutPreferences.ts: broadens layout-only preferences into the
// PersonalPreferencesV1 schema (display/notifications) and adds hybrid
// local-first + server-synced persistence.
//
// Scope note: this schema intentionally covers only fields with a real
// consumer in the client (layoutPreset -> CampaignGameShell's layout grid,
// reducedMotion -> dialog.tsx's animation gating, achievementToasts ->
// campaign.tsx's achievement_unlocked toast). Text size, a collapsible
// context panel, an HUD preset system, and a mechanical-transparency dial
// were part of an earlier draft of this schema but never had a consumer
// anywhere in the client (pure dead state) and were removed per the
// whole-branch review's "no fake toggles, no unbacked controls" finding.
// Add a field back only once it has a real consumer, verified persistence,
// and tests proving the behavior works.
//
// Persistence model:
// - The source of truth for instant reads/writes is localStorage — every
//   preference change applies to local state (and the DOM classes/vars
//   consumers derive from it) synchronously, with no network round trip
//   on the interaction path.
// - A best-effort PATCH to /api/user/preferences fires after every commit
//   so the value follows the player across devices/sessions.
// - On mount, a GET reconciles local vs. server state. Whichever side has
//   the more authoritative value wins: an un-synced local edit (dirty)
//   always wins over the server, regardless of timestamps, so a change
//   made offline (or while a previous PATCH was in flight) is never
//   silently discarded by an older confirmed server row. Once local is
//   clean (not dirty), the more recently updated side wins by timestamp.
// - GET /api/user/preferences returns `{data: null, updatedAt: null}` when
//   the user has no server row yet (brand-new user, or one who never
//   opened Options) — that must never be adopted, since it isn't actually
//   a value, just the absence of one.

import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

export const PERSONAL_PREFERENCES_VERSION = 1 as const;

export type LayoutPreset = "wide" | "reading" | "cinematic";
export type NotificationStyle = "full" | "compact" | "off";

export const LAYOUT_PRESETS: Record<LayoutPreset, { hudWidthPct: number; contextWidthPct: number }> = {
  // Wide: the spec's default — a dominant story column.
  wide: { hudWidthPct: 18, contextWidthPct: 20 },
  // Reading: narrower HUD/context, more breathing room for the chronicle.
  reading: { hudWidthPct: 15, contextWidthPct: 15 },
  // Cinematic: both side columns collapse toward minimal, story nearly full width.
  cinematic: { hudWidthPct: 13, contextWidthPct: 13 },
};

export interface PersonalPreferencesV1 {
  version: 1;
  display: {
    layoutPreset: LayoutPreset;
    reducedMotion: boolean;
  };
  notifications: {
    achievementToasts: NotificationStyle;
  };
}

export const DEFAULT_PREFERENCES: PersonalPreferencesV1 = {
  version: 1,
  display: { layoutPreset: "wide", reducedMotion: false },
  notifications: { achievementToasts: "full" },
};

interface StoredPreferences {
  data: PersonalPreferencesV1;
  updatedAt: string;
  dirty: boolean;
}

const STORAGE_KEY = "dmos.personalPreferences.v1";
const OLD_LAYOUT_KEY = "dmos.gameLayoutPreferences.v1";

// Mirrors server/routes.ts's `personalPreferencesSchema` field-for-field,
// including its strictness: `.strict()` is applied at every level here
// (outer object and both nested `display`/`notifications` objects), same as
// the server copy, so an unknown key nested inside e.g. `display` is
// rejected on both sides rather than silently stripped by Zod's default
// behavior on one side and 400'd on the other. Kept as a separate
// definition rather than a shared import, since client and server code
// aren't allowed to cross that boundary. Used to validate anything read
// back out of localStorage before it reaches a consumer: JSON.parse only
// rejects syntax errors, not a syntactically-valid object with the wrong
// shape (e.g. `{}`, a partial object from a future schema bump, hand-edited
// localStorage, or another app reusing the key) — and an unvalidated
// `display.layoutPreset` in particular crashes the game shell render (see
// CampaignGameShell.tsx's `LAYOUT_PRESETS[layoutPreset]` lookup).
const layoutPresetSchema = z.enum(["wide", "reading", "cinematic"]);

const personalPreferencesV1Schema: z.ZodType<PersonalPreferencesV1> = z
  .object({
    version: z.literal(1),
    display: z
      .object({
        layoutPreset: layoutPresetSchema,
        reducedMotion: z.boolean(),
      })
      .strict(),
    notifications: z
      .object({
        achievementToasts: z.enum(["full", "compact", "off"]),
      })
      .strict(),
  })
  .strict();

/**
 * Validates a value against the PersonalPreferencesV1 shape. Returns the
 * validated data on success, or null on any mismatch — every field of the
 * return value (when non-null) is guaranteed to be one of its valid
 * enum values / correct type, so callers never need to re-check it.
 */
export function parseStoredPreferences(raw: unknown): PersonalPreferencesV1 | null {
  const result = personalPreferencesV1Schema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Carries the one still-live player-visible field (the layout preset) from
 * the old gameLayoutPreferences.ts shape into the new schema.
 * hudWidthPct/contextWidthPct are dropped — they are now derived from
 * LAYOUT_PRESETS[layoutPreset] rather than stored, so a stale pixel/pct pair
 * from an old preset table can never drift out of sync with the current
 * one. The old shape's other two fields (contextCollapsed, textSize) are
 * not carried forward: neither ever had a real consumer, and both were
 * retired from PersonalPreferencesV1 itself (see the file header).
 */
export function migrateFromLayoutPreferences(old: { preset: LayoutPreset }): PersonalPreferencesV1 {
  return {
    ...DEFAULT_PREFERENCES,
    display: {
      ...DEFAULT_PREFERENCES.display,
      layoutPreset: old.preset,
    },
  };
}

/**
 * Decides whether a freshly-fetched server preferences row should replace
 * the locally-held value.
 *
 * - No server row yet (`data`/`updatedAt` null) -> never adopt; there is
 *   nothing to adopt.
 * - Local has unsynced edits (`dirty`) -> never adopt, no matter how new
 *   the server timestamp is. A dirty local value represents a change the
 *   player made that hasn't been confirmed as saved yet; adopting the
 *   server value here would silently discard that edit.
 * - Otherwise, adopt only if the server's `updatedAt` is strictly newer
 *   than local's — i.e. another device/session/tab wrote a value after
 *   this one last synced.
 */
export function shouldAdoptServerValue(
  local: StoredPreferences,
  server: { data: PersonalPreferencesV1 | null; updatedAt: string | null },
): boolean {
  if (!server.data || !server.updatedAt) return false;
  if (local.dirty) return false;
  return new Date(server.updatedAt).getTime() > new Date(local.updatedAt).getTime();
}

function loadLocal(): StoredPreferences {
  if (typeof window === "undefined") {
    return { data: DEFAULT_PREFERENCES, updatedAt: new Date(0).toISOString(), dirty: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { data?: unknown; updatedAt?: unknown; dirty?: unknown } | null;
      const data = parseStoredPreferences(parsed?.data);
      if (data) {
        return {
          data,
          updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
          dirty: typeof parsed?.dirty === "boolean" ? parsed.dirty : false,
        };
      }
      // Syntactically valid JSON but the wrong shape (missing/garbage
      // fields) — fall through to the old-key migration / defaults below
      // rather than trusting it.
    }
  } catch {
    // Fall through to the old-key migration / defaults below.
  }
  try {
    const oldRaw = window.localStorage.getItem(OLD_LAYOUT_KEY);
    if (oldRaw) {
      const old = JSON.parse(oldRaw) as { preset?: unknown } | null;
      const preset = layoutPresetSchema.safeParse(old?.preset);
      const migrated: StoredPreferences = {
        data: migrateFromLayoutPreferences({
          preset: preset.success ? preset.data : DEFAULT_PREFERENCES.display.layoutPreset,
        }),
        updatedAt: new Date().toISOString(),
        // Marked dirty so the migrated value gets pushed to the server on
        // the next sync rather than silently sitting local-only forever.
        dirty: true,
      };
      saveLocal(migrated);
      return migrated;
    }
  } catch {
    // Corrupt/legacy data — fall through to defaults.
  }
  return { data: DEFAULT_PREFERENCES, updatedAt: new Date(0).toISOString(), dirty: false };
}

function saveLocal(stored: StoredPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage can legitimately fail (private browsing, quota) — local
    // caching is a nicety on top of the server sync, never worth
    // surfacing an error over.
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Module-level shared store
//
// usePersonalPreferences() is called independently from three separate
// React component instances (campaign.tsx, CampaignGameShell.tsx,
// OptionsDialog.tsx). A plain `useState` per call site would give each of
// those its own disconnected copy of the preferences — a change made
// through one instance (e.g. the Layout select inside OptionsDialog) would
// never be observed by another instance's own state (e.g.
// CampaignGameShell's bottom-right preset switcher, or campaign.tsx's own
// achievementToasts read), until a full remount/reload re-synced everyone
// from localStorage independently. Worse, each instance's `commit()` would
// build its update from its own possibly-stale snapshot, so one instance's
// change could silently clobber another's.
//
// The fix: one canonical `storeState` value lives at module scope (not
// inside any component), with a listener registry that
// `useSyncExternalStore` subscribes to. Every mutation — whether triggered
// from campaign.tsx, CampaignGameShell.tsx, or OptionsDialog.tsx — updates
// this single value and notifies every subscriber, so every mounted
// instance re-renders with the new value on its next tick, and every
// commit is built from the one true current value rather than a per-
// instance stale copy.
let storeState: StoredPreferences | null = null;

function getStoreState(): StoredPreferences {
  if (storeState === null) {
    storeState = loadLocal();
  }
  return storeState;
}

function setStoreState(next: StoredPreferences): void {
  storeState = next;
  for (const listener of listeners) listener();
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PersonalPreferencesV1 {
  return getStoreState().data;
}

function syncToServer(toSend: StoredPreferences): void {
  apiRequest("PATCH", "/api/user/preferences", { data: toSend.data, updatedAt: toSend.updatedAt })
    .then(() => {
      const current = getStoreState();
      if (current.updatedAt !== toSend.updatedAt) return; // a newer local edit happened mid-flight
      const confirmed = { ...current, dirty: false };
      saveLocal(confirmed);
      setStoreState(confirmed);
    })
    .catch(() => {
      // apiRequest throws on a non-ok response (see throwIfResNotOk) as
      // well as on a network failure — either way, leave dirty: true so
      // this is retried on the next natural trigger (next edit, next
      // tab-visible event, or next mount).
    });
}

// Shared by every setter, from every hook instance: reads the one canonical
// current value (never a per-instance stale copy), applies the updater,
// persists, notifies every subscriber, and fires the best-effort PATCH.
function commitStore(updater: (data: PersonalPreferencesV1) => PersonalPreferencesV1): void {
  const current = getStoreState();
  const next: StoredPreferences = { data: updater(current.data), updatedAt: new Date().toISOString(), dirty: true };
  saveLocal(next);
  setStoreState(next);
  syncToServer(next);
}

// The mount-time GET-reconciliation and the visibilitychange flush listener
// are both side effects on the *shared* store, not on any one component —
// they must run exactly once per page session (not once per mounted hook
// instance, which would fire N redundant network requests / N duplicate
// listeners for N simultaneously-mounted instances). This guard makes
// starting them idempotent; the hook calls it from a `useEffect` on every
// mount, but only the first caller across the whole page session actually
// does anything.
let globalEffectsStarted = false;

function startGlobalEffectsOnce(): void {
  if (globalEffectsStarted) return;
  if (typeof window === "undefined") return;
  globalEffectsStarted = true;

  // Reconcile against the server's current value.
  apiRequest("GET", "/api/user/preferences")
    .then((r) => r.json())
    .then((server: { data: PersonalPreferencesV1 | null; updatedAt: string | null }) => {
      const local = getStoreState();
      if (shouldAdoptServerValue(local, server)) {
        const adopted: StoredPreferences = {
          data: server.data as PersonalPreferencesV1,
          updatedAt: server.updatedAt as string,
          dirty: false,
        };
        saveLocal(adopted);
        setStoreState(adopted);
      } else if (local.dirty) {
        syncToServer(local);
      }
    })
    .catch(() => {
      // Offline or the endpoint is unavailable — local value stands.
    });

  // Flush a dirty local value whenever the tab regains visibility (covers
  // the case where a PATCH failed while the tab/laptop was backgrounded).
  document.addEventListener("visibilitychange", () => {
    const current = getStoreState();
    if (document.visibilityState === "visible" && current.dirty) syncToServer(current);
  });
}

/**
 * Resets the shared preferences store back to a fresh, un-reconciled state
 * and clears the "global effects already started" guard, so the next
 * usePersonalPreferences() mount re-runs the GET reconciliation against
 * whichever user is now authenticated.
 *
 * `storeState` and `globalEffectsStarted` are module-scoped (see "Module-
 * level shared store" above), which makes them scoped to the page session,
 * not to any one authenticated user. This app changes identity via
 * client-side navigation with no full page reload (logout, login, signup),
 * so without this reset, a second user logging in on the same page load
 * would silently inherit the first user's cached local preferences —
 * because `startGlobalEffectsOnce()` already ran and permanently no-ops —
 * and the second user's next edit would PATCH that first-user-derived
 * value onto their own server row, clobbering whatever they'd actually
 * saved. Call this at every point the app's authenticated identity changes
 * without a full page reload — logout, login, and signup — so one user's
 * cached preferences can never leak into or be silently overwritten by
 * another user's session.
 *
 * Does NOT clear localStorage (that's user-agnostic device state and
 * doesn't need clearing) — only the in-memory module state that was scoped
 * to the previous identity. The next mount's GET reconciliation will
 * correctly resolve local-vs-server for whichever user is now logged in.
 */
export function resetPreferencesForNewIdentity(): void {
  storeState = loadLocal();
  globalEffectsStarted = false;
  for (const listener of listeners) listener();
}

export function usePersonalPreferences() {
  // Idempotent (see startGlobalEffectsOnce's guard) — safe to call from
  // every mounted instance's effect; only the first one across the page
  // session actually does anything.
  useEffect(() => {
    startGlobalEffectsOnce();
  }, []);

  const preferences = useSyncExternalStore(subscribe, getSnapshot);

  // Reflect reducedMotion onto the document root as a data attribute so any
  // shared UI primitive (see dialog.tsx's DialogOverlay/DialogContent) can
  // gate its animation classes on it without needing its own preferences
  // read. This is a side effect on a value already sourced from the shared
  // store, not a second source of truth: it runs on every render where the
  // value changed, on every component that calls this hook — a no-op keeps
  // that safe (setAttribute/removeAttribute are idempotent).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (preferences.display.reducedMotion) {
      document.documentElement.setAttribute("data-reduced-motion", "true");
    } else {
      document.documentElement.removeAttribute("data-reduced-motion");
    }
  }, [preferences.display.reducedMotion]);

  return {
    preferences,
    setLayoutPreset: (preset: LayoutPreset) =>
      commitStore((d) => ({ ...d, display: { ...d.display, layoutPreset: preset } })),
    setReducedMotion: (on: boolean) => commitStore((d) => ({ ...d, display: { ...d.display, reducedMotion: on } })),
    setAchievementToastStyle: (v: NotificationStyle) =>
      commitStore((d) => ({ ...d, notifications: { achievementToasts: v } })),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Test-only access to the shared store's underlying data layer.
//
// The store logic above (getStoreState/setStoreState/subscribe/commitStore)
// is intentionally independent of useSyncExternalStore/React rendering —
// that's what makes it possible to prove cross-instance synchronization
// works in a plain node:test file with no DOM/React-rendering harness.
// These exports are for personalPreferences.test.ts only; no application
// code should import them.
export const __testing__ = {
  getSnapshot: (): PersonalPreferencesV1 => getStoreState().data,
  getStoreState: (): StoredPreferences => getStoreState(),
  commit: commitStore,
  subscribe,
  /** Resets the shared store to a known state for test isolation, without
   * touching `globalEffectsStarted` (tests that don't call the React hook
   * never trigger the real GET-reconciliation network call in the first
   * place, so there's nothing to guard against here). */
  reset: (state?: StoredPreferences): void => {
    storeState = state ?? { data: DEFAULT_PREFERENCES, updatedAt: new Date(0).toISOString(), dirty: false };
  },
};
