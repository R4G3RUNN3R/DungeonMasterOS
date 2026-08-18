// client/src/components/game/CombatContext.tsx
//
// Combat state view for the Context Panel (design spec §8.3/§10.2). Pure
// read-only target/initiative information — target selection lives in
// ContextActionDeck's Attack buttons, since that's the spec's home for
// contextual actions. Every number here (HP, whose turn) comes straight
// from the server's encounter/combatant records, never narration text.

import { Swords, Skull } from "lucide-react";
import type { EncounterState } from "@shared/combat";
import { currentTurnCombatant } from "@shared/combat";

type Props = {
  state: EncounterState;
};

export default function CombatContext({ state }: Props) {
  const current = currentTurnCombatant(state);

  return (
    <div className="p-3 space-y-4">
      <div>
        <div className="dm-label flex items-center gap-1 mb-1.5">
          <Swords className="w-3 h-3" />
          Round {state.encounter?.round ?? 1}
        </div>
        {current && (
          <p className="text-xs text-[hsl(var(--dm-text-muted))]">
            <span className="font-medium text-[hsl(var(--dm-text))]">{current.name}</span>'s turn
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        {state.combatants.map((c) => {
          const isCurrent = current?.id === c.id;
          const isOut = c.isDefeated || c.hasFled;
          const hpPct = c.maxHp > 0 ? Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100)) : 0;
          return (
            <div
              key={c.id}
              className={`dm-surface-raised rounded-md px-2 py-1.5 text-xs border-l-2 ${
                isCurrent ? "border-l-[hsl(var(--dm-amber))]" : "border-l-transparent"
              } ${isOut ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium flex items-center gap-1">
                  {isOut && <Skull className="w-3 h-3" />}
                  {c.name}
                  {c.kind === "player" ? " (you)" : ""}
                </span>
                <span className="text-[hsl(var(--dm-text-faint))] shrink-0">
                  {isOut ? (c.isDefeated ? "Defeated" : "Fled") : `${c.hp}/${c.maxHp} HP`}
                </span>
              </div>
              {!isOut && (
                <div className="mt-1 h-1 rounded-full bg-[hsl(var(--dm-void))] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${hpPct}%`,
                      background: hpPct <= 25 ? "hsl(var(--dm-danger))" : "hsl(var(--dm-amber))",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
