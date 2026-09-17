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
import { refundAiTurn, reserveAiTurn, storage, type AiTurnReservation } from "./storage";
import { getNextTurnResetAt } from "../shared/tiers";
import type { User, PublicUser } from "../shared/schema";
import { hasDungeonMasterAccess } from "./access-policy";
import {
  resolveAiEntitlement,
  resolveCampaignEntitlement,
  resolvePlayEntitlement,
} from "./entitlements";

export { hasDungeonMasterAccess } from "./access-policy";

const DEV_JWT_SECRET = "dmos-dev-secret-change-in-production";
const COOKIE_NAME = "dmos_session";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }

  return DEV_JWT_SECRET;
}

function syncDungeonMasterFlags(user: User): User {
  if (!hasDungeonMasterAccess(user)) {
    return user;
  }

  const updates: Partial<User> = {};

  if (user.role !== "dungeon_master") {
    updates.role = "dungeon_master";
  }
  if (!user.isAdmin) {
    updates.isAdmin = true;
  }
  if (!user.unlimitedTurns) {
    updates.unlimitedTurns = true;
  }

  if (Object.keys(updates).length === 0) {
    return user;
  }

  storage.updateUser(user.id, updates);
  return { ...user, ...updates };
}

export function grantDungeonMasterAccess(userId: number): User | undefined {
  const user = storage.getUser(userId);
  if (!user) return undefined;

  const updates: Partial<User> = {
    role: "dungeon_master",
    isAdmin: true,
    unlimitedTurns: true,
  };

  storage.updateUser(user.id, updates);
  return { ...user, ...updates };
}

export function revokeDungeonMasterAccess(userId: number): User | undefined {
  const user = storage.getUser(userId);
  if (!user) return undefined;

  const updates: Partial<User> = {
    role: "player",
    isAdmin: false,
    unlimitedTurns: false,
  };

  storage.updateUser(user.id, updates);
  return { ...user, ...updates };
}

function useSecureCookies(): boolean {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.NODE_ENV === "production";
}

// ── Password utils ─────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT utils ──────────────────────────────────────────────────────────────
export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): { sub: number } | null {
  try {
    const payload = jwt.verify(token, getJwtSecret());
    const sub =
      typeof payload === "string"
        ? Number(payload)
        : Number(payload?.sub);

    if (!Number.isInteger(sub)) {
      return null;
    }

    return { sub };
  } catch {
    return null;
  }
}

// ── Cookie helpers ─────────────────────────────────────────────────────────
export function setSessionCookie(res: Response, userId: number) {
  const token = signToken(userId);
  const secureCookies = useSecureCookies();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: secureCookies ? "strict" : "lax",
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

  const rawUser = storage.getUser(payload.sub);
  const user = rawUser ? syncDungeonMasterFlags(rawUser) : undefined;
  if (!user) return next();

  // Auto-expire trial
  if (user.subscriptionStatus === "trial" && user.trialEndsAt) {
    if (new Date() > new Date(user.trialEndsAt)) {
      storage.updateUser(user.id, { subscriptionStatus: "expired" });
      user.subscriptionStatus = "expired";
    }
  }

  // Reset the recurring turn allowance on the sold cadence. Trial accounts
  // expire before reset so a trial cannot silently refresh its allowance.
  if (user.usageResetAt && user.subscriptionStatus !== "expired") {
    if (new Date() >= new Date(user.usageResetAt)) {
      const nextReset = getNextTurnResetAt(user.stripeBillingInterval);
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

  if (!hasDungeonMasterAccess(req.user)) {
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
  const entitlement = resolvePlayEntitlement(req.user);
  if (!entitlement.canPlay) {
    return res.status(402).json({
      message: "Your adventure awaits — subscribe to continue.",
      code: "SUBSCRIPTION_REQUIRED",
      status: entitlement.status,
      readOnly: entitlement.readOnly,
    });
  }
  next();
}

// ── Middleware: read-only for expired users ────────────────────────────────
export function allowReadOnlyForExpired(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Sign in to continue.", code: "UNAUTHENTICATED" });
  }
  const entitlement = resolvePlayEntitlement(req.user);
  if (entitlement.readOnly && req.method !== "GET") {
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
  const entitlement = resolveCampaignEntitlement(user);
  if (entitlement.unlimited) return next();
  const limits = entitlement.limits;

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
export function checkTurnLimit(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();
  const user = req.user;
  const entitlement = resolveAiEntitlement(user);
  if (entitlement.unlimited) return next();
  const limits = entitlement.limits;
  const allowance = entitlement.allowance;
  const tier = user.tier;
  const cadenceText = allowance.cadence === "week" ? "week" : allowance.cadence === "trial" ? "trial" : "month";

  const regularExhausted =
    allowance.limit >= 0 && user.aiTurnsUsedThisMonth >= allowance.limit;

  if (regularExhausted && (user.bonusTurns ?? 0) <= 0) {
    return res.status(403).json({
      message: `You've used your ${allowance.limit} DM responses this ${cadenceText}. ${limits.upgradePrompt}`,
      code: "TURN_LIMIT",
      limit: allowance.limit,
      used: user.aiTurnsUsedThisMonth,
      bonusRemaining: user.bonusTurns ?? 0,
      canTopUp: entitlement.canTopUp,
    });
  }
  next();
}

export type TurnClaim = AiTurnReservation | "unlimited";

export function claimTurn(user: User):
  | { ok: true; claim: TurnClaim }
  | { ok: false; body: Record<string, unknown> } {
  const entitlement = resolveAiEntitlement(user);
  if (entitlement.unlimited) {
    return { ok: true, claim: "unlimited" };
  }

  const tier = user.tier;
  const limits = entitlement.limits;
  const allowance = entitlement.allowance;
  const claim = reserveAiTurn(user.id, allowance.limit);

  if (claim) {
    return { ok: true, claim };
  }

  const fresh = storage.getUser(user.id) ?? user;
  return {
    ok: false,
    body: {
      message: `You've used your ${allowance.limit} DM responses this ${allowance.cadence === "week" ? "week" : allowance.cadence === "trial" ? "trial" : "month"}. ${limits.upgradePrompt}`,
      code: "TURN_LIMIT",
      limit: allowance.limit,
      used: fresh.aiTurnsUsedThisMonth,
      bonusRemaining: fresh.bonusTurns ?? 0,
      canTopUp: entitlement.canTopUp,
    },
  };
}

export function releaseTurnClaim(userId: number, claim: TurnClaim): void {
  if (claim === "unlimited") return;
  refundAiTurn(userId, claim);
}

// ── Strip password from user ───────────────────────────────────────────────
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _pw, googleId: _googleId, ...pub } = user;
  return pub;
}
