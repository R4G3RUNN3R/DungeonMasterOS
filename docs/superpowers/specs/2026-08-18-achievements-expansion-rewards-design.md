# DungeonMasterOS Achievement Expansion, Mastery, and Turn Rewards

Date: 2026-08-18
Status: Approved product direction, implementation pending
Scope: Account achievements, category mastery, multiplayer/fellowship achievements, achievement score, turn rewards, anti-farming, and implementation rules

## Purpose

DungeonMasterOS should have a deep account-wide achievement system that rewards long-term, meaningful play without turning free AI turns into an easily farmed currency faucet.

The design should feel closer to a mature MMO achievement ecosystem than a checklist of onboarding tasks. Individual achievements recognise interesting play. Series and category progress recognise sustained behaviour. Achievement Score recognises the history of the account. Category Mastery and Grand Mastery provide the largest free-turn rewards.

The intended hierarchy is:

**Achievement -> category progress gates -> Category Mastery -> Grand Mastery**

Achievement Score runs alongside that hierarchy as an account-wide prestige track.

## Important Repository Baseline

At the time this document was written, `shared/achievements.ts` on `main` contains 31 achievement definitions across `character`, `combat`, `social`, `exploration`, `meta`, and `secret`.

Product discussion indicates that 34 achievements may already exist in the current/live product state. Implementation MUST re-audit the branch it is actually changing before modifying the catalogue. Preserve any newer achievements that are not present in the 31-entry snapshot. Do not delete or rename unknown existing achievement IDs merely to make counts match this document.

Existing achievement IDs must remain stable so already-earned achievements are never invalidated.

## Player-Facing Categories

Use these player-facing categories:

1. Character
2. Combat
3. Roleplay
4. Exploration
5. Fellowship
6. Chronicle
7. Secrets

Recommended internal migration:

- existing `social` becomes player-facing `Roleplay`
- existing `meta` becomes player-facing `Chronicle`
- add `fellowship`
- existing `secret` becomes player-facing `Secrets`

Existing achievement IDs remain unchanged. If category names are persisted anywhere, migrate safely rather than invalidating records.

## Why Fellowship Is Separate

Roleplay describes interaction with the fictional world and NPCs.

Fellowship describes cooperative play between authenticated human players. DungeonMasterOS supports campaigns from one to six players, so cooperative play deserves its own prestige track rather than being buried inside Roleplay.

## Reward Economy

### Core rule

Most individual achievements award **Achievement Points, not turns**.

Turns are concentrated at difficult, one-time account gates. This makes achievements rewarding without encouraging players to manufacture trivial actions purely to mint AI usage.

### Direct-turn exceptions

A very small number of clearly long-term achievements may award turns directly. These are explicitly listed in the catalogue below.

### Category gates

Each category has a frozen **Founding Core Set v1** of 12 achievements.

Do NOT define category completion dynamically as `all achievements currently in the category`. Adding achievements later must never cause a player to lose completion.

For each non-secret category:

- **Gate I - Initiate:** unlock 4 of the 12 Founding Core achievements -> **+20 bonus turns**
- **Gate II - Veteran:** unlock 8 of the 12 Founding Core achievements -> **+40 bonus turns**
- **Category Mastery:** unlock all 12 Founding Core achievements -> **+100 bonus turns**, category mastery achievement, title/badge

For Secrets:

- intermediate progress remains hidden
- no visible Gate I/Gate II progress
- **Keeper of Secrets:** complete the frozen 12-achievement Secret Founding Core Set -> **+150 bonus turns** and a hidden mastery badge/frame

Later content should create `Core Set v2`, `Chronicle II`, or similarly versioned metas rather than changing v1 requirements.

### Grand mastery

DungeonMasterOS supports both solo and multiplayer play. The main grand reward should not force every solo player into Fellowship, and it should not force every normal player to hunt every Secret.

Recommended grand metas:

- **Legend of DungeonMasterOS:** complete any **6 of the 7** Category Masteries -> **+300 bonus turns** + unique title/profile crest
- **Absolute Completionist:** complete **all 7** Category Masteries -> **+200 additional bonus turns** + unique animated frame/crest

This preserves an ultimate all-category reward while keeping the main grand track accessible to dedicated solo players.

### Achievement Score gates

Achievement Points are account-wide cosmetic/prestige XP. Recommended lifetime thresholds:

- 1,000 points -> cosmetic account title/badge only
- 2,500 points -> **+25 bonus turns**
- 5,000 points -> **+50 bonus turns**
- 10,000 points -> **+100 bonus turns**
- 20,000 points -> **+150 bonus turns** (future-facing; v1 may not make this immediately reachable)

Score rewards are one-time, account-wide, and idempotent.

### Lifetime budget rationale

The current product sells turns in packs and monthly plans range from relatively small allowances to thousands of turns. A 100-turn reward is therefore meaningful and should represent real persistence, not a few minutes of manufactured activity.

The v1 gate structure deliberately places the majority of free-turn value behind months of genuine play rather than individual easily-scripted events.

## Turn Reward Delivery

Achievement rewards must use the existing persistent `bonusTurns` balance.

Rules:

1. Achievement rewards add to `bonusTurns`.
2. They do not increase the monthly plan allowance.
3. They do not reduce or manipulate `aiTurnsUsedThisMonth`.
4. Bonus turns remain until consumed under the existing turn-consumption rules.
5. Every turn-grant event must have an immutable/idempotent reward record so retries, reconnects, duplicate events, deploys, or backfills cannot pay twice.
6. Achievement unlock and reward grant should occur transactionally where the storage layer permits it.

## Achievement Classification

Each catalogue entry can be one of:

- **Core** - eligible for the category's Founding Core v1 progression
- **Bonus** - awards points and prestige but does not block Category Mastery
- **Hidden** - not shown until earned; may also be Core or Bonus internally
- **Legendary Milestone** - a rare achievement permitted to grant turns directly

Feature-plan-specific achievements should normally be Bonus so Category Mastery is not paywalled.

## Shared Validation Vocabulary

These terms are used throughout the catalogue.

### Legitimate level-up

A positive level transition produced by canonical gameplay progression. Manual edits, admin tools, imports, test fixtures, rollback/replay loops, level-down/level-up loops, or delete/recreate loops do not count.

Imported characters establish a baseline. Only progression earned after the baseline can count.

### Qualifying session

Use a server-authoritative activity session, configurable rather than hard-coded across UI code.

Initial recommended policy:

- session closes after 90 minutes of campaign inactivity
- minimum 8 successful DM responses in the activity window
- minimum 10 minutes between first and last counted action
- test/admin campaigns do not count
- replayed/restored messages do not create new session credit

For multiplayer session credit:

