# DungeonMasterOS Campaign Library - Public Development Updates

Purpose: short, spoiler-light development updates suitable for a future DungeonMasterOS `Updates` or `What we're working on` surface. Detailed research, spoilers, licence evidence and campaign canon remain in the internal research files.

## Update format
- Date
- Headline
- Public summary
- Rulesets affected
- Status: `researching | qa | approved | blocked | library-expansion`
- Internal reference

---

## 2026-08-17 - Campaign Library research begins
**Status:** library-expansion

We have started building a source-verified campaign library for DungeonMasterOS. Adventures are being researched individually, with their native ruleset, intended character progression, source, licence, locations, NPCs, factions, encounters, secrets and story outcomes recorded before they become playable templates. The AI Dungeon Master will be constrained by campaign canon while still allowing players to ignore suggested choices and enter free-form actions.

**Rulesets affected:** D&D 5e, Cairn, B/X-compatible OSR, Mork Borg, Quest RPG, Shadowdark, system-neutral adventures, with more systems being added.

**Internal reference:** `_index/research-log.md`

---

## 2026-08-17 - First campaign approved: Midnight in Bonetown
**Status:** approved

Our first campaign template has passed source, licence, story-graph and adversarial AI-DM review. `Midnight in Bonetown` is a Cairn adventure with a living pointcrawl, factions, relics, changing threats and multiple ways for the players to alter the situation. DungeonMasterOS tracks the campaign's actual world state rather than forcing a single scripted route.

**Native ruleset:** Cairn
**Additional support:** Cairn-compatible / OSR conversion layer
**Internal reference:** `campaigns/midnight-in-bonetown/`

---

## 2026-08-17 - Second campaign approved: A Tomb of Twins
**Status:** approved

`A Tomb of Twins` has passed the same full campaign-template review. Its branching consequences include competing employers, trapped spirits, two liches, soul-vial custody and outcomes that can continue well beyond the tomb itself. Character death inside the tomb can remain part of play instead of automatically ending that character's involvement.

**Native/source-supported rulesets:** CRACK! / B/X-compatible play, Cairn, Mork Borg
**B/X-style progression guidance:** lower-level play; source example levels 1-3
**Internal reference:** `campaigns/a-tomb-of-twins/`

---

## 2026-08-17 - Gothic and sci-fi campaigns enter QA
**Status:** qa

Two additional campaign architectures are close to approval. `The Old Blood` is a Shadowdark gothic/vampire city mystery for levels 1-2, while `Leviathan` is a system-neutral space-horror scenario with confirmed Mothership actual-play use and Monolith compatibility. Both have campaign-state graphs; final source-detail verification remains before release.

**Rulesets affected:** Shadowdark, system-neutral sci-fi, Mothership, Monolith
**Internal references:** `campaigns/the-old-blood/`, `campaigns/leviathan/`

---

## 2026-08-17 - Research expands beyond fantasy
**Status:** library-expansion

The campaign library is no longer fantasy-only. Active research now covers gothic horror, vampire chronicles, science fiction, space horror and post-apocalyptic survival. Proprietary settings such as Ravenloft and Vampire: The Masquerade are being handled through metadata/private-import paths rather than redistributing protected campaign text.

**Rulesets affected:** Cairn, Eco Mofos, system-neutral sci-fi, Monolith, Vampire: The Masquerade V5 private-import, D&D/Ravenloft private-import
**Internal references:** `_index/completion-dashboard.md`, `_index/candidates.md`

---

## 2026-08-17 - Campaign research now has an Updates feed
**Status:** library-expansion

Campaign-library milestones are being recorded in human-readable Markdown plus machine-readable update fragments. These spoiler-light entries are intended to become the data source for a future DungeonMasterOS Updates / What We're Working On page, while detailed spoilers, licensing evidence and campaign canon remain in the internal research layer.

**Internal references:** `_index/public-updates.md`, `_index/public-updates.d/`

