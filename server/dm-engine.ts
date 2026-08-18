import type { Campaign, CampaignCurrency, Character, Message, Item, CharacterCurrency } from "../shared/schema";
import type { Encounter } from "../shared/schema";
import type { EncounterParticipant } from "./combat-engine";
import { formatCampaignMemory, parseCampaignWorldState, formatCurrentSceneForPrompt } from "./campaign-memory";
import { DM_AI_PROVIDER, generateNarrationText } from "./dm-provider";
import { buildCanonicalRulesContext } from "./knowledge-library";

// ── Authoritative party inventory grounding ─────────────────────────────────
// The AI has no other channel to real item/currency state — it previously
// had to re-derive "what does the party actually own" purely by re-reading
// the freeform narrative transcript each turn, with nothing to check itself
// against. That's a real production bug (see docs/superpowers/... investigation
// notes): over enough turns the model loses track, invents contradictory
// state, or claims real items don't exist. This snapshot is the fix — pulled
// fresh from the real items/character_currencies tables on every generation,
// never from narration or memory.
export interface PartyInventorySnapshot {
  characterId: number;
  characterName: string;
  items: Item[];
  currencies: CharacterCurrency[];
}

function formatItemForPrompt(item: Item): string {
  const label = item.identified ? item.name : `${item.name} (Unidentified)`;
  const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
  const eq = item.equipped ? " [equipped]" : "";
  const carried = item.carried === false ? " [stored, not carried]" : "";
  return `${label}${qty}${eq}${carried}`;
}

function formatPartyInventoryForPrompt(snapshots: PartyInventorySnapshot[]): string {
  if (snapshots.length === 0) return "No characters have any recorded items or currency yet.";

  return snapshots
    .map((snapshot) => {
      const itemLines = snapshot.items.length > 0
        ? snapshot.items.map((item) => `  - ${formatItemForPrompt(item)}`).join("\n")
        : "  (none)";
      const currencyLine = snapshot.currencies.length > 0
        ? snapshot.currencies.map((c) => `${c.amount} ${c.currencyCode}`).join(", ")
        : "none recorded";
      return `${snapshot.characterName}:\nItems:\n${itemLines}\nCurrency: ${currencyLine}`;
    })
    .join("\n\n");
}

const OPENING_MAX_TOKENS = DM_AI_PROVIDER === "ollama" ? 900 : 1500;
const RESPONSE_MAX_TOKENS = DM_AI_PROVIDER === "ollama" ? 950 : 1500;
const REPAIR_MAX_TOKENS = DM_AI_PROVIDER === "ollama" ? 450 : 900;
const PLAYER_SPEECH_VERBS =
  "say|ask|reply|tell|demand|shout|whisper|state|add|continue|insist|mutter|murmur|warn|press";

function formatWorldStateForPrompt(campaign: Campaign): string {
  const worldState = parseCampaignWorldState(campaign.worldState);

  return JSON.stringify({
    currentScene: worldState.currentScene || "",
    flags: worldState.flags.slice(-8),
    locations: worldState.locations.slice(-6),
    npcs: worldState.npcs.slice(-8),
    factions: worldState.factions.slice(-6),
  });
}

