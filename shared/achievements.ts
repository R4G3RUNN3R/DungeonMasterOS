/**
 * DMOS Achievement System
 *
 * Achievements trigger from meaningful play events:
 *   - after DM response  → "dm_response" context
 *   - after stat update  → "stat_update" context
 *   - after item use     → "item_use" context
 *   - after campaign created → "campaign_create" context
 *   - after settings change → "settings_change" context
 *
 * Hidden achievements are not shown in the list until unlocked.
 */

export type AchievementCategory =
  | "character"
  | "combat"
  | "social"
  | "exploration"
  | "meta"
  | "secret";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  flavour: string;           // short italicised quote shown on unlock card
  category: AchievementCategory;
  icon: string;              // emoji
  hidden: boolean;
  points: number;            // cosmetic XP value
  // Real, spendable AI turns granted on unlock — omitted or 0 for the vast
  // majority of achievements, which stay cosmetic-only on purpose (see the
  // "reward evidence of history, not repetition of a button" design note
  // above tryUnlockAchievements in server/routes.ts). Only grant this for
  // achievements backed by a server-authoritative, farm-resistant counter.
  rewardTurns?: number;
}

// ── Full achievement catalogue ───────────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = [

  // ── CHARACTER PROGRESSION ────────────────────────────────────────────────
  {
    id: "scars_of_experience",
    name: "Scars of Experience",
    description: "Reach 20 verified level-ups, across any of your characters.",
    flavour: "\"Twenty times you became something greater.\"",
    category: "character",
    icon: "📈",
    hidden: false,
    points: 100,
    // The one reward-bearing achievement in the launch catalogue — backed by
    // users.totalLevelUps, incremented server-side only by the real,
    // eligibility-checked /level-up endpoint (server/routes.ts), never by
    // narration or client claim. See tryUnlockAchievements.
    rewardTurns: 100,
  },
  {
    id: "iron_body",
    name: "Iron Body",
    description: "Reach 100 HP on a single character.",
    flavour: "\"Pain is just your body's way of telling you it's still working.\"",
    category: "character",
    icon: "🛡️",
    hidden: false,
    points: 50,
  },
  {
    id: "unkillable",
    name: "Unkillable",
    description: "Reach 300 HP on a single character.",
    flavour: "\"You've become something beyond mortal.\"",
    category: "character",
    icon: "💀",
    hidden: false,
    points: 150,
  },
  {
    id: "peak_strength",
    name: "Peak Strength",
    description: "Reach 20 STR on a single character.",
    flavour: "\"The limit of human potential — barely scratched.\"",
    category: "character",
    icon: "💪",
    hidden: false,
    points: 75,
  },
  {
    id: "beyond_mortal",
    name: "Beyond Mortal Limits",
    description: "Reach 30 or higher in any ability score.",
    flavour: "\"Numbers weren't built for what you've become.\"",
    category: "character",
    icon: "⚡",
    hidden: false,
    points: 200,
  },
  {
    id: "jack_of_all",
    name: "Jack of All Trades",
    description: "Use 3 different class abilities in a single session.",
    flavour: "\"Why specialise when you can do everything?\"",
    category: "character",
    icon: "🃏",
    hidden: false,
    points: 60,
  },
  {
    id: "scholar_of_magic",
    name: "Scholar of Magic",
    description: "Have 10 or more spells or abilities on your character sheet.",
    flavour: "\"The library of the self is never full.\"",
    category: "character",
    icon: "📚",
    hidden: false,
    points: 80,
  },

  // ── COMBAT ───────────────────────────────────────────────────────────────
  {
    id: "first_blood",
    name: "First Blood",
    description: "Defeat your first enemy.",
    flavour: "\"Every warrior remembers their first.\"",
    category: "combat",
    icon: "⚔️",
    hidden: false,
    points: 25,
  },
  {
    id: "untouchable",
    name: "Untouchable",
    description: "Win a fight without taking damage.",
    flavour: "\"They never even came close.\"",
    category: "combat",
    icon: "🌀",
    hidden: false,
    points: 100,
  },
  {
    id: "overkill",
    name: "Overkill",
    description: "Deal damage exceeding an enemy's HP by 200% or more.",
    flavour: "\"That was unnecessary. Glorious, but unnecessary.\"",
    category: "combat",
    icon: "💥",
    hidden: false,
    points: 75,
  },
  {
    id: "last_stand",
    name: "Last Stand",
    description: "Win a fight while at 1 HP.",
    flavour: "\"On the edge of the abyss — and you chose to fight back.\"",
    category: "combat",
    icon: "🔥",
    hidden: false,
    points: 150,
  },
  {
    id: "never_surrender",
    name: "Never Surrender",
    description: "Survive 5 separate near-death moments (HP dropped to 10 or below).",
    flavour: "\"Death keeps sending you back with a note: 'Not yet.'\"",
    category: "combat",
    icon: "🩸",
    hidden: false,
    points: 120,
  },

  // ── ROLEPLAY / SOCIAL ─────────────────────────────────────────────────────
  {
    id: "silver_tongue",
    name: "Silver Tongue",
    description: "Resolve a conflict without combat.",
    flavour: "\"The best fights are the ones that never happen.\"",
    category: "social",
    icon: "🗣️",
    hidden: false,
    points: 80,
  },
  {
    id: "manipulator",
    name: "Manipulator",
    description: "Convince an enemy to switch sides.",
    flavour: "\"Your greatest weapon was always words.\"",
    category: "social",
    icon: "🎭",
    hidden: false,
    points: 120,
  },
  {
    id: "cold_blooded",
    name: "Cold-Blooded",
    description: "Betray an ally for personal gain.",
    flavour: "\"Everyone has a price. Even friendships.\"",
    category: "social",
    icon: "🗡️",
    hidden: false,
    points: 100,
  },
  {
    id: "marked_by_fate",
    name: "Marked by Fate",
    description: "Have a character flaw triggered and acknowledged by the Dungeon Master.",
    flavour: "\"Even your worst traits have a role to play.\"",
    category: "social",
    icon: "🔮",
    hidden: false,
    points: 90,
  },

  // ── EXPLORATION ──────────────────────────────────────────────────────────
  {
    id: "curious_mind",
    name: "Curious Mind",
    description: "Investigate 10 unique locations in your campaigns.",
    flavour: "\"Every door hides a different world.\"",
    category: "exploration",
    icon: "🗺️",
    hidden: false,
    points: 70,
  },
  {
    id: "dungeon_diver",
    name: "Dungeon Diver",
    description: "Clear your first dungeon.",
    flavour: "\"You went in. You came out. Most don't.\"",
    category: "exploration",
    icon: "🏰",
    hidden: false,
    points: 60,
  },
  {
    id: "cartographer",
    name: "Cartographer",
    description: "Visit 25 different locations across your campaigns.",
    flavour: "\"The world is a map, and you are the legend.\"",
    category: "exploration",
    icon: "🧭",
    hidden: false,
    points: 180,
  },

  // ── META / SYSTEM ─────────────────────────────────────────────────────────
  {
    id: "architect",
    name: "Architect",
    description: "Create your first campaign.",
    flavour: "\"Every great saga begins with a name and a spark.\"",
    category: "meta",
    icon: "🏗️",
    hidden: false,
    points: 10,
  },
  {
    id: "rule_breaker",
    name: "Rule Breaker",
    description: "Enable homebrew rules in a campaign.",
    flavour: "\"The rulebook is a suggestion, not a ceiling.\"",
    category: "meta",
    icon: "📜",
    hidden: false,
    points: 30,
  },
  {
    id: "anime_protagonist",
    name: "Anime Protagonist",
    description: "Play in a campaign with an anime world enabled.",
    flavour: "\"Your power level? Don't worry about it.\"",
    category: "meta",
    icon: "✨",
    hidden: false,
    points: 40,
  },
  {
    id: "god_tier",
    name: "God-Tier",
    description: "Enable Epic Mode in a campaign.",
    flavour: "\"Standard rules don't apply anymore. Neither does common sense.\"",
    category: "meta",
    icon: "🌌",
    hidden: false,
    points: 50,
  },
  {
    id: "chronicler",
    name: "The Chronicler",
    description: "Have a campaign with 100 or more messages.",
    flavour: "\"This isn't just a campaign. This is a novel.\"",
    category: "meta",
    icon: "📖",
    hidden: false,
    points: 100,
  },

  // ── DMOS-SPECIFIC ─────────────────────────────────────────────────────────
  {
    id: "living_world",
    name: "Living World",
    description: "The Dungeon Master references something from a previous scene in a meaningful way.",
    flavour: "\"The world didn't forget what you did.\"",
    category: "meta",
    icon: "🌍",
    hidden: false,
    points: 120,
  },
  {
    id: "system_remembers",
    name: "The System Remembers",
    description: "An NPC reacts to something your character said or did much earlier.",
    flavour: "\"Consequences have long memories.\"",
    category: "meta",
    icon: "🧠",
    hidden: false,
    points: 130,
  },
  {
    id: "gifted_power",
    name: "Gifted Power",
    description: "Receive an ability or power directly from the Dungeon Master's narration.",
    flavour: "\"The world itself decided you were worthy.\"",
    category: "meta",
    icon: "🎁",
    hidden: false,
    points: 70,
  },
  {
    id: "item_hoarder",
    name: "Item Hoarder",
    description: "Have 20 or more items in a single character's inventory.",
    flavour: "\"You didn't leave anything behind. Not voluntarily, anyway.\"",
    category: "meta",
    icon: "🎒",
    hidden: false,
    points: 60,
  },

  // ── SECRET / HIDDEN ───────────────────────────────────────────────────────
  {
    id: "the_absolute",
    name: "The Absolute",
    description: "Reach a state where the DM acknowledges your character has exceeded normal limits.",
    flavour: "\"There are no more rules here. You are the rule.\"",
    category: "secret",
    icon: "👁️",
    hidden: true,
    points: 500,
  },
  {
    id: "shouldnt_be_here",
    name: "You Shouldn't Be Here",
    description: "Break expected narrative flow in a way that surprises even the Dungeon Master.",
    flavour: "\"The script didn't account for this.\"",
    category: "secret",
    icon: "❓",
    hidden: true,
    points: 300,
  },
  {
    id: "unlikely_alliance",
    name: "Unlikely Alliance",
    description: "Form an alliance with someone or something that should have been an enemy.",
    flavour: "\"Some stories write themselves.\"",
    category: "secret",
    icon: "🤝",
    hidden: true,
    points: 200,
  },
  {
    id: "played_dm",
    name: "Played the DM",
    description: "Use the DM's own world against them in a way they clearly didn't anticipate.",
    flavour: "\"Even the narrator can be surprised.\"",
    category: "secret",
    icon: "♟️",
    hidden: true,
    points: 250,
  },
  // Emergent titles — hidden until unlocked on purpose (see server/titles.ts
  // and processTitleTags). The requirement itself (10 / 100 established
  // titles) must never be shown to the player pre-unlock, which is exactly
  // what `hidden: true` already enforces in the achievements UI.
  {
    id: "many_names",
    name: "Many Names",
    description: "This character has become known by many names.",
    flavour: "\"They call you a great many things, these days.\"",
    category: "character",
    icon: "🎭",
    hidden: true,
    points: 150,
  },
  {
    id: "legend_of_many_names",
    name: "Legend of Many Names",
    description: "Across every character on this account, the world has given you countless names.",
    flavour: "\"No single name was ever going to be enough.\"",
    category: "meta",
    icon: "👑",
    hidden: true,
    points: 300,
  },
];

