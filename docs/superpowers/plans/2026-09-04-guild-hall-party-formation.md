# DungeonMasterOS Guild Hall / Party Formation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Use test-driven development and preserve production-release gates.

**Date:** 4 September 2026

**Status:** Future implementation plan. Research/design only. No implementation, merge, deployment or production migration is authorised by this document.

**Goal:** Add a safe, ruleset-native Guild Hall to DungeonMasterOS that lets authenticated users discover compatible campaigns and adventurers, apply to campaigns, form explicit memberships, and later create parties around approved campaign templates without duplicating the DMOS campaign runtime.

**Architecture:** Keep recruitment as a modular DMOS-owned subsystem. Introduce explicit campaign membership before applications. Separate public recruitment projections from private campaign state. Keep private invite-code joining. Use deterministic hard constraints plus transparent weighted matching. Store schedules as recurring local-time windows in IANA timezones and calculate real future overlap. Keep SQLite/WAL. Do not introduce a separate matchmaking service, Redis, vector database or PostgreSQL migration for this feature.

**Research:** `docs/superpowers/research/2026-09-04-guild-hall-party-formation-research.md`

## Non-negotiable invariants

- `Campaign` is authoritative gameplay state; `RecruitmentListing` is a safe public/authenticated projection.
- `CampaignApplication` never grants gameplay access by itself.
- `CampaignMembership` is the authoritative access/relationship record.
- `CampaignParticipation` is historical evidence and remains separate from current membership.
- Character existence must not remain the primary definition of campaign membership.
- UI/personal preferences are not matchmaking preferences.
- Private invite codes never become public listing identifiers.
- All public/profile/listing DTOs are server-side allowlists, never raw database rows.
- Campaign secrets, world state, hidden NPCs, inventories, billing data, email addresses and AI-turn balances never enter recruitment DTOs.
- Applicant/listing text is untrusted input and must never be injected into the AI Dungeon Master's prompt.
- Match scores are explainable and deterministic. AI/embeddings are not authoritative match logic.
- Existing private invite-code flow remains available.
- Existing account auth remains authoritative until separately migrated under the Voidsmith identity programme.
- SQLite/better-sqlite3 remains authoritative unless a separate deliberate redesign is approved.
- Anything released to production must update DMOS public Updates/changelog.

---

# Phase 0 - Re-audit the actual implementation baseline

This plan was prepared from `production-live-base` plus relevant feature/reference branches. Before implementation, the worker must re-audit the then-current production branch/live server and update this plan where reality differs.

### Task 0.1: Capture exact baseline

**Inspect:**
- `shared/schema.ts`
- `server/storage.ts`
- `server/routes.ts`
- `server/auth.ts`
- `client/src/App.tsx`
- `client/src/pages/dashboard.tsx`
- `shared/player-profile.ts`
- `client/src/pages/player-profile.tsx`
- `shared/rulesets.ts`
- `reference/multiplayer-turn-deduction-v1`
- `research/campaign-template-library`

**Verify:**
- live/prod branch SHA;
- current campaign access logic;
- current invite-code flow;
- current profile discoverability and profile API state;
- whether Campaign Participation has already been ported;
- whether AI turn deduction policy has already been ported;
- current test count and release process.

**Exit gate:** no implementation begins from stale assumptions.

---

# Phase 1 - Campaign Membership foundation

## Task 1.1: Add membership contracts and schema

**Files:**
- Modify: `shared/schema.ts`
- Modify: `server/storage.ts`
- Create: `server/campaign-membership.test.ts`

Create `campaign_memberships` with at least:

```text
id
campaignId
userId
role              host | player
status            invited | offered | active | left | removed | banned
primaryCharacterId nullable
source             owner | invite | guild_hall | migration
joinedAt nullable
leftAt nullable
createdAt
updatedAt
```

Recommended constraints/indexes:

- unique `(campaign_id, user_id)` current logical relationship;
- index `(user_id, status)`;
- index `(campaign_id, status)`;
- character assignment must reference a character in the same campaign and owned by the same user.

### Task 1.2: Backfill conservatively

- Campaign owner becomes active `host` membership.
- Existing character ownership can be used as evidence for an active player membership only after collision/identity review.
- Do not invent membership for anonymous historical rows that cannot be attributed safely.
- Backfill must be idempotent.

### Task 1.3: Replace access inference

