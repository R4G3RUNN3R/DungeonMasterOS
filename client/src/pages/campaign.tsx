import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { gameWs } from "@/lib/websocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Swords, Send, Users, ScrollText, Shield, Heart, Skull,
  BookOpen, Copy, Check, ChevronLeft, Sparkles, Loader2, Dices,
  FileText, Wand2, PenLine,
} from "lucide-react";
import CharacterSheetView, { type CharacterSheetData } from "@/components/CharacterSheetView";
import SidebarCharacterSheet from "@/components/SidebarCharacterSheet";
import CampaignSettingsPanel from "@/components/CampaignSettingsPanel";
import DiceRoller, { DiceButton, detectDiceRolls } from "@/components/DiceRoller";
import type { Campaign, Character, Message } from "@shared/schema";

const RACES = ["Human", "Elf", "Dwarf", "Halfling", "Half-Orc", "Gnome", "Tiefling", "Dragonborn"];
const CLASSES = ["Fighter", "Wizard", "Rogue", "Cleric", "Ranger", "Paladin", "Barbarian", "Bard", "Warlock", "Sorcerer", "Druid", "Monk"];

function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
      <span>The Dungeon Master is weaving the narrative</span>
      <div className="flex gap-1 ml-1">
        <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-primary inline-block" />
        <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-primary inline-block" />
        <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-primary inline-block" />
      </div>
      {elapsed >= 8 && (
        <span className="ml-2 text-xs text-muted-foreground/60">({elapsed}s — writing...)</span>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isDM = message.senderType === "dm";
  const isSystem = message.senderType === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-2" data-testid={`message-system-${message.id}`}>
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 py-2 ${isDM ? "" : "items-end"}`} data-testid={`message-${message.senderType}-${message.id}`}>
      <div className="flex items-center gap-2">
        {isDM && <Sparkles className="w-3.5 h-3.5 text-primary" />}
        <span className={`text-xs font-semibold ${isDM ? "text-primary" : "text-muted-foreground"}`}>
          {message.sender}
        </span>
        <span className="text-xs text-muted-foreground/50">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
          isDM
            ? "bg-card border border-border dm-prose"
            : "bg-primary/10 border border-primary/20"
        }`}
        dangerouslySetInnerHTML={{
          __html: message.content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br />')
        }}
      />
    </div>
  );
}

function CharacterSheet({ character }: { character: Character }) {
  const hpPercent = (character.hp / character.maxHp) * 100;
  const hpColor = hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="p-3 rounded-lg bg-card border border-border space-y-2" data-testid={`character-sheet-${character.id}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{character.name}</span>
        <Badge variant="secondary" className="text-xs">Lv {character.level}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">
        {character.race} {character.charClass}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" /> HP</span>
          <span>{character.hp}/{character.maxHp}</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${hpColor} rounded-full transition-all`} style={{ width: `${hpPercent}%` }} />
        </div>
      </div>
      {character.status !== "alive" && (
        <Badge variant="destructive" className="text-xs gap-1">
          <Skull className="w-3 h-3" /> {character.status}
        </Badge>
      )}
      {character.traits && (
        <p className="text-xs text-muted-foreground italic">{character.traits}</p>
      )}
    </div>
  );
}

// Blank sheet used as the starting point for "Build" mode
const BLANK_SHEET: CharacterSheetData = {
  name: "",
  race: "",
  charClass: "",
  level: 1,
  hp: 20,
  maxHp: 20,
  traits: "",
  backstory: "",
  characterData: JSON.stringify({ sections: [], raw: "" }),
};

