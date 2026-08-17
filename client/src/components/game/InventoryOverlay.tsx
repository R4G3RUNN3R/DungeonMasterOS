// client/src/components/game/InventoryOverlay.tsx
//
// Inventory content moved out of the old always-visible sidebar (see
// SidebarCharacterSheet.tsx's "Inventory & Possessions" section, now
// replaced by the compact Character HUD) into a dedicated overlay reachable
// from the HUD's Inventory button, per design spec §4.4/§12.3. This is
// functionally the same grouping/display logic as before — a full "premium
// leather/wood" inventory redesign is explicitly Phase 5 (spec §22), not
// required for the shell to preserve current functionality.

import { useMemo } from "react";
import {
  Backpack, Sword, Shield, Sparkles, Castle, Car, Ship, Wrench, ScrollText,
  Link as LinkIcon, UserRound, PawPrint, Package,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Item = {
  id: number;
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  equipped: boolean;
  identified: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
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

export default function InventoryOverlay({ open, onOpenChange, items }: Props) {
  const groupedItems = useMemo(() => groupItems(items), [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dm-shell dm-surface border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text))] max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="dm-heading flex items-center gap-2">
            <Backpack className="w-4 h-4 dm-amber-text" />
            Inventory &amp; Possessions
          </DialogTitle>
        </DialogHeader>

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
                    <Icon className="w-4 h-4 text-[hsl(var(--dm-text-muted))]" />
                    {group.label}
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div key={item.id} className="dm-surface-raised rounded-lg px-3 py-2 text-sm">
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
                          </div>
                          <div className="flex flex-col gap-1 shrink-0 items-end">
                            {item.equipped && <Badge variant="secondary">Equipped</Badge>}
                            {!item.identified && <Badge variant="outline">Unknown</Badge>}
                            {item.consumable && <Badge variant="outline">Consumable</Badge>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
