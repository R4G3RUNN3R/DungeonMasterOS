# DungeonMasterOS Cross-Ruleset Character Conversion Design

**Date:** 2026-08-23  
**Status:** Design for review. No implementation is authorized by this document.  
**Design branch base:** `production-live-base` at `176456af5f79400bafe39836bbe01faebdfd4913`  
**Implementation gate:** `REVALIDATE AGAINST LATEST production-live-base BEFORE IMPLEMENTATION`

## 1. Purpose

DungeonMasterOS should let a player preserve one long-lived character identity while creating independent mechanical versions of that character for exact, isolated rulesets.

The system must support conversions such as an origin D&D 3.5e character becoming a D&D 5e 2014, D&D 5e 2024, Vampire V20, Vampire V5, Pathfinder, or future-system version without mutating the origin or pretending incompatible rules are interchangeable.

The conversion framework must be conservative where certainty exists, explicit where uncertainty exists, and non-destructive everywhere.

This design combines the strongest ideas found in official conversion guidance, mature VTT architecture, community conversion practice, and DungeonMasterOS's existing canonical rules work:

- preserve character concept and feel rather than raw numbers when systems differ materially;
- use deterministic pair-specific mappings where systems are close enough to support them;
- isolate every exact ruleset and edition mechanically;
- preserve old versions instead of silently upgrading or overwriting them;
- present unresolved conversion choices instead of guessing invisibly;
- convert unmatched value by relative significance rather than literal currency exchange;
- keep the Dungeon Master or Storyteller authoritative over mechanical imports into an active multiplayer campaign;
- preserve provenance so every converted result can explain where it came from and how it was produced.

## 2. Non-goals

The framework is not a universal mathematical formula that claims all RPG systems are equivalent.

It is not permission for AI to invent mechanics and label them canonical.

It is not a currency exchange between fictional economies.

It is not a way to merge two rulesets inside one character sheet.

It is not an automatic migration that rewrites existing characters when a new edition is released.

It is not ready to implement until every participating ruleset has a stable mechanical identity, canonical data model, item/ability library, and destination rules adapter.

## 3. Research-derived principles

### 3.1 Wizards: preserve feel, use destination-native equivalents, retain DM authority

Wizards' official *Conversions to 5th Edition D&D* states that conversion is more art than science and should aim for something that feels like the earlier-edition version rather than exact replication. It tells players to choose the closest destination race/class, use similar existing spells before creating a new one, swap equipment for fifth-edition equivalents, and leave final conversion authority with the DM.

DungeonMasterOS should therefore translate **meaning into destination-native mechanics**, not transport raw source modifiers into an incompatible system.

Source: https://media.wizards.com/2016/downloads/DND/DnD-Conversions.pdf

### 3.2 Paizo: pair-specific rules where systems are close

Paizo's 3.5-to-Pathfinder conversion guide provides explicit conversion procedures for characters, feats, spells, prestige classes, monsters, and magic items. This is strong evidence that related systems benefit from versioned deterministic pair profiles rather than generic AI interpretation.

Source: https://paizo.com/products/btpy89m6?Pathfinder-Roleplaying-Game-Conversion-Guide=

### 3.3 D&D Beyond: preserve legacy character mechanics instead of silently replacing them

D&D Beyond reversed its original 2024 transition approach after user feedback and preserved 2014 character options, spells, and magic items. Its current model differentiates 2014 and 2024 content rather than silently rewriting established characters.

DungeonMasterOS should follow the stronger principle: **a conversion creates another version; it never mutates the source version.**

Sources:
- https://www.dndbeyond.com/posts/1806-2024-d-d-beyond-ruleset-changelog-update
- https://www.dndbeyond.com/changelog

### 3.4 Foundry VTT: systems own their data models

Foundry lets each game system define its own Actor and Item data models, and compendium content can explicitly require a system. Owned Items are actor-specific instances derived from item data rather than an assumption that every system shares one item schema.

DungeonMasterOS should similarly keep exact ruleset mechanics isolated, with a translation layer connecting them rather than a shared cross-system mechanical table.

Sources:
- https://foundryvtt.com/article/system-development/
- https://foundryvtt.com/article/system-data-models/
- https://foundryvtt.com/article/items/

### 3.5 Vampire community practice: preserve demonstrated concept and cash out what cannot translate