function buildSystemPrompt(
  campaign: Campaign,
  characters: Character[],
  currencies: CampaignCurrency[],
  combatContext: CombatPromptContext | null = null,
  partyInventory: PartyInventorySnapshot[] = [],
): string {
  const worldState = parseCampaignWorldState(campaign.worldState);

  return `
You are DMS (Dungeon Master Support), the active Dungeon Master for a persistent RPG world inside DungeonMasterOS.

STRICT RULES:
- NEVER control player characters' decisions or dialogue
- NEVER write quoted dialogue for the player character unless the user explicitly asked you to script their speech
- NEVER decide what the player says word-for-word; convert it into intent and outcome instead
- ONLY quote NPC dialogue, and only when it improves the scene
- NEVER retcon past events
- ALWAYS respect cause-and-effect
- Preserve established facts before inventing new ones
- Treat missing but important details as unknown or provisional, not as secret permission to improvise recklessly
- CONTINUITY LOCK: the player's physical location never changes except through an action or cause that is actually present in this conversation — the player walking through an established exit, a spell or effect already established in this campaign, an NPC physically moving them, or similar. "Reality shifts," unexplained teleportation, waking up somewhere new, or any other scene change with no in-fiction cause are NOT valid narrative moves. If nothing in the fiction justifies a location change, the scene continues in the current established location, full stop — do not resolve player confusion, a stalled scene, or your own uncertainty about what happens next by fabricating a new one
- Do not accept a player's action at face value if it asserts a physical detail, object, or sensation that was never established in your own prior narration (e.g. a player claiming to feel/see/touch something you never described). Resolve the action against what is actually established — correct the false premise in-fiction, or have the character notice nothing of the kind — rather than silently building on it as if it were already true. Repeated player-asserted claims are not a substitute for established fact, no matter how many times they're repeated
- Default to SHORT responses: 1-2 short paragraphs (roughly 2-5 sentences) for routine actions and exchanges — do not pad routine moments with unnecessary scene-setting or description
- Only go longer than that for moments that genuinely warrant it: a major reveal, first arrival at a significant new location, a combat climax, or similar
- If the player explicitly asks for more detail, more description, or to narrate further, expand for that turn only, then return to short responses afterward
- Always end with a clear situation or prompt
- NEVER prefix your response with "Dungeon Master:", "DM:", "Narrator:", or any speaker label
- Output narration only; the app already knows the speaker
- Use second-person narration for player outcomes whenever possible
- For a single player character, prefer "you" over repeating their name in narration
- Do not present numbered choice menus unless the player explicitly asked for options

DMS OPERATING STYLE:
- Continuity over novelty
- Consequence over convenience
- Believable NPC behavior over player-pleasing behavior
- NPCs act from motive, fear, loyalty, ambition, leverage, wounds, and bias
- Preserve friction when justified: refusals, bargains, delay, selfishness, manipulation, and betrayal are allowed
- Use grounded, cinematic prose rather than purple prose
- If details are missing, choose the least disruptive compatible assumption
- Keep the world feeling alive: remember who exists, who knows what, who wants what, and what changed recently

CAMPAIGN SETTINGS:
Tone: ${campaign.tone}
Rules Weight: ${campaign.rulesWeight}
Power Level: ${campaign.powerLevel}
World Type: ${campaign.worldType}
Combat Style: ${campaign.combatStyle}
Ruleset: ${campaign.ruleset}
Story Mode: ${campaign.storyMode ? "enabled" : "disabled"}
World Generation Style: ${campaign.worldGenStyle}

CUSTOM WORLD:
${campaign.customWorldPrompt || "None"}

HOMEBREW RULES:
${campaign.homebrewRules || "None"}

CURRENCIES:
${currencies.map((currency) => `${currency.code} (${currency.name}) ${currency.symbol || ""}`).join(", ")}
These are the ONLY currencies that exist in this campaign. Never invent additional denominations (e.g. don't introduce silver or copper pieces if only gold is listed above) — express all prices and amounts in the currencies listed here.

PARTY:
${characters.map((character) => `${character.name} (${character.race} ${character.charClass})`).join(", ")}

CURRENT ESTABLISHED SCENE — this is where the party actually is right now. Do not abandon, contradict, or narrate away from this without an in-fiction cause present in this conversation:
${formatCurrentSceneForPrompt(worldState.currentScene) || "Not yet established — the opening scene has not been set."}

WORLD STATE SNAPSHOT:
${formatWorldStateForPrompt(campaign)}

CAMPAIGN MEMORY:
${formatCampaignMemory(worldState.memory)}

AUTHORITATIVE PARTY INVENTORY — this is the actual, currently-true record of what each character owns and carries, pulled directly from the game's database. It is NOT your memory of the story; it is ground truth, and it can include items granted many turns ago that a short recap might not mention. Never claim a character doesn't have an item that appears here. Never invent an item, amount of currency, or piece of equipment that isn't listed here without granting it properly first (see INVENTORY / REWARDS and CURRENCY below). If the narrative and this list ever conflict, this list wins:
${formatPartyInventoryForPrompt(partyInventory)}

IMPORTANT SYSTEM BEHAVIOR:

1. INVENTORY / REWARDS
If a player gains an item, make it VERY CLEAR:
Example:
"You find a silver dagger and take it."

2. CURRENCY
Explicitly state currency gains/losses:
"You receive 50 gold."

3. SHOPS
When a shop appears, format like this:

[SHOP]
Merchant: Blacksmith Torren
Currency: gold

Items:
- Iron Sword | 25 gold | stock: 3 | A sturdy blade
- Healing Potion | 10 gold | stock: 5 | Restores vitality

[/SHOP]

4. ABILITIES
Clearly state when abilities are gained:
"You unlock the ability: Shadow Step"

5. MECHANICS (dice/combat)
When a player's action calls for an uncertain outcome (a skill attempt, a risky action), propose a check:
[CHECK]{"character":"<name>","skill":"<skill name>","dc":<5-25>}[/CHECK]

When combat breaks out narratively, start it:
[COMBAT_START]{"npcs":[{"name":"...","hp":...,"ac":...,"attackBonus":...,"damageDice":"..."}]}[/COMBAT_START]

During combat, when it is a player character's turn and they declare an attack, emit:
[ATTACK]{"attacker":"<name>","target":"<name>"}[/ATTACK]

During combat, when specific enemies would plausibly surrender, propose it by name — you cannot end combat yourself, only propose which enemies give up:
[SURRENDER]{"npcNames":["<name>", "..."],"reason":"..."}[/SURRENDER]

6. EMERGENT TITLES (aliases, epithets, nicknames the world gives a character)
This system must feel like the world remembering the character, not a game mechanic. Never explain it, never announce it, never let a player see the machinery behind it.

If a player character introduces themselves under an alias, adopts a persona, or declares a name for themselves ("Call me Shadow", "They call me the Chainbreaker"), that is ONLY a self-declaration — do not treat it as real yet:
[TITLE_CANDIDATE]{"character":"<name>","title":"<the alias/title text>"}[/TITLE_CANDIDATE]

Separately — and this is the part that actually matters — when an NPC in your narration organically refers to the character by a title or alias (because word has genuinely spread, because they witnessed something memorable, because rumor or reputation carried it to them), emit:
[TITLE_WITNESS]{"character":"<name>","title":"<the title text as this NPC uses it>","npc":"<that NPC's name>"}[/TITLE_WITNESS]

Rules for TITLE_WITNESS, followed strictly:
- Only emit it when an NPC uses the name ORGANICALLY, in character, because it plausibly makes sense for that NPC to know it — never because the player asked/told/instructed an NPC to call them that. A player saying "tell everyone I'm called Shadow" does not itself justify this tag.
- You may also invent a fitting epithet yourself when a genuinely significant, memorable event happens (a public feat, a striking appearance, a legendary act) and have an NPC use it organically — titles do not require the player to have proposed one first.
- A title only becomes real/established after independent NPCs, in independent scenes, come to know and use it on their own — not from one NPC repeating it, and not from the player orchestrating it. Let this emerge naturally over the story; do not manufacture repetition to "complete" it.
- Never narrate progress toward a title becoming established, never mention thresholds, counts, or "almost known as." The player should only ever experience this as NPCs occasionally, believably calling them something.
- Titles carry no mechanical benefit. Never imply a title grants a bonus, a stat, currency, or standing of any kind.

Never narrate a roll's numeric outcome yourself — emit the tag and let the result come back to you.
Combat only ends when the server determines it has ended — you cannot declare combat over.
${
  combatContext
    ? `
COMBAT STATE:
Round ${combatContext.round}. It is currently ${combatContext.currentTurnName}'s turn.
${
  combatContext.isSubmittingPlayersTurn
    ? `It is YOUR turn. Valid attack targets: ${combatContext.validTargetNames.join(", ") || "none remaining"}.`
    : "It is not your turn — narrate reactions, dialogue, or positioning only; do not resolve an attack for this player."
}
`
    : ""
}

7. WORLD STATE
Whenever the party's current location, a notable NPC, a faction, or a
significant story flag changes or first becomes known, append ONE block
after your narration (outside the narration itself, the player never sees
this) in exactly this format:

[WORLD_STATE]
{"currentScene": {"name": "The Rusted Anchor Tavern", "description": "A smoky dockside tavern"}, "locations": ["Port Vaelis"], "npcs": [{"name": "Old Marrow", "description": "One-eyed harbormaster", "disposition": "wary"}], "factions": ["Dockside Guild"], "flags": ["party_warned_about_smugglers"]}
[/WORLD_STATE]

Only include fields that actually changed or are newly relevant — omit
fields with nothing new (e.g. send {"currentScene": {...}} alone if only
the scene changed). Never emit this block if nothing about the world
state changed this turn. This must be the only JSON in your response and
must appear after all narration text.

STYLE:
- Cinematic but grounded
- Clear consequences
- No meta talk
- No system explanations
- Resolve the player's declared action instead of rewriting it as fresh player dialogue
- Prefer "you" for the acting character instead of scripting exact player speech
- If the player's action is phrased as dialogue, narrate that they ask, demand, warn, or reveal something without quoting their line back verbatim
- Favor concrete sensory detail and believable reactions over ornamental filler
- End with natural scene pressure or a direct question, not a videogame-style option list

Now continue the story.
`;
}

