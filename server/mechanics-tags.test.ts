// server/mechanics-tags.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractCheckTag,
  extractCombatStartTag,
  extractAttackTag,
  extractSurrenderTag,
  extractTitleCandidateTag,
  extractTitleWitnessTag,
} from "./mechanics-tags";

test("extractTitleCandidateTag: parses a valid self-declared alias tag", () => {
  const text = 'He straightens his mask. [TITLE_CANDIDATE]{"character":"Hennet","title":"Shadow"}[/TITLE_CANDIDATE]';
  const result = extractTitleCandidateTag(text);
  assert.ok(result);
  assert.equal(result!.character, "Hennet");
  assert.equal(result!.title, "Shadow");
});

test("extractTitleCandidateTag: returns null with no tag present", () => {
  assert.equal(extractTitleCandidateTag("Just narration."), null);
});

test("extractTitleCandidateTag: returns null when title is missing", () => {
  assert.equal(extractTitleCandidateTag('[TITLE_CANDIDATE]{"character":"Hennet"}[/TITLE_CANDIDATE]'), null);
});

test("extractTitleWitnessTag: parses a valid npc-usage tag", () => {
  const text = '"Wait... you\'re Shadow?" Thrain asks. [TITLE_WITNESS]{"character":"Hennet","title":"Shadow","npc":"Thrain"}[/TITLE_WITNESS]';
  const result = extractTitleWitnessTag(text);
  assert.ok(result);
  assert.equal(result!.character, "Hennet");
  assert.equal(result!.title, "Shadow");
  assert.equal(result!.npc, "Thrain");
});

test("extractTitleWitnessTag: returns null when npc is missing", () => {
  assert.equal(extractTitleWitnessTag('[TITLE_WITNESS]{"character":"Hennet","title":"Shadow"}[/TITLE_WITNESS]'), null);
});

test("extractTitleWitnessTag: returns null on malformed JSON", () => {
  assert.equal(extractTitleWitnessTag("[TITLE_WITNESS]{not valid[/TITLE_WITNESS]"), null);
});

test("extractCheckTag: parses a valid tag", () => {
  const text = 'The lock looks tricky. [CHECK]{"character":"Kira","skill":"Sleight of Hand","dc":14,"reason":"picking the lock"}[/CHECK]';
  const result = extractCheckTag(text);
  assert.ok(result);
  assert.equal(result!.character, "Kira");
  assert.equal(result!.skill, "Sleight of Hand");
  assert.equal(result!.dc, 14);
  assert.equal(result!.reason, "picking the lock");
});

test("extractCheckTag: returns null when no tag present", () => {
  assert.equal(extractCheckTag("Just narration, no mechanics here."), null);
});

test("extractCheckTag: returns null on malformed JSON", () => {
  assert.equal(extractCheckTag("[CHECK]{not valid json[/CHECK]"), null);
});

test("extractCheckTag: clamps an out-of-range dc to 5-25 rather than rejecting the tag", () => {
  assert.equal(extractCheckTag('[CHECK]{"character":"Kira","ability":"dex","dc":99}[/CHECK]')!.dc, 25);
  assert.equal(extractCheckTag('[CHECK]{"character":"Kira","ability":"dex","dc":0}[/CHECK]')!.dc, 5);
  assert.equal(extractCheckTag('[CHECK]{"character":"Kira","ability":"dex","dc":-40}[/CHECK]')!.dc, 5);
});

test("extractCheckTag: returns null when dc is missing or not a number at all (a genuinely malformed tag)", () => {
  assert.equal(extractCheckTag('[CHECK]{"character":"Kira","ability":"dex"}[/CHECK]'), null);
  assert.equal(extractCheckTag('[CHECK]{"character":"Kira","ability":"dex","dc":"fourteen"}[/CHECK]'), null);
});

test("extractCheckTag: returns null when character is missing", () => {
  assert.equal(extractCheckTag('[CHECK]{"ability":"dex","dc":14}[/CHECK]'), null);
});

test("extractCheckTag: returns null when neither ability nor skill is present", () => {
  assert.equal(extractCheckTag('[CHECK]{"character":"Kira","dc":14}[/CHECK]'), null);
});

test("extractCheckTag: accepts isSave flag", () => {
  const result = extractCheckTag('[CHECK]{"character":"Kira","ability":"con","dc":15,"isSave":true}[/CHECK]');
  assert.equal(result!.isSave, true);
});

test("extractCombatStartTag: parses participants and npcs", () => {
  const text = '[COMBAT_START]{"participants":["Kira","Doran"],"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]';
  const result = extractCombatStartTag(text);
  assert.ok(result);
  assert.deepEqual(result!.participants, ["Kira", "Doran"]);
  assert.equal(result!.npcs.length, 1);
  assert.equal(result!.npcs[0].name, "Goblin");
});

