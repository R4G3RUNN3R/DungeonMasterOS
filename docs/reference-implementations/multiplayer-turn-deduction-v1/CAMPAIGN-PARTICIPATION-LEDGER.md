# Campaign Participation Ledger

## Product intent

Every authenticated player account should have a persistent historical ledger of campaigns they genuinely played in, even when they were not the campaign host.

This is **not** a list of every campaign invite ever opened.

A campaign becomes part of a player's account history only after the player has demonstrated meaningful participation.

Examples that SHOULD count:

- player joined another person's campaign and genuinely played multiple scenes
- player took meaningful in-character actions over time
- player participated in combat, exploration, investigation, dialogue, or other substantive play
- player returned to the campaign across one or more sessions
- player spent real active time participating rather than merely remaining connected

Examples that SHOULD NOT count:

- accepted invite, created/joined a character, then left
- sent one or two test actions and disappeared
- opened the campaign and stayed idle
- joined accidentally
- spammed meaningless actions to cross a raw counter threshold

## Terminology

Player-facing account section recommendation:

- **Campaign History**
- optional subtitle: `Campaigns you've meaningfully adventured in.`

Do not call it billing history. This is gameplay history.

## Authoritative concept

Separate:

- **campaign membership/access** - whether the account can currently enter a campaign
- **campaign participation** - measured gameplay activity
- **campaign ledger qualification** - whether participation is substantial enough to become permanent account history

A player can lose current campaign access while retaining a historical ledger entry.

## Qualification rule

Do not use only `joinedAt`, raw WebSocket connection duration, or a simple message count.

Use a configurable qualification policy combining meaningful actions and active play time.

Recommended initial policy:

```text
qualifies when EITHER:

A) meaningfulActions >= 5 AND activePlaySeconds >= 900   (15 active minutes)

OR

B) meaningfulActions >= 10

OR

C) activePlaySeconds >= 1800 (30 active minutes) AND meaningfulActions >= 3
```

These values are deliberately centralized configuration, not scattered magic numbers.

The purpose is not to create a gameable achievement threshold. It is merely to exclude drive-by joins and trivial testing.

The live server may choose slightly different values after observing real usage, but must preserve the principle that 1-2 actions alone are insufficient.

## What is a meaningful action?

A meaningful action is a canonical gameplay contribution, not any chat line.

Usually counts:

- accepted player action submitted to the campaign action pipeline
- combat action
- meaningful roleplay/action declaration that enters canonical campaign history
- consequential item use that triggers gameplay resolution
- scene-level decision
- accepted contribution included in a future multiplayer action batch

Usually does not count:

- OOC chat
- typing indicator
- dice UI interaction with no canonical action
- reconnect/subscription event
- opening settings
- changing portrait/UI
- duplicate/retried HTTP request
- rejected action
- spam/no-op action filtered by the server

Where the live server later has validated `campaign_events`, prefer those as the evidence source rather than raw messages.

## Active play time

Do not count wall-clock time merely because a browser tab remains connected.

Track **active participation windows**.

Recommended model:

- start/refresh activity on meaningful player interaction
- keep a short activity window alive, e.g. 5 minutes, while the player continues interacting
- cap idle gaps rather than counting them
- aggregate active seconds server-side
- reconnecting does not create duplicate time

Example:

Player acts at 20:00, 20:03, 20:08, 20:11.

The system may accumulate overlapping activity windows into real active play time.

Player opens campaign at 20:00 and leaves the tab untouched until midnight.

That should not count as four hours played.

## Suggested ledger record

A qualified historical record should retain enough information to remain useful even if campaign membership changes later:

```text
userId
campaignId
campaignNameSnapshot
hostUserIdSnapshot
hostUsernameSnapshot (optional display snapshot)
characterId
characterNameSnapshot
rulesProfileId / system label if known
firstJoinedAt
firstMeaningfulActionAt
lastMeaningfulActionAt
qualifiedAt
meaningfulActionCount
activePlaySeconds
sessionCount
lastPlayedAt
currentAccessStatus
campaignArchivedAt (optional)
```

Do not duplicate campaign story state into the account ledger.

## Visibility

Each player sees their own ledger.

Recommended card fields:

- campaign name
- character used
- game/ruleset
- host name where appropriate
- first played / last played
- approximate meaningful play time
- number of sessions if reliable
- current status: Active / Left / Archived / Campaign ended

Avoid exposing other players' account data.

## Historical persistence

Once a campaign qualifies for the player's ledger, later leaving the campaign should not delete the history.

The ledger is historical evidence that the account genuinely participated.

If the campaign itself is deleted, retain a minimal tombstoned historical record where legally/product-appropriate rather than crashing the ledger because a foreign key vanished.

A host should not be able to erase another player's personal participation history merely by removing them from the current campaign.

## Host campaigns

Campaigns hosted by the account may also appear in Campaign History, but hosting alone should not be the sole qualification signal if this section is intended to represent campaigns actually played.

If the product already has a separate `My Campaigns` owner list, keep that separate.

Recommended account organization:

- **My Campaigns** - campaigns I own/host
- **Campaign History** - campaigns I meaningfully played in, including campaigns hosted by others

A campaign may appear in both views when appropriate.

## Anti-gaming

This ledger should not be tied directly to rewards unless separately approved.

If later achievements use campaign-history counts, use the canonical qualified ledger, not raw joins.

Do not expose the exact internal qualification thresholds in the UI. Players simply see a campaign appear after they have genuinely participated.

## Interaction with turn deduction

Turn deduction and campaign history are separate systems.

A player can qualify for Campaign History even if:

- Host mode consumed only the host's AI turns
- Selected Player mode consumed another participant's turns
- Individual mode consumed the player's own turns

The ledger tracks **participation**, not who supplied AI Turns.

For analytics/audit, generation events may reference the actor and turn-source account separately.
