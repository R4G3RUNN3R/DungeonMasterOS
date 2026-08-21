// client/src/components/sheet/EquipmentTab.tsx
//
// Read-only equipment + feats reference for the 3.5e Character Sheet's
// Equipment tab. Deliberately has no equip/unequip/use/read actions —
// client/src/components/game/InventoryOverlay.tsx remains the sole place
// inventory state is mutated (design spec 2026-08-20). This just shows a
// loadout summary and the full item list in the sheet's parchment style.

import { useMemo } from "react";
import {
  Backpack, Sword, Shield, Sparkles, Castle, Car, Ship, Wrench, ScrollText,
  Link as LinkIcon, UserRound, PawPrint, Package,
} from "lucide-react";

type Item = {
  id: number;
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  equipped: boolean;
  identified: boolean;
  slot: string | null;
  weight: number;
  carried: boolean;
  weaponDamageDice: string | null;
};

type ParsedSection = {
  label: string;
  entries?: Array<{ key?: string; name?: string; value?: string; description?: string }>;
};

type Props = {
  items: Item[];
  featSections: ParsedSection[];
};

// Same 11 slots InventoryOverlay's equipped view uses (EquipmentPaperDoll.tsx),
// duplicated here as a plain label list rather than importing that component:
// EquipmentPaperDoll is dark/leather-themed for the campaign HUD, and reskinning
// it in place would create a visual mismatch everywhere else it's used.
const SLOT_LABELS: Array<{ key: string; label: string }> = [
  { key: "head", label: "Head" },
  { key: "neck", label: "Neck" },
  { key: "chest", label: "Chest" },
  { key: "underclothes", label: "Undergarments" },
  { key: "hands", label: "Hands" },
  { key: "mainHand", label: "Main Hand" },
  { key: "offHand", label: "Off Hand" },
  { key: "ring1", label: "Ring 1" },
  { key: "ring2", label: "Ring 2" },
  { key: "legs", label: "Legs" },
  { key: "feet", label: "Feet" },
];

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="parchment-label text-xs border-b border-[#654a27]/40 pb-1 mb-2">{children}</div>;
}

export default function EquipmentTab({ items, featSections }: Props) {
  const groupedItems = useMemo(() => groupItems(items), [items]);
  const equippedByslot = useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of items) {
      if (item.equipped && item.slot) map.set(item.slot, item);
    }
    return map;
  }, [items]);

  return (
    <div className="p-6 space-y-6">
      {/* Loadout */}
      <div>
        <SectionLabel>Equipped</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SLOT_LABELS.map((slot) => {
            const item = equippedByslot.get(slot.key);
            return (
              <div key={slot.key} className="border border-[#654a27]/30 rounded-md bg-[#f6ecd2]/50 px-2 py-1.5">
                <div className="text-[9px] parchment-label opacity-70">{slot.label}</div>
                <div className="text-xs mt-0.5 truncate">{item ? item.name : <span className="opacity-40">Empty</span>}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full inventory */}
      <div>
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <Backpack className="w-3 h-3" /> Inventory &amp; Possessions
          </span>
        </SectionLabel>
        {groupedItems.length === 0 ? (
          <div className="text-xs opacity-60">Nothing carried.</div>
        ) : (
          <div className="space-y-4">
            {groupedItems.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.label}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold mb-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    {group.label}
                  </div>
                  <div className="space-y-1.5">
                    {group.items.map((item) => (
                      <div key={item.id} className="border-b border-[#654a27]/15 pb-1.5 text-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">
                            {item.name}
                            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                          </span>
                          <span className="text-[10px] opacity-60 shrink-0">
                            {item.weight > 0 ? `${Math.round(item.weight * item.quantity * 10) / 10} lb` : ""}
                            {item.equipped ? " · equipped" : item.carried ? "" : " · stored"}
                            {!item.identified ? " · unidentified" : ""}
                          </span>
                        </div>
                        {item.description && (
                          <div className="text-xs opacity-70 mt-0.5 whitespace-pre-wrap">{item.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feats & Special Abilities */}
      {featSections.length > 0 && (
        <div>
          <SectionLabel>Feats &amp; Special Abilities</SectionLabel>
          <div className="space-y-1.5">
            {featSections.flatMap((section) => section.entries ?? []).map((entry, idx) => (
              <div key={`${entry.key || entry.name || "entry"}-${idx}`} className="text-sm">
                <span className="font-semibold">{entry.name || entry.key}.</span>{" "}
                <span className="opacity-80">{entry.description || entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