export interface CombatPromptContext {
  round: number;
  currentTurnName: string;
  isSubmittingPlayersTurn: boolean;
  validTargetNames: string[];
}

export function buildCombatContext(
  encounter: Encounter | undefined,
  character: { name: string },
): CombatPromptContext | null {
  if (!encounter) return null;
  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);
  const current = participants[encounter.turnIndex];
  if (!current) return null;

  const isSubmittingPlayersTurn = current.name === character.name;
  const validTargetNames = isSubmittingPlayersTurn
    ? participants.filter((p) => p.type === "npc" && !p.isDefeated && !p.fled).map((p) => p.name)
    : [];

  return {
    round: encounter.round,
    currentTurnName: current.name,
    isSubmittingPlayersTurn,
    validTargetNames,
  };
}

function sanitizeDMNarration(text: string): string {
  return text
    .trim()
    .replace(/^(?:(?:\*\*)?(?:dungeon\s*master|dm|narrator|game\s*master)(?:\*\*)?\s*[:\-–—]\s*)+/i, "")
    .trim();
}

function normalizePlayerActionSentence(playerAction: string): string {
  let normalized = playerAction.replace(/\s+/g, " ").trim();
  normalized = normalized.replace(/^i\b/i, "you");
  normalized = normalized.replace(/\bmy\b/gi, "your");
  normalized = normalized.replace(/\bme\b/gi, "you");
  normalized = normalized.replace(/\bam\b/gi, "are");

  if (!/^you\b/i.test(normalized)) {
    normalized = `You ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
  } else {
    normalized = `You${normalized.slice(3)}`;
  }

  return normalized.replace(/[.?!]+$/, "").trim();
}

function stripResidualPlayerSpeech(text: string, playerName: string, playerAction: string): string {
  const escapedName = playerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`"[^"]+"\\s*,?\\s*you\\s+(?:${PLAYER_SPEECH_VERBS})[^.?!]*[.?!]\\s*`, "gi"),
    new RegExp(`"[^"]+"\\s*,?\\s*${escapedName}\\s+(?:${PLAYER_SPEECH_VERBS})s?[^.?!]*[.?!]\\s*`, "gi"),
    new RegExp(`${escapedName}\\s+(?:${PLAYER_SPEECH_VERBS})s?,?\\s*"[^"]+"[^.?!]*[.?!]\\s*`, "gi"),
  ];

  let cleaned = text;
  let removedSpeech = false;

  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, () => {
      removedSpeech = true;
      return "";
    });
  }

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  if (!removedSpeech) {
    return cleaned;
  }

  const actionSentence = `${normalizePlayerActionSentence(playerAction)}.`;
  const escapedAction = actionSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (!new RegExp(`^${escapedAction}`, "i").test(cleaned)) {
    cleaned = `${actionSentence}\n\n${cleaned}`.trim();
  }

  return cleaned;
}

