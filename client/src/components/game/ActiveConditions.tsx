// client/src/components/game/ActiveConditions.tsx
//
// "Important conditions/effects" Context Panel section (design spec §8.4).
// Reads the real, already-existing active_effects table via the character
// effects endpoint — this data already backs the app's buff-tracking
// feature, it just wasn't surfaced in the redesigned shell yet. Renders
// nothing when the character has no active effects, rather than an empty
// section header.

import { ShieldAlert, Sparkles } from "lucide-react";

export type ActiveEffectDisplay = {
  id: number;
  name: string;
  description: string;
  isDebuff: boolean;
  durationType: string;
  roundsRemaining: number | null;
  concentration: boolean;
};

type Props = {
  effects: ActiveEffectDisplay[];
};

function durationLabel(effect: ActiveEffectDisplay): string | null {
  if (effect.durationType === "rounds" && effect.roundsRemaining != null) {
    return `${effect.roundsRemaining} rd${effect.roundsRemaining === 1 ? "" : "s"}`;
  }
  if (effect.durationType && effect.durationType !== "rounds") {
    return effect.durationType;
  }
  return null;
}

export default function ActiveConditions({ effects }: Props) {
  if (effects.length === 0) return null;

  return (
    <div>
      <div className="dm-label flex items-center gap-1 mb-1.5">
        <ShieldAlert className="w-3 h-3" />
        Active Conditions
      </div>
      <div className="space-y-1.5">
        {effects.map((effect) => {
          const duration = durationLabel(effect);
          return (
            <div
              key={effect.id}
              className={`dm-surface-raised rounded-md px-2 py-1.5 text-xs border-l-2 ${
                effect.isDebuff ? "border-l-[hsl(var(--dm-danger))]" : "border-l-[hsl(var(--dm-amber))]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium flex items-center gap-1">
                  {effect.concentration && <Sparkles className="w-3 h-3 dm-amber-text" />}
                  {effect.name}
                </span>
                {duration && <span className="text-[hsl(var(--dm-text-faint))] shrink-0">{duration}</span>}
              </div>
              {effect.description && (
                <div className="text-[hsl(var(--dm-text-faint))] mt-0.5">{effect.description}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
