import React, { useEffect, useMemo, useState } from "react";
import {
  Backpack,
  Sword,
  Shield,
  Sparkles,
  Coins,
  Wrench,
  Castle,
  Car,
  Ship,
  PawPrint,
  UserRound,
  KeyRound,
  Package,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Entry = {
  id: string;
  key?: string;
  name?: string;
  value?: string;
  description?: string;
  quantity?: number;
  equipped?: boolean;
  identified?: boolean;
  charges?: number | null;
  maxCharges?: number | null;
  locationNote?: string;
  statMods?: any[];
};

type SectionType =
  | "notes"
  | "abilities"
  | "weapon"
  | "armor"
  | "consumable"
  | "gear"
  | "tool"
  | "magic"
  | "currency"
  | "property"
  | "vehicle"
  | "vessel"
  | "mount"
  | "creature"
  | "retainer"
  | "key"
  | "misc";

type Section = {
  id: string;
  label: string;
  type: SectionType;
  entries: Entry[];
};

type CharacterSheetData = {
  sections: Section[];
  raw?: string;
};

type Props = {
  value?: string;
  onChange?: (nextValue: string) => void;
  readOnly?: boolean;
  className?: string;
};

const SECTION_OPTIONS: Array<{
  value: SectionType;
  label: string;
  icon: React.ComponentType<any>;
}> = [
  { value: "notes", label: "Notes", icon: Package },
  { value: "abilities", label: "Abilities", icon: Sparkles },
  { value: "weapon", label: "Weapons", icon: Sword },
  { value: "armor", label: "Armor", icon: Shield },
  { value: "consumable", label: "Consumables", icon: Sparkles },
  { value: "gear", label: "Gear", icon: Backpack },
  { value: "tool", label: "Tools", icon: Wrench },
  { value: "magic", label: "Magic Items", icon: Sparkles },
  { value: "currency", label: "Currency", icon: Coins },
  { value: "property", label: "Property", icon: Castle },
  { value: "vehicle", label: "Vehicles", icon: Car },
  { value: "vessel", label: "Vessels", icon: Ship },
  { value: "mount", label: "Mounts", icon: PawPrint },
  { value: "creature", label: "Creatures", icon: PawPrint },
  { value: "retainer", label: "Retainers", icon: UserRound },
  { value: "key", label: "Keys", icon: KeyRound },
  { value: "misc", label: "Miscellaneous", icon: Package },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultLabelForType(type: SectionType) {
  return SECTION_OPTIONS.find((s) => s.value === type)?.label || "Section";
}

function safeParse(value?: string): CharacterSheetData {
  if (!value?.trim()) return { sections: [] };

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return { sections: [] };

    const sections = Array.isArray(parsed.sections)
      ? parsed.sections.map((section: any) => ({
          id: section.id || uid(),
          label: section.label || defaultLabelForType(section.type || "notes"),
          type: (section.type || "notes") as SectionType,
          entries: Array.isArray(section.entries)
            ? section.entries.map((entry: any) => ({
                id: entry.id || uid(),
                key: entry.key || "",
                name: entry.name || "",
                value: entry.value || "",
                description: entry.description || "",
                quantity:
                  typeof entry.quantity === "number" ? entry.quantity : 1,
                equipped: !!entry.equipped,
                identified:
                  entry.identified === undefined ? true : !!entry.identified,
                charges:
                  typeof entry.charges === "number" ? entry.charges : null,
                maxCharges:
                  typeof entry.maxCharges === "number" ? entry.maxCharges : null,
                locationNote: entry.locationNote || "",
                statMods: Array.isArray(entry.statMods) ? entry.statMods : [],
              }))
            : [],
        }))
      : [];

    return {
      sections,
      raw: typeof parsed.raw === "string" ? parsed.raw : "",
    };
  } catch {
    return { sections: [], raw: value };
  }
}

function serialize(data: CharacterSheetData) {
  return JSON.stringify(data);
}

function makeEntryForType(type: SectionType): Entry {
  if (type === "currency") {
    return {
      id: uid(),
      name: "",
      value: "",
      quantity: 1,
    };
  }

  if (
    [
      "weapon",
      "armor",
      "consumable",
      "gear",
      "tool",
      "magic",
      "property",
      "vehicle",
      "vessel",
      "mount",
      "creature",
      "retainer",
      "key",
      "misc",
    ].includes(type)
  ) {
    return {
      id: uid(),
      name: "",
      description: "",
      quantity: 1,
      equipped: false,
      identified: true,
      charges: null,
      maxCharges: null,
      locationNote: "",
      statMods: [],
    };
  }

  return {
    id: uid(),
    key: "",
    value: "",
    description: "",
  };
}

function sectionIcon(type: SectionType) {
  return SECTION_OPTIONS.find((s) => s.value === type)?.icon || Package;
}

function SectionTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: SectionType;
  onChange: (next: SectionType) => void;
  disabled?: boolean;
}) {
  const current = SECTION_OPTIONS.find((s) => s.value === value);
  const Icon = current?.icon || Package;

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SectionType)}
        disabled={disabled}
        className="appearance-none w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm"
      >
        {SECTION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hidden" />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function ItemEntryEditor({
  type,
  entry,
  onChange,
  onRemove,
  readOnly,
}: {
  type: SectionType;
  entry: Entry;
  onChange: (next: Entry) => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const isCurrency = type === "currency";
  const isBasicNote = type === "notes" || type === "abilities";

  if (isCurrency) {
    return (
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Currency Name / Code</label>
            <Input
              value={entry.name || ""}
              onChange={(e) => onChange({ ...entry, name: e.target.value })}
              placeholder="Gold, USD, Beri..."
              disabled={readOnly}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount</label>
            <Input
              type="number"
              value={entry.value || ""}
              onChange={(e) => onChange({ ...entry, value: e.target.value })}
              placeholder="0"
              disabled={readOnly}
            />
          </div>
        </div>

        {!readOnly && (
          <div className="flex justify-end">
            <Button variant="destructive" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </div>
        )}
      </Card>
    );
  }

  if (isBasicNote) {
    return (
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">
              {type === "abilities" ? "Ability Name" : "Property"}
            </label>
            <Input
              value={entry.key || entry.name || ""}
              onChange={(e) =>
                onChange({ ...entry, key: e.target.value, name: e.target.value })
              }
              placeholder={type === "abilities" ? "Shadow Step" : "Title"}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              {type === "abilities" ? "Description" : "Value"}
            </label>
            <Textarea
              value={entry.value || entry.description || ""}
              onChange={(e) =>
                onChange({
                  ...entry,
                  value: e.target.value,
                  description: e.target.value,
                })
              }
              placeholder={
                type === "abilities"
                  ? "What it does..."
                  : "Details..."
              }
              disabled={readOnly}
            />
          </div>
        </div>

        {!readOnly && (
          <div className="flex justify-end">
            <Button variant="destructive" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Item Name</label>
          <Input
            value={entry.name || ""}
            onChange={(e) => onChange({ ...entry, name: e.target.value })}
            placeholder="Iron Sword"
            disabled={readOnly}
          />
        </div>

        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Description</label>
          <Textarea
            value={entry.description || ""}
            onChange={(e) => onChange({ ...entry, description: e.target.value })}
            placeholder="Short description..."
            disabled={readOnly}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Quantity</label>
          <Input
            type="number"
            min={1}
            value={entry.quantity ?? 1}
            onChange={(e) =>
              onChange({
                ...entry,
                quantity: Math.max(1, Number(e.target.value) || 1),
              })
            }
            disabled={readOnly}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Location / Note</label>
          <Input
            value={entry.locationNote || ""}
            onChange={(e) =>
              onChange({ ...entry, locationNote: e.target.value })
            }
            placeholder="Belt, bag, stable..."
            disabled={readOnly}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Charges</label>
          <Input
            type="number"
            value={entry.charges ?? ""}
            onChange={(e) =>
              onChange({
                ...entry,
                charges:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="Optional"
            disabled={readOnly}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Max Charges</label>
          <Input
            type="number"
            value={entry.maxCharges ?? ""}
            onChange={(e) =>
              onChange({
                ...entry,
                maxCharges:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="Optional"
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={entry.equipped ? "default" : "outline"}
          onClick={() => onChange({ ...entry, equipped: !entry.equipped })}
          disabled={readOnly}
        >
          Equipped: {entry.equipped ? "Yes" : "No"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant={entry.identified === false ? "outline" : "default"}
          onClick={() =>
            onChange({
              ...entry,
              identified: entry.identified === false ? true : false,
            })
          }
          disabled={readOnly}
        >
          Identified: {entry.identified === false ? "No" : "Yes"}
        </Button>
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <Button variant="destructive" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function CharacterSheetView({
  value,
  onChange,
  readOnly = false,
  className,
}: Props) {
  const [data, setData] = useState<CharacterSheetData>(() => safeParse(value));

  useEffect(() => {
    setData(safeParse(value));
  }, [value]);

  useEffect(() => {
    onChange?.(serialize(data));
  }, [data, onChange]);

  const sectionCount = data.sections.length;

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const section of data.sections) {
      counts[section.type] = (counts[section.type] || 0) + section.entries.length;
    }
    return counts;
  }, [data.sections]);

  function updateSection(sectionId: string, updater: (section: Section) => Section) {
    setData((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? updater(section) : section
      ),
    }));
  }

  function addSection(type: SectionType = "notes") {
    setData((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: uid(),
          label: defaultLabelForType(type),
          type,
          entries: [makeEntryForType(type)],
        },
      ],
    }));
  }

  function removeSection(sectionId: string) {
    setData((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== sectionId),
    }));
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <Backpack className="h-4 w-4 text-primary" />
              Character Sections
            </div>
            <div className="text-sm text-muted-foreground">
              Build structured inventory, abilities, notes, property, vehicles, currency and more.
            </div>
          </div>

          {!readOnly && (
            <Button onClick={() => addSection("gear")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Sections: {sectionCount}</Badge>
          {Object.entries(summary).map(([key, count]) => (
            <Badge key={key} variant="outline">
              {defaultLabelForType(key as SectionType)}: {count}
            </Badge>
          ))}
        </div>
      </Card>

      {data.sections.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No sections yet. Add one and stop making the app guess whether a cart, a dagger and a castle are all just “properties”.
        </Card>
      ) : (
        data.sections.map((section) => {
          const Icon = sectionIcon(section.type);

          return (
            <Card key={section.id} className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg border flex items-center justify-center bg-background">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                    <div>
                      <label className="text-xs text-muted-foreground">Section Type</label>
                      <SectionTypeSelect
                        value={section.type}
                        onChange={(nextType) =>
                          updateSection(section.id, () => ({
                            ...section,
                            type: nextType,
                            label: defaultLabelForType(nextType),
                            entries:
                              section.entries.length > 0 &&
                              section.type === nextType
                                ? section.entries
                                : [makeEntryForType(nextType)],
                          }))
                        }
                        disabled={readOnly}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Section Label</label>
                      <Input
                        value={section.label}
                        onChange={(e) =>
                          updateSection(section.id, (current) => ({
                            ...current,
                            label: e.target.value,
                          }))
                        }
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>

                {!readOnly && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeSection(section.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Section
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {section.entries.map((entry) => (
                  <ItemEntryEditor
                    key={entry.id}
                    type={section.type}
                    entry={entry}
                    readOnly={readOnly}
                    onChange={(nextEntry) =>
                      updateSection(section.id, (current) => ({
                        ...current,
                        entries: current.entries.map((existing) =>
                          existing.id === entry.id ? nextEntry : existing
                        ),
                      }))
                    }
                    onRemove={() =>
                      updateSection(section.id, (current) => ({
                        ...current,
                        entries: current.entries.filter((existing) => existing.id !== entry.id),
                      }))
                    }
                  />
                ))}

                {!readOnly && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      updateSection(section.id, (current) => ({
                        ...current,
                        entries: [...current.entries, makeEntryForType(current.type)],
                      }))
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
