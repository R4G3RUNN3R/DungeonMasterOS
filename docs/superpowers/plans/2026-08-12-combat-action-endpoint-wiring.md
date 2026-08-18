# Combat Action-Endpoint Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-built combat engine (Tasks 1-12 of the original dice-mechanics-engine plan) actually reachable by real players, while closing a genuine server-authority hole discovered during design review — the AI can no longer end combat or defeat NPCs merely by declaring it so.

**Architecture:** Replace `[COMBAT_END]`/`applySurrenderTag` with a validated, per-NPC `[SURRENDER]` mechanic. Add a `advanceAndResolveTurns` orchestrator (in `server/npc-turn.ts`, not `combat-engine.ts` — avoids a circular import, since `npc-turn.ts` already imports from `combat-engine.ts`) that cascades consecutive NPC turns. Teach the DM system prompt about the mechanical tags. Wire all of it into the live `POST /api/campaigns/:id/action` handler, with `handleAction`/`handleFlee` exported and given an injectable AI-dependency parameter so the new behavior can be tested in-process without hitting the real Anthropic API. Fold in six previously-logged defensive gaps at the same production boundary.

**Tech Stack:** Same as the rest of this codebase — TypeScript, Node's built-in `node:test`, Drizzle/better-sqlite3, Express. No new dependencies.

## Global Constraints

- DC clamping stays 5-25 (unrelated to this plan, but no task here may touch it).
- 0 HP = incapacitated, never dead, for v1 (unrelated to this plan, but no task here may introduce death/removal logic).
- Server authority: the AI proposes; the server validates, rolls, mutates, logs, and decides every outcome. This plan specifically closes the one place that guarantee was violated (`[COMBAT_END]`).
- `[SURRENDER]`'s `reason` field is flavor only — never parsed, never branched on.
- A `[SURRENDER]` proposal can never mutate a PC, under any circumstance, including name collision.
- Every new call this plan adds must run inside the existing `withCampaignLock`-wrapped `handleAction`/`handleFlee`, after the existing `clientSubmissionId` dedup short-circuit — never in a new code path that bypasses either.
- Off-turn player submissions fall back to plain narration silently — never an explicit rejection.
- Each NPC turn in a cascade gets its own persisted message and its own WebSocket broadcast — never collapsed into one combined message.
- Existing non-combat behavior (the majority of turns, and the two other call sites of `generateDMResponse`) must be provably unaffected.

---

### Task 1: Replace `[COMBAT_END]` with a validated `[SURRENDER]` tag

**Files:**
- Modify: `server/mechanics-tags.ts`
- Modify: `server/combat-engine.ts`
- Modify: `server/combat-engine-end.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `extractSurrenderTag(text: string): SurrenderTag | null` (`SurrenderTag = { npcNames: string[]; reason?: string }`); `applyNpcSurrender(encounterId: number, rawResponse: string, storage): SurrenderResult` (`SurrenderResult = { applied: boolean; surrenderedNames: string[]; message: Message | null }`). Removes `extractCombatEndTag`, `CombatEndTag`, `applySurrenderTag` entirely — nothing else in the codebase calls them, so this is a clean deletion.

- [ ] **Step 1: Remove the old tag, add the new one, in `server/mechanics-tags.ts`**

Delete this block entirely:

```typescript
export interface CombatEndTag {
  reason: string;
}

export function extractCombatEndTag(text: string): CombatEndTag | null {
  const payload = extractJsonPayload(text, "COMBAT_END");
  if (!payload) return null;
  return { reason: typeof payload.reason === "string" ? payload.reason : "" };
}
```

Replace it with:

```typescript
export interface SurrenderTag {
  npcNames: string[];
  reason?: string;
}

export function extractSurrenderTag(text: string): SurrenderTag | null {
  const payload = extractJsonPayload(text, "SURRENDER");
  if (!payload) return null;
  if (!Array.isArray(payload.npcNames) || payload.npcNames.length === 0) return null;
  if (!payload.npcNames.every((n: any) => typeof n === "string" && n.trim().length > 0)) return null;
  return {
    npcNames: payload.npcNames,
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
  };
}
```

- [ ] **Step 2: Write the failing tests — replace `server/combat-engine-end.test.ts`'s `applySurrenderTag` tests**

Replace the whole file with:

```typescript
// server/combat-engine-end.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyNpcSurrender, fleeEncounter } from "./combat-engine";

function fakeStorageWithEncounter(participants: any[], overrides: any = {}) {
  const store = { id: 1, campaignId: 9, status: "active", round: 1, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
  const messages: any[] = [];
  return {
    getEncounter: (_id: number) => ({ ...store }),
    updateEncounter: (_id: number, updates: any) => Object.assign(store, updates),
    tickEffects: (_characterId: number) => [],
    createRollLogEntry: (_entry: any) => {},
    createMessage: (message: any) => { const msg = { id: messages.length + 1, ...message }; messages.push(msg); return msg; },
    _store: store,
    _messages: messages,
  };
}

const kira = { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 };
const goblin1 = { id: "npc-0", type: "npc", name: "Goblin 1", isDefeated: false, fled: false };
const goblin2 = { id: "npc-1", type: "npc", name: "Goblin 2", isDefeated: false, fled: false };

test("applyNpcSurrender: no tag present -> not applied, no mutation", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const result = applyNpcSurrender(1, "just narration", storage as any);
  assert.equal(result.applied, false);
  assert.deepEqual(result.surrenderedNames, []);
  assert.equal(storage._messages.length, 0);
});

test("applyNpcSurrender: a nonexistent NPC name is dropped, not mutated", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const tag = '[SURRENDER]{"npcNames":["Nonexistent Ghost"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.equal(result.applied, true);
  assert.deepEqual(result.surrenderedNames, []);
  const updated = JSON.parse(storage._store.participants).find((p: any) => p.name === "Goblin 1");
  assert.equal(updated.isDefeated, false);
});

test("applyNpcSurrender: an already-defeated NPC name is dropped", () => {
  const defeatedGoblin = { ...goblin1, isDefeated: true };
  const storage = fakeStorageWithEncounter([kira, defeatedGoblin]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.deepEqual(result.surrenderedNames, []);
});

test("applyNpcSurrender: an already-fled NPC name is dropped", () => {
  const fledGoblin = { ...goblin1, fled: true };
  const storage = fakeStorageWithEncounter([kira, fledGoblin]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.deepEqual(result.surrenderedNames, []);
});

test("applyNpcSurrender: a PC name in npcNames never mutates the PC", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const tag = '[SURRENDER]{"npcNames":["Kira"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.deepEqual(result.surrenderedNames, []);
  const updatedKira = JSON.parse(storage._store.participants).find((p: any) => p.name === "Kira");
  assert.equal(updatedKira.isDefeated, false);
});

test("applyNpcSurrender: a mix of one valid and one invalid name only mutates the valid one", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1, goblin2]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1","Nonexistent Ghost"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.deepEqual(result.surrenderedNames, ["Goblin 1"]);
  const participants = JSON.parse(storage._store.participants);
  assert.equal(participants.find((p: any) => p.name === "Goblin 1").isDefeated, true);
  assert.equal(participants.find((p: any) => p.name === "Goblin 2").isDefeated, false);
});

test("applyNpcSurrender: reason content is never parsed/branched on — any reason string produces the same effect", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1"],"reason":"they simply vanish"}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.deepEqual(result.surrenderedNames, ["Goblin 1"]);
});

test("applyNpcSurrender: all NPCs surrendering ends the encounter via the deterministic victory check", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1, goblin2]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1","Goblin 2"],"reason":"they throw down their weapons"}[/SURRENDER]';
  applyNpcSurrender(1, tag, storage as any);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "victory");
});