Refactor campaign authority/access checks so membership is authoritative for authenticated users.

Do not immediately delete legacy visitor compatibility if production still needs it. Use an expand/contract migration:

1. write/read membership while retaining legacy checks;
2. compare behaviour in tests/staging;
3. remove obsolete authenticated-character inference only after parity is proven.

### Task 1.4: Keep invite-code flow

Private invite-code joining should result in explicit membership rather than merely allowing a character row to imply access.

**Acceptance:**
- owner is host member;
- invited/joining player becomes active member through an explicit transition;
- non-member cannot access campaign-private routes;
- membership removal revokes future access without deleting historical characters/state;
- existing private campaigns remain usable.

---

# Phase 2 - Campaign Participation / Campaign History

## Task 2.1: Port/reconcile the reference implementation

Use `reference/multiplayer-turn-deduction-v1` as design input, not as blind source replacement.

Implement/reconcile:

- `campaign_participation`
- `campaign_participation_evidence`
- meaningful-action evidence
- bounded active-play windows
- qualified Campaign History

### Task 2.2: Keep membership and participation separate

Membership answers: **may this account enter now?**

Participation answers: **did this account genuinely play?**

Campaign History answers: **has participation crossed the conservative threshold for durable history?**

### Task 2.3: Player-facing history

Add an authenticated `Campaign History` surface distinct from `My Campaigns`.

No public history exposure in this phase.

**Acceptance:** drive-by joins and idle tabs do not qualify; leaving/removal does not erase qualified history.

---

# Phase 3 - Public-player projection and discoverability privacy

## Task 3.1: Finish authoritative public profile API

Build on `shared/player-profile.ts` and existing profile UI.

Public/authenticated profile projection must be allowlisted.

Recommended initial Guild Hall projection:

```text
username
avatarUrl
memberSince
showcasedAchievements
mostRecentCharacterSummary optional
campaignExperienceSummary optional/private-by-default
lookingForGroup status
```

Do not expose email, Google identity, subscription, billing, AI-turn balance, private characters or private campaigns.

## Task 3.2: Add discoverability settings

Create separate persistence from UI preferences:

```text
profileDiscoverability
lookingForGroup
allowCampaignInvites
```

Default `lookingForGroup` to **off**.

`Find Adventurers` must include only users who explicitly opted in.

---

# Phase 4 - Guild Hall V1: campaign listings

## Task 4.1: Add recruitment listing schema

Create `campaign_recruitment_listings` separate from `campaigns`.

Recommended fields:

```text
id
campaignId unique
publicSlug unique
status              draft | open | paused | filled | closed
pitch
campaignFormat      one_shot | short_campaign | long_campaign | open_ended
languageCode
minimumAgeBand nullable
newPlayerFriendly
requiredVoiceMode   none | optional | required
cadence             one_time | weekly | fortnightly | monthly | variable
maxPlayers
openSeatsTarget
applicationMode     approval
applicationDeadline nullable
createdAt
updatedAt
openedAt
closedAt
```

Do not duplicate fields that can be safely projected from `campaigns` unless a listing needs an intentional public override/snapshot.

## Task 4.2: Build safe `RecruitmentListingProjection`

Projection may include:

- campaign/listing title;
- pitch;
- ruleset;
- setting label;
- tone;
- rules weight;
- combat style;
- story mode;
- campaign format;
- current party level/progression summary where safe;
- open seat count;
- schedule;
- language;
- new-player friendliness;
- content/safety summary;
- AI Turn Usage policy;
- host public profile summary.

It must not include `worldState`, hidden notes, private prompts, full character sheets, inventory, campaign memory, secret invite code or applicant information.

## Task 4.3: Seat accounting

Authoritative seat count derives from membership and valid pending offers, not a host-edited counter.

Acceptance must use a transaction/critical section so simultaneous accepts cannot exceed capacity.

## Task 4.4: Guild Hall campaign UI

Routes:

```text
/guild-hall
/guild-hall/campaigns
/guild-hall/campaign/:slug
```

Authenticated-only V1.

Filters:

- ruleset;
- setting;
- campaign format;
- language;
- day/time compatibility;
- tone/playstyle tags;
- new-player-friendly;
- open seats.

Keep interface dense and DMOS-native: dark surfaces, restrained bronze, compact cards.

---

# Phase 5 - Structured applications and membership offers

