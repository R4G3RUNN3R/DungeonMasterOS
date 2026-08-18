// client/src/components/game/LootFlash.tsx
//
// Transient "loot discovery" Context Panel state (design spec §8.4).
// Triggered by the real item_granted WebSocket event campaign.tsx already
// receives — that payload previously only caused a refetch and was
// otherwise discarded. This is event-driven, not narration string
// matching: the panel shows the actual granted item record, then the
// caller reverts to Exploration after a short delay.

import { Gift } from "lucide-react";

export type GrantedItemDisplay = {
  id: number;
  name: string;
  description: string;
  itemType: string;
  quantity: number;
};

type Props = {
  item: GrantedItemDisplay;
};

export default function LootFlash({ item }: Props) {
  return (
    <div className="p-3">
      <div className="dm-label flex items-center gap-1 mb-1.5">
        <Gift className="w-3 h-3 dm-amber-text" />
        Item Found
      </div>
      <div className="dm-surface-raised rounded-md px-3 py-2.5">
        <div className="text-sm font-medium">
          {item.name}
          {item.quantity > 1 ? ` ×${item.quantity}` : ""}
        </div>
        {item.description && (
          <div className="text-xs text-[hsl(var(--dm-text-faint))] mt-1 leading-relaxed">{item.description}</div>
        )}
      </div>
    </div>
  );
}
