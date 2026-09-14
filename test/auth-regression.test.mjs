import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function runTsx(source, extraEnv = {}) {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-auth-test-'));
  const env = { ...process.env, DATABASE_URL: path.join(dbDir, 'test.db'), ...extraEnv };
  delete env.JWT_SECRET;
  const result = spawnSync(path.join(repoRoot, 'node_modules', '.bin', 'tsx'), ['-e', source], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
  rmSync(dbDir, { recursive: true, force: true });
  return result;
}

test('production auth fails closed when JWT_SECRET is missing', () => {
  const result = runTsx("import('./server/auth.ts').then(({ signToken }) => signToken(1));", {
    NODE_ENV: 'production',
  });
  assert.notEqual(result.status, 0, 'production signToken unexpectedly succeeded without JWT_SECRET');
  assert.match(`${result.stdout}\n${result.stderr}`, /JWT_SECRET must be set in production/);
});

test('DungeonMaster auth helpers remain exported for protected admin routes', () => {
  const result = runTsx(`
    import('./server/auth.ts').then((auth) => {
      const required = ['hasDungeonMasterAccess', 'requireDungeonMaster', 'grantDungeonMasterAccess', 'revokeDungeonMasterAccess'];
      const missing = required.filter((name) => typeof auth[name] !== 'function');
      if (missing.length) throw new Error('missing exports: ' + missing.join(', '));
    });
  `, { NODE_ENV: 'test' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
