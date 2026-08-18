# Dice/Mechanics Engine — Design

Date: 2026-08-11 (hardened 2026-08-11, re-aligned to existing frontend 2026-08-11)
Status: approved for planning

**Superseded in part on 2026-08-12**: `[COMBAT_END]` as described below (AI proposes, server unconditionally marks every living NPC defeated) was replaced with a validated, per-NPC `[SURRENDER]` mechanic before it was ever wired into live play — see `docs/superpowers/specs/2026-08-12-combat-action-endpoint-wiring-design.md`, "Server-authoritative surrender." Every other section of this document remains current.

## Context

DungeonMasterOS's AI DM currently narrates outcomes purely by judgment — there is no dice roll, no ability-score math, no mechanical enforcement anywhere in `server/dm-engine.ts`. `combatStyle` and `rulesWeight` are narrative style dials the AI reads, not a rules system. Competitive research (LoreKeeper, StoryRoll) shows the proven differentiator against "just a chatbot" platforms (AI Dungeon, NovelAI) is mechanics that resolve *before* narration: "when you roll a 14 on Stealth against a goblin's passive Perception of 12, the goblin doesn't see you — because the math says so, not because the AI felt generous."

This spec covers building that mechanical layer: ability scores, a d20-based check/attack/save resolver, a persisted combat (encounter) state machine, and a strict AI-untrusted verification model.

**This revision hardens the original design** against six specific ambiguities the user flagged before implementation (NPC turn execution, where player attack stats come from, server-authoritative combat termination, a full edge-case catalogue, a strict JSON tag protocol, and an explicit audit of the "AI proposes, server verifies" guarantee), **then re-aligns it** to substantial existing frontend infrastructure discovered while grounding the plan: `client/src/lib/computedStats.ts` (a full D&D 5e attribute cascade), `StatGenWizard.tsx` (ability-score generation UI), and `DiceRoller.tsx` (an animated dice UI with crit/fumble visuals) all already exist and already commit to D&D-standard ability names and mechanics.

## Decisions made during brainstorming

1. **Core mechanic: d20 + modifier vs DC.** Universally recognizable, proven by LoreKeeper's own "d20 system."
2. **V1 scope: checks AND full combat together** (initiative, attack rolls, damage), not checks-only with combat deferred.
3. **AI-requests / server-rolls / AI-narrates flow.** The DM AI proposes that a roll should happen (and, for checks, what DC applies); the server performs the actual roll using its own authoritative data; a second short AI call narrates the fixed outcome. The AI can never supply or override a character's own stats.
4. **Every roll is logged with real numbers**, not just asserted in a chat message — added at the user's explicit request, to make the "server never blindly trusts the AI" guarantee auditable.
5. **Ability names: STR/DEX/CON/INT/WIS/CHA, not genre-neutral labels.** Originally designed as genre-agnostic (Might/Agility/Fortitude/etc.) to avoid D&D-5e baggage — reversed after discovering `computedStats.ts` and `StatGenWizard.tsx` already implement a complete D&D 5e attribute system client-side (18 standard skills, 5e proficiency-bonus-by-level table, spell save DC, AC, etc.). The resolver's math (d20+modifier vs DC) stays genre-agnostic regardless of what the six scores are called; matching the existing names avoids a split where the character sheet and the combat log disagree, and makes the existing UI immediately reusable instead of orphaned.
6. **Natural 1/20 get real mechanical treatment (crit/fumble)**, not just narration. Originally scoped as "no special behavior" — reversed because `DiceRoller.tsx` already has crit/fumble visual treatment (gold glow + "Critical!" banner on a natural max, red glow + "Fumble" on a natural 1); leaving the mechanics purely cosmetic would make that existing animation misleading once real outcomes are on the line.

## Goals

- A player action that calls for a check or an attack gets resolved by real dice math against the character's actual persisted stats, not the AI's narrative judgment.
- Full combat: initiative order, turn enforcement (including NPC turns, server-driven, not player- or AI-driven), attack rolls vs. AC, damage application to HP, deterministic encounter start/end.
- Every roll is persisted with the real stat values used, auditable after the fact.
- Reuses existing D&D-5e-flavored infrastructure (`computedStats.ts`'s ability names, skill map, proficiency table; `DiceRoller.tsx`'s presentation) rather than duplicating it server-side under different names.
- Existing non-mechanical narration (the vast majority of DM turns) is completely unaffected — additive, not a rewrite of `dm-engine.ts`'s existing behavior.
- Correct under concurrent multiplayer submissions, disconnects, and server restarts.