## Task 5.1: Application schema

Create:

```text
campaign_applications
campaign_application_questions
campaign_application_answers
campaign_application_events
```

Application states:

```text
draft
submitted
pending
shortlisted
accepted
membership_offered
joined
declined
withdrawn
expired
```

Persist immutable/auditable state-transition events.

## Task 5.2: Host questions

Support a small bounded number of questions. Recommended V1:

- maximum 5 custom questions;
- short-text / long-text / single-choice / checkbox acknowledgement;
- strict length limits;
- no executable markup.

## Task 5.3: Accept does not equal join

Flow:

```text
application accepted
 -> membership offer
 -> applicant accepts
 -> AI Turn Usage policy acknowledgement/consent where required
 -> active campaign membership
 -> character create/import/assign
```

Never silently consume an applicant's AI Turns merely because the host accepted them.

## Task 5.4: Applicant UI

Routes/surfaces:

```text
/guild-hall/applications
```

Show status history and allow withdrawal where valid.

## Task 5.5: Host recruitment dashboard

Routes/surfaces:

```text
/campaign/:id/recruitment
/campaign/:id/applications
```

Host actions:

- open/pause/close listing;
- review;
- shortlist;
- accept;
- decline;
- expire/revoke outstanding offer when valid.

---

# Phase 6 - Player Match Profile / Find Adventurers

## Task 6.1: Separate matchmaking profile

Create `player_match_profiles` and schedule tables/contracts.

Do not store this in `user_preferences`.

Recommended fields:

```text
lookingForGroup
rulesets[]
languages[]
campaignFormats[]
commitment
roleplay
combat
exploration
puzzles
rulesStrictness
homebrewAttitude
tonePreferences[]
structurePreference
groupSizeMin
groupSizeMax
newPlayerComfort
voicePreference
timezone
updatedAt
```

Prefer normalized tables for schedule windows and any fields that need indexed searching; bounded JSON is acceptable for low-query preference vectors if kept validated/versioned.

## Task 6.2: Recurring availability

Store:

```text
weekday
localStartMinutes
localEndMinutes
timezone (IANA)
```

Use actual future dates and timezone rules to compute overlap across a 4-8 week horizon. Do not permanently flatten recurring schedules to a fixed UTC offset.

## Task 6.3: Find Adventurers

Authenticated route:

```text
/guild-hall/adventurers
```

Only opted-in/discoverable users appear.

Hosts may invite a player to **apply** or view a campaign listing. Do not create campaign membership from unsolicited host action.

---

# Phase 7 - Compatibility Engine V1

## Task 7.1: Pure matching domain

Create a pure, testable module such as:

```text
shared/matchmaking.ts
server/matchmaking-service.ts
server/matchmaking-service.test.ts
```

### Hard gates

Evaluate before scoring:

- listing open;
- seat available;
- ruleset accepted;
- language compatibility;
- required schedule overlap;
- voice/play mode requirements;
- minimum-age/access policy where applicable;
- not blocked;
- not already an active member;
- not already holding an incompatible live application/offer.

Return explicit machine-readable mismatch reasons.

### Weighted soft score

Initial recommended weights:

```text
schedule quality                 30
playstyle/vibe                   25
rules/homebrew                   10
commitment/cadence               10
tone/content                     10
structure/agency                 10
group-size/new-player comfort     5
TOTAL                            100
```

Weights are versioned configuration.

## Task 7.2: Explainability

Return:

```text
score
strongMatches[]
differences[]
hardConflicts[]
scoreVersion
```

The UI must not claim an opaque AI judgement.

## Task 7.3: Search strategy

For SQLite V1:

1. SQL hard-filter candidates using indexed fields.
2. Limit/paginate candidate set.
3. Compute schedule overlap + soft score in application code.
4. Sort by score/freshness.

Do not do all-pairs precomputation.

## Task 7.4: Tests

At minimum:

- DST transition cases;
- cross-midnight availability;
- zero-overlap hard rejection;
- hard rule failure cannot be outweighed by preferences;
- symmetric vs asymmetric preference tests;
- blocked-user removal;
- deterministic same-input result;
- score versioning;
- missing/unknown preference handling distinct from negative preference.

---

# Phase 8 - Safety, moderation and abuse controls

This phase is a release blocker for public stranger discovery, not optional polish.

## Task 8.1: Block/report

