import type { NextFunction, Request, Response } from "express";

type RateLimitKey = (req: Request) => string | null | undefined;

type RateLimitOptions = {
  name: string;
  windowMs: number;
  maxAttempts: number;
  key: RateLimitKey;
  maxKeys?: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_MAX_KEYS = 10_000;

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function requestIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createFixedWindowRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, RateLimitBucket>();
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  let nextCleanupAt = 0;

  function cleanup(now: number): void {
    if (now < nextCleanupAt && buckets.size < maxKeys) return;

    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }

    while (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next().value as string | undefined;
      if (!oldest) break;
      buckets.delete(oldest);
    }

    nextCleanupAt = now + Math.min(options.windowMs, 60_000);
  }

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const rawKey = options.key(req);
    if (!rawKey) return next();

    const now = Date.now();
    cleanup(now);

    const key = `${options.name}:${rawKey}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return next();
    }

    if (current.count >= options.maxAttempts) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message: "Too many attempts. Try again later.",
        code: "RATE_LIMITED",
      });
    }

    current.count += 1;
    return next();
  };
}

function configuredAppOrigin(req: Request): string | null {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      if (process.env.NODE_ENV === "production") return null;
    }
  }

  const host = req.get("host");
  if (!host) return null;

  try {
    return new URL(`${req.protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

export function requireTrustedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const origin = req.get("origin");
  if (!origin) {
    // Non-browser clients commonly omit Origin. Cookie CSRF protection remains
    // enforced by SameSite and browser-origin requests are validated below.
    return next();
  }

  const allowedOrigin = configuredAppOrigin(req);
  if (!allowedOrigin || origin !== allowedOrigin) {
    return res.status(403).json({
      message: "Request origin is not allowed.",
      code: "ORIGIN_NOT_ALLOWED",
    });
  }

  return next();
}

export const authLoginIpLimit = createFixedWindowRateLimiter({
  name: "auth-login-ip",
  windowMs: 15 * 60 * 1000,
  maxAttempts: 60,
  key: (req) => requestIp(req),
});

export const authLoginIdentityLimit = createFixedWindowRateLimiter({
  name: "auth-login-identity",
  windowMs: 15 * 60 * 1000,
  maxAttempts: 12,
  key: (req) => normalizeEmail(req.body?.email) || null,
});

export const authRegisterIpLimit = createFixedWindowRateLimiter({
  name: "auth-register-ip",
  windowMs: 60 * 60 * 1000,
  maxAttempts: 20,
  key: (req) => requestIp(req),
});

export const authRecoveryIpLimit = createFixedWindowRateLimiter({
  name: "auth-recovery-ip",
  windowMs: 60 * 60 * 1000,
  maxAttempts: 20,
  key: (req) => requestIp(req),
});

export const authRecoveryIdentityLimit = createFixedWindowRateLimiter({
  name: "auth-recovery-identity",
  windowMs: 60 * 60 * 1000,
  maxAttempts: 6,
  key: (req) => normalizeEmail(req.body?.email) || null,
});

export const authResetIpLimit = createFixedWindowRateLimiter({
  name: "auth-reset-ip",
  windowMs: 60 * 60 * 1000,
  maxAttempts: 30,
  key: (req) => requestIp(req),
});

export const authSensitiveIpLimit = createFixedWindowRateLimiter({
  name: "auth-sensitive-ip",
  windowMs: 60 * 60 * 1000,
  maxAttempts: 30,
  key: (req) => requestIp(req),
});
