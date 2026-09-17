# Changelog

## 2026-09-17
- Security audit ledger: added an additive `security_events` table recording authentication, credential-rotation, logout, and DungeonMaster privilege changes with actor/subject user IDs and bounded sanitized metadata.
- Security audit privacy: audit metadata rejects keys associated with passwords, tokens, cookies, authorization headers, API keys, secrets, and email addresses. Raw IPs and credential material are not stored.
- Security audit availability: event writes are best-effort and log failures server-side rather than failing a successful authentication/account action; audit storage failure therefore cannot become an authentication outage.
- Privileged-route CSRF hardening: DungeonMaster grant/revoke POST routes now use the same trusted-origin validation and sensitive-action throttle as other privileged account mutations.
- Audit retention: V1 does not automatically delete security events; retention/archive policy remains an operational decision rather than silently discarding security evidence.
- Auth request hardening: added bounded in-memory fixed-window throttles for login, registration, password recovery/reset, and sensitive authenticated account actions. Login is constrained by both source IP and normalized identity while limits remain deliberately high enough to avoid routine user lockouts.
- Auth origin validation: state-changing authentication/account POST routes now reject browser requests whose `Origin` differs from the canonical `APP_URL`; origin-less non-browser clients remain compatible, while production SameSite cookie policy continues to provide the browser cookie boundary.
- Auth abuse safety: limiter storage is bounded to prevent untrusted keys from growing process memory without limit. The V1 limiter is intentionally process-local and restart-local because DMOS currently runs as a single process; multi-instance deployment requires a shared limiter before horizontal scaling.
- Auth credential rotation: added a per-user authentication version stamped into both v2 opaque sessions and newly issued legacy compatibility JWTs. Existing pre-version JWTs map to version 0 so current users remain signed in until a credential rotation occurs.
- Auth password security: successful password changes atomically update the password hash and bump the authentication version, revoke all existing v2 sessions, and issue a fresh current-browser session. Password-reset completion bumps the version, revokes v2 sessions, and clears browser auth cookies so every prior session generation is rejected.
- Auth session authority: HTTP and WebSocket authentication now compare each session generation against the user's current authentication version, preventing old JWT or v2 credentials from surviving password rotation even during the dual-cookie compatibility window.
- Auth privacy: the authentication version remains server-internal and is removed from public user payloads alongside password hashes and Google provider subjects.
- Auth migration coverage: old databases receive user/session auth-version columns with a zero default, preserving existing accounts and pre-version session compatibility without rewriting user rows.
- Release sequencing: this hardening is safe to merge but must not be promoted with a JWT-only rollback target. Establish the v2-compatible session release as the rollback baseline before promoting authentication-version enforcement.
- Auth sessions: added server-revocable opaque v2 sessions backed by an additive `auth_sessions` ledger; only SHA-256 token hashes are persisted, never raw bearer tokens.
- Auth rollback safety: introduced a dual-cookie migration where `dmos_session_v2` is preferred while the existing `dmos_session` JWT remains untouched for JWT-only release rollback compatibility. JWT-only HTTP sessions upgrade additively on use.
- Auth revocation: a present but invalid/revoked v2 cookie fails closed instead of falling back to a legacy JWT, logout revokes the current v2 session and clears both cookies, and HTTP/WebSocket authentication share the same session resolution rules.
- Auth operations: added independent legacy-session acceptance/issuance controls so JWT compatibility can be retired in stages only after the rollback target is v2-capable and the seven-day legacy lifetime has drained.
- Auth migration coverage: added hashed-token, immediate-revocation, dual-cookie, legacy-upgrade, no-resurrection, WebSocket, logout, compatibility-disable, and old-database additive-migration regression checks.
- Risk: moderate and intentionally staged. Legacy JWT behavior remains available during the compatibility window; no password, Google identity, billing, campaign, or gameplay data is rewritten.
- Auth architecture: introduced dedicated access-policy and entitlement boundaries so DungeonMaster access, subscription state, campaign limits, and AI quota are resolved as explicit concepts instead of repeated legacy flag/product-rule combinations.
- Auth compatibility: the new policy deliberately preserves existing V1 effective access, including legacy admin-to-DungeonMaster compatibility and standalone unlimited-turn access; no session, login, Google OAuth, billing, or campaign ownership contract changes in this step.
- Regression coverage: added executable capability and entitlement mapping tests, including proof that standalone unlimited-turn access does not silently become subscription or campaign-limit bypass.
- Risk: low-to-moderate. Authorization code paths were refactored, but the capability mapping is behavior-preserving and remains protected by the release gate.
- SEO server rendering: production now returns route-aware HTML metadata for `/`, `/how-it-works`, and `/pricing` instead of serving the homepage canonical for every clean route.
- SEO crawlability: the three public marketing routes now include concise semantic fallback content and a crawlable `Powered by Voidsmith Industries` publisher link in the initial HTML response before JavaScript runs.
- SEO indexing boundaries: authentication and application routes now receive `noindex, follow` in the server response and no longer leak the homepage canonical before React boots.
- Regression coverage: added production-server tests for self-canonical public routes, pre-JavaScript public content/publisher attribution, and private-route noindex behavior.
- Risk: low. No gameplay, authentication authority, billing, WebSocket, database, campaign, or AI logic changed.

