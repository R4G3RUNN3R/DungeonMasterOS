// server/routes-combat.e2e.test.ts
//
// End-to-end tests against the real handleAction/handleFlee route logic
// (exported for testing in Task 6), a real migrated SQLite database, and
// fake req/res objects. Only the AI-calling functions are substituted
// (via handleAction's injectable `deps` parameter) — every combat-engine
// function, every storage call, and every mutation runs for real.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, "test-combat-e2e.db");
process.env.DATABASE_URL = TEST_DB;
process.env.JWT_SECRET = "test-secret";

const { storage, runMigrations } = await import("./storage");
const { registerRoutes } = await import("./routes");

function fakeRes() {
  const state: any = { statusCode: 200, body: undefined };
  return {
    status(code: number) { state.statusCode = code; return this; },
    json(body: any) { state.body = body; return this; },
    _state: state,
  };
}

let didRegister = false;
let fixtureCounter = 0;

async function setup() {
  runMigrations();
  if (!didRegister) {
    // registerRoutes(httpServer, app) attaches routes to app AND expects a
    // real http.Server for WebSocket setup (mirrors server/index.ts's own
    // construction). Only needs to run once per process — it populates the
    // handleAction/handleFlee properties on the registerRoutes function
    // itself, which every subsequent test reuses.
    const app = express();
    app.use(express.json());
    const httpServer = createServer(app);
    await registerRoutes(httpServer, app);
    httpServer.close();
    didRegister = true;
  }
  const handleAction = (registerRoutes as any).handleAction;
  const handleFlee = (registerRoutes as any).handleFlee;

  const unique = `${Date.now()}-${fixtureCounter++}`;
  const user = storage.createUser({
    email: `t${unique}@test.com`,
    username: `t${unique}`,
    passwordHash: "x",
    tier: "free",
  } as any);
  const campaign = storage.createCampaign({
    userId: user.id, name: "Test Campaign", inviteCode: `invite-${unique}`, hostVisitorId: "visitor-1",
    tone: "grim", rulesWeight: "light",
    powerLevel: "standard", worldType: "fantasy", combatStyle: "tactical",
    storyMode: false, worldGenStyle: "guided",
  } as any);
  // getVisitorId(req) in server/routes.ts resolves a logged-in request's
  // visitor id as `user-${req.user.id}` (it prefers req.user.id over any
  // header) — fakeReq always sets req.user, so the character's visitorId
  // must match that shape or storage.getCharacterByVisitor finds nothing
  // and handleAction 403s before it ever reaches combat logic.
  const character = storage.createCharacter({
    campaignId: campaign.id, userId: user.id, name: "Kira", race: "Human", charClass: "Fighter",
    hp: 20, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", visitorId: `user-${user.id}`,
  } as any);

  return { handleAction, handleFlee, user, campaign, character };
}

function fakeReq(body: any, user: any, campaignId: number) {
  return { body, user, params: { id: String(campaignId) }, headers: {} } as any;
}

function stubDeps(rawResponse: string, npcResponses: string[] = []) {
  let npcCallIndex = 0;
  return {
    generateDMResponse: async () => rawResponse,
    generateNpcTurnAction: async () => npcResponses[npcCallIndex++] ?? "The enemy hesitates.",
    generateNarrationText: async () => "A fixed narration.",
  };
}

test("COMBAT_START submitted through handleAction actually creates a live, persisted encounter", async () => {
  const { handleAction, user, campaign, character } = await setup();
  const rawResponse = 'Battle erupts! [COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]';
  const req = fakeReq({ content: "I ready my sword." }, user, campaign.id);
  const res = fakeRes();
  await handleAction(req, res, campaign.id, stubDeps(rawResponse));

  const encounter = storage.getActiveEncounterByCampaign(campaign.id);
  assert.ok(encounter, "encounter should exist");
  assert.equal(encounter!.status, "active");
  const participants = JSON.parse(encounter!.participants);
  assert.ok(participants.some((p: any) => p.name === "Kira"));
  assert.ok(participants.some((p: any) => p.name === "Goblin"));
});

