// client/src/components/game/CharacterHud.tsx
//
// Permanent left Character HUD (design spec §4). Not a full character
// sheet — the at-a-glance top section plus core combat/travel numbers.
// Reads only the ruleset-agnostic CharacterHudModel (see rulesAdapters) so
// this component never needs to know it's currently only ever fed 3.5e
// data.

import { Backpack, BookOpen, ScrollText, Heart, Shield, Zap, Wind, Swords, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CharacterHudModel } from "@/lib/rulesAdapters";

type CurrencyDisplay = {
  code: string;
  label: string;
  amount: number;
};

type Props = {
  hud: CharacterHudModel;
  currencies: CurrencyDisplay[];
  onOpenPortrait: () => void;
  onOpenSheet: () => void;
  onOpenInventory: () => void;
  onOpenCodex: () => void;
};

function StatBox({
  label,
  value,
  icon: Icon,
  valueClassName,
}: {
  label: string;
  value: string;
  icon: typeof Heart;
  valueClassName?: string;
}) {
  return (
    <div className="dm-surface-raised rounded-md px-2 py-1.5 flex flex-col gap-0.5">
      <div className="dm-label flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`text-sm font-semibold tabular-nums ${valueClassName ?? ""}`}>{value}</div>
    </div>
  );
}

function carryWeightValueClass(carryWeight: CharacterHudModel["carryWeight"]) {
  const tier = carryWeight?.tier;
  if (tier === "overloaded") return "dm-danger-text";
  if (tier === "heavy") return "dm-amber-text";
  return "";
}

function fmtNumberOrUnknown(value: number | null): string {
  return value === null ? "—" : String(value);
}

function fmtSigned(value: number | null): string {
  if (value === null) return "—";
  return value >= 0 ? `+${value}` : String(value);
}

export default function CharacterHud({
  hud,
  currencies,
  onOpenPortrait,
  onOpenSheet,
  onOpenInventory,
  onOpenCodex,
}: Props) {
  const hpPct =
    hud.hp && hud.hp.max > 0 ? Math.max(0, Math.min(100, Math.round((hud.hp.current / hud.hp.max) * 100))) : null;

  return (
    <div className="h-full flex flex-col dm-surface border-r">
      <div className="flex-1 overflow-y-auto dm-scroll p-3 space-y-4">
        {/* Identity */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onOpenPortrait}
            className="shrink-0 w-[76px] h-[76px] rounded-full dm-surface-raised border-2 flex items-center justify-center overflow-hidden hover:brightness-110 transition-[filter]"
            style={{ borderColor: "hsl(var(--dm-bronze))" }}
            aria-label="Open character profile"
          >
            {hud.portraitUrl ? (
              <img src={hud.portraitUrl} alt={hud.name} className="w-full h-full object-cover" />
            ) : (
              <span className="dm-heading text-xl dm-amber-text">
                {hud.name.slice(0, 1).toUpperCase() || "?"}
              </span>
            )}
          </button>

          <div className="min-w-0 pt-1">
            <div className="dm-heading text-base font-semibold leading-tight truncate">{hud.name}</div>
            <div className="text-xs text-[hsl(var(--dm-text-muted))] truncate">
              {hud.race ?? "Unknown race"} · {hud.classSummary ?? "Unknown class"}
            </div>
            <div className="text-[11px] text-[hsl(var(--dm-text-faint))] truncate">
              {hud.age ? `Age ${hud.age}` : "Age unknown"} · {hud.alignment ?? "Alignment unknown"}
            </div>
          </div>
        </div>

        {/* HP bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="dm-label flex items-center gap-1">
              <Heart className="w-3 h-3" />
              Hit Points
            </span>
            <span className="tabular-nums font-medium">
              {hud.hp ? `${hud.hp.current} / ${hud.hp.max}` : "Unknown"}
            </span>
          </div>
          <div className="h-2 rounded-full dm-surface-raised overflow-hidden">
            {hpPct !== null && (
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${hpPct}%`,
                  background: hpPct <= 25 ? "hsl(var(--dm-danger))" : "hsl(var(--dm-amber))",
                }}
              />
            )}
          </div>
        </div>

        {/* Core stat grid */}
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="AC" value={fmtNumberOrUnknown(hud.ac)} icon={Shield} />
          <StatBox label="Init" value={fmtSigned(hud.initiative)} icon={Zap} />
          <StatBox label="Speed" value={hud.speed !== null ? `${hud.speed} ft` : "—"} icon={Wind} />
          <StatBox label="Atk/Rnd" value={fmtNumberOrUnknown(hud.attacksPerRound)} icon={Swords} />
          <StatBox
            label="Carry"
            value={
              hud.carryWeight && hud.carryWeight.current !== null && hud.carryWeight.max !== null
                ? `${hud.carryWeight.current}/${hud.carryWeight.max}`
                : "—"
            }
            icon={Weight}
            valueClassName={carryWeightValueClass(hud.carryWeight)}
          />
        </div>

        {/* Saving throws — ruleset-specific set, driven entirely by the adapter */}
        {hud.saves.length > 0 && (
          <div className="space-y-1.5">
            <div className="dm-label">Saving Throws</div>
            <div className="grid grid-cols-3 gap-2">
              {hud.saves.map((save) => (
                <div key={save.key} className="dm-surface-raised rounded-md px-2 py-1.5 text-center">
                  <div className="dm-label">{save.label}</div>
                  <div className="text-sm font-semibold tabular-nums">{fmtSigned(save.value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Primary controls */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-col h-auto py-2 gap-1 dm-surface-raised border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text))] hover:bg-[hsl(var(--dm-leather))]"
            onClick={onOpenSheet}
          >
            <ScrollText className="w-4 h-4" />
            <span className="text-[10px]">Sheet</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-col h-auto py-2 gap-1 dm-surface-raised border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text))] hover:bg-[hsl(var(--dm-leather))]"
            onClick={onOpenInventory}
          >
            <Backpack className="w-4 h-4" />
            <span className="text-[10px]">Inventory</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-col h-auto py-2 gap-1 dm-surface-raised border-[hsl(var(--dm-line))] text-[hsl(var(--dm-text))] hover:bg-[hsl(var(--dm-leather))]"
            onClick={onOpenCodex}
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-[10px]">Codex</span>
          </Button>
        </div>
      </div>

      {/* Currency footer */}
      {currencies.length > 0 && (
        <div className="dm-leather border-t px-3 py-2 flex flex-wrap gap-x-3 gap-y-1">
          {currencies.map((c) => (
            <div key={c.code} className="flex items-center gap-1 text-xs">
              <span className="dm-label">{c.label}</span>
              <span className="tabular-nums font-medium dm-amber-text">{c.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