export const ACHIEVEMENT_MAP: Record<string, Achievement> = Object.fromEntries(
  ACHIEVEMENTS.map(a => [a.id, a])
);

// ── Event context types ──────────────────────────────────────────────────────

export type AchievementEventType =
  | "campaign_create"
  | "settings_change"
  | "dm_response"
  | "stat_update"
  | "item_use"
  | "item_added"
  | "character_update"
  | "ability_granted";

export interface AchievementEventContext {
  type: AchievementEventType;

  // Character data snapshot (current state after the event)
  character?: {
    id: number;
    hp: number;
    maxHp: number;
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
    abilityCount?: number;  // total abilities + spells on sheet
    itemCount?: number;
    establishedTitleCount?: number;  // server/titles.ts — never player-visible pre-unlock
  };

  // Campaign data snapshot
  campaign?: {
    id: number;
    messageCount: number;
    epicMode: boolean;
    homebrewRules: string;
    animeWorldSource: string;
    animeWorldMode: string;
  };

  // DM response analysis flags (populated by the achievement engine)
  dm?: {
    mentionedPastEvent?: boolean;  // DM references a previous scene explicitly
    npcReactedToPast?: boolean;    // NPC reacts to something the character said/did before
    confirmedFlawTriggered?: boolean;  // DM acknowledged a flaw activating
    confirmedConflictResolvedPeacefully?: boolean;
    confirmedEnemySwitchedSides?: boolean;
    confirmedBetrayal?: boolean;
    confirmedEnemyDefeated?: boolean;
    confirmedFightWonWithoutDamage?: boolean;
    confirmedFightWonAt1HP?: boolean;
    confirmedOverkill?: boolean;
    confirmedExceededNormalLimits?: boolean;
    confirmedSurpriseNarrative?: boolean;
    confirmedUnlikelyAlliance?: boolean;
    confirmedPlayedDM?: boolean;
    confirmedDungeonCleared?: boolean;
    newLocationName?: string;  // if a new location was visited
  };