test("a player ATTACK submitted through handleAction actually resolves — real roll, real HP mutation, real rollLog entry", async () => {
  const { handleAction, user, campaign, character } = await setup();
  await handleAction(fakeReq({ content: "Combat starts" }, user, campaign.id), fakeRes(), campaign.id,
    stubDeps('[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]'));

  const before = storage.getActiveEncounterByCampaign(campaign.id)!;
  const beforeGoblin = JSON.parse(before.participants).find((p: any) => p.name === "Goblin");

  const res = fakeRes();
  await handleAction(fakeReq({ content: "I attack the goblin!" }, user, campaign.id), res, campaign.id,
    stubDeps('[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]'));

  const after = storage.getActiveEncounterByCampaign(campaign.id) ?? before;
  const afterGoblin = JSON.parse((after as any).participants ?? before.participants).find((p: any) => p.name === "Goblin");
  const rollLog = storage.getRollLogByEncounter(before.id);

  assert.ok(rollLog.some((r) => r.rollType === "attack"), "an attack roll should be logged");
  // Either the goblin took damage, or (if the swing missed) HP is unchanged
  // but a real logged roll still exists — either way this proves resolution
  // happened through real dice math, not AI narration.
  assert.ok(afterGoblin.currentHp <= beforeGoblin.currentHp);
});

test("an out-of-turn ATTACK cannot mutate combat state", async () => {
  const { handleAction, user, campaign, character } = await setup();
  await handleAction(fakeReq({ content: "Combat starts" }, user, campaign.id), fakeRes(), campaign.id,
    stubDeps('[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]'));

  const encounter = storage.getActiveEncounterByCampaign(campaign.id)!;
  const beforeRollCount = storage.getRollLogByEncounter(encounter.id).length;

  // Force it to not be Kira's turn by directly setting turnIndex past her (if
  // she isn't already first) — read participants to find her index, then
  // point turnIndex at any other participant.
  const participants = JSON.parse(encounter.participants);
  const kiraIndex = participants.findIndex((p: any) => p.name === "Kira");
  const otherIndex = kiraIndex === 0 ? 1 : 0;
  storage.updateEncounter(encounter.id, { turnIndex: otherIndex });

  const res = fakeRes();
  await handleAction(fakeReq({ content: "I attack anyway!" }, user, campaign.id), res, campaign.id,
    stubDeps('[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]'));

  // It genuinely isn't Kira's turn, so the real current turn-holder (the
  // NPC) still gets its own turn resolved automatically by the post-action
  // cascade — that legitimately adds roll-log entries. What must NEVER
  // happen is Kira's own illicit off-turn swing producing an attack roll
  // credited to her character, so check specifically for that rather than
  // asserting the roll count never changes.
  //
  // Note on what this actually proves: in this scenario resolveAttack is
  // never invoked at all — buildCombatContext's isSubmittingPlayersTurn gate
  // in routes.ts/dm-engine.ts short-circuits before resolveAttack's own
  // internal turn-order check would run. So this test exercises that
  // higher-level route gate end-to-end, not resolveAttack's internal
  // `currentTurnParticipant.name !== tag.attacker` guard — that branch is
  // separately and directly unit-tested in combat-engine-attack.test.ts.
  const afterRollLog = storage.getRollLogByEncounter(encounter.id);
  const newRolls = afterRollLog.slice(beforeRollCount);
  assert.ok(
    !newRolls.some((r) => r.rollType === "attack" && r.characterId === character.id),
    "no attack roll credited to Kira should have been logged for her out-of-turn attack",
  );
});

