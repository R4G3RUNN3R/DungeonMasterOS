import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Crown, CreditCard, ChevronLeft, Loader2, AlertTriangle,
  CheckCircle, Gift, Plus, ExternalLink, Zap, RefreshCw,
} from "lucide-react";
import logoImg from "@assets/logo.png";
import { TIERS, TURN_PACKS, formatPrice, getEffectiveLimits, type TierName, type SubscriptionStatus } from "@shared/tiers";

export default function Billing() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [buyingTopUp, setBuyingTopUp] = useState<string | null>(null);

  if (!authLoading && !user) { navigate("/login"); return null; }

  const { data: billing, isLoading: billingLoading } = useQuery({
    queryKey: ["/api/billing"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  }) as { data: any; isLoading: boolean };

  const checkoutMutation = useMutation({
    mutationFn: async ({ tier, interval }: { tier: TierName; interval: string }) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { tier, interval });
      return res.json();
    },
    onSuccess: (data: any) => { if (data.url) window.location.href = data.url; },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/portal");
      return res.json();
    },
    onSuccess: (data: any) => { if (data.url) window.location.href = data.url; },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const topUpMutation = useMutation({
    mutationFn: async (packId: string) => {
      const res = await apiRequest("POST", "/api/stripe/topup", { packId });
      return res.json();
    },
    onSuccess: (data: any) => { if (data.url) window.location.href = data.url; },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); setBuyingTopUp(null); },
  });

  const tier = (billing?.tier || user?.tier || "free") as TierName;
  const status = (billing?.subscriptionStatus || user?.subscriptionStatus || "trial") as SubscriptionStatus;
  const tierDef = TIERS[tier];
  const limits = getEffectiveLimits(tier, status, user?.trialEndsAt ? new Date(user.trialEndsAt) : null);

  const statusColors: Record<string, string> = {
    trial: "bg-primary/10 text-primary border-primary/20",
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    past_due: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    cancelled: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    expired: "bg-destructive/10 text-destructive border-destructive/20",
  };

  if (authLoading || billingLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border px-6 py-3 flex items-center justify-between bg-background/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1 text-xs"><ChevronLeft className="w-4 h-4" /> Dashboard</Button>
          </Link>
          <span className="text-sm font-medium text-muted-foreground">Billing & Subscription</span>
        </div>
        <Link href="/">
          <img src={logoImg} alt="DMOS" className="w-7 h-7 rounded-lg" style={{ border: "1px solid #c4a26544" }} />
        </Link>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Current plan */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <Crown className="w-4 h-4 text-primary" /> Current Plan
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-serif text-2xl font-bold text-foreground">{tierDef.displayName}</span>
                <Badge className={`text-xs border capitalize ${statusColors[status] || statusColors.trial}`}>{status}</Badge>
              </div>
              {status === "trial" && user?.trialEndsAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Trial ends {new Date(user.trialEndsAt).toLocaleDateString()}
                </p>
              )}
              {billing?.subscriptionCurrentPeriodEnd && status === "active" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Renews {new Date(billing.subscriptionCurrentPeriodEnd).toLocaleDateString()}
                  {billing.stripeBillingInterval && ` · ${billing.stripeBillingInterval}`}
                </p>
              )}
              {billing?.subscriptionCurrentPeriodEnd && status === "cancelled" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Access until {new Date(billing.subscriptionCurrentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">AI Turns this month</p>
              <p className="font-mono text-lg font-bold text-foreground">
                {billing?.aiTurnsUsedThisMonth ?? 0} <span className="text-sm text-muted-foreground font-normal">/ {limits.aiTurnsPerMonth === 999 ? "∞" : limits.aiTurnsPerMonth}</span>
              </p>
              {(billing?.bonusTurns ?? 0) > 0 && (
                <p className="text-xs text-primary mt-0.5">+{billing.bonusTurns} bonus turns</p>
              )}
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-border flex flex-wrap gap-3">
            {billing?.hasSubscription ? (
              <Button variant="outline" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending} className="gap-2">
                {portalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage Subscription
              </Button>
            ) : (
              <Link href="/pricing">
                <Button className="gap-2">
                  <Crown className="w-4 h-4" /> Upgrade Plan
                </Button>
              </Link>
            )}
            {(status === "trial" || status === "expired") && (
              <Link href="/pricing">
                <Button variant="outline" className="gap-2">
                  <Zap className="w-4 h-4" /> Subscribe Now
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Plan features */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4">Your Plan Includes</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "Active Campaigns", value: limits.activeCampaigns === 999 ? "Unlimited" : limits.activeCampaigns },
              { label: "Players per Campaign", value: limits.playersPerCampaign },
              { label: "AI Turns per Month", value: limits.aiTurnsPerMonth === 999 ? "Unlimited" : limits.aiTurnsPerMonth.toLocaleString() },
              { label: "Message History Depth", value: limits.messageHistoryDepth === 99999 ? "Unlimited" : limits.messageHistoryDepth.toLocaleString() },
              { label: "Anime Worlds", value: limits.animeWorlds ? "✓ Included" : "✗ Not included" },
              { label: "Epic Mode", value: limits.epicMode ? "✓ Included" : "✗ Not included" },
              { label: "Homebrew Rules", value: limits.homebrewRules ? "✓ Included" : "✗ Not included" },
              { label: "Priority Responses", value: limits.priorityResponse ? "✓ Included" : "✗ Not included" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className={`text-sm font-medium ${typeof item.value === "string" && item.value.startsWith("✗") ? "text-muted-foreground" : "text-foreground"}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
          {tier !== "chronicler" && (
            <div className="mt-4">
              <Link href="/pricing">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Upgrade for more
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Top-up turns */}
        {status !== "expired" && tier !== "free" && (
          <div>
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" /> Buy More AI Turns
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Top up your AI turns any time. As a {tierDef.displayName} subscriber, you get {tierDef.topUpDiscountPct}% off all packs.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TURN_PACKS.filter((p) => p.prices[tier] !== null).map((pack) => {
                const price = pack.prices[tier];
                if (price === null) return null;
                return (
                  <div key={pack.id} className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-foreground">{pack.turns} turns</p>
                        <p className="text-xs text-muted-foreground">{pack.playTime}</p>
                      </div>
                      <p className="font-serif text-xl font-bold text-primary">{formatPrice(price)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1.5"
                      disabled={topUpMutation.isPending && buyingTopUp === pack.id}
                      onClick={() => { setBuyingTopUp(pack.id); topUpMutation.mutate(pack.id); }}
                    >
                      {topUpMutation.isPending && buyingTopUp === pack.id
                        ? <><Loader2 className="w-3 h-3 animate-spin" />Processing...</>
                        : <><Plus className="w-3 h-3" />Buy Pack</>
                      }
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upgrade to higher tiers (if applicable) */}
        {tier !== "chronicler" && status !== "expired" && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Want more turns and features?</h3>
                <p className="text-sm text-muted-foreground">{limits.upgradePrompt}</p>
              </div>
              <Link href="/pricing">
                <Button className="gap-2 shrink-0">
                  <Crown className="w-4 h-4" /> See Plans
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
