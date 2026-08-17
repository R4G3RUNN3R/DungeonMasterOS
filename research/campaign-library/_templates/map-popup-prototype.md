# DungeonMasterOS Player Map Popup Prototype

Status: prototype specification, not production integration
Date: 2026-08-17

## Decision

A popup/modal map is a good fit for DungeonMasterOS because it keeps the narration and action input as the primary campaign surface while making spatial information available on demand. The existing client already includes a Radix-based `Dialog` component, and the current campaign header has an appropriate control group beside Shop/Dashboard.

Do not expose a raw GM/source map to players merely because a map image exists.

## Proposed player flow

1. Campaign header gains a `Map` button only when the current campaign has at least one player-visible map.
2. Clicking it opens a modal rather than replacing the campaign page.
3. Desktop target: roughly 90vw x 88vh maximum, preserving a visible close control.
4. Mobile target: full-screen or near-full-screen sheet/modal.
5. Map supports zoom and pan; reset/fit control is desirable.
6. Closing the map returns the player to the same narration scroll/input state.
7. Opening/closing the map never consumes a turn.

## Map safety model

Map records must distinguish:

- `gm-source`: authoritative source map for research/DM verification only; never player-visible.
- `player-source`: source includes a genuinely player-safe map and distribution rights permit its use.
- `dmos-player`: DungeonMasterOS redraw/schematic generated from legally reusable campaign topology.

Player maps must not reveal undiscovered:

- secret doors/passages;
- trap locations;
- keyed room numbers when those identify unseen content;
- monster/NPC positions not currently known;
- hidden treasure;
- GM annotations;
- future branches/locations that are not yet discovered.

## Reveal modes

- `full`: safe regional/world map already intended for players.
- `discovery`: reveal rooms/nodes/paths as characters actually discover them.
- `fog`: image/tile map with unexplored portions obscured.

For the first test, prefer `discovery` with a clean DMOS schematic. It is cheaper, easier to keep spoiler-safe, and does not require complex image masking.

## Rights rules

Each source map requires an explicit rights record separate from adventure-text rights. If the source only licenses text and excludes artwork/visual representations, do not redistribute its printed map without separate permission.

Where the campaign text/topology is reusable but the printed map artwork is not, DungeonMasterOS may create its own clean schematic/redraw only when the applicable source licence permits adaptation of the underlying location/topology data. The redraw must not copy protected illustration/trade dress.

## Suggested map record

```json
{
  "id": "main-dungeon-player",
  "title": "Dungeon Map",
  "kind": "dmos-player",
  "revealMode": "discovery",
  "playerVisible": true,
  "sourceMapRights": "not-redistributed",
  "derivedFrom": ["locations.md", "story-graph.json"],
  "assetPath": null,
  "locationIds": ["area1", "area2"],
  "discoveredLocationIds": ["area1"],
  "notes": []
}
```

Runtime should store discovery state separately from the immutable campaign template.

## First prototype candidate

Use one of the Basic Fantasy AA1 campaigns only after its visual map has been inspected. For public/player testing, prefer a DMOS redraw from verified topology rather than the anthology's printed map unless the map's own reuse rights are explicitly confirmed.

Merilla's Magic Tower is a useful internal verification candidate because the research dossier already flags a staircase text/map discrepancy. The source/GM map can be inspected during research, while the player popup should use a clean spoiler-safe redraw.

## Acceptance test

The prototype passes if:

- Map button is absent when no player map exists.
- Map button opens without navigating away from the campaign.
- Narration/action state is unchanged after closing.
- Zoom/pan works on desktop; mobile remains usable.
- Undiscovered secret information is not visible.
- Two connected players see only discovery state that campaign state says they know.
- No copyrighted/non-reusable source artwork is shipped accidentally.
- The popup remains optional and does not interrupt normal text play.

## Why not a permanent side panel

The current campaign page can already display a Shop side panel. Adding a permanent map panel would compete with narration and character/shop information, particularly on laptops and mobile. A modal gives the map space when needed without permanently shrinking the primary play surface.