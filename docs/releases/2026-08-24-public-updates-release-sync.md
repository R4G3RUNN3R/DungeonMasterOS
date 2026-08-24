# 2026-08-24 — Public Updates release sync

## Area
Release/deployment pipeline and public Updates feed.

## Problem
The 2026-08-24 production release shipped successfully, but the public `/updates` page remained on the prior 2026-08-22 entry because release notes were stored only in the production SQLite `updates` table and required a separate manual publish step.

## Fix
- Added a version-controlled `shared/public-updates.ts` release catalogue.
- Added startup synchronization that inserts missing bundled release entries into the existing `updates` table idempotently.
- Added automated catalogue validation tests.
- Made updating the public Updates feed a mandatory deployment gate in `DEPLOYMENT.md`.
- Added the 2026-08-24 Player Profiles / Achievements / D&D 3.5e release entry.

## Expected player impact
Every future player-visible or runtime production release can ship its public changelog entry in the same verified commit, rather than relying on a second manual database action after deployment.

## Operational requirement
A release that changes player-visible behavior or runtime mechanics is not considered deployable until its corresponding entry is present in `shared/public-updates.ts` and the normal test/typecheck/build gates pass.
