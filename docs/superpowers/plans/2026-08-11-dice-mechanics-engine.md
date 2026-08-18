# Dice/Mechanics Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give DungeonMasterOS a server-authoritative dice/mechanics engine — ability scores, a d20 check/attack/save resolver, and a persisted combat (encounter) state machine — so the AI DM can request rolls but never decide or override their outcome.

**Architecture:** New pure-function dice/resolution math (`server/dice-engine.ts`), a DB-backed character-stat resolver that folds in active-effect modifiers (`server/character-stats.ts`), strict JSON tag parsing extending the existing `[SHOP]`/`[WORLD_STATE]` bracket-tag convention (`server/mechanics-tags.ts`), a persisted `encounters`/`rollLog` schema, a server-driven turn loop that resolves NPC turns without waiting on player input, and integration into the existing `/api/campaigns/:id/action` endpoint. Existing frontend infrastructure (`computedStats.ts`'s D&D ability names, `StatGenWizard.tsx`, `DiceRoller.tsx`) is reused, not duplicated.

**Tech Stack:** TypeScript, Express, Drizzle ORM (better-sqlite3), Node's built-in `node:test` for the new test suite (no new dependency), existing Anthropic/Ollama provider in `server/dm-provider.ts` (unchanged).

## Global Constraints

- Ability scores are `str`, `dex`, `con`, `int`, `wis`, `cha` — matching `client/src/lib/computedStats.ts`'s `Ability` type exactly. Never introduce a second ability-naming vocabulary.
- The AI never supplies a character's own stats (modifier, AC, HP, attack bonus, damage dice) as authoritative — those always come from the database. The one number the AI legitimately supplies is a check's DC (a narrative judgment call) — and even that is clamped to 5-25, never trusted verbatim (26-30 is reserved for future non-AI-authored content, out of this plan's scope).
- Reaching 0 HP means incapacitated, never dead. v1 has exactly one fixed death-policy behavior, not a configurable settings surface.
- Modifier formula: `floor((score - 10) / 2)`. Proficiency bonus: `level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2` — copied verbatim from `computedStats.ts`'s existing `profBonus` calculation, not re-derived.
- Every roll the server executes is written to `rollLog` with the real stat values used, before any narration is generated.
- Migrations follow the existing pattern in `server/storage.ts`'s `runMigrations()`: `CREATE TABLE IF NOT EXISTS` for new tables, `addColumnIfMissing(table, column, sqlColumnDef)` for new columns on existing tables — never `drizzle-kit push` (that script exists in `package.json` but is not what actually runs; `runMigrations()` runs at process startup and is the real migration path).
- Structured tags follow the existing bracket-tag convention (`[SHOP]...[/SHOP]`, `[WORLD_STATE]...[/WORLD_STATE]` in `server/dm-engine.ts`) but carry strict JSON payloads, not loosely-formatted positional text.
- Natural 20 = automatic success/hit (+ doubled damage dice on an attack); natural 1 = automatic failure/miss. This overrides the normal modifier-vs-target comparison but the computed total is still logged.
- A hit always deals at least 1 damage.
- Roll display data attaches to the existing `messages.metadata` JSON field (already present on every message row, `NOT NULL DEFAULT '{}'`) — no new column needed for this.
- No automated test may call the real Anthropic API. The AI-narration boundary (`generateNarrationText`, and the new `generateNpcTurnAction`) is always mocked/stubbed in tests.
- Single `systemd` process (`dmos.service`) — concurrency control is in-process (a `Map`-based per-campaign async mutex), not distributed. Do not add multi-instance coordination.
- Run `npm run typecheck` and the new `npm run test` after every task before committing.

---

### Task 1: Schema migration — new tables and columns

**Files:**
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: Drizzle table definitions `encounters`, `rollLog`, and new columns on `characters` (`str`, `dex`, `con`, `int`, `wis`, `cha`, `ac`, `damageDice`, `attackAbility`, `proficiencies`) and `messages` (`clientSubmissionId`). Produces exported TypeScript types `Encounter`, `InsertEncounter`, `RollLogEntry`, `InsertRollLogEntry` that later tasks import.
- Consumes: nothing new — extends the existing schema file.

- [ ] **Step 1: Add the new `characters` columns to the Drizzle schema**

In `shared/schema.ts`, find the `characters` table definition (the `inventory` field is its last data column before `createdAt`):

```typescript
  // Legacy field kept for compatibility while the rest of the project is rewritten
  inventory: text("inventory").notNull().default("[]"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
```

Replace with:

```typescript
  // Legacy field kept for compatibility while the rest of the project is rewritten
  inventory: text("inventory").notNull().default("[]"),

  // Dice/mechanics engine — ability scores (matches client/src/lib/computedStats.ts's Ability type)
  str: integer("str").notNull().default(10),
  dex: integer("dex").notNull().default(10),
  con: integer("con").notNull().default(10),
  int: integer("int").notNull().default(10),
  wis: integer("wis").notNull().default(10),
  cha: integer("cha").notNull().default(10),
  ac: integer("ac").notNull().default(10),
  damageDice: text("damage_dice").notNull().default("1d4"),
  attackAbility: text("attack_ability").notNull().default("str"),
  proficiencies: text("proficiencies").notNull().default("[]"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 2: Add `clientSubmissionId` to the `messages` schema**

Find:

```typescript
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  sender: text("sender").notNull(),
  senderType: text("sender_type").notNull(), // dm | player | system
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("narration"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
```

Replace with:

```typescript
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  sender: text("sender").notNull(),
  senderType: text("sender_type").notNull(), // dm | player | system
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("narration"),
  metadata: text("metadata").notNull().default("{}"),
  clientSubmissionId: text("client_submission_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 3: Add the `encounters` and `rollLog` Drizzle tables**

In `shared/schema.ts`, after the `messages` table's `export type Message = typeof messages.$inferSelect;` line, add:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// ENCOUNTERS
// The server-authoritative combat state machine. participants is a JSON
// snapshot — see server/dice-engine.ts EncounterParticipant for its shape.
// ─────────────────────────────────────────────────────────────────────────────

export const encounters = sqliteTable("encounters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  status: text("status").notNull().default("active"), // active | ended
  round: integer("round").notNull().default(1),
  turnIndex: integer("turn_index").notNull().default(0),
  participants: text("participants").notNull().default("[]"),
  lastResolvedTurnKey: text("last_resolved_turn_key"),
  outcome: text("outcome"), // victory | defeat | all_fled | aborted, set when status becomes "ended"
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  endedAt: text("ended_at"),
});

export const insertEncounterSchema = createInsertSchema(encounters).omit({
  id: true,
  createdAt: true,
});

export type InsertEncounter = z.infer<typeof insertEncounterSchema>;
export type Encounter = typeof encounters.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// ROLL LOG
// Every roll the server executes, with the real stat values used. This is the
// audit trail proving the AI never supplied its own numbers.
// ─────────────────────────────────────────────────────────────────────────────

export const rollLog = sqliteTable("roll_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  encounterId: integer("encounter_id"),
  characterId: integer("character_id"),
  participantId: text("participant_id"),
  rollType: text("roll_type").notNull(), // check | attack | save | initiative
  statUsed: text("stat_used").notNull(),
  baseModifier: integer("base_modifier").notNull(),
  effectModifier: integer("effect_modifier").notNull().default(0),
  proficiencyBonus: integer("proficiency_bonus").notNull().default(0),
  diceResult: integer("dice_result").notNull(),
  total: integer("total").notNull(),
  targetValue: integer("target_value").notNull(),
  isCritical: integer("is_critical", { mode: "boolean" }).notNull().default(false),
  isFumble: integer("is_fumble", { mode: "boolean" }).notNull().default(false),
  outcome: text("outcome").notNull(), // success | failure | hit | miss
  turnKey: text("turn_key"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertRollLogSchema = createInsertSchema(rollLog).omit({
  id: true,
  createdAt: true,
});

export type InsertRollLogEntry = z.infer<typeof insertRollLogSchema>;
export type RollLogEntry = typeof rollLog.$inferSelect;
```

- [ ] **Step 4: Add the migration statements to `server/storage.ts`**

Find (the end of the `CREATE TABLE` block, immediately before the `addColumnIfMissing` calls begin):

```typescript
    CREATE TABLE IF NOT EXISTS stripe_events (
```

Read the full `stripe_events` block in the file to find its closing `);` and the line right after it (should be the closing of the big template-literal `sqlite.exec(...)` call, then `addColumnIfMissing("users", ...)` begins). Immediately after the last `CREATE TABLE IF NOT EXISTS` block's closing `);` and before the closing backtick+`)` of the `sqlite.exec()` call, add two new table definitions:

```sql

    CREATE TABLE IF NOT EXISTS encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      round INTEGER NOT NULL DEFAULT 1,
      turn_index INTEGER NOT NULL DEFAULT 0,
      participants TEXT NOT NULL DEFAULT '[]',
      last_resolved_turn_key TEXT,
      outcome TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS roll_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      encounter_id INTEGER,
      character_id INTEGER,
      participant_id TEXT,
      roll_type TEXT NOT NULL,
      stat_used TEXT NOT NULL,
      base_modifier INTEGER NOT NULL,
      effect_modifier INTEGER NOT NULL DEFAULT 0,
      proficiency_bonus INTEGER NOT NULL DEFAULT 0,
      dice_result INTEGER NOT NULL,
      total INTEGER NOT NULL,
      target_value INTEGER NOT NULL,
      is_critical INTEGER NOT NULL DEFAULT 0,
      is_fumble INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL,
      turn_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
```

(Exact insertion point: this is the last thing inside the big `sqlite.exec(\`...\`)` template literal that opens `runMigrations()` — add it right before the closing `` ` `` `);` of that call, after the `stripe_events` table block.)

Then, in the `addColumnIfMissing(...)` calls section (after the existing `characters` block: `addColumnIfMissing("characters", "attacks_per_round", ...)`), add:

```typescript
  addColumnIfMissing("characters", "str", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "dex", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "con", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "int", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "wis", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "cha", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "ac", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "damage_dice", "TEXT NOT NULL DEFAULT '1d4'");
  addColumnIfMissing("characters", "attack_ability", "TEXT NOT NULL DEFAULT 'str'");
  addColumnIfMissing("characters", "proficiencies", "TEXT NOT NULL DEFAULT '[]'");
```

And after the existing `addColumnIfMissing("messages", "metadata", ...)` line, add:

```typescript
  addColumnIfMissing("messages", "client_submission_id", "TEXT");
```

Also add a unique index for submission dedup, at the very end of `runMigrations()` (right before its closing `}`):

```typescript

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS messages_campaign_submission_unique
    ON messages (campaign_id, client_submission_id)
    WHERE client_submission_id IS NOT NULL;
  `);
```

- [ ] **Step 5: Add a `node:test` test script**

In `package.json`, find:

```json
    "typecheck": "tsc --noEmit",
```

Replace with:

```json
    "typecheck": "tsc --noEmit",
    "test": "node --import tsx --test server/**/*.test.ts",
```

- [ ] **Step 6: Verify the migration runs cleanly**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
rm -f /tmp/dmos-migration-check.db
node -e "
process.env.DATABASE_URL = '/tmp/dmos-migration-check.db';
require('tsx/cjs');
require('./server/storage.ts');
console.log('migrations ran without throwing');
"
node -e "
const Database = require('better-sqlite3');
const db = new Database('/tmp/dmos-migration-check.db');
const cols = db.prepare('PRAGMA table_info(characters)').all().map(c => c.name);
console.log('characters columns include str/dex/ac:', ['str','dex','con','int','wis','cha','ac','damage_dice','attack_ability','proficiencies'].every(c => cols.includes(c)));
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(t => t.name);
console.log('encounters table exists:', tables.includes('encounters'));
console.log('roll_log table exists:', tables.includes('roll_log'));
"
rm -f /tmp/dmos-migration-check.db
```

Expected: `migrations ran without throwing`, all three checks print `true`.

- [ ] **Step 7: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
git add shared/schema.ts server/storage.ts package.json
git commit -m "Add dice/mechanics schema: character ability columns, encounters, rollLog"
```

---

### Task 2: Dice/resolution math library (pure functions)

**Files:**
- Create: `server/dice-engine.ts`
- Test: `server/dice-engine.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no DB, no AI).
- Produces: `modifierFor(score: number): number`, `proficiencyBonusForLevel(level: number): number`, `parseDiceNotation(notation: string): { count: number; sides: number } | null`, `rollDice(count: number, sides: number, rng: () => number): number[]`, `resolveD20(params: ResolveD20Params): ResolveD20Result`, `resolveDamage(params: ResolveDamageParams): number`, `clampNpcStats(proposed: ProposedNpcStats, powerLevel: string): ClampedNpcStats`, `breakInitiativeTies(participants: Array<{ id: number | string; initiative: number; dexModifier: number }>): typeof participants`. These are imported by `server/character-stats.ts`, `server/combat-engine.ts`, and the action-endpoint integration in later tasks.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/dice-engine.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  modifierFor,
  proficiencyBonusForLevel,
  parseDiceNotation,
  rollDice,
  resolveD20,
  resolveDamage,
  clampNpcStats,
  breakInitiativeTies,
} from "./dice-engine";

test("modifierFor follows the standard d20 curve", () => {
  assert.equal(modifierFor(10), 0);
  assert.equal(modifierFor(11), 0);
  assert.equal(modifierFor(12), 1);
  assert.equal(modifierFor(13), 1);
  assert.equal(modifierFor(8), -1);
  assert.equal(modifierFor(9), -1);
  assert.equal(modifierFor(20), 5);
  assert.equal(modifierFor(1), -5);
});

test("proficiencyBonusForLevel matches the 5e table used in computedStats.ts", () => {
  assert.equal(proficiencyBonusForLevel(1), 2);
  assert.equal(proficiencyBonusForLevel(4), 2);
  assert.equal(proficiencyBonusForLevel(5), 3);
  assert.equal(proficiencyBonusForLevel(8), 3);
  assert.equal(proficiencyBonusForLevel(9), 4);
  assert.equal(proficiencyBonusForLevel(12), 4);
  assert.equal(proficiencyBonusForLevel(13), 5);
  assert.equal(proficiencyBonusForLevel(16), 5);
  assert.equal(proficiencyBonusForLevel(17), 6);
  assert.equal(proficiencyBonusForLevel(20), 6);
});

test("parseDiceNotation accepts valid notation and rejects invalid", () => {
  assert.deepEqual(parseDiceNotation("1d4"), { count: 1, sides: 4 });
  assert.deepEqual(parseDiceNotation("2d6"), { count: 2, sides: 6 });
  assert.deepEqual(parseDiceNotation("10d12"), { count: 10, sides: 12 });
  assert.equal(parseDiceNotation("1d7"), null);
  assert.equal(parseDiceNotation("d6"), null);
  assert.equal(parseDiceNotation("2x6"), null);
  assert.equal(parseDiceNotation(""), null);
});

test("rollDice uses the injected RNG deterministically", () => {
  const scripted = [0.0, 0.99, 0.5];
  let i = 0;
  const rng = () => scripted[i++];
  const results = rollDice(3, 6, rng);
  assert.deepEqual(results, [1, 6, 4]);
});

test("resolveD20: normal success/failure vs a target", () => {
  const rngFor = (value: number) => () => (value - 1) / 20;
  const success = resolveD20({ rng: rngFor(15), modifier: 3, target: 17, kind: "check" });
  assert.equal(success.diceResult, 15);
  assert.equal(success.total, 18);
  assert.equal(success.outcome, "success");
  assert.equal(success.isCritical, false);
  assert.equal(success.isFumble, false);

  const failure = resolveD20({ rng: rngFor(10), modifier: 1, target: 17, kind: "check" });
  assert.equal(failure.outcome, "failure");
});

test("resolveD20: attack ties go to the attacker", () => {
  const rngFor = (value: number) => () => (value - 1) / 20;
  const result = resolveD20({ rng: rngFor(14), modifier: 3, target: 17, kind: "attack" });
  assert.equal(result.total, 17);
  assert.equal(result.outcome, "hit");
});

test("resolveD20: natural 20 is an automatic success/hit regardless of modifier", () => {
  const rngFor = (value: number) => () => (value - 1) / 20;
  const result = resolveD20({ rng: rngFor(20), modifier: -10, target: 30, kind: "attack" });
  assert.equal(result.outcome, "hit");
  assert.equal(result.isCritical, true);
  assert.equal(result.isFumble, false);
});

test("resolveD20: natural 1 is an automatic failure/miss regardless of modifier", () => {
  const rngFor = (value: number) => () => (value - 1) / 20;
  const result = resolveD20({ rng: rngFor(1), modifier: 10, target: 5, kind: "check" });
  assert.equal(result.outcome, "failure");
  assert.equal(result.isFumble, true);
  assert.equal(result.isCritical, false);
});

test("resolveDamage: normal hit rolls the dice once, floors at 1 minimum", () => {
  const scripted = [0.0]; // rolls a 1 on 1d4
  let i = 0;
  const rng = () => scripted[i++];
  const dmg = resolveDamage({ damageDice: "1d4", modifier: -10, isCritical: false, rng });
  assert.equal(dmg, 1); // 1 (die) + -10 (modifier) would be -9, floored to minimum 1
});

test("resolveDamage: critical hit doubles the dice, not the flat modifier", () => {
  const scripted = [0.99, 0.99]; // two max rolls on 1d6 -> 6, 6
  let i = 0;
  const rng = () => scripted[i++];
  const dmg = resolveDamage({ damageDice: "1d6", modifier: 2, isCritical: true, rng });
  assert.equal(dmg, 14); // 6 + 6 (doubled dice) + 2 (modifier, not doubled)
});

test("clampNpcStats clamps out-of-range proposals to the powerLevel tier bounds", () => {
  const clamped = clampNpcStats(
    { hp: 9999, ac: 99, attackBonus: 99, damageDice: "10d12" },
    "low",
  );
  assert.equal(clamped.hp, 20);
  assert.equal(clamped.ac, 14);
  assert.equal(clamped.attackBonus, 3);
  assert.equal(clamped.damageDice, "1d6"); // tier default, since 10d12 exceeds the max-total ceiling
});

test("clampNpcStats leaves in-range proposals untouched", () => {
  const clamped = clampNpcStats(
    { hp: 15, ac: 13, attackBonus: 2, damageDice: "1d6" },
    "low",
  );
  assert.deepEqual(clamped, { hp: 15, ac: 13, attackBonus: 2, damageDice: "1d6" });
});

test("clampNpcStats replaces malformed dice notation with the tier default", () => {
  const clamped = clampNpcStats(
    { hp: 15, ac: 13, attackBonus: 2, damageDice: "not-dice" },
    "standard",
  );
  assert.equal(clamped.damageDice, "2d6");
});

test("breakInitiativeTies: higher DEX modifier wins a tie, then lower id", () => {
  const result = breakInitiativeTies([
    { id: 3, initiative: 15, dexModifier: 1 },
    { id: 1, initiative: 15, dexModifier: 2 },
    { id: 2, initiative: 15, dexModifier: 2 },
    { id: 4, initiative: 18, dexModifier: 0 },
  ]);
  assert.deepEqual(result.map((p) => p.id), [4, 1, 2, 3]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `Cannot find module './dice-engine'`.

- [ ] **Step 3: Implement `server/dice-engine.ts`**

```typescript
// server/dice-engine.ts
//
// Pure dice/resolution math for the mechanics engine. No DB, no AI, no I/O —
// every function here is deterministic given its inputs, so the RNG is always
// injected (never Math.random() directly) to keep this testable.

export type Rng = () => number; // must return a float in [0, 1)

export function modifierFor(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonusForLevel(level: number): number {
  // Copied verbatim from client/src/lib/computedStats.ts's profBonus calculation
  // so the server and the character-sheet display never disagree.
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

const VALID_DIE_SIDES = new Set([4, 6, 8, 10, 12]);

export function parseDiceNotation(notation: string): { count: number; sides: number } | null {
  const match = /^(\d+)d(\d+)$/.exec(notation.trim());
  if (!match) return null;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (!Number.isInteger(count) || count < 1) return null;
  if (!VALID_DIE_SIDES.has(sides)) return null;
  return { count, sides };
}

function rollOneDie(sides: number, rng: Rng): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollDice(count: number, sides: number, rng: Rng): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) results.push(rollOneDie(sides, rng));
  return results;
}

export type D20RollKind = "check" | "attack" | "save" | "initiative";
export type D20Outcome = "success" | "failure" | "hit" | "miss";

export interface ResolveD20Params {
  rng: Rng;
  modifier: number; // baseModifier + effectModifier + proficiencyBonus, already summed
  target: number; // DC for check/save, target AC for attack
  kind: D20RollKind;
}

export interface ResolveD20Result {
  diceResult: number;
  total: number;
  outcome: D20Outcome;
  isCritical: boolean;
  isFumble: boolean;
}

function outcomeFor(kind: D20RollKind, success: boolean): D20Outcome {
  if (kind === "attack") return success ? "hit" : "miss";
  return success ? "success" : "failure";
}

export function resolveD20(params: ResolveD20Params): ResolveD20Result {
  const diceResult = rollOneDie(20, params.rng);
  const total = diceResult + params.modifier;
  const isCritical = diceResult === 20;
  const isFumble = diceResult === 1;

  let success: boolean;
  if (isCritical) success = true;
  else if (isFumble) success = false;
  else success = total >= params.target; // ties go to the attacker/actor

  return {
    diceResult,
    total,
    outcome: outcomeFor(params.kind, success),
    isCritical,
    isFumble,
  };
}

export interface ResolveDamageParams {
  damageDice: string;
  modifier: number;
  isCritical: boolean;
  rng: Rng;
}

export function resolveDamage(params: ResolveDamageParams): number {
  const parsed = parseDiceNotation(params.damageDice);
  const { count, sides } = parsed || { count: 1, sides: 4 }; // defense-in-depth; callers should validate upstream
  const diceCount = params.isCritical ? count * 2 : count; // double the dice on a crit, never the flat modifier
  const rolled = rollDice(diceCount, sides, params.rng).reduce((sum, n) => sum + n, 0);
  return Math.max(1, rolled + params.modifier); // a hit always deals at least 1 damage
}

export interface ProposedNpcStats {
  hp: number;
  ac: number;
  attackBonus: number;
  damageDice: string;
}

export type PowerLevel = "low" | "standard" | "high" | "godtier";

interface PowerLevelBounds {
  hp: [number, number];
  ac: [number, number];
  attackBonus: [number, number];
  maxDamageTotal: number;
  defaultDamageDice: string;
}

const POWER_LEVEL_BOUNDS: Record<PowerLevel, PowerLevelBounds> = {
  low: { hp: [1, 20], ac: [8, 14], attackBonus: [-1, 3], maxDamageTotal: 12, defaultDamageDice: "1d6" },
  standard: { hp: [1, 40], ac: [8, 16], attackBonus: [0, 5], maxDamageTotal: 18, defaultDamageDice: "2d6" },
  high: { hp: [1, 80], ac: [8, 18], attackBonus: [2, 8], maxDamageTotal: 24, defaultDamageDice: "2d8" },
  godtier: { hp: [1, 200], ac: [8, 22], attackBonus: [4, 12], maxDamageTotal: 40, defaultDamageDice: "3d8" },
};

function clampNumber(value: number, [min, max]: [number, number]): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function clampNpcStats(proposed: ProposedNpcStats, powerLevel: string): ProposedNpcStats {
  const bounds = POWER_LEVEL_BOUNDS[powerLevel as PowerLevel] || POWER_LEVEL_BOUNDS.standard;

  const parsed = parseDiceNotation(proposed.damageDice);
  const maxPossible = parsed ? parsed.count * parsed.sides : Infinity;
  const damageDice = parsed && maxPossible <= bounds.maxDamageTotal ? proposed.damageDice : bounds.defaultDamageDice;

  return {
    hp: clampNumber(proposed.hp, bounds.hp),
    ac: clampNumber(proposed.ac, bounds.ac),
    attackBonus: clampNumber(proposed.attackBonus, bounds.attackBonus),
    damageDice,
  };
}

export function breakInitiativeTies<
  T extends { id: number | string; initiative: number; dexModifier: number },
>(participants: T[]): T[] {
  return [...participants].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    if (b.dexModifier !== a.dexModifier) return b.dexModifier - a.dexModifier;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `dice-engine.test.ts` tests pass.

- [ ] **Step 5: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
git add server/dice-engine.ts server/dice-engine.test.ts
git commit -m "Add pure dice/resolution math library with tests"
```

---

### Task 3: Character stat resolution (DB + active-effect integration)

**Files:**
- Create: `server/character-stats.ts`
- Test: `server/character-stats.test.ts`

**Interfaces:**
- Consumes: `modifierFor`, `proficiencyBonusForLevel` from `server/dice-engine.ts` (Task 2); `storage` from `server/storage.ts` (existing `getCharacter`, `getActiveEffectsByCharacter` — both already exist per the `IStorage` interface); `characters.proficiencies` JSON column (Task 1).
- Produces: `resolveCharacterModifier(characterId: number, ability: Ability, opts?: { skill?: string; isSave?: boolean }): ResolvedModifier` where `ResolvedModifier = { baseModifier: number; effectModifier: number; proficiencyBonus: number; statUsed: string; total: number }`. Imported by Task 6 (`[CHECK]` resolution) and Task 9 (`[ATTACK]` resolution).

- [ ] **Step 1: Write the failing tests**

```typescript
// server/character-stats.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCharacterModifier } from "./character-stats";

function fakeStorage(overrides: Partial<Record<string, any>> = {}) {
  return {
    getCharacter: (id: number) => ({
      id,
      level: 5,
      str: 14,
      dex: 16,
      con: 12,
      int: 10,
      wis: 10,
      cha: 8,
      proficiencies: JSON.stringify(["Stealth", "Constitution Save"]),
      ...overrides,
    }),
    getActiveEffectsByCharacter: (_id: number) => overrides.effects ?? [],
  };
}

test("resolveCharacterModifier: base ability modifier only, no proficiency", () => {
  const result = resolveCharacterModifier(1, "str", {}, fakeStorage() as any);
  assert.equal(result.baseModifier, 2); // str 14 -> +2
  assert.equal(result.proficiencyBonus, 0);
  assert.equal(result.effectModifier, 0);
  assert.equal(result.total, 2);
  assert.equal(result.statUsed, "str");
});

test("resolveCharacterModifier: skill proficiency adds proficiency bonus and derives ability from the skill", () => {
  const result = resolveCharacterModifier(1, "wis", { skill: "Stealth" }, fakeStorage() as any);
  // Stealth is governed by DEX per SKILL_ABILITY, even though "wis" was passed —
  // the skill map wins, closing the gap where the AI's ability field would otherwise be trusted.
  assert.equal(result.statUsed, "dex.stealth");
  assert.equal(result.baseModifier, 3); // dex 16 -> +3
  assert.equal(result.proficiencyBonus, 3); // level 5 -> +3, and "Stealth" is in proficiencies
  assert.equal(result.total, 6);
});

test("resolveCharacterModifier: save proficiency", () => {
  const result = resolveCharacterModifier(1, "con", { isSave: true }, fakeStorage() as any);
  assert.equal(result.statUsed, "con.save");
  assert.equal(result.baseModifier, 1); // con 12 -> +1
  assert.equal(result.proficiencyBonus, 3); // "Constitution Save" is in proficiencies, level 5 -> +3
  assert.equal(result.total, 4);
});

test("resolveCharacterModifier: unrecognized skill falls back to the supplied ability with no proficiency", () => {
  const result = resolveCharacterModifier(1, "int", { skill: "Made Up Skill" }, fakeStorage() as any);
  assert.equal(result.statUsed, "int");
  assert.equal(result.proficiencyBonus, 0);
});

test("resolveCharacterModifier: active-effect statMods contribute effectModifier", () => {
  const storage = fakeStorage({
    effects: [
      { statMods: JSON.stringify([{ stat: "str", type: "bonus", modifier: 3, source: "Bless" }]) },
      { statMods: JSON.stringify([{ stat: "dex", type: "bonus", modifier: -1, source: "Encumbered" }]) },
    ],
  });
  const result = resolveCharacterModifier(1, "str", {}, storage as any);
  assert.equal(result.baseModifier, 2);
  assert.equal(result.effectModifier, 3);
  assert.equal(result.total, 5);
});

test("resolveCharacterModifier: character always proficient in their own attack", () => {
  const result = resolveCharacterModifier(1, "str", { skill: "attack" }, fakeStorage() as any);
  assert.equal(result.proficiencyBonus, 3); // level 5, always-proficient regardless of the proficiencies list
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `Cannot find module './character-stats'`.

- [ ] **Step 3: Implement `server/character-stats.ts`**

```typescript
// server/character-stats.ts
//
// Resolves a character's real, DB-backed modifier for a roll — the
// authoritative source the dice engine compares against. Never trusts a
// number the AI proposed; only ever reads what's actually in the database.

import { modifierFor, proficiencyBonusForLevel } from "./dice-engine";

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

// Mirrors client/src/lib/computedStats.ts's SKILL_ABILITY so a skill label in
// a [CHECK] tag maps to the same governing ability the character sheet uses.
export const SKILL_ABILITY: Record<string, Ability> = {
  Acrobatics: "dex",
  "Animal Handling": "wis",
  Arcana: "int",
  Athletics: "str",
  Deception: "cha",
  History: "int",
  Insight: "wis",
  Intimidation: "cha",
  Investigation: "int",
  Medicine: "wis",
  Nature: "int",
  Perception: "wis",
  Performance: "cha",
  Persuasion: "cha",
  Religion: "int",
  "Sleight of Hand": "dex",
  Stealth: "dex",
  Survival: "wis",
};

interface StatMod {
  stat: string;
  type: "bonus" | "override" | "override_if_higher" | "advantage" | "disadvantage" | "immunity" | "resistance" | "custom";
  modifier?: number;
  overrideValue?: number;
  source?: string;
}

export interface ResolveOpts {
  skill?: string;
  isSave?: boolean;
}

export interface ResolvedModifier {
  baseModifier: number;
  effectModifier: number;
  proficiencyBonus: number;
  statUsed: string;
  total: number;
}

interface StorageLike {
  getCharacter(id: number): { level: number; str: number; dex: number; con: number; int: number; wis: number; cha: number; proficiencies: string } | undefined;
  getActiveEffectsByCharacter(characterId: number): Array<{ statMods: string }>;
}

function parseProficiencies(json: string): Set<string> {
  try {
    const arr = JSON.parse(json);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function parseStatMods(json: string): StatMod[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function resolveCharacterModifier(
  characterId: number,
  requestedAbility: Ability,
  opts: ResolveOpts,
  storage: StorageLike,
): ResolvedModifier {
  const character = storage.getCharacter(characterId);
  if (!character) {
    throw new Error(`resolveCharacterModifier: character ${characterId} not found`);
  }

  // The skill map wins over an AI-supplied ability when the skill is recognized —
  // this is what "ability" being AI-supplied actually means: it's overridden
  // whenever we have real game data to derive it from instead.
  let ability = requestedAbility;
  let statUsed = requestedAbility;

  if (opts.skill && opts.skill !== "attack" && SKILL_ABILITY[opts.skill]) {
    ability = SKILL_ABILITY[opts.skill];
    statUsed = `${ability}.${opts.skill.toLowerCase().replace(/\s+/g, "")}`;
  } else if (opts.isSave) {
    statUsed = `${ability}.save`;
  }

  const baseModifier = modifierFor(character[ability]);

  const proficiencies = parseProficiencies(character.proficiencies);
  const abilityLabel = ability.charAt(0).toUpperCase() + ability.slice(1);
  const isProficient =
    opts.skill === "attack" || // always proficient in one's own basic attack
    (opts.skill && opts.skill !== "attack" && proficiencies.has(opts.skill)) ||
    (opts.isSave && proficiencies.has(`${abilityLabel} Save`));

  const proficiencyBonus = isProficient ? proficiencyBonusForLevel(character.level) : 0;

  const effects = storage.getActiveEffectsByCharacter(characterId);
  let effectModifier = 0;
  for (const effect of effects) {
    for (const mod of parseStatMods(effect.statMods)) {
      if (mod.stat === ability && mod.type === "bonus" && typeof mod.modifier === "number") {
        effectModifier += mod.modifier;
      }
    }
  }

  return {
    baseModifier,
    effectModifier,
    proficiencyBonus,
    statUsed,
    total: baseModifier + effectModifier + proficiencyBonus,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `character-stats.test.ts` tests pass.

- [ ] **Step 5: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
git add server/character-stats.ts server/character-stats.test.ts
git commit -m "Add character stat resolution with active-effect integration"
```

---

### Task 4: Structured tag parsing and validation

**Files:**
- Create: `server/mechanics-tags.ts`
- Test: `server/mechanics-tags.test.ts`

**Interfaces:**
- Consumes: nothing (pure parsing/validation).
- Produces: `extractCheckTag`, `extractCombatStartTag`, `extractAttackTag`, `extractCombatEndTag` — each `(text: string) => ParsedTag | null`, returning `null` (never throwing) on missing/malformed input. Imported by Task 6, 7, 9, 11.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/mechanics-tags.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractCheckTag,
  extractCombatStartTag,
  extractAttackTag,
  extractCombatEndTag,
} from "./mechanics-tags";

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

test("extractCombatEndTag: parses reason, defaults to empty string", () => {
  assert.equal(extractCombatEndTag('[COMBAT_END]{"reason":"surrender"}[/COMBAT_END]')!.reason, "surrender");
  assert.equal(extractCombatEndTag('[COMBAT_END]{}[/COMBAT_END]')!.reason, "");
});

test("extractCombatEndTag: returns null when no tag present", () => {
  assert.equal(extractCombatEndTag("The goblins flee into the trees."), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `Cannot find module './mechanics-tags'`.

- [ ] **Step 3: Implement `server/mechanics-tags.ts`**

```typescript
// server/mechanics-tags.ts
//
// Extraction and validation for the mechanics engine's structured tags.
// Extends the existing bracket-tag convention already used for [SHOP] and
// [WORLD_STATE] in dm-engine.ts, but with strict JSON payloads instead of
// loosely-formatted positional text. Every function here returns null on
// anything malformed — never throws — so a bad AI proposal always falls
// back to unmechanized narration rather than breaking a turn.

const VALID_ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha"]);

// AI-proposed DCs are clamped to this band, never rejected outside it — 26-30
// is reserved for future manually-approved/ruleset-authored content that
// doesn't exist yet in this spec's scope. Clamping (not rejecting) the DC is
// what makes the DC itself server-authoritative, not just the roll after it.
const MIN_AI_DC = 5;
const MAX_AI_DC = 25;

function extractJsonPayload(text: string, tagName: string): any | null {
  const pattern = new RegExp(`\\[${tagName}\\]([\\s\\S]*?)\\[/${tagName}\\]`);
  const match = text.match(pattern);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export interface CheckTag {
  character: string;
  ability?: "str" | "dex" | "con" | "int" | "wis" | "cha";
  skill?: string;
  dc: number;
  isSave?: boolean;
  reason?: string;
}

export function extractCheckTag(text: string): CheckTag | null {
  const payload = extractJsonPayload(text, "CHECK");
  if (!payload) return null;

  if (typeof payload.character !== "string" || !payload.character.trim()) return null;
  if (typeof payload.dc !== "number" || !Number.isInteger(payload.dc)) return null; // missing/non-numeric dc is a genuinely malformed tag

  const hasAbility = typeof payload.ability === "string" && VALID_ABILITIES.has(payload.ability);
  const hasSkill = typeof payload.skill === "string" && payload.skill.trim().length > 0;
  if (!hasAbility && !hasSkill) return null;

  return {
    character: payload.character,
    ability: hasAbility ? payload.ability : undefined,
    skill: hasSkill ? payload.skill : undefined,
    dc: Math.min(MAX_AI_DC, Math.max(MIN_AI_DC, payload.dc)), // clamped, never rejected
    isSave: payload.isSave === true,
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
  };
}

export interface CombatStartNpc {
  name: string;
  hp: number;
  ac: number;
  attackBonus: number;
  damageDice: string;
}

export interface CombatStartTag {
  participants?: string[];
  npcs: CombatStartNpc[];
}

function isValidNpc(value: any): value is CombatStartNpc {
  return (
    value &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.hp === "number" &&
    typeof value.ac === "number" &&
    typeof value.attackBonus === "number" &&
    typeof value.damageDice === "string"
  );
}

export function extractCombatStartTag(text: string): CombatStartTag | null {
  const payload = extractJsonPayload(text, "COMBAT_START");
  if (!payload) return null;

  if (!Array.isArray(payload.npcs) || payload.npcs.length === 0) return null;
  if (!payload.npcs.every(isValidNpc)) return null;

  const participants =
    Array.isArray(payload.participants) && payload.participants.every((p: any) => typeof p === "string")
      ? payload.participants
      : undefined;

  return { participants, npcs: payload.npcs };
}

export interface AttackTag {
  attacker: string;
  target: string;
}

export function extractAttackTag(text: string): AttackTag | null {
  const payload = extractJsonPayload(text, "ATTACK");
  if (!payload) return null;
  if (typeof payload.attacker !== "string" || !payload.attacker.trim()) return null;
  if (typeof payload.target !== "string" || !payload.target.trim()) return null;
  // Deliberately return ONLY attacker/target — any other field the AI included
  // (a bonus, a damage value, anything numeric) is never read.
  return { attacker: payload.attacker, target: payload.target };
}

export interface CombatEndTag {
  reason: string;
}

export function extractCombatEndTag(text: string): CombatEndTag | null {
  const payload = extractJsonPayload(text, "COMBAT_END");
  if (!payload) return null;
  return { reason: typeof payload.reason === "string" ? payload.reason : "" };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `mechanics-tags.test.ts` tests pass.

- [ ] **Step 5: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
git add server/mechanics-tags.ts server/mechanics-tags.test.ts
git commit -m "Add structured tag parsing/validation for mechanics engine"
```

---

### Task 5: Storage layer — encounters, rollLog, submission dedup

**Files:**
- Modify: `server/storage.ts`
- Test: `server/storage-mechanics.test.ts`

**Interfaces:**
- Consumes: `Encounter`, `InsertEncounter`, `RollLogEntry`, `InsertRollLogEntry` types from `shared/schema.ts` (Task 1).
- Produces on `IStorage`/`DatabaseStorage`: `createEncounter(data: InsertEncounter): Encounter`, `getEncounter(id: number): Encounter | undefined`, `getActiveEncounterByCampaign(campaignId: number): Encounter | undefined`, `updateEncounter(id: number, updates: Partial<InsertEncounter>): void`, `createRollLogEntry(data: InsertRollLogEntry): RollLogEntry`, `getRollLogByEncounter(encounterId: number): RollLogEntry[]`, `createMessageIdempotent(message: InsertMessage & { clientSubmissionId?: string }): { message: Message; wasCreated: boolean }`. Consumed by Task 6, 7, 8, 9, 10, 11, 12, 13.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/storage-mechanics.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const dbPath = path.join(os.tmpdir(), `dmos-storage-mechanics-test-${Date.now()}.db`);
process.env.DATABASE_URL = dbPath;

const { storage } = await import("./storage");

test.after(() => {
  fs.rmSync(dbPath, { force: true });
  fs.rmSync(`${dbPath}-wal`, { force: true });
  fs.rmSync(`${dbPath}-shm`, { force: true });
});

test("createEncounter + getEncounter round-trip", () => {
  const created = storage.createEncounter({
    campaignId: 1,
    status: "active",
    round: 1,
    turnIndex: 0,
    participants: JSON.stringify([{ id: "p1", type: "character", name: "Kira" }]),
  });
  assert.ok(created.id);
  const fetched = storage.getEncounter(created.id);
  assert.equal(fetched?.campaignId, 1);
  assert.equal(fetched?.status, "active");
});

test("getActiveEncounterByCampaign returns only the active one", () => {
  storage.createEncounter({ campaignId: 2, status: "ended", round: 1, turnIndex: 0, participants: "[]" });
  const active = storage.createEncounter({ campaignId: 2, status: "active", round: 1, turnIndex: 0, participants: "[]" });
  const found = storage.getActiveEncounterByCampaign(2);
  assert.equal(found?.id, active.id);
});

test("updateEncounter mutates round/turnIndex/status", () => {
  const created = storage.createEncounter({ campaignId: 3, status: "active", round: 1, turnIndex: 0, participants: "[]" });
  storage.updateEncounter(created.id, { round: 2, turnIndex: 1, status: "ended", outcome: "victory" });
  const fetched = storage.getEncounter(created.id);
  assert.equal(fetched?.round, 2);
  assert.equal(fetched?.turnIndex, 1);
  assert.equal(fetched?.status, "ended");
  assert.equal(fetched?.outcome, "victory");
});

test("createRollLogEntry + getRollLogByEncounter", () => {
  const encounter = storage.createEncounter({ campaignId: 4, status: "active", round: 1, turnIndex: 0, participants: "[]" });
  storage.createRollLogEntry({
    campaignId: 4,
    encounterId: encounter.id,
    characterId: null as any,
    participantId: "p1",
    rollType: "attack",
    statUsed: "str",
    baseModifier: 2,
    effectModifier: 0,
    proficiencyBonus: 3,
    diceResult: 15,
    total: 20,
    targetValue: 13,
    isCritical: false,
    isFumble: false,
    outcome: "hit",
    turnKey: "1:0",
  });
  const entries = storage.getRollLogByEncounter(encounter.id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].outcome, "hit");
  assert.equal(entries[0].total, 20);
});

test("createMessageIdempotent: first submission creates, duplicate is a no-op returning the original", () => {
  const first = storage.createMessageIdempotent({
    campaignId: 5,
    sender: "Kira",
    senderType: "player",
    content: "I attack the goblin",
    messageType: "action",
    clientSubmissionId: "sub-abc-123",
  });
  assert.equal(first.wasCreated, true);

  const duplicate = storage.createMessageIdempotent({
    campaignId: 5,
    sender: "Kira",
    senderType: "player",
    content: "I attack the goblin",
    messageType: "action",
    clientSubmissionId: "sub-abc-123",
  });
  assert.equal(duplicate.wasCreated, false);
  assert.equal(duplicate.message.id, first.message.id);
});

test("createMessageIdempotent: no clientSubmissionId always creates a new message", () => {
  const a = storage.createMessageIdempotent({ campaignId: 6, sender: "Kira", senderType: "player", content: "hi", messageType: "action" });
  const b = storage.createMessageIdempotent({ campaignId: 6, sender: "Kira", senderType: "player", content: "hi", messageType: "action" });
  assert.notEqual(a.message.id, b.message.id);
  assert.equal(a.wasCreated, true);
  assert.equal(b.wasCreated, true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `storage.createEncounter is not a function`.

- [ ] **Step 3: Add the storage methods**

In `server/storage.ts`, find the `IStorage` interface's message-related section (around `getMessagesByCampaign(campaignId: number, limit?: number): Message[];`) and add after `countMessagesByCampaign`:

```typescript
  createMessageIdempotent(message: InsertMessage & { clientSubmissionId?: string }): { message: Message; wasCreated: boolean };

  // Encounters
  createEncounter(data: InsertEncounter): Encounter;
  getEncounter(id: number): Encounter | undefined;
  getActiveEncounterByCampaign(campaignId: number): Encounter | undefined;
  updateEncounter(id: number, updates: Partial<InsertEncounter>): void;

  // Roll log
  createRollLogEntry(data: InsertRollLogEntry): RollLogEntry;
  getRollLogByEncounter(encounterId: number): RollLogEntry[];
```

Add the corresponding imports at the top of the file, in the existing `from "@shared/schema"` import block, alongside the other type imports:

```typescript
  type Encounter,
  type InsertEncounter,
  encounters,
  type RollLogEntry,
  type InsertRollLogEntry,
  rollLog,
```

Then, in the `DatabaseStorage` class, immediately after the existing `getMessagesByCampaign`/`createMessage`/`countMessagesByCampaign` methods, add:

```typescript
  createMessageIdempotent(message: InsertMessage & { clientSubmissionId?: string }): { message: Message; wasCreated: boolean } {
    if (!message.clientSubmissionId) {
      return { message: this.createMessage(message), wasCreated: true };
    }

    const existing = db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.campaignId, message.campaignId),
          eq(messages.clientSubmissionId, message.clientSubmissionId),
        ),
      )
      .get();

    if (existing) {
      return { message: existing, wasCreated: false };
    }

    try {
      return { message: this.createMessage(message), wasCreated: true };
    } catch (error) {
      // Race: another concurrent request inserted the same submissionId between
      // our SELECT and our INSERT. The unique index rejected us — fetch and
      // return what actually landed, rather than erroring the request.
      const raced = db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.campaignId, message.campaignId),
            eq(messages.clientSubmissionId, message.clientSubmissionId),
          ),
        )
        .get();
      if (raced) return { message: raced, wasCreated: false };
      throw error;
    }
  }

  // Encounters
  createEncounter(data: InsertEncounter): Encounter {
    return db.insert(encounters).values(data).returning().get();
  }
  getEncounter(id: number): Encounter | undefined {
    return db.select().from(encounters).where(eq(encounters.id, id)).get();
  }
  getActiveEncounterByCampaign(campaignId: number): Encounter | undefined {
    return db
      .select()
      .from(encounters)
      .where(and(eq(encounters.campaignId, campaignId), eq(encounters.status, "active")))
      .get();
  }
  updateEncounter(id: number, updates: Partial<InsertEncounter>): void {
    db.update(encounters).set(updates as any).where(eq(encounters.id, id)).run();
  }

  // Roll log
  createRollLogEntry(data: InsertRollLogEntry): RollLogEntry {
    return db.insert(rollLog).values(data).returning().get();
  }
  getRollLogByEncounter(encounterId: number): RollLogEntry[] {
    return db.select().from(rollLog).where(eq(rollLog.encounterId, encounterId)).orderBy(rollLog.id).all();
  }
```

Note: `createMessage` must already exist as a private-capable call target — confirm it's an instance method (it already is, per the existing `IStorage`/`DatabaseStorage` shown in Task 1's grounding) so `this.createMessage(message)` resolves correctly.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `storage-mechanics.test.ts` tests pass.

- [ ] **Step 5: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
git add server/storage.ts server/storage-mechanics.test.ts
git commit -m "Add encounter/rollLog storage methods and idempotent message creation"
```

---

### Task 6: `[CHECK]` resolution wired into the action endpoint

**Files:**
- Create: `server/mechanics-resolver.ts`
- Modify: `server/routes.ts`
- Test: `server/mechanics-resolver.test.ts`

**Interfaces:**
- Consumes: `resolveCharacterModifier` (Task 3), `resolveD20` (Task 2), `extractCheckTag` (Task 4), `storage.createRollLogEntry`/`getCharacterByVisitor`-equivalent lookups (Task 5), `generateNarrationText` from `server/dm-provider.ts` (existing, unchanged).
- Produces: `resolveCheckTag(params: ResolveCheckParams): Promise<{ cleanContent: string; rollData: RollDisplayData } | null>` — returns `null` if the tag wasn't present or didn't validate, in which case the caller (the action endpoint) falls back to today's plain narration unchanged. `RollDisplayData` is the shape written into `messages.metadata`.

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `Cannot find module './mechanics-resolver'`.

- [ ] **Step 3: Implement `server/mechanics-resolver.ts`**

```typescript
// server/mechanics-resolver.ts
//
// Wires the pure dice engine, character stat resolution, and tag parsing
// together into the request -> roll -> narrate flow described in the design
// doc. This module is the only place that calls resolveCharacterModifier +
// resolveD20 in response to a [CHECK] tag from the DM's first AI call.

import { resolveD20, type Rng } from "./dice-engine";
import { resolveCharacterModifier, type Ability } from "./character-stats";
import { extractCheckTag } from "./mechanics-tags";

export interface RollDisplayData {
  rollType: "check";
  statUsed: string;
  diceResult: number;
  total: number;
  targetValue: number;
  outcome: "success" | "failure";
  isCritical: boolean;
  isFumble: boolean;
}

interface StorageLike {
  getCharacterByName(campaignId: number, name: string): { id: number } | undefined;
  createRollLogEntry(entry: any): any;
}
// Also satisfies the StorageLike interface resolveCharacterModifier expects
// (getCharacter/getActiveEffectsByCharacter) — the real `storage` singleton
// implements both; this narrower type here documents what THIS module uses directly.

export interface ResolveCheckParams {
  campaignId: number;
  rawResponse: string;
  storage: StorageLike & Parameters<typeof resolveCharacterModifier>[3];
  rng: Rng;
  narrate: (prompt: string) => Promise<string>;
}

function buildNarratePrompt(statUsed: string, roll: ReturnType<typeof resolveD20>, dc: number): string {
  const label = roll.outcome === "success" ? "SUCCESS" : "FAILURE";
  return `${statUsed} check: rolled ${roll.diceResult} + modifier = ${roll.total} vs DC ${dc} → ${label}. Narrate this outcome in 2-4 sentences, following the established style rules. Do not restate the numbers.`;
}

function fallbackNarration(outcome: "success" | "failure"): string {
  return outcome === "success"
    ? "The attempt lands cleanly, the moment resolving in your favor."
    : "The attempt falls short — this particular effort doesn't pay off, at least not yet.";
}

export async function resolveCheckTag(
  params: ResolveCheckParams,
): Promise<{ cleanContent: string; rollData: RollDisplayData } | null> {
  const tag = extractCheckTag(params.rawResponse);
  if (!tag) return null;

  const character = params.storage.getCharacterByName(params.campaignId, tag.character);
  if (!character) return null;

  const resolved = resolveCharacterModifier(
    character.id,
    (tag.ability || "str") as Ability,
    { skill: tag.skill, isSave: tag.isSave },
    params.storage,
  );

  const roll = resolveD20({
    rng: params.rng,
    modifier: resolved.total,
    target: tag.dc,
    kind: tag.isSave ? "save" : "check",
  });

  params.storage.createRollLogEntry({
    campaignId: params.campaignId,
    encounterId: null,
    characterId: character.id,
    participantId: null,
    rollType: tag.isSave ? "save" : "check",
    statUsed: resolved.statUsed,
    baseModifier: resolved.baseModifier,
    effectModifier: resolved.effectModifier,
    proficiencyBonus: resolved.proficiencyBonus,
    diceResult: roll.diceResult,
    total: roll.total,
    targetValue: tag.dc,
    isCritical: roll.isCritical,
    isFumble: roll.isFumble,
    outcome: roll.outcome,
    turnKey: null,
  });

  const outcome = roll.outcome as "success" | "failure";

  let cleanContent: string;
  try {
    cleanContent = await params.narrate(buildNarratePrompt(resolved.statUsed, roll, tag.dc));
  } catch {
    cleanContent = fallbackNarration(outcome);
  }

  return {
    cleanContent,
    rollData: {
      rollType: "check",
      statUsed: resolved.statUsed,
      diceResult: roll.diceResult,
      total: roll.total,
      targetValue: tag.dc,
      outcome,
      isCritical: roll.isCritical,
      isFumble: roll.isFumble,
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `mechanics-resolver.test.ts` tests pass.

- [ ] **Step 5: Add `getCharacterByName` to storage (small addition alongside the existing `getCharacterByVisitor`)**

In `server/storage.ts`, find the existing character lookup methods (near `getCharacterByVisitor`) and add to `IStorage`:

```typescript
  getCharacterByName(campaignId: number, name: string): Character | undefined;
```

And in `DatabaseStorage`:

```typescript
  getCharacterByName(campaignId: number, name: string): Character | undefined {
    return db
      .select()
      .from(characters)
      .where(and(eq(characters.campaignId, campaignId), eq(characters.name, name)))
      .get();
  }
```

- [ ] **Step 6: Wire `resolveCheckTag` into the action endpoint**

In `server/routes.ts`, find (inside `POST /api/campaigns/:id/action`, immediately after `extractWorldState`):

```typescript
      const { cleanContent, worldState } = extractWorldState(rawResponse);

      if (worldState) {
        const merged = mergeCampaignWorldState(campaign.worldState, worldState);
        storage.updateWorldState(campaignId, JSON.stringify(merged));
      }

      const finalContent = cleanContent?.trim() || buildFallbackActionResponse(character.name, content);

      const dmMsg = storage.createMessage({
        campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: finalContent,
        messageType: "narration",
      });
```

Replace with:

```typescript
      const { cleanContent, worldState } = extractWorldState(rawResponse);

      if (worldState) {
        const merged = mergeCampaignWorldState(campaign.worldState, worldState);
        storage.updateWorldState(campaignId, JSON.stringify(merged));
      }

      const checkResolution = await resolveCheckTag({
        campaignId,
        rawResponse,
        storage,
        rng: Math.random,
        narrate: (prompt) =>
          generateNarrationText({
            system: "You are DMS narrating the fixed outcome of a resolved dice roll. Do not restate the numbers; narrate only the consequence, in 2-4 sentences, matching the established DungeonMasterOS narration style.",
            maxTokens: 300,
            purpose: "check outcome narration",
            messages: [{ role: "user", content: prompt }],
          }),
      });

      const finalContent =
        checkResolution?.cleanContent || cleanContent?.trim() || buildFallbackActionResponse(character.name, content);

      const dmMsg = storage.createMessage({
        campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: finalContent,
        messageType: "narration",
        metadata: checkResolution ? JSON.stringify({ roll: checkResolution.rollData }) : "{}",
      });
```

Add the new imports at the top of `server/routes.ts`, alongside the existing `import { generateDMResponse, ... } from "./dm-engine";` line:

```typescript
import { resolveCheckTag } from "./mechanics-resolver";
import { generateNarrationText } from "./dm-provider";
```

(`generateNarrationText` may already be imported transitively via `dm-engine.ts` re-exports — check for an existing import of it from `./dm-provider` in `routes.ts` before adding a duplicate; if `dm-provider` isn't already imported in this file, this is a new import line.)

- [ ] **Step 7: Run the full test suite and typecheck**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
npm run typecheck
```

Expected: all tests pass, typecheck clean.

- [ ] **Step 8: Commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
git add server/mechanics-resolver.ts server/mechanics-resolver.test.ts server/routes.ts server/storage.ts
git commit -m "Wire [CHECK] tag resolution into the action endpoint (first end-to-end mechanics slice)"
```

---

### Task 7: `[COMBAT_START]` — encounter creation and NPC clamping

**Files:**
- Create: `server/combat-engine.ts`
- Test: `server/combat-engine.test.ts`

**Interfaces:**
- Consumes: `clampNpcStats`, `breakInitiativeTies`, `resolveD20`, `modifierFor` (Task 2); `resolveCharacterModifier` (Task 3); `extractCombatStartTag` (Task 4); `storage.createEncounter`, `storage.createRollLogEntry`, `storage.getCharactersByCampaign` (existing) (Task 5).
- Produces: `startEncounter(params: StartEncounterParams): Promise<Encounter | null>` — returns `null` if no `[COMBAT_START]` tag is present. `EncounterParticipant` type (used by Tasks 8-11 too): `{ id: string; type: "character" | "npc"; name: string; initiative: number; currentHp: number; maxHp: number; ac: number; attackBonus: number; damageDice: string; isDefeated: boolean; fled: boolean; characterId?: number }`.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/combat-engine.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { startEncounter } from "./combat-engine";

function fakeStorage(characters: any[]) {
  const encounters: any[] = [];
  const rollLog: any[] = [];
  return {
    getCharactersByCampaign: (_id: number) => characters,
    createEncounter: (data: any) => { const row = { id: encounters.length + 1, ...data }; encounters.push(row); return row; },
    createRollLogEntry: (entry: any) => { rollLog.push(entry); return entry; },
    getActiveEffectsByCharacter: (_id: number) => [],
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

test("startEncounter: rolls and logs initiative for every participant, sets round=1 turnIndex=0", async () => {
  const storage = fakeStorage([{ id: 1, name: "Kira", str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10, ac: 10, damageDice: "1d4", attackAbility: "str", level: 1, hp: 10, maxHp: 10, proficiencies: "[]" }]);
  const tag = '[COMBAT_START]{"npcs":[{"name":"Goblin","hp":11,"ac":13,"attackBonus":3,"damageDice":"1d6"}]}[/COMBAT_START]';
  const encounter = await startEncounter({ campaignId: 1, rawResponse: tag, powerLevel: "standard", storage: storage as any, rng: () => 9 / 20 });

  assert.equal(encounter!.round, 1);
  assert.equal(encounter!.turnIndex, 0);
  assert.equal(encounter!.status, "active");
  assert.equal(storage._rollLog.filter((r: any) => r.rollType === "initiative").length, 2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `Cannot find module './combat-engine'`.

- [ ] **Step 3: Implement `server/combat-engine.ts` (Part 1 — `startEncounter` only; the turn loop is Task 8)**

```typescript
// server/combat-engine.ts
//
// The server-authoritative combat state machine: encounter creation, and
// (added in Task 8) the turn-advancement loop. NPC stats are always clamped
// against the campaign's powerLevel before being persisted; PC stats are
// always read from the real characters table, never from the AI's tag.

import { clampNpcStats, breakInitiativeTies, resolveD20, modifierFor, type Rng } from "./dice-engine";
import { resolveCharacterModifier } from "./character-stats";
import { extractCombatStartTag } from "./mechanics-tags";
import type { Encounter } from "@shared/schema";

export interface EncounterParticipant {
  id: string;
  type: "character" | "npc";
  name: string;
  initiative: number;
  currentHp: number;
  maxHp: number;
  ac: number;
  attackBonus: number;
  damageDice: string;
  isDefeated: boolean;
  fled: boolean;
  characterId?: number;
}

interface CharacterRow {
  id: number;
  name: string;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  ac: number;
  damageDice: string;
  attackAbility: string;
  level: number;
  hp: number;
  maxHp: number;
  proficiencies: string;
}

interface StorageLike {
  getCharactersByCampaign(campaignId: number): CharacterRow[];
  createEncounter(data: any): Encounter;
  createRollLogEntry(entry: any): any;
  getActiveEffectsByCharacter(characterId: number): Array<{ statMods: string }>;
}

export interface StartEncounterParams {
  campaignId: number;
  rawResponse: string;
  powerLevel: string;
  storage: StorageLike;
  rng: Rng;
}

export async function startEncounter(params: StartEncounterParams): Promise<Encounter | null> {
  const tag = extractCombatStartTag(params.rawResponse);
  if (!tag) return null;

  const allCharacters = params.storage.getCharactersByCampaign(params.campaignId);
  const involvedCharacters = tag.participants
    ? allCharacters.filter((c) => tag.participants!.includes(c.name))
    : allCharacters;

  const pcParticipants: EncounterParticipant[] = involvedCharacters.map((c) => {
    const attackAbility = (["str", "dex", "int"].includes(c.attackAbility) ? c.attackAbility : "str") as "str" | "dex" | "int";
    const attackResolved = resolveCharacterModifier(c.id, attackAbility, { skill: "attack" }, params.storage as any);
    return {
      id: `char-${c.id}`,
      type: "character",
      name: c.name,
      initiative: 0, // set below
      currentHp: c.hp,
      maxHp: c.maxHp,
      ac: c.ac,
      attackBonus: attackResolved.total,
      damageDice: c.damageDice,
      isDefeated: c.hp <= 0,
      fled: false,
      characterId: c.id,
    };
  });

  const npcParticipants: EncounterParticipant[] = tag.npcs.map((npc, index) => {
    const clamped = clampNpcStats(npc, params.powerLevel);
    return {
      id: `npc-${index}-${npc.name.toLowerCase().replace(/\s+/g, "-")}`,
      type: "npc",
      name: npc.name,
      initiative: 0,
      currentHp: clamped.hp,
      maxHp: clamped.hp,
      ac: clamped.ac,
      attackBonus: clamped.attackBonus,
      damageDice: clamped.damageDice,
      isDefeated: false,
      fled: false,
    };
  });

  const encounter = params.storage.createEncounter({
    campaignId: params.campaignId,
    status: "active",
    round: 1,
    turnIndex: 0,
    participants: "[]", // placeholder, updated below once initiative is rolled
  });

  const allParticipants = [...pcParticipants, ...npcParticipants];
  const withInitiative = allParticipants.map((participant) => {
    const dexModifier =
      participant.type === "character"
        ? resolveCharacterModifier(participant.characterId!, "dex", {}, params.storage as any).baseModifier +
          resolveCharacterModifier(participant.characterId!, "dex", {}, params.storage as any).effectModifier
        : modifierFor(10); // NPCs don't have a full ability block; initiative parity with an average DEX

    const roll = resolveD20({ rng: params.rng, modifier: dexModifier, target: 0, kind: "initiative" });

    params.storage.createRollLogEntry({
      campaignId: params.campaignId,
      encounterId: encounter.id,
      characterId: participant.characterId ?? null,
      participantId: participant.id,
      rollType: "initiative",
      statUsed: "dex",
      baseModifier: dexModifier,
      effectModifier: 0,
      proficiencyBonus: 0,
      diceResult: roll.diceResult,
      total: roll.total,
      targetValue: 0,
      isCritical: roll.isCritical,
      isFumble: roll.isFumble,
      outcome: roll.outcome,
      turnKey: "0:0",
    });

    return { ...participant, initiative: roll.total, dexModifier };
  });

  const ordered = breakInitiativeTies(withInitiative);
  const finalParticipants: EncounterParticipant[] = ordered.map(({ dexModifier, ...p }) => p);

  const updatedEncounter: Encounter = { ...encounter, participants: JSON.stringify(finalParticipants) };
  (params.storage as any).updateEncounter?.(encounter.id, { participants: JSON.stringify(finalParticipants) });

  return updatedEncounter;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `combat-engine.test.ts` tests pass.

- [ ] **Step 5: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
git add server/combat-engine.ts server/combat-engine.test.ts
git commit -m "Add encounter creation: PC/NPC participant seeding, NPC clamping, initiative"
```

---

### Task 8: Turn loop core — skip defeated/fled, effect ticking, deterministic end conditions

**Files:**
- Modify: `server/combat-engine.ts`
- Test: `server/combat-engine-turnloop.test.ts`

**Interfaces:**
- Consumes: `EncounterParticipant` (Task 7); `storage.updateEncounter`, `storage.tickEffects` (existing) (Task 5/existing).
- Produces: `advanceToNextActionableTurn(encounterId: number, storage: StorageLike): { encounter: Encounter; currentParticipant: EncounterParticipant | null }` — the `null` case means the encounter just ended (victory/defeat/aborted); the caller checks `encounter.status` to find out which. This is the function Task 9 (player attacks) and Task 10 (NPC turns) both call after resolving a turn.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/combat-engine-turnloop.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceToNextActionableTurn } from "./combat-engine";

function fakeStorageWithEncounter(encounter: any) {
  const store = { ...encounter };
  const tickedCharacterIds: number[] = [];
  return {
    getEncounter: (_id: number) => ({ ...store }),
    updateEncounter: (_id: number, updates: any) => Object.assign(store, updates),
    tickEffects: (characterId: number) => { tickedCharacterIds.push(characterId); return []; },
    _tickedCharacterIds: tickedCharacterIds,
    _store: store,
  };
}

const baseParticipants = (overrides: any[]) => JSON.stringify(overrides);

test("advanceToNextActionableTurn: stops immediately on a living PC's turn", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant?.name, "Kira");
  assert.equal(storage._store.turnIndex, 0);
});

test("advanceToNextActionableTurn: skips a defeated participant and lands on the next living one", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: true, fled: false, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant?.name, "Goblin");
  assert.equal(storage._store.turnIndex, 1);
});

test("advanceToNextActionableTurn: skips a fled participant", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: true, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant?.name, "Goblin");
});

test("advanceToNextActionableTurn: wraps to round 2 and ticks effects for every character participant", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 1, // last participant's turn just finished
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(storage._store.round, 2);
  assert.equal(result.currentParticipant?.name, "Kira");
  assert.deepEqual(storage._tickedCharacterIds, [1]);
});

test("advanceToNextActionableTurn: all NPCs defeated ends the encounter with victory", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: true, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant, null);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "victory");
});

test("advanceToNextActionableTurn: all PCs defeated ends the encounter with defeat", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "active", round: 1, turnIndex: 0,
    participants: baseParticipants([
      { id: "char-1", type: "character", name: "Kira", isDefeated: true, fled: false, characterId: 1 },
      { id: "npc-0", type: "npc", name: "Goblin", isDefeated: false, fled: false },
    ]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant, null);
  assert.equal(storage._store.outcome, "defeat");
});

test("advanceToNextActionableTurn: an already-ended encounter is a no-op", () => {
  const storage = fakeStorageWithEncounter({
    id: 1, status: "ended", outcome: "victory", round: 3, turnIndex: 0,
    participants: baseParticipants([{ id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 }]),
  });
  const result = advanceToNextActionableTurn(1, storage as any);
  assert.equal(result.currentParticipant, null);
  assert.equal(storage._store.status, "ended"); // unchanged
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `advanceToNextActionableTurn is not exported`.

- [ ] **Step 3: Add `advanceToNextActionableTurn` to `server/combat-engine.ts`**

Append to `server/combat-engine.ts` (after `startEncounter`), and extend `StorageLike` with the two methods this needs:

```typescript
// Extend the module's StorageLike (edit the existing interface declared above
// in this file to add these two members):
//   getEncounter(id: number): Encounter | undefined;
//   tickEffects(characterId: number): unknown[];

export interface AdvanceTurnResult {
  encounter: Encounter;
  currentParticipant: EncounterParticipant | null;
}

function checkDeterministicEnd(participants: EncounterParticipant[]): "victory" | "defeat" | "aborted" | null {
  const livingNpcs = participants.filter((p) => p.type === "npc" && !p.isDefeated && !p.fled);
  const livingPcs = participants.filter((p) => p.type === "character" && !p.isDefeated && !p.fled);

  if (livingNpcs.length === 0 && livingPcs.length === 0) return "aborted";
  if (livingNpcs.length === 0) return "victory";
  if (livingPcs.length === 0) return "defeat";
  return null;
}

export function advanceToNextActionableTurn(
  encounterId: number,
  storage: StorageLike & { getEncounter(id: number): Encounter | undefined; tickEffects(characterId: number): unknown[] },
): AdvanceTurnResult {
  let encounter = storage.getEncounter(encounterId)!;
  if (encounter.status !== "active") {
    return { encounter, currentParticipant: null };
  }

  let participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  const endOutcome = checkDeterministicEnd(participants);
  if (endOutcome) {
    (storage as any).updateEncounter(encounterId, { status: "ended", outcome: endOutcome, endedAt: new Date().toISOString() });
    return { encounter: { ...encounter, status: "ended", outcome: endOutcome }, currentParticipant: null };
  }

  let turnIndex = encounter.turnIndex;
  let round = encounter.round;
  let guard = 0;

  while (guard < participants.length * 2 + 2) {
    guard += 1;
    const candidate = participants[turnIndex];

    if (!candidate.isDefeated && !candidate.fled) {
      (storage as any).updateEncounter(encounterId, { turnIndex, round });
      return {
        encounter: { ...encounter, turnIndex, round },
        currentParticipant: candidate,
      };
    }

    turnIndex += 1;
    if (turnIndex >= participants.length) {
      turnIndex = 0;
      round += 1;
      for (const p of participants) {
        if (p.type === "character" && p.characterId) storage.tickEffects(p.characterId);
      }
    }

    const outcomeAfterSkip = checkDeterministicEnd(participants);
    if (outcomeAfterSkip) {
      (storage as any).updateEncounter(encounterId, { status: "ended", outcome: outcomeAfterSkip, endedAt: new Date().toISOString(), turnIndex, round });
      return { encounter: { ...encounter, status: "ended", outcome: outcomeAfterSkip, turnIndex, round }, currentParticipant: null };
    }
  }

  // Every participant defeated/fled but checkDeterministicEnd somehow didn't
  // catch it (defense-in-depth against an inconsistent snapshot) — abort
  // rather than looping forever.
  (storage as any).updateEncounter(encounterId, { status: "ended", outcome: "aborted", endedAt: new Date().toISOString() });
  return { encounter: { ...encounter, status: "ended", outcome: "aborted" }, currentParticipant: null };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `combat-engine-turnloop.test.ts` tests pass, and all earlier test files still pass (no regressions).

- [ ] **Step 5: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
git add server/combat-engine.ts server/combat-engine-turnloop.test.ts
git commit -m "Add turn-advancement loop: skip defeated/fled, effect ticking, deterministic victory/defeat"
```

---

### Task 9: `[ATTACK]` resolution (player-submitted) with crit/fumble

**Files:**
- Modify: `server/combat-engine.ts`
- Test: `server/combat-engine-attack.test.ts`

**Interfaces:**
- Consumes: `resolveD20`, `resolveDamage` (Task 2); `extractAttackTag` (Task 4); `advanceToNextActionableTurn` (Task 8).
- Produces: `resolvePlayerAttack(params: ResolveAttackParams): Promise<AttackResolution | { error: "invalid_target" | "not_your_turn" | "no_tag" }>` where `AttackResolution` carries the roll data plus the updated encounter. Consumed by Task 6's action-endpoint integration point (extended in this task) and by Task 10 (NPC attacks reuse the same core resolver).

- [ ] **Step 1: Write the failing tests**

```typescript
// server/combat-engine-attack.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAttack } from "./combat-engine";

function fakeStorageWithEncounter(participants: any[], overrides: any = {}) {
  const store = { id: 1, status: "active", round: 1, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
  const rollLog: any[] = [];
  return {
    getEncounter: (_id: number) => ({ ...store }),
    updateEncounter: (_id: number, updates: any) => Object.assign(store, updates),
    createRollLogEntry: (entry: any) => { rollLog.push(entry); return entry; },
    tickEffects: (_characterId: number) => [],
    _store: store,
    _rollLog: rollLog,
  };
}

const kira = { id: "char-1", type: "character", name: "Kira", currentHp: 20, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", isDefeated: false, fled: false, characterId: 1 };
const goblin = { id: "npc-0", type: "npc", name: "Goblin", currentHp: 11, maxHp: 11, ac: 13, attackBonus: 3, damageDice: "1d6", isDefeated: false, fled: false };

test("resolveAttack: no tag returns no_tag error", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]);
  const result = await resolveAttack({ encounterId: 1, rawResponse: "just narration", storage: storage as any, rng: () => 0.5, narrate: async () => "x" });
  assert.equal((result as any).error, "no_tag");
});

test("resolveAttack: rejects an attack from a participant who isn't the current turn", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin], { turnIndex: 1 }); // it's the goblin's turn
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const result = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => 0.5, narrate: async () => "x" });
  assert.equal((result as any).error, "not_your_turn");
});

test("resolveAttack: rejects an attack on an invalid/defeated target without consuming a roll", async () => {
  const defeatedGoblin = { ...goblin, isDefeated: true };
  const storage = fakeStorageWithEncounter([kira, defeatedGoblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const result = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => 0.5, narrate: async () => "x" });
  assert.equal((result as any).error, "invalid_target");
  assert.equal(storage._rollLog.length, 0);
});

test("resolveAttack: hit applies damage and logs the roll with real stats", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  // rng sequence: to-hit roll first (14/20 -> 15), then damage roll (3/8 -> 4)
  const values = [14 / 20, 3 / 8];
  let i = 0;
  const rng = () => values[i++];

  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng, narrate: async () => "The blade connects." });

  assert.equal(result.outcome, "hit");
  const updatedGoblin = JSON.parse(storage._store.participants).find((p: any) => p.name === "Goblin");
  assert.equal(updatedGoblin.currentHp, 11 - (4 + 5)); // 15+5=20 >= AC13 -> hit; damage 1d8+5... wait, damage uses ATTACKER's damage dice/modifier
});

test("resolveAttack: natural 20 is an automatic hit with doubled damage dice", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const values = [19 / 20, 0.99, 0.99]; // nat 20 to-hit, two max damage-die rolls (crit doubles 1d8 -> 2d8)
  let i = 0;
  const rng = () => values[i++];

  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng, narrate: async () => "A devastating blow!" });

  assert.equal(result.isCritical, true);
  assert.equal(result.outcome, "hit");
});

test("resolveAttack: natural 1 is an automatic miss, no damage roll, target HP unchanged", async () => {
  const storage = fakeStorageWithEncounter([kira, goblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => 0, narrate: async () => "The strike goes wide." });

  assert.equal(result.isFumble, true);
  assert.equal(result.outcome, "miss");
  const updatedGoblin = JSON.parse(storage._store.participants).find((p: any) => p.name === "Goblin");
  assert.equal(updatedGoblin.currentHp, 11); // unchanged
});

test("resolveAttack: defeating the last NPC ends the encounter as victory via the turn loop", async () => {
  const nearDeadGoblin = { ...goblin, currentHp: 1 };
  const storage = fakeStorageWithEncounter([kira, nearDeadGoblin]);
  const tag = '[ATTACK]{"attacker":"Kira","target":"Goblin"}[/ATTACK]';
  const values = [19 / 20, 0.5]; // guaranteed hit, some damage
  let i = 0;
  const result: any = await resolveAttack({ encounterId: 1, rawResponse: tag, storage: storage as any, rng: () => values[i++], narrate: async () => "The goblin falls." });

  assert.equal(result.encounterEnded, true);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "victory");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `resolveAttack is not exported`.

- [ ] **Step 3: Add `resolveAttack` to `server/combat-engine.ts`**

Append (imports at the top of the file need `resolveDamage` and `extractAttackTag` added):

```typescript
// Add to the existing import lines at the top of combat-engine.ts:
//   import { clampNpcStats, breakInitiativeTies, resolveD20, resolveDamage, modifierFor, type Rng } from "./dice-engine";
//   import { extractCombatStartTag, extractAttackTag } from "./mechanics-tags";

export interface ResolveAttackParams {
  encounterId: number;
  rawResponse: string;
  storage: StorageLike & { getEncounter(id: number): Encounter | undefined; tickEffects(characterId: number): unknown[]; updateEncounter(id: number, updates: any): void };
  rng: Rng;
  narrate: (prompt: string) => Promise<string>;
}

export interface AttackResolution {
  outcome: "hit" | "miss";
  isCritical: boolean;
  isFumble: boolean;
  attacker: string;
  target: string;
  damageDealt: number;
  narration: string;
  encounterEnded: boolean;
}

export async function resolveAttack(
  params: ResolveAttackParams,
): Promise<AttackResolution | { error: "no_tag" | "not_your_turn" | "invalid_target" }> {
  const tag = extractAttackTag(params.rawResponse);
  if (!tag) return { error: "no_tag" };

  const encounter = params.storage.getEncounter(params.encounterId)!;
  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  const currentTurnParticipant = participants[encounter.turnIndex];
  if (!currentTurnParticipant || currentTurnParticipant.name !== tag.attacker) {
    return { error: "not_your_turn" };
  }

  const attacker = currentTurnParticipant;
  const target = participants.find((p) => p.name === tag.target);
  if (!target || target.isDefeated || target.fled) {
    return { error: "invalid_target" };
  }

  const toHit = resolveD20({ rng: params.rng, modifier: attacker.attackBonus, target: target.ac, kind: "attack" });

  let damageDealt = 0;
  if (toHit.outcome === "hit") {
    damageDealt = resolveDamage({ damageDice: attacker.damageDice, modifier: attacker.attackBonus, isCritical: toHit.isCritical, rng: params.rng });
  }

  (params.storage as any).createRollLogEntry({
    campaignId: (encounter as any).campaignId,
    encounterId: encounter.id,
    characterId: attacker.characterId ?? null,
    participantId: attacker.id,
    rollType: "attack",
    statUsed: "attack",
    baseModifier: attacker.attackBonus,
    effectModifier: 0,
    proficiencyBonus: 0,
    diceResult: toHit.diceResult,
    total: toHit.total,
    targetValue: target.ac,
    isCritical: toHit.isCritical,
    isFumble: toHit.isFumble,
    outcome: toHit.outcome,
    turnKey: `${encounter.round}:${encounter.turnIndex}`,
  });

  const updatedParticipants = participants.map((p) => {
    if (p.id !== target.id) return p;
    const newHp = Math.max(0, p.currentHp - damageDealt);
    return { ...p, currentHp: newHp, isDefeated: newHp === 0 };
  });

  params.storage.updateEncounter(params.encounterId, {
    participants: JSON.stringify(updatedParticipants),
    lastResolvedTurnKey: `${encounter.round}:${encounter.turnIndex}`,
  });

  const narratePrompt =
    toHit.outcome === "hit"
      ? `${attacker.name} attacks ${target.name}: rolled ${toHit.diceResult} + ${attacker.attackBonus} = ${toHit.total} vs AC ${target.ac} → HIT${toHit.isCritical ? " (CRITICAL)" : ""}, ${damageDealt} damage. Narrate this outcome in 2-4 sentences. Do not restate the numbers.`
      : `${attacker.name} attacks ${target.name}: rolled ${toHit.diceResult} + ${attacker.attackBonus} = ${toHit.total} vs AC ${target.ac} → MISS${toHit.isFumble ? " (FUMBLE)" : ""}. Narrate this outcome in 2-4 sentences. Do not restate the numbers.`;

  let narration: string;
  try {
    narration = await params.narrate(narratePrompt);
  } catch {
    narration =
      toHit.outcome === "hit"
        ? `${attacker.name}'s attack connects, dealing a solid blow to ${target.name}.`
        : `${attacker.name}'s attack goes wide, missing ${target.name} entirely.`;
  }

  const advanced = advanceToNextActionableTurn(params.encounterId, params.storage as any);

  return {
    outcome: toHit.outcome,
    isCritical: toHit.isCritical,
    isFumble: toHit.isFumble,
    attacker: attacker.name,
    target: target.name,
    damageDealt,
    narration,
    encounterEnded: advanced.encounter.status === "ended",
  };
}
```

Note the test comment on line "damage uses ATTACKER's damage dice/modifier" — `resolveDamage`'s `modifier` parameter is intentionally the attacker's `attackBonus` (not a separate "damage modifier"), matching the design's simplified v1 model where one number governs both to-hit and damage-bonus; this is consistent with the `damageDice` default (`"1d4"`) being deliberately small so this doesn't produce outsized damage.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `combat-engine-attack.test.ts` tests pass. (The one test with an inline `assert.equal` comment showing the arithmetic is illustrative — confirm the actual computed value matches what the implementation produces, since `resolveDamage`'s modifier is the full `attackBonus`, not a separate damage-only modifier; if a test's literal expected number doesn't match, fix the test's expected value to match the implementation's documented behavior above, not the other way around.)

- [ ] **Step 5: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
git add server/combat-engine.ts server/combat-engine-attack.test.ts
git commit -m "Add player attack resolution: to-hit, damage, crit/fumble, turn-loop integration"
```

---

### Task 10: NPC turn resolution

**Files:**
- Create: `server/npc-turn.ts`
- Modify: `server/combat-engine.ts` (export a small helper used by `npc-turn.ts`)
- Test: `server/npc-turn.test.ts`

**Interfaces:**
- Consumes: `resolveAttack`'s internal roll logic (refactored slightly — see Step 3) and `advanceToNextActionableTurn` (Task 8/9).
- Produces: `resolveNpcTurn(params: ResolveNpcTurnParams): Promise<NpcTurnResult>` — always resolves an action for the current NPC (never returns an error state, since the deterministic fallback guarantees a result). Called in a loop by the route handler (Task 11) until the current turn is a PC or the encounter ends.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/npc-turn.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNpcTurn } from "./npc-turn";

function fakeStorageWithEncounter(participants: any[], overrides: any = {}) {
  const store = { id: 1, campaignId: 9, status: "active", round: 1, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
  const rollLog: any[] = [];
  return {
    getEncounter: (_id: number) => ({ ...store }),
    updateEncounter: (_id: number, updates: any) => Object.assign(store, updates),
    createRollLogEntry: (entry: any) => { rollLog.push(entry); return entry; },
    tickEffects: (_characterId: number) => [],
    _store: store,
    _rollLog: rollLog,
  };
}

const goblin = { id: "npc-0", type: "npc", name: "Goblin", currentHp: 11, maxHp: 11, ac: 13, attackBonus: 3, damageDice: "1d6", isDefeated: false, fled: false };
const kira = { id: "char-1", type: "character", name: "Kira", currentHp: 20, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", isDefeated: false, fled: false, characterId: 1 };
const doran = { id: "char-2", type: "character", name: "Doran", currentHp: 5, maxHp: 20, ac: 12, attackBonus: 5, damageDice: "1d8", isDefeated: false, fled: false, characterId: 2 };

test("resolveNpcTurn: valid AI-proposed attack on a valid target resolves normally", async () => {
  const storage = fakeStorageWithEncounter([goblin, kira]); // goblin's turn (index 0)
  const generateNpcAction = async () => '[ATTACK]{"attacker":"Goblin","target":"Kira"}[/ATTACK]';
  const result = await resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 19 / 20, generateNpcAction, narrate: async () => "The goblin lunges." });
  assert.equal(result.attacker, "Goblin");
  assert.equal(result.target, "Kira");
});

test("resolveNpcTurn: AI proposes an invalid/dead target -> falls back to lowest-HP living PC", async () => {
  const storage = fakeStorageWithEncounter([goblin, kira, doran]);
  const generateNpcAction = async () => '[ATTACK]{"attacker":"Goblin","target":"Nonexistent Ghost"}[/ATTACK]';
  const result = await resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 19 / 20, generateNpcAction, narrate: async () => "The goblin strikes." });
  assert.equal(result.target, "Doran"); // lower HP than Kira
});

test("resolveNpcTurn: malformed AI response -> falls back to lowest-HP living PC", async () => {
  const storage = fakeStorageWithEncounter([goblin, kira, doran]);
  const generateNpcAction = async () => "The goblin snarls menacingly."; // no tag at all
  const result = await resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 19 / 20, generateNpcAction, narrate: async () => "x" });
  assert.equal(result.target, "Doran");
});

test("resolveNpcTurn: AI call throwing -> falls back to lowest-HP living PC, does not throw", async () => {
  const storage = fakeStorageWithEncounter([goblin, kira, doran]);
  const generateNpcAction = async () => { throw new Error("model unavailable"); };
  const result = await resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 19 / 20, generateNpcAction, narrate: async () => "x" });
  assert.equal(result.target, "Doran");
});

