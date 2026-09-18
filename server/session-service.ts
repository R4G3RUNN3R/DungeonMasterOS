import { createHash, randomBytes } from "crypto";
import {
  createAuthSessionRecord,
  getAuthSessionByTokenHash,
  listActiveAuthSessionsForUser,
  revokeAllAuthSessionsForUser,
  revokeAuthSessionByIdForUser,
  revokeAuthSessionByTokenHash,
  touchAuthSession,
  storage,
  type AuthSessionRecord,
} from "./storage";

export const OPAQUE_SESSION_PREFIX = "dmosv2_";
export const OPAQUE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const TOUCH_INTERVAL_MS = 15 * 60 * 1000;

export type SessionAuthMethod = "password" | "register" | "google" | "legacy-jwt";

export type SessionMetadata = {
  userAgent?: string | null;
  ipHash?: string | null;
  expiresAt?: Date | string | null;
  authVersion?: number;
};

const MAX_USER_AGENT_LENGTH = 512;
const MAX_IP_HASH_LENGTH = 128;

function normalizeOptionalMetadata(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function generateOpaqueSessionToken(): string {
  return `${OPAQUE_SESSION_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashOpaqueSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function looksLikeOpaqueSessionToken(token: string): boolean {
  return (
    token.startsWith(OPAQUE_SESSION_PREFIX) &&
    token.length >= OPAQUE_SESSION_PREFIX.length + 40 &&
    token.length <= 128
  );
}

export function createOpaqueSession(
  userId: number,
  authMethod: SessionAuthMethod = "password",
  metadata: SessionMetadata = {},
): { token: string; session: AuthSessionRecord } {
  const token = generateOpaqueSessionToken();
  const now = new Date();
  const nowIso = now.toISOString();
  const maximumExpiry = now.getTime() + OPAQUE_SESSION_TTL_MS;
  const requestedExpiry =
    metadata.expiresAt instanceof Date
      ? metadata.expiresAt.getTime()
      : metadata.expiresAt
        ? Date.parse(metadata.expiresAt)
        : maximumExpiry;

  if (!Number.isFinite(requestedExpiry) || requestedExpiry <= now.getTime()) {
    throw new Error("Session expiry must be a valid future timestamp.");
  }

  const expiresAt = new Date(Math.min(requestedExpiry, maximumExpiry)).toISOString();
  const authVersion = metadata.authVersion ?? storage.getUser(userId)?.authVersion ?? 0;

  if (!Number.isInteger(authVersion) || authVersion < 0) {
    throw new Error("Session auth version must be a non-negative integer.");
  }

  const session = createAuthSessionRecord({
    tokenHash: hashOpaqueSessionToken(token),
    userId,
    authMethod,
    createdAt: nowIso,
    lastSeenAt: nowIso,
    expiresAt,
    revokedAt: null,
    userAgent: normalizeOptionalMetadata(metadata.userAgent, MAX_USER_AGENT_LENGTH),
    ipHash: normalizeOptionalMetadata(metadata.ipHash, MAX_IP_HASH_LENGTH),
    authVersion,
  });

  return { token, session };
}

export function resolveOpaqueSession(
  token: string,
  options: { touch?: boolean } = {},
): AuthSessionRecord | null {
  if (!looksLikeOpaqueSessionToken(token)) return null;

  const tokenHash = hashOpaqueSessionToken(token);
  const session = getAuthSessionByTokenHash(tokenHash);
  if (!session || session.revokedAt) return null;

  const now = Date.now();
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  if (options.touch !== false) {
    const lastSeenAt = Date.parse(session.lastSeenAt);
    if (!Number.isFinite(lastSeenAt) || now - lastSeenAt >= TOUCH_INTERVAL_MS) {
      const nextLastSeenAt = new Date(now).toISOString();
      touchAuthSession(session.id, nextLastSeenAt);
      return { ...session, lastSeenAt: nextLastSeenAt };
    }
  }

  return session;
}

export function revokeOpaqueSession(token: string): boolean {
  if (!looksLikeOpaqueSessionToken(token)) return false;
  return revokeAuthSessionByTokenHash(
    hashOpaqueSessionToken(token),
    new Date().toISOString(),
  );
}

export function revokeAllOpaqueSessionsForUser(userId: number): number {
  return revokeAllAuthSessionsForUser(userId, new Date().toISOString());
}


export function listActiveOpaqueSessionsForUser(userId: number): AuthSessionRecord[] {
  return listActiveAuthSessionsForUser(userId, new Date().toISOString());
}

export function revokeOpaqueSessionByIdForUser(
  userId: number,
  sessionId: number,
): boolean {
  if (!Number.isInteger(sessionId) || sessionId <= 0) return false;
  return revokeAuthSessionByIdForUser(
    sessionId,
    userId,
    new Date().toISOString(),
  );
}
