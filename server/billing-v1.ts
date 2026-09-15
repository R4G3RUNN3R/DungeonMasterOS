import type { Express } from "express";
import Stripe from "stripe";
import { applyWebhookEventOnce, storage } from "./storage";
import { attachUser, requireAuth, requireCanPlay } from "./auth";
import {
  TIERS,
  TURN_PACKS,
  PUBLIC_SUBSCRIPTION_TIERS,
  TOP_UP_SALES_ENABLED,
  getAiTurnAllowance,
  getNextTurnResetAt,
  type TierName,
  type PublicSubscriptionTier,
  type BillingInterval,
  type SubscriptionStatus,
} from "../shared/tiers";

let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

function isPublicSubscriptionTier(tier: unknown): tier is PublicSubscriptionTier {
  return typeof tier === "string" && (PUBLIC_SUBSCRIPTION_TIERS as readonly string[]).includes(tier);
}

function getStripePriceId(tier: TierName, interval: BillingInterval): string | null {
  const tierDef = TIERS[tier];
  if (!tierDef) return null;
  const envVarMap: Record<BillingInterval, string | undefined> = {
    monthly: tierDef.stripePriceIdMonthly,
    weekly: tierDef.stripePriceIdWeekly,
    yearly: tierDef.stripePriceIdYearly,
  };
  const envVarName = envVarMap[interval];
  return envVarName ? process.env[envVarName] || null : null;
}

function getStripePlanForPriceId(priceId: string): { tier: PublicSubscriptionTier; interval: BillingInterval } | null {
  for (const tier of PUBLIC_SUBSCRIPTION_TIERS) {
    for (const interval of ["weekly", "monthly", "yearly"] as const) {
      if (getStripePriceId(tier, interval) === priceId) return { tier, interval };
    }
  }
  return null;
}

function getTopUpPriceId(packId: string, tier: TierName): string | null {
  const turns = packId.replace("pack_", "");
  return process.env[`STRIPE_PRICE_TOPUP_${turns}_${tier.toUpperCase()}`] || null;
}

