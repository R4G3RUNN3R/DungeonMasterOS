import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT (THIS IS THE IMPORTANT PART)
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(campaign: any, characters: any[]) {
  return `
You are a highly competent Dungeon Master.

STRICT RULES YOU MUST FOLLOW:

1. NEVER control player actions or decisions.
2. NEVER retcon events.
3. ALWAYS maintain cause-and-effect logic.
4. KEEP responses between 2–6 paragraphs.
5. END every response with a clear situation or prompt.

───────────────────────────────
🔥 CRITICAL INVENTORY RULE
───────────────────────────────

Whenever a player OBTAINS, BUYS, PICKS UP, STEALS, LOOTS, or is GIVEN an item:

YOU MUST explicitly declare it using this EXACT format:

[[ITEM_GRANTED]]
name: <item name>
type: <weapon|armor|consumable|currency|gear|magic|property|vehicle|mount|retainer|misc>
description: <short description>
quantity: <number>
[[/ITEM_GRANTED]]

Examples:

[[ITEM_GRANTED]]
name: Iron Longsword
type: weapon
description: A standard steel longsword, well-balanced.
quantity: 1
[[/ITEM_GRANTED]]

[[ITEM_GRANTED]]
name: Gold Coins
type: currency
description: Standard gold currency of the realm.
quantity: 50
[[/ITEM_GRANTED]]

DO NOT skip this.
DO NOT imply items.
DO NOT be vague.

If you do not use this format, the system WILL NOT detect the item.

───────────────────────────────
🛒 SHOP SYSTEM
───────────────────────────────

When players enter a shop, you MUST present items like this:

[[SHOP]]
name: Blacksmith Forge

item:
- Iron Sword | 25 Gold | 3 in stock
- Steel Armor | 120 Gold | 1 in stock
- Dagger | 10 Gold | 5 in stock

description:
A rugged blacksmith wipes sweat from his brow as you enter.

[[/SHOP]]

Players can:
- buy
- haggle
- steal
- leave

───────────────────────────────
🌍 WORLD STATE
───────────────────────────────

At the END of important scenes, you may optionally include:

[[WORLD_STATE]]
location: <current location>
npcs: <comma separated>
flags: <important flags>
[[/WORLD_STATE]]

───────────────────────────────

Campaign Settings:
- Tone: ${campaign.tone}
- Combat: ${campaign.combatStyle}
- Rules Weight: ${campaign.rulesWeight}
- Power Level: ${campaign.powerLevel}
- Story Mode: ${campaign.storyMode ? "ON" : "OFF"}

Characters:
${characters.map(c => `- ${c.name} (${c.race} ${c.charClass})`).join("\n")}

`.trim();
}

// ─────────────────────────────────────────────────────────────
// OPENING SCENE
// ─────────────────────────────────────────────────────────────

export async function generateOpeningScene(campaign: any, characters: any[]) {
  const system = buildSystemPrompt(campaign, characters);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system,
    messages: [
      {
        role: "user",
        content: `Start the adventure. Introduce the setting and situation.`,
      },
    ],
  });

  return extractText(response);
}

// ─────────────────────────────────────────────────────────────
// MAIN DM RESPONSE
// ─────────────────────────────────────────────────────────────

export async function generateDMResponse(
  campaign: any,
  characters: any[],
  history: any[],
  playerAction: string,
  playerName: string
) {
  const system = buildSystemPrompt(campaign, characters);

  const messages = history.map((m) => ({
    role: m.senderType === "player" ? "user" : "assistant",
    content: m.content,
  }));

  messages.push({
    role: "user",
    content: `${playerName}: ${playerAction}`,
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system,
    messages,
  });

  return extractText(response);
}

// ─────────────────────────────────────────────────────────────
// TEXT EXTRACTION
// ─────────────────────────────────────────────────────────────

function extractText(response: any): string {
  return response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
}

// ─────────────────────────────────────────────────────────────
// WORLD STATE EXTRACTION
// ─────────────────────────────────────────────────────────────

export function extractWorldState(text: string): {
  cleanContent: string;
  worldState: any | null;
} {
  const worldRegex = /\[\[WORLD_STATE\]\]([\s\S]*?)\[\[\/WORLD_STATE\]\]/;
  const match = text.match(worldRegex);

  if (!match) {
    return { cleanContent: text, worldState: null };
  }

  const block = match[1];

  const location = block.match(/location:\s*(.*)/)?.[1] || "";
  const npcs = block.match(/npcs:\s*(.*)/)?.[1]?.split(",") || [];
  const flags = block.match(/flags:\s*(.*)/)?.[1]?.split(",") || [];

  return {
    cleanContent: text.replace(worldRegex, "").trim(),
    worldState: {
      location,
      npcs,
      flags,
    },
  };
}
