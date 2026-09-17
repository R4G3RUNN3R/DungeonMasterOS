/**
 * Auth + Subscription middleware for DMOS
 *
 * - Revocable opaque session stored in httpOnly cookie (7-day expiry)
 * - Legacy JWT cookie retained temporarily for rollback-safe migration
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
import {
  createOpaqueSession,
  resolveOpaqueSession,
  revokeOpaqueSession,
  type SessionAuthMethod,
} from "./session-service";

export { hasDungeonMasterAccess } from "./access-policy";

const DEV_JWT_SECRET = "dmos-dev-secret-change-in-production";
const COOKIE_NAME = "dmos_session";
const OPAQUE_COOKIE_NAME = "dmos_session_v2";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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

// ── Legacy JWT compatibility ───────────────────────────────────────────────
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

function envFlag(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return defaultValue;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return defaultValue;
}

function acceptsLegacySessions(): boolean {
  return envFlag("AUTH_LEGACY_SESSION_ACCEPT", true);
}

function issuesLegacySessions(): boolean {
  return envFlag("AUTH_LEGACY_SESSION_ISSUE", true);
}

function sessionCookieOptions() {
  const secureCookies = useSecureCookies();
  return {
    httpOnly: true as const,
    secure: secureCookies,
    sameSite: (secureCookies ? "strict" : "lax") as "strict" | "lax",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

function setOpaqueSessionCookie(res: Response, token: string): void {
  res.cookie(OPAQUE_COOKIE_NAME, token, sessionCookieOptions());
}

function setLegacySessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, sessionCookieOptions());
}

// ── Cookie helpers ─────────────────────────────────────────────────────────
export function setSessionCookie(
  res: Response,
  userId: number,
  authMethod: SessionAuthMethod = "password",
): void {
  const legacyToken = issuesLegacySessions() ? signToken(userId) : null;

  try {
    const { token } = createOpaqueSession(userId, authMethod);
    setOpaqueSessionCookie(res, token);
  } catch (error) {
    // During the compatibility window the legacy session remains authoritative.
    // If opaque persistence is unavailable, preserve login availability rather
    // than converting an additive migration into an outage.
    console.error("Opaque session creation failed; using legacy session compatibility.", error);
    if (!legacyToken) {
      throw error;
    }
  }

  if (legacyToken) {
    setLegacySessionCookie(res, legacyToken);
  }
}

export function revokeRequestSession(req: Request): boolean {
  const token = req.cookies?.[OPAQUE_COOKIE_NAME];
  return typeof token === "string" && token.length > 0
    ? revokeOpaqueSession(token)
    : false;
}

export function clearSessionCookie(res: Response): void {
  const baseOptions = {
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
  res.clearCookie(OPAQUE_COOKIE_NAME, baseOptions);
  res.clearCookie(COOKIE_NAME, baseOptions);
}

function decodeCookieValue(rawValue: string): string | null {
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return null;
  }
}

function getCookieValueFromHeader(
  cookieHeader: string | undefined,
  cookieName: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const prefix = `${cookieName}=`;
  const part = cookieHeader
    .split(";")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith(prefix));
  if (!part) return undefined;
  return decodeCookieValue(part.slice(prefix.length)) ?? "";
}

export function getSessionUserIdFromCookieHeader(
  cookieHeader: string | undefined,
): number | null {
  const opaqueToken = getCookieValueFromHeader(cookieHeader, OPAQUE_COOKIE_NAME);
  if (opaqueToken !== undefined) {
    const session = resolveOpaqueSession(opaqueToken, { touch: false });
    if (!session) return null;
    return storage.getUser(session.userId)?.id ?? null;
  }

  if (!acceptsLegacySessions()) return null;

  const legacyToken = getCookieValueFromHeader(cookieHeader, COOKIE_NAME);
  if (!legacyToken) return null;
  const payload = verifyToken(legacyToken);
  if (!payload) return null;
  return storage.getUser(payload.sub)?.id ?? null;
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

// ── Middleware: attach user from v2 session or legacy JWT ──────────────────
export function attachUser(req: Request, res: Response, next: NextFunction) {
  const opaqueToken = req.cookies?.[OPAQUE_COOKIE_NAME];
  let rawUser: User | undefined;

  if (typeof opaqueToken === "string") {
    const session = resolveOpaqueSession(opaqueToken);
    if (!session) {
      // Never fall back to a legacy JWT when a v2 cookie is present but invalid
      // or revoked. Otherwise revoking the v2 session could resurrect it.
      return next();
    }
    rawUser = storage.getUser(session.userId);
  } else if (acceptsLegacySessions()) {
    const legacyToken = req.cookies?.[COOKIE_NAME];
    if (typeof legacyToken !== "string" || !legacyToken) return next();

    const payload = verifyToken(legacyToken);
    if (!payload) return next();

    rawUser = storage.getUser(payload.sub);
    if (rawUser) {
      try {
        const { token } = createOpaqueSession(rawUser.id, "legacy-jwt");
        setOpaqueSessionCookie(res, token);
      } catch (error) {
        // A valid legacy session must remain usable during the migration window.
        console.error("Legacy session upgrade to opaque session failed.", error);
      }
    }
  }

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
