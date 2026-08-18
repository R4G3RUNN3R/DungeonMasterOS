// client/src/components/game/CombatContext.tsx
//
// Combat state view: round/turn-order/HP for every participant, plus
// Attack/Flee buttons. Every number here comes straight from the server's
// real Encounter.participants snapshot (server/combat-engine.ts), never
// narration text. Attack targeting is enforced server-side regardless of
// what's clickable here — a stale/invalid target or a click on the wrong
// turn is rejected by POST .../combat/attack.

import { Swords, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EncounterState } from "@shared/combat";
import { currentTurnParticipant } from "@shared/combat";

type Props = {
  state: EncounterState;
  myCharacterId?: number;
  onAttack?: (targetParticipantId: string) => void;
  onFlee?: () => void;
  actionPending?: boolean;
};

export default function CombatContext({ state, myCharacterId, onAttack, onFlee, actionPending }: Props) {
  const current = currentTurnParticipant(state);
  const myTurn = !!current && current.type === "character" && current.characterId === myCharacterId;
  const targets = state.participants.filter((p) => p.type === "npc" && !p.isDefeated && !p.fled);

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
        {state.participants.map((p) => {
          const isCurrent = current?.id === p.id;
          const isOut = p.isDefeated || p.fled;
          const hpPct = p.maxHp > 0 ? Math.max(0, Math.min(100, (p.currentHp / p.maxHp) * 100)) : 0;
          return (
            <div
              key={p.id}
              className={`dm-surface-raised rounded-md px-2 py-1.5 text-xs border-l-2 ${
                isCurrent ? "border-l-[hsl(var(--dm-amber))]" : "border-l-transparent"
              } ${isOut ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium flex items-center gap-1">
                  {isOut && <Skull className="w-3 h-3" />}
                  {p.name}
                  {p.type === "character" && p.characterId === myCharacterId ? " (you)" : ""}
                </span>
                <span className="text-[hsl(var(--dm-text-faint))] shrink-0">
                  {isOut ? (p.isDefeated ? "Defeated" : "Fled") : `${p.currentHp}/${p.maxHp} HP`}
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

      <div className="flex flex-wrap gap-1.5 pt-1">
        {targets.map((target) => (
          <Button
            key={target.id}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs dm-surface-raised border-[hsl(var(--dm-line))]"
            disabled={!myTurn || actionPending}
            title={myTurn ? undefined : "Not your turn"}
            onClick={() => onAttack?.(target.id)}
          >
            Attack {target.name} ({target.currentHp}/{target.maxHp} HP)
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs dm-surface-raised border-[hsl(var(--dm-line))]"
          disabled={actionPending}
          onClick={onFlee}
        >
          Flee
        </Button>
      </div>
    </div>
  );
}
