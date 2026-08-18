import { X, UserRound } from "lucide-react";

export type EquipmentSlot =
  | "head"
  | "neck"
  | "chest"
  | "underclothes"
  | "hands"
  | "mainHand"
  | "offHand"
  | "ring1"
  | "ring2"
  | "legs"
  | "feet";

export const EQUIPMENT_SLOTS: Array<{ key: EquipmentSlot; label: string }> = [
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

type EquippableItem = {
  id: number;
  name: string;
  equipped: boolean;
  slot: string | null;
};

type Props = {
  items: EquippableItem[];
  onUnequip: (itemId: number) => void;
};

function SlotBox({
  label,
  item,
  onUnequip,
}: {
  label: string;
  item?: EquippableItem;
  onUnequip: (itemId: number) => void;
}) {
  return (
    <div
      className={
        item
          ? "rounded-lg border border-primary/40 bg-primary/10 px-2 py-1.5 min-h-[46px] flex flex-col justify-center transition-colors"
          : "rounded-lg border border-border bg-background/60 px-2 py-1.5 min-h-[46px] flex flex-col justify-center transition-colors"
      }
      title={label}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {item ? (
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-xs font-medium text-amber-200 truncate">{item.name}</span>
          <button
            type="button"
            aria-label={`Unequip ${item.name}`}
            className="text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onUnequip(item.id)}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/50 mt-0.5">Empty</div>
      )}
    </div>
  );
}

export default function EquipmentPaperDoll({ items, onUnequip }: Props) {
  const equippedBySlot = new Map<string, EquippableItem>();
  for (const item of items) {
    if (item.equipped && item.slot) equippedBySlot.set(item.slot, item);
  }

  const slot = (key: EquipmentSlot) => equippedBySlot.get(key);

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <div className="col-start-2">
        <SlotBox label="Head" item={slot("head")} onUnequip={onUnequip} />
      </div>
      <div className="col-start-2">
        <SlotBox label="Neck" item={slot("neck")} onUnequip={onUnequip} />
      </div>

      <SlotBox label="Main Hand" item={slot("mainHand")} onUnequip={onUnequip} />
      <div className="rounded-lg border border-dashed border-amber-500/20 flex items-center justify-center min-h-[46px] bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.06),_transparent_70%)]">
        <UserRound className="w-5 h-5 text-amber-500/30" />
      </div>
      <SlotBox label="Off Hand" item={slot("offHand")} onUnequip={onUnequip} />

      <SlotBox label="Ring 1" item={slot("ring1")} onUnequip={onUnequip} />
      <SlotBox label="Chest" item={slot("chest")} onUnequip={onUnequip} />
      <SlotBox label="Ring 2" item={slot("ring2")} onUnequip={onUnequip} />

      <div className="col-start-2">
        <SlotBox label="Undergarments" item={slot("underclothes")} onUnequip={onUnequip} />
      </div>

      <div className="col-start-2">
        <SlotBox label="Hands" item={slot("hands")} onUnequip={onUnequip} />
      </div>
      <div className="col-start-2">
        <SlotBox label="Legs" item={slot("legs")} onUnequip={onUnequip} />
      </div>
      <div className="col-start-2">
        <SlotBox label="Feet" item={slot("feet")} onUnequip={onUnequip} />
      </div>
    </div>
  );
}
