# Claude Handoff - Multiplayer Turn Deduction + Campaign Participation History

## Repository

`R4G3RUNN3R/DungeonMasterOS`

## Reference branch

`reference/multiplayer-turn-deduction-v1`

## Reference folder

`docs/reference-implementations/multiplayer-turn-deduction-v1/`

## Baseline used to build this reference

GitHub `main` was inspected at:

`8581553e283a67ea4c3e0fcfa68bd45e667337c5`

The live server may be newer. **Compare first. Do not blindly merge.**

---

# Objective

Implement a robust multiplayer AI-turn deduction policy and persistent campaign participation history.

The current GitHub action route effectively deducts AI Turns from whichever authenticated account sent the action:

`req.user -> checkTurnLimit -> AI generation -> incrementTurnCount(req.user.id)`

That model must become campaign-configurable.

At the same time, every authenticated player account should gain a historical **Campaign History** for campaigns they genuinely played in, including campaigns hosted by other users. Drive-by joins must not appear.

---

# Read these files first

1. `README.md`
2. `CURRENT-REPO-FINDINGS.md`
3. `domain.ts`
4. `storage-contract.ts`
5. `turn-deduction-service.ts`
6. `schema-proposal.ts`
7. `route-integration.ts`
8. `UI-CONTRACT.md`
9. `TEST-VECTORS.md`
10. `CAMPAIGN-PARTICIPATION-LEDGER.md`
11. `participation-ledger.ts`
12. `participation-schema-proposal.ts`
13. `participation-route-integration.ts`
14. `PARTICIPATION-TEST-VECTORS.md`
15. `REFERENCE-STATUS.md`

---

# Required live-server comparison method

For every subsystem use exactly one disposition:

- `KEEP_PRODUCTION`
- `PORT_REFERENCE`
- `MERGE_TO_ONE`
- `DEFER_WITH_BLOCKER`

If production is stronger, keep it.

If the reference is stronger or production lacks it, port it.

If both contain useful pieces, merge them into one authoritative implementation.

Never leave parallel billing/turn-deduction systems or parallel campaign-history sources of truth.

---

# Part A - AI Turn Deduction Policy

## Player-facing question

Use this language:

> **Where should AI Dungeon Master turns be deducted from for this campaign?**

Do NOT use `payer`, `pays`, `payment source`, raw `tokens`, or Anthropic billing language in player-facing UI.

Supported options:

### Campaign Host

Every successful AI Dungeon Master response in the campaign is deducted from the campaign host's available AI Turns.

### Each Individual Player

A player's own AI-triggering action uses that player's available AI Turns.

Each player must acknowledge the current individual-policy revision before their first AI-triggering action after an explicit policy configuration/change.

### Selected Player

Every successful AI Dungeon Master response is deducted from one selected authenticated campaign participant.

The selected player must explicitly accept before that policy becomes active.

---

# Core deduction rules

1. The actor account and the turn-source account are separate concepts.
2. Client input never controls the final sourceUserId.
3. Server resolves sourceUserId from authoritative campaign policy.
4. Existing campaigns must migrate to `individual / active` to preserve current behavior.
5. New campaigns should create a policy row with `setup_required` until multiplayer policy is configured.
6. Single-player play should not be needlessly blocked while host is the only authenticated participant.
7. When a second authenticated participant joins, prominently require setup before the first multiplayer AI generation.
8. Selected-player policy remains pending until selected account accepts.
9. A decline leaves the previous valid policy unchanged.
10. A selected account may revoke future use of its turns.
11. Revocation blocks future AI generations that rely on that source.
12. Never silently fall back to another account.
13. Exhaustion of selected/host allowance never silently switches to individual mode.
14. Deduct per successful authoritative AI DM generation, not per chat message or WebSocket event.
15. Provider failure/local fallback consumes zero AI Turns.
16. OOC chat, typing, reconnects, dice UI interactions, settings changes, and non-AI operations consume zero AI Turns.
17. Future multi-player action batching must define explicit individual-mode attribution before being enabled. Do not invent fractional turns or charge everyone one full turn without an approved product rule.

---

# Reservation / concurrency requirement

The current GitHub `checkTurnLimit` then later `incrementTurnCount` pattern is not sufficient for concurrent multiplayer requests.

Production should use an idempotent reservation lifecycle:

`resolve source -> check/reserve -> AI generation -> commit on success OR release on failure`

Properties:

