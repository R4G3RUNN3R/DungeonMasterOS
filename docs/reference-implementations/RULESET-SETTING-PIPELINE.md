# DungeonMasterOS Ruleset & Setting Expansion Pipeline

Status: locked engineering pipeline

This document defines the work queue after the D&D 3.5e character-core reference implementation. It exists so future ruleset support is systematic instead of becoming a pile of edition-specific conditionals held together by optimism.

## 1. Taxonomy: rules engines are not settings

DungeonMasterOS must distinguish:

### RULES ENGINE / RULES PROFILE
Owns mechanical truth:

- attributes/ability scores
- dice/check resolution
- skills
- defenses/saves
- health/damage/death
- combat/action economy
- advancement/XP/milestones
- classes/archetypes/playbooks/templates
- species/races/ancestries where applicable
- backgrounds
- feats/talents/advantages
- powers/spells/disciplines/gifts
- equipment mechanics
- conditions/status effects
- character creation
- level/advancement choices
- character-sheet projection
- AI mechanical context

Examples:

- `dnd35-core`
- `dnd5e-2014`
- `dnd5e-2024` / revised 5e
- Pathfinder 1e
- Pathfinder 2e
- Call of Cthulhu, exact edition
- Vampire: The Masquerade, exact edition
- Werewolf: The Apocalypse, exact edition

### SETTING / SOURCE OVERLAY
Owns compatible world/content policy on top of a rules engine:

- geography
- factions
- cultures
- religions/deities
- calendars
- languages
- setting races/species/ancestries
- setting classes/subclasses/archetypes
- feats/talents/options
- monsters/NPC packages
- equipment availability
- setting-specific subsystems
- horror/corruption/domain rules
- campaign source restrictions

Examples:

- Ravenloft
- Forgotten Realms
- Eberron
- Greyhawk
- Planescape
- Spelljammer
- Plane Shift: Innistrad

A setting overlay MUST name the rules profile(s) it supports. Ravenloft must never be modeled as a generic stand-alone rules engine when its mechanics depend on a particular D&D edition/source set.

---

# 2. Source policy

For every ruleset or setting, source discovery follows this order:

1. User-owned books/files in connected Google Drive.
2. Official publisher SRD / Creative Commons / ORC / OGL / open rules resources.
3. Official publisher web rules, errata, FAQs and public previews.
4. Licensed rules databases and legitimate digital references.
5. High-quality community references only to corroborate or fill narrowly identified gaps, cross-checked against other sources.

Do NOT:

- bypass paywalls
- use cracked/pirated scans
- scrape unauthorized book dumps
- copy protected descriptive prose into the repository
- treat a random wiki as authoritative when primary/open sources exist

If the user does not own a required book, lack of a local PDF is NOT a blocker to researching mechanics that are lawfully available online.

Every reference implementation gets a `SOURCES.md` containing:

- source title
- edition/version/date
- publisher
- source type (owned book, official SRD, official web, licensed DB, corroborating secondary)
- rules/content areas taken from it
- licensing/usage note where relevant
- conflicts/errata resolved

---

# 3. Edition isolation

Never mix editions because names look similar.

Examples:

- D&D 5e 2014 and revised/2024 rules are distinct profiles.
- Pathfinder 1e and Pathfinder 2e are distinct engines.
- Vampire V20 and Vampire V5 are distinct engines/profiles.
- Werewolf W20 and Werewolf W5 are distinct engines/profiles.
- Call of Cthulhu editions must be identified before implementation.

Campaigns explicitly select a rules profile plus allowed source packs.

No implicit fallback such as:

`If this 2024 rule is missing, use the 2014 one.`

That behavior is forbidden unless a campaign explicitly enables a conversion/compatibility policy.

---

# 4. Reference-implementation structure

Each new engine gets its own branch and folder.

Suggested branch convention:

`reference/<ruleset-id>-core-v1`

Suggested folder convention:

`docs/reference-implementations/<ruleset-id>-core-v1/`

Each implementation should contain at minimum:

- `README.md`
- `SOURCES.md`
- `AUDIT-RECONCILIATION.md` when production already contains related code
- `CLAUDE-HANDOFF.md`
- `domain.ts`
- registries appropriate to the system
- core mechanics/calculator modules
- progression/advancement logic
- creation logic
- player-choice entitlement logic
- equipment adapter
- active-effect/condition adapter
- sheet read-model/projector contract
- trusted AI context builder
- persistence/schema proposal
- state-transaction boundary
- `TEST-VECTORS.md`

The reference folders stay outside the app's normal TypeScript include until Claude/live-server reconciliation deliberately ports the winning pieces.