V20-to-V5 discussions commonly recommend preserving what the character has actually demonstrated in play and translating vanished traits into destination-appropriate traits rather than keeping the same dots. One Onyx Path proposal explicitly converts otherwise untranslatable traits into Freebie Points for re-spending.

This supports DungeonMasterOS's Conversion Credit model, but DungeonMasterOS must make that credit safer by locking it to one destination ruleset and one character version.

Sources:
- https://forum.theonyxpath.com/forum/main-category/main-forum/the-classic-world-of-darkness/vampire-the-masquerade/1248399-converting-v20-attribues-and-abilities-to-v5
- https://www.reddit.com/r/vtm/comments/1ah6cw5
- https://www.reddit.com/r/vtm/comments/1v91u1t/v5_v20_character_conversion/

### 3.6 Free5e: explicit mapping plus a human-review lane

Free5e publishes cross-system mapping guidance and its 2026 character converter exposes unresolved rows for review instead of making hidden guesses. It treats missing spells/features by substitution or review and explicitly separates clean matches from items requiring a human decision.

DungeonMasterOS should similarly produce a conversion preview with explicit resolution states before committing a new character version.

Sources:
- https://wyrmworkspublishing.com/wiki_cats/characters-codex/?print=print-search
- https://wyrmworkspublishing.com/dd-beyond-character-converter-for-free5e/

## 4. Architectural laws

The following are hard design rules.

1. **Exact ruleset identity.** A ruleset ID represents one exact mechanical ruleset/edition, never only a franchise name. D&D 5e 2014 and D&D 5e 2024 must be distinct. Vampire V20 and Vampire V5 must be distinct. Current repository IDs are not assumed to be final.
2. **No ruleset mixing.** Source-system mechanics do not become active in a destination ruleset merely because a field name looks similar.
3. **Origin immutability.** Full conversion never mutates the source Origin Version.
4. **Origin-only full conversion.** Only the Origin Version can create a new full ruleset version. A converted version cannot be used as the source of another full conversion.
5. **Persistent identity, independent mechanics.** Character identity and possession history persist above ruleset-specific mechanical expressions.
6. **Deterministic before AI.** Exact canonical mappings and approved translation rules always precede AI fallback.
7. **AI cannot counterfeit canon.** AI-generated mechanics must be marked generated/homebrew/adaptive, never canonical.
8. **Player controls uncertainty.** Unmatched content is shown and the player chooses how to resolve it.
9. **No silent loss.** The engine never silently drops an item, power, feature, or other tracked element during conversion.
10. **Campaign authority.** Cross-version mechanical gains introduced into an active multiplayer origin campaign require that campaign DM/ST's approval.
11. **Auditable conversion.** Every result records source, destination, profile version, resolution method, confidence, and provenance.
12. **No cross-system value arbitrage.** Conversion Credit is permanently destination-scoped and cannot become a universal exchange currency.

## 5. Current repository fit and required revalidation

At the design base commit, DungeonMasterOS already has several useful foundations:

- `shared/rules-registry/canonical-id.ts` creates ruleset-namespaced canonical IDs.
- `server/compendium.ts` stores item definitions with both `ruleset` and `edition` metadata and already distinguishes 2014/2024 source material, though both currently use the broad `dnd5e` ruleset value.
- `shared/schema.ts` stores character-owned item instances separately from canonical item definitions.
- `shared/schema.ts` has a real character currency wallet and a structured shop system.
- the canonical rules project already distinguishes source provenance, source enablement, and revision concepts.

The current character model is still campaign-bound and does not yet separate a global Character Identity from a ruleset-specific Character Version. The current item instance model also lacks cross-version possession identity and conversion provenance. These must be designed against the final post-ruleset architecture, not patched blindly into today's schema.

The implementation agent must therefore begin with a **mandatory revalidation audit** of final ruleset IDs, schemas, canonical entity families, item libraries, shop interfaces, source registry, permissions, multiplayer synchronization, and AI contracts.

## 6. Character lineage model

### 6.1 Character Identity

A Character Identity is the persistent concept of the person across rulesets. It owns information that is genuinely ruleset-neutral, such as:

