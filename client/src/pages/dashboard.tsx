import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { resetPreferencesForNewIdentity } from "@/lib/personalPreferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Swords, Plus, Users, Clock, LogOut, Crown, AlertTriangle,
  CheckCircle, Loader2, Hash, Archive, BarChart3, Settings,
  BookOpen, Sparkles, ChevronRight, Gift, RefreshCw, X,
} from "lucide-react";
import logoImg from "@assets/logo.png";
import type { Campaign } from "@shared/schema";
import { turnsUsedPercent } from "@shared/tiers";

function SubscriptionBanner({ status, tier, trialEndsAt, daysLeft, hasStripe, subscriptionCurrentPeriodEnd }: {
  status: string | undefined;
  tier: string | undefined;
  trialEndsAt: string | null | undefined;
  daysLeft: number | null;
  hasStripe: boolean | undefined;
  subscriptionCurrentPeriodEnd: string | null | undefined;
}) {
  if (!status) return null;

  // getNewUserBillingState() gives every new signup subscriptionStatus:
  // "expired" (no free trial) — someone who has never touched Stripe and
  // never had a subscription period is not "lapsed", they've simply never
  // subscribed. Showing them the same "Subscription ended / Resubscribe"
  // banner as an actually-lapsed subscriber is misleading right after
  // registration.
  const neverSubscribed = status === "expired" && !hasStripe && !subscriptionCurrentPeriodEnd;
  if (neverSubscribed) {
    return (
      <div className="bg-primary/10 border-b border-primary/20 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Crown className="w-4 h-4 text-primary shrink-0" />
          <span className="text-foreground">
            <span className="font-semibold">Choose a plan</span> to start playing —{" "}
            <span className="text-muted-foreground">a one-time Squire Pass or a subscription.</span>
          </span>
        </div>
        <Link href="/pricing">
          <Button size="sm" className="text-xs shrink-0">See Plans</Button>
        </Link>
      </div>
    );
  }

  if (status === "trial" && daysLeft !== null) {
    return (
      <div className="bg-primary/10 border-b border-primary/20 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Crown className="w-4 h-4 text-primary shrink-0" />
          <span className="text-foreground">
            <span className="font-semibold">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span> left in your free trial —{" "}
            <span className="text-muted-foreground">Subscribe to keep your campaigns going.</span>
          </span>
        </div>
        <Link href="/pricing">
          <Button size="sm" className="text-xs shrink-0">Subscribe</Button>
        </Link>
      </div>
    );
  }

  if (status === "past_due") {
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-foreground">Payment failed — update your payment method to continue playing.</span>
        </div>
        <Link href="/billing">
          <Button size="sm" variant="outline" className="text-xs shrink-0 border-amber-500/30">Fix Billing</Button>
        </Link>
      </div>
    );
  }

  if (status === "expired" || status === "cancelled") {
    return (
      <div className="bg-destructive/10 border-b border-destructive/20 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-foreground">
            {status === "cancelled" ? "Subscription cancelled — " : "Subscription ended — "}
            <span className="text-muted-foreground">your campaigns are saved and waiting.</span>
          </span>
        </div>
        <Link href="/pricing">
          <Button size="sm" variant="destructive" className="text-xs shrink-0">Resubscribe</Button>
        </Link>
      </div>
    );
  }

  return null;
}

function TurnsUsageBar({ used, turnsIncluded, interval, bonusTurns }: {
  used: number; turnsIncluded: number; interval: string | null | undefined; bonusTurns: number;
}) {
  // turnsIncluded comes straight from /api/billing, which already accounts
  // for the subscriber's real weekly/monthly/yearly entitlement and
  // unlimitedTurns (-1) — it must never be recomputed client-side from
  // aiTurnsPerMonth, which is always the MONTHLY figure regardless of the
  // subscriber's actual billing interval.
  const unlimited = turnsIncluded === -1;
  const total = unlimited ? 0 : turnsIncluded + bonusTurns;
  const pct = unlimited ? 0 : turnsUsedPercent(used, total);
  const remaining = unlimited ? 0 : Math.max(0, total - used);
  const periodLabel = interval === "weekly" ? "week" : "month";

  const barColor = pct >= 95 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{periodLabel === "week" ? "Weekly" : "Monthly"} AI Turns</span>
        </div>
        <span className="text-xs text-muted-foreground">{used} / {unlimited ? "∞" : total}</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${unlimited ? 0 : Math.min(100, pct)}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{unlimited ? "Unlimited turns" : `${remaining} turns remaining this ${periodLabel}`}</span>
        {bonusTurns > 0 && (
          <span className="text-primary flex items-center gap-1">
            <Gift className="w-3 h-3" /> +{bonusTurns} bonus
          </span>
        )}
      </div>
      {!unlimited && pct >= 80 && (
        <Link href="/pricing">
          <Button size="sm" variant="outline" className="w-full text-xs gap-1">
            <Plus className="w-3 h-3" /> Get More Turns
          </Button>
        </Link>
      )}
    </div>
  );
}

