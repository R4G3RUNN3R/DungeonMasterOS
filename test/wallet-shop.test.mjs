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
  if (response.status !== 201) throw new Error(`registration failed (${response.status}): ${await response.text()}`);
  const body = await response.json();
  return {
    cookie: response.headers.get('set-cookie').split(';', 1)[0],
    user: body.user,
  };
}

async function createCampaign(baseUrl, cookie) {
  const response = await request(baseUrl, '/api/campaigns', {
    method: 'POST', cookie,
    body: {
      name: 'Wallet Shop Test', tone: 'heroic', rulesWeight: 'medium', powerLevel: 'standard',
      worldType: 'original', combatStyle: 'cinematic', storyMode: false, worldGenStyle: 'standard',
      homebrewRules: '', customWorldPrompt: '', epicMode: false, animeWorldSource: '', animeWorldMode: 'none',
      currencies: [{ code: 'gp', name: 'Gold', symbol: 'gp', isPrimary: true, exchangeRate: 1 }],
    },
  });
  if (response.status !== 201) throw new Error(`campaign failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function createCharacter(baseUrl, cookie, campaignId) {
  const response = await request(baseUrl, `/api/campaigns/${campaignId}/characters`, {
    method: 'POST', cookie,
    body: { name: 'Buyer', race: 'Human', charClass: 'Fighter', traits: '', backstory: '' },
  });
  if (response.status !== 201) throw new Error(`character failed (${response.status}): ${await response.text()}`);
  return response.json();
}

function startDmos(dbPath, port) {
  return spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: dbPath,
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy', APP_URL: `http://127.0.0.1:${port}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('character creation seeds a real zero balance for every campaign currency', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-wallet-seed-'));
  const dbPath = path.join(dbDir, 'test.db');
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = startDmos(dbPath, port);

  try {
    await waitForServer(baseUrl, child);
    const { cookie } = await register(baseUrl, 'wallet-owner@example.invalid', 'wallet-owner');
    const campaign = await createCampaign(baseUrl, cookie);
    const character = await createCharacter(baseUrl, cookie, campaign.id);

    const response = await request(baseUrl, `/api/characters/${character.id}/currencies`, { cookie });
    assert.equal(response.status, 200);
    const balances = await response.json();
    assert.deepEqual(
      balances.map(({ currencyCode, amount }) => ({ currencyCode, amount })),
      [{ currencyCode: 'gp', amount: 0 }],
    );
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
});

test('shop purchase atomically deducts wallet, stock and grants exactly one item', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-shop-purchase-'));
  const dbPath = path.join(dbDir, 'test.db');
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = startDmos(dbPath, port);

  try {
    await waitForServer(baseUrl, child);
    const { cookie } = await register(baseUrl, 'shop-owner@example.invalid', 'shop-owner');
    const campaign = await createCampaign(baseUrl, cookie);
    const character = await createCharacter(baseUrl, cookie, campaign.id);

    const db = new Database(dbPath);
    db.prepare('UPDATE character_currencies SET amount = 10 WHERE character_id = ? AND currency_code = ?').run(character.id, 'gp');
    db.close();

    const open = await request(baseUrl, `/api/campaigns/${campaign.id}/shop/open`, {
      method: 'POST', cookie,
      body: {
        merchantName: 'Quartermaster',
        currencyCode: 'gp',
        title: 'Supplies',
        items: [{
          itemKey: 'rope', name: 'Rope', description: 'Fifty feet of rope.', itemType: 'gear',
          stock: 1, quantityPerPurchase: 1, priceAmount: 5, priceCurrencyCode: 'gp',
        }],
      },
    });
    if (open.status !== 201) {
      throw new Error(`shop open failed (${open.status}): ${await open.text()}`);
    }
    const opened = await open.json();
    assert.equal(opened.items.length, 1);

    const itemId = opened.items[0].id;
    const buys = await Promise.all([
      request(baseUrl, `/api/campaigns/${campaign.id}/shop/buy`, {
        method: 'POST', cookie, body: { shopItemId: itemId, quantity: 1 },
      }),
      request(baseUrl, `/api/campaigns/${campaign.id}/shop/buy`, {
        method: 'POST', cookie, body: { shopItemId: itemId, quantity: 1 },
      }),
    ]);
    assert.deepEqual(buys.map((response) => response.status).sort((a, b) => a - b), [200, 400]);

    const walletResponse = await request(baseUrl, `/api/characters/${character.id}/currencies`, { cookie });
    const wallet = await walletResponse.json();
    assert.equal(wallet.find((row) => row.currencyCode === 'gp')?.amount, 5);

    const shopResponse = await request(baseUrl, `/api/campaigns/${campaign.id}/shop`, { cookie });
    assert.equal(shopResponse.status, 200);
    const shop = await shopResponse.json();
    assert.equal(shop.items[0].stock, 0);

    const itemsResponse = await request(baseUrl, `/api/characters/${character.id}/items`, { cookie });
    const items = await itemsResponse.json();
    const purchased = items.filter((item) => item.name === 'Rope');
    assert.equal(purchased.length, 1);
    assert.equal(purchased[0].quantity, 1);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
});
