// server/mechanics-tags.ts
//
// Extraction and validation for the mechanics engine's structured tags.
// Extends the existing bracket-tag convention already used for [SHOP] and
// [WORLD_STATE] in dm-engine.ts, but with strict JSON payloads instead of
// loosely-formatted positional text. Every function here returns null on
// anything malformed — never throws — so a bad AI proposal always falls
// back to unmechanized narration rather than breaking a turn.
//
// Uses the same markdown-tolerant tag matching and brace-matching JSON
// extraction as internal-tag-guard.ts (see that file's header for the
// 2026-08-18 [WORLD_STATE] leak this pattern traces back to) — these tags
// are just as capable of being wrapped in markdown emphasis by the model,
// and whatever text isn't consumed as a valid tag here is exactly what
// routes.ts's finalContent still needs stripInternalTags to catch.

import { tagBlockPattern, extractJsonObject } from "./internal-tag-guard";

const VALID_ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha"]);

// AI-proposed DCs are clamped to this band, never rejected outside it — 26-30
// is reserved for future manually-approved/ruleset-authored content that
// doesn't exist yet in this spec's scope. Clamping (not rejecting) the DC is
// what makes the DC itself server-authoritative, not just the roll after it.
const MIN_AI_DC = 5;
const MAX_AI_DC = 25;

// A [COMBAT_START] npcs array is clamped to this length, never rejected
// outright — 8 is generous for a tactical encounter. Uncapped, the AI could
// spin up dozens of NPCs, and every subsequent action in that encounter
// cascades two AI calls per NPC turn (npc-turn.ts) synchronously inside one
// HTTP request, while one metered turn is charged and the campaign mutex is
// held the whole time. Same "clamp, never reject" posture as the dc bounds
// above and clampNpcStats in dice-engine.ts.
const MAX_COMBAT_START_NPCS = 8;

function extractJsonPayload(text: string, tagName: string): any | null {
  const match = text.match(tagBlockPattern(tagName));
  if (!match) return null;
  const parsed = extractJsonObject(match[0]);
  return parsed && typeof parsed === "object" ? parsed : null;
}

export interface CheckTag {
  character: string;
  ability?: "str" | "dex" | "con" | "int" | "wis" | "cha";
  skill?: string;
  dc: number;
  isSave?: boolean;
  reason?: string;
}

export function extractCheckTag(text: string): CheckTag | null {
  const payload = extractJsonPayload(text, "CHECK");
  if (!payload) return null;

  if (typeof payload.character !== "string" || !payload.character.trim()) return null;
  if (typeof payload.dc !== "number" || !Number.isInteger(payload.dc)) return null; // missing/non-numeric dc is a genuinely malformed tag

  const hasAbility = typeof payload.ability === "string" && VALID_ABILITIES.has(payload.ability);
  const hasSkill = typeof payload.skill === "string" && payload.skill.trim().length > 0;
  if (!hasAbility && !hasSkill) return null;

  return {
    character: payload.character,
    ability: hasAbility ? payload.ability : undefined,
    skill: hasSkill ? payload.skill : undefined,
    dc: Math.min(MAX_AI_DC, Math.max(MIN_AI_DC, payload.dc)), // clamped, never rejected
    isSave: payload.isSave === true,
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
  };
}

export interface CombatStartNpc {
  name: string;
  hp: number;
  ac: number;
  attackBonus: number;
  damageDice: string;
}

export interface CombatStartTag {
  participants?: string[];
  npcs: CombatStartNpc[];
}

function isValidNpc(value: any): value is CombatStartNpc {
  return (
    value &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.hp === "number" &&
    typeof value.ac === "number" &&
    typeof value.attackBonus === "number" &&
    typeof value.damageDice === "string"
  );
}

export function extractCombatStartTag(text: string): CombatStartTag | null {
  const payload = extractJsonPayload(text, "COMBAT_START");
  if (!payload) return null;

  if (!Array.isArray(payload.npcs) || payload.npcs.length === 0) return null;

  // Clamp the count before validating shape, so a malformed entry past the
  // cap (which gets dropped anyway) never rejects an otherwise-valid tag.
  const npcs = payload.npcs.slice(0, MAX_COMBAT_START_NPCS); // clamped, never rejected
  if (!npcs.every(isValidNpc)) return null;

  const participants =
    Array.isArray(payload.participants) && payload.participants.every((p: any) => typeof p === "string")
      ? payload.participants
      : undefined;

  return { participants, npcs };
}

export interface AttackTag {
  attacker: string;
  target: string;
}

export function extractAttackTag(text: string): AttackTag | null {
  const payload = extractJsonPayload(text, "ATTACK");
  if (!payload) return null;
  if (typeof payload.attacker !== "string" || !payload.attacker.trim()) return null;
  if (typeof payload.target !== "string" || !payload.target.trim()) return null;
  // Deliberately return ONLY attacker/target — any other field the AI included
  // (a bonus, a damage value, anything numeric) is never read.
  return { attacker: payload.attacker, target: payload.target };
}

export interface SurrenderTag {
  npcNames: string[];
  reason?: string;
}

export function extractSurrenderTag(text: string): SurrenderTag | null {
  const payload = extractJsonPayload(text, "SURRENDER");
  if (!payload) return null;
  if (!Array.isArray(payload.npcNames) || payload.npcNames.length === 0) return null;
  if (!payload.npcNames.every((n: any) => typeof n === "string" && n.trim().length > 0)) return null;
  return {
    npcNames: payload.npcNames,
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
  };
}

// ── Emergent titles ─────────────────────────────────────────────────────────
// [TITLE_CANDIDATE]: the player character introduces/declares an alias
// themselves — a self-declared candidate only. Never establishes a title on
// its own, no matter how many times it's repeated (server/titles.ts enforces
// that; this function only extracts and shape-validates).
export interface TitleCandidateTag {
  character: string;
  title: string;
}

export function extractTitleCandidateTag(text: string): TitleCandidateTag | null {
  const payload = extractJsonPayload(text, "TITLE_CANDIDATE");
  if (!payload) return null;
  if (typeof payload.character !== "string" || !payload.character.trim()) return null;
  if (typeof payload.title !== "string" || !payload.title.trim()) return null;
  return { character: payload.character, title: payload.title };
}

// [TITLE_WITNESS]: an NPC organically refers to the character by this name in
// this narration turn — the AI's signal that the world itself is starting to
// use the name, not that the player asked someone to say it. Evidence from
// this tag is what can eventually establish a title (server/titles.ts
// requires independent evidence from more than one npc before promoting).
export interface TitleWitnessTag {
  character: string;
  title: string;
  npc: string;
}

export function extractTitleWitnessTag(text: string): TitleWitnessTag | null {
  const payload = extractJsonPayload(text, "TITLE_WITNESS");
  if (!payload) return null;
  if (typeof payload.character !== "string" || !payload.character.trim()) return null;
  if (typeof payload.title !== "string" || !payload.title.trim()) return null;
  if (typeof payload.npc !== "string" || !payload.npc.trim()) return null;
  return { character: payload.character, title: payload.title, npc: payload.npc };
}
