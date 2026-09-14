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

async function createCampaign(baseUrl, cookie) {
  const response = await request(baseUrl, '/api/campaigns', {
    method: 'POST', cookie,
    body: {
      name: 'Multiplayer Continuity', tone: 'heroic', rulesWeight: 'medium', powerLevel: 'standard',
      worldType: 'original', combatStyle: 'cinematic', storyMode: false, worldGenStyle: 'standard',
      homebrewRules: '', customWorldPrompt: '', epicMode: false, animeWorldSource: '', animeWorldMode: 'none',
      currencies: [{ code: 'gp', name: 'Gold', symbol: 'gp', isPrimary: true, exchangeRate: 1 }],
    },
  });
  if (response.status !== 201) throw new Error(`campaign failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function createCharacter(baseUrl, cookie, campaignId, name) {
  const response = await request(baseUrl, `/api/campaigns/${campaignId}/characters`, {
    method: 'POST', cookie,
    body: { name, race: 'Human', charClass: 'Fighter', traits: '', backstory: '', hp: 20, maxHp: 20 },
  });
  if (response.status !== 201) throw new Error(`character failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function connectSubscribed(port, cookie, campaignId) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { Cookie: cookie } });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('websocket subscribe timeout')), 5000);
    ws.once('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'subscribe', campaignId })));
    const onMessage = (raw) => {
      const data = JSON.parse(raw.toString());
      if (data.type === 'subscribed') {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve();
      }
    };
    ws.on('message', onMessage);
  });
  return ws;
}

function waitForMessage(ws, predicate, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error(`timed out waiting for ${label}`));
    }, 5000);
    const onMessage = (raw) => {
      const data = JSON.parse(raw.toString());
      if (!predicate(data)) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(data);
    };
    ws.on('message', onMessage);
  });
}

test('two campaign members receive state broadcasts and a reconnecting member can resubscribe', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-multiplayer-state-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      DATABASE_URL: path.join(dbDir, 'test.db'),
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy', APP_URL: baseUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let ownerWs;
  let memberWs;
  let reconnectWs;
  try {
    await waitForServer(baseUrl, child);
    const ownerCookie = await register(baseUrl, 'multi-owner@example.invalid', 'multi-owner');
    const memberCookie = await register(baseUrl, 'multi-member@example.invalid', 'multi-member');
    const campaign = await createCampaign(baseUrl, ownerCookie);

    const join = await request(baseUrl, '/api/campaigns/join', {
      method: 'POST', cookie: memberCookie, body: { inviteCode: campaign.inviteCode },
    });
    assert.equal(join.status, 200);

    const ownerCharacter = await createCharacter(baseUrl, ownerCookie, campaign.id, 'Owner Hero');
    const memberCharacter = await createCharacter(baseUrl, memberCookie, campaign.id, 'Member Hero');

    ownerWs = await connectSubscribed(port, ownerCookie, campaign.id);
    memberWs = await connectSubscribed(port, memberCookie, campaign.id);

    const ownerSawMemberUpdate = waitForMessage(
      ownerWs,
      (data) => data.type === 'character_updated' && data.characterId === memberCharacter.id,
      'owner to receive member character update',
    );
    const memberSawOwnUpdate = waitForMessage(
      memberWs,
      (data) => data.type === 'character_updated' && data.characterId === memberCharacter.id,
      'member to receive own character update',
    );

    const hpUpdate = await request(baseUrl, `/api/characters/${memberCharacter.id}/hp`, {
      method: 'PATCH', cookie: memberCookie, body: { hp: 13 },
    });
    assert.equal(hpUpdate.status, 200);
    await Promise.all([ownerSawMemberUpdate, memberSawOwnUpdate]);

    await new Promise((resolve) => {
      memberWs.once('close', resolve);
      memberWs.close();
    });
    memberWs = undefined;

    reconnectWs = await connectSubscribed(port, memberCookie, campaign.id);
    const memberSawOwnerAfterReconnect = waitForMessage(
      reconnectWs,
      (data) => data.type === 'character_updated' && data.characterId === ownerCharacter.id,
      'reconnected member to receive owner character update',
    );

    const ownerHpUpdate = await request(baseUrl, `/api/characters/${ownerCharacter.id}/hp`, {
      method: 'PATCH', cookie: ownerCookie, body: { hp: 17 },
    });
    assert.equal(ownerHpUpdate.status, 200);
    await memberSawOwnerAfterReconnect;
  } finally {
    ownerWs?.terminate();
    memberWs?.terminate();
    reconnectWs?.terminate();
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
});
