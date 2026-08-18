import type { Campaign, Character, Message } from "../shared/schema";
import { DM_AI_PROVIDER, generateNarrationText } from "./dm-provider";

export type CampaignMemory = {
  summary: string;
  activeThreads: string[];
  discoveredFacts: string[];
  npcNotes: string[];
  recentConsequences: string[];
};

export type CampaignWorldState = {
  locations: any[];
  npcs: any[];
  factions: any[];
  flags: string[];
  currentScene: string;
  memory: CampaignMemory;
};

type MemoryUpdateParams = {
  campaign: Campaign;
  characters: Character[];
  history: Message[];
  latestNarration: string;
};

const EMPTY_MEMORY: CampaignMemory = {
  summary: "",
  activeThreads: [],
  discoveredFacts: [],
  npcNotes: [],
  recentConsequences: [],
};

const MEMORY_MAX_TOKENS = DM_AI_PROVIDER === "ollama" ? 320 : 900;

function uniqueStrings(values: unknown[], limit: number): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(normalized);
  }

  return cleaned.slice(0, limit);
}

function normalizeMemory(memory: unknown): CampaignMemory {
  const source = memory && typeof memory === "object" ? (memory as Record<string, unknown>) : {};

  return {
    summary: typeof source.summary === "string" ? source.summary.trim() : "",
    activeThreads: uniqueStrings(Array.isArray(source.activeThreads) ? source.activeThreads : [], 8),
    discoveredFacts: uniqueStrings(Array.isArray(source.discoveredFacts) ? source.discoveredFacts : [], 10),
    npcNotes: uniqueStrings(Array.isArray(source.npcNotes) ? source.npcNotes : [], 10),
    recentConsequences: uniqueStrings(Array.isArray(source.recentConsequences) ? source.recentConsequences : [], 8),
  };
}

export function createEmptyWorldState(): CampaignWorldState {
  return {
    locations: [],
    npcs: [],
    factions: [],
    flags: [],
    currentScene: "",
    memory: { ...EMPTY_MEMORY },
  };
}

export function parseCampaignWorldState(raw?: string | null): CampaignWorldState {
  if (!raw) return createEmptyWorldState();

  try {
    const parsed = JSON.parse(raw);
    const base = parsed && typeof parsed === "object" ? parsed : {};

    return {
      locations: Array.isArray((base as any).locations) ? (base as any).locations : [],
      npcs: Array.isArray((base as any).npcs) ? (base as any).npcs : [],
      factions: Array.isArray((base as any).factions) ? (base as any).factions : [],
      flags: uniqueStrings(Array.isArray((base as any).flags) ? (base as any).flags : [], 12),
      currentScene: typeof (base as any).currentScene === "string" ? (base as any).currentScene.trim() : "",
      memory: normalizeMemory((base as any).memory),
    };
  } catch {
    return createEmptyWorldState();
  }
}

export function mergeCampaignWorldState(
  baseRaw: CampaignWorldState | string | null | undefined,
  deltaRaw: Partial<CampaignWorldState> | Record<string, any> | null | undefined,
): CampaignWorldState {
  const base = typeof baseRaw === "string" || !baseRaw ? parseCampaignWorldState(baseRaw) : baseRaw;
  const delta = deltaRaw && typeof deltaRaw === "object" ? deltaRaw : {};
  const deltaMemory = normalizeMemory((delta as any).memory);

  const mergedNpcs = [...base.npcs, ...(Array.isArray((delta as any).npcs) ? (delta as any).npcs : [])].reduce(
    (acc: any[], npc: any) => {
      if (!npc || typeof npc !== "object") return acc;
      if (!acc.find((existing) => existing?.name && existing.name === npc.name)) {
        acc.push(npc);
      }
      return acc;
    },
    [],
  );

  return {
    locations: Array.from(new Set([...(base.locations || []), ...((delta as any).locations || [])])),
    npcs: mergedNpcs,
    factions: Array.from(new Set([...(base.factions || []), ...((delta as any).factions || [])])),
    flags: uniqueStrings([...(base.flags || []), ...((delta as any).flags || [])], 12),
    currentScene:
      typeof (delta as any).currentScene === "string" && (delta as any).currentScene.trim()
        ? (delta as any).currentScene.trim()
        : base.currentScene,
    memory: {
      summary: deltaMemory.summary || base.memory.summary,
      activeThreads: uniqueStrings([...(base.memory.activeThreads || []), ...deltaMemory.activeThreads], 8),
      discoveredFacts: uniqueStrings([...(base.memory.discoveredFacts || []), ...deltaMemory.discoveredFacts], 10),
      npcNotes: uniqueStrings([...(base.memory.npcNotes || []), ...deltaMemory.npcNotes], 10),
      recentConsequences: uniqueStrings(
        [...deltaMemory.recentConsequences, ...(base.memory.recentConsequences || [])],
        8,
      ),
    },
  };
}

