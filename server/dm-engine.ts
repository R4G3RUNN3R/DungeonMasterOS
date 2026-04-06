import Anthropic from "@anthropic-ai/sdk";
import type { Campaign, Character, Message, CampaignCurrency } from "../shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// AI CLIENT
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT BUILDER
// This is the "brain contract" that forces the DM to behave properly
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(
  campaign: Campaign,
  characters: Character[],
  currencies: CampaignCurrency[],
): string {
  return `
You are a professional Dungeon Master running a persistent RPG world.

STRICT RULES:
- NEVER control player characters' decisions or dialogue
- NEVER retcon past events
- ALWAYS respect cause-and-effect
- Keep responses between 2–6 paragraphs
- Always end with a clear situation or prompt

CAMPAIGN SETTINGS:
Tone: ${campaign.tone}
Rules Weight: ${campaign.rulesWeight}
Power Level: ${campaign.powerLevel}
World Type: ${campaign.worldType}
Combat Style: ${campaign.combatStyle}
Story Mode: ${campaign.storyMode ? "enabled" : "disabled"}
World Generation Style: ${campaign.worldGenStyle}

CUSTOM WORLD:
${campaign.customWorldPrompt || "None"}

HOMEBREW RULES:
${campaign.homebrewRules || "None"}

CURRENCIES:
${currencies.map(c => `${c.code} (${c.name}) ${c.symbol || ""}`).join(", ")}

PARTY:
${characters.map(c => `${c.name} (${c.race} ${c.charClass})`).join(", ")}

WORLD STATE:
${campaign.worldState || "{}"}

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

STYLE:
- Cinematic but grounded
- Clear consequences
- No meta talk
- No system explanations

Now continue the story.
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPENING SCENE
// ─────────────────────────────────────────────────────────────────────────────

export async function generateOpeningScene(
  campaign: Campaign,
  characters: Character[],
  currencies: CampaignCurrency[],
): Promise<string> {
  const system = buildSystemPrompt(campaign, characters, currencies);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system,
    messages: [
      {
        role: "user",
        content: "Begin the adventure. Introduce the setting and situation.",
      },
    ],
  });

  return extractText(response);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DM RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDMResponse(
  campaign: Campaign,
  characters: Character[],
  history: Message[],
  playerAction: string,
  playerName: string,
  currencies: CampaignCurrency[],
): Promise<string> {
  const system = buildSystemPrompt(campaign, characters, currencies);

  const messages = history.map((m) => ({
    role: m.senderType === "player" ? "user" : "assistant",
    content: `${m.sender}: ${m.content}`,
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

// ─────────────────────────────────────────────────────────────────────────────
// TEXT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function extractText(response: any): string {
  return response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD STATE EXTRACTION
// Optional structured state inside narration
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// SHOP EXTRACTION
// Converts DM shop text → structured system
// ─────────────────────────────────────────────────────────────────────────────

export function extractShopStateFromNarration(text: string) {
  const match = text.match(/\[SHOP\]([\s\S]*?)\[\/SHOP\]/);

  if (!match) return null;

  try {
    const content = match[1];

    const merchant = content.match(/Merchant:\s*(.+)/i)?.[1]?.trim();
    const currency = content.match(/Currency:\s*(.+)/i)?.[1]?.trim();

    const itemLines = content.split("\n").filter((l) => l.includes("|"));

    const items = itemLines.map((line) => {
      const [name, price, stock, desc] = line.split("|").map((x) => x.trim());

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