- stable identity ID;
- owner user ID;
- canonical display name and aliases;
- portrait/appearance references where appropriate;
- overarching narrative history/provenance;
- origin version ID;
- creation timestamp;
- account/profile linkage.

It must not contain mechanical fields such as AC, Blood Potency, proficiency bonus, BAB, Hunger, saving throw formulas, spell slots, or system-specific equipment statistics.

### 6.2 Origin Version

Exactly one version is the Origin Version. It is the mechanical character that originally created the identity.

The Origin Version:

- has one exact ruleset ID;
- may continue normal play forever;
- is never overwritten by conversions;
- is the only version permitted to initiate full conversion to another ruleset;
- can be snapshotted at conversion time so the generated version has a reproducible source state.

### 6.3 Converted Versions

Each conversion creates a new independent Character Version linked directly to the Origin Version.

A converted version:

- has one exact destination ruleset;
- records the immutable source snapshot used for conversion;
- has its own stats, powers, inventory, currency/resources, advancement, campaign memberships, and future gameplay history;
- can level, gain/lose gear, earn achievements, and otherwise live normally;
- cannot become the source of another full ruleset conversion.

This creates a hub-and-spoke lineage, never a conversion chain.

## 7. Conversion readiness registry

Every exact ruleset must expose a machine-readable **Conversion Readiness Contract** before it participates in conversion.

The contract should report, at minimum:

- stable ruleset ID and schema version;
- canonical entity families supported;
- canonical item/feature/spell/power coverage state;
- destination creation/validation adapter availability;
- destination economic/value adapter availability;
- AI-context serializer availability;
- deterministic mechanics readiness;
- legal/provenance scope of available canonical content;
- conversion support status for each source/destination pair.

Suggested pair statuses:

- `supported`: reviewed deterministic/semantic profile exists and acceptance fixtures pass;
- `partial`: meaningful profile exists but known gaps remain;
- `experimental`: limited mapping and AI fallback expected;
- `unsupported`: no approved pair profile exists; best-effort conversion may still be requested with explicit warning.

Unsupported must not mean unavailable. It means **the player is warned and must opt in knowingly**.

## 8. Universal Semantic Layer

DungeonMasterOS should not create direct pairwise mappings for every individual entity in every possible pair, nor should it pretend one universal numerical formula can understand all RPGs.

Use a hybrid model.

Each source entity can expose a ruleset-neutral semantic projection describing what it *means*, while exact mechanics remain in its owning ruleset.

For items, semantic dimensions may include:

- entity family: weapon, armor, tool, consumable, vehicle, property, companion, relic, etc.;
- physical form and broad use;
- mundane/supernatural/technological nature;
- offensive/defensive/utility/social/mobility role;
- damage/effect themes such as fire, poison, mind control, healing, concealment;
- power significance band;
- economic significance band;
- scarcity/availability;
- narrative importance;
- sentience/uniqueness/artifact status;
- consumability/charges/durability concepts;
- prerequisites or ownership restrictions;
- tags suitable for semantic retrieval.

The semantic layer must never be the authoritative mechanics engine. It is a bridge used to find or construct a destination expression.

## 9. Versioned translation profiles

Every researched source/destination pair may have a versioned Translation Profile.

A profile contains explicit rules for categories that can be reliably mapped and documented fallback behavior for categories that cannot.

Typical mapping kinds:

- `exact`: same canonical concept exists in destination;
- `renamed`: destination has the same concept under another name;
- `mechanical_equivalent`: different canonical entity expresses the same mechanical role;
- `authentic`: destination-native expression preserves the original purpose/feel rather than exact numbers;
- `adaptive`: closest defensible destination concept after semantic comparison;
- `native`: deliberately retain source mechanics because the object is explicitly multiversal/native;
- `unresolved`: no safe result is available yet.

Translation profiles are data and policy, not undocumented prompt prose. They must be reviewable, versioned, testable, and attributable to source research.

Profile evolution must never silently rewrite existing converted versions. A later profile version can offer the player a new conversion from the Origin or a review of previously unresolved elements.

## 10. Conversion staging and source snapshot

Full conversion must be a staged transaction.

