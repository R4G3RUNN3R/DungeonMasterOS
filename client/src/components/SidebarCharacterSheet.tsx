import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Shield, Zap, Coins, Sword, Wifi, WifiOff, Backpack, BookOpen, ScrollText, Wind, Moon, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import InventoryModal from "@/components/InventoryModal";
import CodexModal from "@/components/CodexModal";
import CharacterSheetModal, { type FullCharacterSheet } from "@/components/CharacterSheetModal";
import LevelUpWizard from "@/components/LevelUpWizard";
import AchievementsPanel from "@/components/AchievementsPanel";

type Character = {
  id: number;
  campaignId: number;
  name: string;
  race: string;
  charClass: string;
  traits: string;
  backstory: string;
  level: number;
  hp: number;
  maxHp: number;
  tempHp: number;
  speed: number;
  attacksPerRound: number;
  status: string;
  characterData: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  ac: number;
  xp: number;
};

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

type Props = {
  character: Character;
  items: Item[];
  currencies: CurrencyBalance[];
  campaignCurrencies: CampaignCurrency[];
  connected?: boolean;
  onEquip: (itemId: number, slot: string) => void;
  onUnequip: (itemId: number) => void;
  onUse: (itemId: number) => Promise<void>;
  onRead: (itemId: number) => Promise<string>;
  onSubmitReport: (description: string) => Promise<void>;
  worldState?: string;
};

const ABILITY_LABELS: Record<string, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

function modifierFor(score: number) {
  return Math.floor((score - 10) / 2);
}

function formatCurrencyAmount(amount: number, def?: CampaignCurrency) {
  if (!def) return `${amount}`;
  if (def.symbol) return `${def.symbol}${amount}`;
  return `${amount} ${def.name}`;
}

