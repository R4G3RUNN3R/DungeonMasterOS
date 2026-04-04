/**
 * flawsFeats.ts
 *
 * Complete library of flaws and feats for the Flaw ↔ Feat exchange system.
 *
 * Design principles:
 * - Flaws must have genuine narrative AND mechanical weight
 * - Every flaw has a DM trigger description so the engine knows WHEN to invoke it
 * - Feats are balanced against flaw severity (minor flaw = minor feat, severe flaw = major feat)
 * - System covers: D&D 5e standard, anime/isekai, homebrew, narrative-only
 */

export interface Flaw {
  id: string;
  name: string;
  category: "combat" | "social" | "mental" | "physical" | "supernatural" | "narrative";
  severity: "minor" | "moderate" | "severe"; // determines feat exchange value
  description: string;       // what the player reads
  mechanicalEffect: string;  // concrete game effect
  dmTrigger: string;         // instruction to DM: when/how to invoke this flaw
  examples: string;          // flavour examples
}

export interface Feat {
  id: string;
  name: string;
  category: "combat" | "magic" | "social" | "utility" | "defensive" | "anime" | "homebrew";
  requiredSeverity: "minor" | "moderate" | "severe"; // minimum flaw severity to unlock
  description: string;
  mechanicalEffect: string;
  statMods?: Array<{ stat: string; modifier: number; type: string }>; // fed into cascade
}

// ── FLAWS LIBRARY ─────────────────────────────────────────────────────────

