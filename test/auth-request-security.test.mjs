import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function runTsx(source, extraEnv = {}) {
  return spawnSync(path.join(repoRoot, 'node_modules', '.bin', 'tsx'), ['-e', source], {
    cwd: repoRoot,
    env: { ...process.env, NODE_ENV: 'test', ...extraEnv },
    encoding: 'utf8',
  });
}

test('fixed-window auth throttling enforces allowance, Retry-After, and key isolation', () => {
  const result = runTsx(`
    import('./server/security.ts').then(({ createFixedWindowRateLimiter }) => {
      function response() {
        return {
          statusCode: 200,
          body: null,
          headers: new Map(),
          setHeader(name, value) { this.headers.set(String(name).toLowerCase(), String(value)); },
          status(code) { this.statusCode = code; return this; },
          json(body) { this.body = body; return this; },
        };
      }

      function request(ip, email) {
        return {
          ip,
          body: { email },
          protocol: 'https',
          socket: { remoteAddress: ip },
          get() { return undefined; },
        };
      }

      const limiter = createFixedWindowRateLimiter({
        name: 'test',
        windowMs: 60000,
        maxAttempts: 2,
        key: (req) => req.ip,
      });

      const req = request('203.0.113.10', 'first@example.invalid');
      let nextCalls = 0;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const res = response();
        limiter(req, res, () => { nextCalls += 1; });
        if (res.statusCode !== 200) throw new Error('allowed request was blocked');
      }

      const blocked = response();
      limiter(req, blocked, () => { nextCalls += 1; });

      if (nextCalls !== 2) throw new Error('rate limiter allowed too many requests');
      if (blocked.statusCode !== 429) throw new Error('rate limiter did not return 429');
      if (blocked.body?.code !== 'RATE_LIMITED') throw new Error('rate limiter response code changed');
      if (Number(blocked.headers.get('retry-after')) < 1) throw new Error('Retry-After header missing');

      const identityLimiter = createFixedWindowRateLimiter({
        name: 'identity-test',
        windowMs: 60000,
        maxAttempts: 1,
        key: (candidate) => String(candidate.body?.email || '').toLowerCase(),
      });

      let identityNext = 0;
      identityLimiter(request('203.0.113.10', 'first@example.invalid'), response(), () => { identityNext += 1; });
      identityLimiter(request('203.0.113.10', 'second@example.invalid'), response(), () => { identityNext += 1; });
      if (identityNext !== 2) throw new Error('independent identities shared a bucket');
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('trusted-origin validation accepts canonical and origin-less clients but rejects cross-origin browsers', () => {
  const result = runTsx(`
    import('./server/security.ts').then(({ requireTrustedOrigin }) => {
      function response() {
        return {
          statusCode: 200,
          body: null,
          setHeader() {},
          status(code) { this.statusCode = code; return this; },
          json(body) { this.body = body; return this; },
        };
      }

      function request(origin) {
        return {
          protocol: 'https',
          socket: { remoteAddress: '203.0.113.10' },
          get(name) {
            const key = String(name).toLowerCase();
            if (key === 'origin') return origin;
            if (key === 'host') return 'dungeonmaster-os.com';
            return undefined;
          },
        };
      }

      let allowed = 0;
      requireTrustedOrigin(request('https://dungeonmaster-os.com'), response(), () => { allowed += 1; });
      requireTrustedOrigin(request(undefined), response(), () => { allowed += 1; });

      const rejected = response();
      requireTrustedOrigin(request('https://evil.example'), rejected, () => { allowed += 1; });

      if (allowed !== 2) throw new Error('trusted-origin allow behavior changed');
      if (rejected.statusCode !== 403) throw new Error('cross-origin request was not rejected');
      if (rejected.body?.code !== 'ORIGIN_NOT_ALLOWED') throw new Error('origin rejection code changed');
    });
  `, {
    APP_URL: 'https://dungeonmaster-os.com/app/path',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
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
