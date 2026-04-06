import Anthropic from "@anthropic-ai/sdk";
import type { Campaign, Character, CampaignCurrency } from "../shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// AI CLIENT
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ShopStatePayload = {
  merchantName: string;
  merchantDescription?: string;
  currencyCode: string;
  title?: string;
  metadata?: Record<string, any>;
  items: Array<{
    itemKey?: string;
    id?: string;
    name: string;
    description?: string;
    itemType?:
      | "weapon"
      | "armor"
      | "consumable"
      | "gear"
      | "tool"
      | "magic"
      | "misc"
      | "property"
      | "vehicle"
      | "vessel"
      | "mount"
      | "creature"
      | "retainer"
      | "key";
    quantityPerPurchase?: number;
    stock?: number;
    price?: number;
    priceAmount?: number;
    priceCurrencyCode?: string;
    metadata?: Record<string, any>;
  }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateOpeningScene(
  campaign: Campaign,
  characters: Character[],
  currencies: CampaignCurrency[] = [],
): Promise<string> {
  ensureAnthropicKey();

  const system = buildSystemPrompt(campaign, characters, currencies);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1400,
    system,
    messages: [
      {
        role: "user",
        content:
          "Begin the campaign. Establish the scene, the immediate situation, and the first meaningful decision or tension point for the party. If the scene naturally opens in a merchant or vendor context, you MAY include a structured shop block.",
      },
    ],
  });

  return extractText(response);
}

export async function generateDMResponse(
  campaign: Campaign,
  characters: Character[],
  history: Array<{ sender: string; senderType: string; content: string }>,
  playerAction: string,
  playerName: string,
  currencies: CampaignCurrency[] = [],
): Promise<string> {
  ensureAnthropicKey();

  const system = buildSystemPrompt(campaign, characters, currencies);

  const messages: Array<{ role: "user" | "assistant"; content: string }> = history
    .slice(-20)
    .map((msg) => ({
      role: msg.senderType === "dm" ? "assistant" : "user",
      content: `${msg.sender}: ${msg.content}`,
    }));

  messages.push({
    role: "user",
    content: `${playerName}: ${playerAction}`,
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1400,
    system,
    messages,
  });

  return extractText(response);
}

export function extractWorldState(raw: string): {
  cleanContent: string;
  worldState: Record<string, any> | null;
} {
  try {
    const blocks = extractTaggedJsonBlocks(raw);
    const worldBlock = blocks.find((b) => b.tag === "WORLD_STATE");

    if (!worldBlock) {
      return {
        cleanContent: stripTaggedBlocks(raw).trim(),
        worldState: null,
      };
    }

    const parsed = JSON.parse(worldBlock.json);

    return {
      cleanContent: stripTaggedBlocks(raw).trim(),
      worldState: parsed && typeof parsed === "object" ? parsed : null,
    };
  } catch {
    return {
      cleanContent: stripTaggedBlocks(raw).trim(),
      worldState: null,
    };
  }
}

export function extractShopStateFromNarration(raw: string): ShopStatePayload | null {
  try {
    const blocks = extractTaggedJsonBlocks(raw);
    const shopBlock = blocks.find((b) => b.tag === "SHOP_STATE");
    if (!shopBlock) return null;

    const parsed = JSON.parse(shopBlock.json);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.merchantName || !parsed.currencyCode || !Array.isArray(parsed.items)) return null;

    return parsed as ShopStatePayload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function ensureAnthropicKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing");
  }
}

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function buildCurrencyPrompt(currencies: CampaignCurrency[]): string {
  if (!currencies.length) {
    return `No explicit campaign currencies are defined. If currency appears, keep it grounded in the current world and do not assume D&D gold unless the setting supports it.`;
  }

  const primary =
    currencies.find((c) => c.isPrimary) || currencies[0];

  return `
Campaign currencies:
${currencies
  .map(
    (c) =>
      `- code: ${c.code}, name: ${c.name}${c.symbol ? `, symbol: ${c.symbol}` : ""}${
        c.isPrimary ? " [PRIMARY]" : ""
      }`,
  )
  .join("\n")}

Currency rules:
- Use these currency names exactly when money is awarded, paid, found, stolen, or priced
- Prefer the PRIMARY currency (${primary.code} / ${primary.name}) for merchant pricing unless the scene strongly implies otherwise
- Do not invent additional currency systems unless the campaign setting absolutely requires it
- If a shop block is emitted, every shop item must use a valid campaign currency code
`.trim();
}

