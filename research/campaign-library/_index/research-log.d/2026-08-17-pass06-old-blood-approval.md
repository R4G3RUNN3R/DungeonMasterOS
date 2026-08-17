# Research pass 06 - The Old Blood central approval audit

Date: 2026-08-17

## Goal
Resolve every remaining source-completeness blocker for `The Old Blood`, migrate its importer to the v2 campaign schema, and approve only after central review.

## Authoritative creator verification
- Creator itch release verifies Shadowdark RPG, experienced characters levels 1-2, OSR-style compatibility, 88-page scope and CC0 dedication of original writing/layout/design.
- Creator module page independently verifies the investigative Brannam premise, three major dungeon families, open-ended structure, evolving factions, panic and failure states.
- Current itch release notes a corrected PDF page order; current creator release remains version authority.

## Detailed source audit
An indexed copy of the creator-released CC0 text was used only as an extraction aid, never as licence authority.

The audit recovered/verified:
- all six Sewer sector keys;
- all three Catacomb levels;
- both Ruins floors;
- all sixteen Secret Dungeon rooms;
- Flooded Corridor and Flooded Shrine;
- Blood Rite instructions in the second-floor Ruins Library plus annual-sacrifice and ritual-leader consequences;
- source existence of Victor, weakened Edric, restored Edric and The Forgotten native mechanics/stat blocks;
- Whispering Blade of Blood state dependencies;
- the full 20-name resident table.

## NPC corrections
Four names absent from the previous resident notes were recovered:
- Mirela Venth, Crowmarket herbalist and Victor ingredient-history clue;
- Thessin Cade, Crowmarket chandler and Annex-crate witness;
- Garren Paine, Eastward cobbler, with no major clue invented;
- Erin Druet, Crowmarket fishmonger and Victor purchase-history clue.

`named-npc-register.json` now preserves the full resident table. Major actors outside that table remain separate first-class NPCs.

## Keyed-location register
Created `keyed-location-register.json` covering the exact source area names for:
- Moorgate, Eastward, Old Docks, Crowmarket, Tradesman's Ward, Northgate and Annex sewer sectors;
- Catacomb levels 1-3;
- Ruins floors 1-2;
- Secret Dungeon;
- Flooded Shrine.

## Template migration
The older pre-v2 `dmos-template.json` was replaced with a compact v2 schema-controlled template. It references the detailed story graph and source registers rather than duplicating every room into the root importer.

## QA / central gate
The existing adversarial graph already covered early Victor death/arrest, sequence-breaking into Sewers, false accusations, shop destruction, leaving Brannam, waking/abandoning Edric, killing Edric without resolving the Shrine, Shrine-first resolution, Blood Rite, optional relic consequences and arbitrary free-text actions.

Central review passed:
- source identity/version;
- CC0 rights boundary;
- Shadowdark level range;
- source completeness;
- named NPC completeness;
- layered canon/state model;
- adversarial player freedom;
- source/community separation;
- v2 import structure.

The v2 migration passed the Campaign Library CI validation step before approval. The approved status/log commits are followed by a new exact-head CI run; approval is not considered mechanically locked until that run is green.

## Result
`The Old Blood` is the fourth DungeonMasterOS approved built-in campaign and the first approved built-in specifically centred on a vampire investigation/city-collapse structure.

Native ruleset: **Shadowdark RPG**.
Progression: **levels 1-2**.
Licence: **CC0** for original campaign content, with referenced rules mechanics separately licensed.

## Files created/updated
- `campaigns/the-old-blood/source-verification.md`
- `campaigns/the-old-blood/named-npc-register.json`
- `campaigns/the-old-blood/keyed-location-register.json`
- `campaigns/the-old-blood/dmos-template.json`
- `campaigns/the-old-blood/approval-review.md`
- `campaigns/the-old-blood/approval-manifest.json`
- `campaigns/the-old-blood/qa.md`
- `campaigns/the-old-blood/README.md`
- `_index/completion-dashboard.md`
- `_index/public-updates.md`
- `_index/public-updates.d/2026-08-17-old-blood-approved.json`

## Next central targets
1. Obtain the first approved sci-fi/space-horror campaign.
2. Obtain the first approved post-apocalyptic campaign.
3. Continue AA1 extraction without approving OGL material until its release-package requirements are fully satisfied.