- at least two distinct authenticated user accounts must participate
- each counted player must contribute at least 2 meaningful player actions
- the campaign must produce at least 8 successful DM responses in the session
- same-IP users are allowed; households and in-person tables must not be punished
- suspicious account/device patterns may be risk-scored, but IP address alone must never invalidate a legitimate group

### Meaningful encounter

A combat/conflict with a persistent encounter identity or canonical evidence that it was a real threat. Trivial repeated rats, one-line fabricated enemies, replayed encounters, test fixtures, or duplicate event processing must not increment combat milestones.

When the ruleset supports threat/CR/level comparison, use it. In freeform/anime/homebrew worlds, use canonical encounter state plus server-side significance rules. The LLM may propose significance evidence, but the LLM alone must never grant an economically valuable reward.

### Major encounter

A meaningful encounter flagged as boss, named antagonist, major set piece, story-critical combat, or equivalent high-significance conflict.

### Unique location

A canonical location/entity ID, not raw text. Renaming the same room does not create a new location.

### Meaningful recurring NPC

A canonical NPC with repeated campaign presence and relationship/history state. Throwaway generated names do not count.

### Established title

A title validated by the Emergent Character Titles system. Self-declared-only aliases, duplicates, joke names, and unvalidated titles do not count.

### Core multiplayer group

A stable set of authenticated users. For long-running group achievements, at least the required minimum players must appear in 80% or more of the qualifying sessions used for that achievement.

## Catalogue

Points below are proposed account Achievement Points. `Turns` is a direct achievement payout. Most entries deliberately pay 0 direct turns because category and score gates carry the economic rewards.

---

# Character

### Founding Core v1 recommendation

`iron_body`, `peak_strength`, `jack_of_all`, `scholar_of_magic`, `growing_pains`, `veteran_soul`, `ascendant`, `old_campaigner`, `living_legend`, `polymath`, `walking_arsenal`, `prepared_for_anything`

| ID | Achievement | Player-facing requirement | Internal validation / accomplishment terms | Points | Turns | Class |
|---|---|---|---|---:|---:|---|
| `iron_body` | Iron Body | Reach 100 maximum HP on one character. | Canonical current `maxHp >= 100`; no reward from temporary HP. | 50 | 0 | Core |
| `unkillable` | Unkillable | Reach 300 maximum HP on one character. | Canonical `maxHp >= 300`; Bonus because some rulesets cannot reasonably reach this. | 150 | 0 | Bonus |
| `peak_strength` | Peak Strength | Reach 20 Strength on one character. | Canonical ability score, not temporary buff. In non-six-stat systems use mapped primary physical-power stat only if the rules adapter explicitly supports it. | 75 | 0 | Core |
| `beyond_mortal` | Beyond Mortal Limits | Reach 30 or higher in any supported core ability score. | Permanent/canonical score only. Bonus because many grounded systems cap below this. | 200 | 0 | Bonus |
| `jack_of_all` | Jack of All Trades | Use 3 different class or power abilities in one qualifying session. | Three distinct canonical ability IDs, not renamed repeats of one action. | 60 | 0 | Core |
| `scholar_of_magic` | Scholar of Magic | Have 10 or more learned spells/abilities on one character. | Ten distinct persisted abilities, excluding temporary narration-only effects. | 80 | 0 | Core |
| `growing_pains` | Growing Pains | Gain 5 legitimate levels through play on one character. | Five legitimate positive level transitions after the character's baseline. | 75 | 0 | Core |
| `veteran_soul` | Veteran Soul | Gain 10 legitimate levels through play on one character. | Ten legitimate positive transitions on the same character. | 125 | 0 | Core |
| `ascendant` | Ascendant | Take one DungeonMasterOS character from level 1 to level 20 through play. | Character must have a verified level-1 baseline and 19 legitimate progression transitions. Imports/manual edits do not retroactively qualify. | 250 | **100** | Core, Legendary Milestone |
| `many_lives_many_legends` | Many Lives, Many Legends | Have 5 different characters each gain at least 3 legitimate levels. | Five distinct character IDs owned by the account; each must earn three legitimate transitions. | 150 | 0 | Bonus |
| `old_campaigner` | Old Campaigner | Complete 25 qualifying sessions with the same character. | Same character ID, 25 qualifying sessions. | 125 | 0 | Core |
| `living_legend_character` | Living Legend | Complete 50 qualifying sessions with the same character. | Same character ID, 50 qualifying sessions. | 225 | 0 | Core |
| `polymath` | Polymath | Use abilities from 3 distinct class/power families during the life of one character. | Distinct persisted power-family IDs or rules-adapter classifications; simple reskins do not count as separate families. | 100 | 0 | Core |
| `walking_arsenal` | Walking Arsenal | Successfully use 5 different weapon categories in meaningful combat. | Five distinct canonical weapon categories across meaningful encounters. | 90 | 0 | Core |
| `arcane_breadth` | Arcane Breadth | Use spells/powers from 5 distinct schools or power categories. | Requires rules adapter/category metadata; Bonus because some characters/worlds have no magic taxonomy. | 110 | 0 | Bonus |
| `prepared_for_anything` | Prepared for Anything | Successfully use 5 distinct categories of adventuring equipment during one character's career. | Examples: tool, consumable, survival gear, key/utility, vehicle/mount/property interaction. Must be meaningful canonical use, not equip/unequip spam. | 90 | 0 | Core |
| `known_by_many_names` | Known by Many Names | Become known by many earned names over one character's life. | Hidden until one character has 10 validated established titles from the title system. Never count self-declared-only aliases. | 200 | 0 | Bonus, Hidden |

---

# Combat

### Founding Core v1 recommendation

`first_blood`, `untouchable`, `overkill`, `last_stand`, `never_surrender`, `battle_hardened`, `veteran_hundred_fights`, `giant_killer`, `against_all_odds`, `nemesis_ended`, `spellbreaker`, `the_gauntlet`