1. Resolve the player's Character Identity and verify the selected source is the Origin Version.
2. Create an immutable conversion-source snapshot containing the state required for reproducibility.
3. Resolve the exact destination ruleset and pair support level.
4. If support is partial/experimental/unsupported, show the warning before expensive AI work.
5. Convert deterministic categories.
6. Classify every source element by resolution state.
7. Present unresolved/high-risk elements and player choices.
8. Resolve chosen AI or Conversion Credit paths.
9. Validate the entire proposed destination character against the destination ruleset adapter.
10. Show a conversion review/receipt.
11. Only after explicit confirmation, atomically create the new Character Version and its associated state.

A failure at any step before commit leaves the Origin untouched and creates no half-converted playable version.

## 11. Per-element resolution state machine

Every convertible element should end in an explicit state. Recommended states:

- `exact_canonical_match`
- `approved_profile_match`
- `semantic_canonical_match`
- `ai_canonical_match`
- `generated_homebrew_equivalent`
- `native_multiversal`
- `converted_to_credit`
- `kept_unresolved`
- `not_applicable_in_destination`
- `conversion_failed`

Each record should store:

- source canonical/instance reference;
- source ruleset and source snapshot;
- destination ruleset;
- destination canonical/instance reference if any;
- translation profile ID/version;
- resolution method;
- confidence band or score where relevant;
- deterministic rationale codes;
- AI rationale summary where AI was used;
- user choice and timestamp;
- canonical vs generated classification;
- provenance/attribution/licensing metadata where required.

## 12. Item conversion: identity versus expression

The core item rule is:

> The possession's identity/history is preserved; the destination version receives a destination-ruleset expression of that possession.

An item such as a named +4 flaming weapon can retain its name, appearance, acquisition story, owner history, creator, repairs, narrative significance, and other identity metadata even though its 3.5e numerical mechanics are replaced by valid destination mechanics.

A normal translated item should therefore have:

- a persistent possession lineage/root reference;
- source item instance reference;
- destination item instance reference;
- destination canonical definition when matched;
- preserved narrative identity fields;
- destination-only mechanical expression;
- conversion provenance.

The system must not copy source-system modifiers into destination mechanics simply to preserve numbers.

## 13. Native/multiversal artifacts

A deliberately special item may declare a conversion policy equivalent to `native` rather than `semantic`.

Native/multiversal items are exceptions, not fallback mistakes. Their alien mechanics or special cross-world behavior are part of the fiction.

Requirements:

- explicit item-level authorization/policy;
- clear UI marker that the item is operating outside normal destination conversion rules;
- destination safety adapter so the foreign mechanic cannot bypass state integrity, permissions, inventory ownership, billing, or multiplayer synchronization;
- DM/ST authority where the campaign requires approval;
- complete provenance.

A failed semantic conversion must never silently become `native` merely to avoid reporting a problem.

## 14. Deterministic item matching order

For each source item:

1. **Exact canonical match.** Use verified ruleset-specific mapping.
2. **Approved profile match.** Use reviewed renamed/mechanical/authentic mapping.
3. **Semantic canonical search.** Search destination canonical entities using semantic role, power band, rarity/significance, prerequisites, and tags.
4. **AI canonical selection.** If still unresolved and the player has opted into high-risk assistance, AI may rank/select among real destination canonical candidates.
5. **Generated homebrew equivalent.** Only after explicit player choice where no acceptable canonical match exists, and always clearly labelled generated/homebrew.
6. **Conversion Credit.** Player can liquidate unmatched eligible value into destination-scoped credit.
7. **Keep unresolved.** Preserve the possession record without active destination mechanics for later review.

The AI is never allowed to invent destination statistics and call the result an official/canonical item.

## 15. Mandatory unmatched-item player choice

If one or more items are unresolved after deterministic conversion, DungeonMasterOS must stop and present the player with the list before final commit.

The UX must clearly say that reliable equivalents were not found in the new system and show every affected item.

The player must receive at least these choices:

1. **Find/create closest equivalents with DungeonMasterOS AI.** High-risk path. AI first searches destination canonical content and may only create a generated/homebrew equivalent if the player explicitly authorizes that outcome.
2. **Convert eligible items to Conversion Credit.** The system evaluates relative significance and grants destination-scoped purchasing credit usable in the conversion shop.
3. **Keep unresolved.** Preserve the possession on the converted version without active mechanics for later resolution.

The original Origin Version and its inventory remain unchanged regardless of choice.

## 16. Universal Conversion Value Profile

