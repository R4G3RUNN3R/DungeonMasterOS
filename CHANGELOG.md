# Changelog

## 2026-08-17
- Campaign research: created the isolated `research/campaign-template-library` branch and `research/campaign-library/` archive for deep campaign discovery, provenance, licence checks, source-derived canon extraction, community intelligence, AI-DM adaptation notes, and final reusable campaign templates.
- Campaign templating: added a research dossier and machine-readable story-graph schema covering level range, party size, source attribution, hard/conditional/soft canon, locations, NPCs, factions, items, milestones, scenes, 3-5 suggested choices, free-text adjudication, state transitions, failure paths, and endings.
- Deep research pass: expanded the candidate registry across creator sites, itch.io, Reddit, OPD archives, forums/reviews and open-licence sources, explicitly separating full-adventure licences from misleading cases where only fonts, art, templates, SRD material or rules engines are Creative Commons.
- Active dossiers: started structured source/canon/story-graph research for `Castle Inspection`, `Well, what now?`, `Island of Trials`, `The Whispered Caverns of June Serin`, and `OVERTHROW THE TYRANT`, with incomplete source facts quarantined rather than guessed.
- AI-DM safeguards: added scenario-specific guard patterns for concurrent crises, dungeon topology, mysteries/clues, rumours/factions and source secrecy so free-text player actions can be adjudicated without rewriting campaign truth.
- Open-content pipeline: identified additional strong candidates including `Under the Rusted Sun`, `The Cultists' Keep of Kthrone`, `Cargoth: Ruinous Edition`, `Cheeseur the Geezer and the Smell Below`, and `De farra a Ruïnaceleste`; recorded blocked/metadata-only titles where licence terms do not permit adaptation.
- Multi-ruleset campaign model: added v2 template support for non-level systems, converted/native support labels, source-specific progression models and proprietary/private-import campaign handling.
- Public research updates: added spoiler-light Markdown plus machine-readable update-feed files for future `Updates / What we're working on` UI integration; append-only JSON fragments are used when the shared feed blob conflicts under concurrent writes.
- Approved library: `Midnight in Bonetown`, `A Tomb of Twins`, and `Born Into Black Nights` reached approved built-in status after source/canon/story-graph/adversarial QA and required machine validation.
- Basic Fantasy anthology research: identified `Adventure Anthology One` Release 21 as a fourteen-adventure completion pipeline with explicit party/level guidance and source text designated Open Game Content under its OGL declaration; created OGL packaging/release guidance and a per-adventure queue.
- Source-version hardening: migrated `Merilla's Magic Tower` from older standalone Release 3 assumptions to current AA1 Release 21, preserving superseded monsters/items/stats as research history instead of mixing editions.
- QA pipeline: `Merilla's Magic Tower` and `Gold in the Hills` are story/canon/adversarial-QA complete and machine-validated; they remain gated by final map/source-specific OGL release checks.
- Beneath Brymassen: completed Release 21 source extraction, corrected a neighbouring-adventure progression ambiguity to **3-6 beginning / level-1 Basic Fantasy characters**, modelled separate bounty and child-rescue modes, added full canon/location/NPC/faction/item/community/story-graph/template/QA files, and passed Campaign Library CI schema validation. Approval remains gated by visual-map review and OGL/Copyright Notice packaging.
- Gated parallel research: formalised independent research lanes for Basic Fantasy/OGL, sci-fi/space horror, post-apocalyptic, and gothic/vampire campaigns. No lane may self-approve; all campaign promotions remain centrally gated by source, licence, ruleset/progression, canon/state, adversarial QA and machine validation review.
- Non-fantasy queue: verified additional open sci-fi candidates including `The Return of the XBRC Terror`, `Cascading Failure`, `Derelict Transdimensional Anomaly`, `Nautilus of Time`, and `The Horror of Station XK-629`; full source extraction remains required before templating/approval.
- Active gothic extraction: `The Zombraire's Estate` remains in research with current provenance/community sources; room graph is incomplete until all keyed source text is verified.
- Expected impact: campaign research can accumulate without touching the live application branch, while preserving an auditable trail from discovery through source verification, licence status, canon extraction, QA and future user-facing progress updates.
- Risk: low. Research-only branch/files; no runtime or production changes.

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