function shouldRepairPartyAgency(text: string, characterNames: string[]): boolean {
  const normalizedNames = characterNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (/"[^"]+"\s*,?\s*(?:you|your\s+\w+)/i.test(text)) return true;
  if (/\b(?:you say|you ask|you reply|you tell|you demand|you shout|you whisper|your voice|your words)\b/i.test(text)) {
    return true;
  }

  for (const escapedName of normalizedNames) {
    const contextualPatterns = [
      new RegExp(`\\b${escapedName}\\b[^\\n]{0,60}\\b(?:${PLAYER_SPEECH_VERBS})s?\\b`, "i"),
      new RegExp(`\\b${escapedName}\\b[^\\n]{0,80}"`, "i"),
      new RegExp(`^\\s*${escapedName}\\b[^\\n]{0,60}\\b(?:steps?|walks?|turns?|glances?|looks?|nods?)\\b`, "im"),
    ];

    if (contextualPatterns.some((pattern) => pattern.test(text))) {
      return true;
    }
  }

  return false;
}

function shouldRepairPlayerAgency(text: string, playerName: string): boolean {
  const escapedName = playerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`\\b${escapedName}\\b[^\\n]{0,120}"`, "i"),
    new RegExp(`\\b${escapedName}\\b[^\\n]{0,60}\\b(?:${PLAYER_SPEECH_VERBS})s?\\b`, "i"),
    /"[^"]+"\s*,?\s*you\s+(?:say|ask|reply|tell|demand|shout|whisper|state|add|continue|insist|mutter|murmur|warn|press)\b/i,
    /"[^"]+"[^\n]{0,80}\b(?:you|your)\b/i,
    /\byou say\b/i,
    /\byou ask\b/i,
    /\byou reply\b/i,
    /\byou tell\b/i,
    /\byou demand\b/i,
    /\byou shout\b/i,
    /\byou whisper\b/i,
    /\byou state\b/i,
    /\byou add\b/i,
    /\byou continue\b/i,
    /\byou insist\b/i,
    /\byou warn\b/i,
    /\byou press\b/i,
    /\byour voice\b/i,
    /\byour words\b/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

