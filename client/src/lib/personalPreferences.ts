// client/src/lib/personalPreferences.ts
//
// Player-controlled personal preferences for the immersive game shell
// (design spec §7 and the in-game Options/Settings system). Supersedes
// gameLayoutPreferences.ts: broadens layout-only preferences into the full
// PersonalPreferencesV1 schema (display/interface/mechanicalTransparency/
// notifications) and adds hybrid local-first + server-synced persistence.
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

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

export const PERSONAL_PREFERENCES_VERSION = 1 as const;

export type LayoutPreset = "wide" | "reading" | "cinematic";
export type TextSize = "sm" | "md" | "lg";
export type HudPreset = "minimal" | "standard" | "tactical" | "immersive" | "custom";
export type MechanicalTransparency = "narrative" | "balanced" | "ruleslawyer";
export type NotificationStyle = "full" | "compact" | "off";

export const LAYOUT_PRESETS: Record<LayoutPreset, { hudWidthPct: number; contextWidthPct: number }> = {
  // Wide: the spec's default — a dominant story column.
  wide: { hudWidthPct: 18, contextWidthPct: 20 },
  // Reading: narrower HUD/context, more breathing room for the chronicle.
  reading: { hudWidthPct: 15, contextWidthPct: 15 },
  // Cinematic: both side columns collapse toward minimal, story nearly full width.
  cinematic: { hudWidthPct: 13, contextWidthPct: 13 },
};

export interface HudFieldOverrides {
  [fieldKey: string]: boolean | undefined;
}

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

// Mirrors server/routes.ts's `personalPreferencesSchema` field-for-field
// (kept as a separate definition rather than a shared import, since client
// and server code aren't allowed to cross that boundary). Used to validate
// anything read back out of localStorage before it reaches a consumer:
// JSON.parse only rejects syntax errors, not a syntactically-valid object
// with the wrong shape (e.g. `{}`, a partial object from a future schema
// bump, hand-edited localStorage, or another app reusing the key) — and an
// unvalidated `display.layoutPreset` in particular crashes the game shell
// render (see CampaignGameShell.tsx's `LAYOUT_PRESETS[layoutPreset]` lookup).
const layoutPresetSchema = z.enum(["wide", "reading", "cinematic"]);
const textSizeSchema = z.enum(["sm", "md", "lg"]);

const personalPreferencesV1Schema: z.ZodType<PersonalPreferencesV1> = z.object({
  version: z.literal(1),
  display: z.object({
    layoutPreset: layoutPresetSchema,
    textSize: textSizeSchema,
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
});

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
 * Carries the 3 player-visible fields from the old gameLayoutPreferences.ts
 * shape into the new schema. hudWidthPct/contextWidthPct are dropped — they
 * are now derived from LAYOUT_PRESETS[layoutPreset] rather than stored, so
 * a stale pixel/pct pair from an old preset table can never drift out of
 * sync with the current one.
 */
export function migrateFromLayoutPreferences(old: {
  preset: LayoutPreset;
  contextCollapsed: boolean;
  textSize: TextSize;
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
      const old = JSON.parse(oldRaw) as { preset?: unknown; contextCollapsed?: unknown; textSize?: unknown } | null;
      const preset = layoutPresetSchema.safeParse(old?.preset);
      const textSize = textSizeSchema.safeParse(old?.textSize);
      const migrated: StoredPreferences = {
        data: migrateFromLayoutPreferences({
          preset: preset.success ? preset.data : DEFAULT_PREFERENCES.display.layoutPreset,
          contextCollapsed:
            typeof old?.contextCollapsed === "boolean"
              ? old.contextCollapsed
              : DEFAULT_PREFERENCES.display.contextCollapsed,
          textSize: textSize.success ? textSize.data : DEFAULT_PREFERENCES.display.textSize,
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

export function usePersonalPreferences() {
  const [stored, setStored] = useState<StoredPreferences>(() => loadLocal());

  const syncToServer = useCallback((toSend: StoredPreferences) => {
    fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: toSend.data, updatedAt: toSend.updatedAt }),
    })
      .then((res) => {
        if (!res.ok) return;
        setStored((current) => {
          if (current.updatedAt !== toSend.updatedAt) return current; // a newer local edit happened mid-flight
          const confirmed = { ...current, dirty: false };
          saveLocal(confirmed);
          return confirmed;
        });
      })
      .catch(() => {
        // Leave dirty: true — retried on the next natural trigger (next
        // edit, next tab-visible event, or next mount).
      });
  }, []);

  // On mount: reconcile against the server's current value.
  useEffect(() => {
    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((server: { data: PersonalPreferencesV1 | null; updatedAt: string | null }) => {
        setStored((local) => {
          if (shouldAdoptServerValue(local, server)) {
            const adopted: StoredPreferences = { data: server.data as PersonalPreferencesV1, updatedAt: server.updatedAt as string, dirty: false };
            saveLocal(adopted);
            return adopted;
          }
          if (local.dirty) syncToServer(local);
          return local;
        });
      })
      .catch(() => {
        // Offline or the endpoint is unavailable — local value stands.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush a dirty local value whenever the tab regains visibility (covers
  // the case where a PATCH failed while the tab/laptop was backgrounded).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && stored.dirty) syncToServer(stored);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [stored, syncToServer]);

  const commit = useCallback(
    (updater: (data: PersonalPreferencesV1) => PersonalPreferencesV1) => {
      setStored((current) => {
        const next: StoredPreferences = { data: updater(current.data), updatedAt: new Date().toISOString(), dirty: true };
        saveLocal(next);
        syncToServer(next);
        return next;
      });
    },
    [syncToServer],
  );

  return {
    preferences: stored.data,
    setLayoutPreset: (preset: LayoutPreset) =>
      commit((d) => ({ ...d, display: { ...d.display, layoutPreset: preset } })),
    setTextSize: (size: TextSize) => commit((d) => ({ ...d, display: { ...d.display, textSize: size } })),
    toggleContextCollapsed: () =>
      commit((d) => ({ ...d, display: { ...d.display, contextCollapsed: !d.display.contextCollapsed } })),
    setReducedMotion: (on: boolean) => commit((d) => ({ ...d, display: { ...d.display, reducedMotion: on } })),
    setHudPreset: (preset: HudPreset) =>
      commit((d) => ({ ...d, interface: { ...d.interface, hudPreset: preset, hudOverrides: {} } })),
    setHudOverride: (field: string, value: boolean) =>
      commit((d) => ({
        ...d,
        interface: { hudPreset: "custom", hudOverrides: { ...d.interface.hudOverrides, [field]: value } },
      })),
    setMechanicalTransparency: (v: MechanicalTransparency) => commit((d) => ({ ...d, mechanicalTransparency: v })),
    setAchievementToastStyle: (v: NotificationStyle) => commit((d) => ({ ...d, notifications: { achievementToasts: v } })),
  };
}
