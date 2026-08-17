# Research Pass 04 - Basic Fantasy AA1 open-adventure pipeline

Date: 2026-08-17

## Scope
Find a high-throughput source of legally transformable adventures with readable full text and explicit native level ranges, then move individual entries toward completed DMOS templates.

## Discovery
`Adventure Anthology One`, 1st Edition Release 21, provides fourteen compact Basic Fantasy adventures. The anthology describes them as short modules generally playable in a session or two and gives explicit party/level guidance. Its OGL section designates the anthology text (except the OGL text itself) as Open Game Content while excluding artwork/product branding as stated Product Identity.

A dedicated queue was created at `_index/basic-fantasy-aa1-pipeline.md`.

## OGL handling
Created `_legal/ogl-1.0a-packaging.md` recording production obligations: include OGL text, preserve/update complete Copyright Notice, clearly identify distributed OGC, keep Product Identity/artwork separate, review Basic Fantasy compatibility branding separately, and attach exact per-campaign source notice data before release.

## Merilla's Magic Tower
Native system: Basic Fantasy Role-Playing Game.
Source progression: 3-6 characters, levels 4-7.
Status: story/canon/adversarial QA complete; release-gated.

### Version audit
Initial extraction used standalone Release 3. Later research found current AA1 Release 21 materially changed play. DMOS migrated to Release 21 and retained R3 only as version history.

Current R21 changes captured:
- Level 2 includes Platemail of Life Protection +3 with six charges.
- Level 4 contains two Pipe Beasts, replacing old Release 3 Blast Spores.
- Sword of Smiting recharges Life Protection armour when striking energy-draining creatures; old assassination/level-drain mechanic superseded.
- Ring of Wonder changes effect daily at dawn; old equip-trigger wording superseded.
- Ground-floor random magic-search percentages superseded by coded/slow research and non-magical-aura component containers.
- Current guardian/assassin stats stored separately in `release21-mechanics.md`.

### Community intelligence
- Fresh Basic Fantasy review flags Bronze Golem as potentially brutal for level band and identifies a map/text staircase discrepancy.
- Solo-roleplay post recommends Merilla among AA1 modules.
- Star Wars conversion report says story conversion was easier than stat conversion, reinforcing separation of story graph from rules adapter.

### Remaining Merilla gates
- machine schema validation;
- direct current visual-map inspection / staircase discrepancy disposition;
- production OGL/Copyright Notice packaging.

## Gold in the Hills
Native system: Basic Fantasy Role-Playing Game.
Source progression: 2-4 characters, levels 1-3.
Status: story/canon/adversarial QA complete; release-gated.

### Campaign state extracted
- mine global alert state;
- entrance guards warn/retreat and arm dwarven pit;
- alert state changes leadership placement in main mine;
- non-alert Area 4 combat exceeding six rounds causes Area 6 leadership to investigate;
- Area 5's five goblins explicitly refuse to reinforce because it is their day off;
- damaged dwarven mining automaton supports only simple Dwarven commands and carries 20% catastrophic-failure chance while moving;
- repaired elevator has 5% rope-failure chance and leads below written source boundary;
- exposed gold vein is nearly exhausted, not infinite.

### Community intelligence
- 2015 family actual play used four level-1 characters with maximum HP and still treated the adventure as dangerous. GM-invented Steel Fisted Goblins were recorded as non-canon.
- 2022 Scarlet Heroes solo play shows story portability but does not establish approved rules support.
- 2016 club use with DCC-style 0-level pregens is also portability evidence, not native balance evidence.

### Remaining Gold gates
- machine schema validation;
- final visual-map check;
- production OGL/Copyright Notice packaging.

## Public-update logging
Human-readable `_index/public-updates.md` was updated with:
- discovery of the fourteen-adventure Basic Fantasy anthology pipeline;
- Merilla reaching QA after a source-version audit;
- Gold in the Hills reaching QA.

The existing monolithic `public-updates.json` returned repeated GitHub 409 conflicts on in-place update despite a fresh read. An append-only fragment strategy was attempted for machine updates; the first fragment write received a transient GitHub 502. No data was force-overwritten. Human-readable update history remains current; machine-feed consolidation is a follow-up infrastructure task.

## Next extraction priority
1. The Zombraire's Estate - Basic Fantasy, 3-6 characters, levels 2-5, gothic/undead estate.
2. Beneath Brymassen - Basic Fantasy, 3-6 beginning characters.
3. Night of the Necromancer - Basic Fantasy, levels 3-5, village siege/state-machine scenario.
4. Continue non-fantasy queues in parallel: open vampire/gothic, sci-fi and post-apocalyptic campaigns.
