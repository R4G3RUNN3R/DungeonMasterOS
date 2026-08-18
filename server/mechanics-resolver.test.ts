// server/mechanics-resolver.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCheckTag } from "./mechanics-resolver";

function fakeStorage(character: any) {
  const logged: any[] = [];
  return {
    getCharacterByName: (_campaignId: number, _name: string) => character,
    createRollLogEntry: (entry: any) => { logged.push(entry); return { id: logged.length, ...entry }; },
    _logged: logged,
  };
}

test("resolveCheckTag: no tag in the AI response returns null (falls back to plain narration)", async () => {
  const storage = fakeStorage({ id: 1, level: 1, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, proficiencies: "[]" });
  const result = await resolveCheckTag({
    campaignId: 1,
    rawResponse: "Just narration, no check needed.",
    storage: storage as any,
    rng: () => 0.5,
    narrate: async () => "unused",
  });
  assert.equal(result, null);
});

test("resolveCheckTag: character name that doesn't resolve returns null", async () => {
  const storage = fakeStorage(undefined);
  const result = await resolveCheckTag({
    campaignId: 1,
    rawResponse: '[CHECK]{"character":"Nobody","ability":"str","dc":10}[/CHECK]',
    storage: storage as any,
    rng: () => 0.5,
    narrate: async () => "unused",
  });
  assert.equal(result, null);
});

test("resolveCheckTag: valid check resolves, logs the roll, and narrates the fixed outcome", async () => {
  const storage = fakeStorage({ id: 7, level: 5, str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10, proficiencies: JSON.stringify(["Stealth"]) });
  let narratePrompt = "";
  const result = await resolveCheckTag({
    campaignId: 1,
    rawResponse: 'Before you decide: [CHECK]{"character":"Kira","skill":"Stealth","dc":14}[/CHECK]',
    storage: storage as any,
    rng: () => 14 / 20, // rolls a 15
    narrate: async (prompt: string) => { narratePrompt = prompt; return "You slip past unnoticed."; },
  });

  assert.ok(result);
  assert.equal(result!.cleanContent, "You slip past unnoticed.");
  assert.equal(result!.rollData.rollType, "check");
  assert.equal(result!.rollData.total, 15 + 3 + 3); // dex mod +3, proficiency +3 (level 5)
  assert.equal(result!.rollData.outcome, "success");
  assert.match(narratePrompt, /SUCCESS/);
  assert.equal(storage._logged.length, 1);
  assert.equal(storage._logged[0].statUsed, "dex.stealth");
});

test("resolveCheckTag: failed narration call falls back to a templated outcome description, not a throw", async () => {
  const storage = fakeStorage({ id: 7, level: 1, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, proficiencies: "[]" });
  const result = await resolveCheckTag({
    campaignId: 1,
    rawResponse: '[CHECK]{"character":"Kira","ability":"str","dc":25}[/CHECK]',
    storage: storage as any,
    rng: () => 1 / 20, // rolls a 2
    narrate: async () => { throw new Error("AI unavailable"); },
  });
  assert.ok(result);
  assert.equal(result!.rollData.outcome, "failure");
  assert.match(result!.cleanContent, /fail|unsuccessful|falls short/i);
});
