import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users ──────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),

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

  // Trial
  trialEndsAt: text("trial_ends_at"),
  subscriptionCurrentPeriodEnd: text("subscription_current_period_end"),

  // Bonus turns from top-ups
  bonusTurns: integer("bonus_turns").notNull().default(0),

  // Usage tracking (reset monthly)
  aiTurnsUsedThisMonth: integer("ai_turns_used_this_month").notNull().default(0),
  usageResetAt: text("usage_reset_at"),

  // Onboarding
  onboardingComplete: integer("onboarding_complete", { mode: "boolean" }).notNull().default(false),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, "passwordHash">;

// ── Password Reset Tokens ──────────────────────────────────────────────────
export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// ── Campaigns ──────────────────────────────────────────────────────────────
export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  hostVisitorId: text("host_visitor_id").notNull(),
  userId: integer("user_id"),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),

  // Core settings
  tone: text("tone").notNull().default("heroic"),
  rulesWeight: text("rules_weight").notNull().default("medium"),
  powerLevel: text("power_level").notNull().default("standard"),
  worldType: text("world_type").notNull().default("original"),
  combatStyle: text("combat_style").notNull().default("cinematic"),
  storyMode: integer("story_mode", { mode: "boolean" }).notNull().default(false),
  worldGenStyle: text("world_gen_style").notNull().default("standard"),
  homebrewRules: text("homebrew_rules").notNull().default(""),
  customWorldPrompt: text("custom_world_prompt").notNull().default(""),
  epicMode: integer("epic_mode", { mode: "boolean" }).notNull().default(false),
  animeWorldSource: text("anime_world_source").notNull().default(""),
  animeWorldMode: text("anime_world_mode").notNull().default("inspired"),

  // Persistent world state
  worldState: text("world_state").notNull().default("{}"),

  // Session tracking
  totalMessages: integer("total_messages").notNull().default(0),
  lastPlayedAt: text("last_played_at"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
});
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// ── Characters ─────────────────────────────────────────────────────────────
export const characters = sqliteTable("characters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  userId: integer("user_id"),

  name: text("name").notNull(),
  race: text("race").notNull().default("Unknown"),
  charClass: text("char_class").notNull().default("Unknown"),
  traits: text("traits").notNull().default(""),
  backstory: text("backstory").notNull().default(""),

  level: integer("level").notNull().default(1),
  hp: integer("hp").notNull().default(20),
  maxHp: integer("max_hp").notNull().default(20),
  status: text("status").notNull().default("alive"),
  inventory: text("inventory").notNull().default("[]"),

  characterData: text("character_data").notNull().default("{}"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
  createdAt: true,
});
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

// ── Messages ───────────────────────────────────────────────────────────────
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  sender: text("sender").notNull(),
  senderType: text("sender_type").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("narration"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ── Items ──────────────────────────────────────────────────────────────────
export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  characterId: integer("character_id").notNull(),

  name: text("name").notNull(),
  trueName: text("true_name").notNull().default(""),
  description: text("description").notNull().default(""),
  trueDescription: text("true_description").notNull().default(""),

  itemType: text("item_type").notNull().default("gear"),
  quantity: integer("quantity").notNull().default(1),
  charges: integer("charges").default(null),
  maxCharges: integer("max_charges").default(null),
  identified: integer("identified", { mode: "boolean" }).notNull().default(true),
  consumable: integer("consumable", { mode: "boolean" }).notNull().default(false),
  equipped: integer("equipped", { mode: "boolean" }).notNull().default(false),
  locationNote: text("location_note").notNull().default(""),
  source: text("source").notNull().default("manual"),
  statMods: text("stat_mods").notNull().default("[]"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// ── Active Effects ─────────────────────────────────────────────────────────
export const activeEffects = sqliteTable("active_effects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  characterId: integer("character_id").notNull(),

  name: text("name").notNull(),
  source: text("source").notNull().default(""),
  icon: text("icon").notNull().default(""),
  isDebuff: integer("is_debuff", { mode: "boolean" }).notNull().default(false),

  durationType: text("duration_type").notNull().default("rounds"),
  totalDuration: integer("total_duration").default(null),
  roundsRemaining: integer("rounds_remaining").default(null),
  concentration: integer("concentration", { mode: "boolean" }).notNull().default(false),
  statMods: text("stat_mods").notNull().default("[]"),
  description: text("description").notNull().default(""),
  appliedBy: text("applied_by").notNull().default("manual"),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertActiveEffectSchema = createInsertSchema(activeEffects).omit({ id: true, createdAt: true });
export type InsertActiveEffect = z.infer<typeof insertActiveEffectSchema>;
export type ActiveEffect = typeof activeEffects.$inferSelect;

// ── Achievements ───────────────────────────────────────────────────────────
export const userAchievements = sqliteTable("user_achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  achievementId: text("achievement_id").notNull(),
  campaignId: integer("campaign_id"),
  characterId: integer("character_id"),
  unlockedAt: text("unlocked_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({ id: true, unlockedAt: true });
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;

// ── StatMod shape ──────────────────────────────────────────────────────────
export interface StatMod {
  stat: string;
  modifier: number;
  type: "bonus" | "override" | "override_if_higher" | "advantage" | "disadvantage" | "immunity" | "resistance" | "custom";
  overrideValue?: number;
  customLabel?: string;
  source?: string;
}

// ── Validation schemas ─────────────────────────────────────────────────────
export const createCampaignFormSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(100),
  tone: z.enum(["dark", "heroic", "comedic", "realistic"]),
  rulesWeight: z.enum(["light", "medium", "crunchy"]),
  powerLevel: z.enum(["low", "standard", "high", "godtier"]),
  worldType: z.enum(["custom", "faerun", "original"]),
  combatStyle: z.enum(["cinematic", "tactical", "dice"]),
  storyMode: z.boolean().default(false),
  worldGenStyle: z.enum(["standard", "isekai", "portal", "reincarnation", "dreamfall"]),
  homebrewRules: z.string().max(2000).default(""),
  customWorldPrompt: z.string().max(2000).default(""),
  epicMode: z.boolean().default(false),
  animeWorldSource: z.string().max(2000).default(""),
  animeWorldMode: z.enum(["none", "inspired", "canonical"]).default("inspired"),
});

export const createCharacterFormSchema = z.object({
  name: z.string().min(1, "Character name is required").max(100),
  race: z.string().min(1, "Race is required").max(100),
  charClass: z.string().min(1, "Class is required").max(100),
  traits: z.string().max(3000).default(""),
  backstory: z.string().max(5000).default(""),
});

export const playerActionSchema = z.object({
  content: z.string().min(1, "Action cannot be empty").max(1000),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters").max(30).regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, numbers, underscores, and hyphens"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
