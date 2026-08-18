// shared/world-state.ts
//
// Type contract for the campaign's persisted `worldState` JSON column
// (design spec §8.1/§8.4: current location, NPCs, objective/story flags).
// Mirrors the exact merge shape server/routes.ts already writes when the
// DM emits a [WORLD_STATE] block — see server/dm-engine.ts's
// extractWorldState() and the WORLD STATE system-prompt section.
//
// This is genuinely authoritative, persisted campaign state, not narration
// text — the Context Panel is only allowed to read from structures like
// this one, never guess from message content (spec §8.4).

export interface WorldStateNpc {
  name: string;
  description?: string;
  disposition?: string;
}

export interface WorldStateScene {
  name: string;
  description?: string;
}

export interface WorldState {
  locations: string[];
  npcs: WorldStateNpc[];
  factions: string[];
  flags: string[];
  currentScene?: WorldStateScene | string | null;
}

export function parseWorldState(raw: string | null | undefined): WorldState {
  const empty: WorldState = { locations: [], npcs: [], factions: [], flags: [] };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    return {
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      npcs: Array.isArray(parsed.npcs) ? parsed.npcs : [],
      factions: Array.isArray(parsed.factions) ? parsed.factions : [],
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      currentScene: parsed.currentScene ?? null,
    };
  } catch {
    return empty;
  }
}

export function sceneDisplay(scene: WorldState["currentScene"]): WorldStateScene | null {
  if (!scene) return null;
  if (typeof scene === "string") return { name: scene };
  if (typeof scene === "object" && typeof scene.name === "string") return scene;
  return null;
}