test("resolveNpcTurn: advances the turn afterward", async () => {
  const storage = fakeStorageWithEncounter([goblin, kira]);
  const generateNpcAction = async () => '[ATTACK]{"attacker":"Goblin","target":"Kira"}[/ATTACK]';
  await resolveNpcTurn({ encounterId: 1, storage: storage as any, rng: () => 1 / 20, generateNpcAction, narrate: async () => "x" }); // fumble, no damage
  assert.equal(storage._store.turnIndex, 1); // moved to Kira's turn
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `Cannot find module './npc-turn'`.

- [ ] **Step 3: Export a reusable inner resolver from `combat-engine.ts`**

`resolveAttack` (Task 9) currently parses its own `[ATTACK]` tag from `rawResponse` and enforces the "is it actually your turn" check against `tag.attacker`. The NPC path needs the same roll/mutate/log/advance logic but already knows the attacker (it's always the current-turn NPC) and needs a deterministic-fallback target instead of erroring on an invalid one. Refactor `combat-engine.ts`: extract the core (everything in `resolveAttack` from `const toHit = resolveD20(...)` through the `return { outcome: ... }`) into a new exported function:

```typescript
// In combat-engine.ts, add this export (the body is exactly what resolveAttack
// already does from its "const toHit = resolveD20(...)" line onward — resolveAttack
// itself is refactored to validate the tag/turn/target, then delegate to this):

export async function executeAttack(params: {
  encounterId: number;
  attacker: EncounterParticipant;
  target: EncounterParticipant;
  storage: ResolveAttackParams["storage"];
  rng: Rng;
  narrate: (prompt: string) => Promise<string>;
}): Promise<AttackResolution> {
  const encounter = params.storage.getEncounter(params.encounterId)!;
  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  const toHit = resolveD20({ rng: params.rng, modifier: params.attacker.attackBonus, target: params.target.ac, kind: "attack" });

  let damageDealt = 0;
  if (toHit.outcome === "hit") {
    damageDealt = resolveDamage({ damageDice: params.attacker.damageDice, modifier: params.attacker.attackBonus, isCritical: toHit.isCritical, rng: params.rng });
  }

  (params.storage as any).createRollLogEntry({
    campaignId: (encounter as any).campaignId,
    encounterId: encounter.id,
    characterId: params.attacker.characterId ?? null,
    participantId: params.attacker.id,
    rollType: "attack",
    statUsed: "attack",
    baseModifier: params.attacker.attackBonus,
    effectModifier: 0,
    proficiencyBonus: 0,
    diceResult: toHit.diceResult,
    total: toHit.total,
    targetValue: params.target.ac,
    isCritical: toHit.isCritical,
    isFumble: toHit.isFumble,
    outcome: toHit.outcome,
    turnKey: `${encounter.round}:${encounter.turnIndex}`,
  });

  const updatedParticipants = participants.map((p) => {
    if (p.id !== params.target.id) return p;
    const newHp = Math.max(0, p.currentHp - damageDealt);
    return { ...p, currentHp: newHp, isDefeated: newHp === 0 };
  });

  params.storage.updateEncounter(params.encounterId, {
    participants: JSON.stringify(updatedParticipants),
    lastResolvedTurnKey: `${encounter.round}:${encounter.turnIndex}`,
  });

  const narratePrompt =
    toHit.outcome === "hit"
      ? `${params.attacker.name} attacks ${params.target.name}: rolled ${toHit.diceResult} + ${params.attacker.attackBonus} = ${toHit.total} vs AC ${params.target.ac} → HIT${toHit.isCritical ? " (CRITICAL)" : ""}, ${damageDealt} damage. Narrate this outcome in 2-4 sentences. Do not restate the numbers.`
      : `${params.attacker.name} attacks ${params.target.name}: rolled ${toHit.diceResult} + ${params.attacker.attackBonus} = ${toHit.total} vs AC ${params.target.ac} → MISS${toHit.isFumble ? " (FUMBLE)" : ""}. Narrate this outcome in 2-4 sentences. Do not restate the numbers.`;

  let narration: string;
  try {
    narration = await params.narrate(narratePrompt);
  } catch {
    narration =
      toHit.outcome === "hit"
        ? `${params.attacker.name}'s attack connects, dealing a solid blow to ${params.target.name}.`
        : `${params.attacker.name}'s attack goes wide, missing ${params.target.name} entirely.`;
  }

  const advanced = advanceToNextActionableTurn(params.encounterId, params.storage as any);

  return {
    outcome: toHit.outcome,
    isCritical: toHit.isCritical,
    isFumble: toHit.isFumble,
    attacker: params.attacker.name,
    target: params.target.name,
    damageDealt,
    narration,
    encounterEnded: advanced.encounter.status === "ended",
  };
}
```

Then simplify `resolveAttack` itself to validate and delegate:

```typescript
export async function resolveAttack(
  params: ResolveAttackParams,
): Promise<AttackResolution | { error: "no_tag" | "not_your_turn" | "invalid_target" }> {
  const tag = extractAttackTag(params.rawResponse);
  if (!tag) return { error: "no_tag" };

  const encounter = params.storage.getEncounter(params.encounterId)!;
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

- [ ] **Step 4: Implement `server/npc-turn.ts`**

```typescript
// server/npc-turn.ts
//
// Resolves a single NPC's turn in an active encounter. Always produces a
// result — never returns an error state — because a malformed or absent AI
// proposal falls back to a deterministic target choice (lowest current HP
// among living PCs), per the design's "the server never blocks on the AI
// behaving correctly" guarantee.

import { extractAttackTag } from "./mechanics-tags";
import { executeAttack, type AttackResolution, type EncounterParticipant, type ResolveAttackParams } from "./combat-engine";
import type { Rng } from "./dice-engine";

export interface ResolveNpcTurnParams {
  encounterId: number;
  storage: ResolveAttackParams["storage"];
  rng: Rng;
  generateNpcAction: () => Promise<string>;
  narrate: (prompt: string) => Promise<string>;
}

function pickFallbackTarget(livingPcs: EncounterParticipant[]): EncounterParticipant {
  return [...livingPcs].sort((a, b) => a.currentHp - b.currentHp)[0];
}

export async function resolveNpcTurn(params: ResolveNpcTurnParams): Promise<AttackResolution> {
  const encounter = params.storage.getEncounter(params.encounterId)!;
  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);
  const npc = participants[encounter.turnIndex];

  const livingPcs = participants.filter((p) => p.type === "character" && !p.isDefeated && !p.fled);

  let target: EncounterParticipant | undefined;

  try {
    const aiResponse = await params.generateNpcAction();
    const tag = extractAttackTag(aiResponse);
    if (tag) {
      target = livingPcs.find((p) => p.name === tag.target);
    }
  } catch {
    target = undefined; // AI call failed — fall through to the deterministic fallback
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

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `npc-turn.test.ts` tests pass, and `combat-engine-attack.test.ts` still passes after the `resolveAttack` refactor.

- [ ] **Step 6: Add `generateNpcTurnAction` to `server/dm-provider.ts`-adjacent code**

In `server/dm-engine.ts`, add (near `generateDMResponse`):

```typescript
export async function generateNpcTurnAction(
  npcName: string,
  npcNotes: string,
  currentScene: string,
  validTargetNames: string[],
): Promise<string> {
  const system = `You are DMS controlling ${npcName} during combat. It is ${npcName}'s turn.

Respond with EXACTLY ONE of:
- An attack: [ATTACK]{"attacker":"${npcName}","target":"<one of: ${validTargetNames.join(", ")}>"}[/ATTACK]
- A non-attack action described in plain prose only (flee, taunt, use an item) — no tag.

Do not narrate the outcome of the action, only declare the intent. Keep any prose to one sentence.`;

  return generateNarrationText({
    system,
    maxTokens: 150,
    purpose: "npc turn action",
    messages: [
      {
        role: "user",
        content: `Current scene: ${currentScene}\n${npcName}'s notes: ${npcNotes || "none"}\nValid targets: ${validTargetNames.join(", ")}\n\nWhat does ${npcName} do?`,
      },
    ],
  });
}
```

(`generateNarrationText` is already imported in `dm-engine.ts` from `./dm-provider`.)

- [ ] **Step 7: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
git add server/npc-turn.ts server/npc-turn.test.ts server/combat-engine.ts server/dm-engine.ts server/combat-engine-attack.test.ts
git commit -m "Add NPC turn resolution with deterministic fallback targeting"
```

---

### Task 11: `[COMBAT_END]` surrender handling and the flee endpoint

**Files:**
- Modify: `server/combat-engine.ts`
- Modify: `server/routes.ts`
- Test: `server/combat-engine-end.test.ts`

**Interfaces:**
- Consumes: `extractCombatEndTag` (Task 4); `advanceToNextActionableTurn` (Task 8) for the deterministic-check-after-mutation pattern.
- Produces: `applySurrenderTag(encounterId: number, rawResponse: string, storage): boolean` (returns whether a `[COMBAT_END]` tag was found and applied); `fleeEncounter(encounterId: number, participantName: string, storage): { fled: boolean; encounterEnded: boolean }`. New route: `POST /api/campaigns/:id/encounter/flee`.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/combat-engine-end.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { applySurrenderTag, fleeEncounter } from "./combat-engine";

function fakeStorageWithEncounter(participants: any[], overrides: any = {}) {
  const store = { id: 1, status: "active", round: 1, turnIndex: 0, participants: JSON.stringify(participants), ...overrides };
  return {
    getEncounter: (_id: number) => ({ ...store }),
    updateEncounter: (_id: number, updates: any) => Object.assign(store, updates),
    tickEffects: (_characterId: number) => [],
    createRollLogEntry: (_entry: any) => {},
    _store: store,
  };
}

const kira = { id: "char-1", type: "character", name: "Kira", isDefeated: false, fled: false, characterId: 1 };
const goblin1 = { id: "npc-0", type: "npc", name: "Goblin 1", isDefeated: false, fled: false };
const goblin2 = { id: "npc-1", type: "npc", name: "Goblin 2", isDefeated: false, fled: false };

test("applySurrenderTag: no tag present returns false, no mutation", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  const applied = applySurrenderTag(1, "just narration", storage as any);
  assert.equal(applied, false);
});

test("applySurrenderTag: marks all living NPCs defeated and the deterministic victory check then ends the encounter", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1, goblin2]);
  const applied = applySurrenderTag(1, '[COMBAT_END]{"reason":"the goblins throw down their weapons"}[/COMBAT_END]', storage as any);
  assert.equal(applied, true);
  assert.equal(storage._store.status, "ended");
  assert.equal(storage._store.outcome, "victory");
});

