// client/src/components/game/ContextPanel.tsx
//
// The adaptive right-hand panel (design spec §8). Selects among the
// contextual states that authoritative campaign state can actually drive
// today: Merchant (an active shop record), a transient Loot flash (a real
// item_granted event), and default Exploration (persisted worldState +
// active effects + party). Combat/travel/quest-focus states are Phase 4+
// (spec §8.4) — the panel is structured so adding a branch there later
// doesn't require touching the shell around it.
//
// State selection is driven entirely by real data, never by string-
// matching narration text, per spec §8.4's explicit requirement.

import type { WorldState } from "@shared/world-state";
import MerchantContext from "./MerchantContext";
import LocationContext from "./LocationContext";
import LootFlash, { type GrantedItemDisplay } from "./LootFlash";
import type { ActiveEffectDisplay } from "./ActiveConditions";

type Shop = {
  merchantName: string;
  merchantDescription: string;
};

type ShopItem = {
  id: number;
  name: string;
  priceAmount: number;
  priceCurrencyCode: string;
  stock: number;
};

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
  recentLoot: GrantedItemDisplay | null;
  activeShop: { shop: Shop; items: ShopItem[] } | null;
  onViewShop: () => void;
  shopExpanded: boolean;
};

export default function ContextPanel({
  worldType,
  worldState,
  party,
  effects,
  recentLoot,
  activeShop,
  onViewShop,
  shopExpanded,
}: Props) {
  const label = activeShop ? "Merchant" : recentLoot ? "Loot" : "Exploration";

  return (
    <div className="h-full flex flex-col dm-surface border-l">
      <div className="dm-leather border-b px-3 h-9 flex items-center shrink-0">
        <span className="dm-label">{label}</span>
      </div>
      <div className="flex-1 overflow-y-auto dm-scroll">
        {activeShop ? (
          <MerchantContext
            shop={activeShop.shop}
            items={activeShop.items}
            onViewShop={onViewShop}
            shopExpanded={shopExpanded}
          />
        ) : recentLoot ? (
          <LootFlash item={recentLoot} />
        ) : (
          <LocationContext worldType={worldType} worldState={worldState} party={party} effects={effects} />
        )}
      </div>
    </div>
  );
}
