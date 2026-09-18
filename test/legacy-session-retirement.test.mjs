import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function runTsx(source, extraEnv = {}) {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-legacy-readiness-test-'));
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: path.join(dbDir, 'test.db'),
    JWT_SECRET: 'legacy-readiness-test-secret-with-enough-entropy',
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

test('legacy-only HTTP sessions record one sanitized upgrade event and migration evidence', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('./server/auth.ts'),
      import('better-sqlite3'),
    ]).then(([storageMod, auth, dbMod]) => {
      storageMod.runMigrations();
      const user = storageMod.storage.createUser({
        email: 'legacy-readiness@example.invalid',
        username: 'legacy_readiness',
        passwordHash: 'test-hash',
      });

      const legacy = auth.signToken(user.id);
      const written = [];
      const req = {
        cookies: { dmos_session: legacy },
        get(name) { return name === 'user-agent' ? 'RetirementReadiness/1.0' : undefined; },
      };
      const res = {
        cookie(name, value, options) { written.push({ name, value, options }); },
        clearCookie() {},
      };

      let nextCalls = 0;
      auth.attachUser(req, res, () => { nextCalls += 1; });

      if (nextCalls !== 1 || req.user?.id !== user.id) {
        throw new Error('legacy session failed to authenticate');
      }
      const opaque = written.find((cookie) => cookie.name === 'dmos_session_v2');
      if (!opaque) throw new Error('legacy session was not upgraded');

      const stats = storageMod.getLegacySessionMigrationStats();
      if (stats.activeOpaqueSessions !== 1) throw new Error('active opaque session count is wrong');
      if (stats.activeLegacyUpgradeSessions !== 1) throw new Error('active legacy-upgrade session count is wrong');
      if (stats.legacyUpgradesLast24Hours !== 1) throw new Error('24h legacy upgrade count is wrong');
      if (stats.legacyUpgradesLast7Days !== 1) throw new Error('7d legacy upgrade count is wrong');
      if (!stats.latestLegacyUpgradeAt) throw new Error('latest legacy upgrade timestamp is missing');

      const Database = dbMod.default;
      const db = new Database(process.env.DATABASE_URL);
      const events = db.prepare(
        "SELECT actor_user_id AS actorUserId, subject_user_id AS subjectUserId, metadata FROM security_events WHERE event_type = 'AUTH_LEGACY_SESSION_UPGRADED'"
      ).all();

      if (events.length !== 1) throw new Error('legacy upgrade audit event count is wrong');
      if (events[0].actorUserId !== user.id || events[0].subjectUserId !== user.id) {
        throw new Error('legacy upgrade audit ownership is wrong');
      }
      if (events[0].metadata !== '{}') {
        throw new Error('legacy upgrade event stored unnecessary metadata');
      }

      db.close();
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('migration evidence excludes expired and revoked sessions without exposing account identities', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('./server/session-service.ts'),
      import('./server/security-audit.ts'),
    ]).then(([storageMod, sessions, audit]) => {
      storageMod.runMigrations();
      const user = storageMod.storage.createUser({
        email: 'migration-stats@example.invalid',
        username: 'migration_stats',
        passwordHash: 'test-hash',
      });

      const active = sessions.createOpaqueSession(user.id, 'password');
      const legacyUpgrade = sessions.createOpaqueSession(user.id, 'legacy-jwt');
      const revoked = sessions.createOpaqueSession(user.id, 'legacy-jwt');
      sessions.revokeOpaqueSession(revoked.token);

      audit.recordSecurityEvent({
        eventType: 'AUTH_LEGACY_SESSION_UPGRADED',
        actorUserId: user.id,
        subjectUserId: user.id,
      });

      const stats = storageMod.getLegacySessionMigrationStats();
      if (stats.activeOpaqueSessions !== 2) throw new Error('revoked session leaked into active count');
      if (stats.activeLegacyUpgradeSessions !== 1) throw new Error('legacy active count is wrong');
      if (stats.legacyUpgradesLast24Hours !== 1 || stats.legacyUpgradesLast7Days !== 1) {
        throw new Error('upgrade evidence count is wrong');
      }

      for (const forbidden of ['userId', 'email', 'username', 'tokenHash', 'ipHash']) {
        if (forbidden in stats) throw new Error('migration stats exposed identity/session material: ' + forbidden);
      }

      if (!sessions.resolveOpaqueSession(active.token, { touch: false })) {
        throw new Error('active session unexpectedly changed');
      }
      if (!sessions.resolveOpaqueSession(legacyUpgrade.token, { touch: false })) {
        throw new Error('active legacy-upgrade session unexpectedly changed');
      }
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('legacy compatibility runtime flags are observable without exposing secret configuration', () => {
  const result = runTsx(`
    import('./server/auth.ts').then((auth) => {
      const status = auth.getLegacySessionCompatibilityConfig();
      if (status.accepting !== false) throw new Error('acceptance flag did not reflect runtime config');
      if (status.issuing !== false) throw new Error('issuance flag did not reflect runtime config');
      if (status.maximumLifetimeSeconds !== 7 * 24 * 60 * 60) {
        throw new Error('legacy maximum lifetime changed unexpectedly');
      }
      if (Object.keys(status).some((key) => /secret|token|cookie/i.test(key))) {
        throw new Error('compatibility status exposed secret-bearing fields');
      }
    });
  `, {
    AUTH_LEGACY_SESSION_ACCEPT: 'false',
    AUTH_LEGACY_SESSION_ISSUE: 'false',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('admin migration-status endpoint returns only aggregate retirement evidence', () => {
  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');
  const auth = readFileSync(path.join(repoRoot, 'server', 'auth.ts'), 'utf8');

  assert.match(
    routes,
    /\/api\/admin\/auth-migration-status", requirePermission\(PERMISSIONS\.ADMIN_ACCESS\)/,
  );
  assert.match(routes, /legacySessionCompatibility: getLegacySessionCompatibilityConfig\(\)/);
  assert.match(routes, /migrationEvidence: getLegacySessionMigrationStats\(\)/);
  assert.doesNotMatch(routes, /auth-migration-status[\s\S]{0,400}tokenHash/);
  assert.doesNotMatch(routes, /auth-migration-status[\s\S]{0,400}ipHash/);
  assert.match(auth, /eventType: ["']AUTH_LEGACY_SESSION_UPGRADED["']/);
});
