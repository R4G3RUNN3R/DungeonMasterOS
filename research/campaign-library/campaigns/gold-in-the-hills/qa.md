# Gold in the Hills - DungeonMasterOS QA

## Current verdict
`QA COMPLETE AT STORY/CANON LEVEL - RELEASE GATES REMAIN`

Authoritative gameplay version: `Adventure Anthology One`, 1st Edition Release 21.
Native ruleset: **Basic Fantasy Role-Playing Game**.
Source guidance: **2-4 characters, levels 1-3**.

The six-area source is fully represented with persistent alert state, pit state, leadership movement, Area 5 non-reinforcement, mining-automaton command/failure rules, elevator risk and a hard boundary between written source and generated deeper-mine continuation.

## Source / rights QA
- Current anthology source and level/party guidance: PASS.
- OGL/Open Game Content disposition recorded: PASS at research level.
- Community homebrew separated from source canon: PASS.
- Production OGL package / complete Copyright Notice: PENDING.

## Adversarial tests

### Party sneaks past or silently captures entrance guards
PASS. `mineAlerted` remains false if no warning actually reaches deeper rooms. Leadership stays in Area 6 and pit does not become armed by the retreating guard.

### Party charges the entrance loudly
PASS. Guards fire/retreat, warning propagates, pit is armed and leadership is mobilised into Area 4 according to source alert state.

### Party lets one guard escape but kills the other
PASS. One successful warning is enough to establish global alert state.

### Party sees the pit and uses its lever
PASS. The source explicitly provides the disable lever. The AI may not insist the pit must be jumped because it wants a hazard scene.

### Party crosses the one-foot ledge
PASS. Source-supported bypass. Adjudicate normally rather than auto-triggering the pit.

### Party goes to the elevator before the main mine
PASS. Tentacle Worm/elevator scene can occur before Area 4; mine alert state remains whatever prior actions established.

### Party repairs the elevator and immediately descends
PASS WITH SOURCE BOUNDARY. Apply the source 5% rope-failure chance. If descent succeeds, written campaign canon ends and the system must clearly load/create a `DMOS continuation/homebrew` layer rather than hallucinating Ray Allen's lower mine.

### Party attacks Area 4 while mine is unalerted and kills everything within six rounds
PASS. Leadership remains Area 6 unless another action/noise condition changes that state.

### Area 4 battle reaches round seven while leadership remains Area 6
PASS. Xikek/Snerk/Yuliak investigate/move toward the fight as source directs.

### Party expects Area 5 goblins to reinforce Area 4
PASS. They do not. Their explicit day-off behaviour is preserved even if it is tactically silly.

### Party negotiates with the Area 5 goblins
PASS. Free-text negotiation is valid. Source does not provide a broad diplomatic settlement, so any larger alliance/peace becomes explicit emergent/homebrew consequence rather than hidden canon.

### Party speaks Dwarven and orders automaton to `stop`
PASS. Source-supported simple command.

### Party tells automaton a long natural-language plan
PASS. The machine does not suddenly understand it. AI requires/derives only the source-supported simple Dwarven command and preserves ambiguity/failure.

### Party tells automaton to `attack enemies` when no recognised traditional dwarf enemy is present
PASS. Source fallback attacks nearest object/creature. AI must not protect the party from the bad command by secretly upgrading target recognition.

### Automaton moves repeatedly
PASS. Apply 20% catastrophic-failure chance while in motion. On failure it is destroyed and damages everyone within 20 feet.

### Party repairs automaton and sells it
PASS. Source explicitly supports extracting it to civilisation and selling it for several thousand gp.

### Party assumes the mine contains unlimited gold
PASS. AI refuses that premise as source truth. The earthquake-exposed vein is almost played out.

### Party retreats after alerting the mine, rests, then returns immediately
PASS. Alert/pit/actor state persists unless sufficient fictional time and source-consistent actions justify a new posture. Rooms do not reset because an encounter ended.

### Party kills Xikek but leaves tribe alive
PASS. Xikek-dead state persists. The source does not specify a successor; a later leadership struggle must be labelled emergent continuation/homebrew.

## Community intelligence QA
- 2015 family actual play used four level-1 characters and maximum HP; still treated as a dangerous outing. Recorded as balance intelligence, not a source change.
- `Steel Fisted Goblins` from that GM's improvisation are explicitly excluded from canon.
- Scarlet Heroes solo and DCC-style club runs are portability evidence only, not approved rules adapters.

## Remaining blockers before `APPROVED`
1. Machine validation of `dmos-template.json` against v2 schema.
2. Production OGL package/complete Copyright Notice review.
3. Final direct visual-map check before a release build if exact corridor rendering/navigation is generated from map coordinates.

Story/canon/adversarial QA is complete; release status remains `qa` until those gates clear.
