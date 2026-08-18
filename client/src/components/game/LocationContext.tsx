// client/src/components/game/LocationContext.tsx
//
// The default Exploration state of the Context Panel (design spec §8.1,
// §8.4), extracted from the inline block Phase 1 shipped. Renders the
// campaign's real, persisted worldState (current scene, known NPCs) and
// active conditions/effects — never narration text. When the DM hasn't
// established any of this yet, each section says so honestly rather than
// inventing detail (spec §19).

import { Compass, Users, Sparkles } from "lucide-react";
import type { WorldState } from "@shared/world-state";
import { sceneDisplay } from "@shared/world-state";
import ActiveConditions, { type ActiveEffectDisplay } from "./ActiveConditions";

type PartyMember = {
  id: number;
  name: string;
  race: string;
  charClass: string;
};

type Props = {
  worldType?: string | null;
  worldState: WorldState;
  party: PartyMember[];
  effects: ActiveEffectDisplay[];
};

export default function LocationContext({ worldType, worldState, party, effects }: Props) {
  const scene = sceneDisplay(worldState.currentScene);
  const npcs = worldState.npcs.slice(0, 5);

  return (
    <div className="p-3 space-y-4">
      <div>
        <div className="dm-label flex items-center gap-1 mb-1.5">
          <Compass className="w-3 h-3" />
          Scene
        </div>
        {scene ? (
          <div>
            <div className="text-sm font-medium">{scene.name}</div>
            {scene.description && (
              <p className="text-xs text-[hsl(var(--dm-text-muted))] mt-1 leading-relaxed">{scene.description}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-[hsl(var(--dm-text-muted))]">
            {worldType || "The world unfolds as you play — location and scene details will appear here as your DM establishes them."}
          </p>
        )}
      </div>

      {npcs.length > 0 && (
        <div>
          <div className="dm-label flex items-center gap-1 mb-1.5">
            <Sparkles className="w-3 h-3" />
            Known NPCs
          </div>
          <div className="space-y-1.5">
            {npcs.map((npc) => (
              <div key={npc.name} className="dm-surface-raised rounded-md px-2 py-1.5 text-xs">
                <div className="font-medium">{npc.name}</div>
                {npc.description && (
                  <div className="text-[hsl(var(--dm-text-faint))] mt-0.5">{npc.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ActiveConditions effects={effects} />

      {party.length > 0 && (
        <div>
          <div className="dm-label flex items-center gap-1 mb-1.5">
            <Users className="w-3 h-3" />
            Party
          </div>
          <div className="space-y-1">
            {party.map((member) => (
              <div key={member.id} className="dm-surface-raised rounded-md px-2 py-1.5 text-xs">
                <span className="font-medium">{member.name}</span>
                <span className="text-[hsl(var(--dm-text-faint))]"> · {member.race} {member.charClass}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