  // Item context
  item?: {
    name: string;
    type: string;
  };

  // Account-wide counters — server-authoritative tallies that live on the
  // user row, not derived from anything the AI said. Kept separate from
  // `character` (which is a per-event snapshot of one character) because
  // these accumulate across every character on the account.
  account?: {
    totalLevelUps: number;
    establishedTitleCount?: number;  // server/titles.ts — never player-visible pre-unlock
  };

  // Already unlocked achievement IDs (to avoid duplicates)
  unlockedIds: Set<string>;
}

// ── Achievement engine ───────────────────────────────────────────────────────
// Returns list of achievement IDs that should be unlocked for this event.
// The caller is responsible for saving to DB and broadcasting.

export function checkAchievements(ctx: AchievementEventContext): string[] {
  const toUnlock: string[] = [];
  const has = (id: string) => ctx.unlockedIds.has(id);
  const check = (id: string, condition: boolean) => {
    if (!has(id) && condition) toUnlock.push(id);
  };

  // ── ACCOUNT-WIDE COUNTERS ───────────────────────────────────────────────
  if (ctx.account) {
    check("scars_of_experience", ctx.account.totalLevelUps >= 20);
    if (ctx.account.establishedTitleCount !== undefined) {
      check("legend_of_many_names", ctx.account.establishedTitleCount >= 100);
    }
  }

  // ── CHARACTER PROGRESSION ──────────────────────────────────────────────
  if (ctx.character) {
    const c = ctx.character;
    check("iron_body", c.maxHp >= 100);
    check("unkillable", c.maxHp >= 300);
    check("scholar_of_magic", (c.abilityCount ?? 0) >= 10);
    check("item_hoarder", (c.itemCount ?? 0) >= 20);
    if (c.establishedTitleCount !== undefined) {
      check("many_names", c.establishedTitleCount >= 10);
    }

    // STR milestone
    if (c.str !== undefined) {
      check("peak_strength", c.str >= 20);
      check("beyond_mortal", c.str >= 30);
    }
    // Any stat at 30+
    if (
      !has("beyond_mortal") &&
      (c.str ?? 0) < 30 &&
      [c.dex, c.con, c.int, c.wis, c.cha].some(v => (v ?? 0) >= 30)
    ) {
      toUnlock.push("beyond_mortal");
    }
  }

  // ── META / SYSTEM ──────────────────────────────────────────────────────
  if (ctx.type === "campaign_create") {
    check("architect", true);
  }

  if (ctx.type === "settings_change" && ctx.campaign) {
    check("rule_breaker", (ctx.campaign.homebrewRules ?? "").trim().length > 0);
    check("anime_protagonist", (ctx.campaign.animeWorldSource ?? "").trim().length > 0 && ctx.campaign.animeWorldMode !== "none");
    check("god_tier", ctx.campaign.epicMode === true);
  }

  if (ctx.campaign) {
    check("chronicler", (ctx.campaign.messageCount ?? 0) >= 100);
  }

  // ── ABILITY GRANTED ─────────────────────────────────────────────────────
  if (ctx.type === "ability_granted") {
    check("gifted_power", true);
  }

  // ── DM RESPONSE ANALYSIS ───────────────────────────────────────────────
  if (ctx.dm) {
    check("living_world", ctx.dm.mentionedPastEvent === true);
    check("system_remembers", ctx.dm.npcReactedToPast === true);
    check("marked_by_fate", ctx.dm.confirmedFlawTriggered === true);
    check("silver_tongue", ctx.dm.confirmedConflictResolvedPeacefully === true);
    check("manipulator", ctx.dm.confirmedEnemySwitchedSides === true);
    check("cold_blooded", ctx.dm.confirmedBetrayal === true);
    check("first_blood", ctx.dm.confirmedEnemyDefeated === true);
    check("untouchable", ctx.dm.confirmedFightWonWithoutDamage === true);
    check("overkill", ctx.dm.confirmedOverkill === true);
    check("last_stand", ctx.dm.confirmedFightWonAt1HP === true);
    check("the_absolute", ctx.dm.confirmedExceededNormalLimits === true);
    check("shouldnt_be_here", ctx.dm.confirmedSurpriseNarrative === true);
    check("unlikely_alliance", ctx.dm.confirmedUnlikelyAlliance === true);
    check("played_dm", ctx.dm.confirmedPlayedDM === true);
    check("dungeon_diver", ctx.dm.confirmedDungeonCleared === true);
  }

  return toUnlock;
}

