// client/src/components/game/ContextPanel.tsx
//
// The adaptive right-hand panel (design spec §8). Selects among the
// contextual states that authoritative campaign state can actually drive
// today: Combat (a real active encounter), Merchant (an active shop
// record), a transient Loot flash (a real item_granted event), and
// default Exploration (persisted worldState + active effects + party).
// Travel/quest-focus states have no backing data model yet.
//
// State selection is driven entirely by real data, never by string-
// matching narration text, per spec §8.4's explicit requirement. Combat
// takes priority over everything else once an encounter is active — the
// spec calls this out explicitly in §8.3.

import type { WorldState } from "@shared/world-state";
import type { EncounterState } from "@shared/combat";
import MerchantContext from "./MerchantContext";
import LocationContext from "./LocationContext";
import LootFlash, { type GrantedItemDisplay } from "./LootFlash";
import CombatContext from "./CombatContext";
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
  encounter: EncounterState;
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
  encounter,
}: Props) {
  const inCombat = encounter.encounter?.status === "active";
  const label = inCombat ? "Combat" : activeShop ? "Merchant" : recentLoot ? "Loot" : "Exploration";

  return (
    <div className="h-full flex flex-col dm-surface border-l">
      <div className="dm-leather border-b px-3 h-9 flex items-center shrink-0">
        <span className="dm-label">{label}</span>
      </div>
      <div className="flex-1 overflow-y-auto dm-scroll">
        {inCombat ? (
          <CombatContext state={encounter} />
        ) : activeShop ? (
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
