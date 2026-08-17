# Emergent Character Titles

Date: 2026-08-17
Status: Approved product design
Scope: DungeonMasterOS character/world-memory title system

## Purpose

DungeonMasterOS should allow characters to acquire titles, epithets, nicknames, aliases, and other names organically through play. Titles are not predefined rewards and do not grant character statistics, XP, feats, or mechanical bonuses. They are evidence that the campaign world has begun to remember and refer to a character in a particular way.

The system must remain deliberately opaque to players. Players should discover titles through NPC dialogue, rumours, documents, faction chatter, and later character history rather than through visible progress meters or explained thresholds.

## Core Product Rules

1. Titles are emergent, not selected from a fixed catalogue.
2. Claude may creatively propose title wording, but DungeonMasterOS owns whether the title is valid, established, and persisted.
3. A player cannot grant themselves a counted title merely by declaring one.
4. A self-declared alias can become a real title if the world independently adopts it through gameplay.
5. A title must be backed by canonical campaign evidence.
6. Titles themselves grant no XP, no feats, no statistics, and no automatic mechanical bonuses.
7. Recognition and spread are world-state facts, not player-facing progression bars.
8. The title-recognition algorithm and thresholds must not be exposed to players.
9. Update notes should describe the feature vaguely enough to preserve discovery.
10. Titles remain attached to a specific character, even when the player owns many characters across campaigns.
11. Character and account achievements may count validated titles, but the titles themselves are not achievements.
12. Self-proclaimed names, jokes, or repeatedly spammed aliases must not count toward title milestones unless independently adopted by the world.

## Example: Shadow

Hennet wears black clothing and a full-face mask, then introduces himself as "Shadow."

This does not immediately create an earned title.

DungeonMasterOS should first treat "Shadow" as a self-declared alias associated with Hennet's masked identity.

Possible progression through play:

1. Hennet tells witnesses that he is Shadow.
2. NPCs remember that the masked figure called himself Shadow.
3. NPCs begin repeating the name to other people.
4. People who were not directly told by Hennet begin referring to the masked figure as Shadow.
5. Independent usage becomes established enough that the world now genuinely knows this character identity as Shadow.
6. The canonical title/alias record is promoted to an earned title and begins counting toward title achievements.

The player must not see numeric adoption progress or the promotion threshold.

## Hidden Recognition Lifecycle

The implementation may use internal stages such as:

- self_declared
- observed
- repeated
- independently_adopted
- established
- widely_known

These names are implementation concepts, not player-facing terminology.

The exact number of witnesses, independent usages, regions, factions, or events required for promotion should remain server-side and should not be disclosed in UI or release notes.

The system should prefer evidence quality over a simplistic count. One meaningful public event may establish a name more strongly than ten trivial repetitions among the same three NPCs.

## Canonical Evidence

A validated title should be traceable to campaign state.

Relevant evidence can include:

- canonical campaign events
- NPC dialogue events
- witnessed actions
- rumours
- faction reports
- public notices
- wanted posters
- bardic stories
- official records
- repeated references by independent NPCs
- major achievements or deeds that cause an epithet to emerge

A title should retain provenance so DungeonMasterOS can explain internally why it exists, even though the player is not shown the hidden scoring logic.

## Suggested Data Model

Use existing event/entity architecture if present. Do not duplicate systems unnecessarily.

A title record should conceptually support:

- id
- campaignId
- characterId
- text/name
- normalizedName for deduplication
- titleType: alias, epithet, nickname, honorific-like flavour, infamous name, secret identity name, other
- status/lifecycle state
- originEventId
- firstKnownUseEventId
- sourceCharacterId or sourceNpcId when useful
- selfDeclared boolean
- earned boolean
- countsTowardMilestones boolean
- createdAt
- establishedAt
- retiredAt if the name falls out of use
- knownFactionIds
- knownLocationIds / regions
- knownNpcIds or knowledge references
- identityBinding describing which identity/persona the title refers to
- evidence event references
- lastObservedUseAt
- usage/support counters or confidence state

