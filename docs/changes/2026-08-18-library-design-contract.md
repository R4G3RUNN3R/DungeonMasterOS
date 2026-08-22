# Library of Knowledge product contract

The player-facing Library and the Dungeon Master rules engine are two projections of the same canonical records.

- Player projection: readable sourcebook/tome presentation, search/index, provenance, edition shelf.
- Rules projection: machine-readable spell/feat/item/creature mechanics used for validation and deterministic state mutation.
- Narrative is never the authoritative state store.
- Edition is always part of the lookup key. Same-named rules in different editions are separate records.
- Missing corpus data must remain visibly incomplete rather than being silently supplied from model memory.
- Homebrew remains allowed, but must be explicitly distinguished from canonical rulebook data.