| ID | Achievement | Player-facing requirement | Internal validation / accomplishment terms | Points | Turns | Class |
|---|---|---|---|---:|---:|---|
| `first_blood` | First Blood | Defeat your first meaningful enemy. | First unique meaningful encounter victory credited to the player's character. | 25 | 0 | Core |
| `untouchable` | Untouchable | Win a meaningful fight without taking damage. | Encounter must be meaningful; character starts and ends without damage received from hostile sources. | 100 | 0 | Core |
| `overkill` | Overkill | Deal a finishing blow at least 200% beyond the enemy's remaining HP. | Use canonical damage/remaining-HP data where available. Narrative-only inference may award points only after server validation. | 75 | 0 | Core |
| `last_stand` | Last Stand | Win a meaningful fight while at exactly 1 HP. | Character is at 1 HP when victory is canonically resolved. | 150 | 0 | Core |
| `never_surrender` | Never Surrender | Survive 5 separate near-death moments. | Five distinct meaningful encounters where HP reaches <=10% max HP or the rules adapter's equivalent critical threshold and character survives. | 120 | 0 | Core |
| `battle_hardened` | Battle-Hardened | Win 25 meaningful combats. | 25 unique qualifying encounter IDs. | 100 | 0 | Core |
| `veteran_hundred_fights` | Veteran of a Hundred Fights | Win 100 meaningful combats. | 100 unique qualifying encounter IDs; no repeated/replayed encounter credit. | 250 | **50** | Core, Legendary Milestone |
| `giant_killer` | Giant Killer | Defeat an enemy substantially above your expected power. | Threat evaluator marks enemy/encounter materially above character/party expected power. Must be a real threat, not a manually inflated dummy. | 150 | 0 | Core |
| `against_all_odds` | Against All Odds | Win a combat substantially above the party's expected strength. | Party-level threat evaluator confirms high disparity before outcome is known. | 175 | 0 | Core |
| `nemesis_ended` | Nemesis Ended | Defeat a recurring antagonist encountered in at least 3 previous sessions. | Same canonical antagonist entity, appeared in 3 prior qualifying sessions, then is definitively defeated. | 175 | 0 | Core |
| `dragonbane` | Dragonbane | Defeat 5 distinct dragon-class enemies. | Five canonical enemy IDs classified as dragons by the active rules/world adapter. Genre-specific, therefore Bonus. | 150 | 0 | Bonus |
| `one_shot_one_kill` | One Shot, One Kill | Defeat a meaningful full-health enemy with one attack/action. | Enemy was at full health and meaningful threat immediately before a single canonical damaging action resolves it. | 125 | 0 | Bonus |
| `spellbreaker` | Spellbreaker | Interrupt, counter, dispel, or nullify hostile magic 10 times. | Ten distinct hostile ability events successfully stopped; equivalent anti-power actions may count in non-D&D systems. | 120 | 0 | Core |
| `the_gauntlet` | The Gauntlet | Win 3 meaningful combats without a long rest/full recovery between them. | Three distinct encounter victories in one recovery chain; no full-reset event between first and third. | 150 | 0 | Core |
| `flawless_campaigner` | Flawless Campaigner | Win 5 meaningful combats without taking damage. | Five distinct qualifying encounters satisfying Untouchable conditions. | 200 | 0 | Bonus |
| `boss_hunter` | Boss Hunter | Defeat 10 named or major bosses. | Ten distinct major-encounter antagonist IDs. | 200 | 0 | Bonus |
| `from_the_brink` | From the Brink | Win 5 fights after dropping below 10% HP. | Five separate meaningful encounters with critical HP state followed by victory. | 160 | 0 | Bonus |
| `answered_in_kind` | Answered in Kind | Defeat an enemy within one round/scene beat after it incapacitates one of your allies. | Ally may be player or meaningful NPC; same encounter; retaliation must occur within one combat round or rules-adapter equivalent. | 125 | 0 | Bonus |

---

# Roleplay

### Founding Core v1 recommendation

`silver_tongue`, `manipulator`, `marked_by_fate`, `diplomat`, `peacemaker`, `oathkeeper`, `kingmaker`, `redeemer`, `friends_in_many_places`, `folk_hero`, `master_negotiator`, `reputation_precedes_you`

| ID | Achievement | Player-facing requirement | Internal validation / accomplishment terms | Points | Turns | Class |
|---|---|---|---|---:|---:|---|
| `silver_tongue` | Silver Tongue | Resolve a meaningful conflict without combat. | Conflict must have credible hostile stakes and be canonically resolved peacefully. | 80 | 0 | Core |
| `manipulator` | Manipulator | Convince an enemy to switch sides. | Canonical hostile NPC changes allegiance/stance due primarily to player interaction. | 120 | 0 | Core |
| `cold_blooded` | Cold-Blooded | Betray an established ally for meaningful personal gain. | Ally relationship must predate the betrayal; gain must materially affect state/story. Evil-path Bonus, never required for mastery. | 100 | 0 | Bonus |
| `marked_by_fate` | Marked by Fate | Have a character flaw materially shape a scene. | Canonical flaw/trait is triggered and affects outcome or choice; not merely mentioned in narration. | 90 | 0 | Core |
| `diplomat` | Diplomat | Resolve 10 meaningful conflicts without combat. | Ten distinct conflict IDs, each peacefully resolved. | 150 | 0 | Core |
| `peacemaker` | Peacemaker | Broker peace between two hostile factions. | Both factions have canonical hostile relationship before negotiation and materially de-escalate afterward. | 175 | 0 | Core |
| `oathkeeper` | Oathkeeper | Fulfil 10 meaningful promises made during play. | Promises must be explicit, persisted, non-trivial, and later canonically fulfilled. | 150 | 0 | Core |
| `oathbreaker` | Oathbreaker | Break 5 important agreements or sworn promises. | Five distinct persisted promises with meaningful negative consequence or recognised breach. | 130 | 0 | Bonus |
| `kingmaker` | Kingmaker | Materially change the leadership of a settlement or faction. | Canonical authority/leadership state changes substantially due to player action. | 200 | 0 | Core |
| `redeemer` | Redeemer | Turn a recurring villain into an ally without defeating them in combat. | Recurring antagonist with prior hostility becomes allied/peaceful primarily through social/story action; no defeat state immediately preceding switch. | 200 | 0 | Core |
| `friends_in_many_places` | Friends in Many Places | Build meaningful recurring friendly relationships with 10 NPCs. | Ten canonical recurring NPCs reach a persisted friendly/allied relationship threshold through play. | 150 | 0 | Core |
| `brothers_in_arms_npc` | Brothers in Arms | Adventure alongside the same recurring NPC companion for 20 qualifying sessions. | Same canonical NPC appears as meaningful allied companion in 20 sessions. | 175 | 0 | Bonus |
| `folk_hero` | Folk Hero | Be recognised positively for past deeds in 5 different settlements/regions. | Five distinct canonical locations where independent NPCs react positively to persisted reputation/history. | 175 | 0 | Core |
| `infamous` | Infamous | Be recognised negatively for past deeds in 5 different settlements/regions. | Same as Folk Hero but negative/feared/hated reputation. Evil/chaotic-path Bonus. | 175 | 0 | Bonus |
| `master_negotiator` | Master Negotiator | Secure 10 meaningful concessions through negotiation. | Ten distinct negotiations where NPC/faction changes a material term, access, resource, stance, or outcome. | 150 | 0 | Core |
| `confidant` | Confidant | Earn 5 meaningful secrets or personal revelations from recurring NPCs. | Five distinct canonical NPC revelation events caused by trust/relationship, not theft/omniscient narration. | 125 | 0 | Bonus |
| `bridge_builder` | Bridge Builder | Create an alliance between two groups that were not previously allies. | Persisted faction relationship changes to alliance/cooperation due to player action. | 175 | 0 | Bonus |
| `reputation_precedes_you` | Reputation Precedes You | Be recognised for previous deeds in 10 distinct encounters without introducing yourself first. | Ten independent recognition events backed by world memory/knowledge state. | 175 | 0 | Core |

