// server/campaign-source-selection.test.ts
//
// Task 5: persistence + resolver for campaign source selection
// (all_official/core_only/custom). Exercises storage.getCampaignEnabledSources
// as the one authoritative resolver, storage.setCampaignCustomSources'
// wrong-ruleset/nonexistent-id rejection, and the authority-gated
// PATCH /api/campaigns/:id/sources route end-to-end over real HTTP.
//
// Fixture pattern (express() + createServer() + registerRoutes() + real
// fetch(), temp SQLite via DATABASE_URL, signToken()+cookie auth) mirrors
// server/campaign-settings.test.ts exactly, including its real signatures:
// registerRoutes(httpServer, app) (not app, server), signToken imported from
// "./auth" (not "./storage"), storage.createUser({email, username,
// passwordHash}), storage.createCampaign({name, inviteCode, hostVisitorId,
// userId, ruleset}).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-campaign-sources-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "campaign-source-selection-test-secret";
process.env.ANTHROPIC_API_KEY = "campaign-source-selection-test";

const { storage, runMigrations } = await import("./storage");
runMigrations();

const { signToken } = await import("./auth");
const { registerRoutes } = await import("./routes");

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
function makeFixture(ruleset = "dnd35e") {
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
  const campaign = storage.createCampaign({
    name: `Campaign ${unique}`,
    inviteCode: `inv-${unique}`,
    hostVisitorId: `user-${owner.id}`,
    userId: owner.id,
    ruleset,
  } as any);
  return { owner, player, campaign };
}

test("generic 3.5 sources are included under all_official for a generic-setting campaign", () => {
  const { campaign } = makeFixture();
  const generic = storage.createRuleSource({
    sourceKey: `dnd35e-phb-a-${Date.now()}`,
    title: "PHB",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const enabled = storage.getCampaignEnabledSources(campaign.id);
  assert.ok(enabled.some((s) => s.id === generic.id));
});

test("Eberron and Forgotten Realms sources stay isolated from each other under all_official", () => {
  const { campaign } = makeFixture();
  const eberron = storage.createRuleSource({
    sourceKey: `dnd35e-eberron-a-${Date.now()}`,
    title: "Eberron CS",
    ruleset: "dnd35e",
    setting: "eberron",
    publicationType: "setting-book",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const faerun = storage.createRuleSource({
    sourceKey: `dnd35e-faerun-a-${Date.now()}`,
    title: "FRCS",
    ruleset: "dnd35e",
    setting: "forgotten-realms",
    publicationType: "setting-book",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  storage.updateCampaign(campaign.id, { setting: "eberron" } as any);
  const enabled = storage.getCampaignEnabledSources(campaign.id);
  assert.ok(enabled.some((s) => s.id === eberron.id));
  assert.ok(!enabled.some((s) => s.id === faerun.id));
});

test("all_official dynamically includes a source registered after the campaign was created", () => {
  const { campaign } = makeFixture();
  const before = storage.getCampaignEnabledSources(campaign.id);
  const late = storage.createRuleSource({
    sourceKey: `dnd35e-late-a-${Date.now()}`,
    title: "Late-Registered Splatbook",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "splatbook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const after = storage.getCampaignEnabledSources(campaign.id);
  assert.ok(!before.some((s) => s.id === late.id));
  assert.ok(after.some((s) => s.id === late.id));
});

test("custom mode is frozen -- a source registered after selection does not silently appear", () => {
  const { campaign } = makeFixture();
  const kept = storage.createRuleSource({
    sourceKey: `dnd35e-custom-kept-${Date.now()}`,
    title: "Kept Source",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  storage.setCampaignSourcePreset(campaign.id, "custom");
  storage.setCampaignCustomSources(campaign.id, [kept.id]);

  const lateArrival = storage.createRuleSource({
    sourceKey: `dnd35e-custom-late-${Date.now()}`,
    title: "Late Arrival",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });

  const enabled = storage.getCampaignEnabledSources(campaign.id);
  assert.ok(enabled.some((s) => s.id === kept.id));
  assert.ok(!enabled.some((s) => s.id === lateArrival.id));
});

test("setCampaignCustomSources rejects a source from a different ruleset", () => {
  const wrongRuleset = storage.createRuleSource({
    sourceKey: `dnd5e-wrong-ruleset-${Date.now()}`,
    title: "5e Source",
    ruleset: "dnd5e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const { campaign } = makeFixture("dnd35e");
  assert.throws(() => storage.setCampaignCustomSources(campaign.id, [wrongRuleset.id]));
});

test("setCampaignCustomSources rejects a nonexistent source id", () => {
  const { campaign } = makeFixture("dnd35e");
  assert.throws(() => storage.setCampaignCustomSources(campaign.id, [999999999]));
});

test("PATCH /api/campaigns/:id/sources rejects a wrong-ruleset source ID over HTTP as 400", async () => {
  const wrongRuleset = storage.createRuleSource({
    sourceKey: `dnd5e-wrong-ruleset-http-${Date.now()}`,
    title: "5e Source",
    ruleset: "dnd5e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const { owner, campaign } = makeFixture("dnd35e");
  const token = signToken(owner.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/sources`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ sourcePreset: "custom", customSourceIds: [wrongRuleset.id] }),
  });
  assert.equal(res.status, 400);
});

test("PATCH /api/campaigns/:id/sources: owner can set core_only and the route returns the resolved enabled sources", async () => {
  const { owner, campaign } = makeFixture("dnd35e");
  storage.createRuleSource({
    sourceKey: `dnd35e-core-${Date.now()}`,
    title: "PHB",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  storage.createRuleSource({
    sourceKey: `dnd35e-splat-${Date.now()}`,
    title: "Splatbook",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "splatbook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const token = signToken(owner.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/sources`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ sourcePreset: "core_only" }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.sourcePreset, "core_only");
  assert.ok(body.enabledSources.every((s: any) => s.publicationType === "core-rulebook"));
  assert.ok(body.enabledSources.length > 0);
});

test("PATCH /api/campaigns/:id/sources: non-owner is rejected with 403", async () => {
  const { player, campaign } = makeFixture("dnd35e");
  const token = signToken(player.id);
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/sources`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ sourcePreset: "core_only" }),
  });
  assert.equal(res.status, 403);
});

test("PATCH /api/campaigns/:id/sources: unknown campaign id 404s", async () => {
  const { owner } = makeFixture("dnd35e");
  const token = signToken(owner.id);
  const res = await fetch(`${base}/api/campaigns/999999999/sources`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ sourcePreset: "core_only" }),
  });
  assert.equal(res.status, 404);
});

test("PATCH /api/campaigns/:id/sources: setCampaignCustomSources replaces (not appends) the enabled set on each call", async () => {
  const { owner, campaign } = makeFixture("dnd35e");
  const a = storage.createRuleSource({
    sourceKey: `dnd35e-replace-a-${Date.now()}`,
    title: "A",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const b = storage.createRuleSource({
    sourceKey: `dnd35e-replace-b-${Date.now()}`,
    title: "B",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const token = signToken(owner.id);
  await fetch(`${base}/api/campaigns/${campaign.id}/sources`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ sourcePreset: "custom", customSourceIds: [a.id] }),
  });
  const res = await fetch(`${base}/api/campaigns/${campaign.id}/sources`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ customSourceIds: [b.id] }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.ok(!body.enabledSources.some((s: any) => s.id === a.id), "previous custom selection must be fully replaced, not appended to");
  assert.ok(body.enabledSources.some((s: any) => s.id === b.id));
});