function CharacterCreation({ campaignId, onCreated }: { campaignId: number; onCreated: () => void }) {
  // "paste" = initial paste screen, "sheet" = sheet view (both build and import end here)
  const [mode, setMode] = useState<"choose" | "paste" | "sheet">("choose");
  const [sheet, setSheet] = useState<CharacterSheetData>(BLANK_SHEET);

  // Import paste
  const [importText, setImportText] = useState("");
  const [parseError, setParseError] = useState("");

  const parseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/parse-character", { text: importText });
      return res.json();
    },
    onSuccess: (data: CharacterSheetData) => {
      setSheet(data);
      setParseError("");
      setMode("sheet");
    },
    onError: (e: any) => setParseError(e.message || "Could not parse. Add more detail."),
  });

  const createMutation = useMutation({
    mutationFn: async (charData: any) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/characters`, charData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "characters"] });
      onCreated();
    },
  });

  const handleConfirm = () => {
    createMutation.mutate({
      name: sheet.name,
      race: sheet.race || "Unknown",
      charClass: sheet.charClass || "Unknown",
      traits: sheet.traits,
      backstory: sheet.backstory,
      level: sheet.level ?? 1,
      hp: sheet.hp ?? 20,
      maxHp: sheet.maxHp ?? 20,
      characterData: sheet.characterData,
    });
  };

  // ── Choose ──
  if (mode === "choose") {
    return (
      <div className="max-w-sm mx-auto p-6 space-y-5">
        <div className="text-center space-y-2">
          <Shield className="w-8 h-8 mx-auto text-primary" />
          <h2 className="font-bold text-lg">Who are you?</h2>
          <p className="text-xs text-muted-foreground">Fill in the sheet yourself, or paste anything and let the AI do the work.</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => { setSheet(BLANK_SHEET); setMode("sheet"); }}
            className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all"
            data-testid="button-mode-build"
          >
            <div className="flex items-center gap-3">
              <PenLine className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold">Fill in a blank sheet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Name, race, class, HP, abilities, equipment — fill as much or as little as you like.</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setMode("paste")}
            className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all"
            data-testid="button-mode-import"
          >
            <div className="flex items-center gap-3">
              <Wand2 className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold">Paste &amp; auto-import</p>
                <p className="text-xs text-muted-foreground mt-0.5">Paste a D&amp;D Beyond stat block, any character description, or freeform text. AI fills the sheet for you.</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Paste (import) ──
  if (mode === "paste") {
    return (
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("choose")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base">Paste Character Data</h2>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Paste anything — D&amp;D Beyond, Pathfinder, FATE, homebrew, an isekai skill list, a prose description. No format required.
        </p>

        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Works with:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
            <li>D&amp;D Beyond / Pathfinder stat blocks (copy the full text)</li>
            <li>Isekai characters with cheat skills, status windows, and ability lists</li>
            <li>FATE aspects &amp; stunts, Blades in the Dark stress/trauma, any system</li>
            <li>Modern-world characters with real-world knowledge and no combat stats</li>
            <li>Plain prose: <span className="italic">"A scarred half-orc gladiator who fears the dark..."</span></li>
          </ul>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Paste here</label>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste your character sheet, description, or any text..."
            rows={10}
            className="resize-none text-sm font-mono"
            data-testid="input-import-text"
          />
        </div>

        {parseError && <p className="text-xs text-destructive">{parseError}</p>}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setMode("choose")} className="flex-1 text-sm">Back</Button>
          <Button
            onClick={() => parseMutation.mutate()}
            disabled={importText.trim().length < 5 || parseMutation.isPending}
            className="flex-1 text-sm gap-2"
            data-testid="button-parse-character"
          >
            {parseMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Build Sheet</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Sheet view (both build and import land here) ──
  const canSubmit = sheet.name.trim().length > 0;

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setMode("choose")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-xs text-muted-foreground">Edit anything — click any field to change it</p>
      </div>

      {/* The visual character sheet */}
      <CharacterSheetView data={sheet} onChange={setSheet} />

      {/* Confirm button */}
      <div className="sticky bottom-0 pb-4 pt-2 bg-background/80 backdrop-blur-sm">
        <Button
          onClick={handleConfirm}
          disabled={!canSubmit || createMutation.isPending}
          className="w-full h-11 text-sm gap-2 font-semibold"
          data-testid="button-create-character"
        >
          {createMutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Entering the world...</>
          ) : (
            <><Swords className="w-4 h-4" /> Enter the World</>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const campaignId = Number(id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [actionText, setActionText] = useState("");
  const [wsThinking, setWsThinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const [campaignData, setCampaignData] = useState<Campaign | null>(null); // live campaign (updated via WS)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Queries
  const campaignQuery = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}`);
      return res.json();
    },
  });

  const myCharQuery = useQuery<Character | null>({
    queryKey: ["/api/campaigns", campaignId, "my-character"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/campaigns/${campaignId}/my-character`);
        return res.json();
      } catch {
        return null;
      }
    },
  });

  const charsQuery = useQuery<Character[]>({
    queryKey: ["/api/campaigns", campaignId, "characters"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/characters`);
      return res.json();
    },
  });

  const messagesQuery = useQuery<Message[]>({
    queryKey: ["/api/campaigns", campaignId, "messages"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/messages`);
      return res.json();
    },
  });

  // Initialize messages from query
  useEffect(() => {
    if (messagesQuery.data) setMessages(messagesQuery.data);
  }, [messagesQuery.data]);

  // WebSocket connection
  useEffect(() => {
    gameWs.connect(campaignId);
    const unsub = gameWs.subscribe((data) => {
      if (data.type === "message") {
        setMessages((prev) => {
          if (prev.find((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      if (data.type === "dm_thinking") {
        setWsThinking(data.thinking);
      }
      if (data.type === "character_joined") {
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "characters"] });
      }
      // Refresh items when DM grants something or another player uses an item
      if (data.type === "items_updated" || data.type === "item_granted") {
        queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      }
      // Refresh character data when abilities are granted or effects tick
      if (data.type === "abilities_granted" || data.type === "effects_updated") {
        queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "characters"] });
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] });
      }
      // Show a toast/notification when abilities are granted
      if (data.type === "abilities_granted" && data.abilities?.length > 0) {
        // The message banner in chat handles this, but also refresh character sheet
        queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      }
      // Refresh character HP if updated server-side
      if (data.type === "character_updated") {
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "characters"] });
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] });
      }
      // Live campaign settings update (host changed something mid-session)
      if (data.type === "campaign_updated" && data.campaign) {
        setCampaignData(data.campaign);
        queryClient.setQueryData(["/api/campaigns", campaignId], data.campaign);
      }
    });
    return () => { unsub(); gameWs.disconnect(); };
  }, [campaignId]);

  // Poll messages from server — fallback when WS misses an event
  const pollMessages = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiRequest("GET", `/api/campaigns/${campaignId}/messages`);
        const fresh: Message[] = await res.json();
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newOnes = fresh.filter((m) => !existingIds.has(m.id));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      } catch { /* ignore */ }
    }, 2000);
  }, [campaignId]);

  // Send action
  const actionMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/action`, { content });
      return res.json();
    },
    onSettled: pollMessages,
  });

  // Start campaign
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/start`);
      return res.json();
    },
    onSettled: pollMessages,
  });

  // HP update mutation
  const hpMutation = useMutation({
    mutationFn: async ({ characterId, hp }: { characterId: number; hp: number }) => {
      const res = await apiRequest("PATCH", `/api/characters/${characterId}/hp`, { hp });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "characters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "my-character"] });
    },
  });

  // Thinking state — derived AFTER both mutations are declared
  const isDMThinking = wsThinking || actionMutation.isPending;

  const handleSend = useCallback(() => {
    const text = actionText.trim();
    if (!text || actionMutation.isPending || wsThinking) return;
    setActionText("");
    actionMutation.mutate(text);
  }, [actionText, actionMutation, wsThinking]);

  // Scroll to bottom on new messages — must be AFTER isDMThinking is declared
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isDMThinking]);

  const copyInvite = () => {
    if (campaignQuery.data) {
      navigator.clipboard.writeText(campaignQuery.data.inviteCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Use live campaign data (updated in real-time via WS) or fall back to query
  const liveCampaign = campaignData || campaignQuery.data;
  // Host = whoever created the campaign. We detect this by checking if the
  // server would accept our PATCH (the server checks x-visitor-id header).
  // Simplest client-side proxy: the host is whoever has no character yet OR
  // whose character was first. We just allow all logged-in players to see the
  // settings panel — only the host's PATCH will be accepted by the server.
  const isHost = true; // server enforces the actual restriction

  if (campaignQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaignQuery.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Campaign not found.</p>
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2 text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
      </div>
    );
  }

  const campaign = campaignQuery.data;
  const myChar = myCharQuery.data;
  const party = charsQuery.data || [];
  const hasStarted = messages.some((m) => m.senderType === "dm");

  // Character creation gate
  if (!myChar && !myCharQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1 text-xs">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <span className="font-semibold text-sm">{campaign.name}</span>
          <Badge variant="secondary" className="text-xs ml-auto">{campaign.tone}</Badge>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <CharacterCreation campaignId={campaignId} onCreated={() => {
            myCharQuery.refetch();
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" data-testid="campaign-session">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1 text-xs p-1">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <Swords className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-sm truncate">{campaign.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={copyInvite}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded bg-muted"
                data-testid="button-copy-invite"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                <span className="font-mono">{campaign.inviteCode}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy invite code</TooltipContent>
          </Tooltip>
          <Badge variant="secondary" className="text-xs hidden sm:inline-flex">{campaign.tone}</Badge>
          <Badge variant="outline" className="text-xs hidden sm:inline-flex gap-1">
            <Users className="w-3 h-3" /> {party.length}
          </Badge>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — Party & World */}
        {/* Parchment character sheet sidebar */}
        <aside className="hidden md:flex flex-col w-72 border-r border-border shrink-0" style={{ background: "#1a1108" }}>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {party.map((c) => (
                <SidebarCharacterSheet
                  key={c.id}
                  character={c}
                  isMyChar={myChar?.id === c.id}
                  onHpChange={(hp) => hpMutation.mutate({ characterId: c.id, hp })}
                />
              ))}
              {party.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: "#8a6830", fontFamily: "serif", fontStyle: "italic" }}>Waiting for adventurers...</p>
              )}

              {/* Live campaign settings panel */}
              {liveCampaign && (
                <CampaignSettingsPanel
                  campaign={liveCampaign}
                  isHost={isHost}
                  campaignId={campaignId}
                />
              )}

              {/* Start campaign button */}
              {!hasStarted && party.length > 0 && (
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="w-full text-sm gap-2"
                  data-testid="button-start-campaign"
                >
                  {startMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Summoning the DM...</>
                  ) : (
                    <><Dices className="w-4 h-4" /> Begin Adventure</>
                  )}
                </Button>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Mobile start button */}
          {!hasStarted && party.length > 0 && (
            <div className="md:hidden p-3 border-b border-border">
              <Button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="w-full text-sm gap-2"
                data-testid="button-start-campaign-mobile"
              >
                {startMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Summoning the DM...</>
                ) : (
                  <><Dices className="w-4 h-4" /> Begin Adventure</>
                )}
              </Button>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 px-4">
            <div className="max-w-3xl mx-auto py-4">
              {messages.length === 0 && !isDMThinking && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ScrollText className="w-10 h-10 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {party.length === 0
                      ? "Share the invite code to gather your party."
                      : "The adventure awaits. Press 'Begin Adventure' to start."}
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {(isDMThinking || startMutation.isPending) && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Action input */}
          {myChar && hasStarted && (
            <div className="border-t border-border p-3 bg-card shrink-0">
              <div className="max-w-3xl mx-auto flex gap-2 items-end">
                {/* Dice roller button */}
                <DiceButton onClick={() => setDiceOpen(o => !o)} active={diceOpen} />
                <div className="flex-1 relative">
                  <Textarea
                    ref={inputRef}
                    value={actionText}
                    onChange={(e) => setActionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Describe your action... (e.g. 'I sneak behind the guard and draw my dagger')"
                    className="resize-none text-sm min-h-[40px] max-h-[120px]"
                    rows={1}
                    disabled={isDMThinking || actionMutation.isPending}
                    data-testid="input-player-action"
                  />
                </div>
                <Button
                  onClick={handleSend}
                  disabled={!actionText.trim() || isDMThinking || actionMutation.isPending}
                  size="sm"
                  className="h-10 w-10 p-0 shrink-0"
                  data-testid="button-send-action"
                >
                  {actionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Dice Roller overlay */}
          <DiceRoller
            isOpen={diceOpen}
            onClose={() => setDiceOpen(false)}
            onResult={(result) => {
              // Post dice result as a player message
              if (myChar && hasStarted) {
                const msg = `🎲 ${result.label}: **${result.total}**${result.dice.length > 1 ? ` (${result.dice.map(d => d.result).join('+')}${result.modifier ? (result.modifier > 0 ? '+' : '') + result.modifier : ''})` : ''}${result.isCrit ? ' — CRITICAL!' : result.isFumble ? ' — FUMBLE!' : ''}`;
                actionMutation.mutate(msg);
              }
            }}
          />
        </main>
      </div>
    </div>
  );
}