---

# 5. Reconciliation rule

For each reference implementation Claude compares LIVE production with the reference and chooses exactly one outcome per subsystem:

- `KEEP_PRODUCTION`
- `PORT_REFERENCE`
- `MERGE_TO_ONE`
- `DEFER_WITH_BLOCKER`

Never preserve two authoritative writers merely because deleting one requires a decision.

---

# 6. Current queue

## PHASE A — D&D 3.5e

Branch:

`reference/dnd35-character-core-v2`

Folder:

`docs/reference-implementations/dnd35-character-core-v2/`

Complete and harden:

- core seven races
- eleven PHB base classes
- class features/resources
- skill system
- typed bonus stacking
- BAB/saves/grapple/iterative attacks
- carrying/encumbrance/movement
- spellcasting
- XP and favored-class multiclass penalty
- creation
- level-up
- player-choice entitlements
- equipment/effect adapters
- character-sheet projection
- trusted AI context
- persistence proposal
- server-authoritative transactions
- acceptance vectors

Then compare with live VPS and port whichever parts win.

### 3.5e source-pack expansion after core

Do not put every supplement into `dnd35-core`.

Create source packs for books actually enabled by a campaign, including as available/researched:

- prestige classes
- additional base classes
- expanded races/subraces
- templates
- feats
- spells
- domains
- equipment
- psionics
- alternate systems

Prestige classes are first-class 3.5e progression entities with prerequisites and progression rules. They are NOT copied into the D&D 5e model simply because both editions say D&D on the cover.

---

## PHASE B — D&D 5e FROM SCRATCH

Create a NEW branch from the then-current intended base, not from the 3.5 reference implementation as a rules dependency.

Suggested branch:

`reference/dnd5e-character-core-v1`

Folder:

`docs/reference-implementations/dnd5e-character-core-v1/`

### Important

The existing `client/src/lib/computedStats.ts` is evidence of previous work, NOT the new foundation.

The new 5e engine is researched and designed from scratch.

### Two profiles

At minimum:

- `dnd5e-2014`, grounded in SRD 5.1 and compatible owned sources
- `dnd5e-2024`, grounded in the revised rules / current SRD 5.2.x and compatible owned sources

These profiles share generic infrastructure where mechanics genuinely match, but every divergent rule is explicit.

### Required 5e coverage

Research and implement:

- character creation sequence
- ability generation
- races/species
- subraces/lineages where source/profile uses them
- backgrounds
- origin rules
- all core classes available to the selected source profile
- subclasses/archetypes
- class/subclass feature progression
- multiclass requirements/progression
- proficiency bonus
- skills
- skill proficiency/expertise
- tool proficiency
- all six saving throws
- armor class
- initiative
- movement/speeds
- carrying/encumbrance
- HP/Hit Dice
- healing
- death saves
- rests
- exhaustion for the selected edition
- action economy
- attacks
- extra attack
- dual/two-weapon rules
- opportunity attacks
- cover
- advantage/disadvantage
- grappling/shoving for the selected edition
- weapon properties
- weapon mastery only where the selected edition uses it
- damage types
- resistance/immunity/vulnerability
- conditions
- concentration
- spellcasting
- spell attacks/save DCs
- slots
- prepared/known spells
- cantrips
- ritual casting where applicable
- pact-style/special casting where applicable
- feats
- ASI/feat choice progression
- equipment
- magic-item attunement
- consumables/charges
- class resources
- species/background resources
- character sheet
- level-up flow
- player-choice entitlements
- rules-aware inventory/effects
- trusted AI context
- server-authoritative transactions
- source policy
- exhaustive acceptance tests

### Prestige-class clarification

Standard 5e progression primarily uses subclasses/archetypes rather than the 3.5e prestige-class model.

Do NOT invent 5e prestige classes to imitate 3.5e.

If a specific legitimate source contains an actual prestige-class or prestige-like optional subsystem, implement it as a source-specific extension with its own prerequisites and rules.

---

# 7. D&D setting overlays after 5e core

Inventory owned D&D setting books and map each one to its proper edition/profile.

Examples to detect and implement if sources exist:

- Ravenloft / Domains of Dread / compatible Ravenloft products
- Forgotten Realms
- Eberron
- Greyhawk
- Planescape
- Spelljammer
- Dragonlance
- Dark Sun
- Plane Shift settings such as Innistrad

Each overlay can contribute:

- campaign-world knowledge
- allowed/blocked source options
- setting-specific character options
- factions/religions/languages
- setting-specific mechanical modules
- location/NPC/monster compendia

Do not hard-code setting lore into the generic rules engine.

---

