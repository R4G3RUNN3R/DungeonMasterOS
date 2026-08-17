# Campaign Research Library Changelog

## 2026-08-17 - Loot discovery gate and map-popup prototype

### Loot/reward policy
- Added central `loot-policy-v1.md`: every built-in campaign must contain meaningful tangible discovery rewards in addition to story, monsters and traps.
- Added machine-readable `loot-profile.json` schema with campaign-scale reward-density minimums, source-loot preservation, supplemental-loot provenance, rules-adapter requirements and anti-farm persistence rules.
- Added CI enforcement: every v2 campaign at `qa` or `approved` requires a loot profile; approved campaigns must have a verified passing loot gate with no blockers.
- Added retroactive loot profiles for all four currently approved campaigns and the three Basic Fantasy release-gated campaigns.
- The approved and Basic Fantasy QA campaigns all pass without generic extra drops because their sources already contain sufficient treasure/items.
- `The Old Blood` may use source-authorized/native Shadowdark ordinary treasure procedures in Ruins/Sewers/crypts.
- `Merilla's Magic Tower` may resolve the source-authorized unspecified minor-magic rescue reward through a compatible native adapter/compendium definition; older Release 3 random-container magic remains forbidden.
- `Leviathan` now has an explicit loot blocker until its authoritative two-page PDF is extracted; no station salvage is invented as source canon.
- Added `_index/loot-coverage-dashboard.md` for at-a-glance reward coverage.

### Master item compendium coordination
- Confirmed draft PR `feature/master-item-compendium` provides `definitionKey`, ruleset/edition, rarity/category, mechanics/effects and provenance fields plus a large first-party catalogue.
- Loot policy explicitly forbids treating the current 5e-heavy compendium as a universal cross-system random table.
- Source/native definitions and approved rules adapters take priority before generic compendium selection.

### Map popup prototype
- Added `_templates/map-popup-prototype.md`.
- Existing Radix Dialog UI and campaign-header controls make an optional popup map a good technical fit without permanently shrinking narration.
- Player maps must be spoiler-safe and rights-safe: no raw GM keys, secret doors, hidden treasure or unverified source artwork.
- First public prototype should use a DMOS schematic/redraw with discovery-based reveal rather than blindly redistributing a printed source map.

### Integration impact
Research-only branch. No production runtime, Claude VPS inventory work, master-compendium PR or `main` code was overwritten by this change.

## 2026-08-17 - Central approval ledger reconciliation

### Approval state
- Reconciled the machine-readable approved campaign index with the completion dashboard: approved built-in count is **4**.
- Added `campaigns/the-old-blood/` to the approved index after its central source, rights, canon, NPC, adversarial-QA and v2-template review.
- Recorded successful Campaign Library CI run 37 on approval head `bb93877303b54895811d0791ef78dc675fa325ed`, satisfying The Old Blood's previously pending exact-head mechanical gate.
- The approval manifest and central approval review now agree with the verified CI state.

### Integration impact
Research-only branch. No production runtime or `main` changes were made by this reconciliation.

## 2026-08-17 - Multi-genre completion batch

### Approved built-in templates
- `campaigns/midnight-in-bonetown/` - approved Cairn weird-fantasy/fungal pointcrawl. Full CC BY-SA campaign structure, state graph, source attribution and adversarial QA completed.
- `campaigns/a-tomb-of-twins/` - approved multi-ruleset old-school adventure. Source-provided support for CRACK!/B/X-compatible games (source example levels 1-3), Cairn and Mörk Borg; complete tomb graph, ghost-PC state, soul-vial custody consequences and adversarial QA completed.

### QA-stage templates
- `campaigns/the-old-blood/` - historical status at the start of this batch: Shadowdark levels 1-2 gothic/vampire city mystery awaiting final authoritative source-room/stat verification. This entry is superseded by the central approval reconciliation above.
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