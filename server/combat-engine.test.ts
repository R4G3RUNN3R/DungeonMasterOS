// server/combat-engine.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { startEncounter } from "./combat-engine";

function fakeStorage(characters: any[], items: any[] = []) {
  const encounters: any[] = [];
  const rollLog: any[] = [];
  return {
    getCharactersByCampaign: (_id: number) => characters,
    createEncounter: (data: any) => { const row = { id: encounters.length + 1, ...data }; encounters.push(row); return row; },
    createRollLogEntry: (entry: any) => { rollLog.push(entry); return entry; },
    getActiveEffectsByCharacter: (_id: number) => [],
    getItemsByCharacter: (_id: number) => items,
    _rollLog: rollLog,
  };
}

test("startEncounter: no tag returns null", async () => {
  const storage = fakeStorage([]);
  const result = await startEncounter({ campaignId: 1, rawResponse: "Just narration.", powerLevel: "standard", storage: storage as any, rng: () => 0.5 });
  assert.equal(result, null);
});

test("startEncounter: seeds PC participants from real character stats, not the AI tag", async () => {
  const kira = { id: 1, name: "Kira", str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10, ac: 15, damageDice: "1d8", attackAbility: "str", level: 3, hp: 22, maxHp: 22, proficiencies: "[]" };
  const storage = fakeStorage([kira]);
  const tag = '[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]';
  const encounter = await startEncounter({ campaignId: 1, rawResponse: tag, powerLevel: "standard", storage: storage as any, rng: () => 0.5 });

  assert.ok(encounter);
  const participants = JSON.parse(encounter!.participants);
  const kiraParticipant = participants.find((p: any) => p.name === "Kira");
  assert.equal(kiraParticipant.ac, 15); // from the real character row, not invented
  assert.equal(kiraParticipant.currentHp, 22);
  assert.equal(kiraParticipant.type, "character");
});

test("startEncounter: clamps NPC stats against powerLevel before persisting", async () => {
  const storage = fakeStorage([{ id: 1, name: "Kira", str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ac: 10, damageDice: "1d4", attackAbility: "str", level: 1, hp: 10, maxHp: 10, proficiencies: "[]" }]);
  const tag = '[COMBAT_START]{"npcs":[{"name":"Ancient Dragon","hp":99999,"ac":99,"attackBonus":99,"damageDice":"20d20"}]}[/COMBAT_START]';
  const encounter = await startEncounter({ campaignId: 1, rawResponse: tag, powerLevel: "low", storage: storage as any, rng: () => 0.5 });

  const participants = JSON.parse(encounter!.participants);
  const dragon = participants.find((p: any) => p.name === "Ancient Dragon");
  assert.equal(dragon.currentHp, 20); // clamped to "low" tier max
  assert.equal(dragon.ac, 14);
});

test("startEncounter: an equipped mainHand weapon's damage dice overrides the character's base damageDice", async () => {
  const kira = { id: 1, name: "Kira", str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10, ac: 15, damageDice: "1d4", attackAbility: "str", level: 3, hp: 22, maxHp: 22, proficiencies: "[]" };
  const items = [
    { equipped: true, slot: "mainHand", weaponDamageDice: "2d6", statMods: "[]", name: "Greatsword" },
    { equipped: true, slot: "offHand", weaponDamageDice: "1d6", statMods: "[]", name: "Dagger" }, // not mainHand — must not win
  ];
  const storage = fakeStorage([kira], items);
  const tag = '[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]';
  const encounter = await startEncounter({ campaignId: 1, rawResponse: tag, powerLevel: "standard", storage: storage as any, rng: () => 0.5 });

  const kiraParticipant = JSON.parse(encounter!.participants).find((p: any) => p.name === "Kira");
  assert.equal(kiraParticipant.damageDice, "2d6");
});

test("startEncounter: no mainHand weapon equipped falls back to the character's base damageDice", async () => {
  const kira = { id: 1, name: "Kira", str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10, ac: 15, damageDice: "1d4", attackAbility: "str", level: 3, hp: 22, maxHp: 22, proficiencies: "[]" };
  const storage = fakeStorage([kira], []); // nothing equipped
  const tag = '[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]';
  const encounter = await startEncounter({ campaignId: 1, rawResponse: tag, powerLevel: "standard", storage: storage as any, rng: () => 0.5 });

  const kiraParticipant = JSON.parse(encounter!.participants).find((p: any) => p.name === "Kira");
  assert.equal(kiraParticipant.damageDice, "1d4"); // unarmed/innate, unaffected
});

test("startEncounter: rolls and logs initiative for every participant, sets round=1 turnIndex=0", async () => {
  const storage = fakeStorage([{ id: 1, name: "Kira", str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10, ac: 10, damageDice: "1d4", attackAbility: "str", level: 1, hp: 10, maxHp: 10, proficiencies: "[]" }]);
  const tag = '[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]';
  const encounter = await startEncounter({ campaignId: 1, rawResponse: tag, powerLevel: "standard", storage: storage as any, rng: () => 9 / 20 });

  assert.equal(encounter!.round, 1);
  assert.equal(encounter!.turnIndex, 0);
  assert.equal(encounter!.status, "active");
  assert.equal(storage._rollLog.filter((r: any) => r.rollType === "initiative").length, 2);
});
