/**
 * Auth + Subscription middleware for DMOS
 *
 * - JWT stored in httpOnly cookie (7-day expiry)
 * - bcrypt password hashing (cost 12)
 * - Trial auto-expiry on each request
 * - Monthly usage counter auto-reset
 * - Tier enforcement: requireCanPlay, checkTurnLimit, incrementTurnCount
 * - Read-only mode for expired subscriptions (GET allowed, POST/PATCH/DELETE blocked)
 */

import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import {
  getEffectiveLimits,
  getIncludedTurns,
  getNextUsageResetAt,
  isReadOnly,
  canPlay,
  type BillingInterval,
  type TierName,
  type SubscriptionStatus,
} from "../shared/tiers";
import type { User, PublicUser } from "../shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "dmos-dev-secret-change-in-production";
const COOKIE_NAME = "dmos_session";

// ── Password utils ─────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT utils ──────────────────────────────────────────────────────────────
export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { sub: number } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload | string;
    const rawSub = typeof payload === "string" ? undefined : payload.sub;
    const sub = Number(rawSub);
    if (!Number.isFinite(sub)) return null;
    return { sub };
  } catch {
    return null;
  }
}

// ── Cookie helpers ─────────────────────────────────────────────────────────
export function setSessionCookie(res: Response, userId: number) {
  const token = signToken(userId);
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

// ── Request augmentation ───────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: User;
    }
  }
}

// ── Middleware: attach user from JWT cookie ────────────────────────────────
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  const payload = verifyToken(token);
  if (!payload) return next();

  const user = storage.getUser(payload.sub);
  if (!user) return next();

  // Auto-expire trial
  if (user.subscriptionStatus === "trial" && user.trialEndsAt) {
    if (new Date() > new Date(user.trialEndsAt)) {
      storage.updateUser(user.id, { subscriptionStatus: "expired" });
      user.subscriptionStatus = "expired";
    }
  }

  // Auto-reset usage at the current entitlement boundary
  if (user.usageResetAt) {
    if (new Date() >= new Date(user.usageResetAt)) {
      const interval: BillingInterval =
        user.stripeBillingInterval === "weekly" ||
        user.stripeBillingInterval === "yearly"
          ? user.stripeBillingInterval
          : "monthly";
      const nextReset = getNextUsageResetAt(interval);
      storage.updateUser(user.id, {
        aiTurnsUsedThisMonth: 0,
        usageResetAt: nextReset.toISOString(),
      });
      user.aiTurnsUsedThisMonth = 0;
      user.usageResetAt = nextReset.toISOString();
    }
  }

  req.userId = user.id;
  req.user = user;
  next();
}

// ── Middleware: require authenticated user ─────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      message: "Sign in to continue your adventure.",
      code: "UNAUTHENTICATED",
    });
  }
  next();
}

export function requireDungeonMaster(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      message: "Sign in to continue.",
      code: "UNAUTHENTICATED",
    });
  }

  if (!(req.user.isAdmin || req.user.role === "dungeon_master")) {
    return res.status(403).json({
      message: "DungeonMaster access is required for that action.",
      code: "DUNGEON_MASTER_REQUIRED",
    });
  }

  next();
}

// ── Middleware: require active subscription or trial ───────────────────────
export function requireCanPlay(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      message: "Sign in to continue.",
      code: "UNAUTHENTICATED",
    });
  }
  if (req.user.unlimitedTurns) return next();
  const status = req.user.subscriptionStatus as SubscriptionStatus;
  // Squire Pass turns (bonusTurns) are sold as one-time, no-expiry AI turns
  // — a user whose subscription has lapsed to "expired" must still be able
  // to spend any bonusTurns they separately paid for. checkTurnLimit does
  // the real per-request accounting (0 included turns for a non-playable
  // tier + remaining bonusTurns), so this only widens who reaches that
  // check, not how many turns anyone actually gets.
  if (!canPlay(status) && !((req.user.bonusTurns ?? 0) > 0)) {
    return res.status(402).json({
      message: "Your adventure awaits — subscribe to continue.",
      code: "SUBSCRIPTION_REQUIRED",
      status,
      readOnly: isReadOnly(status),
    });
  }
  next();
}

// ── Middleware: read-only for expired users ────────────────────────────────
export function allowReadOnlyForExpired(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Sign in to continue.", code: "UNAUTHENTICATED" });
  }
  const status = req.user.subscriptionStatus as SubscriptionStatus;
  if (isReadOnly(status) && req.method !== "GET") {
    return res.status(402).json({
      message: "Your subscription has ended. Subscribe to resume your campaigns.",
      code: "READ_ONLY",
      readOnly: true,
    });
  }
  next();
}

