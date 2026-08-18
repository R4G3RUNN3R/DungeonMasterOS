# Combat Action-Endpoint Wiring — Design

Date: 2026-08-12 (hardened 2026-08-12: `[COMBAT_END]` replaced with a validated `[SURRENDER]` mechanic)
Status: approved for planning

## Context

The dice/mechanics engine (`docs/superpowers/specs/2026-08-11-dice-mechanics-engine-design.md`) was implemented task-by-task (Tasks 1-12 of `docs/superpowers/plans/2026-08-11-dice-mechanics-engine.md`): schema, dice math, character stats, tag parsing, storage, combat state machine, attack resolution with real crit/fumble, NPC turn resolution with deterministic fallback, combat-end/flee handling, and a per-campaign concurrency mutex. Every piece is implemented, unit-tested, and independently code-reviewed.

None of it is reachable by a real player yet. Tracing the actual live `POST /api/campaigns/:id/action` handler in `server/routes.ts` during Task 12 showed it calls only `resolveCheckTag` (Task 6). Nothing calls `startEncounter`, `resolveAttack`, `resolveNpcTurn`, or `applySurrenderTag`. Re-reading every remaining plan task confirmed none of them add this wiring either: Task 13 is resume/reconnect-only, Task 14 is frontend-only, Task 15 is deploy/smoke-test-only (and its own Step 4 assumes combat already works end-to-end through the live endpoint).

The original design spec already named this piece and explicitly flagged it as unresolved: its "NPC turn execution" section fully describes an orchestrator function `advanceAndResolveTurns(encounterId)`, and its "Open items for the implementation plan" section lists "the concrete `advanceAndResolveTurns`... implementation" as something the plan still needed to nail down. The plan then split the orchestrator's two halves into separate, already-built pieces — `advanceToNextActionableTurn` (Task 8, mechanical turn-advancement only) and `resolveNpcTurn` (Task 10, one NPC's AI-backed turn) — but never added the loop connecting them, and never added the route-level call site either, despite task interface notes in Tasks 9 and 10 promising both ("Consumed by Task 6's action-endpoint integration point (extended in this task)"; "Called in a loop by the route handler (Task 11)").

A second, related gap surfaced while designing the fix: `server/dm-engine.ts`'s `buildSystemPrompt` — the system prompt sent on every DM response — documents `[SHOP]` but has no mention of `[CHECK]`, `[COMBAT_START]`, `[ATTACK]`, or `[COMBAT_END]` anywhere. The AI is never told these tags exist, so even Task 6's already-shipped `[CHECK]` resolution is currently unreachable in real play — correct code behind a prompt that never invites it to fire.

**A third gap, a genuine guarantee violation, was caught during review of this spec's first draft**: Task 11's `[COMBAT_END]`/`applySurrenderTag` lets the AI single-handedly end an encounter by marking **every currently-living NPC** defeated, from a tag whose only payload is a free-text `reason` string the server never validates. That is the exact authority hole the whole engine was built to close — "AI proposes, server validates, never AI decides the outcome" — reopened at the finish line. This spec's first draft would have wired that hole directly into live play. It's fixed below by replacing `[COMBAT_END]` with a validated, per-NPC `[SURRENDER]` mechanic before any wiring happens.

This spec covers closing all three gaps: teaching the DM prompt about the mechanical tags (with live combat-state context injected when relevant), building the missing orchestration that actually calls the combat engine from the live action endpoint, and replacing the unvalidated surrender tag with one that upholds server authority.

## Decisions made during brainstorming

