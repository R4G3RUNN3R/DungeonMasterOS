import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { gameWs } from "@/lib/websocket";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/appBase";
import logoImg from "@assets/logo.png";

import SidebarCharacterSheet from "@/components/SidebarCharacterSheet";
import ShopPanel from "@/components/ShopPanel";
import CharacterSheetView from "@/components/CharacterSheetView";

import { classesForRuleset, SKILL_ABILITY, startingSkillCount, startingFeatSlots } from "@shared/classes";
import { racesForRuleset, getRace, applyRacialAdjustments } from "@shared/races";
import { toast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Loader2,
  Send,
  ScrollText,
  Coins,
  Sparkles,
  Sword,
  ShieldAlert,
  Store,
  ArrowLeft,
  UserPlus,
  Dices,
} from "lucide-react";

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
type AbilityKey = (typeof ABILITY_KEYS)[number];
const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

function rollFourD6DropLowest(): number {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6));
  dice.sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

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
  ruleset: string;
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
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  ac: number;
  xp: number;
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
  slot: string | null;
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
  const res = await fetch(apiUrl(url), {
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

function renderMessageContent(content: string) {
  const parts = content.split(/\n/g);
  return parts.map((line, index) => (
    <p key={index} className="whitespace-pre-wrap leading-relaxed">
      {line}
    </p>
  ));
}

export default function CampaignPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/campaign/:id");
  const campaignId = Number(params?.id);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [actionInput, setActionInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [dmThinking, setDmThinking] = useState(false);
  const [shopOpen, setShopOpen] = useState(true);

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

  // Ability score rolling — 4d6 drop lowest, six times, freely assignable.
  const [rolledPool, setRolledPool] = useState<number[]>([]);
  const [abilityAssignment, setAbilityAssignment] = useState<Record<AbilityKey, number>>({
    str: 0,
    dex: 1,
    con: 2,
    int: 3,
    wis: 4,
    cha: 5,
  });

  // Alternative to rolling: standard point buy, base 8 in every ability.
  const [statMethod, setStatMethod] = useState<"roll" | "pointbuy">("roll");
  const [pointBuyScores, setPointBuyScores] = useState<Record<AbilityKey, number>>({
    str: 8,
    dex: 8,
    con: 8,
    int: 8,
    wis: 8,
    cha: 8,
  });
  const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

  const [multiclass, setMulticlass] = useState(false);
  const [secondClass, setSecondClass] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [feats, setFeats] = useState<string[]>([]);

  function rollStats() {
    setRolledPool(Array.from({ length: 6 }, rollFourD6DropLowest));
    setAbilityAssignment({ str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 });
  }

  function assignAbility(ability: AbilityKey, poolIndex: number) {
    setAbilityAssignment((prev) => {
      const next = { ...prev };
      const swapWith = (Object.keys(next) as AbilityKey[]).find(
        (key) => next[key] === poolIndex,
      );
      if (swapWith && swapWith !== ability) {
        next[swapWith] = prev[ability];
      }
      next[ability] = poolIndex;
      return next;
    });
  }

  function pointBuySpent(scores: Record<AbilityKey, number>): number {
    return ABILITY_KEYS.reduce((sum, key) => sum + (POINT_BUY_COST[scores[key]] ?? 0), 0);
  }

  function adjustPointBuy(ability: AbilityKey, delta: number) {
    setPointBuyScores((prev) => {
      const next = Math.min(15, Math.max(8, prev[ability] + delta));
      if (next === prev[ability]) return prev;
      const candidate = { ...prev, [ability]: next };
      return pointBuySpent(candidate) <= pointBuyBudget ? candidate : prev;
    });
  }

  function toggleSkill(skill: string, cap: number) {
    setSelectedSkills((prev) => {
      if (prev.includes(skill)) return prev.filter((s) => s !== skill);
      if (prev.length >= cap) return prev;
      return [...prev, skill];
    });
  }

  const abilityScores: Record<AbilityKey, number> =
    statMethod === "pointbuy"
      ? pointBuyScores
      : rolledPool.length === 6
        ? (Object.fromEntries(
            ABILITY_KEYS.map((key) => [key, rolledPool[abilityAssignment[key]]]),
          ) as Record<AbilityKey, number>)
        : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

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

  const shopQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "shop"],
    queryFn: () => api<ShopResponse>(`/api/campaigns/${campaignId}/shop`),
    enabled: Number.isFinite(campaignId),
    retry: false,
  });

  const createCharacterMutation = useMutation({
    mutationFn: () => {
      let finalCharClass = charClass;
      if (multiclass && secondClass) {
        const levelA = Math.ceil(level / 2);
        const levelB = level - levelA;
        finalCharClass = `${charClass} ${levelA} / ${secondClass} ${levelB}`;
      }
      return api(`/api/campaigns/${campaignId}/characters`, {
        method: "POST",
        body: JSON.stringify({
          name,
          race,
          charClass: finalCharClass,
          traits,
          backstory,
          level,
          hp,
          maxHp,
          speed,
          attacksPerRound,
          characterData,
          proficiencies: selectedSkills,
          feats: feats.map((f) => f.trim()).filter(Boolean),
          ...adjustedAbilityScores,
        }),
      });
    },
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
    onMutate: () => {
      setActionInput("");
      setDmThinking(true);
    },
    onSuccess: async () => {
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
    onError: (_err, content) => {
      setDmThinking(false);
      setActionInput(content);
    },
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

  const equipMutation = useMutation({
    mutationFn: ({
      itemId,
      equipped,
      slot,
    }: {
      itemId: number;
      equipped: boolean;
      slot: string | null;
    }) =>
      api(`/api/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ equipped, slot }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["/api/characters", myCharacterQuery.data?.id, "items"] }),
  });

  function handleEquip(itemId: number, slot: string) {
    const conflicting = items.find(
      (it) => it.equipped && it.slot === slot && it.id !== itemId,
    );
    if (conflicting) {
      equipMutation.mutate({ itemId: conflicting.id, equipped: false, slot: null });
    }
    equipMutation.mutate({ itemId, equipped: true, slot });
  }

  function handleUnequip(itemId: number) {
    equipMutation.mutate({ itemId, equipped: false, slot: null });
  }

  const useItemMutation = useMutation({
    mutationFn: (itemId: number) => api(`/api/items/${itemId}/use`, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/characters", myCharacterQuery.data?.id, "items"] }),
        qc.invalidateQueries({
          queryKey: ["/api/characters", myCharacterQuery.data?.id, "currencies"],
        }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "messages"] }),
        qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] }),
      ]);
    },
  });

  async function handleUseItem(itemId: number) {
    await useItemMutation.mutateAsync(itemId);
  }

  async function handleReadItem(itemId: number): Promise<string> {
    const res = await api<{ content: string }>(`/api/items/${itemId}/read`, { method: "POST" });
    return res.content;
  }

  const reportBugMutation = useMutation({
    mutationFn: (description: string) =>
      api("/api/bug-reports", {
        method: "POST",
        body: JSON.stringify({ description, campaignId }),
      }),
  });

  async function handleSubmitReport(description: string) {
    await reportBugMutation.mutateAsync(description);
  }

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
        case "item_granted":
          qc.invalidateQueries({ queryKey: ["/api/characters", myCharacterQuery.data?.id, "items"] });
          break;

        case "currencies_updated":
          qc.invalidateQueries({
            queryKey: ["/api/characters", myCharacterQuery.data?.id, "currencies"],
          });
          break;

        case "effects_updated":
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] });
          break;

        case "shop_updated":
        case "shop_closed":
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "shop"] });
          break;

        case "campaign_updated":
          qc.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
          break;

        case "achievement_unlocked": {
          // Broadcast campaign-wide (a party sees each other's unlocks, like
          // any co-op game) — so this toast never claims turns landed in
          // *this* viewer's account specifically, only that the deed happened.
          qc.invalidateQueries({ queryKey: ["/api/achievements"] });
          const achievement = data.achievement;
          toast({
            title: `${achievement?.icon ?? "🏆"} ${achievement?.name ?? "Achievement Unlocked"}`,
            description: achievement?.description,
          });
          break;
        }

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
    };
  }, [campaignId, qc, myCharacterQuery.data?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messagesQuery.data, dmThinking]);

  const campaign = campaignQuery.data;
  const pointBuyBudget = campaign?.ruleset === "dnd35e" ? 28 : 27;

  // Race is only a real, registry-backed selection for 3.5e so far (Canon-doc
  // Phase 1 scope) — other rulesets keep the free-text field and never touch
  // this. adjustedAbilityScores is what actually gets submitted: the raw
  // rolled/point-bought scores stay untouched in the interactive UI above,
  // racial adjustments are applied only at this derived layer.
  const selectedRace = campaign?.ruleset === "dnd35e" ? getRace("dnd35e", race) : undefined;
  const adjustedAbilityScores = applyRacialAdjustments(abilityScores, selectedRace);

  const skillCount = startingSkillCount(campaign?.ruleset || "dnd5e", charClass, abilityModifier(adjustedAbilityScores.int));
  const requiredFeatSlots = startingFeatSlots(campaign?.ruleset || "dnd5e", level);
  const statsReady =
    statMethod === "roll" ? rolledPool.length === 6 : pointBuySpent(pointBuyScores) === pointBuyBudget;
  const raceRequired = campaign?.ruleset === "dnd35e";
  const createDisabled =
    createCharacterMutation.isPending ||
    !name.trim() ||
    !race.trim() ||
    (raceRequired && !selectedRace) ||
    !charClass.trim() ||
    !statsReady ||
    selectedSkills.length !== skillCount ||
    feats.slice(0, requiredFeatSlots).length < requiredFeatSlots ||
    feats.slice(0, requiredFeatSlots).some((f) => !f.trim()) ||
    (multiclass && (!secondClass || secondClass === charClass));

  // Auto-fill Speed from the selected race's base speed (still editable
  // below — this just seeds a sensible default instead of leaving whatever
  // was there before, e.g. after switching from Human to Halfling).
  useEffect(() => {
    if (selectedRace) setSpeed(selectedRace.speed);
  }, [selectedRace?.id]);

  // Pre-populate the mandatory feat slots (grows with class level for 3.5e)
  // so the required inputs are actually on screen, not just counted.
  useEffect(() => {
    setFeats((prev) => (prev.length < requiredFeatSlots ? [...prev, ...Array(requiredFeatSlots - prev.length).fill("")] : prev));
  }, [requiredFeatSlots]);

  // Reset skill selection whenever the trainable count changes (class/INT
  // change) so a stale over-cap selection can't silently linger.
  useEffect(() => {
    setSelectedSkills((prev) => (prev.length > skillCount ? prev.slice(0, skillCount) : prev));
  }, [skillCount]);

  const myCharacter = myCharacterQuery.data;
  const messages = messagesQuery.data || [];
  const items = itemsQuery.data || [];
  const currencies = currenciesQuery.data || [];
  const balances = characterCurrenciesQuery.data || [];

  const shopVisible = !!shopQuery.data?.shop && shopOpen;

  const primaryCurrency = useMemo(() => {
    if (!currencies.length) return null;
    return currencies.find((c) => c.isPrimary) || currencies[0];
  }, [currencies]);

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
                    {campaign.ruleset === "dnd35e" ? (
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={race}
                        onChange={(e) => setRace(e.target.value)}
                      >
                        <option value="">Choose a race...</option>
                        {racesForRuleset(campaign.ruleset).map((r) => (
                          <option key={r.id} value={r.displayName}>
                            {r.displayName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={race}
                        onChange={(e) => setRace(e.target.value)}
                        placeholder="Wood Elf"
                      />
                    )}
                    {selectedRace && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div>
                          {Object.keys(selectedRace.abilityAdjustments).length > 0
                            ? Object.entries(selectedRace.abilityAdjustments)
                                .map(([ab, delta]) => `${ab.toUpperCase()} ${delta! > 0 ? "+" : ""}${delta}`)
                                .join(", ")
                            : "No ability adjustments"}
                          {" · "}
                          {selectedRace.size === "small" ? "Small" : "Medium"} · {selectedRace.speed} ft speed
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground">Class</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={charClass}
                      onChange={(e) => setCharClass(e.target.value)}
                    >
                      <option value="">Choose a class...</option>
                      {classesForRuleset(campaign.ruleset).map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={multiclass}
                        disabled={level < 2}
                        onChange={(e) => {
                          setMulticlass(e.target.checked);
                          if (!e.target.checked) setSecondClass("");
                        }}
                      />
                      Multiclass{level < 2 && " (requires starting level 2+)"}
                    </label>
                    {multiclass && (
                      <select
                        className="w-full h-9 mt-2 rounded-md border border-input bg-background px-2 text-sm"
                        value={secondClass}
                        onChange={(e) => setSecondClass(e.target.value)}
                      >
                        <option value="">Choose a second class...</option>
                        {classesForRuleset(campaign.ruleset)
                          .filter((cls) => cls !== charClass)
                          .map((cls) => (
                            <option key={cls} value={cls}>
                              {cls}
                            </option>
                          ))}
                      </select>
                    )}
                    {multiclass && secondClass && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Splits your {level} starting levels: {Math.ceil(level / 2)} {charClass || "(class)"} /{" "}
                        {level - Math.ceil(level / 2)} {secondClass}.
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">Ability Scores</div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={statMethod === "roll" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatMethod("roll")}
                    >
                      Roll
                    </Button>
                    <Button
                      type="button"
                      variant={statMethod === "pointbuy" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatMethod("pointbuy")}
                    >
                      Point Buy
                    </Button>
                  </div>
                </div>

                {statMethod === "roll" ? (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={rollStats}>
                      <Dices className="w-4 h-4 mr-2" />
                      {rolledPool.length === 6 ? "Reroll" : "Roll Stats"}
                    </Button>

                    {rolledPool.length === 6 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {ABILITY_KEYS.map((key) => {
                          const score = rolledPool[abilityAssignment[key]];
                          const mod = abilityModifier(score);
                          return (
                            <div key={key}>
                              <label className="text-sm text-muted-foreground">
                                {ABILITY_LABELS[key]}
                              </label>
                              <div className="flex items-center gap-2">
                                <select
                                  className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
                                  value={abilityAssignment[key]}
                                  onChange={(e) => assignAbility(key, Number(e.target.value))}
                                >
                                  {rolledPool.map((value, idx) => (
                                    <option key={idx} value={idx}>
                                      {value}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-sm text-muted-foreground w-8 text-right">
                                  {mod >= 0 ? `+${mod}` : mod}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Roll 4d6 (drop the lowest) six times, then assign the results to
                        whichever abilities you like. Reroll as many times as you want
                        before entering the world.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground">
                      {pointBuyBudget - pointBuySpent(pointBuyScores)} of {pointBuyBudget} points
                      remaining. Every ability starts at 8.
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {ABILITY_KEYS.map((key) => {
                        const score = pointBuyScores[key];
                        const mod = abilityModifier(score);
                        return (
                          <div key={key}>
                            <label className="text-sm text-muted-foreground">
                              {ABILITY_LABELS[key]}
                            </label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => adjustPointBuy(key, -1)}
                                disabled={score <= 8}
                              >
                                -
                              </Button>
                              <span className="w-8 text-center text-sm">{score}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => adjustPointBuy(key, 1)}
                                disabled={score >= 15}
                              >
                                +
                              </Button>
                              <span className="text-sm text-muted-foreground w-8 text-right">
                                {mod >= 0 ? `+${mod}` : mod}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </Card>

              {selectedRace && (
                <Card className="p-5 space-y-3">
                  <div className="font-semibold">Final Ability Scores</div>
                  <div className="text-xs text-muted-foreground">
                    Rolled/point-bought scores plus {selectedRace.displayName} racial adjustments.
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {ABILITY_KEYS.map((key) => {
                      const base = abilityScores[key];
                      const final = adjustedAbilityScores[key];
                      const mod = abilityModifier(final);
                      return (
                        <div key={key} className="rounded-lg border border-input p-2 text-center">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {ABILITY_LABELS[key].slice(0, 3)}
                          </div>
                          <div className="text-sm font-semibold">
                            {final}
                            {final !== base && (
                              <span className="text-muted-foreground font-normal">
                                {" "}({base} {final > base ? "+" : ""}{final - base})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{mod >= 0 ? `+${mod}` : mod}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">Trained Skills</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedSkills.length} / {skillCount} selected
                  </div>
                </div>
                {!charClass ? (
                  <div className="text-sm text-muted-foreground">Choose a class first.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(SKILL_ABILITY).map(([skill, ability]) => (
                      <label key={skill} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedSkills.includes(skill)}
                          onChange={() => toggleSkill(skill, skillCount)}
                          disabled={!selectedSkills.includes(skill) && selectedSkills.length >= skillCount}
                        />
                        {skill}{" "}
                        <span className="text-muted-foreground">({ABILITY_LABELS[ability].slice(0, 3)})</span>
                      </label>
                    ))}
                  </div>
                )}
              </Card>

              {requiredFeatSlots > 0 || feats.length > 0 ? (
                <Card className="p-5 space-y-4">
                  <div className="font-semibold">
                    Feats{requiredFeatSlots > 0 && ` (${requiredFeatSlots} required)`}
                  </div>
                  <div className="space-y-2">
                    {feats.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={feat}
                          onChange={(e) =>
                            setFeats((prev) => prev.map((f, i) => (i === idx ? e.target.value : f)))
                          }
                          placeholder={idx < requiredFeatSlots ? "Required feat" : "Optional feat"}
                        />
                        {idx >= requiredFeatSlots && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFeats((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFeats((prev) => [...prev, ""])}
                  >
                    Add feat
                  </Button>
                </Card>
              ) : (
                <Card className="p-5 space-y-3">
                  <div className="font-semibold">Feats</div>
                  <div className="text-sm text-muted-foreground">
                    No feats at character creation for this ruleset. You'll pick feats as you level up.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFeats((prev) => [...prev, ""])}
                  >
                    Add a starting feat anyway
                  </Button>
                </Card>
              )}

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
                  disabled={createDisabled}
                  onClick={() => createCharacterMutation.mutate()}
                >
                  {createCharacterMutation.isPending ? "Creating..." : "Enter the World"}
                </Button>
                {!createDisabled ? null : (
                  <div className="text-xs text-muted-foreground">
                    {!statsReady && "Finish rolling or point-buying your ability scores. "}
                    {selectedSkills.length !== skillCount &&
                      `Select exactly ${skillCount} trained skill${skillCount === 1 ? "" : "s"}. `}
                    {feats.slice(0, requiredFeatSlots).some((f) => !f.trim()) &&
                      "Fill in all required feats. "}
                    {multiclass &&
                      (!secondClass || secondClass === charClass) &&
                      "Choose a different second class. "}
                  </div>
                )}
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

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="hidden xl:flex xl:w-[420px] shrink-0 border-r border-border bg-card/40">
        <div className="w-full h-screen overflow-hidden">
          <SidebarCharacterSheet
            character={myCharacter}
            items={items}
            currencies={balances}
            campaignCurrencies={currencies}
            connected={wsConnected}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
            onUse={handleUseItem}
            onRead={handleReadItem}
            onSubmitReport={handleSubmitReport}
            worldState={campaign?.worldState}
          />
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col h-screen">
        <div className="border-b border-border bg-background/90 backdrop-blur px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold">{campaign.name}</h1>
                <Badge variant="secondary">{campaign.tone}</Badge>
                <Badge variant="outline">{campaign.combatStyle}</Badge>
                {campaign.storyMode && <Badge>Story Mode</Badge>}
                {campaign.epicMode && <Badge className="bg-amber-600 text-white">Epic</Badge>}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                <span>Invite: {campaign.inviteCode}</span>
                <span>World: {campaign.worldType}</span>
                <span>Rules: {campaign.rulesWeight}</span>
                {primaryCurrency && (
                  <span className="inline-flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    Primary currency: {primaryCurrency.name}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {shopQuery.data?.shop && (
                <Button variant="outline" size="sm" onClick={() => setShopOpen((v) => !v)}>
                  <Store className="w-4 h-4 mr-2" />
                  {shopVisible ? "Hide shop" : "Show shop"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          <section className={cn("flex-1 min-w-0 flex flex-col", shopVisible && "border-r border-border")}>
            <ScrollArea className="flex-1 px-5 py-5">
              <div ref={scrollRef} className="space-y-4 pr-2">
                {messages.length === 0 && (
                  <Card className="p-5 border-dashed">
                    <div className="flex items-start gap-3">
                      <ScrollText className="w-5 h-5 mt-0.5 text-muted-foreground" />
                      <div className="space-y-2">
                        <div className="font-medium">Your campaign is ready.</div>
                        <p className="text-sm text-muted-foreground">
                          Click <strong>Begin Adventure</strong> to start. Ideally software would
                          not make this dramatic, but here we are.
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {messages.map((msg) => (
                  <Card
                    key={msg.id}
                    className={cn(
                      "p-4 max-w-4xl",
                      msg.senderType === "player" && "ml-auto bg-primary/5",
                      msg.senderType === "dm" && "border-amber-500/20",
                      msg.senderType === "system" && "bg-muted/40 text-sm"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {msg.senderType === "dm" && (
                          <img src={logoImg} alt="" className="w-4 h-4 rounded-sm object-cover" />
                        )}
                        {msg.senderType === "player" && <Sword className="w-4 h-4 text-primary" />}
                        {msg.sender}
                      </div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        {msg.messageType}
                      </div>
                    </div>
                    <div className="text-sm space-y-2">{renderMessageContent(msg.content)}</div>
                  </Card>
                ))}

                {dmThinking && (
                  <Card className="p-4 max-w-md border-amber-500/20">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      The Dungeon Master is thinking...
                    </div>
                  </Card>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border p-4 space-y-3 bg-background/95">
              {!messages.some((m) => m.senderType === "dm") ? (
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={startDisabled}
                  className="w-full h-11"
                >
                  {startMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Beginning...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Begin Adventure
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Describe what you do..."
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          actionInput.trim() &&
                          !actionMutation.isPending
                        ) {
                          e.preventDefault();
                          actionMutation.mutate(actionInput.trim());
                        }
                      }}
                      className="h-11"
                    />
                    <Button
                      className="h-11 px-4"
                      disabled={!actionInput.trim() || actionMutation.isPending}
                      onClick={() => actionMutation.mutate(actionInput.trim())}
                    >
                      {actionMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-3">
                    <span>
                      Playing as <strong>{myCharacter.name}</strong>
                    </span>
                    {primaryCurrency && (
                      <span className="inline-flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {primaryCurrency.name}
                      </span>
                    )}
                    {wsConnected ? (
                      <span className="text-emerald-500">Live</span>
                    ) : (
                      <span className="text-yellow-500">Reconnecting</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          {shopVisible && shopQuery.data?.shop && (
            <aside className="w-[420px] shrink-0 bg-card/40">
              <ShopPanel
                shop={shopQuery.data.shop}
                items={shopQuery.data.items}
                balances={balances}
                currencies={currencies}
                buying={buyMutation.isPending}
                onBuy={(shopItemId, quantity) => buyMutation.mutate({ shopItemId, quantity })}
              />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
