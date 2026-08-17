# DungeonMasterOS Master Item Compendium — Claude/VPS Handoff

Date: 2026-08-17
Branch: `feature/master-item-compendium`
Draft PR: `#1` — `feat: master equipment and item compendium foundation`
Base of branch: GitHub `main` at `eaf34157feb4f35e9c36b4b55515fed9e8183114`

## Read this first

Claude's InventoryModal / Use / Read / Equip work was described as living on the VPS/local working copy and is not present on GitHub `main`. This compendium work was therefore isolated on its own branch and intentionally avoids rewriting InventoryModal, character-sheet inventory UI, `server/routes.ts`, `server/auth.ts`, or `server/storage.ts`.

Do **not** hard-reset the VPS to this branch. The safe integration path is to checkpoint the VPS work first, fetch this branch, copy the new compendium files, and manually merge the three integration files listed below.

## Exact changed files

### New files — safe to copy from this branch

1. `.github/workflows/compendium-ci.yml`
   - Compendium-specific verification workflow.
   - Runs isolated TypeScript, client Vite build, and isolated server bundle checks.
   - Also records the existing full-repository build/typecheck baseline as non-blocking diagnostics.

2. `tsconfig.compendium.json`
   - TypeScript scope for the compendium feature so unrelated legacy/auth errors do not hide compendium regressions.

3. `server/compendium.ts`
   - Master item-definition database layer.
   - Creates/maintains `item_definitions`, `item_definition_aliases`, `compendium_sync_state`, and optional FTS5 search.
   - Adds nullable raw SQLite `definition_key` columns to existing `items` and `shop_items` tables if missing.
   - Imports reusable SRD 2014/2024 datasets.
   - Seeds 2,246 deterministic first-party DungeonMasterOS/Voidsmith homebrew definitions.
   - Stores ruleset, edition, aliases, category/subcategory, rarity, attunement, consumable/equippable/readable/viewable flags, use action, equipment slots, descriptions, mechanics, effects, actions, tags, cost, weight, and full source/provenance fields.
   - Exposes definition search/stats/init helpers.

4. `server/compendium-routes.ts`
   - Public read-only website API.
   - `GET /api/compendium/facets`
   - `GET /api/compendium/items`
   - `GET /api/compendium/items/:definitionKey`
   - Supports search, category, rarity, rules era, ruleset, source kind, interaction, featured-only, sorting, page and page-size filters.
   - Parameterized SQL for user-controlled values.
   - Explicitly excludes `campaign_homebrew` from public output.
   - Public canonical records suppress publisher branding while retaining license/source provenance in the database.

5. `client/src/lib/compendium.ts`
   - Shared public compendium data types and helpers.
   - Category/rules/source labels, item URL builder, cost formatting, and source-link resolution.
   - `sourceHref()` prefers the exact imported source-reference URL, then falls back to the recorded source page.

6. `client/src/components/CompendiumBook.tsx`
   - Interactive book shell.
   - Closed-cover mode.
   - Two-page desktop spreads.
   - Far-left/far-right click navigation.
   - Left/right keyboard navigation.
   - Mobile single-page mode with swipe navigation and floating page arrows.
   - Page-turn animation and reduced-motion handling.

7. `client/src/components/CompendiumSourceLink.tsx`
   - Small source icon/link used directly beneath item entries.
   - Links to the exact dataset/source URL where available.
   - Does not allow non-http(s) source strings to become clickable URLs.

8. `client/src/pages/compendium.tsx`
   - Public `/compendium` catalogue.
   - First visit starts on a closed book cover; clicking opens pages 1–2.
   - Cover-open state is remembered for the browser session so returning from an item does not repeatedly force the cover animation.
   - Front matter/title page plus browse/filter page.
   - 12 results per book spread, 6 per page.
   - Search and filters for category, rarity, rules era, source, interaction, and sort.
   - Quick filter overlay remains available while browsing.
   - Every result shows source/provenance beneath it.

9. `client/src/pages/compendium-item.tsx`
   - Public `/compendium/items/:definitionKey` detail view.
   - Spread 1: title, lore/description, source link, rarity/category/tags.
   - Spread 2: properties and structured mechanics.
   - Spread 3: full source/provenance and exact external source link.
   - Spread 4: related discoveries with their own source links.
   - Uses the same page-turn interaction as the catalogue.

10. `client/src/compendium.css`
    - Main fantasy-rulebook visual system.
    - Parchment page texture, serif typography, central gutter/spine, page numbers, rule lines, property tables, book frame, responsive/mobile behavior, page-turn animation.
    - Interior deliberately evokes a classic fantasy RPG reference-book feel without copying protected logos, trade dress, or branding.

