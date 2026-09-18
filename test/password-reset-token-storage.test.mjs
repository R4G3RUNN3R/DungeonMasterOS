import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function runTsx(source) {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-reset-token-test-'));
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: path.join(dbDir, 'test.db'),
    JWT_SECRET: 'reset-token-test-secret-with-enough-entropy',
  };
  const result = spawnSync(path.join(repoRoot, 'node_modules', '.bin', 'tsx'), ['-e', source], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
  rmSync(dbDir, { recursive: true, force: true });
  return result;
}

test('new password reset credentials are hashed at rest and only raw links resolve them', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('better-sqlite3'),
    ]).then(([storageMod, dbMod]) => {
      storageMod.runMigrations();
      const user = storageMod.storage.createUser({
        email: 'reset-hash@example.invalid',
        username: 'reset_hash_user',
        passwordHash: 'test-hash',
      });

      const rawToken = 'ab'.repeat(32);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const created = storageMod.storage.createPasswordResetToken(user.id, rawToken, expiresAt);

      if (created.token === rawToken) throw new Error('raw reset token was persisted');
      if (!/^sha256:[a-f0-9]{64}$/.test(created.token)) {
        throw new Error('stored reset token is not a prefixed SHA-256 digest');
      }

      const resolved = storageMod.storage.getPasswordResetToken(rawToken);
      if (!resolved || resolved.id !== created.id) {
        throw new Error('raw reset link did not resolve its hashed record');
      }

      if (storageMod.storage.getPasswordResetToken(created.token)) {
        throw new Error('stored reset-token digest became a bearer credential');
      }

      const Database = dbMod.default;
      const db = new Database(process.env.DATABASE_URL);
      const row = db.prepare('SELECT token FROM password_reset_tokens WHERE id = ?').get(created.id);
      if (!row || row.token !== created.token || row.token === rawToken) {
        throw new Error('database did not retain only the reset-token digest');
      }
      db.close();
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('pre-hardening 64-hex reset links remain valid without broad raw-token fallback', () => {
  const result = runTsx(`
    Promise.all([
      import('./server/storage.ts'),
      import('better-sqlite3'),
    ]).then(([storageMod, dbMod]) => {
      storageMod.runMigrations();
      const user = storageMod.storage.createUser({
        email: 'legacy-reset@example.invalid',
        username: 'legacy_reset_user',
        passwordHash: 'test-hash',
      });

      const legacyToken = 'cd'.repeat(32);
      const Database = dbMod.default;
      const db = new Database(process.env.DATABASE_URL);
      db.prepare(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)'
      ).run(
        user.id,
        legacyToken,
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        new Date().toISOString(),
      );
      db.close();

      const resolved = storageMod.storage.getPasswordResetToken(legacyToken);
      if (!resolved || resolved.userId !== user.id) {
        throw new Error('legacy reset link stopped resolving');
      }

      if (storageMod.storage.getPasswordResetToken('legacy-token-not-64-hex')) {
        throw new Error('non-legacy raw token unexpectedly received fallback lookup');
      }
    });
  `);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
