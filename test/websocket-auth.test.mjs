import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import WebSocket from 'ws';

const repoRoot = path.resolve(import.meta.dirname, '..');

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

async function register(baseUrl, email, username) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, username, password: 'Password123!' }),
  });
  if (response.status !== 201) {
    throw new Error(`registration failed (${response.status}): ${await response.text()}`);
  }
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie, 'registration did not set a session cookie');
  return cookie.split(';', 1)[0];
}

async function createCampaign(baseUrl, cookie) {
  const response = await fetch(`${baseUrl}/api/campaigns`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: 'Socket Security Campaign',
      tone: 'heroic',
      rulesWeight: 'medium',
      powerLevel: 'standard',
      worldType: 'original',
      combatStyle: 'cinematic',
      storyMode: false,
      worldGenStyle: 'standard',
      homebrewRules: '',
      customWorldPrompt: '',
      epicMode: false,
      animeWorldSource: '',
      animeWorldMode: 'none',
      currencies: [{ code: 'gp', name: 'Gold', symbol: 'gp', isPrimary: true, exchangeRate: 1 }],
    }),
  });
  if (response.status !== 201) {
    throw new Error(`campaign creation failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

function subscribe({ port, cookie, campaignId }) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { Cookie: cookie } });
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('websocket subscription timed out'));
    }, 5000);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'subscribe', campaignId, userId: 999999 })));
    ws.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.type === 'subscribed') {
        clearTimeout(timer);
        ws.close();
        resolve({ kind: 'subscribed', data });
      }
    });
    ws.on('close', (code, reason) => {
      clearTimeout(timer);
      resolve({ kind: 'closed', code, reason: reason.toString() });
    });
    ws.on('error', reject);
  });
}

test('WebSocket subscriptions require the authenticated user to own or belong to the campaign', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-ws-test-'));
  const dbPath = path.join(dbDir, 'test.db');
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: dbPath,
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy',
      APP_URL: baseUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child);
    const ownerCookie = await register(baseUrl, 'owner@example.invalid', 'owner-user');
    const outsiderCookie = await register(baseUrl, 'outsider@example.invalid', 'outsider-user');
    const campaign = await createCampaign(baseUrl, ownerCookie);

    const ownerResult = await subscribe({ port, cookie: ownerCookie, campaignId: campaign.id });
    assert.equal(ownerResult.kind, 'subscribed', `owner could not subscribe: ${JSON.stringify(ownerResult)}`);

    const outsiderResult = await subscribe({ port, cookie: outsiderCookie, campaignId: campaign.id });
    assert.deepEqual(
      { kind: outsiderResult.kind, code: outsiderResult.code },
      { kind: 'closed', code: 1008 },
      `outsider unexpectedly subscribed: ${JSON.stringify(outsiderResult)}`,
    );
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }

  assert.equal(stderr, '', stderr);
});
