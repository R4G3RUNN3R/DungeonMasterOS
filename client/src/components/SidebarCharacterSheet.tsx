import { useMemo } from "react";
import {
  Heart,
  Shield,
  Zap,
  Coins,
  Backpack,
  Sparkles,
  Sword,
  Castle,
  Car,
  Ship,
  Wrench,
  ScrollText,
  Link as LinkIcon,
  UserRound,
  PawPrint,
  Package,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
};

type ParsedSection = {
  label: string;
  type?: string;
  entries?: Array<{
    key?: string;
    name?: string;
    value?: string;
    description?: string;
    quantity?: number;
    equipped?: boolean;
  }>;
};

function safeParseCharacterData(raw: string): { sections: ParsedSection[] } {
  try {
    const parsed = JSON.parse(raw || "{}");
    return {
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    };
  } catch {
    return { sections: [] };
  }
}

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
  const groups = new Map<
    string,
    {
      label: string;
      icon: any;
      items: Item[];
    }
  >();

  for (const item of items) {
    const meta = getItemTypeMeta(item.itemType);
    if (!groups.has(meta.label)) {
      groups.set(meta.label, {
        label: meta.label,
        icon: meta.icon,
        items: [],
      });
    }
    groups.get(meta.label)!.items.push(item);
  }

  return Array.from(groups.values());
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
}: Props) {
  const hpPercent =
    character.maxHp > 0
      ? Math.max(0, Math.min(100, Math.round((character.hp / character.maxHp) * 100)))
      : 0;

  const parsedCharacterData = useMemo(
    () => safeParseCharacterData(character.characterData),
    [character.characterData],
  );

  const groupedItems = useMemo(() => groupItems(items), [items]);

  const grantedAbilitiesSection = useMemo(() => {
    return parsedCharacterData.sections.find(
      (section) =>
        String(section.label || "").toLowerCase() === "granted abilities" ||
        String(section.type || "").toLowerCase() === "abilities",
    );
  }, [parsedCharacterData]);

  const currencyDisplay = useMemo(() => {
    return currencies
      .map((balance) => {
        const def = campaignCurrencies.find((c) => c.code === balance.currencyCode);
        return {
          ...balance,
          def,
        };
      })
      .sort((a, b) => {
        const aPrimary = a.def?.isPrimary ? 1 : 0;
        const bPrimary = b.def?.isPrimary ? 1 : 0;
        return bPrimary - aPrimary || a.currencyCode.localeCompare(b.currencyCode);
      });
  }, [currencies, campaignCurrencies]);

  return (
    <div className="h-full flex flex-col bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.05),_transparent_35%)]">
      <div className="border-b border-border px-5 py-4 bg-background/90 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-xl font-semibold leading-tight truncate">{character.name}</div>
            <div className="text-sm text-muted-foreground truncate">
              {character.race} • {character.charClass}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary">Lv {character.level}</Badge>
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                connected ? "text-emerald-600 border-emerald-500/30" : "text-yellow-600 border-yellow-500/30",
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
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 font-medium">
              <Heart className="w-4 h-4 text-rose-500" />
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
              <Progress value={hpPercent} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <div className="text-muted-foreground text-xs mb-1">Speed</div>
                <div className="font-medium flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  {character.speed}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="text-muted-foreground text-xs mb-1">Attacks / Round</div>
                <div className="font-medium flex items-center gap-2">
                  <Sword className="w-3.5 h-3.5 text-primary" />
                  {character.attacksPerRound}
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Status: <span className="font-medium text-foreground">{character.status}</span>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 font-medium">
              <Coins className="w-4 h-4 text-amber-500" />
              Currency
            </div>

            {currencyDisplay.length === 0 ? (
              <div className="text-sm text-muted-foreground">No currency tracked yet.</div>
            ) : (
              <div className="space-y-2">
                {currencyDisplay.map((entry) => (
                  <div
                    key={entry.currencyCode}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {entry.def?.name || entry.currencyCode}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {entry.currencyCode}
                        {entry.def?.isPrimary ? " • primary" : ""}
                      </div>
                    </div>

                    <div className="font-semibold">
                      {formatCurrencyAmount(entry.amount, entry.def)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 font-medium">
              <Backpack className="w-4 h-4 text-primary" />
              Inventory & Possessions
            </div>

            {groupedItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nothing tracked yet. Once the DM actually awards or you buy something, it should appear here instead of evaporating into decorative prose.
              </div>
            ) : (
              <div className="space-y-4">
                {groupedItems.map((group) => {
                  const Icon = group.icon;
                  return (
                    <div key={group.label} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        {group.label}
                      </div>

                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-border px-3 py-2 text-sm"
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
          </Card>

          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 text-violet-500" />
              Abilities & Features
            </div>

            {grantedAbilitiesSection?.entries?.length ? (
              <div className="space-y-2">
                {grantedAbilitiesSection.entries.map((entry, idx) => (
                  <div
                    key={`${entry.key || entry.name || "ability"}-${idx}`}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div className="font-medium">
                      {entry.name || entry.key || "Ability"}
                    </div>
                    {(entry.description || entry.value) && (
                      <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                        {entry.description || entry.value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No tracked granted abilities yet.
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <div className="font-medium">Traits</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {character.traits?.trim() || "No traits entered."}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="font-medium">Backstory</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {character.backstory?.trim() || "No backstory entered."}
            </div>
          </Card>

          {parsedCharacterData.sections
            .filter((section) => {
              const label = String(section.label || "").toLowerCase();
              return (
                label !== "granted abilities" &&
                label !== "currency" &&
                label !== "inventory" &&
                label !== "items"
              );
            })
            .map((section, sectionIndex) => (
              <Card key={`${section.label}-${sectionIndex}`} className="p-4 space-y-3">
                <div className="font-medium">{section.label || "Section"}</div>

                {section.entries?.length ? (
                  <div className="space-y-2">
                    {section.entries.map((entry, entryIndex) => (
                      <div
                        key={`${entry.key || entry.name || "entry"}-${entryIndex}`}
                        className="rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <div className="font-medium">
                          {entry.name || entry.key || "Entry"}
                        </div>
                        {(entry.description || entry.value) && (
                          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {entry.description || entry.value}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No entries.</div>
                )}
              </Card>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}
