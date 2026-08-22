// server/campaign-settings.test.ts
//
// Foundation tests for Task 1 of the Options/Settings feature: the new
// campaign_settings_history / campaign_setting_suggestions / user_preferences
// tables, their storage CRUD, and the consolidated getCampaignAuthority()
// ownership check that later tasks' routes will reuse.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-campaign-settings-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "campaign-settings-test-secret";
process.env.ANTHROPIC_API_KEY = "campaign-settings-test";

const { storage, runMigrations } = await import("./storage");
runMigrations();

const { signToken } = await import("./auth");
const { registerRoutes, getCampaignAuthority } = await import("./routes");

let httpServer: ReturnType<typeof createServer>;
let base: string;

before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address !== "object") throw new Error("failed to bind test server");
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(dbPath + suffix);
    } catch {
      // ignore
    }
  }
});

let fixtureCounter = 0;
function makeFixture() {
  const unique = `${Date.now()}-${fixtureCounter++}`;
  const owner = storage.createUser({
    email: `owner-${unique}@test.dev`,
    username: `owner${unique}`,
    passwordHash: "x",
  } as any);
  const player = storage.createUser({
    email: `player-${unique}@test.dev`,
    username: `player${unique}`,
    passwordHash: "x",
  } as any);
  const outsider = storage.createUser({
    email: `outsider-${unique}@test.dev`,
    username: `outsider${unique}`,
    passwordHash: "x",
  } as any);
  const campaign = storage.createCampaign({
    name: `Campaign ${unique}`,
    inviteCode: `inv-${unique}`,
    hostVisitorId: `user-${owner.id}`,
    userId: owner.id,
  } as any);
  storage.createCharacter({
    campaignId: campaign.id,
    userId: player.id,
    visitorId: `user-${player.id}`,
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

test("getCampaignAuthority: role dungeon_master grants owner on a campaign the user doesn't otherwise own", () => {
  const { campaign } = makeFixture();
  const unique = `${Date.now()}-${fixtureCounter++}`;
  const dm = storage.createUser({
    email: `dm-${unique}@test.dev`,
    username: `dm${unique}`,
    passwordHash: "x",
    role: "dungeon_master",
  } as any);
  const req: any = { user: { id: dm.id, role: "dungeon_master" }, headers: {} };
  assert.equal(getCampaignAuthority(req, campaign as any), "owner");
});

test("getCampaignAuthority: a campaign hosted only by hostVisitorId (anonymous host) resolves to owner via the matching x-visitor-id header", () => {
  const unique = `${Date.now()}-${fixtureCounter++}`;
  // getVisitorId() only derives a "user-<id>" identity from an authenticated
  // req.user; for an anonymous host it falls back to the caller-supplied
  // x-visitor-id header verbatim (as long as it doesn't itself look like a
  // "user-" identity, which is rejected to prevent impersonation) — so a
  // hostVisitorId set to an arbitrary anon token is matched by replaying
  // that same token back in the header, with no req.user at all.
  const hostVisitorId = `anon-${unique}`;
  const campaign = storage.createCampaign({
    name: `Anon-hosted Campaign ${unique}`,
    inviteCode: `inv-${unique}`,
    hostVisitorId,
  } as any);
  const req: any = { user: undefined, headers: { "x-visitor-id": hostVisitorId } };
  assert.equal(getCampaignAuthority(req, campaign as any), "owner");
});

test("storage: campaign settings history round-trips", () => {
  const { owner, campaign } = makeFixture();
  storage.createCampaignSettingsHistory({
    campaignId: campaign.id,
    settingKey: "tone",
    oldValue: "heroic",
    newValue: "dark",
    changedByUserId: owner.id,
    source: "owner-direct",
  });
  const rows = storage.getCampaignSettingsHistory(campaign.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].newValue, "dark");
});

test("storage: campaign setting suggestion round-trips", () => {
  const { player, campaign } = makeFixture();
  const row = storage.createCampaignSettingSuggestion({
    campaignId: campaign.id,
    settingKey: "tone",
    currentValue: "heroic",
    proposedValue: "dark",
    submittedByUserId: player.id,
    reason: "too cheerful",
  });
  assert.equal(row.status, "pending");
  const fetched = storage.getCampaignSettingSuggestion(row.id);
  assert.equal(fetched?.proposedValue, "dark");
});

test("smoke: server still registers routes and serves an authenticated request after the schema/storage additions", async () => {
  const { owner, campaign } = makeFixture();
  const token = signToken(owner.id);

  const res = await fetch(`${base}/api/campaigns/${campaign.id}/archive`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie: `dmos_session=${token}`,
    },
    body: JSON.stringify({ archive: true }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.isArchived, true);
});

test("PATCH /api/campaigns/:id: owner can change a valid setting and it is audited", async () => {
  const { owner, campaign } = makeFixture();
  const token = signToken(owner.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `dmos_session=${token}` },
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
  const res = await fetch(`${base}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ tone: "dark" }),
  });
  assert.equal(res.status, 403);
});

test("PATCH /api/campaigns/:id: invalid enum value is rejected, not written", async () => {
  const { owner, campaign } = makeFixture();
  const token = signToken(owner.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `dmos_session=${token}` },
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
  const res = await fetch(`${base}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ tone: "dark" }),
  });
  assert.equal(res.status, 409);
});