# 8. Pathfinder

Drive/source inventory must identify editions before coding.

## Pathfinder 1e

Build as its own rules engine, even though it has ancestry with D&D 3.5e.

Do NOT make it `dnd35 + patches`.

Research/use Paizo's lawful open rules resources and owned books.

Cover the same production-grade categories as the D&D engines, including:

- races
- classes
- archetypes
- prestige classes where applicable
- favored class bonuses
- feats
- skills
- combat maneuvers/CMB/CMD
- spellcasting
- traits
- equipment
- conditions
- advancement

## Pathfinder 2e

Separate engine/profile.

Cover its own:

- ancestry/heritage
- background
- class
- archetype
- feat-category progression
- four degrees of success
- proficiency/rank math
- three-action economy
- conditions
- dying/wounded
- spellcasting traditions
- remaster/source-version distinctions where required

Never silently apply PF1 rules to PF2.

---

# 9. Call of Cthulhu

First identify exact owned/target edition.

Then create an independent rules engine for its actual mechanics, including as applicable:

- characteristics
- percentile skills/checks
- regular/hard/extreme success
- pushed rolls
- bonus/penalty dice
- luck
- sanity
- bouts/insanity
- HP/damage
- combat/fighting back/dodge
- firearms
- chase mechanics
- occupations
- credit rating
- improvement/advancement
- magic/Mythos mechanics
- investigator sheet projection

Do NOT re-use D&D levels/classes/AC assumptions.

---

# 10. World of Darkness / Storyteller-family games

Search Drive separately for each game and edition.

Potential engines/source families include, only if owned or deliberately targeted:

- Vampire: The Masquerade
- Werewolf: The Apocalypse
- Mage
- Hunter
- Wraith
- Changeling
- other related lines discovered in source inventory

Edition/version is mandatory before implementation.

Example distinctions to preserve:

- Vampire V20 vs V5
- Werewolf W20 vs W5

Their mechanics, character creation and resource systems are not interchangeable.

A Vampire implementation may need concepts such as attributes, skills, disciplines, blood/potency/hunger or edition-equivalent resources, humanity, clan, predator/identity choices, advantages/flaws and damage/willpower systems.

A Werewolf implementation may need its own forms, rage/resource model, auspice/tribe choices, gifts, renown and transformation mechanics.

These examples are discovery prompts, not permission to assume one edition's terms apply to another.

---

# 11. Other systems and settings discovered in user files

After the named queue above, run a systematic Drive inventory.

For every probable TTRPG rulebook/sourcebook:

1. identify title
2. identify game line
3. identify edition/version
4. classify as rules engine / expansion / setting / adventure / bestiary / equipment / lore
5. group duplicate scans/editions
6. identify legal/open online sources
7. add the system to the implementation backlog

Examples that may be discovered include Warhammer-family RPGs, Cyberpunk, Shadowrun, Star Wars RPGs, superhero systems, generic systems or other games. Do not add them merely because the names are familiar; add them when actual user files or explicit product goals establish them.

---

# 12. Universal DungeonMasterOS interfaces

After at least two engines are implemented, extract ONLY genuinely common interfaces.

Good universal concepts:

- `RulesetProfile`
- `CharacterRulesState`
- `CharacterSheetProjection`
- `CharacterChoiceEntitlement`
- `RulesSourcePolicy`
- `RuleEvent`
- `RulesValidationResult`
- `RulesEffectAdapter`
- `RulesItemAdapter`
- `AiCharacterContext`
- `RulesTransaction`

Bad universal concepts:

- every game has `class`
- every game has `level`
- every game has `AC`
- every game uses d20
- every game has six D&D abilities

The shared interface should allow a game to say those concepts do not exist.

---

# 13. Quality gate for every engine

A rules engine is NOT considered complete because a character sheet renders.

It must demonstrate:

- source/edition identity
- complete creation path for supported core options
- deterministic derived mechanics
- explicit player-owned permanent choices
- advancement
- inventory/equipment interaction
- temporary condition/effect interaction
- combat resolution data
- spell/power/resource handling where applicable
- persistence
- snapshot/rewind behavior
- AI trusted context
- no cross-ruleset contamination
- test vectors
- live-server reconciliation

---

# 14. Product rule

DungeonMasterOS should eventually be able to run campaigns with radically different systems while preserving the same higher-level product strengths:

- persistent canon
- persistent NPC/world memory
- player agency
- transparent stored facts
- rules-aware progression
- reliable character sheets
- validated state changes
- achievements/titles/reputation independent of any one rules engine

The narrative/canon platform is shared.

The mechanical truth belongs to the selected rules engine.