export default function SidebarCharacterSheet({
  character,
  items,
  currencies,
  campaignCurrencies,
  connected = true,
  onEquip,
  onUnequip,
  onUse,
  onRead,
  onSubmitReport,
  worldState,
}: Props) {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);

  const qc = useQueryClient();

  // Shared with CharacterSheetModal via the same query key — react-query
  // dedupes the request, so opening the modal doesn't refetch what the
  // sidebar already has.
  const { data: sheet } = useQuery<FullCharacterSheet>({
    queryKey: [`/api/characters/${character.id}/sheet`],
  });

  const longRestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/characters/${character.id}/long-rest`, {});
      return res.json() as Promise<{ hp: number; maxHp: number; pendingLevelUps: number }>;
    },
    onSuccess: async (data) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/campaigns", character.campaignId, "my-character"] }),
        qc.invalidateQueries({ queryKey: [`/api/characters/${character.id}/sheet`] }),
      ]);
      if (data.pendingLevelUps > 0) setLevelUpOpen(true);
    },
  });

  const hpPercent =
    character.maxHp > 0
      ? Math.max(0, Math.min(100, Math.round((character.hp / character.maxHp) * 100)))
      : 0;

  const currencyDisplay = useMemo(() => {
    return currencies
      .map((balance) => {
        const def = campaignCurrencies.find((c) => c.code === balance.currencyCode);
        return { ...balance, def };
      })
      .sort((a, b) => {
        const aPrimary = a.def?.isPrimary ? 1 : 0;
        const bPrimary = b.def?.isPrimary ? 1 : 0;
        return bPrimary - aPrimary || a.currencyCode.localeCompare(b.currencyCode);
      });
  }, [currencies, campaignCurrencies]);

  return (
    <div className="h-full flex flex-col parchment-surface">
      <div className="border-b border-amber-900/20 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="parchment-heading text-xl font-semibold leading-tight truncate text-amber-950">
              {character.name}
            </div>
            <div className="text-sm text-amber-900/60 truncate">
              {character.race} • {character.charClass}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge className="bg-amber-100/70 text-amber-900 border border-amber-800/25 hover:bg-amber-100/70">
              Lv {character.level}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "gap-1 bg-amber-50/40",
                connected ? "text-emerald-700 border-emerald-700/30" : "text-yellow-700 border-yellow-700/30",
              )}
            >
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connected ? "Live" : "Offline"}
            </Badge>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5">
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant="outline"
            className="gap-2 bg-amber-50/50 border-amber-800/25 text-amber-950 hover:bg-amber-50/80 px-2"
            onClick={() => setInventoryOpen(true)}
          >
            <Backpack className="w-4 h-4 text-amber-700" />
            Inventory
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-amber-50/50 border-amber-800/25 text-amber-950 hover:bg-amber-50/80 px-2"
            onClick={() => setCodexOpen(true)}
          >
            <BookOpen className="w-4 h-4 text-amber-700" />
            Codex
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-amber-50/50 border-amber-800/25 text-amber-950 hover:bg-amber-50/80 px-2"
            onClick={() => setSheetOpen(true)}
          >
            <ScrollText className="w-4 h-4 text-amber-700" />
            Sheet
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-amber-50/50 border-amber-800/25 text-amber-950 hover:bg-amber-50/80 px-2"
            onClick={() => setAchievementsOpen(true)}
          >
            <Trophy className="w-4 h-4 text-amber-700" />
            Deeds
          </Button>
        </div>

        <Card className="parchment-ruled p-4 space-y-4 bg-amber-50/30 border-amber-800/25 text-amber-950 shadow-none">
          <div className="parchment-label flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-700" />
            Vital Status
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>HP</span>
              <span className="font-medium">
                {character.hp} / {character.maxHp}
                {character.tempHp > 0 ? ` (+${character.tempHp} temp)` : ""}
              </span>
            </div>
            <Progress value={hpPercent} className="bg-amber-900/10" />
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-amber-800/20 bg-amber-50/40 p-3">
              <div className="text-amber-900/60 text-xs mb-1">Speed</div>
              <div className="font-medium flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-700" />
                {character.speed}
              </div>
            </div>

            <div className="rounded-lg border border-amber-800/20 bg-amber-50/40 p-3">
              <div className="text-amber-900/60 text-xs mb-1">Attacks</div>
              <div className="font-medium flex items-center gap-2">
                <Sword className="w-3.5 h-3.5 text-amber-700" />
                {character.attacksPerRound}
              </div>
            </div>

            <div className="rounded-lg border border-amber-800/20 bg-amber-50/40 p-3">
              <div className="text-amber-900/60 text-xs mb-1">Initiative</div>
              <div className="font-medium flex items-center gap-2">
                <Wind className="w-3.5 h-3.5 text-amber-700" />
                {sheet ? (sheet.abilities.dex.modifier >= 0 ? `+${sheet.abilities.dex.modifier}` : sheet.abilities.dex.modifier) : "—"}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-amber-900/60">
            <span>
              Status: <span className="font-medium text-amber-950">{character.status}</span>
            </span>
            <span>{character.xp} XP</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 bg-amber-50/50 border-amber-800/25 text-amber-950 hover:bg-amber-50/80"
            disabled={longRestMutation.isPending}
            onClick={() => longRestMutation.mutate()}
          >
            <Moon className="w-3.5 h-3.5 text-amber-700" />
            {longRestMutation.isPending ? "Resting..." : "Long Rest"}
          </Button>
        </Card>

        <Card className="parchment-ruled p-4 space-y-3 bg-amber-50/30 border-amber-800/25 text-amber-950 shadow-none">
          <div className="parchment-label flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-700" />
            Saving Throws
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["str", "dex", "con", "int", "wis", "cha"] as const).map((key) => {
              const save = sheet?.saves[key];
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-lg border p-2 text-center",
                    save?.proficient ? "border-amber-700/40 bg-amber-100/40" : "border-amber-800/20 bg-amber-50/40",
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wide text-amber-900/60">{ABILITY_LABELS[key]}</div>
                  <div className="text-sm font-semibold">{save ? (save.total >= 0 ? `+${save.total}` : save.total) : "—"}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="parchment-ruled p-4 space-y-4 bg-amber-50/30 border-amber-800/25 text-amber-950 shadow-none">
          <div className="flex items-center justify-between gap-2">
            <div className="parchment-label flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-700" />
              Ability Scores
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-amber-900/60">AC</span>
              <span className="parchment-badge">{character.ac}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["str", "dex", "con", "int", "wis", "cha"] as const).map((key) => {
              const score = character[key];
              const mod = modifierFor(score);
              return (
                <div key={key} className="rounded-lg border border-amber-800/20 bg-amber-50/40 p-2 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-amber-900/60">
                    {ABILITY_LABELS[key]}
                  </div>
                  <div className="text-sm font-semibold">{score}</div>
                  <div className="text-xs text-amber-900/60">{mod >= 0 ? `+${mod}` : mod}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="parchment-ruled p-4 space-y-4 bg-amber-50/30 border-amber-800/25 text-amber-950 shadow-none">
          <div className="parchment-label flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-700" />
            Currency
          </div>

          {currencyDisplay.length === 0 ? (
            <div className="text-sm text-amber-900/60">No currency tracked yet.</div>
          ) : (
            <div className="space-y-2">
              {currencyDisplay.map((entry) => (
                <div
                  key={entry.currencyCode}
                  className="flex items-center justify-between rounded-lg border border-amber-800/20 bg-amber-50/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{entry.def?.name || entry.currencyCode}</div>
                    <div className="text-xs text-amber-900/60 truncate">
                      {entry.currencyCode}
                      {entry.def?.isPrimary ? " • primary" : ""}
                    </div>
                  </div>

                  <div className="font-semibold">{formatCurrencyAmount(entry.amount, entry.def)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        </div>
      </ScrollArea>

      <InventoryModal
        open={inventoryOpen}
        onOpenChange={setInventoryOpen}
        items={items}
        onEquip={onEquip}
        onUnequip={onUnequip}
        onUse={onUse}
        onRead={onRead}
      />

      <CodexModal
        open={codexOpen}
        onOpenChange={setCodexOpen}
        traits={character.traits}
        backstory={character.backstory}
        characterData={character.characterData}
        worldState={worldState}
        onSubmitReport={onSubmitReport}
      />

      <CharacterSheetModal
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        characterId={character.id}
        characterName={character.name}
        race={character.race}
        charClass={character.charClass}
        level={character.level}
        ac={character.ac}
        characterData={character.characterData}
      />

      <LevelUpWizard open={levelUpOpen} onOpenChange={setLevelUpOpen} characterId={character.id} />

      <AchievementsPanel open={achievementsOpen} onOpenChange={setAchievementsOpen} />
    </div>
  );
}