1. **Off-turn submissions fall back to narration silently, never an explicit rejection.** A player submitting an action while an encounter is active but it isn't their character's turn is treated as ordinary roleplay/chat — it can still resolve a `[CHECK]`, but any `[ATTACK]` tag naming a non-current attacker is rejected by `resolveAttack`'s existing `"not_your_turn"` check and the endpoint falls back to plain narration rather than surfacing an error. Keeps in-combat party chatter frictionless.
2. **Tag precedence is a branch on encounter existence, not a flat list.** If an active encounter exists: try `[SURRENDER]` first (a validated surrender should resolve cleanly, not fight through a same-breath attack), then `[ATTACK]` (if it's the submitter's turn). If no active encounter exists: try `[COMBAT_START]`. `[CHECK]` resolution is unconditional either way, unchanged from Task 6.
3. **The main DM system prompt gets extended, not forked.** Rather than routing combat-turn submissions through a second, narrower AI pipeline (the pattern `generateNpcTurnAction` uses for NPCs), `buildSystemPrompt` gains a new documented section for the mechanical tags — matching the existing `[SHOP]`/`[ABILITIES]` numbered-section convention — plus additional injected context (whose turn it is, valid target names) only when an encounter is active. One consistent DM voice, additive to the existing prompt rather than a rewrite.
4. **NPC-turn orchestration runs synchronously, within the same HTTP request.** A new `advanceAndResolveTurns(encounterId, storage, deps)` in `combat-engine.ts` — the concrete implementation of the name and behavior the original design spec already prescribed — calls `advanceToNextActionableTurn`, and if the resulting participant is an NPC, calls `resolveNpcTurn` and recurses, stopping on a living PC's turn or encounter end. This runs inline in the same request that triggered it (after a player's attack, after `[COMBAT_START]` creates a fresh encounter in case the first initiative slot is an NPC, after a surrender) rather than being deferred to a background task or a later poll. Task 12's per-campaign mutex already serializes one full action-cycle before the next request for that campaign starts, so there's no concurrency reason to split this across requests.
5. **Each NPC turn still gets its own saved DM message and its own WebSocket broadcast**, exactly like every other turn resolution — a cascade of three NPC turns produces three separate messages, not one concatenated blob.
6. **The action endpoint's response gains an additive `npcTurnMessages: Message[]` field** alongside the existing `playerMessage`/`dmMessage`, so the submitter's own HTTP response already contains the full cascade — not just what the WebSocket delivers to already-connected clients.
7. **`[COMBAT_END]` is removed from the AI's command vocabulary entirely, replaced by a validated `[SURRENDER]` tag.** The AI can never end an encounter, cannot mark NPCs defeated as a blanket action, and cannot have its `reason` prose interpreted as mechanics. Encounter termination stays exactly what it already is: a deterministic consequence of validated state (every hostile NPC actually defeated/fled/surrendered → victory; every PC actually incapacitated → defeat; every PC actually fled → all_fled) — see "Server-authoritative surrender" below.
8. **Six previously-logged defensive gaps around the live combat boundary are folded into this task** rather than left open at the exact seam this spec wires into production: `resolveAttack` gains its own active-encounter guard, `resolveNpcTurn` gains its own NPC-turn guard, `fleeEncounter` gains its own active-encounter guard, `checkDeterministicEnd` gets a regression test for the mixed defeated+fled case, `clientSubmissionId` dedup is checked ahead of `checkTurnLimit`, and the per-campaign mutex / idempotency guarantees from Task 12 are preserved throughout. See "Defensive hardening folded into this task" below.

## Goals

- A player's narrated combat action (submitted as free text, same as any other action) reliably becomes a real `[ATTACK]` tag the server can verify, because the AI now knows the tag exists and who the valid targets are.
- A cascade of NPC turns following a player's action (or combat starting, or a validated surrender) resolves fully within that one request/response cycle, with each turn's narration saved and broadcast individually.
- Non-combat narration (the large majority of turns) is provably unaffected — the same additive posture the original engine design held to.
- `[CHECK]` resolution (Task 6, already shipped) becomes actually reachable in live play for the first time.
- Encounter termination remains provably server-authoritative: no AI response can end combat, defeat an NPC, or defeat a PC merely by claiming it does.
- **Honest scope note (added post-review):** "no AI response can end combat merely by claiming it does" describes *mutation* authority — the server, not the AI's prose, decides HP, defeat, and victory/defeat outcomes. It does not mean the AI has no path to ending an encounter: a validated `[SURRENDER]` naming every living NPC still converts any encounter into a `victory`, because surrender validation checks identity (exists, is an NPC, is alive), not plausibility. See "Server-authoritative surrender" below for exactly what is and isn't checked.

## Non-goals

