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
  isReadOnly,
  canPlay,
  type TierName,
  type SubscriptionStatus,
} from "../shared/tiers";
import type { User, PublicUser, UserRole } from "../shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "dmos-dev-secret-change-in-production";
const COOKIE_NAME = "dmos_session";

function isDungeonMasterRole(role: string | null | undefined): role is UserRole {
  return role === "dungeon_master";
}

export function hasDungeonMasterAccess(user?: Pick<User, "role" | "isAdmin"> | null): boolean {
  return !!user && (isDungeonMasterRole(user.role) || user.isAdmin);
}

function syncDungeonMasterFlags(user: User): User {
  if (!hasDungeonMasterAccess(user)) {
    return user;
  }

  const updates: Partial<User> = {};

  if (!isDungeonMasterRole(user.role)) {
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
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { sub: number } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
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

  // Auto-reset monthly usage counter
  if (user.usageResetAt) {
    if (new Date() >= new Date(user.usageResetAt)) {
      const nextReset = new Date();
      nextReset.setMonth(nextReset.getMonth() + 1);
      nextReset.setDate(1);
      nextReset.setHours(0, 0, 0, 0);
      storage.updateUser(user.id, {
        aiTurnsUsedThisMonth: 0,
        usageResetAt: nextReset.toISOString(),
      });
      user.aiTurnsUsedThisMonth = 0;
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
  if (hasDungeonMasterAccess(req.user)) {
    return next();
  }
  const status = req.user.subscriptionStatus as SubscriptionStatus;
  if (!canPlay(status)) {
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
  if (hasDungeonMasterAccess(req.user)) {
    return next();
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
  if (hasDungeonMasterAccess(user)) return next();
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
export function checkTurnLimit(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();
  const user = req.user;
  if (hasDungeonMasterAccess(user) || user.unlimitedTurns) return next();
  const tier = user.tier as TierName;
  const status = user.subscriptionStatus as SubscriptionStatus;
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const limits = getEffectiveLimits(tier, status, trialEndsAt);

  const totalTurns = limits.aiTurnsPerMonth + (user.bonusTurns ?? 0);

  if (user.aiTurnsUsedThisMonth >= totalTurns) {
    return res.status(403).json({
      message: `You've used your ${limits.aiTurnsPerMonth} DM responses this month. ${limits.upgradePrompt}`,
      code: "TURN_LIMIT",
      limit: totalTurns,
      used: user.aiTurnsUsedThisMonth,
      canTopUp: tier !== "free",
    });
  }
  next();
}

// ── Increment AI turn counter ──────────────────────────────────────────────
export function incrementTurnCount(userId: number): void {
  const user = storage.getUser(userId);
  if (!user) return;
  if (hasDungeonMasterAccess(user) || user.unlimitedTurns) return;
  // Decrement bonus turns first if any
  if ((user.bonusTurns ?? 0) > 0) {
    const tier = user.tier as TierName;
    const status = user.subscriptionStatus as SubscriptionStatus;
    const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
    const limits = getEffectiveLimits(tier, status, trialEndsAt);
    if (user.aiTurnsUsedThisMonth >= limits.aiTurnsPerMonth) {
      // Only deduct bonus if regular allowance is exhausted
      storage.updateUser(userId, {
        bonusTurns: Math.max(0, (user.bonusTurns ?? 0) - 1),
        aiTurnsUsedThisMonth: user.aiTurnsUsedThisMonth + 1,
      });
      return;
    }
  }
  storage.updateUser(userId, {
    aiTurnsUsedThisMonth: user.aiTurnsUsedThisMonth + 1,
  });
}

// ── Strip password from user ───────────────────────────────────────────────
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _pw, ...pub } = user;
  return pub;
}
