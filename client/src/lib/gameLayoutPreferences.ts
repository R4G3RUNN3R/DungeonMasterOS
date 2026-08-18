// client/src/lib/gameLayoutPreferences.ts
//
// Player-controlled layout preferences for the immersive game shell
// (design spec §7). Persisted as relative proportions/presets, never raw
// pixel widths, so they stay sane across different screens.
//
// Phase 1 foundation only: preferences persist to localStorage. The spec
// asks for server-backed sync "for authenticated users" as a later step —
// this module is deliberately shaped so that swap is additive (replace
// load/save below with an API-backed pair; the hook's public shape doesn't
// need to change) rather than a rewrite.

import { useCallback, useEffect, useState } from "react";

export type LayoutPreset = "wide" | "reading" | "cinematic";
export type TextSize = "sm" | "md" | "lg";

export interface GameLayoutPreferences {
  preset: LayoutPreset;
  hudWidthPct: number;
  contextWidthPct: number;
  contextCollapsed: boolean;
  textSize: TextSize;
}

export const LAYOUT_PRESETS: Record<LayoutPreset, Pick<GameLayoutPreferences, "hudWidthPct" | "contextWidthPct">> = {
  // Wide: the spec's default — a dominant story column.
  wide: { hudWidthPct: 18, contextWidthPct: 20 },
  // Reading: narrower HUD/context, more breathing room for the chronicle.
  reading: { hudWidthPct: 15, contextWidthPct: 15 },
  // Cinematic: both side columns collapse toward minimal, story nearly full width.
  cinematic: { hudWidthPct: 13, contextWidthPct: 13 },
};

const DEFAULTS: GameLayoutPreferences = {
  preset: "wide",
  ...LAYOUT_PRESETS.wide,
  contextCollapsed: false,
  textSize: "md",
};

const STORAGE_KEY = "dmos.gameLayoutPreferences.v1";

function isPreset(value: unknown): value is LayoutPreset {
  return value === "wide" || value === "reading" || value === "cinematic";
}

function isTextSize(value: unknown): value is TextSize {
  return value === "sm" || value === "md" || value === "lg";
}

function loadPreferences(): GameLayoutPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      preset: isPreset(parsed.preset) ? parsed.preset : DEFAULTS.preset,
      hudWidthPct: typeof parsed.hudWidthPct === "number" ? parsed.hudWidthPct : DEFAULTS.hudWidthPct,
      contextWidthPct: typeof parsed.contextWidthPct === "number" ? parsed.contextWidthPct : DEFAULTS.contextWidthPct,
      contextCollapsed: typeof parsed.contextCollapsed === "boolean" ? parsed.contextCollapsed : DEFAULTS.contextCollapsed,
      textSize: isTextSize(parsed.textSize) ? parsed.textSize : DEFAULTS.textSize,
    };
  } catch {
    return DEFAULTS;
  }
}

function savePreferences(prefs: GameLayoutPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can legitimately fail (private browsing, quota) — layout
    // preferences are a nicety, never worth surfacing an error over.
  }
}

export function useGameLayoutPreferences() {
  const [preferences, setPreferences] = useState<GameLayoutPreferences>(() => loadPreferences());

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const setPreset = useCallback((preset: LayoutPreset) => {
    setPreferences((prev) => ({ ...prev, preset, ...LAYOUT_PRESETS[preset] }));
  }, []);

  const setTextSize = useCallback((textSize: TextSize) => {
    setPreferences((prev) => ({ ...prev, textSize }));
  }, []);

  const toggleContextCollapsed = useCallback(() => {
    setPreferences((prev) => ({ ...prev, contextCollapsed: !prev.contextCollapsed }));
  }, []);

  return { preferences, setPreset, setTextSize, toggleContextCollapsed };
}