function buildSystemPrompt(
  campaign: Campaign,
  characters: Character[],
  currencies: CampaignCurrency[],
): string {
  const partyBlock =
    characters.length > 0
      ? characters
          .map(
            (c) =>
              `- ${c.name}: ${c.race} ${c.charClass}, level ${c.level}, HP ${c.hp}/${c.maxHp}, status ${c.status}`,
          )
          .join("\n")
      : "- No characters provided";

  const shopInstructions = `
Optional structured blocks:
You MAY include hidden structured JSON blocks for system synchronization.
These blocks must appear exactly in the following format:

[[WORLD_STATE]]
{
  "locations": ["Dockside Market", "Temple Steps"],
  "npcs": [{ "name": "Tessara", "role": "merchant" }],
  "factions": ["City Watch"],
  "flags": ["party_entered_market"],
  "currentScene": "The party stands in a cramped market lane beneath patched awnings."
}
[[/WORLD_STATE]]

[[SHOP_STATE]]
{
  "merchantName": "Tessara",
  "merchantDescription": "A sharp-eyed apothecary with ink-stained fingers.",
  "currencyCode": "beri",
  "title": "Tessara's Counter",
  "metadata": {},
  "items": [
    {
      "itemKey": "minor_healing_tonic",
      "name": "Minor Healing Tonic",
      "description": "A bitter red draft that closes minor wounds.",
      "itemType": "consumable",
      "quantityPerPurchase": 1,
      "stock": 5,
      "priceAmount": 50,
      "priceCurrencyCode": "beri",
      "metadata": {}
    }
  ]
}
[[/SHOP_STATE]]

Rules for structured blocks:
- They are OPTIONAL, not mandatory
- They must be valid JSON
- WORLD_STATE should only include meaningful changes or current context
- SHOP_STATE should only be included when the party is clearly in a merchant/vendor/shop interaction
- The visible narration should still read naturally even if the UI also renders a shop panel
- Never mention the existence of JSON, tags, or hidden blocks in the visible narration
`.trim();

  return `
You are the AI Dungeon Master for a persistent multiplayer RPG platform.

Core DM rules:
- Never control player character thoughts, dialogue, or choices
- Never retcon past events
- Keep the world internally consistent
- Use cause and effect
- Keep responses concise but vivid: usually 2 to 6 paragraphs
- End with a clear situation, tension point, or invitation for the players to act
- Combat should follow the campaign's selected combat style
- Respect the campaign's tone and world assumptions
- Do not inject multiversal or abstract nonsense unless the campaign explicitly supports it

Campaign settings:
- Name: ${campaign.name}
- Tone: ${campaign.tone}
- Rules weight: ${campaign.rulesWeight}
- Power level: ${campaign.powerLevel}
- World type: ${campaign.worldType}
- Combat style: ${campaign.combatStyle}
- Story mode: ${campaign.storyMode ? "enabled" : "disabled"}
- World generation style: ${campaign.worldGenStyle}
- Epic mode: ${campaign.epicMode ? "enabled" : "disabled"}
- Anime world source: ${campaign.animeWorldSource || "none"}
- Anime world mode: ${campaign.animeWorldMode || "none"}

Homebrew rules:
${campaign.homebrewRules?.trim() ? campaign.homebrewRules : "None"}

Party:
${partyBlock}

${buildCurrencyPrompt(currencies)}

Merchant and inventory rules:
- If a player finds, receives, buys, pockets, loots, recovers, or clearly takes possession of an item, describe that clearly enough that the system can infer the ownership change
- If currency is gained or lost, state the amount and currency name explicitly
- If the party is browsing a shop, merchant stall, blacksmith, alchemist, vendor cart, quartermaster, fence, or similar seller, you may emit a SHOP_STATE block
- Buying is handled by the system UI, but haggling, persuasion, intimidation, deception, distraction, theft, and negotiation stay narrative
- Do not force a shop block for every merchant encounter. Only use it when the vendor is actively presenting stock

Writing style:
- Cinematic, grounded, reactive
- NPC dialogue should feel distinct and intentional
- Keep descriptions readable and not overblown
- Do not bury key outcomes inside excessive flourish

${shopInstructions}
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// TAGGED BLOCK EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function extractTaggedJsonBlocks(raw: string): Array<{ tag: string; json: string }> {
  const regex = /\[\[(WORLD_STATE|SHOP_STATE)\]\]\s*([\s\S]*?)\s*\[\[\/\1\]\]/g;
  const blocks: Array<{ tag: string; json: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    blocks.push({
      tag: match[1],
      json: match[2].trim(),
    });
  }

  return blocks;
}

function stripTaggedBlocks(raw: string): string {
  return raw
    .replace(/\[\[(WORLD_STATE|SHOP_STATE)\]\]\s*[\s\S]*?\s*\[\[\/\1\]\]/g, "")
    .trim();
}
