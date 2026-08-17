# Changelog

## 2026-08-17
- Compendium: added the master item-definition foundation on an isolated feature branch, including canonical/homebrew provenance, ruleset and edition identity, aliases, searchable names, categories, rarity, equipment slots, interaction flags, mechanics/effects payloads, and public-compendium publication metadata.
- Canon data: added first-run synchronization for D&D 5e SRD 5.1 (2014) equipment and magic items plus SRD 5.2.1 (2024 rules) equipment, magic items, and poisons, with CC BY 4.0 attribution metadata and 5e-bits data-provider references.
- Homebrew: added a deterministic DungeonMasterOS/Voidsmith first-party seed catalogue producing more than 2,200 definitions across themed weapons, armor, wondrous items, consumables, maps/documents, and related interactions.
- Inventory/shop integration: added nullable `definition_key` links to existing `items` and `shop_items` tables without invalidating legacy rows.
- Expected impact: DungeonMasterOS gains a scalable authoritative item layer that can power AI item resolution, deterministic consumable/equipment behavior, merchant stock, and the future public item compendium.
- Risk: medium. This is additive and isolated from the active Claude inventory work, but it introduces first-start network synchronization for canonical SRD data; failures are non-fatal and homebrew/local schema initialization still succeeds.

## 2026-04-18
- Routes: applied the uploaded `server/routes.ts` visitor identity patch shape directly to `main` while preserving the rest of the newer route file.
- Behavior: logged-in players resolve to `user-{id}` before any `x-visitor-id` or anonymous fallback is used.
- Expected impact: stable character ownership and campaign identity for signed-in users, which supports Enter the World and character import flows.
- Risk: low. Narrow route-level change only.
- Deployment: added a fresh commit to force Railway to redeploy current `main`.
- Auth/routes: confirmed `server/routes.ts` already uses stable logged-in visitor identity (`user-{id}`) before falling back to `x-visitor-id` or anonymous IDs.
- Expected impact: logged-in users keep a stable character/campaign identity, which unblocks Enter the World and character import flows after redeploy.
- Risk: low. No gameplay logic changes in this commit beyond triggering a fresh deployment of the already-fixed route code.

## 2026-04-17
- Auth: production now fails fast when `JWT_SECRET` is missing instead of silently falling back to the known development secret. This closes a session-forgery risk and makes misconfiguration obvious during deploy/startup.