test("PATCH /api/campaigns/:id/settings/lock: owner can lock and unlock; unlock is not blocked by the lock", async () => {
  const { owner, campaign } = makeFixture();
  const token = signToken(owner.id);

  const lockRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/lock`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ locked: true }),
  });
  assert.equal(lockRes.status, 200);
  assert.equal((await lockRes.json() as any).settingsLocked, true);

  const unlockRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/lock`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ locked: false }),
  });
  assert.equal(unlockRes.status, 200, "owner must always be able to unlock even while locked");
  assert.equal((await unlockRes.json() as any).settingsLocked, false);

  const history = storage.getCampaignSettingsHistory(campaign.id);
  const lockEvents = history.filter((h) => h.settingKey === "settingsLocked");
  assert.equal(lockEvents.length, 2, "both lock and unlock must be audited");
});

test("PATCH /api/campaigns/:id/settings/lock: non-owner is rejected", async () => {
  const { player, campaign } = makeFixture();
  const token = signToken(player.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/settings/lock`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ locked: true }),
  });
  assert.equal(res.status, 403);
});

test("suggestions: player can submit, owner sees it, player sees own only", async () => {
  const { owner, player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const submitRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark", reason: "too cheerful" }),
  });
  assert.equal(submitRes.status, 201);

  const ownerToken = signToken(owner.id);
  const ownerList = await (
    await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
      headers: { cookie: `dmos_session=${ownerToken}` },
    })
  ).json();
  assert.equal(ownerList.length, 1);

  const playerList = await (
    await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
      headers: { cookie: `dmos_session=${playerToken}` },
    })
  ).json();
  assert.equal(playerList.length, 1);
});

test("suggestions: accept applies the change and writes history", async () => {
  const { owner, player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const submitRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  const suggestion = await submitRes.json();

  const ownerToken = signToken(owner.id);
  const acceptRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions/${suggestion.id}`, {
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

test("suggestions: accept coerces a boolean setting to a real boolean", async () => {
  const { owner, player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const submitRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "storyMode", proposedValue: true }),
  });
  assert.equal(submitRes.status, 201);
  const suggestion = await submitRes.json();

  const ownerToken = signToken(owner.id);
  const acceptRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions/${suggestion.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerToken}` },
    body: JSON.stringify({ action: "accept" }),
  });
  assert.equal(acceptRes.status, 200);
  const reloaded = storage.getCampaign(campaign.id);
  assert.equal((reloaded as any).storyMode, true);
  const history = storage.getCampaignSettingsHistory(campaign.id);
  const entry = history.find((h) => h.source === "accepted-suggestion" && h.settingKey === "storyMode");
  assert.ok(entry);
  assert.equal(entry!.newValue, "true");
});

test("suggestions: a boolean-key submission with a non-boolean proposedValue is rejected at submit time", async () => {
  const { player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "storyMode", proposedValue: "yes" }),
  });
  assert.equal(res.status, 400, "a string proposedValue for a boolean key must 400 at submit time, not silently coerce wrong later");
});

test("suggestions: an unknown extra key in the submission body is rejected (both union members are .strict())", async () => {
  const { player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark", garbageKey: true }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.errors, "the failure response must include errors, matching the sibling validation routes");
});

test("suggestions: an enum-key submission with a non-string proposedValue is rejected at submit time", async () => {
  const { player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: true }),
  });
  assert.equal(res.status, 400);
});

test("suggestions: accept rejects a malformed boolean proposedValue inserted directly (bypassing submit-time validation)", async () => {
  // Simulates a second writer of the campaign_setting_suggestions table (or
  // a direct DB edit) that never went through the submit route's Zod
  // schema — proving the accept route's own re-validation independently
  // catches a garbage proposedValue for a boolean key, rather than
  // silently coercing it to `false` (`"yes" === "true"` is false) and
  // accepting that as if it were a real user choice.
  const { owner, player, campaign } = makeFixture();
  const suggestion = storage.createCampaignSettingSuggestion({
    campaignId: campaign.id,
    settingKey: "storyMode",
    currentValue: String((campaign as any).storyMode),
    proposedValue: "yes",
    submittedByUserId: player.id,
  });

  const ownerToken = signToken(owner.id);
  const acceptRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions/${suggestion.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerToken}` },
    body: JSON.stringify({ action: "accept" }),
  });
  assert.equal(acceptRes.status, 400, "a malformed boolean proposedValue must 400, not silently coerce to false");
  const reloaded = storage.getCampaign(campaign.id);
  assert.equal((reloaded as any).storyMode, (campaign as any).storyMode, "the setting must be left untouched");
  const history = storage.getCampaignSettingsHistory(campaign.id);
  assert.equal(
    history.filter((h) => h.suggestionId === suggestion.id).length,
    0,
    "a rejected accept must not write a history entry",
  );
});

