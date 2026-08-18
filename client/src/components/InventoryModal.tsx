import { useMemo, useState } from "react";
import {
  Backpack,
  Sword,
  Shield,
  Sparkles,
  Castle,
  Car,
  Ship,
  Wrench,
  ScrollText,
  Link as LinkIcon,
  UserRound,
  PawPrint,
  Package,
  BookOpenText,
} from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EquipmentPaperDoll, { EQUIPMENT_SLOTS } from "@/components/EquipmentPaperDoll";

type Item = {
  id: number;
  campaignId: number;
  characterId: number;
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  equipped: boolean;
  identified: boolean;
  slot: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
  onEquip: (itemId: number, slot: string) => void;
  onUnequip: (itemId: number) => void;
  onUse: (itemId: number) => Promise<void>;
  onRead: (itemId: number) => Promise<string>;
};

const EQUIPPABLE_TYPES = new Set(["weapon", "armor", "magic", "gear"]);
const READABLE_KEYWORDS = /\b(notice|map|letter|scroll|book|journal|document|ledger|note|contract|deed|manuscript|tome|missive)\b/i;

function isReadableDocument(item: Item): boolean {
  return READABLE_KEYWORDS.test(`${item.name} ${item.description}`);
}

function getEligibleSlots(item: Item): typeof EQUIPMENT_SLOTS {
  const type = String(item.itemType || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();

  if (type === "weapon") {
    return EQUIPMENT_SLOTS.filter((s) => s.key === "mainHand" || s.key === "offHand");
  }
  if (/\b(ring|band)\b/.test(name)) {
    return EQUIPMENT_SLOTS.filter((s) => s.key === "ring1" || s.key === "ring2");
  }
  if (/\b(amulet|necklace|pendant|cloak|cape)\b/.test(name)) {
    return EQUIPMENT_SLOTS.filter((s) => s.key === "neck");
  }
  if (/\b(helm|helmet|hood|cap|crown|circlet)\b/.test(name)) {
    return EQUIPMENT_SLOTS.filter((s) => s.key === "head");
  }
  if (/\b(boots?|greaves?|shoes?)\b/.test(name)) {
    return EQUIPMENT_SLOTS.filter((s) => s.key === "feet");
  }
  if (/\b(gloves?|gauntlets?|bracers?)\b/.test(name)) {
    return EQUIPMENT_SLOTS.filter((s) => s.key === "hands");
  }
  if (/\b(leggings?|pants?|trousers?)\b/.test(name)) {
    return EQUIPMENT_SLOTS.filter((s) => s.key === "legs");
  }
  if (/\b(clothes?|shirt|tunic|garment|undergarment)\b/.test(name)) {
    return EQUIPMENT_SLOTS.filter((s) => s.key === "underclothes");
  }
  if (type === "armor") {
    return EQUIPMENT_SLOTS.filter((s) => s.key === "chest");
  }
  // No matching wearable keyword — treat as carried, not slot-equippable
  // (covers things like bags, notices, maps, tools that aren't worn on the body).
  return [];
}

function getItemTypeMeta(itemType: string) {
  const t = String(itemType || "misc").toLowerCase();

  if (t === "weapon") return { label: "Weapons", icon: Sword, color: "text-orange-400" };
  if (t === "armor") return { label: "Armor", icon: Shield, color: "text-amber-400" };
  if (t === "consumable") return { label: "Consumables", icon: Sparkles, color: "text-yellow-400" };
  if (t === "property") return { label: "Property", icon: Castle, color: "text-amber-300" };
  if (t === "vehicle") return { label: "Vehicles", icon: Car, color: "text-orange-300" };
  if (t === "vessel") return { label: "Vessels", icon: Ship, color: "text-orange-300" };
  if (t === "tool") return { label: "Tools", icon: Wrench, color: "text-amber-500" };
  if (t === "magic") return { label: "Magic Items", icon: ScrollText, color: "text-orange-500" };
  if (t === "retainer") return { label: "Retainers", icon: UserRound, color: "text-amber-200" };
  if (t === "mount" || t === "creature") return { label: "Mounts & Creatures", icon: PawPrint, color: "text-yellow-300" };
  if (t === "key") return { label: "Keys", icon: LinkIcon, color: "text-amber-600" };
  return { label: "Gear & Misc", icon: Package, color: "text-amber-200" };
}

function groupItems(items: Item[]) {
  const groups = new Map<string, { label: string; icon: any; color: string; items: Item[] }>();

  for (const item of items) {
    const meta = getItemTypeMeta(item.itemType);
    if (!groups.has(meta.label)) {
      groups.set(meta.label, { label: meta.label, icon: meta.icon, color: meta.color, items: [] });
    }
    groups.get(meta.label)!.items.push(item);
  }

  return Array.from(groups.values());
}

export default function InventoryModal({ open, onOpenChange, items, onEquip, onUnequip, onUse, onRead }: Props) {
  const groupedItems = useMemo(() => groupItems(items), [items]);

  const [useLoadingId, setUseLoadingId] = useState<number | null>(null);
  const [readLoadingId, setReadLoadingId] = useState<number | null>(null);
  const [readContent, setReadContent] = useState<Record<number, string>>({});

  async function handleUse(itemId: number) {
    setUseLoadingId(itemId);
    try {
      await onUse(itemId);
    } finally {
      setUseLoadingId(null);
    }
  }

  async function handleRead(itemId: number) {
    if (readContent[itemId]) {
      // Already fetched — just toggle it back open if it was closed.
      setReadContent((prev) => ({ ...prev }));
      return;
    }
    setReadLoadingId(itemId);
    try {
      const content = await onRead(itemId);
      setReadContent((prev) => ({ ...prev, [itemId]: content }));
    } finally {
      setReadLoadingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Backpack className="w-4 h-4 text-amber-500" />
            Inventory
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <Card className="p-4 space-y-4 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.06),_transparent_45%)]">
            <div className="flex items-center gap-2 font-medium">
              <UserRound className="w-4 h-4 text-amber-500" />
              Equipment
            </div>
            <EquipmentPaperDoll items={items} onUnequip={onUnequip} />
          </Card>

          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 font-medium">
              <Backpack className="w-4 h-4 text-amber-500" />
              Inventory & Possessions
            </div>

            {groupedItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nothing tracked yet. Once the DM actually awards or you buy something, it should appear here instead of evaporating into decorative prose.
              </div>
            ) : (
              <div className="pr-1">
                <div className="space-y-4">
                  {groupedItems.map((group) => {
                    const Icon = group.icon;
                    return (
                      <div key={group.label} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Icon className={`w-4 h-4 ${group.color}`} />
                          {group.label}
                        </div>

                        <div className="space-y-2">
                          {group.items.map((item) => {
                            const readable = isReadableDocument(item);
                            return (
                              <div
                                key={item.id}
                                className={
                                  item.equipped
                                    ? "rounded-lg border border-amber-500/30 bg-amber-500/[0.04] px-3 py-2 text-sm transition-colors"
                                    : "rounded-lg border border-border hover:border-amber-500/20 px-3 py-2 text-sm transition-colors"
                                }
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">
                                      {item.name}
                                      {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                                    </div>
                                    {item.description ? (
                                      <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                        {item.description}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-col gap-1 shrink-0 items-end">
                                    {item.equipped && (
                                      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/15">
                                        Equipped
                                      </Badge>
                                    )}
                                    {!item.identified && <Badge variant="outline">Unknown</Badge>}
                                    {item.consumable && (
                                      <Badge className="bg-yellow-500/10 text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/10">
                                        Consumable
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-2 flex items-center gap-3 flex-wrap">
                                  {EQUIPPABLE_TYPES.has(String(item.itemType || "").toLowerCase()) &&
                                    (item.equipped ? (
                                      <button
                                        type="button"
                                        className="text-xs text-muted-foreground hover:text-destructive"
                                        onClick={() => onUnequip(item.id)}
                                      >
                                        Unequip
                                      </button>
                                    ) : (
                                      getEligibleSlots(item).length > 0 && (
                                        <select
                                          className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                                          value=""
                                          onChange={(e) => {
                                            if (e.target.value) onEquip(item.id, e.target.value);
                                          }}
                                        >
                                          <option value="">Equip to...</option>
                                          {getEligibleSlots(item).map((s) => (
                                            <option key={s.key} value={s.key}>
                                              {s.label}
                                            </option>
                                          ))}
                                        </select>
                                      )
                                    ))}

                                  {item.consumable && (
                                    <button
                                      type="button"
                                      disabled={useLoadingId === item.id}
                                      className="text-xs font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-wait"
                                      onClick={() => handleUse(item.id)}
                                    >
                                      {useLoadingId === item.id ? "Using..." : "Use"}
                                    </button>
                                  )}

                                  {readable && (
                                    <button
                                      type="button"
                                      disabled={readLoadingId === item.id}
                                      className="text-xs font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-wait flex items-center gap-1"
                                      onClick={() => handleRead(item.id)}
                                    >
                                      <BookOpenText className="w-3 h-3" />
                                      {readLoadingId === item.id
                                        ? "Reading..."
                                        : readContent[item.id]
                                          ? "Read Again"
                                          : "Read"}
                                    </button>
                                  )}
                                </div>

                                {readContent[item.id] && (
                                  <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                    {readContent[item.id]}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
