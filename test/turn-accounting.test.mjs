import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import Database from 'better-sqlite3';

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
    body: { email: 'turn-user@example.invalid', username: 'turn-user', password: 'Password123!' },
  });
  if (response.status !== 201) throw new Error(`registration failed: ${response.status} ${await response.text()}`);
  const body = await response.json();
  return {
    cookie: response.headers.get('set-cookie').split(';', 1)[0],
    user: body.user,
  };
}

async function createCampaignAndCharacter(baseUrl, cookie) {
  const campaignResponse = await request(baseUrl, '/api/campaigns', {
    method: 'POST', cookie,
    body: {
      name: 'Turn Accounting', tone: 'heroic', rulesWeight: 'medium', powerLevel: 'standard',
      worldType: 'original', combatStyle: 'cinematic', storyMode: false, worldGenStyle: 'standard',
      homebrewRules: '', customWorldPrompt: '', epicMode: false, animeWorldSource: '', animeWorldMode: 'none',
      currencies: [{ code: 'gp', name: 'Gold', symbol: 'gp', isPrimary: true, exchangeRate: 1 }],
    },
  });
  if (campaignResponse.status !== 201) throw new Error(`campaign failed: ${campaignResponse.status} ${await campaignResponse.text()}`);
  const campaign = await campaignResponse.json();

  const characterResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/characters`, {
    method: 'POST', cookie,
    body: { name: 'Counter', race: 'Human', charClass: 'Fighter', traits: '', backstory: '' },
  });
  if (characterResponse.status !== 201) throw new Error(`character failed: ${characterResponse.status} ${await characterResponse.text()}`);
  return campaign;
}

async function startFakeAnthropic({
  delayMs = 150,
  status = 200,
  text = 'The corridor answers your move with a distant echo.\n\nWhat do you do?',
} = {}) {
  const port = await getFreePort();
  let requestCount = 0;
  const server = http.createServer(async (req, res) => {
    requestCount += 1;
    for await (const _chunk of req) {}
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    if (status >= 400) {
      res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'test provider failure' } }));
      return;
    }
    res.end(JSON.stringify({
      id: `msg_test_${Date.now()}`,
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

test('concurrent AI actions cannot consume more turns than the regular plus bonus allowance', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-turn-concurrency-'));
  const dbPath = path.join(dbDir, 'test.db');
  const fake = await startFakeAnthropic({ delayMs: 200 });
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: dbPath,
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy', APP_URL: baseUrl,
      ANTHROPIC_API_KEY: 'sk-ant-test-local', ANTHROPIC_BASE_URL: fake.baseUrl,
      ANTHROPIC_RETRY_ATTEMPTS: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(baseUrl, child);
    const { cookie, user } = await register(baseUrl);
    const campaign = await createCampaignAndCharacter(baseUrl, cookie);

    const db = new Database(dbPath);
    db.prepare(`UPDATE users SET tier='free', subscription_status='active', ai_turns_used_this_month=59, bonus_turns=2 WHERE id=?`).run(user.id);
    db.close();

    const results = await Promise.all(
      Array.from({ length: 4 }, (_, index) => request(baseUrl, `/api/campaigns/${campaign.id}/action`, {
        method: 'POST', cookie, body: { content: `Concurrent action ${index + 1}` },
      })),
    );

    const statuses = results.map((response) => response.status).sort((a, b) => a - b);
    assert.deepEqual(statuses, [200, 200, 200, 403], 'exactly three turns should remain available');

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    const current = await me.json();
    assert.equal(current.user.aiTurnsUsedThisMonth, 62);
    assert.equal(current.user.bonusTurns, 0);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await fake.close();
    rmSync(dbDir, { recursive: true, force: true });
  }
});

test('failed AI generation refunds a reserved turn', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-turn-refund-'));
  const dbPath = path.join(dbDir, 'test.db');
  const fake = await startFakeAnthropic({ delayMs: 0, status: 401 });
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: dbPath,
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy', APP_URL: baseUrl,
      ANTHROPIC_API_KEY: 'sk-ant-test-local', ANTHROPIC_BASE_URL: fake.baseUrl,
      ANTHROPIC_RETRY_ATTEMPTS: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(baseUrl, child);
    const { cookie, user } = await register(baseUrl);
    const campaign = await createCampaignAndCharacter(baseUrl, cookie);

    const db = new Database(dbPath);
    db.prepare(`UPDATE users SET tier='free', subscription_status='active', ai_turns_used_this_month=59, bonus_turns=0 WHERE id=?`).run(user.id);
    db.close();

    const response = await request(baseUrl, `/api/campaigns/${campaign.id}/action`, {
      method: 'POST', cookie, body: { content: 'Attempt an action during provider failure' },
    });
    assert.equal(response.status, 200, 'DMOS should return its graceful AI-unavailable response');

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    const current = await me.json();
    assert.equal(current.user.aiTurnsUsedThisMonth, 59, 'failed provider call must not consume the turn');
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await fake.close();
    rmSync(dbDir, { recursive: true, force: true });
  }
});


test('Anthropic timeout is bounded and SDK retries do not multiply the DMOS retry policy', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-ai-timeout-'));
  const dbPath = path.join(dbDir, 'test.db');
  const fake = await startFakeAnthropic({ delayMs: 500, status: 200 });
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: dbPath,
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy', APP_URL: baseUrl,
      ANTHROPIC_API_KEY: 'sk-ant-test-local', ANTHROPIC_BASE_URL: fake.baseUrl,
      ANTHROPIC_MODEL: 'claude-sonnet-4-6', ANTHROPIC_FALLBACK_MODELS: 'claude-sonnet-4-6',
      ANTHROPIC_RETRY_ATTEMPTS: '1', ANTHROPIC_TIMEOUT_MS: '100',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(baseUrl, child);
    const { cookie } = await register(baseUrl);
    const campaign = await createCampaignAndCharacter(baseUrl, cookie);

    const startedAt = Date.now();
    const response = await request(baseUrl, `/api/campaigns/${campaign.id}/action`, {
      method: 'POST', cookie, body: { content: 'Test the provider timeout boundary' },
    });
    const elapsedMs = Date.now() - startedAt;
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.aiUnavailable, true, 'timeout should use the AI-unavailable path');
    assert.ok(elapsedMs < 400, `configured 100ms timeout was not honored; request took ${elapsedMs}ms`);
    assert.equal(fake.getRequestCount(), 1, 'SDK-level retries multiplied the configured DMOS retry count');
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await fake.close();
    rmSync(dbDir, { recursive: true, force: true });
  }
});


test('auxiliary AI calls use the same bounded client timeout policy', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-aux-ai-timeout-'));
  const fake = await startFakeAnthropic({ delayMs: 500, status: 200 });
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
      ANTHROPIC_MODEL: 'claude-sonnet-4-6', ANTHROPIC_TIMEOUT_MS: '100',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(baseUrl, child);
    const { cookie } = await register(baseUrl);

    const startedAt = Date.now();
    const response = await request(baseUrl, '/api/parse-character', {
      method: 'POST', cookie,
      body: { text: 'A human fighter with a longsword, a shield, and a stubborn sense of duty.' },
    });
    const elapsedMs = Date.now() - startedAt;

    assert.equal(response.status, 422, 'malformed/timeout auxiliary response should fail closed');
    assert.ok(elapsedMs < 400, `auxiliary AI timeout was not honored; request took ${elapsedMs}ms`);
    assert.equal(fake.getRequestCount(), 1, 'auxiliary AI client performed hidden SDK retries');
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await fake.close();
    rmSync(dbDir, { recursive: true, force: true });
  }
});


test('DM shop markup becomes a structured active shop without leaking protocol tags into narration', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-ai-shop-'));
  const shopNarration = `A weathered quartermaster waves you over.\n\n[SHOP]\nMerchant: Quartermaster Vale\nCurrency: gp\n\nItems:\n- Rope | 5 gp | stock: 2 | Fifty feet of hemp rope\n- Torch | 1 gp | stock: 6 | A simple torch\n[/SHOP]\n\nHe folds his arms and waits.`;
  const fake = await startFakeAnthropic({ delayMs: 0, text: shopNarration });
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
    const { cookie } = await register(baseUrl);
    const campaign = await createCampaignAndCharacter(baseUrl, cookie);

    const start = await request(baseUrl, `/api/campaigns/${campaign.id}/start`, { method: 'POST', cookie });
    assert.equal(start.status, 200, `opening scene failed: ${start.status}`);
    const opening = await start.json();
    assert.equal(opening.message.content.includes('[SHOP]'), false, 'internal shop protocol markup leaked into narration');

    const shopResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/shop`, { cookie });
    assert.equal(shopResponse.status, 200);
    const shop = await shopResponse.json();
    assert.equal(shop.shop.merchantName, 'Quartermaster Vale');
    assert.equal(shop.shop.currencyCode, 'gp');
    assert.deepEqual(
      shop.items.map((item) => ({ name: item.name, stock: item.stock, priceAmount: item.priceAmount, priceCurrencyCode: item.priceCurrencyCode })),
      [
        { name: 'Rope', stock: 2, priceAmount: 5, priceCurrencyCode: 'gp' },
        { name: 'Torch', stock: 6, priceAmount: 1, priceCurrencyCode: 'gp' },
      ],
    );
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await fake.close();
    rmSync(dbDir, { recursive: true, force: true });
  }
});


