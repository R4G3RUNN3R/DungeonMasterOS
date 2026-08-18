# DungeonMasterOS Immersive In-Game UI Redesign

Date: 2026-08-17
Branch: `feature/immersive-ingame-ui-redesign`
Status: Design approved in conversation; implementation pending written-spec review.

## 1. Goal

Redesign the live DungeonMasterOS gameplay screen so it feels like a premium dark-fantasy tabletop experience rather than a generic web dashboard, while preserving readability, player freedom, current campaign functionality, and ruleset-specific correctness.

The target visual identity is a hybrid of:

- premium dark-fantasy game UI,
- immersive tabletop/tome presentation,
- old rustic tavern warmth,
- cinematic environmental backgrounds,
- readable and practical game controls.

The redesign must be coded into the existing React/Tailwind application. It is not a static mockup.

## 2. Core visual language

### 2.1 Palette and materials

The default live-play palette should evoke an old tavern:

- deep walnut and brown-black surfaces,
- aged leather,
- warm amber/candlelight,
- antique bronze and iron accents,
- parchment/cream reading surfaces,
- restrained red for danger and HP state,
- low-saturation environmental tones so foreground text remains legible.

Decorative treatment should be subtle and premium. Avoid theme-park medieval ornamentation, fake heavy embossing everywhere, or effects that reduce readability.

### 2.2 Background treatment

The game shell supports a scene background behind the live-play interface.

The background should use a hybrid cinematic/atmospheric treatment:

- clearly visible scene art,
- edge vignette,
- dimming behind dense text or controls,
- optional mild blur/gradient under foreground panels,
- slow crossfade when the environment meaningfully changes,
- no rapid wallpaper changes for tiny movements inside the same scene.

The background system is a separate presentation layer so original DungeonMasterOS artwork can replace free assets later without changing scene logic.

## 3. Desktop game shell

The default desktop experience is a three-region layout:

`Character HUD | Story / Scene | Context Panel`

The centre region defaults to a wide gameplay column. Players may resize and personalise the layout globally.

### 3.1 Thin immersive header

Replace the current large dashboard-style campaign header with a narrow wood/leather game header.

Left side:

- Dashboard/back control,
- campaign name,
- optional chapter/current scene label.

Right side:

- Map,
- Journal/Quests,
- Party,
- overflow/settings.

Shop is not a permanent header control. Merchant interaction appears contextually when a merchant is present.

Connection state remains available but visually quiet unless reconnecting or failed.

## 4. Permanent left Character HUD

The left sidebar is not a full character sheet. It is the at-a-glance top section of a character sheet plus essential combat and travel information.

### 4.1 Identity block

Show:

- small 72-80 px portrait/medallion,
- character name,
- race,
- class or multiclass summary,
- age,
- alignment.

The portrait is clickable and opens a Character Profile overlay, not the Character Sheet.

### 4.2 Core status

Show prominently:

- HP current / maximum,
- AC,
- Initiative,
- Speed,
- Attacks / Round,
- Carry Weight current / maximum.

Carry Weight must eventually be ruleset-aware rather than a decorative number.

### 4.3 Saving throws

Display saving throws as individual compact boxes.

The set is ruleset-specific. Examples:

- D&D 3.5e: Fortitude, Reflex, Will.
- D&D 5e: six ability saves if that rules adapter exposes them.
- Other systems: whatever the native rules require.

Do not hard-code one ruleset's save model into the generic HUD.

### 4.4 Primary character controls

Immediately below the status block:

- Character Sheet,
- Inventory,
- Codex.

These open dedicated overlays/views.

### 4.5 Currency

Currency is anchored at the bottom of the Character HUD. For D&D-style games this should expose Copper, Silver, Gold, and Platinum where the campaign rules define them.

Campaign-specific currencies remain possible through the existing campaign currency model.

## 5. Character portrait and profile

Portrait sources should be abstracted so the system can later support:

- built-in/default portrait,
- user-uploaded portrait,
- AI-generated portrait,
- DM/campaign-assigned portrait.

The first UI pass only needs the portrait slot and Character Profile overlay entry point.

The future Character Profile overlay may contain:

- large portrait,
- full name and titles,
- race/class/age/alignment,
- appearance and physical description,
- biography/backstory,
- scars or notable features,
- known affiliations/reputation,
- earned titles/epithets.

AI portrait generation is a future feature. It should use actual character data rather than a generic fantasy portrait prompt.

## 6. Story chronicle

The central region is the primary experience.

Use a hybrid chronicle layout:

- Dungeon Master narration is wide, immersive, and visually dominant.
- Player actions remain clearly offset/right-aligned.
- System/combat messages use quieter styling so they do not compete with story narration.
- Text lines remain comfortably readable even when the surrounding story canvas is wide.
- The environment background remains visible around and, where safe, subtly through the narrative surfaces.

The default is a wide gameplay column, but the user may alter layout proportions globally.

## 7. Player-controlled layout preferences

Layout freedom belongs to the player, not the campaign.

Persist account-level preferences for:

- Character HUD width,
- Context Panel width,
- centre/story width or equivalent proportions,
- collapsed/expanded context state,
- preset: Wide / Reading / Cinematic,
- text size,
- future background intensity/accessibility controls.

Save relative proportions or presets rather than only raw pixel widths so settings remain sane across different screens.

Campaigns may provide content or a recommended presentation but may not forcibly override the player's saved layout.

For authenticated users, preferences should be server-backed so they follow the account across devices. Anonymous/temporary play may fall back to local storage until an account exists.

## 8. Context Panel

The right side is adaptive rather than a permanent fixed-purpose sidebar.

### 8.1 Exploration/default state

Possible information:

- current location,
- scene/environment,
- in-world time,
- weather when known/relevant,
- party members present,
- active objective,
- important nearby NPCs or scene details.

### 8.2 Merchant state

When a merchant is active, the Context Panel shows a compact storefront preview:

- merchant name,
- merchant description/role,
- item names,
- prices,
- stock or availability where relevant,
- View Shop action.

The player should not need to open another view merely to discover whether a merchant sells anything useful.

### 8.3 Combat state

During combat the Context Panel switches to the combat interface. See section 10.

### 8.4 Other contextual states

The panel may also switch to:

- travel progress,
- map preview,
- active NPC conversation,
- loot discovery,
- quest/objective focus,
- important conditions/effects.

Context changes must be driven by authoritative campaign/game state, not by brittle string matching against narration text.

## 9. Action composer and contextual command deck

The typing area remains the dominant player control.

Immediately above it, provide one narrow row of small contextual action buttons.

Examples outside combat:

- Speak,
- Look,
- Interact,
- Inventory,
- Custom.

Examples during combat:

- Move,
- Attack,
- Spell,
- Item,
- Grapple,
- Shove.

Examples with a merchant:

- Buy,
- Sell,
- Ask Merchant,
- Leave.

Buttons assist but never restrict play. The player can always type a freeform action.

Unavailable-but-relevant actions remain visible but disabled with a reason where useful, for example `Grapple - Too far (30 ft)`. This allows the player to understand that movement may make the action possible.

The action composer may expand upward as text grows, but the contextual button row must remain visually subordinate to the composer.

## 10. Combat UX

Combat uses a hybrid tactical model.

### 10.1 Two spatial representations

Mapped mode:

- real top-down tactical mini-map when reliable geometry and coordinates exist,
- clickable tokens,
- movement range,
- cover/elevation where known,
- current target,
- initiative/combatant state.

Relative mode:

- when exact geometry is unavailable, show combatants by relative distance/zone,
- examples: melee, near, mid, far,
- show known distance, relative position, elevation, cover, and visible conditions when available.

The UI must never invent exact coordinates merely to make the screen look more tactical.

### 10.2 Target information

Selecting an enemy shows only what the character can reasonably perceive or has learned.

For D&D 3.5e this may combine:

- visible size/equipment/wounds,
- obvious conditions,
- distance,
- cover/elevation,
- relevant Knowledge skill results,
- information learned from prior encounters.

Unknown monster data remains unknown. Exact internal HP, hidden abilities, invisible enemies, or unrevealed weaknesses must not leak through the UI unless game rules/state say the character knows them.

