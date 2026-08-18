// client/src/components/game/InventoryOverlay.tsx
//
// Premium leather/wood equipment interface (design spec §4.4/§12.3) — a
// framed case rather than the literal book metaphor Codex uses. Equipped
// items are visually distinguished from carried ones using the real
// `equipped` field.
//
// Encumbrance (spec §16 / Phase 6): each item shows its real per-unit
// weight, the header shows the same current/max/tier the HUD computes
// (shared/encumbrance.ts via the rules adapter — passed in rather than
// recomputed here), and items marked carried=false render as "Stored" —
// owned but not physically on the character, so they don't count toward
// the total. Container/Bag-of-Holding-specific capacity logic is out of
// scope here (spec §16 calls that out as needing its own logic).

import { useMemo } from "react";
import {
  Backpack, Sword, Shield, Sparkles, Castle, Car, Ship, Wrench, ScrollText,
  Link as LinkIcon, UserRound, PawPrint, Package, Archive,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CarryWeightDisplay } from "@/lib/rulesAdapters";

type Item = {
  id: number;
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  equipped: boolean;
  identified: boolean;
  weight: number;
  carried: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
  carryWeight: CarryWeightDisplay | null;
  onToggleCarried: (itemId: number, carried: boolean) => void;
};

function getItemTypeMeta(itemType: string) {
  const t = String(itemType || "misc").toLowerCase();
  if (t === "weapon") return { label: "Weapons", icon: Sword };
  if (t === "armor") return { label: "Armor", icon: Shield };
  if (t === "consumable") return { label: "Consumables", icon: Sparkles };
  if (t === "property") return { label: "Property", icon: Castle };
  if (t === "vehicle") return { label: "Vehicles", icon: Car };
  if (t === "vessel") return { label: "Vessels", icon: Ship };
  if (t === "tool") return { label: "Tools", icon: Wrench };
  if (t === "magic") return { label: "Magic Items", icon: ScrollText };
  if (t === "retainer") return { label: "Retainers", icon: UserRound };
  if (t === "mount" || t === "creature") return { label: "Mounts & Creatures", icon: PawPrint };
  if (t === "key") return { label: "Keys", icon: LinkIcon };
  return { label: "Gear & Misc", icon: Package };
}

function groupItems(items: Item[]) {
  const groups = new Map<string, { label: string; icon: any; items: Item[] }>();
  for (const item of items) {
    const meta = getItemTypeMeta(item.itemType);
    if (!groups.has(meta.label)) groups.set(meta.label, { label: meta.label, icon: meta.icon, items: [] });
    groups.get(meta.label)!.items.push(item);
  }
  return Array.from(groups.values());
}

function itemWeightLabel(item: Item): string {
  const total = item.weight * item.quantity;
  if (total <= 0) return "";
  const rounded = Math.round(total * 10) / 10;
  return `${rounded} lb`;
}

function ItemCard({ item, onToggleCarried }: { item: Item; onToggleCarried: (itemId: number, carried: boolean) => void }) {
  const stored = !item.carried;
  const weightLabel = itemWeightLabel(item);
  return (
    <div
      className={`rounded-md px-3 py-2 text-sm dm-surface-raised border-l-2 ${
        item.equipped ? "border-l-[hsl(var(--dm-amber))]" : "border-l-transparent"
      } ${stored ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">
            {item.name}
            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
          </div>
          {item.description && (
            <div className="text-xs text-[hsl(var(--dm-text-faint))] mt-1 whitespace-pre-wrap">
              {item.description}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {weightLabel && <span className="text-[11px] text-[hsl(var(--dm-text-faint))] tabular-nums">{weightLabel}</span>}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[11px] dm-label hover:dm-amber-text"
              onClick={() => onToggleCarried(item.id, stored)}
            >
              {stored ? "Carry" : "Store"}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0 items-end">
          {stored && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Archive className="w-3 h-3" />
              Stored
            </Badge>
          )}
          {item.equipped && (
            <Badge className="dm-amber-text border-[hsl(var(--dm-amber))]" variant="outline">
              Equipped
            </Badge>
          )}
          {!item.identified && <Badge variant="outline">Unknown</Badge>}
          {item.consumable && <Badge variant="outline">Consumable</Badge>}
        </div>
      </div>
    </div>
  );
}

function tierLabel(tier: CarryWeightDisplay["tier"]): string {
  if (tier === "light") return "Light Load";
  if (tier === "medium") return "Medium Load";
  if (tier === "heavy") return "Heavy Load";
  if (tier === "overloaded") return "Overloaded";
  return "";
}

function tierClass(tier: CarryWeightDisplay["tier"]): string {
  if (tier === "overloaded") return "dm-danger-text";
  if (tier === "heavy") return "dm-amber-text";
  return "text-[hsl(var(--dm-text-muted))]";
}

export default function InventoryOverlay({ open, onOpenChange, items, carryWeight, onToggleCarried }: Props) {
  const groupedItems = useMemo(() => groupItems(items), [items]);
  const equippedCount = items.filter((i) => i.equipped).length;
  const hasCarryWeight = carryWeight && carryWeight.current !== null && carryWeight.max !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="dm-shell dm-surface max-w-2xl max-h-[80vh] overflow-y-auto dm-scroll p-0"
        style={{ boxShadow: "inset 0 0 0 1px hsl(var(--dm-bronze) / 0.35)" }}
      >
        <div className="px-5 pt-5 pb-4 dm-leather border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Backpack className="w-4 h-4 dm-amber-text" />
            <DialogTitle className="dm-heading text-base font-semibold">Inventory &amp; Possessions</DialogTitle>
          </div>
          <div className="flex items-center gap-3">
            {hasCarryWeight && (
              <span className={`text-xs tabular-nums font-medium ${tierClass(carryWeight!.tier)}`}>
                {carryWeight!.current}/{carryWeight!.max} lb · {tierLabel(carryWeight!.tier)}
              </span>
            )}
            {equippedCount > 0 && (
              <span className="dm-label">{equippedCount} equipped</span>
            )}
          </div>
        </div>

        <div className="p-5">
          {groupedItems.length === 0 ? (
            <div className="text-sm text-[hsl(var(--dm-text-muted))] py-6 text-center">
              Nothing carried yet.
            </div>
          ) : (
            <div className="space-y-5">
              {groupedItems.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.label} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium dm-heading">
                      <Icon className="w-4 h-4" style={{ color: "hsl(var(--dm-bronze))" }} />
                      {group.label}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <ItemCard key={item.id} item={item} onToggleCarried={onToggleCarried} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
