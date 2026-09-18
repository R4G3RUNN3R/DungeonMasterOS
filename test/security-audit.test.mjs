import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function runTsx(source) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dmos-audit-test-'));
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: path.join(dir, 'audit.db'),
  };
  const result = spawnSync(path.join(repoRoot, 'node_modules', '.bin', 'tsx'), ['-e', source], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
  rmSync(dir, { recursive: true, force: true });
  return result;
}

test('security events persist actor/subject ids with sanitized metadata only', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('./server/security-audit.ts'),
      import('better-sqlite3'),
    ]).then(([storageMod, audit, dbMod]) => {
      storageMod.runMigrations();
      const actor = storageMod.storage.createUser({
        email: 'actor@example.invalid',
        username: 'audit_actor',
        passwordHash: 'hash',
      });
      const subject = storageMod.storage.createUser({
        email: 'subject@example.invalid',
        username: 'audit_subject',
        passwordHash: 'hash',
      });

      const event = audit.recordSecurityEvent({
        eventType: 'DUNGEON_MASTER_GRANTED',
        actorUserId: actor.id,
        subjectUserId: subject.id,
        metadata: { method: 'admin-action', changed: true },
      });

      const Database = dbMod.default;
      const db = new Database(process.env.DATABASE_URL);
      const row = db.prepare(
        'SELECT actor_user_id AS actorUserId, subject_user_id AS subjectUserId, event_type AS eventType, metadata FROM security_events WHERE id = ?'
      ).get(event.id);

      if (!row) throw new Error('security event was not persisted');
      if (row.actorUserId !== actor.id) throw new Error('audit actor mismatch');
      if (row.subjectUserId !== subject.id) throw new Error('audit subject mismatch');
      if (row.eventType !== 'DUNGEON_MASTER_GRANTED') throw new Error('audit event type mismatch');

      const metadata = JSON.parse(row.metadata);
      if (metadata.method !== 'admin-action' || metadata.changed !== true) {
        throw new Error('safe audit metadata changed');
      }
      if (row.metadata.includes('actor@example.invalid') || row.metadata.includes('subject@example.invalid')) {
        throw new Error('email leaked into audit metadata');
      }

      db.close();
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('security audit metadata rejects credential and identity-bearing keys', () => {
  const result = runTsx(`
    import('./server/security-audit.ts').then(({ encodeSecurityEventMetadata }) => {
      for (const key of ['password', 'token', 'cookie', 'authorization', 'apiKey', 'email']) {
        let rejected = false;
        try {
          encodeSecurityEventMetadata({ [key]: 'must-not-be-stored' });
        } catch {
          rejected = true;
        }
        if (!rejected) throw new Error('sensitive audit key was accepted: ' + key);
      }

      const safe = encodeSecurityEventMetadata({ reason: 'credentials', method: 'password' });
      if (safe !== '{"reason":"credentials","method":"password"}') {
        throw new Error('safe metadata encoding changed');
      }
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('auth and privilege routes emit the expected security events without error payloads', () => {
  const routes = readFileSync(path.join(repoRoot, 'server', 'routes.ts'), 'utf8');

  for (const eventType of [
    'AUTH_REGISTER_SUCCESS',
    'AUTH_LOGIN_SUCCESS',
    'AUTH_LOGIN_FAILED',
    'AUTH_GOOGLE_SUCCESS',
    'AUTH_GOOGLE_FAILED',
    'AUTH_LOGOUT',
    'AUTH_REAUTH_SUCCESS',
    'AUTH_REAUTH_FAILED',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET',
    'ACCESS_ROLE_CHANGED',
    'ENTITLEMENTS_CHANGED',
    'DUNGEON_MASTER_GRANTED',
    'DUNGEON_MASTER_REVOKED',
  ]) {
    assert.match(routes, new RegExp('eventType: ["\\\']' + eventType + '["\\\']'));
  }

  assert.doesNotMatch(routes, /safeRecordSecurityEvent\([\s\S]*?metadata:\s*\{\s*email:/);
  assert.doesNotMatch(routes, /safeRecordSecurityEvent\([\s\S]*?metadata:\s*\{\s*(?:token|password|cookie|authorization):/);

  assert.match(
    routes,
    /\/api\/admin\/grant-dungeon-master", requirePermission\(PERMISSIONS\.ADMIN_ROLES_MANAGE\), requireTrustedOrigin, requireRecentAuthentication, authSensitiveIpLimit/,
  );
  assert.match(
    routes,
    /\/api\/admin\/revoke-dungeon-master", requirePermission\(PERMISSIONS\.ADMIN_ROLES_MANAGE\), requireTrustedOrigin, requireRecentAuthentication, authSensitiveIpLimit/,
  );
  assert.match(
    routes,
    /\/api\/admin\/set-access-role", requirePermission\(PERMISSIONS\.ADMIN_ROLES_MANAGE\), requireTrustedOrigin, requireRecentAuthentication, authSensitiveIpLimit/,
  );
  assert.match(
    routes,
    /\/api\/admin\/set-entitlements", requirePermission\(PERMISSIONS\.ADMIN_ENTITLEMENTS_MANAGE\), requireTrustedOrigin, requireRecentAuthentication, authSensitiveIpLimit/,
  );
  assert.match(routes, /eventType: ["']ENTITLEMENTS_CHANGED["']/);
  assert.match(routes, /reasonCode: parsed\.data\.reasonCode/);
  assert.match(routes, /metadata:\s*\{[\s\S]*?fromRole: target\.accessRole,[\s\S]*?toRole: updated\.accessRole/);

  // No-op role requests must not create false privilege-change audit history.
  assert.match(routes, /const changed = updated\.accessRole !== target\.accessRole;/);
  assert.match(
    routes,
    /if \(changed\) \{[\s\S]*?eventType: ["']DUNGEON_MASTER_GRANTED["']/,
  );
  assert.match(
    routes,
    /if \(changed\) \{[\s\S]*?eventType: ["']DUNGEON_MASTER_REVOKED["']/,
  );
  assert.match(routes, /return res\.json\(\{ user: toPublicUser\(updated\), changed \}\);/);
});
