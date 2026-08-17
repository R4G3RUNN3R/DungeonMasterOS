# Leviathan - Encounters, Problems and Escalation

Leviathan is primarily an investigation-pressure scenario. Mechanical encounters are consequences of station conditions and player choices, not a mandatory combat ladder.

## Core clocks

### `messageIndex`
Represents progression through the source cryptic-message sequence.
- Starts at source-defined opening state after PCs wake.
- Advances by selected pacing mode.
- Must preserve source message order once PDF extraction is complete.
- Does not require strict wall-clock timing in DMOS.

### `solarThreat`
Represents the intensifying coronal mass ejection.
- Starts noticeable but not terminal.
- Advances with source timing/events.
- Communicated through station instruments, viewport conditions, warnings and infrastructure stress.
- Must remain a real environmental threat even though the apparent monster-threat is benign.

### `stationIntegrity`
Tracks cumulative unresolved failures.
- Problems may be fixed, ignored or worsened.
- Ignoring one problem cannot magically halt the plot; it changes downstream station capabilities/hazards.

### `aiState`
Suggested states:
- functional
- unstable
- escalating-malfunctions
- countdown/critical-behaviour
- damaged
- destroyed

Destroying the AI is permitted if fiction/rules allow it.

## Opening encounter: Wake Without Identity
Objectives:
- establish amnesia
- establish station isolation
- provide first immediately inspectable signs that something is wrong
- create multiple plausible priorities rather than a single quest marker

Suggested player-facing actions:
1. Check the station computer for identity/log data.
2. Examine immediate surroundings and personal equipment.
3. Look outside / inspect stellar conditions.
4. Check station status and alarms.
5. Ignore the systems and explore the station manually.

Free text must remain valid.

## Cryptic message encounters
Messages are scenario beats. Each should:
- add information without fully resolving the mystery
- interact with current player theories
- arrive under `timerMode`
- not become a direct narrator voice explaining the twist

DMOS modes:
- `real-time`: source-intended timer interval
- `paced`: message arrives after meaningful exploration beat, tension lull or escalating station event
- `accelerating`: intervals shorten as solar threat/station state worsens

Default recommendation from actual-play intelligence: `paced` with acceleration available if players bunker down.

## Station problem encounters
Exact source table entries remain pending PDF extraction. Verified examples from actual play include:
- exploding beakers / laboratory-type failure
- solar-panel/external power problem
- airlock breach/problem
- general electrical problems

For every source problem, final template should record:
- trigger
- immediate symptom
- consequence if ignored
- consequence if failed repair
- consequence if fixed
- whether it changes power, atmosphere, communications, mobility or information availability
- applicable ruleset test guidance

## AI malfunction encounters
The central AI can become increasingly unsettling/malfunctioning.

Verified play behaviours:
- countdown behaviour can cause panic
- AI can deliver an ominous Leviathan-related monologue
- AI can be shot/destroyed mid-delivery

DMOS requirement:
No essential campaign truth can be accessible ONLY through an AI speech that players can interrupt. If source design requires a later message, deliver it through another surviving station channel only if that channel is source-consistent; otherwise allow the consequences of destroying the AI.

## Environmental repair adjudication
System-neutral default:
- automatic success when the character has plausible tools/skills and failure has no interesting consequence
- make a ruleset-specific test when pressure, danger, uncertainty or meaningful failure exists

Mothership adapter:
- use Mothership skills/saves/stress only when warranted
- do not generate stress merely because the player searches a room
- actual play indicates the scenario can work with relatively few rolls

Monolith adapter:
- use Monolith's science-fiction resolution procedures without changing scenario facts
- exact adapter notes pending separate Monolith rules integration

## Player theory handling
Track theories separately:
- `sunCreatureTheory`
- `experimentTheory`
- `hostileAiTheory`
- other freeform theories

These are conversational/context states, never canon facts.

The AI DM should use player theories to frame descriptions and NPC-less suspense, but must not confirm a false theory through invented evidence.

## Bunker/stall handling
If players stop moving because they fear an imminent attack:
1. do not spawn an invented monster
2. advance message/solar/event clock according to pacing mode
3. allow station problems to worsen naturally
4. let the characters wait if they insist
5. reveal the source ending/truth only through valid source conditions

## Failure philosophy
The scenario should fail forward through worsening infrastructure, loss of information channels, damaged equipment and increased time pressure. Routine failed checks must not produce arbitrary instant death unless the chosen ruleset/source event legitimately supports it.