### 10.3 Contextual combat actions

Selecting a target may expose:

- Attack,
- Cast Spell,
- Use Item,
- Grapple,
- Shove,
- other ruleset-native actions.

Availability is rules-adapter driven.

Relevant but unavailable actions can remain disabled with an explanatory reason.

### 10.4 Movement as a first-class action

Movement is independently selectable and can be combined with another planned action.

Mapped combat supports both:

- dragging the player's token to a legal destination,
- selecting Move and clicking a destination.

Relative combat supports meaningful choices such as:

- toward target,
- away from target,
- beside ally,
- take cover,
- close to melee range,
- move to doorway/objective,
- custom movement description.

After planned movement, contextual actions are recalculated from the planned position.

The system may warn about consequences the character can reasonably anticipate, such as provoking an attack of opportunity. It must not reveal hidden enemies or undiscovered threat zones.

### 10.5 Planned turn

Movement and actions should build a planned turn before resolution where the ruleset supports it.

Example:

`Move 20 ft toward Goblin Archer -> Grapple Goblin Archer`

Nothing resolves until the player confirms/submits the turn.

The freeform composer remains available throughout.

## 11. Mobile UX

Desktop and mobile are designed together.

Mobile is story-first, not a squeezed three-column desktop layout.

### 11.1 Mobile shell

- thin immersive top header,
- story fills essentially the full screen,
- environmental background remains visible,
- composer remains the main interaction area.

### 11.2 Character and context

Character HUD opens as a bottom sheet.

Context opens as a separate bottom sheet containing the currently relevant contextual information.

During combat, the Context control may become explicit, e.g. `Combat - 4 enemies`.

### 11.3 Specialist views

These should use full-screen mobile views/overlays:

- tactical combat map,
- Character Sheet,
- Inventory,
- Codex,
- Map,
- Character Profile,
- full Shop.

Mapped combat on mobile supports pinch-zoom, pan, tap targeting, and token movement.

Relative combat may remain inside the Context sheet when that is sufficient.

Avoid a large permanent mobile navigation bar that steals vertical story space.

## 12. Feature-specific fantasy overlays

Use a different physical metaphor where it naturally fits rather than forcing every screen into one gimmick.

### 12.1 Character Sheet

The Character Sheet remains an authentic ruleset-appropriate character sheet.

For D&D 3.5e retain the expected structure and fields. Enrich it with:

- aged parchment,
- subtle ink treatment,
- improved spacing and typography,
- restrained bronze accents,
- better grouping/tabs only where they do not distort the sheet's familiar structure.

Do not redesign away rules information merely for aesthetics.

### 12.2 Codex

Present as an interactive open tome/book.

This is the feature where stronger page/book presentation is appropriate.

### 12.3 Inventory

Use a premium fantasy inventory/equipment interface with leather/wood framing, equipment slots, containers, carried weight, and ownership distinctions.

Do not force inventory into a literal book metaphor.

### 12.4 Map

Use parchment/map-table treatment where appropriate.

Player-visible maps must not expose GM-only secrets.

### 12.5 Character Profile

Use an illuminated portrait-card/manuscript treatment.

### 12.6 Shop

Use merchant-specific fantasy storefront/ledger styling instead of a generic application modal.

## 13. Scene-background architecture

Scene selection uses a layered fallback model:

1. explicit campaign/location background,
2. campaign-specific environment pool,
3. global environment pool.

Examples of environment keys:

- tavern,
- tavern-night,
- busy-market,
- city-street,
- forest,
- forest-camp,
- cave,
- crypt,
- castle-interior,
- mountain-road,
- dungeon,
- coast,
- village.

Scene variants may eventually include:

- day/night,
- rain/snow/fog,
- crowded/abandoned,
- firelight,
- ruined/intact.

Known campaign locations should prefer explicit background assignment. Improvised locations may use a DM/AI environment classification that resolves to a campaign or global pool.

Meaningful scene changes crossfade. Minor movement inside the same environment should not cause background churn.

## 14. Background asset research and licensing

The first asset library uses free assets only.

A later original-art pass may replace generic assets without changing code contracts.

Each asset in the registry must record:

