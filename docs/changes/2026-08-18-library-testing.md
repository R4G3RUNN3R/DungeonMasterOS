# Library of Knowledge verification gate

Before this branch is considered merge-ready:

1. TypeScript typecheck must pass.
2. Production test suite must pass, including the new Library/3.5 tests.
3. Production-aligned Task #130 changes must be present in branch ancestry/content.
4. `/compendiums` must render without affecting the legacy `/compendium` item tome.
5. D&D 3.5 spell preflight must block illegal prepared/component/slot cases without consuming resources.
6. Successful catalogued spell actions must consume exactly one correct spell resource and duplicates/fallbacks must consume none.
7. Level-up tests must cover 3.5 feat-only levels, ability-only levels, and level 12 where both are granted.
8. AI reward reconciliation must distinguish canonical item matches from unverified/homebrew rewards.
9. No 5e item record may appear under the 3.5 shelf.
10. No deployment to production until the full branch is verified and deliberately promoted.