---

# Exploration

### Founding Core v1 recommendation

`curious_mind`, `dungeon_diver`, `cartographer`, `trailblazer`, `worldwalker`, `seasoned_delver`, `master_delver`, `secret_seeker`, `treasure_hunter`, `ancient_places`, `planeswalker`, `frontier_cartographer`

| ID | Achievement | Player-facing requirement | Internal validation / accomplishment terms | Points | Turns | Class |
|---|---|---|---|---:|---:|---|
| `curious_mind` | Curious Mind | Investigate 10 unique locations. | Ten canonical unique location IDs with meaningful player presence/investigation. | 70 | 0 | Core |
| `dungeon_diver` | Dungeon Diver | Clear your first dungeon. | Canonical dungeon/instance is materially completed, not merely entered. | 60 | 0 | Core |
| `cartographer` | Cartographer | Visit 25 unique locations. | Twenty-five canonical location IDs. | 180 | 0 | Core |
| `trailblazer` | Trailblazer | Visit 50 unique locations. | Fifty canonical location IDs. | 200 | 0 | Core |
| `worldwalker` | Worldwalker | Visit 100 unique locations. | One hundred canonical location IDs across the account. | 250 | 0 | Core |
| `beyond_the_horizon` | Beyond the Horizon | Visit 250 unique locations across your campaigns. | 250 canonical location IDs with duplicate/renamed-location protection. | 350 | **50** | Bonus, Legendary Milestone |
| `seasoned_delver` | Seasoned Delver | Clear 5 dungeons. | Five distinct canonical dungeon IDs. | 125 | 0 | Core |
| `master_delver` | Master Delver | Clear 25 dungeons. | Twenty-five distinct canonical dungeon IDs. | 250 | 0 | Core |
| `secret_seeker` | Secret Seeker | Discover 10 hidden rooms, passages, or secret locations. | Ten location/discovery entities marked hidden before player discovery. | 150 | 0 | Core |
| `treasure_hunter` | Treasure Hunter | Find 25 genuinely hidden treasures or caches. | Twenty-five distinct hidden-cache discovery IDs; shop purchases and ordinary loot do not count. | 175 | 0 | Core |
| `ancient_places` | Ancient Places | Explore 10 ruins, tombs, forgotten sites, or ancient complexes. | Ten canonical locations classified as ancient/ruin/tomb equivalents. | 140 | 0 | Core |
| `planeswalker` | Planeswalker | Travel to 3 distinct worlds, planes, dimensions, or equivalent major realms. | Three canonical world/plane IDs; teleporting between rooms does not qualify. | 175 | 0 | Core |
| `between_worlds` | Between Worlds | Travel to 10 distinct worlds, planes, dimensions, or major realms. | Ten canonical world/plane IDs. | 250 | 0 | Bonus |
| `no_stone_unturned` | No Stone Unturned | Discover every qualifying location in one sufficiently large region. | Only available when the region has a server-known discoverable-location manifest. Region must meet a minimum size to prevent one-room farming. | 225 | 0 | Bonus |
| `frontier_cartographer` | Frontier Cartographer | Explore 10 distinct regions in meaningful depth. | Ten canonical regions, each with minimum location/activity threshold. | 175 | 0 | Core |
| `return_to_the_source` | Return to the Source | Return to an old location after at least 20 qualifying sessions and discover that the world there has meaningfully changed. | Same canonical location, >=20 qualifying sessions since prior meaningful visit, persisted world-state delta is acknowledged. | 175 | 0 | Bonus |
| `world_without_end` | World Without End | Record meaningful exploration progress in 10 different campaigns. | Ten campaigns each meet a minimum unique-location threshold; campaign create/delete loops do not count. | 225 | 0 | Bonus |

---

# Fellowship

Fellowship achievements recognise authenticated human co-play. They must never be granted merely because another account joins a lobby.

### Founding Core v1 recommendation

`not_alone_anymore`, `band_of_adventurers`, `seasoned_company`, `veteran_fellowship`, `long_campaign_multiplayer`, `leave_no_one_behind`, `no_hero_left_behind`, `not_today`, `guardian_angel`, `party_diplomat`, `the_pact`, `friendly_faces`

The core set is deliberately achievable through repeated duo play. Party-size achievements above two players are Bonus so Fellowship Mastery is not locked behind a higher subscription tier.

