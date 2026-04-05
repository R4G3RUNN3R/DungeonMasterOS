import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────────────────────
// Generate Opening Scene
// ─────────────────────────────────────────────────────────────
export async function generateOpeningScene(campaign: any, characters: any[]) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing");
  }

  const systemPrompt = buildSystemPrompt(campaign, characters);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1200,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: "Begin the campaign. Introduce the world, the situation, and place the party into a clear opening scene.",
      },
    ],
  });

  return extractText(response);
}

// ─────────────────────────────────────────────────────────────
// Generate DM Response
// ─────────────────────────────────────────────────────────────
export async function generateDMResponse(
  campaign: any,
  characters: any[],
  history: any[],
  playerAction: string,
  playerName: string
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing");
  }

  const systemPrompt = buildSystemPrompt(campaign, characters);

  const formattedHistory = history.slice(-20).map((msg: any) => ({
    role: msg.senderType === "dm" ? "assistant" : "user",
    content: `${msg.sender}: ${msg.content}`,
  }));

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1200,
    system: systemPrompt,
    messages: [
      ...formattedHistory,
      {
        role: "user",
        content: `${playerName}: ${playerAction}`,
      },
    ],
  });

  return extractText(response);
}

// ─────────────────────────────────────────────────────────────
// Extract world state (optional structured output)
// ─────────────────────────────────────────────────────────────
export function extractWorldState(raw: string) {
  try {
    const match = raw.match(/```json([\s\S]*?)```/);
    if (!match) {
      return { cleanContent: raw, worldState: null };
    }

    const parsed = JSON.parse(match[1]);

    const cleanContent = raw.replace(match[0], "").trim();

    return {
      cleanContent,
      worldState: parsed,
    };
  } catch {
    return { cleanContent: raw, worldState: null };
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function extractText(response: any): string {
  return response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
}

// ─────────────────────────────────────────────────────────────
// System Prompt Builder (YOUR CORE DM BRAIN)
// ─────────────────────────────────────────────────────────────
function buildSystemPrompt(campaign: any, characters: any[]) {
  return `
You are a Dungeon Master running a persistent tabletop RPG world.

RULES:
- NEVER control player characters' decisions or dialogue
- NEVER retcon events
- ALWAYS follow cause-and-effect logic
- Keep responses grounded and immersive
- 2–6 paragraphs per response

CAMPAIGN SETTINGS:
Tone: ${campaign.tone}
Rules Weight: ${campaign.rulesWeight}
Power Level: ${campaign.powerLevel}
World Type: ${campaign.worldType}
Combat Style: ${campaign.combatStyle || "cinematic"}
Story Mode: ${campaign.storyMode ? "enabled" : "disabled"}

HOME BREW RULES:
${campaign.homebrewRules || "None"}

PARTY:
${characters
  .map(
    (c: any) =>
      `${c.name} - ${c.race} ${c.charClass} (Level ${c.level})`
  )
  .join("\n")}

STYLE:
- Use cinematic narration
- NPC dialogue in quotes
- End with a clear situation requiring player action
`;
}