Create domain tables/services for:

- `user_blocks`;
- `reports`;
- moderation state/action history.

Blocks remove users from each other's discovery/application paths without disclosing who blocked whom.

## Task 8.2: Rate limits and anti-spam

Rate-limit:

- applications;
- listing creation/edit churn;
- profile/discoverability search;
- reports;
- host invitations to apply.

Prevent duplicate/spam applications to the same listing.

## Task 8.3: User-generated text safety

- server-side length validation;
- output escaping/sanitisation;
- no raw HTML;
- no recruitment text in gameplay AI context;
- audit moderation edits/removals.

## Task 8.4: UK safety/privacy release review

Before any public stranger-discovery rollout:

- perform current Ofcom scope/children-access assessment;
- review whether child-safety duties are triggered;
- document data-protection-by-design assessment;
- verify privacy notice/retention/purpose limitation;
- verify report/block/moderation workflows;
- define age/access approach explicitly;
- obtain qualified legal review if scope is uncertain.

Do not rely only on a terms-of-service age statement as the safety model.

---

# Phase 9 - Notifications and saved discovery

Only after applications/listings are stable.

## Task 9.1: In-app notification events

Examples:

- new application;
- application shortlisted/declined;
- membership offer;
- offer expiring;
- listing filled/closed;
- compatible campaign newly available.

Do not send marketing notifications without the appropriate preference/consent model.

## Task 9.2: Saved searches

Allow saved filters such as:

```text
D&D 3.5e
Friday/Saturday evenings
roleplay >= preferred threshold
long campaign
English
```

Notification should trigger only on meaningful new matches, not every listing edit.

---

# Phase 10 - Campaign Template -> Form a Party

Do not start this until the approved campaign-template library is importable/usable by the runtime.

## Task 10.1: Party formation lobby

From a template offer:

```text
Start Solo
Create Private Campaign
Form a Party
```

`Form a Party` creates a recruitment lobby/listing referencing the template metadata without exposing source-only spoilers.

## Task 10.2: Pre-campaign state

The recruitment lobby exists before authoritative campaign instantiation where practical.

When target party size/host confirmation is reached:

- instantiate campaign from approved template;
- create host membership;
- convert accepted party offers to campaign memberships;
- proceed through character setup and AI-turn policy consent.

Do not create abandoned full campaign worlds for every speculative party listing if a lightweight lobby can represent the pre-game state.

---

# Phase 11 - Replacement recruitment

For established campaigns, host action:

```text
Recruit Replacement
```

Generate the listing from a safe current campaign projection.

May expose only spoiler-safe facts such as:

- ruleset;
- current party level/progression band;
- current player count;
- campaign age/session cadence;
- style/tone;
- safe premise.

Never expose campaign memory, current secret objectives, hidden NPC identities or unrevealed plot state.

---

# Phase 12 - Party Formation Engine V2

Only after real marketplace density and outcome data exist.

Potential capabilities:

- suggest several compatible players for an open campaign;
- suggest compatible campaigns to a player;
- suggest an approved adventure template to a group;
- calculate group-level schedule compatibility;
- identify the single preference causing an otherwise strong group to fail;
- recommend host review, never auto-enrol strangers.

No auto-created parties without explicit human confirmation from affected users.

AI may assist with explanation/presentation later but must not silently replace the deterministic eligibility/matching contract.

---

# Suggested API surface

Exact naming may change after baseline audit.

```text
GET    /api/guild-hall/listings
GET    /api/guild-hall/listings/:slug
POST   /api/campaigns/:id/recruitment-listing
PATCH  /api/campaigns/:id/recruitment-listing
POST   /api/guild-hall/listings/:id/applications
GET    /api/guild-hall/my-applications
GET    /api/campaigns/:id/applications
PATCH  /api/campaign-applications/:id/status
POST   /api/campaign-applications/:id/offer
POST   /api/membership-offers/:id/accept
POST   /api/membership-offers/:id/decline
GET    /api/campaigns/:id/members
DELETE /api/campaigns/:id/members/:userId
GET    /api/guild-hall/adventurers
GET    /api/me/match-profile
PUT    /api/me/match-profile
GET    /api/guild-hall/listings/:id/compatibility
POST   /api/users/:username/block
DELETE /api/users/:username/block
POST   /api/reports
```

Every route requires an explicit authorization matrix in tests.

