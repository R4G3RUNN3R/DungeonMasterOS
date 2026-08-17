// client/src/components/game/ContextPanel.tsx
//
// The adaptive right-hand panel (design spec §8). Phase 1 implements the
// two contextual states that authoritative campaign state can actually
// drive today: default exploration and merchant. Combat/travel/NPC/loot
// states are Phase 3-4 (spec §8.4) — the panel is structured so adding a
// branch there later doesn't require touching the shell around it.
//
// State selection is driven by real data (an active shop record), never by
// string-matching narration text, per spec §8.4's explicit requirement.

import { Compass, Users } from "lucide-react";
import MerchantContext from "./MerchantContext";

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
  party: PartyMember[];
  activeShop: { shop: Shop; items: ShopItem[] } | null;
  onViewShop: () => void;
  shopExpanded: boolean;
};

function ExplorationContext({ worldType, party }: { worldType?: string | null; party: PartyMember[] }) {
  return (
    <div className="p-3 space-y-4">
      <div>
        <div className="dm-label flex items-center gap-1 mb-1.5">
          <Compass className="w-3 h-3" />
          Scene
        </div>
        <p className="text-xs text-[hsl(var(--dm-text-muted))]">
          {worldType || "The world unfolds as you play — location and scene details will appear here as your DM establishes them."}
        </p>
      </div>

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

export default function ContextPanel({ worldType, party, activeShop, onViewShop, shopExpanded }: Props) {
  return (
    <div className="h-full flex flex-col dm-surface border-l">
      <div className="dm-leather border-b px-3 h-9 flex items-center shrink-0">
        <span className="dm-label">{activeShop ? "Merchant" : "Exploration"}</span>
      </div>
      <div className="flex-1 overflow-y-auto dm-scroll">
        {activeShop ? (
          <MerchantContext
            shop={activeShop.shop}
            items={activeShop.items}
            onViewShop={onViewShop}
            shopExpanded={shopExpanded}
          />
        ) : (
          <ExplorationContext worldType={worldType} party={party} />
        )}
      </div>
    </div>
  );
}