---

## 2026-08-17 - Open adventure anthology pipeline discovered
**Status:** library-expansion

A batch-research lane has opened through `Adventure Anthology One` for the Basic Fantasy Role-Playing Game. The research edition contains fourteen short adventures with explicit party/progression guidance, and its text is published as Open Game Content under the source OGL declaration. We are processing these adventures one-by-one rather than treating the anthology as a blind bulk import.

**Ruleset affected:** Basic Fantasy Role-Playing Game
**Range represented:** beginning characters through higher low/mid-level parties across the anthology
**Internal reference:** `_index/basic-fantasy-aa1-pipeline.md`

---

## 2026-08-17 - Merilla's Magic Tower reaches QA after version audit
**Status:** qa

`Merilla's Magic Tower` now has a five-level campaign graph for **3-6 Basic Fantasy characters, levels 4-7**. Research found material differences between an older standalone release and the current anthology version, so the DungeonMasterOS template was migrated to the current source rather than mixing editions.

**Native ruleset:** Basic Fantasy Role-Playing Game
**Progression:** levels 4-7, 3-6 characters
**Release state:** story/canon/adversarial QA and machine validation complete; final map review and source-specific release packaging remain
**Internal reference:** `campaigns/merillas-magic-tower/`

---

## 2026-08-17 - Gold in the Hills reaches QA
**Status:** qa

`Gold in the Hills` has been converted into a persistent-state campaign template for **2-4 Basic Fantasy characters, levels 1-3**. The mine remembers alert state, trap state, actor movement and discovered machinery instead of treating every room as an isolated encounter.

**Native ruleset:** Basic Fantasy Role-Playing Game
**Progression:** levels 1-3, 2-4 characters
**Release state:** story/canon/adversarial QA and machine validation complete; final visual-map check and source-specific release packaging remain
**Internal reference:** `campaigns/gold-in-the-hills/`

---

## 2026-08-17 - Third campaign approved: Born Into Black Nights
**Status:** approved

`Born Into Black Nights` has passed the full DungeonMasterOS gate, including source/canon review, adversarial AI-DM QA and automated v2 template validation. It becomes the first approved built-in gothic ghost-horror campaign in the library.

**Native ruleset:** Cairn
**Progression:** native Cairn progression; no invented D&D level
**Additional support:** other fantasy systems through explicit conversion only
**Current approved campaign count:** 3
**Internal reference:** `campaigns/born-into-black-nights/`

---

## 2026-08-17 - Beneath Brymassen reaches QA
**Status:** qa

`Beneath Brymassen` now has a full DungeonMasterOS campaign model for **3-6 beginning / level-1 Basic Fantasy characters**. Research also caught an anthology-layout ambiguity that could have incorrectly assigned a neighbouring adventure's level range. The template keeps its two source-supported modes separate: a conventional dungeon/bounty expedition or a captive-rescue scenario.

**Native ruleset:** Basic Fantasy Role-Playing Game
**Progression:** beginning / level 1, 3-6 characters
**Release state:** source extraction, story graph, adversarial QA and machine validation complete; final source-map review and OGL/Copyright Notice packaging remain before approval
**Internal reference:** `campaigns/beneath-brymassen/`

---

## 2026-08-17 - Parallel campaign research lanes established
**Status:** library-expansion

Campaign work is now being advanced in parallel research lanes for open fantasy/OSR material, sci-fi/space horror, post-apocalyptic survival, and gothic/vampire content. Every lane remains subject to one central approval gate: source, licence, native ruleset/progression, canon/state model, adversarial AI-DM QA and machine validation are all reviewed before a campaign can become `APPROVED`.

**Current approved campaign count:** 3
**Current QA focus:** Basic Fantasy release gates, open sci-fi full-text extraction, post-apocalyptic full-text extraction, and gothic/vampire completion
**Internal reference:** `_index/completion-dashboard.md`
