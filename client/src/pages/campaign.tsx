import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { gameWs } from "@/lib/websocket";
import { parseWorldState } from "@shared/world-state";

import CharacterSheetView from "@/components/CharacterSheetView";
import CampaignGameShell from "@/components/game/CampaignGameShell";
import "@/styles/game-shell.css";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Loader2, ShieldAlert, ArrowLeft, UserPlus } from "lucide-react";

type Campaign = {
  id: number;
  name: string;
  inviteCode: string;
  tone: string;
  rulesWeight: string;
  powerLevel: string;
  worldType: string;
  combatStyle: string;
  storyMode: boolean;
  worldGenStyle: string;
  homebrewRules: string;
  customWorldPrompt: string;
  epicMode: boolean;
  animeWorldSource: string;
  animeWorldMode: string;
  worldState: string;
  activeShopId?: number | null;
};

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

type Message = {
  id: number;
  campaignId: number;
  sender: string;
  senderType: "dm" | "player" | "system";
  content: string;
  messageType: string;
  metadata?: string;
  createdAt?: string;
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

type ActiveEffect = {
  id: number;
  characterId: number;
  name: string;
  description: string;
  isDebuff: boolean;
  durationType: string;
  roundsRemaining: number | null;
  concentration: boolean;
};

type CurrencyBalance = {
  id?: number;
  campaignId?: number;
  characterId?: number;
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

type ActiveShop = {
  id: number;
  campaignId: number;
  merchantName: string;
  merchantDescription: string;
  currencyCode: string;
  title: string;
  isOpen: boolean;
  metadata?: string;
};

type ShopItem = {
  id: number;
  shopId: number;
  campaignId: number;
  itemKey: string;
  name: string;
  description: string;
  itemType: string;
  quantityPerPurchase: number;
  stock: number;
  priceAmount: number;
  priceCurrencyCode: string;
  metadata?: string;
};

type ShopResponse = {
  shop: ActiveShop;
  items: ShopItem[];
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

export default function CampaignPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/campaign/:id");
  const campaignId = Number(params?.id);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [actionInput, setActionInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [dmThinking, setDmThinking] = useState(false);
  const [recentLoot, setRecentLoot] = useState<Item | null>(null);
  const recentLootTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Character creation state
  const [name, setName] = useState("");
  const [race, setRace] = useState("");
  const [charClass, setCharClass] = useState("");
  const [traits, setTraits] = useState("");
  const [backstory, setBackstory] = useState("");
  const [level, setLevel] = useState(1);
  const [hp, setHp] = useState(20);
  const [maxHp, setMaxHp] = useState(20);
  const [speed, setSpeed] = useState(30);
  const [attacksPerRound, setAttacksPerRound] = useState(1);
  const [characterData, setCharacterData] = useState<string>(
    JSON.stringify({ sections: [], raw: "" }),
  );
  const [createError, setCreateError] = useState<string | null>(null);

  const qc = useQueryClient();

  const campaignQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: () => api<Campaign>(`/api/campaigns/${campaignId}`),
    enabled: Number.isFinite(campaignId),
    staleTime: 10_000,
  });

  const myCharacterQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "my-character"],
    queryFn: () => api<Character>(`/api/campaigns/${campaignId}/my-character`),
    enabled: Number.isFinite(campaignId),
    retry: false,
  });

  const charactersQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "characters"],
    queryFn: () => api<Character[]>(`/api/campaigns/${campaignId}/characters`),
    enabled: Number.isFinite(campaignId),
  });

  const messagesQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "messages"],
    queryFn: () => api<Message[]>(`/api/campaigns/${campaignId}/messages`),
    enabled: Number.isFinite(campaignId),
    refetchOnWindowFocus: false,
  });

  const currenciesQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "currencies"],
    queryFn: () => api<CampaignCurrency[]>(`/api/campaigns/${campaignId}/currencies`),
    enabled: Number.isFinite(campaignId),
  });

  const itemsQuery = useQuery({
    queryKey: ["/api/characters", myCharacterQuery.data?.id, "items"],
    queryFn: () => api<Item[]>(`/api/characters/${myCharacterQuery.data!.id}/items`),
    enabled: !!myCharacterQuery.data?.id,
  });

  const characterCurrenciesQuery = useQuery({
    queryKey: ["/api/characters", myCharacterQuery.data?.id, "currencies"],
    queryFn: () =>
      api<CurrencyBalance[]>(`/api/characters/${myCharacterQuery.data!.id}/currencies`),
    enabled: !!myCharacterQuery.data?.id,
  });

  const effectsQuery = useQuery({
    queryKey: ["/api/characters", myCharacterQuery.data?.id, "effects"],
    queryFn: () => api<ActiveEffect[]>(`/api/characters/${myCharacterQuery.data!.id}/effects`),
    enabled: !!myCharacterQuery.data?.id,
  });

  const shopQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "shop"],
    queryFn: () => api<ShopResponse>(`/api/campaigns/${campaignId}/shop`),
    enabled: Number.isFinite(campaignId),
    retry: false,
  });

  const createCharacterMutation = useMutation({
    mutationFn: () =>
      api(`/api/campaigns/${campaignId}/characters`, {
        method: "POST",
        body: JSON.stringify({
          name,
          race,
          charClass,
          traits,
          backstory,
          level,
          hp,
          maxHp,
          speed,
          attacksPerRound,
          characterData,
        }),
      }),
    onSuccess: async () => {
      setCreateError(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "characters"] }),
        qc.invalidateQueries({ queryKey: ["/api/characters", myCharacterQuery.data?.id, "items"] }),
        qc.invalidateQueries({
          queryKey: ["/api/characters", myCharacterQuery.data?.id, "currencies"],
        }),
      ]);
    },
    onError: (err: any) => {
      setCreateError(err?.message || "Failed to create character.");
    },
  });

  const startMutation = useMutation({
    mutationFn: () =>
      api(`/api/campaigns/${campaignId}/start`, {
        method: "POST",
      }),
    onMutate: () => setDmThinking(true),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "messages"] }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "shop"] }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] }),
      ]);
    },
    onError: () => setDmThinking(false),
    onSettled: () => setDmThinking(false),
  });

  const actionMutation = useMutation({
    mutationFn: (content: string) =>
      api(`/api/campaigns/${campaignId}/action`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onMutate: () => setDmThinking(true),
    onSuccess: async () => {
      setActionInput("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "messages"] }),
        qc.invalidateQueries({ queryKey: ["/api/characters", myCharacterQuery.data?.id, "items"] }),
        qc.invalidateQueries({
          queryKey: ["/api/characters", myCharacterQuery.data?.id, "currencies"],
        }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "shop"] }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] }),
      ]);
    },
    onError: () => setDmThinking(false),
    onSettled: () => setDmThinking(false),
  });

  const buyMutation = useMutation({
    mutationFn: ({ shopItemId, quantity }: { shopItemId: number; quantity: number }) =>
      api(`/api/campaigns/${campaignId}/shop/buy`, {
        method: "POST",
        body: JSON.stringify({ shopItemId, quantity }),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "shop"] }),
        qc.invalidateQueries({ queryKey: ["/api/characters", myCharacterQuery.data?.id, "items"] }),
        qc.invalidateQueries({
          queryKey: ["/api/characters", myCharacterQuery.data?.id, "currencies"],
        }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "messages"] }),
      ]);
    },
  });

  useEffect(() => {
    if (!campaignId) return;

    gameWs.connect(campaignId);
    setWsConnected(true);

    const unsubscribe = gameWs.subscribe((data: any) => {
      if (!data?.type) return;

      switch (data.type) {
        case "message":
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "messages"] });
          setDmThinking(false);
          break;

        case "dm_thinking":
          setDmThinking(!!data.thinking);
          break;

        case "character_updated":
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] });
          break;

        case "items_updated":
          qc.invalidateQueries({ queryKey: ["/api/characters", myCharacterQuery.data?.id, "items"] });
          break;

        case "item_granted":
          qc.invalidateQueries({ queryKey: ["/api/characters", myCharacterQuery.data?.id, "items"] });
          if (data.item && data.item.characterId === myCharacterQuery.data?.id) {
            if (recentLootTimeoutRef.current) clearTimeout(recentLootTimeoutRef.current);
            setRecentLoot(data.item as Item);
            recentLootTimeoutRef.current = setTimeout(() => setRecentLoot(null), 6000);
          }
          break;

        case "currencies_updated":
          qc.invalidateQueries({
            queryKey: ["/api/characters", myCharacterQuery.data?.id, "currencies"],
          });
          break;

        case "effects_updated":
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] });
          qc.invalidateQueries({ queryKey: ["/api/characters", myCharacterQuery.data?.id, "effects"] });
          break;

        case "shop_updated":
        case "shop_closed":
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "shop"] });
          break;

        case "campaign_updated":
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
          break;

        case "campaign_restored":
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "messages"] });
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "characters"] });
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] });
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "shop"] });
          qc.invalidateQueries({ queryKey: ["/api/characters", myCharacterQuery.data?.id, "items"] });
          qc.invalidateQueries({
            queryKey: ["/api/characters", myCharacterQuery.data?.id, "currencies"],
          });
          break;
      }
    });

    return () => {
      unsubscribe();
      gameWs.disconnect();
      setWsConnected(false);
      if (recentLootTimeoutRef.current) clearTimeout(recentLootTimeoutRef.current);
    };
  }, [campaignId, qc, myCharacterQuery.data?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messagesQuery.data, dmThinking]);

  const campaign = campaignQuery.data;
  const myCharacter = myCharacterQuery.data;
  const messages = messagesQuery.data || [];
  const items = itemsQuery.data || [];
  const currencies = currenciesQuery.data || [];
  const balances = characterCurrenciesQuery.data || [];

  const loading =
    campaignQuery.isLoading ||
    myCharacterQuery.isLoading ||
    charactersQuery.isLoading ||
    messagesQuery.isLoading;

  const noCharacter =
    !myCharacterQuery.isLoading &&
    !myCharacterQuery.data &&
    !!myCharacterQuery.error;

  const startDisabled =
    startMutation.isPending ||
    dmThinking ||
    !myCharacter ||
    messages.some((m) => m.senderType === "dm");

  if (!campaignId || Number.isNaN(campaignId)) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Card className="p-6 text-sm">Invalid campaign.</Card>
      </div>
    );
  }

  if (loading && !noCharacter) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading campaign...
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <Card className="max-w-lg w-full p-6 space-y-4">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            Campaign not found
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (!myCharacter && noCharacter) {
    return (
      <div className="min-h-screen bg-background text-foreground px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <h1 className="text-2xl font-semibold">Create Your Character</h1>
              </div>
              <div className="text-sm text-muted-foreground">
                Campaign: <strong>{campaign.name}</strong>. Build something real, not another vague “property/value” abomination.
              </div>
            </div>

            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>

          {createError && (
            <Card className="p-4 border-red-500/30 bg-red-500/5 text-sm text-red-300">
              {createError}
            </Card>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 space-y-6">
              <Card className="p-5 space-y-4">
                <div className="font-semibold">Core Identity</div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Hennet Uthellien"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground">Race</label>
                    <Input
                      value={race}
                      onChange={(e) => setRace(e.target.value)}
                      placeholder="Wood Elf"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground">Class</label>
                    <Input
                      value={charClass}
                      onChange={(e) => setCharClass(e.target.value)}
                      placeholder="Rogue"
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="font-semibold">Vitals</div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Level</label>
                    <Input
                      type="number"
                      min={1}
                      value={level}
                      onChange={(e) => setLevel(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground">Speed</label>
                    <Input
                      type="number"
                      min={0}
                      value={speed}
                      onChange={(e) => setSpeed(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground">HP</label>
                    <Input
                      type="number"
                      min={0}
                      value={hp}
                      onChange={(e) => setHp(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground">Max HP</label>
                    <Input
                      type="number"
                      min={1}
                      value={maxHp}
                      onChange={(e) => setMaxHp(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-sm text-muted-foreground">Attacks Per Round</label>
                    <Input
                      type="number"
                      min={1}
                      value={attacksPerRound}
                      onChange={(e) =>
                        setAttacksPerRound(Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="font-semibold">Personality & History</div>

                <div>
                  <label className="text-sm text-muted-foreground">Traits</label>
                  <Textarea
                    value={traits}
                    onChange={(e) => setTraits(e.target.value)}
                    rows={4}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Backstory</label>
                  <Textarea
                    value={backstory}
                    onChange={(e) => setBackstory(e.target.value)}
                    rows={6}
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={
                    createCharacterMutation.isPending ||
                    !name.trim() ||
                    !race.trim() ||
                    !charClass.trim()
                  }
                  onClick={() => createCharacterMutation.mutate()}
                >
                  {createCharacterMutation.isPending ? "Creating..." : "Enter the World"}
                </Button>
              </Card>
            </div>

            <div className="xl:col-span-2">
              <CharacterSheetView value={characterData} onChange={setCharacterData} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!myCharacter) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <Card className="max-w-lg w-full p-6 space-y-4">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            Could not load your character
          </div>
          <p className="text-sm text-muted-foreground">
            The campaign loaded, but your character did not. Refresh first. If it still fails,
            something is still out of sync somewhere, which is very software of it.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to dashboard
            </Button>
            <Button
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] });
                qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "characters"] });
              }}
            >
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const party = (charactersQuery.data || []).filter((c) => c.id !== myCharacter.id);

  return (
    <CampaignGameShell
      campaignId={campaignId}
      campaignName={campaign.name}
      worldType={campaign.worldType}
      worldState={parseWorldState(campaign.worldState)}
      character={myCharacter}
      party={party}
      messages={messages}
      items={items}
      effects={effectsQuery.data || []}
      recentLoot={recentLoot}
      campaignCurrencies={currencies}
      balances={balances}
      shop={shopQuery.data?.shop ? shopQuery.data : null}
      connected={wsConnected}
      dmThinking={dmThinking}
      actionInput={actionInput}
      onActionInputChange={setActionInput}
      onSubmitAction={() => actionMutation.mutate(actionInput.trim())}
      actionPending={actionMutation.isPending}
      showBeginAdventure={messages.length === 0}
      onBeginAdventure={() => startMutation.mutate()}
      beginAdventurePending={startMutation.isPending}
      beginAdventureDisabled={startDisabled}
      onBuy={(shopItemId, quantity) => buyMutation.mutate({ shopItemId, quantity })}
      buyPending={buyMutation.isPending}
      onBack={() => navigate("/dashboard")}
      scrollRef={scrollRef}
    />
  );
}