export const FLAWS: Flaw[] = [
  // ── COMBAT FLAWS ──────────────────────────────────────────────────────
  {
    id: "reckless_fighter",
    name: "Reckless Fighter",
    category: "combat",
    severity: "moderate",
    description: "You throw yourself into danger headfirst, heedless of consequence.",
    mechanicalEffect: "When you attack, you must attack all enemies in range before retreating. Cannot willingly disengage unless at half HP.",
    dmTrigger: "When combat begins, the DM should present tempting targets that would require overextension. NPCs will exploit this recklessness.",
    examples: "Charging the back line alone, refusing to fall back when outnumbered.",
  },
  {
    id: "glass_jaw",
    name: "Glass Jaw",
    category: "combat",
    severity: "minor",
    description: "You hit hard, but you can't take a punch.",
    mechanicalEffect: "First hit in each combat deals +50% damage to you (rounded up).",
    dmTrigger: "Enemies with intelligence will target this character first. Ambushes always hit this character first.",
    examples: "One good hit and you're already reeling.",
  },
  {
    id: "honour_bound",
    name: "Honour Bound",
    category: "combat",
    severity: "moderate",
    description: "You will not strike an unaware, surrendering, or unarmed opponent. Ever.",
    mechanicalEffect: "Cannot attack surprised enemies, cannot finish downed opponents, cannot use dirty tricks or poison.",
    dmTrigger: "The DM will create villains who exploit this — surrendering then attacking, using human shields, fighting unarmoured.",
    examples: "You sheathe your sword when the bandit drops his. Even if he'll pick it back up.",
  },
  {
    id: "berserk",
    name: "Berserk",
    category: "combat",
    severity: "severe",
    description: "When bloodied, you lose control. Ally or enemy — you attack the nearest target.",
    mechanicalEffect: "When HP drops below 25%, you must attack the nearest creature each turn. A DC 15 WIS save (your stat) can override this for 1 round.",
    dmTrigger: "Track HP carefully. When threshold is crossed, narrate the loss of control. Allies should be afraid.",
    examples: "Your party has learned to stay behind you, not beside you.",
  },

  // ── SOCIAL FLAWS ──────────────────────────────────────────────────────
  {
    id: "notorious",
    name: "Notorious",
    category: "social",
    severity: "moderate",
    description: "Your reputation precedes you — and not in a good way. Authorities know your face.",
    mechanicalEffect: "In populated areas, there is a 1-in-4 chance per day that someone recognizes you and alerts guards or enemies.",
    dmTrigger: "In towns and cities, periodically have NPCs recognize the character. Bounty hunters may appear. Nobles refuse audiences.",
    examples: "You robbed that bank two provinces over. They still talk about it.",
  },
  {
    id: "big_mouth",
    name: "Loose Lips",
    category: "social",
    severity: "minor",
    description: "You cannot keep a secret to save your life. If you know it, it comes out.",
    mechanicalEffect: "In social situations, the DM may force a WIS check (DC 12) or the character accidentally reveals a secret.",
    dmTrigger: "In tense social scenes, create situations where keeping quiet matters. The flaw activates at the worst moment.",
    examples: "You told the innkeeper about the hidden rebel base. You didn't mean to.",
  },
  {
    id: "pride",
    name: "Crushing Pride",
    category: "social",
    severity: "moderate",
    description: "Admitting weakness or asking for help is something you simply cannot do.",
    mechanicalEffect: "Cannot voluntarily ask NPCs for help. Cannot accept healing from allies unless unconscious. CHA checks to appear humble automatically fail.",
    dmTrigger: "The DM should create situations where help is clearly available but the character's pride prevents taking it. Villains will offer 'reasonable' deals the character must refuse.",
    examples: "The city healer offered free treatment. You said you were fine. You were not fine.",
  },
  {
    id: "trusting",
    name: "Dangerously Trusting",
    category: "social",
    severity: "moderate",
    description: "You see the good in everyone. Including people who very clearly do not have good in them.",
    mechanicalEffect: "Disadvantage on Insight checks to detect deception. Cannot initiate hostile action against a creature that hasn't attacked first.",
    dmTrigger: "The DM will introduce convincing villains and liars. Give the character chances to detect deception — then have them fail. NPCs will exploit this.",
    examples: "The smiling merchant was obviously a spy. Obviously.",
  },

  // ── MENTAL FLAWS ──────────────────────────────────────────────────────
  {
    id: "phobia_darkness",
    name: "Nyctophobia",
    category: "mental",
    severity: "minor",
    description: "Supernatural, suffocating fear of darkness and enclosed dark spaces.",
    mechanicalEffect: "In total darkness: disadvantage on all checks, -2 to attack rolls. Must make DC 12 WIS save to enter a dark room voluntarily.",
    dmTrigger: "Underground and night scenes should acknowledge this. Extinguished torches are a genuine threat. The DM will arrange at least one scene per session in darkness.",
    examples: "You keep three backup torches. And a backup for the backup.",
  },
  {
    id: "paranoia",
    name: "Paranoia",
    category: "mental",
    severity: "moderate",
    description: "You trust no one, suspect everyone, and jump at shadows.",
    mechanicalEffect: "Disadvantage on all social checks with new NPCs. Cannot benefit from the Help action. Sleeps in armour — always takes penalties for interrupted rest.",
    dmTrigger: "The DM will provide occasional red herrings that seem to confirm the paranoia. Once per session, have a seemingly trustworthy NPC do something suspicious (even if innocent).",
    examples: "You checked the innkeeper for weapons. Twice.",
  },
  {
    id: "obsession",
    name: "Consuming Obsession",
    category: "mental",
    severity: "severe",
    description: "You have one goal that overrides all others. You will sacrifice anything for it.",
    mechanicalEffect: "When your obsession goal is within reach, you must make a DC 15 WIS save to prioritize anything else. Failure means you pursue the goal regardless of danger to self or allies.",
    dmTrigger: "The DM will regularly put the obsession in tension with party goals. Create scenarios where pursuing the obsession costs something real.",
    examples: "You found the man who killed your father. The prisoner transport could wait.",
  },
  {
    id: "bloodlust",
    name: "Bloodlust",
    category: "mental",
    severity: "severe",
    description: "Violence isn't just a tool for you. It's satisfying.",
    mechanicalEffect: "When a combat opportunity presents itself, must make DC 14 WIS save to choose a non-violent option. After killing an enemy, gains advantage on next attack (the rush).",
    dmTrigger: "The DM should offer regular temptations to start fights. NPCs who know the character are wary. Peaceful solutions require more convincing.",
    examples: "You could have let them run. You didn't want to.",
  },

  // ── PHYSICAL FLAWS ────────────────────────────────────────────────────
  {
    id: "chronic_pain",
    name: "Chronic Pain",
    category: "physical",
    severity: "moderate",
    description: "An old wound that never healed right. It flares up at the worst times.",
    mechanicalEffect: "In stressful situations (combat, extended exertion), roll d6 at start of each scene. On a 1, the pain flares: -2 to all physical checks for that scene.",
    dmTrigger: "The DM can trigger this manually for dramatic effect — climbing the tower during the climax, swimming in cold water. The injury has a backstory the DM should reference.",
    examples: "The arrow wound from three years ago. It hates rain.",
  },
  {
    id: "frail",
    name: "Frail Constitution",
    category: "physical",
    severity: "minor",
    description: "Your body is your greatest liability.",
    mechanicalEffect: "-2 max HP per level. Disadvantage on CON saving throws. Disease and poison affect you at double severity.",
    dmTrigger: "Environmental hazards (cold, disease, poison, exhaustion) are genuine threats. The DM should not shy away from these.",
    examples: "Everyone else was fine after the swamp. You were not.",
  },
  {
    id: "distinctive_appearance",
    name: "Unmistakable",
    category: "physical",
    severity: "minor",
    description: "You stand out in a crowd. Disguise is nearly impossible for you.",
    mechanicalEffect: "Stealth checks to blend into crowds automatically fail. Disguise attempts require a DC 16 Deception check. Witnesses always remember you.",
    dmTrigger: "Witnesses will describe the character accurately. Disguise plans involving 'blending in' will need alternatives.",
    examples: "Seven feet tall and covered in scales. Real subtle.",
  },

  // ── SUPERNATURAL FLAWS ────────────────────────────────────────────────
  {
    id: "cursed",
    name: "Cursed",
    category: "supernatural",
    severity: "severe",
    description: "Something ancient and malevolent has marked you. Its attention is not always welcome.",
    mechanicalEffect: "Once per session the DM may invoke the curse — a supernatural complication, an entity drawn to you, a compulsion you must resist (DC 15 WIS).",
    dmTrigger: "The curse has a patron or source that is a recurring element of the campaign. Once per session invoke it meaningfully — not trivially.",
    examples: "The witch's mark. Priests flinch near you. Dogs howl.",
  },
  {
    id: "magic_attracter",
    name: "Magic Magnet",
    category: "supernatural",
    severity: "moderate",
    description: "Spells and magical effects are drawn to you. Being around magic is unsafe.",
    mechanicalEffect: "Whenever magical area effects are rolled, you are the primary or first target. Wild magic surges occur more frequently near you.",
    dmTrigger: "In magical encounters, direct AoE effects toward this character first. Wild magic environments are especially dangerous.",
    examples: "The wizard's fireball definitely clipped you more than the others.",
  },
  {
    id: "power_drain",
    name: "Power Drain",
    category: "supernatural",
    severity: "moderate",
    description: "Your abilities fluctuate. Sometimes you're at full power. Sometimes you're not.",
    mechanicalEffect: "At the start of each session, roll d6. On 1-2: your primary ability (spellcasting, signature power) is at half effectiveness until a long rest.",
    dmTrigger: "When this triggers, narrate it in flavour — the Sharingan is sluggish today, the chakra flows wrong, the spells feel sluggish. The party should feel it.",
    examples: "Not every day is a good jutsu day.",
  },

  // ── NARRATIVE FLAWS ───────────────────────────────────────────────────
  {
    id: "wanted",
    name: "Wanted",
    category: "narrative",
    severity: "severe",
    description: "A powerful organisation is actively hunting you. They have resources and patience.",
    mechanicalEffect: "The DM introduces agents of this organisation at least once every two sessions. They escalate — scouts first, then assassins, then a named hunter.",
    dmTrigger: "Track the escalation. Agents report back. The organisation learns and adapts. This is a persistent campaign thread, not a random encounter.",
    examples: "The guild knows your face. The empire knows your name. Someone paid very good money.",
  },
  {
    id: "debt",
    name: "Life Debt",
    category: "narrative",
    severity: "minor",
    description: "You owe someone your life. They haven't forgotten.",
    mechanicalEffect: "Once per campaign arc, the creditor calls in a favour. The favour will be inconvenient, dangerous, or morally complicated.",
    dmTrigger: "Introduce the creditor as a recurring NPC. When the story needs a complication, have them call the debt. The favour should require genuine sacrifice.",
    examples: "He saved you from the gallows. Now he needs a small favour. Just one small favour.",
  },
  {
    id: "the_prophecy",
    name: "Bound by Prophecy",
    category: "narrative",
    severity: "moderate",
    description: "A prophecy involves you. Whether you want it to or not.",
    mechanicalEffect: "The DM may not retcon the prophecy. Events will bend toward it. The character cannot avoid their prophesied role — only the manner of fulfillment.",
    dmTrigger: "Weave the prophecy into the world. Other factions know it. Some will try to help. Some will try to kill the character to prevent it. Use it as a narrative anchor.",
    examples: "You didn't ask to be the Chosen One. Really.",
  },
];

