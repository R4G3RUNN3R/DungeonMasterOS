import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleSchema = z.enum(["player", "dungeon_master"]);
export type UserRole = z.infer<typeof userRoleSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  googleId: text("google_id").unique(),
  googleEmail: text("google_email"),
  avatarUrl: text("avatar_url"),

  // Account role
  role: text("role").notNull().default("player"),
  // player | dungeon_master

  // Subscription
  tier: text("tier").notNull().default("free"),
  // free | adventurer | master | legend | chronicler

  subscriptionStatus: text("subscription_status").notNull().default("trial"),
  // trial | active | past_due | cancelled | expired

  // Stripe
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  stripeBillingInterval: text("stripe_billing_interval"),
  // monthly | weekly | yearly

  // Trial / billing periods
  trialEndsAt: text("trial_ends_at"),
  subscriptionCurrentPeriodEnd: text("subscription_current_period_end"),

  // Usage
  aiTurnsUsedThisMonth: integer("ai_turns_used_this_month").notNull().default(0),
  bonusTurns: integer("bonus_turns").notNull().default(0),
  usageResetAt: text("usage_reset_at"),

  // Account-wide achievement counters — see shared/achievements.ts
  totalLevelUps: integer("total_level_ups").notNull().default(0),

  // Admin / internal
  onboardingComplete: integer("onboarding_complete", { mode: "boolean" }).notNull().default(false),
  unlimitedTurns: integer("unlimited_turns", { mode: "boolean" }).notNull().default(false),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, "passwordHash" | "googleId">;

// ─────────────────────────────────────────────────────────────────────────────
// USER PREFERENCES
// One row per user. `data` is an opaque JSON blob owned by the client-side
// preferences feature; the server only stores/returns it.
// ─────────────────────────────────────────────────────────────────────────────