Do not force this exact schema if the repository already contains a better canonical event/knowledge architecture.

## Identity Separation

Titles must integrate with knowledge boundaries.

Example:

- The criminal underworld knows a masked thief called Shadow.
- The city watch knows Shadow is a masked suspect.
- Hennet's allies know Shadow = Hennet Uthellien.
- The city watch does not know Shadow = Hennet Uthellien.

DungeonMasterOS must not leak identity connections simply because the AI globally knows them.

This makes titles useful for secret identities, disguises, criminal aliases, ceremonial names, and faction-specific identities.

## World Adoption

The world decides whether a name sticks.

A player's self-declared alias is evidence of intent, not proof of recognition.

Independent adoption should consider factors such as:

- who heard the name
- whether those NPCs survived
- whether they had reason/opportunity to spread it
- whether subsequent NPCs learned it plausibly
- whether independent NPCs used it without being prompted by the player
- whether an associated event was memorable/public
- whether the name is being used across more than one conversation or social cluster
- whether the title refers unambiguously to this character or persona

The title engine must resist farming through repeated low-value self-introductions or scripted NPC repetition.

## Emergent Epithets

Players do not need to invent every title.

Claude may propose a new nickname or epithet when campaign events plausibly cause one to emerge.

Examples:

- The Chainbreaker
- Ghost of Redharbour
- Wyrmbane
- The Bloodless Blade
- The Black Fox

These are examples only, not a fixed list.

A proposed epithet must still pass the same canonical-evidence and world-adoption rules before becoming established.

## No Mechanical Effects

Titles are flavour and world memory only.

Titles do not directly grant:

- ability-score bonuses
- skill bonuses
- AC
- saves
- XP
- feats
- class features
- spellcasting bonuses
- discounts
- legal authority
- land
- faction rank

If DungeonMasterOS later implements offices, noble ranks, faction positions, licenses, land grants, or legal privileges, those should live in a separate authority/position system. A title may reference such an office narratively, but the title record itself is not the source of mechanical privilege.

## Character Title Milestones

Validated earned titles may feed deterministic achievements.

Example milestone policy:

- 10 earned titles on one character -> character-level title achievement
- larger future thresholds may exist, but should be configured centrally rather than scattered through UI code

Only titles with countsTowardMilestones=true count.

Self-declared-only, joke, duplicate, administrative, test, or unvalidated titles do not count.

The achievement is separate from the titles. Earning a specific title does not automatically grant an achievement.

## Account Title Milestones

Player-account achievements may aggregate earned titles across all characters owned by that account.

Example:

- 100 validated earned titles across the account -> account title achievement/reward

Account milestone rewards should be cosmetic, profile/prestige, or presentation-oriented rather than granting D&D character power.

Possible future rewards include profile badges, frames, title showcase capacity, cosmetic themes, chronicle presentation, or other non-mechanical account recognition.

The exact reward should remain configurable.

## Deduplication and Farming Protection

The system must prevent obvious title inflation.

Examples that must not generate ten counted titles:

- Shadow
- The Shadow
- Shadow!
- Dark Shadow
- Shadow of Shadows

when all refer to the same established nickname and the variations are trivial repetitions.

Likewise, one NPC being prompted by the player to repeat ten different names is not independent adoption.

Use normalization, evidence grouping, identity/persona binding, independent-source checks, and sensible server-side anti-farming rules.

## Player Experience

Do not expose:

- title-recognition score
- adoption percentage
- witness count
- required NPC count
- faction-spread threshold
- number of uses remaining until a title is earned
- exact algorithm

Do not display messages such as:

"Shadow recognition: 4/5"

or:

"One more NPC must call you Shadow."

The player should discover the system through fiction.

Possible natural discovery:

- an NPC recognizes the name
- an enemy uses it threateningly
- a rumour mentions it
- a wanted notice uses it
- an ally jokes about how widespread it has become
- it later appears in the character chronicle/history

A quiet title-history/profile entry is acceptable after the title is truly established.

