# DungeonMasterOS Campaign Completion Dashboard

Last updated: 2026-08-17

This dashboard tracks playable campaign-template maturity, not merely discoveries. Rulesets are stated explicitly. `Approved` means source rights, campaign canon, ruleset identity, story graph, adversarial AI-DM QA and required machine validation are complete enough for built-in integration without inventing missing story content. Source-specific release obligations may still prevent approval.

## Approved built-in campaigns

| Campaign | Genre | Native ruleset | Progression | Additional support | Licence | Status |
|---|---|---|---|---|---|---|
| Midnight in Bonetown | Weird fantasy / fungal horror / pointcrawl | Cairn | Cairn/system-specific, no invented D&D level | Cairn-compatible/OSR via conversion adapter | CC BY-SA 4.0 | APPROVED |
| A Tomb of Twins | Ghost/necromancer dungeon / old-school fantasy | CRACK!/B/X-compatible, Cairn, Mörk Borg | B/X example levels 1-3; Cairn/Mörk Borg use native progression | Other OSR via conversion adapter | CC BY-SA 4.0 full text | APPROVED |
| Born Into Black Nights | Gothic/ghost horror / town investigation / tomb | Cairn | Cairn native; source states no D&D-style level | Other fantasy systems through explicit conversion only | CC BY-SA 4.0 text | APPROVED |
| The Old Blood | Gothic/vampire horror / investigative city sandbox | Shadowdark RPG | **Levels 1-2** | Creator-supported OSR-style systems via explicit rules adapter | CC0 original campaign content | APPROVED |

## QA-complete architecture, release blockers remain

| Campaign | Genre | Native ruleset | Progression | Additional support | Licence | Remaining blocker |
|---|---|---|---|---|---|---|
| Merilla's Magic Tower | Magical tower / rescue / assassination | Basic Fantasy Role-Playing Game | **3-6 characters, levels 4-7** | B/X-compatible conversion only after adapter QA | OGL v1.0a / AA1 Open Game Content | Direct visual-map check for reported stair discrepancy; production OGL/Copyright Notice package. Machine schema validation PASSED. |
| Gold in the Hills | Goblin mine / infiltration / dwarven machinery | Basic Fantasy Role-Playing Game | **2-4 characters, levels 1-3** | OSR conversions only after adapter QA | OGL v1.0a / AA1 Open Game Content | Final visual-map check; production OGL/Copyright Notice package. Machine schema validation PASSED. |
| Beneath Brymassen | Beginner dungeon / rescue / humanoid factions | Basic Fantasy Role-Playing Game | **3-6 beginning / level-1 characters** | B/X-compatible OSR conversion only after adapter QA | OGL v1.0a / AA1 Open Game Content | Direct visual-map check; production OGL/Copyright Notice package. Story/canon/adversarial QA and machine schema validation PASSED. |
| Leviathan | Sci-fi / space horror / paranoia | System-neutral | None assumed; one-shot | Mothership TESTED by actual play; Monolith creator-listed compatible | CC BY-SA 4.0 text | Direct two-page PDF extraction for exact map/messages/tables |

## Active research / partial graphs

