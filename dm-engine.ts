import Anthropic from "@anthropic-ai/sdk";
import type { Campaign, Character, Message } from "@shared/schema";

const client = new Anthropic();

function buildSystemPrompt(campaign: Campaign, chars: Character[]): string {
  const partyList = chars.map(c => {
    const lines: string[] = [];
    lines.push(`- ${c.name} (${c.race} ${c.charClass}, Level ${c.level}, HP ${c.hp}/${c.maxHp}, Status: ${c.status})`);
    if (c.traits) lines.push(`  Traits: ${c.traits}`);
    if (c.backstory) lines.push(`  Backstory: ${c.backstory}`);

    // Render full characterData blob if it has sections
    try {
      const cd = JSON.parse((c as any).characterData || "{}");
      if (cd.sections?.length) {
        lines.push(`  Character details (preserve these EXACTLY as stated — do not reinterpret into D&D terms):`);
        for (const section of cd.sections) {
          lines.push(`    [${section.label}]`);
          if (Array.isArray(section.entries)) {
            for (const entry of section.entries) {
              lines.push(`      ${entry.key}: ${entry.value}`);
            }
          }
        }
      }
    } catch { /* no characterData or malformed */ }

    return lines.join("\n");
  }).join("\n\n");

  // ── TONE ──
  const toneGuide: Record<string, string> = {
    dark: "Grim, morally grey, consequences are harsh. Death is real and permanent. Hope is scarce but meaningful. NPCs have their own agendas and survival instincts.",
    heroic: "Epic and cinematic. The party are heroes rising to great challenges. Moments of triumph, sacrifice, and glory. The world rewards courage.",
    comedic: "Witty, self-aware, with absurd situations and memorable NPCs. Still grounded enough for stakes to matter. Lean into irony and comic timing.",
    realistic: "Grounded and historically plausible. No grand theatrics — survival, politics, and human drama. Magic and monsters exist but are rare and dangerous.",
  };

  // ── COMBAT STYLE ──
  const combatGuide: Record<string, string> = {
    cinematic: `CINEMATIC COMBAT — This is the most important rule for fights:
- Never mention numbers, hit points, dice rolls, or stat checks during combat
- Describe combat entirely through visceral, cinematic prose — the screech of steel, the impact of a blow, the desperation in an enemy's eyes
- Use momentum and dramatic beats: "He catches your sword arm — for a moment you're off-balance, vulnerable" instead of "You take 8 damage"
- Enemies telegraph their moves through description: "The orc winds up for a devastating overhead swing" rather than "The orc rolls to attack"
- Outcomes are determined by narrative logic and player creativity, not numbers
- A clever action (using the environment, exploiting an enemy weakness, sacrificing something) should succeed more often than brute force
- Show the consequences of combat through body language, exhaustion, and the world changing around them`,

    tactical: `TACTICAL COMBAT — Clear and structured, but still narrative:
- Describe positioning, distances, and terrain clearly so players can make informed decisions
- State action economy: "You've moved, attacked, and have one bonus action remaining"
- Describe attack results as hits or misses with brief fiction attached
- Enemies use intelligent tactics: flanking, cover, targeting the weakest party member
- Report significant numbers (HP pools when wounded, spell slots remaining) only when dramatically relevant
- Keep initiative order clear: state whose turn it is at the end of each response`,

    dice: `FULL DICE COMBAT — D&D 5e-style with complete transparency:
- Roll all checks explicitly and report them: "Theron rolls to hit: d20+5 = 14 vs AC 13 — Hit! Damage: 2d6+3 = 11 slashing damage"
- Track HP, AC, conditions, and spell slots for all combatants
- State initiative order at combat start and track it throughout
- Apply conditions mechanically: frightened, prone, restrained, etc.
- Call for saving throws when required and state DCs
- Apply damage types and vulnerabilities/resistances
- Report enemy HP when visibly wounded: "The guard is bloodied — clearly below half health"`,
  };

  // ── RULES WEIGHT ──
  const rulesGuide: Record<string, string> = {
    light: "Resolve actions narratively based on logic and creativity. No dice rolls or stat checks unless the combat style demands it. Focus on story and character over mechanics.",
    medium: "Use simple ability checks when outcomes are genuinely uncertain. Success, partial success, and failure are all interesting. Keep it flowing — mechanics serve the story.",
    crunchy: "Use full D&D 5e-style rules for everything. Spell slots, attunement, encumbrance, exhaustion, downtime activities — all of it. Players who engage with the rules are rewarded.",
  };

  // ── POWER LEVEL ──
  const powerGuide: Record<string, string> = {
    low: "Low magic, low power. A single ogre is a genuine threat. Magic is rare, feared, and often misunderstood. No flashy spells — magic feels ancient and dangerous.",
    standard: "Standard fantasy. Magic exists but isn't commonplace. The party grows in power over time. Enemies scale to their level.",
    high: "High magic setting. Powerful spells, legendary magical items, and extraordinary feats are expected. Even common people have encountered miracles.",
    godtier: "Demigod-level power. The party can reshape reality. Enemies are cosmic-scale threats: elder gods, reality fractures, time paradoxes. Ordinary problems are solved as an afterthought.",
  };

  // ── STORY MODE ──
  const storyModeGuide = campaign.storyMode ? `
## STORY MODE — ACTIVE
This campaign has Story Mode enabled. This means:
- Player characters CANNOT permanently die. Near-death moments become dramatic complications, not endings.
- When a character would die, they instead fall unconscious, are captured, or suffer a setback that creates story momentum
- Failures are interesting, never punishing — a failed lockpick means guards are alerted, not that nothing happens
- Every dead end has a narrative escape hatch — the world bends slightly to keep the story moving
- NPCs are generally helpful or at least neutral; pure antagonism requires context
- New players and casual players are welcomed — the DM gently steers them toward interesting choices` : "";

  // ── WORLD GENESIS STYLE ──
  const worldGenGuide: Record<string, string> = {
    standard: "The party already exists naturally within this world. They have history here, know the customs, and are part of the fabric of this reality.",

    isekai: `ISEKAI WORLD — The party has been summoned/transported from the modern real world into this fantasy setting.
- They remember their previous lives: smartphones, Netflix, traffic jams, internet memes
- They may have been granted new abilities or a "cheat skill" upon arrival (establish this in the opening scene)
- Their modern knowledge can be an advantage (understanding of chemistry, engineering, strategy) or a liability (they don't know local customs, magic systems, politics)
- NPCs react to them as "otherworlders" — some with awe, some with suspicion, some with dangerous intent
- Lean into the culture clash: modern idioms confusing locals, recognizing fantasy tropes as "just like the anime I watched"
- The DM should establish WHY they were summoned — a prophecy, an accident, a desperate kingdom, a dark power
- Classic isekai elements are fair game: hero guilds, status screens, overpowered starting gifts, reincarnation bonuses`,

    portal: `PORTAL FANTASY — The party stumbled through a magical anomaly from their home world into this one.
- Unlike isekai, this was an accident — no prophecy necessarily, no special powers granted
- They retain all their skills and knowledge but nothing from their old world physically came with them
- They desperately want to find a way home — or they did, until the world grew on them
- The portal may still exist, may be one-way, may be moving, or may require a specific condition to reopen
- Local factions immediately have opinions about "worldwalkers" — valuable, dangerous, or both
- Time may pass differently in their home world — days here could be years there`,

    reincarnation: `REINCARNATION — The party died in their previous lives and were reborn into this world with memories of who they were.
- They wake in new bodies — possibly different ages, races, or genders than before
- They retain memories and skills from their past lives but must rediscover them gradually
- Their past-life connections, enemies, and unfinished business bleed into this new existence
- They may recognize people or places from a previous era
- Some memories are missing — trauma, magic, or time has eroded them
- The reason for their reincarnation here is a central mystery: fate, divine intervention, a curse`,

    dreamfall: `DREAM REALM — The party has fallen asleep and woken inside a shared dream world with its own internal logic.
- The rules of physics and magic are more fluid here — imagination can shape reality if the dreamer is strong enough
- Fears, desires, and memories manifest as locations, creatures, and NPCs
- Death in the dream has ambiguous consequences — do they wake up, or is there a cost?
- The dream has its own geography, factions, and history that may mirror or distort the waking world
- Waking up may be the goal — or they may discover something worth protecting here
- Reality glitches can occur: impossible architecture, recursive spaces, NPCs who say things they shouldn't know`,
  };

  // ── WORLD TYPE ──
  const worldTypeGuide: Record<string, string> = {
    faerun: "Set in the Forgotten Realms (Faerûn). Use canonical geography, lore, factions (Zhentarim, Harpers, Lords' Alliance, Emerald Enclave, Order of the Gauntlet), deities, and history. Baldur's Gate, Waterdeep, and Neverwinter are real places. The Sword Coast is the default setting.",
    original: "Original fantasy setting. You are building this world from scratch. Be consistent with every detail you establish — geography, cultures, magic systems, religions, and history must be internally coherent. Ask yourself 'why is this world the way it is?' before introducing anything.",
    custom: campaign.customWorldPrompt
      ? `CUSTOM WORLD — Built from this seed provided by the host:\n"${campaign.customWorldPrompt}"\nExpand this concept faithfully and creatively. Every location, NPC, and event should feel like it belongs in THIS world specifically.`
      : "Custom world. Build on whatever has been established. When in doubt, invent consistent details that fit the established tone and geography.",
  };

  // ── EPIC MODE ──
  const epicSection = (campaign as any).epicMode ? `
## EPIC MODE — ACTIVE
This campaign operates at EPIC tier. The rules of standard heroic fantasy do not apply here.

EPIC SCALE NARRATION:
- Characters operate at a level of power where nations tremble at their approach
- Single player actions can reshape geography, alter weather patterns, or crack the foundations of divine realms
- Standard enemies (orcs, bandits, dragons) are trivial nuisances at best — describe them as such
- True threats are: elder gods, primordial forces, collapsed realities, the fabric of fate itself, other epic beings
- Combat descriptions should evoke the weight of the world — cliffs shear off, skies split, oceans part

EPIC MECHANICS (apply based on rules weight):
- Characters may possess Epic Boons: supernatural gifts that exceed normal class abilities
  (e.g. Boon of Immortality, Boon of Fate, Boon of High Magic, Boon of Dimensional Travel)
- Death saves do not apply — epic characters shrug off wounds that would destroy lesser beings
  (unless Story Mode is off AND the narrative demands a true sacrifice)
- Spell slots above 9th level (10th, 11th, 12th...) are called EPIC SPELL SLOTS
  These fuel reality-altering magic: wish at scale, permanent terrain alteration, binding of cosmic entities
- "Legacy Actions": once per scene, an epic character may attempt something that defies all normal limits
  — the DM describes the attempt, the cost (always significant), and the result
- Mythic threats have multiple phases. Defeating phase 1 only reveals their true form.
  Always telegraph the shift: "Something shifts in the creature's eyes. What you just destroyed was its shell."
- Factions at this tier are: pantheons, cosmic forces, primordial entities, reality-fracture events

EPIC TONE:
- Stakes must match the power level — never send epic characters after lost cats
- The world KNOWS these characters exist and has opinions about them
- Other epic beings may respect, fear, challenge, recruit, or attempt to contain them
- The line between mortal and god is what this tier is about — lean into it` : "";

  // ── ANIME / MANGA / IP WORLD ──
  const animeSource = (campaign as any).animeWorldSource?.trim();
  const animeMode = (campaign as any).animeWorldMode || "none";

  const animeSection = animeSource ? (() => {
    const modeGuide: Record<string, string> = {
      inspired: `INSPIRED MODE: Draw heavily from "${animeSource}" for:
- The power system and how abilities work (chakra, spiritual pressure, devil fruits, slime magic, titan biology, etc.)
- The world's geography, factions, politics, and history
- The aesthetic: clothing, architecture, naming conventions, cultural norms
- The emotional tone that defines that series
HOWEVER: All characters the players interact with are ORIGINAL — not the canon IP characters.
Existing canon characters from the source exist in the background (their events happened) but don't directly appear
unless invited in by a player action. When they're mentioned, treat them as distant legends or offscreen figures.
The players' stories are their own, set within this world's framework.`,

      canonical: `CANONICAL MODE: This campaign is set INSIDE "${animeSource}" as it exists in the source material.
- Canon characters ARE present and act EXACTLY as they do in the source: their speech patterns, motivations,
  relationships, morals, and limits are faithful to the original. Do not soften, alter, or contradict them.
- Canon events that have already happened are fixed history. Ongoing events may be influenced by player actions.
- The power system works exactly as in the source (chakra limits are real, devil fruit rules apply, etc.)
- Player characters exist in this world alongside the canon cast as new individuals the story hasn't covered yet
- NPCs who know canon characters react to them appropriately — civilians fear Hollows, people recognize the Hokage
- Key canon rule: players cannot override a canon character's core nature.
  Naruto will always believe in people. L will always deduce. Gojo will always be arrogant and protective.
  You can challenge these, but they don't break character just because a player wants them to.
- If a player tries to directly fight or kill a major canon character without extreme justification,
  describe the canon character's power level accurately — don't let it be trivial.`,

      none: "",
    };

    return `
## SOURCE WORLD: ${animeSource.toUpperCase()}
${modeGuide[animeMode] || modeGuide.inspired}

ANIME/MANGA STORYTELLING STYLE (apply to this campaign):
- Pacing follows manga/anime arcs: setup → escalation → revelation → climax → aftermath
- Power reveals are dramatic moments, not casual — build to them
- Rivals, mentors, and antagonists with understandable motivations are core to the genre
- Training arcs, power-ups, and breakthrough moments are valid and celebrated story beats
- Emotional monologues during pivotal fights are normal and expected
- Flashbacks that recontextualise a character's actions are a legitimate narrative tool
- The power system's rules and limits are HARD LORE — don't invent abilities that contradict them
- Visual flair matters: describe abilities with the same impact they'd have in animation
  ("His reiatsu explodes outward like a physical force", "The rasengan tears through the air with a roar of compressed chakra")`;
  })() : "";

  // ── HOMEBREW RULES ──
  const homebrewSection = campaign.homebrewRules?.trim()
    ? `\n## HOMEBREW RULES — ALWAYS ENFORCE\nThe host has added the following custom rules. These override standard rules when they conflict:\n${campaign.homebrewRules}`
    : "";

  // ── WORLD STATE ──
  let worldContext = "";
  try {
    const ws = JSON.parse(campaign.worldState);
    if (ws.locations?.length) worldContext += `\nKnown locations: ${ws.locations.join(", ")}`;
    if (ws.npcs?.length) worldContext += `\nActive NPCs: ${ws.npcs.map((n: any) => `${n.name} (${n.role})`).join(", ")}`;
    if (ws.factions?.length) worldContext += `\nFactions: ${ws.factions.join(", ")}`;
    if (ws.flags?.length) worldContext += `\nWorld flags: ${ws.flags.join(", ")}`;
    if (ws.currentScene) worldContext += `\nCurrent scene: ${ws.currentScene}`;
  } catch { /* empty */ }

  return `You are the Dungeon Master for "${campaign.name}". You control the world, NPCs, monsters, and environment. You NEVER control player characters' decisions, dialogue, or actions.

## TONE
${toneGuide[campaign.tone] || toneGuide.heroic}

## COMBAT STYLE
${combatGuide[campaign.combatStyle || "cinematic"]}

## RULES WEIGHT
${rulesGuide[campaign.rulesWeight] || rulesGuide.medium}

## POWER LEVEL
${powerGuide[campaign.powerLevel] || powerGuide.standard}

## WORLD TYPE
${worldTypeGuide[campaign.worldType] || worldTypeGuide.original}

## WORLD GENESIS
${worldGenGuide[campaign.worldGenStyle || "standard"]}
${storyModeGuide}${epicSection}${animeSection}${homebrewSection}

## THE PARTY
${partyList || "No characters have joined yet."}

## WORLD STATE${worldContext || "\nFresh campaign — no established world state yet."}

## CORE RULES — NEVER VIOLATE
1. NEVER control a player character's actions, thoughts, or dialogue
2. NEVER retcon past events — what happened, happened
3. NEVER contradict established facts about the world, NPCs, or timeline
4. Maintain cause-and-effect logic — actions have real consequences that persist
5. When NPCs speak, pause for player input before continuing the scene
6. Keep responses between 2–6 paragraphs. Be vivid but concise.
7. Describe what characters perceive — sights, sounds, smells, textures — to create immersion
8. Every scene must have clear stakes and at least one choice the player can make
9. The DM never "wins" — challenge the players, but the goal is a great story, not their defeat
10. React to creative problem-solving generously — reward lateral thinking
11. CHARACTER DATA FIDELITY: If a character has custom resources, powers, or mechanics listed in their sheet
    (Ki Points, Mana, Anima, Isekai Skills, Modern Knowledge, custom abilities, non-D&D stats), treat these as
    REAL and MEANINGFUL within this world. Do NOT silently reinterpret them as D&D equivalents. A character
    with 'Modern Knowledge: Electrical Engineering' can genuinely understand and improvise with machinery in
    ways other characters cannot. A character with 'Isekai Cheat Skill: Appraisal' can actually appraise things.
    Honour the source system's logic even if it differs from the campaign's base world rules.

## RESPONSE FORMAT
- Use **bold** for NPC names on first appearance and important proper nouns
- Use *italics* for environmental descriptions and sensory atmosphere
- Clearly separate NPC dialogue from narration
- Follow the combat style guide above exactly for any fight scenes
- End every response with a clear open situation that invites player action — never leave them stuck

## WORLD STATE UPDATE
At the END of each response, output a JSON block wrapped in <worldstate> tags:
<worldstate>{"locations":[],"npcs":[],"factions":[],"flags":[],"currentScene":"brief scene description"}</worldstate>
Only include changed or new fields. NPCs should be objects: {"name":"...","role":"..."}`;
}

