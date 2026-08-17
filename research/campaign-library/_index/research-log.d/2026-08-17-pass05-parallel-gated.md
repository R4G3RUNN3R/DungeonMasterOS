# Research pass 05 - Parallel lanes, central approval gate

Date: 2026-08-17

## Operating model
The user requested parallel campaign research with all submissions gated centrally before approval. The current ChatGPT environment does not expose independent sub-agent worker processes, so research is being run as multiple independent lanes while all source interpretation, repository writes, QA and approval decisions remain centrally reviewed.

No lane may mark a campaign `APPROVED`. Approval requires final central verification of source, licence/distribution, native ruleset and progression, canon/state model, adversarial AI-DM QA and machine validation.

## Lane A - Basic Fantasy / Adventure Anthology One
### Beneath Brymassen
- Source: `Adventure Anthology One`, 1st Edition Release 21.
- Native ruleset: Basic Fantasy Role-Playing Game.
- Progression correction: source title block says 3-6 beginning player characters; independent RPG index tags it at 1st level. The apparent levels 2-5 range belongs to neighbouring `The Zombraire's Estate` and must not leak into Brymassen metadata.
- Full Rooms 1-14 extraction completed, including two mutually exclusive Room 14 versions.
- Two campaign modes preserved: bounty/dungeon-crawl and kidnapped-children rescue.
- Hard canon extracted for shrine/key/chalice, pits, centipede disturbance, outside exit, axe trap, false Room 7 secret-door bait, Room 8 splinter kobolds, Green Slime, catacomb random outcomes, neutral Room 11 information broker, Room 12 orc/slaver link, Room 13 conditional skeletons and both Room 14 variants.
- NPC/faction, item/reward, community-intelligence and source-rights records completed.
- `story-graph.json`, `dmos-template.json` and `qa.md` completed.
- Adversarial QA includes mode contamination, fake-secret persistence, faction-order changes, ransom/stealth rescue, route persistence, retreat/re-entry and explicit source/homebrew continuation boundary.
- Campaign Library CI run #16 succeeded on exact branch head containing the template. Machine schema validation therefore passes.
- Status remains `qa` because direct visual map review and production OGL/Copyright Notice packaging remain.

## Lane B - Sci-fi / space horror discovery and completion queue
Verified open candidates include:
- `The Return of the XBRC Terror` - system-neutral derelict/salvage horror, CC BY-SA 4.0.
- `Cascading Failure` - system-neutral collapsing-ship survival scenario, CC BY-SA 4.0.
- `Derelict Transdimensional Anomaly` - system-neutral SF pointcrawl, text/map CC BY-SA 4.0.
- `Nautilus of Time` - system-neutral procedural time-travel derelict, CC BY-SA 4.0; creator-run actual play demonstrates portability but does not alter canon.
- `The Horror of Station XK-629` - system-neutral asteroid-station horror, CC BY-SA 4.0.

These remain research candidates until their complete one-page text/tables can be extracted. Storefront/jam descriptions are not sufficient for approval.

## Lane C - Post-apocalyptic
- `These Pillars Remain` remains a high-value self-contained post-apocalyptic survival-horror candidate under CC BY-SA 4.0. Community feedback about its dice-tower health mechanic is stored as design intelligence only.
- `The Chalk-Marked Grave` remains a Cairn/Eco Mofos-adaptable wasteland pointcrawl under CC BY-SA 4.0.
- Continue mining open Eco Mofos/jam collections, but only promote titles after full-text extraction.

## Lane D - Gothic/vampire
- `The Old Blood` remains mature QA for Shadowdark levels 1-2 but needs final authoritative room/map/stat verification.
- `The Crypt of Unending Hunger` remains the preferred open built-in vampire-dungeon candidate.
- Ravenloft and Vampire: The Masquerade remain metadata/private-import unless separate rights permit built-in story content.

## Repository changes in this pass
Created `campaigns/beneath-brymassen/` with:
- README.md
- sources.md
- canon.md
- locations.md
- npcs-factions.md
- items-rewards.md
- community-intelligence.md
- story-graph.json
- dmos-template.json
- qa.md

Updated:
- completion dashboard
- public Markdown updates
- append-only machine update fragments

## Next gated targets
1. Finish OGL/map release checks for Merilla, Gold and Beneath without prematurely approving them.
2. Deep-extract one open sci-fi scenario to full story/canon QA.
3. Deep-extract one post-apocalyptic scenario to full story/canon QA.
4. Continue AA1 queue only in parallel with non-fantasy completions so the library remains diverse.