// ── DM response achievement scanner ─────────────────────────────────────────
// Analyses DM response text for achievement-triggering narrative patterns.
// Returns a dm context object with detected flags.

export function scanDMResponseForAchievements(
  dmResponse: string,
  character: { hp: number; maxHp: number },
): Partial<AchievementEventContext["dm"]> {
  const r = dmResponse.toLowerCase();
  const flags: Partial<AchievementEventContext["dm"]> = {};

  // Enemy defeated
  if (/\b(falls?|collapses?|slain|defeated|vanquished|dead|drops? to the ground|crumples?|the .{0,30}(is|are) (dead|defeated|slain|no more)|enemy (falls?|is down))\b/.test(r)) {
    flags.confirmedEnemyDefeated = true;
  }

  // Won without taking damage
  if (/\b(without (a scratch|taking damage|being hit|suffering|injury)|untouched|unscathed|perfect victory|flawless|not a mark on)\b/.test(r)) {
    flags.confirmedFightWonWithoutDamage = true;
  }

  // Won at 1 HP (last stand) — also check HP state
  if (character.hp <= 1 && flags.confirmedEnemyDefeated) {
    flags.confirmedFightWonAt1HP = true;
  }

  // Overkill
  if (/\b(obliterate|vaporize|vaporised|obliterated|nothing left|reduced to (ash|dust|nothing|pulp)|excessive(ly)?|more than enough|way beyond|completely destroy)\b/.test(r)) {
    flags.confirmedOverkill = true;
  }

  // Peaceful resolution
  if (/\b(peacefully|stands down|lowers? (their |his |her )?weapon|without (a fight|bloodshed|combat|violence)|talks? (them |him |her )?down|diffuse|negotiate|parley|resolv(es?|ed) without)\b/.test(r)) {
    flags.confirmedConflictResolvedPeacefully = true;
  }

  // Enemy switches sides
  if (/\b(switch(es|ed)? sides|joins? you|joins? your (party|cause|side)|now (fight|stand|stand|works?) with you|defect(s|ed)?|turn(s|ed)? against (them|their))\b/.test(r)) {
    flags.confirmedEnemySwitchedSides = true;
  }

  // Betrayal
  if (/\b(betray(s|ed|al)?|backstab(bed|s)?|turn(s|ed) on|double-cross|sold out|sacrifice(d)? .{0,30}(ally|companion|friend))\b/.test(r)) {
    flags.confirmedBetrayal = true;
  }

  // Flaw triggered
  if (/\b(your .{0,30}(flaw|weakness|failing|vice|compulsion)|can('t| not) resist|despite yourself|old habit|the urge overwhelms|your nature (takes?|seizes?|wins?))\b/.test(r)) {
    flags.confirmedFlawTriggered = true;
  }

  // NPC reacts to past — DM referencing history
  if (/\b(remembers?|recalls?|heard about|told me about|last time|when you|from before|hasn't forgotten|still talk(s|ing)? about|word spread|word has spread|news of|reputation precede)\b/.test(r)) {
    flags.mentionedPastEvent = true;
    flags.npcReactedToPast = true;
  }

  // Exceeded normal limits
  if (/\b(beyond (mortal|human|normal|natural)|transcend(s|ed)?|no longer (bound|limited|mortal)|achieved (godhood|divinity|ascension)|the (rules?|law) no longer apply|broken (the ceiling|all limits))\b/.test(r)) {
    flags.confirmedExceededNormalLimits = true;
  }

  // Unlikely alliance
  if (/\b(unlikely ally|unlikely alliance|sworn (enemy|foe) now (stands?|fights?) with|once your enemy|former (enemy|foe|rival) now|against all odds, (they|he|she) (joins?|sides with|ally with))\b/.test(r)) {
    flags.confirmedUnlikelyAlliance = true;
  }

  // Dungeon cleared
  if (/\b(dungeon (cleared|complete|conquered|finished|defeated)|last (chamber|room|enemy) .{0,20}(cleared|fallen|defeated)|the dungeon is (yours|silent|empty))\b/.test(r)) {
    flags.confirmedDungeonCleared = true;
  }

  return flags;
}
