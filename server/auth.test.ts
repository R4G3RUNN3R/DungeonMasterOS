// server/auth.test.ts
//
// Regression tests for final-review issue #1: checkTurnLimit's
// clientSubmissionId dedup bypass was exploitable on
// POST /api/campaigns/:id/start because the same middleware guarded both
// /action (which has a downstream dedup in handleAction that makes the
// bypass safe) and /start (which has no downstream dedup, makes a real,
// turn-incrementing AI call, and must never honor a replayed submission id).
//
// These are the two tests the design spec called for (design doc:182) and
// that were never written — that missing coverage is why the bug shipped.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import express from "express";

const dbPath = path.join(os.tmpdir(), `dmos-auth-test-${Date.now()}.db`);
process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "auth-test-unused";
process.env.JWT_SECRET = "test-secret";

const { storage, runMigrations } = await import("./storage");
const { checkTurnLimit, requireCanPlay, grantDungeonMasterAccess } = await import("./auth");
runMigrations();

function fakeRes() {
  const state: any = { statusCode: 200, body: undefined };
  return {
    status(code: number) { state.statusCode = code; return this; },
    json(body: any) { state.body = body; return this; },
    _state: state,
  };
}

let fixtureCounter = 0;

// Builds an over-quota free-tier user, a campaign, and a persisted message
// carrying `clientSubmissionId` — i.e. exactly the state an attacker would
// have after making one real /action submission and then trying to replay
// its submission id.
function setupOverQuotaUserWithReplayableSubmission() {
  const unique = `${Date.now()}-${fixtureCounter++}`;
  const user = storage.createUser({
    email: `t${unique}@test.com`,
    username: `t${unique}`,
    passwordHash: "x",
    tier: "free",
    subscriptionStatus: "active",
  } as any);
  // Free tier is 10 turns/month; put the user exactly at quota.
  storage.updateUser(user.id, { aiTurnsUsedThisMonth: 10 });
  const overQuotaUser = storage.getUser(user.id)!;

  const campaign = storage.createCampaign({
    userId: user.id, name: "Test", inviteCode: `invite-${unique}`, hostVisitorId: "visitor-1",
    tone: "grim", rulesWeight: "light", powerLevel: "standard", worldType: "fantasy",
    combatStyle: "tactical", storyMode: false, worldGenStyle: "guided",
  } as any);

  const submissionId = `sub-${unique}`;
  storage.createMessageIdempotent({
    campaignId: campaign.id,
    sender: "Kira",
    senderType: "player",
    content: "I attack",
    messageType: "action",
    clientSubmissionId: submissionId,
  });

  return { user: overQuotaUser, campaign, submissionId };
}

test("checkTurnLimit({ dedupAware: true }): a replayed clientSubmissionId bypasses the turn-limit check on /action (intended, existing behavior)", () => {
  const { user, campaign, submissionId } = setupOverQuotaUserWithReplayableSubmission();

  const req = { user, params: { id: String(campaign.id) }, body: { clientSubmissionId: submissionId } } as any;
  const res = fakeRes();
  let nextCalled = false;

  checkTurnLimit({ dedupAware: true })(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true, "next() must be called — the dedup bypass is intended on /action");
  assert.equal(res._state.body, undefined, "no rejection response should have been sent");
});

test("checkTurnLimit() [/start, not dedupAware]: a replayed clientSubmissionId does NOT bypass the turn-limit check, even though that exact submission id exists as a message in the campaign", () => {
  const { user, campaign, submissionId } = setupOverQuotaUserWithReplayableSubmission();

  // Same over-quota user, same campaign, same *real* replayed submission id —
  // the only difference from the /action test above is the route context
  // (checkTurnLimit() with no dedupAware opt-in, as /start uses).
  const req = { user, params: { id: String(campaign.id) }, body: { clientSubmissionId: submissionId } } as any;
  const res = fakeRes();
  let nextCalled = false;

  checkTurnLimit()(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false, "next() must NOT be called — /start has no downstream dedup, so the bypass must not apply");
  assert.equal(res._state.statusCode, 403);
  assert.equal(res._state.body?.code, "TURN_LIMIT");
});