## Non-goals

- Full D&D 5e subsystems beyond what's specified here: spell slots, feats, class features, multiclassing, encumbrance. `computedStats.ts` already computes spell save DC / spell attack bonus for character-sheet display, but this engine does not add spellcasting *resolution* mechanics.
- New condition/status-effect *types* — the app already has an `active_effects` table (name, duration in rounds, `statMods`, concentration) that this engine integrates with (effect stat modifiers apply to roll modifiers via the same `StatMod` shape `computedStats.ts` already reads; combat round-advancement ticks effects via the existing `tickEffects`).
- A dedicated persistent "monster/bestiary" table. NPC combat stats are proposed by the AI at encounter start, validated/clamped by the server, and live only inside that encounter's snapshot.
- A full equipment/itemization system driving damage dice. See "Where player attack stats come from."
- Any change to the AI provider architecture (`dm-provider.ts` stays as-is).
- Rulebook/PDF ingestion.
- A configurable death policy (death saves, narrative death, hardcore permadeath). v1 has exactly one fixed behavior — 0 HP means incapacitated, never dead — not a settings surface with one working option.
- Horizontal scaling / multi-instance concurrency. DMOS runs as a single `systemd` process. The concurrency design below uses an in-process lock, correct for that topology but not for multiple instances — flagged as a future constraint, not solved here.
- Migrating `computedStats.ts`'s existing `characterData`-blob-based ability-score storage to the new dedicated columns this spec adds. That reconciliation (making the character sheet UI read from the new authoritative columns instead of its current heuristic blob-parsing) is real follow-up work, called out explicitly in "Open items," not silently assumed.

## Data model

### `characters` table — new columns

- `str`, `dex`, `con`, `int`, `wis`, `cha` (integer, default 10 = average). Matches `computedStats.ts`'s `Ability` type (`["str","dex","con","int","wis","cha"]`) exactly. Modifier = `floor((score - 10) / 2)` (10-11 → +0, 12-13 → +1, 8-9 → -1, etc.) — the same formula `computedStats.ts` already uses.
- `ac` (integer, default 10). Matches existing "AC" terminology (`computedStats.ts` already computes a *display* AC as `10 + DEX mod` for the character sheet — this column is the separate, authoritative combat value the resolver reads; see "Where player attack stats come from" for how it's derived at encounter-seed time).
- `damageDice` (text, default `"1d4"`). This character's current basic-attack damage in dice notation. New characters start at an unarmed-strike-equivalent baseline; a full weapon/equipment system that changes this is a future enhancement, but the field is always a real, DB-backed value — never AI-invented at roll time.
- `attackAbility` (text, default `"str"`, one of `str | dex | int`). Which ability governs this character's attack-bonus calculation — `str` for a physical attacker (default), `dex` for a finesse/ranged build, `int` for a caster-type, mirroring standard 5e conventions (finesse weapons use DEX; this spec doesn't model a full spellcasting-ability field separately from `int` since spell *resolution* is a non-goal).
- `proficiencies` (text, JSON array, default `"[]"`). Skill/save/attack labels this character is trained in. Skill labels must match `SKILL_ABILITY`'s keys from `computedStats.ts` (e.g. `"Athletics"`, `"Stealth"`, `"Persuasion"`) — reusing the existing 18-skill list rather than inventing a second one. Save proficiency uses the existing convention too (`"Strength Save"`, `"Dexterity Save"`, etc., matching `SAVE_ABILITY`'s keys). A character is always assumed proficient in their own basic attack regardless of what's listed.

Proficiency bonus formula (server-side): `level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2` — copied verbatim from `computedStats.ts`'s existing `profBonus` calculation (the two are mathematically identical to the formula used in the first hardening pass, but stating it this way keeps the server and client demonstrably in sync with one literal source of truth to copy from, not two independently-derived versions of the same table).