test("suggestions: decline does not apply the change", async () => {
  const { owner, player, campaign } = makeFixture();
  const playerToken = signToken(player.id);
  const submitRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  const suggestion = await submitRes.json();
  const ownerToken = signToken(owner.id);
  await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions/${suggestion.id}`, {
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
  const submitRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  const suggestion = await submitRes.json();
  const ownerToken = signToken(owner.id);
  // owner changes the setting directly before reviewing the suggestion
  await fetch(`${base}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerToken}` },
    body: JSON.stringify({ tone: "comedic" }),
  });
  const acceptRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions/${suggestion.id}`, {
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
  const submitRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  const suggestion = await submitRes.json();
  storage.updateCampaign(campaign.id, { settingsLocked: true } as any);
  const ownerToken = signToken(owner.id);
  const acceptRes = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions/${suggestion.id}`, {
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
  const submitRes = await fetch(`${base}/api/campaigns/${fixtureA.campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${playerToken}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  const suggestion = await submitRes.json();
  const ownerBToken = signToken(fixtureB.owner.id);
  const res = await fetch(`${base}/api/campaigns/${fixtureB.campaign.id}/settings/suggestions/${suggestion.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerBToken}` },
    body: JSON.stringify({ action: "accept" }),
  });
  assert.equal(res.status, 404, "a suggestion must not be resolvable through a different campaign's URL");
});

test("suggestions: a user with no character in the campaign cannot submit", async () => {
  const { outsider, campaign } = makeFixture();
  const token = signToken(outsider.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/settings/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ settingKey: "tone", proposedValue: "dark" }),
  });
  assert.equal(res.status, 403);
});

test("history route: returns rows in reverse-chronological order, viewable by owner and player", async () => {
  const { owner, player, campaign } = makeFixture();
  const ownerToken = signToken(owner.id);
  await fetch(`${base}/api/campaigns/${campaign.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${ownerToken}` },
    body: JSON.stringify({ tone: "dark" }),
  });
  const playerToken = signToken(player.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/settings/history`, {
    headers: { cookie: `dmos_session=${playerToken}` },
  });
  assert.equal(res.status, 200);
  const rows = (await res.json()) as any[];
  assert.equal(rows[0].settingKey, "tone");
});

test("history route: unrelated user is rejected", async () => {
  const { outsider, campaign } = makeFixture();
  const token = signToken(outsider.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/settings/history`, {
    headers: { cookie: `dmos_session=${token}` },
  });
  assert.equal(res.status, 403);
});

test("GET /api/campaigns/:id: viewerAuthority is correct for owner, player, and unrelated user", async () => {
  const { owner, player, outsider, campaign } = makeFixture();
  for (const [user, expected] of [
    [owner, "owner"],
    [player, "player"],
    [outsider, "none"],
  ] as const) {
    const token = signToken(user.id);
    const res = await fetch(`${base}/api/campaigns/${campaign.id}`, { headers: { cookie: `dmos_session=${token}` } });
    const body = (await res.json()) as any;
    assert.equal(body.viewerAuthority, expected);
  }
});

test("storage: user preferences upsert round-trips (insert then update)", () => {
  const { owner } = makeFixture();
  assert.equal(storage.getUserPreferences(owner.id), undefined);

  storage.upsertUserPreferences(owner.id, JSON.stringify({ theme: "dark" }), "2026-01-01T00:00:00.000Z");
  const inserted = storage.getUserPreferences(owner.id);
  assert.equal(inserted?.data, JSON.stringify({ theme: "dark" }));

  storage.upsertUserPreferences(owner.id, JSON.stringify({ theme: "light" }), "2026-01-02T00:00:00.000Z");
  const updated = storage.getUserPreferences(owner.id);
  assert.equal(updated?.data, JSON.stringify({ theme: "light" }));
  assert.equal(updated?.updatedAt, "2026-01-02T00:00:00.000Z");
});
