import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Check, Swords, ChevronDown, ChevronUp, Star, Crown, Loader2, Sparkles } from "lucide-react";
import { TIERS, formatPrice, getIncludedTurns, SQUIRE_PASS, type TierName, type BillingInterval } from "@shared/tiers";
import logoImg from "@assets/logo.png";

const TIER_ORDER: TierName[] = ["adventurer", "master", "legend"];

const faqs = [
  { q: "Can I cancel anytime?", a: "Yes — cancel anytime with no fees. Access continues until the end of your paid period." },
  { q: "Do all players need to subscribe?", a: "Only the campaign host needs to pay. Players join for free using an invite code, up to your plan's players-per-campaign limit (2 to 6 depending on tier, including the host)." },
  { q: "What game systems does it support?", a: "Any system. D&D 5e, Pathfinder, anime power systems (Naruto, One Piece), homebrew rules, narrative-only — paste your character sheet and the DM adapts." },
  { q: "What's the difference between Squire Pass and a subscription?", a: `Squire Pass is a one-time ${formatPrice(SQUIRE_PASS.price)} purchase for ${SQUIRE_PASS.turns} AI DM turns — no recurring billing, ideal for a single one-shot session. Subscriptions renew automatically and refill your turns every billing period.` },
  { q: "Why do weekly plans include fewer turns than monthly?", a: "Weekly billing includes a smaller turn allotment per period so your total cost scales with how often you actually play. Monthly and yearly plans include the full monthly allotment every period." },
  { q: "What happens if I lose internet mid-session?", a: "Sessions are persisted server-side. Reconnect and the DM will pick up exactly where you left off." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-left text-sm font-medium text-foreground hover:text-primary transition-colors gap-4"
      >
        <span>{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <p className="pb-4 text-sm text-muted-foreground leading-relaxed pr-8">{a}</p>}
    </div>
  );
}

function getTierFeatures(tierName: TierName, interval: BillingInterval): string[] {
  const t = TIERS[tierName];
  const turnUnit = interval === "weekly" ? "week" : "month";
  const features = [
    `${t.activeCampaigns >= 999 ? "Unlimited" : t.activeCampaigns} active campaign${t.activeCampaigns === 1 ? "" : "s"}`,
    `${getIncludedTurns(tierName, interval)} AI turns/${turnUnit}`,
    `${t.playersPerCampaign} player${t.playersPerCampaign === 1 ? "" : "s"} per campaign`,
    `${t.messageHistoryDepth >= 99999 ? "Unlimited" : t.messageHistoryDepth.toLocaleString()}-message context`,
  ];
  if (t.customWorldPrompt) features.push("Custom worlds");
  if (t.homebrewRules) features.push("Homebrew rules");
  if (t.exportSessions) features.push("Export sessions");
  if (t.animeWorlds) features.push("Anime worlds");
  if (t.epicMode) features.push("Epic mode");
  if (t.allWorldModes) features.push("All world modes");
  if (t.priorityResponse) features.push("Priority responses");
  if (t.earlyAccess) features.push("Early access");
  return features;
}

