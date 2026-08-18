// server/integrity-checks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const dbPath = path.join(os.tmpdir(), `dmos-integrity-checks-test-${Date.now()}.db`);
process.env.DATABASE_URL = dbPath;

const { storage, runMigrations } = await import("./storage");
const { runDataIntegrityChecks } = await import("./integrity-checks");
runMigrations();

test.after(() => {
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      fs.rmSync(p, { force: true });
    } catch {
      // best-effort cleanup only, same as the other storage-backed test files
    }
  }
});

function makeCampaignAndCharacter(unique: string) {
  const user = storage.createUser({ email: `${unique}@test.com`, username: unique, passwordHash: "x", tier: "free" } as any);
  const campaign = storage.createCampaign({
    userId: user.id, name: `Campaign ${unique}`, inviteCode: `invite-${unique}`, hostVisitorId: "visitor-1",
    tone: "grim", rulesWeight: "light", powerLevel: "standard", worldType: "fantasy", combatStyle: "tactical",
    storyMode: false, worldGenStyle: "guided",
  } as any);
  const character = storage.createCharacter({
    campaignId: campaign.id, userId: user.id, name: "Kira", race: "Human", charClass: "Fighter",
    hp: 20, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", visitorId: `user-${user.id}`,
  } as any);
  return { user, campaign, character };
}

test("runDataIntegrityChecks: clean data produces no issues", () => {
  const { campaign, character } = makeCampaignAndCharacter("clean");
  storage.createItem({
    campaignId: campaign.id, characterId: character.id, name: "Dagger", itemType: "weapon",
    quantity: 1, identified: true, consumable: false, equipped: false, carried: true,
  } as any);
  storage.adjustCharacterCurrency(campaign.id, character.id, "gold", 10);

  const issues = runDataIntegrityChecks();
  const relevant = issues.filter((i) => i.details?.characterId === character.id);
  assert.deepEqual(relevant, []);
});

test("runDataIntegrityChecks: flags a negative item quantity", () => {
  const { campaign, character } = makeCampaignAndCharacter("negqty");
  const item = storage.createItem({
    campaignId: campaign.id, characterId: character.id, name: "Broken Arrow", itemType: "gear",
    quantity: -1, identified: true, consumable: false, equipped: false, carried: true,
  } as any);

  const issues = runDataIntegrityChecks();
  const found = issues.find((i) => i.check === "negative_item_quantity" && i.details?.itemId === item.id);
  assert.ok(found, "expected a negative_item_quantity issue for the broken item");
});

test("runDataIntegrityChecks: flags a negative currency balance", () => {
  const { campaign, character } = makeCampaignAndCharacter("negcur");
  storage.adjustCharacterCurrency(campaign.id, character.id, "gold", -50);

  const issues = runDataIntegrityChecks();
  const found = issues.find(
    (i) => i.check === "negative_currency_balance" && i.details?.characterId === character.id,
  );
  assert.ok(found, "expected a negative_currency_balance issue");
});

test("runDataIntegrityChecks: flags more than one simultaneously active encounter for the same campaign", () => {
  const { campaign } = makeCampaignAndCharacter("dualencounter");
  storage.createEncounter({ campaignId: campaign.id, status: "active", round: 1, turnIndex: 0, participants: "[]" });
  storage.createEncounter({ campaignId: campaign.id, status: "active", round: 1, turnIndex: 0, participants: "[]" });

  const issues = runDataIntegrityChecks();
  const found = issues.find((i) => i.check === "multiple_active_encounters" && i.details?.campaignId === campaign.id);
  assert.ok(found, "expected a multiple_active_encounters issue");
});
