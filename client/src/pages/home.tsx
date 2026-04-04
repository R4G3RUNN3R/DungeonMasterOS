import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/use-theme";
import {
  Swords, Users, ScrollText, Moon, Sun, Shield, Flame,
  Clapperboard, Dices, BookOpen, Globe, Wand2, Scroll, Tv, Star,
} from "lucide-react";
import type { Campaign } from "@shared/schema";

import logoImg from "@assets/logo.png";

function DmLogo({ large }: { large?: boolean }) {
  return large ? (
    <img src={logoImg} alt="Dungeon Master OS" className="w-full max-w-sm mx-auto rounded-2xl shadow-2xl" style={{ border: "2px solid #c4a265" }} />
  ) : (
    <img src={logoImg} alt="Dungeon Master OS" className="w-12 h-12 rounded-xl" style={{ border: "1px solid #c4a26544" }} />
  );
}

// ── Option card used for tone, world gen style, etc. ──
function OptionCard({
  value, current, onChange, label, description, icon,
}: {
  value: string; current: string; onChange: (v: string) => void;
  label: string; description: string; icon?: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card hover:border-border/80 text-muted-foreground hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-2 mb-0.5">
        {icon && <span className={active ? "text-primary" : "text-muted-foreground"}>{icon}</span>}
        <span className={`text-xs font-semibold ${active ? "text-primary" : ""}`}>{label}</span>
        {active && <Badge className="ml-auto text-xs py-0 h-4">Selected</Badge>}
      </div>
      <p className="text-xs leading-relaxed opacity-80">{description}</p>
    </button>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  // ── Core settings ──
  const [campaignName, setCampaignName] = useState("");
  const [tone, setTone] = useState("heroic");
  const [rulesWeight, setRulesWeight] = useState("medium");
  const [powerLevel, setPowerLevel] = useState("standard");
  const [worldType, setWorldType] = useState("original");

  // ── Advanced / new settings ──
  const [combatStyle, setCombatStyle] = useState("cinematic");
  const [storyMode, setStoryMode] = useState(false);
  const [worldGenStyle, setWorldGenStyle] = useState("standard");
  const [homebrewRules, setHomebrewRules] = useState("");
  const [customWorldPrompt, setCustomWorldPrompt] = useState("");
  // Epic + Anime
  const [epicMode, setEpicMode] = useState(false);
  const [animeWorldSource, setAnimeWorldSource] = useState("");
  const [animeWorldMode, setAnimeWorldMode] = useState<"none"|"inspired"|"canonical">("inspired");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/campaigns", {
        name: campaignName,
        tone, rulesWeight, powerLevel, worldType,
        combatStyle, storyMode, worldGenStyle,
        homebrewRules, customWorldPrompt,
        epicMode,
        animeWorldSource,
        animeWorldMode: animeWorldSource.trim() ? animeWorldMode : "none",
      });
      return (await res.json()) as Campaign;
    },
    onSuccess: (campaign) => navigate(`/campaign/${campaign.id}`),
  });

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoinError("");
    try {
      const res = await apiRequest("GET", `/api/campaigns/invite/${joinCode.trim()}`);
      const campaign = (await res.json()) as Campaign;
      navigate(`/campaign/${campaign.id}`);
    } catch {
      setJoinError("Campaign not found. Check the invite code.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent transition-colors"
        data-testid="button-theme-toggle"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Hero */}
      <div className="text-center mb-6 max-w-lg">
        {mode === "menu" ? (
          <>
            <DmLogo large />
            <p className="text-muted-foreground text-sm leading-relaxed mt-4">
              A persistent, multiplayer tabletop RPG powered by an AI Dungeon Master.
              Create a campaign, invite your party, and step into a living world.
            </p>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3 mb-3">
            <DmLogo />
            <h1 className="text-xl font-bold tracking-tight">Dungeon Master OS</h1>
          </div>
        )}
      </div>

      {/* Menu */}
      {mode === "menu" && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button onClick={() => setMode("create")} className="w-full h-12 text-sm font-medium gap-2" data-testid="button-create-campaign">
            <Swords className="w-4 h-4" /> Create Campaign
          </Button>
          <Button variant="secondary" onClick={() => setMode("join")} className="w-full h-12 text-sm font-medium gap-2" data-testid="button-join-campaign">
            <Users className="w-4 h-4" /> Join Campaign
          </Button>
        </div>
      )}

      {/* Join */}
      {mode === "join" && (
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Enter Invite Code</h2>
            </div>
            <Input
              placeholder="e.g. a1b2c3d4"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              data-testid="input-invite-code"
              className="font-mono"
            />
            {joinError && <p className="text-destructive text-xs">{joinError}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setMode("menu")} className="flex-1 text-sm">Back</Button>
              <Button onClick={handleJoin} className="flex-1 text-sm" data-testid="button-join-submit">Join</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create — Tabbed */}
      {mode === "create" && (
        <div className="w-full max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Forge Your Campaign</h2>
            <Button variant="ghost" size="sm" onClick={() => setMode("menu")} className="ml-auto text-xs">
              Back
            </Button>
          </div>

          <div className="space-y-3 mb-4">
            <Input
              placeholder="Campaign name, e.g. The Sunken Citadel"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="text-sm"
              data-testid="input-campaign-name"
            />
          </div>

          <Tabs defaultValue="world" className="w-full">
            <TabsList className="w-full grid grid-cols-5 mb-4">
              <TabsTrigger value="world" className="text-xs gap-1"><Globe className="w-3 h-3" />World</TabsTrigger>
              <TabsTrigger value="combat" className="text-xs gap-1"><Swords className="w-3 h-3" />Combat</TabsTrigger>
              <TabsTrigger value="story" className="text-xs gap-1"><BookOpen className="w-3 h-3" />Story</TabsTrigger>
              <TabsTrigger value="anime" className="text-xs gap-1"><Tv className="w-3 h-3" />Anime</TabsTrigger>
              <TabsTrigger value="homebrew" className="text-xs gap-1"><Scroll className="w-3 h-3" />Homebrew</TabsTrigger>
            </TabsList>

            {/* ── WORLD TAB ── */}
            <TabsContent value="world" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tone</label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger data-testid="select-tone"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark & Grim</SelectItem>
                      <SelectItem value="heroic">Heroic & Epic</SelectItem>
                      <SelectItem value="comedic">Comedic</SelectItem>
                      <SelectItem value="realistic">Realistic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Power Level</label>
                  <Select value={powerLevel} onValueChange={setPowerLevel}>
                    <SelectTrigger data-testid="select-power"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Fantasy</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="high">High Fantasy</SelectItem>
                      <SelectItem value="godtier">God-Tier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">World Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <OptionCard
                    value="original" current={worldType} onChange={setWorldType}
                    label="Original Setting"
                    description="The DM builds a world from scratch, unique to your campaign."
                    icon={<Wand2 className="w-3 h-3" />}
                  />
                  <OptionCard
                    value="faerun" current={worldType} onChange={setWorldType}
                    label="Forgotten Realms"
                    description="Faerûn, the Sword Coast, Baldur's Gate, Waterdeep. D&D canon lore."
                    icon={<Globe className="w-3 h-3" />}
                  />
                  <OptionCard
                    value="custom" current={worldType} onChange={setWorldType}
                    label="Custom World Seed"
                    description="Describe your world below and the DM builds from that vision."
                    icon={<Scroll className="w-3 h-3" />}
                  />
                </div>
              </div>

              {worldType === "custom" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">World Seed</label>
                  <Textarea
                    placeholder={`Describe your world concept. Examples:\n• "Post-apocalyptic world where magic replaced technology after the Collapse"\n• "Victorian steampunk London with a hidden fae underworld"\n• "The party is trapped inside a 1994 video game with glitching NPCs"`}
                    value={customWorldPrompt}
                    onChange={(e) => setCustomWorldPrompt(e.target.value)}
                    rows={4}
                    className="resize-none text-sm"
                    data-testid="input-world-seed"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">How does the party arrive?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <OptionCard
                    value="standard" current={worldGenStyle} onChange={setWorldGenStyle}
                    label="They already live here"
                    description="The party has history in this world. No special arrival needed."
                  />
                  <OptionCard
                    value="isekai" current={worldGenStyle} onChange={setWorldGenStyle}
                    label="Isekai — Summoned from Earth"
                    description="Modern people transported to a fantasy world. Truck-kun optional."
                  />
                  <OptionCard
                    value="portal" current={worldGenStyle} onChange={setWorldGenStyle}
                    label="Portal Fantasy"
                    description="Stumbled through a magical gate by accident. May be one-way."
                  />
                  <OptionCard
                    value="reincarnation" current={worldGenStyle} onChange={setWorldGenStyle}
                    label="Reincarnation"
                    description="They died and woke in new bodies with fragmentary past-life memories."
                  />
                  <OptionCard
                    value="dreamfall" current={worldGenStyle} onChange={setWorldGenStyle}
                    label="Dream Realm"
                    description="Fell asleep and woke inside a shared dream with its own rules."
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── COMBAT TAB ── */}
            <TabsContent value="combat" className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Combat Style</label>
                <div className="space-y-2">
                  <OptionCard
                    value="cinematic" current={combatStyle} onChange={setCombatStyle}
                    label="Cinematic"
                    description="Pure prose. No numbers, no HP, no dice — just visceral, dramatic storytelling. 'The blade catches your guard and sends you stumbling backward.' Outcomes driven by narrative logic and creativity."
                    icon={<Clapperboard className="w-3 h-3" />}
                  />
                  <OptionCard
                    value="tactical" current={combatStyle} onChange={setCombatStyle}
                    label="Tactical"
                    description="Clear positioning, action economy, and results — but still narrative. 'You land a solid hit, staggering him back three paces. You have a bonus action remaining.' Strategic without full dice exposure."
                    icon={<Swords className="w-3 h-3" />}
                  />
                  <OptionCard
                    value="dice" current={combatStyle} onChange={setCombatStyle}
                    label="Full Dice (D&D 5e)"
                    description="All rolls reported. 'd20+5 = 17 vs AC 14 — Hit! 2d6+3 = 11 slashing damage.' Initiative, AC, saving throws, spell slots — the whole rulebook."
                    icon={<Dices className="w-3 h-3" />}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Rules Weight</label>
                <div className="grid grid-cols-3 gap-2">
                  <OptionCard
                    value="light" current={rulesWeight} onChange={setRulesWeight}
                    label="Light"
                    description="Story over mechanics. Outcomes based on narrative logic."
                  />
                  <OptionCard
                    value="medium" current={rulesWeight} onChange={setRulesWeight}
                    label="Medium"
                    description="Simple checks when uncertain. Balanced approach."
                  />
                  <OptionCard
                    value="crunchy" current={rulesWeight} onChange={setRulesWeight}
                    label="Crunchy"
                    description="Full D&D 5e rules. Spell slots, attunement, exhaustion."
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── STORY TAB ── */}
            <TabsContent value="story" className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Story Mode</span>
                      {storyMode && <Badge className="text-xs py-0 h-4">Active</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Characters cannot permanently die. Failures become interesting complications, not dead ends.
                      Every scene has a narrative escape hatch. Ideal for new players, casual groups, or campaigns
                      where you want the story to always move forward.
                    </p>
                  </div>
                  <Switch
                    checked={storyMode}
                    onCheckedChange={setStoryMode}
                    data-testid="switch-story-mode"
                  />
                </div>

                {storyMode && (
                  <div className="pt-2 border-t border-border space-y-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Story Mode rules:</p>
                    <ul className="space-y-0.5 list-disc list-inside">
                      <li>Near-death = captured, unconscious, or setback — never a full stop</li>
                      <li>Failures create story momentum, not punishing dead ends</li>
                      <li>NPCs tend toward helpful or neutral rather than pure antagonism</li>
                      <li>The DM gently steers players toward interesting choices</li>
                    </ul>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── HOMEBREW TAB ── */}
            <TabsContent value="homebrew" className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Homebrew Rules</label>
                <p className="text-xs text-muted-foreground">
                  Write any custom rules in plain English. The DM will enforce them throughout the campaign.
                </p>
                <Textarea
                  placeholder={`Examples:\n• Critical failures cause fumbles with comedic or dramatic consequences\n• Magic users must sacrifice HP to cast spells (1 HP per spell level)\n• Death is permanent — but the player can introduce a new character next scene\n• Any player can spend a "Fate Point" once per session to reroll any die\n• NPCs remember everything — even off-hand comments become plot hooks\n• Stealth is always cinematic — never a simple pass/fail roll\n• The villain is always three steps ahead and never monologues`}
                  value={homebrewRules}
                  onChange={(e) => setHomebrewRules(e.target.value)}
                  rows={7}
                  className="resize-none text-sm font-mono"
                  data-testid="input-homebrew-rules"
                />
                {homebrewRules.trim() && (
                  <p className="text-xs text-primary">
                    {homebrewRules.trim().split("\n").filter(l => l.trim()).length} rule(s) added — the DM will enforce these throughout the campaign.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setMode("menu")} className="flex-1 text-sm">
              Back
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!campaignName.trim() || createMutation.isPending}
              className="flex-1 text-sm gap-2"
              data-testid="button-create-submit"
            >
              {createMutation.isPending ? (
                <><Flame className="w-4 h-4 animate-pulse" /> Creating...</>
              ) : (
                <><Swords className="w-4 h-4" /> Forge Campaign</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
