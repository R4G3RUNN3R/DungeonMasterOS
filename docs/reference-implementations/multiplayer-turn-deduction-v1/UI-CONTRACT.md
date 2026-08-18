# UI Contract - Multiplayer AI Turn Deduction

## Product wording

Use **turn deduction / turn usage**.

Do not use player-facing wording such as:

- payer
- pays
- payment source
- token billing
- Anthropic tokens

The user-facing resource is **AI Dungeon Master Turns** / **AI Turns**.

## Setup prompt

When multiplayer becomes active, the host should see:

### AI Turn Usage

**Where should AI Dungeon Master turns be deducted from for this campaign?**

#### Campaign Host
All AI Dungeon Master responses in this campaign use the campaign host's available turns.

#### Each Individual Player
Each player's AI-triggering actions use that player's available turns.

Players must acknowledge this before their first AI-triggering action under this policy revision.

#### Selected Player
All AI Dungeon Master responses use one selected participant's available turns.

The selected participant must accept before this setting becomes active.

## Selected-player request

The selected participant sees a direct request:

### AI Turn Usage Request

`<host>` has selected your account as the source of AI Dungeon Master turns for `<campaign>`.

Future AI Dungeon Master responses for this campaign will be deducted from your available turns while this setting remains active.

Buttons:

- **Accept**
- **Decline**

Decline must not change the currently active campaign policy.

## Individual acknowledgement

Before a player's first AI-triggering action under an explicitly configured `individual` revision:

### Confirm Turn Usage

This campaign is set to **Each Individual Player**.

When one of your actions triggers an AI Dungeon Master response, one AI Turn will be deducted from your available turns.

Buttons:

- **Confirm and Continue**
- **Cancel**

Acknowledgement applies only to the current policy revision. If the host changes away and later returns to individual mode, the new revision requires acknowledgement again.

## Persistent top indicator

Keep this compact and visible near the top of the campaign UI without creating another large gameplay bar.

Examples:

- `Turn Usage: Campaign Host`
- `Turn Usage: Each Player`
- `Turn Usage: George`
- `Turn Usage: Setup Required`
- `Turn Usage: Unavailable - Action Required`

Click/tap opens a compact detail/settings panel.

## Detail panel

Show only information relevant to the current user:

- active mode
- selected username when applicable
- whether the current user has acknowledged individual mode
- whether a selected-player request is waiting for the current user
- who can change the policy (campaign host)
- selected player option to revoke future use of their turns

Do not expose another user's private allowance unless the existing product explicitly permits that. A guest does not need to know the host has exactly 17 turns left.

## Exhausted or unavailable source

Never fall back silently.

Display:

### AI Turn Source Unavailable

The account currently configured for AI Dungeon Master turn usage cannot provide another AI Turn.

The campaign host must choose another turn-usage option before new AI Dungeon Master responses can be generated.

The campaign remains readable. Non-AI UI operations should remain available where safe.

## Setup timing

Recommended behavior:

- Existing campaigns migrate to `Each Individual Player` and are not interrupted.
- New campaigns receive `setup_required` policy state.
- A single-player campaign can continue because host and actor are the same account.
- As soon as a second authenticated participant joins, surface the setup prompt prominently.
- Before the first multiplayer AI generation, require setup completion.

## Changing policy mid-campaign

Host -> Individual:
- applies immediately
- revision increments
- players acknowledge when they next attempt an AI-triggering action

Individual -> Host:
- applies immediately
- old acknowledgements become historical only

Any mode -> Selected Player:
- creates a pending request
- current active mode remains effective until acceptance
- accepting switches the policy and increments revision
- declining leaves current policy unchanged

Selected Player revokes:
- future generations are blocked
- no fallback
- host receives a clear action-required state

## WebSocket behavior

On policy change or request, connected clients should receive a small event and refetch authoritative state:

- `turn_deduction_updated`
- `turn_deduction_request`
- `turn_deduction_setup_required`
- `turn_deduction_source_unavailable`

Do not send private allowance values in a campaign-wide broadcast.