- Any change to the dice math, or to `resolveAttack`/`resolveNpcTurn`/`startEncounter`'s tested resolution behavior from Tasks 1-12 beyond the specific defensive guards listed below — this spec adds a caller and closes a validation hole, not new resolution logic.
- Redesigning `buildSystemPrompt`'s existing narrative-style instructions, tone rules, or the `[SHOP]`/`[ABILITIES]` sections — additive only.
- Task 13's reconnect/resume work and Task 14's frontend integration — this spec is scoped to the server-side action-endpoint wiring only; those tasks proceed afterward as already planned.

## Server-authoritative surrender (`[SURRENDER]` replaces `[COMBAT_END]`)

**`[COMBAT_END]{"reason": string}[/COMBAT_END]`, `extractCombatEndTag`, and `applySurrenderTag` are removed entirely** — the tag is deleted from the system prompt, from `mechanics-tags.ts`, and from `combat-engine.ts`. Nothing else in the codebase calls them (this wiring task is the only thing that would have), so removal is a clean deletion, not a deprecation shim.

In their place:

**`[SURRENDER]{"npcNames": string[], "reason"?: string}[/SURRENDER]`**

The AI proposes that one or more *specific, named* NPCs surrender. `npcNames` must be a non-empty array of strings (a malformed or empty array makes the tag invalid — treated as absent, same as every other tag's malformed-input handling). `reason` is optional flavor text, stored for narration only — **never parsed, never branched on, never used to decide which participants are affected.**

`applyNpcSurrender(encounterId, rawResponse, storage)` in `combat-engine.ts`:

1. Extract the tag via the new `extractSurrenderTag`. No tag → return `{ applied: false, surrenderedNames: [] }`, no mutation, no advance-check.
2. Fetch the encounter. **Not active → no mutation, return `{ applied: true, surrenderedNames: [] }`** (a tag was present but there's nothing to apply to — matches the existing `applySurrenderTag` precedent of "present but inert" rather than throwing).
3. For each name in `npcNames`, look it up against the encounter's real `participants` snapshot. A name survives validation only if **all** of: the participant exists, `type === "npc"`, and `!isDefeated && !fled` (still actually alive and present). Every other case — a name that doesn't match any participant, a name that matches a **PC** (explicitly checked and rejected even if a name collision were possible — a PC can never be marked defeated by this tag under any circumstance), a name that matches an already-defeated or already-fled NPC — is silently dropped from the surrender, not partially honored and not treated as an error that voids the rest of the (valid) names in the same proposal.
4. Only the validated subset is mutated: those specific participants get `isDefeated: true`, written via `storage.updateEncounter`. If the validated subset is empty (every proposed name failed validation), no mutation happens at all — `{ applied: true, surrenderedNames: [] }`.
5. The mutation is explicit and logged: a "System" `storage.createMessage` records exactly which NPCs surrendered (e.g. `"Goblin 1 and Goblin 2 lay down their weapons."` built from the validated names, not from the AI's `reason`), broadcast the same way every other state-changing message is.
6. `advanceToNextActionableTurn` (or the new `advanceAndResolveTurns` orchestrator — see below) runs afterward, exactly like every other mutation, so victory only fires if this surrender happens to leave zero living NPCs — the same deterministic check every other path goes through, not a special case.

This closes every requirement from the hardening request: an active encounter is required; named NPCs must exist, be alive, and be hostile-NPC-typed; the proposal structurally cannot affect a PC (the `type === "npc"` check is not optional and not bypassable by name collision); the mutation only ever touches the validated subset and is explicit/logged; deterministic encounter-end logic is the only thing that can actually end the encounter, running unconditionally afterward regardless of what surrendered.

**Honest scope note (added post-review):** this validation is identity-only, not mechanical — it checks that named NPCs exist, are NPC-typed, and are alive, but it does not check whether surrender is *plausible* (no HP threshold, no round count, no server-rolled morale check). The AI still decides which NPCs propose to surrender, and nothing stops it from naming every living NPC in an encounter — converting any fight into a `victory` outcome by enumeration instead of by a bare `[COMBAT_END]` tag. What this change achieves is a narrowing and an audit trail (PC immunity, no free-text `reason` parsing, an explicit logged System message, deterministic end-check retained) — not a removal of the AI's narrative authority over whether an encounter ends via surrender. Closing that residual (e.g. a server-rolled morale check or an HP-fraction gate per named NPC) is out of scope for this task and logged as future work.

## Defensive hardening folded into this task

Six items, each closing a real gap at the exact boundary this task wires into production:

1. **`resolveAttack` rejects a non-active encounter itself.** Currently it trusts the caller. Add a check immediately after fetching the encounter: `if (encounter.status !== "active") return { error: "encounter_not_active" }` — before any tag/turn/target validation, before any roll. Extends the existing error-union return type (`"no_tag" | "not_your_turn" | "invalid_target"` → add `"encounter_not_active"`); no existing caller inspects the union exhaustively enough for this to be a breaking change (Task 9/10's tests only assert specific error strings on specific fixtures).
2. **`resolveNpcTurn` verifies the current participant is actually an NPC.** Currently it trusts the caller (the future orchestrator) to only invoke it on an NPC's turn — flagged as a Minor finding in Task 10's review. Add a guard at the top: if `participants[encounter.turnIndex].type !== "npc"`, throw a descriptive `Error` (this is a programmer-contract violation by the caller, not recoverable AI/user input, so it should fail loudly rather than silently produce a wrong result — matches how `resolveAttack`'s existing guards distinguish "bad AI input → graceful error return" from "impossible caller misuse → throw").
3. **`fleeEncounter` rejects a non-active encounter itself.** Same shape as item 1: `if (encounter.status !== "active") return { fled: false, encounterEnded: false }` immediately after fetching the encounter, before any participant lookup or mutation. Currently only its one caller (`handleFlee`) prevents this via `getActiveEncounterByCampaign` pre-filtering — this makes the guarantee hold even if a future caller doesn't pre-filter.
4. **Regression test for mixed defeated+fled PCs in `checkDeterministicEnd`.** Task 11's review flagged this exact case as untested: some PCs defeated, some fled, zero living PCs remain. Add a fixture to `server/combat-engine-turnloop.test.ts` (or wherever `checkDeterministicEnd` is exercised) asserting the outcome is `"defeat"` (per the already-implemented precedence: any actually-defeated PC means `"defeat"`, even if others also fled) — codifying existing, correct, previously-only-hand-traced behavior.
5. **`clientSubmissionId` dedup is checked ahead of `checkTurnLimit`.** Currently `checkTurnLimit` (middleware, runs before `handleAction`) has no awareness of duplicate submissions, so a legitimate retry whose original submission already exhausted the user's turn budget gets rejected with a `TURN_LIMIT` error instead of transparently returning the original result. Fix: add `storage.getMessageBySubmissionId(campaignId, clientSubmissionId): Message | undefined` (a pure read, factored out of `createMessageIdempotent`'s existing SELECT so both share one implementation), and have `checkTurnLimit` call it first — if a message already exists for this `(campaignId, clientSubmissionId)` pair, skip the limit check and call `next()` immediately, since `handleAction`'s own dedup path will return the original result without consuming a new turn. No behavior change for requests without a `clientSubmissionId` (the existing `/api/campaigns/:id/start` route, which never sends one).
6. **Preserve the per-campaign mutex and all Task 12 idempotency guarantees.** Every new call this task adds (`applyNpcSurrender`, `resolveAttack`, `startEncounter`, `advanceAndResolveTurns`) happens inside the existing `withCampaignLock`-wrapped `handleAction`/`handleFlee`, after the existing dedup short-circuit — never in a new code path that bypasses either. No new endpoint is added that mutates encounter state outside the mutex.

## System prompt extension

`buildSystemPrompt` (`server/dm-engine.ts`) gains a fifth numbered section, following the existing `[SHOP]`/`[ABILITIES]` convention:

```
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
```

`generateDMResponse`'s signature gains a new optional trailing parameter, `combatContext: CombatPromptContext | null = null` (keeping both existing call sites in `routes.ts` valid without modification unless they choose to pass it):

```typescript
export interface CombatPromptContext {
  round: number;
  currentTurnName: string;
  isSubmittingPlayersTurn: boolean;
  validTargetNames: string[]; // living, non-fled NPCs — only meaningful when isSubmittingPlayersTurn
}
```

When `combatContext` is present, `buildSystemPrompt` appends a short block after the MECHANICS section:

```
COMBAT STATE:
Round ${round}. It is currently ${currentTurnName}'s turn.
${isSubmittingPlayersTurn ? `It is YOUR turn. Valid attack targets: ${validTargetNames.join(", ")}.` : "It is not your turn — narrate reactions, dialogue, or positioning only; do not resolve an attack for this player."}
```

The action endpoint builds this context by reading `storage.getActiveEncounterByCampaign(campaignId)` before calling `generateDMResponse` — `null` when no encounter is active, which is the common case and produces byte-identical prompts to today's behavior.

## Action-endpoint flow (extends Task 6's existing wiring)

Inside `handleAction`, after the existing character/content validation and dedup short-circuit, and before constructing the AI call:

```
activeEncounter = storage.getActiveEncounterByCampaign(campaignId)
combatContext = buildCombatContext(activeEncounter, character) // null if no active encounter

rawResponse = generateDMResponse(campaign, chars, history, content, character.name, currencies, combatContext)

surrenderResult = null
attackResult = null

if (activeEncounter):
    surrenderResult = applyNpcSurrender(activeEncounter.id, rawResponse, storage)
    if (!surrenderResult.applied || surrenderResult.surrenderedNames.length === 0):
        if it's character's turn:
            attackResult = resolveAttack({ encounterId: activeEncounter.id, rawResponse, storage, rng: Math.random, narrate })
            // attackResult.error (no_tag/not_your_turn/invalid_target/encounter_not_active) -> fall through to plain narration, no player-visible error
else:
    startEncounter({ campaignId, rawResponse, powerLevel: campaign.powerLevel, storage, rng: Math.random })

checkResolution = resolveCheckTag(...) // unchanged, unconditional, existing Task 6 call

// Precedence: resolveAttack (like resolveCheckTag) makes its own second AI call to
// narrate the fixed mechanical outcome, so attackResult.narration takes priority when
// an attack actually resolved. A surrender's own System message (step 5 above) is
// separate from finalContent — it's its own message, not folded into this one.
// [COMBAT_START] needs no override — the AI's own first-call narration already
// describes combat breaking out, so it falls through to cleanContent like plain narration does.
finalContent = attackResult?.narration || checkResolution?.cleanContent || cleanContent?.trim() || buildFallbackActionResponse(character.name, content)
dmMsg = storage.createMessage({ ...finalContent... })

npcTurnMessages = []
if (an encounter is now active, whether pre-existing or just started):
    npcTurnMessages = advanceAndResolveTurns(encounterId, storage, { generateNpcAction: generateNpcTurnAction, narrate, rng: Math.random })
    // each element already saved via storage.createMessage and broadcast individually inside the loop

return res.json({ playerMessage: playerMsg, dmMessage: dmMsg, npcTurnMessages })
```

`advanceAndResolveTurns` returns the array of DM `Message` rows it created (one per resolved NPC turn) so the route can include them in the response, in addition to broadcasting each one as it resolves.

A surrender and an attack in the same response are mutually exclusive by construction (surrender is checked first; if it validated and actually affected at least one NPC, no attack is attempted from the same tag pass) — this only matters if the AI emits both tags in one response, which the prompt doesn't instruct it to do, but the precedence removes the ambiguity either way.

## Edge cases

- **Player attacks but it isn't a combat action the AI recognized** (no `[ATTACK]` tag emitted despite an active encounter and it being their turn): falls through to plain narration; their turn is NOT consumed mechanically — matches the original design's "Invalid/dead targets... does not consume the player's turn" edge case, generalized to "no valid attack proposed at all."
- **`[COMBAT_START]` fires but the encounter's first turn is immediately an NPC**: `advanceAndResolveTurns` runs right after `startEncounter` returns, exactly as the original design's step 1 specifies ("After `[COMBAT_START]` resolves... the server runs `advanceAndResolveTurns`").
- **A validated surrender ends the encounter outright**: `advanceAndResolveTurns` is still safe to call — `advanceToNextActionableTurn`'s existing `status !== "active"` guard makes it a no-op, so it naturally returns an empty `npcTurnMessages` array rather than needing a special case in the route.
- **A `[SURRENDER]` tag names NPCs that don't validate** (nonexistent, already defeated, already fled, or — structurally impossible but explicitly guarded — a PC's name): those names are silently dropped; if none survive validation, nothing is mutated and no System message is created. The AI is never told which names failed, matching the same "malformed/invalid proposal → deterministic, silent fallback" posture used everywhere else in this engine.
- **The AI's narration for the player's own action, a surrender's System message, and the subsequent NPC-turn narrations must not be conflated**: all are always separate `storage.createMessage` calls / separate WebSocket broadcasts, per Decision 5.
- **Existing non-combat call sites of `generateDMResponse`** (the `/start` campaign-opening endpoint, `routes.ts:1840`) pass no `combatContext`, defaulting to `null` — zero prompt change for that path.

## Testing

Unit-level (extends the existing per-file test suites, Node's built-in `node:test`, injectable RNG throughout, no automated test hits the real Anthropic API):

- `advanceAndResolveTurns` (new `server/combat-engine-orchestrate.test.ts`): stops on a living PC's turn without calling the NPC-action callback; resolves a single NPC turn and stops on the next PC; resolves a chain of multiple consecutive NPC turns; stops when the encounter ends mid-chain (victory/defeat/all_fled/aborted); no-ops on an already-ended encounter; returns the full list of created messages in order.
- `applyNpcSurrender` / `extractSurrenderTag` (replaces `server/combat-engine-end.test.ts`'s `applySurrenderTag`/`extractCombatEndTag` tests): no tag → not applied, no mutation; nonexistent NPC name → dropped, not mutated; already-defeated/fled NPC name → dropped; a PC name in `npcNames` → never mutates the PC, explicitly asserted; a mix of one valid and one invalid name → only the valid one is mutated; all-NPCs-surrender → deterministic victory check fires afterward; inactive encounter → no mutation.
- `resolveAttack`'s new `encounter_not_active` guard; `resolveNpcTurn`'s new non-NPC-turn guard (asserts it throws); `fleeEncounter`'s new inactive-encounter guard.
- `checkDeterministicEnd`'s mixed defeated+fled regression fixture.
- `storage.getMessageBySubmissionId` and `checkTurnLimit`'s new bypass-on-duplicate behavior.
- The new `buildCombatContext` helper: `null` when no active encounter; correct `isSubmittingPlayersTurn`/`validTargetNames` when it is/isn't the submitting character's turn.

End-to-end, against the real `handleAction`/`handleFlee` route logic (DB-integration style, matching this project's existing `script/verify-*.mjs` pattern, with the AI narration boundary stubbed — no automated test hits the real Anthropic API):

- `[COMBAT_START]` submitted through `/action` actually creates a live, persisted encounter.
- A player `[ATTACK]` submitted through `/action` actually resolves — real roll, real HP mutation, real `rollLog` entry.
- An out-of-turn or otherwise invalid `[ATTACK]` cannot mutate combat state — encounter/participants unchanged, no `rollLog` entry, turn not consumed.
- A cascade of consecutive NPC turns automatically resolves after a player's turn ends, stopping exactly at the next living PC's turn.
- Multiple consecutive NPC turns in one cascade each produce their own message and `rollLog` entry (not collapsed).
- Victory/defeat/all_fled are only ever reached through `checkDeterministicEnd`'s real state evaluation — never by directly honoring an AI claim.
- **An AI response that includes prose claiming combat has ended, without a validated mechanism, does not end the encounter** — the encounter's `status`/`outcome` are unchanged.
- A `[SURRENDER]` tag only ever affects the specific, validated NPC targets it names — a PC is never mutated by it, an invalid name is dropped, and encounter-end still runs through the deterministic check afterward.
- A duplicate submission (same `clientSubmissionId`) cannot cause a duplicate attack, a duplicate NPC-turn cascade, or double-mutate encounter state — re-submitting returns the original result.
- The WebSocket broadcasts and the HTTP response's `npcTurnMessages` agree with what's actually persisted in the DB (same messages, same order, same content).
- `buildSystemPrompt`'s output actually contains the tag documentation the AI is expected to act on (a direct string-content assertion on the built prompt, not just an indirect behavioral test).

A live smoke test (folded into Task 15's existing Step 4, not a new deploy step) confirming a real combat encounter now runs end-to-end through the actual endpoint, including at least one automatic NPC turn and a surrender attempt.

## Open items

None blocking.