| ID | Achievement | Player-facing requirement | Internal validation / accomplishment terms | Points | Turns | Class |
|---|---|---|---|---:|---:|---|
| `not_alone_anymore` | Not Alone Anymore | Complete a qualifying session with another player. | At least 2 distinct authenticated users satisfy multiplayer session contribution rules. | 50 | 0 | Core |
| `fellowship_begins` | The Fellowship Begins | Complete a qualifying session with 3 active players. | Three distinct authenticated users each meet contribution minimum. | 75 | 0 | Bonus |
| `full_party` | Full Party | Complete a qualifying session with 4 active players. | Four distinct authenticated users. | 100 | 0 | Bonus |
| `strength_in_numbers` | Strength in Numbers | Complete a qualifying session with 5 active players. | Five distinct authenticated users. | 125 | 0 | Bonus |
| `six_against_world` | Six Against the World | Complete a qualifying session with the maximum 6-player party. | Six distinct authenticated users, all contributing meaningfully. | 175 | 0 | Bonus |
| `band_of_adventurers` | Band of Adventurers | Complete 5 qualifying multiplayer sessions. | Five sessions with at least one other authenticated player. | 90 | 0 | Core |
| `seasoned_company` | Seasoned Company | Complete 15 qualifying multiplayer sessions. | Fifteen qualifying multiplayer sessions. | 125 | 0 | Core |
| `veteran_fellowship` | Veteran Fellowship | Complete 30 qualifying multiplayer sessions. | Thirty qualifying multiplayer sessions. | 175 | 0 | Core |
| `brothers_sisters_in_arms` | Brothers & Sisters in Arms | Complete 25 qualifying sessions with the same core group of at least 3 players. | Stable core group; required users appear in >=80% of credited sessions. | 225 | 0 | Bonus |
| `long_campaign_multiplayer` | The Long Campaign | Complete 50 qualifying multiplayer sessions in one campaign. | Same campaign ID, multiplayer qualification on all 50 sessions. | 250 | 0 | Core |
| `legends_together` | Legends Together | Finish a substantial campaign with at least 3 players who remained part of the core group. | Campaign completion must be canonical and meet minimum session threshold; core group participation >=80%. | 300 | **100** | Bonus, Legendary Milestone |
| `leave_no_one_behind` | Leave No One Behind | Win a major encounter with every player character alive at the end. | Major encounter; all participating player characters survive. | 100 | 0 | Core |
| `no_hero_left_behind` | No Hero Left Behind | Rescue another player character from incapacitation or imminent defeat. | Another player's character is canonically incapacitated/critical, then the achiever's action materially restores/saves/removes them from danger. | 125 | 0 | Core |
| `not_today` | Not Today | Prevent another player's character from dying through your action. | Server state indicates credible death/defeat would have occurred absent the rescuing action; use conservative validation. | 150 | 0 | Core |
| `guardian_angel` | Guardian Angel | Save other player characters from defeat 10 times. | Ten distinct rescue events across meaningful encounters; same event cannot credit multiple times. | 200 | 0 | Core |
| `together_we_stand` | Together We Stand | Win a difficult encounter where every participating player contributes meaningfully. | Difficult encounter plus contribution evidence from every active player. | 125 | 0 | Bonus |
| `skin_of_our_teeth` | By the Skin of Our Teeth | Win a major encounter after at least half the party becomes critically injured or incapacitated. | Major encounter; >=50% of participating PCs hit critical/incapacitated state before victory. | 175 | 0 | Bonus |
| `against_impossible_odds_party` | Against Impossible Odds | As a multiplayer party, defeat an encounter substantially above expected party strength. | Multiplayer threat evaluator confirms disparity before outcome. | 200 | 0 | Bonus |
| `perfect_formation` | Perfect Formation | Win 5 major multiplayer encounters without any player character being incapacitated. | Five distinct major encounters. | 200 | 0 | Bonus |
| `united_we_stand` | United We Stand | Reach unanimous agreement on an important party decision. | Persisted major decision with all active players explicitly choosing/confirming the same course. Do not trigger on routine movement. | 100 | 0 | Bonus |
| `divided_we_fall` | Divided We Fall | Split into separate groups during an adventure and later successfully reunite. | Party-split state persists across meaningful play and later canonical reunion occurs. | 100 | 0 | Bonus |
| `party_diplomat` | Party Diplomat | Resolve a serious disagreement between player characters without violence. | Genuine conflicting player-character goals/positions, de-escalated through play, no PvP resolution. | 125 | 0 | Core |
| `different_paths` | Different Paths | Have two player characters pursue conflicting objectives during the same story arc without the campaign collapsing. | Conflicting persisted objectives plus later continued shared campaign activity. | 125 | 0 | Bonus |
| `odd_couple` | Odd Couple | Keep two strongly opposed player characters allied for 10 qualifying sessions. | Opposed alignment/faction/goal metadata and same two PCs remain cooperating across 10 sessions. | 150 | 0 | Bonus |
| `the_pact` | The Pact | Make and fulfil a significant shared oath with another player character. | Shared persisted promise/oath explicitly accepted by 2+ players and later fulfilled. | 150 | 0 | Core |
| `the_fellowship` | The Fellowship | Complete an entire substantial campaign with the same core group of at least 3 players. | Similar to Legends Together but requires the qualifying core group to be present from early campaign phase through completion. | 300 | 0 | Bonus |
| `four_against_fate` | Four Against Fate | Finish a substantial campaign with 4 active core players. | Four-player core group, >=80% qualifying-session participation. | 225 | 0 | Bonus |
| `the_five` | The Five | Finish a substantial campaign with 5 active core players. | Five-player core group, >=80% participation. | 275 | 0 | Bonus |
| `the_six` | The Six | Finish a substantial campaign with the maximum 6-player core party. | Six-player core group, >=80% participation, campaign completion threshold met. | 350 | **100** | Bonus, Legendary Milestone |
| `friendly_faces` | Friendly Faces | Complete qualifying sessions with 5 different human players over the life of the account. | Five distinct authenticated user IDs; each must share at least one qualifying session. | 100 | 0 | Core |
| `well_travelled_fellowship` | Well Travelled | Complete qualifying sessions with 10 different human players. | Ten distinct authenticated user IDs. | 150 | 0 | Bonus |
| `friend_to_many` | Friend to Many | Complete qualifying sessions with 25 different human players. | Twenty-five distinct authenticated user IDs; risk-score suspicious alt clusters but never use IP alone. | 225 | 0 | Bonus |
| `adventurer_without_borders` | Adventurer Without Borders | Complete qualifying sessions with 50 different human players. | Fifty distinct authenticated user IDs. Intended as a long-term/community achievement. | 350 | 0 | Bonus |
| `classic_party` | The Classic Party | Complete a substantial adventure with a balanced spread of frontline, support, magic/power, and skill/utility roles. | Use role tags, not exact D&D class names. All roles must contribute during the adventure. | 125 | 0 | Bonus |
| `oops_all_wizards` | Oops, All Wizards | Complete a substantial adventure where every active player is primarily magic/power focused. | Party composition classified by rules adapter; minimum 3 players. | 125 | 0 | Bonus |
| `no_healer_no_problem` | No Healer, No Problem | Complete a difficult multiplayer adventure with 3+ players and no dedicated healer/support-restoration role. | Party role classifier confirms no dedicated healer and sufficient difficulty. | 150 | 0 | Bonus |
| `steel_and_sorcery` | Steel and Sorcery | Complete a substantial adventure with both martial and magical characters contributing meaningfully. | At least one martial and one magic/power-focused PC contribute. | 100 | 0 | Bonus |
| `band_of_rogues` | Band of Rogues | Complete a major objective with a party mostly composed of stealth/skill-focused characters. | Majority role classification; minimum 3 players; objective must be meaningful. | 125 | 0 | Bonus |
| `holy_company` | Holy Company | Complete a major objective with a party mostly composed of divine/support/faith-oriented characters. | Majority role classification; minimum 3 players. Equivalent spiritual/support archetypes may count in non-D&D worlds. | 125 | 0 | Bonus |

---

# Chronicle

Chronicle replaces the player-facing label `Meta`. It recognises long-term account/campaign history and DungeonMasterOS-specific persistence.

### Founding Core v1 recommendation

`architect`, `chronicler`, `living_world`, `system_remembers`, `adventure_begins`, `seasoned_adventurer`, `long_road`, `life_of_adventure`, `saga_complete`, `veteran_storyteller`, `adventure_continues`, `year_in_realm`

