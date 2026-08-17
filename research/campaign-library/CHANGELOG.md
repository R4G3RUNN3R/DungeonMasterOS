# Campaign Research Library Changelog

## 2026-08-17 - Multi-genre completion batch

### Approved built-in templates
- `campaigns/midnight-in-bonetown/` - approved Cairn weird-fantasy/fungal pointcrawl. Full CC BY-SA campaign structure, state graph, source attribution and adversarial QA completed.
- `campaigns/a-tomb-of-twins/` - approved multi-ruleset old-school adventure. Source-provided support for CRACK!/B/X-compatible games (source example levels 1-3), Cairn and Mörk Borg; complete tomb graph, ghost-PC state, soul-vial custody consequences and adversarial QA completed.

### QA-stage templates
- `campaigns/the-old-blood/` - Shadowdark levels 1-2 gothic/vampire city mystery. Full campaign architecture, state clocks and QA drafted; remains blocked on final authoritative source-room/stat verification.
- `campaigns/leviathan/` - system-neutral sci-fi horror. Mothership verified through actual-play report; Monolith explicitly creator-compatible. Full pressure/mystery graph and QA drafted; remains blocked on direct authoritative two-page PDF message/table/map extraction.

### Post-apocalyptic research
- `campaigns/these-pillars-remain/` - source/rights/premise archived. Self-contained post-apocalyptic survival-horror sheet under CC BY-SA 4.0; exact source-sheet extraction remains blocked by current file retrieval.
- `campaigns/the-chalk-marked-grave/` - Cairn/Eco Mofos wasteland pointcrawl candidate archived. Verified two-faction/three-relic/four-creature/five-location exterior scope and seven-room insect-hive dungeon; full page extraction still required before templating.
- Eco Mofos `A Ruin, A Glade, A Wasteland` jam identified as a strong future pool because jam rules require submitted writing to use CC BY-SA 4.0.

### Library architecture
- Added multi-ruleset registry and v2 campaign schema so non-D&D games use their real progression model instead of forced character levels.
- Added explicit private-import/metadata handling for proprietary Ravenloft and Vampire: The Masquerade material.
- Added completion dashboard distinguishing `approved`, `qa`, `researching`, `private-import`, `metadata-only` and rejected/licence-blocked content.

### Integration impact
Research-only branch. No production runtime or `main` changes were made by this batch.