Literal currency exchange is forbidden as the primary cross-system valuation method.

Each convertible possession may have a Universal Conversion Value Profile derived from destination-neutral significance dimensions, for example:

- economic significance tier;
- mechanical/power significance tier;
- scarcity;
- availability/restriction;
- narrative importance;
- liquidity;
- unique/artifact/story-critical flags;
- consumable/durable nature.

The destination ruleset's Value Adapter interprets those dimensions into that system's purchase model.

This lets a jeweled necklace and a supernatural weapon have different semantic value profiles even if a source book happens to list similar prices.

Unique, artifact, sentient, or story-critical items cannot be bulk-liquidated automatically. They require individual confirmation.

## 17. Conversion Credit

Conversion Credit is a dedicated ledger/resource, **not campaign currency and not account credit**.

A credit grant must be bound to:

- user/owner authorization;
- one Character Identity;
- one destination Character Version;
- one exact destination ruleset;
- one conversion event/source snapshot;
- reason and source item references;
- immutable audit entries.

Hard restrictions:

- non-transferable;
- not withdrawable;
- not account-wide;
- not spendable by another character or another version;
- not convertible into another ruleset's Conversion Credit;
- not accepted by ordinary cross-system transaction paths;
- never tied to subscription/billing credit;
- persists indefinitely until spent or explicitly reversed by an audited rollback.

The ledger should be append-only or equivalently auditable, with balance derived from grants/spends/reversals rather than an unaudited mutable number.

## 18. Conversion Shop / AI Shop

A converted character with Conversion Credit can use a destination-specific DungeonMasterOS conversion shop.

The shop should:

- only expose items valid for the character version's exact destination ruleset and enabled sources;
- price items using the destination Value Adapter, not a cross-system cash rate;
- permit AI-assisted recommendations based on what was surrendered, while keeping purchase math deterministic;
- spend Conversion Credit only, unless a separate explicit ordinary-shop transaction is invoked;
- create normal destination item instances once purchased;
- preserve the conversion acquisition provenance on purchased items;
- show remaining Conversion Credit indefinitely.

No route may allow a purchased conversion item to generate credit in another ruleset because converted versions cannot source another full conversion.

## 19. AI responsibilities and hard boundaries

AI is useful for semantic judgment but must not own authoritative state transitions.

AI may:

- compare narrative function and semantic tags;
- rank canonical destination candidates;
- explain why one candidate is closer than another;
- propose a clearly labelled generated/homebrew equivalent;
- suggest destination-shop purchases;
- summarize trade-offs for player/DM review.

AI may not:

- mutate inventory directly;
- mint Conversion Credit;
- decide that a generated item is canonical;
- bypass destination validation;
- select disabled/unlicensed/unavailable source content as if available;
- approve its own high-risk conversion on behalf of the player or DM;
- overwrite the Origin Version;
- create another full conversion from a converted version;
- override server-side ownership, campaign authority, or permissions.

Structured AI outputs must be validated against strict schemas and then resolved to server-owned canonical IDs before any state change.

## 20. Cross-Version Reintegration

Converted versions cannot initiate another full conversion, but eligible gains acquired during play on a converted version may be selectively **reintegrated** into the Origin Version.

Examples include a newly acquired item, spell, power, feat, supernatural gift, title with mechanics, permanent bonus, companion, or other tracked gain.

Reintegration is not a reverse character conversion. It translates one acquired concept back into the Origin ruleset.

Resolution order:

1. exact Origin-ruleset canonical equivalent;
2. approved translation-profile equivalent;
3. semantic canonical equivalent;
4. AI-assisted candidate with explicit risk labelling;
5. generated/homebrew proposal only where authorized;
6. unresolved if no defensible equivalent exists.

Source mechanics never become active directly in the Origin ruleset.

The reintegration record must prevent the same acquisition from being imported repeatedly.

## 21. DM/ST approval for active multiplayer campaigns

If the Origin Version is currently part of an active multiplayer campaign, a mechanically meaningful reintegration is pending until that campaign's DM/ST approves it.

The approval view should show:

- player/character;
- source converted version and ruleset;
- original acquired element;
- proposed Origin-ruleset equivalent;
- canonical/generated status;
- mapping type;
- profile version;
- confidence/risk;
- mechanical effects that will become active;
- provenance.

