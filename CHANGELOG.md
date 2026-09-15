# Changelog

## 2026-09-15
- V1 recovery tooling: backup and restore utilities now run directly under Node in production, avoiding a dependency on TypeScript/esbuild tooling that is intentionally absent from the runtime install.
- V1 billing catalogue: reconciled customer-facing subscription prices with the dedicated live DungeonMasterOS Stripe catalogue dated 2026-08-12: Adventurer £4.99/week, £14.99/month, £159.99/year; Campaign Master £7.99/week, £24.99/month, £269.99/year; Legend £10.99/week, £34.99/month, £379.99/year.
- V1 billing fail-closed: only Adventurer, Campaign Master and Legend are purchasable in V1. Chronicler remains an internal entitlement tier but is not advertised for sale while no live Stripe prices exist. Legacy turn top-ups remain disabled until dedicated verified live prices are provisioned.
- V1 billing UX: added a public safe billing-catalog endpoint exposing configured availability without price IDs or secrets; pricing and billing screens consume it, unavailable checkout paths stay disabled, current-plan checkout is disabled, and stale host-only/free-player and fixed-discount claims were removed.
- V1 Stripe audit: the dedicated DungeonMasterOS Stripe account has no active Payment Links and no live subscriptions, so the unused Squire Pass price does not provide a public bypass and the entitlement correction does not reduce an existing subscriber.
- V1 turn entitlements: aligned paid allowances with the live Stripe product metadata: Adventurer 50/week or 200/month, Campaign Master 100/week or 400/month, and Legend 150/week or 600/month. Weekly plans now reset weekly; monthly and yearly plans receive the monthly allowance on a monthly cadence. Checkout activation, renewals, automatic resets, server enforcement and client usage meters share the same allowance model.
- V1 responsive polish: fixed the pricing navigation overflow on narrow screens and verified the public pricing surface at 360×800, 390×844 and 1440×900 with no horizontal overflow or missing catalogue controls.
- V1 verification: final build, typecheck, 29/29 regression tests, and `npm audit --omit=dev --audit-level=high` pass after the entitlement correction and client-payload check. The four remaining moderate audit notices are development-tool-only dependencies and are excluded from the production runtime audit.

## 2026-09-14
- V1 stabilization: restored the verified DungeonMaster authentication/admin implementation lost in an earlier source-sync regression, including production `JWT_SECRET` fail-closed behavior, DungeonMaster grant/revoke middleware and entitlement bypass rules.
- V1 security: authenticated WebSocket upgrades from the signed session cookie, removed client-supplied user authority, introduced durable campaign membership, and locked campaign/message/character access to authenticated owners and members. Existing live characters are account-linked and migrate safely into membership.
- V1 billing: added persisted Stripe webhook event idempotency so replayed checkout/top-up and subscription events cannot apply twice; subscription deletion also prevents stale invoice events from resurrecting access.
- V1 AI integrity: added atomic turn reservations/refunds, bounded Anthropic timeouts with SDK retries disabled, truthful provider-unavailable paths, consolidated narration state projection, and item-use protection so failed AI calls do not consume turns or consumables.
- V1 gameplay/state: activated campaign currencies and character wallets, atomic shop purchases, structured AI-created shops, campaign recovery snapshots, restart persistence, multiplayer reconnect/resubscribe coverage, and verified SQLite migration/backup/restore paths.
- V1 build hygiene: committed deterministic dependency resolution, upgraded runtime `drizzle-orm` to 0.45.2 to close the high-severity SQL-identifier injection advisory, upgraded `drizzle-kit` to 0.31.10, added the automated regression suite, and fixed D&D 3.5e feat typing.
- V1 client performance: route-split the browser application and removed the PostCSS provenance warning without suppressing diagnostics.
- V1 operations: replaced stale PM2/in-place deployment guidance with the actual systemd + immutable-release + shared-state model, and added integrity-checked SQLite online backup/restore tooling and rollback guidance.
- Password recovery truthfulness: production no longer claims to send a reset email when no DMOS mail transport is configured. The endpoint fails closed with a clear unavailable response until a dedicated DungeonMasterOS sending domain and mail transport are provisioned; development reset-token testing remains available.
- Verification: the isolated V1 suite covers auth, campaign authorization, WebSockets, Stripe replay/lifecycle, AI concurrency/failure/timeouts, narrative projection, wallets/shops, snapshots, migration, backup/restore, restart persistence and client-build constraints; production dependency audit is zero vulnerabilities. Development-only Drizzle CLI dependencies still report moderate esbuild advisories and are not part of the runtime dependency set.
- SEO: added a descriptive public title and meta description, canonical URL, robots directive, Open Graph/Twitter metadata, and SoftwareApplication structured data to the HTML shell.
- SEO structured data: added the verified Voidsmith Industries logo URL to the publisher Organization schema so search-audit validation no longer reports a missing publisher logo.
- SEO discovery: added real `client/public/robots.txt` and `client/public/sitemap.xml` files so `/robots.txt` and `/sitemap.xml` can be served as crawler resources rather than falling through to the SPA shell after deployment.
- Sitemap scope: intentionally lists only the canonical public root while the current hash-based marketing/game routes remain outside the XML sitemap.
- Risk: low. No authentication, campaign, gameplay, billing, API, WebSocket, database, or routing behaviour changed.

