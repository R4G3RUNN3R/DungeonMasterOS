import { useMemo, useState } from "react";
import {
  Coins,
  Package,
  Sword,
  Shield,
  Sparkles,
  Castle,
  Car,
  Ship,
  Wrench,
  UserRound,
  PawPrint,
  KeyRound,
  ShoppingCart,
  Minus,
  Plus,
  Store,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type CurrencyBalance = {
  currencyCode: string;
  amount: number;
};

type CampaignCurrency = {
  id: number;
  campaignId: number;
  code: string;
  name: string;
  symbol: string;
  isPrimary: boolean;
  exchangeRate: number;
};

type ActiveShop = {
  id: number;
  campaignId: number;
  merchantName: string;
  merchantDescription: string;
  currencyCode: string;
  title: string;
  isOpen: boolean;
  metadata?: string;
};

type ShopItem = {
  id: number;
  shopId: number;
  campaignId: number;
  itemKey: string;
  name: string;
  description: string;
  itemType: string;
  quantityPerPurchase: number;
  stock: number;
  priceAmount: number;
  priceCurrencyCode: string;
  metadata?: string;
};

type Props = {
  shop: ActiveShop;
  items: ShopItem[];
  balances: CurrencyBalance[];
  currencies: CampaignCurrency[];
  buying?: boolean;
  onBuy: (shopItemId: number, quantity: number) => void;
};

function getItemTypeMeta(itemType: string) {
  const t = String(itemType || "misc").toLowerCase();

  if (t === "weapon") return { label: "Weapon", icon: Sword };
  if (t === "armor") return { label: "Armor", icon: Shield };
  if (t === "consumable") return { label: "Consumable", icon: Sparkles };
  if (t === "property") return { label: "Property", icon: Castle };
  if (t === "vehicle") return { label: "Vehicle", icon: Car };
  if (t === "vessel") return { label: "Vessel", icon: Ship };
  if (t === "tool") return { label: "Tool", icon: Wrench };
  if (t === "magic") return { label: "Magic", icon: Sparkles };
  if (t === "retainer") return { label: "Retainer", icon: UserRound };
  if (t === "mount" || t === "creature") return { label: "Mount", icon: PawPrint };
  if (t === "key") return { label: "Key", icon: KeyRound };
  return { label: "Gear", icon: Package };
}

function formatMoney(amount: number, def?: CampaignCurrency) {
  if (!def) return `${amount}`;
  if (def.symbol) return `${def.symbol}${amount}`;
  return `${amount} ${def.name}`;
}

export default function ShopPanel({
  shop,
  items,
  balances,
  currencies,
  buying = false,
  onBuy,
}: Props) {
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const currencyMap = useMemo(() => {
    const map = new Map<string, CampaignCurrency>();
    for (const c of currencies) map.set(c.code, c);
    return map;
  }, [currencies]);

  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of balances) map.set(b.currencyCode, b.amount);
    return map;
  }, [balances]);

  const shopCurrency = currencyMap.get(shop.currencyCode);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ShopItem[]>();

    for (const item of items) {
      const meta = getItemTypeMeta(item.itemType);
      if (!groups.has(meta.label)) groups.set(meta.label, []);
      groups.get(meta.label)!.push(item);
    }

    return Array.from(groups.entries()).map(([label, entries]) => ({
      label,
      items: entries,
    }));
  }, [items]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-4 py-4 bg-background/90 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl border border-border bg-card flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-amber-500" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-semibold text-base truncate">
              {shop.title || `${shop.merchantName}'s Shop`}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {shop.merchantName}
            </div>
            {shop.merchantDescription ? (
              <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                {shop.merchantDescription}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Your Funds
          </div>

          {balances.length === 0 ? (
            <div className="text-sm text-muted-foreground">No tracked currency.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {balances.map((balance) => {
                const def = currencyMap.get(balance.currencyCode);
                return (
                  <Badge key={balance.currencyCode} variant="secondary" className="gap-1">
                    <Coins className="w-3 h-3" />
                    {formatMoney(balance.amount, def)}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Standard buying is handled here. Haggling, intimidation, charm, scams, and theft still belong in the normal action box, because we are not turning roleplay into an accounting app.
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {groupedItems.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              This shop currently has no visible stock.
            </Card>
          ) : (
            groupedItems.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="text-sm font-semibold">{group.label}</div>

                <div className="space-y-3">
                  {group.items.map((item) => {
                    const meta = getItemTypeMeta(item.itemType);
                    const Icon = meta.icon;
                    const quantity = quantities[item.id] ?? 1;
                    const currencyDef = currencyMap.get(item.priceCurrencyCode);
                    const availableFunds = balanceMap.get(item.priceCurrencyCode) ?? 0;
                    const totalCost = item.priceAmount * quantity;
                    const canAfford = availableFunds >= totalCost;
                    const inStock = item.stock > 0;
                    const canBuy = canAfford && inStock && quantity > 0 && quantity <= item.stock && !buying;

                    return (
                      <Card key={item.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                              </div>

                              <div className="font-medium truncate">{item.name}</div>

                              <Badge variant="outline">{meta.label}</Badge>

                              {item.stock <= 0 ? (
                                <Badge variant="destructive">Out of stock</Badge>
                              ) : (
                                <Badge variant="secondary">Stock: {item.stock}</Badge>
                              )}
                            </div>

                            {item.description ? (
                              <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">
                                {item.description}
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span>Unit price: <strong className="text-foreground">{formatMoney(item.priceAmount, currencyDef)}</strong></span>
                              <span>Per purchase: <strong className="text-foreground">{item.quantityPerPurchase || 1}</strong></span>
                              <span>Currency: <strong className="text-foreground">{currencyDef?.name || item.priceCurrencyCode}</strong></span>
                            </div>
                          </div>

                          <div className="w-[180px] shrink-0 space-y-3">
                            <div className="rounded-lg border border-border p-3">
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                                Quantity
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    setQuantities((prev) => ({
                                      ...prev,
                                      [item.id]: Math.max(1, (prev[item.id] ?? 1) - 1),
                                    }))
                                  }
                                  disabled={buying}
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>

                                <div className="font-semibold text-sm min-w-[24px] text-center">
                                  {quantity}
                                </div>

                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    setQuantities((prev) => ({
                                      ...prev,
                                      [item.id]: Math.min(item.stock, (prev[item.id] ?? 1) + 1),
                                    }))
                                  }
                                  disabled={buying || item.stock <= 1}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>

                              <div className="mt-3 text-xs text-muted-foreground">
                                Total cost
                              </div>
                              <div className="font-semibold mt-1">
                                {formatMoney(totalCost, currencyDef)}
                              </div>

                              <div className="mt-2 text-xs text-muted-foreground">
                                Your balance: {formatMoney(availableFunds, currencyDef)}
                              </div>
                            </div>

                            <Button
                              className={cn("w-full", !canBuy && "opacity-70")}
                              disabled={!canBuy}
                              onClick={() => onBuy(item.id, quantity)}
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              {item.stock <= 0
                                ? "Unavailable"
                                : !canAfford
                                ? "Not enough funds"
                                : buying
                                ? "Processing..."
                                : "Buy"}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
