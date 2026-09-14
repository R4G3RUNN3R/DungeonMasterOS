import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';

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

async function register(baseUrl) {
  const response = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { email: 'projection@example.invalid', username: 'projection-user', password: 'Password123!' },
  });
  if (response.status !== 201) throw new Error(`registration failed: ${response.status} ${await response.text()}`);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

async function createCampaign(baseUrl, cookie) {
  const response = await request(baseUrl, '/api/campaigns', {
    method: 'POST', cookie,
    body: {
      name: 'Projection Test', tone: 'heroic', rulesWeight: 'medium', powerLevel: 'standard',
      worldType: 'original', combatStyle: 'cinematic', storyMode: false, worldGenStyle: 'standard',
      homebrewRules: '', customWorldPrompt: '', epicMode: false, animeWorldSource: '', animeWorldMode: 'none',
      currencies: [{ code: 'gp', name: 'Gold', symbol: 'gp', isPrimary: true, exchangeRate: 1 }],
    },
  });
  if (response.status !== 201) throw new Error(`campaign failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function startProjectionAnthropic() {
  const port = await getFreePort();
  let requestCount = 0;
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk.toString();
    requestCount += 1;
    const payload = JSON.parse(raw || '{}');
    const system = typeof payload.system === 'string' ? payload.system : '';

    const isProjection = /state projection extractor/i.test(system);
    const text = isProjection
      ? JSON.stringify({
          items: [{
            name: 'Silver Dagger', description: 'A finely balanced silver dagger.', itemType: 'weapon',
            quantity: 1, consumable: false, identified: true,
          }],
          currencies: [{ currencyCode: 'gp', amountDelta: 50 }],
          abilities: [{
            name: 'Shadow Step', description: 'Briefly step between nearby shadows.', category: 'active',
          }],
        })
      : 'The grateful innkeeper presses a silver dagger into your hand, pays you 50 gp, and the strange magic in the blade causes you to unlock Shadow Step.';

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      id: `msg_projection_${requestCount}`,
      type: 'message', role: 'assistant', model: 'claude-test',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    getRequestCount: () => requestCount,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('one narration plus one projection call updates items, currency and abilities before action completion', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-projection-'));
  const fake = await startProjectionAnthropic();
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      DATABASE_URL: path.join(dbDir, 'test.db'),
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy', APP_URL: baseUrl,
      ANTHROPIC_API_KEY: 'sk-ant-test-local', ANTHROPIC_BASE_URL: fake.baseUrl,
      ANTHROPIC_MODEL: 'claude-sonnet-4-6', ANTHROPIC_FALLBACK_MODELS: 'claude-sonnet-4-6',
      ANTHROPIC_RETRY_ATTEMPTS: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(baseUrl, child);
    const cookie = await register(baseUrl);
    const campaign = await createCampaign(baseUrl, cookie);
    const characterResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/characters`, {
      method: 'POST', cookie,
      body: { name: 'Projection Hero', race: 'Human', charClass: 'Rogue', traits: '', backstory: '' },
    });
    assert.equal(characterResponse.status, 201);
    const character = await characterResponse.json();

    const action = await request(baseUrl, `/api/campaigns/${campaign.id}/action`, {
      method: 'POST', cookie, body: { content: 'I help the innkeeper.' },
    });
    assert.equal(action.status, 200, `action failed: ${action.status}`);

    const itemsResponse = await request(baseUrl, `/api/characters/${character.id}/items`, { cookie });
    const items = await itemsResponse.json();
    assert.equal(items.filter((item) => item.name === 'Silver Dagger').length, 1);

    const walletResponse = await request(baseUrl, `/api/characters/${character.id}/currencies`, { cookie });
    const wallet = await walletResponse.json();
    assert.equal(wallet.find((entry) => entry.currencyCode === 'gp')?.amount, 50);

    const characterAfterResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/my-character`, { cookie });
    const characterAfter = await characterAfterResponse.json();
    const characterData = JSON.parse(characterAfter.characterData || '{}');
    const granted = (characterData.sections || []).find((section) => section.label === 'Granted Abilities');
    assert.ok(granted?.entries?.some((entry) => entry.key === 'Shadow Step'));

    assert.equal(fake.getRequestCount(), 2, 'one action should use one narration call and one consolidated projection call');
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await fake.close();
    rmSync(dbDir, { recursive: true, force: true });
  }
});
