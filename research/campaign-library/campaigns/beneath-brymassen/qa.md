# Beneath Brymassen - DungeonMasterOS QA

## Current verdict
`QA COMPLETE AT STORY/CANON LEVEL - RELEASE GATES REMAIN`

Native ruleset: **Basic Fantasy Role-Playing Game**.
Recommended source progression: **3-6 beginning / level-1 characters**.
Source: `Adventure Anthology One`, 1st Edition Release 21.

## Source / rights QA
- Current Release 21 source identified: PASS.
- Two-hook/two-Room-14 structure verified: PASS.
- Entire anthology text designated Open Game Content under OGL v1.0a: PASS at research level.
- Artwork/branding excluded from reusable content: PASS.
- Production OGL/Copyright Notice package: PENDING.

## Adversarial campaign tests

### Players accept the mayor's bounty, then later learn children were kidnapped
PASS. Do not silently switch campaign mode. A second rescue contract can exist only if established through new fiction; Room 14 is not allowed to contain both source variants simultaneously.

### Players enter without accepting either hook
PASS. The AI can establish motive through free play, but must select a single Room 14 variant before it is instantiated and record why.

### Players carefully cross Room 4 without poking the sludge
PASS. No centipede encounter is forced merely because the room feels too quiet.

### Players spend twenty minutes searching Room 7 for the secret door
PASS. They find no secret door. Repeated rolls cannot manufacture one.

### Players recruit the Room 8 kobolds against the chieftain
PASS AS EMERGENT PLAY. Their dislike/fear of the chieftain is source-supported; a formal alliance is not guaranteed and becomes emergent state.

### Players kill the Room 8 kobolds before reaching Room 14
PASS. The chieftain remains angry about the prior theft; dead splinter kobolds do not teleport treasure or information back to him.

### Players meet the Room 12 orcs before learning about the children
PASS. Orc state persists. In rescue mode they remain the prospective buyers/slavers even if the party meets or kills them first.

### Players kill the Room 12 orcs, then negotiate in Room 14
PASS. The kobolds' plan to sell the children is now impossible, which should materially alter negotiation leverage. The AI must not resurrect replacement buyers.

### Players try to buy information from the Room 11 hobgoblin
PASS. He can trade local knowledge for gold, but his statements are not automatically canonical truth because the source explicitly supports exaggeration/lying.

### Players attack the Room 11 hobgoblin during negotiations
PASS. Neutral state flips to hostile. Community actual play confirms this is plausible player behaviour; source combat stats govern the result.

### Players open Room 13 but never touch the sarcophagus
PASS. Skeletons remain inert unless attacked or the sarcophagus is touched.

### Players remove the Room 2 chalice and attempt to use it elsewhere
PASS. It retains value as treasure but not the source's shrine-bound healing effect.

### Players discover Room 5's exterior route and retreat
PASS. The exit remains discovered and can be used for later entry/exit if normal map geometry permits.

### Rescue-mode players defeat all kobolds but leave children hanging while continuing exploration
PASS. Combat victory is not rescue completion. Child state becomes `rescued-in-dungeon` only after the cage is actually lowered/reached safely.

### Rescue-mode players negotiate ransom
PASS. Source supports ransom as an option being discussed by captors; exact bargain is adjudicated from current chieftain/treasure/orc state.

### Crawl-mode players enter Room 14 and ask where the children are
PASS. There are no kidnapped children in this variant. The AI does not cross-contaminate hooks.

### Players retreat to town and return after resting
PASS. Discovered traps, dead actors, negotiated actors, opened routes and chosen campaign mode persist. Rooms do not respawn by default.

### Players descend into homebrew material beyond the source
PASS WITH BOUNDARY. Any new region/continuation must be explicitly labelled DMOS emergent/homebrew and may not be represented as `Beneath Brymassen` source canon.

## Required choice behaviour
- 3-5 sensible contextual suggestions at major decision points: PASS.
- Free-text action always available: PASS.
- Suggested actions never mandatory rails: PASS.
- Source mode/room truth preserved under free-text play: PASS.

## Community intelligence QA
- Felbrigg 2022 actual play recorded as behaviour/balance evidence only: PASS.
- The 3 Toadstools campaign usage recorded as beginner/continuation evidence only: PASS.
- Converted/renamed later campaign material excluded from canon: PASS.

## Remaining blockers before `APPROVED`
1. CI/schema validation of `dmos-template.json` after this commit.
2. Production OGL v1.0a / complete Copyright Notice release package.
3. Direct visual check of the source dungeon map before DMOS generates exact map coordinates or navigation graphics.

Story, canon and adversarial AI-DM QA are complete.