// ── Middleware: check campaign limit ───────────────────────────────────────
export function checkCampaignLimit(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();
  const user = req.user;
  const tier = user.tier as TierName;
  const status = user.subscriptionStatus as SubscriptionStatus;
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const limits = getEffectiveLimits(tier, status, trialEndsAt);

  const activeCampaigns = storage.getCampaignsByUser(user.id).filter((c) => !c.isArchived);
  if (activeCampaigns.length >= limits.activeCampaigns) {
    return res.status(403).json({
      message: `Your ${limits.displayName} plan supports ${limits.activeCampaigns} active campaign${limits.activeCampaigns === 1 ? "" : "s"}. ${limits.upgradePrompt}`,
      code: "CAMPAIGN_LIMIT",
      limit: limits.activeCampaigns,
      current: activeCampaigns.length,
    });
  }
  next();
}

// ── Middleware: check AI turn limit ───────────────────────────────────────
export interface CheckTurnLimitOptions {
  // The clientSubmissionId dedup bypass below is only safe on routes whose
  // handler has its own downstream dedup (createMessageIdempotent) that
  // returns the original result without consuming a new turn — that's
  // `/api/campaigns/:id/action`, and only that route. Any other route
  // guarded by this middleware (e.g. `/api/campaigns/:id/start`, which makes
  // a real, turn-incrementing AI call with no downstream dedup) must NOT
  // honor a replayed clientSubmissionId, or an over-quota user can replay
  // any of their own prior /action submission ids to get unlimited free
  // generations that keep incrementing their own counter. Opt in explicitly
  // per route rather than defaulting to on, so a future route added to this
  // middleware is bypass-safe unless it deliberately asks otherwise.
  dedupAware?: boolean;
}

export function checkTurnLimit(options: CheckTurnLimitOptions = {}) {
  return function checkTurnLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!req.user) return next();
    if (req.user.unlimitedTurns) return next();

    if (options.dedupAware) {
      const clientSubmissionId = typeof req.body?.clientSubmissionId === "string" ? req.body.clientSubmissionId : undefined;
      if (clientSubmissionId) {
        const campaignId = Number(req.params.id);
        const existing = storage.getMessageBySubmissionId(campaignId, clientSubmissionId);
        // A retry of an already-processed submission must not be blocked by the
        // turn limit even if the original submission used up the user's last
        // turn — handleAction's own dedup path returns the original result
        // without consuming a new turn, so there's nothing to protect here.
        if (existing) return next();
      }
    }

    const user = req.user;
    const tier = user.tier as TierName;
    const status = user.subscriptionStatus as SubscriptionStatus;
    const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
    const limits = getEffectiveLimits(tier, status, trialEndsAt);
    const interval: BillingInterval =
      user.stripeBillingInterval === "weekly" ||
      user.stripeBillingInterval === "yearly"
        ? user.stripeBillingInterval
        : "monthly";
    const includedTurns = getIncludedTurns(tier, interval);
    const totalTurns = includedTurns + (user.bonusTurns ?? 0);

    if (user.aiTurnsUsedThisMonth >= totalTurns) {
      return res.status(403).json({
        message: `You've used your ${includedTurns} included DM responses for this entitlement period. ${limits.upgradePrompt}`,
        code: "TURN_LIMIT",
        limit: totalTurns,
        used: user.aiTurnsUsedThisMonth,
        canTopUp: tier !== "free",
      });
    }
    next();
  };
}

// ── Increment AI turn counter ──────────────────────────────────────────────
export function incrementTurnCount(userId: number): void {
  const user = storage.getUser(userId);
  if (!user) return;

  const tier = user.tier as TierName;
  const interval: BillingInterval =
    user.stripeBillingInterval === "weekly" ||
    user.stripeBillingInterval === "yearly"
      ? user.stripeBillingInterval
      : "monthly";
  const includedTurns = getIncludedTurns(tier, interval);
  const useBonusTurn =
    (user.bonusTurns ?? 0) > 0 &&
    user.aiTurnsUsedThisMonth >= includedTurns;

  storage.recordTurnSpend(userId, useBonusTurn);
}

export function grantDungeonMasterAccess(userId: number): User | undefined {
  const user = storage.getUser(userId);
  if (!user) return undefined;

  storage.updateUser(userId, {
    role: "dungeon_master",
    isAdmin: true,
    unlimitedTurns: true,
  } as Partial<User>);

  return storage.getUser(userId);
}

export function revokeDungeonMasterAccess(userId: number): User | undefined {
  const user = storage.getUser(userId);
  if (!user) return undefined;

  storage.updateUser(userId, {
    role: "player",
    isAdmin: false,
    unlimitedTurns: false,
  } as Partial<User>);

  return storage.getUser(userId);
}

// ── Strip password from user ───────────────────────────────────────────────
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _pw, googleId: _googleId, ...pub } = user;
  return pub;
}
