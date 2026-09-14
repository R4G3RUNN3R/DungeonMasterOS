import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

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

async function request(baseUrl, url, { method = 'GET', cookie, body, headers = {} } = {}) {
  return fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
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
    method: 'POST',
    cookie,
    body: {
      name: 'Private Campaign', tone: 'heroic', rulesWeight: 'medium', powerLevel: 'standard',
      worldType: 'original', combatStyle: 'cinematic', storyMode: false, worldGenStyle: 'standard',
      homebrewRules: '', customWorldPrompt: '', epicMode: false, animeWorldSource: '', animeWorldMode: 'none',
      currencies: [{ code: 'gp', name: 'Gold', symbol: 'gp', isPrimary: true, exchangeRate: 1 }],
    },
  });
  if (response.status !== 201) throw new Error(`campaign creation failed: ${response.status} ${await response.text()}`);
  return response.json();
}

test('campaign data is private until an authenticated user joins with the invite code', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-campaign-access-'));
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
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child);
    const ownerCookie = await register(baseUrl, 'owner2@example.invalid', 'owner-two');
    const outsiderCookie = await register(baseUrl, 'outsider2@example.invalid', 'outsider-two');
    const campaign = await createCampaign(baseUrl, ownerCookie);
    const ownerCharacterResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/characters`, {
      method: 'POST', cookie: ownerCookie,
      body: { name: 'Host Hero', race: 'Human', charClass: 'Fighter', traits: '', backstory: '' },
    });
    if (ownerCharacterResponse.status !== 201) {
      throw new Error(`owner character creation failed (${ownerCharacterResponse.status}): ${await ownerCharacterResponse.text()}`);
    }
    const ownerCharacter = await ownerCharacterResponse.json();

    const anonymousMessages = await request(baseUrl, `/api/campaigns/${campaign.id}/messages`);
    assert.equal(anonymousMessages.status, 401, 'anonymous users must not read campaign messages');

    const outsiderMessages = await request(baseUrl, `/api/campaigns/${campaign.id}/messages`, { cookie: outsiderCookie });
    assert.equal(outsiderMessages.status, 403, 'unjoined users must not read campaign messages');

    const outsiderCharacters = await request(baseUrl, `/api/campaigns/${campaign.id}/characters`, { cookie: outsiderCookie });
    assert.equal(outsiderCharacters.status, 403, 'unjoined users must not list campaign characters');

    const outsiderItemsBeforeJoin = await request(baseUrl, `/api/characters/${ownerCharacter.id}/items`, { cookie: outsiderCookie });
    assert.equal(outsiderItemsBeforeJoin.status, 403, 'unjoined users must not inspect another character inventory');

    const join = await request(baseUrl, '/api/campaigns/join', {
      method: 'POST', cookie: outsiderCookie, body: { inviteCode: campaign.inviteCode },
    });
    assert.equal(join.status, 200, `valid invite join failed: ${await join.text()}`);

    const joinedMessages = await request(baseUrl, `/api/campaigns/${campaign.id}/messages`, { cookie: outsiderCookie });
    assert.equal(joinedMessages.status, 200, 'joined users must be able to read campaign messages');

    const joinedCampaign = await request(baseUrl, `/api/campaigns/${campaign.id}`, { cookie: outsiderCookie });
    assert.equal(joinedCampaign.status, 200, 'joined users must be able to read campaign metadata');

    const joinedRename = await request(baseUrl, `/api/campaigns/${campaign.id}`, {
      method: 'PATCH', cookie: outsiderCookie, body: { name: 'Hijacked Campaign' },
    });
    assert.equal(joinedRename.status, 403, 'campaign membership must not grant owner settings authority');

    const joinedArchive = await request(baseUrl, `/api/campaigns/${campaign.id}/archive`, {
      method: 'PATCH', cookie: outsiderCookie, body: { archive: true },
    });
    assert.equal(joinedArchive.status, 403, 'campaign membership must not grant archive authority');

    const joinedSnapshot = await request(baseUrl, `/api/campaigns/${campaign.id}/snapshots`, {
      method: 'POST', cookie: outsiderCookie, body: { label: 'Unauthorized Snapshot' },
    });
    assert.equal(joinedSnapshot.status, 403, 'campaign membership must not grant recovery authority');

    const joinedShopOpen = await request(baseUrl, `/api/campaigns/${campaign.id}/shop/open`, {
      method: 'POST', cookie: outsiderCookie,
      body: { merchantName: 'Unauthorized', currencyCode: 'gp', items: [] },
    });
    assert.equal(joinedShopOpen.status, 403, 'campaign membership must not grant shop-authoring authority');

    const joinedCampaignsResponse = await request(baseUrl, '/api/my-campaigns', { cookie: outsiderCookie });
    assert.equal(joinedCampaignsResponse.status, 200);
    const joinedCampaigns = await joinedCampaignsResponse.json();
    assert.ok(
      joinedCampaigns.some((entry) => entry.id === campaign.id),
      'joined campaign must remain visible in My Campaigns after navigation/reload',
    );

    const outsiderItemsAfterJoin = await request(baseUrl, `/api/characters/${ownerCharacter.id}/items`, { cookie: outsiderCookie });
    assert.equal(outsiderItemsAfterJoin.status, 403, 'campaign membership alone must not reveal another character inventory');

    const createCharacter = await request(baseUrl, `/api/campaigns/${campaign.id}/characters`, {
      method: 'POST', cookie: outsiderCookie,
      body: { name: 'Joiner', race: 'Human', charClass: 'Fighter', traits: '', backstory: '' },
    });
    assert.equal(createCharacter.status, 201, `joined user could not create character: ${await createCharacter.text()}`);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }

  assert.equal(stderr, '', stderr);
});


test('campaign creation persists its configured currencies', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-campaign-currency-'));
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

  try {
    await waitForServer(baseUrl, child);
    const ownerCookie = await register(baseUrl, 'currency-owner@example.invalid', 'currency-owner');
    const campaign = await createCampaign(baseUrl, ownerCookie);

    const response = await request(baseUrl, `/api/campaigns/${campaign.id}/currencies`, { cookie: ownerCookie });
    assert.equal(response.status, 200);
    const currencies = await response.json();
    assert.deepEqual(
      currencies.map(({ code, name, symbol, isPrimary, exchangeRate }) => ({ code, name, symbol, isPrimary, exchangeRate })),
      [{ code: 'gp', name: 'Gold', symbol: 'gp', isPrimary: true, exchangeRate: 1 }],
      'campaign currency definitions supplied at creation must be persisted',
    );
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
});


test('authenticated character authority is bound to the account, not a replayable visitor id', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-character-authority-'));
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

  try {
    await waitForServer(baseUrl, child);
    const ownerCookie = await register(baseUrl, 'authority-owner@example.invalid', 'authority-owner');
    const memberCookie = await register(baseUrl, 'authority-member@example.invalid', 'authority-member');
    const campaign = await createCampaign(baseUrl, ownerCookie);

    const ownerCharacterResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/characters`, {
      method: 'POST', cookie: ownerCookie,
      headers: { 'x-visitor-id': 'legacy-owner-visitor-id' },
      body: { name: 'Owner Hero', race: 'Human', charClass: 'Fighter', traits: '', backstory: '' },
    });
    assert.equal(ownerCharacterResponse.status, 201);
    const ownerCharacter = await ownerCharacterResponse.json();

    const ownerCharacterWithoutVisitorHeader = await request(baseUrl, `/api/campaigns/${campaign.id}/my-character`, {
      cookie: ownerCookie,
    });
    assert.equal(
      ownerCharacterWithoutVisitorHeader.status,
      200,
      'authenticated users must resolve their character from account identity without a legacy visitor header',
    );

    const join = await request(baseUrl, '/api/campaigns/join', {
      method: 'POST', cookie: memberCookie, body: { inviteCode: campaign.inviteCode },
    });
    assert.equal(join.status, 200);

    const memberCharacterResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/characters`, {
      method: 'POST', cookie: memberCookie,
      headers: { 'x-visitor-id': 'legacy-member-visitor-id' },
      body: { name: 'Member Hero', race: 'Elf', charClass: 'Rogue', traits: '', backstory: '' },
    });
    assert.equal(memberCharacterResponse.status, 201);

    const charactersResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/characters`, { cookie: memberCookie });
    assert.equal(charactersResponse.status, 200);
    const characters = await charactersResponse.json();
    const exposedOwner = characters.find((entry) => entry.id === ownerCharacter.id);
    assert.ok(exposedOwner, 'owner character must be visible to campaign members');

    const spoofedHpMutation = await request(baseUrl, `/api/characters/${ownerCharacter.id}/hp`, {
      method: 'PATCH', cookie: memberCookie,
      headers: { 'x-visitor-id': exposedOwner.visitorId },
      body: { hp: 1 },
    });
    assert.equal(
      spoofedHpMutation.status,
      403,
      'another member must not gain character mutation authority by replaying visitorId',
    );
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
});


test('production password reset does not claim an email was sent when no mail transport exists', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-password-reset-'));
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

  try {
    await waitForServer(baseUrl, child);
    await register(baseUrl, 'reset-user@example.invalid', 'reset-user');
    const response = await request(baseUrl, '/api/auth/forgot-password', {
      method: 'POST', body: { email: 'reset-user@example.invalid' },
    });
    assert.equal(response.status, 503, 'production must not report reset email delivery when no mail transport is configured');
    const body = await response.json();
    assert.match(body.message, /temporarily unavailable|not configured/i);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
});
