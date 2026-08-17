// client/src/components/game/ContextActionDeck.tsx
//
// The narrow row of contextual quick-action buttons above the composer
// (design spec §9). These are typing helpers, never restrictions — every
// button either inserts a starter phrase into the composer for the player
// to finish, or opens an existing overlay. Freeform text always remains
// available regardless of what's clicked here.

import { Button } from "@/components/ui/button";

type Deck = "exploration" | "merchant";

type Props = {
  deck: Deck;
  onInsertPrefix: (prefix: string) => void;
  onOpenInventory: () => void;
  onBuy: () => void;
  onSell: () => void;
  onLeaveMerchant: () => void;
};

const EXPLORATION_ACTIONS = [
  { label: "Speak", prefix: "I say: " },
  { label: "Look", prefix: "I look at " },
  { label: "Interact", prefix: "I " },
];

const MERCHANT_ACTIONS = [
  { label: "Ask Merchant", prefix: "I ask the merchant about " },
];

export default function ContextActionDeck({ deck, onInsertPrefix, onOpenInventory, onBuy, onSell, onLeaveMerchant }: Props) {
  const chipClass =
    "h-7 px-2.5 text-xs dm-surface-raised border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text-muted))] hover:text-[hsl(var(--dm-text))] hover:bg-[hsl(var(--dm-leather))]";

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
