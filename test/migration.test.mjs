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
    if (child.exitCode !== null) throw new Error(`DMOS exited during migration with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/auth/me`);
      if (response.status === 401) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('DMOS did not become ready after migration');
}

function createOldV1Database(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL DEFAULT 'trial',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      stripe_price_id TEXT,
      trial_ends_at TEXT,
      subscription_current_period_end TEXT,
      ai_turns_used_this_month INTEGER NOT NULL DEFAULT 0,
      usage_reset_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      host_visitor_id TEXT NOT NULL,
      user_id INTEGER,
      tone TEXT NOT NULL DEFAULT 'heroic',
      rules_weight TEXT NOT NULL DEFAULT 'medium',
      power_level TEXT NOT NULL DEFAULT 'standard',
      world_type TEXT NOT NULL DEFAULT 'original',
      world_state TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      visitor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      race TEXT NOT NULL DEFAULT 'Unknown',
      char_class TEXT NOT NULL DEFAULT 'Unknown',
      traits TEXT NOT NULL DEFAULT '',
      backstory TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 1,
      hp INTEGER NOT NULL DEFAULT 20,
      max_hp INTEGER NOT NULL DEFAULT 20,
      status TEXT NOT NULL DEFAULT 'alive',
      inventory TEXT NOT NULL DEFAULT '[]',
      character_data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'narration',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      true_name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      true_description TEXT NOT NULL DEFAULT '',
      item_type TEXT NOT NULL DEFAULT 'gear',
      quantity INTEGER NOT NULL DEFAULT 1,
      charges INTEGER,
      max_charges INTEGER,
      identified INTEGER NOT NULL DEFAULT 1,
      consumable INTEGER NOT NULL DEFAULT 0,
      equipped INTEGER NOT NULL DEFAULT 0,
      location_note TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO users (id, email, username, password_hash)
    VALUES (1, 'old@example.invalid', 'old-user', 'not-a-real-hash');
    INSERT INTO campaigns (id, name, invite_code, host_visitor_id, user_id)
    VALUES (1, 'Old Campaign', 'oldcode1', 'user-1', 1);
    INSERT INTO characters (id, campaign_id, visitor_id, name, race, char_class)
    VALUES (1, 1, 'user-1', 'Old Hero', 'Human', 'Fighter');
    INSERT INTO items (id, campaign_id, character_id, name, item_type, quantity)
    VALUES (1, 1, 1, 'Old Sword', 'weapon', 1);
  `);
  db.close();
}

test('current startup migrates an older V1 database in place without losing rows', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'dmos-old-v1-'));
  const dbPath = path.join(dir, 'old.db');
  createOldV1Database(dbPath);

  // Simulate the last pre-canonical-role schema with both legacy privilege paths.
  const legacyDb = new Database(dbPath);
  legacyDb.exec(`
    ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'player';
    ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN unlimited_turns INTEGER NOT NULL DEFAULT 0;
    INSERT INTO users (id, email, username, password_hash, role, is_admin, unlimited_turns)
    VALUES
      (2, 'legacy-dm@example.invalid', 'legacy-dm', 'not-a-real-hash', 'dungeon_master', 0, 0),
      (3, 'legacy-admin@example.invalid', 'legacy-admin', 'not-a-real-hash', 'player', 1, 0),
      (4, 'legacy-ai@example.invalid', 'legacy-ai', 'not-a-real-hash', 'player', 0, 1);
  `);
  legacyDb.close();

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
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await waitForServer(baseUrl, child);

    const db = new Database(dbPath, { readonly: true });
    assert.equal(db.pragma('quick_check', { simple: true }), 'ok');

    const userColumns = new Set(db.pragma('table_info(users)').map((row) => row.name));
    for (const column of ['role', 'access_role', 'bonus_turns', 'onboarding_complete', 'subscription_bypass', 'campaign_limit_bypass', 'unlimited_ai_turns', 'unlimited_turns', 'is_admin', 'auth_version']) {
      assert.equal(userColumns.has(column), true, `users.${column} was not migrated`);
    }

    const sessionColumns = new Set(db.pragma('table_info(auth_sessions)').map((row) => row.name));
    for (const column of ['token_hash', 'user_id', 'auth_method', 'created_at', 'last_seen_at', 'expires_at', 'revoked_at', 'auth_version']) {
      assert.equal(sessionColumns.has(column), true, `auth_sessions.${column} was not migrated`);
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 0);

    const securityEventColumns = new Set(db.pragma('table_info(security_events)').map((row) => row.name));
    for (const column of ['actor_user_id', 'subject_user_id', 'event_type', 'metadata', 'created_at']) {
      assert.equal(securityEventColumns.has(column), true, `security_events.${column} was not migrated`);
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM security_events").get().count, 0);

    const itemColumns = new Set(db.pragma('table_info(items)').map((row) => row.name));
    assert.equal(itemColumns.has('stat_mods'), true);
    assert.equal(itemColumns.has('updated_at'), true);

    assert.equal(db.prepare('SELECT name FROM campaigns WHERE id = 1').get().name, 'Old Campaign');
    assert.equal(db.prepare('SELECT name FROM characters WHERE id = 1').get().name, 'Old Hero');
    assert.equal(db.prepare('SELECT name FROM items WHERE id = 1').get().name, 'Old Sword');
    assert.equal(db.prepare('SELECT role FROM users WHERE id = 1').get().role, 'player');
    assert.equal(db.prepare('SELECT access_role AS accessRole FROM users WHERE id = 1').get().accessRole, 'player');
    assert.equal(db.prepare('SELECT access_role AS accessRole FROM users WHERE id = 2').get().accessRole, 'admin');
    assert.equal(db.prepare('SELECT access_role AS accessRole FROM users WHERE id = 3').get().accessRole, 'admin');
    assert.equal(db.prepare('SELECT access_role AS accessRole FROM users WHERE id = 4').get().accessRole, 'player');
    assert.equal(db.prepare('SELECT role FROM users WHERE id = 2').get().role, 'dungeon_master');
    assert.equal(db.prepare('SELECT is_admin AS isAdmin FROM users WHERE id = 3').get().isAdmin, 1);
    for (const id of [2, 3]) {
      const entitlements = db.prepare('SELECT subscription_bypass AS subscriptionBypass, campaign_limit_bypass AS campaignLimitBypass, unlimited_ai_turns AS unlimitedAiTurns FROM users WHERE id = ?').get(id);
      assert.equal(entitlements.subscriptionBypass, 1);
      assert.equal(entitlements.campaignLimitBypass, 1);
      assert.equal(entitlements.unlimitedAiTurns, 1);
    }
    const normalEntitlements = db.prepare('SELECT subscription_bypass AS subscriptionBypass, campaign_limit_bypass AS campaignLimitBypass, unlimited_ai_turns AS unlimitedAiTurns FROM users WHERE id = 1').get();
    assert.deepEqual(normalEntitlements, { subscriptionBypass: 0, campaignLimitBypass: 0, unlimitedAiTurns: 0 });
    const legacyAiEntitlements = db.prepare('SELECT subscription_bypass AS subscriptionBypass, campaign_limit_bypass AS campaignLimitBypass, unlimited_ai_turns AS unlimitedAiTurns FROM users WHERE id = 4').get();
    assert.deepEqual(legacyAiEntitlements, { subscriptionBypass: 0, campaignLimitBypass: 0, unlimitedAiTurns: 1 });
    assert.equal(db.prepare('SELECT auth_version AS authVersion FROM users WHERE id = 1').get().authVersion, 0);
    db.close();
  } catch (error) {
    throw new Error(`${error.message}\n${stderr}`);
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
