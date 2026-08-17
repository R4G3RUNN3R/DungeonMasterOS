# The Old Blood - Central Approval Review

Date: 2026-08-17
Reviewer: DungeonMasterOS central campaign gate
Decision: **APPROVED**

## Gate 1 - Source identity and current release
PASS.
- Creator release and creator module page agree on title, Shadowdark ruleset, levels 1-2, open-ended investigation structure, three major dungeon families and 88-page scope.
- Creator page records a current PDF page-order correction. DMOS uses the current creator release as authority for version identity.

## Gate 2 - Rights / distribution
PASS.
- Original writing, layout and design are dedicated to CC0 by the creator.
- Shadowdark mechanics and third-party material are explicitly treated as separately licensed.
- DMOS template contains campaign state and source-derived fiction, not copied Shadowdark stat blocks.
- Creator attribution is retained voluntarily for provenance.

## Gate 3 - Ruleset / progression
PASS.
- Native ruleset: Shadowdark RPG.
- Creator-supported additional family: OSR-style systems.
- Progression: levels 1-2.
- Converted OSR mechanics remain adapter-specific rather than being advertised as native.

## Gate 4 - Source completeness
PASS after final audit.
- All six Sewer sectors are registered.
- All three Catacomb levels are registered.
- Both Ruins floors are registered.
- All 16 Secret Dungeon rooms are registered.
- Flooded Corridor and Flooded Shrine are registered.
- Blood Rite instructions/location and recurring cost are verified.
- Major native stat/item references are verified as existing in source while numerical mechanics remain outside the CC0 campaign-data layer.

## Gate 5 - NPC completeness
PASS.
- Full 20-name resident table is stored in `named-npc-register.json`.
- Major non-table campaign actors remain first-class NPCs.
- Four previously omitted residents were recovered during final audit: Mirela Venth, Thessin Cade, Garren Paine and Erin Druet.
- Knowledge boundaries remain explicit; a named resident is not automatically allowed to know the answer to the mystery.

## Gate 6 - Canon/state model
PASS.
- Victor is locked as initial killer.
- Edric begins dormant and can remain dormant if the Crypt is never breached.
- The Forgotten is an independent threat, not automatically Edric's minion.
- Flooded Shrine causality remains independent from Victor/Edric defeat.
- Brannam collapse and Edric restoration are separate clocks.
- Blood Rite restoration and Shrine destruction are materially different resolutions.

## Gate 7 - Player freedom / adversarial QA
PASS.
Existing QA explicitly covers:
- killing/arresting Victor early;
- entering Sewers before proving guilt;
- accusing/killing innocent clue NPCs;
- destroying Victor's shop;
- leaving Brannam;
- waking Edric and abandoning the city;
- killing Edric without solving the Shrine;
- destroying the Shrine before waking Edric;
- choosing the Blood Rite;
- stealing/desecrating optional relics;
- ignoring suggested choices and using free-text traversal.

The campaign does not require a fixed chapter order.

## Gate 8 - Machine-readable import contract
PASS.
- V2 template validation passed before approval.
- Campaign Library CI run **37** completed successfully on approval head `bb93877303b54895811d0791ef78dc675fa325ed`, satisfying the exact-head confirmation required by the original approval decision.

## Gate 9 - Source-versus-community separation
PASS.
Creator sources control identity/licence/version. Indexed copies are extraction aids only. Community reports do not overwrite canon.

## Gate 10 - Final central decision
APPROVED.

The approval is based on the combined dossier, `source-verification.md`, `keyed-location-register.json`, `named-npc-register.json`, source/provenance records, adversarial QA and v2 importer. The final exact-head Campaign Library CI confirmation has been recorded in `approval-manifest.json`.