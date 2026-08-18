// client/src/components/game/ContextActionDeck.tsx
//
// The narrow row of contextual quick-action buttons above the composer
// (design spec §9). Outside combat these are typing helpers, never
// restrictions — every button either inserts a starter phrase into the
// composer or opens an existing overlay; freeform text always remains
// available. During combat, Attack targets and Flee are real mechanical
// actions gated on whose turn it actually is (spec §10.3) — "Attack" on
// a target the server doesn't recognize, or thrown on the wrong turn,
// is rejected server-side regardless of what the button shows.

import { Button } from "@/components/ui/button";
import type { CombatantView } from "@shared/combat";

type Deck = "exploration" | "merchant" | "combat";

type Props = {
  deck: Deck;
  onInsertPrefix: (prefix: string) => void;
  onOpenInventory: () => void;
  onBuy: () => void;
  onSell: () => void;
  onLeaveMerchant: () => void;
  combatTargets?: CombatantView[];
  onAttack?: (targetId: number) => void;
  onFlee?: () => void;
  myTurn?: boolean;
  attackPending?: boolean;
};

const EXPLORATION_ACTIONS = [
  { label: "Speak", prefix: "I say: " },
  { label: "Look", prefix: "I look at " },
  { label: "Interact", prefix: "I " },
];

const MERCHANT_ACTIONS = [
  { label: "Ask Merchant", prefix: "I ask the merchant about " },
];

export default function ContextActionDeck({
  deck,
  onInsertPrefix,
  onOpenInventory,
  onBuy,
  onSell,
  onLeaveMerchant,
  combatTargets,
  onAttack,
  onFlee,
  myTurn,
  attackPending,
}: Props) {
  const chipClass =
    "h-7 px-2.5 text-xs dm-surface-raised border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text-muted))] hover:text-[hsl(var(--dm-text))] hover:bg-[hsl(var(--dm-leather))]";
  const disabledChipClass =
    "h-7 px-2.5 text-xs dm-surface-raised border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text-faint))] opacity-60";

  if (deck === "combat") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
        {(combatTargets ?? []).map((target) => (
          <Button
            key={target.id}
            variant="outline"
            size="sm"
            className={myTurn ? chipClass : disabledChipClass}
            disabled={!myTurn || attackPending}
            title={myTurn ? undefined : "Not your turn"}
            onClick={() => onAttack?.(target.id)}
          >
            Attack {target.name} ({target.hp}/{target.maxHp} HP)
          </Button>
        ))}
        <Button variant="outline" size="sm" className={chipClass} disabled={attackPending} onClick={onFlee}>
          Flee
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
      {deck === "exploration" ? (
        <>
          {EXPLORATION_ACTIONS.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className={chipClass}
              onClick={() => onInsertPrefix(action.prefix)}
            >
              {action.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" className={chipClass} onClick={onOpenInventory}>
            Inventory
          </Button>
        </>
      ) : (
        <>
          <Button variant="outline" size="sm" className={chipClass} onClick={onBuy}>
            Buy
          </Button>
          <Button variant="outline" size="sm" className={chipClass} onClick={onSell}>
            Sell
          </Button>
          {MERCHANT_ACTIONS.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className={chipClass}
              onClick={() => onInsertPrefix(action.prefix)}
            >
              {action.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" className={chipClass} onClick={onLeaveMerchant}>
            Leave
          </Button>
        </>
      )}
    </div>
  );
}