## 2026-09-16
- SEO routing: replaced hash-only public routing with clean browser paths so `/how-it-works` and `/pricing` can be requested directly by users and crawlers, while preserving legacy `#/...` links through a compatibility redirect.
- SEO metadata: public root, how-it-works, and pricing routes now set route-specific titles, descriptions, canonicals, Open Graph/Twitter metadata, and index/follow directives; authenticated and account/game surfaces are marked `noindex, follow` in the rendered client.
- SEO discovery: expanded the sitemap from the homepage alone to the three intended public marketing URLs.
- Voidsmith attribution: added a visible crawlable `Powered by Voidsmith Industries` footer link across DungeonMasterOS public and authentication surfaces.
- Character-sheet compatibility: popup launch URLs now use the clean `/character-sheet/:id` path while legacy hash routes remain supported.

## 2026-09-15
- V1 authentication preservation: added a pinned, read-only GitHub Actions release gate plus a canonical `release:verify` command, documented Google-linked identity continuity as a release-blocking invariant, and added a non-secret `.env.example` so Google OAuth configuration cannot quietly disappear from future deployments.
- V1 Google authentication hotfix: restored Google OAuth sign-in, callback/state validation, Google identity mapping and the login/register UI entry point after the V1 release accidentally omitted the previously-live integration. Existing Google-linked accounts and production user data were intact; the regression prevented access rather than deleting accounts. Added regression coverage so future releases fail if the Google auth module, routes, storage mapping, schema fields or UI wiring disappear again.
- V1 recovery tooling: backup and restore utilities now run directly under Node in production, avoiding a dependency on TypeScript/esbuild tooling that is intentionally absent from the runtime install.
- V1 billing catalogue: reconciled customer-facing subscription prices with the dedicated live DungeonMasterOS Stripe catalogue dated 2026-08-12: Adventurer £4.99/week, £14.99/month, £159.99/year; Campaign Master £7.99/week, £24.99/month, £269.99/year; Legend £10.99/week, £34.99/month, £379.99/year.
- V1 billing fail-closed: only Adventurer, Campaign Master and Legend are purchasable in V1. Chronicler remains an internal entitlement tier but is not advertised for sale while no live Stripe prices exist. Legacy turn top-ups remain disabled until dedicated verified live prices are provisioned.
- V1 billing routing: consolidated Stripe and billing endpoints behind one authoritative router and added regression coverage preventing duplicate route registrations from being reintroduced.
- V1 billing UX: added a public safe billing-catalog endpoint exposing configured availability without price IDs or secrets; pricing and billing screens consume it, unavailable checkout paths stay disabled, current-plan checkout is disabled, and stale host-only/free-player and fixed-discount claims were removed.
- V1 Stripe audit: the dedicated DungeonMasterOS Stripe account has no active Payment Links and no live subscriptions, so the unused Squire Pass price does not provide a public bypass and the entitlement correction does not reduce an existing subscriber.
- V1 turn entitlements: aligned paid allowances with the live Stripe product metadata: Adventurer 50/week or 200/month, Campaign Master 100/week or 400/month, and Legend 150/week or 600/month. Weekly plans now reset weekly; monthly and yearly plans receive the monthly allowance on a monthly cadence. Checkout activation, renewals, automatic resets, server enforcement and client usage meters share the same allowance model.
- V1 responsive polish: fixed the pricing navigation overflow on narrow screens and verified the public pricing surface at 360×800, 390×844 and 1440×900 with no horizontal overflow or missing catalogue controls.
- V1 client payload: optimized the shipped DMOS logo from a megabyte-scale source to a 123 KB lossless asset sized appropriately for its actual UI use, with regression coverage preventing accidental reintroduction of the oversized source.
- V1 verification: final build, typecheck, 31/31 regression tests, and `npm audit --omit=dev --audit-level=high` pass after the entitlement correction and client-payload check. The four remaining moderate audit notices are development-tool-only dependencies and are excluded from the production runtime audit.

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
- Auth/routes: confirmed `server/routes.ts` already uses stable logged-in visitor identity (`user-{id}` before falling back to `x-visitor-id` or anonymous IDs.
- Expected impact: logged-in users keep a stable character/campaign identity, which unblocks Enter the World and character import flows after redeploy.
- Risk: low. No gameplay logic changes in this commit beyond triggering a fresh deployment of the already-fixed route code.

## 2026-04-17
- Auth: production now fails fast when `JWT_SECRET` is missing instead of silently falling back to the known development secret. This closes a session-forgery risk and makes misconfiguration obvious during deploy/startup.