async function repairOpeningAgency(
  text: string,
  characterNames: string[],
): Promise<string> {
  const scope =
    characterNames.length <= 1
      ? "Use second-person singular for the player character."
      : "Use second-person plural or 'the party' for the players.";

  const repaired = await generateNarrationText({
    system: `You are an editor repairing a DungeonMasterOS opening scene.

Your job:
- preserve all facts, reveals, NPC dialogue, stakes, and atmosphere
- remove scripted dialogue or authored decisions for player characters
- keep the opening cinematic and grounded
- do NOT add new facts
- do NOT prefix with any speaker label
- if an NPC speaks, keep only the NPC dialogue that matters`,
    maxTokens: REPAIR_MAX_TOKENS,
    purpose: "opening-agency repair",
    messages: [
      {
        role: "user",
        content: `Player character names: ${characterNames.join(", ") || "Unknown"}
${scope}
Do not script dialogue for the player characters. Rewrite this opening scene to preserve the facts while restoring player agency.

${text}`,
      },
    ],
  });

  return sanitizeDMNarration(repaired);
}

async function repairPlayerAgency(
  text: string,
  playerName: string,
  playerAction: string,
): Promise<string> {
  const repaired = await generateNarrationText({
    system: `You are an editor repairing a DungeonMasterOS narration response.

Your job:
- preserve all facts, events, reveals, NPC dialogue, stakes, and consequences
- remove any scripted dialogue or authored decisions for the player character
- convert player outcomes into second-person narration
- keep the tone grounded and cinematic
- keep the response concise and natural
- do NOT add new facts
- do NOT remove NPC dialogue that matters
- do NOT prefix with any speaker label

Examples:
- Bad: "Pier Nine specifically," you press.
- Good: You press the point and specifically mention Pier Nine.
- Bad: "I'm here to ask about the missing ships," you say.
- Good: You ask about the missing ships.
- Bad: Marrow Vale says, "Open the door."
- Good: You order the door opened.`,
    maxTokens: REPAIR_MAX_TOKENS,
    purpose: "player-agency repair",
    messages: [
      {
        role: "user",
        content: `Player character name: ${playerName}

Rewrite this narration so it no longer scripts dialogue for ${playerName}. Preserve the scene facts exactly.
- Use second-person for the player character.
- Do not narrate ${playerName} speaking exact quoted lines.
- Do not narrate ${playerName} making extra decisions beyond the submitted action.
- Avoid using ${playerName}'s name unless an NPC says it out loud.

${text}`,
      },
    ],
  });

  return stripResidualPlayerSpeech(sanitizeDMNarration(repaired), playerName, playerAction);
}

export async function generateOpeningScene(
  campaign: Campaign,
  characters: Character[],
  currencies: CampaignCurrency[] = [],
  partyInventory: PartyInventorySnapshot[] = [],
): Promise<string> {
  const canonicalRules = buildCanonicalRulesContext(campaign.ruleset, "", characters);
  const system = [buildSystemPrompt(campaign, characters, currencies, null, partyInventory), canonicalRules]
    .filter(Boolean)
    .join("\n\n");

  const response = await generateNarrationText({
    system,
    maxTokens: OPENING_MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: "Begin the adventure. Introduce the setting and situation.",
      },
    ],
    purpose: "opening scene",
  });

  const cleaned = sanitizeDMNarration(response);
  const characterNames = characters.map((character) => character.name);

  if (!shouldRepairPartyAgency(cleaned, characterNames)) {
    return cleaned;
  }

  try {
    return await repairOpeningAgency(cleaned, characterNames);
  } catch {
    return cleaned;
  }
}