## 2026-08-17
- Character sheet: added a dedicated read-only D&D 3.5e character sheet popup page that opens separately from the live campaign and leaves all existing campaign bars untouched.
- Character sheet data: added `shared/dnd35-character-sheet.ts` as the canonical structured sheet contract for identity, class levels, ability scores, HP, movement, AC/touch/flat-footed AC, initiative, BAB, grapple, saves, skills, feats, special abilities, proficiencies, languages, weapons, armor, equipment, wealth, encumbrance, spellcasting, physical details, XP, backstory, contacts, enemies, and campaign notes.
- Character sheet projection: existing preset `rulesProfile` data is used as a safe fallback while future character-creation and level-up flows can progressively fill `characterData.dnd35Sheet`; missing values remain visibly unknown instead of being invented.
- Character sheet skills: the popup includes the full core D&D 3.5e skill list with class-skill, trained-only, ranks, ability modifier, miscellaneous modifier, total, and armor-check-penalty columns.
- Character sheet spells: caster class/level, casting ability, save DC by spell level, spells per day, bonus spells, known/prepared spell records, domains, specialization, prohibited schools, and notes are supported without using the repo's unrelated 5e proficiency-bonus cascade.
- Character sheet live data: HP, inventory, equipment, wealth endpoints, feats, abilities, and other recorded character data refresh while the popup remains open; a print-friendly view is included.
- Campaign UI: added a compact `Character Sheet` launcher while inside a campaign. It opens `/#/character-sheet/:campaignId` in a separate resizable browser window and does not replace or resize the existing gameplay layout.
- Characters: added eleven original level-1 D&D 3.5e PHB/SRD starter presets covering all eleven PHB base classes: Fighter, Cleric, Barbarian, Bard, Druid, Monk, Paladin, Ranger, Rogue, Wizard, and Sorcerer.
- Sorcerer: added Neris Tallow, a Half-Elf spontaneous arcane caster with proper level-1 sorcerer spells known, spell slots, saves, equipment, familiar, and progression guidance distinct from the Wizard preset.
- Catalogue: added `shared/default-character-catalogue.ts` as the growing canonical preset export, combining the original ten presets with the Sorcerer while preserving the original array for backwards compatibility.
- Character data: each preset includes core ability scores, HP, speed, AC, initiative, BAB, saves, feats, racial traits, class features, skills, spellcasting where relevant, combat notes, personality, backstory, and starting gear definitions.
- AI progression: each preset carries bounded Claude scaling guidance that preserves the character concept, follows core 3.5e class progression, and flags permanent player choices instead of silently making them.
- Inventory: starter equipment is represented separately from the flexible character-data blob so it can be seeded into the real item system when the character picker is wired into creation.
- Expected impact: DungeonMasterOS now has a reusable starter option for every core 3.5e PHB class and a complete live character-record surface ready to be populated by the character builder and level-up choices.
- Risk: low-to-moderate. The sheet is isolated to a new route/data contract plus a launcher button; no existing gameplay bars or campaign-state contracts were replaced.

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