- asset ID,
- source URL,
- creator,
- license,
- commercial-use permission,
- modification permission,
- redistribution permission,
- attribution text/requirement,
- environment tags,
- campaign/location assignment where applicable.

Research sources may include general free-asset libraries and DeviantArt.

DeviantArt images are only eligible where the artist explicitly grants a compatible license/permission or direct permission is obtained. Public visibility alone is not permission to redistribute the artwork with DungeonMasterOS.

Every currently supported campaign should receive an asset audit identifying its key locations/scenes and appropriate free background candidates.

## 15. Rules adapter boundary

Generic UI must not hard-code D&D 3.5e mechanics.

Introduce or extend a rules presentation adapter with capabilities conceptually equivalent to:

- buildCharacterHud(character, campaignState),
- getSavingThrows(character),
- getCarryCapacity(character, items, containers),
- getKnownTargetInformation(character, target, encounterState),
- getContextualActions(character, target, plannedPosition, encounterState),
- validatePlannedMovement(...),
- validatePlannedAction(...).

The initial D&D 3.5e implementation can project from `characterData.dnd35Sheet` and existing live fields where authoritative values already exist.

Missing data must remain visibly unknown/unavailable rather than being invented.

## 16. Encumbrance and ownership model

The HUD reserves a real Carry Weight display.

The eventual item/encumbrance system must distinguish between:

- carried/equipped items,
- items stored inside carried containers,
- items stored elsewhere,
- owned assets that are not physically carried.

A wagon, galley, house, mount, or similar possession may appear in Inventory/Assets but must not be treated as being carried on the character.

Ruleset-specific carrying capacity is derived from the rules adapter. For D&D 3.5e, Strength and relevant size/rules modifiers must drive carrying thresholds.

Magical containers such as Bags of Holding require their own capacity/container logic rather than simply deleting encumbrance from the game.

This data-model work must be reconciled with the in-progress master item compendium/inventory branch rather than implemented independently in a conflicting schema.

## 17. Component architecture

The current `client/src/pages/campaign.tsx` mixes data fetching, WebSocket handling, campaign creation fallback, layout, story rendering, composer, and shop presentation in one file. The redesign should extract focused units without unrelated refactoring.

Suggested boundaries:

- `CampaignGameShell`
- `CampaignGameHeader`
- `CharacterHud`
- `StoryChronicle`
- `StoryMessage`
- `ContextPanel`
- `MerchantContext`
- `CombatContext`
- `SceneBackdrop`
- `ActionComposer`
- `ContextActionDeck`
- `MobileGameChrome`
- `CharacterProfileDialog`
- layout-preference hook/store
- rules presentation adapter(s)

The campaign page remains the data/orchestration boundary initially. Existing API routes and WebSocket event contracts should be preserved in the first shell pass unless a new feature genuinely requires new state.

## 18. Data flow

Initial shell flow:

1. `campaign.tsx` loads campaign, character, messages, currencies, inventory, shop and WebSocket state using existing queries.
2. A rules adapter projects raw character/campaign data into a display-safe HUD model.
3. `CampaignGameShell` receives display models plus interaction callbacks.
4. `StoryChronicle` renders DM/player/system entries.
5. `ContextPanel` chooses the active contextual view from authoritative state.
6. `ActionComposer` submits through the existing campaign action route.
7. Existing WebSocket invalidation continues to refresh campaign, character, inventory, currencies, shop and messages.
8. Later scene/combat state extends this contract without requiring a second parallel game page.

## 19. Failure and fallback behaviour

The redesign must fail gracefully.

- Missing background: render a warm dark fallback texture/gradient.
- Broken background image: fall back without blocking gameplay.
- Missing character field: show unknown/placeholder state, never fabricate rules values.
- Missing rules adapter capability: omit or disable that UI function with a clear reason.
- Context data unavailable: show neutral exploration context rather than an empty broken panel.
- WebSocket reconnecting: keep the game readable and show a quiet reconnecting indicator.
- Combat geometry unavailable: use relative mode instead of fake exact map coordinates.
- Mobile viewport too small: specialist interactions move to full-screen views rather than shrinking beyond usability.

