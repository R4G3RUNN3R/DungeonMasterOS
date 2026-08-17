# The Old Blood - DungeonMasterOS Campaign Dossier

## Status
`APPROVED` - source, licence, ruleset/progression, keyed locations, named NPCs, canon/state graph, adversarial AI-DM QA and v2 import structure have passed the DungeonMasterOS central campaign gate. Final exact-head CI confirmation is performed after the approval/log commits.

## Identity
- Title: The Old Blood
- Creator / publisher: Doomed Zone
- Primary source: https://doomedzone.itch.io/the-old-blood
- Creator module page: https://doomed.zone/modules/old_blood/old_blood/
- Native ruleset: **Shadowdark RPG**
- Creator-stated compatibility: OSR-style systems
- Progression: **levels 1-2**
- Genre: gothic horror, vampire horror, mystery, investigative city crawl, decaying urban sandbox
- Scope: 88-page modular adventure
- Core setting: Brannam, a dying former trade city on the Aulach River

## Rights
The creator releases original writing, layout and design under CC0/public-domain dedication. Referenced Shadowdark mechanics and third-party materials remain under their own licences. DungeonMasterOS may adapt the original campaign fiction and structure, while exact Shadowdark mechanics/stat blocks must come from an authorised rules integration.

## Player-facing pitch
Brannam is dying beneath the shadow of a ruined tyrant's keep. Two residents have been found drained of blood, and the city whispers that its long-dead vampire lord has returned. The truth is worse, older and buried deeper. Investigate the murders while fear spreads through the streets, decide whom to trust, and determine whether Brannam should be saved at all.

## Campaign architecture
The adventure is deliberately non-linear. DungeonMasterOS runs it as a living state machine rather than a chapter script.

Primary dynamic states:
1. Victor Marlowe active / exposed / captured / dead / escaped.
2. Edric von Braech dormant / awakened / feeding / restored / defeated.
3. Flooded Shrine hidden / discovered / intact / destroyed / blood-rite restoration state.
4. Brannam collapse stage and public panic.
5. Nightly murder counter and active murderer pool.
6. Discovery states for Victor's apothecary, Secret Laboratory, sewer routes, Sealed Crypt, Catacombs, Ruins and Flooded Shrine.

## Principal truths
- Victor Marlowe committed the initial blood-drained murders, not Edric.
- Victor is a grieving alchemist being psychically influenced by the deeper Shrine.
- Edric remains dormant until the Sealed Crypt is breached.
- If awakened and not immediately stopped, Edric seeks refuge in Saint Arlen's Catacombs and feeds until restored.
- The Flooded Shrine is the deeper alien biological influence associated with the King Below.
- Defeating Victor or Edric does not permanently resolve Brannam.
- Long-term outcomes include destroying the Shrine or restoring prosperity through the Sacrificial Blood Rite, whose recurring annual human cost and alien consequences remain hard canon.

## Source-completeness records
- `source-verification.md`: final source audit and rights/rules boundary.
- `keyed-location-register.json`: all Sewer sectors, three Catacomb levels, both Ruins floors, Secret Dungeon rooms and Flooded Shrine.
- `named-npc-register.json`: full 20-name source resident table.
- `approval-review.md`: central gate decision.
- `approval-manifest.json`: machine-readable release/approval record.

## Ending space
The campaign supports, among other outcomes:
- Victor stopped early while Edric remains dormant.
- Victor or the PCs awaken Edric.
- Edric is defeated while the deeper Shrine remains unresolved.
- The players leave Brannam and Edric eventually becomes a regional threat.
- The Flooded Shrine is destroyed, ending its local influence without magically restoring the city.
- The Blood Rite is restored, allowing Brannam to recover at the recurring cost of human sacrifice and alien attention.
- Brannam collapses while one or more threats remain unresolved.

## DMOS implementation rule
The AI must never assume a single correct investigation path. Clues can be discovered through different districts, NPCs, physical evidence and dungeon routes. Player refusal, premature sewer exploration, killing or arresting Victor, waking Edric early, abandoning the city, destroying the Shrine or embracing the Blood Rite are all valid state transitions. Consequences, not rails, preserve the campaign.