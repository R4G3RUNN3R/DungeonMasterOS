import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';

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
  throw new Error('DMOS SEO test server did not become ready');
}

function canonicalFrom(html) {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? null;
}

function robotsFrom(html) {
  return html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null;
}

function titleFrom(html) {
  return html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? null;
}

function bodyFrom(html) {
  return html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '';
}

async function withProductionServer(run) {
  const dbDir = mkdtempSync(path.join(tmpdir(), 'dmos-seo-routes-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.cjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: path.join(dbDir, 'test.db'),
      JWT_SECRET: 'test-only-jwt-secret-with-enough-entropy',
      APP_URL: baseUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(baseUrl, child);
    await run(baseUrl);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    rmSync(dbDir, { recursive: true, force: true });
  }
}

const publicRoutes = [
  {
    path: '/',
    canonical: 'https://dungeonmaster-os.com/',
    title: 'DungeonMasterOS | Persistent AI Dungeon Master RPG',
    bodyPattern: /persistent AI Dungeon Master/i,
  },
  {
    path: '/how-it-works',
    canonical: 'https://dungeonmaster-os.com/how-it-works',
    title: 'How DungeonMasterOS Works | Persistent AI RPG Campaigns',
    bodyPattern: /campaign memory/i,
  },
  {
    path: '/pricing',
    canonical: 'https://dungeonmaster-os.com/pricing',
    title: 'DungeonMasterOS Pricing | AI Dungeon Master Plans',
    bodyPattern: /subscription|pricing|plans/i,
  },
];

test('production HTML gives each public DMOS route self-canonical indexable metadata', async () => {
  await withProductionServer(async (baseUrl) => {
    for (const expected of publicRoutes) {
      const response = await fetch(`${baseUrl}${expected.path}`);
      assert.equal(response.status, 200, `${expected.path} should return HTTP 200`);
      const html = await response.text();
      assert.equal(canonicalFrom(html), expected.canonical, `${expected.path} canonical must be self-referential`);
      assert.equal(titleFrom(html), expected.title, `${expected.path} must have route-specific title metadata`);
      assert.match(robotsFrom(html) ?? '', /^index,\s*follow/i, `${expected.path} must be indexable`);
    }
  });
});

test('production HTML exposes crawlable public-page content and the Voidsmith publisher link before JavaScript', async () => {
  await withProductionServer(async (baseUrl) => {
    for (const expected of publicRoutes) {
      const response = await fetch(`${baseUrl}${expected.path}`);
      const body = bodyFrom(await response.text());
      assert.match(body, expected.bodyPattern, `${expected.path} must expose semantic page content in the HTML body`);
      assert.match(body, /href=["']https:\/\/voidsmithindustries\.com\/["']/i, `${expected.path} must expose the Voidsmith publisher link in the HTML body`);
    }
  });
});

test('production HTML marks auth and application routes noindex without homepage canonical leakage', async () => {
  await withProductionServer(async (baseUrl) => {
    for (const route of ['/login', '/register', '/dashboard']) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, `${route} should continue to serve the application shell`);
      const html = await response.text();
      assert.match(robotsFrom(html) ?? '', /^noindex/i, `${route} must be noindex in the server response`);
      assert.notEqual(canonicalFrom(html), 'https://dungeonmaster-os.com/', `${route} must not canonicalize to the public homepage`);
    }
  });
});


test('production returns a real 404 for unknown routes while preserving noindex shell metadata', async () => {
  await withProductionServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/__seo_probe_missing__`);
    assert.equal(response.status, 404, 'unknown route must return HTTP 404');
    const html = await response.text();
    assert.match(robotsFrom(html) ?? '', /^noindex/i, 'unknown-route shell must remain noindex');
    assert.equal(canonicalFrom(html), null, 'unknown-route shell must not advertise a canonical URL');
  });
});
