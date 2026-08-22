# Player Profile, Community Discovery & Achievements Showcase Design

## Status
Approved in chat for implementation as a UI-first scaffold. Backend/social/DM wiring is intentionally deferred for Claude to inspect and complete later.

## Goal
Create a minimal, good-looking social/profile layer for DungeonMasterOS that makes achievements meaningful to players, supports lightweight player discovery from the dashboard, and establishes the UI contract for later DM narrative use without wiring new persistence, social APIs, or AI behavior in this pass.

## Design principles

- Match the existing DungeonMasterOS dashboard/account visual language: dark surfaces, restrained bronze accents, compact cards, serif headings, existing shadcn/ui primitives, and current spacing conventions.
- Keep the public player profile deliberately small. V1 is identity, achievements, and most recent character, not a social-media wall.
- Reuse existing account identity and achievement concepts rather than inventing duplicate profile/account systems.
- Do not expose campaign-private state, character inventory, HP, location, quests, party data, billing/subscription details, or other private gameplay data.
- Owner-only edit controls are presentation only in this scaffold. Later server wiring must enforce authorization independently.
- No fake social data in production UI. Unwired sections render polished empty/placeholder states rather than hard-coded fake users or fake achievement events.
- Do not wire the DM Session Spotlight in this pass. The UI/contracts should make that later integration straightforward.

## Public player profile

### Route target

Future route: `/player/:username`

The page component may be created now, but route registration/data loading can remain for the later wiring pass if doing so avoids pretending a backend profile endpoint already exists.

### Information hierarchy

The V1 profile contains exactly four major sections:

1. Player header
2. Achievement summary
3. Showcased achievements
4. Most recent character

### Player header

Display:

- profile/avatar image
- public profile name using the existing account username for V1
- lightweight account identity metadata such as `Member since <year>` if supplied by the eventual profile API

Do not add a separate `displayName` field in V1.

### Achievement summary

Display:

- total achievements unlocked
- lifetime **Turns Earned** from reward-bearing achievements

`Turns Earned` means the lifetime sum of `rewardTurns` attached to achievements the player has unlocked. It is not the player's current AI-turn balance and must not decrease when turns are spent.

Do not display the existing cosmetic achievement-points total as the primary profile prestige metric.

### Showcased achievements

Players may showcase 0-3 unlocked achievements.

Presentation:

- three compact prestige cards/medals maximum
- restrained bronze border/accent
- dark inset background
- large achievement icon/emblem
- achievement name
- optional `+N Turns` only when the achievement actually grants turns
- hover/detail affordance may show the achievement description

The showcase is user-curated. Newly unlocked achievements never automatically replace a showcase slot.

These same three selected achievements are intended to become the candidate pool for the future per-session DM Session Spotlight system, but no AI/session selection logic is implemented here.

### Most recent character

Show only:

- portrait
- character name
- race/species/ancestry label
- level or ruleset-equivalent progression label/value

For current D&D characters the rendered form is conceptually:

`Hennet Uthellien`  
`Human · Level 17`

Do not show class, HP, ability scores, campaign name, location, inventory, currency, spells, private backstory, quests, or party information in V1.

The shared public-character summary contract should remain ruleset-friendly rather than hard-coding the entire system around D&D terminology.

## Owner-only controls

When the authenticated viewer owns the profile, discreet controls appear in-place:

- `Edit Profile`
- `Edit Showcase`

Visitors do not see these controls.

### Edit Profile

UI-only scaffold for:

- username/profile name
- avatar/profile picture

Use the existing account/profile editing visual style where possible. Do not implement a parallel identity system.

### Edit Showcase

Opens a compact selector over unlocked achievements.

Rules:

- select 0-3
- selected cards receive clear bronze-highlight treatment
- maximum of three is visibly enforced in the UI contract
- reward-bearing cards can show `+N Turns`
- hidden achievements remain absent until actually unlocked

The same selector component should be reusable from both the profile and Achievements page.

## Achievements page

### Route target

Future route: `/achievements`

There is currently no first-class achievement page in the app. Create the V1 page scaffold now; backend route/data wiring may remain for the later integration pass.

### Top summary

Display:

- `Achievements`
- unlocked count / total visible catalogue count
- progress bar
- lifetime `Turns Earned`
- current showcased achievements
- owner-only `Edit Showcase` control

