# The Old Blood - DungeonMasterOS Campaign Dossier

## Status
`templated` - high-confidence campaign structure and executable story graph drafted from the creator's CC0 release plus indexed source text. Final room-by-room/stat QA remains before `approved`.

## Identity
- Title: The Old Blood
- Creator / publisher: Doomed Zone
- Primary source: https://doomedzone.itch.io/the-old-blood
- Creator module page: https://doomed.zone/modules/old_blood/old_blood/
- Native ruleset: Shadowdark RPG
- Creator-stated compatibility: any OSR-style system
- Progression: levels 1-2
- Genre: gothic horror, vampire horror, mystery, investigative city crawl, decaying urban sandbox
- Scope: 88-page modular adventure
- Core setting: Brannam, a dying former trade city on the Aulach River

## Rights
The creator explicitly releases all original writing, layout and design under CC0/public-domain dedication. Referenced Shadowdark mechanics and third-party materials remain under their own licences. DungeonMasterOS may adapt the original campaign fiction and structure, but should source rules mechanics from an authorised Shadowdark rules integration rather than treating the campaign's use of Shadowdark as a licence to republish the whole game system.

## Player-facing pitch
Brannam is dying beneath the shadow of a ruined tyrant's keep. Two residents have been found drained of blood, and the city whispers that its long-dead vampire lord has returned. The truth is worse, older and buried deeper. Investigate the murders while fear spreads through the streets, decide whom to trust, and determine whether Brannam should be saved at all.

## Campaign architecture
The adventure is deliberately non-linear. DungeonMasterOS must run it as a living state machine rather than a chapter script.

Primary dynamic states:
1. Victor Marlowe active / exposed / captured / dead / escaped.
2. Edric von Braech dormant / awakened / feeding / restored / defeated.
3. Flooded Shrine intact / discovered / destroyed / blood rite restored.
4. Brannam collapse stage and public panic.
5. Nightly murder counter and active murderer pool.
6. Discovery states for Victor's apothecary, secret laboratory, sewer escape route, Sealed Crypt, Catacombs and Flooded Shrine.

## Principal truths
- The initial blood-drained murders are committed by Victor Marlowe, not Edric.
- Victor is a grieving alchemist being psychically manipulated by the Flooded Shrine.
- Victor believes blood experiments can restore his dead wife Evelyn.
- Edric remains dormant until Victor or the PCs breach the Sealed Crypt.
- If awakened, Edric seeks refuge in the Catacombs beneath Saint Arlen's Chapel and feeds until restored.
- The Flooded Shrine is an ancient alien biological device associated with the King Below; it corrupted Edric and now manipulates Victor.
- Defeating Victor or even Edric does not permanently resolve Brannam. Long-term resolution requires destroying the Flooded Shrine or resuming the annual Sacrificial Blood Rite.

## Ending space
At minimum the graph supports:
- Victor stopped early; Edric remains dormant; Brannam remains cursed and stagnant.
- Victor escapes into the crypt and awakens Edric; PCs later defeat Edric.
- PCs awaken Edric themselves.
- PCs leave Brannam; Edric eventually restores himself and becomes a regional threat.
- Flooded Shrine destroyed; alien influence ends but Brannam remains a decaying city with no magical restoration.
- Sacrificial Blood Rite restored; Brannam regains prosperity at the recurring moral cost of annual sacrifice, and the ritual leader becomes marked by the alien power.
- Catastrophic failure where Victor/Edric/the Shrine remain unresolved and Brannam collapses.

## DMOS implementation rule
The AI must never assume a single correct investigation path. Clues can be discovered in different districts and NPC conversations. Player refusal, premature descent into the sewers, killing Victor, helping Victor, waking Edric early, leaving the city, destroying the shrine or embracing the blood rite are all valid state transitions. Consequences, not rails, preserve the campaign.
