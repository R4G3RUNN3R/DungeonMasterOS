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
