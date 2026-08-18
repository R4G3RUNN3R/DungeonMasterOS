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
  activeShops,
  type ShopItem,
  shopItems,
  type UserAchievement,
  type InsertUserAchievement,
  userAchievements,
  type PasswordResetToken,
  passwordResetTokens,
  type Encounter,
  type InsertEncounter,
  encounters,
  type Combatant,
  type InsertCombatant,
  combatants,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc } from "drizzle-orm";
import path from "path";

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

    CREATE TABLE IF NOT EXISTS encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      round INTEGER NOT NULL DEFAULT 1,
      current_turn_index INTEGER NOT NULL DEFAULT 0,
      end_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS combatants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encounter_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      character_id INTEGER,
      name TEXT NOT NULL,
      hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      attack_bonus INTEGER NOT NULL DEFAULT 0,
      armor_class INTEGER NOT NULL DEFAULT 10,
      damage_die TEXT NOT NULL DEFAULT '1d6',
      initiative INTEGER NOT NULL DEFAULT 0,
      turn_order INTEGER NOT NULL DEFAULT 0,
      is_defeated INTEGER NOT NULL DEFAULT 0,
      has_fled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  addColumnIfMissing("items", "updated_at", "TEXT NOT NULL DEFAULT (datetime('now'))");
}

// ── Storage interface ──────────────────────────────────────────────────────
export interface IStorage {
  // Users
  getUser(id: number): User | undefined;
  getUserByUsername(username: string): User | undefined;
  getUserByEmail(email: string): User | undefined;
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
  createCampaign(campaign: InsertCampaign): Campaign;
  updateWorldState(campaignId: number, worldState: string): void;
  updateCampaign(campaignId: number, updates: Partial<Campaign>): void;
  incrementCampaignMessages(campaignId: number): void;
  getCampaignCurrencies(campaignId: number): CampaignCurrency[];
  createCampaignCurrency(currency: InsertCampaignCurrency): CampaignCurrency;
  getActiveShopByCampaign(campaignId: number): ActiveShop | undefined;
  getShopItemsByShop(shopId: number): ShopItem[];

  // Characters
  getCharacter(id: number): Character | undefined;
  getCharactersByCampaign(campaignId: number): Character[];
  getCharacterByVisitor(campaignId: number, visitorId: string): Character | undefined;
  createCharacter(character: InsertCharacter): Character;
  updateCharacter(id: number, updates: Partial<Character>): void;

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

  // Combat
  getActiveEncounter(campaignId: number): Encounter | undefined;
  getEncounter(id: number): Encounter | undefined;
  createEncounter(encounter: InsertEncounter): Encounter;
  updateEncounter(id: number, updates: Partial<Encounter>): void;
  getCombatantsByEncounter(encounterId: number): Combatant[];
  getCombatant(id: number): Combatant | undefined;
  createCombatant(combatant: InsertCombatant): Combatant;
  updateCombatant(id: number, updates: Partial<Combatant>): void;

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

  // Combat
  getActiveEncounter(campaignId: number): Encounter | undefined {
    return db
      .select()
      .from(encounters)
      .where(and(eq(encounters.campaignId, campaignId), eq(encounters.status, "active")))
      .get();
  }
  getEncounter(id: number): Encounter | undefined {
    return db.select().from(encounters).where(eq(encounters.id, id)).get();
  }
  createEncounter(encounter: InsertEncounter): Encounter {
    return db.insert(encounters).values(encounter).returning().get();
  }
  updateEncounter(id: number, updates: Partial<Encounter>): void {
    db.update(encounters).set(updates as any).where(eq(encounters.id, id)).run();
  }
  getCombatantsByEncounter(encounterId: number): Combatant[] {
    return db
      .select()
      .from(combatants)
      .where(eq(combatants.encounterId, encounterId))
      .orderBy(combatants.turnOrder)
      .all();
  }
  getCombatant(id: number): Combatant | undefined {
    return db.select().from(combatants).where(eq(combatants.id, id)).get();
  }
  createCombatant(combatant: InsertCombatant): Combatant {
    return db.insert(combatants).values(combatant).returning().get();
  }
  updateCombatant(id: number, updates: Partial<Combatant>): void {
    db.update(combatants).set(updates as any).where(eq(combatants.id, id)).run();
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
