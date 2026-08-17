# Gold in the Hills - Encounter and State Model

Native ruleset: Basic Fantasy Role-Playing Game.
Party: 2-4 characters, levels 1-3.

## Global state: mine alert

`mineAlerted=false` initially if party approaches carefully.

If Area 1 guards detect intruders:
1. guards fire one volley;
2. retreat to Area 4;
3. shout warning;
4. one arms the Area 2 dwarven pit;
5. Xikek/Snerk/Yuliak are treated as mobilised into the main Area 4 defence under the source's alert text.

DMOS must broadcast this state change to later mine scenes. No room reset.

## Area 1 - Entrance guards
Two goblins.
Stealth/social/unusual capture options are valid. Killing or disabling them before they warn the mine preserves non-alert state if no other action makes enough warning.

## Area 2 - Pit of Protection
Potentially armed based on alert state.
Options include:
- use/disable east-wall lever;
- cross one-foot ledge;
- jump/climb/bridge according to native rules;
- deliberately trigger/manipulate it.

The pit is not a magic auto-hit. State and player method matter.

## Area 3 - Tentacle Worm / elevator
Tentacle Worm attacks when it notices party.
Native profile: AC 13, HD 3*, six paralysis tentacles, Move 40', Save Fighter 3, Morale 9, HP 18.

Elevator repair is an engineering/exploration opportunity rather than mandatory combat objective. Each repaired-elevator use: 5% rope break. Shaft depth 100 feet.

## Area 4 - Main mine battle
Default force: 15 goblins + 3 hobgoblin overseers.
Alerted force: add retreating Area 1 guards plus Xikek/Snerk/Yuliak according to source alert text.

If not alerted and Area 4 battle lasts >6 rounds, Area 6 leadership investigates.

The tribe treats Area 4/lair defence seriously. Free-text alternatives such as surrender demands, deception, automaton use, retreat or terrain exploitation are valid but must be adjudicated rather than converted to mandatory slaughter.

## Mining automaton
Activation/control encounter:
- commands must be simple Dwarven;
- movement invokes 20% catastrophic failure chance;
- catastrophe: automaton destroyed, 2d10 damage to all within 20 feet;
- attack command with no recognised traditional dwarf enemy targets nearest object/creature;
- `stop` / `wait` valid.

DMOS should require the player to give/approximate the actual simple command; natural-language AI intent cannot secretly improve the machine's parser.

## Area 5 - Day-off goblins
Five goblins are surprised by intruders but **will not reinforce Area 4**. They can still defend themselves in Area 5.

Possible free-text interactions include intimidation, capture, negotiation or bypass. Source does not provide complex diplomacy; do not invent a Black Fang peace treaty as mandatory canon.

## Area 6 - Leadership
Default unalerted occupants: Xikek, Snerk, Yuliak.
On party appearance: Xikek/Snerk attack and Yuliak starts casting.

If alerted earlier, leadership may already be in Area 4 and Area 6 should reflect that absence.

Chief chest:
- dart trap when opened, 1d4 damage;
- treasure: 400 gp worth of gold nuggets, 326 cp, 168 sp, 48 gp, 2 Potions of Healing.

## Failure / retreat states
- party retreats after alerting mine: Black Fangs remain warned; do not automatically reset guards/trap/leadership for immediate return.
- party kills Xikek but leaves most tribe alive: tribe leadership state changes, but source does not prescribe successor; continuation can be DMOS-explicit homebrew if needed.
- party repairs automaton and extracts it: major salvage outcome; source values it at several thousand gp.
- party descends repaired elevator: written adventure ends at this source boundary and a labelled continuation/homebrew module begins.