| ID | Achievement | Player-facing requirement | Internal validation / accomplishment terms | Points | Turns | Class |
|---|---|---|---|---:|---:|---|
| `architect` | Architect | Create your first real campaign. | Campaign must produce at least one qualifying session before credit. Prevent create/delete farming. | 25 | 0 | Core |
| `rule_breaker` | Rule Breaker | Play a qualifying session with homebrew rules enabled. | Feature-specific; campaign must actually reach qualifying play after setting is enabled. | 50 | 0 | Bonus |
| `anime_protagonist` | Anime Protagonist | Play a qualifying session in an anime-enabled world. | Feature-specific; Bonus so mastery is not subscription-gated. | 60 | 0 | Bonus |
| `god_tier` | God-Tier | Play a qualifying session with Epic Mode enabled. | Feature-specific; Bonus so mastery is not subscription-gated. | 75 | 0 | Bonus |
| `chronicler` | The Chronicler | Build a campaign containing at least 100 qualifying DM turns. | Harden the current raw-message requirement. Count successful gameplay DM turns, not arbitrary user/system messages. | 125 | 0 | Core |
| `living_world` | Living World | Have the Dungeon Master meaningfully reference a previous scene. | AI may detect evidence, but persisted event/scene reference must validate it. | 120 | 0 | Core |
| `system_remembers` | The System Remembers | Have an NPC react to something you said or did much earlier. | NPC knowledge/reputation/history evidence must support the reaction. | 130 | 0 | Core |
| `gifted_power` | Gifted Power | Receive a new ability or power organically through the story. | Ability must be persisted as genuinely new and originate from validated DM event. | 70 | 0 | Bonus |
| `item_hoarder` | Item Hoarder | Hold 20 or more distinct meaningful inventory entries on one character. | Persisted item records; quantity spam of identical items does not create 20 entries. | 60 | 0 | Bonus |
| `adventure_begins` | The Adventure Begins | Complete 10 qualifying sessions. | Account-wide qualifying-session counter. | 100 | 0 | Core |
| `seasoned_adventurer` | Seasoned Adventurer | Complete 25 qualifying sessions. | Account-wide. | 150 | 0 | Core |
| `long_road` | The Long Road | Complete 50 qualifying sessions. | Account-wide. | 200 | 0 | Core |
| `life_of_adventure` | A Life of Adventure | Complete 100 qualifying sessions. | Account-wide. | 300 | 0 | Core |
| `saga_complete` | Saga Complete | Finish a substantial campaign. | Explicit canonical campaign-completion state plus minimum qualifying-session threshold. Archiving is not completion. | 200 | 0 | Core |
| `veteran_storyteller` | Veteran Storyteller | Finish 3 substantial campaigns. | Three distinct completed campaign IDs; each meets completion criteria. | 300 | 0 | Core |
| `wayfarer_of_worlds` | Wayfarer of Worlds | Complete substantial play in 5 different campaigns. | Five campaigns each reach a minimum qualifying-session threshold. | 175 | 0 | Bonus |
| `adventure_continues` | The Adventure Continues | Return to a campaign after at least 30 days away and complete another qualifying session. | Same campaign; >=30 days since last qualifying session; must continue rather than duplicate/restore old messages. | 150 | 0 | Core |
| `year_in_realm` | A Year in the Realm | Play the same campaign during 12 distinct calendar months. | Same campaign ID, at least one qualifying session in 12 distinct year-month buckets. | 350 | **100** | Core, Legendary Milestone |
| `achievement_hunter` | Achievement Hunter | Unlock 50 non-secret achievements. | Account-wide unique achievement IDs; mastery/meta achievements may be excluded to avoid recursive inflation. | 200 | 0 | Bonus |
| `names_become_legend` | Names Become Legend | Accumulate 100 validated established titles across your account. | Hidden milestone from Emergent Titles design; deduplicate title variants and count only validated titles. | 400 | 0 | Bonus, Hidden |

---

# Secrets

Secrets are intentionally hidden, weird, story-driven, and often partly stochastic. Individual Secret achievements award **no direct turns**. This avoids encouraging players to force absurd behaviour merely to farm currency.

Secret unlocks still grant Achievement Points and can contribute to the hidden Keeper of Secrets mastery.

### Secret Founding Core v1 recommendation

`shouldnt_be_here`, `unlikely_alliance`, `played_dm`, `door_wins`, `what_could_go_wrong`, `return_to_sender`, `can_we_keep_it`, `pocket_sand`, `words_against_apocalypse`, `i_meant_to_do_that`, `dungeon_master_sighed`, `somehow_this_worked`

`the_absolute` remains a prestigious Bonus Secret and is not required for mastery because many grounded campaigns should never reach that state.

| ID | Achievement | Hidden accomplishment terms | Points | Turns | Class |
|---|---|---|---:|---:|---|
| `the_absolute` | The Absolute | The DM and canonical state acknowledge that the character has genuinely exceeded the world's normal limits. Do not manufacture this solely for the achievement. | 500 | 0 | Bonus, Hidden |
| `shouldnt_be_here` | You Shouldn't Be Here | Player breaks expected narrative flow in a materially surprising but valid way. Requires canonical outcome, not simply saying something random. | 300 | 0 | Core, Hidden |
| `unlikely_alliance` | Unlikely Alliance | Form a meaningful alliance with a person/creature/faction strongly expected to remain hostile. | 200 | 0 | Core, Hidden |
| `played_dm` | Played the DM | Use established world facts/rules against the situation in a way the DM analysis flags as genuinely unanticipated and successful. | 250 | 0 | Core, Hidden |
| `door_wins` | The Door Wins | Fail repeatedly and spectacularly against the same mundane door/lock/obstacle across a meaningful scene before eventually changing approach or being defeated by common sense. No deliberate rapid spam. | 100 | 0 | Core, Hidden |
| `mimicry` | Mimicry | Interact with an apparently ordinary object that is later canonically revealed to be a mimic or equivalent deceptive creature. | 125 | 0 | Bonus, Hidden |
| `what_could_go_wrong` | What Could Possibly Go Wrong? | Voluntarily consume/use an unidentified magical or clearly suspicious substance/item and survive the resulting consequence. | 125 | 0 | Core, Hidden |
| `friendly_fire_secret` | Friendly Fire | Accidentally harm another player character or meaningful ally with your own action and continue the encounter. | 100 | 0 | Bonus, Hidden |
| `return_to_sender` | Return to Sender | Defeat or decisively turn back an enemy using its own weapon, reflected ability, redirected attack, or equivalent. | 175 | 0 | Core, Hidden |
| `can_we_keep_it` | Can We Keep It? | Befriend, tame, adopt, recruit, or otherwise keep a creature that began as genuinely hostile. | 150 | 0 | Core, Hidden |
| `pocket_sand` | Pocket Sand | Win an important moment using a mundane improvised object/action the encounter did not revolve around. | 150 | 0 | Core, Hidden |
| `words_against_apocalypse` | Words Against the Apocalypse | Resolve a major boss/story-ending threat without fighting it. | 250 | 0 | Core, Hidden |
| `i_meant_to_do_that` | I Meant To Do That | A serious failure directly creates the opportunity for a major success in the same arc. | 150 | 0 | Core, Hidden |
| `dungeon_master_sighed` | The Dungeon Master Sighed | A ridiculous but coherent player plan succeeds and the DM analysis recognises the absurdity without breaking canon. | 175 | 0 | Core, Hidden |
| `we_had_a_plan` | We Had a Plan | In multiplayer, all active players agree on a plan and it quickly goes catastrophically wrong through play rather than deliberate sabotage. | 125 | 0 | Bonus, Hidden |
| `that_was_the_plan` | That Was the Plan? | The party succeeds after substantially abandoning or reversing its original agreed plan. | 150 | 0 | Bonus, Hidden |
| `you_go_first` | You Go First | Another player knowingly volunteers for an obviously dangerous task before anyone is forced into it. | 100 | 0 | Bonus, Hidden |
| `with_friends_like_these` | With Friends Like These | One player intentionally harms another party member and the party nevertheless continues together through meaningful subsequent play. | 125 | 0 | Bonus, Hidden |
| `absolutely_not` | Absolutely Not | Every active player independently rejects the DM-presented obvious course of action and chooses another path. | 125 | 0 | Bonus, Hidden |
| `collective_stupidity` | Collective Stupidity | The whole active party knowingly participates in a clearly dangerous plan and survives the consequences. | 175 | 0 | Bonus, Hidden |
| `somehow_this_worked` | Somehow, This Worked | A ridiculous multiplayer strategy successfully resolves a serious encounter/objective. | 200 | 0 | Core, Hidden |
| `trust_me` | Trust Me | The whole party follows one player's clearly risky plan and it succeeds. | 150 | 0 | Bonus, Hidden |
| `trust_him_he_said` | Trust Him, He Said | The whole party follows one player's clearly risky plan and it fails badly. | 150 | 0 | Bonus, Hidden |

