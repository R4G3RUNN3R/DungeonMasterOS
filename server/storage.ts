import {
  type User,
  type InsertUser,
  users,
  type Campaign,
  type InsertCampaign,
  campaigns,
  type CampaignCurrency,
  type InsertCampaignCurrency,
  campaignCurrencies,
  type Character,
  type InsertCharacter,
  characters,
  type CharacterCurrency,
  characterCurrencies,
  type Message,
  type InsertMessage,
  messages,
  type Item,
  type InsertItem,
  items,
  type ActiveEffect,
  type InsertActiveEffect,
  activeEffects,
  type CampaignSnapshot,
  type InsertCampaignSnapshot,
  campaignSnapshots,
  type ActiveShop,
  type InsertActiveShop,
  activeShops,
  type ShopItem,
  type InsertShopItem,
  shopItems,
  type UserAchievement,
  type InsertUserAchievement,
  userAchievements,
  type PasswordResetToken,
  passwordResetTokens,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, inArray, or } from "drizzle-orm";
import path from "path";

const dbPath = process.env.DATABASE_URL || path.resolve(process.cwd(), "data.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

export type AiTurnReservation = "regular" | "bonus";

export type AuthSessionRecord = {
  id: number;
  tokenHash: string;
  userId: number;
  authMethod: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  userAgent: string | null;
  ipHash: string | null;
  authVersion: number;
};

export type NewAuthSessionRecord = Omit<AuthSessionRecord, "id" | "revokedAt"> & {
  revokedAt?: string | null;
};

export type SecurityEventRecord = {
  id: number;
  actorUserId: number | null;
  subjectUserId: number | null;
  eventType: string;
  metadata: string;
  createdAt: string;
};

export type NewSecurityEventRecord = Omit<SecurityEventRecord, "id">;

export type ShopPurchaseResult =
  | { ok: true; wallet: CharacterCurrency; remainingStock: number; item: Item }
  | { ok: false; reason: "not_found" | "stock" | "funds" };

export function reserveAiTurn(userId: number, regularLimit: number): AiTurnReservation | null {
  const transaction = sqlite.transaction(() => {
    const row = sqlite
      .prepare("SELECT ai_turns_used_this_month AS used, bonus_turns AS bonus FROM users WHERE id = ?")
      .get(userId) as { used: number; bonus: number } | undefined;

    if (!row) return null;

    if (regularLimit < 0 || row.used < regularLimit) {
      sqlite
        .prepare("UPDATE users SET ai_turns_used_this_month = ai_turns_used_this_month + 1 WHERE id = ?")
        .run(userId);
      return "regular" as const;
    }

    if (row.bonus > 0) {
      sqlite
        .prepare("UPDATE users SET ai_turns_used_this_month = ai_turns_used_this_month + 1, bonus_turns = bonus_turns - 1 WHERE id = ?")
        .run(userId);
      return "bonus" as const;
    }

    return null;
  });

  return transaction();
}

export function refundAiTurn(userId: number, reservation: AiTurnReservation): void {
  const transaction = sqlite.transaction(() => {
    if (reservation === "bonus") {
      sqlite
        .prepare("UPDATE users SET ai_turns_used_this_month = MAX(0, ai_turns_used_this_month - 1), bonus_turns = bonus_turns + 1 WHERE id = ?")
        .run(userId);
      return;
    }

    sqlite
      .prepare("UPDATE users SET ai_turns_used_this_month = MAX(0, ai_turns_used_this_month - 1) WHERE id = ?")
      .run(userId);
  });

  transaction();
}


const AUTH_SESSION_SELECT = `
  SELECT
    id,
    token_hash AS tokenHash,
    user_id AS userId,
    auth_method AS authMethod,
    created_at AS createdAt,
    last_seen_at AS lastSeenAt,
    expires_at AS expiresAt,
    revoked_at AS revokedAt,
    user_agent AS userAgent,
    ip_hash AS ipHash,
    auth_version AS authVersion
  FROM auth_sessions
`;

export function createAuthSessionRecord(input: NewAuthSessionRecord): AuthSessionRecord {
  const result = sqlite.prepare(`
    INSERT INTO auth_sessions (
      token_hash,
      user_id,
      auth_method,
      created_at,
      last_seen_at,
      expires_at,
      revoked_at,
      user_agent,
      ip_hash,
      auth_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.tokenHash,
    input.userId,
    input.authMethod,
    input.createdAt,
    input.lastSeenAt,
    input.expiresAt,
    input.revokedAt ?? null,
    input.userAgent,
    input.ipHash,
    input.authVersion,
  );

  return sqlite
    .prepare(`${AUTH_SESSION_SELECT} WHERE id = ?`)
    .get(Number(result.lastInsertRowid)) as AuthSessionRecord;
}

export function getAuthSessionByTokenHash(tokenHash: string): AuthSessionRecord | undefined {
  return sqlite
    .prepare(`${AUTH_SESSION_SELECT} WHERE token_hash = ?`)
    .get(tokenHash) as AuthSessionRecord | undefined;
}

export function listActiveAuthSessionsForUser(
  userId: number,
  nowIso: string,
): AuthSessionRecord[] {
  return sqlite
    .prepare(`${AUTH_SESSION_SELECT}
      WHERE user_id = ?
        AND revoked_at IS NULL
        AND expires_at > ?
      ORDER BY last_seen_at DESC, id DESC
    `)
    .all(userId, nowIso) as AuthSessionRecord[];
}

export function revokeAuthSessionByIdForUser(
  sessionId: number,
  userId: number,
  revokedAt: string,
): boolean {
  const result = sqlite
    .prepare(`
      UPDATE auth_sessions
      SET revoked_at = ?
      WHERE id = ?
        AND user_id = ?
        AND revoked_at IS NULL
    `)
    .run(revokedAt, sessionId, userId);
  return result.changes > 0;
}

export function touchAuthSession(id: number, lastSeenAt: string): void {
  sqlite
    .prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL")
    .run(lastSeenAt, id);
}

export function revokeAuthSessionByTokenHash(tokenHash: string, revokedAt: string): boolean {
  const result = sqlite
    .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .run(revokedAt, tokenHash);
  return result.changes > 0;
}

export function revokeAllAuthSessionsForUser(userId: number, revokedAt: string): number {
  const result = sqlite
    .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
    .run(revokedAt, userId);
  return result.changes;
}

export function insertSecurityEventRecord(
  input: NewSecurityEventRecord,
): SecurityEventRecord {
  const result = sqlite.prepare(`
    INSERT INTO security_events (
      actor_user_id,
      subject_user_id,
      event_type,
      metadata,
      created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    input.actorUserId,
    input.subjectUserId,
    input.eventType,
    input.metadata,
    input.createdAt,
  );

  return sqlite.prepare(`
    SELECT
      id,
      actor_user_id AS actorUserId,
      subject_user_id AS subjectUserId,
      event_type AS eventType,
      metadata,
      created_at AS createdAt
    FROM security_events
    WHERE id = ?
  `).get(Number(result.lastInsertRowid)) as SecurityEventRecord;
}

export function updateUserPasswordAndBumpAuthVersion(
  userId: number,
  passwordHash: string,
): number | null {
  const transaction = sqlite.transaction(() => {
    const updated = sqlite
      .prepare(`
        UPDATE users
        SET password_hash = ?, auth_version = auth_version + 1
        WHERE id = ?
      `)
      .run(passwordHash, userId);

    if (updated.changes === 0) return null;

    const row = sqlite
      .prepare("SELECT auth_version AS authVersion FROM users WHERE id = ?")
      .get(userId) as { authVersion: number } | undefined;
    return row?.authVersion ?? null;
  });

  return transaction();
}

export function applyWebhookEventOnce(
  eventId: string,
  eventType: string,
  apply: () => void,
): boolean {
  const transaction = sqlite.transaction(() => {
    const claim = sqlite
      .prepare("INSERT OR IGNORE INTO stripe_webhook_events (event_id, event_type) VALUES (?, ?)")
      .run(eventId, eventType);

    if (claim.changes === 0) return false;

    apply();
    return true;
  });

  return transaction();
}

function columnExists(tableName: string, columnName: string): boolean {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function addColumnIfMissing(tableName: string, columnName: string, columnDef: string) {
  if (!columnExists(tableName, columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

// ── Run migrations on startup ──────────────────────────────────────────────
export function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      google_id TEXT UNIQUE,
      google_email TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'player',
      access_role TEXT NOT NULL DEFAULT 'player',
      tier TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL DEFAULT 'trial',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      stripe_price_id TEXT,
      stripe_billing_interval TEXT,
      trial_ends_at TEXT,
      subscription_current_period_end TEXT,
      bonus_turns INTEGER NOT NULL DEFAULT 0,
      ai_turns_used_this_month INTEGER NOT NULL DEFAULT 0,
      usage_reset_at TEXT,
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      unlimited_turns INTEGER NOT NULL DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0,
      auth_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      auth_method TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      auth_version INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
      ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
      ON auth_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      subject_user_id INTEGER,
      event_type TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_security_events_created_at
      ON security_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_security_events_event_type
      ON security_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_security_events_actor_user_id
      ON security_events(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_security_events_subject_user_id
      ON security_events(subject_user_id);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      processed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      host_visitor_id TEXT NOT NULL,
      user_id INTEGER,
      is_archived INTEGER NOT NULL DEFAULT 0,
      tone TEXT NOT NULL DEFAULT 'heroic',
      rules_weight TEXT NOT NULL DEFAULT 'medium',
      power_level TEXT NOT NULL DEFAULT 'standard',
      world_type TEXT NOT NULL DEFAULT 'original',
      combat_style TEXT NOT NULL DEFAULT 'cinematic',
      story_mode INTEGER NOT NULL DEFAULT 0,
      world_gen_style TEXT NOT NULL DEFAULT 'standard',
      homebrew_rules TEXT NOT NULL DEFAULT '',
      custom_world_prompt TEXT NOT NULL DEFAULT '',
      epic_mode INTEGER NOT NULL DEFAULT 0,
      anime_world_source TEXT NOT NULL DEFAULT '',
      anime_world_mode TEXT NOT NULL DEFAULT 'inspired',
      world_state TEXT NOT NULL DEFAULT '{}',
      total_messages INTEGER NOT NULL DEFAULT 0,
      last_played_at TEXT,
      latest_snapshot_id INTEGER,
      active_shop_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaign_members (
      campaign_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (campaign_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id ON campaign_members(user_id);

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      visitor_id TEXT NOT NULL,
      user_id INTEGER,
      name TEXT NOT NULL,
      race TEXT NOT NULL DEFAULT 'Unknown',
      char_class TEXT NOT NULL DEFAULT 'Unknown',
      traits TEXT NOT NULL DEFAULT '',
      backstory TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 1,
      hp INTEGER NOT NULL DEFAULT 20,
      max_hp INTEGER NOT NULL DEFAULT 20,
      temp_hp INTEGER NOT NULL DEFAULT 0,
      speed INTEGER NOT NULL DEFAULT 30,
      attacks_per_round INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'alive',
      inventory TEXT NOT NULL DEFAULT '[]',
      character_data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'narration',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
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
      stat_mods TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS active_effects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '',
      is_debuff INTEGER NOT NULL DEFAULT 0,
      duration_type TEXT NOT NULL DEFAULT 'rounds',
      total_duration INTEGER,
      rounds_remaining INTEGER,
      concentration INTEGER NOT NULL DEFAULT 0,
      stat_mods TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      applied_by TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      campaign_id INTEGER,
      character_id INTEGER,
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaign_currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL DEFAULT '',
      is_primary INTEGER NOT NULL DEFAULT 0,
      exchange_rate INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(campaign_id, code)
    );

    CREATE TABLE IF NOT EXISTS character_currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      currency_code TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(character_id, currency_code)
    );

    CREATE TABLE IF NOT EXISTS campaign_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT 'Save Point',
      reason TEXT NOT NULL DEFAULT 'manual',
      trigger_message_id INTEGER,
      snapshot_data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS active_shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      merchant_name TEXT NOT NULL,
      merchant_description TEXT NOT NULL DEFAULT '',
      currency_code TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Merchant Stock',
      is_open INTEGER NOT NULL DEFAULT 1,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shop_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      campaign_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      item_type TEXT NOT NULL DEFAULT 'gear',
      quantity_per_purchase INTEGER NOT NULL DEFAULT 1,
      stock INTEGER NOT NULL DEFAULT 1,
      price_amount INTEGER NOT NULL DEFAULT 0,
      price_currency_code TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Bring older databases forward safely. Railway volumes love keeping old schemas around like bad decisions.
  addColumnIfMissing("users", "stripe_billing_interval", "TEXT");
  addColumnIfMissing("users", "bonus_turns", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "onboarding_complete", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "unlimited_turns", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "role", "TEXT NOT NULL DEFAULT 'player'");
  addColumnIfMissing("users", "access_role", "TEXT");
  sqlite.exec(`
    UPDATE users
    SET access_role = CASE
      WHEN is_admin = 1 OR role = 'dungeon_master' THEN 'admin'
      ELSE 'player'
    END
    WHERE access_role IS NULL OR access_role = '';
  `);
  addColumnIfMissing("users", "google_id", "TEXT");
  addColumnIfMissing("users", "google_email", "TEXT");
  addColumnIfMissing("users", "avatar_url", "TEXT");
  addColumnIfMissing("users", "auth_version", "INTEGER NOT NULL DEFAULT 0");
  sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users(google_id) WHERE google_id IS NOT NULL");

  addColumnIfMissing("auth_sessions", "auth_version", "INTEGER NOT NULL DEFAULT 0");

  addColumnIfMissing("campaigns", "is_archived", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("campaigns", "combat_style", "TEXT NOT NULL DEFAULT 'cinematic'");
  addColumnIfMissing("campaigns", "story_mode", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("campaigns", "world_gen_style", "TEXT NOT NULL DEFAULT 'standard'");
  addColumnIfMissing("campaigns", "homebrew_rules", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("campaigns", "custom_world_prompt", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("campaigns", "epic_mode", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("campaigns", "anime_world_source", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("campaigns", "anime_world_mode", "TEXT NOT NULL DEFAULT 'inspired'");
  addColumnIfMissing("campaigns", "total_messages", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("campaigns", "last_played_at", "TEXT");
  addColumnIfMissing("campaigns", "latest_snapshot_id", "INTEGER");
  addColumnIfMissing("campaigns", "active_shop_id", "INTEGER");

  addColumnIfMissing("characters", "user_id", "INTEGER");
  addColumnIfMissing("characters", "temp_hp", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("characters", "speed", "INTEGER NOT NULL DEFAULT 30");
  addColumnIfMissing("characters", "attacks_per_round", "INTEGER NOT NULL DEFAULT 1");

  addColumnIfMissing("messages", "metadata", "TEXT NOT NULL DEFAULT '{}'");
  addColumnIfMissing("items", "stat_mods", "TEXT NOT NULL DEFAULT '[]'");
  if (!columnExists("items", "updated_at")) {
    // SQLite ALTER TABLE rejects non-constant defaults such as datetime('now').
    // Add a safe constant default, then backfill old rows. New Drizzle inserts
    // supply updated_at from the schema's application-side $defaultFn.
    sqlite.exec("ALTER TABLE items ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
    sqlite.exec(`
      UPDATE items
      SET updated_at = CASE
        WHEN created_at IS NOT NULL AND created_at <> '' THEN created_at
        ELSE datetime('now')
      END
      WHERE updated_at = '';
    `);
  }

  // Preserve access for existing authenticated players when introducing the
  // explicit membership ledger. Character ownership is the strongest existing
  // evidence that a user already belongs to a campaign.
  sqlite.exec(`
    INSERT OR IGNORE INTO campaign_members (campaign_id, user_id)
    SELECT DISTINCT campaign_id, user_id
    FROM characters
    WHERE user_id IS NOT NULL;
  `);
}

// ── Storage interface ──────────────────────────────────────────────────────
export interface IStorage {
  // Users
  getUser(id: number): User | undefined;
  getUserByUsername(username: string): User | undefined;
  getUserByEmail(email: string): User | undefined;
  getUserByGoogleId(googleId: string): User | undefined;
  getUserByStripeCustomerId(customerId: string): User | undefined;
  getUserByStripeSubscriptionId(subscriptionId: string): User | undefined;
  createUser(user: InsertUser): User;
  updateUser(id: number, updates: Partial<User>): void;

  // Password reset
  createPasswordResetToken(userId: number, token: string, expiresAt: Date): PasswordResetToken;
  getPasswordResetToken(token: string): PasswordResetToken | undefined;
  markPasswordResetTokenUsed(id: number): void;
  deleteExpiredPasswordResetTokens(): void;

  // Campaigns
  getCampaign(id: number): Campaign | undefined;
  getCampaignByInviteCode(code: string): Campaign | undefined;
  getCampaignsByUser(userId: number): Campaign[];
  getCampaignsAccessibleByUser(userId: number): Campaign[];
  isCampaignMember(campaignId: number, userId: number): boolean;
  addCampaignMember(campaignId: number, userId: number): void;
  createCampaign(campaign: InsertCampaign): Campaign;
  createCampaignWithCurrencies(
    campaign: InsertCampaign,
    currencies: Array<Omit<InsertCampaignCurrency, "campaignId">>,
  ): Campaign;
  updateWorldState(campaignId: number, worldState: string): void;
  updateCampaign(campaignId: number, updates: Partial<Campaign>): void;
  incrementCampaignMessages(campaignId: number): void;
  getCampaignCurrencies(campaignId: number): CampaignCurrency[];
  createCampaignCurrency(currency: InsertCampaignCurrency): CampaignCurrency;

  // Shops
  getActiveShopByCampaign(campaignId: number): ActiveShop | undefined;
  getShopItemsByShop(shopId: number): ShopItem[];
  getShopItem(id: number): ShopItem | undefined;
  openShop(
    shop: InsertActiveShop,
    items: Array<Omit<InsertShopItem, "shopId" | "campaignId">>,
  ): { shop: ActiveShop; items: ShopItem[] };
  closeActiveShop(shopId: number): void;
  purchaseShopItem(
    campaignId: number,
    characterId: number,
    shopItemId: number,
    quantity: number,
  ): ShopPurchaseResult;

  // Characters
  getCharacter(id: number): Character | undefined;
  getCharactersByCampaign(campaignId: number): Character[];
  getCharacterByVisitor(campaignId: number, visitorId: string): Character | undefined;
  createCharacter(character: InsertCharacter): Character;
  updateCharacter(id: number, updates: Partial<Character>): void;
  getCharacterCurrencies(characterId: number): CharacterCurrency[];
  getCharacterCurrency(characterId: number, currencyCode: string): CharacterCurrency | undefined;
  adjustCharacterCurrency(
    campaignId: number,
    characterId: number,
    currencyCode: string,
    delta: number,
  ): CharacterCurrency | undefined;
  replaceCharacterCurrencies(
    campaignId: number,
    characterId: number,
    balances: Array<{ currencyCode: string; amount: number }>,
  ): void;

  // Messages
  getMessagesByCampaign(campaignId: number, limit?: number): Message[];
  createMessage(message: InsertMessage): Message;
  countMessagesByCampaign(campaignId: number): number;

  // Items
  getItemsByCharacter(characterId: number): Item[];
  getItem(id: number): Item | undefined;
  createItem(item: InsertItem): Item;
  updateItem(id: number, updates: Partial<Item>): void;
  deleteItem(id: number): void;
  decrementItem(id: number): Item | undefined;
  countItemsByCharacter(characterId: number): number;

  // Active Effects
  getActiveEffectsByCharacter(characterId: number): ActiveEffect[];
  getActiveEffectsByCampaign(campaignId: number): ActiveEffect[];
  getActiveEffect(id: number): ActiveEffect | undefined;
  createActiveEffect(effect: InsertActiveEffect): ActiveEffect;
  updateActiveEffect(id: number, updates: Partial<ActiveEffect>): void;
  deleteActiveEffect(id: number): void;
  removeConcentration(characterId: number): ActiveEffect | undefined;
  tickEffects(characterId: number): ActiveEffect[];

  // Campaign snapshots / recovery
  createCampaignSnapshot(data: InsertCampaignSnapshot): CampaignSnapshot;
  getCampaignSnapshot(id: number): CampaignSnapshot | undefined;
  getCampaignSnapshots(campaignId: number): CampaignSnapshot[];
  buildCampaignSnapshot(campaignId: number): Record<string, unknown> | null;
  restoreCampaignSnapshot(snapshotId: number): Campaign | null;

  // Achievements
  getUserAchievements(userId: number): UserAchievement[];
  unlockAchievement(data: InsertUserAchievement): UserAchievement;
  hasAchievement(userId: number, achievementId: string): boolean;
  getUnlockedAchievementIds(userId: number): Set<string>;
}

// ── Implementation ─────────────────────────────────────────────────────────
export class DatabaseStorage implements IStorage {
  // Users
  getUser(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByUsername(username: string): User | undefined {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  getUserByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  getUserByGoogleId(googleId: string): User | undefined {
    return db.select().from(users).where(eq(users.googleId, googleId)).get();
  }
  getUserByStripeCustomerId(customerId: string): User | undefined {
    return db.select().from(users).where(eq(users.stripeCustomerId, customerId)).get();
  }
  getUserByStripeSubscriptionId(subscriptionId: string): User | undefined {
    return db.select().from(users).where(eq(users.stripeSubscriptionId, subscriptionId)).get();
  }
  createUser(insertUser: InsertUser): User {
    try {
      return db.insert(users).values({
        accessRole: "player",
        ...insertUser,
      }).returning().get();
    } catch (err: any) {
      if (String(err?.message || '').toLowerCase().includes('unique')) {
        throw new Error('A user with that email or username already exists.');
      }
      throw err;
    }
  }
  updateUser(id: number, updates: Partial<User>): void {
    db.update(users).set(updates as any).where(eq(users.id, id)).run();
  }

  // Password reset
  createPasswordResetToken(userId: number, token: string, expiresAt: Date): PasswordResetToken {
    return db
      .insert(passwordResetTokens)
      .values({ userId, token, expiresAt: expiresAt.toISOString() })
      .returning()
      .get();
  }
  getPasswordResetToken(token: string): PasswordResetToken | undefined {
    return db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).get();
  }
  markPasswordResetTokenUsed(id: number): void {
    db.update(passwordResetTokens).set({ usedAt: new Date().toISOString() }).where(eq(passwordResetTokens.id, id)).run();
  }
  deleteExpiredPasswordResetTokens(): void {
    const now = new Date().toISOString();
    sqlite.prepare("DELETE FROM password_reset_tokens WHERE expires_at < ?").run(now);
  }

  // Campaigns
  getCampaign(id: number): Campaign | undefined {
    return db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  }
  getCampaignByInviteCode(code: string): Campaign | undefined {
    return db.select().from(campaigns).where(eq(campaigns.inviteCode, code)).get();
  }
  getCampaignsByUser(userId: number): Campaign[] {
    return db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.lastPlayedAt), desc(campaigns.createdAt))
      .all();
  }
  getCampaignsAccessibleByUser(userId: number): Campaign[] {
    const memberships = sqlite
      .prepare("SELECT campaign_id FROM campaign_members WHERE user_id = ?")
      .all(userId) as Array<{ campaign_id: number }>;
    const memberIds = memberships.map((row) => row.campaign_id);

    if (memberIds.length === 0) {
      return this.getCampaignsByUser(userId);
    }

    return db
      .select()
      .from(campaigns)
      .where(or(eq(campaigns.userId, userId), inArray(campaigns.id, memberIds)))
      .orderBy(desc(campaigns.lastPlayedAt), desc(campaigns.createdAt))
      .all();
  }
  isCampaignMember(campaignId: number, userId: number): boolean {
    const row = sqlite
      .prepare("SELECT 1 AS ok FROM campaign_members WHERE campaign_id = ? AND user_id = ? LIMIT 1")
      .get(campaignId, userId) as { ok: number } | undefined;
    return !!row;
  }
  addCampaignMember(campaignId: number, userId: number): void {
    sqlite
      .prepare("INSERT OR IGNORE INTO campaign_members (campaign_id, user_id) VALUES (?, ?)")
      .run(campaignId, userId);
  }
  createCampaign(campaign: InsertCampaign): Campaign {
    return db.insert(campaigns).values(campaign).returning().get();
  }
  createCampaignWithCurrencies(
    campaign: InsertCampaign,
    currencies: Array<Omit<InsertCampaignCurrency, "campaignId">>,
  ): Campaign {
    const transaction = sqlite.transaction(() => {
      const created = db.insert(campaigns).values(campaign).returning().get();
      for (const currency of currencies) {
        db.insert(campaignCurrencies).values({ ...currency, campaignId: created.id }).run();
      }
      return created;
    });

    return transaction();
  }
  updateWorldState(campaignId: number, worldState: string): void {
    db.update(campaigns).set({ worldState }).where(eq(campaigns.id, campaignId)).run();
  }
  updateCampaign(campaignId: number, updates: Partial<Campaign>): void {
    db.update(campaigns).set(updates as any).where(eq(campaigns.id, campaignId)).run();
  }
  incrementCampaignMessages(campaignId: number): void {
    sqlite
      .prepare("UPDATE campaigns SET total_messages = total_messages + 1, last_played_at = ? WHERE id = ?")
      .run(new Date().toISOString(), campaignId);
  }
  getCampaignCurrencies(campaignId: number): CampaignCurrency[] {
    return db
      .select()
      .from(campaignCurrencies)
      .where(eq(campaignCurrencies.campaignId, campaignId))
      .orderBy(desc(campaignCurrencies.isPrimary), campaignCurrencies.id)
      .all();
  }
  createCampaignCurrency(currency: InsertCampaignCurrency): CampaignCurrency {
    return db.insert(campaignCurrencies).values(currency).returning().get();
  }
  getActiveShopByCampaign(campaignId: number): ActiveShop | undefined {
    return db
      .select()
      .from(activeShops)
      .where(and(eq(activeShops.campaignId, campaignId), eq(activeShops.isOpen, true)))
      .orderBy(desc(activeShops.updatedAt), desc(activeShops.id))
      .get();
  }
  getShopItemsByShop(shopId: number): ShopItem[] {
    return db
      .select()
      .from(shopItems)
      .where(eq(shopItems.shopId, shopId))
      .orderBy(shopItems.name)
      .all();
  }
  getShopItem(id: number): ShopItem | undefined {
    return db.select().from(shopItems).where(eq(shopItems.id, id)).get();
  }
  openShop(
    shop: InsertActiveShop,
    stock: Array<Omit<InsertShopItem, "shopId" | "campaignId">>,
  ): { shop: ActiveShop; items: ShopItem[] } {
    const transaction = sqlite.transaction(() => {
      const now = new Date().toISOString();
      db.update(activeShops)
        .set({ isOpen: false, updatedAt: now })
        .where(and(eq(activeShops.campaignId, shop.campaignId), eq(activeShops.isOpen, true)))
        .run();

      const opened = db
        .insert(activeShops)
        .values(shop)
        .returning()
        .get();

      db.update(campaigns)
        .set({ activeShopId: opened.id })
        .where(eq(campaigns.id, shop.campaignId))
        .run();

      if (stock.length) {
        db.insert(shopItems)
          .values(
            stock.map((item) => ({
              ...item,
              shopId: opened.id,
              campaignId: shop.campaignId,
            })),
          )
          .run();
      }

      return { shop: opened, items: this.getShopItemsByShop(opened.id) };
    });

    return transaction();
  }
  closeActiveShop(shopId: number): void {
    const transaction = sqlite.transaction(() => {
      const shop = db.select().from(activeShops).where(eq(activeShops.id, shopId)).get();
      if (!shop) return;
      db.update(activeShops)
        .set({ isOpen: false, updatedAt: new Date().toISOString() })
        .where(eq(activeShops.id, shopId))
        .run();
      db.update(campaigns)
        .set({ activeShopId: null })
        .where(and(eq(campaigns.id, shop.campaignId), eq(campaigns.activeShopId, shopId)))
        .run();
    });
    transaction();
  }
  purchaseShopItem(
    campaignId: number,
    characterId: number,
    shopItemId: number,
    quantity: number,
  ): ShopPurchaseResult {
    const transaction = sqlite.transaction((): ShopPurchaseResult => {
      const shopItem = this.getShopItem(shopItemId);
      const activeShop = this.getActiveShopByCampaign(campaignId);
      if (!shopItem || !activeShop || shopItem.shopId !== activeShop.id || shopItem.campaignId !== campaignId) {
        return { ok: false, reason: "not_found" };
      }
      if (shopItem.stock < quantity) {
        return { ok: false, reason: "stock" };
      }

      const wallet = this.getCharacterCurrency(characterId, shopItem.priceCurrencyCode);
      const totalCost = shopItem.priceAmount * quantity;
      if (!wallet || wallet.amount < totalCost) {
        return { ok: false, reason: "funds" };
      }

      const now = new Date().toISOString();
      db.update(characterCurrencies)
        .set({ amount: wallet.amount - totalCost, updatedAt: now })
        .where(eq(characterCurrencies.id, wallet.id))
        .run();
      db.update(shopItems)
        .set({ stock: shopItem.stock - quantity, updatedAt: now })
        .where(eq(shopItems.id, shopItem.id))
        .run();

      const grantedItem = db.insert(items).values({
        campaignId,
        characterId,
        name: shopItem.name,
        trueName: "",
        description: shopItem.description,
        trueDescription: "",
        itemType: shopItem.itemType,
        quantity: (shopItem.quantityPerPurchase || 1) * quantity,
        charges: null,
        maxCharges: null,
        identified: true,
        consumable: shopItem.itemType === "consumable",
        equipped: false,
        locationNote: "",
        source: "shop_purchase",
        statMods: "[]",
      }).returning().get();

      return {
        ok: true,
        wallet: this.getCharacterCurrency(characterId, shopItem.priceCurrencyCode)!,
        remainingStock: shopItem.stock - quantity,
        item: grantedItem,
      };
    });

    return transaction();
  }

  // Characters
  getCharacter(id: number): Character | undefined {
    return db.select().from(characters).where(eq(characters.id, id)).get();
  }
  getCharactersByCampaign(campaignId: number): Character[] {
    return db.select().from(characters).where(eq(characters.campaignId, campaignId)).all();
  }
  getCharacterByVisitor(campaignId: number, visitorId: string): Character | undefined {
    return db
      .select()
      .from(characters)
      .where(and(eq(characters.campaignId, campaignId), eq(characters.visitorId, visitorId)))
      .get();
  }
  createCharacter(character: InsertCharacter): Character {
    return db.insert(characters).values(character).returning().get();
  }
  updateCharacter(id: number, updates: Partial<Character>): void {
    db.update(characters).set(updates as any).where(eq(characters.id, id)).run();
  }
  getCharacterCurrencies(characterId: number): CharacterCurrency[] {
    return db
      .select()
      .from(characterCurrencies)
      .where(eq(characterCurrencies.characterId, characterId))
      .orderBy(characterCurrencies.id)
      .all();
  }
  getCharacterCurrency(characterId: number, currencyCode: string): CharacterCurrency | undefined {
    return db
      .select()
      .from(characterCurrencies)
      .where(
        and(
          eq(characterCurrencies.characterId, characterId),
          eq(characterCurrencies.currencyCode, currencyCode),
        ),
      )
      .get();
  }
  adjustCharacterCurrency(
    campaignId: number,
    characterId: number,
    currencyCode: string,
    delta: number,
  ): CharacterCurrency | undefined {
    if (!Number.isInteger(delta) || delta === 0) {
      return this.getCharacterCurrency(characterId, currencyCode);
    }

    const transaction = sqlite.transaction(() => {
      const wallet = this.getCharacterCurrency(characterId, currencyCode);
      if (!wallet || wallet.campaignId !== campaignId) return undefined;
      const nextAmount = Math.max(0, wallet.amount + delta);
      db.update(characterCurrencies)
        .set({ amount: nextAmount, updatedAt: new Date().toISOString() })
        .where(eq(characterCurrencies.id, wallet.id))
        .run();
      return this.getCharacterCurrency(characterId, currencyCode);
    });

    return transaction();
  }
  replaceCharacterCurrencies(
    campaignId: number,
    characterId: number,
    balances: Array<{ currencyCode: string; amount: number }>,
  ): void {
    const transaction = sqlite.transaction(() => {
      db.delete(characterCurrencies).where(eq(characterCurrencies.characterId, characterId)).run();
      if (!balances.length) return;
      db.insert(characterCurrencies)
        .values(balances.map((balance) => ({ campaignId, characterId, ...balance })))
        .run();
    });
    transaction();
  }

  // Messages
  getMessagesByCampaign(campaignId: number, limit = 200): Message[] {
    return db
      .select()
      .from(messages)
      .where(eq(messages.campaignId, campaignId))
      .orderBy(messages.id)
      .limit(limit)
      .all();
  }
  createMessage(message: InsertMessage): Message {
    const msg = db.insert(messages).values(message).returning().get();
    if (message.senderType === "dm" || message.senderType === "player") {
      this.incrementCampaignMessages(message.campaignId);
    }
    return msg;
  }
  countMessagesByCampaign(campaignId: number): number {
    const row = sqlite
      .prepare("SELECT COUNT(*) as cnt FROM messages WHERE campaign_id = ?")
      .get(campaignId) as { cnt: number };
    return row?.cnt ?? 0;
  }

  // Items
  getItemsByCharacter(characterId: number): Item[] {
    return db
      .select()
      .from(items)
      .where(eq(items.characterId, characterId))
      .orderBy(items.itemType, items.name)
      .all();
  }
  getItem(id: number): Item | undefined {
    return db.select().from(items).where(eq(items.id, id)).get();
  }
  createItem(item: InsertItem): Item {
    return db.insert(items).values(item).returning().get();
  }
  updateItem(id: number, updates: Partial<Item>): void {
    db.update(items).set(updates as any).where(eq(items.id, id)).run();
  }
  deleteItem(id: number): void {
    db.delete(items).where(eq(items.id, id)).run();
  }
  decrementItem(id: number): Item | undefined {
    const item = this.getItem(id);
    if (!item) return undefined;
    if (item.charges !== null) {
      const newCharges = (item.charges ?? 1) - 1;
      if (newCharges <= 0) {
        this.deleteItem(id);
        return undefined;
      }
      this.updateItem(id, { charges: newCharges });
      return this.getItem(id);
    }
    const newQty = item.quantity - 1;
    if (newQty <= 0) {
      this.deleteItem(id);
      return undefined;
    }
    this.updateItem(id, { quantity: newQty });
    return this.getItem(id);
  }
  countItemsByCharacter(characterId: number): number {
    const row = sqlite
      .prepare("SELECT COUNT(*) as cnt FROM items WHERE character_id = ?")
      .get(characterId) as { cnt: number };
    return row?.cnt ?? 0;
  }

  // Active Effects
  getActiveEffectsByCharacter(characterId: number): ActiveEffect[] {
    return db.select().from(activeEffects).where(eq(activeEffects.characterId, characterId)).all();
  }
  getActiveEffectsByCampaign(campaignId: number): ActiveEffect[] {
    return db.select().from(activeEffects).where(eq(activeEffects.campaignId, campaignId)).all();
  }
  getActiveEffect(id: number): ActiveEffect | undefined {
    return db.select().from(activeEffects).where(eq(activeEffects.id, id)).get();
  }
  createActiveEffect(effect: InsertActiveEffect): ActiveEffect {
    return db.insert(activeEffects).values(effect).returning().get();
  }
  updateActiveEffect(id: number, updates: Partial<ActiveEffect>): void {
    db.update(activeEffects).set(updates as any).where(eq(activeEffects.id, id)).run();
  }
  deleteActiveEffect(id: number): void {
    db.delete(activeEffects).where(eq(activeEffects.id, id)).run();
  }
  removeConcentration(characterId: number): ActiveEffect | undefined {
    const existing = db
      .select()
      .from(activeEffects)
      .where(
        and(
          eq(activeEffects.characterId, characterId),
          eq(activeEffects.concentration, true),
        ),
      )
      .get();
    if (existing) this.deleteActiveEffect(existing.id);
    return existing;
  }
  tickEffects(characterId: number): ActiveEffect[] {
    const effects = this.getActiveEffectsByCharacter(characterId);
    const expired: ActiveEffect[] = [];
    for (const e of effects) {
      if (e.durationType !== "rounds" || e.roundsRemaining === null) continue;
      const next = e.roundsRemaining - 1;
      if (next <= 0) {
        this.deleteActiveEffect(e.id);
        expired.push(e);
      } else {
        this.updateActiveEffect(e.id, { roundsRemaining: next });
      }
    }
    return expired;
  }

  // Campaign snapshots / recovery
  createCampaignSnapshot(data: InsertCampaignSnapshot): CampaignSnapshot {
    const transaction = sqlite.transaction(() => {
      const snapshot = db.insert(campaignSnapshots).values(data).returning().get();
      db.update(campaigns)
        .set({ latestSnapshotId: snapshot.id })
        .where(eq(campaigns.id, data.campaignId))
        .run();
      return snapshot;
    });
    return transaction();
  }
  getCampaignSnapshot(id: number): CampaignSnapshot | undefined {
    return db.select().from(campaignSnapshots).where(eq(campaignSnapshots.id, id)).get();
  }
  getCampaignSnapshots(campaignId: number): CampaignSnapshot[] {
    return db
      .select()
      .from(campaignSnapshots)
      .where(eq(campaignSnapshots.campaignId, campaignId))
      .orderBy(desc(campaignSnapshots.id))
      .all();
  }
  buildCampaignSnapshot(campaignId: number): Record<string, unknown> | null {
    const campaign = this.getCampaign(campaignId);
    if (!campaign) return null;

    const campaignCharacters = this.getCharactersByCampaign(campaignId);
    const campaignMessages = this.getMessagesByCampaign(campaignId, 100000);
    const campaignItems = db.select().from(items).where(eq(items.campaignId, campaignId)).all();
    const effects = this.getActiveEffectsByCampaign(campaignId);
    const currencies = this.getCampaignCurrencies(campaignId);
    const characterMoney = campaignCharacters.map((character) => ({
      characterId: character.id,
      balances: this.getCharacterCurrencies(character.id),
    }));
    const shop = this.getActiveShopByCampaign(campaignId);
    const shopStock = shop ? this.getShopItemsByShop(shop.id) : [];

    return {
      version: 1,
      campaign,
      characters: campaignCharacters,
      messages: campaignMessages,
      items: campaignItems,
      effects,
      currencies,
      characterMoney,
      shop,
      shopStock,
      takenAt: new Date().toISOString(),
    };
  }
  restoreCampaignSnapshot(snapshotId: number): Campaign | null {
    const snapshot = this.getCampaignSnapshot(snapshotId);
    if (!snapshot) return null;

    let data: any;
    try {
      data = JSON.parse(snapshot.snapshotData || "{}");
    } catch {
      return null;
    }
    if (!data?.campaign || Number(data.campaign.id) !== snapshot.campaignId) return null;

    const currentCampaign = this.getCampaign(snapshot.campaignId);
    if (!currentCampaign) return null;

    const transaction = sqlite.transaction(() => {
      const campaignId = snapshot.campaignId;
      const restoredCampaign = { ...data.campaign };
      delete restoredCampaign.id;
      delete restoredCampaign.userId;
      delete restoredCampaign.hostVisitorId;
      delete restoredCampaign.inviteCode;
      delete restoredCampaign.createdAt;
      delete restoredCampaign.latestSnapshotId;
      delete restoredCampaign.isArchived;

      db.update(campaigns)
        .set({
          ...restoredCampaign,
          latestSnapshotId: snapshot.id,
          userId: currentCampaign.userId,
          hostVisitorId: currentCampaign.hostVisitorId,
          inviteCode: currentCampaign.inviteCode,
          isArchived: currentCampaign.isArchived,
        } as any)
        .where(eq(campaigns.id, campaignId))
        .run();

      db.delete(shopItems).where(eq(shopItems.campaignId, campaignId)).run();
      db.delete(activeShops).where(eq(activeShops.campaignId, campaignId)).run();
      db.delete(characterCurrencies).where(eq(characterCurrencies.campaignId, campaignId)).run();
      db.delete(activeEffects).where(eq(activeEffects.campaignId, campaignId)).run();
      db.delete(items).where(eq(items.campaignId, campaignId)).run();
      db.delete(messages).where(eq(messages.campaignId, campaignId)).run();
      db.delete(characters).where(eq(characters.campaignId, campaignId)).run();
      db.delete(campaignCurrencies).where(eq(campaignCurrencies.campaignId, campaignId)).run();

      if (Array.isArray(data.currencies) && data.currencies.length) {
        db.insert(campaignCurrencies).values(data.currencies as any).run();
      }
      if (Array.isArray(data.characters) && data.characters.length) {
        db.insert(characters).values(data.characters as any).run();
      }
      if (Array.isArray(data.messages) && data.messages.length) {
        db.insert(messages).values(data.messages as any).run();
      }
      if (Array.isArray(data.items) && data.items.length) {
        db.insert(items).values(data.items as any).run();
      }
      if (Array.isArray(data.effects) && data.effects.length) {
        db.insert(activeEffects).values(data.effects as any).run();
      }

      const walletRows = Array.isArray(data.characterMoney)
        ? data.characterMoney.flatMap((bucket: any) => Array.isArray(bucket?.balances) ? bucket.balances : [])
        : [];
      if (walletRows.length) {
        db.insert(characterCurrencies).values(walletRows as any).run();
      }

      if (data.shop) {
        db.insert(activeShops).values(data.shop as any).run();
      }
      if (Array.isArray(data.shopStock) && data.shopStock.length) {
        db.insert(shopItems).values(data.shopStock as any).run();
      }

      return this.getCampaign(campaignId) ?? null;
    });

    return transaction();
  }

  // Achievements
  getUserAchievements(userId: number): UserAchievement[] {
    return db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))
      .orderBy(userAchievements.unlockedAt)
      .all();
  }
  unlockAchievement(data: InsertUserAchievement): UserAchievement {
    return db.insert(userAchievements).values(data).returning().get();
  }
  hasAchievement(userId: number, achievementId: string): boolean {
    const row = db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievementId),
        ),
      )
      .get();
    return !!row;
  }
  getUnlockedAchievementIds(userId: number): Set<string> {
    const rows = db
      .select({ achievementId: userAchievements.achievementId })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))
      .all();
    return new Set(rows.map((r) => r.achievementId));
  }
}

export const storage = new DatabaseStorage();
