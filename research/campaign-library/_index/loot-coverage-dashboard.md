# DungeonMasterOS Loot Coverage Dashboard

Last updated: 2026-08-17
Policy: `../_templates/loot-policy-v1.md`

This dashboard tracks whether campaign play contains enough tangible item/treasure/salvage discovery to avoid becoming an uninterrupted sequence of narration, monsters and traps.

## Approved campaigns

| Campaign | Scale | Tangible reward beats | Useful beats | Signature beats | Supplemental mode | Loot gate |
|---|---:|---:|---:|---:|---|---|
| Midnight in Bonetown | multi-session | 7 | 5 | 4 | none | PASS |
| A Tomb of Twins | short | 7 | 5 | 4 | none | PASS |
| Born Into Black Nights | short | 7 | 5 | 2 | none | PASS |
| The Old Blood | multi-session | 6 | 4 | 2 | native Shadowdark treasure procedures | PASS |

## Release-gated / QA campaigns

| Campaign | Scale | Tangible reward beats | Useful beats | Signature beats | Supplemental mode | Loot gate |
|---|---:|---:|---:|---:|---|---|
| Merilla's Magic Tower | short | 4 | 4 | 3 | source-authorized random minor magic reward | PASS |
| Gold in the Hills | short | 5 | 4 | 2 | none | PASS |
| Beneath Brymassen | short | 6 | 5 | 3 | none | PASS |
| Leviathan | one-shot | 0 verified | 0 verified | 0 verified | disabled until source extraction | BLOCKED |

## Interpretation

The current fantasy/gothic campaigns are not loot-starved. Most already contain more source treasure than the new minimum requires, so DMOS should preserve that material rather than layering generic drops on top.

The new policy mainly protects future sparse adventures and prevents non-fantasy scenarios from being approved without considering tangible discovery/salvage play.

## Compendium compatibility

The draft master item compendium is currently strongest for D&D 5e/SRD and first-party 5e-compatible homebrew. It must not be used as an unfiltered universal loot table.

Campaign loot resolution must prefer:
1. source/native item definitions;
2. exact native-ruleset adapter definitions;
3. compatible compendium definitions only after adapter approval;
4. campaign-scoped definitions when the source provides a unique item.

## Required review for future campaigns

Every campaign entering `qa` must receive `loot-profile.json`.
Every campaign entering `approved` must have `approval.passesLootGate=true`, enough reward beats for its campaign scale, no loot blockers, and a verified profile.

The validator enforces this for v2 templates.