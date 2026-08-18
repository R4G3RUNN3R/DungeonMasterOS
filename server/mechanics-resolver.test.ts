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

test("resolveCheckTag: valid 5e check keeps the existing proficiency behavior", async () => {
  const storage = fakeStorage({ id: 7, level: 5, str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10, proficiencies: JSON.stringify(["Stealth"]) });
  let narratePrompt = "";
  const result = await resolveCheckTag({
    campaignId: 1,
    rawResponse: 'Before you decide: [CHECK]{"character":"Kira","skill":"Stealth","dc":14}[/CHECK]',
    storage: storage as any,
    rng: () => 14 / 20,
    narrate: async (prompt: string) => { narratePrompt = prompt; return "You slip past unnoticed."; },
  });

  assert.ok(result);
  assert.ok(result.rollData);
  assert.equal(result.cleanContent, "You slip past unnoticed.");
  assert.equal(result.rollData.rollType, "check");
  assert.equal(result.rollData.total, 15 + 3 + 3);
  assert.equal(result.rollData.outcome, "success");
  assert.match(narratePrompt, /SUCCESS/);
  assert.equal(storage._logged.length, 1);
  assert.equal(storage._logged[0].statUsed, "dex.stealth");
});

test("resolveCheckTag: D&D 3.5 uses recorded Tumble ranks rather than a level-based proficiency approximation", async () => {
  const storage = fakeStorage({
    id: 8,
    name: "Kira",
    level: 5,
    str: 10,
    dex: 16,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    charClass: "Rogue",
    proficiencies: "[]",
    characterData: JSON.stringify({ dnd35Sheet: { skills: [{ name: "Tumble", ranks: 5 }] } }),
  });

  const result = await resolveCheckTag({
    campaignId: 1,
    rawResponse: '[CHECK]{"character":"Kira","skill":"Tumble","ability":"str","dc":20}[/CHECK]',
    storage: storage as any,
    ruleset: "dnd35e",
    rng: () => 14 / 20,
    narrate: async () => "You roll beneath the blade and keep moving.",
  });

  assert.ok(result?.rollData);
  assert.equal(result.rollData.total, 15 + 3 + 5, "Tumble must use Dex + recorded ranks; the AI-supplied Str ability is ignored");
  assert.equal(result.rollData.statUsed, "dex.tumble");
  assert.equal(storage._logged[0].proficiencyBonus, 5, "roll log stores ranks in the legacy proficiencyBonus audit column for 3.5 skills");
});

test("resolveCheckTag: a trained-only 3.5 skill with zero ranks is not rolled", async () => {
  const storage = fakeStorage({
    id: 9,
    name: "Kira",
    level: 5,
    str: 10,
    dex: 16,
    con: 10,
    int: 14,
    wis: 10,
    cha: 14,
    charClass: "Rogue",
    proficiencies: "[]",
    characterData: JSON.stringify({ dnd35Sheet: { skills: [] } }),
  });
  let prompt = "";
  const result = await resolveCheckTag({
    campaignId: 1,
    rawResponse: '[CHECK]{"character":"Kira","skill":"Use Magic Device","dc":20}[/CHECK]',
    storage: storage as any,
    ruleset: "dnd35e",
    rng: () => { throw new Error("RNG must not be called for an untrained trained-only skill"); },
    narrate: async (value: string) => { prompt = value; return "You cannot make sense of the device's activation method."; },
  });

  assert.ok(result);
  assert.equal(result.rollData, null);
  assert.equal(storage._logged.length, 0);
  assert.match(prompt, /trained-only/i);
  assert.match(prompt, /No d20 roll/i);
});

test("resolveCheckTag: an untrained-allowed 3.5 skill can roll with zero ranks", async () => {
  const storage = fakeStorage({
    id: 10,
    name: "Kira",
    level: 3,
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 14,
    cha: 10,
    charClass: "Fighter",
    proficiencies: "[]",
    characterData: JSON.stringify({ dnd35Sheet: { skills: [] } }),
  });

  const result = await resolveCheckTag({
    campaignId: 1,
    rawResponse: '[CHECK]{"character":"Kira","skill":"Spot","dc":15}[/CHECK]',
    storage: storage as any,
    ruleset: "dnd35e",
    rng: () => 14 / 20,
    narrate: async () => "You notice the movement in time.",
  });

  assert.ok(result?.rollData);
  assert.equal(result.rollData.total, 15 + 2);
  assert.equal(result.rollData.statUsed, "wis.spot");
});

test("resolveCheckTag: failed narration call falls back to a templated outcome description, not a throw", async () => {
  const storage = fakeStorage({ id: 7, level: 1, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, proficiencies: "[]" });
  const result = await resolveCheckTag({
    campaignId: 1,
    rawResponse: '[CHECK]{"character":"Kira","ability":"str","dc":25}[/CHECK]',
    storage: storage as any,
    rng: () => 1 / 20,
    narrate: async () => { throw new Error("AI unavailable"); },
  });
  assert.ok(result?.rollData);
  assert.equal(result.rollData.outcome, "failure");
  assert.match(result.cleanContent, /fail|unsuccessful|falls short/i);
});