11. `client/src/compendium-enhancements.css`
    - DungeonMasterOS cover styling and provenance treatments.
    - Cover uses current DungeonMasterOS dark charcoal plus warm amber/gold palette derived from the existing site: charcoal/black surfaces with `#c4a265` and `#e8c47a` accents.
    - Adds source-link styling beneath catalogue/detail items.

### Existing files changed — merge these manually into Claude's newer VPS copies

12. `client/src/App.tsx`
    - Adds imports for `CompendiumPage` and `CompendiumItemPage`.
    - Adds public routes:
      - `/compendium/items/:definitionKey`
      - `/compendium`
    - These should remain before the catch-all NotFound route.

13. `server/index.ts`
    - Imports `initializeCompendium` from `./compendium`.
    - Imports `registerCompendiumRoutes` from `./compendium-routes`.
    - After `runMigrations()` succeeds, calls `await initializeCompendium()`.
    - Registers public compendium routes before the normal application route registration.
    - Keep the ordering: base DB migrations -> compendium schema/init -> register public compendium routes -> register existing game/application routes.

14. `CHANGELOG.md`
    - Documentation only. Merge/cherry-pick as desired after functional files are reconciled.

15. `COMPENDIUM_HANDOFF.md`
    - This handoff document.

## Integration commands for the VPS

Use the commands as a guide, not a destructive script. The VPS may contain uncommitted Claude work that does not exist in GitHub.

```bash
cd /path/to/DungeonMasterOS
git status
# Commit or stash the current VPS work before touching branches.
git fetch origin feature/master-item-compendium
```

Recommended integration approach if the VPS branch is newer than GitHub `main`:

```bash
# From Claude's current, checkpointed VPS branch
git checkout -b integrate-master-item-compendium

# Copy the NEW files directly from the feature branch
git checkout origin/feature/master-item-compendium -- \
  .github/workflows/compendium-ci.yml \
  tsconfig.compendium.json \
  server/compendium.ts \
  server/compendium-routes.ts \
  client/src/lib/compendium.ts \
  client/src/components/CompendiumBook.tsx \
  client/src/components/CompendiumSourceLink.tsx \
  client/src/pages/compendium.tsx \
  client/src/pages/compendium-item.tsx \
  client/src/compendium.css \
  client/src/compendium-enhancements.css \
  COMPENDIUM_HANDOFF.md
```

Then manually merge the compendium additions from this branch into Claude's current:

- `client/src/App.tsx`
- `server/index.ts`
- `CHANGELOG.md` (optional/documentation)

Do not blindly replace Claude's VPS versions of those files.

## Startup/database behavior

`initializeCompendium()` is idempotent:

1. Ensures compendium tables/indexes exist.
2. Adds `definition_key` to `items` and `shop_items` if missing.
3. Seeds the deterministic first-party homebrew catalogue with upserts.
4. Counts existing canonical entries.
5. If canonical content is sparse, imports the configured reusable SRD datasets.
6. Canonical-source failures are collected as non-fatal errors; local schema/homebrew still initialize.

Environment switches:

- `COMPENDIUM_SYNC_ON_START=false` — disables remote canonical synchronization.
- `COMPENDIUM_FORCE_SYNC=true` — forces a canonical resync.
- Existing `DATABASE_URL` behavior is preserved; otherwise the app uses `data.db`.

The VPS needs outbound HTTPS access to the configured raw SRD dataset URLs for first-run canonical synchronization.

## Seeded content

First-party deterministic homebrew currently generates:

- 1,280 themed magical weapons
- 360 magical armour definitions
- 400 wondrous items
- 200 consumables
- 6 readable/viewable campaign-document templates

Total first-party generated core: **2,246 definitions**.

Canonical synchronization is configured for:

- SRD 5.1 / 2014 equipment
- SRD 5.1 / 2014 magic items
- SRD 5.2.1 / 2024 equipment
- SRD 5.2.1 / 2024 magic items
- SRD 5.2.1 / 2024 poisons

Third-party open content is deliberately **not** bulk-imported until its individual commercial-use licensing is verified source-by-source.

## Provenance/source behavior

Every definition can carry:

- `sourceKind`
- `sourceTitle`
- `sourcePublisher`
- `sourceLicense`
- `sourceLicenseUrl`
- `sourceUrl`
- `sourceReference`
- `sourceRecordId`
- `dataProvider`

Website behavior:

