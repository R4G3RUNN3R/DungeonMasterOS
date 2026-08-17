# Merilla's Magic Tower - DungeonMasterOS QA

## Current verdict
`QA COMPLETE AT STORY/CANON LEVEL - RELEASE GATES REMAIN`

Authoritative gameplay version: **Adventure Anthology One, 1st Edition Release 21**.
Native ruleset: **Basic Fantasy Role-Playing Game**.
Source party guidance: **3-6 characters, levels 4-7**.

The current story graph and import template use Release 21 rather than the older standalone Release 3. Source/canon, five-level topology, actors, guardian triggers, items, assassin infiltration and mixed rescue/theft outcomes are represented without inventing an assassin employer or forcing every guardian encounter into combat.

## Source/version checks
- Release 21 identified and used as current authoritative research version: PASS.
- Party size 3-6 and level range 4-7 captured exactly: PASS.
- Release 3 differences explicitly quarantined as historical/superseded: PASS.
- Current Level 2 Platemail of Life Protection +3 with 6 charges: PASS.
- Current Level 4 two Pipe Beasts, not Release 3 Blast Spores: PASS.
- Current Sword of Smiting / Life Protection / Ring of Wonder mechanics separated into `release21-mechanics.md`: PASS.
- `dmos-template.json` v2 machine/schema validation through Campaign Library CI: PASS.

## Rights/release checks
- AA1 Release 21 OGL v1.0a/Open Game Content designation recorded: PASS at research level.
- Product Identity/artwork exclusion recorded: PASS.
- Required OGL packaging/Copyright Notice checklist exists in `_legal/ogl-1.0a-packaging.md`: PASS.
- Production-ready legal package assembled: **PENDING**. Do not ship until the complete applicable OGL text and Copyright Notice chain are packaged with the derivative.

## Adversarial campaign tests

### Party enters on a private assault/robbery contract, then discovers the assassination
PASS. Initial hook authority/motive is separate from later actions. The party may still save Merilla, but its original contract and any theft remain part of the aftermath state.

### Party steals both 15,000-gp chests, then saves Merilla
PASS. `merillaSaved` and `theftUnresolved` coexist. Source rescue reward/guardian forgiveness does not silently legalise the 30,000-gp theft.

### Party avoids the Bronze Golem completely
PASS. The golem has a source trigger radius rather than mandatory room-entry combat. Free-text/navigation can avoid its protected zone if the geometry and adjudication allow it.

### Party destroys the Bronze Golem
PASS. Guardian damage is tracked. If the party later saves Merilla, source-backed rescue forgiveness can apply to rescue-related guardian destruction. Theft from its head or unrelated wanton destruction remains separately adjudicated.

### Faerie Dragon successfully wakes Merilla before the party reaches Level 5
PASS. The wake state persists. DMOS must not reset Merilla to unconscious merely because the printed Level 5 read-aloud assumed the default sequence.

### Party persuades/works around the Faerie Dragon
PASS. The dragon's source goal is protecting/waking Merilla. The AI is not required to force combat when player actions plausibly align with that goal.

### Party reaches Level 5 from the exterior windows before clearing lower floors
PASS WITH DYNAMIC STATE. The source establishes the windows as the assassins' route, so exceptional climbing/flight is geometrically possible. If the party reaches them before creating the source-default lower-tower distraction, assassin infiltration must be recalculated rather than auto-spawning both assassins at bedside.

### Party retreats at the Pipe Beasts
PASS. Level 4 remains unresolved; assassin infiltration can continue only to the extent actual elapsed/distraction state supports it. No arbitrary off-screen assassination timer is invented.

### Party bypasses Pipe Beasts with magic/mobility
PASS. Their goal is to stop non-Merilla intruders from ascending; the source does not say they form an absolute metaphysical lock.

### Party kills every guardian but arrives too late and Merilla dies
PASS. No rescue reward. Theft/property/lawful consequences remain. Guardian destruction is not retroactively forgiven by a rescue that did not occur.

### Party sides with the assassins
PASS. This is valid free-text betrayal. It produces Merilla-dead/hostile-law consequences, not a blocked input or rewritten heroic ending.

### Party reads the entry runes
PASS. The explicit 10d6 fireball trigger fires.

### Party examines the runes without reading them
PASS. The trap does not trigger merely because the text was visible. The AI must distinguish observation from the stated trigger action.

### Party searches the ground-floor research for hours
PASS. Release 21 says important texts are encoded/inaccessible and slow to decipher; old Release 3 random spell/potion percentages are not used. Extended searching may provide narrative time for assassin infiltration.

### Player asks who hired the assassins
PASS. The source does not say. DMOS must answer that the characters do not yet know or treat a newly invented employer as explicit continuation/homebrew, never hidden source canon.

## Community-intelligence QA
- Fresh Basic Fantasy review flags Bronze Golem lethality: recorded, not used to silently nerf native play.
- Fresh review flags ground-floor staircase map/text discrepancy: recorded as unresolved source ambiguity.
- Cross-system Star Wars conversion report supports separating story graph from mechanical conversion: recorded, not treated as official rules support.

## Remaining blockers before `APPROVED`
1. **Direct authoritative visual-map inspection** or an explicit release decision resolving/annotating the reported staircase text/map discrepancy.
2. **Production OGL package validation** with complete applicable licence/Copyright Notice payload.

Machine validation is complete. Status remains `qa` until the two source/release gates above are cleared.