export const userPreferences = sqliteTable("user_preferences", {
  userId: integer("user_id").primaryKey(),
  data: text("data").notNull().default("{}"),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export type UserPreferencesRow = typeof userPreferences.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// TURN ACCOUNTING
// Ledger rows are append-only audit records. visibleDelta affects user-facing
// available turns; reserveDelta tracks the internal 20% buffer we fund per grant.
// ─────────────────────────────────────────────────────────────────────────────

export const turnLedger = sqliteTable("turn_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  visibleDelta: integer("visible_delta").notNull().default(0),
  reserveDelta: integer("reserve_delta").notNull().default(0),
  balanceAfter: integer("balance_after"),
  reason: text("reason").notNull(),
  source: text("source").notNull().default("manual"),
  sourceId: text("source_id"),
  stripeEventId: text("stripe_event_id"),
  stripeSessionId: text("stripe_session_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  tier: text("tier"),
  packId: text("pack_id"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertTurnLedgerSchema = createInsertSchema(turnLedger).omit({
  id: true,
  createdAt: true,
});

export type InsertTurnLedgerEntry = z.infer<typeof insertTurnLedgerSchema>;
export type TurnLedgerEntry = typeof turnLedger.$inferSelect;

export const stripeEvents = sqliteTable("stripe_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("processed"),
  userId: integer("user_id"),
  metadata: text("metadata").notNull().default("{}"),
  processedAt: text("processed_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type StripeEventRecord = typeof stripeEvents.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET TOKENS
// ─────────────────────────────────────────────────────────────────────────────

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGNS
// ─────────────────────────────────────────────────────────────────────────────

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),

  // Identity / ownership
  hostVisitorId: text("host_visitor_id").notNull(),
  userId: integer("user_id"),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),

  // Core settings
  tone: text("tone").notNull().default("heroic"),
  rulesWeight: text("rules_weight").notNull().default("medium"),
  powerLevel: text("power_level").notNull().default("standard"),
  worldType: text("world_type").notNull().default("original"),
  combatStyle: text("combat_style").notNull().default("cinematic"),
  ruleset: text("ruleset").notNull().default("dnd5e"),
  storyMode: integer("story_mode", { mode: "boolean" }).notNull().default(false),
  worldGenStyle: text("world_gen_style").notNull().default("standard"),
  homebrewRules: text("homebrew_rules").notNull().default(""),
  customWorldPrompt: text("custom_world_prompt").notNull().default(""),
  epicMode: integer("epic_mode", { mode: "boolean" }).notNull().default(false),
  animeWorldSource: text("anime_world_source").notNull().default(""),
  animeWorldMode: text("anime_world_mode").notNull().default("inspired"),
  settingsLocked: integer("settings_locked", { mode: "boolean" }).notNull().default(false),

  // Persistent world state
  worldState: text("world_state").notNull().default("{}"),

  // Save / state tracking
  totalMessages: integer("total_messages").notNull().default(0),
  lastPlayedAt: text("last_played_at"),
  latestSnapshotId: integer("latest_snapshot_id"),

  // Shop state
  activeShopId: integer("active_shop_id"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN SETTINGS HISTORY
// Append-only audit trail of every campaign setting change, whether made
// directly by the owner or applied from an accepted player suggestion.
// ─────────────────────────────────────────────────────────────────────────────

export const campaignSettingsHistory = sqliteTable("campaign_settings_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  settingKey: text("setting_key").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  changedByUserId: integer("changed_by_user_id"),
  source: text("source").notNull(), // 'owner-direct' | 'accepted-suggestion' | 'system'
  suggestionId: integer("suggestion_id"),
  note: text("note"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type CampaignSettingsHistoryRow = typeof campaignSettingsHistory.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN SETTING SUGGESTIONS
// Players propose a setting change; the owner accepts, declines, or the
// player withdraws it. Accepted suggestions get mirrored into
// campaignSettingsHistory with source "accepted-suggestion".
// ─────────────────────────────────────────────────────────────────────────────

export const campaignSettingSuggestions = sqliteTable("campaign_setting_suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  settingKey: text("setting_key").notNull(),
  currentValue: text("current_value").notNull(),
  proposedValue: text("proposed_value").notNull(),
  submittedByUserId: integer("submitted_by_user_id").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending | accepted | declined | withdrawn
  ownerResponse: text("owner_response"),
  resolvedByUserId: integer("resolved_by_user_id"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type CampaignSettingSuggestionRow = typeof campaignSettingSuggestions.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN CURRENCIES
// One campaign can define one or more currencies.
// Examples:
// - USD / EUR / GBP
// - Gold / Silver / Copper
// - Beli / Beri
// - Crowns / Sovereigns / Credits
// ─────────────────────────────────────────────────────────────────────────────

export const campaignCurrencies = sqliteTable(
  "campaign_currencies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull(),

    code: text("code").notNull(),          // e.g. usd, gold, beri
    name: text("name").notNull(),          // e.g. US Dollar, Gold, Beli
    symbol: text("symbol").notNull().default(""),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),

    // Optional exchange value relative to a campaign-defined base currency.
    // For simple single-currency campaigns this can stay 1.
    exchangeRate: integer("exchange_rate").notNull().default(1),

    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    campaignCurrencyUnique: uniqueIndex("campaign_currency_unique").on(table.campaignId, table.code),
  }),
);

export const insertCampaignCurrencySchema = createInsertSchema(campaignCurrencies).omit({
  id: true,
  createdAt: true,
});

export type InsertCampaignCurrency = z.infer<typeof insertCampaignCurrencySchema>;
export type CampaignCurrency = typeof campaignCurrencies.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTERS
// ─────────────────────────────────────────────────────────────────────────────

export const characters = sqliteTable("characters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),

  // Legacy/compat identity
  visitorId: text("visitor_id").notNull(),
  userId: integer("user_id"),

  // Core identity
  name: text("name").notNull(),
  race: text("race").notNull().default("Unknown"),
  charClass: text("char_class").notNull().default("Unknown"),
  traits: text("traits").notNull().default(""),
  backstory: text("backstory").notNull().default(""),

  // Vitals
  level: integer("level").notNull().default(1),
  hp: integer("hp").notNull().default(20),
  maxHp: integer("max_hp").notNull().default(20),
  tempHp: integer("temp_hp").notNull().default(0),
  speed: integer("speed").notNull().default(30),
  attacksPerRound: integer("attacks_per_round").notNull().default(1),

  status: text("status").notNull().default("alive"),

  // Structured character data blob for sections, spells, feats, etc.
  characterData: text("character_data").notNull().default("{}"),

  // Legacy field kept for compatibility while the rest of the project is rewritten
  inventory: text("inventory").notNull().default("[]"),

  // Dice/mechanics engine — ability scores (matches client/src/lib/computedStats.ts's Ability type)
  str: integer("str").notNull().default(10),
  dex: integer("dex").notNull().default(10),
  con: integer("con").notNull().default(10),
  int: integer("int").notNull().default(10),
  wis: integer("wis").notNull().default(10),
  cha: integer("cha").notNull().default(10),
  ac: integer("ac").notNull().default(10),
  xp: integer("xp").notNull().default(0),
  damageDice: text("damage_dice").notNull().default("1d4"),
  attackAbility: text("attack_ability").notNull().default("str"),
  proficiencies: text("proficiencies").notNull().default("[]"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
  createdAt: true,
});

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER CURRENCY BALANCES
// This is the real wallet system.
// Do NOT treat money as fake inventory items for actual transaction logic.
// ─────────────────────────────────────────────────────────────────────────────

export const characterCurrencies = sqliteTable(
  "character_currencies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull(),
    characterId: integer("character_id").notNull(),
    currencyCode: text("currency_code").notNull(),
    amount: integer("amount").notNull().default(0),

    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    characterCurrencyUnique: uniqueIndex("character_currency_unique").on(
      table.characterId,
      table.currencyCode,
    ),
  }),
);

export const insertCharacterCurrencySchema = createInsertSchema(characterCurrencies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCharacterCurrency = z.infer<typeof insertCharacterCurrencySchema>;
export type CharacterCurrency = typeof characterCurrencies.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  sender: text("sender").notNull(),
  senderType: text("sender_type").notNull(), // dm | player | system
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("narration"),
  metadata: text("metadata").notNull().default("{}"),
  clientSubmissionId: text("client_submission_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// ENCOUNTERS
// The server-authoritative combat state machine. participants is a JSON
// snapshot — see server/dice-engine.ts EncounterParticipant for its shape.
// ─────────────────────────────────────────────────────────────────────────────

export const encounters = sqliteTable("encounters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  status: text("status").notNull().default("active"), // active | ended
  round: integer("round").notNull().default(1),
  turnIndex: integer("turn_index").notNull().default(0),
  participants: text("participants").notNull().default("[]"),
  lastResolvedTurnKey: text("last_resolved_turn_key"),
  outcome: text("outcome"), // victory | defeat | all_fled | aborted, set when status becomes "ended"
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  endedAt: text("ended_at"),
});

export const insertEncounterSchema = createInsertSchema(encounters).omit({
  id: true,
  createdAt: true,
});

export type InsertEncounter = z.infer<typeof insertEncounterSchema>;
export type Encounter = typeof encounters.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// ROLL LOG
// Every roll the server executes, with the real stat values used. This is the
// audit trail proving the AI never supplied its own numbers.
// ─────────────────────────────────────────────────────────────────────────────

export const rollLog = sqliteTable("roll_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  encounterId: integer("encounter_id"),
  characterId: integer("character_id"),
  participantId: text("participant_id"),
  rollType: text("roll_type").notNull(), // check | attack | save | initiative
  statUsed: text("stat_used").notNull(),
  baseModifier: integer("base_modifier").notNull(),
  effectModifier: integer("effect_modifier").notNull().default(0),
  proficiencyBonus: integer("proficiency_bonus").notNull().default(0),
  diceResult: integer("dice_result").notNull(),
  total: integer("total").notNull(),
  targetValue: integer("target_value").notNull(),
  isCritical: integer("is_critical", { mode: "boolean" }).notNull().default(false),
  isFumble: integer("is_fumble", { mode: "boolean" }).notNull().default(false),
  outcome: text("outcome").notNull(), // success | failure | hit | miss
  turnKey: text("turn_key"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertRollLogSchema = createInsertSchema(rollLog).omit({
  id: true,
  createdAt: true,
});

export type InsertRollLogEntry = z.infer<typeof insertRollLogSchema>;
export type RollLogEntry = typeof rollLog.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// ITEMS
// Inventory objects, possessions, property, vehicles, mounts, etc.
// ─────────────────────────────────────────────────────────────────────────────

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  characterId: integer("character_id").notNull(),

  name: text("name").notNull(),
  trueName: text("true_name").notNull().default(""),

  description: text("description").notNull().default(""),
  trueDescription: text("true_description").notNull().default(""),

  itemType: text("item_type").notNull().default("gear"),
  // weapon | armor | consumable | gear | tool | magic | misc | property | vehicle | vessel | mount | creature | retainer | key

  quantity: integer("quantity").notNull().default(1),

  charges: integer("charges"),
  maxCharges: integer("max_charges"),

  identified: integer("identified", { mode: "boolean" }).notNull().default(true),
  consumable: integer("consumable", { mode: "boolean" }).notNull().default(false),
  equipped: integer("equipped", { mode: "boolean" }).notNull().default(false),
  // Equipment slot when equipped: head | neck | chest | hands | mainHand | offHand | ring1 | ring2 | legs | feet
  slot: text("slot"),
  // Damage dice this weapon deals when equipped in mainHand (e.g. "1d8") — only
  // meaningful for itemType "weapon". Null means it doesn't override the
  // character's base damage dice.
  weaponDamageDice: text("weapon_damage_dice"),

  // Encumbrance (design spec §16). Weight is per single unit, in pounds —
  // multiply by quantity for the item stack's total weight. Carried
  // distinguishes items physically on the character from owned-but-stored
  // assets (a house, a wagon, a cache back at the inn) that must not count
  // toward carry weight.
  weight: real("weight").notNull().default(0),
  carried: integer("carried", { mode: "boolean" }).notNull().default(true),

  locationNote: text("location_note").notNull().default(""),
  source: text("source").notNull().default("manual"),

  // JSON array of StatMod entries
  statMods: text("stat_mods").notNull().default("[]"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE EFFECTS
// ─────────────────────────────────────────────────────────────────────────────

export const activeEffects = sqliteTable("active_effects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  characterId: integer("character_id").notNull(),

  name: text("name").notNull(),
  source: text("source").notNull().default(""),
  icon: text("icon").notNull().default(""),
  isDebuff: integer("is_debuff", { mode: "boolean" }).notNull().default(false),

  durationType: text("duration_type").notNull().default("rounds"),
  totalDuration: integer("total_duration"),
  roundsRemaining: integer("rounds_remaining"),

  concentration: integer("concentration", { mode: "boolean" }).notNull().default(false),
  statMods: text("stat_mods").notNull().default("[]"),
  description: text("description").notNull().default(""),
  appliedBy: text("applied_by").notNull().default("manual"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertActiveEffectSchema = createInsertSchema(activeEffects).omit({
  id: true,
  createdAt: true,
});

export type InsertActiveEffect = z.infer<typeof insertActiveEffectSchema>;
export type ActiveEffect = typeof activeEffects.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN SNAPSHOTS / SAVE POINTS
// For admin recovery, rewinds, and safe-point restoration.
// ─────────────────────────────────────────────────────────────────────────────

export const campaignSnapshots = sqliteTable("campaign_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),

  label: text("label").notNull().default("Save Point"),
  reason: text("reason").notNull().default("manual"),
  // manual | auto | scene_change | admin_restore_point

  triggerMessageId: integer("trigger_message_id"),
  snapshotData: text("snapshot_data").notNull().default("{}"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertCampaignSnapshotSchema = createInsertSchema(campaignSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertCampaignSnapshot = z.infer<typeof insertCampaignSnapshotSchema>;
export type CampaignSnapshot = typeof campaignSnapshots.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE SHOPS
// A campaign can currently expose one active shop interface at a time.
// The DM can narrate around it, but transactions use structured data.
// ─────────────────────────────────────────────────────────────────────────────

export const activeShops = sqliteTable("active_shops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),

  merchantName: text("merchant_name").notNull(),
  merchantDescription: text("merchant_description").notNull().default(""),
  currencyCode: text("currency_code").notNull(),

  title: text("title").notNull().default("Merchant Stock"),
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true),

  metadata: text("metadata").notNull().default("{}"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertActiveShopSchema = createInsertSchema(activeShops).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertActiveShop = z.infer<typeof insertActiveShopSchema>;
export type ActiveShop = typeof activeShops.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// SHOP ITEMS
// ─────────────────────────────────────────────────────────────────────────────

export const shopItems = sqliteTable("shop_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id").notNull(),
  campaignId: integer("campaign_id").notNull(),

  itemKey: text("item_key").notNull(), // stable key within the shop payload
  name: text("name").notNull(),
  description: text("description").notNull().default(""),

  itemType: text("item_type").notNull().default("gear"),
  quantityPerPurchase: integer("quantity_per_purchase").notNull().default(1),
  stock: integer("stock").notNull().default(1),

  priceAmount: integer("price_amount").notNull().default(0),
  priceCurrencyCode: text("price_currency_code").notNull(),

  metadata: text("metadata").notNull().default("{}"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertShopItemSchema = createInsertSchema(shopItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShopItem = z.infer<typeof insertShopItemSchema>;
export type ShopItem = typeof shopItems.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// ACHIEVEMENTS
// ─────────────────────────────────────────────────────────────────────────────

export const userAchievements = sqliteTable("user_achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  achievementId: text("achievement_id").notNull(),
  campaignId: integer("campaign_id"),
  characterId: integer("character_id"),
  unlockedAt: text("unlocked_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  unlockedAt: true,
});

export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SHAPES
// ─────────────────────────────────────────────────────────────────────────────

export interface StatMod {
  stat: string;
  modifier: number;
  type:
    | "bonus"
    | "override"
    | "override_if_higher"
    | "advantage"
    | "disadvantage"
    | "immunity"
    | "resistance"
    | "custom";
  overrideValue?: number;
  customLabel?: string;
  source?: string;
}

export interface CampaignCurrencyDefinition {
  code: string;
  name: string;
  symbol?: string;
  isPrimary?: boolean;
  exchangeRate?: number;
}

export interface CharacterCurrencyBalance {
  currencyCode: string;
  amount: number;
}

export interface ShopPanelItem {
  itemKey: string;
  name: string;
  description: string;
  itemType:
    | "weapon"
    | "armor"
    | "consumable"
    | "gear"
    | "tool"
    | "magic"
    | "misc"
    | "property"
    | "vehicle"
    | "vessel"
    | "mount"
    | "creature"
    | "retainer"
    | "key";
  stock: number;
  quantityPerPurchase?: number;
  priceAmount: number;
  priceCurrencyCode: string;
  metadata?: Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const currencyDefinitionSchema = z.object({
  code: z.string().min(1).max(32).regex(/^[a-zA-Z0-9_-]+$/, "Currency code may only contain letters, numbers, underscores, and hyphens"),
  name: z.string().min(1).max(64),
  symbol: z.string().max(16).default(""),
  isPrimary: z.boolean().default(false),
  exchangeRate: z.number().int().positive().default(1),
});

export const createCampaignFormSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(100),

  tone: z.enum(["dark", "heroic", "comedic", "realistic"]),
  rulesWeight: z.enum(["light", "medium", "crunchy"]),
  powerLevel: z.enum(["low", "standard", "high", "godtier"]),

  worldType: z.enum(["custom", "faerun", "original"]),
  combatStyle: z.enum(["cinematic", "tactical", "dice"]),
  ruleset: z.enum(["dnd5e", "dnd35e"]).default("dnd5e"),
  storyMode: z.boolean().default(false),

  worldGenStyle: z.enum(["standard", "isekai", "portal", "reincarnation", "dreamfall"]),
  homebrewRules: z.string().max(2000).default(""),
  customWorldPrompt: z.string().max(2000).default(""),

  epicMode: z.boolean().default(false),
  animeWorldSource: z.string().max(2000).default(""),
  animeWorldMode: z.enum(["none", "inspired", "canonical"]).default("inspired"),

  currencies: z.array(currencyDefinitionSchema).min(1, "At least one currency is required"),
});

export const createCharacterFormSchema = z.object({
  name: z.string().min(1, "Character name is required").max(100),
  race: z.string().min(1, "Race is required").max(100),
  charClass: z.string().min(1, "Class is required").max(100),
  traits: z.string().max(3000).default(""),
  backstory: z.string().max(5000).default(""),
  // No .default(10) here on purpose: a request that omits an ability score
  // must fail validation, not silently become a 10. That silent fallback is
  // exactly what produced a live character with every score defaulted and
  // +0 everywhere — see campaign.tsx's character-creation form, which now
  // requires the player to actually roll or point-buy before this is ever
  // submitted.
  // Max raised from 18 to 20: a legitimate 18 (4d6-drop-lowest ceiling or
  // max point buy) plus a +2 racial adjustment can reach 20. Min lowered to 1
  // for the same reason on the penalty side (a -2 racial adjustment on a low
  // roll, clamped at 1 by applyRacialAdjustments in shared/races.ts).
  str: z.number().int().min(1).max(20),
  dex: z.number().int().min(1).max(20),
  con: z.number().int().min(1).max(20),
  int: z.number().int().min(1).max(20),
  wis: z.number().int().min(1).max(20),
  cha: z.number().int().min(1).max(20),
  proficiencies: z.array(z.string().max(60)).max(20).default([]),
  feats: z.array(z.string().min(1).max(200)).max(20).default([]),
});

export const playerActionSchema = z.object({
  content: z.string().min(1, "Action cannot be empty").max(4000),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, numbers, underscores, and hyphens"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const dungeonMasterTargetSchema = z
  .object({
    email: z.string().email("Invalid email address").optional(),
    username: z.string().min(1, "Username is required").max(30).optional(),
  })
  .refine((value) => !!value.email || !!value.username, {
    message: "Email or username is required.",
  });

export const createShopItemSchema = z.object({
  itemKey: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).default(""),
  itemType: z.enum([
    "weapon",
    "armor",
    "consumable",
    "gear",
    "tool",
    "magic",
    "misc",
    "property",
    "vehicle",
    "vessel",
    "mount",
    "creature",
    "retainer",
    "key",
  ]),
  stock: z.number().int().nonnegative(),
  quantityPerPurchase: z.number().int().positive().default(1),
  priceAmount: z.number().int().nonnegative(),
  priceCurrencyCode: z.string().min(1).max(32),
  metadata: z.record(z.any()).optional(),
});

export const buyShopItemSchema = z.object({
  shopItemId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
});

export const adjustCurrencySchema = z.object({
  currencyCode: z.string().min(1).max(32),
  amount: z.number().int(),
});

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CurrencyDefinitionInput = z.infer<typeof currencyDefinitionSchema>;
export type CreateShopItemInput = z.infer<typeof createShopItemSchema>;
export type BuyShopItemInput = z.infer<typeof buyShopItemSchema>;
export type AdjustCurrencyInput = z.infer<typeof adjustCurrencySchema>;
export type DungeonMasterTargetInput = z.infer<typeof dungeonMasterTargetSchema>;