### Filters

Use the existing achievement categories from `shared/achievements.ts`:

- All
- Character
- Combat
- Social
- Exploration
- Meta

Secret/hidden achievements must remain genuinely hidden until unlocked. Do not render locked secret cards with revealing descriptions.

### Achievement grid

Unlocked card:

- icon
- name
- description
- earned state
- `+N Turns` only when `rewardTurns > 0`

Locked visible card:

- subdued treatment
- name/description only where the existing achievement is non-hidden
- locked state

Do not invent rarity tiers or loud gamey effects. The design should feel like medals/records in a dark display case, not a mobile-game loot screen.

## Dashboard community section

Add a compact `Community` section to the existing dashboard, visually consistent with current cards and spacing.

V1 layout contains two subsections:

### Recent Achievements

Future data shape supports:

- player username
- avatar
- unlocked achievement
- relative/unlock timestamp

Each player identity is intended to link to `/player/:username` after routing/backend wiring exists.

### New Adventurers

Future data shape supports:

- player username
- avatar
- joined timestamp

Do not expose subscription plan or payment amount. A separate future opt-in supporter event may exist, but it is out of this scaffold.

### Empty/unwired behavior

Because this pass intentionally does not add the social activity backend, the dashboard must not ship fabricated users or achievement events. Render compact, intentional empty states that make the section look finished rather than broken.

## Shared UI contracts

Create focused TypeScript display contracts suitable for later API wiring, conceptually including:

### PublicPlayerProfileSummary

- `username`
- `avatarUrl`
- `memberSince`
- `achievementsUnlocked`
- `turnsEarned`
- `showcasedAchievements`
- `mostRecentCharacter`
- `viewerIsOwner`

### PublicAchievementSummary

- `id`
- `name`
- `description`
- `icon`
- `category`
- `unlocked`
- `unlockedAt`
- `rewardTurns`

### PublicCharacterSummary

- `name`
- `portraitUrl`
- `identityLabel` (race/species/ancestry presentation)
- `progressionLabel`
- `progressionValue`

### CommunityActivityItem / NewAdventurerSummary

Small display-only contracts for the two dashboard subsections.

These contracts must not include sensitive account, billing, campaign, inventory, or character-sheet data.

## Data and security boundaries

This scaffold does not create public profile persistence, social activity tables, new profile APIs, achievement showcase persistence, or DM spotlight persistence.

Later wiring must ensure:

- server-side ownership checks for profile/showcase mutations
- public profile projection is allowlisted, not a serialized `User` row
- current AI-turn balance is never exposed as `Turns Earned`
- `Turns Earned` is computed from unlocked achievement rewards or an equivalent server-authoritative lifetime record
- profile discoverability/privacy can be added without changing the public UI contract
- hidden achievements are never disclosed by public APIs prior to unlock

## Deliberately deferred

Not part of this UI scaffold:

- public profile API routes
- persistence for showcased achievement IDs
- community activity-event tables
- new-player/activity feed queries
- discoverability/privacy persistence
- friends/following/messages
- LFG/player matching
- supporter/subscription activity
- DM Session Spotlight selection
- AI prompt injection of achievement narrative meaning
- mechanical bonuses from achievements

## Future Session Spotlight contract

The intended later behavior remains:

1. Player selects up to three showcased achievements.
2. At campaign-session context establishment, DungeonMasterOS randomly selects one of those three.
3. That choice stays fixed for the session.
4. The DM receives the achievement's narrative meaning as optional flavour.
5. The DM is not required to mention it.
6. NPC references should interpret the deed naturally rather than quote the literal badge title.
7. It grants no implicit mechanical bonus.

## Acceptance criteria for this scaffold

- New minimal player-profile page/component exists and matches the current DungeonMasterOS visual system.
- Owner-only edit affordances are represented without pretending backend authorization/persistence already exists.
- New Achievements page presents progress, Turns Earned, showcase, filters, and achievement cards cleanly.
- Dashboard includes polished Recent Achievements and New Adventurers community sections with non-fabricated empty states.
- Reusable showcase-selector and profile/community UI components are factored sensibly.
- No new backend/social/DM wiring is introduced.
- No fake player/activity data ships.
- Existing dashboard/account/campaign behavior is not disrupted.
- TypeScript remains clean and existing tests/build stay green once implementation begins.
