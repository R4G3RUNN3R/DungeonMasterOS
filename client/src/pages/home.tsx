import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Coins,
  Wand2,
  Globe,
  Swords,
  ScrollText,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type CurrencyDef = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isPrimary: boolean;
  exchangeRate: number;
};

type CreateCampaignPayload = {
  name: string;
  tone: "dark" | "heroic" | "comedic" | "realistic";
  rulesWeight: "light" | "medium" | "crunchy";
  powerLevel: "low" | "standard" | "high" | "godtier";
  worldType: "custom" | "faerun" | "original";
  combatStyle: "cinematic" | "tactical" | "dice";
  storyMode: boolean;
  worldGenStyle: "standard" | "isekai" | "portal" | "reincarnation" | "dreamfall";
  homebrewRules: string;
  customWorldPrompt: string;
  epicMode: boolean;
  animeWorldSource: string;
  animeWorldMode: "none" | "inspired" | "canonical";
  currencies: Array<{
    code: string;
    name: string;
    symbol: string;
    isPrimary: boolean;
    exchangeRate: number;
  }>;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.message || parsed.error || text;
    } catch {}
    throw new Error(message || `Request failed: ${res.status}`);
  }

  return res.json();
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultCurrenciesForPreset(worldType: string, worldGenStyle: string): CurrencyDef[] {
  const lowerWorld = worldType.toLowerCase();
  const lowerGen = worldGenStyle.toLowerCase();

  if (lowerGen === "isekai" || lowerWorld === "custom") {
    return [
      {
        id: uid(),
        code: "gold",
        name: "Gold",
        symbol: "g",
        isPrimary: true,
        exchangeRate: 1,
      },
    ];
  }

  if (lowerWorld === "faerun") {
    return [
      {
        id: uid(),
        code: "gold",
        name: "Gold",
        symbol: "gp",
        isPrimary: true,
        exchangeRate: 1,
      },
      {
        id: uid(),
        code: "silver",
        name: "Silver",
        symbol: "sp",
        isPrimary: false,
        exchangeRate: 10,
      },
      {
        id: uid(),
        code: "copper",
        name: "Copper",
        symbol: "cp",
        isPrimary: false,
        exchangeRate: 100,
      },
    ];
  }

  return [
    {
      id: uid(),
      code: "gold",
      name: "Gold",
      symbol: "g",
      isPrimary: true,
      exchangeRate: 1,
    },
  ];
}

