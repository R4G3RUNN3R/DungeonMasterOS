import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function runTsx(source, extraEnv = {}) {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-recent-auth-test-'));
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: path.join(dbDir, 'test.db'),
    JWT_SECRET: 'recent-auth-test-secret-with-enough-entropy',
    ...extraEnv,
  };
  const result = spawnSync(path.join(repoRoot, 'node_modules', '.bin', 'tsx'), ['-e', source], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
  rmSync(dbDir, { recursive: true, force: true });
  return result;
}

test('opaque sessions track credential authentication time separately from activity', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('./server/session-service.ts'),
    ]).then(([storageMod, sessions]) => {
      storageMod.runMigrations();
      const user = storageMod.storage.createUser({
        email: 'freshness@example.invalid',
        username: 'freshness_user',
        passwordHash: 'test-hash',
      });

      const fresh = sessions.createOpaqueSession(user.id, 'password');
      if (fresh.session.authenticatedAt !== fresh.session.createdAt) {
        throw new Error('new credential session was not marked freshly authenticated');
      }

      const oldAt = new Date(Date.now() - 60 * 60 * 1000);
      const old = sessions.createOpaqueSession(user.id, 'password', {
        authenticatedAt: oldAt,
      });
      const drift = Math.abs(Date.parse(old.session.authenticatedAt) - oldAt.getTime());
      if (drift > 5) throw new Error('explicit authentication time was not preserved');

      const before = old.session.lastSeenAt;
      sessions.resolveOpaqueSession(old.token);
      const after = sessions.resolveOpaqueSession(old.token, { touch: false });
      if (!after) throw new Error('session stopped resolving');
      if (after.authenticatedAt !== old.session.authenticatedAt) {
        throw new Error('ordinary session activity refreshed credential authentication time');
      }
      if (Date.parse(after.lastSeenAt) < Date.parse(before)) {
        throw new Error('last-seen time moved backwards');
      }
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('legacy JWT upgrade preserves original credential age instead of becoming freshly authenticated', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('./server/auth.ts'),
      import('jsonwebtoken'),
    ]).then(([storageMod, auth, jwtMod]) => {
      storageMod.runMigrations();
      const user = storageMod.storage.createUser({
        email: 'legacy-age@example.invalid',
        username: 'legacy_age_user',
        passwordHash: 'test-hash',
      });

      const jwt = jwtMod.default;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const issuedSeconds = nowSeconds - 60 * 60;
      const token = jwt.sign({
        sub: user.id,
        ver: user.authVersion,
        iat: issuedSeconds,
        exp: nowSeconds + 60 * 60,
      }, process.env.JWT_SECRET);

      const written = [];
      const req = {
        cookies: { dmos_session: token },
        get(name) { return name === 'user-agent' ? 'RecentAuthTest/1.0' : undefined; },
      };
      const res = {
        cookie(name, value, options) { written.push({ name, value, options }); },
        clearCookie() {},
      };

      auth.attachUser(req, res, () => {});
      if (!req.user || req.user.id !== user.id) throw new Error('legacy user did not authenticate');
      if (!req.authSession) throw new Error('legacy upgrade did not attach the new opaque session');

      const actualSeconds = Math.floor(Date.parse(req.authSession.authenticatedAt) / 1000);
      if (Math.abs(actualSeconds - issuedSeconds) > 1) {
        throw new Error('legacy upgrade reset authentication freshness');
      }
      if (Date.now() - Date.parse(req.authSession.authenticatedAt) < 50 * 60 * 1000) {
        throw new Error('old legacy credential was incorrectly treated as recent');
      }
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('recent-auth middleware rejects stale sessions and accepts freshly verified sessions', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('./server/session-service.ts'),
      import('./server/auth.ts'),
    ]).then(([storageMod, sessions, auth]) => {
      storageMod.runMigrations();
      const user = storageMod.storage.createUser({
        email: 'recent-middleware@example.invalid',
        username: 'recent_middleware',
        passwordHash: 'test-hash',
      });

      const fresh = sessions.createOpaqueSession(user.id, 'password');
      const stale = sessions.createOpaqueSession(user.id, 'password', {
        authenticatedAt: new Date(Date.now() - auth.RECENT_AUTH_MAX_AGE_MS - 60_000),
      });

      function run(session) {
        const result = { status: null, body: null, nextCalls: 0 };
        const req = { user, authSession: session };
        const res = {
          status(code) { result.status = code; return this; },
          json(body) { result.body = body; return body; },
        };
        auth.requireRecentAuthentication(req, res, () => { result.nextCalls += 1; });
        return result;
      }

      const freshResult = run(fresh.session);
      if (freshResult.nextCalls !== 1 || freshResult.status !== null) {
        throw new Error('fresh session was rejected');
      }

      const staleResult = run(stale.session);
      if (staleResult.status !== 403 || staleResult.body?.code !== 'RECENT_AUTH_REQUIRED') {
        throw new Error('stale session was not rejected');
      }
      if (staleResult.nextCalls !== 0) throw new Error('stale session reached protected action');
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('successful reauthentication refreshes only the current owned session', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('./server/session-service.ts'),
    ]).then(([storageMod, sessions]) => {
      storageMod.runMigrations();
      const user = storageMod.storage.createUser({
        email: 'reauth-service@example.invalid',
        username: 'reauth_service',
        passwordHash: 'test-hash',
      });
      const other = storageMod.storage.createUser({
        email: 'reauth-other@example.invalid',
        username: 'reauth_other',
        passwordHash: 'test-hash',
      });

      const oldAt = new Date(Date.now() - 60 * 60 * 1000);
      const current = sessions.createOpaqueSession(user.id, 'password', { authenticatedAt: oldAt });
      const sibling = sessions.createOpaqueSession(user.id, 'password', { authenticatedAt: oldAt });
      const foreign = sessions.createOpaqueSession(other.id, 'password', { authenticatedAt: oldAt });

      const refreshed = sessions.markOpaqueSessionReauthenticated(user.id, current.session.id);
      if (!refreshed) throw new Error('owned current session did not refresh');
      if (Date.now() - Date.parse(refreshed.authenticatedAt) > 10_000) {
        throw new Error('reauthentication timestamp was not refreshed');
      }

      const siblingAfter = sessions.resolveOpaqueSession(sibling.token, { touch: false });
      if (!siblingAfter || siblingAfter.authenticatedAt !== sibling.session.authenticatedAt) {
        throw new Error('reauthentication changed a sibling session');
      }

      if (sessions.markOpaqueSessionReauthenticated(user.id, foreign.session.id) !== null) {
        throw new Error('reauthentication modified another account session');
      }
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('privilege and entitlement mutations require recent authentication', () => {
  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');

  for (const route of [
    'set-access-role',
    'set-entitlements',
    'grant-dungeon-master',
    'revoke-dungeon-master',
  ]) {
    const pattern = new RegExp(
      '/api/admin/' + route +
      '", requirePermission\\(PERMISSIONS\\.[A-Z_]+\\), requireTrustedOrigin, requireRecentAuthentication, authSensitiveIpLimit'
    );
    assert.match(routes, pattern);
  }

  assert.match(
    routes,
    /"\/api\/auth\/reauthenticate",[\s\S]*?requireAuth,[\s\S]*?requireTrustedOrigin,[\s\S]*?authSensitiveIpLimit,[\s\S]*?authReauthUserLimit/,
  );
  assert.match(routes, /markOpaqueSessionReauthenticated\(user\.id, sessionId\)/);
  assert.match(routes, /eventType: ["']AUTH_REAUTH_SUCCESS["']/);
  assert.match(routes, /eventType: ["']AUTH_REAUTH_FAILED["']/);
});
