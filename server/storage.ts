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
  type CharacterCurrency,
  type InsertCharacterCurrency,
  characterCurrencies,
  type Character,
  type InsertCharacter,
  characters,
  type Message,
  type InsertMessage,
  messages,
  type Item,
  type InsertItem,
  items,
  type ActiveEffect,
  type InsertActiveEffect,
  activeEffects,
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
  type TurnLedgerEntry,
  type Encounter,
  type InsertEncounter,
  encounters,
  type RollLogEntry,
  type InsertRollLogEntry,
  rollLog,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc } from "drizzle-orm";
import path from "path";
import { calculateTurnSpend } from "@shared/tiers";
import { containsInternalTagMarker, stripInternalTags } from "./internal-tag-guard";

const dbPath = process.env.DATABASE_URL || path.resolve(process.cwd(), "data.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      xp INTEGER NOT NULL DEFAULT 0,
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
      slot TEXT,
      weapon_damage_dice TEXT,
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

    CREATE TABLE IF NOT EXISTS updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_updates_date ON updates(date DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      campaign_id INTEGER,
      character_id INTEGER,
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS character_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      campaign_id INTEGER NOT NULL,
      title_text TEXT NOT NULL,
      normalized_title TEXT NOT NULL,
      self_declared INTEGER NOT NULL DEFAULT 0,
      established INTEGER NOT NULL DEFAULT 0,
      established_at TEXT,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(character_id, normalized_title)
    );

    CREATE INDEX IF NOT EXISTS character_titles_character_idx ON character_titles(character_id);

    CREATE TABLE IF NOT EXISTS title_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_id INTEGER NOT NULL,
      npc_name TEXT NOT NULL,
      normalized_npc_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(title_id, normalized_npc_name)
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

    CREATE TABLE IF NOT EXISTS turn_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      visible_delta INTEGER NOT NULL DEFAULT 0,
      reserve_delta INTEGER NOT NULL DEFAULT 0,
      balance_after INTEGER,
      reason TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT,
      stripe_event_id TEXT,
      stripe_session_id TEXT,
      stripe_invoice_id TEXT,
      tier TEXT,
      pack_id TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS turn_ledger_source_id_unique
      ON turn_ledger(source_id)
      WHERE source_id IS NOT NULL AND source_id != '';

    CREATE INDEX IF NOT EXISTS turn_ledger_user_created_idx
      ON turn_ledger(user_id, created_at);

    CREATE TABLE IF NOT EXISTS stripe_events (
      event_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processed',
      user_id INTEGER,
      metadata TEXT NOT NULL DEFAULT '{}',
      processed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      round INTEGER NOT NULL DEFAULT 1,
      turn_index INTEGER NOT NULL DEFAULT 0,
      participants TEXT NOT NULL DEFAULT '[]',
      last_resolved_turn_key TEXT,
      outcome TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS roll_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      encounter_id INTEGER,
      character_id INTEGER,
      participant_id TEXT,
      roll_type TEXT NOT NULL,
      stat_used TEXT NOT NULL,
      base_modifier INTEGER NOT NULL,
      effect_modifier INTEGER NOT NULL DEFAULT 0,
      proficiency_bonus INTEGER NOT NULL DEFAULT 0,
      dice_result INTEGER NOT NULL,
      total INTEGER NOT NULL,
      target_value INTEGER NOT NULL,
      is_critical INTEGER NOT NULL DEFAULT 0,
      is_fumble INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL,
      turn_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Bring older databases forward safely. Railway volumes love keeping old schemas around like bad decisions.
  addColumnIfMissing("users", "stripe_billing_interval", "TEXT");
  addColumnIfMissing("users", "bonus_turns", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "total_level_ups", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "onboarding_complete", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "unlimited_turns", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "role", "TEXT NOT NULL DEFAULT 'player'");
  addColumnIfMissing("users", "google_id", "TEXT");
  addColumnIfMissing("users", "google_email", "TEXT");
  addColumnIfMissing("users", "avatar_url", "TEXT");
  sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users(google_id) WHERE google_id IS NOT NULL");

  addColumnIfMissing("campaigns", "is_archived", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("campaigns", "combat_style", "TEXT NOT NULL DEFAULT 'cinematic'");
  addColumnIfMissing("campaigns", "ruleset", "TEXT NOT NULL DEFAULT 'dnd5e'");
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
  addColumnIfMissing("characters", "str", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "dex", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "con", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "int", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "wis", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "cha", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "ac", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing("characters", "xp", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("characters", "damage_dice", "TEXT NOT NULL DEFAULT '1d4'");
  addColumnIfMissing("characters", "attack_ability", "TEXT NOT NULL DEFAULT 'str'");
  addColumnIfMissing("characters", "proficiencies", "TEXT NOT NULL DEFAULT '[]'");

  addColumnIfMissing("messages", "metadata", "TEXT NOT NULL DEFAULT '{}'");
  addColumnIfMissing("messages", "client_submission_id", "TEXT");
  addColumnIfMissing("items", "stat_mods", "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing("items", "updated_at", "TEXT NOT NULL DEFAULT (datetime('now'))");
  addColumnIfMissing("items", "slot", "TEXT");
  addColumnIfMissing("items", "weapon_damage_dice", "TEXT");
  addColumnIfMissing("items", "weight", "REAL NOT NULL DEFAULT 0");
  addColumnIfMissing("items", "carried", "INTEGER NOT NULL DEFAULT 1");

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS messages_campaign_submission_unique
    ON messages (campaign_id, client_submission_id)
    WHERE client_submission_id IS NOT NULL;
  `);
}

export type TurnLedgerReason =
  | "free_trial_grant"
  | "subscription_grant"
  | "topup_grant"
  | "turn_spend"
  | "admin_adjustment";

export interface TurnLedgerWrite {
  userId: number;
  visibleDelta: number;
  reserveDelta?: number;
  balanceAfter?: number | null;
  reason: TurnLedgerReason | string;
  source?: string;
  sourceId?: string | null;
  stripeEventId?: string | null;
  stripeSessionId?: string | null;
  stripeInvoiceId?: string | null;
  tier?: string | null;
  packId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PaidTurnGrantOptions {
  reason: TurnLedgerReason | string;
  source: string;
  sourceId?: string | null;
  reserveTurns?: number;
  stripeEventId?: string | null;
  stripeSessionId?: string | null;
  stripeInvoiceId?: string | null;
  tier?: string | null;
  packId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StripeEventWrite {
  eventId: string;
  type: string;
  status: "processed" | "failed";
  userId?: number | null;
  metadata?: Record<string, unknown>;
}

function metadataJson(metadata: Record<string, unknown> | undefined): string {
  return JSON.stringify(metadata ?? {});
}

function mapTurnLedgerRow(row: any): TurnLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    visibleDelta: row.visible_delta,
    reserveDelta: row.reserve_delta,
    balanceAfter: row.balance_after,
    reason: row.reason,
    source: row.source,
    sourceId: row.source_id,
    stripeEventId: row.stripe_event_id,
    stripeSessionId: row.stripe_session_id,
    stripeInvoiceId: row.stripe_invoice_id,
    tier: row.tier,
    packId: row.pack_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  } as TurnLedgerEntry;
}

function insertTurnLedgerRaw(entry: TurnLedgerWrite): TurnLedgerEntry {
  const info = sqlite
    .prepare(`
      INSERT INTO turn_ledger (
        user_id, visible_delta, reserve_delta, balance_after, reason, source, source_id,
        stripe_event_id, stripe_session_id, stripe_invoice_id, tier, pack_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      entry.userId,
      entry.visibleDelta,
      entry.reserveDelta ?? 0,
      entry.balanceAfter ?? null,
      entry.reason,
      entry.source ?? "manual",
      entry.sourceId ?? null,
      entry.stripeEventId ?? null,
      entry.stripeSessionId ?? null,
      entry.stripeInvoiceId ?? null,
      entry.tier ?? null,
      entry.packId ?? null,
      metadataJson(entry.metadata),
    );

  const row = sqlite.prepare("SELECT * FROM turn_ledger WHERE id = ?").get(info.lastInsertRowid);
  return mapTurnLedgerRow(row);
}

export interface CharacterTitleRow {
  id: number;
  characterId: number;
  campaignId: number;
  titleText: string;
  normalizedTitle: string;
  selfDeclared: boolean;
  established: boolean;
  establishedAt: string | null;
}

function mapCharacterTitleRow(row: any): CharacterTitleRow {
  return {
    id: row.id,
    characterId: row.character_id,
    campaignId: row.campaign_id,
    titleText: row.title_text,
    normalizedTitle: row.normalized_title,
    selfDeclared: !!row.self_declared,
    established: !!row.established,
    establishedAt: row.established_at,
  };
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

  // Turn accounting
  getTurnLedgerByUser(userId: number, limit?: number): TurnLedgerEntry[];
  recordTurnLedgerEntry(entry: TurnLedgerWrite): TurnLedgerEntry | undefined;
  recordIncludedTurnGrant(entry: Omit<TurnLedgerWrite, "visibleDelta"> & { turns: number }): TurnLedgerEntry | undefined;
  grantBonusTurns(userId: number, turns: number, options: PaidTurnGrantOptions): { applied: boolean; bonusTurns: number; entry?: TurnLedgerEntry };
  recordTurnSpend(userId: number, useBonusTurn: boolean): void;
  hasStripeEvent(eventId: string): boolean;
  recordStripeEvent(event: StripeEventWrite): void;

  // Password reset
  createPasswordResetToken(userId: number, token: string, expiresAt: Date): PasswordResetToken;
  getPasswordResetToken(token: string): PasswordResetToken | undefined;
  markPasswordResetTokenUsed(id: number): void;
  deleteExpiredPasswordResetTokens(): void;

  // Campaigns
  getCampaign(id: number): Campaign | undefined;
  getCampaignByInviteCode(code: string): Campaign | undefined;
  getCampaignsByUser(userId: number): Campaign[];
  createCampaign(campaign: InsertCampaign): Campaign;
  updateWorldState(campaignId: number, worldState: string): void;
  updateCampaign(campaignId: number, updates: Partial<Campaign>): void;
  incrementCampaignMessages(campaignId: number): void;
  getCampaignCurrencies(campaignId: number): CampaignCurrency[];
  createCampaignCurrency(currency: InsertCampaignCurrency): CampaignCurrency;
  getCharacterCurrencies(characterId: number): CharacterCurrency[];
  getCharacterCurrency(characterId: number, currencyCode: string): CharacterCurrency | undefined;
  createCharacterCurrency(currency: InsertCharacterCurrency): CharacterCurrency;
  adjustCharacterCurrency(campaignId: number, characterId: number, currencyCode: string, amount: number): CharacterCurrency;
  getActiveShopByCampaign(campaignId: number): ActiveShop | undefined;
  closeActiveShops(campaignId: number): void;
  createActiveShop(shop: InsertActiveShop): ActiveShop;
  getShopItemsByShop(shopId: number): ShopItem[];
  getShopItem(id: number): ShopItem | undefined;
  createShopItem(item: InsertShopItem): ShopItem;
  updateShopItem(id: number, updates: Partial<ShopItem>): void;

  // Characters
  getCharacter(id: number): Character | undefined;
  getCharactersByCampaign(campaignId: number): Character[];
  getCharacterByVisitor(campaignId: number, visitorId: string): Character | undefined;
  getCharacterByName(campaignId: number, name: string): Character | undefined;
  createCharacter(character: InsertCharacter): Character;
  updateCharacter(id: number, updates: Partial<Character>): void;

  // Messages
  getMessagesByCampaign(campaignId: number, limit?: number): Message[];
  createMessage(message: InsertMessage): Message;
  countMessagesByCampaign(campaignId: number): number;
  createMessageIdempotent(message: InsertMessage & { clientSubmissionId?: string }): { message: Message; wasCreated: boolean };
  getMessageBySubmissionId(campaignId: number, clientSubmissionId: string): Message | undefined;

  // Encounters
  createEncounter(data: InsertEncounter): Encounter;
  getEncounter(id: number): Encounter | undefined;
  getActiveEncounterByCampaign(campaignId: number): Encounter | undefined;
  updateEncounter(id: number, updates: Partial<InsertEncounter>): void;

  // Roll log
  createRollLogEntry(data: InsertRollLogEntry): RollLogEntry;
  getRollLogByEncounter(encounterId: number): RollLogEntry[];

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

  // Achievements
  getUserAchievements(userId: number): UserAchievement[];
  unlockAchievement(data: InsertUserAchievement): UserAchievement;
  hasAchievement(userId: number, achievementId: string): boolean;
  getUnlockedAchievementIds(userId: number): Set<string>;

  // Emergent titles (server/titles.ts)
  getCharacterTitles(characterId: number): CharacterTitleRow[];
  getEstablishedCharacterTitles(characterId: number): CharacterTitleRow[];
  createCharacterTitle(data: {
    characterId: number;
    campaignId: number;
    titleText: string;
    normalizedTitle: string;
    selfDeclared: boolean;
  }): CharacterTitleRow;
  addTitleEvidence(titleId: number, npcName: string): { inserted: boolean; distinctWitnessCount: number };
  establishTitle(titleId: number): void;
  getEstablishedTitleCount(characterId: number): number;
  getEstablishedTitleCountForUser(userId: number): number;
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
      return db.insert(users).values(insertUser).returning().get();
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

  getTurnLedgerByUser(userId: number, limit = 25): TurnLedgerEntry[] {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = sqlite
      .prepare("SELECT * FROM turn_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?")
      .all(userId, safeLimit);
    return rows.map(mapTurnLedgerRow);
  }

  private getTurnLedgerBySourceId(sourceId: string): TurnLedgerEntry | undefined {
    const row = sqlite.prepare("SELECT * FROM turn_ledger WHERE source_id = ?").get(sourceId);
    return row ? mapTurnLedgerRow(row) : undefined;
  }

  recordTurnLedgerEntry(entry: TurnLedgerWrite): TurnLedgerEntry | undefined {
    if (entry.sourceId) {
      const existing = this.getTurnLedgerBySourceId(entry.sourceId);
      if (existing) return existing;
    }

    try {
      return insertTurnLedgerRaw(entry);
    } catch (err: any) {
      if (entry.sourceId && String(err?.message || "").toLowerCase().includes("unique")) {
        return this.getTurnLedgerBySourceId(entry.sourceId);
      }
      throw err;
    }
  }

  recordIncludedTurnGrant(entry: Omit<TurnLedgerWrite, "visibleDelta"> & { turns: number }): TurnLedgerEntry | undefined {
    return this.recordTurnLedgerEntry({
      ...entry,
      visibleDelta: entry.turns,
      reserveDelta: entry.reserveDelta ?? 0,
    });
  }

  grantBonusTurns(
    userId: number,
    turns: number,
    options: PaidTurnGrantOptions,
  ): { applied: boolean; bonusTurns: number; entry?: TurnLedgerEntry } {
    const tx = sqlite.transaction(() => {
      if (options.sourceId) {
        const existing = this.getTurnLedgerBySourceId(options.sourceId);
        if (existing) {
          const user = this.getUser(userId);
          return { applied: false, bonusTurns: user?.bonusTurns ?? 0, entry: existing };
        }
      }

      const user = this.getUser(userId);
      if (!user) throw new Error("Cannot grant turns to a missing user.");
      const nextBonusTurns = (user.bonusTurns ?? 0) + turns;
      sqlite.prepare("UPDATE users SET bonus_turns = ? WHERE id = ?").run(nextBonusTurns, userId);
      const entry = insertTurnLedgerRaw({
        userId,
        visibleDelta: turns,
        reserveDelta: options.reserveTurns ?? 0,
        balanceAfter: nextBonusTurns,
        reason: options.reason,
        source: options.source,
        sourceId: options.sourceId ?? null,
        stripeEventId: options.stripeEventId ?? null,
        stripeSessionId: options.stripeSessionId ?? null,
        stripeInvoiceId: options.stripeInvoiceId ?? null,
        tier: options.tier ?? null,
        packId: options.packId ?? null,
        metadata: options.metadata,
      });
      return { applied: true, bonusTurns: nextBonusTurns, entry };
    });

    return tx();
  }

  recordTurnSpend(userId: number, useBonusTurn: boolean): void {
    const tx = sqlite.transaction(() => {
      const user = this.getUser(userId);
      if (!user) return;
      const { used: nextUsed, bonusTurns: nextBonusTurns } = calculateTurnSpend(
        user.aiTurnsUsedThisMonth,
        user.bonusTurns ?? 0,
        useBonusTurn,
      );
      sqlite
        .prepare("UPDATE users SET ai_turns_used_this_month = ?, bonus_turns = ? WHERE id = ?")
        .run(nextUsed, nextBonusTurns, userId);
      insertTurnLedgerRaw({
        userId,
        visibleDelta: -1,
        reserveDelta: 0,
        balanceAfter: nextBonusTurns,
        reason: "turn_spend",
        source: "ai_turn",
        metadata: { usedBonusTurn: useBonusTurn },
      });
    });

    tx();
  }

  hasStripeEvent(eventId: string): boolean {
    const row = sqlite
      .prepare("SELECT event_id FROM stripe_events WHERE event_id = ? AND status = 'processed'")
      .get(eventId);
    return !!row;
  }

  recordStripeEvent(event: StripeEventWrite): void {
    sqlite
      .prepare(`
        INSERT INTO stripe_events (event_id, type, status, user_id, metadata, processed_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(event_id) DO UPDATE SET
          status = excluded.status,
          user_id = excluded.user_id,
          metadata = excluded.metadata,
          processed_at = excluded.processed_at
      `)
      .run(event.eventId, event.type, event.status, event.userId ?? null, metadataJson(event.metadata));
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
  createCampaign(campaign: InsertCampaign): Campaign {
    return db.insert(campaigns).values(campaign).returning().get();
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
  getCharacterCurrencies(characterId: number): CharacterCurrency[] {
    return db
      .select()
      .from(characterCurrencies)
      .where(eq(characterCurrencies.characterId, characterId))
      .orderBy(characterCurrencies.currencyCode)
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
  createCharacterCurrency(currency: InsertCharacterCurrency): CharacterCurrency {
    return db.insert(characterCurrencies).values(currency).returning().get();
  }
  adjustCharacterCurrency(
    campaignId: number,
    characterId: number,
    currencyCode: string,
    amount: number,
  ): CharacterCurrency {
    sqlite
      .prepare(`
        INSERT INTO character_currencies (campaign_id, character_id, currency_code, amount, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(character_id, currency_code)
        DO UPDATE SET amount = amount + excluded.amount, updated_at = datetime('now')
      `)
      .run(campaignId, characterId, currencyCode, amount);

    const balance = this.getCharacterCurrency(characterId, currencyCode);
    if (!balance) throw new Error("Failed to update character currency balance.");
    return balance;
  }
  getActiveShopByCampaign(campaignId: number): ActiveShop | undefined {
    return db
      .select()
      .from(activeShops)
      .where(and(eq(activeShops.campaignId, campaignId), eq(activeShops.isOpen, true)))
      .orderBy(desc(activeShops.updatedAt), desc(activeShops.id))
      .get();
  }
  closeActiveShops(campaignId: number): void {
    db
      .update(activeShops)
      .set({ isOpen: false, updatedAt: new Date().toISOString() } as any)
      .where(eq(activeShops.campaignId, campaignId))
      .run();
  }
  createActiveShop(shop: InsertActiveShop): ActiveShop {
    return db.insert(activeShops).values(shop).returning().get();
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
  createShopItem(item: InsertShopItem): ShopItem {
    return db.insert(shopItems).values(item).returning().get();
  }
  updateShopItem(id: number, updates: Partial<ShopItem>): void {
    db.update(shopItems).set(updates as any).where(eq(shopItems.id, id)).run();
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
  getCharacterByName(campaignId: number, name: string): Character | undefined {
    return db
      .select()
      .from(characters)
      .where(and(eq(characters.campaignId, campaignId), eq(characters.name, name)))
      .get();
  }
  createCharacter(character: InsertCharacter): Character {
    return db.insert(characters).values(character).returning().get();
  }
  updateCharacter(id: number, updates: Partial<Character>): void {
    db.update(characters).set(updates as any).where(eq(characters.id, id)).run();
  }

  // Messages
  getMessagesByCampaign(campaignId: number, limit = 200): Message[] {
    // Fetch the most recent `limit` messages (newest first), then restore
    // chronological order — a plain ascending order+limit here would return
    // the OLDEST messages once a campaign passes `limit`, starving both the
    // AI prompt and the chat UI of recent context.
    return db
      .select()
      .from(messages)
      .where(eq(messages.campaignId, campaignId))
      .orderBy(desc(messages.id))
      .limit(limit)
      .all()
      .reverse();
  }
  createMessage(message: InsertMessage): Message {
    // Persistence-layer safeguard, independent of whatever already ran in
    // dm-engine.ts/routes.ts: every message insert is the one place all
    // paths (including any future caller) funnel through, so it's checked
    // here too rather than trusting every call site to have sanitized its
    // own content. Should never fire — if it does, something upstream
    // regressed, which is exactly why it's logged loudly. See
    // server/internal-tag-guard.ts for the 2026-08-18 incident this
    // guards against.
    let toInsert = message;
    if (containsInternalTagMarker(message.content)) {
      console.error(
        "[storage.createMessage] internal protocol tag marker detected in message content at persistence time — stripping before insert",
        { campaignId: message.campaignId, senderType: message.senderType },
      );
      toInsert = { ...message, content: stripInternalTags(message.content) };
    }

    const msg = db.insert(messages).values(toInsert).returning().get();
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
  getMessageBySubmissionId(campaignId: number, clientSubmissionId: string): Message | undefined {
    return db
      .select()
      .from(messages)
      .where(and(eq(messages.campaignId, campaignId), eq(messages.clientSubmissionId, clientSubmissionId)))
      .get();
  }
  createMessageIdempotent(message: InsertMessage & { clientSubmissionId?: string }): { message: Message; wasCreated: boolean } {
    if (!message.clientSubmissionId) {
      return { message: this.createMessage(message), wasCreated: true };
    }

    const existing = this.getMessageBySubmissionId(message.campaignId, message.clientSubmissionId);
    if (existing) {
      return { message: existing, wasCreated: false };
    }

    try {
      return { message: this.createMessage(message), wasCreated: true };
    } catch (error) {
      // Race: another concurrent request inserted the same submissionId between
      // our SELECT and our INSERT. The unique index rejected us — fetch and
      // return what actually landed, rather than erroring the request.
      const raced = this.getMessageBySubmissionId(message.campaignId, message.clientSubmissionId);
      if (raced) return { message: raced, wasCreated: false };
      throw error;
    }
  }

  // Encounters
  createEncounter(data: InsertEncounter): Encounter {
    return db.insert(encounters).values(data).returning().get();
  }
  getEncounter(id: number): Encounter | undefined {
    return db.select().from(encounters).where(eq(encounters.id, id)).get();
  }
  getActiveEncounterByCampaign(campaignId: number): Encounter | undefined {
    return db
      .select()
      .from(encounters)
      .where(and(eq(encounters.campaignId, campaignId), eq(encounters.status, "active")))
      .get();
  }
  updateEncounter(id: number, updates: Partial<InsertEncounter>): void {
    db.update(encounters).set(updates as any).where(eq(encounters.id, id)).run();
  }

  // Roll log
  createRollLogEntry(data: InsertRollLogEntry): RollLogEntry {
    return db.insert(rollLog).values(data).returning().get();
  }
  getRollLogByEncounter(encounterId: number): RollLogEntry[] {
    return db.select().from(rollLog).where(eq(rollLog.encounterId, encounterId)).orderBy(rollLog.id).all();
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

  // Updates
  getUpdates(): Array<{ id: number; date: string; title: string; description: string; createdAt: string }> {
    return sqlite
      .prepare(
        "SELECT id, date, title, description, created_at as createdAt FROM updates ORDER BY date DESC, created_at DESC",
      )
      .all() as any;
  }
  createUpdate(entry: { date: string; title: string; description: string }): void {
    sqlite
      .prepare("INSERT INTO updates (date, title, description) VALUES (?, ?, ?)")
      .run(entry.date, entry.title, entry.description);
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

  // Emergent titles — raw sqlite, same ad-hoc pattern as getUpdates/createUpdate
  // above: a small, self-contained feature table that doesn't need the full
  // Drizzle query builder to stay readable.
  getCharacterTitles(characterId: number): CharacterTitleRow[] {
    return (sqlite
      .prepare("SELECT * FROM character_titles WHERE character_id = ? ORDER BY first_seen_at")
      .all(characterId) as any[]).map(mapCharacterTitleRow);
  }
  getEstablishedCharacterTitles(characterId: number): CharacterTitleRow[] {
    return (sqlite
      .prepare("SELECT * FROM character_titles WHERE character_id = ? AND established = 1 ORDER BY established_at")
      .all(characterId) as any[]).map(mapCharacterTitleRow);
  }
  createCharacterTitle(data: {
    characterId: number;
    campaignId: number;
    titleText: string;
    normalizedTitle: string;
    selfDeclared: boolean;
  }): CharacterTitleRow {
    const info = sqlite
      .prepare(
        "INSERT INTO character_titles (character_id, campaign_id, title_text, normalized_title, self_declared) VALUES (?, ?, ?, ?, ?)",
      )
      .run(data.characterId, data.campaignId, data.titleText, data.normalizedTitle, data.selfDeclared ? 1 : 0);
    const row = sqlite.prepare("SELECT * FROM character_titles WHERE id = ?").get(info.lastInsertRowid);
    return mapCharacterTitleRow(row);
  }
  addTitleEvidence(titleId: number, npcName: string): { inserted: boolean; distinctWitnessCount: number } {
    const normalizedNpcName = npcName.trim().toLowerCase();
    const info = sqlite
      .prepare("INSERT OR IGNORE INTO title_evidence (title_id, npc_name, normalized_npc_name) VALUES (?, ?, ?)")
      .run(titleId, npcName.trim(), normalizedNpcName);
    sqlite.prepare("UPDATE character_titles SET last_seen_at = datetime('now') WHERE id = ?").run(titleId);
    const { cnt } = sqlite
      .prepare("SELECT COUNT(*) as cnt FROM title_evidence WHERE title_id = ?")
      .get(titleId) as { cnt: number };
    return { inserted: info.changes > 0, distinctWitnessCount: cnt };
  }
  establishTitle(titleId: number): void {
    sqlite
      .prepare("UPDATE character_titles SET established = 1, established_at = datetime('now') WHERE id = ? AND established = 0")
      .run(titleId);
  }
  getEstablishedTitleCount(characterId: number): number {
    const { cnt } = sqlite
      .prepare("SELECT COUNT(*) as cnt FROM character_titles WHERE character_id = ? AND established = 1")
      .get(characterId) as { cnt: number };
    return cnt;
  }
  getEstablishedTitleCountForUser(userId: number): number {
    const { cnt } = sqlite
      .prepare(
        `SELECT COUNT(*) as cnt FROM character_titles ct
         JOIN characters c ON c.id = ct.character_id
         WHERE c.user_id = ? AND ct.established = 1`,
      )
      .get(userId) as { cnt: number };
    return cnt;
  }
}

export const storage = new DatabaseStorage();