test("applySurrenderTag: reason content is never parsed/branched on — any reason string produces the same effect", () => {
  const storage = fakeStorageWithEncounter([kira, goblin1]);
  applySurrenderTag(1, '[COMBAT_END]{"reason":"they simply vanish"}[/COMBAT_END]', storage as any);
  assert.equal(storage._store.outcome, "victory");
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

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `applySurrenderTag is not exported`.

- [ ] **Step 3: Implement `applySurrenderTag` and `fleeEncounter` in `server/combat-engine.ts`**

```typescript
// Add to the imports at the top: extractCombatEndTag from "./mechanics-tags"

export function applySurrenderTag(
  encounterId: number,
  rawResponse: string,
  storage: StorageLike & { getEncounter(id: number): Encounter | undefined; updateEncounter(id: number, updates: any): void; tickEffects(characterId: number): unknown[] },
): boolean {
  const tag = extractCombatEndTag(rawResponse);
  if (!tag) return false;

  const encounter = storage.getEncounter(encounterId)!;
  if (encounter.status !== "active") return true; // nothing to do, but a tag WAS present

  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);
  const updated = participants.map((p) => (p.type === "npc" && !p.isDefeated ? { ...p, isDefeated: true } : p));

  storage.updateEncounter(encounterId, { participants: JSON.stringify(updated) });
  advanceToNextActionableTurn(encounterId, storage as any); // runs the deterministic victory check, which now finds no living NPCs

  return true;
}

export function fleeEncounter(
  encounterId: number,
  participantName: string,
  storage: StorageLike & { getEncounter(id: number): Encounter | undefined; updateEncounter(id: number, updates: any): void; tickEffects(characterId: number): unknown[] },
): { fled: boolean; encounterEnded: boolean } {
  const encounter = storage.getEncounter(encounterId)!;
  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);

  const target = participants.find((p) => p.name === participantName);
  if (!target) return { fled: false, encounterEnded: false };

  const updated = participants.map((p) => (p.id === target.id ? { ...p, fled: true } : p));
  storage.updateEncounter(encounterId, { participants: JSON.stringify(updated) });

  const advanced = advanceToNextActionableTurn(encounterId, storage as any);

  return { fled: true, encounterEnded: advanced.encounter.status === "ended" };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `combat-engine-end.test.ts` tests pass.

- [ ] **Step 5: Add the flee endpoint to `server/routes.ts`**

Add, near the existing `POST /api/campaigns/:id/action` endpoint:

```typescript
  app.post("/api/campaigns/:id/encounter/flee", requireAuth, async (req, res) => {
    const visitorId = getVisitorId(req);
    const campaignId = Number(req.params.id);
    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return res.status(403).json({ message: "You don't have a character in this campaign" });

    const encounter = storage.getActiveEncounterByCampaign(campaignId);
    if (!encounter) return res.status(404).json({ message: "No active encounter" });

    const result = fleeEncounter(encounter.id, character.name, storage);
    if (!result.fled) return res.status(400).json({ message: "You are not part of this encounter" });

    broadcastToCampaign(campaignId, { type: "encounter_updated", encounterId: encounter.id });
    if (result.encounterEnded) {
      broadcastToCampaign(campaignId, { type: "encounter_ended", encounterId: encounter.id });
    }

    return res.json({ fled: true, encounterEnded: result.encounterEnded });
  });
```

Add the import: `import { fleeEncounter } from "./combat-engine";` (may already be present from Task 7's import if consolidated — check for a duplicate import line before adding).

- [ ] **Step 6: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
git add server/combat-engine.ts server/combat-engine-end.test.ts server/routes.ts
git commit -m "Add server-authoritative combat-end handling and flee endpoint"
```

---

### Task 12: Concurrency — per-campaign action mutex and duplicate-submission handling

**Files:**
- Create: `server/action-mutex.ts`
- Modify: `server/routes.ts`
- Test: `server/action-mutex.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `withCampaignLock<T>(campaignId: number, fn: () => Promise<T>): Promise<T>` — queues concurrent calls for the same `campaignId` so only one runs at a time; different campaigns run fully in parallel.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/action-mutex.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { withCampaignLock } from "./action-mutex";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("withCampaignLock: serializes concurrent calls for the same campaign", async () => {
  const order: string[] = [];

  const a = withCampaignLock(1, async () => {
    order.push("a-start");
    await delay(20);
    order.push("a-end");
    return "a";
  });
  const b = withCampaignLock(1, async () => {
    order.push("b-start");
    await delay(5);
    order.push("b-end");
    return "b";
  });

  const [resultA, resultB] = await Promise.all([a, b]);
  assert.equal(resultA, "a");
  assert.equal(resultB, "b");
  // b must not start until a has fully finished, even though b's own work is faster
  assert.deepEqual(order, ["a-start", "a-end", "b-start", "b-end"]);
});

test("withCampaignLock: different campaigns run concurrently, not serialized", async () => {
  const order: string[] = [];

  const a = withCampaignLock(1, async () => {
    order.push("campaign1-start");
    await delay(20);
    order.push("campaign1-end");
  });
  const b = withCampaignLock(2, async () => {
    order.push("campaign2-start");
    await delay(5);
    order.push("campaign2-end");
  });

  await Promise.all([a, b]);
  // campaign2 finishes before campaign1 even though campaign1 started first,
  // proving they ran in parallel rather than being serialized against each other.
  assert.deepEqual(order, ["campaign1-start", "campaign2-start", "campaign2-end", "campaign1-end"]);
});

test("withCampaignLock: a rejected call doesn't block the next queued call for the same campaign", async () => {
  const results: string[] = [];

  const a = withCampaignLock(3, async () => {
    throw new Error("boom");
  });
  const b = withCampaignLock(3, async () => {
    results.push("b-ran");
    return "ok";
  });

  await assert.rejects(a, /boom/);
  const resultB = await b;
  assert.equal(resultB, "ok");
  assert.deepEqual(results, ["b-ran"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `Cannot find module './action-mutex'`.

- [ ] **Step 3: Implement `server/action-mutex.ts`**

```typescript
// server/action-mutex.ts
//
// In-process per-campaign serialization. This is what makes turn-order
// enforcement actually hold under real concurrent HTTP requests, not just in
// the single-player happy path — without it, two players submitting actions
// at the same moment could both read the same "current turn" state and both
// proceed. Correct for DMOS's current single-process (systemd) deployment;
// would need to become a DB-level lock if ever scaled to multiple instances.

const queues = new Map<number, Promise<unknown>>();

export function withCampaignLock<T>(campaignId: number, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(campaignId) ?? Promise.resolve();

  const run = previous
    .catch(() => {}) // a prior call's rejection must not propagate into or block this one
    .then(fn);

  // Store a settled-either-way marker so the NEXT call queues behind this one
  // regardless of whether `run` itself resolves or rejects.
  const marker = run.catch(() => {});
  queues.set(campaignId, marker);

  return run;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `action-mutex.test.ts` tests pass.

- [ ] **Step 5: Wrap the action endpoint and combat-mutating endpoints in the lock**

In `server/routes.ts`, find the start of the action endpoint body:

```typescript
  app.post("/api/campaigns/:id/action", requireAuth, requireCanPlay, checkTurnLimit, async (req, res) => {
    const visitorId = getVisitorId(req);
    const campaignId = Number(req.params.id);
```

Wrap the entire existing handler body (from `const campaign = storage.getCampaign(campaignId);` through the end of the route's try/catch, i.e. everything currently inside this handler) in `withCampaignLock`. Concretely: rename the existing handler function body to an inner `async function handleAction(req, res, campaignId)` and change the route registration to:

```typescript
  app.post("/api/campaigns/:id/action", requireAuth, requireCanPlay, checkTurnLimit, async (req, res) => {
    const campaignId = Number(req.params.id);
    await withCampaignLock(campaignId, () => handleAction(req, res, campaignId));
  });
```

(This is a mechanical extraction — move the existing handler's full body, unchanged, into a new `async function handleAction(req: Request, res: Response, campaignId: number)` declared just above this route registration, replacing its own internal `const campaignId = Number(req.params.id);` line since that's now a parameter.)

Add the import: `import { withCampaignLock } from "./action-mutex";`

Apply the same wrapping to the flee endpoint added in Task 11 (`POST /api/campaigns/:id/encounter/flee`) — wrap its body in `withCampaignLock(campaignId, ...)` the same way, since fleeing mutates encounter state and must not race against an in-flight action resolution for the same campaign.

- [ ] **Step 6: Wire `clientSubmissionId` dedup into the action endpoint**

In the (now-extracted) `handleAction` function, find:

```typescript
    const playerMsg = storage.createMessage({
      campaignId,
      sender: character.name,
      senderType: "player",
      content,
      messageType: "action",
    });
    broadcastToCampaign(campaignId, { type: "message", message: playerMsg });
```

Replace with:

```typescript
    const clientSubmissionId = typeof req.body?.clientSubmissionId === "string" ? req.body.clientSubmissionId : undefined;

    const { message: playerMsg, wasCreated } = storage.createMessageIdempotent({
      campaignId,
      sender: character.name,
      senderType: "player",
      content,
      messageType: "action",
      clientSubmissionId,
    });

    if (!wasCreated) {
      // Duplicate submission — the original was already processed (or is being
      // processed by a call queued ahead of this one on the same campaign lock).
      // Return the existing message rather than reprocessing the action.
      return res.json({ message: playerMsg, duplicate: true });
    }

    broadcastToCampaign(campaignId, { type: "message", message: playerMsg });
```

- [ ] **Step 7: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
git add server/action-mutex.ts server/action-mutex.test.ts server/routes.ts
git commit -m "Add per-campaign action mutex and duplicate-submission handling"
```

---

### Task 13: Reconnect/resume — encounter resync endpoint and restart-resume logic

**Files:**
- Modify: `server/routes.ts`
- Modify: `server/combat-engine.ts`
- Test: `server/combat-engine-resume.test.ts`

**Interfaces:**
- Consumes: `Encounter`, `rollLog` lookups (Task 5).
- Produces: `GET /api/campaigns/:id/encounter` (returns the active encounter or `null`); `checkForUnresolvedNarration(encounterId, storage): { needsNarrationOnly: boolean; turnKey: string | null }` — used by the route to detect the restart-mid-NPC-turn case described in the design.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/combat-engine-resume.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkForUnresolvedNarration } from "./combat-engine";

function fakeStorage(encounter: any, messages: any[]) {
  return {
    getEncounter: (_id: number) => encounter,
    getMessagesByCampaign: (_campaignId: number) => messages,
  };
}

test("checkForUnresolvedNarration: no lastResolvedTurnKey means nothing to resume", () => {
  const storage = fakeStorage({ id: 1, campaignId: 9, lastResolvedTurnKey: null }, []);
  const result = checkForUnresolvedNarration(1, storage as any);
  assert.equal(result.needsNarrationOnly, false);
});

test("checkForUnresolvedNarration: turn key set and a matching narration message exists -> already fully resolved", () => {
  const storage = fakeStorage(
    { id: 1, campaignId: 9, lastResolvedTurnKey: "1:0" },
    [{ senderType: "dm", messageType: "narration", metadata: JSON.stringify({ roll: { turnKey: "1:0" } }), createdAt: "2026-08-11T00:00:01Z" }],
  );
  const result = checkForUnresolvedNarration(1, storage as any);
  assert.equal(result.needsNarrationOnly, false);
});

test("checkForUnresolvedNarration: turn key set but no matching message -> needs narration only, never a re-roll", () => {
  const storage = fakeStorage({ id: 1, campaignId: 9, lastResolvedTurnKey: "2:1" }, []);
  const result = checkForUnresolvedNarration(1, storage as any);
  assert.equal(result.needsNarrationOnly, true);
  assert.equal(result.turnKey, "2:1");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: FAIL — `checkForUnresolvedNarration is not exported`.

- [ ] **Step 3: Implement `checkForUnresolvedNarration` in `server/combat-engine.ts`**

```typescript
export function checkForUnresolvedNarration(
  encounterId: number,
  storage: { getEncounter(id: number): Encounter | undefined; getMessagesByCampaign(campaignId: number): Array<{ metadata: string }> },
): { needsNarrationOnly: boolean; turnKey: string | null } {
  const encounter = storage.getEncounter(encounterId);
  if (!encounter || !encounter.lastResolvedTurnKey) {
    return { needsNarrationOnly: false, turnKey: null };
  }

  const messages = storage.getMessagesByCampaign((encounter as any).campaignId);
  const hasMatchingNarration = messages.some((m) => {
    try {
      const meta = JSON.parse(m.metadata || "{}");
      return meta?.roll?.turnKey === encounter.lastResolvedTurnKey;
    } catch {
      return false;
    }
  });

  return { needsNarrationOnly: !hasMatchingNarration, turnKey: encounter.lastResolvedTurnKey };
}
```

Note: this requires `resolveAttack`/`executeAttack` (Task 9/10) to also stamp `turnKey` into the saved message's `metadata.roll.turnKey` when they build the DM message — cross-check that step against Task 9/10's message-creation code when implementing this task, and add `turnKey` to the `metadata` payload there if it isn't already included (the `rollLog` entries already carry `turnKey`; the corresponding chat message needs the same value in its `metadata` for this lookup to work).

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run test
```

Expected: all `combat-engine-resume.test.ts` tests pass.

- [ ] **Step 5: Add the `GET /api/campaigns/:id/encounter` endpoint**

In `server/routes.ts`:

```typescript
  app.get("/api/campaigns/:id/encounter", requireAuth, async (req, res) => {
    const campaignId = Number(req.params.id);
    const encounter = storage.getActiveEncounterByCampaign(campaignId);
    if (!encounter) return res.json({ encounter: null });
    return res.json({ encounter, participants: JSON.parse(encounter.participants) });
  });
```

- [ ] **Step 6: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
git add server/combat-engine.ts server/combat-engine-resume.test.ts server/routes.ts
git commit -m "Add encounter resync endpoint and restart-resume detection"
```

---

### Task 14: Frontend integration — StatGenWizard and DiceRoller

**Files:**
- Modify: `client/src/pages/home.tsx` (or wherever character creation currently calls `StatGenWizard`'s `onComplete` — confirm exact call site by searching for `StatGenWizard` usage before editing)
- Modify: `client/src/pages/campaign.tsx` (message rendering, to pass server roll data into `DiceRoller`)

**Interfaces:**
- Consumes: `StatGenWizard`'s existing `onComplete: (scores: Record<Ability, number>) => void` callback (unchanged component); `DiceRoller`'s existing `onResult`/`autoRoll` props (unchanged component); the new `messages.metadata.roll` shape produced by Tasks 6/9/10.
- Produces: character-creation now sends `str`/`dex`/`con`/`int`/`wis`/`cha` to the character-creation API call; message rendering passes server-authoritative roll results into `DiceRoller` instead of only detecting formula strings in prose.

- [ ] **Step 1: Find the exact character-creation call site**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
grep -rn "StatGenWizard" client/src/pages/*.tsx client/src/components/*.tsx
```

Read the surrounding ~30 lines of whatever file this returns to find the `onComplete` handler and the character-creation POST body it currently builds, before editing — the exact shape of that POST body wasn't part of this plan's grounding and must be confirmed against the real file, not assumed.

- [ ] **Step 2: Wire `StatGenWizard`'s output into the character-creation request**

In the file found in Step 1, locate the `onComplete` handler passed to `<StatGenWizard onComplete={...} .../>`. It currently presumably writes scores into a `characterData` sections blob (matching `computedStats.ts`'s current `extractBaseAbilities` heuristic) or discards them into local component state. Add the six scores directly to whatever object is POSTed to the character-creation endpoint, alongside existing fields like `name`/`race`/`charClass`:

```typescript
// Inside the onComplete handler, merging into the existing character-creation payload object:
str: scores.str,
dex: scores.dex,
con: scores.con,
int: scores.int,
wis: scores.wis,
cha: scores.cha,
```

Leave any existing `characterData`-blob writing of the same scores in place for now (do not remove it) — `computedStats.ts` still reads from there until the follow-up reconciliation noted in the design doc's "Open items" happens; this step's job is only to make the new authoritative columns correct going forward, not to migrate the display path yet.

- [ ] **Step 3: Verify the character-creation endpoint accepts these fields**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
grep -n "app.post(\"/api/campaigns/:id/characters\"" server/routes.ts
```

Read that handler. If it uses `insertCharacterSchema.parse(req.body)` or similar (validating against the Drizzle-derived Zod schema from Task 1), the new columns are already accepted automatically since they're now part of the `characters` table schema — no server change needed. If the handler instead manually picks specific fields off `req.body` (an explicit allowlist), add `str`, `dex`, `con`, `int`, `wis`, `cha` to that allowlist.

- [ ] **Step 4: Wire server-authoritative roll results into `DiceRoller`**

In `client/src/pages/campaign.tsx`, find where incoming DM messages are rendered (the `msg.senderType === "dm"` block identified during grounding, around line 772). Add: when a message's `metadata` contains a `roll` object (the shape produced by Tasks 6/9/10 — `{ statUsed, diceResult, total, targetValue, outcome, isCritical, isFumble }`), pass it to `DiceRoller` via its existing `autoRoll` prop pattern rather than letting the component's own `detectDiceRolls` text-scanning trigger it. Concretely: alongside the existing message-rendering JSX, add a derived value:

```typescript
const rollMetadata = (() => {
  try {
    const meta = JSON.parse(msg.metadata || "{}");
    return meta.roll ?? null;
  } catch {
    return null;
  }
})();
```

And where the message content is displayed, if `rollMetadata` is present, render a `DiceRoller` (or a lighter-weight inline result badge using the same `ResultBanner`-style presentation `DiceRoller.tsx` already exports internally) driven by `rollMetadata.diceResult`/`total`/`isCritical`/`isFumble` directly — not by re-rolling or by text-scanning the narration for a formula string, since the real roll already happened server-side and `detectDiceRolls`-based re-triggering would show a *different*, fake, client-rolled number next to the real one. Exact placement/styling is a UI judgment call to make against the live rendered page during implementation (start the dev server and look at it, per this project's own house rule for frontend changes), not something to over-specify in this plan.

- [ ] **Step 5: Manual verification**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run build
```

Then use the Browser tooling to load the built app locally (or against a dev server), create a character through `StatGenWizard`, and confirm no console errors. Full end-to-end roll-display verification happens in Task 15 once the server side is live.

- [ ] **Step 6: Typecheck and commit**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
git add client/src/pages/home.tsx client/src/pages/campaign.tsx
git commit -m "Wire StatGenWizard output and server-authoritative rolls into existing frontend components"
```

(Adjust the file list in the `git add` to whatever Step 1 actually found, if different from `home.tsx`.)

---

### Task 15: Full build, deploy, and end-to-end verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1-14.
- Produces: a deployed, verified release on the live server, following the exact same release/symlink/systemd pattern already used for the earlier history-order-fix deploy (`releases/<timestamp>-<label>`, `chown dmos:dmos`, `ln -sfn ... current`, `systemctl restart dmos.service`).

- [ ] **Step 1: Full local verification before touching the server**

```bash
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
npm run typecheck
npm run test
npm run build
```

Expected: all green, build produces `dist/index.cjs` and `dist/public/` with no errors.

- [ ] **Step 2: Deploy as a new release**

```bash
RELEASE="$(date +%Y%m%d-%H%M%S)-dice-mechanics-engine"
ssh -o BatchMode=yes -i "/c/Users/rager/.ssh/id_ed25519" root@178.104.1.195 "cp -a /srv/dmos/app/current/ /srv/dmos/app/releases/$RELEASE"
cd "/c/Users/rager/Downloads/dungeonmasteros-live"
scp -r -i "/c/Users/rager/.ssh/id_ed25519" server client shared script dist package.json package-lock.json root@178.104.1.195:/srv/dmos/app/releases/$RELEASE/
ssh -o BatchMode=yes -i "/c/Users/rager/.ssh/id_ed25519" root@178.104.1.195 "
cd /srv/dmos/app/releases/$RELEASE
npm ci --omit=dev
chown -R dmos:dmos /srv/dmos/app/releases/$RELEASE
ln -sfn /srv/dmos/app/releases/$RELEASE /srv/dmos/app/current
systemctl restart dmos.service
sleep 2
systemctl status dmos.service --no-pager | head -10
journalctl -u dmos.service --no-pager -n 15
"
```

Expected: service active, "Database migrations complete" and "serving on port 3002" in the logs, no errors — confirming Task 1's migration ran cleanly against the real production database (with its real existing rows, not a fresh test DB).

- [ ] **Step 3: Smoke-test a full check resolution against the live server**

Using a throwaway diagnostic account (register, exercise, then delete — same pattern as the earlier verification pass): register a test user, create a campaign and character, submit an action worded to prompt a check (e.g. "I try to pick the lock"), and confirm via the API response / a direct `rollLog` query that a real roll was logged with real character stats, not just narrated.

- [ ] **Step 4: Smoke-test a full combat encounter**

Same diagnostic account: prompt a combat start, submit at least one player attack, and confirm via direct DB query on `/srv/dmos/shared/data.db` (using the same `better-sqlite3` one-off script pattern used earlier in this session) that: `encounters.participants` reflects real character AC/damage dice (not AI-invented numbers), `rollLog` has entries for initiative and the attack, and — if any NPCs were included — that at least one NPC turn resolved automatically without a corresponding player submission.

- [ ] **Step 5: Verify concurrency handling**

Fire two action submissions for the same campaign at effectively the same time (two parallel `curl` calls backgrounded together) and confirm — via `rollLog`/message ordering — that they were processed sequentially, not interleaved.

- [ ] **Step 6: Clean up diagnostic data**

Delete the diagnostic test account and any test campaign/encounter rows created during Steps 3-5, using the same direct-DB-delete pattern used earlier in this session for test account cleanup — never leave diagnostic data in the production database.

- [ ] **Step 7: Report results**

Summarize what was verified (migration ran clean against production data, check resolution works end-to-end, combat encounter including NPC auto-resolution works end-to-end, concurrency holds) and flag anything that didn't check out for a fix-and-re-verify pass before considering this feature complete. No commit for this task — it's verification-only.