test("applyNpcSurrender: creates an explicit System message naming who surrendered", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1, goblin2]);
  const tag = '[SURRENDER]{"npcNames":["Goblin 1","Goblin 2"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.equal(result.message?.senderType, "system");
  assert.match(result.message!.content, /Goblin 1/);
  assert.match(result.message!.content, /Goblin 2/);
});

test("applyNpcSurrender: an inactive encounter is a no-op", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1], { status: "ended" });
  const tag = '[SURRENDER]{"npcNames":["Goblin 1"]}[/SURRENDER]';
  const result = applyNpcSurrender(1, tag, storage as any);
  assert.equal(result.applied, true);
  assert.deepEqual(result.surrenderedNames, []);
  assert.equal(storage._messages.length, 0);
});

test("fleeEncounter: marks the named participant fled and removes them from turn order consideration", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const result = fleeEncounter(1, "Kira", storage as any);
  assert.equal(result.fled, true);
  const updated = JSON.parse(storage._store.participants).find((p: any) => p.name === "Kira");
  assert.equal(updated.fled, true);
});

test("fleeEncounter: all PCs fleeing ends the encounter with all_fled", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const result = fleeEncounter(1, "Kira", storage as any);
  assert.equal(result.encounterEnded, true);
  assert.equal(storage._store.outcome, "all_fled");
});

test("fleeEncounter: unknown participant name returns fled: false, no mutation", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const result = fleeEncounter(1, "Nobody", storage as any);
  assert.equal(result.fled, false);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `applyNpcSurrender is not exported` / `extractSurrenderTag is not exported`.

- [ ] **Step 4: Implement `applyNpcSurrender` in `server/combat-engine.ts`**

Change the import line at the top from:

```typescript
import { extractCombatStartTag, extractAttackTag, extractCombatEndTag } from "./mechanics-tags";
```

to:

```typescript
import { extractCombatStartTag, extractAttackTag, extractSurrenderTag } from "./mechanics-tags";
```

Add `createMessage` to the file's local `StorageLike` interface (needed by `applyNpcSurrender`'s explicit-log requirement):

```typescript
interface StorageLike {
  getCharactersByCampaign(campaignId: number): CharacterRow[];
  createEncounter(data: any): Encounter;
  createRollLogEntry(entry: any): any;
  getActiveEffectsByCharacter(characterId: number): Array<{ statMods: string }>;
  getEncounter(id: number): Encounter | undefined;
  tickEffects(characterId: number): unknown[];
  createMessage(message: any): any;
}
```

Delete the entire `applySurrenderTag` function and replace it with:

```typescript
export interface SurrenderResult {
  applied: boolean;
  surrenderedNames: string[];
  message: any | null;
}

export function applyNpcSurrender(
  encounterId: number,
  rawResponse: string,
  storage: StorageLike & { getEncounter(id: number): Encounter | undefined; updateEncounter(id: number, updates: any): void; tickEffects(characterId: number): unknown[]; createMessage(message: any): any },
): SurrenderResult {
  const tag = extractSurrenderTag(rawResponse);
  if (!tag) return { applied: false, surrenderedNames: [], message: null };

  const encounter = storage.getEncounter(encounterId)!;
  if (encounter.status !== "active") return { applied: true, surrenderedNames: [], message: null };

  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  // Validate every proposed name independently: it must exist, must be an
  // NPC (never a PC, even by name collision — this is the specific hole
  // being closed), and must still be alive/present. Anything that fails is
  // silently dropped, not an error and not a partial rejection of the whole
  // proposal — a valid name elsewhere in the same array still applies.
  const validNames = new Set(
    tag.npcNames.filter((name) => {
      const participant = participants.find((p) => p.name === name);
      return !!participant && participant.type === "npc" && !participant.isDefeated && !participant.fled;
    }),
  );

  if (validNames.size === 0) return { applied: true, surrenderedNames: [], message: null };

  const updated = participants.map((p) => (validNames.has(p.name) && p.type === "npc" ? { ...p, isDefeated: true } : p));
  storage.updateEncounter(encounterId, { participants: JSON.stringify(updated) });

  const surrenderedNames = Array.from(validNames);
  const content =
    surrenderedNames.length === 1
      ? `${surrenderedNames[0]} surrenders.`
      : `${surrenderedNames.slice(0, -1).join(", ")} and ${surrenderedNames[surrenderedNames.length - 1]} surrender.`;

  const message = storage.createMessage({
    campaignId: (encounter as any).campaignId,
    sender: "System",
    senderType: "system",
    content,
    messageType: "system",
  });

  // Runs the same deterministic victory check every other mutation goes
  // through — this surrender has no authority to end the encounter itself,
  // only to change the state that check evaluates.
  advanceToNextActionableTurn(encounterId, storage as any);

  return { applied: true, surrenderedNames, message };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `combat-engine-end.test.ts` tests pass.

- [ ] **Step 6: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
git add server/mechanics-tags.ts server/combat-engine.ts server/combat-engine-end.test.ts
git commit -m "Replace [COMBAT_END] with validated per-NPC [SURRENDER] - closes AI combat-end authority hole"
```

---

### Task 2: Defensive hardening at the combat-engine boundary

**Files:**
- Modify: `server/combat-engine.ts`
- Modify: `server/npc-turn.ts`
- Modify: `server/combat-engine-attack.test.ts`
- Modify: `server/npc-turn.test.ts`
- Modify: `server/combat-engine-end.test.ts`
- Modify: `server/combat-engine-turnloop.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `resolveAttack`'s error union gains `"encounter_not_active"`; `resolveNpcTurn` throws if called when the current turn isn't an NPC's; `fleeEncounter` rejects a non-active encounter itself.

- [ ] **Step 1: Write the failing tests**

Add to `server/combat-engine-attack.test.ts` (after the existing tests, using the file's existing `fakeStorageWithEncounter`/`kira`/`goblin` fixtures):

```typescript
test("resolveAttack: rejects an attack against an already-ended encounter without consuming a roll", () => {});
```

Replace that stub with the real test:

```typescript
test("resolveAttack: rejects an attack against an already-ended encounter without consuming a roll", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin], { status: "ended" });
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const result = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => 0.5, narrate: async () => "x" });
  assert.equal((result as any).error, "encounter_not_active");
  assert.equal(storage._rollLog.length, 0);
});
```

Add to `server/npc-turn.test.ts` (after the existing tests, using the file's existing `fakeStorageWithEncounter`/`goblin`/`kira` fixtures):

```typescript
test("resolveNpcTurn: throws if the current turn is not actually an NPC's turn", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]); // turnIndex 0 -> Kira, a PC
  const generateNpcAction = async () => '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  await assert.rejects(
    () => resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 0.5, generateNpcAction, narrate: async () => "x" }),
    /not an NPC/,
  );
});
```

Add to `server/combat-engine-end.test.ts` (after the existing `fleeEncounter` tests):

```typescript
test("fleeEncounter: rejects a non-active encounter without mutation", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1], { status: "ended" });
  const result = fleeEncounter(1, "Kira", storage as any);
  assert.equal(result.fled, false);
  const updated = JSON.parse(storage._store.participants).find((p: any) => p.name === "Kira");
  assert.equal(updated.fled, false);
});
```

Add to `server/combat-engine-turnloop.test.ts` (after the existing "all PCs defeated ends the encounter with defeat" test):

```typescript
test("advanceToNextActionableTurn: mixed defeated+fled PCs still ends in defeat, not all_fled", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: true, fled: false, characterId: 1 },
      { id: "char-2", type: "character", name: "Doran", isDefeated: false, fled: true, characterId: 2 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant, null);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "defeat");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: the `resolveAttack`/`fleeEncounter` tests FAIL on wrong error values (not yet `encounter_not_active`, not yet a rejected `fled: false`); the `resolveNpcTurn` test FAILS because nothing throws yet; the `advanceToNextActionableTurn` mixed test should already PASS (it's a regression test codifying already-correct, already-implemented behavior from Task 11 — confirm it passes as-is; if it doesn't, stop and report, since that would mean the existing precedence logic is broken, not that this test is wrong).