Avoid intrusive gamified popups unless the broader product design later explicitly chooses them.

## Release Notes / Update Notes

Do not explain the hidden rules.

Recommended intentionally vague release-note language:

"The world now pays closer attention to how your character becomes known over time. Names, reputations and stories may take on a life of their own as your campaign unfolds."

Do not mention thresholds, independent-adoption counts, hidden stages, or account milestone formulas in public-facing update notes.

## AI Responsibilities

Claude may:

- notice possible emerging names
- generate natural title wording
- have NPCs use names when their knowledge allows it
- propose title-evidence events
- narrate rumours and reactions

Claude may not:

- directly set an earned title without validation
- mark a self-declared alias as established merely because the player said it
- expose hidden recognition logic
- award title milestone achievements directly
- bypass knowledge/identity restrictions

## Server / Rules-State Responsibilities

DungeonMasterOS should:

- persist title candidates and established titles
- retain canonical evidence
- validate independent adoption
- deduplicate trivial variants
- enforce identity boundaries
- determine when a title counts toward milestones
- aggregate per-character and per-account title counts
- award deterministic milestone achievements once
- prevent duplicate account/character milestone rewards

## Character History

Established titles should become part of a character's persistent story.

The history should allow old titles to remain recorded even if they later fall out of common use.

Possible states include current, historical, retired, disputed, or identity-specific, but avoid overbuilding UI until needed.

This is intended to let a long-lived character accumulate a meaningful personal chronicle rather than merely a list of levels and items.

## Interaction with Reputation

Titles and reputation are related but separate.

A title is a name used for the character.

Reputation is what an NPC, faction, region, or population believes about the character.

The same title may carry different sentiment in different groups.

Example:

"Chainbreaker"

- former slaves: heroic
- slavers: hated
- uninvolved nobles: concerning

Do not bake universal positive/negative sentiment into the title itself when the reaction belongs to reputation/knowledge state.

## Interaction with Achievements

Achievements are deterministic recognition of accumulated validated history.

Titles are not achievement definitions.

Examples:

- 10 established titles on one character -> achievement
- 100 established titles across one player account -> account achievement/reward

Achievement progress may be tracked internally, but public UI should avoid exposing title-recognition mechanics.

It is acceptable to show progress on the explicit milestone achievement after it exists if product design later chooses to, but that must never reveal how an individual title becomes established.

## Testing Requirements

Add tests for at least:

- self-declared alias does not immediately count as earned
- independent NPC adoption can establish a title
- repeated use by the same source does not trivially establish a title
- trivial title variants deduplicate
- title is bound to the correct character/persona
- secret identity mapping is not leaked to NPCs without knowledge
- established title counts once toward character milestones
- 10 counted titles can unlock the configured character milestone once
- account aggregation spans characters belonging to the same user
- 100 counted titles can unlock the configured account milestone once
- duplicate achievements/rewards cannot be granted
- titles confer no direct stat or XP changes
- hidden recognition state is not returned by player-facing APIs unless explicitly authorized for internal/admin tooling

## Non-Goals

This feature does not implement:

- mechanical noble ranks
- land ownership
- command authority
- faction rank bonuses
- title-based stat bonuses
- title-based XP rewards
- predefined title catalogues
- player-visible title-progress bars
- universal NPC knowledge

Those may be separate future systems where appropriate.

## Success Criteria

The system succeeds when:

1. A player can introduce an alias without instantly earning it.
2. The world can organically adopt that alias through plausible NPC information flow.
3. DungeonMasterOS can also generate new epithets organically from significant events.
4. Established titles persist with the character and are used only by NPCs who could plausibly know them.
5. Players are never shown the hidden recognition threshold or algorithm.
6. Titles remain mechanically neutral flavour.
7. Validated titles feed deterministic character and account milestone achievements.
8. Title farming through self-declaration or trivial repetition is resisted.
9. Release notes preserve the mystery rather than documenting the mechanic.
10. Long-running characters build a meaningful history of names the world actually gave them.