**Active-effect integration:** when the resolver computes a character's modifier for any roll, it fetches that character's currently-active `active_effects` rows and applies their `statMods` — the same `StatMod` shape (`bonus | override | override_if_higher | advantage | disadvantage`, targeting a `stat` key) that `computedStats.ts` already parses client-side — on top of the base ability-score modifier before comparing to DC/AC. This makes existing buffs/debuffs mechanically real for the first time, using the data shape that already exists rather than a new one.

### New `encounters` table

Persists the active combat state machine:

- `id`, `campaignId`
- `status` (`"active" | "ended"`)
- `round` (integer, starts at 1)
- `turnIndex` (integer, pointer into `participants`)
- `participants` (text, JSON array): each entry — `{ id, type: "character" | "npc", name, initiative, currentHp, maxHp, ac, attackBonus, damageDice, isDefeated, fled }`. Player-character entries are seeded from the real `characters` row at encounter start; NPC entries are proposed by the AI via `[COMBAT_START]` and clamped against the campaign's `powerLevel` before being persisted here.
- `lastResolvedTurnKey` (text, nullable). Set to `"{round}:{turnIndex}"` immediately after a turn's mechanical resolution (roll + state mutation + `rollLog` write) commits, *before* the follow-up narration call runs — lets a server restart mid-NPC-turn distinguish "already mechanically resolved, just missing narration" from "never started."
- `createdAt`, `endedAt`

### New `rollLog` table

Persists every roll the server executes:

