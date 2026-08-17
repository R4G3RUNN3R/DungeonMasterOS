// client/src/components/game/MerchantContext.tsx
//
// Compact storefront preview for the Context Panel's merchant state
// (design spec §8.2). The player can see what's for sale without opening
// the full Shop overlay — "View Shop" reveals it when they actually want
// to transact.

import { Coins, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

type ShopItem = {
  id: number;
  name: string;
  priceAmount: number;
  priceCurrencyCode: string;
  stock: number;
};

type Shop = {
  merchantName: string;
  merchantDescription: string;
};

type Props = {
  shop: Shop;
  items: ShopItem[];
  onViewShop: () => void;
  shopExpanded: boolean;
};

export default function MerchantContext({ shop, items, onViewShop, shopExpanded }: Props) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4 dm-amber-text" />
        <div className="min-w-0">
          <div className="dm-heading text-sm font-semibold truncate">{shop.merchantName}</div>
          {shop.merchantDescription && (
            <div className="text-xs text-[hsl(var(--dm-text-muted))] truncate">{shop.merchantDescription}</div>
          )}
        </div>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto dm-scroll">
        {items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between dm-surface-raised rounded-md px-2 py-1.5 text-xs"
          >
            <span className="truncate pr-2">{item.name}</span>
            <span className="flex items-center gap-1 tabular-nums dm-amber-text shrink-0">
              <Coins className="w-3 h-3" />
              {item.priceAmount} {item.priceCurrencyCode}
            </span>
          </div>
        ))}
        {items.length > 8 && (
          <div className="text-[11px] text-[hsl(var(--dm-text-faint))] text-center pt-1">
            +{items.length - 8} more
          </div>
        )}
        {items.length === 0 && (
          <div className="text-xs text-[hsl(var(--dm-text-faint))] text-center py-3">Nothing in stock.</div>
        )}
      </div>

      <Button size="sm" className="w-full" onClick={onViewShop}>
        {shopExpanded ? "Close Shop" : "View Shop"}
      </Button>
    </div>
  );
}
