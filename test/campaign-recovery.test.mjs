import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import Database from 'better-sqlite3';

const repoRoot = path.resolve(import.meta.dirname, '..');

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
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

async function request(baseUrl, url, { method = 'GET', cookie, body } = {}) {
  return fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function register(baseUrl, email, username) {
  const response = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { email, username, password: 'Password123!' },
  });
  if (response.status !== 201) throw new Error(`registration failed: ${response.status} ${await response.text()}`);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

async function createCampaign(baseUrl, cookie, name = 'Recovery Test') {
  const response = await request(baseUrl, '/api/campaigns', {
    method: 'POST', cookie,
    body: {
      name, tone: 'heroic', rulesWeight: 'medium', powerLevel: 'standard',
      worldType: 'original', combatStyle: 'cinematic', storyMode: false, worldGenStyle: 'standard',
      homebrewRules: '', customWorldPrompt: '', epicMode: false, animeWorldSource: '', animeWorldMode: 'none',
      currencies: [{ code: 'gp', name: 'Gold', symbol: 'gp', isPrimary: true, exchangeRate: 1 }],
    },
  });
  if (response.status !== 201) throw new Error(`campaign failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function createCharacter(baseUrl, cookie, campaignId) {
  const response = await request(baseUrl, `/api/campaigns/${campaignId}/characters`, {
    method: 'POST', cookie,
    body: { name: 'Recovery Hero', race: 'Human', charClass: 'Fighter', traits: '', backstory: '', hp: 15, maxHp: 20 },
  });
  if (response.status !== 201) throw new Error(`character failed: ${response.status} ${await response.text()}`);
  return response.json();
}

test('campaign snapshot restore atomically rewinds character, inventory and wallet state', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-recovery-'));
  const dbPath = path.join(dbDir, 'test.db');
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: dbPath,
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy', APP_URL: baseUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(baseUrl, child);
    const ownerCookie = await register(baseUrl, 'recovery-owner@example.invalid', 'recovery-owner');
    const outsiderCookie = await register(baseUrl, 'recovery-outsider@example.invalid', 'recovery-outsider');
    const campaign = await createCampaign(baseUrl, ownerCookie);
    const character = await createCharacter(baseUrl, ownerCookie, campaign.id);

    const initialItemResponse = await request(baseUrl, `/api/characters/${character.id}/items`, {
      method: 'POST', cookie: ownerCookie,
      body: { name: 'Old Sword', description: 'The original blade.', itemType: 'weapon', quantity: 1 },
    });
    assert.equal(initialItemResponse.status, 201);

    const db = new Database(dbPath);
    db.prepare('UPDATE character_currencies SET amount = 10 WHERE character_id = ? AND currency_code = ?').run(character.id, 'gp');
    db.close();

    const snapshotResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/snapshots`, {
      method: 'POST', cookie: ownerCookie, body: { label: 'Before Disaster' },
    });
    assert.equal(snapshotResponse.status, 201, `snapshot creation failed: ${snapshotResponse.status}`);
    const snapshot = await snapshotResponse.json();

    const outsiderRestore = await request(baseUrl, `/api/campaigns/${campaign.id}/restore/${snapshot.id}`, {
      method: 'POST', cookie: outsiderCookie,
    });
    assert.equal(outsiderRestore.status, 403, 'non-owner must not be able to restore campaign state');

    const hpMutation = await request(baseUrl, `/api/characters/${character.id}/hp`, {
      method: 'PATCH', cookie: ownerCookie, body: { hp: 1 },
    });
    assert.equal(hpMutation.status, 200);

    const newItemResponse = await request(baseUrl, `/api/characters/${character.id}/items`, {
      method: 'POST', cookie: ownerCookie,
      body: { name: 'After Snapshot', description: 'Should disappear after restore.', itemType: 'gear', quantity: 1 },
    });
    assert.equal(newItemResponse.status, 201);

    const dbAfter = new Database(dbPath);
    dbAfter.prepare('UPDATE character_currencies SET amount = 99 WHERE character_id = ? AND currency_code = ?').run(character.id, 'gp');
    dbAfter.close();

    const restoreResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/restore/${snapshot.id}`, {
      method: 'POST', cookie: ownerCookie,
    });
    assert.equal(restoreResponse.status, 200, `restore failed: ${restoreResponse.status}`);

    const restoredCharacterResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/my-character`, { cookie: ownerCookie });
    assert.equal(restoredCharacterResponse.status, 200);
    const restoredCharacter = await restoredCharacterResponse.json();
    assert.equal(restoredCharacter.hp, 15);

    const itemsResponse = await request(baseUrl, `/api/characters/${restoredCharacter.id}/items`, { cookie: ownerCookie });
    const items = await itemsResponse.json();
    assert.equal(items.some((item) => item.name === 'Old Sword'), true);
    assert.equal(items.some((item) => item.name === 'After Snapshot'), false);

    const walletResponse = await request(baseUrl, `/api/characters/${restoredCharacter.id}/currencies`, { cookie: ownerCookie });
    const wallet = await walletResponse.json();
    assert.equal(wallet.find((entry) => entry.currencyCode === 'gp')?.amount, 10);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
});