- [ ] **Step 3: Add `resolveAttack`'s active-encounter guard in `server/combat-engine.ts`**

Change the function signature and add the guard right after fetching the encounter:

```typescript
export async function resolveAttack(
  params: ResolveAttackParams,
): Promise<AttackResolution | { error: "no_tag" | "not_your_turn" | "invalid_target" | "encounter_not_active" }> {
  const tag = extractAttackTag(params.rawResponse);
  if (!tag) return { error: "no_tag" };

  const encounter = params.storage.getEncounter(params.encounterId)!;
  if (encounter.status !== "active") return { error: "encounter_not_active" };

  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  const currentTurnParticipant = participants[encounter.turnIndex];
  if (!currentTurnParticipant || currentTurnParticipant.name !== tag.attacker) {
    return { error: "not_your_turn" };
  }

  const target = participants.find((p) => p.name === tag.target);
  if (!target || target.isDefeated || target.fled) {
    return { error: "invalid_target" };
  }

  return executeAttack({ encounterId: params.encounterId, attacker: currentTurnParticipant, target, storage: params.storage, rng: params.rng, narrate: params.narrate });
}
```

- [ ] **Step 4: Add `fleeEncounter`'s active-encounter guard in `server/combat-engine.ts`**

```typescript
export function fleeEncounter(
  encounterId: number,
  participantName: string,
  storage: StorageLike & { getEncounter(id: number): Encounter | undefined; updateEncounter(id: number, updates: any): void; tickEffects(characterId: number): unknown[] },
): { fled: boolean; encounterEnded: boolean } {
  const encounter = storage.getEncounter(encounterId)!;
  if (encounter.status !== "active") return { fled: false, encounterEnded: false };

  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  const target = participants.find((p) => p.name === participantName);
  if (!target) return { fled: false, encounterEnded: false };

  const updated = participants.map((p) => (p.id === target.id ? { ...p, fled: true } : p));
  storage.updateEncounter(encounterId, { participants: JSON.stringify(updated) });

  const advanced = advanceToNextActionableTurn(encounterId, storage as any);

  return { fled: true, encounterEnded: advanced.encounter.status === "ended" };
}
```

- [ ] **Step 5: Add `resolveNpcTurn`'s NPC-turn guard in `server/npc-turn.ts`**

```typescript
export async function resolveNpcTurn(params: ResolveNpcTurnParams): Promise<AttackResolution> {
  const encounter = params.storage.getEncounter(params.encounterId)!;
  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);
  const npc = participants[encounter.turnIndex];

  if (!npc || npc.type !== "npc") {
    throw new Error(`resolveNpcTurn called when the current turn (index ${encounter.turnIndex}) is not an NPC's turn`);
  }

  const livingPcs = participants.filter((p) => p.type === "character" && !p.isDefeated && !p.fled);

  let target: EncounterParticipant | undefined;

  try {
    const aiResponse = await params.generateNpcAction();
    const tag = extractAttackTag(aiResponse);
    if (tag) {
      target = livingPcs.find((p) => p.name === tag.target);
    }
  } catch {
    target = undefined;
  }

  if (!target) {
    target = pickFallbackTarget(livingPcs);
  }

  return executeAttack({
    encounterId: params.encounterId,
    attacker: npc,
    target,
    storage: params.storage,
    rng: params.rng,
    narrate: params.narrate,
  });
}
```

(Only the new guard block at the top changed — the rest of the function is unchanged from its current form.)

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all tests pass, including the six new/modified ones from Step 1.

- [ ] **Step 7: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
git add server/combat-engine.ts server/npc-turn.ts server/combat-engine-attack.test.ts server/npc-turn.test.ts server/combat-engine-end.test.ts server/combat-engine-turnloop.test.ts
git commit -m "Harden combat-engine boundary: active-encounter guards, NPC-turn guard, mixed defeat+flee regression test"
```

---

### Task 3: `clientSubmissionId` dedup ahead of `checkTurnLimit`

**Files:**
- Modify: `server/storage.ts`
- Modify: `server/auth.ts`
- Create: `server/storage-dedup.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `storage.getMessageBySubmissionId(campaignId: number, clientSubmissionId: string): Message | undefined` on `IStorage`/`DatabaseStorage`. `checkTurnLimit` bypasses the turn-limit rejection when the request's `clientSubmissionId` already matches a persisted message.

- [ ] **Step 1: Write the failing test**

```typescript
// server/storage-dedup.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, "test-dedup.db");

process.env.DATABASE_URL = TEST_DB;
const { storage, runMigrations } = await import("./storage");