export default function HomePage() {
  const [, navigate] = useLocation();

  const [name, setName] = useState("");
  const [tone, setTone] = useState<"dark" | "heroic" | "comedic" | "realistic">("heroic");
  const [rulesWeight, setRulesWeight] = useState<"light" | "medium" | "crunchy">("medium");
  const [powerLevel, setPowerLevel] = useState<"low" | "standard" | "high" | "godtier">("standard");
  const [worldType, setWorldType] = useState<"custom" | "faerun" | "original">("original");
  const [combatStyle, setCombatStyle] = useState<"cinematic" | "tactical" | "dice">("cinematic");
  const [storyMode, setStoryMode] = useState(false);
  const [worldGenStyle, setWorldGenStyle] = useState<"standard" | "isekai" | "portal" | "reincarnation" | "dreamfall">("standard");
  const [homebrewRules, setHomebrewRules] = useState("");
  const [customWorldPrompt, setCustomWorldPrompt] = useState("");
  const [epicMode, setEpicMode] = useState(false);
  const [animeWorldSource, setAnimeWorldSource] = useState("");
  const [animeWorldMode, setAnimeWorldMode] = useState<"none" | "inspired" | "canonical">("none");
  const [currencies, setCurrencies] = useState<CurrencyDef[]>(
    defaultCurrenciesForPreset("original", "standard"),
  );
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: CreateCampaignPayload) =>
      api<{ id: number }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (campaign) => {
      navigate(`/campaign/${campaign.id}`);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to create campaign.");
    },
  });

  const primaryCount = useMemo(
    () => currencies.filter((c) => c.isPrimary).length,
    [currencies],
  );

  function updateCurrency(id: string, patch: Partial<CurrencyDef>) {
    setCurrencies((prev) =>
      prev.map((currency) =>
        currency.id === id ? { ...currency, ...patch } : currency,
      ),
    );
  }

  function addCurrency() {
    setCurrencies((prev) => [
      ...prev,
      {
        id: uid(),
        code: "",
        name: "",
        symbol: "",
        isPrimary: prev.length === 0,
        exchangeRate: 1,
      },
    ]);
  }

  function removeCurrency(id: string) {
    setCurrencies((prev) => {
      const next = prev.filter((currency) => currency.id !== id);
      if (next.length > 0 && !next.some((c) => c.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  }

  function setPrimaryCurrency(id: string) {
    setCurrencies((prev) =>
      prev.map((currency) => ({
        ...currency,
        isPrimary: currency.id === id,
      })),
    );
  }

  function applyCurrencyPreset() {
    setCurrencies(defaultCurrenciesForPreset(worldType, worldGenStyle));
  }

  function submit() {
    setError(null);

    if (!name.trim()) {
      setError("Campaign name is required.");
      return;
    }

    const cleanedCurrencies = currencies
      .map((currency) => ({
        code: currency.code.trim().toLowerCase(),
        name: currency.name.trim(),
        symbol: currency.symbol.trim(),
        isPrimary: currency.isPrimary,
        exchangeRate: Number(currency.exchangeRate) || 1,
      }))
      .filter((currency) => currency.code && currency.name);

    if (cleanedCurrencies.length === 0) {
      setError("At least one currency is required.");
      return;
    }

    if (!cleanedCurrencies.some((c) => c.isPrimary)) {
      cleanedCurrencies[0].isPrimary = true;
    }

    const payload: CreateCampaignPayload = {
      name: name.trim(),
      tone,
      rulesWeight,
      powerLevel,
      worldType,
      combatStyle,
      storyMode,
      worldGenStyle,
      homebrewRules,
      customWorldPrompt,
      epicMode,
      animeWorldSource,
      animeWorldMode,
      currencies: cleanedCurrencies,
    };

    createMutation.mutate(payload);
  }

  const optionClass =
    "rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40 transition-colors";
  const selectedClass = "border-primary bg-primary/5";

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="text-3xl font-bold">Create Campaign</div>
          <div className="text-muted-foreground">
            Build the world first, then let the chaos begin in an organized way for once.
          </div>
        </div>

        {error && (
          <Card className="p-4 border-red-500/30 bg-red-500/5 text-sm text-red-300">
            {error}
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 font-semibold">
                <Globe className="h-4 w-4 text-primary" />
                Core Campaign Setup
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm text-muted-foreground">Campaign Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="The Ashen Crown, East Blue Rising, Neon Winter..."
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="dark">Dark</option>
                    <option value="heroic">Heroic</option>
                    <option value="comedic">Comedic</option>
                    <option value="realistic">Realistic</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Rules Weight</label>
                  <select
                    value={rulesWeight}
                    onChange={(e) => setRulesWeight(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="crunchy">Crunchy</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Power Level</label>
                  <select
                    value={powerLevel}
                    onChange={(e) => setPowerLevel(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="standard">Standard</option>
                    <option value="high">High</option>
                    <option value="godtier">God-tier</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">World Type</label>
                  <select
                    value={worldType}
                    onChange={(e) => setWorldType(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="original">Original</option>
                    <option value="faerun">Faerûn-like</option>
                    <option value="custom">Custom Seed</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 font-semibold">
                <Swords className="h-4 w-4 text-primary" />
                Playstyle
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { value: "cinematic", label: "Cinematic" },
                  { value: "tactical", label: "Tactical" },
                  { value: "dice", label: "Full Dice" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCombatStyle(option.value as any)}
                    className={`${optionClass} ${combatStyle === option.value ? selectedClass : ""}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={storyMode ? "default" : "outline"}
                  onClick={() => setStoryMode((v) => !v)}
                >
                  <ScrollText className="h-4 w-4 mr-2" />
                  Story Mode {storyMode ? "On" : "Off"}
                </Button>

                <Button
                  type="button"
                  variant={epicMode ? "default" : "outline"}
                  onClick={() => setEpicMode((v) => !v)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Epic Mode {epicMode ? "On" : "Off"}
                </Button>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 font-semibold">
                <Wand2 className="h-4 w-4 text-primary" />
                World Framing
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">World Generation Style</label>
                  <select
                    value={worldGenStyle}
                    onChange={(e) => setWorldGenStyle(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="standard">Standard</option>
                    <option value="isekai">Isekai</option>
                    <option value="portal">Portal Fantasy</option>
                    <option value="reincarnation">Reincarnation</option>
                    <option value="dreamfall">Dreamfall</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Anime World Mode</label>
                  <select
                    value={animeWorldMode}
                    onChange={(e) => setAnimeWorldMode(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="none">None</option>
                    <option value="inspired">Inspired</option>
                    <option value="canonical">Canonical</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm text-muted-foreground">Anime / Franchise Source</label>
                  <Input
                    value={animeWorldSource}
                    onChange={(e) => setAnimeWorldSource(e.target.value)}
                    placeholder="One Piece, Naruto, Bleach, Cyberpunk, Modern London..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm text-muted-foreground">Custom World Prompt</label>
                  <Textarea
                    value={customWorldPrompt}
                    onChange={(e) => setCustomWorldPrompt(e.target.value)}
                    placeholder="Describe the world seed, assumptions, atmosphere, political situation, themes..."
                    rows={5}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm text-muted-foreground">Homebrew Rules</label>
                  <Textarea
                    value={homebrewRules}
                    onChange={(e) => setHomebrewRules(e.target.value)}
                    placeholder="Any custom mechanics, hard bans, progression rules, inventory logic, social rules, death rules..."
                    rows={5}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 font-semibold">
                  <Coins className="h-4 w-4 text-primary" />
                  Campaign Currencies
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={applyCurrencyPreset}>
                    Apply Preset
                  </Button>
                  <Button type="button" onClick={addCurrency}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Currency
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Define the actual money used in this campaign. Euros, Dollars, Beri, Gold, Sovereigns, Credits, whatever. Humanity invented enough bad economies already, so the app may as well support them.
              </div>

              <div className="space-y-4">
                {currencies.map((currency) => (
                  <Card key={currency.id} className="p-4 space-y-4 bg-card/40">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant={currency.isPrimary ? "default" : "outline"}>
                          {currency.isPrimary ? "Primary" : "Secondary"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Exchange rate uses the primary currency as baseline.
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {!currency.isPrimary && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPrimaryCurrency(currency.id)}
                          >
                            Set Primary
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeCurrency(currency.id)}
                          disabled={currencies.length === 1}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-sm text-muted-foreground">Code</label>
                        <Input
                          value={currency.code}
                          onChange={(e) =>
                            updateCurrency(currency.id, { code: e.target.value })
                          }
                          placeholder="usd, beri, gold"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-muted-foreground">Name</label>
                        <Input
                          value={currency.name}
                          onChange={(e) =>
                            updateCurrency(currency.id, { name: e.target.value })
                          }
                          placeholder="US Dollar, Beri, Gold"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-muted-foreground">Symbol</label>
                        <Input
                          value={currency.symbol}
                          onChange={(e) =>
                            updateCurrency(currency.id, { symbol: e.target.value })
                          }
                          placeholder="$, gp, ฿"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-muted-foreground">
                          Exchange Rate
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={currency.exchangeRate}
                          onChange={(e) =>
                            updateCurrency(currency.id, {
                              exchangeRate: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                Primary currencies selected: {primaryCount}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-5 space-y-4">
              <div className="font-semibold">Summary</div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Name</span>
                  <span className="text-right font-medium">{name || "Untitled"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Tone</span>
                  <span className="font-medium">{tone}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Combat</span>
                  <span className="font-medium">{combatStyle}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">World</span>
                  <span className="font-medium">{worldType}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Currencies</span>
                  <span className="font-medium">{currencies.length}</span>
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="font-semibold">Preview Currency Set</div>

              <div className="space-y-2">
                {currencies.map((currency) => (
                  <div
                    key={currency.id}
                    className="rounded-lg border border-border px-3 py-2 text-sm flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-medium">
                        {currency.name || "Unnamed"}{" "}
                        <span className="text-muted-foreground">
                          ({currency.code || "no-code"})
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Symbol: {currency.symbol || "none"} • Rate: {currency.exchangeRate}
                      </div>
                    </div>

                    {currency.isPrimary && <Badge>Primary</Badge>}
                  </div>
                ))}
              </div>
            </Card>

            <Button
              className="w-full h-12"
              onClick={submit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