export function formatCampaignMemory(memory: CampaignMemory): string {
  const lines = [
    `Summary: ${memory.summary || "No persistent summary yet."}`,
    `Active Threads: ${memory.activeThreads.length ? memory.activeThreads.join(" | ") : "None recorded yet."}`,
    `Discovered Facts: ${memory.discoveredFacts.length ? memory.discoveredFacts.join(" | ") : "None recorded yet."}`,
    `NPC Notes: ${memory.npcNotes.length ? memory.npcNotes.join(" | ") : "None recorded yet."}`,
    `Recent Consequences: ${memory.recentConsequences.length ? memory.recentConsequences.join(" | ") : "None recorded yet."}`,
  ];

  return lines.join("\n");
}

function extractJsonObject(text: string): any | null {
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/m, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

export async function generateCampaignMemoryUpdate(
  params: MemoryUpdateParams,
): Promise<Partial<CampaignWorldState> | null> {
  const currentWorldState = parseCampaignWorldState(params.campaign.worldState);
  const recentHistory = params.history
    .slice(-6)
    .map((message) => `${message.senderType.toUpperCase()} ${message.sender}: ${message.content}`)
    .join("\n");

  const response = await generateNarrationText({
    system: `You maintain persistent campaign memory for DungeonMasterOS.

Return JSON only. No markdown fences. No explanation.

Rules:
- Capture only established facts, not speculation.
- Keep memory compact and useful.
- Preserve continuity-critical information.
- Do not invent NPC motives unless the scene established them.
- Favor short, concrete notes.
- Keep arrays lean. Prefer 1-4 strong entries per list instead of exhaustive noise.

Return exactly this shape:
{
  "currentScene": "short description of where things stand right now",
  "memory": {
    "summary": "50-90 word rolling summary of the campaign so far",
    "activeThreads": ["open question or unresolved thread"],
    "discoveredFacts": ["established fact the party now knows"],
    "npcNotes": ["NPC name: current posture, fear, leverage, or secret if established"],
    "recentConsequences": ["latest outcome now affecting the world"]
  }
}`,
    maxTokens: MEMORY_MAX_TOKENS,
    purpose: "campaign memory update",
    messages: [
      {
        role: "user",
        content: `Campaign: ${params.campaign.name}
Characters: ${params.characters.map((character) => `${character.name} (${character.race} ${character.charClass})`).join(", ")}

Existing memory:
${JSON.stringify(currentWorldState.memory, null, 2)}

Existing current scene:
${currentWorldState.currentScene || "None recorded yet."}

Recent transcript:
${recentHistory || "No prior transcript."}

Latest DM narration:
${params.latestNarration}`,
      },
    ],
  });

  const parsed = extractJsonObject(response);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  return {
    currentScene: typeof parsed.currentScene === "string" ? parsed.currentScene.trim() : "",
    memory: normalizeMemory(parsed.memory),
  };
}