test("an AI response claiming combat ended, without a validated mechanism, does not end the encounter", async () => {
  const { handleAction, user, campaign } = await setup();
  await handleAction(fakeReq({ content: "Combat starts" }, user, campaign.id), fakeRes(), campaign.id,
    stubDeps('[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]'));

  const before = storage.getActiveEncounterByCampaign(campaign.id)!;

  const res = fakeRes();
  await handleAction(
    fakeReq({ content: "I declare victory!" }, user, campaign.id),
    res,
    campaign.id,
    stubDeps("The battle is over! Combat has ended and you are victorious. [COMBAT_END]{\"reason\":\"I said so\"}[/COMBAT_END]"),
  );

  const after = storage.getActiveEncounterByCampaign(campaign.id);
  assert.ok(after, "the encounter must still be active — a bare COMBAT_END-shaped tag (now unrecognized) cannot end it");
  assert.equal(after!.status, "active");
});

test("a SURRENDER tag only ever affects the specific, validated NPC targets it names", async () => {
  const { handleAction, user, campaign } = await setup();
  await handleAction(fakeReq({ content: "Combat starts" }, user, campaign.id), fakeRes(), campaign.id,
    stubDeps('[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]'));

  // Capture the encounter's id before the surrender resolves. With this
  // fixture (a single NPC, Goblin), the Goblin surrendering alone already
  // ends the encounter via checkDeterministicEnd's NPC-only victory check —
  // and if Kira were illicitly defeated too, checkDeterministicEnd would
  // instead resolve "aborted" (no living NPCs *and* no living PCs), which
  // also flips status to "ended". Either way storage.getActiveEncounterByCampaign
  // (status === "active" only) would return undefined regardless of Kira's
  // fate, so it can't be used to observe the outcome here — look the
  // encounter up by id instead, which returns it regardless of status.
  const encounterId = storage.getActiveEncounterByCampaign(campaign.id)!.id;

  const res = fakeRes();
  await handleAction(
    fakeReq({ content: "The goblin looks scared." }, user, campaign.id),
    res,
    campaign.id,
    stubDeps('[SURRENDER]{"npcNames":["Goblin","Kira"],"reason":"it drops its weapon"}[/SURRENDER]'),
  );

  const after = storage.getEncounter(encounterId);
  assert.ok(after, "the encounter record must still exist");
  assert.equal(after!.status, "ended");
  // Inspect Kira's own participant object directly: she must still be a
  // "character" type, untouched by the surrender mutation, even though her
  // name was included in npcNames.
  const kiraParticipant = JSON.parse(after!.participants).find((p: any) => p.name === "Kira");
  assert.ok(kiraParticipant, "Kira must still be present in the participants list");
  assert.equal(kiraParticipant.type, "character");
  assert.equal(kiraParticipant.isDefeated, false, "Kira must never have been touched by the tag even though her name was included");
});

test("duplicate submissions (same clientSubmissionId) cannot cause a duplicate attack", async () => {
  const { handleAction, user, campaign } = await setup();
  await handleAction(fakeReq({ content: "Combat starts" }, user, campaign.id), fakeRes(), campaign.id,
    stubDeps('[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]'));

  const encounter = storage.getActiveEncounterByCampaign(campaign.id)!;
  const submissionId = "dup-sub-1";
  const deps = stubDeps('[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]');

  const res1 = fakeRes();
  await handleAction(fakeReq({ content: "I attack!", clientSubmissionId: submissionId }, user, campaign.id), res1, campaign.id, deps);
  const rollCountAfterFirst = storage.getRollLogByEncounter(encounter.id).length;

  const res2 = fakeRes();
  await handleAction(fakeReq({ content: "I attack!", clientSubmissionId: submissionId }, user, campaign.id), res2, campaign.id, deps);
  const rollCountAfterSecond = storage.getRollLogByEncounter(encounter.id).length;

  assert.equal(rollCountAfterSecond, rollCountAfterFirst, "a duplicate submission must not roll again");
  assert.equal(res2._state.body.duplicate, true);
});

