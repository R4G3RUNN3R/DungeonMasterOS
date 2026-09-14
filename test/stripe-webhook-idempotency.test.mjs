import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import Stripe from 'stripe';
import Database from 'better-sqlite3';

const repoRoot = path.resolve(import.meta.dirname, '..');
const webhookSecret = 'whsec_test_dmos_idempotency';

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

async function register(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'stripe-user@example.invalid', username: 'stripe-user', password: 'Password123!' }),
  });
  if (response.status !== 201) throw new Error(`registration failed: ${response.status} ${await response.text()}`);
  const body = await response.json();
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie, 'registration did not set session cookie');
  return { cookie, user: body.user };
}

async function sendSignedWebhook(baseUrl, event) {
  const stripe = new Stripe('sk_test_dmos_local_only');
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  return fetch(`${baseUrl}/api/stripe/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  });
}

test('Stripe webhook replay cannot grant the same turn top-up twice', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-stripe-idempotency-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      DATABASE_URL: path.join(dbDir, 'test.db'),
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy', APP_URL: baseUrl,
      STRIPE_SECRET_KEY: 'sk_test_dmos_local_only',
      STRIPE_WEBHOOK_SECRET: webhookSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child);
    const { cookie, user } = await register(baseUrl);
    assert.equal(user.bonusTurns, 0);

    const event = {
      id: 'evt_test_topup_once',
      object: 'event',
      api_version: '2025-02-24.acacia',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_topup_once',
          object: 'checkout.session',
          metadata: {
            userId: String(user.id),
            topUpTurns: '25',
            packId: 'test-pack',
          },
          customer: 'cus_test_local',
          subscription: null,
        },
      },
    };

    const first = await sendSignedWebhook(baseUrl, event);
    assert.equal(first.status, 200, `first webhook failed: ${await first.text()}`);

    const replay = await sendSignedWebhook(baseUrl, event);
    assert.equal(replay.status, 200, `replayed webhook failed: ${await replay.text()}`);

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    const current = await me.json();
    assert.equal(current.user.bonusTurns, 25, 'replayed Stripe event granted the top-up more than once');
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
    if (stderr && !stderr.includes('serving on port')) {
      // Preserve useful diagnostics only when the server emitted real errors.
      const useful = stderr.split('\n').filter((line) => line && !line.includes('ExperimentalWarning')).join('\n');
      if (useful) console.error(useful);
    }
  }
});


test('Stripe subscription lifecycle stays consistent across retries and stale events', async () => {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-stripe-lifecycle-'));
  const dbPath = path.join(dbDir, 'test.db');
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      DATABASE_URL: dbPath,
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy', APP_URL: baseUrl,
      STRIPE_SECRET_KEY: 'sk_test_dmos_local_only',
      STRIPE_WEBHOOK_SECRET: webhookSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(baseUrl, child);
    const { cookie, user } = await register(baseUrl);
    const db = new Database(dbPath);
    db.prepare(`
      UPDATE users
      SET tier = 'master',
          subscription_status = 'active',
          stripe_customer_id = 'cus_lifecycle',
          stripe_subscription_id = 'sub_lifecycle',
          stripe_price_id = 'price_master',
          ai_turns_used_this_month = 73
      WHERE id = ?
    `).run(user.id);
    db.close();

    const eventBase = {
      object: 'event',
      api_version: '2025-02-24.acacia',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
    };

    const failedPayment = {
      ...eventBase,
      id: 'evt_lifecycle_failed',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_failed', object: 'invoice', subscription: 'sub_lifecycle' } },
    };
    assert.equal((await sendSignedWebhook(baseUrl, failedPayment)).status, 200);

    let me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    let current = await me.json();
    assert.equal(current.user.subscriptionStatus, 'past_due');

    const recoveredPayment = {
      ...eventBase,
      id: 'evt_lifecycle_recovered',
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_recovered', object: 'invoice', subscription: 'sub_lifecycle' } },
    };
    assert.equal((await sendSignedWebhook(baseUrl, recoveredPayment)).status, 200);

    me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    current = await me.json();
    assert.equal(current.user.subscriptionStatus, 'active');
    assert.equal(current.user.aiTurnsUsedThisMonth, 0, 'successful renewal should reset monthly usage');

    const cancelledUpdate = {
      ...eventBase,
      id: 'evt_lifecycle_cancelled',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_lifecycle', object: 'subscription', status: 'canceled',
          current_period_end: Math.floor(Date.now() / 1000) + 3600,
          items: { data: [{ price: { id: 'price_master' } }] },
        },
      },
    };
    assert.equal((await sendSignedWebhook(baseUrl, cancelledUpdate)).status, 200);

    me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    current = await me.json();
    assert.equal(current.user.subscriptionStatus, 'cancelled');
    assert.equal(current.user.tier, 'master', 'scheduled cancellation must preserve paid tier until deletion');

    const deleted = {
      ...eventBase,
      id: 'evt_lifecycle_deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_lifecycle', object: 'subscription', status: 'canceled',
          items: { data: [{ price: { id: 'price_master' } }] },
        },
      },
    };
    assert.equal((await sendSignedWebhook(baseUrl, deleted)).status, 200);

    me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    current = await me.json();
    assert.equal(current.user.subscriptionStatus, 'expired');
    assert.equal(current.user.tier, 'free');
    assert.equal(current.user.stripeSubscriptionId, null);

    const staleSuccess = {
      ...eventBase,
      id: 'evt_lifecycle_stale_success',
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_stale', object: 'invoice', subscription: 'sub_lifecycle' } },
    };
    assert.equal((await sendSignedWebhook(baseUrl, staleSuccess)).status, 200);

    me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    current = await me.json();
    assert.equal(current.user.subscriptionStatus, 'expired', 'late invoice must not resurrect a deleted subscription');
    assert.equal(current.user.tier, 'free');
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
});