Approval is **campaign-specific**. A gain approved in Campaign A does not force Campaign B's DM to accept it. Previous approvals may be shown as context, but each active multiplayer campaign retains authority over imported mechanics.

Declining does not erase the gain from the converted version or from provenance history. It records a campaign-specific rejection.

Purely narrative continuity may cross versions without this mechanical approval unless it creates mechanical authority, assets, followers, resources, bonuses, or other gameplay effects.

## 22. Permissions and ownership

Server-side authorization must verify all of the following:

- requester owns or is authorized to manage the Character Identity;
- selected full-conversion source is the Origin Version;
- requester can access the destination ruleset/content sources required;
- requester owns the source item/gain being resolved;
- only authorized campaign DM/ST accounts can approve reintegration for that campaign;
- conversion credit can only be spent by the bound character version;
- no client-supplied balance, canonical ID, profile ID, or confidence result is trusted without server verification.

Campaign Owner and Character Owner remain distinct roles.

## 23. Atomicity, retries, and rollback

Full conversion commit must be transactional.

The database should not expose a playable destination version until all required records are valid and committed together: character version, inventory expressions, credit ledger grants, conversion event, per-element decisions, provenance, and any required source snapshot reference.

Retry behavior must distinguish:

- retrying the same conversion event after a technical failure, which should be idempotent;
- intentionally creating a new destination version from the Origin at a later date/profile revision, which is a new conversion event.

Rollback tools should reverse only the destination conversion event and never touch the Origin Version.

## 24. Conversion receipt and observability

Every conversion should produce a human-readable and machine-readable receipt.

The receipt should summarize:

- source Origin Version/snapshot;
- destination ruleset;
- support status;
- translation profile/version;
- exact mappings;
- semantic mappings;
- AI-selected mappings;
- generated/homebrew equivalents;
- native multiversal elements;
- unresolved elements;
- items converted to credit;
- credit grants and spends;
- warnings accepted by the player;
- final destination validation result.

Operational metrics should track pair-level failure rates, unresolved rates, AI fallback rates, rejection rates, and profile-version regressions without exposing private narrative content unnecessarily.

## 25. Legal and source boundaries

Translation profiles must distinguish canonical/open content from closed-source material and homebrew.

DungeonMasterOS must not scrape, reproduce, or treat paid/closed rulebook text as reusable canonical corpus merely because a converter would benefit from it.

Mappings may identify that a concept exists where legally permissible, but stored descriptions/mechanics must come from sources the platform is authorized to use or from original/generated content with correct labelling.

Every canonical destination candidate remains subject to the destination campaign's source-enablement policy.

## 26. Acceptance test strategy

The eventual implementation plan must include automated coverage for at least the following invariants:

- exact ruleset IDs never cross-contaminate mechanics;
- 2014 and 2024 D&D remain distinct;
- V20 and V5 remain distinct;
- current/future ruleset wrappers cannot accidentally resolve as mechanical editions;
- Origin Version is immutable during full conversion;
- converted versions cannot source another full conversion;
- conversion snapshot is reproducible;
- canonical mappings resolve to real destination canonical IDs;
- item identity/provenance survives while mechanics change;
- AI cannot label generated content as canonical;
- unsupported/experimental conversion cannot proceed without explicit warning acknowledgement;
- every unresolved item is surfaced to the player;
- Conversion Credit uses significance/value adapters rather than literal cross-system exchange;
- Conversion Credit cannot transfer, cash out, cross rulesets, or affect billing/account credit;
- Conversion Credit persists across sessions until spent;
- unique/artifact/story-critical liquidation requires individual confirmation;
- shop purchases are exact-ruleset scoped and server-authoritative;
- reintegration cannot duplicate one acquired gain;
- multiplayer mechanical reintegration requires the target campaign DM/ST's approval;
- campaign-specific approval does not leak to another campaign;
- declined reintegration does not destroy source-version gains;
- transactional failures leave no half-created version or partial credit grant;
- retries are idempotent;
- WebSocket/multiplayer clients receive coherent post-commit state;
- legacy characters migrate without loss;
- source enablement and licensing restrictions are honored;
- AI/schema failures fail safely without narrating a state change that never committed.