| Campaign | Genre | Native ruleset | Known progression | Licence state | Current stage |
|---|---|---|---|---|---|
| The Zombraire's Estate | Gothic/undead estate / cursed manor | Basic Fantasy Role-Playing Game | **3-6 characters, levels 2-5** | OGL v1.0a / AA1 Open Game Content | researching; provenance/community play captured; exact keyed extraction incomplete |
| Castle Inspection | Dark-comedy fantasy / crisis management | System-neutral | One-evening adventure | CC BY-SA 4.0 | researching / partial graph |
| Well, what now? | OSR cave rescue | System-neutral OSR | Source does not state level | CC BY-SA 4.0 | researching / partial graph |
| Island of Trials | Fantasy trials one-shot | D&D 5e | Level 5, four players | Itch asset licence CC BY 4.0; PDF scope still to verify | researching |
| The Whispered Caverns of June Serin | Mystery / cavern investigation | Quest RPG | Quest progression, first-level tag; no invented D&D level | CC BY 4.0 adventure module | researching / graph drafted |
| Under the Rusted Sun | OSR fantasy | System-agnostic / OSR | Source-defined | CC BY 4.0 | dossier started |
| OVERTHROW THE TYRANT | OSR political fantasy | System-agnostic OSR | Source-defined | CC BY 4.0 | dossier started |
| De Farra a Ruinaceleste | Fantasy | Source-defined | Source-defined | research folder exists | researching |
| The Crypt of Unending Hunger | Vampire crypt / gothic dungeon | Cairn monsters / one-page dungeon | Cairn-style, source level not stated | CC BY 4.0 | primary source/licence verified; exact PDF extraction pending |
| These Pillars Remain | Post-apocalyptic survival horror | Self-contained one-page TTRPG | Native source system; no level assumption | CC BY-SA 4.0 | source verified; sheet extraction pending |
| The Chalk-Marked Grave | Acid-rain post-apocalyptic pointcrawl | Cairn; Eco Mofos adaptable | Cairn/system-specific | CC BY-SA 4.0 | source verified; pointcrawl/hive extraction pending |
| The Return of the XBRC Terror | Sci-fi salvage/survival horror | System-neutral | One-page / few-hour scenario | CC BY-SA 4.0 | source/licence verified; exact text extraction pending |
| Cascading Failure | Sci-fi derelict / collapsing ship | System-neutral | One-page / few-hour scenario | CC BY-SA 4.0 | source/licence verified; exact text extraction pending |
| Derelict Transdimensional Anomaly | Sci-fi pointcrawl / time-space anomaly | System-neutral | One-page scenario | CC BY-SA 4.0 text/map | source/licence verified; exact node/table extraction pending |
| Nautilus of Time | Time-travel derelict / procedural sci-fi | System-neutral | Scenario; no level model | CC BY-SA 4.0 | source/licence verified; source tables partially extracted |
| The Horror of Station XK-629 | Asteroid-station survival horror | System-neutral | One-page scenario | CC BY-SA 4.0 | source/licence verified; exact station key extraction pending |
| Pharmacy Run | Post-apocalyptic Western / gang towns / moral compromise | Americhaos 1994 | Native source rules; no D&D level model | CC0 | source/licence verified; DOS module content extraction pending |

## Open anthology completion pipeline

`Adventure Anthology One`, 1st Edition Release 21, provides a batch of short Basic Fantasy adventures with explicit party/level guidance and anthology text designated Open Game Content under the source OGL declaration. Full queue lives in `_index/basic-fantasy-aa1-pipeline.md`.

Current pipeline state:
- Merilla's Magic Tower: QA, machine schema validation passed
- Gold in the Hills: QA, machine schema validation passed
- Beneath Brymassen: QA, machine schema validation passed
- The Zombraire's Estate: researching
- 10 additional AA1 adventures queued with source progression bands recorded

## Parallel completion lanes

### Lane A - Basic Fantasy / OGL
Close visual-map and OGL packaging gates for Merilla, Gold and Beneath, while extracting the remaining AA1 queue.

### Lane B - Sci-fi / space horror
Prioritise complete, open sources: Leviathan, The Return of the XBRC Terror, Cascading Failure, Derelict Transdimensional Anomaly, Nautilus of Time and The Horror of Station XK-629.

### Lane C - Post-apocalyptic
Prioritise These Pillars Remain, The Chalk-Marked Grave, Pharmacy Run and additional open Eco Mofos/jam scenarios whose full text can be extracted.

### Lane D - Gothic / vampire / proprietary compatibility
The Old Blood is now approved. Finish The Crypt of Unending Hunger as the next open vampire built-in; preserve Ravenloft and Vampire: The Masquerade as metadata/private-import unless separate rights permit more.

Every lane is research-only until the central approval gate verifies source, licence, ruleset/progression, canon graph, adversarial QA and machine validation.

## High-priority next built-in candidates