function CampaignCard({ campaign, onArchive }: { campaign: Campaign; onArchive: (id: number, archive: boolean) => void }) {
  const toneColors: Record<string, string> = {
    heroic: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    dark: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    comedic: "bg-green-500/20 text-green-400 border-green-500/30",
    realistic: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  const toneClass = toneColors[campaign.tone ?? "heroic"] ?? "bg-primary/20 text-primary border-primary/30";
  const lastPlayed = campaign.lastPlayedAt
    ? new Date(campaign.lastPlayedAt).toLocaleDateString()
    : "Never played";

  return (
    <div className="relative group">
      <Link href={`/campaign/${campaign.id}`}>
        <div className={`bg-card border rounded-xl p-5 transition-all group cursor-pointer h-full flex flex-col ${campaign.isArchived ? "border-border opacity-60" : "border-border hover:border-primary/40 hover:bg-card/80"}`}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-serif font-bold text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
              {campaign.name}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {campaign.isArchived && <Badge variant="secondary" className="text-xs">Archived</Badge>}
              {campaign.tone && (
                <Badge className={`text-xs border capitalize ${toneClass}`} variant="outline">{campaign.tone}</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {campaign.epicMode && <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">Epic</Badge>}
            {campaign.animeWorldSource && <Badge variant="outline" className="text-xs border-pink-500/30 text-pink-400">Anime</Badge>}
            {campaign.storyMode && <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">Story Mode</Badge>}
          </div>

          <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground pt-3 border-t border-border">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> {campaign.totalMessages ?? 0} messages
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" /> {lastPlayed}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </Link>
      {/* Archive button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchive(campaign.id, !campaign.isArchived); }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-card border border-border hover:bg-destructive/10 hover:border-destructive/30 text-muted-foreground hover:text-destructive"
        title={campaign.isArchived ? "Unarchive" : "Archive"}
      >
        {campaign.isArchived ? <RefreshCw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
      </button>
    </div>
  );
}

function NewCampaignCard() {
  return (
    <Link href="/home">
      <div className="bg-card/40 border border-dashed border-border rounded-xl p-5 hover:border-primary/40 hover:bg-card/60 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[140px] group">
        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Plus className="w-5 h-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">New Campaign</p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading, daysLeftInTrial } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Check for subscription success params
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("subscribed=1")) {
      toast({ title: "Subscription activated!", description: "Welcome to Dungeon Master OS. Your adventure begins now." });
      window.history.replaceState(null, "", window.location.pathname + "#/dashboard");
    }
    if (hash.includes("squire=1")) {
      toast({ title: "Squire Pass activated!", description: "50 AI DM turns have been added to your account." });
      window.history.replaceState(null, "", window.location.pathname + "#/dashboard");
    }
  }, []);

  if (!authLoading && !user) {
    navigate("/login");
    return null;
  }

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/my-campaigns"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const { data: billingData } = useQuery({
    queryKey: ["/api/billing"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  }) as { data: any };

  const campaigns = campaignsData ?? [];
  const activeCampaigns = campaigns.filter((c) => !c.isArchived);
  const archivedCampaigns = campaigns.filter((c) => c.isArchived);

  const logoutMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/auth/logout"); },
    onSuccess: () => { resetPreferencesForNewIdentity(); queryClient.clear(); navigate("/"); },
    onError: () => { resetPreferencesForNewIdentity(); queryClient.clear(); navigate("/"); },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: number; archive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/campaigns/${id}/archive`, { archive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/my-campaigns"] }),
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Link href="/">
              <img src={logoImg} alt="DMOS" className="w-8 h-8 rounded-lg cursor-pointer hover:opacity-80 transition-opacity" style={{ border: "1px solid #c4a26544" }} />
            </Link>
            <span className="text-sm font-medium text-muted-foreground hidden sm:block">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary uppercase">{user.username[0]}</span>
                </div>
                <span className="text-xs font-medium text-foreground">{user.username}</span>
                <Badge variant="secondary" className="text-xs capitalize">{billingData?.tier || user.tier}</Badge>
                {(user.role === "dungeon_master" || user.isAdmin) && (
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                    DungeonMaster
                  </Badge>
                )}
              </div>
            )}
            <Link href="/billing">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5">
                <Settings className="w-3.5 h-3.5" /><span className="hidden sm:block">Billing</span>
              </Button>
            </Link>
            <Link href="/account">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5">
                <Settings className="w-3.5 h-3.5" /><span className="hidden sm:block">Account</span>
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
              <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:block">Sign Out</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Subscription banner */}
      <SubscriptionBanner
        status={billingData?.subscriptionStatus || user?.subscriptionStatus}
        tier={billingData?.tier || user?.tier}
        trialEndsAt={user?.trialEndsAt}
        daysLeft={daysLeftInTrial}
        hasStripe={billingData?.hasStripe}
        subscriptionCurrentPeriodEnd={billingData?.subscriptionCurrentPeriodEnd}
      />

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground mb-1">
            Welcome back, {user?.username}
          </h1>
          <p className="text-muted-foreground text-sm">
            {activeCampaigns.length === 0
              ? "Create your first campaign to get started."
              : `${activeCampaigns.length} active campaign${activeCampaigns.length !== 1 ? "s" : ""} waiting for you.`}
          </p>
        </div>

        {/* Usage + quick actions */}
        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          {/* Turns usage */}
          <div className="lg:col-span-2">
            {billingData && (
              <TurnsUsageBar
                used={billingData.aiTurnsUsedThisMonth}
                turnsIncluded={billingData.turnsIncluded}
                interval={billingData.stripeBillingInterval}
                bonusTurns={billingData.bonusTurns ?? 0}
              />
            )}
          </div>
          {/* Quick actions */}
          <div className="space-y-3">
            <Link href="/home">
              <Button className="w-full gap-2 justify-start" variant="outline">
                <Plus className="w-4 h-4" /> New Campaign
              </Button>
            </Link>
            <Link href="/pricing">
              <Button className="w-full gap-2 justify-start" variant="outline">
                <Crown className="w-4 h-4" /> Upgrade Plan
              </Button>
            </Link>
            <Link href="/pricing">
              <Button className="w-full gap-2 justify-start" variant="outline">
                <Gift className="w-4 h-4" /> Get More Turns
              </Button>
            </Link>
          </div>
        </div>

        {/* Campaigns */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-xl font-bold text-foreground flex items-center gap-2">
              <Swords className="w-5 h-5 text-primary" /> My Campaigns
            </h2>
            <Link href="/home">
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New Campaign
              </Button>
            </Link>
          </div>

          {campaignsLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Loading campaigns...</span>
            </div>
          ) : activeCampaigns.length === 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <NewCampaignCard />
              {/* Onboarding hint */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex flex-col gap-3">
                <Sparkles className="w-6 h-6 text-primary" />
                <h3 className="font-semibold text-sm">Create your first campaign</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choose a tone, world, and combat style. The AI Dungeon Master will build a living world around your choices.
                </p>
                <Link href="/home">
                  <Button size="sm" className="w-full gap-1.5 mt-auto">
                    <Swords className="w-3.5 h-3.5" /> Start Now
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCampaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} onArchive={(id, archive) => archiveMutation.mutate({ id, archive })} />
              ))}
              <NewCampaignCard />
            </div>
          )}
        </section>

        {/* Archived campaigns */}
        {archivedCampaigns.length > 0 && (
          <section className="mb-12">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <Archive className="w-4 h-4" />
              {showArchived ? "Hide" : "Show"} archived campaigns ({archivedCampaigns.length})
              <ChevronRight className={`w-3 h-3 transition-transform ${showArchived ? "rotate-90" : ""}`} />
            </button>
            {showArchived && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedCampaigns.map((c) => (
                  <CampaignCard key={c.id} campaign={c} onArchive={(id, archive) => archiveMutation.mutate({ id, archive })} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Quick join */}
        <section className="border-t border-border pt-10">
          <h2 className="font-serif text-xl font-bold text-foreground flex items-center gap-2 mb-4">
            <Hash className="w-5 h-5 text-primary" /> Quick Join
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Have an invite code from another player? Enter it below.</p>
          <div className="flex gap-2 max-w-sm">
            <Input
              placeholder="e.g. a1b2c3d4"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className="font-mono"
            />
            <Button onClick={handleJoin} className="shrink-0">Join</Button>
          </div>
          {joinError && <p className="text-destructive text-xs mt-2">{joinError}</p>}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>Dungeon Master OS</span>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link>
            <Link href="/billing" className="hover:text-foreground transition-colors">Billing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