test("getMessageBySubmissionId: finds an existing message by campaign + submission id", async () => {
  runMigrations();
  const campaign = storage.createCampaign({ userId: 1, name: "Test", tone: "grim", rulesWeight: "light", powerLevel: "standard", worldType: "fantasy", combatStyle: "tactical", storyMode: false, worldGenStyle: "guided" } as any);

  const { message } = storage.createMessageIdempotent({
    campaignId: campaign.id,
    sender: "Kira",
    senderType: "player",
    content: "I attack",
    messageType: "action",
    clientSubmissionId: "sub-abc",
  });

  const found = storage.getMessageBySubmissionId(campaign.id, "sub-abc");
  assert.equal(found?.id, message.id);

  const notFound = storage.getMessageBySubmissionId(campaign.id, "sub-does-not-exist");
  assert.equal(notFound, undefined);

  fs.rmSync(TEST_DB, { force: true });
  fs.rmSync(`${TEST_DB}-wal`, { force: true });
  fs.rmSync(`${TEST_DB}-shm`, { force: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `storage.getMessageBySubmissionId is not a function`. (If the test instead fails on `createCampaign`'s required fields not matching the real `InsertCampaign` shape, read `shared/schema.ts`'s `campaigns` table and adjust the fixture's fields to match exactly — don't guess a second time.)

- [ ] **Step 3: Add `getMessageBySubmissionId` to `server/storage.ts`**

Add to the `IStorage` interface, right after the existing `createMessageIdempotent` line:

```typescript
  createMessageIdempotent(message: InsertMessage & { clientSubmissionId?: string }): { message: Message; wasCreated: boolean };
  getMessageBySubmissionId(campaignId: number, clientSubmissionId: string): Message | undefined;
```

Add the implementation to `DatabaseStorage`, and refactor `createMessageIdempotent` to use it (removing the duplicated SELECT):

```typescript
  getMessageBySubmissionId(campaignId: number, clientSubmissionId: string): Message | undefined {
    return db
      .select()
      .from(messages)
      .where(and(eq(messages.campaignId, campaignId), eq(messages.clientSubmissionId, clientSubmissionId)))
      .get();
  }
  createMessageIdempotent(message: InsertMessage & { clientSubmissionId?: string }): { message: Message; wasCreated: boolean } {
    if (!message.clientSubmissionId) {
      return { message: this.createMessage(message), wasCreated: true };
    }

    const existing = this.getMessageBySubmissionId(message.campaignId, message.clientSubmissionId);
    if (existing) {
      return { message: existing, wasCreated: false };
    }

    try {
      return { message: this.createMessage(message), wasCreated: true };
    } catch (error) {
      // Race: another concurrent request inserted the same submissionId between
      // our SELECT and our INSERT. The unique index rejected us — fetch and
      // return what actually landed, rather than erroring the request.
      const raced = this.getMessageBySubmissionId(message.campaignId, message.clientSubmissionId);
      if (raced) return { message: raced, wasCreated: false };
      throw error;
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: `storage-dedup.test.ts` passes, and every existing `createMessageIdempotent` test (in whichever file added it during the original plan's Task 5) still passes unchanged — the refactor must not change `createMessageIdempotent`'s observable behavior.

- [ ] **Step 5: Wire the bypass into `checkTurnLimit` in `server/auth.ts`**

```typescript
export function checkTurnLimit(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();

  const clientSubmissionId = typeof req.body?.clientSubmissionId === "string" ? req.body.clientSubmissionId : undefined;
  if (clientSubmissionId) {
    const campaignId = Number(req.params.id);
    const existing = storage.getMessageBySubmissionId(campaignId, clientSubmissionId);
    // A retry of an already-processed submission must not be blocked by the
    // turn limit even if the original submission used up the user's last
    // turn — handleAction's own dedup path returns the original result
    // without consuming a new turn, so there's nothing to protect here.
    if (existing) return next();
  }

  const user = req.user;
  const tier = user.tier as TierName;
  const status = user.subscriptionStatus as SubscriptionStatus;
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const limits = getEffectiveLimits(tier, status, trialEndsAt);

  const totalTurns = limits.aiTurnsPerMonth + (user.bonusTurns ?? 0);

  if (user.aiTurnsUsedThisMonth >= totalTurns) {
    return res.status(403).json({
      message: `You've used your ${limits.aiTurnsPerMonth} DM responses this month. ${limits.upgradePrompt}`,
      code: "TURN_LIMIT",
      limit: totalTurns,
      used: user.aiTurnsUsedThisMonth,
      canTopUp: tier !== "free",
    });
  }
  next();
}
```

(Only the new bypass block at the top is added — everything below `const user = req.user;` is unchanged from the current implementation. `req.params.id` is safe to read here since this middleware only ever runs on routes with an `:id` param, per its existing registration on `/api/campaigns/:id/action` and `/api/campaigns/:id/start`, and a request without `clientSubmissionId` — including the `/start` route, which never sends one — skips the new block entirely and behaves exactly as before.)

- [ ] **Step 6: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
git add server/storage.ts server/auth.ts server/storage-dedup.test.ts
git commit -m "Check clientSubmissionId dedup ahead of checkTurnLimit so retries return the original result"
```

---

### Task 4: NPC-turn cascade orchestrator

**Files:**
- Modify: `server/npc-turn.ts`
- Create: `server/npc-turn-orchestrate.test.ts`

**Interfaces:**
- Consumes: `advanceToNextActionableTurn` (needs a new import from `./combat-engine`), `resolveNpcTurn` (already local to this file).
- Produces: `advanceAndResolveTurns(encounterId: number, storage, deps: AdvanceAndResolveTurnsDeps): Promise<any[]>` — resolves a chain of consecutive NPC turns, stopping on a living PC's turn or encounter end, returning every DM message it created, in order.

Placed in `server/npc-turn.ts` rather than `server/combat-engine.ts` (where the design doc first described it) because `npc-turn.ts` already imports from `combat-engine.ts` (`executeAttack`, `EncounterParticipant`, `ResolveAttackParams`) — putting the orchestrator in `combat-engine.ts` would require `combat-engine.ts` to import `resolveNpcTurn` back from `npc-turn.ts`, a circular import. Same behavior, different file, for a concrete technical reason — not a design change.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/npc-turn-orchestrate.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceAndResolveTurns } from "./npc-turn";

function fakeStorageWithEncounter(participants: any[], overrides: any = {}) {
  const store = { id: 1, campaignId: 9, status: "active", round: 1, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
  const messages: any[] = [];
  return {
    getEncounter: (_id: number) => ({ ...store }),
    updateEncounter: (_id: number, updates: any) => Object.assign(store, updates),
    createRollLogEntry: (_entry: any) => {},
    tickEffects: (_characterId: number) => [],
    createMessage: (message: any) => { const msg = { id: messages.length + 1, ...message }; messages.push(msg); return msg; },
    _store: store,
    _messages: messages,
  };
}

function deps(generateNpcAction: any) {
  return {
    generateNpcAction,
    narrate: async () => "Narration.",
    rng: () => 1 / 20, // fumble on every d20 -> misses, no damage, keeps fixtures simple/deterministic
    currentScene: "A tense standoff.",
    broadcast: () => {},
  };
}

const kira = { id: "char-1", type: "character", name: "Kira", currentHp: 20, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", isDefeated: false, fled: false, characterId: 1 };
const goblin1 = { id: "npc-0", type: "npc", name: "Goblin 1", currentHp: 11, maxHp: 11, ac: 13, attackBonus: 3, damageDice: "1d6", isDefeated: false, fled: false };
const goblin2 = { id: "npc-1", type: "npc", name: "Goblin 2", currentHp: 11, maxHp: 11, ac: 13, attackBonus: 3, damageDice: "1d6", isDefeated: false, fled: false };

test("advanceAndResolveTurns: stops immediately on a living PC's turn without calling the NPC-action callback", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]); // turnIndex 0 -> Kira
  let called = false;
  const messages = await advanceAndResolveTurns(1, storage as any, deps(async () => { called = true; return "x"; }));
  assert.equal(called, false);
  assert.deepEqual(messages, []);
});

test("advanceAndResolveTurns: resolves a single NPC turn and stops on the next PC", async () => {
  const storage = fakeStorageWithEncounter([goblin1, kira]); // turnIndex 0 -> Goblin 1
  const generateNpcAction = async (npcName: string, _notes: string, _scene: string, validTargets: string[]) => {
    assert.equal(npcName, "Goblin 1");
    assert.deepEqual(validTargets, ["Kira"]);
    return `[ATTACK]{"attacker":"Goblin 1","target":"Kira"}[/ATTACK]`;
  };
  const messages = await advanceAndResolveTurns(1, storage as any, deps(generateNpcAction));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].senderType, "dm");
  assert.equal(storage._store.turnIndex, 1); // landed back on Kira's turn
});

test("advanceAndResolveTurns: resolves a chain of multiple consecutive NPC turns", async () => {
  const storage = fakeStorageWithEncounter([goblin1, goblin2, kira]); // turnIndex 0 -> Goblin 1, then Goblin 2
  const generateNpcAction = async () => "The goblin snarls."; // no tag -> deterministic fallback targets Kira both times
  const messages = await advanceAndResolveTurns(1, storage as any, deps(generateNpcAction));
  assert.equal(messages.length, 2);
  assert.equal(storage._store.turnIndex, 2); // landed on Kira's turn
});

test("advanceAndResolveTurns: stops when the encounter ends mid-chain", async () => {
  const nearDeadKira = { ...kira, currentHp: 1 };
  const storage = fakeStorageWithEncounter([goblin1, nearDeadKira]);
  const generateNpcAction = async () => `[ATTACK]{"attacker":"Goblin 1","target":"Kira"}[/ATTACK]`;
  const messages = await advanceAndResolveTurns(1, storage as any, {
    ...deps(generateNpcAction),
    rng: () => 19 / 20, // guaranteed hit
  });
  assert.equal(messages.length, 1);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "defeat");
});

