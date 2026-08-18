# Current Repository Findings

Baseline inspected: `main` at `8581553e283a67ea4c3e0fcfa68bd45e667337c5`.

## Current turn accounting behavior

The current action route:

1. authenticates the request user
2. runs `checkTurnLimit` against `req.user`
3. resolves that user's character
4. persists the player action
5. calls the AI DM
6. persists the DM response
7. calls `incrementTurnCount(req.user!.id)`

Therefore today's effective policy is **Each Individual Player** for the normal action route.

The same request-user assumption also appears in AI-generating item-use and campaign-start flows and must be compared carefully on the live server.

## Current account model

`users` contains:

- `aiTurnsUsedThisMonth`
- `bonusTurns`
- `usageResetAt`
- tier/subscription fields

`campaigns.userId` is the authenticated campaign owner/host account.

`characters.userId` can identify authenticated participants. The current repo does not expose a dedicated `campaign_members` table in the inspected schema, so the reference derives authenticated participation from:

- campaign host account
- character ownership in that campaign

If the live server already has a proper campaign-membership table, prefer that as the authoritative participation source.

## Current multiplayer transport

The current server maintains WebSocket clients per campaign and broadcasts campaign messages/state updates. That is sufficient to broadcast a small `turn_deduction_updated` event and have clients refetch authoritative settings.

Do not broadcast private allowance values to all campaign members.

## Current schema gap

The inspected `campaigns` table has no persisted AI-turn-deduction policy and no consent/acknowledgement state.

Do not stuff this into `worldState` or message metadata. It is account/subscription state and needs structured persistence.

## Current concurrency concern

`checkTurnLimit` and `incrementTurnCount` are separate operations around an asynchronous provider call. A production multiplayer implementation should not merely replace `req.user.id` with another user ID and leave this race intact.

Use an idempotent reservation/commit/release mechanism or keep a superior live-server equivalent if one already exists.

## Compatibility principle

Existing campaigns must behave exactly as they do today after migration unless the host explicitly changes the policy:

`individual` / active.

New campaigns can enter the new setup flow without retroactively changing old campaigns.
