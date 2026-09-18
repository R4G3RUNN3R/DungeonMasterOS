import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');

function readBundledUpdates() {
  const source = `
    import { PUBLIC_UPDATES } from './shared/public-updates.ts';
    console.log(JSON.stringify(PUBLIC_UPDATES));
  `;
  return JSON.parse(execFileSync(tsx, ['--eval', source], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim());
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`DMOS exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/auth/me`);
      if (response.status === 401) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('DMOS test server did not become ready');
}

test('public release catalogue is version-controlled, ordered, unique, and public-safe', () => {
  const updates = readBundledUpdates();
  assert.ok(updates.length >= 13);
  assert.equal(updates[0].id, '2026-09-18-account-session-security');
  assert.equal(updates[0].date, '2026-09-18');

  const ids = new Set();
  for (let index = 0; index < updates.length; index += 1) {
    const entry = updates[index];
    assert.match(entry.id, /^[a-z0-9][a-z0-9-]*$/);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.title.trim());
    assert.ok(entry.description.trim());
    assert.equal(ids.has(entry.id), false, `duplicate public update id: ${entry.id}`);
    ids.add(entry.id);
    if (index > 0) {
      assert.ok(updates[index - 1].date >= entry.date, 'public updates must remain newest-first');
    }
  }

  assert.doesNotMatch(
    updates[0].description,
    /auth_version|legacy jwt|bearer token|token hash|sha-256|reset token|session secret/i,
  );
});

test('GET /api/updates serves JSON with bounded CORS and no mutation dependency', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-public-updates-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: path.join(dbDir, 'test.db'),
      JWT_SECRET: 'public-updates-test-secret-with-enough-entropy',
      APP_URL: baseUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(baseUrl, child);

    const allowed = await fetch(`${baseUrl}/api/updates`, {
      headers: { Origin: 'https://voidsmithindustries.com' },
    });
    assert.equal(allowed.status, 200);
    assert.match(allowed.headers.get('content-type') || '', /^application\/json/i);
    assert.equal(
      allowed.headers.get('access-control-allow-origin'),
      'https://voidsmithindustries.com',
    );
    assert.match(allowed.headers.get('vary') || '', /Origin/i);
    assert.match(allowed.headers.get('cache-control') || '', /max-age=300/);

    const body = await allowed.json();
    assert.ok(Array.isArray(body.updates));
    assert.equal(body.updates[0].product, 'DMOS');
    assert.equal(body.updates[0].type, 'RELEASE');
    assert.equal(body.updates[0].date, '2026-09-18');
    assert.equal(body.updates[0].title, 'Account and session security hardening');

    const denied = await fetch(`${baseUrl}/api/updates`, {
      headers: { Origin: 'https://example.invalid' },
    });
    assert.equal(denied.status, 200);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
});
