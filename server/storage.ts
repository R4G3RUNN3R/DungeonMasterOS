import Database from "better-sqlite3";
import path from "path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  users,
  passwordResetTokens,
  campaigns,
  campaignCurrencies,
  characters,
  characterCurrencies,
  messages,
  items,
  activeEffects,
  campaignSnapshots,
  activeShops,
  shopItems,
  userAchievements,

  type User,
  type InsertUser,
  type Campaign,
  type InsertCampaign,
  type CampaignCurrency,
  type InsertCampaignCurrency,
  type Character,
  type InsertCharacter,
  type CharacterCurrency,
  type InsertCharacterCurrency,
  type Message,
  type InsertMessage,
  type Item,
  type InsertItem,
  type ActiveEffect,
  type InsertActiveEffect,
  type CampaignSnapshot,
  type InsertCampaignSnapshot,
  type ActiveShop,
  type InsertActiveShop,
  type ShopItem,
  type InsertShopItem,
  type UserAchievement,
  type InsertUserAchievement,
} from "../shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// DB INIT
// ─────────────────────────────────────────────────────────────────────────────

const dbPath =
  process.env.DATABASE_URL ||
  path.resolve(process.cwd(), "data.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

function nowIso() {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATIONS
// Minimal runtime-safe migration layer.
// Keeps the app alive even when schema evolves while you're testing in Railway.
// Because apparently software must also double as archaeology.
// ─────────────────────────────────────────────────────────────────────────────

function columnExists(table: string, column: string): boolean {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function ensureColumn(table: string, column: string, definitionSql: string) {
  if (!columnExists(table, column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definitionSql}`);
  }
}

function tableExists(table: string): boolean {
  const row = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
    .get(table);
  return !!row;
}

export function runMigrations() {
  // Core tables should already be created by your project bootstrapping / prior runs.
  // These ensures cover the new / evolving fields used by the rewritten schema.

  // users
  if (tableExists("users")) {
    ensureColumn("users", "bonus_turns", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("users", "usage_reset_at", "TEXT");
    ensureColumn("users", "onboarding_complete", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("users", "unlimited_turns", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  }

  // campaigns
  if (tableExists("campaigns")) {
    ensureColumn("campaigns", "combat_style", "TEXT NOT NULL DEFAULT 'cinematic'");
    ensureColumn("campaigns", "story_mode", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("campaigns", "world_gen_style", "TEXT NOT NULL DEFAULT 'standard'");
    ensureColumn("campaigns", "homebrew_rules", "TEXT NOT NULL DEFAULT ''");
    ensureColumn("campaigns", "custom_world_prompt", "TEXT NOT NULL DEFAULT ''");
    ensureColumn("campaigns", "epic_mode", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("campaigns", "anime_world_source", "TEXT NOT NULL DEFAULT ''");
    ensureColumn("campaigns", "anime_world_mode", "TEXT NOT NULL DEFAULT 'inspired'");
    ensureColumn("campaigns", "world_state", "TEXT NOT NULL DEFAULT '{}'");
    ensureColumn("campaigns", "user_id", "INTEGER");
    ensureColumn("campaigns", "is_archived", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("campaigns", "total_messages", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("campaigns", "last_played_at", "TEXT");
    ensureColumn("campaigns", "latest_snapshot_id", "INTEGER");
    ensureColumn("campaigns", "active_shop_id", "INTEGER");
  }

  // characters
  if (tableExists("characters")) {
    ensureColumn("characters", "user_id", "INTEGER");
    ensureColumn("characters", "level", "INTEGER NOT NULL DEFAULT 1");
    ensureColumn("characters", "temp_hp", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("characters", "speed", "INTEGER NOT NULL DEFAULT 30");
    ensureColumn("characters", "attacks_per_round", "INTEGER NOT NULL DEFAULT 1");
    ensureColumn("characters", "status", "TEXT NOT NULL DEFAULT 'alive'");
    ensureColumn("characters", "character_data", "TEXT NOT NULL DEFAULT '{}'");
    ensureColumn("characters", "inventory", "TEXT NOT NULL DEFAULT '[]'");
  }

  // messages
  if (tableExists("messages")) {
    ensureColumn("messages", "metadata", "TEXT NOT NULL DEFAULT '{}'");
  }

  // items
  if (tableExists("items")) {
    ensureColumn("items", "true_name", "TEXT NOT NULL DEFAULT ''");
    ensureColumn("items", "true_description", "TEXT NOT NULL DEFAULT ''");
    ensureColumn("items", "charges", "INTEGER");
    ensureColumn("items", "max_charges", "INTEGER");
    ensureColumn("items", "identified", "INTEGER NOT NULL DEFAULT 1");
    ensureColumn("items", "consumable", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("items", "equipped", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("items", "location_note", "TEXT NOT NULL DEFAULT ''");
    ensureColumn("items", "source", "TEXT NOT NULL DEFAULT 'manual'");
    ensureColumn("items", "stat_mods", "TEXT NOT NULL DEFAULT '[]'");
    ensureColumn("items", "updated_at", "TEXT NOT NULL DEFAULT ''");
  }

  // active_effects
  if (tableExists("active_effects")) {
    ensureColumn("active_effects", "icon", "TEXT NOT NULL DEFAULT ''");
    ensureColumn("active_effects", "is_debuff", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("active_effects", "duration_type", "TEXT NOT NULL DEFAULT 'rounds'");
    ensureColumn("active_effects", "total_duration", "INTEGER");
    ensureColumn("active_effects", "rounds_remaining", "INTEGER");
    ensureColumn("active_effects", "concentration", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("active_effects", "stat_mods", "TEXT NOT NULL DEFAULT '[]'");
    ensureColumn("active_effects", "description", "TEXT NOT NULL DEFAULT ''");
    ensureColumn("active_effects", "applied_by", "TEXT NOT NULL DEFAULT 'manual'");
  }

  // New tables (create if missing)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS campaign_currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL DEFAULT '',
      is_primary INTEGER NOT NULL DEFAULT 0,
      exchange_rate INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS campaign_currency_unique
    ON campaign_currencies (campaign_id, code);
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS character_currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      currency_code TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS character_currency_unique
    ON character_currencies (character_id, currency_code);
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS campaign_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT 'Save Point',
      reason TEXT NOT NULL DEFAULT 'manual',
      trigger_message_id INTEGER,
      snapshot_data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS active_shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      merchant_name TEXT NOT NULL,
      merchant_description TEXT NOT NULL DEFAULT '',
      currency_code TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Merchant Stock',
      is_open INTEGER NOT NULL DEFAULT 1,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqlite.exec(`
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      campaign_id INTEGER,
      character_id INTEGER,
      unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("[db] Database migrations complete");
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class Storage {
  // ───── Users ─────

  createUser(data: InsertUser): User {
    const [row] = db.insert(users).values(data).returning();
    return row;
  }

  getUser(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  getUserByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email)).get();
  }

  getUserByUsername(username: string): User | undefined {
    return db.select().from(users).where(eq(users.username, username)).get();
  }

  getUserByStripeSubscriptionId(subscriptionId: string): User | undefined {
    return db.select().from(users).where(eq(users.stripeSubscriptionId, subscriptionId)).get();
  }

  updateUser(id: number, updates: Partial<InsertUser>): User | undefined {
    db.update(users).set(updates as any).where(eq(users.id, id)).run();
    return this.getUser(id);
  }

  listUsers(): User[] {
    return db.select().from(users).orderBy(desc(users.createdAt)).all();
  }

  // ───── Password reset tokens ─────

  createPasswordResetToken(userId: number, token: string, expiresAt: Date) {
    db.insert(passwordResetTokens)
      .values({
        userId,
        token,
        expiresAt: expiresAt.toISOString(),
      })
      .run();
  }

  getPasswordResetToken(token: string) {
    return db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).get();
  }

  markPasswordResetTokenUsed(id: number) {
    db.update(passwordResetTokens)
      .set({ usedAt: nowIso() })
      .where(eq(passwordResetTokens.id, id))
      .run();
  }

  deleteExpiredPasswordResetTokens() {
    sqlite
      .prepare(`DELETE FROM password_reset_tokens WHERE expires_at < ? OR used_at IS NOT NULL`)
      .run(nowIso());
  }

  // ───── Campaigns ─────

  createCampaign(data: InsertCampaign): Campaign {
    const [row] = db.insert(campaigns).values(data).returning();
    return row;
  }

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
      .orderBy(desc(campaigns.createdAt))
      .all();
  }

  listCampaigns(): Campaign[] {
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).all();
  }

  updateCampaign(id: number, updates: Partial<InsertCampaign> | Record<string, any>): Campaign | undefined {
    db.update(campaigns).set(updates as any).where(eq(campaigns.id, id)).run();
    return this.getCampaign(id);
  }

  updateWorldState(campaignId: number, worldState: string) {
    db.update(campaigns)
      .set({
        worldState,
        lastPlayedAt: nowIso(),
      })
      .where(eq(campaigns.id, campaignId))
      .run();
  }

  incrementCampaignMessageCount(campaignId: number) {
    sqlite
      .prepare(`UPDATE campaigns SET total_messages = COALESCE(total_messages, 0) + 1, last_played_at = ? WHERE id = ?`)
      .run(nowIso(), campaignId);
  }

  countMessagesByCampaign(campaignId: number): number {
    const row = db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.campaignId, campaignId))
      .get();
    return row?.count ?? 0;
  }

  // ───── Campaign currencies ─────

  createCampaignCurrency(data: InsertCampaignCurrency): CampaignCurrency {
    const [row] = db.insert(campaignCurrencies).values(data).returning();
    return row;
  }

  getCampaignCurrencies(campaignId: number): CampaignCurrency[] {
    return db
      .select()
      .from(campaignCurrencies)
      .where(eq(campaignCurrencies.campaignId, campaignId))
      .all();
  }

  getCampaignCurrency(campaignId: number, code: string): CampaignCurrency | undefined {
    return db
      .select()
      .from(campaignCurrencies)
      .where(and(eq(campaignCurrencies.campaignId, campaignId), eq(campaignCurrencies.code, code)))
      .get();
  }

  replaceCampaignCurrencies(campaignId: number, defs: InsertCampaignCurrency[]) {
    db.delete(campaignCurrencies).where(eq(campaignCurrencies.campaignId, campaignId)).run();
    if (defs.length) {
      db.insert(campaignCurrencies).values(defs).run();
    }
  }

  // ───── Characters ─────

  createCharacter(data: InsertCharacter): Character {
    const [row] = db.insert(characters).values(data).returning();
    return row;
  }

  getCharacter(id: number): Character | undefined {
    return db.select().from(characters).where(eq(characters.id, id)).get();
  }

  getCharactersByCampaign(campaignId: number): Character[] {
    return db
      .select()
      .from(characters)
      .where(eq(characters.campaignId, campaignId))
      .orderBy(characters.id)
      .all();
  }

  getCharacterByVisitor(campaignId: number, visitorId: string): Character | undefined {
    return db
      .select()
      .from(characters)
      .where(and(eq(characters.campaignId, campaignId), eq(characters.visitorId, visitorId)))
      .get();
  }

  getCharacterByUserAndCampaign(campaignId: number, userId: number): Character | undefined {
    return db
      .select()
      .from(characters)
      .where(and(eq(characters.campaignId, campaignId), eq(characters.userId, userId)))
      .get();
  }

  updateCharacter(id: number, updates: Partial<InsertCharacter> | Record<string, any>): Character | undefined {
    db.update(characters).set(updates as any).where(eq(characters.id, id)).run();
    return this.getCharacter(id);
  }

  deleteCharacter(id: number) {
    db.delete(characters).where(eq(characters.id, id)).run();
  }

  // ───── Character currencies ─────

  getCharacterCurrencies(characterId: number): CharacterCurrency[] {
    return db
      .select()
      .from(characterCurrencies)
      .where(eq(characterCurrencies.characterId, characterId))
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

  setCharacterCurrency(
    campaignId: number,
    characterId: number,
    currencyCode: string,
    amount: number,
  ): CharacterCurrency {
    const existing = this.getCharacterCurrency(characterId, currencyCode);

    if (existing) {
      db.update(characterCurrencies)
        .set({
          amount,
          updatedAt: nowIso(),
        })
        .where(eq(characterCurrencies.id, existing.id))
        .run();
      return this.getCharacterCurrency(characterId, currencyCode)!;
    }

    const [row] = db
      .insert(characterCurrencies)
      .values({
        campaignId,
        characterId,
        currencyCode,
        amount,
      })
      .returning();

    return row;
  }

  adjustCharacterCurrency(
    campaignId: number,
    characterId: number,
    currencyCode: string,
    delta: number,
  ): CharacterCurrency {
    const existing = this.getCharacterCurrency(characterId, currencyCode);
    const currentAmount = existing?.amount ?? 0;
    return this.setCharacterCurrency(campaignId, characterId, currencyCode, currentAmount + delta);
  }

  replaceCharacterCurrencies(
    campaignId: number,
    characterId: number,
    balances: Array<{ currencyCode: string; amount: number }>,
  ) {
    db.delete(characterCurrencies).where(eq(characterCurrencies.characterId, characterId)).run();
    if (!balances.length) return;

    db.insert(characterCurrencies)
      .values(
        balances.map((b) => ({
          campaignId,
          characterId,
          currencyCode: b.currencyCode,
          amount: b.amount,
        })),
      )
      .run();
  }

  // ───── Messages ─────

  createMessage(data: InsertMessage): Message {
    const [row] = db.insert(messages).values(data).returning();
    this.incrementCampaignMessageCount(data.campaignId);
    return row;
  }

  getMessagesByCampaign(campaignId: number): Message[] {
    return db
      .select()
      .from(messages)
      .where(eq(messages.campaignId, campaignId))
      .orderBy(messages.id)
      .all();
  }

  deleteMessagesAfter(campaignId: number, messageId: number) {
    sqlite
      .prepare(`DELETE FROM messages WHERE campaign_id = ? AND id > ?`)
      .run(campaignId, messageId);
  }

  // ───── Items ─────

  createItem(data: InsertItem): Item {
    const [row] = db
      .insert(items)
      .values({
        ...data,
        updatedAt: nowIso(),
      } as any)
      .returning();
    return row;
  }

  createItemsMany(data: InsertItem[]) {
    if (!data.length) return;
    db.insert(items)
      .values(
        data.map((d) => ({
          ...d,
          updatedAt: nowIso(),
        })) as any[],
      )
      .run();
  }

  getItem(id: number): Item | undefined {
    return db.select().from(items).where(eq(items.id, id)).get();
  }

  getItemsByCharacter(characterId: number): Item[] {
    return db
      .select()
      .from(items)
      .where(eq(items.characterId, characterId))
      .orderBy(items.id)
      .all();
  }

  getItemsByCampaign(campaignId: number): Item[] {
    return db
      .select()
      .from(items)
      .where(eq(items.campaignId, campaignId))
      .orderBy(items.id)
      .all();
  }

  updateItem(id: number, updates: Partial<InsertItem> | Record<string, any>): Item | undefined {
    db.update(items)
      .set({
        ...(updates as any),
        updatedAt: nowIso(),
      })
      .where(eq(items.id, id))
      .run();
    return this.getItem(id);
  }

  deleteItem(id: number) {
    db.delete(items).where(eq(items.id, id)).run();
  }

  deleteItemsByCharacter(characterId: number) {
    db.delete(items).where(eq(items.characterId, characterId)).run();
  }

  replaceCharacterItems(characterId: number, replacementItems: InsertItem[]) {
    this.deleteItemsByCharacter(characterId);
    this.createItemsMany(replacementItems);
  }

  decrementItem(itemId: number): Item | null {
    const item = this.getItem(itemId);
    if (!item) return null;

    if (item.quantity <= 1) {
      this.deleteItem(itemId);
      return null;
    }

    return this.updateItem(itemId, { quantity: item.quantity - 1 }) ?? null;
  }

  // ───── Active effects ─────

  createActiveEffect(data: InsertActiveEffect): ActiveEffect {
    const [row] = db.insert(activeEffects).values(data).returning();
    return row;
  }

  getActiveEffect(id: number): ActiveEffect | undefined {
    return db.select().from(activeEffects).where(eq(activeEffects.id, id)).get();
  }

  getActiveEffectsByCharacter(characterId: number): ActiveEffect[] {
    return db
      .select()
      .from(activeEffects)
      .where(eq(activeEffects.characterId, characterId))
      .orderBy(activeEffects.id)
      .all();
  }

  updateActiveEffect(id: number, updates: Partial<InsertActiveEffect> | Record<string, any>): ActiveEffect | undefined {
    db.update(activeEffects).set(updates as any).where(eq(activeEffects.id, id)).run();
    return this.getActiveEffect(id);
  }

  deleteActiveEffect(id: number) {
    db.delete(activeEffects).where(eq(activeEffects.id, id)).run();
  }

  deleteEffectsByCharacter(characterId: number) {
    db.delete(activeEffects).where(eq(activeEffects.characterId, characterId)).run();
  }

  removeConcentration(characterId: number): ActiveEffect[] {
    const effects = this.getActiveEffectsByCharacter(characterId).filter((e) => e.concentration);
    if (!effects.length) return [];
    db.delete(activeEffects)
      .where(inArray(activeEffects.id, effects.map((e) => e.id)))
      .run();
    return effects;
  }

  tickEffects(characterId: number): ActiveEffect[] {
    const effects = this.getActiveEffectsByCharacter(characterId);
    const expired: ActiveEffect[] = [];

    for (const effect of effects) {
      if (effect.durationType !== "rounds") continue;
      if (effect.roundsRemaining == null) continue;

      const next = effect.roundsRemaining - 1;
      if (next <= 0) {
        expired.push(effect);
        this.deleteActiveEffect(effect.id);
      } else {
        this.updateActiveEffect(effect.id, { roundsRemaining: next });
      }
    }

    return expired;
  }

  // ───── Campaign snapshots ─────

  createCampaignSnapshot(data: InsertCampaignSnapshot): CampaignSnapshot {
    const [row] = db.insert(campaignSnapshots).values(data).returning();
    db.update(campaigns)
      .set({ latestSnapshotId: row.id })
      .where(eq(campaigns.id, data.campaignId))
      .run();
    return row;
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

  // ───── Active shops ─────

  createActiveShop(data: InsertActiveShop): ActiveShop {
    const [row] = db
      .insert(activeShops)
      .values({
        ...data,
        updatedAt: nowIso(),
      } as any)
      .returning();

    db.update(campaigns)
      .set({ activeShopId: row.id })
      .where(eq(campaigns.id, data.campaignId))
      .run();

    return row;
  }

  getActiveShop(id: number): ActiveShop | undefined {
    return db.select().from(activeShops).where(eq(activeShops.id, id)).get();
  }

  getActiveShopByCampaign(campaignId: number): ActiveShop | undefined {
    return db
      .select()
      .from(activeShops)
      .where(and(eq(activeShops.campaignId, campaignId), eq(activeShops.isOpen, true)))
      .orderBy(desc(activeShops.id))
      .get();
  }

  updateActiveShop(id: number, updates: Partial<InsertActiveShop> | Record<string, any>): ActiveShop | undefined {
    db.update(activeShops)
      .set({
        ...(updates as any),
        updatedAt: nowIso(),
      })
      .where(eq(activeShops.id, id))
      .run();
    return this.getActiveShop(id);
  }

  closeActiveShop(shopId: number) {
    const shop = this.getActiveShop(shopId);
    if (!shop) return;
    db.update(activeShops)
      .set({ isOpen: false, updatedAt: nowIso() })
      .where(eq(activeShops.id, shopId))
      .run();

    const campaign = this.getCampaign(shop.campaignId);
    if (campaign?.activeShopId === shopId) {
      db.update(campaigns)
        .set({ activeShopId: null as any })
        .where(eq(campaigns.id, shop.campaignId))
        .run();
    }
  }

  // ───── Shop items ─────

  createShopItem(data: InsertShopItem): ShopItem {
    const [row] = db
      .insert(shopItems)
      .values({
        ...data,
        updatedAt: nowIso(),
      } as any)
      .returning();
    return row;
  }

  createShopItemsMany(data: InsertShopItem[]) {
    if (!data.length) return;
    db.insert(shopItems)
      .values(
        data.map((d) => ({
          ...d,
          updatedAt: nowIso(),
        })) as any[],
      )
      .run();
  }

  getShopItem(id: number): ShopItem | undefined {
    return db.select().from(shopItems).where(eq(shopItems.id, id)).get();
  }

  getShopItems(shopId: number): ShopItem[] {
    return db
      .select()
      .from(shopItems)
      .where(eq(shopItems.shopId, shopId))
      .orderBy(shopItems.id)
      .all();
  }

  replaceShopItems(shopId: number, campaignId: number, data: InsertShopItem[]) {
    db.delete(shopItems).where(eq(shopItems.shopId, shopId)).run();
    if (!data.length) return;
    this.createShopItemsMany(
      data.map((d) => ({
        ...d,
        shopId,
        campaignId,
      })),
    );
  }

  updateShopItem(id: number, updates: Partial<InsertShopItem> | Record<string, any>): ShopItem | undefined {
    db.update(shopItems)
      .set({
        ...(updates as any),
        updatedAt: nowIso(),
      })
      .where(eq(shopItems.id, id))
      .run();
    return this.getShopItem(id);
  }

  decrementShopStock(id: number, quantity: number): ShopItem | undefined {
    const item = this.getShopItem(id);
    if (!item) return undefined;
    const nextStock = Math.max(0, item.stock - quantity);
    return this.updateShopItem(id, { stock: nextStock });
  }

  // ───── Achievements ─────

  unlockAchievement(data: InsertUserAchievement): UserAchievement {
    const [row] = db.insert(userAchievements).values(data).returning();
    return row;
  }

  getUserAchievements(userId: number): UserAchievement[] {
    return db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))
      .orderBy(desc(userAchievements.unlockedAt))
      .all();
  }

  getUnlockedAchievementIds(userId: number): string[] {
    return this.getUserAchievements(userId).map((a) => a.achievementId);
  }

  hasAchievement(userId: number, achievementId: string): boolean {
    const row = db
      .select()
      .from(userAchievements)
      .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)))
      .get();
    return !!row;
  }

  // ───── Save point helpers ─────

  buildCampaignSnapshot(campaignId: number) {
    const campaign = this.getCampaign(campaignId);
    if (!campaign) return null;

    const charactersInCampaign = this.getCharactersByCampaign(campaignId);
    const messagesInCampaign = this.getMessagesByCampaign(campaignId);
    const itemsInCampaign = this.getItemsByCampaign(campaignId);
    const effectsInCampaign = charactersInCampaign.flatMap((c) => this.getActiveEffectsByCharacter(c.id));
    const currencies = this.getCampaignCurrencies(campaignId);
    const characterMoney = charactersInCampaign.map((c) => ({
      characterId: c.id,
      balances: this.getCharacterCurrencies(c.id),
    }));
    const shop = campaign.activeShopId ? this.getActiveShop(campaign.activeShopId) : this.getActiveShopByCampaign(campaignId);
    const shopStock = shop ? this.getShopItems(shop.id) : [];

    return {
      campaign,
      characters: charactersInCampaign,
      messages: messagesInCampaign,
      items: itemsInCampaign,
      effects: effectsInCampaign,
      currencies,
      characterMoney,
      shop,
      shopStock,
      takenAt: nowIso(),
    };
  }

  restoreCampaignSnapshot(snapshotId: number) {
    const snapshot = this.getCampaignSnapshot(snapshotId);
    if (!snapshot) return null;

    const data = JSON.parse(snapshot.snapshotData || "{}");
    const campaignId = snapshot.campaignId;

    if (!data.campaign) return null;

    // Restore campaign
    const campaignData = { ...data.campaign };
    delete campaignData.id;
    delete campaignData.createdAt;
    db.update(campaigns).set(campaignData).where(eq(campaigns.id, campaignId)).run();

    // Clear dependent state
    db.delete(characters).where(eq(characters.campaignId, campaignId)).run();
    db.delete(messages).where(eq(messages.campaignId, campaignId)).run();
    db.delete(items).where(eq(items.campaignId, campaignId)).run();
    db.delete(activeEffects).where(eq(activeEffects.campaignId, campaignId)).run();
    db.delete(characterCurrencies).where(eq(characterCurrencies.campaignId, campaignId)).run();
    db.delete(activeShops).where(eq(activeShops.campaignId, campaignId)).run();
    db.delete(shopItems).where(eq(shopItems.campaignId, campaignId)).run();
    db.delete(campaignCurrencies).where(eq(campaignCurrencies.campaignId, campaignId)).run();

    // Restore currencies
    if (Array.isArray(data.currencies) && data.currencies.length) {
      db.insert(campaignCurrencies)
        .values(
          data.currencies.map((c: any) => {
            const row = { ...c };
            delete row.id;
            delete row.createdAt;
            return row;
          }),
        )
        .run();
    }

    // Restore characters
    if (Array.isArray(data.characters) && data.characters.length) {
      db.insert(characters)
        .values(
          data.characters.map((c: any) => {
            const row = { ...c };
            delete row.createdAt;
            return row;
          }),
        )
        .run();
    }

    // Restore messages
    if (Array.isArray(data.messages) && data.messages.length) {
      db.insert(messages)
        .values(
          data.messages.map((m: any) => {
            const row = { ...m };
            delete row.createdAt;
            return row;
          }),
        )
        .run();
    }

    // Restore items
    if (Array.isArray(data.items) && data.items.length) {
      db.insert(items)
        .values(
          data.items.map((i: any) => {
            const row = { ...i };
            delete row.createdAt;
            delete row.updatedAt;
            row.updatedAt = nowIso();
            return row;
          }),
        )
        .run();
    }

    // Restore effects
    if (Array.isArray(data.effects) && data.effects.length) {
      db.insert(activeEffects)
        .values(
          data.effects.map((e: any) => {
            const row = { ...e };
            delete row.createdAt;
            return row;
          }),
        )
        .run();
    }

    // Restore character currency
    if (Array.isArray(data.characterMoney)) {
      const moneyRows: any[] = [];
      for (const bucket of data.characterMoney) {
        if (!Array.isArray(bucket.balances)) continue;
        for (const bal of bucket.balances) {
          const row = { ...bal };
          delete row.createdAt;
          delete row.updatedAt;
          row.updatedAt = nowIso();
          moneyRows.push(row);
        }
      }
      if (moneyRows.length) {
        db.insert(characterCurrencies).values(moneyRows).run();
      }
    }

    // Restore shop
    if (data.shop) {
      const row = { ...data.shop };
      delete row.createdAt;
      delete row.updatedAt;
      row.updatedAt = nowIso();
      db.insert(activeShops).values(row).run();
    }

    if (Array.isArray(data.shopStock) && data.shopStock.length) {
      db.insert(shopItems)
        .values(
          data.shopStock.map((s: any) => {
            const row = { ...s };
            delete row.createdAt;
            delete row.updatedAt;
            row.updatedAt = nowIso();
            return row;
          }),
        )
        .run();
    }

    return this.getCampaign(campaignId);
  }
}

export const storage = new Storage();
runMigrations();