| Campaign | Genre | Native ruleset | Licence | Why high priority |
|---|---|---|---|---|
| Pharmacy Run | Post-apocalyptic Western | Americhaos 1994 | CC0 | Open post-apocalyptic campaign story with clean commercial reuse rights; executable text still needs extraction |
| The Return of the XBRC Terror | Sci-fi salvage/survival horror | System-neutral | CC BY-SA 4.0 | Open one-page derelict scenario; non-fantasy completion priority |
| Cascading Failure | Sci-fi collapsing-ship survival | System-neutral | CC BY-SA 4.0 | Real-time failure state, victims, loot and hidden antagonist; strong AI state-machine test |
| Derelict Transdimensional Anomaly | Sci-fi pointcrawl | System-neutral | CC BY-SA 4.0 text/map | Branching non-combat exploration |
| Nautilus of Time | Procedural time-travel derelict | System-neutral | CC BY-SA 4.0 | Randomised levels/time paradoxes; creator actual-play evidence exists |
| The Horror of Station XK-629 | Asteroid station horror | System-neutral | CC BY-SA 4.0 | Compact survival-horror template candidate |
| The Zombraire's Estate | Gothic/undead estate | Basic Fantasy | OGL v1.0a / AA1 OGC | Levels 2-5; strong gothic branch candidate |
| Night of the Necromancer | Village siege / necromancer | Basic Fantasy | OGL v1.0a / AA1 OGC | Levels 3-5; excellent state-machine/siege diversity |
| The Crypt of Unending Hunger | Gothic/vampire dungeon | Cairn monsters | CC BY 4.0 | Open vampire content without VTM IP |
| The Ghosts of Aramoor | Coastal pirate-ghost horror | System-neutral; OSR intended | CC BY-SA 4.0 | Fully open one-page ghost adventure |
| These Pillars Remain | Post-apocalyptic survival horror | self-contained one-page TTRPG | CC BY-SA 4.0 | Fast post-apocalyptic completion once source sheet captured |
| The Chalk-Marked Grave | Weird post-apocalyptic pointcrawl | Cairn / Eco Mofos | CC BY-SA 4.0 | Factions, relics, wasteland locations and hive dungeon |
| COMPOUND INTEREST | Southern-gothic / mutagenic modern horror | FIST | CC BY-SA 4.0 text | Modern/alt-history horror expansion |
| A Pale Lantern | Science-fantasy / cosmic dungeon | Shadowdark | CC0 original content | Levels 4-6 |
| Terror of Dunmoor | Regional sandbox horror/fantasy | Shadowdark | CC0 original content | Levels 1-2; three simultaneous threats |

## Proprietary/private-import catalogue

These can be catalogued with public metadata and supported through user-owned/private source import, but DungeonMasterOS must not ship protected campaign text/story as built-in content without separate rights.

| Campaign/source | Genre/setting | Ruleset | Progression | DMOS disposition |
|---|---|---|---|---|
| Curse of Strahd | Ravenloft gothic horror | D&D 5e 2014 | Levels 1-10 | metadata + private import |
| Ravenloft: The Horrors Within | Domains of Dread horror anthology/campaign framework | current D&D rules | varies | metadata + private import |
| The Crimson Gutter | Vampire urban horror | Vampire: The Masquerade V5 | V5 dots/XP, no levels | metadata + private import |
| Fall of London | Vampire chronicle | Vampire: The Masquerade V5 | V5 dots/XP | metadata + private import |
| Chicago by Night V5 | Vampire city chronicle/source | Vampire: The Masquerade V5 | V5 dots/XP | metadata + private import |

## Coverage snapshot

- Approved built-in campaigns total: **4**
- Approved gothic/vampire/ghost built-ins: **2** (`Born Into Black Nights`, `The Old Blood`)
- Story/canon/adversarial QA complete and machine-validated but OGL/map release-gated: **3 Basic Fantasy campaigns** (`Merilla's Magic Tower`, `Gold in the Hills`, `Beneath Brymassen`)
- Mature sci-fi QA architecture: `Leviathan`
- Approved post-apocalyptic: **0**
- Approved sci-fi/space horror: **0**
- VTM: proprietary private-import path established; no built-in copyrighted chronicle
- Ravenloft: proprietary private-import path established; no built-in copyrighted adventure

## Production rule
A title does not count as a completed/release-ready campaign merely because it has a synopsis or a folder. It counts only when:
1. native ruleset/progression is verified;
2. rights/distribution disposition is verified;
3. locations/NPCs/factions/items/clues/encounters are extracted sufficiently for play;
4. hard/conditional/soft canon is separated;
5. story graph supports 3-5 contextual choices plus free text;
6. failure/retreat/sequence breaking is represented;
7. adversarial AI-DM QA passes;
8. source attribution is ready for the public UI;
9. machine-readable template passes schema/format validation;
10. any source-specific release package/licence obligations are cleared;
11. final approval is made by the central DungeonMasterOS campaign gate after reviewing all lane/submission work.
