import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldAdoptServerValue,
  migrateFromLayoutPreferences,
  parseStoredPreferences,
  resetPreferencesForNewIdentity,
  DEFAULT_PREFERENCES,
  __testing__,
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

test("migrateFromLayoutPreferences: carries the old layout preset into the new schema shape", () => {
  const migrated = migrateFromLayoutPreferences({ preset: "reading" });
  assert.equal(migrated.display.layoutPreset, "reading");
  assert.equal(migrated.display.reducedMotion, false);
});

test("migrateFromLayoutPreferences: fills the rest of the schema with defaults", () => {
  const migrated = migrateFromLayoutPreferences({ preset: "wide" });
  assert.equal(migrated.version, 1);
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
    display: { layoutPreset: "cinematic" as const, reducedMotion: true },
    notifications: { achievementToasts: "compact" as const },
  };
  assert.deepEqual(parseStoredPreferences(valid), valid);
});

test("parseStoredPreferences: DEFAULT_PREFERENCES itself always validates", () => {
  assert.deepEqual(parseStoredPreferences(DEFAULT_PREFERENCES), DEFAULT_PREFERENCES);
});

// --- shared module-level store: proves cross-instance synchronization ---
//
// usePersonalPreferences() is called from three independent React component
// instances (campaign.tsx, CampaignGameShell.tsx, OptionsDialog.tsx). Before
// the fix, each call site owned its own `useState`, so a change committed
// through one instance was invisible to the others until a full remount.
// The fix moves the mutable state to a module-level store that every hook
// instance reads via useSyncExternalStore and writes via a shared commit
// function.
//
// There's no DOM/React-rendering harness in this node:test file, so this
// can't literally mount two <OptionsDialog> and <CampaignGameShell>
// instances side by side. Instead it exercises the underlying data layer
// directly via the `__testing__` export — two independent "handles" reading
// and subscribing to the exact same module-level `storeState`, with no
// useSyncExternalStore/React involved at all. This is the layer that
// actually holds the shared value; useSyncExternalStore is just a thin
// React-rendering adapter on top of it (subscribe/getSnapshot), so proving
// synchronization here proves the real fix.

test("shared store: a commit from one handle is visible via an independent handle reading the same state", () => {
  __testing__.reset();

  // "handle A" and "handle B" are just two independent reads of the module-
  // level store — standing in for two separate mounted hook instances, e.g.
  // OptionsDialog's Layout Select vs. CampaignGameShell's own preset
  // switcher, each reading `usePersonalPreferences().preferences` in its
  // own component.
  const handleABefore = __testing__.getSnapshot();
  assert.equal(handleABefore.display.layoutPreset, "wide", "starts at the default layout preset");

  // Commit through what stands in for OptionsDialog's setLayoutPreset call.
  __testing__.commit((d) => ({ ...d, display: { ...d.display, layoutPreset: "cinematic" } }));

  // A completely independent read (standing in for CampaignGameShell's own
  // hook instance, which never called commit itself) sees the change.
  const handleBAfter = __testing__.getSnapshot();
  assert.equal(
    handleBAfter.display.layoutPreset,
    "cinematic",
    "an independent handle must observe the change committed via another handle",
  );
});

test("shared store: a commit built from the current canonical value never clobbers a prior commit from another handle", () => {
  __testing__.reset();

  // Two commits in a row, each modifying a *different* field, standing in
  // for two different mounted instances each changing their own setting —
  // e.g. OptionsDialog toggling Reduced Motion while CampaignGameShell's
  // preset switcher had just changed the layout. Because commitStore always
  // reads the current canonical state (not a per-instance stale snapshot),
  // the second commit must not undo the first.
  __testing__.commit((d) => ({ ...d, display: { ...d.display, layoutPreset: "reading" } }));
  __testing__.commit((d) => ({ ...d, display: { ...d.display, reducedMotion: true } }));

  const finalState = __testing__.getSnapshot();
  assert.equal(finalState.display.layoutPreset, "reading", "the first commit's change must survive the second commit");
  assert.equal(finalState.display.reducedMotion, true, "the second commit's change must also be present");
});

