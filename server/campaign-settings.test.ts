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
