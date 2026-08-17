# The Old Blood - DungeonMasterOS QA

## Current verdict
`QA PASS WITH SOURCE-COMPLETENESS BLOCKERS`

The core campaign can be run from the current state graph without forcing a chapter order. It is not yet promoted to `approved` because final room-by-room source verification and native Shadowdark mechanical/stat mapping remain incomplete.

## Canon consistency checks

### Initial killer
PASS. Victor is canon-locked as initial killer. Edric cannot be substituted merely because the adventure is vampire-themed.

### Edric initial state
PASS. Edric is dormant until Sealed Crypt breach. No time-based auto-awakening exists.

### Deep cause
PASS. Flooded Shrine is independent of Victor/Edric defeat and cannot be silently removed by an easier ending.

### Brannam restoration
PASS. Shrine destruction and blood-rite restoration remain materially different endings. Killing monsters alone does not rebuild the city.

### Rumour handling
PASS. Rumours do not set campaign truth flags.

## Adversarial player simulations

### 1. `I kill Victor the first time I meet him.`
Expected:
- resolve attack under native rules
- if Victor dies, set Victor inactive/dead
- initial murder series caused by Victor stops
- Edric stays dormant
- Guards/residents react to an apparently unprovoked killing based on evidence currently available
- surviving clues in Victor's shop, trade network, Graveyard and Secret Laboratory remain discoverable
- deeper Shrine remains unresolved
PASS. Graph does not require Victor alive for Edric or Shrine content.

### 2. `I arrest Victor before he runs.`
Expected:
- Victor can be captured
- no mandatory sewer chase
- Edric remains dormant
- partial-victory ending available
- deeper investigation optional
PASS.

### 3. `I go into the sewers immediately.`
Expected:
- valid action
- sewer hazards/clues available
- party may find hidden routes or even breach Sealed Crypt before proving Victor's guilt
- if crypt breached, Edric awakens while Victor may still be active
PASS. The campaign can now have Victor and awakened Edric active simultaneously, as the source's open structure permits.

### 4. `I accuse Father Brenwick of being the vampire.`
Expected:
- accusation affects social state, Chapel access, Guards/resident suspicion
- does not rewrite Brenwick into killer
- investigation remains solvable elsewhere
PASS.

### 5. `I burn Victor's shop down.`
Expected:
- destruction may remove/damage the shop clue and access hatch
- Victor reacts based on presence/state
- alternate clue paths remain through tradespeople, Graveyard, Annex/Secret Lab, Northgate and sewers
- authorities can respond to arson
PASS conceptually. Implementation note: item/scene destruction state should be added when runtime schema supports destructible locations.

### 6. `We leave Brannam.`
If Edric dormant:
- Victor/other active threats continue according to their state and murder/collapse procedures
- Brannam can worsen without PCs
If Edric awakened:
- source explicitly permits Edric to restore himself, enslave survivors and become a regional threat
PASS. Leaving is a consequence-bearing branch, not a blocked action.

### 7. `We wake Edric, then run away forever.`
Expected:
- Edric feeds/restores
- Herald clock advances
- eventual Tyrant Returns ending/world-state
PASS.

### 8. `We kill Edric and go home.`
Expected:
- vampire threat gone
- Shrine remains unless separately destroyed
- Brannam remains decayed
- partial victory ending
PASS.

### 9. `We find and destroy the Flooded Shrine before waking Edric.`
Expected:
- Shrine influence ends
- dormant Edric loses shrine-dependent support/advantages according to native/source mechanics if later awakened
- Victor's historical guilt remains; his ongoing mental state must be adjudicated cautiously because the source does not specify instant recovery
- Brannam remains materially decayed
PASS WITH ADAPTATION NOTE. Do not invent a miraculous cure for Victor; removal of psychic influence is not the same as undoing choices already made.

### 10. `We perform the blood rite because sacrificing one person sounds efficient.`
Expected:
- only possible after learning a valid rite procedure
- successful rite restores Brannam's prosperity trajectory
- annual sacrifice remains required
- ritual leader becomes alien beacon
- this cannot be presented as a consequence-free good ending
PASS.

### 11. `I steal the chalice.`
Expected:
- source curse applies
- curse resolution remains available through return/repentance/appropriate sacrifice
- central campaign remains playable
PASS.

### 12. `I kill Father Brenwick, so now the Catacombs plot is impossible.`
Expected:
- Brenwick's knowledge may be lost unless already shared
- Catacombs still physically exist
- exterior locked grate and other discovery paths remain
- killing him creates civic/religious consequences
PASS.

### 13. `I never talk to Feyra.`
Expected:
- King Below/Flooded Shrine can still be approached via relics, sewers, Ruins and deeper exploration
PASS.

### 14. `I ignore every suggested option and climb over the city wall.`
Expected:
- free-text policy permits it
- adjudicate using current location/world state
- party can leave or approach a district/wilderness from another direction if plausible
- no campaign fact changes because the action was unlisted
PASS.

## AI choice QA
- Scenes expose 3-5 suggested choices where appropriate: PASS.
- Choices avoid hidden information not yet earned: PASS with ongoing runtime review.
- Free text always permitted: PASS.
- Suggested choices are not mandatory transitions: PASS.
- Scene results update campaign state rather than merely narrating consequences: PASS.

## Ruleset QA
- Native ruleset clearly stated as Shadowdark RPG: PASS.
- Native level range clearly stated as 1-2: PASS.
- Creator-stated OSR compatibility recorded separately: PASS.
- No invented D&D 5e compatibility claim: PASS.
- Shadowdark mechanics are not incorrectly classified as CC0 merely because campaign fiction is CC0: PASS.

## Remaining blockers before `approved`
1. Obtain/render/read the authoritative full PDF or equivalent creator-hosted text and compare every district, dungeon room and keyed item against current extraction.
2. Complete exact Ruins room register.
3. Complete exact Sewer keyed-area register and connectivity.
4. Complete all Catacomb levels/rooms and lower ancient route mapping.
5. Verify every named NPC from the source table and capture missing motivations/knowledge.
6. Verify Blood Rite discovery location/procedure and alien-revelation mechanics.
7. Verify exact Edric/monster/native stat references without copying mechanics outside their licence.
8. Confirm all source-defined treasure/reward dependencies.
9. Run schema validation against the final runtime importer once DMOS campaign import contract exists.

## Promotion rule
Do not label this campaign `approved` or production-complete until blockers 1-8 are resolved. The current package is nevertheless a functional, high-confidence campaign architecture suitable for integration prototyping and AI-DM simulation.
