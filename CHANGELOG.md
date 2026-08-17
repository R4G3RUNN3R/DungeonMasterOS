# Changelog

## 2026-08-17
- Campaign research: created the isolated `research/campaign-template-library` branch and `research/campaign-library/` archive for deep campaign discovery, provenance, licence checks, source-derived canon extraction, community intelligence, AI-DM adaptation notes, and final reusable campaign templates.
- Campaign templating: added a research dossier and machine-readable story-graph schema covering level range, party size, source attribution, hard/conditional/soft canon, locations, NPCs, factions, items, milestones, scenes, 3-5 suggested choices, free-text adjudication, state transitions, failure paths, and endings.
- Expected impact: campaign research can now accumulate without touching the live application branch, while preserving a complete audit trail from internet discovery through approved DungeonMasterOS template.
- Risk: low. Research-only branch and files; no runtime or production changes.

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
