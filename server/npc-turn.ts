// server/npc-turn.ts
//
// Resolves a single NPC's turn in an active encounter. Always produces a
// result — never returns an error state — because a malformed or absent AI
// proposal falls back to a deterministic target choice (lowest current HP
// among living PCs), per the design's "the server never blocks on the AI
// behaving correctly" guarantee.

import { extractAttackTag } from "./mechanics-tags";
import { executeAttack, advanceToNextActionableTurn, type AttackResolution, type EncounterParticipant, type ResolveAttackParams } from "./combat-engine";
import type { Rng } from "./dice-engine";

export interface ResolveNpcTurnParams {
  encounterId: number;
  storage: ResolveAttackParams["storage"];
  rng: Rng;
  generateNpcAction: () => Promise<string>;
  narrate: (prompt: string) => Promise<string>;
}

function pickFallbackTarget(livingPcs: EncounterParticipant[]): EncounterParticipant {
  return [...livingPcs].sort((a, b) => a.currentHp - b.currentHp)[0];
}

export async function resolveNpcTurn(params: ResolveNpcTurnParams): Promise<AttackResolution> {
  const encounter = params.storage.getEncounter(params.encounterId)!;
  const participants: EncounterParticipant[] = JSON.parse(encounter.participants);
  const npc = participants[encounter.turnIndex];

  if (!npc || npc.type !== "npc") {
    throw new Error(`resolveNpcTurn called when the current turn (index ${encounter.turnIndex}) is not an NPC's turn`);
  }

  const livingPcs = participants.filter((p) => p.type === "character" && !p.isDefeated && !p.fled);

  let target: EncounterParticipant | undefined;

  try {
    const aiResponse = await params.generateNpcAction();
    const tag = extractAttackTag(aiResponse);
    if (tag) {
      target = livingPcs.find((p) => p.name === tag.target);
    }
  } catch {
    target = undefined; // AI call failed — fall through to the deterministic fallback
  }

  if (!target) {
    target = pickFallbackTarget(livingPcs);
  }

  return executeAttack({
    encounterId: params.encounterId,
    attacker: npc,
    target,
    storage: params.storage,
    rng: params.rng,
    narrate: params.narrate,
  });
}

export interface AdvanceAndResolveTurnsDeps {
  generateNpcAction: (npcName: string, npcNotes: string, currentScene: string, validTargetNames: string[]) => Promise<string>;
  narrate: (prompt: string) => Promise<string>;
  rng: Rng;
  currentScene: string;
  broadcast: (message: any) => void;
}

export async function advanceAndResolveTurns(
  encounterId: number,
  storage: ResolveAttackParams["storage"] & { createMessage(message: any): any },
  deps: AdvanceAndResolveTurnsDeps,
): Promise<any[]> {
  const createdMessages: any[] = [];

  // Bounded the same way advanceToNextActionableTurn's own internal loop is
  // — a real encounter can't have more consecutive NPC turns than there are
  // participants without cycling back to a PC or ending. Defense-in-depth
  // against an unforeseen infinite loop, not an expected code path.
  for (let guard = 0; guard < 100; guard++) {
    const advanced = advanceToNextActionableTurn(encounterId, storage as any);
    if (!advanced.currentParticipant || advanced.currentParticipant.type !== "npc") {
      break; // encounter ended, or it's a living PC's turn — stop and wait for their submission
    }

    const npc = advanced.currentParticipant;
    const encounter = storage.getEncounter(encounterId)!;
    const participants: EncounterParticipant[] = JSON.parse(encounter.participants);
    const validTargetNames = participants
      .filter((p) => p.type === "character" && !p.isDefeated && !p.fled)
      .map((p) => p.name);

    const result = await resolveNpcTurn({
      encounterId,
      storage: storage as any,
      rng: deps.rng,
      generateNpcAction: () => deps.generateNpcAction(npc.name, "", deps.currentScene, validTargetNames),
      narrate: deps.narrate,
    });

    const message = storage.createMessage({
      campaignId: (encounter as any).campaignId,
      sender: "Dungeon Master",
      senderType: "dm",
      content: result.narration,
      messageType: "narration",
      metadata: JSON.stringify({
        roll: {
          attacker: result.attacker,
          target: result.target,
          outcome: result.outcome,
          isCritical: result.isCritical,
          isFumble: result.isFumble,
          damageDealt: result.damageDealt,
        },
      }),
    });
    deps.broadcast(message);
    createdMessages.push(message);

    if (result.xpAwarded) {
      const xpMessage = storage.createMessage({
        campaignId: (encounter as any).campaignId,
        sender: "System",
        senderType: "system",
        content: `Victory! The party gains ${result.xpAwarded.perCharacter} XP each.`,
        messageType: "system",
      });
      deps.broadcast(xpMessage);
      createdMessages.push(xpMessage);
    }

    if (result.encounterEnded) break;
  }

  return createdMessages;
}
