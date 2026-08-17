# Born Into Black Nights

Status: `approved`

## Executive summary

`Born Into Black Nights` is a short gothic/undead adventure by Jason Renslow (JunkyardTornado) written for Cairn. The heroes arrive in Bertram's Grove, a mixed human/gnome settlement suffering increasingly disturbing nightmares. The burgomaster's daughter Zahra is affected most severely and sleepwalks toward an old tomb in the woods.

The true cause is not a random curse: grave robber Kyran disturbed Bertram's tomb and stole Bertram's ring. Bertram's spirit now seeks proper rest. The adventure can be solved through investigation, wilderness travel and tomb exploration, but merely killing or destroying the undead does not necessarily resolve the haunting.

## Player-facing metadata

- Genre: gothic fantasy, ghosts/undead, town investigation, forest travel, dungeon exploration
- Native ruleset: **Cairn**
- Progression model: Cairn; the source does **not** state a D&D-style level range
- Additional support: creator states the adventure is readily adaptable to other fantasy TTRPGs; DMOS must use an explicit conversion adapter rather than inventing native stats
- Format: short adventure / one-shot or campaign starting location
- Primary source: https://junkyardtornado.itch.io/born-into-black-nights
- Author: Jason Renslow / JunkyardTornado
- Licence: text CC BY-SA 4.0
- Source update observed: 2026-07-16

## Why it suits DungeonMasterOS

The adventure has several independent entry hooks and a non-obvious resolution condition. The AI-DM must understand that:

1. Zahra's sleepwalking is a symptom and clue, not the villain.
2. Kyran caused the disturbance but is not the supernatural final enemy.
3. Osian knows the family-line connection and can identify Bertram's stolen ring.
4. Bertram wants rest rather than conquest.
5. Killing Bertram without restoring him correctly causes the problem to return.
6. Completely destroying Bertram makes matters worse: he can return later as a ghost and resume the haunting/possession threat.

This makes the scenario a useful test of clue graphs and outcome-state handling rather than simple combat completion.

## Approval state

The full textual adventure structure has been extracted and cross-checked against the creator's primary page for title, author, ruleset and licence. Canon locks, ten-room tomb topology, NPC knowledge, encounters, items, alternate clue paths, failure states and a v2 DungeonMasterOS campaign template are present.

Adversarial story/canon QA passed. The branch-level `Campaign Library CI` also successfully parsed the library and schema-validated the v2 campaign templates at commit `f82e0bf16d4d9fefdbc7573fa4f3a5188757c1e5`.

The visual town/tomb maps are useful enhancements but non-blocking for play because the source text specifies the required room connections and explicitly allows the Warden to expand Bertram's Grove with minor local details.

## Release note

This template's adapted text is subject to the source CC BY-SA 4.0 terms. Attribution and ShareAlike obligations must remain attached when the built-in campaign is packaged for users.