test("shared store: every subscriber is notified after a commit from any handle (the useSyncExternalStore re-render trigger)", () => {
  __testing__.reset();

  // Register two listeners, standing in for the re-render callbacks
  // useSyncExternalStore would register from two separate mounted hook
  // instances.
  let instanceAnotified = 0;
  let instanceBnotified = 0;
  const unsubA = __testing__.subscribe(() => {
    instanceAnotified++;
  });
  const unsubB = __testing__.subscribe(() => {
    instanceBnotified++;
  });

  // A commit triggered by a third instance (e.g. OptionsDialog) must notify
  // both, not just the instance that called the setter.
  __testing__.commit((d) => ({ ...d, notifications: { achievementToasts: "off" } }));

  assert.equal(instanceAnotified, 1, "every subscribed instance must be notified, not just the committing one");
  assert.equal(instanceBnotified, 1, "every subscribed instance must be notified, not just the committing one");

  unsubA();
  unsubB();
});

test("shared store: an unsubscribed listener is no longer notified", () => {
  __testing__.reset();

  let notified = 0;
  const unsub = __testing__.subscribe(() => {
    notified++;
  });
  unsub();

  __testing__.commit((d) => ({ ...d, display: { ...d.display, reducedMotion: true } }));

  assert.equal(notified, 0, "an unsubscribed listener must not fire on a later commit");
});

// --- resetPreferencesForNewIdentity: the identity-change regression fix ---
//
// storeState and globalEffectsStarted are module-scoped, not user-scoped.
// This app changes authenticated identity via client-side navigation with
// no full page reload (logout/login/signup), so without a reset at those
// transitions, a second user logging in on the same page load would
// silently inherit the first user's cached local preferences (and their
// next edit would PATCH that stale, first-user-derived value onto their
// own server row). resetPreferencesForNewIdentity() is called at all three
// identity-transition points (dashboard.tsx's logout onSuccess/onError,
// auth.tsx's login and signup onSuccess) to close that gap.
//
// This test calls the real exported function directly rather than a
// test-only wrapper: resetPreferencesForNewIdentity() calls loadLocal(),
// whose very first check is `typeof window === "undefined"`, which is true
// in this plain node:test environment (no jsdom/DOM shim here) — so it
// deterministically falls back to DEFAULT_PREFERENCES, the same as
// __testing__.reset()'s own default. That makes the real export safe and
// meaningful to exercise directly here.
test("resetPreferencesForNewIdentity: returns the store to defaults and notifies every subscriber", () => {
  __testing__.reset();

  // Simulate a prior user's session having drifted the store away from
  // defaults before the identity changes (e.g. user A customized their
  // layout, then logged out).
  __testing__.commit((d) => ({
    ...d,
    display: { ...d.display, layoutPreset: "cinematic", reducedMotion: true },
    notifications: { achievementToasts: "off" },
  }));
  assert.notDeepEqual(
    __testing__.getSnapshot(),
    DEFAULT_PREFERENCES,
    "sanity check: the prior commit actually moved the store away from defaults",
  );

  // Register subscribers, standing in for mounted hook instances' re-render
  // callbacks (e.g. CampaignGameShell, OptionsDialog) that must be told the
  // store just changed.
  let instanceAnotified = 0;
  let instanceBnotified = 0;
  const unsubA = __testing__.subscribe(() => {
    instanceAnotified++;
  });
  const unsubB = __testing__.subscribe(() => {
    instanceBnotified++;
  });

  resetPreferencesForNewIdentity();

  assert.deepEqual(
    __testing__.getSnapshot(),
    DEFAULT_PREFERENCES,
    "the store must return to a clean default state so the next mount's GET reconciles against the new identity, not the old one's cached value",
  );
  assert.equal(instanceAnotified, 1, "every subscribed instance must be notified of the reset");
  assert.equal(instanceBnotified, 1, "every subscribed instance must be notified of the reset");

  unsubA();
  unsubB();
});