- Every catalogue item has a small source icon/link beneath it.
- Every related item has the same source link.
- Every item detail page shows the source immediately beneath the title.
- A dedicated provenance page repeats the full source metadata and exact external source reference.
- Canonical public output does not expose publisher branding.
- Campaign-specific homebrew is excluded from the public API.
- The UI uses the exact recorded import/reference URL when available; homebrew falls back to its recorded DungeonMasterOS source page.

## Book UX

Desktop:

- Closed DungeonMasterOS-coloured cover on first visit.
- Click cover to open at pages 1–2.
- Two facing parchment pages with central gutter/spine.
- Click far right of the viewport for the next spread.
- Click far left for the previous spread.
- Left/right arrow keys do the same.
- Subtle 3D page-turn sheet animation.

Mobile/tablet:

- Single page rather than squeezing two pages into a tiny viewport.
- Swipe left/right.
- Floating previous/next controls.
- Same content order as desktop spreads.

Accessibility/performance:

- Interactive elements have labels/titles.
- `prefers-reduced-motion` collapses turn animations.
- Catalogue is server-paginated; thousands of definitions are not rendered into the DOM at once.

## Current public routes

Frontend:

- `#/compendium`
- `#/compendium/items/<encoded-definition-key>`

The app uses Wouter hash routing, so production browser URLs retain the existing hash-based routing behavior.

Backend:

- `/api/compendium/facets`
- `/api/compendium/items`
- `/api/compendium/items/:definitionKey`

Example list query:

```text
/api/compendium/items?q=longsword&category=weapon&rarity=Rare&edition=2024&source=canonical_srd&interaction=equip&sort=rarity&page=1&pageSize=12
```

## Verification evidence

GitHub Actions workflow: `Compendium CI`.

Verified successfully on the feature branch:

- compendium-scoped `tsc --noEmit`
- Vite production client build
- isolated esbuild bundle of `server/compendium.ts`
- isolated esbuild bundle of `server/compendium-routes.ts`

The branch's full-repository baseline still reports pre-existing auth issues outside this feature:

- `server/routes.ts` imports missing `requireDungeonMaster`
- `server/routes.ts` imports missing `grantDungeonMasterAccess`
- `server/routes.ts` imports missing `revokeDungeonMasterAccess`
- `server/auth.ts` has an existing JWT `sub` type mismatch

Do not solve those by replacing Claude's newer VPS auth/routes files with the older GitHub versions. Re-run the full build against the VPS code after integration; Claude may already have fixed them locally.

## Important post-integration checks on VPS

After copying/merging the files:

```bash
npm install --no-audit --no-fund
npx tsc --noEmit -p tsconfig.compendium.json
npx vite build
npx esbuild server/compendium.ts server/compendium-routes.ts --bundle --platform=node --format=esm --external:better-sqlite3 --outdir=/tmp/compendium-server-build
```

Then run the VPS application's normal full build/test/deploy flow using Claude's latest auth/routes/inventory code.

Smoke-test:

1. Start the app.
2. Confirm the startup log reports `Item compendium ready`.
3. Open `#/compendium` while logged out and confirm it is publicly reachable.
4. Click the charcoal/amber cover and confirm the first spread opens.
5. Turn pages from the far left/right edges and with keyboard arrows.
6. Search for an item and exercise category/rarity/edition/source/interaction filters.
7. Open an item detail page.
8. Confirm the source icon appears beneath the item and its external link opens the recorded source.
9. Confirm campaign-specific homebrew is not returned from public endpoints.
10. Check mobile width: single-page view, swipe, and floating arrows.
11. Restart the server and confirm seeding is idempotent rather than duplicating rows.

## Deferred/intentional integration point with Claude's current Inventory work

This branch does **not** overwrite Claude's current InventoryModal/Use/Read/Equip work.

`server/compendium.ts` creates nullable `definition_key` columns at the SQLite level, but this branch intentionally does not edit the older GitHub `shared/schema.ts` or `server/storage.ts`, because those are precisely the areas likely to diverge from Claude's VPS work.

When Claude reconciles its newest inventory code, it should expose the existing DB column in its current item/shop types, then resolve recognized item names against the master definition key. Recommended behavior:

- owned character `items` optionally store `definitionKey`
- shop stock optionally stores `definitionKey`
- instance-specific quantity/charges/equipped/identified/custom text remain on the owned/shop row
- canonical mechanics stay in the master definition
- homebrew/custom items remain valid with a null definition key
- AI extraction should resolve a known item to a master definition before inventing mechanics

That reconciliation should be done against Claude's **current VPS schema**, not by copying GitHub's older `shared/schema.ts` over it.
