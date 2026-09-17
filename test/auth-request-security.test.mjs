import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function fakeResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: new Map(),
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), String(value));
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function fakeRequest({ ip = '203.0.113.10', body = {}, origin, host = 'dungeonmaster-os.com', protocol = 'https' } = {}) {
  return {
    ip,
    body,
    protocol,
    socket: { remoteAddress: ip },
    get(name) {
      const key = String(name).toLowerCase();
      if (key === 'origin') return origin;
      if (key === 'host') return host;
      return undefined;
    },
  };
}

test('fixed-window limiter blocks only after the configured allowance and emits Retry-After', async () => {
  const { createFixedWindowRateLimiter } = await import('../server/security.ts');
  const limiter = createFixedWindowRateLimiter({
    name: 'test',
    windowMs: 60_000,
    maxAttempts: 2,
    key: (req) => req.ip,
  });

  const req = fakeRequest();
  let nextCalls = 0;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const res = fakeResponse();
    limiter(req, res, () => { nextCalls += 1; });
    assert.equal(res.statusCode, 200);
  }

  const blocked = fakeResponse();
  limiter(req, blocked, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body?.code, 'RATE_LIMITED');
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
});

test('rate-limit identities are isolated from one another', async () => {
  const { createFixedWindowRateLimiter } = await import('../server/security.ts');
  const limiter = createFixedWindowRateLimiter({
    name: 'identity-test',
    windowMs: 60_000,
    maxAttempts: 1,
    key: (req) => String(req.body?.email || '').toLowerCase(),
  });

  let nextCalls = 0;
  limiter(fakeRequest({ body: { email: 'first@example.invalid' } }), fakeResponse(), () => { nextCalls += 1; });
  limiter(fakeRequest({ body: { email: 'second@example.invalid' } }), fakeResponse(), () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
});

test('trusted-origin middleware accepts canonical and origin-less clients but rejects cross-origin browsers', async () => {
  const previousAppUrl = process.env.APP_URL;
  process.env.APP_URL = 'https://dungeonmaster-os.com/app/path';

  try {
    const { requireTrustedOrigin } = await import('../server/security.ts');

    let allowed = 0;
    requireTrustedOrigin(
      fakeRequest({ origin: 'https://dungeonmaster-os.com' }),
      fakeResponse(),
      () => { allowed += 1; },
    );
    requireTrustedOrigin(
      fakeRequest({ origin: undefined }),
      fakeResponse(),
      () => { allowed += 1; },
    );

    const rejected = fakeResponse();
    requireTrustedOrigin(
      fakeRequest({ origin: 'https://evil.example' }),
      rejected,
      () => { allowed += 1; },
    );

    assert.equal(allowed, 2);
    assert.equal(rejected.statusCode, 403);
    assert.equal(rejected.body?.code, 'ORIGIN_NOT_ALLOWED');
  } finally {
    if (previousAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousAppUrl;
  }
});

test('all state-changing auth routes consume the intended origin and throttle middleware', () => {
  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');

  assert.match(routes, /\/api\/auth\/register", requireTrustedOrigin, authRegisterIpLimit/);
  assert.match(routes, /\/api\/auth\/login", requireTrustedOrigin, authLoginIpLimit, authLoginIdentityLimit/);
  assert.match(routes, /\/api\/auth\/logout", requireTrustedOrigin/);
  assert.match(routes, /\/api\/auth\/complete-onboarding", requireAuth, requireTrustedOrigin, authSensitiveIpLimit/);
  assert.match(routes, /\/api\/auth\/change-password", requireAuth, requireTrustedOrigin, authSensitiveIpLimit/);
  assert.match(routes, /\/api\/auth\/forgot-password", requireTrustedOrigin, authRecoveryIpLimit, authRecoveryIdentityLimit/);
  assert.match(routes, /\/api\/auth\/reset-password", requireTrustedOrigin, authResetIpLimit/);
});
