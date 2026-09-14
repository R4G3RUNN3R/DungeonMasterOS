import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const repoRoot = path.resolve(import.meta.dirname, '..');
const jwtSecret = 'test-only-jwt-secret-with-enough-entropy';

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

function startDmos(dbPath, port) {
  return spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: dbPath,
      JWT_SECRET: jwtSecret, APP_URL: `http://127.0.0.1:${port}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
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

async function stopDmos(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
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
    method: 'POST', body: { email, username, password: 'Password123!' },
  });
  if (response.status !== 201) throw new Error(`registration failed: ${response.status} ${await response.text()}`);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

async function createCampaign(baseUrl, cookie) {
  const response = await request(baseUrl, '/api/campaigns', {
    method: 'POST', cookie,
    body: {
      name: 'Persistence Test', tone: 'heroic', rulesWeight: 'medium', powerLevel: 'standard',
      worldType: 'original', combatStyle: 'cinematic', storyMode: false, worldGenStyle: 'standard',
      homebrewRules: '', customWorldPrompt: '', epicMode: false, animeWorldSource: '', animeWorldMode: 'none',
      currencies: [{ code: 'gp', name: 'Gold', symbol: 'gp', isPrimary: true, exchangeRate: 1 }],
    },
  });
  if (response.status !== 201) throw new Error(`campaign failed: ${response.status} ${await response.text()}`);
  return response.json();
}

test('campaign membership and character state survive a real server restart', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-gameplay-persistence-'));
  const dbPath = path.join(dbDir, 'test.db');
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let child = startDmos(dbPath, port);

  try {
    await waitForServer(baseUrl, child);
    const ownerCookie = await register(baseUrl, 'persist-owner@example.invalid', 'persist-owner');
    const memberCookie = await register(baseUrl, 'persist-member@example.invalid', 'persist-member');
    const campaign = await createCampaign(baseUrl, ownerCookie);

    const join = await request(baseUrl, '/api/campaigns/join', {
      method: 'POST', cookie: memberCookie, body: { inviteCode: campaign.inviteCode },
    });
    assert.equal(join.status, 200);

    const characterResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/characters`, {
      method: 'POST', cookie: ownerCookie,
      body: { name: 'Persistent Hero', race: 'Human', charClass: 'Fighter', traits: '', backstory: '', hp: 20, maxHp: 20 },
    });
    assert.equal(characterResponse.status, 201);
    const character = await characterResponse.json();

    const hp = await request(baseUrl, `/api/characters/${character.id}/hp`, {
      method: 'PATCH', cookie: ownerCookie, body: { hp: 11 },
    });
    assert.equal(hp.status, 200);

    const item = await request(baseUrl, `/api/characters/${character.id}/items`, {
      method: 'POST', cookie: ownerCookie,
      body: { name: 'Persistent Token', description: 'Survives restart.', itemType: 'gear', quantity: 2 },
    });
    assert.equal(item.status, 201);

    const effect = await request(baseUrl, `/api/characters/${character.id}/effects`, {
      method: 'POST', cookie: ownerCookie,
      body: { name: 'Persistent Blessing', source: 'Test', durationType: 'permanent', description: 'Survives restart.' },
    });
    assert.equal(effect.status, 201);

    await stopDmos(child);
    child = startDmos(dbPath, port);
    await waitForServer(baseUrl, child);

    const ownerMe = await request(baseUrl, '/api/auth/me', { cookie: ownerCookie });
    assert.equal(ownerMe.status, 200, 'signed session should remain valid across restart');

    const memberCampaigns = await request(baseUrl, '/api/my-campaigns', { cookie: memberCookie });
    assert.equal(memberCampaigns.status, 200);
    const memberCampaignList = await memberCampaigns.json();
    assert.ok(memberCampaignList.some((entry) => entry.id === campaign.id), 'joined membership was lost after restart');

    const characterAfter = await request(baseUrl, `/api/campaigns/${campaign.id}/my-character`, { cookie: ownerCookie });
    assert.equal(characterAfter.status, 200);
    const persistedCharacter = await characterAfter.json();
    assert.equal(persistedCharacter.id, character.id);
    assert.equal(persistedCharacter.hp, 11);

    const itemsAfter = await request(baseUrl, `/api/characters/${character.id}/items`, { cookie: ownerCookie });
    assert.equal(itemsAfter.status, 200);
    const items = await itemsAfter.json();
    assert.ok(items.some((entry) => entry.name === 'Persistent Token' && entry.quantity === 2));

    const effectsAfter = await request(baseUrl, `/api/characters/${character.id}/effects`, { cookie: ownerCookie });
    assert.equal(effectsAfter.status, 200);
    const effects = await effectsAfter.json();
    assert.ok(effects.some((entry) => entry.name === 'Persistent Blessing'));

    const memberCampaign = await request(baseUrl, `/api/campaigns/${campaign.id}`, { cookie: memberCookie });
    assert.equal(memberCampaign.status, 200, 'joined member access was lost after restart');
  } finally {
    await stopDmos(child);
    rmSync(dbDir, { recursive: true, force: true });
  }
});