## 20. Accessibility and readability

- Maintain strong foreground/background contrast despite scene artwork.
- Do not communicate state by colour alone.
- All contextual actions must be keyboard reachable.
- Drag movement must always have a click/tap alternative.
- Respect reduced-motion settings for background crossfades and animated transitions.
- Text size preference must not break the desktop shell.
- Mobile touch targets should remain large enough to use reliably.

## 21. Testing strategy

### 21.1 Core shell

- desktop widths including 1366, 1920, 2560 and ultrawide layouts,
- tablet widths,
- representative phone widths,
- global preference persistence,
- panel resize/collapse behaviour,
- long DM messages,
- long player actions,
- zero/large currency values,
- missing optional character fields.

### 21.2 Rules presentation

Unit tests for D&D 3.5e HUD projection:

- identity,
- AC,
- initiative,
- Fort/Ref/Will,
- speed,
- attacks/round,
- unknown fields,
- later encumbrance values.

### 21.3 Regression

Verify the redesign does not break:

- campaign start,
- action submission,
- message updates,
- WebSocket reconnect/invalidation,
- character refresh,
- inventory updates,
- currency updates,
- shop state and purchases,
- character sheet launcher/view,
- campaign restore.

### 21.4 Combat later

Test mapped/relative fallback, knowledge filtering, hidden-information leakage, disabled-action reasons, planned movement/action validation, and mobile map interaction.

## 22. Implementation sequence

The work is deliberately staged so the redesign does not turn `campaign.tsx` into a larger monolith.

### Phase 1 - Core responsive game shell

Implement:

- warm tavern visual tokens/surfaces,
- thin header,
- redesigned Character HUD,
- wide hybrid Story Chronicle,
- Context Panel shell with current exploration/merchant data,
- compact contextual action row with typing-dominant composer,
- responsive desktop/mobile shell,
- mobile Character/Context sheets,
- account-level layout preference foundation,
- background presentation layer with a temporary safe fallback image/gradient contract.

Use existing APIs and WebSocket events wherever possible.

### Phase 2 - Scene/background system and licensed asset library

Implement scene registry, asset manifest, environment fallbacks, transitions, campaign scene assignments and deep asset research for all current campaigns. Include DeviantArt only where licensing permits redistribution/commercial use.

### Phase 3 - Context expansion

Add richer location, NPC, objective, travel, loot and merchant context views.

### Phase 4 - Combat UX

Add encounter state, mapped/relative modes, target knowledge, contextual actions, movement planning, initiative and mobile tactical view.

### Phase 5 - Fantasy overlays

Redesign Character Sheet presentation, Codex tome, Inventory, Map, Character Profile and Shop while preserving each feature's native function.

### Phase 6 - Encumbrance/item integration

Reconcile with the master item compendium/inventory work and add authoritative weights, containers, carried-vs-owned state and ruleset-native carrying capacity.

## 23. Acceptance criteria for Phase 1

Phase 1 is successful when:

- the live campaign page no longer resembles a generic dashboard,
- the warm rustic/tavern visual identity is obvious but readable,
- desktop defaults to a wide story column with permanent compact Character HUD and adaptive Context Panel,
- mobile is story-first with Character and Context bottom sheets,
- Character HUD shows portrait, identity, HP, AC, initiative, speed, attacks/round, ruleset-native saves and carry slot where authoritative data exists,
- Character Sheet, Inventory and Codex remain easy to reach,
- currency remains visible,
- DM narration and player actions are visually distinct in a hybrid chronicle,
- the composer dominates the command area,
- merchant context can show item names/prices without requiring the full shop,
- user layout preferences persist globally,
- current campaign start/action/shop/WebSocket flows still work,
- missing or unsupported data is never fabricated,
- no production item-schema changes conflict with the concurrent compendium/inventory branch.

## 24. Explicit non-goals for Phase 1

Phase 1 does not need to finish:

- AI portrait generation,
- complete tactical combat engine,
- final campaign background library,
- original commissioned art,
- complete encumbrance schema migration,
- every overlay redesign.

Those are planned follow-on phases built on the new shell rather than prerequisites for replacing the current live-play layout.
