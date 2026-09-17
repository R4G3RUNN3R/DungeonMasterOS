import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function runTsx(source, extraEnv = {}) {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-session-test-'));
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: path.join(dbDir, 'test.db'),
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

test('opaque sessions persist only a SHA-256 token hash and revoke immediately', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('./server/session-service.ts'),
      import('better-sqlite3'),
    ]).then(([storageMod, sessions, dbMod]) => {
      storageMod.runMigrations();
      const user = storageMod.storage.createUser({
        email: 'session-hash@example.invalid',
        username: 'session_hash_user',
        passwordHash: 'test-hash',
      });

      const created = sessions.createOpaqueSession(user.id, 'password');
      if (!created.token.startsWith('dmosv2_')) throw new Error('opaque token prefix missing');

      const Database = dbMod.default;
      const db = new Database(process.env.DATABASE_URL);
      const row = db.prepare(
        'SELECT token_hash AS tokenHash, user_id AS userId, revoked_at AS revokedAt FROM auth_sessions WHERE id = ?'
      ).get(created.session.id);

      if (!row) throw new Error('session row missing');
      if (row.tokenHash === created.token) throw new Error('raw session token was persisted');
      if (row.tokenHash !== sessions.hashOpaqueSessionToken(created.token)) throw new Error('persisted hash mismatch');
      if (row.userId !== user.id) throw new Error('session user mismatch');
      if (!sessions.resolveOpaqueSession(created.token)) throw new Error('fresh opaque session did not resolve');

      if (!sessions.revokeOpaqueSession(created.token)) throw new Error('session revocation reported no change');
      if (sessions.resolveOpaqueSession(created.token) !== null) throw new Error('revoked session still resolves');

      const revoked = db.prepare('SELECT revoked_at AS revokedAt FROM auth_sessions WHERE id = ?').get(created.session.id);
      if (!revoked?.revokedAt) throw new Error('revocation timestamp missing');
      db.close();
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('new login session creation issues both v2 and legacy cookies during rollback-safe compatibility', () => {
  const result = runTsx(`
    import('./server/storage.ts').then(async (storageMod) => {
      storageMod.runMigrations();
      const auth = await import('./server/auth.ts');
      const cookies = [];
      const res = {
        cookie(name, value, options) { cookies.push({ name, value, options }); },
        clearCookie() {},
      };

      auth.setSessionCookie(res, 123, 'password');

      const legacy = cookies.find((cookie) => cookie.name === 'dmos_session');
      const opaque = cookies.find((cookie) => cookie.name === 'dmos_session_v2');
      if (!legacy) throw new Error('legacy rollback cookie missing');
      if (!opaque) throw new Error('opaque v2 cookie missing');
      if (legacy.value.split('.').length !== 3) throw new Error('legacy compatibility cookie is not a JWT');
      if (!opaque.value.startsWith('dmosv2_')) throw new Error('opaque cookie has wrong format');
      if (!legacy.options.httpOnly || !opaque.options.httpOnly) throw new Error('session cookies must be HttpOnly');
      if (legacy.options.maxAge !== opaque.options.maxAge) throw new Error('cookie lifetimes diverged');
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('legacy HTTP sessions upgrade additively without replacing the rollback JWT', () => {
  const result = runTsx(`
    import('./server/storage.ts').then(async (storageMod) => {
      storageMod.runMigrations();
      const auth = await import('./server/auth.ts');
      const user = storageMod.storage.createUser({
        email: 'legacy-upgrade@example.invalid',
        username: 'legacy_upgrade_user',
        passwordHash: 'test-hash',
      });

      const legacy = auth.signToken(user.id);
      const written = [];
      const req = { cookies: { dmos_session: legacy } };
      const res = {
        cookie(name, value, options) { written.push({ name, value, options }); },
        clearCookie() {},
      };
      let nextCalls = 0;

      auth.attachUser(req, res, () => { nextCalls += 1; });

      if (nextCalls !== 1) throw new Error('auth middleware did not continue');
      if (req.user?.id !== user.id) throw new Error('legacy user was not authenticated');
      if (!written.some((cookie) => cookie.name === 'dmos_session_v2')) throw new Error('legacy session was not upgraded');
      if (written.some((cookie) => cookie.name === 'dmos_session')) throw new Error('legacy JWT was unexpectedly replaced during upgrade');
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('a revoked or invalid v2 cookie cannot be resurrected by a legacy JWT beside it', () => {
  const result = runTsx(`
    import('./server/storage.ts').then(async (storageMod) => {
      storageMod.runMigrations();
      const auth = await import('./server/auth.ts');
      const sessions = await import('./server/session-service.ts');
      const user = storageMod.storage.createUser({
        email: 'no-resurrection@example.invalid',
        username: 'no_resurrection_user',
        passwordHash: 'test-hash',
      });

      const created = sessions.createOpaqueSession(user.id, 'password');
      sessions.revokeOpaqueSession(created.token);
      const legacy = auth.signToken(user.id);
      const req = {
        cookies: {
          dmos_session_v2: created.token,
          dmos_session: legacy,
        },
      };
      const res = { cookie() {}, clearCookie() {} };
      let nextCalls = 0;

      auth.attachUser(req, res, () => { nextCalls += 1; });

      if (nextCalls !== 1) throw new Error('auth middleware did not continue');
      if (req.user) throw new Error('revoked v2 session was resurrected from legacy JWT');

      const header = `dmos_session_v2=${encodeURIComponent(created.token)}; dmos_session=${encodeURIComponent(legacy)}`;
      if (auth.getSessionUserIdFromCookieHeader(header) !== null) {
        throw new Error('WebSocket auth resurrected a revoked v2 session');
      }
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('WebSocket session resolution accepts v2 first and legacy-only clients during migration', () => {
  const result = runTsx(`
    import('./server/storage.ts').then(async (storageMod) => {
      storageMod.runMigrations();
      const auth = await import('./server/auth.ts');
      const sessions = await import('./server/session-service.ts');
      const user = storageMod.storage.createUser({
        email: 'ws-session@example.invalid',
        username: 'ws_session_user',
        passwordHash: 'test-hash',
      });

      const opaque = sessions.createOpaqueSession(user.id, 'password').token;
      const legacy = auth.signToken(user.id);

      const v2Header = `dmos_session_v2=${encodeURIComponent(opaque)}; dmos_session=${encodeURIComponent(legacy)}`;
      if (auth.getSessionUserIdFromCookieHeader(v2Header) !== user.id) {
        throw new Error('v2 WebSocket session did not resolve');
      }

      const legacyHeader = `dmos_session=${encodeURIComponent(legacy)}`;
      if (auth.getSessionUserIdFromCookieHeader(legacyHeader) !== user.id) {
        throw new Error('legacy-only WebSocket client lost migration compatibility');
      }
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('logout revokes the current v2 session and clears both compatibility cookies', () => {
  const result = runTsx(`
    import('./server/storage.ts').then(async (storageMod) => {
      storageMod.runMigrations();
      const auth = await import('./server/auth.ts');
      const sessions = await import('./server/session-service.ts');
      const created = sessions.createOpaqueSession(55, 'password');
      const req = { cookies: { dmos_session_v2: created.token } };
      const cleared = [];
      const res = {
        cookie() {},
        clearCookie(name) { cleared.push(name); },
      };

      if (!auth.revokeRequestSession(req)) throw new Error('logout did not revoke the v2 session');
      auth.clearSessionCookie(res);

      if (sessions.resolveOpaqueSession(created.token) !== null) throw new Error('logged-out session still resolves');
      if (!cleared.includes('dmos_session_v2')) throw new Error('v2 cookie was not cleared');
      if (!cleared.includes('dmos_session')) throw new Error('legacy cookie was not cleared');
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('legacy session compatibility can be disabled independently after the migration window', () => {
  const result = runTsx(`
    import('./server/storage.ts').then(async (storageMod) => {
      storageMod.runMigrations();
      const auth = await import('./server/auth.ts');
      const user = storageMod.storage.createUser({
        email: 'legacy-off@example.invalid',
        username: 'legacy_off_user',
        passwordHash: 'test-hash',
      });
      const legacy = auth.signToken(user.id);
      const header = `dmos_session=${encodeURIComponent(legacy)}`;
      if (auth.getSessionUserIdFromCookieHeader(header) !== null) {
        throw new Error('legacy JWT was accepted after compatibility was disabled');
      }
    });
  `, { AUTH_LEGACY_SESSION_ACCEPT: 'false' });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
