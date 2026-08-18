import Anthropic from "@anthropic-ai/sdk";
import type { Campaign, Character, Message, CampaignCurrency } from "../shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// AI CLIENT
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_ANTHROPIC_FALLBACK_MODELS = [
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
];
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
const ANTHROPIC_FALLBACK_MODELS = (
  process.env.ANTHROPIC_FALLBACK_MODELS || DEFAULT_ANTHROPIC_FALLBACK_MODELS.join(",")
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const ANTHROPIC_RETRY_ATTEMPTS = Number(process.env.ANTHROPIC_RETRY_ATTEMPTS || 3);
const ANTHROPIC_RETRY_BASE_MS = Number(process.env.ANTHROPIC_RETRY_BASE_MS || 750);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHeaderValue(headers: unknown, name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof (headers as any).get === "function") {
    return (headers as any).get(name) ?? undefined;
  }
  if (typeof headers === "object") {
    const exact = (headers as Record<string, unknown>)[name];
    if (typeof exact === "string") return exact;
    const lower = (headers as Record<string, unknown>)[name.toLowerCase()];
    if (typeof lower === "string") return lower;
  }
  return undefined;
}

function isRetryableAnthropicError(error: unknown): boolean {
  const status = Number((error as any)?.status);
  const shouldRetry = getHeaderValue((error as any)?.headers, "x-should-retry");
  const message = String((error as any)?.message || "");

  return (
    shouldRetry === "true" ||
    [408, 409, 429, 500, 502, 503, 504, 529].includes(status) ||
    /overloaded|temporar|timeout|timed out|rate limit|econnreset|socket hang up/i.test(message)
  );
}

async function createAnthropicMessageWithRetry(
  params: Parameters<typeof anthropic.messages.create>[0],
  purpose: string,
) {
  let lastError: unknown;
  const requestedModel = String((params as any).model || ANTHROPIC_MODEL);
  const modelCandidates = [requestedModel, ...ANTHROPIC_FALLBACK_MODELS.filter((model) => model !== requestedModel)];

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
    const model = modelCandidates[modelIndex];

    for (let attempt = 1; attempt <= ANTHROPIC_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await anthropic.messages.create({
          ...params,
          model,
        });
      } catch (error) {
        lastError = error;

        if (!isRetryableAnthropicError(error)) {
          throw error;
        }

        if (attempt < ANTHROPIC_RETRY_ATTEMPTS) {
          const delayMs =
            ANTHROPIC_RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
          console.warn(
            `Anthropic ${purpose} retry ${attempt}/${ANTHROPIC_RETRY_ATTEMPTS} on ${model} after ${delayMs}ms`,
            error,
          );
          await sleep(delayMs);
          continue;
        }

        const nextModel = modelCandidates[modelIndex + 1];
        if (nextModel) {
          console.warn(
            `Anthropic ${purpose} exhausted retries on ${model}; failing over to ${nextModel}`,
            error,
          );
          break;
        }

        throw error;
      }
    }
  }

  throw lastError;
}

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
- NEVER prefix your response with "Dungeon Master:", "DM:", "Narrator:", or any speaker label
- Output narration only; the app already knows the speaker

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

5. WORLD STATE
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

Now continue the story.
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPENING SCENE
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeDMNarration(text: string): string {
  return text
    .trim()
    .replace(/^(?:(?:\*\*)?(?:dungeon\s*master|dm|narrator|game\s*master)(?:\*\*)?\s*[:\-–—]\s*)+/i, "")
    .trim();
}

export async function generateOpeningScene(
  campaign: Campaign,
  characters: Character[],
  currencies: CampaignCurrency[] = [],
): Promise<string> {
  const system = buildSystemPrompt(campaign, characters, currencies);

  const response = await createAnthropicMessageWithRetry({
    model: ANTHROPIC_MODEL,
    max_tokens: 1500,
    system,
    messages: [
      {
        role: "user",
        content: "Begin the adventure. Introduce the setting and situation.",
      },
    ],
  }, "opening scene");

  return sanitizeDMNarration(extractText(response));
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
  currencies: CampaignCurrency[] = [],
): Promise<string> {
  const system = buildSystemPrompt(campaign, characters, currencies);

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.senderType === "player" ? "user" : "assistant",
    content:
      m.senderType === "player"
        ? `${m.sender}: ${m.content}`
        : sanitizeDMNarration(m.content),
  }));

  messages.push({
    role: "user",
    content: `${playerName}: ${playerAction}`,
  });

  const response = await createAnthropicMessageWithRetry({
    model: ANTHROPIC_MODEL,
    max_tokens: 1500,
    system,
    messages,
  }, "response generation");

  return sanitizeDMNarration(extractText(response));
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
