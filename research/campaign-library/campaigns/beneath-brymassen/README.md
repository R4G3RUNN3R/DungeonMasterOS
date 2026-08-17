# Beneath Brymassen

Status: `qa`

## Executive summary
`Beneath Brymassen` is a short introductory dungeon from `Adventure Anthology One`, 1st Edition Release 21. It supports two distinct modes that DungeonMasterOS must keep separate:

1. **Dungeon crawl / bounty mode**: Brymassen's mayor pays for proof that humanoid raiders beneath the local mill have been cleared out.
2. **Rescue mode**: four kidnapped children must be recovered from the dungeon. Room 14 changes materially in this mode.

## Player-facing metadata
- Genre: low-level dungeon crawl, rescue, traps, old ruins, humanoid factions
- Native ruleset: **Basic Fantasy Role-Playing Game**
- Intended group: **3-6 beginning player characters**
- Progression guidance: treat as **1st-level / beginning-character play**. The Release 21 contents entry describes it as a beginning module; the adventure title block says 3-6 beginning player characters. An independent RPG index also tags the adventure at 1st level.
- Structure: branching dungeon with optional second exit and mode-dependent finale
- Primary publisher: Basic Fantasy Project
- Source anthology: `Adventure Anthology One`, 1st Edition Release 21
- Licence: OGL v1.0a; anthology designates its entire adventure text as Open Game Content, while artwork/branding remain excluded Product Identity.

## DMOS guardrails
- Never merge the two Room 14 versions. `rescue` mode uses the kidnapped children and kobold chieftain; `crawl` mode uses the abandoned bird cage and stirges.
- Room 8 kobolds stole only part of their tribe's treasure and are hiding from their chieftain. They are not automatically loyal reinforcements for Room 14.
- The grizzled hobgoblin in Room 11 is an information broker and is not hostile unless attacked.
- The orcs in Room 12 are the slavers the Room 14 rescue-mode kobolds are considering selling the children to.
- The hidden shrine in Room 2 is a genuine sanctuary and its chalice only functions inside that room.
- The apparent secret-door clue in Room 7 is false. The AI may not reward repeated searching by inventing a passage.
- The east route from Room 5 genuinely provides a hidden exit to the outside.

## Current QA state
Source text for rooms 1-14, both hooks and both Room 14 variants has been recovered from the current Release 21 anthology. Story graph and adversarial QA are included in this dossier. Machine validation and production OGL packaging remain release gates before `APPROVED`.