- unique generationId
- reservation is idempotent
- duplicate HTTP retries do not double-charge
- concurrency-safe allowance check/reserve
- commit once
- release/refund on provider failure/timeout/non-AI fallback
- late duplicate handlers cannot convert committed <-> released state incorrectly

If the live server already has a superior usage ledger/reservation system, KEEP_PRODUCTION and adapt the reference resolver to it.

---

# Current GitHub routes that must be audited

At minimum inspect and reconcile:

- `POST /api/campaigns/:id/action`
- `POST /api/items/:id/use`
- `POST /api/campaigns/:id/start`
- retry/regenerate/continue endpoints if production has them
- future multiplayer batch endpoints

Do not leave request-user `checkTurnLimit` middleware in front of routes where host/selected mode may use a different account.

Do not leave `incrementTurnCount(req.user.id)` as a second deduction after the new reservation service commits.

---

# Turn-deduction API contract

Recommended endpoints:

- `GET /api/campaigns/:id/turn-deduction`
- `PATCH /api/campaigns/:id/turn-deduction`
- `POST /api/campaigns/:id/turn-deduction/acknowledge`
- `POST /api/campaigns/:id/turn-deduction/accept-selected`
- `POST /api/campaigns/:id/turn-deduction/decline-selected`
- `POST /api/campaigns/:id/turn-deduction/revoke-selected`

Mutation endpoints require authentication.

Policy changes are host-only except selected-user accept/decline/revoke and individual acknowledgement.

Use live route conventions if they are better, but preserve behavior.

---

# Turn-deduction WebSocket contract

Use small campaign events that tell clients to refetch authoritative state:

- `turn_deduction_updated`
- `turn_deduction_request`
- `turn_deduction_setup_required`
- `turn_deduction_source_unavailable`

Never broadcast another account's private remaining-turn count campaign-wide.

---

# Persistent top indicator

Keep a compact status near the top of the campaign UI, without inventing another large gameplay bar:

- `Turn Usage: Campaign Host`
- `Turn Usage: Each Player`
- `Turn Usage: <username>`
- `Turn Usage: Setup Required`
- `Turn Usage: Unavailable - Action Required`

Clicking/tapping may open settings/details.

---

# Part B - Campaign Participation Ledger

## Product requirement

Each authenticated player account should have a historical list of campaigns they genuinely played in, even when they were not the host.

A player who joins, takes one or two turns, and leaves should **not** receive a visible Campaign History entry.

Keep two concepts separate:

### My Campaigns

Campaigns the account owns/hosts.

Current `/api/my-campaigns` semantics should remain owner-focused.

### Campaign History

Campaigns the account meaningfully participated in, including campaigns hosted by other accounts.

A campaign can appear in both sections when the account hosted and meaningfully played it.

---

# Campaign History qualification

Do not expose the thresholds in player UI.

Centralize the policy.

Reference initial policy:

- `meaningfulActions >= 5 AND activePlaySeconds >= 15 minutes`
- OR `meaningfulActions >= 10`
- OR `meaningfulActions >= 3 AND activePlaySeconds >= 30 minutes`

The exact values may be adjusted after real usage data, but the core product rule is fixed:

**1-2 turns alone must not qualify.**

Do not qualify merely because:

- character exists
- invite was accepted
- WebSocket connected
- browser tab stayed open
- player sent OOC chat

---

# Meaningful participation evidence

Count canonical gameplay contributions only.

Good evidence:

- accepted player action persisted in canonical history
- accepted combat action
- meaningful roleplay/action declaration entering campaign history
- consequential item-use action persisted as gameplay
- future accepted batch action per player

Do not count:

- OOC chat
- typing
- reconnect
- rejected request
- duplicate HTTP retry
- settings/UI changes
- raw dice UI event with no canonical gameplay action
- spam/no-op actions rejected by validation

If production has a canonical `campaign_events` system, prefer it over raw message rows.

Evidence must be idempotent with a unique source key such as:

- `message:1842`
- `campaign_event:912`
- `batch_action:477`

---

# Active play time

Do not count wall-clock connection time.

Use conservative active participation windows.

Reference behavior:

- activity accumulates only after meaningful play begins
- each elapsed segment is capped, e.g. 5 minutes
- long idle gaps do not count in full
- gap >= 30 minutes starts another session
- optional activity pulses should be rate-limited and server-keyed
- source keys should be generated server-side from presence-session/time buckets
- multiple tabs/retries must not double-count a bucket

This is approximate gameplay-history time, not payroll accounting.

---

# Campaign History persistence

Once qualified:

- leaving campaign does not delete history
- being removed does not delete history
- host cannot erase another player's qualified account history by removing current access
- archive/end state may update display status
- if campaign is deleted, retain a minimal historical snapshot where product/legal policy permits

Store snapshots sufficient for historical display:

- campaign name
- character name/id
- host username/id snapshot if appropriate
- ruleset/profile if known
- first meaningful play
- last play
- active play seconds
- session count
- current access/status

Do not copy campaign world/story state into the account ledger.

---

# Campaign History API/UI

Recommended endpoint:

`GET /api/campaign-history`

It always resolves `req.user.id` server-side. Do not allow arbitrary userId queries.

Return qualified entries only.

Dashboard should retain current owner campaigns and add a distinct:

## Campaign History

Suggested subtitle:

`Campaigns you've meaningfully adventured in.`

Drive-by candidate participation is never shown.

Do not reveal qualification thresholds.

---

# Integration points for participation

Audit/port at minimum:

- authenticated character join/creation -> ensure candidate participation row
- accepted canonical player action -> record meaningful evidence after persistence
- canonical item-use action -> record once
- future multiplayer batch -> record each accepted participant contribution once
- authenticated campaign presence/activity -> optional server-keyed activity pulse
- dashboard/account -> query qualified history
- archive/remove/leave/end flows -> update currentAccessStatus without deleting qualified history

Important:

Record player participation after their canonical action is accepted. Do not require the Anthropic request to succeed. A provider outage does not mean the player did not participate.

---

# Turn deduction and Campaign History are independent

A player may qualify for Campaign History even if:

- host mode consumed host turns
- selected mode consumed someone else's turns
- individual mode consumed the player's own turns

Participation tracks who played.

Turn deduction tracks whose AI allowance funded the generation.

Do not merge these concepts into one table/counter.

---

# Schema strategy

Reference proposes structured tables for:

- campaign turn-deduction settings
- deduction acknowledgements/consent
- deduction event ledger
- optional AI-turn reservations if live server lacks them
- campaign participation
- campaign participation evidence

If production has stronger generalized membership, consent, audit, generation-usage, campaign-event, or session tables, adapt to them rather than creating duplicates.

Do not put subscription policy into `worldState`.

Do not put campaign history qualification into `characterData`.

---

# Security requirements

- server determines turn-source account
- selected user must be authenticated participant
- visitor/anonymous identity cannot sponsor turns
- host cannot forge another user's consent
- one selected user cannot accept/revoke for another
- client sourceUserId is ignored
- private allowance is never broadcast to all campaign members
- history endpoint cannot query arbitrary other accounts
- evidence source keys are server/canonical IDs
- activity pulses are server-keyed/rate-limited
- retries cannot double-charge or double-qualify

---

# Required test coverage

Implement/adapt all scenarios in:

- `TEST-VECTORS.md`
- `PARTICIPATION-TEST-VECTORS.md`

Also run:

- typecheck
- unit tests
- route/integration tests
- migration against representative old DB
- migration against fresh DB
- concurrency/idempotency tests for reservations
- reconnect/WebSocket tests where possible

---

# Do not change

- unrelated gameplay bars
- character rules systems
- campaign narration behavior except where necessary to route AI usage safely
- existing campaign ownership meaning
- D&D rulesets
- unrelated subscription prices/tier quantities

Do not expose raw Anthropic tokens to players.

Do not replace `My Campaigns` with Campaign History.

---

# Changelog

Update internal `CHANGELOG.md` with implementation detail.

Player-facing copy should explain the feature plainly but need not reveal Campaign History qualification thresholds.

Good public wording:

> Multiplayer campaigns can now define where AI Dungeon Master turns are deducted from, with clear consent and campaign-wide visibility. Player accounts also retain a history of campaigns they genuinely participated in, even when someone else hosted the adventure.

Do not publish the anti-drive-by thresholds.

---

# Final report format

When implementation is complete, report:

## A. Live architecture discovered

## B. Turn-deduction production vs reference comparison

## C. Winning turn-deduction implementation

## D. Schema/migrations

## E. Consent and selected-player flow

## F. Reservation/concurrency handling

## G. Action/item/start/retry integration

## H. WebSocket/UI status behavior

## I. Campaign participation production vs reference comparison

## J. Meaningful-action evidence

## K. Active-time/session accounting

## L. Campaign History endpoint/dashboard integration

## M. Privacy/security protections

## N. Backwards compatibility

## O. Tests/typecheck/build/migration results

## P. Remaining risks or deferred work

Do not dump large code diffs unless explicitly requested.