- `id`, `campaignId`, `encounterId` (nullable — null for non-combat checks)
- `characterId` (nullable — null if the roll was for an NPC participant)
- `participantId` (nullable — the encounter participant's `id`, set for combat rolls whether PC or NPC)
- `rollType` (`"check" | "attack" | "save" | "initiative"`)
- `statUsed` (one of `"str"|"dex"|"con"|"int"|"wis"|"cha"`, optionally suffixed, e.g. `"dex.stealth"` for a skill check, `"con.save"` for a saving throw)
- `baseModifier` (integer — ability-score-derived modifier before effects/proficiency)
- `effectModifier` (integer — sum of active-effect `statMods` applied)
- `proficiencyBonus` (integer — 0 if not proficient)
- `diceResult` (integer — the raw d20 roll)
- `total` (integer — `diceResult + baseModifier + effectModifier + proficiencyBonus`, ignored if `isCritical`/`isFumble` forced the outcome — see "Critical hits and fumbles")
- `targetValue` (integer — the DC or target AC compared against)
- `isCritical` (boolean, default false — `diceResult === 20`)
- `isFumble` (boolean, default false — `diceResult === 1`)
- `outcome` (`"success" | "failure" | "hit" | "miss"`)
- `turnKey` (text, nullable — `"{round}:{turnIndex}"` for combat rolls, supports the resume-after-restart check)
- `createdAt`

### `messages` table — new column

- `clientSubmissionId` (text, nullable). A UUID the frontend generates once per user-initiated submission and resends unchanged on retry. A unique index on `(campaignId, clientSubmissionId)` (partial, where not null) makes a duplicate submission a clean DB-level no-op instead of double-processing.

## Structured AI↔server protocol

Extends the existing bracket-tag convention already used for `[SHOP]...[/SHOP]` and `[WORLD_STATE]...[/WORLD_STATE]` in `dm-engine.ts` — same tag names/precedent, but strict JSON payloads inside each tag rather than `[SHOP]`'s loosely-formatted positional text.

**`[CHECK]{"character": string, "ability"?: "str"|"dex"|"con"|"int"|"wis"|"cha", "skill"?: string, "dc": integer 5-25, "isSave"?: boolean, "reason"?: string}[/CHECK]`**

`character` must resolve to a real character in this campaign. `dc` is the **one** number the AI legitimately supplies — a narrative judgment call, same as a human DM setting a DC — but it is still clamped, not trusted verbatim: **AI-proposed DCs are bounded to 5-25** (5 = trivial-but-failable, 25 = extreme). A value outside that range is clamped to the nearer bound, never rejected. DC 26-30 exists as a reserved ceiling in the data model for future manually-approved or ruleset-authored content (e.g. a licensed SRD import that specifies its own fixed DC) — nothing in this spec's v1 scope produces content in that band, since there is no non-AI content-authoring path yet. The distinction matters: an AI proposing DC 80 and the server *honestly rolling* against DC 80 would still be AI-controlled mechanics wearing a server-authoritative costume — the clamp is what makes the DC number itself part of server authority, not just the roll that follows it. `skill`, when provided, must match a key in `SKILL_ABILITY` (from `computedStats.ts`) — when it does, the server **derives `ability` from the skill map and ignores any `ability` value the AI also supplied**; if `skill` is omitted or unrecognized, `ability` must be one of the six valid values directly. `isSave: true` marks this as a saving throw (checked against `SAVE_ABILITY` naming) rather than a skill check — same math, different narration label; no separate `[SAVE]` tag exists since the flow is identical. `reason` is logging/narration flavor only.

**`[COMBAT_START]{"participants"?: string[], "npcs": [{"name": string, "hp": integer, "ac": integer, "attackBonus": integer, "damageDice": string}]}[/COMBAT_START]`**

`participants` names which existing characters join the fight; omitted → defaults to every character currently in the campaign. `npcs` are proposed enemy stat blocks — always clamped, never trusted as-is (see "NPC stat clamping"). Server creates the `encounters` row, seeds PC participants from real character rows, seeds clamped NPC participants, rolls initiative for every participant (`d20 + DEX modifier`, logged with `rollType: "initiative"`), sorts descending, breaks ties, sets `round = 1`, `turnIndex = 0`.

**`[ATTACK]{"attacker": string, "target": string}[/ATTACK]`**

Both names resolve against the *current encounter's* `participants` — no other fields are read even if the AI includes them. The server additionally verifies `attacker` is actually the participant whose turn it currently is per `turnIndex`, independent of who submitted the HTTP request.

**`[COMBAT_END]{"reason": string}[/COMBAT_END]`** — **superseded 2026-08-12, see note at top of document.** Replaced by `[SURRENDER]{"npcNames": string[], "reason"?: string}[/SURRENDER]`, which the server validates per-NPC (must exist, be an actual NPC, still be alive) before mutating anything — no blanket "mark every NPC defeated" authority is ever granted to the AI.

## NPC turn execution (server-authoritative turn loop)

1. After `[COMBAT_START]` resolves (or after any turn resolves), the server runs `advanceAndResolveTurns(encounterId)`.
2. That function looks at `participants[turnIndex]`:
   - **Defeated or fled** → skip; advance `turnIndex` (wrapping to `turnIndex = 0, round += 1` at the end of the order, ticking `active_effects` for every participant via the existing `tickEffects` on round rollover) and re-check.
   - **Player character** → stop and return; the server waits for that player's next `POST /api/campaigns/:id/action` submission. No AI call happens yet.
   - **NPC** → resolve immediately, without waiting for player input:
     a. Build a valid-target list (living, non-fled PCs).
     b. Call a new, narrowly-scoped AI function `generateNpcTurnAction` (not the general `generateDMResponse` pipeline) with only the NPC's name/notes, current scene, and valid-target list. It must respond with either `[ATTACK]` or plain prose (a non-attack action).
     c. Valid `[ATTACK]` (target in the valid-target list) → resolve exactly like a player attack.
     d. Malformed response, invalid/dead target, or AI call failure → **deterministic fallback**: attack the valid target with the lowest current HP, using the NPC's own real stats.
     e. Generate narration for the resolved outcome, save as a DM message, broadcast over the WebSocket.
     f. Advance `turnIndex`/`round` (same skip/tick logic) and recurse — a string of consecutive NPC turns resolves automatically, stopping only on a living PC's turn or encounter end.
3. Deterministic end-of-combat conditions are checked after **every** individual turn resolution, not just at round boundaries.

## Where player attack stats come from

The encounter participant model requires `attackBonus`, `damageDice`, and `ac` for every participant, including PCs — **never AI-supplied for player characters**:

- `attackBonus` = ability modifier of `characters.attackAbility` (default STR) + proficiency bonus (always assumed proficient in one's own basic attack) + active-effect `statMods` contribution.
- `damageDice` = `characters.damageDice` directly (default `"1d4"`).
- `ac` = `characters.ac` directly, plus active-effect modifiers at roll time.

All three are computed by the server from the character's actual row **at the moment they're seeded into the encounter's `participants` snapshot**. The snapshot holds the *unmodified* base values; the resolver adds current effect modifiers fresh at roll time on top of the snapshot, so a mid-fight buff or debuff applies correctly without needing to mutate the snapshot itself when an effect expires.

## Critical hits and fumbles

Real mechanical effect, not just narration flavor (reversed from the prior no-special-behavior decision — see "Decisions," #6):

- **Attack rolls:** a natural 20 (`diceResult === 20`) is an automatic hit regardless of AC, and damage is rolled with **double the dice** (standard convention: `1d6` becomes `2d6` on a crit, not `1d6` rolled twice and doubled — flat modifiers to damage are not doubled). A natural 1 (`diceResult === 1`) is an automatic miss regardless of attack bonus; no damage roll happens.
- **Checks and saves:** a natural 20 is an automatic success regardless of DC; a natural 1 is an automatic failure regardless of DC. The computed `total` is still logged in `rollLog` for audit purposes even though it didn't determine the outcome.
- **Minimum damage** (see edge cases) still applies on a crit — a crit can't deal 0 damage either.
- `rollLog.isCritical`/`isFumble` make this auditable independent of re-deriving it from `diceResult`.
- `DiceRoller.tsx`'s existing crit/fumble visual treatment is exactly the right presentation for these outcomes — see "Frontend integration."

## Combat termination is server-authoritative

**Superseded 2026-08-12** — see note at top of document. The AI's `[SURRENDER]` tag (replacing `[COMBAT_END]`) **cannot end an encounter directly, and cannot affect any NPC it doesn't correctly name**. Emitting it proposes that specific, named NPCs surrender; the server validates each name (must exist in the current encounter, must be an NPC, must still be alive) before mutating anything, and silently drops any name that fails validation — including any name that would resolve to a PC, which is structurally impossible to mutate through this path. Only the validated subset is marked `isDefeated = true` (`reason` is stored for narration flavor only, never parsed or branched on). That mutation then flows through the same deterministic victory check every other turn resolution goes through.

Actual encounter-end, checked after every turn resolution:

- **Victory**: every NPC participant is `isDefeated` → `status = "ended"`, `endedAt` set, outcome `"victory"`.
- **Defeat**: every PC participant is `isDefeated` → encounter ends, outcome `"defeat"`. Reaching 0 HP sets `isDefeated = true` and removes the participant from active turn order. **v1 death policy is fixed, not configurable: 0 HP means incapacitated, never dead.** The character is not deleted, and no permanent-death consequence is ever mechanically applied — a defeated PC can be narratively recovered (healed, revived, rescued) after the encounter ends. A richer, configurable death-policy system (death saves, narrative death, a hardcore permadeath option) is real future work, explicitly out of scope here — v1 ships with exactly one behavior (incapacitated) rather than a config surface with only one working value.
- **Flee**: dedicated `POST /api/campaigns/:id/encounter/flee` endpoint (not inferred from prose). Marks that participant `fled = true`, removes from turn order. If it empties all PCs, encounter ends with outcome `"all_fled"`.
- **Degenerate case**: if every participant on both sides is somehow removed, encounter ends with outcome `"aborted"` rather than looping forever.

## NPC stat clamping (by `powerLevel`)

`powerLevel` is a fixed 4-value enum already in the schema (`low | standard | high | godtier`, confirmed against the campaign-creation UI). Any `[COMBAT_START]` NPC proposal is clamped to these bounds before being persisted — clamped, never rejected:

| powerLevel | HP | AC | attackBonus | damageDice (max total) |
|---|---|---|---|---|
| low | 1–20 | 8–14 | -1 to +3 | ≤ 2d6 (max 12) |
| standard | 1–40 | 8–16 | 0 to +5 | ≤ 3d6 (max 18) |
| high | 1–80 | 8–18 | +2 to +8 | ≤ 3d8 (max 24) |
| godtier | 1–200 | 8–22 | +4 to +12 | ≤ 4d10 (max 40) |

`damageDice` must match `^\d+d(4|6|8|10|12)$`; a value that fails the regex, or whose max possible roll exceeds the tier ceiling, is replaced with a tier-default (`"1d6"` low, `"2d6"` standard, `"2d8"` high, `"3d8"` godtier).

## Edge case catalogue

- **Initiative ties**: broken by higher DEX modifier; still tied → lower participant `id`.
- **Natural 1 / natural 20**: real mechanical effect — see "Critical hits and fumbles" above (superseding the earlier no-special-behavior decision).
- **Attack total equal to AC**: a tie goes to the attacker (`total >= ac` = hit).
- **Minimum damage**: a hit always deals at least 1 damage (applies on crits too).
- **Defeated participant turn skipping**: handled by the turn-loop itself.
- **Invalid/dead targets**: a player-submitted attack naming a nonexistent or already-defeated target is rejected before any roll happens, narrated as "that target is no longer there," and does **not** consume the player's turn. An NPC-selected invalid target falls back to the deterministic lowest-HP-living-PC target.
- **Fleeing/abandoning combat**: dedicated endpoint, not inferred from prose.
- **Duplicate or stale submissions**: `messages.clientSubmissionId` + partial unique index on `(campaignId, clientSubmissionId)`.
- **Concurrent multiplayer actions**: in-process async mutex keyed by `campaignId` — each incoming action for a campaign awaits the prior one's full resolve-narrate-broadcast cycle. Sufficient for the current single-process topology.
- **Disconnects/reconnects**: state lives entirely in the DB, never the WebSocket connection. New `GET /api/campaigns/:id/encounter` endpoint lets a reconnecting client resync (WebSocket doesn't replay missed broadcasts).
- **Server restart with an active encounter**: `encounters`/`rollLog` are real tables, so a restart never loses combat state. `lastResolvedTurnKey` + `rollLog.turnKey` detect a restart mid-NPC-turn-resolution and regenerate only the missing narration — never re-roll a turn that already has a `rollLog` entry.
- **Malformed AI action proposals**: any tag that fails JSON parsing or schema validation is treated as "no mechanical action" — falls back to unmechanized narration for a player-triggered proposal, or the deterministic lowest-HP-target fallback for an NPC-turn proposal.

## Resolution flow (checks, outside combat)

1. Player submits an action (unchanged entry point, now behind the per-campaign action mutex).
2. First AI call (existing `generateDMResponse` path): narrates directly (unaffected, common case) or emits `[CHECK]`.
3. Server parses the tag, resolves `character`, computes ability modifier + effect modifiers + proficiency bonus, rolls, applies crit/fumble override if applicable, writes `rollLog`, determines the outcome. Never calls the AI for this step.
4. Second AI call: a short prompt containing only the fixed outcome ("Stealth check: rolled 14 + 3 = 17 vs DC 14 → SUCCESS. Narrate this in 2-4 sentences.") — the AI narrates around the number, never renegotiates it.
5. Final DM message saved through the existing message-creation path, with structured roll data attached so the frontend can render the actual math.

Combat resolution follows the same request→roll→narrate shape per individual turn, orchestrated by the NPC turn-loop.

## Frontend integration

Reuses existing components rather than building new ones:

- **`DiceRoller.tsx`** already renders animated dice with crit/fumble banners and exposes an `onResult` callback and an `autoRoll` prop that triggers from a detected formula string. The server-authoritative roll (once computed) should drive this component directly — passing the real `diceResult`/`total`/`isCritical`/`isFumble` from the resolved roll as the displayed result, rather than letting the component roll its own random number for anything that has real mechanical consequences. `DiceRoller`'s own `rollDie`/`Math.random()` path remains fine for the existing purely-decorative "quick roll" tray (a player rolling dice just to roll dice), which stays disconnected from game state exactly as it is today.
- **`StatGenWizard.tsx`** already produces `Record<Ability, number>` in the exact shape the new `characters` columns need — the character-creation flow's completion handler should write those values into the new `str`/`dex`/`con`/`int`/`wis`/`cha` columns directly, instead of (or in addition to, during a transition period) the `characterData`-blob section it currently targets.
- **`computedStats.ts`** stays as the character-sheet *display* engine; migrating its `extractBaseAbilities` heuristic-blob-parsing to read the new dedicated columns instead is real follow-up work (see "Open items"), not assumed complete by this spec.

## Guarantee audit

Explicit re-check of: *"AI proposes intent; server verifies authoritative state, rolls, mutates state, logs the exact numbers, and decides the mechanical outcome. The AI may narrate but may never override that outcome."*

| Tag | AI supplies | Server-authoritative |
|---|---|---|
| `[CHECK]` | character name, dc (legitimate DM judgment call, but clamped to 5-25), optional skill/ability label | the character's actual ability modifier, active-effect modifiers, proficiency bonus, the die roll, crit/fumble override, the success/failure outcome; `ability` itself is overridden by the skill map when `skill` is recognized; `dc` itself is clamped, not trusted verbatim |
| `[COMBAT_START]` | which characters join, proposed NPC stat blocks | NPC stats clamped to `powerLevel` bounds; PC participant stats pulled from real `characters` rows; initiative server-computed |
| `[ATTACK]` | attacker name, target name | attacker/target verified against the real participant snapshot and whose turn it actually is; attack bonus, damage dice, AC, HP all snapshot/DB values; to-hit roll, crit/fumble, damage roll, HP mutation, defeated-flag all server-computed |
| `[SURRENDER]` (supersedes `[COMBAT_END]`, 2026-08-12) | which NPCs surrender (`npcNames`), a `reason` string (flavor only) | each named NPC is individually validated (exists, is an NPC, still alive) before any mutation; a PC can never be affected; only the validated subset is marked defeated; no direct authority to end combat — the mutation still passes through the deterministic victory check like everything else |
| NPC turns | (no tag — server-initiated) | server chooses when an NPC acts, builds the valid-target list, falls back to a deterministic target if the AI's proposal is invalid or absent |

No path exists where the AI's own numbers are written to `rollLog`, `encounters`, or `characters` without first passing through server-side lookup, clamping, or a deterministic fallback.

## Testing

No existing test framework in this repo. This feature adds:

- **Pure-function unit tests** (Node's built-in `node:test`, no new dependency, injectable RNG) for: modifier calculation, the proficiency-bonus table, roll-vs-DC/AC resolution including crit/fumble overrides, damage application and minimum-damage flooring (including doubled-dice crit damage), NPC stat clamping per `powerLevel`, initiative tie-breaking.
- **DB-integration checks** in the style of `script/verify-history-order-fix.mjs` — encounter creation, turn advancement (skip-defeated, NPC-turn-loop), `rollLog` persistence, the duplicate-submission unique-index behavior, and the restart-resume check.
- The AI-narration boundary (`generateNarrationText`, `generateNpcTurnAction`) is mocked/stubbed — no automated test hits the real Anthropic API.
- No test covers the AI's *decision* to emit a tag — only the server's handling of tags once emitted, including malformed ones.

## Open items for the implementation plan

- Exact Zod (or equivalent) schema definitions for each tag's JSON payload, matching the shapes specified above.
- Migration for the two new tables and the `characters`/`messages` column additions (Drizzle + `db:push`, matching `runMigrations` in `server/storage.ts`).
- The concrete `advanceAndResolveTurns` and per-campaign action-mutex implementations.
- New endpoints: `GET /api/campaigns/:id/encounter`, `POST /api/campaigns/:id/encounter/flee`.
- Wiring `StatGenWizard`'s output and `DiceRoller`'s display into the new server-authoritative data, per "Frontend integration" above.
- **Reconciling `computedStats.ts` with the new authoritative columns** is explicitly *not* solved by this spec — it currently reads ability scores from a heuristically-parsed `characterData` blob. Whether to migrate it to read the new columns, keep both in sync, or replace the blob approach entirely is a decision for a follow-up pass once this engine is live, not blocking this implementation.
- **Default ability scores for newly-created characters** who skip `StatGenWizard` (or for any other path that creates a character without it): all six default to 10 (+0 modifier), `ac` to 10, `damageDice` to `"1d4"`, `attackAbility` to `"str"`, empty `proficiencies`.
