import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldAdoptServerValue,
  migrateFromLayoutPreferences,
  parseStoredPreferences,
  DEFAULT_PREFERENCES,
} from "./personalPreferences";

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

test("shouldAdoptServerValue: server updatedAt present but data null returns false", () => {
  // Defensive case: a malformed/partial response shouldn't be treated as adoptable
  // just because updatedAt happens to be set.
  const local = { data: DEFAULT_PREFERENCES, updatedAt: "2026-08-01T00:00:00.000Z", dirty: false };
  assert.equal(shouldAdoptServerValue(local, { data: null, updatedAt: "2026-08-02T00:00:00.000Z" }), false);
});

test("migrateFromLayoutPreferences: carries the 3 old fields into the new schema shape", () => {
  const migrated = migrateFromLayoutPreferences({ preset: "reading", contextCollapsed: true, textSize: "lg" });
  assert.equal(migrated.display.layoutPreset, "reading");
  assert.equal(migrated.display.contextCollapsed, true);
  assert.equal(migrated.display.textSize, "lg");
  assert.equal(migrated.display.reducedMotion, false);
});

test("migrateFromLayoutPreferences: fills the rest of the schema with defaults", () => {
  const migrated = migrateFromLayoutPreferences({ preset: "wide", contextCollapsed: false, textSize: "sm" });
  assert.equal(migrated.version, 1);
  assert.deepEqual(migrated.interface, { hudPreset: "standard", hudOverrides: {} });
  assert.equal(migrated.mechanicalTransparency, "balanced");
  assert.deepEqual(migrated.notifications, { achievementToasts: "full" });
});

// --- parseStoredPreferences: shape validation for localStorage-sourced data ---
//
// JSON.parse only rejects a syntax error; it happily returns `{}` or any
// other syntactically-valid-but-wrong-shape object, which a bare `as`
// type-cast would then trust. These tests cover exactly that: garbage that
// parses fine as JSON but doesn't match PersonalPreferencesV1, which — if it
// reached CampaignGameShell.tsx's `LAYOUT_PRESETS[layoutPreset]` lookup
// unguarded — throws and crashes the whole game shell render.

test("parseStoredPreferences: empty object falls back to null (caller defaults)", () => {
  assert.equal(parseStoredPreferences({}), null);
});

test("parseStoredPreferences: garbage display.layoutPreset value is rejected", () => {
  const garbage = {
    ...DEFAULT_PREFERENCES,
    display: { ...DEFAULT_PREFERENCES.display, layoutPreset: "sideways" },
  };
  assert.equal(parseStoredPreferences(garbage), null);
});

test("parseStoredPreferences: syntactically-wrong-shape object (no display key) is rejected", () => {
  assert.equal(parseStoredPreferences({ foo: "bar" }), null);
});

test("parseStoredPreferences: non-object inputs (null, arrays, primitives) are rejected", () => {
  assert.equal(parseStoredPreferences(null), null);
  assert.equal(parseStoredPreferences(undefined), null);
  assert.equal(parseStoredPreferences("not an object"), null);
  assert.equal(parseStoredPreferences([1, 2, 3]), null);
});

test("parseStoredPreferences: a genuinely valid PersonalPreferencesV1 round-trips unchanged", () => {
  const valid = {
    version: 1 as const,
    display: { layoutPreset: "cinematic" as const, textSize: "lg" as const, contextCollapsed: true, reducedMotion: true },
    interface: { hudPreset: "tactical" as const, hudOverrides: { initiative: false } },
    mechanicalTransparency: "ruleslawyer" as const,
    notifications: { achievementToasts: "compact" as const },
  };
  assert.deepEqual(parseStoredPreferences(valid), valid);
});

test("parseStoredPreferences: DEFAULT_PREFERENCES itself always validates", () => {
  assert.deepEqual(parseStoredPreferences(DEFAULT_PREFERENCES), DEFAULT_PREFERENCES);
});
