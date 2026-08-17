# DungeonMasterOS Campaign Research Library

This folder is the canonical research archive for reusable DungeonMasterOS campaign templates.

## Purpose

Every campaign discovered during web research must be recorded here before it is considered for inclusion in DungeonMasterOS. The archive preserves the full chain from discovery to playable AI-DM template: original source, author, licence, authoritative version, research notes, community intelligence, extracted campaign canon, structured story graph, implementation notes, and final publication decision.

## Non-negotiable research rules

1. Discovery sources are leads, not authority. Reddit, forums, blogs, social posts, mirrors, wikis, and indexes may point to a campaign, but primary-source verification must follow whenever possible.
2. Record the original creator/publisher and authoritative publication location.
3. Record the exact licence and whether commercial reuse, adaptation, translation, redistribution, and ShareAlike obligations apply.
4. Do not put copyrighted commercial adventure text into the public DungeonMasterOS template library unless reuse rights clearly permit it.
5. Separate source canon from community advice and DungeonMasterOS adaptation decisions.
6. Preserve spoilers, NPC secrets, hidden locations, branching conditions, rewards, encounter assumptions, fail states, and ending conditions in structured research notes.
7. Record every URL used during research with the date accessed and what it supported.
8. Do not silently correct or rewrite a source. If DungeonMasterOS changes a weak scene, missing clue, balance issue, or broken transition, record that separately as an adaptation decision.
9. Campaign-specific player data and private campaign homebrew never belong in this public research library.

## Campaign statuses

- `discovered` - candidate found, not yet verified
- `source-verified` - primary/authoritative source identified
- `licence-verified` - reuse/adaptation rights checked
- `researching` - adventure being read and mapped
- `extracted` - locations, NPCs, factions, scenes, encounters, secrets, rewards, and progression captured
- `templated` - structured DungeonMasterOS campaign graph written
- `qa` - continuity, branching, source, and AI-DM guard checks in progress
- `approved` - suitable for built-in DungeonMasterOS campaign library
- `metadata-only` - may be listed/referenced but not republished/adapted
- `rejected` - unsuitable, licence-blocked, inaccessible, or too incomplete

## Folder layout

- `_index/candidates.md` - master candidate queue and current status
- `_index/source-registry.md` - sources, communities, archives, publishers, repositories, and research locations
- `_index/research-log.md` - chronological record of research passes
- `_templates/research-dossier.md` - per-campaign research dossier template
- `_templates/campaign-template.schema.json` - machine-readable campaign/story-graph schema
- `campaigns/<slug>/` - one folder per researched campaign

A mature campaign folder should contain at least:

- `README.md` - status and executive summary
- `sources.md` - source/provenance/licence evidence
- `research.md` - source-derived campaign analysis
- `community-intelligence.md` - Reddit/forum/DM reports and known issues
- `canon.md` - authoritative story facts and hard locks
- `locations.md` - places and spatial relationships
- `npcs.md` - NPC identities, motives, knowledge, relationships, and state changes
- `factions.md` - faction goals, resources, relationships, and triggers
- `encounters.md` - combat/social/exploration encounters and assumptions
- `items-rewards.md` - important objects, treasure, keys, rewards, and ownership
- `story-graph.json` - acts, scenes, choices, transitions, conditions, fail states, and endings
- `dmos-template.json` - final importable DungeonMasterOS campaign template
- `qa.md` - continuity, branch, exploit, and AI-deviation review

## AI-DM design principle

The campaign template is authoritative. The AI may improvise presentation and adjudicate free-form player actions, but it must not contradict hard canon, reveal secrets early, skip required beats without a valid branch, invent incompatible locations or NPC histories, or overwrite campaign state. Suggested player choices are conveniences, not rails; free-text actions remain valid and are resolved against the campaign's current scene/state graph.
