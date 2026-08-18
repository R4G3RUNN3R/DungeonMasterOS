// server/internal-tag-guard.test.ts
//
// 2026-08-18 production incident: message id 381 in campaign 19 leaked a
// [WORLD_STATE] block verbatim into a player's chat. The AI wrapped the
// tags in markdown bold; the old strict regex still matched (bracket text
// is a substring of the bolded version) but JSON.parse threw on the
// trailing "**" left in the captured payload, and the catch block's
// fallback — `cleanContent: text`, the entire raw response — was persisted
// and shown to the player. These tests use the actual captured production
// text (byte-for-byte, from the live database) as the primary regression
// case, plus the broader class of malformed-output scenarios the incident
// implies.

import { test } from "node:test";
import assert from "node:assert/strict";
import { stripInternalTags, containsInternalTagMarker, extractJsonObject, tagBlockPattern } from "./internal-tag-guard";
import { extractWorldState } from "./dm-engine";

// Exact content of production message id 381 (campaign 19), captured
// directly from the live database during the incident investigation.
const LEAKED_PRODUCTION_MESSAGE =
  "You tell Rill about coming up in the gutters — nothing to buy with until you were ten, so nobody bothered selling you anything — and make it clear that going back to living that way holds no fear for you. You're still smiling when you say it.\n\n" +
  'Rill takes it without much reaction. "Then you\'ll know it\'s slower than it sounds," he says. "Nobody starves here. They just get watched, and get tired, and get gone."\n\n' +
  'Vance is already dragging a second ledger toward himself, the day\'s business. "Master Uthellien. The door."\n\n' +
  "**[WORLD_STATE]**\n" +
  '{"flags":["hennet_threatened_vances_people","vance_letter_north_written_today","hennet_dismissed_from_vances_office"]}\n' +
  "**[/WORLD_STATE]**";

test("extractWorldState: the exact production leak — markdown-bolded tags — is fully stripped and correctly parsed", () => {
  const { cleanContent, worldState } = extractWorldState(LEAKED_PRODUCTION_MESSAGE);

  assert.ok(!cleanContent.includes("WORLD_STATE"), "cleanContent must never contain the tag name");
  assert.ok(!cleanContent.includes("**"), "the markdown bold wrapper must not survive either");
  assert.ok(cleanContent.startsWith("You tell Rill about coming up in the gutters"));
  assert.ok(cleanContent.trim().endsWith('"Master Uthellien. The door."'));

  assert.ok(worldState, "the JSON payload should still parse despite the markdown wrapping");
  assert.deepEqual(worldState.flags, [
    "hennet_threatened_vances_people",
    "vance_letter_north_written_today",
    "hennet_dismissed_from_vances_office",
  ]);
});

test("stripInternalTags: removes a plain, unwrapped [WORLD_STATE] block", () => {
  const text = 'Narration here.\n\n[WORLD_STATE]\n{"flags":["a_flag"]}\n[/WORLD_STATE]';
  const result = stripInternalTags(text);
  assert.equal(result, "Narration here.");
});

test("stripInternalTags: removes tags wrapped in single asterisks or underscores too", () => {
  for (const [open, close] of [["*", "*"], ["_", "_"], ["__", "__"]]) {
    const text = `Narration.\n\n${open}[WORLD_STATE]${close}\n{"flags":["x"]}\n${open}[/WORLD_STATE]${close}`;
    assert.equal(stripInternalTags(text), "Narration.", `failed for wrapper ${open}...${close}`);
  }
});

test("stripInternalTags: strips every known internal tag, not just WORLD_STATE", () => {
  const cases = [
    'Narration. [CHECK]{"character":"Kira","skill":"Stealth","dc":15}[/CHECK]',
    'Narration. [COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]',
    'Narration. [ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]',
    'Narration. [SURRENDER]{"npcNames":["Goblin"],"reason":"scared"}[/SURRENDER]',
    'Narration. [TITLE_CANDIDATE]{"character":"Kira","title":"Shadow"}[/TITLE_CANDIDATE]',
    'Narration. [TITLE_WITNESS]{"character":"Kira","title":"Shadow","npc":"Thrain"}[/TITLE_WITNESS]',
    "Narration. [SHOP]\nMerchant: Old Tom\nCurrency: gold\n[/SHOP]",
  ];
  for (const text of cases) {
    const result = stripInternalTags(text);
    assert.equal(result, "Narration.", `failed to strip: ${text}`);
  }
});

test("stripInternalTags: fails closed — an unclosed/malformed tag truncates rather than ever showing raw protocol text", () => {
  const text = 'Some real narration the player should see.\n\n[WORLD_STATE]\n{"flags": [incomplete json that never clo';
  const result = stripInternalTags(text);
  assert.equal(result, "Some real narration the player should see.");
  assert.ok(!containsInternalTagMarker(result));
});

test("stripInternalTags: multiple state blocks in one response are all removed", () => {
  const text = 'A. [WORLD_STATE]{"flags":["x"]}[/WORLD_STATE] B. [WORLD_STATE]{"flags":["y"]}[/WORLD_STATE] C.';
  const result = stripInternalTags(text);
  assert.ok(!containsInternalTagMarker(result));
  assert.ok(result.includes("A.") && result.includes("B.") && result.includes("C."));
});

test("stripInternalTags: ordinary narration with no tags is untouched", () => {
  const text = "The tavern is loud tonight, and the fire crackles in the hearth.";
  assert.equal(stripInternalTags(text), text);
});

test("containsInternalTagMarker: detects a bare marker even without a matching close", () => {
  assert.equal(containsInternalTagMarker("some text [WORLD_STATE] more text"), true);
  assert.equal(containsInternalTagMarker("ordinary narration"), false);
});

test("extractJsonObject: recovers JSON with trailing junk after the closing brace (the exact incident case)", () => {
  const captured = '\n{"flags":["a","b"]}\n**'; // what match[1] looked like for the leaked message
  const result = extractJsonObject(captured);
  assert.deepEqual(result, { flags: ["a", "b"] });
});

test("extractJsonObject: still returns null for genuinely unparseable content", () => {
  assert.equal(extractJsonObject("not json at all"), null);
});

test("extractWorldState: no block present returns the original text untouched and worldState null", () => {
  const text = "Just plain narration with no tags at all.";
  const { cleanContent, worldState } = extractWorldState(text);
  assert.equal(cleanContent, text);
  assert.equal(worldState, null);
});

test("extractWorldState: malformed/incomplete JSON inside a well-formed tag pair still strips the tag and returns worldState null", () => {
  const text = 'Good narration here.\n\n[WORLD_STATE]\n{not valid json\n[/WORLD_STATE]';
  const { cleanContent, worldState } = extractWorldState(text);
  assert.equal(cleanContent, "Good narration here.");
  assert.equal(worldState, null);
});

test("tagBlockPattern: capture group still isolates inner content for non-JSON tags like [SHOP]", () => {
  const text = "[SHOP]\nMerchant: Old Tom\nCurrency: gold\n1 | 2 | 3 | desc\n[/SHOP]";
  const match = text.match(tagBlockPattern("SHOP"));
  assert.ok(match);
  assert.ok(match![1].includes("Merchant: Old Tom"));
});