// Regression guard for final-review Minor finding #1 on the Fix-1 re-review:
// the two tests above call checkTurnLimit({ dedupAware: true }) / checkTurnLimit()
// directly — they prove the middleware itself is safe, but not that
// routes.ts actually *registers* /action and /start with the options this
// safety depends on. A future edit that silently changed either
// registration (e.g. someone "simplifying" /start to also pass
// { dedupAware: true }) would reintroduce the exact bypass this fix closed,
// and the suite would stay green, because nothing here reads the real route
// table. This test pulls the *actual* middleware function instances Express
// has registered for both routes (via registerRoutes -> app._router.stack)
// and behaviorally probes each one directly — same replayed submission id,
// same over-quota user — so it fails if the real registration ever drifts,
// not just if checkTurnLimit's own logic regresses.
function getCheckTurnLimitInstance(app: express.Express, method: "post", routePath: string) {
  const stack = (app as any)._router.stack as any[];
  const layer = stack.find((l) => l.route?.path === routePath && l.route?.methods?.[method]);
  if (!layer) throw new Error(`No registered route found for ${method.toUpperCase()} ${routePath}`);
  const middlewareLayer = layer.route.stack.find((s: any) => s.handle?.name === "checkTurnLimitMiddleware");
  if (!middlewareLayer) throw new Error(`No checkTurnLimitMiddleware found on ${method.toUpperCase()} ${routePath}`);
  return middlewareLayer.handle as (req: any, res: any, next: any) => void;
}

test("route registration: /action and /start are actually wired to differently-configured checkTurnLimit instances (guards against a silent registration regression)", async () => {
  const { registerRoutes } = await import("./routes");
  const { createServer } = await import("node:http");

  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  httpServer.close();

  const actionCheckTurnLimit = getCheckTurnLimitInstance(app, "post", "/api/campaigns/:id/action");
  const startCheckTurnLimit = getCheckTurnLimitInstance(app, "post", "/api/campaigns/:id/start");

  const { user, campaign, submissionId } = setupOverQuotaUserWithReplayableSubmission();
  const req = { user, params: { id: String(campaign.id) }, body: { clientSubmissionId: submissionId } } as any;

  const actionRes = fakeRes();
  let actionNextCalled = false;
  actionCheckTurnLimit(req, actionRes, () => { actionNextCalled = true; });
  assert.equal(actionNextCalled, true, "the actual middleware registered on /action must bypass a replayed submission id");

  const startRes = fakeRes();
  let startNextCalled = false;
  startCheckTurnLimit(req, startRes, () => { startNextCalled = true; });
  assert.equal(startNextCalled, false, "the actual middleware registered on /start must NOT bypass a replayed submission id");
  assert.equal(startRes._state.statusCode, 403);
  assert.equal(startRes._state.body?.code, "TURN_LIMIT");
});

// Regression tests for an independent adversarial review finding (Important):
// grantDungeonMasterAccess sets unlimitedTurns:true but leaves tier/
// subscriptionStatus untouched (a DM-granted account is otherwise an
// ordinary "free" account) — checkTurnLimit and requireCanPlay never read
// unlimitedTurns at all, so a DM-granted account was still blocked: 0
// included turns (free tier) meant checkTurnLimit's very first real /action
// call 403'd, and if the account happened to be a normal post-no-trial
// signup (subscriptionStatus:"expired"), requireCanPlay 402'd before that.
function makeUnlimitedTurnsUser() {
  const unique = `${Date.now()}-${fixtureCounter++}`;
  const user = storage.createUser({
    email: `dm${unique}@test.com`,
    username: `dm${unique}`,
    passwordHash: "x",
    tier: "free",
    subscriptionStatus: "expired",
  } as any);
  const granted = grantDungeonMasterAccess(user.id)!;
  assert.equal(granted.unlimitedTurns, true, "precondition: grantDungeonMasterAccess must actually set unlimitedTurns");
  assert.equal(granted.tier, "free", "precondition: tier is untouched by grantDungeonMasterAccess, exactly as in production");
  assert.equal(granted.subscriptionStatus, "expired", "precondition: subscriptionStatus is untouched, exactly as in production");
  return granted;
}

