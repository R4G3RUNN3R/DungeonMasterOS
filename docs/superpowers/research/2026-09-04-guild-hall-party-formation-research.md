# DungeonMasterOS Guild Hall / Party Formation Research

**Date:** 4 September 2026

**Status:** Research only. No product implementation or production change is authorised by this document.

## Research question

What is the strongest way to add campaign discovery, player discovery, applications, compatibility matching and later party formation to DungeonMasterOS without duplicating the campaign runtime, weakening privacy boundaries, or creating a generic social network?

## Executive finding

DungeonMasterOS should not build a standalone LFG clone. It should add a product-owned **Guild Hall** subsystem whose job ends when a safe, explicit campaign membership begins.

The distinctive product loop is:

`discover -> compare fit -> apply -> accept -> membership -> character -> AI-turn consent -> play -> participation history -> recruit again when needed`

Competitors can help users find a table. DungeonMasterOS can own the full lifecycle because it already owns the campaign, characters, AI Dungeon Master, campaign state, achievements and multiplayer runtime.

## Current DMOS baseline verified from repository

Research was performed against `production-live-base` as the production-reference branch, with relevant feature/reference branches inspected separately.

### Existing strengths

- `campaigns` already stores ruleset, setting, tone, rules weight, power level, combat style, source preset, story mode and other structured campaign configuration suitable for a safe recruitment projection.
- Public player-profile and achievement UI/contracts already exist in the production-reference tree, while the approved profile/community design explicitly deferred LFG/player matching for later work.
- The campaign-template research branch already defines player-facing template metadata including ruleset/edition, party-size recommendations, duration, pitch, themes, tone, structure and content warnings.
- `reference/multiplayer-turn-deduction-v1` already separates AI turn-source policy from action ownership and requires explicit consent.
- The same multiplayer reference defines Campaign History through qualified participation rather than raw invites/joins.
- SQLite/better-sqlite3 with WAL remains the authoritative DMOS persistence model.

### Missing foundation

DMOS does not yet have the first-class campaign-membership model required for a public recruitment system.

Current production-reference behaviour includes:

- `/api/my-campaigns` returning campaigns owned by the authenticated account;
- campaign ownership stored on `campaigns.user_id`;
- player authority being inferred in part by scanning campaign characters for a matching user/visitor identity;
- private join by campaign invite code.

Public recruitment must not be built directly on character existence or the invite-code mechanism. Applications need to create explicit membership, and character creation/assignment must happen after membership is established.

## Competitive/product research

### Groupfinder

Current Groupfinder discovery supports system, campaign/one-shot/event type, timezone, day/time, tags such as roleplay/combat/homebrew/newbie-friendly, and applications. Its August 2026 update added a group manager after matching, timezone filtering and game applications.

Useful lessons:

- schedule/timezone filtering is core, not optional metadata;
- structured applications are better than publishing contact details;
- tags provide useful quick filtering;
- post-match tooling is valuable in generic LFG services.

DMOS should **not** copy Groupfinder's post-match organiser as a separate product area because DMOS already owns the campaign runtime.

Sources:
- https://groupfinder.gg/
- https://groupfinder.gg/list

### RoleCall

Current RoleCall heavily emphasises system + schedule + playstyle/vibe matching. It exposes sliders for tone, darkness, lethality, combat and roleplay, supports safety-tool filtering, applications, public profiles and availability. It also frames the important failure mode correctly: finding the wrong group and losing it after several sessions is more damaging than merely taking longer to find one.

Useful lessons:

- matching must consider table style, not merely ruleset;
- the score must be explainable to users;
- availability should be first-class;
- safety expectations should be visible before commitment;
- profile discoverability should be user-controlled.

DMOS should **not** copy open direct messaging or public review culture in V1. Structured applications are enough to form a campaign and have a much smaller abuse/moderation surface.

Sources:
- https://rolecall.games/
- https://rolecall.games/ttrpg-group-finder
- https://rolecall.games/features

## Regulatory/privacy research relevant to product design

Public profiles, listings, application text and other user-generated content materially increase the safety/compliance surface.

Current Ofcom guidance states that providers of in-scope user-to-user/search services must carry out a children's access assessment. If a service is likely to be accessed by children, further child-risk and protection duties apply. A terms-of-service statement alone must not be treated as proof that children cannot access the service.

Current ICO guidance requires privacy/data protection to be considered from design through the product lifecycle and says default processing/accessibility should be limited to what is necessary for the stated purpose.

Therefore a Guild Hall launch requires a documented online-safety/privacy gate before public release. This research is architectural guidance, not legal advice; scope and final obligations should be confirmed against then-current Ofcom/ICO guidance and, where appropriate, qualified counsel.

Sources:
- https://www.ofcom.org.uk/online-safety/protecting-children/protection-of-children-duties-under-the-online-safety-act
- https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/childrens-access-assessment-duties-under-the-online-safety-act
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/data-protection-by-design-and-by-default/

## Approaches considered

### A. Add public fields directly to Campaign and reuse invite codes

**Rejected.** Campaign state and recruitment state have different privacy and lifecycle requirements. A private invite secret must never become a public listing identifier.

### B. Build a separate marketplace/microservice

**Rejected for current scale.** It adds authentication, deployment, database, consistency and operational complexity while DMOS already owns every required domain object. No Redis, vector database, PostgreSQL migration or separate service is justified for V1.