test("consecutive NPC turns cascade automatically through the real endpoint until the next PC turn", async () => {
  const { handleAction, user, campaign } = await setup();
  // Two NPCs both proposed before the PC, plus a second PC (Doran) so the
  // encounter doesn't end after only one enemy's HP changes. Kira attacks
  // whichever enemy initiative put first; both goblins should then act in
  // the same request before control returns to a PC.
  await handleAction(fakeReq({ content: "Combat starts" }, user, campaign.id), fakeRes(), campaign.id,
    stubDeps('[COMBAT_START]{"participants":["Kira"],"npcs":[{"name":"Goblin A","hp":50,"ac":8,"attackBonus":0,"damageDice":"1d4"},{"name":"Goblin B","hp":50,"ac":8,"attackBonus":0,"damageDice":"1d4"}]}[/COMBAT_START]'));

  const encounter = storage.getActiveEncounterByCampaign(campaign.id)!;
  const participants = JSON.parse(encounter.participants);
  const kiraIndex = participants.findIndex((p: any) => p.name === "Kira");
  // Force initiative order to Goblin A, Goblin B, Kira, regardless of the
  // random roll, so this test deterministically exercises a 2-NPC cascade.
  const reordered = [
    ...participants.filter((p: any) => p.name !== "Kira"),
    participants[kiraIndex],
  ];
  storage.updateEncounter(encounter.id, { participants: JSON.stringify(reordered), turnIndex: 0 });

  const res = fakeRes();
  // It's Goblin A's turn, not Kira's — her submitted action won't resolve as
  // an attack (no combatContext.isSubmittingPlayersTurn), but it still
  // triggers the post-action advanceAndResolveTurns cascade, which should
  // resolve BOTH goblins' turns before landing back on Kira.
  await handleAction(fakeReq({ content: "I brace myself." }, user, campaign.id), res, campaign.id, stubDeps("You brace for the enemy's turn."));

  assert.equal(res._state.body.npcTurnMessages.length, 2, "both NPC turns should have cascaded in one request");
  const after = storage.getActiveEncounterByCampaign(campaign.id)!;
  assert.equal(JSON.parse(after.participants)[after.turnIndex].name, "Kira");
});

test("npcTurnMessages in the HTTP response agree with what's actually persisted", async () => {
  const { handleAction, user, campaign } = await setup();
  await handleAction(fakeReq({ content: "Combat starts" }, user, campaign.id), fakeRes(), campaign.id,
    stubDeps('[COMBAT_START]{"participants":["Kira"],"npcs":[{"name":"Goblin","hp":50,"ac":8,"attackBonus":0,"damageDice":"1d4"}]}[/COMBAT_START]'));

  const encounter = storage.getActiveEncounterByCampaign(campaign.id)!;
  const participants = JSON.parse(encounter.participants);
  const kiraIndex = participants.findIndex((p: any) => p.name === "Kira");
  const reordered = [...participants.filter((p: any) => p.name !== "Kira"), participants[kiraIndex]];
  storage.updateEncounter(encounter.id, { participants: JSON.stringify(reordered), turnIndex: 0 });

  const beforeMessageCount = storage.getMessagesByCampaign(campaign.id).length;
  const res = fakeRes();
  await handleAction(fakeReq({ content: "I brace myself." }, user, campaign.id), res, campaign.id, stubDeps("You brace."));

  const persistedMessages = storage.getMessagesByCampaign(campaign.id);
  const newPersisted = persistedMessages.slice(beforeMessageCount);
  const responseNpcMessages = res._state.body.npcTurnMessages;

  assert.equal(responseNpcMessages.length, 1);
  const persistedNpcMessage = newPersisted.find((m: any) => m.id === responseNpcMessages[0].id);
  assert.ok(persistedNpcMessage, "the message returned in npcTurnMessages must actually exist in storage");
  assert.equal(persistedNpcMessage!.content, responseNpcMessages[0].content);
});