test("extractCombatStartTag: participants defaults to undefined when omitted", () => {
  const result = extractCombatStartTag('[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]');
  assert.ok(result);
  assert.equal(result!.participants, undefined);
});

test("extractCombatStartTag: returns null when npcs is missing or empty entries are malformed", () => {
  assert.equal(extractCombatStartTag('[COMBAT_START]{"npcs":[{"name":"Goblin"}]}[/COMBAT_START]'), null);
  assert.equal(extractCombatStartTag('[COMBAT_START]{}[/COMBAT_START]'), null);
});

// Regression test for final-review issue #4: an unbounded npcs array lets
// one metered turn cascade into dozens of synchronous AI calls (two per NPC
// turn) while holding the campaign mutex. extractCombatStartTag validates
// each NPC's shape but never capped how many there are. Matches the
// codebase's existing "clamp, never reject" posture (see extractCheckTag's
// dc clamping) — truncate to the cap rather than rejecting the whole tag.
test("extractCombatStartTag: clamps an oversized npcs array to the 8-NPC cap rather than rejecting the tag", () => {
  const npcs = Array.from({ length: 12 }, (_, i) => ({ name: `Goblin${i}`, hp: 11, ac: 13, attackBonus: 3, damageDice: "1d6" }));
  const result = extractCombatStartTag(`[COMBAT_START]{"npcs":${JSON.stringify(npcs)}}[/COMBAT_START]`);
  assert.ok(result, "an oversized npcs array must still produce a valid tag, not null");
  assert.equal(result!.npcs.length, 8);
  assert.deepEqual(result!.npcs.map((n) => n.name), npcs.slice(0, 8).map((n) => n.name));
});

test("extractCombatStartTag: leaves an npcs array at or under the cap untouched", () => {
  const npcs = Array.from({ length: 8 }, (_, i) => ({ name: `Goblin${i}`, hp: 11, ac: 13, attackBonus: 3, damageDice: "1d6" }));
  const result = extractCombatStartTag(`[COMBAT_START]{"npcs":${JSON.stringify(npcs)}}[/COMBAT_START]`);
  assert.equal(result!.npcs.length, 8);
});

test("extractAttackTag: parses attacker and target, ignores extra fields", () => {
  const result = extractAttackTag('[ATTACK]{"attacker":"Kira","target":"Goblin","bonus":99,"damage":"10d10"}[/ATTACK]');
  assert.ok(result);
  assert.equal(result!.attacker, "Kira");
  assert.equal(result!.target, "Goblin");
  assert.equal((result as any).bonus, undefined); // extra fields are not carried through
  assert.equal((result as any).damage, undefined);
});

test("extractAttackTag: returns null when attacker or target missing", () => {
  assert.equal(extractAttackTag('[ATTACK]{"attacker":"Kira"}[/ATTACK]'), null);
  assert.equal(extractAttackTag('[ATTACK]{"target":"Goblin"}[/ATTACK]'), null);
});

// 2026-08-18: a [WORLD_STATE] leak in production traced to the model
// wrapping a tag in markdown bold, which broke a strict JSON.parse and fell
// back to showing the raw tagged text to the player (see
// internal-tag-guard.test.ts). Every tag here shares that same extraction
// pattern, so the same markdown-wrapping failure mode is worth covering for
// each one — even though these particular tags are never themselves shown
// to the player when they DO parse, an unparsed one still leaves raw
// protocol text sitting in the narration for stripInternalTags to catch.
test("extractAttackTag: still parses when the model wraps the tag in markdown bold", () => {
  const result = extractAttackTag('The blade swings. **[ATTACK]**{"attacker":"Kira","target":"Goblin"}**[/ATTACK]**');
  assert.ok(result);
  assert.equal(result!.attacker, "Kira");
  assert.equal(result!.target, "Goblin");
});

test("extractCheckTag: still parses when the model wraps the tag in markdown bold", () => {
  const result = extractCheckTag('She tries the lock. **[CHECK]**{"character":"Kira","skill":"Sleight of Hand","dc":15}**[/CHECK]**');
  assert.ok(result);
  assert.equal(result!.character, "Kira");
  assert.equal(result!.dc, 15);
});

test("extractCombatStartTag: still parses when the model wraps the tag in markdown bold", () => {
  const text = '**[COMBAT_START]**{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}**[/COMBAT_START]**';
  const result = extractCombatStartTag(text);
  assert.ok(result);
  assert.equal(result!.npcs[0].name, "Goblin");
});