---

# Category Mastery Achievements

These are explicit, versioned meta-achievements with frozen ID lists.

| ID | Name | Requirement | Reward |
|---|---|---|---|
| `mastery_character_v1` | Paragon of the Self | Complete all 12 Character Founding Core v1 achievements. | 100 turns + title/badge |
| `mastery_combat_v1` | Master of Battle | Complete all 12 Combat Founding Core v1 achievements. | 100 turns + title/badge |
| `mastery_roleplay_v1` | Master of Words | Complete all 12 Roleplay Founding Core v1 achievements. | 100 turns + title/badge |
| `mastery_exploration_v1` | Master of the Unknown | Complete all 12 Exploration Founding Core v1 achievements. | 100 turns + title/badge |
| `mastery_fellowship_v1` | Master of Fellowship | Complete all 12 Fellowship Founding Core v1 achievements. | 100 turns + title/badge |
| `mastery_chronicle_v1` | Veteran of the Chronicle | Complete all 12 Chronicle Founding Core v1 achievements. | 100 turns + title/badge |
| `mastery_secrets_v1` | Keeper of Secrets | Complete all 12 hidden Secret Founding Core v1 achievements. | 150 turns + hidden special frame/badge |

Intermediate 4/12 and 8/12 turn gates are account reward checkpoints, not necessarily separate visible achievement cards.

## Grand Mastery Achievements

| ID | Name | Requirement | Reward |
|---|---|---|---|
| `legend_of_dmos_v1` | Legend of DungeonMasterOS | Complete any 6 of the 7 v1 Category Masteries. | 300 turns + unique title/profile crest |
| `absolute_completionist_v1` | Absolute Completionist | Complete all 7 v1 Category Masteries. | Additional 200 turns + unique animated frame/crest |

## Achievement Score Milestones

| ID | Requirement | Reward |
|---|---|---|
| `achievement_score_1000` | Reach 1,000 lifetime Achievement Points. | Cosmetic title/badge only |
| `achievement_score_2500` | Reach 2,500 lifetime Achievement Points. | 25 turns |
| `achievement_score_5000` | Reach 5,000 lifetime Achievement Points. | 50 turns |
| `achievement_score_10000` | Reach 10,000 lifetime Achievement Points. | 100 turns |
| `achievement_score_20000` | Reach 20,000 lifetime Achievement Points. | 150 turns |

Score milestone rewards are never repeatable if point totals later change.

## Presentation

Recommended achievement screen structure:

**Character | Combat | Roleplay | Exploration | Fellowship | Chronicle | Secrets**

Each category should show:

- unlocked count
- total visible achievements in that category
- Achievement Points earned from the category
- Founding Core mastery progress for non-secret categories
- next visible category gate when appropriate
- Category Mastery badge once earned

Secrets should avoid exposing undiscovered names, descriptions, exact trigger logic, and ideally exact remaining count. A presentation such as `Secrets Discovered: 7 / ?` is preferable to advertising every hidden target.

Achievement unlock cards may show points and direct turn rewards when a direct reward exists.

Category gate/mastery unlocks should have a more substantial presentation than ordinary achievements.

## Anti-Farming and Economic Security

### Server authority

Achievement state and turn rewards are server-authoritative.

The client may display progress but must never be able to submit `achievement unlocked`, `grant turns`, or arbitrary counter increments.

### AI output is evidence, not economic authority

Claude/LLM analysis may classify a scene or propose flags such as peaceful resolution, unexpected solution, alliance, or major conflict.

For any achievement that can contribute to a turn-bearing gate, persist canonical evidence and apply deterministic server-side checks before incrementing progress.

The LLM must never directly call a `grantBonusTurns` operation based only on its own narration.

### Idempotent reward ledger

Add a reward ledger concept if one does not already exist.

Each account reward should have a stable key, for example:

- `achievement:ascendant`
- `category_gate:combat:v1:4`
- `category_gate:combat:v1:8`
- `category_mastery:combat:v1`
- `achievement_score:5000`
- `grand_mastery:legend_of_dmos:v1`

A unique constraint on `(userId, rewardKey)` should make duplicate grants impossible.

### Character/import manipulation

Do not grant progression achievements from:

- imported high-level characters
- manual stat/level edits
- admin edits
- test fixtures
- campaign restore/replay
- level down -> level up loops
- delete/recreate loops

Use a baseline plus validated deltas.

### Message spam

Raw message count is not meaningful activity.

The existing Chronicler concept should use qualifying DM turns/session logic rather than arbitrary message rows. Repeated punctuation, one-word spam, rejected actions, or system messages should not create achievement progress.

### Multiplayer alt farming

Do not reject legitimate same-household players because they share an IP.