---

# Database/index plan

SQLite is sufficient for V1 provided queries are bounded and indexed.

Minimum likely indexes:

```text
campaign_memberships(campaign_id, status)
campaign_memberships(user_id, status)
recruitment_listings(status, updated_at)
recruitment_listings(campaign_id)
campaign_applications(listing_id, status, created_at)
campaign_applications(applicant_user_id, status, created_at)
match_profiles(looking_for_group, updated_at)
availability(user_id, weekday)
user_blocks(blocker_user_id, blocked_user_id)
reports(status, created_at)
```

Use transactions for:

- offer acceptance + capacity check + membership creation;
- application terminal transitions where needed;
- membership removal plus related access-state updates;
- idempotent event generation.

---

# UI structure

## Dashboard

Add a compact Guild Hall/Discovery area without overwhelming current campaign controls.

Recommended navigation:

```text
Adventures
  My Campaigns
  Campaign History

Guild Hall
  Find Campaigns
  Find Adventurers
  My Applications
  Recruitment
```

## Campaign cards

Show at-a-glance:

- title;
- ruleset/setting;
- open seats;
- localised schedule;
- tone/style tags;
- AI Turn Usage;
- compatibility score when available.

## Player cards

Show only opt-in safe fields:

- profile identity;
- preferred systems;
- availability summary;
- playstyle summary;
- optional experience summary;
- compatibility with the host's selected listing.

Do not display subscription tier as prestige.

---

# Release strategy

Use feature flags and progressive rollout.

Recommended states:

```text
OFF
OWNER_ONLY
CLOSED_ALPHA
OPT_IN_BETA
GENERAL
```

Suggested rollout:

1. owner-only synthetic/staging tests;
2. closed cohort using real accounts but no public indexing;
3. opt-in authenticated Guild Hall beta;
4. only after safety/privacy/moderation review: broader authenticated discovery;
5. public shareable/SEO listing pages considered separately.

Rollback must disable Guild Hall without disabling existing campaigns or private invite-code joins.

---

# Test matrix / release gates

No phase should ship merely because the happy path works.

Required categories:

- schema migration + idempotency;
- membership authorization;
- capacity/race-condition tests;
- application state-machine tests;
- invite-code regression tests;
- profile/listing data-leak tests;
- blocked-user privacy tests;
- XSS/markup tests;
- rate-limit tests;
- schedule/timezone/DST tests;
- matching determinism/explainability tests;
- turn-policy consent tests;
- Campaign History qualification tests;
- listing close/reopen lifecycle tests;
- deletion/archive/tombstone behaviour;
- mobile UI checks;
- accessibility checks;
- fresh SQLite DB migration;
- copy of production-like DB migration;
- full existing DMOS test suite;
- build/typecheck;
- public Updates/changelog policy test;
- staging smoke test;
- explicit human production approval.

---

# Explicit non-goals for initial Guild Hall

Do not include in V1:

- open direct messages;
- follower/friend network;
- public wall/feed;
- public star ratings/reviews;
- paid placement/boosted listings;
- automatic party enrolment;
- AI-generated compatibility authority;
- vector/embedding matching;
- cross-product Voidsmith marketplace;
- unauthenticated player directory;
- arbitrary public contact details;
- replacing private invite codes;
- replacing SQLite;
- coupling implementation to the DMOS server migration.

---

# Definition of first useful release

The first Guild Hall release is complete when:

1. campaign membership is explicit and authoritative;
2. existing private invites still work;
3. a host can safely open a recruitment listing from an existing DMOS campaign;
4. an authenticated player can find/filter it and see a safe campaign projection;
5. the player can submit a structured application;
6. the host can review and accept/decline it;
7. acceptance creates an explicit membership **offer**, not silent access;
8. the player can accept after seeing/acknowledging the AI Turn Usage policy;
9. an active campaign membership is created without overfilling the campaign;
10. the player can proceed to create/import/assign a character and enter the campaign;
11. block/report/privacy controls exist;
12. no campaign secret/private account data leaks through Guild Hall APIs;
13. all existing DMOS tests plus the new subsystem tests pass;
14. public Updates/changelog is updated as part of release;
15. production deployment still requires explicit human approval.

That release alone turns DMOS from "invite people you already know" into a real player-to-campaign marketplace while preserving the campaign engine as the product's centre of gravity.