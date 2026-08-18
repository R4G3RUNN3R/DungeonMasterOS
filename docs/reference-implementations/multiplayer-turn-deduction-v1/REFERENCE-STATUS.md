# Reference Status

## Status

**READY FOR LIVE-SERVER COMPARISON / SELECTIVE PORT**

Branch:

`reference/multiplayer-turn-deduction-v1`

Baseline main inspected:

`8581553e283a67ea4c3e0fcfa68bd45e667337c5`

## Implemented in this reference

### AI Turn Deduction

- explicit campaign-level turn-deduction modes:
  - host
  - individual
  - selected player
- player-facing terminology contract
- persistent policy state
- policy revisioning
- selected-player request/accept/decline/revoke
- individual-mode acknowledgement
- legacy compatibility behavior
- new-campaign setup-required behavior
- server-side source resolution
- participation validation for selected account
- no-silent-fallback rule
- blocked source handling
- allowance reservation/commit/release port
- idempotent generation contract
- provider-failure refund/release behavior
- route integration contract for action/item/start/future retry paths
- WebSocket refresh events
- compact top-of-campaign status contract
- security/concurrency acceptance vectors

### Campaign Participation / Campaign History

- distinct Campaign History concept separate from My Campaigns
- candidate participation records
- meaningful-action qualification
- conservative active-play-time calculation
- session counting
- internal qualification thresholds
- qualified-at state
- persistent history after leave/remove/archive
- campaign/character/host/ruleset display snapshots
- idempotent meaningful-action evidence
- idempotent activity-pulse evidence
- server-keyed activity pulse contract
- dedicated `/api/campaign-history` contract
- dashboard integration guidance
- privacy and anti-drive-by test vectors
- independence from AI-turn source

## Deliberately not wired into application build

All implementation code in this reference lives under:

`docs/reference-implementations/multiplayer-turn-deduction-v1/`

It is intentionally outside the current production TypeScript runtime.

Claude must compare against the live server before moving code into `shared/`, `server/`, or `client/`.

## Live-server decisions Claude must make

1. Does production already have a campaign-membership table?
   - If yes, use it instead of deriving participants from campaign owner + character.userId.

2. Does production already have an idempotent AI-usage ledger/reservation system?
   - If yes, keep it and port only the policy/source resolver.

3. Does production already have generalized campaign events?
   - If yes, use canonical event IDs as Campaign History evidence rather than raw message IDs.

4. Does production already track authenticated presence/session activity?
   - If yes, reuse the better mechanism for active-play-time estimation.

5. Does production already expose joined campaigns separately from hosted campaigns?
   - Preserve its useful UX while keeping historical qualification semantics.

## Known design boundary

A future multiplayer batch that contains actions from multiple players is not yet assigned a turn-deduction rule under `individual` mode.

Do not guess.

Before enabling multi-user batching with individual deduction, product must choose an explicit attribution rule.

Host and selected-player modes remain unambiguous for batches because one configured account supplies the generation turn.

## Verification status

The reference was inspected against the current GitHub schema, routes, auth usage counters, WebSocket campaign broadcasting and dashboard owner-campaign flow.

No production files on `main` were modified by this reference work.

The reference TypeScript files are not part of the application build, so they have not been runtime-integrated or migration-tested against the live VPS database.

Claude must run on the live candidate implementation:

- TypeScript typecheck
- test suite
- migration on old DB copy
- migration on fresh DB
- route integration tests
- concurrent generation/reservation tests
- retry/idempotency tests
- WebSocket refresh tests
- dashboard Campaign History tests

## Risk assessment

### Turn deduction

Risk if implemented poorly: **high** because the feature controls account allowances and multiplayer AI access.

The strongest safeguards in the reference are server-side source resolution, explicit consent, policy revisioning, and reservation idempotency.

### Campaign History

Risk if implemented poorly: **moderate**. Main risks are privacy leaks, fake qualification through retries/idle connections, and accidental loss of historical records.

## Expected player impact after production port

Players should clearly see where AI Turns are deducted from in multiplayer campaigns without billing jargon.

Campaign hosts can choose host, individual, or selected-player turn usage.

Selected players explicitly consent before their turns are used.

Player accounts retain a meaningful Campaign History even when they joined someone else's campaign, while trivial one- or two-turn visits remain absent.
