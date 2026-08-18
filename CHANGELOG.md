# Changelog

## 2026-08-18
- Multiplayer turn usage reference: added an isolated server-ready reference design for campaign-level AI Turn deduction with `Campaign Host`, `Each Individual Player`, and consented `Selected Player` modes.
- Turn usage safety: added explicit policy revisioning, selected-player accept/decline/revoke flow, individual-mode acknowledgement, no-silent-fallback behavior, and compact campaign status wording that avoids billing/token jargon.
- Turn accounting: added an idempotent reservation/commit/release contract so concurrent requests, retries, provider failures, and local fallbacks do not double-charge or consume turns incorrectly.
- Route integration: documented required migration of action, item-use, campaign-start, retry/regenerate, WebSocket and campaign-creation paths away from request-user-only deduction.
- Campaign history reference: added a qualified account-level Campaign History for campaigns genuinely played in, including non-host campaigns, while preserving `My Campaigns` as the owner/host list.
- Participation filtering: added canonical meaningful-action evidence, conservative active-play-time/session tracking, deduplication, privacy rules, and internal qualification policy so one- or two-turn drive-by joins remain invisible.
- Historical persistence: qualified participation survives leave/remove/archive states and is stored separately from current campaign access, AI Turn source, `worldState`, and `characterData`.
- Handoff: all work is isolated under `docs/reference-implementations/multiplayer-turn-deduction-v1/` on `reference/multiplayer-turn-deduction-v1` for live-server comparison and selective port by Claude.
- Expected impact after production port: multiplayer groups can clearly choose where AI Turns are deducted from, selected users must consent before their turns are used, and every genuinely participating player retains a meaningful personal campaign history.
- Risk: high for turn accounting and moderate for participation history if ported incorrectly; reference therefore requires server-authoritative source resolution, idempotent reservations/evidence, migrations, concurrency tests and live-server comparison before deployment.

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
