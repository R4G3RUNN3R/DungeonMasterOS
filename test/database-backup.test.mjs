import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const repoRoot = path.resolve(import.meta.dirname, '..');

function runTsx(script, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', script, ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

test('online SQLite backup restores into a clean database with integrity intact', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'dmos-db-backup-'));
  const source = path.join(dir, 'source.db');
  const backup = path.join(dir, 'backups', 'source.backup.db');
  const restored = path.join(dir, 'restored.db');

  try {
    const db = new Database(source);
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE proof (id INTEGER PRIMARY KEY, value TEXT NOT NULL);');
    db.prepare('INSERT INTO proof (value) VALUES (?)').run('survived-backup');
    db.close();

    const backupResult = await runTsx('script/backup-database.ts', [
      '--source', source,
      '--output', backup,
    ]);
    assert.equal(backupResult.code, 0, `backup failed: ${backupResult.stderr || backupResult.stdout}`);
    assert.equal(existsSync(backup), true);

    const backupDb = new Database(backup, { readonly: true });
    assert.equal(backupDb.pragma('quick_check', { simple: true }), 'ok');
    assert.equal(backupDb.prepare('SELECT value FROM proof WHERE id = 1').get().value, 'survived-backup');
    backupDb.close();

    const restoreResult = await runTsx('script/restore-database.ts', [
      '--backup', backup,
      '--target', restored,
    ]);
    assert.equal(restoreResult.code, 0, `restore failed: ${restoreResult.stderr || restoreResult.stdout}`);
    assert.equal(existsSync(restored), true);

    const restoredDb = new Database(restored, { readonly: true });
    assert.equal(restoredDb.pragma('quick_check', { simple: true }), 'ok');
    assert.equal(restoredDb.prepare('SELECT value FROM proof WHERE id = 1').get().value, 'survived-backup');
    restoredDb.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
