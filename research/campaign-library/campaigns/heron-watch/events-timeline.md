# Heron Watch - Dynamic events and failure timeline

## Core campaign clocks

### White Ape sacrifice / Power Gem clock

Source facts:
- White Ape Cultists kidnap victims for sacrifice at Area 20.
- Their activity begins escalating on the present day.
- **7 sacrifices:** Heron Watch trembles/shakes, exposing an Ape Tunnel route near Area 16.
- **14 sacrifices:** Power Gem goes critical and destroys everything within roughly ten miles.
- Successful cult activity contributes to Merithon's eventual escape from his sealed tomb.

Initial exact numeric count is not safely stated by the open prose. DMOS must not assume `0` or `1` without a source-rule interpretation/QA decision. Store as `source-ambiguous initial progress` until template review.

### Captive clock

A source sign/event can establish:
- Susanna and Figaro are kidnapped by 2d4 White Apes.
- They will be sacrificed **one hour later** unless rescued/interrupted.

### Noble movement clock

- Carl's former entourage plans to leave within roughly an hour.
- Remaining noble group later goes to dinner in Area 10.

### External pursuit clock

Only if the criminal-PC hook is selected:
- four Marchguard trail PCs by approximately one day.

## Source random encounter table (paraphrased)

Encounter results can introduce:
1. a small White Ape Cultist patrol;
2. a Heron Guard ghost or Carl's wight state;
3. one claimant noble with entourage/staff;
4. Ibn Rashid moving through the site;
5. Giovanni immediately after murdering another claimant;
6. the last Great Heron.

DMOS implementation:
- encounters must respect current alive/dead/location state;
- impossible duplicates must be filtered (e.g. dead Ibn cannot wander later);
- `Giovanni after murder` result must actually update a victim state rather than just create flavour text.

## Source sign/foreshadow table (paraphrased)

Signs can reveal nearby or newly changed state:
1. a large Great-Heron dropping indicates the bird nearby;
2. sudden cold/fogged breath indicates a Heron Guard ghost;
3. banana refuse indicates nearby White Apes;
4. Galahad's murdered body indicates Giovanni has killed him;
5. screams indicate Susanna/Figaro have been abducted and start a one-hour sacrifice clock;
6. Ibn Rashid can be heard humming the Flight Song while researching nearby;
7. Carl's corpse is missing, bloody tracks lead downstairs and Revealing Pool becomes red, indicating wight/possession progression;
8. Quixote can be heard fighting an inanimate object.

DMOS implementation:
- signs are not cosmetic: several represent irreversible state changes/deaths/captures and must update world state exactly once.

## Source environment/event table (paraphrased)

Possible environmental developments:
1. a claimant manipulates Power Gem lever, causing compound temperature drop;
2. Revealing Pool boils and fills area with heavy obscuring mist;
3. horses flee or are stolen by Cutpurses; if that state already occurred, cultists gain another sacrifice instead;
4. Area 8 suffers further collapse;
5. compound fire alarm activates and can be stopped via an Area 7 lever;
6. circuitry malfunction restores power/broadcasts the radio station throughout facility.

DMOS implementation:
- events must be idempotent/state-aware where necessary;
- repeat result should use source-defined fallback where specified;
- area collapse must update topology/access only after exact map impact is verified from source/layout.

## Explicit no-intervention outcome sequence

The author provides an ordered catastrophic trajectory if PCs fail to act meaningfully. This is extremely valuable for DMOS because it defines the world's autonomous progression.

Source sequence, paraphrased:
1. Quixote lends his Flightsuit to Sancho and is killed by Area 16's immolation trap.
2. Giovanni murders Galahad and Ibn Rashid.
3. White Ape Cultists kill Almaviva.
4. White Ape Cultists kill Susanna and Figaro.
5. White Ape Cultists kill Sancho Panza.
6. Cutpurses steal the horses.
7. White Apes kill the remaining noble entourage.
8. Carl's wight kills Giovanni in the Crypt just before Giovanni can finish securing the Heron Vow/claim.
9. Heron Watch/Power Gem reaches critical catastrophe.
10. Merithon breaks the seal on his tomb and begins rebuilding an army.
11. Cherubino and Leporello steal the donkey after dinner, elope and are the only named survivors of this default collapse.

## Timeline-engine requirements

The final DMOS template should implement source chronology as **conditional event pressure**, not a fixed cinematic playlist.

Rules:
- resolved problems cancel/alter later events that depended on them;
- dead/captured NPCs cannot perform future scheduled acts;
- Giovanni's murder chain depends on his survival/freedom;
- rescue of Susanna/Figaro prevents their source sacrifice/death state;
- disabling/containing Power Gem must change catastrophe progression;
- eliminating/converting cultists changes sacrifice pressure;
- taking the Heron Vow/allying with Great Heron may change ghost hostility and legacy outcome;
- stopping Merithon communication or seizing holographic stone does not automatically destroy Merithon, who remains sealed elsewhere;
- default failure trajectory should resume only from still-valid unresolved dependencies.

This event engine is the model for future templates that specify what happens when players ignore a problem rather than freezing the world until PCs look at it.