test("buildSystemPrompt documents the mechanical tags the AI is expected to emit", async () => {
  const { buildCombatContext } = await import("./dm-engine");
  // buildSystemPrompt itself isn't exported (internal to dm-engine.ts) — verify
  // indirectly via generateDMResponse's actual prompt construction path by
  // checking the exported pieces it depends on exist and are wired, plus a
  // direct content check against the module's source as a last-resort guard
  // against silent prompt regressions.
  const dmEngineSource = fs.readFileSync(path.join(__dirname, "dm-engine.ts"), "utf-8");
  for (const tag of ["[CHECK]", "[COMBAT_START]", "[ATTACK]", "[SURRENDER]"]) {
    assert.ok(dmEngineSource.includes(tag), `system prompt source must document ${tag}`);
  }
  assert.ok(!dmEngineSource.includes("[COMBAT_END]"), "the removed COMBAT_END tag must not still be documented");
});

test("buildSystemPrompt is grounded with the authoritative party inventory (regression guard for item-hallucination bug)", async () => {
  // Same last-resort source-content approach as the test above: buildSystemPrompt
  // isn't exported, so this guards against someone silently deleting the fix for
  // the 2026-08-18 production bug where the AI DM claimed real inventory items
  // (Bag of Holding, CIEL Ring, etc.) didn't exist because the prompt never told
  // it what the party actually owned.
  const dmEngineSource = fs.readFileSync(path.join(__dirname, "dm-engine.ts"), "utf-8");
  assert.ok(
    dmEngineSource.includes("AUTHORITATIVE PARTY INVENTORY"),
    "system prompt source must include the authoritative party inventory grounding section",
  );
  assert.ok(
    dmEngineSource.includes("partyInventory"),
    "buildSystemPrompt's call chain must still be wired to accept a partyInventory param",
  );

  const routesSource = fs.readFileSync(path.join(__dirname, "routes.ts"), "utf-8");
  assert.ok(
    routesSource.includes("buildPartyInventorySnapshots"),
    "the live action/opening-scene/item-use routes must still build and pass real inventory snapshots into the AI prompt",
  );
});

test("extractItemsFromNarration never double-books ordinary tracked currency as a separate item (regression guard)", async () => {
  // Live regression testing on 2026-08-18 found a real bug: the item-grant
  // extractor's old instructions told it to treat ANY mention of gold/coins
  // as a grantable itemType "currency", so when the DM narrated a character
  // rediscovering money it already had (tracked correctly by the separate
  // currency ledger), this extractor ALSO created duplicate "Gold Pieces" /
  // "Small Leather Purse" item rows for the same money. Guard against this
  // regressing silently since extractItemsFromNarration isn't exported.
  const routesSource = fs.readFileSync(path.join(__dirname, "routes.ts"), "utf-8");
  assert.ok(
    routesSource.includes("campaignCurrencies"),
    "extractItemsFromNarration must be told the campaign's tracked currencies",
  );
  assert.ok(
    routesSource.includes("NEVER extract them here"),
    "extractItemsFromNarration's prompt must explicitly forbid double-booking ordinary tracked currency as an item",
  );
});

test("cleanup", () => {
  // better-sqlite3 keeps its file handle open for the life of the process,
  // and on Windows an open file can't be unlinked (EPERM) — see the same
  // pattern in server/storage-dedup.test.ts. Cleanup is best-effort hygiene
  // for a throwaway file, not a correctness assertion, so swallow failures
  // rather than let a locked handle fail the whole suite.
  for (const p of [TEST_DB, `${TEST_DB}-wal`, `${TEST_DB}-shm`]) {
    try {
      fs.rmSync(p, { force: true });
    } catch {
      // best-effort; ignore (e.g. EPERM on Windows while the handle is open)
    }
  }
});
