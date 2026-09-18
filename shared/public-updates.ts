export type PublicUpdateEntry = {
  id: string;
  date: string;
  title: string;
  description: string;
};

export const PUBLIC_UPDATES: readonly PublicUpdateEntry[] = [
  {
    id: "2026-09-18-account-session-security",
    date: "2026-09-18",
    title: "Account and session security hardening",
    description:
      "DungeonMasterOS has received a substantial account-security update. Active sessions can now be reviewed and revoked from Account Settings, password changes and resets invalidate older sessions, Google sign-in has additional request protection, and sensitive account or privilege changes require recent authentication. The rollout preserves existing accounts and campaigns and does not change gameplay or subscription pricing.",
  },
  {
    id: "2026-09-14-public-page-browser-search-support",
    date: "2026-09-14",
    title: "Public pages now load with stronger browser and search support",
    description:
      "Home, How It Works, and Pricing now include meaningful page content in the initial response, improving search discovery and resilience when scripts are delayed. This release also restores the DungeonMasterOS browser tab icon. Gameplay, accounts, campaigns, and billing are unchanged.",
  },
  {
    id: "2026-08-24-public-updates-release-sync",
    date: "2026-08-24",
    title: "Updates now ship with every release",
    description:
      "The public changelog is now part of the release itself. From now on, anything deployed to Dungeon Master OS must include its Updates entry in the same verified release, so the website cannot quietly fall behind the live game again. The standard test command has also been hardened to discover the complete nested test suite before a release is accepted.",
  },
  {
    id: "2026-08-24-completed-live-release",
    date: "2026-08-24",
    title: "Player Profiles, Achievements, and a major D&D 3.5e rules upgrade",
    description:
      "Player Profile and Achievements are now live and reachable from the dashboard, using your real account and achievement data rather than placeholder content. This release also ships the largest D&D 3.5e rules-library upgrade so far: a provenance-backed canonical rules registry plus verified core races, all 11 core classes, skills, class spell lists, feats, hundreds of spells, weapons, ammunition, armor, and shields. The new 3.5e data is kept edition-isolated so unfinished 5e 2014/2024 work cannot leak into 3.5e play, while the existing legacy 5e experience remains unchanged. This release also includes the completed source-ingestion and verification foundation that lets future 3.5e rules content be added deterministically instead of guessed by the AI.",
  },
  {
    id: "2026-08-22-options-campaign-settings",
    date: "2026-08-22",
    title: "In-game Options, and real Campaign Settings",
    description:
      "A new Options button in the campaign header opens two things. Personal Options are yours alone: pick a layout, turn on reduced motion, and set how achievement pop-ups behave — synced to your account. Campaign Settings are the host's: every change is now validated and logged, and other players can suggest a change (tone, combat style, rules weight, and more) instead of asking in chat — the host accepts or declines it, and a stale suggestion won't silently overwrite something that changed since it was proposed. Hosts can also lock settings mid-session to prevent accidental changes.",
  },
  {
    id: "2026-08-20-character-sheet-equipment-spells",
    date: "2026-08-20",
    title: "Character sheet: Equipment & Spells",
    description:
      "The 3.5e character sheet now has three tabs. Equipment shows your full loadout and inventory at a glance. Spells is a proper spellbook — slots, prepared spells, metamagic, and class resources, with save DCs computed per spell level the way 3.5e actually works.",
  },
  {
    id: "2026-08-18-narration-reliability-fix",
    date: "2026-08-18",
    title: "Narration reliability fix",
    description:
      "Fixed a rare issue where the Dungeon Master's internal bookkeeping could leak into the story text instead of staying behind the scenes. Added several layers of protection so this class of issue can't resurface, and corrected the one past message it affected.",
  },
  {
    id: "2026-08-18-campaign-interface-upgrade",
    date: "2026-08-18",
    title: "The campaign screen finally looks like the game it is",
    description:
      "The rest of the immersive interface is live: your character panel now shows real carry weight and active conditions at a glance, the side panel reflects what's actually happening in the scene (combat, a merchant, a fresh find, or your surroundings), and Inventory, Codex, and Character Sheet all open as proper in-world panels instead of a plain sidebar. Combat controls now work directly from the side panel as well as the action bar.",
  },
  {
    id: "2026-08-18-dm-memory-grounding",
    date: "2026-08-18",
    title: "The Dungeon Master now double-checks its memory against the truth",
    description:
      "Fixed a class of bugs where the AI Dungeon Master could contradict what your character actually carries or owns — claiming an item didn't exist when it did, leaving a returned item stuck in your bag, or letting a purchase go through with no gold to pay for it. The DM is now grounded against your real inventory and currency on every turn, item and currency changes are validated server-side before they apply, and purchases are rejected outright if you can't afford them rather than quietly going into debt.",
  },
  {
    id: "2026-08-18-combat-carry-weight",
    date: "2026-08-18",
    title: "Real combat and carry weight have arrived",
    description:
      "Combat is no longer just narration — encounters now track initiative order, real HP for every combatant, and dice rolls the server actually resolves (attack bonus vs. armor class, crits on a natural 20, fumbles on a natural 1), with enemy turns resolving automatically until it's your move again. The action panel now shows an Attack button per living enemy and a Flee option whenever a fight breaks out. Also added real carrying capacity: your Strength score now determines how much you can carry before you're encumbered, following the same light/medium/heavy load thresholds as the tabletop rules, with your HUD's Carry stat turning amber and then red as you approach your limit. Items you own but leave behind — stashed at an inn, back at your stronghold — no longer count against what you're carrying; a new Carry/Store toggle in your Inventory lets you mark the difference yourself.",
  },
  {
    id: "2026-08-18-immersive-interface",
    date: "2026-08-18",
    title: "A reimagined interface: living scenes, a smarter panel, and a world that remembers",
    description:
      "Rebuilt the entire in-game screen around a parchment-and-bronze fantasy interface instead of the old generic dark UI. The left-hand character panel now shows your portrait, HP, AC, initiative, speed, attacks per round, and carry weight at a glance, with saving throws laid out as their own boxes. The right-hand panel is now context-aware: it shows the merchant's stock while you're shopping, flashes newly found loot for a few seconds, and otherwise shows your current scene, the NPCs you've met, and your active buffs and conditions — all pulled from what's actually happened in your campaign, never guessed. Scenes can now render with real background art instead of a flat void. The Codex opened as a two-page tome, Inventory got a leather-and-wood equipment case with equipped items visually marked, your Character Profile became an illuminated portrait card, the Shop got proper merchant-ledger styling, and the Character Sheet's header picked up the same bronze-and-parchment treatment — all without touching how any of those screens actually work.",
  },
  {
    id: "2026-08-17-character-creation-leveling-achievements",
    date: "2026-08-17",
    title: "Real character creation rules, XP and leveling, and achievements are live",
    description:
      "Character creation is now locked down to real rules instead of free-text guessing: pick a class from the actual 3.5e or 5e roster, roll your stats (or use point buy) before you can enter the world, choose your trained skills, and take your starting feats — including multiclassing if you start above level 1. Added a full XP and leveling system: defeating enemies now awards real XP, a Long Rest button checks whether you have earned a level, and a level-up wizard walks you through hit points, an ability score improvement or a new feat, and which class advances if you are multiclassed. Also surfaced the achievement system for the first time — a Deeds panel on your character sheet shows unlocked and locked achievements, unlocking one now shows the whole party a toast, and reaching 20 level-ups across your characters earns Scars of Experience and 100 bonus AI turns.",
  },
  {
    id: "2026-08-17-item-compendium-inventory-character-sheet",
    date: "2026-08-17",
    title: "Item Compendium launch, inventory fixes, and a proper character sheet look",
    description:
      "Launched the Item Compendium: a public, browsable book of 3,302 items — 2,246 original DungeonMasterOS homebrew items (magic weapons, armor, wondrous items, consumables) plus 1,056 official D&D 5e SRD items imported from the 2014 and 2024 rule sets, each with real structured mechanics, rarity, and source attribution so canon and homebrew never get mixed up. Fixed a bug where using a multi-use consumable (like a flask) deleted it from your inventory after a single use instead of tracking remaining charges. Fixed the Inventory and Codex windows getting stuck and clipping content when reading long documents. Gave the character sheet sidebar a proper parchment, aged-paper look in place of the old dark panel.",
  },
];