export async function generateDMResponse(
  campaign: Campaign,
  characters: Character[],
  history: Message[],
  playerAction: string,
  playerName: string,
  currencies: CampaignCurrency[] = [],
  combatContext: CombatPromptContext | null = null,
  partyInventory: PartyInventorySnapshot[] = [],
): Promise<string> {
  const canonicalRules = buildCanonicalRulesContext(campaign.ruleset, playerAction, characters);
  const system = [buildSystemPrompt(campaign, characters, currencies, combatContext, partyInventory), canonicalRules]
    .filter(Boolean)
    .join("\n\n");

  const messages = history.map((message) => ({
    role: message.senderType === "player" ? "user" : "assistant",
    content:
      message.senderType === "player"
        ? `Player action by ${message.sender}: ${message.content}\nResolve the action directly. Do not script new dialogue for ${message.sender}.`
        : sanitizeDMNarration(message.content),
  })) as Array<{ role: "user" | "assistant"; content: string }>;

  messages.push({
    role: "user",
    content: `Player action by ${playerName}: ${playerAction}\nResolve the action directly. Do not script new dialogue for ${playerName}.`,
  });

  const response = await generateNarrationText({
    system,
    maxTokens: RESPONSE_MAX_TOKENS,
    messages,
    purpose: "response generation",
  });

  const cleaned = sanitizeDMNarration(response);

  if (!shouldRepairPlayerAgency(cleaned, playerName)) {
    return stripResidualPlayerSpeech(cleaned, playerName, playerAction);
  }

  try {
    return await repairPlayerAgency(cleaned, playerName, playerAction);
  } catch {
    return stripResidualPlayerSpeech(cleaned, playerName, playerAction);
  }
}

export async function generateNpcTurnAction(
  npcName: string,
  npcNotes: string,
  currentScene: string,
  validTargetNames: string[],
): Promise<string> {
  const system = `You are DMS controlling ${npcName} during combat. It is ${npcName}'s turn.

Respond with EXACTLY ONE of:
- An attack: [ATTACK]{"attacker":"${npcName}","target":"<one of: ${validTargetNames.join(", ")}>"}[/ATTACK]
- A non-attack action described in plain prose only (flee, taunt, use an item) — no tag.

Do not narrate the outcome of the action, only declare the intent. Keep any prose to one sentence.`;

  return generateNarrationText({
    system,
    maxTokens: 150,
    purpose: "npc turn action",
    messages: [
      {
        role: "user",
        content: `Current scene: ${currentScene}\n${npcName}'s notes: ${npcNotes || "none"}\nValid targets: ${validTargetNames.join(", ")}\n\nWhat does ${npcName} do?`,
      },
    ],
  });
}

export function extractWorldState(text: string): {
  cleanContent: string;
  worldState: any | null;
} {
  try {
    const match = text.match(/\[WORLD_STATE\]([\s\S]*?)\[\/WORLD_STATE\]/);

    if (!match) {
      return { cleanContent: text, worldState: null };
    }

    const json = JSON.parse(match[1].trim());
    const clean = text.replace(match[0], "").trim();

    return {
      cleanContent: clean,
      worldState: json,
    };
  } catch {
    return { cleanContent: text, worldState: null };
  }
}

export function extractShopStateFromNarration(text: string) {
  const match = text.match(/\[SHOP\]([\s\S]*?)\[\/SHOP\]/);

  if (!match) return null;

  try {
    const content = match[1];

    const merchant = content.match(/Merchant:\s*(.+)/i)?.[1]?.trim();
    const currency = content.match(/Currency:\s*(.+)/i)?.[1]?.trim();

    const itemLines = content.split("\n").filter((line) => line.includes("|"));

    const items = itemLines.map((line) => {
      const [name, price, stock, desc] = line.split("|").map((value) => value.trim());

      return {
        name,
        description: desc || "",
        itemType: "gear",
        stock: Number(stock?.replace(/\D/g, "")) || 1,
        priceAmount: Number(price?.replace(/\D/g, "")) || 0,
        priceCurrencyCode: currency?.toLowerCase(),
      };
    });

    return {
      merchantName: merchant || "Merchant",
      currencyCode: currency?.toLowerCase() || "gold",
      items,
    };
  } catch {
    return null;
  }
}