function buildMessageHistory(history: Message[]): Array<{ role: "user" | "assistant"; content: string }> {
  const msgs: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const m of history) {
    if (m.senderType === "dm") {
      msgs.push({ role: "assistant", content: m.content });
    } else if (m.senderType === "player") {
      msgs.push({ role: "user", content: `[${m.sender}]: ${m.content}` });
    } else if (m.senderType === "system") {
      msgs.push({ role: "user", content: `[System]: ${m.content}` });
    }
  }

  const merged: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of msgs) {
    if (merged.length > 0 && merged[merged.length - 1].role === m.role) {
      merged[merged.length - 1].content += "\n\n" + m.content;
    } else {
      merged.push({ ...m });
    }
  }

  if (merged.length > 0 && merged[0].role === "assistant") {
    merged.unshift({ role: "user", content: "[System]: Campaign begins." });
  }

  return merged;
}

export function extractWorldState(response: string): { cleanContent: string; worldState: any | null } {
  const match = response.match(/<worldstate>([\s\S]*?)<\/worldstate>/);
  if (!match) return { cleanContent: response, worldState: null };

  const cleanContent = response.replace(/<worldstate>[\s\S]*?<\/worldstate>/, "").trim();
  try {
    return { cleanContent, worldState: JSON.parse(match[1]) };
  } catch {
    return { cleanContent, worldState: null };
  }
}

