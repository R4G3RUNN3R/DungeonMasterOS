import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { generateDMResponse, generateOpeningScene, extractWorldState } from "./dm-engine";
import {
  createCampaignFormSchema,
  createCharacterFormSchema,
  playerActionSchema,
  registerSchema,
  loginSchema,
} from "@shared/schema";
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  attachUser,
  requireAuth,
  requireCanPlay,
  allowReadOnlyForExpired,
  checkCampaignLimit,
  checkTurnLimit,
  incrementTurnCount,
  toPublicUser,
} from "./auth";
import { randomBytes, randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import { TIERS, TURN_PACKS, TRIAL_DAYS, type TierName } from "../shared/tiers";
import { ACHIEVEMENT_MAP, checkAchievements, scanDMResponseForAchievements } from "../shared/achievements";

// ── Clients ────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });
}

// ── WebSocket campaign registry ─────────────────────────────────────────────
const campaignClients = new Map<number, Set<WebSocket>>();

function broadcastToCampaign(campaignId: number, data: any) {
  const clients = campaignClients.get(campaignId);
  if (!clients) return;
  const json = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(json);
  }
}

function broadcastToUser(userId: number, campaignId: number, data: any) {
  const clients = campaignClients.get(campaignId);
  if (!clients) return;
  const json = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN && (ws as any)._userId === userId) {
      ws.send(json);
    }
  }
}

function getVisitorId(req: Request): string {
  // If the user is logged in, use their userId as the stable identity.
  // This ensures character lookups work regardless of browser session/header.
  if (req.user?.id) return `user-${req.user.id}`;
  return req.headers["x-visitor-id"] as string || `anon-${randomBytes(8).toString("hex")}`;
}

// ── AI extractors ───────────────────────────────────────────────────────────
async function extractAbilitiesFromNarration(
  narration: string,
  _campaignId: number,
  _characterId: number,
): Promise<Array<{ name: string; description: string; category: string }>> {
  const grantKeywords =
    /\b(learns?|learns? to|gains? the ability|gains? access to|awakens?|unlocks?|masters?|receives? the|is granted|manifests?|activates?|teaches? you|your body remembers|the power of|acquire[sd]?|bestow[sd]?)\b/i;
  if (!grantKeywords.test(narration)) return [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: `You are an ability extractor for a narrative RPG. Given DM narration, identify any abilities, powers, spells, techniques, or capabilities that were NEWLY GRANTED to the player character RIGHT NOW.

This covers ALL systems: D&D spells, anime jutsu (Sharingan, Rasengan, Shadow Clone), devil fruit powers, isekai cheat skills, homebrew abilities, racial abilities, class features, etc.

Return a JSON array (may be empty []):
[
  {
    "name": "exact name of the ability as stated or implied",
    "description": "what the ability does, based on what the narration describes. Be specific and preserve any game system's vocabulary. 2-3 sentences max.",
    "category": "spell|jutsu|devil_fruit|isekai_skill|racial|class_feature|homebrew|passive|active|transformation"
  }
]

Only include abilities EXPLICITLY granted in this scene. Do not include abilities the character already had.
Return ONLY the JSON array. No explanation.`,
      messages: [{ role: "user", content: narration }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function extractItemsFromNarration(
  narration: string,
  campaignId: number,
  characterId: number,
): Promise<any[]> {
  const grantKeywords =
    /\b(gives?|hands?|grants?|receives?|finds?|picks? up|obtains?|discovers?|rewards?|loot|opens? .{0,20}chest|inside .{0,20}(bag|chest|pack|pouch)|tucks? .{0,30}(into|away)|presses? .{0,20}into|slips? .{0,20}(into|to)|places? .{0,20}in your hand|passes? .{0,20}to you)\b/i;
  if (!grantKeywords.test(narration)) return [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: `You are an item extractor for a tabletop RPG. Given DM narration, identify any items that were NEWLY GRANTED to the player character in this scene.

Only extract items that were explicitly given/found/received RIGHT NOW in this narration. Do not list items the character already owns.

Return a JSON array (may be empty []) of objects:
[
  {
    "name": "display name (use 'X (Unidentified)' format if it seems mysterious or magical but unnamed)",
    "description": "one sentence describing what it is, or empty string if unidentified",
    "itemType": "consumable|weapon|armor|gear|magic|key|currency|misc|mount|vessel|property|vehicle|creature|retainer",
    "quantity": 1,
    "consumable": true or false,
    "identified": true or false (false if it's mysterious, glowing, unexamined, or described vaguely)
  }
]

Rules:
- Currency mentioned (gold, coins, silver) = itemType "currency"
- Potions, scrolls, bombs = consumable true
- Weapons, armor = consumable false
- If the item seems magical but its nature is unclear = identified false
- If nothing was granted, return []
- Return ONLY the JSON array. No explanation.`,
      messages: [{ role: "user", content: narration }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any) => ({
      campaignId,
      characterId,
      name: item.name || "Unknown Item",
      trueName: "",
      description: item.description || "",
      trueDescription: "",
      itemType: item.itemType || "misc",
      quantity: item.quantity || 1,
      charges: null,
      maxCharges: null,
      identified: item.identified !== false,
      consumable: !!item.consumable,
      equipped: false,
      locationNote: "",
      source: "dm",
      statMods: "[]",
    }));
  } catch {
    return [];
  }
}

// ── Stripe helpers ──────────────────────────────────────────────────────────
function getStripePriceId(tier: TierName, interval: "monthly" | "weekly" | "yearly"): string | null {
  const tierDef = TIERS[tier];
  if (!tierDef) return null;
  const envVarMap: Record<string, string | undefined> = {
    monthly: tierDef.stripePriceIdMonthly,
    weekly: tierDef.stripePriceIdWeekly,
    yearly: tierDef.stripePriceIdYearly,
  };
  const envVarName = envVarMap[interval];
  if (!envVarName) return null;
  return process.env[envVarName] || null;
}

function getTopUpPriceId(packId: string, tier: TierName): string | null {
  // STRIPE_PRICE_TOPUP_50_ADVENTURER, etc.
  const turns = packId.replace("pack_", "");
  const envKey = `STRIPE_PRICE_TOPUP_${turns}_${tier.toUpperCase()}`;
  return process.env[envKey] || null;
}

// ── Achievement helpers ─────────────────────────────────────────────────────
function tryUnlockAchievements(
  userId: number,
  campaignId: number,
  characterId: number | null,
  ctx: Parameters<typeof checkAchievements>[0],
): void {
  try {
    const toUnlock = checkAchievements(ctx);
    for (const id of toUnlock) {
      if (!storage.hasAchievement(userId, id)) {
        storage.unlockAchievement({
          userId,
          achievementId: id,
          campaignId,
          characterId: characterId ?? undefined,
        });
        const achievement = ACHIEVEMENT_MAP[id];
        if (achievement) {
          broadcastToCampaign(campaignId, {
            type: "achievement_unlocked",
            achievement,
          });
        }
      }
    }
  } catch {
    // Achievement errors must never break gameplay
  }
}

// ── Route registration ──────────────────────────────────────────────────────
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Apply auth middleware globally
  app.use(attachUser);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // Register
  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { email, username, password } = parsed.data;

    const existingEmail = storage.getUserByEmail(email);
    if (existingEmail) return res.status(409).json({ message: "An account with this email already exists." });

    const existingUsername = storage.getUserByUsername(username);
    if (existingUsername) return res.status(409).json({ message: "This username is already taken." });

    const passwordHash = await hashPassword(password);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    const user = storage.createUser({
      email,
      username,
      passwordHash,
      tier: "free",
      subscriptionStatus: "trial",
    
