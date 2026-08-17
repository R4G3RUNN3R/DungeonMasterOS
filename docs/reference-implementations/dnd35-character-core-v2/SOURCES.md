# D&D 3.5 Character Core v2 — Sources

The reference implementation stores structured mechanical facts and does not copy protected descriptive/flavour prose from sourcebooks.

## Primary owned source

### Player's Handbook (Premium Edition), Core Rulebook I v3.5

Source location: user's connected Google Drive

Used to validate the core player-character layer, including:

- seven core races
- eleven PHB base classes
- ability modifiers and character creation
- skills
- feats/level entitlement structure
- multiclassing/favored classes
- equipment/encumbrance concepts
- combat statistics
- spellcasting progression
- XP/advancement

The user's Drive also contains many 3.5e supplements. Those are deliberately NOT folded into `dnd35-core`; they should become optional source packs after core reconciliation.

## Publisher support / errata context

Wizards of the Coast still exposes support material directing legacy 3rd/3.5e users to collected developer updates and errata. Production implementation should apply relevant official errata before treating a mechanical table as final.

## SRD cross-checks

During design, public 3.5e SRD mirrors were used to cross-check open mechanics such as:

- race mechanics
- class tables
- skill rank/cost rules
- multiclass BAB/saves
- carrying capacity
- standard advancement

Where a mirror and the owned PHB/official errata disagree, the owned corrected core book/official errata wins.

## Source-pack policy

Future 3.5e source packs should record per mechanic:

- source book
- page/section reference internally where useful
- source-pack id
- prerequisite source packs
- replacement/variant relationships
- errata applied
- whether the option is enabled for the campaign

Do not create one undifferentiated global catalogue containing every feat, prestige class, spell and subsystem from every 3.5e book.

## Licensing/content rule

Store:

- names where legally usable
- numerical mechanics
- structured prerequisites
- rule hooks
- concise original summaries

Avoid copying long protected prose from owned books into source code or player-facing databases. If a campaign needs exact text from a user-owned source, use source-aware retrieval rather than embedding whole book passages.