test("advanceAndResolveTurns: no-ops on an already-ended encounter", async () => {
  const storage = fakeStorageWithEncounter([goblin1, kira], { status: "ended", outcome: "victory" });
  const messages = await advanceAndResolveTurns(1, storage as any, deps(async () => "x"));
  assert.deepEqual(messages, []);
});

test("advanceAndResolveTurns: returns created messages in resolution order", async () => {
  const storage = fakeStorageWithEncounter([goblin1, goblin2, kira]);
  const generateNpcAction = async () => "The goblin snarls.";
  const messages = await advanceAndResolveTurns(1, storage as any, deps(generateNpcAction));
  assert.equal(messages[0].id, 1);
  assert.equal(messages[1].id, 2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `advanceAndResolveTurns is not exported`.

- [ ] **Step 3: Implement `advanceAndResolveTurns` in `server/npc-turn.ts`**

Change the import line at the top from:

```typescript
import { executeAttack, type AttackResolution, type EncounterParticipant, type ResolveAttackParams } from "./combat-engine";
```

to:

```typescript
import { executeAttack, advanceToNextActionableTurn, type AttackResolution, type EncounterParticipant, type ResolveAttackParams } from "./combat-engine";
```

Append at the end of the file:

```typescript
export interface AdvanceAndResolveTurnsDeps {
  generateNpcAction: (npcName: string, npcNotes: string, currentScene: string, validTargetNames: string[]) => Promise<string>;
  narrate: (prompt: string) => Promise<string>;
  rng: Rng;
  currentScene: string;
  broadcast: (message: any) => void;
}

export async function advanceAndResolveTurns(
  encounterId: number,
  storage: ResolveAttackParams["storage"] & { createMessage(message: any): any },
  deps: AdvanceAndResolveTurnsDeps,
): Promise<any[]> {
  const createdMessages: any[] = [];

  // Bounded the same way advanceToNextActionableTurn's own internal loop is
  // — a real encounter can't have more consecutive NPC turns than there are
  // participants without cycling back to a PC or ending. Defense-in-depth
  // against an unforeseen infinite loop, not an expected code path.
  for (let guard = 0; guard < 100; guard++) {
    const advanced = advanceToNextActionableTurn(encounterId, storage as any);
    if (!advanced.currentParticipant || advanced.currentParticipant.type !== "npc") {
      break; // encounter ended, or it's a living PC's turn — stop and wait for their submission
    }

    const npc = advanced.currentParticipant;
    const encounter = storage.getEncounter(encounterId)!;
    const participants: EncounterParticipant[] = JSON.parse(encounter.participants);
    const validTargetNames = participants
      .filter((p) => p.type === "character" && !p.isDefeated && !p.fled)
      .map((p) => p.name);

    const result = await resolveNpcTurn({
      encounterId,
      storage: storage as any,
      rng: deps.rng,
      generateNpcAction: () => deps.generateNpcAction(npc.name, "", deps.currentScene, validTargetNames),
      narrate: deps.narrate,
    });

    const message = storage.createMessage({
      campaignId: (encounter as any).campaignId,
      sender: "Dungeon Master",
      senderType: "dm",
      content: result.narration,
      messageType: "narration",
      metadata: JSON.stringify({
        roll: {
          attacker: result.attacker,
          target: result.target,
          outcome: result.outcome,
          isCritical: result.isCritical,
          isFumble: result.isFumble,
          damageDealt: result.damageDealt,
        },
      }),
    });
    deps.broadcast(message);
    createdMessages.push(message);

    if (result.encounterEnded) break;
  }

  return createdMessages;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `npc-turn-orchestrate.test.ts` tests pass, and every existing `npc-turn.test.ts`/`combat-engine*.test.ts` test still passes.

- [ ] **Step 5: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
git add server/npc-turn.ts server/npc-turn-orchestrate.test.ts
git commit -m "Add advanceAndResolveTurns: cascades consecutive NPC turns until a living PC's turn or encounter end"
```

---

### Task 5: DM system prompt documents the mechanical tags, with live combat context

**Files:**
- Modify: `server/dm-engine.ts`
- Create: `server/dm-engine-combat-context.test.ts`

**Interfaces:**
- Consumes: `EncounterParticipant`, `Encounter` (types only).
- Produces: `CombatPromptContext` interface; `buildCombatContext(encounter, character): CombatPromptContext | null`; `generateDMResponse`'s signature gains an optional trailing `combatContext` parameter; `buildSystemPrompt` documents `[CHECK]`/`[COMBAT_START]`/`[ATTACK]`/`[SURRENDER]` and injects combat-state context when present.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/dm-engine-combat-context.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCombatContext } from "./dm-engine";

function fakeEncounter(participants: any[], overrides: any = {}) {
  return { id: 1, campaignId: 9, status: "active", round: 2, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
}

test("buildCombatContext: null when no active encounter", () => {
  const result = buildCombatContext(undefined, { name: "Kira" });
  assert.equal(result, null);
});

test("buildCombatContext: correct when it IS the submitting character's turn", () => {
  const encounter = fakeEncounter([
    { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false },
    { id: "npc-0", type: "npc", name: "Goblin 1", isDefeated: false, fled: false },
    { id: "npc-1", type: "npc", name: "Goblin 2", isDefeated: true, fled: false },
  ]);
  const result = buildCombatContext(encounter as any, { name: "Kira" });
  assert.equal(result?.round, 2);
  assert.equal(result?.currentTurnName, "Kira");
  assert.equal(result?.isSubmittingPlayersTurn, true);
  assert.deepEqual(result?.validTargetNames, ["Goblin 1"]); // Goblin 2 is defeated, excluded
});

test("buildCombatContext: correct when it is NOT the submitting character's turn", () => {
  const encounter = fakeEncounter([
    { id: "npc-0", type: "npc", name: "Goblin 1", isDefeated: false, fled: false },
    { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false },
  ]);
  const result = buildCombatContext(encounter as any, { name: "Kira" });
  assert.equal(result?.currentTurnName, "Goblin 1");
  assert.equal(result?.isSubmittingPlayersTurn, false);
  assert.deepEqual(result?.validTargetNames, []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `buildCombatContext is not exported`.

- [ ] **Step 3: Add the MECHANICS prompt section and `combatContext` support to `server/dm-engine.ts`**

Add this import near the top of the file, alongside the existing imports:

```typescript
import type { Encounter } from "../shared/schema";
import type { EncounterParticipant } from "./combat-engine";
```

In `buildSystemPrompt`, insert a new numbered section immediately after the existing "4. ABILITIES" block and before "STYLE:" — change the function signature to accept the optional context and inject it:

```typescript
function buildSystemPrompt(
  campaign: Campaign,
  characters: Character[],
  currencies: CampaignCurrency[],
  combatContext: CombatPromptContext | null = null,
): string {
  const worldState = parseCampaignWorldState(campaign.worldState);

  return `
You are DMS (Dungeon Master Support), the active Dungeon Master for a persistent RPG world inside DungeonMasterOS.

STRICT RULES:
- NEVER control player characters' decisions or dialogue
- NEVER write quoted dialogue for the player character unless the user explicitly asked you to script their speech
- NEVER decide what the player says word-for-word; convert it into intent and outcome instead
- ONLY quote NPC dialogue, and only when it improves the scene
- NEVER retcon past events
- ALWAYS respect cause-and-effect
- Preserve established facts before inventing new ones
- Treat missing but important details as unknown or provisional, not as secret permission to improvise recklessly
- Keep responses between 2-4 concise paragraphs
- Always end with a clear situation or prompt
- NEVER prefix your response with "Dungeon Master:", "DM:", "Narrator:", or any speaker label
- Output narration only; the app already knows the speaker
- Use second-person narration for player outcomes whenever possible
- For a single player character, prefer "you" over repeating their name in narration
- Do not present numbered choice menus unless the player explicitly asked for options

DMS OPERATING STYLE:
- Continuity over novelty
- Consequence over convenience
- Believable NPC behavior over player-pleasing behavior
- NPCs act from motive, fear, loyalty, ambition, leverage, wounds, and bias
- Preserve friction when justified: refusals, bargains, delay, selfishness, manipulation, and betrayal are allowed
- Use grounded, cinematic prose rather than purple prose
- If details are missing, choose the least disruptive compatible assumption
- Keep the world feeling alive: remember who exists, who knows what, who wants what, and what changed recently

CAMPAIGN SETTINGS:
Tone: ${campaign.tone}
Rules Weight: ${campaign.rulesWeight}
Power Level: ${campaign.powerLevel}
World Type: ${campaign.worldType}
Combat Style: ${campaign.combatStyle}
Story Mode: ${campaign.storyMode ? "enabled" : "disabled"}
World Generation Style: ${campaign.worldGenStyle}

CUSTOM WORLD:
${campaign.customWorldPrompt || "None"}

HOMEBREW RULES:
${campaign.homebrewRules || "None"}

CURRENCIES:
${currencies.map((currency) => `${currency.code} (${currency.name}) ${currency.symbol || ""}`).join(", ")}

PARTY:
${characters.map((character) => `${character.name} (${character.race} ${character.charClass})`).join(", ")}

WORLD STATE SNAPSHOT:
${formatWorldStateForPrompt(campaign)}

CAMPAIGN MEMORY:
${formatCampaignMemory(worldState.memory)}

IMPORTANT SYSTEM BEHAVIOR:

1. INVENTORY / REWARDS
If a player gains an item, make it VERY CLEAR:
Example:
"You find a silver dagger and take it."

2. CURRENCY
Explicitly state currency gains/losses:
"You receive 50 gold."

3. SHOPS
When a shop appears, format like this:

[SHOP]
Merchant: Blacksmith Torren
Currency: gold

Items:
- Iron Sword | 25 gold | stock: 3 | A sturdy blade
- Healing Potion | 10 gold | stock: 5 | Restores vitality

[/SHOP]

4. ABILITIES
Clearly state when abilities are gained:
"You unlock the ability: Shadow Step"

5. MECHANICS (dice/combat)
When a player's action calls for an uncertain outcome (a skill attempt, a risky action), propose a check:
[CHECK]{"character":"<name>","skill":"<skill name>","dc":<5-25>}[/CHECK]

When combat breaks out narratively, start it:
[COMBAT_START]{"npcs":[{"name":"...","hp":...,"ac":...,"attackBonus":...,"damageDice":"..."}]}[/COMBAT_START]

During combat, when it is a player character's turn and they declare an attack, emit:
[ATTACK]{"attacker":"<name>","target":"<name>"}[/ATTACK]

During combat, when specific enemies would plausibly surrender, propose it by name — you cannot end combat yourself, only propose which enemies give up:
[SURRENDER]{"npcNames":["<name>", "..."],"reason":"..."}[/SURRENDER]

Never narrate a roll's numeric outcome yourself — emit the tag and let the result come back to you.
Combat only ends when the server determines it has ended — you cannot declare combat over.
${
  combatContext
    ? `
COMBAT STATE:
Round ${combatContext.round}. It is currently ${combatContext.currentTurnName}'s turn.
${
  combatContext.isSubmittingPlayersTurn
    ? `It is YOUR turn. Valid attack targets: ${combatContext.validTargetNames.join(", ") || "none remaining"}.`
    : "It is not your turn — narrate reactions, dialogue, or positioning only; do not resolve an attack for this player."
}
`
    : ""
}

STYLE:
- Cinematic but grounded
- Clear consequences
- No meta talk
- No system explanations
- Resolve the player's declared action instead of rewriting it as fresh player dialogue
- Prefer "you" for the acting character instead of scripting exact player speech
- If the player's action is phrased as dialogue, narrate that they ask, demand, warn, or reveal something without quoting their line back verbatim
- Favor concrete sensory detail and believable reactions over ornamental filler
- End with natural scene pressure or a direct question, not a videogame-style option list

Now continue the story.
`;
}
```

Add the new interface and helper function right after `buildSystemPrompt`'s closing brace:

```typescript
export interface CombatPromptContext {
  round: number;
  currentTurnName: string;
  isSubmittingPlayersTurn: boolean;
  validTargetNames: string[];
}

export function buildCombatContext(
  encounter: Encounter | undefined,
  character: { name: string },
): CombatPromptContext | null {
  if (!encounter) return null;
  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);
  const current = participants[encounter.turnIndex];
  if (!current) return null;

  const isSubmittingPlayersTurn = current.name === character.name;
  const validTargetNames = isSubmittingPlayersTurn
    ? participants.filter((p) => p.type === "npc" && !p.isDefeated && !p.fled).map((p) => p.name)
    : [];

  return {
    round: encounter.round,
    currentTurnName: current.name,
    isSubmittingPlayersTurn,
    validTargetNames,
  };
}
```

Update `generateDMResponse`'s signature to accept and thread through the new parameter — change:

```typescript
export async function generateDMResponse(
  campaign: Campaign,
  characters: Character[],
  history: Message[],
  playerAction: string,
  playerName: string,
  currencies: CampaignCurrency[] = [],
): Promise<string> {
  const system = buildSystemPrompt(campaign, characters, currencies);
```

to:

```typescript
export async function generateDMResponse(
  campaign: Campaign,
  characters: Character[],
  history: Message[],
  playerAction: string,
  playerName: string,
  currencies: CampaignCurrency[] = [],
  combatContext: CombatPromptContext | null = null,
): Promise<string> {
  const system = buildSystemPrompt(campaign, characters, currencies, combatContext);
```

(Nothing else in `generateDMResponse` changes. Both existing call sites in `routes.ts` — the `/start` endpoint and the `/action` endpoint — remain valid without modification, since the new parameter defaults to `null`; the `/action` endpoint is updated to actually pass a real value in Task 6.)

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `dm-engine-combat-context.test.ts` tests pass, and no existing test regresses (nothing currently asserts on `buildSystemPrompt`'s exact string output, so the new section is additive and safe).

- [ ] **Step 5: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
git add server/dm-engine.ts server/dm-engine-combat-context.test.ts
git commit -m "Document mechanical tags in the DM system prompt, inject live combat-turn context"
```

---

### Task 6: Wire everything into the live action endpoint

**Files:**
- Modify: `server/routes.ts`

**Interfaces:**
- Consumes: `applyNpcSurrender`, `resolveAttack`, `startEncounter` (from `combat-engine.ts`); `advanceAndResolveTurns` (from `npc-turn.ts`); `buildCombatContext`, `generateNpcTurnAction` (from `dm-engine.ts`); `parseCampaignWorldState` (from `campaign-memory.ts`, already imported).
- Produces: `handleAction`/`handleFlee` are exported (not just locally-scoped) and gain an optional injected `deps` parameter for their AI-calling functions, defaulting to the real implementations — this is what makes Task 7's end-to-end tests possible without hitting the real Anthropic API. The action endpoint's JSON response gains an additive `npcTurnMessages` field.

- [ ] **Step 1: Update imports in `server/routes.ts`**

Change:

```typescript
import { generateDMResponse, generateOpeningScene, extractWorldState } from "./dm-engine";
```

to:

```typescript
import { generateDMResponse, generateOpeningScene, extractWorldState, generateNpcTurnAction, buildCombatContext } from "./dm-engine";
```

Change:

```typescript
import { fleeEncounter } from "./combat-engine";
```

to:

```typescript
import { fleeEncounter, applyNpcSurrender, resolveAttack, startEncounter, type AttackResolution } from "./combat-engine";
import { advanceAndResolveTurns } from "./npc-turn";
```

Add (near the other top-level imports — `parseCampaignWorldState` may already be imported for other uses in this file; if it is, don't add a duplicate import, just extend the existing one):

```typescript
import { parseCampaignWorldState } from "./campaign-memory";
```

- [ ] **Step 2: Give `handleAction`/`handleFlee` an injectable AI-dependency parameter, and export both**

Change the `handleFlee` declaration from:

```typescript
  async function handleFlee(req: Request, res: Response, campaignId: number) {
```

to:

```typescript
  interface ActionDeps {
    generateDMResponse: typeof generateDMResponse;
    generateNpcTurnAction: typeof generateNpcTurnAction;
    generateNarrationText: typeof generateNarrationText;
  }

  const realActionDeps: ActionDeps = { generateDMResponse, generateNpcTurnAction, generateNarrationText };

  async function handleFlee(req: Request, res: Response, campaignId: number) {
```

(`handleFlee`'s own body doesn't call any AI function, so it doesn't need `deps` threaded into it — only the export matters for it.)

Change the `handleAction` declaration from:

```typescript
  async function handleAction(req: Request, res: Response, campaignId: number) {
```

to:

```typescript
  async function handleAction(req: Request, res: Response, campaignId: number, deps: ActionDeps = realActionDeps) {
```

The enclosing exported function in this file is `export async function registerRoutes(httpServer: Server, app: Express): Promise<Server>` (`server/routes.ts:539`). At the bottom of its body (immediately after both `app.post(...)` registrations that reference `handleAction`/`handleFlee`, so the functions are already defined by this point, and before its final `return httpServer;`), add:

```typescript
  (registerRoutes as any).handleAction = handleAction;
  (registerRoutes as any).handleFlee = handleFlee;
```

This attaches the two real, unmodified handler functions as properties on `registerRoutes` itself, so Task 7's test file can reach them after calling `registerRoutes(httpServer, app)` once: `const handleAction = (registerRoutes as any).handleAction;`.

- [ ] **Step 3: Rewrite the body of `handleAction` to wire in combat resolution**

Replace everything from `const rawResponse = await generateDMResponse(` through `return res.json({ playerMessage: playerMsg, dmMessage: dmMsg });` (i.e., up to but not including the `catch` block, which is unchanged) with:

```typescript
      const activeEncounterBefore = storage.getActiveEncounterByCampaign(campaignId);
      const combatContext = buildCombatContext(activeEncounterBefore, character);

      const rawResponse = await deps.generateDMResponse(
        campaign,
        chars,
        history,
        content,
        character.name,
        [],
        combatContext,
      );

      const { cleanContent, worldState } = extractWorldState(rawResponse);

      if (worldState) {
        const merged = mergeCampaignWorldState(campaign.worldState, worldState);
        storage.updateWorldState(campaignId, JSON.stringify(merged));
      }

      let attackResult: AttackResolution | { error: string } | null = null;

      if (activeEncounterBefore) {
        const surrenderResult = applyNpcSurrender(activeEncounterBefore.id, rawResponse, storage);
        if (surrenderResult.message) {
          broadcastToCampaign(campaignId, { type: "message", message: surrenderResult.message });
        }

        if (surrenderResult.surrenderedNames.length === 0 && combatContext?.isSubmittingPlayersTurn) {
          attackResult = await resolveAttack({
            encounterId: activeEncounterBefore.id,
            rawResponse,
            storage,
            rng: Math.random,
            narrate: (prompt) =>
              deps.generateNarrationText({
                system: "You are DMS narrating the fixed outcome of a resolved combat action. Do not restate the numbers; narrate only the consequence, in 2-4 sentences, matching the established DungeonMasterOS narration style.",
                maxTokens: 300,
                purpose: "attack outcome narration",
                messages: [{ role: "user", content: prompt }],
              }),
          });
        }
      } else {
        await startEncounter({
          campaignId,
          rawResponse,
          powerLevel: campaign.powerLevel,
          storage,
          rng: Math.random,
        });
      }

      const checkResolution = await resolveCheckTag({
        campaignId,
        rawResponse,
        storage,
        rng: Math.random,
        narrate: (prompt) =>
          deps.generateNarrationText({
            system: "You are DMS narrating the fixed outcome of a resolved dice roll. Do not restate the numbers; narrate only the consequence, in 2-4 sentences, matching the established DungeonMasterOS narration style.",
            maxTokens: 300,
            purpose: "check outcome narration",
            messages: [{ role: "user", content: prompt }],
          }),
      });

      const attackNarration = attackResult && "narration" in attackResult ? attackResult.narration : undefined;

      const finalContent =
        attackNarration || checkResolution?.cleanContent || cleanContent?.trim() || buildFallbackActionResponse(character.name, content);

      const dmMsg = storage.createMessage({
        campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: finalContent,
        messageType: "narration",
        metadata: checkResolution
          ? JSON.stringify({ roll: checkResolution.rollData })
          : attackResult && "narration" in attackResult
            ? JSON.stringify({
                roll: {
                  attacker: attackResult.attacker,
                  target: attackResult.target,
                  outcome: attackResult.outcome,
                  isCritical: attackResult.isCritical,
                  isFumble: attackResult.isFumble,
                  damageDealt: attackResult.damageDealt,
                },
              })
            : "{}",
      });

      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      broadcastToCampaign(campaignId, { type: "message", message: dmMsg });

      incrementTurnCount(req.user!.id);

      const historyForMemory = [...history, dmMsg];

      let npcTurnMessages: any[] = [];
      const encounterAfter = storage.getActiveEncounterByCampaign(campaignId);
      if (encounterAfter) {
        const worldStateNow = parseCampaignWorldState(campaign.worldState);
        npcTurnMessages = await advanceAndResolveTurns(encounterAfter.id, storage, {
          generateNpcAction: deps.generateNpcTurnAction,
          narrate: (prompt) =>
            deps.generateNarrationText({
              system: "You are DMS narrating the fixed outcome of an NPC's resolved combat action. Do not restate the numbers; narrate only the consequence, in 2-4 sentences, matching the established DungeonMasterOS narration style.",
              maxTokens: 300,
              purpose: "npc attack outcome narration",
              messages: [{ role: "user", content: prompt }],
            }),
          rng: Math.random,
          currentScene: worldStateNow.currentScene,
          broadcast: (message) => broadcastToCampaign(campaignId, { type: "message", message }),
        });
        if (npcTurnMessages.length > 0 || encounterAfter.status === "ended") {
          broadcastToCampaign(campaignId, { type: "encounter_updated", encounterId: encounterAfter.id });
        }
      }

      Promise.all([
        extractItemsFromNarration(finalContent, campaignId, character.id),
        extractAbilitiesFromNarration(finalContent, campaignId, character.id),
      ]).then(([newItems, newAbilities]) => {
        for (const newItem of newItems) {
          const created = storage.createItem(newItem);
          broadcastToCampaign(campaignId, { type: "item_granted", item: created });
        }
        if (newItems.length) {
          broadcastToCampaign(campaignId, { type: "items_updated", characterId: character.id });
        }

        if (newAbilities.length > 0) {
          const freshChar = storage.getCharacter(character.id);
          if (freshChar) {
            try {
              const cd = JSON.parse((freshChar as any).characterData || "{}");
              if (!cd.sections) cd.sections = [];
              let abSec = cd.sections.find((s: any) => s.label === "Granted Abilities");
              if (!abSec) {
                abSec = { label: "Granted Abilities", entries: [] };
                cd.sections.push(abSec);
              }
              for (const ab of newAbilities) {
                if (!abSec.entries.find((e: any) => e.key === ab.name)) {
                  abSec.entries.push({ key: ab.name, value: `[${ab.category}] ${ab.description}` });
                }
              }
              storage.updateCharacter(character.id, { characterData: JSON.stringify(cd) } as any);
              broadcastToCampaign(campaignId, {
                type: "abilities_granted",
                characterId: character.id,
                abilities: newAbilities,
              });
              broadcastToCampaign(campaignId, { type: "character_updated", characterId: character.id });

              if (req.user) {
                const unlockedIds = storage.getUnlockedAchievementIds(req.user.id);
                tryUnlockAchievements(req.user.id, campaignId, character.id, {
                  type: "ability_granted",
                  unlockedIds,
                });
              }
            } catch {}
          }
        }

        const expired = storage.tickEffects(character.id);
        if (expired.length > 0) {
          broadcastToCampaign(campaignId, {
            type: "effects_updated",
            characterId: character.id,
            expired: expired.map((e) => ({ id: e.id, name: e.name })),
          });
          for (const e of expired) {
            const expMsg = storage.createMessage({
              campaignId,
              sender: "System",
              senderType: "system",
              content: `${character.name}'s **${e.name}** has expired.`,
              messageType: "system",
            });
            broadcastToCampaign(campaignId, { type: "message", message: expMsg });
          }
        }

        if (req.user) {
          const freshChar2 = storage.getCharacter(character.id);
          const unlockedIds = storage.getUnlockedAchievementIds(req.user.id);
          const dmFlags = scanDMResponseForAchievements(finalContent, {
            hp: freshChar2?.hp ?? character.hp,
            maxHp: freshChar2?.maxHp ?? character.maxHp,
          });
          tryUnlockAchievements(req.user.id, campaignId, character.id, {
            type: "dm_response",
            dm: dmFlags,
            campaign: {
              id: campaignId,
              messageCount: storage.countMessagesByCampaign(campaignId),
              epicMode: campaign.epicMode,
              homebrewRules: campaign.homebrewRules,
              animeWorldSource: campaign.animeWorldSource,
              animeWorldMode: campaign.animeWorldMode,
            },
            unlockedIds,
          });
        }

        queueCampaignMemoryRefresh(campaignId, chars, historyForMemory, finalContent);
      }).catch((err) => console.error("Post-action extraction error:", err));

      return res.json({ playerMessage: playerMsg, dmMessage: dmMsg, npcTurnMessages });
```

Everything before this replaced block (character/content validation, the `clientSubmissionId` dedup short-circuit, the initial `broadcastToCampaign` for `playerMsg`) and the `catch` block after it are unchanged.

- [ ] **Step 4: Run the full test suite and typecheck**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
```

Expected: everything from Tasks 1-5 and every pre-existing test still passes — this task doesn't add its own unit tests (Task 7 covers it end-to-end), but must not regress anything. If typecheck fails on the `ActionDeps`/export mechanism from Step 2, resolve it by reading the actual current structure around `handleAction`/`handleFlee`'s declaration and adjusting the export mechanism to fit — the exact attachment method is negotiable per Step 2's own note, the requirement (both handlers real and callable from a test file, with `handleAction` accepting an injectable deps override) is not.

- [ ] **Step 5: Commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
git add server/routes.ts
git commit -m "Wire combat engine into the live action endpoint: surrender/attack/combat-start/NPC-cascade"
```

---

### Task 7: End-to-end tests against the real route logic

**Files:**
- Create: `server/routes-combat.e2e.test.ts`

**Interfaces:**
- Consumes: `handleAction`, `handleFlee` (exported in Task 6), real `storage`/`runMigrations` against a throwaway SQLite file, `DatabaseStorage`.

This task has no new production code — it proves the wiring from Tasks 1-6 actually holds when exercised through the real `handleAction`/`handleFlee` functions, a real migrated database, and fake `req`/`res` objects, with only the three AI-calling functions substituted via the `deps` parameter Task 6 added (never the real Anthropic API).

- [ ] **Step 1: Write the test file**

```typescript
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

  const user = storage.createUser({ email: `t${Date.now()}@test.com`, passwordHash: "x", tier: "free" } as any);
  const campaign = storage.createCampaign({
    userId: user.id, name: "Test Campaign", tone: "grim", rulesWeight: "light",
    powerLevel: "standard", worldType: "fantasy", combatStyle: "tactical",
    storyMode: false, worldGenStyle: "guided",
  } as any);
  const character = storage.createCharacter({
    campaignId: campaign.id, userId: user.id, name: "Kira", race: "Human", charClass: "Fighter",
    hp: 20, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", visitorId: "visitor-1",
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
  const { handleAction, user, campaign } = await setup();
  await handleAction(fakeReq({ content: "Combat starts" }, user, campaign.id), fakeRes(), campaign.id,
    stubDeps('[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]'));

  const encounter = storage.getActiveEncounterByCampaign(campaign.id)!;
  const beforeRollCount = storage.getRollLogByEncounter(encounter.id).length;
  const beforeParticipants = encounter.participants;

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

  const afterRollCount = storage.getRollLogByEncounter(encounter.id).length;
  assert.equal(afterRollCount, beforeRollCount, "no attack roll should have been logged for an out-of-turn attack");
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

  const res = fakeRes();
  await handleAction(
    fakeReq({ content: "The goblin looks scared." }, user, campaign.id),
    res,
    campaign.id,
    stubDeps('[SURRENDER]{"npcNames":["Goblin","Kira"],"reason":"it drops its weapon"}[/SURRENDER]'),
  );

  const after = storage.getActiveEncounterByCampaign(campaign.id);
  // Both NPCs surrendered -> victory, encounter ended; Kira (a PC) must never
  // have been touched by the tag even though her name was included.
  assert.ok(!after || after.status === "ended");
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

test("cleanup", () => {
  fs.rmSync(TEST_DB, { force: true });
  fs.rmSync(`${TEST_DB}-wal`, { force: true });
  fs.rmSync(`${TEST_DB}-shm`, { force: true });
});
```

- [ ] **Step 2: Run the tests, fix fixture mismatches against the real schema**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

The fixture objects above (`createUser`, `createCampaign`, `createCharacter` calls) are grounded on this codebase's general conventions but were not individually re-verified against every required field in `shared/schema.ts` at plan-writing time. Expected outcome: some may fail with a missing-required-field or type error from Drizzle/Zod. When that happens: read the actual `users`/`campaigns`/`characters` table definitions in `shared/schema.ts`, fix the fixture's fields to match exactly, and re-run — do not weaken or remove an assertion to route around a fixture problem. Once fixtures are correct, iterate the same way on any assertion that doesn't match real behavior, tracing the real `handleAction`/combat-engine code path (not guessing) before deciding whether the test or the production code is wrong.

Expected once fixtures are fixed: all tests in this file pass, and the full suite (`npm run test` with no filter) still shows zero regressions elsewhere.

- [ ] **Step 3: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
git add server/routes-combat.e2e.test.ts
git commit -m "Add end-to-end tests proving combat resolves through the real action endpoint, AI cannot end combat unilaterally"
```

---