test("checkTurnLimit(): a user with unlimitedTurns is never blocked, even at 0 included turns", () => {
  const user = makeUnlimitedTurnsUser();
  storage.updateUser(user.id, { aiTurnsUsedThisMonth: 999_999 });
  const overQuota = storage.getUser(user.id)!;

  const req = { user: overQuota, params: { id: "1" }, body: {} } as any;
  const res = fakeRes();
  let nextCalled = false;

  checkTurnLimit()(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true, "an unlimitedTurns user must never be blocked by checkTurnLimit regardless of usage/tier");
  assert.equal(res._state.body, undefined, "no TURN_LIMIT rejection should have been sent");
});

test("requireCanPlay: a user with unlimitedTurns is never blocked, even with subscriptionStatus \"expired\"", () => {
  const user = makeUnlimitedTurnsUser();

  const req = { user } as any;
  const res = fakeRes();
  let nextCalled = false;

  requireCanPlay(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true, "an unlimitedTurns user must never be blocked by requireCanPlay regardless of subscriptionStatus");
  assert.equal(res._state.body, undefined, "no SUBSCRIPTION_REQUIRED rejection should have been sent");
});

// Regression test for an independent adversarial review finding (Important):
// Squire Pass turns (bonusTurns) are marketed as "no expiry", but
// requireCanPlay blocked /action and /start entirely once
// subscriptionStatus reached "expired" (e.g. a subscriber who bought a
// Squire Pass, subscribed, spent some of it, then cancelled and lapsed) —
// before checkTurnLimit ever got a chance to look at bonusTurns. The paid
// turns became permanently unspendable even though /api/billing still
// reported them as available.
test("requireCanPlay: an expired user with remaining bonusTurns is not blocked (paid Squire turns must not expire)", () => {
  const unique = `${Date.now()}-${fixtureCounter++}`;
  const user = storage.createUser({
    email: `expiredbonus${unique}@test.com`,
    username: `expiredbonus${unique}`,
    passwordHash: "x",
    tier: "free",
    subscriptionStatus: "expired",
  } as any);
  storage.updateUser(user.id, { bonusTurns: 40 });
  const withBonus = storage.getUser(user.id)!;
  assert.equal(withBonus.subscriptionStatus, "expired");

  const req = { user: withBonus } as any;
  const res = fakeRes();
  let nextCalled = false;

  requireCanPlay(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true, "an expired user with bonusTurns > 0 must be allowed through to checkTurnLimit's real gating");
  assert.equal(res._state.body, undefined, "no SUBSCRIPTION_REQUIRED rejection should have been sent");
});

test("requireCanPlay: an expired user with NO bonusTurns is still blocked", () => {
  const unique = `${Date.now()}-${fixtureCounter++}`;
  const user = storage.createUser({
    email: `expirednobonus${unique}@test.com`,
    username: `expirednobonus${unique}`,
    passwordHash: "x",
    tier: "free",
    subscriptionStatus: "expired",
  } as any);

  const req = { user } as any;
  const res = fakeRes();
  let nextCalled = false;

  requireCanPlay(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false, "an expired user with zero bonusTurns must still be blocked");
  assert.equal(res._state.statusCode, 402);
  assert.equal(res._state.body?.code, "SUBSCRIPTION_REQUIRED");
});

test.after(() => {
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      fs.rmSync(p, { force: true });
    } catch {
      // best-effort cleanup only, matches storage-dedup.test.ts
    }
  }
});