export default function Pricing() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [subscribingTier, setSubscribingTier] = useState<TierName | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: async ({ tier, interval }: { tier: TierName; interval: string }) => {
      if (!user) { navigate("/register"); return; }
      const res = await apiRequest("POST", "/api/stripe/checkout", { tier, interval });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setSubscribingTier(null);
    },
  });

  const squireMutation = useMutation({
    mutationFn: async () => {
      if (!user) { navigate("/register"); return; }
      const res = await apiRequest("POST", "/api/stripe/squire");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubscribe = (tier: TierName) => {
    if (!user) { navigate("/register"); return; }
    setSubscribingTier(tier);
    checkoutMutation.mutate({ tier, interval });
  };

  const getPriceForInterval = (tier: TierName): number => {
    const t = TIERS[tier];
    if (interval === "weekly") return t.priceWeekly;
    if (interval === "yearly") return Math.round(t.priceYearly / 12);
    return t.priceMonthly;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background/90 backdrop-blur-md z-40">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
            <img src={logoImg} alt="DMOS" className="w-8 h-8 rounded-lg" style={{ border: "1px solid #c4a26544" }} />
            <span className="font-serif font-bold text-foreground tracking-tight text-sm">Dungeon Master OS</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/how-it-works"><Button variant="ghost" size="sm" className="text-xs text-muted-foreground">How It Works</Button></Link>
          {user ? (
            <Link href="/dashboard"><Button size="sm" className="text-xs">Dashboard</Button></Link>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm" className="text-xs">Sign In</Button></Link>
              <Link href="/register"><Button size="sm" className="text-xs">Get Started</Button></Link>
            </>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-primary text-sm font-medium mb-4">
            <Star className="w-4 h-4" /> Honest, transparent pricing
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight mb-5">Choose Your Adventure</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed mb-8">
            Grab a one-time Squire Pass to try a session, or subscribe for ongoing campaigns. Players always join for free.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            {(["weekly", "monthly", "yearly"] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors relative ${interval === iv ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {iv === "yearly" ? "Yearly" : iv === "monthly" ? "Monthly" : "Weekly"}
                {iv === "monthly" && <span className="absolute -top-2.5 -right-2 text-xs bg-green-500 text-white px-1 rounded-full">-17%</span>}
                {iv === "yearly" && <span className="absolute -top-2.5 -right-2 text-xs bg-green-500 text-white px-1 rounded-full">-30%</span>}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Billing toggle applies to subscriptions — Squire Pass is a flat one-time price.</p>
        </div>

        {/* Tier cards */}
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-4 mb-20">
          {/* Squire Pass — one-time purchase, not a subscription tier */}
          <div className="bg-card rounded-xl p-6 flex flex-col relative border border-border">
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{SQUIRE_PASS.displayName}</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-serif text-3xl font-bold text-foreground">{formatPrice(SQUIRE_PASS.price)}</span>
                <span className="text-muted-foreground text-xs mb-1">one-time</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">A single solo session, no subscription required</p>
            </div>

            <ul className="space-y-2 mb-6 flex-1">
              {[`${SQUIRE_PASS.turns} AI DM turns, no expiry`, "Solo play", "No recurring billing", "Upgrade to a subscription anytime"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />{f}
                </li>
              ))}
            </ul>

            <Button
              className="w-full text-xs"
              variant="outline"
              onClick={() => squireMutation.mutate()}
              disabled={squireMutation.isPending}
            >
              {squireMutation.isPending ? (
                <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Processing...</>
              ) : (
                <><Sparkles className="w-3 h-3 mr-1.5" />Buy Squire Pass</>
              )}
            </Button>
          </div>

          {TIER_ORDER.map((tierName) => {
            const tierDef = TIERS[tierName];
            const price = getPriceForInterval(tierName);
            const isMostPopular = tierName === "master";
            const isCurrent = user?.tier === tierName;
            const features = getTierFeatures(tierName, interval);

            return (
              <div
                key={tierName}
                className={`bg-card rounded-xl p-6 flex flex-col relative ${isMostPopular ? "border-2 border-primary" : "border border-border"}`}
              >
                {tierDef.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {tierDef.badge}
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    Current
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{tierDef.displayName}</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="font-serif text-3xl font-bold text-foreground">{formatPrice(price)}</span>
                    <span className="text-muted-foreground text-xs mb-1">/{interval === "weekly" ? "wk" : "mo"}</span>
                  </div>
                  {interval === "yearly" && (
                    <p className="text-xs text-green-400">Billed {formatPrice(TIERS[tierName].priceYearly)}/yr &middot; turns replenish monthly</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{tierDef.tagline}</p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full text-xs"
                  variant={isMostPopular ? "default" : "outline"}
                  onClick={() => handleSubscribe(tierName)}
                  disabled={isCurrent || (checkoutMutation.isPending && subscribingTier === tierName)}
                >
                  {checkoutMutation.isPending && subscribingTier === tierName ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Processing...</>
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : (
                    <>
                      <Crown className="w-3 h-3 mr-1.5" />
                      {interval === "yearly" ? "Subscribe Yearly" : interval === "weekly" ? "Subscribe Weekly" : "Subscribe Monthly"}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Comparison note */}
        <div className="text-center mb-20 text-sm text-muted-foreground">
          <p>All plans include: WebSocket real-time sessions · Parchment character sheets · 3D dice roller · Active effects tracker · Spell sheet · Item system</p>
          <p className="mt-1">Campaign data is <span className="text-foreground">never deleted</span> — expired subscriptions become read-only, not erased.</p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-2xl font-bold tracking-tight text-center mb-8">Frequently Asked Questions</h2>
          <div className="bg-card border border-border rounded-xl px-6">
            {faqs.map((faq) => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center mt-20 py-16 border-t border-border">
          <h2 className="font-serif text-3xl font-bold mb-4">Ready to play?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">Your party can join for free. You just need to host.</p>
          <Link href={user ? "/dashboard" : "/register"}>
            <Button size="lg" className="px-8 gap-2">
              <Swords className="w-4 h-4" />
              {user ? "Go to Dashboard" : "Get Started"}
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-4">No subscription required to start · Cancel anytime</p>
        </div>
      </main>
    </div>
  );
}