In addition, every supported pair profile should have a curated fixture corpus containing mundane items, magic/supernatural items, edge-case abilities, currencies/resources, unique artifacts, consumables, and intentionally unmatched cases.

## 27. Rollout model

The converter framework can exist globally while pair profiles are activated one by one.

Recommended readiness ladder for each pair:

1. research registry complete;
2. exact-ruleset canonical libraries verified;
3. deterministic mappings implemented;
4. semantic/value adapters implemented;
5. fixture corpus passes;
6. internal dry-run only;
7. experimental player opt-in with explicit warning;
8. telemetry/manual review of failures;
9. supported status after acceptance thresholds and human review are met.

No pair gains `supported` status merely because AI can produce plausible prose.

## 28. Mandatory pre-implementation gate

This design intentionally precedes the final implementation of all target rulesets.

Before any agent writes conversion production code it must:

1. fetch the latest `production-live-base`;
2. record the exact starting SHA;
3. inspect the final exact ruleset registry;
4. verify that D&D generations, Vampire generations, and any other target editions are represented by distinct mechanical IDs;
5. inspect final character, inventory, item-definition, spell/power/feature, currency/resource, shop, source-registry, AI, auth, and WebSocket schemas;
6. inspect all migrations completed since this design was written;
7. produce a revalidation matrix showing which assumptions in this document still hold;
8. stop and revise the implementation plan if any final ruleset architecture conflicts with the design;
9. only then begin implementation.

The implementation plan must use the **actual final IDs and interfaces discovered at that time**. Example names such as `dnd5e2014`, `dnd5e2024`, `vampire-v20`, and `vampire-v5` express the isolation requirement but are not permission to rename current production prematurely.

## 29. Recommended implementation decomposition after revalidation

The implementation should be split into independently reviewable phases:

- **Phase 0: Final architecture revalidation and migration design.** Audit post-ruleset repository state and freeze exact contracts.
- **Phase 1: Character Identity / Version foundation.** Introduce non-destructive lineage and migrate legacy characters safely.
- **Phase 2: Conversion registry and readiness contracts.** Exact pair support state, profile versioning, source research registry.
- **Phase 3: Universal semantic projections and value profiles.** Ruleset-neutral meaning without leaking mechanics.
- **Phase 4: Deterministic conversion engine and dry-run preview.** Exact/profile mappings, staging, receipts, atomic commit.
- **Phase 5: Item identity/expression conversion and native artifact policy.** Persistent possession lineage and destination mechanics.
- **Phase 6: AI semantic fallback.** Structured candidate ranking, confidence, canonical resolution, generated/homebrew boundary.
- **Phase 7: Conversion Credit ledger and destination Value Adapters.** Permanent version-scoped credit with anti-abuse guards.
- **Phase 8: Conversion AI Shop.** Destination-only purchases and recommendation flow.
- **Phase 9: Cross-Version Reintegration and campaign DM/ST approvals.** Selective gain return to Origin with deduplication and authority.
- **Phase 10: Multiplayer/UI/admin/observability hardening.** WebSocket coherence, receipts, support diagnostics, rollback tools.
- **Phase 11: Pair-profile rollout.** Research, fixture corpus, experimental activation, verification, then supported status pair by pair.

The later implementation plan should break these phases into exact files, migrations, contracts, tests, commands, and verification gates after inspecting the final repository.

## 30. Final design summary

DungeonMasterOS should model cross-ruleset conversion as **persistent identity with isolated mechanical versions**, not sheet mutation.

The Origin Version remains the sole source of full conversions. Each destination version is an independent branch. Exact canonical mappings and pair-specific translation profiles run first; a Universal Semantic Layer supports comparisons where systems differ; AI is a visible fallback, not an invisible authority. Unmatched possessions are never silently lost. The player chooses AI-assisted replacement, destination-scoped Conversion Credit, or unresolved preservation. Conversion Credit persists but is permanently locked to one destination character version and ruleset. Converted-version gains may return selectively to the Origin through Cross-Version Reintegration, with campaign-specific DM/ST approval when mechanics enter an active multiplayer campaign.

This framework intentionally borrows the proven parts of existing conversion practice while adding the pieces those tools generally do not combine: persistent version lineage, auditable item identity, strict ruleset isolation, AI fallback with canonical safeguards, scoped conversion value, shop resolution, and governed reintegration.