### C. Put Guild Hall data in the Voidsmith central platform

**Rejected.** Product sovereignty requires DMOS to remain authoritative for DMOS campaign/member/recruitment state. The central Voidsmith platform may later consume a narrow safe projection only.

### D. Use AI/embeddings as the primary matcher

**Rejected for early versions.** The key dimensions are structured and explainable. A deterministic hard-filter + weighted compatibility engine is more testable, auditable and understandable.

### E. Build direct messages/reviews at launch

**Rejected for V1.** Neither is needed to form a party. Both enlarge harassment, moderation and privacy risk substantially.

### F. Build structured applications + explicit membership

**Recommended.** This aligns with current market behaviour while preserving DMOS's unique advantage: acceptance transitions directly into the authoritative campaign runtime.

## Recommended product architecture

### Permanent separations

Never collapse these concepts:

1. `User` vs `PublicPlayerProfile`
2. UI/personal preferences vs `PlayerMatchProfile`
3. `Campaign` vs `RecruitmentListing`
4. `CampaignApplication` vs `CampaignMembership`
5. `CampaignMembership` vs `CampaignParticipation`

### Guild Hall surfaces

- **Find Campaigns** - open DMOS recruitment listings.
- **Find Adventurers** - opt-in players looking for a group.
- **My Applications** - the applicant's application/offer history.
- **Recruitment** - host-facing listing and applicant management.

Private invite-code joining remains alongside Guild Hall and is not replaced.

## Best matchmaking model

Use two stages.

### Stage 1: hard compatibility gates

Examples:

- listing is open and has available seats;
- ruleset is accepted by the player;
- language matches a required language;
- required play mode matches;
- minimum schedule overlap exists when schedule is required;
- neither user has blocked the other;
- applicant is not already an active campaign member;
- account/listing satisfies any safety eligibility rules.

A hard miss must not be averaged away by soft preferences.

### Stage 2: transparent weighted fit

Initial recommended weight budget after hard filtering:

- schedule quality: **30**
- playstyle/vibe: **25**
- rules strictness + homebrew attitude: **10**
- campaign commitment/cadence: **10**
- tone/content preferences: **10**
- structure/agency preference: **10**
- group-size/new-player comfort: **5**

The exact values are configuration, not product truth. They should be tuned from real usage later.

The UI should show:

- compatibility percentage;
- **Strong matches**;
- **Differences**;
- **Hard conflicts** where applicable.

Never present the score as an opaque AI judgement.

## Timezone/schedule model

Store recurring availability in the user's IANA timezone, e.g. `Europe/London`, using local weekday/start/end windows.

Do not permanently convert a weekly schedule to a fixed UTC offset. DST changes would make it wrong.

For matching, expand candidate recurring windows into actual UTC occurrences over a bounded future horizon (recommended four to eight weeks), calculate repeated overlap, and either compute on demand for a bounded candidate set or cache a derived result that can be invalidated.

## Privacy model

Recommended V1 defaults:

- Guild Hall requires authentication.
- Player discoverability is opt-in.
- Match-profile fields have explicit purpose and visibility.
- Public/player/listing DTOs are allowlists assembled server-side, never raw `User`/`Campaign` serialisation.
- No email, Google account ID, billing state, subscription details, current AI-turn balance, campaign secrets, world state, hidden NPCs, inventory, private backstory or private campaign prompts leave their owning boundary.
- Blocks must remove both discovery and application paths without revealing the block relationship.

Public unauthenticated/shareable listing pages may be considered later only after moderation, privacy, SEO and online-safety gates are satisfied.

## Safety model

V1 minimum:

- block user;
- report player/listing/application content;
- withdraw application;
- host decline/remove;
- player leave;
- rate limits and length limits on user-generated text;
- HTML/Markdown/XSS sanitisation;
- audit trail for application/membership state transitions;
- no open DMs;
- no public star/review system;
- application/listing text never enters the AI Dungeon Master's prompt.

## AI boundary

AI may later help rewrite a recruitment pitch **only from a server-generated safe public campaign projection**.

Never provide raw campaign memory/world state to an LLM and ask it not to reveal spoilers. Recruitment text and applicant text are untrusted input and remain outside gameplay prompt context.

## Infrastructure conclusion

The best initial implementation is a **modular subsystem inside the existing Node/Express/SQLite application**.

No new infrastructure dependency is justified:

- keep SQLite/WAL;
- no Redis;
- no vector database;
- no PostgreSQL migration for this feature;
- no separate matchmaking service;
- no cross-product database access.

Use proper indexes, bounded candidate queries, pure scoring functions and SQLite transactions for seat/membership state changes.

## Product sequence recommendation

1. Campaign Membership foundation.
2. Campaign Participation/Campaign History selective port.
3. Guild Hall V1: listings + applications + membership offers.
4. Opt-in Player Match Profiles + Find Adventurers.
5. Deterministic transparent compatibility scoring.
6. Campaign-template-backed **Form a Party**.
7. Replacement recruitment and lifecycle automation.
8. Only after marketplace density exists: richer party-formation recommendations.

This sequence solves the authoritative data model before adding discovery, and solves discovery before spending engineering time on an algorithm that would otherwise rank an empty marketplace with tremendous confidence.