Instead, use layered signals if abuse mitigation is needed:

- account age
- repeated identical action text
- improbable join/leave patterns
- device/session fingerprints where legally/privacy appropriate
- groups created solely for one achievement then abandoned
- no meaningful actions from secondary accounts
- repeated exact timing patterns

Risk scoring should be conservative. False positives that punish a family playing around one table are worse than occasionally letting a determined person earn a cosmetic achievement.

Turn-bearing multiplayer rewards should require long-term activity, not simply unique account joins.

### Campaign completion

Archiving/deleting a campaign is not completion.

A completed campaign should have a canonical completion state and minimum meaningful-history threshold. The host should not be able to create a campaign, mark it complete immediately, and receive Saga/party-finish credit.

### Unique entities

Use canonical IDs for locations, encounters, NPCs, factions, promises, titles, and campaigns wherever possible. Text normalization alone is not sufficient for economic counters.

## Backfill and Existing Players

1. Never revoke existing unlocked achievements solely because criteria are hardened.
2. Preserve all existing achievement IDs.
3. Historical deterministic state may be backfilled when the database contains reliable evidence.
4. Do not fabricate historical progress from missing narration/evidence.
5. Existing unlocked achievements may count toward Founding Core mastery.
6. Category/score reward grants during migration must pass through the same idempotent reward ledger.
7. Direct-turn Legendary Milestone rewards may be granted to already-unlocked achievements once if product policy chooses to grandfather them. Record that payment with the same stable reward key.

## Data Model Direction

Do not force this exact schema if the repository already contains better abstractions, but the implementation needs concepts equivalent to:

### Achievement definition

- id
- name
- description
- flavour
- category
- icon / icon key
- hidden
- points
- directTurnReward
- coreVersion / mastery membership
- progress type

### User achievement progress

For cumulative achievements, persist counters/evidence instead of rescanning all messages on every action.

Conceptual fields:

- userId
- achievementId or progressKey
- currentValue
- targetValue
- characterId/campaignId where scoped
- evidence references / dedupe keys as needed
- updatedAt

### Reward ledger

- id
- userId
- rewardKey
- rewardType
- amount
- achievementId/category/meta reference
- createdAt
- unique `(userId, rewardKey)`

### Session/aggregate statistics

If no suitable statistics layer exists, create a small server-side achievement statistics/progression service rather than stuffing every cumulative counter into `shared/achievements.ts`.

Recommended tracked facts include:

- legitimate level transitions per character
- qualifying sessions per account/character/campaign/group
- unique meaningful encounter wins
- unique bosses
- dungeon clears
- unique locations/regions/worlds
- multiplayer participant sets
- campaign completions
- meaningful NPC/faction/reputation outcomes
- validated title counts

## Engine Architecture

The current `checkAchievements(ctx)` model is suitable for simple immediate checks but should not become a single enormous function containing every counter, database query, reward rule, and AI classifier.

Recommended separation:

1. **Achievement catalogue** - static definitions/presentation metadata
2. **Progress/event service** - consumes validated gameplay events and updates counters
3. **Achievement evaluator** - decides which definitions cross thresholds
4. **Mastery evaluator** - checks frozen core ID sets and score thresholds
5. **Reward service** - idempotently grants `bonusTurns`
6. **Presentation API** - returns safe visible progress, hiding Secret internals

## Required Event Types

Implementation should prefer canonical domain events such as:

- character_level_up
- character_stat_changed
- ability_used
- item_used
- encounter_started
- encounter_completed
- enemy_defeated
- boss_defeated
- character_critical
- character_rescued
- dungeon_cleared
- location_discovered
- region_explored
- world_entered
- npc_relationship_changed
- faction_relationship_changed
- promise_created
- promise_resolved
- campaign_session_completed
- campaign_completed
- multiplayer_session_completed
- title_established

Not every event must be a new database table. Reuse existing canonical event/history systems where available.

## Testing Requirements

At minimum add automated tests for:

### Reward safety

- achievement unlock cannot grant its direct reward twice
- 4/12 category gate cannot pay twice
- 8/12 category gate cannot pay twice
- Category Mastery cannot pay twice
- Achievement Score threshold cannot pay twice
- reconnect/retry/replayed event cannot duplicate bonus turns
- existing `bonusTurns` are incremented rather than overwritten

### Mastery stability

- adding a new Bonus achievement does not revoke v1 mastery
- adding a future core set does not alter v1 requirements
- existing unlocked IDs continue to count
- feature-plan-specific Bonus achievements do not block mastery

### Progress integrity

- imported level-20 character does not unlock Ascendant
- level down/up loop does not generate repeated level-up credit
- create/delete campaign loop does not generate campaign milestones
- duplicate encounter event does not increment combat counters twice
- renamed location does not count as a new canonical location
- archived campaign does not equal completed campaign

### Multiplayer

- merely joining a campaign does not unlock Fellowship achievements
- two authenticated users must both contribute meaningfully
- same-IP legitimate users remain eligible
- six-player achievement requires six distinct authenticated users
- long-term group achievement uses stable participant identity and cannot be satisfied by constantly swapping alts
- rescue achievements credit the rescuer once per actual rescue event

### Secrets/privacy

- hidden achievement trigger/progress is not exposed through normal APIs before unlock
- Secret mastery progress is not exposed as a precise checklist to players
- hidden title thresholds remain hidden

### Regression

- all existing achievement IDs remain recognised
- existing unlock UI still works
- gameplay continues even if achievement evaluation fails
- achievement errors do not consume additional AI turns or break campaign actions

## Non-Goals for the First Implementation

- repeatable achievement farming
- daily/weekly achievement chores
- leaderboards based on purchased turns
- PvP ranking
- cash-equivalent withdrawal of bonus turns
- client-authoritative progress
- exact anti-cheat device fingerprinting system if the product does not already have one
- hand-authoring 145 bespoke icon images before the system works

Emoji/icon keys may remain placeholders initially and be replaced with proper art later.

## Success Criteria

The system is successful when:

1. DungeonMasterOS has a large, varied achievement catalogue covering solo and multiplayer play.
2. Players can make meaningful progress in every non-Fellowship category without multiplayer.
3. Fellowship rewards real cooperative play rather than lobby joins.
4. Category completion is versioned and never revoked by future additions.
5. Paid-feature-specific achievements do not paywall ordinary Category Mastery.
6. Most achievements provide prestige/points, while free turns are concentrated at hard gates.
7. `bonusTurns` are granted idempotently and cannot be duplicated through retries or farming loops.
8. Existing achievements and existing users are preserved.
9. Secret achievements remain genuinely secret.
10. The achievement system reinforces DungeonMasterOS's strongest differentiator: a persistent world that remembers what players did together over long campaigns.
