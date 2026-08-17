# DungeonMasterOS Campaign Ruleset Registry

Every campaign template must declare its native ruleset and edition/version. `Level` is only used when the native system actually has levels.

## Support vocabulary

- `native` - written for this exact ruleset/edition.
- `direct-compatible` - source explicitly says it works with this rules family with little/no conversion.
- `system-agnostic` - source intentionally avoids system-specific mechanics.
- `converted` - DungeonMasterOS has explicit conversion notes for this ruleset.
- `tested` - the conversion has been run through mechanical QA or actual play evidence.
- `private-import-only` - DungeonMasterOS may support a user's legally owned campaign source but cannot ship the protected campaign text/story as built-in content.
- `metadata-only` - campaign can be catalogued but not redistributed/adapted as a built-in template under the verified rights.

## Progression models

- `levels` - D&D, Shadowdark, many OSR games.
- `xp` - advancement through XP without a universal level ladder.
- `ranks` - tier/rank based systems.
- `advances` - discrete advancements, improvements or moves.
- `dots` - Storyteller/Storytelling family traits and experience expenditure.
- `narrative` - fiction-triggered progression rather than numeric level.
- `none` - one-shot/no assumed advancement.
- `system-specific` - anything that does not fit cleanly above.

## Rulesets currently represented or targeted

| Ruleset / family | Typical progression | Campaign support policy | Notes |
|---|---|---|---|
| D&D 5e (2014) | levels | native / converted / private-import | Official copyrighted adventures are metadata/private-import unless reuse rights separately permit templating. |
| D&D 5e (2024 rules) | levels | native / converted / private-import | Record whether a source was written for 2014, 2024, or both. |
| Ravenloft / Domains of Dread | D&D levels | setting tag + D&D edition | Ravenloft is a campaign setting, not a separate core rules engine. Official Ravenloft adventures remain protected unless separately open-licensed. |
| Shadowdark RPG | levels | native / direct-compatible | Strong open-adventure ecosystem; campaign text licence must still be checked per adventure. |
| OSR / B/X-compatible | levels or system-specific | native / direct-compatible | Never assume exact stat compatibility without source or conversion notes. |
| Cairn 2e | classless / advancement | native / direct-compatible | Many community adventures publish text under CC BY-SA 4.0. |
| Knave 2e | levels | native / direct-compatible | Open-adventure material available; verify each adventure licence. |
| Quest RPG | abilities / narrative progression | native | Do not invent levels. |
| Ironsworn | assets / advances | native / converted | Solo/co-op/GM modes possible; campaign graph may need oracle-aware scene handling. |
| Monolith | system-specific | native | Sci-fi horror/adventure support. |
| Mothership | system-specific | converted / system-agnostic / private-import | Many adventures are proprietary; system-neutral open scenarios may list Mothership as a compatible target. |
| Vampire: The Masquerade V5 | dots / XP | private-import / metadata-only | Storytellers Vault is a community-content program, not an open licence. Built-in reproductions of official/community chronicles require separate rights. |
| Vampire: The Masquerade legacy editions | dots / XP | private-import / metadata-only | Record exact edition. Do not flatten V1/V2/Revised/V20/V5 into one ruleset. |
| Chronicles of Darkness / Vampire: The Requiem | dots / XP | private-import / metadata-only | Storytellers Vault restrictions apply to Vault material. |
| 24XX family | advances / system-specific | native / direct-compatible | Many hacks explicitly use CC BY 4.0, but adventure text rights remain per work. |
| Americhaos 1994 | system-specific | native | Post-apocalyptic legacy/shareware rules target represented by Pharmacy Run. |
| BRINK | milestone / dice-pool | native / converted | SRD itself is CC BY 4.0; campaign/adventure content requires separate rights. |
| System-neutral | none / source-defined | system-agnostic | Template stores fiction, clocks, threats and outcomes independently of stat blocks. |

## Genre coverage target

The library is intentionally not D&D-only. Research queues should include at minimum:

- heroic fantasy
- dark fantasy
- gothic horror
- vampire / urban horror
- cosmic horror
- survival horror
- post-apocalyptic
- zombie / plague survival
- science fiction
- space horror
- cyberpunk / dystopian
- weird west
- modern supernatural
- mystery / investigation
- political / faction play
- hexcrawls / sandboxes
- solo / co-op capable campaigns

Ruleset compatibility is a factual field, not marketing. A campaign must not be labelled playable in a system merely because the genres look similar.