// ── FEATS LIBRARY ─────────────────────────────────────────────────────────

export const FEATS: Feat[] = [
  // ── MINOR FEATS (exchange for any flaw) ──────────────────────────────
  {
    id: "alert",
    name: "Alert",
    category: "combat",
    requiredSeverity: "minor",
    description: "You are always on guard. You cannot be surprised.",
    mechanicalEffect: "+5 to Initiative. Cannot be surprised while conscious. No disadvantage on Perception while sleeping.",
    statMods: [{ stat: "initiative", modifier: 5, type: "bonus" }],
  },
  {
    id: "lucky",
    name: "Lucky",
    category: "utility",
    requiredSeverity: "minor",
    description: "Three times per day, you can reroll any d20 and take either result.",
    mechanicalEffect: "3 luck points per long rest. Spend 1 to reroll any attack, save, or check — or force an enemy to reroll their attack against you.",
    statMods: [],
  },
  {
    id: "tough",
    name: "Tough",
    category: "defensive",
    requiredSeverity: "minor",
    description: "You are harder to kill than you look.",
    mechanicalEffect: "+2 HP per level (retroactive). Max HP increases by twice your level.",
    statMods: [],
  },
  {
    id: "keen_mind",
    name: "Keen Mind",
    category: "utility",
    requiredSeverity: "minor",
    description: "Perfect memory. You recall anything you've seen or heard with perfect clarity.",
    mechanicalEffect: "You always know which way is north. You know how many hours until sunrise. You can recall anything you've seen or heard in the past month with perfect clarity.",
    statMods: [{ stat: "int", modifier: 1, type: "bonus" }],
  },
  {
    id: "athlete",
    name: "Athlete",
    category: "utility",
    requiredSeverity: "minor",
    description: "Exceptional physical conditioning.",
    mechanicalEffect: "+1 STR or DEX. Climbing costs no extra movement. Stand from prone with 5ft movement. Running jump uses standing jump distance.",
    statMods: [{ stat: "str", modifier: 1, type: "bonus" }],
  },

  // ── MODERATE FEATS (require moderate+ flaw) ──────────────────────────
  {
    id: "war_caster",
    name: "War Caster",
    category: "magic",
    requiredSeverity: "moderate",
    description: "You maintain spells in the heat of battle with preternatural focus.",
    mechanicalEffect: "Advantage on CON saves to maintain Concentration. Can perform somatic components with weapons in hand. Opportunity attacks can be spells.",
    statMods: [],
  },
  {
    id: "sentinel",
    name: "Sentinel",
    category: "combat",
    requiredSeverity: "moderate",
    description: "You are a wall. Nothing gets past you.",
    mechanicalEffect: "Opportunity attacks stop target movement (0 speed). Creatures using Disengage still provoke OA from you. React to enemies attacking adjacent allies.",
    statMods: [],
  },
  {
    id: "polearm_master",
    name: "Polearm Master",
    category: "combat",
    requiredSeverity: "moderate",
    description: "Expert control of reach weapons.",
    mechanicalEffect: "Bonus action attack with polearm butt (d4 + STR bludgeoning). Reach weapons grant opportunity attacks when enemies enter reach.",
    statMods: [],
  },
  {
    id: "resilient",
    name: "Resilient",
    category: "defensive",
    requiredSeverity: "moderate",
    description: "You are proficient in a saving throw of your choice.",
    mechanicalEffect: "+1 to chosen ability score. Gain proficiency in that ability's saving throw.",
    statMods: [],
  },
  {
    id: "shadow_step",
    name: "Shadow Step",
    category: "utility",
    requiredSeverity: "moderate",
    description: "You can teleport between shadows as a bonus action.",
    mechanicalEffect: "Bonus action: teleport up to 60ft to an unoccupied space in dim light or darkness. Next attack has advantage.",
    statMods: [],
  },
  {
    id: "linguist",
    name: "Polyglot",
    category: "social",
    requiredSeverity: "moderate",
    description: "Languages come to you like breathing.",
    mechanicalEffect: "+1 INT. Learn 3 additional languages. Can decipher unknown languages with DC 15 INT check given enough context.",
    statMods: [{ stat: "int", modifier: 1, type: "bonus" }],
  },

  // ── SEVERE FEATS (require severe flaw) ───────────────────────────────
  {
    id: "great_weapon_master",
    name: "Great Weapon Master",
    category: "combat",
    requiredSeverity: "severe",
    description: "You hit hard enough to shake the earth.",
    mechanicalEffect: "Critical hits and killing blows grant a bonus attack. Take -5 to attack roll for +10 damage.",
    statMods: [],
  },
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    category: "combat",
    requiredSeverity: "severe",
    description: "Distance means nothing. Cover means almost nothing.",
    mechanicalEffect: "No disadvantage at long range. Ignore half and three-quarters cover. Take -5 to hit for +10 damage.",
    statMods: [],
  },
  {
    id: "spell_sniper",
    name: "Spell Sniper",
    category: "magic",
    requiredSeverity: "severe",
    description: "Your attack spells reach across impossible distances.",
    mechanicalEffect: "Double the range of spell attacks. Ignore half and three-quarters cover. Learn one attack cantrip from any spell list.",
    statMods: [],
  },
  {
    id: "mobile",
    name: "Phantom Stride",
    category: "combat",
    requiredSeverity: "severe",
    description: "You move like a ghost. Combat is a dance you've already won.",
    mechanicalEffect: "+10ft movement speed. Dash doesn't provoke opportunity attacks. After melee attacking a creature, they cannot OA you until your next turn.",
    statMods: [{ stat: "speed", modifier: 10, type: "bonus" }],
  },

  // ── ANIME / ISEKAI FEATS ─────────────────────────────────────────────
  {
    id: "sharingan_basic",
    name: "Sharingan (Awakened)",
    category: "anime",
    requiredSeverity: "moderate",
    description: "The eye that sees all. You perceive chakra, copy techniques, and see through illusions.",
    mechanicalEffect: "Cannot be surprised. Copy any non-legendary physical technique you observe (DM approval). Advantage against genjutsu/illusion. Costs 1 chakra point per combat round active.",
    statMods: [{ stat: "initiative", modifier: 3, type: "bonus" }],
  },
  {
    id: "conquerors_haki",
    name: "Conqueror's Haki",
    category: "anime",
    requiredSeverity: "severe",
    description: "The will of a king. Weak-willed opponents are simply overwhelmed by your presence.",
    mechanicalEffect: "Once per combat, release a wave of will: all enemies with CR equal to or less than your level must make DC (8 + CHA mod + proficiency) WIS save or fall unconscious for 1 round.",
    statMods: [{ stat: "cha", modifier: 2, type: "bonus" }],
  },
  {
    id: "ultra_instinct",
    name: "Ultra Instinct (Incomplete)",
    category: "anime",
    requiredSeverity: "severe",
    description: "Your body moves before your mind decides. Reaction transcends thought.",
    mechanicalEffect: "When below 25% HP, your AC increases by 4 and you gain advantage on all attacks. This state lasts 3 rounds, then you take 2d6 damage from the strain.",
    statMods: [],
  },
  {
    id: "isekai_cheat_skill",
    name: "Isekai Cheat Skill",
    category: "anime",
    requiredSeverity: "moderate",
    description: "The world gave you a gift upon arrival. Something absurdly useful.",
    mechanicalEffect: "Choose one isekai-style ability: Appraisal (see any entity's true stats), Item Box (unlimited storage), Language Comprehension (speak any language), or Status Window (see your own stats at any time).",
    statMods: [],
  },
  {
    id: "bloodline_limit",
    name: "Bloodline Limit (Kekkei Genkai)",
    category: "anime",
    requiredSeverity: "severe",
    description: "A unique ability passed through your bloodline that cannot be taught or copied.",
    mechanicalEffect: "Work with the DM to define a unique ability tied to your bloodline. Examples: bone manipulation (Kaguya), wood release (Hashirama), lava release. The ability is powerful but has a defined cost and limitation.",
    statMods: [],
  },

  // ── HOMEBREW ─────────────────────────────────────────────────────────
  {
    id: "deathless",
    name: "Deathless",
    category: "homebrew",
    requiredSeverity: "severe",
    description: "You've died before. It didn't take. Once per campaign, you cheat death.",
    mechanicalEffect: "Once per campaign: when you would die, you instead drop to 1 HP. The DM may impose a permanent cost (lost memory, scar, or dark consequence). This uses up the feat permanently.",
    statMods: [],
  },
  {
    id: "void_touched",
    name: "Void-Touched",
    category: "homebrew",
    requiredSeverity: "severe",
    description: "Something from outside touched your mind. It left knowledge. And hunger.",
    mechanicalEffect: "+2 to INT and WIS. You can communicate telepathically within 30ft. Once per long rest, you can glimpse the future (DM gives a vague true vision). The Void sometimes whispers things you didn't ask to know.",
    statMods: [
      { stat: "int", modifier: 2, type: "bonus" },
      { stat: "wis", modifier: 2, type: "bonus" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

export const FLAWS_BY_CATEGORY = FLAWS.reduce((acc, f) => {
  if (!acc[f.category]) acc[f.category] = [];
  acc[f.category].push(f);
  return acc;
}, {} as Record<string, Flaw[]>);

export const FEATS_BY_CATEGORY = FEATS.reduce((acc, f) => {
  if (!acc[f.category]) acc[f.category] = [];
  acc[f.category].push(f);
  return acc;
}, {} as Record<string, Feat[]>);

// Points system: minor = 1 point, moderate = 2, severe = 3
export const FLAW_POINTS: Record<string, number> = { minor: 1, moderate: 2, severe: 3 };
export const FEAT_COST: Record<string, number> = { minor: 1, moderate: 2, severe: 3 };

export function canAffordFeat(selectedFlaws: Flaw[], feat: Feat): boolean {
  const points = selectedFlaws.reduce((s, f) => s + FLAW_POINTS[f.severity], 0);
  const spent = 0; // computed outside
  return FEAT_COST[feat.requiredSeverity] <= points;
}

// Category display labels
export const FLAW_CATEGORY_LABELS: Record<string, string> = {
  combat: "⚔️ Combat",
  social: "🗣️ Social",
  mental: "🧠 Mental",
  physical: "💪 Physical",
  supernatural: "✦ Supernatural",
  narrative: "📖 Narrative",
};

export const FEAT_CATEGORY_LABELS: Record<string, string> = {
  combat: "⚔️ Combat",
  magic: "✨ Magic",
  social: "🗣️ Social",
  utility: "🔧 Utility",
  defensive: "🛡️ Defensive",
  anime: "⭐ Anime / Isekai",
  homebrew: "🔮 Homebrew",
};
