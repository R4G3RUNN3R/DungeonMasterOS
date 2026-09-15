import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');

function readCatalogConstants() {
  const script = `
    import { TIERS, PUBLIC_SUBSCRIPTION_TIERS, TOP_UP_SALES_ENABLED } from './shared/tiers.ts';
    console.log(JSON.stringify({
      publicTiers: PUBLIC_SUBSCRIPTION_TIERS,
      topUpsEnabled: TOP_UP_SALES_ENABLED,
      prices: Object.fromEntries(PUBLIC_SUBSCRIPTION_TIERS.map((tier) => [tier, {
        weekly: TIERS[tier].priceWeekly,
        monthly: TIERS[tier].priceMonthly,
        yearly: TIERS[tier].priceYearly,
      }])),
    }));
  `;
  const out = execFileSync(tsx, ['--eval', script], { cwd: repoRoot, encoding: 'utf8' });
  return JSON.parse(out.trim());
}

test('V1 public subscription catalogue matches the active August 2026 Stripe catalogue', () => {
  const catalog = readCatalogConstants();
  assert.deepEqual(catalog.publicTiers, ['adventurer', 'master', 'legend']);
  assert.equal(catalog.topUpsEnabled, false, 'legacy turn packs must remain fail-closed until live Stripe prices exist');
  assert.deepEqual(catalog.prices, {
    adventurer: { weekly: 499, monthly: 1499, yearly: 15999 },
    master: { weekly: 799, monthly: 2499, yearly: 26999 },
    legend: { weekly: 1099, monthly: 3499, yearly: 37999 },
  });
});


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

test('public billing catalogue exposes only configured V1 products and keeps top-ups closed', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-billing-catalog-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      DATABASE_URL: path.join(dbDir, 'test.db'),
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy', APP_URL: baseUrl,
      STRIPE_SECRET_KEY: 'sk_test_dmos_catalog_local_only',
      STRIPE_PRICE_ADVENTURER_WEEKLY: 'price_adv_weekly',
      STRIPE_PRICE_ADVENTURER_MONTHLY: 'price_adv_monthly',
      STRIPE_PRICE_ADVENTURER_YEARLY: 'price_adv_yearly',
      STRIPE_PRICE_MASTER_WEEKLY: 'price_master_weekly',
      STRIPE_PRICE_MASTER_MONTHLY: 'price_master_monthly',
      STRIPE_PRICE_MASTER_YEARLY: 'price_master_yearly',
      STRIPE_PRICE_LEGEND_WEEKLY: 'price_legend_weekly',
      STRIPE_PRICE_LEGEND_MONTHLY: 'price_legend_monthly',
      STRIPE_PRICE_LEGEND_YEARLY: 'price_legend_yearly',
      STRIPE_PRICE_CHRONICLER_MONTHLY: 'price_must_not_be_public',
      STRIPE_PRICE_TOPUP_50_ADVENTURER: 'price_must_not_enable_legacy_topups',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(baseUrl, child);
    const response = await fetch(`${baseUrl}/api/billing/catalog`);
    assert.equal(response.status, 200);
    const catalog = await response.json();
    assert.equal(catalog.currency, 'gbp');
    assert.deepEqual(catalog.subscriptions.map((item) => item.tier), ['adventurer', 'master', 'legend']);
    assert.deepEqual(catalog.subscriptions[0], {
      tier: 'adventurer',
      displayName: 'Adventurer',
      prices: { weekly: 499, monthly: 1499, yearly: 15999 },
      turns: { weekly: 50, monthly: 200, yearly: 200 },
      available: { weekly: true, monthly: true, yearly: true },
    });
    assert.equal(catalog.topUpsEnabled, false);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
});


test('customer billing screens consume the live-availability catalogue and avoid stale commercial claims', () => {
  const pricingSource = readFileSync(path.join(repoRoot, 'client/src/pages/pricing.tsx'), 'utf8');
  const billingSource = readFileSync(path.join(repoRoot, 'client/src/pages/billing.tsx'), 'utf8');
  assert.match(pricingSource, /PUBLIC_SUBSCRIPTION_TIERS/);
  assert.match(pricingSource, /\/api\/billing\/catalog/);
  assert.match(billingSource, /\/api\/billing\/catalog/);
  assert.match(billingSource, /topUpsEnabled/);
  assert.doesNotMatch(pricingSource, /Players always join for free/i);
  assert.doesNotMatch(pricingSource, /Only the campaign host needs a subscription/i);
  assert.doesNotMatch(pricingSource, /-17%/);
  assert.doesNotMatch(pricingSource, /-30%/);
});


test('paid AI turn entitlements match Stripe metadata and reset on the sold cadence', () => {
  const script = `
    import { getAiTurnAllowance, getNextTurnResetAt } from './shared/tiers.ts';
    const trialEnd = null;
    const rows = {};
    for (const tier of ['adventurer', 'master', 'legend']) {
      rows[tier] = {};
      for (const interval of ['weekly', 'monthly', 'yearly']) {
        rows[tier][interval] = getAiTurnAllowance(tier, 'active', trialEnd, interval);
      }
    }
    const from = new Date('2026-09-15T00:00:00.000Z');
    console.log(JSON.stringify({
      rows,
      resets: {
        weekly: getNextTurnResetAt('weekly', from).toISOString(),
        monthly: getNextTurnResetAt('monthly', from).toISOString(),
        yearly: getNextTurnResetAt('yearly', from).toISOString(),
      },
    }));
  `;
  const out = execFileSync(tsx, ['--eval', script], { cwd: repoRoot, encoding: 'utf8' });
  const result = JSON.parse(out.trim());
  assert.deepEqual(result.rows, {
    adventurer: {
      weekly: { limit: 50, cadence: 'week' },
      monthly: { limit: 200, cadence: 'month' },
      yearly: { limit: 200, cadence: 'month' },
    },
    master: {
      weekly: { limit: 100, cadence: 'week' },
      monthly: { limit: 400, cadence: 'month' },
      yearly: { limit: 400, cadence: 'month' },
    },
    legend: {
      weekly: { limit: 150, cadence: 'week' },
      monthly: { limit: 600, cadence: 'month' },
      yearly: { limit: 600, cadence: 'month' },
    },
  });
  assert.deepEqual(result.resets, {
    weekly: '2026-09-22T00:00:00.000Z',
    monthly: '2026-10-15T00:00:00.000Z',
    yearly: '2026-10-15T00:00:00.000Z',
  });
});

test('billing endpoints have a single authoritative route registration', () => {
  const sources = [
    readFileSync(path.join(repoRoot, 'server/routes.ts'), 'utf8'),
    readFileSync(path.join(repoRoot, 'server/billing-v1.ts'), 'utf8'),
  ].join('\n');
  const endpoints = [
    ['post', '/api/stripe/webhook'],
    ['post', '/api/stripe/checkout'],
    ['post', '/api/stripe/portal'],
    ['post', '/api/stripe/topup'],
    ['post', '/api/stripe/cancel'],
    ['get', '/api/billing'],
  ];
  for (const [method, route] of endpoints) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = sources.match(new RegExp(`app\\.${method}\\("${escaped}"`, 'g')) || [];
    assert.equal(matches.length, 1, `${method.toUpperCase()} ${route} must have exactly one route registration`);
  }
});
