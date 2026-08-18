import type { Campaign, Character, Message } from "../shared/schema";
import { DM_AI_PROVIDER, generateNarrationText } from "./dm-provider";
import type { WorldStateScene } from "../shared/world-state";
import { extractJsonObject } from "./internal-tag-guard";

type NarrationTextGenerator = typeof generateNarrationText;

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
  // WorldStateScene | string, matching shared/world-state.ts's WorldState
  // exactly — see normalizeSceneValue below for why this needed unifying.
  currentScene: WorldStateScene | string;
  memory: CampaignMemory;
};

// The DM system prompt's own [WORLD_STATE] instructions (see dm-engine.ts)
// tell the model to emit currentScene as a structured {name, description}
// object. Before 2026-08-18 this type was `currentScene: string` and the
// merge below only ever accepted a string delta — so a model dutifully
// following its own prompt instructions had its scene update silently
// discarded on every turn. Fixed by accepting both shapes end-to-end,
// matching the frontend's already-correct WorldState type.
function normalizeSceneValue(value: unknown): WorldStateScene | string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const name = typeof (value as any).name === "string" ? (value as any).name.trim() : "";
    if (!name) return "";
    const description = typeof (value as any).description === "string" ? (value as any).description.trim() : "";
    return description ? { name, description } : { name };
  }
  return "";
}

function isSceneEmpty(scene: WorldStateScene | string): boolean {
  return typeof scene === "string" ? scene.length === 0 : !scene.name;
}

export function formatCurrentSceneForPrompt(scene: WorldStateScene | string): string {
  if (typeof scene === "string") return scene;
  if (!scene || !scene.name) return "";
  return scene.description ? `${scene.name} — ${scene.description}` : scene.name;
}

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
      currentScene: normalizeSceneValue((base as any).currentScene),
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
    currentScene: (() => {
      const deltaScene = normalizeSceneValue((delta as any).currentScene);
      return isSceneEmpty(deltaScene) ? base.currentScene : deltaScene;
    })(),
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

// IMPORTANT: this function must NEVER return currentScene. It runs as a
// fire-and-forget background task after the main narration has already been
// sent to the player (see queueCampaignMemoryRefresh in routes.ts), using a
// much smaller token budget and a system prompt with none of the main DM
// prompt's CONTINUITY LOCK guarantees. A production bug (2026-08-18
// investigation) traced an unexplained "reality shift" — the party's
// location silently changing with no in-fiction cause — directly to this
// function: it used to also propose a currentScene, which
// mergeCampaignWorldState applied unconditionally, letting an under-
// constrained summarization call silently overwrite the authoritative scene
// state that every future turn's system prompt trusts. Scene changes now
// happen through exactly one channel: the main narration's [WORLD_STATE]
// tag, which is subject to the full continuity-locked system prompt. This
// function is only ever allowed to summarize memory (summary/threads/facts/
// npcNotes/consequences) — never to assert where the party currently is.
export async function generateCampaignMemoryUpdate(
  params: MemoryUpdateParams,
  generate: NarrationTextGenerator = generateNarrationText,
): Promise<Partial<CampaignWorldState> | null> {
  const currentWorldState = parseCampaignWorldState(params.campaign.worldState);
  const recentHistory = params.history
    .slice(-6)
    .map((message) => `${message.senderType.toUpperCase()} ${message.sender}: ${message.content}`)
    .join("\n");

  const response = await generate({
    system: `You maintain persistent campaign memory for DungeonMasterOS.

Return JSON only. No markdown fences. No explanation.

Rules:
- Capture only established facts, not speculation.
- Keep memory compact and useful.
- Preserve continuity-critical information.
- Do not invent NPC motives unless the scene established them.
- Favor short, concrete notes.
- Keep arrays lean. Prefer 1-4 strong entries per list instead of exhaustive noise.
- You are summarizing memory ONLY. You have no authority over the party's current location or scene — do not describe, restate, reinterpret, or imply any change to where the party physically is. That is decided elsewhere, by a process with full continuity safeguards this one does not have.
- Preserve the difference between what actually happened and what a character believes, fears, or claims happened. An NPC's interpretation of an event is not the event itself — record it as that NPC's belief, not as flat history. Example: if a character warns someone off and an NPC reacts as though threatened, write "NPC_NAME took CHARACTER_NAME's warning as a threat," never "CHARACTER_NAME threatened NPC_NAME."
- Preserve the difference between something stated as an intention or plan and something that has actually happened. "She says the letter goes out today" is not the same as "the letter was sent" — do not record an intention as a completed event until the narration actually shows it completed.

Return exactly this shape:
{
  "memory": {
    "summary": "50-90 word rolling summary of the campaign so far",
    "activeThreads": ["open question or unresolved thread"],
    "discoveredFacts": ["established fact the party now knows"],
    "npcNotes": ["NPC name: current posture, fear, leverage, or secret if established"],
    "recentConsequences": ["latest outcome now affecting the world — distinguish completed events from stated intentions and NPC interpretations, per the rules above"]
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

Existing current scene (for your context only — do not restate or alter it):
${formatCurrentSceneForPrompt(currentWorldState.currentScene) || "None recorded yet."}

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

  // currentScene is deliberately never read from `parsed`, even if the model
  // includes one anyway — see the function-level comment above.
  return {
    memory: normalizeMemory(parsed.memory),
  };
}
