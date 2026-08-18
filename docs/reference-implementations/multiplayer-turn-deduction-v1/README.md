# Multiplayer AI Turn Deduction + Campaign History v1

Status: **REFERENCE IMPLEMENTATION - READY FOR LIVE-SERVER COMPARISON / SELECTIVE PORT**

Branch: `reference/multiplayer-turn-deduction-v1`

This reference contains two related multiplayer account systems:

1. **Campaign AI Turn Deduction** - replaces the current assumption that the account sending an action is always the account whose AI turns are consumed.
2. **Campaign Participation Ledger** - gives each authenticated player a persistent Campaign History for campaigns they genuinely played in, including campaigns hosted by other users, while filtering out drive-by joins.

## Product language

Player-facing wording must use **turn deduction / turn usage**, not "payer", "pays", or raw provider tokens.

Primary setup question:

> **Where should AI Dungeon Master turns be deducted from for this campaign?**

Supported modes:

1. `host` - **Campaign Host**
   - Every successful AI Dungeon Master generation in the campaign is deducted from the campaign host's available turns.

2. `individual` - **Each Individual Player**
   - A player's own AI-triggering action is deducted from that player's available turns.
   - Each player must acknowledge the current policy revision before their first AI-triggering action under this mode.

3. `selected` - **Selected Player**
   - Every successful AI Dungeon Master generation is deducted from one selected campaign participant.
   - The selected player must explicitly accept before the change becomes active.

## Always-visible player indicator

The campaign UI should keep a compact status near the top of the campaign screen:

- `Turn Usage: Campaign Host`
- `Turn Usage: Each Player`
- `Turn Usage: <username>`
- `Turn Usage: Setup Required`
- `Turn Usage: Unavailable - Action Required`

The indicator may open the settings/details panel, but it must not become another large gameplay bar.

## Non-negotiable turn rules

- Never silently deduct turns from an account that did not consent to the active policy.
- Never silently fall back to another account if the configured turn source runs out of turns, loses access, leaves the campaign, or becomes invalid.
- A requested switch to `selected` does not replace the currently active policy until the selected player accepts.
- Declining a selected-player request leaves the previous active policy unchanged.
- A selected player can revoke future use of their turns. Revocation blocks future AI generations that rely on that source until the host selects another valid policy. No automatic fallback.
- Existing campaigns migrate to `individual` to preserve today's behavior and avoid surprise host deductions.
- Newly created multiplayer campaigns should prompt the host to configure turn deduction as multiplayer becomes active.
- The server is authoritative. The client never supplies the final deduction account ID for an AI generation.
- Deduction occurs per **successful authoritative AI DM generation**, not per chat message, typing event, OOC line, WebSocket event, dice UI interaction, or failed provider request.
- Raw Anthropic/provider token usage is internal cost telemetry. Players see AI Turns.

## Campaign History product rule

Keep existing owner semantics:

- **My Campaigns** = campaigns the account owns/hosts.
- **Campaign History** = campaigns the account genuinely participated in, including campaigns hosted by someone else.

A campaign may appear in both when appropriate.

Do not show every invite/join. A player who joins, takes one or two turns, and leaves should not receive a visible history entry.

Qualification is based on canonical meaningful gameplay plus conservative active-play time. Exact thresholds are centralized internally and are intentionally not shown to players.

Once a campaign qualifies, leaving/removal/archive does not erase the player's historical participation record.

## Current repository problems this solves

### Turn deduction

`POST /api/campaigns/:id/action` currently runs `checkTurnLimit` against `req.user`, generates the DM response, then calls `incrementTurnCount(req.user!.id)`. That is correct only for an individual-account policy.

This reference introduces a campaign-level resolver:

`actor user -> campaign turn policy -> resolved turn source -> allowance reservation -> AI generation -> commit/release`

The action actor and the turn-deduction account are intentionally separate concepts.

### Campaign history

The current dashboard's `/api/my-campaigns` path is owner-focused. It does not provide a historical account ledger for campaigns a player joined and genuinely played under another host.

This reference keeps `/api/my-campaigns` intact and adds a distinct qualified `/api/campaign-history` concept.

## Files

### Turn deduction

- `domain.ts` - stable policy and resolver types
- `turn-deduction-service.ts` - pure/server orchestration rules
- `schema-proposal.ts` - Drizzle/SQLite persistence proposal
- `storage-contract.ts` - storage operations required by the service
- `route-integration.ts` - server-route integration contract
- `UI-CONTRACT.md` - setup, consent, status and error UX
- `TEST-VECTORS.md` - acceptance/security/concurrency cases

### Campaign History

- `CAMPAIGN-PARTICIPATION-LEDGER.md` - product/qualification/history design
- `participation-ledger.ts` - server-side qualification and active-time service
- `participation-schema-proposal.ts` - ledger/evidence persistence proposal
- `participation-route-integration.ts` - current-route/dashboard integration contract
- `PARTICIPATION-TEST-VECTORS.md` - qualification/idempotency/privacy tests

### Handoff

- `CURRENT-REPO-FINDINGS.md` - verified GitHub baseline behavior
- `CLAUDE-HANDOFF.md` - live-server comparison and port instructions
- `REFERENCE-STATUS.md` - implementation readiness and known limits

## Scope boundary

This module does **not** decide how a future multiplayer action-batching coordinator should attribute an `individual`-mode batch containing actions from several users. The current server generates one DM response per action, so `individual` is unambiguous today. A future batch coordinator must provide an explicit generation initiator/turn-source rule rather than guessing.

The Campaign History ledger is intentionally independent of whose AI Turns were deducted. It records participation, not funding.