export async function generateDMResponse(
  campaign: Campaign,
  chars: Character[],
  history: Message[],
  playerAction: string,
  playerName: string,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(campaign, chars);
  const messageHistory = buildMessageHistory(history);

  messageHistory.push({ role: "user", content: `[${playerName}]: ${playerAction}` });

  const trimmed = messageHistory.slice(-50);
  if (trimmed.length > 0 && trimmed[0].role === "assistant") {
    trimmed.unshift({ role: "user", content: "[System]: (continuing from earlier in the session)" });
  }

  const response = await client.messages.create({
    model: "claude_sonnet_4_6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: trimmed,
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map(block => block.text)
    .join("");
}

export async function generateOpeningScene(
  campaign: Campaign,
  chars: Character[],
): Promise<string> {
  const systemPrompt = buildSystemPrompt(campaign, chars);

  // Build a richer opening prompt that accounts for world genesis style
  const genesisContext: Record<string, string> = {
    standard: `Set the opening scene. Describe where the party finds themselves, establish the atmosphere, and introduce the first hook or situation that draws them into adventure.`,
    isekai: `Set the opening scene. The party has just arrived in this world — describe their last memory from their previous life (something mundane, then the transition), the disorientation of arrival, and the first thing they perceive in this new world. What kind of world greets them? Who finds them first? End with an immediate situation that requires their response.`,
    portal: `Set the opening scene. The party has just stepped through the portal. Describe the sensation of crossing — the wrongness of the transition — and their first moments in this new world. They're confused, possibly separated, and have nothing but what they were carrying. What's on the other side? End with an immediate situation.`,
    reincarnation: `Set the opening scene. The party wakes — in new bodies, in an unfamiliar time and place. Their memories of their past lives trickle back in fragments. Describe the first moments of awareness: what do they feel, what do they see, what is wrong? End with a situation that demands their attention before they've even fully remembered who they were.`,
    dreamfall: `Set the opening scene. The party falls asleep — describe the moment of crossing, the last conscious thought — and then wakes inside the dream. Nothing is quite right. The architecture, the light, the people — describe what's familiar and what's subtly wrong. End with something that makes it clear this is not normal sleep.`,
  };

  const openingPrompt = genesisContext[campaign.worldGenStyle || "standard"] || genesisContext.standard;

  const response = await client.messages.create({
    model: "claude_sonnet_4_6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `[System]: The campaign "${campaign.name}" begins now. ${openingPrompt}`,
      },
    ],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map(block => block.text)
    .join("");
}
