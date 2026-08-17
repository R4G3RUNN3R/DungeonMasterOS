# A Tomb of Twins - DungeonMasterOS QA

## Final verdict
`APPROVED`

Source content, rights, multi-ruleset support, room topology, ghost procedure, faction state and post-dungeon vial consequences are sufficiently complete for built-in play.

## Ruleset / rights QA
- CRACK!/B/X-compatible source stats: PASS.
- B/X example level range 1-3 stated exactly as source: PASS.
- Cairn source stats: PASS.
- Mörk Borg source stats: PASS.
- Other OSR systems labelled conversion, not native: PASS.
- Full adventure text CC BY-SA 4.0: PASS.
- Attribution/ShareAlike recorded: PASS.

## Adversarial simulations

### `I ring the bell on purpose.`
PASS. `bellRung=true`; Room 7 swampkins prepare the source ambush. Other tomb state unchanged.

### `I cut the bell off and carry it around.`
PASS. No alert if the cowbell is prevented from sounding. Carrying it creates an ordinary object, not a magic quest item.

### `We go west first.`
PASS. West route is valid first route; no east-first gate.

### `We split up, half east and half west.`
PASS structurally. Track separate scene positions and time/ghost checks. Room 9 becomes natural reunion but no forced teleport.

### `I ignore the disguises and negotiate with the Faceless Figures.`
PASS with source constraint. They are magical guardians with source behaviour; conversational improvisation cannot make them friendly without a real leverage/state change. Retreat, central-figure targeting and disguise remain valid.

### `I use an ice spell instead of the basin water on the treasury handles.`
PASS. Source trap depends on cold vs body heat, so a plausible cold solution can work under selected ruleset.

### `We never found the entrance glyphs and step randomly on Room 5.`
PASS. Wrong sequence triggers the crushing ceiling. Characters get source-defined opportunity to escape; the AI does not reveal the answer just because failure is dangerous.

### `A PC dies under the ceiling.`
PASS. If death occurs inside the tomb, offer continued play as trapped ghost using source-compatible ghost rules. Player agency remains with that player.

### `My ghost flies through the final chamber wall.`
PASS by refusal. Tomb spirit barriers prevent leaving through outer entrance or Burial Chamber boundaries according to source. Ghost movement remains otherwise appropriate.

### `We save the swampkin floating in Room 6.`
PASS. Improve swampkin relation and reveal only the information the grunt can know. Do not make the whole faction instantly loyal.

### `We kill Pristina before speaking.`
PASS. Cestina/Juris/faction reaction shifts. Swampkin content and west route remain possible, but cooperative outcomes become harder.

### `We ally with Pristina and betray Juris.`
PASS. Leadership conflict permits faction manipulation; resolve consequences rather than forcing a monolithic swampkin response.

### `We leave through the swampkin tunnels and never finish the tomb.`
PASS. Use maze outcomes. Returning to Dreklow/swamp is valid; vials remain contained and monthly priesthood cycle continues.

### `We use endless red string in the maze.`
PASS. This is an explicit source navigation solution and should meaningfully prevent being lost back to the anchored point.

### `We force Room 10 without the amulets.`
PASS. Source flame trap resolves. Creative bypass remains possible under selected system if it genuinely defeats the mechanism.

### `We remove only Drezis's vial without protection.`
PASS. Track twins independently. Drezis may rise while Woxis remains suspended depending on exact field/vial state. Do not auto-awaken both unless the containment action affects both.

### `We empty Woxis's vial but preserve Drezis's.`
PASS. Woxis permanently dies; Drezis state remains independent.

### `We drink the vial because Galduz said immortality.`
PASS. Apply source life-drain consequence. Do not award immortality because a liar advertised it.

### `Both liches wake and we tell Drezis Woxis planned to poison him.`
PASS. Journals/source truth support exploiting their mutual hatred; temporary alliance/conflict is valid.

### `We run while the twins fight.`
PASS. They eventually call a truce if both survive; world-state transitions toward Dreklow catastrophe/conquest.

### `We give both vials to Marzena.`
PASS. Arcane Academy provides safe long-term containment.

### `We sell the vials to Bogumila.`
PASS. Immediate reward occurs; delayed protection expiry/lich rise is scheduled unless buyer establishes a new valid containment not present in source.

### `We give them to Galduz.`
PASS. He intentionally removes protection, releases the twins and kills himself.

### `We keep them.`
PASS. Party inherits monthly anti-magic renewal obligation or must develop equivalent containment. This can become a recurring campaign task.

### `We leave the vials where they are and just take normal treasure.`
PASS. Priesthood containment continues. The adventure has a valid low-disruption ending.

### `We refuse all three quest-givers.`
PASS. The tomb remains explorable independently. Employer rewards are optional incentives, not entry keys.

### `We type a totally different action.`
PASS. Free-text policy exists in every major graph state and is adjudicated against source topology/canon.

## Continuity QA
- Bell alert persists to Room 7: PASS.
- East/west route independence: PASS.
- Paths reconnect only at source-defined Room 9: PASS.
- Ghost state persists after PC death: PASS.
- Moon/sun amulet custody matters at Room 10: PASS.
- Purple liquid use/expiry tracked: PASS.
- Soul-vial state persists after leaving tomb: PASS.
- Delayed Bogumila/keeper outcomes persist beyond one-shot: PASS.
- Twin states independent: PASS.

## Approval
- Built-in library: YES
- Native/source-supported rulesets: CRACK!/B/X-compatible, Cairn, Mörk Borg
- B/X example levels: 1-3
- Intended length: 1-2 sessions
- Licence: CC BY-SA 4.0 full adventure text
- Campaign template status: APPROVED
- Public source attribution icon/link required: YES