export function registerBillingV1Routes(app: Express): void {
  app.post("/api/stripe/webhook", async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe not configured." });
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(500).json({ message: "Webhook secret not configured." });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody || req.body,
        req.headers["stripe-signature"] as string,
        webhookSecret,
      );
    } catch (err: any) {
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = Number.parseInt(session.metadata?.userId || "0", 10);
          const tier = session.metadata?.tier as TierName | undefined;
          const interval = session.metadata?.interval;
          const topUpTurns = Number.parseInt(session.metadata?.topUpTurns || "0", 10);
          if (!userId) break;

          if (topUpTurns > 0) {
            applyWebhookEventOnce(event.id, event.type, () => {
              const user = storage.getUser(userId);
              if (user) storage.updateUser(userId, { bonusTurns: (user.bonusTurns ?? 0) + topUpTurns } as any);
            });
          } else if (tier && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            const billingInterval: BillingInterval = interval === "weekly" || interval === "yearly" ? interval : "monthly";
            const periodEnd = new Date((sub as any).current_period_end * 1000);
            applyWebhookEventOnce(event.id, event.type, () => {
              storage.updateUser(userId, {
                tier,
                subscriptionStatus: "active",
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                stripePriceId: sub.items.data[0]?.price?.id || null,
                stripeBillingInterval: billingInterval,
                subscriptionCurrentPeriodEnd: periodEnd.toISOString(),
                aiTurnsUsedThisMonth: 0,
                usageResetAt: getNextTurnResetAt(billingInterval).toISOString(),
              } as any);
            });
          } else {
            applyWebhookEventOnce(event.id, event.type, () => {});
          }
          break;
        }

        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const user = storage.getUserByStripeSubscriptionId(sub.id);
          if (!user) break;
          const periodEnd = new Date((sub as any).current_period_end * 1000);
          let status: SubscriptionStatus = "active";
          if (sub.status === "past_due") status = "past_due";
          else if (sub.status === "canceled") status = "cancelled";
          else if (sub.status === "unpaid") status = "expired";
          const priceId = sub.items.data[0]?.price?.id;
          const matchedPlan = priceId ? getStripePlanForPriceId(priceId) : null;
          const tier = matchedPlan?.tier ?? (user.tier as TierName);
          const billingInterval = matchedPlan?.interval ?? user.stripeBillingInterval;
          applyWebhookEventOnce(event.id, event.type, () => {
            storage.updateUser(user.id, {
              tier,
              subscriptionStatus: status,
              stripeSubscriptionId: sub.id,
              stripePriceId: priceId || null,
              stripeBillingInterval: billingInterval || null,
              subscriptionCurrentPeriodEnd: periodEnd.toISOString(),
            } as any);
          });
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const user = storage.getUserByStripeSubscriptionId(sub.id);
          if (!user) break;
          applyWebhookEventOnce(event.id, event.type, () => {
            storage.updateUser(user.id, {
              subscriptionStatus: "expired",
              tier: "free",
              stripeSubscriptionId: null,
              stripePriceId: null,
            } as any);
          });
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          if (!invoice.subscription) break;
          const user = storage.getUserByStripeSubscriptionId(invoice.subscription as string);
          if (!user) break;
          applyWebhookEventOnce(event.id, event.type, () => {
            storage.updateUser(user.id, { subscriptionStatus: "past_due" } as any);
          });
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          if (!invoice.subscription) break;
          const user = storage.getUserByStripeSubscriptionId(invoice.subscription as string);
          if (!user) break;
          const nextReset = getNextTurnResetAt(user.stripeBillingInterval);
          applyWebhookEventOnce(event.id, event.type, () => {
            storage.updateUser(user.id, {
              subscriptionStatus: "active",
              aiTurnsUsedThisMonth: 0,
              usageResetAt: nextReset.toISOString(),
            } as any);
          });
          break;
        }
      }
    } catch (err) {
      console.error("Error processing Stripe webhook:", err);
      return res.status(500).json({ message: "Webhook processing failed." });
    }

    return res.json({ received: true });
  });

  app.get("/api/billing/catalog", (_req, res) => {
    const subscriptions = PUBLIC_SUBSCRIPTION_TIERS.map((tier) => {
      const tierDef = TIERS[tier];
      return {
        tier,
        displayName: tierDef.displayName,
        prices: { weekly: tierDef.priceWeekly, monthly: tierDef.priceMonthly, yearly: tierDef.priceYearly },
        turns: {
          weekly: getAiTurnAllowance(tier, "active", null, "weekly").limit,
          monthly: getAiTurnAllowance(tier, "active", null, "monthly").limit,
          yearly: getAiTurnAllowance(tier, "active", null, "yearly").limit,
        },
        available: {
          weekly: Boolean(getStripePriceId(tier, "weekly")),
          monthly: Boolean(getStripePriceId(tier, "monthly")),
          yearly: Boolean(getStripePriceId(tier, "yearly")),
        },
      };
    });
    return res.json({ currency: "gbp", subscriptions, topUpsEnabled: TOP_UP_SALES_ENABLED });
  });

  app.post("/api/stripe/checkout", attachUser, requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe is not configured on this server." });
    const { tier, interval } = req.body as { tier?: TierName; interval?: BillingInterval };
    if (!tier || !interval) return res.status(400).json({ message: "tier and interval are required." });
    if (!isPublicSubscriptionTier(tier)) return res.status(400).json({ message: "This subscription tier is not currently available for purchase." });
    if (!["weekly", "monthly", "yearly"].includes(interval)) return res.status(400).json({ message: "Invalid billing interval." });
    const priceId = getStripePriceId(tier, interval);
    if (!priceId) return res.status(400).json({ message: `No Stripe price configured for ${tier} ${interval}.` });

    const user = req.user!;
    const appUrl = process.env.APP_URL || "http://localhost:5000";
    try {
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email, name: user.username, metadata: { userId: String(user.id) } });
        customerId = customer.id;
        storage.updateUser(user.id, { stripeCustomerId: customerId } as any);
      }
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/#/dashboard?subscribed=1`,
        cancel_url: `${appUrl}/#/pricing`,
        metadata: { userId: String(user.id), tier, interval },
        subscription_data: { metadata: { userId: String(user.id), tier, interval } },
        allow_promotion_codes: true,
      });
      return res.json({ url: session.url });
    } catch (err) {
      console.error("Stripe checkout error:", err);
      return res.status(500).json({ message: "Failed to create checkout session." });
    }
  });

  app.post("/api/stripe/portal", attachUser, requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe is not configured." });
    const user = req.user!;
    if (!user.stripeCustomerId) return res.status(400).json({ message: "No billing account found. Subscribe first." });
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${process.env.APP_URL || "http://localhost:5000"}/#/dashboard`,
      });
      return res.json({ url: session.url });
    } catch (err) {
      console.error("Stripe portal error:", err);
      return res.status(500).json({ message: "Failed to open billing portal." });
    }
  });

  app.post("/api/stripe/topup", attachUser, requireAuth, requireCanPlay, async (req, res) => {
    if (!TOP_UP_SALES_ENABLED) return res.status(409).json({ message: "Turn top-ups are not currently available." });
    if (!stripe) return res.status(503).json({ message: "Stripe is not configured." });
    const { packId } = req.body as { packId?: string };
    if (!packId) return res.status(400).json({ message: "packId is required." });
    const user = req.user!;
    const tier = user.tier as TierName;
    const pack = TURN_PACKS.find((item) => item.id === packId);
    if (!pack) return res.status(400).json({ message: "Invalid pack." });
    if (pack.prices[tier] === null) return res.status(403).json({ message: "Subscribe first to purchase turn top-ups." });
    const priceId = getTopUpPriceId(packId, tier);
    if (!priceId) return res.status(400).json({ message: "Top-up pricing for this pack is not configured. Contact support." });

    try {
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email, name: user.username, metadata: { userId: String(user.id) } });
        customerId = customer.id;
        storage.updateUser(user.id, { stripeCustomerId: customerId } as any);
      }
      const appUrl = process.env.APP_URL || "http://localhost:5000";
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/#/dashboard?topup=1`,
        cancel_url: `${appUrl}/#/dashboard`,
        metadata: { userId: String(user.id), topUpTurns: String(pack.turns), packId },
      });
      return res.json({ url: session.url });
    } catch (err) {
      console.error("Stripe topup error:", err);
      return res.status(500).json({ message: "Failed to create top-up checkout." });
    }
  });

  app.post("/api/stripe/cancel", attachUser, requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe is not configured." });
    const user = req.user!;
    if (!user.stripeSubscriptionId) return res.status(400).json({ message: "No active subscription found." });
    try {
      await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
      storage.updateUser(user.id, { subscriptionStatus: "cancelled" } as any);
      return res.json({ ok: true });
    } catch (err) {
      console.error("Cancel subscription error:", err);
      return res.status(500).json({ message: "Failed to cancel subscription." });
    }
  });

  app.get("/api/billing", attachUser, requireAuth, (req, res) => {
    const user = req.user!;
    const allowance = getAiTurnAllowance(
      user.tier as TierName,
      user.subscriptionStatus as SubscriptionStatus,
      user.trialEndsAt ? new Date(user.trialEndsAt) : null,
      user.stripeBillingInterval,
    );
    return res.json({
      tier: user.tier,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      stripeBillingInterval: user.stripeBillingInterval,
      aiTurnsUsedThisMonth: user.aiTurnsUsedThisMonth,
      aiTurnLimit: allowance.limit,
      aiTurnCadence: allowance.cadence,
      canTopUp: TOP_UP_SALES_ENABLED && user.tier !== "free",
      bonusTurns: user.bonusTurns ?? 0,
      hasStripe: Boolean(user.stripeCustomerId),
      hasSubscription: Boolean(user.stripeSubscriptionId),
    });
  });
}