test('AI provider failure does not consume the item being used', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-item-refund-'));
  const fake = await startFakeAnthropic({ delayMs: 0, status: 401 });
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
    const { cookie } = await register(baseUrl);
    const campaign = await createCampaignAndCharacter(baseUrl, cookie);
    const characterResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/my-character`, { cookie });
    assert.equal(characterResponse.status, 200);
    const character = await characterResponse.json();

    const itemResponse = await request(baseUrl, `/api/characters/${character.id}/items`, {
      method: 'POST', cookie,
      body: {
        name: 'Healing Potion', description: 'Restores vitality.', itemType: 'consumable',
        quantity: 1, consumable: true, identified: true,
      },
    });
    assert.equal(itemResponse.status, 201);
    const item = await itemResponse.json();

    const useResponse = await request(baseUrl, `/api/items/${item.id}/use`, {
      method: 'POST', cookie, body: {},
    });
    assert.equal(useResponse.status, 200);

    const itemsResponse = await request(baseUrl, `/api/characters/${character.id}/items`, { cookie });
    assert.equal(itemsResponse.status, 200);
    const items = await itemsResponse.json();
    const potion = items.find((entry) => entry.id === item.id);
    assert.ok(potion, 'provider failure permanently removed the consumable');
    assert.equal(potion.quantity, 1);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await fake.close();
    rmSync(dbDir, { recursive: true, force: true });
  }
});


test('successful AI item use consumes exactly one consumable unit', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-item-success-'));
  const fake = await startFakeAnthropic({ delayMs: 0, status: 200 });
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
    const { cookie } = await register(baseUrl);
    const campaign = await createCampaignAndCharacter(baseUrl, cookie);
    const characterResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/my-character`, { cookie });
    const character = await characterResponse.json();

    const itemResponse = await request(baseUrl, `/api/characters/${character.id}/items`, {
      method: 'POST', cookie,
      body: {
        name: 'Healing Potion', description: 'Restores vitality.', itemType: 'consumable',
        quantity: 2, consumable: true, identified: true,
      },
    });
    const item = await itemResponse.json();

    const useResponse = await request(baseUrl, `/api/items/${item.id}/use`, {
      method: 'POST', cookie, body: {},
    });
    assert.equal(useResponse.status, 200);

    const itemsResponse = await request(baseUrl, `/api/characters/${character.id}/items`, { cookie });
    const items = await itemsResponse.json();
    const potion = items.find((entry) => entry.id === item.id);
    assert.ok(potion);
    assert.equal(potion.quantity, 1, 'successful use should consume one unit');
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await fake.close();
    rmSync(dbDir, { recursive: true, force: true });
  }
});
