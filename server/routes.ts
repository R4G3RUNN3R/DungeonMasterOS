import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, updateUserPasswordAndBumpAuthVersion } from "./storage";
import {
  generateDMResponse,
  generateOpeningScene,
  extractWorldState,
  extractShopStateFromNarration,
} from "./dm-engine";
import {
  createCampaignFormSchema,
  createCharacterFormSchema,
  playerActionSchema,
  registerSchema,
  loginSchema,
  dungeonMasterTargetSchema,
  accessRoleUpdateSchema,
  explicitEntitlementUpdateSchema,
  createShopItemSchema,
  buyShopItemSchema,
  type Item,
} from "@shared/schema";
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  attachUser,
  requireAuth,
  getSessionUserIdFromCookieHeader,
  revokeRequestSession,
  OPAQUE_COOKIE_NAME,
  requireCanPlay,
  checkCampaignLimit,
  claimTurn,
  releaseTurnClaim,
  grantDungeonMasterAccess,
  revokeDungeonMasterAccess,
  setAccessRole,
  toPublicUser,
} from "./auth";
import { setExplicitEntitlements } from "./entitlement-management";
import {
  listActiveOpaqueSessionsForUser,
  resolveOpaqueSession,
  revokeAllOpaqueSessionsForUser,
  revokeOpaqueSessionByIdForUser,
} from "./session-service";
import {
  authLoginIdentityLimit,
  authLoginIpLimit,
  authRecoveryIdentityLimit,
  authRecoveryIpLimit,
  authRegisterIpLimit,
  authResetIpLimit,
  authSensitiveIpLimit,
  requireTrustedOrigin,
} from "./security";
import { safeRecordSecurityEvent } from "./security-audit";
import { PERMISSIONS, requirePermission } from "./permissions";
import {
  buildGoogleAuthorizationUrl,
  buildGooglePkceChallenge,
  exchangeGoogleCodeForProfile,
  generateGooglePkceVerifier,
  generateGoogleUsernameBase,
  getGoogleFailureRedirect,
  getGooglePostLoginRedirect,
  isGoogleAuthConfigured,
  type GoogleProfile,
} from "./google-auth";
import { randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { TRIAL_DAYS } from "../shared/tiers";
import { ACHIEVEMENT_MAP, checkAchievements, scanDMResponseForAchievements } from "../shared/achievements";

// ── Clients ────────────────────────────────────────────────────────────────
const configuredAnthropicTimeoutMs = Number(process.env.ANTHROPIC_TIMEOUT_MS || 60_000);
const AUX_ANTHROPIC_TIMEOUT_MS =
  Number.isFinite(configuredAnthropicTimeoutMs) && configuredAnthropicTimeoutMs > 0
    ? configuredAnthropicTimeoutMs
    : 60_000;
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: AUX_ANTHROPIC_TIMEOUT_MS,
  maxRetries: 0,
});
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const GOOGLE_STATE_COOKIE = "dmos_google_oauth_state";
const GOOGLE_PKCE_COOKIE = "dmos_google_oauth_pkce";


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

function getWebSocketUserId(cookieHeader: string | undefined): number | null {
  return getSessionUserIdFromCookieHeader(cookieHeader);
}

function userCanAccessCampaign(userId: number, campaignId: number): boolean {
  const campaign = storage.getCampaign(campaignId);
  if (!campaign) return false;
  return campaign.userId === userId || storage.isCampaignMember(campaignId, userId);
}

function requireCampaignAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Sign in to continue.", code: "UNAUTHENTICATED" });
  }

  const campaignId = Number(req.params.id);
  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return res.status(400).json({ message: "Invalid campaign id." });
  }

  const campaign = storage.getCampaign(campaignId);
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  if (!userCanAccessCampaign(req.user.id, campaignId)) {
    return res.status(403).json({ message: "You do not have access to this campaign." });
  }

  next();
}

function requireCharacterDetailAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Sign in to continue.", code: "UNAUTHENTICATED" });
  }

  const characterId = Number(req.params.characterId);
  if (!Number.isInteger(characterId) || characterId <= 0) {
    return res.status(400).json({ message: "Invalid character id." });
  }

  const character = storage.getCharacter(characterId);
  if (!character) {
    return res.status(404).json({ message: "Character not found" });
  }

  const campaign = storage.getCampaign(character.campaignId);
  const mayInspect = character.userId === req.user.id || campaign?.userId === req.user.id;
  if (!mayInspect) {
    return res.status(403).json({ message: "You do not have access to this character." });
  }

  next();
}

function getActionContent(body: any): string {
  if (!body || typeof body !== "object") return "";
  const candidates = [body.content, body.action, body.message, body.text];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function buildFallbackOpeningScene(campaignName: string, characters: Array<{ name: string }>) {
  const names = characters.map((c) => c.name).join(", ");
  return `A strange stillness settles over **${campaignName}** as the world gathers itself around ${names || "the party"}.

The air is heavy with possibility. Somewhere nearby, something creaks, shifts, or waits. The place feels real enough to touch, but not yet fully awake, as if the story itself had to claw its way into motion.

You have a moment to take stock, study your surroundings, and choose how you want to begin.

**What do you do?**`;
}

function buildFallbackActionResponse(characterName: string, content: string) {
  return `The world hesitates for a heartbeat as **${characterName}** acts: "${content}"

Something in the scene responds, even if imperfectly. You sense movement nearby, the environment tightening around your choice, as if events are beginning to align with your intent.

Whatever happens next, your action has pushed the moment forward.

**What do you do now?**`;
}

function projectShopFromNarration(
  campaignId: number,
  narration: string,
): { cleanContent: string; shopId: number | null } {
  const shopState = extractShopStateFromNarration(narration);
  const cleanContent = narration
    .replace(/\[SHOP\][\s\S]*?\[\/SHOP\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!shopState) return { cleanContent: narration.trim(), shopId: null };

  const currencies = storage.getCampaignCurrencies(campaignId);
  const currencyByCode = new Map(currencies.map((currency) => [currency.code.toLowerCase(), currency.code]));
  const currencyCode = currencyByCode.get(String(shopState.currencyCode || "").toLowerCase());
  if (!currencyCode) return { cleanContent, shopId: null };

  const stock = (shopState.items || [])
    .filter((item: any) => typeof item?.name === "string" && item.name.trim())
    .map((item: any, index: number) => ({
      itemKey: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "item"}_${index + 1}`,
      name: item.name.trim(),
      description: String(item.description || ""),
      itemType: String(item.itemType || "gear"),
      quantityPerPurchase: 1,
      stock: Math.max(0, Number(item.stock) || 0),
      priceAmount: Math.max(0, Number(item.priceAmount) || 0),
      priceCurrencyCode:
        currencyByCode.get(String(item.priceCurrencyCode || currencyCode).toLowerCase()) || currencyCode,
      metadata: "{}",
    }));

  const opened = storage.openShop({
    campaignId,
    merchantName: String(shopState.merchantName || "Merchant").trim() || "Merchant",
    merchantDescription: "",
    currencyCode,
    title: "Merchant Stock",
    isOpen: true,
    metadata: "{}",
  }, stock);

  return { cleanContent, shopId: opened.shop.id };
}

function getAIServiceIssue(error: unknown): { title: string; detail: string } | null {
  const status = Number((error as any)?.status);
  const message = String((error as any)?.message || "");
  const name = String((error as any)?.name || "");

  if (/timeout|timed out/i.test(message) || /timeout/i.test(name) || status === 408 || status === 504) {
    return {
      title: "Anthropic request timed out",
      detail: "The Dungeon Master AI did not respond within the configured request window.",
    };
  }

  if (status === 429 || status === 529 || /rate limit|overloaded/i.test(message)) {
    return {
      title: "Anthropic temporarily unavailable",
      detail: "The Dungeon Master AI is temporarily rate-limited or overloaded. Your turn was not charged.",
    };
  }

  if ([500, 502, 503].includes(status) || /econnreset|socket hang up|network|fetch failed/i.test(message)) {
    return {
      title: "Anthropic service unavailable",
      detail: "The Dungeon Master AI service could not complete the request. Your turn was not charged.",
    };
  }

  if (/credit balance is too low|purchase credits|plans & billing/i.test(message)) {
    return {
      title: "Anthropic credits exhausted",
      detail:
        "The live server reached Anthropic, but the configured Anthropic account has no remaining API credits.",
    };
  }

  if (status === 401 || status === 403 || /invalid x-api-key|authentication|unauthorized|forbidden/i.test(message)) {
    return {
      title: "Anthropic authentication failed",
      detail:
        "The live server could not authenticate with Anthropic using the configured API credentials.",
    };
  }

  if (/model: .*not_found|invalid_request_error/i.test(message) && /model/i.test(message)) {
    return {
      title: "Anthropic model configuration failed",
      detail:
        "The live server is configured to use an Anthropic model that is unavailable to this account or no longer valid.",
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      title: "Anthropic API key missing",
      detail: "The live server does not currently have an Anthropic API key configured.",
    };
  }

  return null;
}

function buildAIUnavailableSystemMessage(
  context: "start" | "action" | "item",
  issue?: { title: string; detail: string } | null,
): string {
  const contextLine =
    context === "start"
      ? "The opening scene could not be generated."
      : context === "item"
        ? "The item interaction could not be narrated."
        : "Your action was saved, but no new narration was generated.";

  const issueTitle = issue?.title || "Dungeon Master AI unavailable";
  const issueDetail =
    issue?.detail ||
    "The live server cannot reach the Anthropic-powered Dungeon Master right now.";

  return `${issueTitle}: ${contextLine}

${issueDetail}

Top up the Anthropic account credits or replace the Anthropic API key, then try again. This is a real service-status message, not part of the story.`;
}

// ── AI state projection ─────────────────────────────────────────────────────
type NarrationProjectionItem = {
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  identified: boolean;
};

type NarrationProjectionCurrency = {
  currencyCode: string;
  amountDelta: number;
};

type NarrationProjectionAbility = {
  name: string;
  description: string;
  category: string;
};

type NarrationProjection = {
  items: NarrationProjectionItem[];
  currencies: NarrationProjectionCurrency[];
  abilities: NarrationProjectionAbility[];
};

const EMPTY_NARRATION_PROJECTION: NarrationProjection = {
  items: [],
  currencies: [],
  abilities: [],
};

async function extractStateProjectionFromNarration(
  narration: string,
  campaignId: number,
): Promise<NarrationProjection> {
  const stateChangeKeywords =
    /\b(gives?|hands?|grants?|receives?|finds?|picks? up|obtains?|discovers?|rewards?|loot|presses? .{0,30}(into|to)|passes? .{0,30}to you|pays?|paid|earns?|gold|coins?|silver|gp|learns?|gains? the ability|gains? access to|awakens?|unlocks?|masters?|is granted|bestow[sd]?)\b/i;
  if (!stateChangeKeywords.test(narration)) return EMPTY_NARRATION_PROJECTION;

  const currencies = storage.getCampaignCurrencies(campaignId);
  const currencyCodes = currencies.map((currency) => currency.code);

  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 900,
      system: `You are a state projection extractor for a narrative RPG. Read the Dungeon Master's narration and identify ONLY state changes that happened to the current player character in this scene.

Return ONLY one JSON object with this exact shape:
{
  "items": [
    {
      "name": "newly acquired item",
      "description": "brief factual description",
      "itemType": "consumable|weapon|armor|gear|tool|magic|misc|property|vehicle|vessel|mount|creature|retainer|key",
      "quantity": 1,
      "consumable": false,
      "identified": true
    }
  ],
  "currencies": [
    {
      "currencyCode": "one of the allowed campaign codes",
      "amountDelta": 50
    }
  ],
  "abilities": [
    {
      "name": "newly granted ability",
      "description": "what it does",
      "category": "spell|jutsu|devil_fruit|isekai_skill|racial|class_feature|homebrew|passive|active|transformation"
    }
  ]
}

Allowed campaign currency codes: ${currencyCodes.length ? currencyCodes.join(", ") : "none"}

Rules:
- Items: only things explicitly acquired or taken NOW. Do not turn currency into an item.
- Currencies: positive means gained; negative means spent/lost/paid. Use ONLY an allowed campaign currency code. Do not invent exchange rates.
- Abilities: only powers, spells, techniques, class/racial features, or capabilities newly granted NOW.
- Never repeat possessions or abilities merely mentioned in narration.
- If a category has no change, return an empty array for it.
- Return JSON only. No markdown and no commentary.`,
      messages: [{ role: "user", content: narration }],
    });

    const raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    let cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/m, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const validItemTypes = new Set([
      "consumable", "weapon", "armor", "gear", "tool", "magic", "misc",
      "property", "vehicle", "vessel", "mount", "creature", "retainer", "key",
    ]);
    const currencyByCode = new Map(
      currencies.map((currency) => [currency.code.toLowerCase(), currency.code]),
    );

    const items: NarrationProjectionItem[] = Array.isArray(parsed.items)
      ? parsed.items.flatMap((candidate: any) => {
          const name = typeof candidate?.name === "string" ? candidate.name.trim().slice(0, 100) : "";
          if (!name) return [];
          const rawType = typeof candidate?.itemType === "string"
            ? candidate.itemType.trim().toLowerCase()
            : "misc";
          const itemType = validItemTypes.has(rawType) ? rawType : "misc";
          const rawQuantity = Number(candidate?.quantity);
          const quantity = Number.isFinite(rawQuantity)
            ? Math.max(1, Math.min(999, Math.trunc(rawQuantity)))
            : 1;
          return [{
            name,
            description: typeof candidate?.description === "string"
              ? candidate.description.trim().slice(0, 1000)
              : "",
            itemType,
            quantity,
            consumable: Boolean(candidate?.consumable),
            identified: candidate?.identified !== false,
          }];
        })
      : [];

    const currencyChanges: NarrationProjectionCurrency[] = Array.isArray(parsed.currencies)
      ? parsed.currencies.flatMap((candidate: any) => {
          const rawCode = typeof candidate?.currencyCode === "string"
            ? candidate.currencyCode.trim().toLowerCase()
            : "";
          const currencyCode = currencyByCode.get(rawCode);
          const rawDelta = Number(candidate?.amountDelta);
          if (!currencyCode || !Number.isFinite(rawDelta)) return [];
          const amountDelta = Math.trunc(rawDelta);
          if (amountDelta === 0) return [];
          return [{ currencyCode, amountDelta }];
        })
      : [];

    const abilities: NarrationProjectionAbility[] = Array.isArray(parsed.abilities)
      ? parsed.abilities.flatMap((candidate: any) => {
          const name = typeof candidate?.name === "string" ? candidate.name.trim().slice(0, 120) : "";
          if (!name) return [];
          return [{
            name,
            description: typeof candidate?.description === "string"
              ? candidate.description.trim().slice(0, 1000)
              : "",
            category: typeof candidate?.category === "string" && candidate.category.trim()
              ? candidate.category.trim().slice(0, 64)
              : "homebrew",
          }];
        })
      : [];

    return { items, currencies: currencyChanges, abilities };
  } catch (error) {
    console.error("Narration state projection failed:", error);
    return EMPTY_NARRATION_PROJECTION;
  }
}

function applyNarrationProjection(
  campaignId: number,
  characterId: number,
  projection: NarrationProjection,
): { createdItems: Item[]; currencyChanged: boolean; abilitiesAdded: NarrationProjectionAbility[] } {
  const createdItems: Item[] = [];
  for (const item of projection.items) {
    createdItems.push(storage.createItem({
      campaignId,
      characterId,
      name: item.name,
      trueName: "",
      description: item.description,
      trueDescription: "",
      itemType: item.itemType,
      quantity: item.quantity,
      charges: null,
      maxCharges: null,
      identified: item.identified,
      consumable: item.consumable,
      equipped: false,
      locationNote: "",
      source: "dm_state_projection",
      statMods: "[]",
    }));
  }

  let currencyChanged = false;
  for (const change of projection.currencies) {
    if (storage.adjustCharacterCurrency(
      campaignId,
      characterId,
      change.currencyCode,
      change.amountDelta,
    )) {
      currencyChanged = true;
    }
  }

  const abilitiesAdded: NarrationProjectionAbility[] = [];
  if (projection.abilities.length) {
    const character = storage.getCharacter(characterId);
    if (character) {
      try {
        const characterData = JSON.parse(character.characterData || "{}");
        if (!Array.isArray(characterData.sections)) characterData.sections = [];
        let section = characterData.sections.find((entry: any) => entry?.label === "Granted Abilities");
        if (!section) {
          section = { label: "Granted Abilities", type: "abilities", entries: [] };
          characterData.sections.push(section);
        }
        if (!Array.isArray(section.entries)) section.entries = [];

        for (const ability of projection.abilities) {
          const exists = section.entries.some((entry: any) =>
            String(entry?.key || entry?.name || "").toLowerCase() === ability.name.toLowerCase(),
          );
          if (exists) continue;
          section.entries.push({
            key: ability.name,
            name: ability.name,
            value: `[${ability.category}] ${ability.description}`,
            description: ability.description,
          });
          abilitiesAdded.push(ability);
        }

        if (abilitiesAdded.length) {
          storage.updateCharacter(characterId, { characterData: JSON.stringify(characterData) } as any);
        }
      } catch (error) {
        console.error("Ability projection persistence failed:", error);
      }
    }
  }

  if (createdItems.length) {
    for (const item of createdItems) {
      broadcastToCampaign(campaignId, { type: "item_granted", item });
    }
    broadcastToCampaign(campaignId, { type: "items_updated", characterId });
  }
  if (currencyChanged) {
    broadcastToCampaign(campaignId, { type: "currencies_updated", characterId });
  }
  if (abilitiesAdded.length) {
    broadcastToCampaign(campaignId, {
      type: "abilities_granted",
      characterId,
      abilities: abilitiesAdded,
    });
    broadcastToCampaign(campaignId, { type: "character_updated", characterId });
  }

  return { createdItems, currencyChanged, abilitiesAdded };
}

function useSecureOAuthCookie(): boolean {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.NODE_ENV === "production";
}

function setShortLivedCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: useSecureOAuthCookie(),
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

function clearShortLivedCookie(res: Response, name: string) {
  res.clearCookie(name, {
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

function makeUniqueGoogleUsername(profile: GoogleProfile): string {
  const base = generateGoogleUsernameBase(profile.email, profile.name).slice(0, 24);
  let candidate = base;
  let counter = 2;

  while (storage.getUserByUsername(candidate)) {
    const suffix = `_${counter}`;
    candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    counter += 1;
  }

  return candidate;
}

function buildNewGoogleUserBillingDefaults() {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1);
  nextReset.setDate(1);
  nextReset.setHours(0, 0, 0, 0);

  return {
    tier: "free",
    subscriptionStatus: "trial",
    trialEndsAt: trialEndsAt.toISOString(),
    usageResetAt: nextReset.toISOString(),
    aiTurnsUsedThisMonth: 0,
    bonusTurns: 0,
    onboardingComplete: false,
  };
}

export async function findOrCreateGoogleUser(profile: GoogleProfile) {
  const googleUser = storage.getUserByGoogleId(profile.sub);
  if (googleUser) {
    storage.updateUser(googleUser.id, {
      googleEmail: profile.email,
      avatarUrl: profile.picture || googleUser.avatarUrl,
    });
    return storage.getUser(googleUser.id) || googleUser;
  }

  const existingEmailUser = storage.getUserByEmail(profile.email);
  if (existingEmailUser) {
    if (existingEmailUser.googleId && existingEmailUser.googleId !== profile.sub) {
      throw new Error("This email is already linked to a different Google account.");
    }

    storage.updateUser(existingEmailUser.id, {
      googleId: profile.sub,
      googleEmail: profile.email,
      avatarUrl: profile.picture || existingEmailUser.avatarUrl,
    });
    return storage.getUser(existingEmailUser.id) || existingEmailUser;
  }

  const passwordHash = await hashPassword(`google:${profile.sub}:${randomBytes(24).toString("hex")}`);
  return storage.createUser({
    email: profile.email,
    username: makeUniqueGoogleUsername(profile),
    passwordHash,
    googleId: profile.sub,
    googleEmail: profile.email,
    avatarUrl: profile.picture,
    ...buildNewGoogleUserBillingDefaults(),
  });
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
  app.use(attachUser);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/auth/google/status", (_req, res) => {
    return res.json({ enabled: isGoogleAuthConfigured() });
  });

  app.get("/api/auth/google", (_req, res) => {
    if (!isGoogleAuthConfigured()) {
      return res.status(503).json({ message: "Google sign-in is not configured yet." });
    }

    const state = randomBytes(24).toString("hex");
    const codeVerifier = generateGooglePkceVerifier();
    const codeChallenge = buildGooglePkceChallenge(codeVerifier);
    setShortLivedCookie(res, GOOGLE_STATE_COOKIE, state);
    setShortLivedCookie(res, GOOGLE_PKCE_COOKIE, codeVerifier);
    return res.redirect(buildGoogleAuthorizationUrl(state, codeChallenge));
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const expectedState = req.cookies?.[GOOGLE_STATE_COOKIE];
    const codeVerifier =
      typeof req.cookies?.[GOOGLE_PKCE_COOKIE] === "string"
        ? req.cookies[GOOGLE_PKCE_COOKIE]
        : undefined;
    clearShortLivedCookie(res, GOOGLE_STATE_COOKIE);
    clearShortLivedCookie(res, GOOGLE_PKCE_COOKIE);

    if (!code || !state || !expectedState || state !== expectedState) {
      safeRecordSecurityEvent({
        eventType: "AUTH_GOOGLE_FAILED",
        metadata: { reason: "state" },
      });
      return res.redirect(getGoogleFailureRedirect("state"));
    }

    try {
      // Missing verifier is accepted only for OAuth attempts that began before
      // PKCE was deployed. Newly-issued authorization requests always carry it.
      const profile = await exchangeGoogleCodeForProfile(code, codeVerifier);
      const user = await findOrCreateGoogleUser(profile);
      setSessionCookie(res, user.id, "google", user.authVersion);
      safeRecordSecurityEvent({
        eventType: "AUTH_GOOGLE_SUCCESS",
        actorUserId: user.id,
        subjectUserId: user.id,
      });
      return res.redirect(getGooglePostLoginRedirect());
    } catch (err: any) {
      console.error("Google auth error:", err);
      safeRecordSecurityEvent({
        eventType: "AUTH_GOOGLE_FAILED",
        metadata: { reason: "provider" },
      });
      return res.redirect(getGoogleFailureRedirect("failed"));
    }
  });

  app.post("/api/auth/register", requireTrustedOrigin, authRegisterIpLimit, async (req, res) => {
    try {
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
        trialEndsAt: trialEndsAt.toISOString(),
        usageResetAt: nextReset.toISOString(),
        aiTurnsUsedThisMonth: 0,
        bonusTurns: 0,
        onboardingComplete: false,
      } as any);

      setSessionCookie(res, user.id, "register", user.authVersion);
      safeRecordSecurityEvent({
        eventType: "AUTH_REGISTER_SUCCESS",
        actorUserId: user.id,
        subjectUserId: user.id,
      });
      return res.status(201).json({ user: toPublicUser(user) });
    } catch (err: any) {
      console.error("Register error:", err);
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("already exists") || msg.includes("unique")) {
        return res.status(409).json({ message: "An account with that email or username already exists." });
      }
      return res.status(500).json({ message: "Registration failed. Check Railway logs for the detailed database error." });
    }
  });

  app.post("/api/auth/login", requireTrustedOrigin, authLoginIpLimit, authLoginIdentityLimit, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;

    const user = storage.getUserByEmail(email);
    if (!user) {
      safeRecordSecurityEvent({
        eventType: "AUTH_LOGIN_FAILED",
        metadata: { reason: "credentials" },
      });
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      safeRecordSecurityEvent({
        eventType: "AUTH_LOGIN_FAILED",
        subjectUserId: user.id,
        metadata: { reason: "credentials" },
      });
      return res.status(401).json({ message: "Invalid email or password." });
    }

    setSessionCookie(res, user.id, "password", user.authVersion);
    safeRecordSecurityEvent({
      eventType: "AUTH_LOGIN_SUCCESS",
      actorUserId: user.id,
      subjectUserId: user.id,
    });
    return res.json({ user: toPublicUser(user) });
  });

  app.post("/api/auth/logout", requireTrustedOrigin, (req, res) => {
    const userId = req.user?.id ?? null;
    revokeRequestSession(req);
    clearSessionCookie(res);
    if (userId !== null) {
      safeRecordSecurityEvent({
        eventType: "AUTH_LOGOUT",
        actorUserId: userId,
        subjectUserId: userId,
      });
    }
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    return res.json({ user: toPublicUser(req.user!) });
  });

  app.get("/api/auth/sessions", requireAuth, (req, res) => {
    const currentToken = req.cookies?.[OPAQUE_COOKIE_NAME];
    const currentSession =
      typeof currentToken === "string"
        ? resolveOpaqueSession(currentToken, { touch: false })
        : null;

    const sessions = listActiveOpaqueSessionsForUser(req.user!.id).map((session) => ({
      id: session.id,
      authMethod: session.authMethod,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent,
      current: currentSession?.id === session.id,
    }));

    return res.json({ sessions });
  });

  app.delete(
    "/api/auth/sessions/:sessionId",
    requireAuth,
    requireTrustedOrigin,
    authSensitiveIpLimit,
    (req, res) => {
      const sessionId = Number(req.params.sessionId);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ message: "Invalid session id." });
      }

      const currentToken = req.cookies?.[OPAQUE_COOKIE_NAME];
      const currentSession =
        typeof currentToken === "string"
          ? resolveOpaqueSession(currentToken, { touch: false })
          : null;
      const isCurrent = currentSession?.id === sessionId;

      if (!revokeOpaqueSessionByIdForUser(req.user!.id, sessionId)) {
        return res.status(404).json({ message: "Session not found." });
      }

      if (isCurrent) {
        clearSessionCookie(res);
      }

      safeRecordSecurityEvent({
        eventType: "AUTH_SESSION_REVOKED",
        actorUserId: req.user!.id,
        subjectUserId: req.user!.id,
        metadata: { sessionId, current: isCurrent },
      });

      return res.json({ ok: true, signedOutCurrentSession: isCurrent });
    },
  );

  app.get("/api/admin/me", requirePermission(PERMISSIONS.ADMIN_ACCESS), (req, res) => {
    return res.json({ user: toPublicUser(req.user!) });
  });

  app.post("/api/admin/set-access-role", requirePermission(PERMISSIONS.ADMIN_ROLES_MANAGE), requireTrustedOrigin, authSensitiveIpLimit, (req, res) => {
    const parsed = accessRoleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const target =
      parsed.data.email
        ? storage.getUserByEmail(parsed.data.email)
        : storage.getUserByUsername(parsed.data.username!);

    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    if (target.id === req.user!.id && parsed.data.accessRole !== target.accessRole) {
      return res.status(400).json({
        message: "You cannot change your own access role.",
        code: "SELF_ROLE_CHANGE_NOT_ALLOWED",
      });
    }

    const updated = setAccessRole(target.id, parsed.data.accessRole);
    if (!updated) {
      return res.status(500).json({ message: "Failed to update access role." });
    }

    const changed = updated.accessRole !== target.accessRole;
    if (changed) {
      safeRecordSecurityEvent({
        eventType: "ACCESS_ROLE_CHANGED",
        actorUserId: req.user!.id,
        subjectUserId: target.id,
        metadata: {
          fromRole: target.accessRole,
          toRole: updated.accessRole,
        },
      });
    }

    return res.json({ user: toPublicUser(updated), changed });
  });

  app.post("/api/admin/set-entitlements", requirePermission(PERMISSIONS.ADMIN_ENTITLEMENTS_MANAGE), requireTrustedOrigin, authSensitiveIpLimit, (req, res) => {
    const parsed = explicitEntitlementUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const target =
      parsed.data.email
        ? storage.getUserByEmail(parsed.data.email)
        : storage.getUserByUsername(parsed.data.username!);

    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    const requestsChange =
      (parsed.data.subscriptionBypass !== undefined &&
        parsed.data.subscriptionBypass !== target.subscriptionBypass) ||
      (parsed.data.campaignLimitBypass !== undefined &&
        parsed.data.campaignLimitBypass !== target.campaignLimitBypass) ||
      (parsed.data.unlimitedAiTurns !== undefined &&
        parsed.data.unlimitedAiTurns !== target.unlimitedAiTurns);

    if (target.id === req.user!.id && requestsChange) {
      return res.status(400).json({
        message: "You cannot change your own entitlement overrides.",
        code: "SELF_ENTITLEMENT_CHANGE_NOT_ALLOWED",
      });
    }

    const updated = setExplicitEntitlements(target.id, {
      subscriptionBypass: parsed.data.subscriptionBypass,
      campaignLimitBypass: parsed.data.campaignLimitBypass,
      unlimitedAiTurns: parsed.data.unlimitedAiTurns,
    });

    if (!updated) {
      return res.status(500).json({ message: "Failed to update entitlement overrides." });
    }

    const changed =
      updated.subscriptionBypass !== target.subscriptionBypass ||
      updated.campaignLimitBypass !== target.campaignLimitBypass ||
      updated.unlimitedAiTurns !== target.unlimitedAiTurns;

    if (changed) {
      safeRecordSecurityEvent({
        eventType: "ENTITLEMENTS_CHANGED",
        actorUserId: req.user!.id,
        subjectUserId: target.id,
        metadata: {
          reasonCode: parsed.data.reasonCode,
          subscriptionBypassFrom: target.subscriptionBypass,
          subscriptionBypassTo: updated.subscriptionBypass,
          campaignLimitBypassFrom: target.campaignLimitBypass,
          campaignLimitBypassTo: updated.campaignLimitBypass,
          unlimitedAiTurnsFrom: target.unlimitedAiTurns,
          unlimitedAiTurnsTo: updated.unlimitedAiTurns,
        },
      });
    }

    return res.json({ user: toPublicUser(updated), changed });
  });

  app.post("/api/admin/grant-dungeon-master", requirePermission(PERMISSIONS.ADMIN_ROLES_MANAGE), requireTrustedOrigin, authSensitiveIpLimit, (req, res) => {
    const parsed = dungeonMasterTargetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const target =
      parsed.data.email
        ? storage.getUserByEmail(parsed.data.email)
        : storage.getUserByUsername(parsed.data.username!);

    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    const updated = grantDungeonMasterAccess(target.id);
    if (!updated) {
      return res.status(500).json({ message: "Failed to grant DungeonMaster access." });
    }

    const changed = updated.accessRole !== target.accessRole;
    if (changed) {
      safeRecordSecurityEvent({
        eventType: "DUNGEON_MASTER_GRANTED",
        actorUserId: req.user!.id,
        subjectUserId: target.id,
      });
    }
    return res.json({ user: toPublicUser(updated), changed });
  });

  app.post("/api/admin/revoke-dungeon-master", requirePermission(PERMISSIONS.ADMIN_ROLES_MANAGE), requireTrustedOrigin, authSensitiveIpLimit, (req, res) => {
    const parsed = dungeonMasterTargetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const target =
      parsed.data.email
        ? storage.getUserByEmail(parsed.data.email)
        : storage.getUserByUsername(parsed.data.username!);

    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    if (target.id === req.user!.id) {
      return res.status(400).json({ message: "You cannot revoke your own DungeonMaster access." });
    }

    const updated = revokeDungeonMasterAccess(target.id);
    if (!updated) {
      return res.status(500).json({ message: "Failed to revoke DungeonMaster access." });
    }

    const changed = updated.accessRole !== target.accessRole;
    if (changed) {
      safeRecordSecurityEvent({
        eventType: "DUNGEON_MASTER_REVOKED",
        actorUserId: req.user!.id,
        subjectUserId: target.id,
      });
    }
    return res.json({ user: toPublicUser(updated), changed });
  });

  app.post("/api/auth/complete-onboarding", requireAuth, requireTrustedOrigin, authSensitiveIpLimit, (req, res) => {
    storage.updateUser(req.user!.id, { onboardingComplete: true } as any);
    return res.json({ ok: true });
  });

  app.post("/api/auth/change-password", requireAuth, requireTrustedOrigin, authSensitiveIpLimit, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }
    const user = storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Current password is incorrect." });

    const passwordHash = await hashPassword(newPassword);
    const authVersion = updateUserPasswordAndBumpAuthVersion(user.id, passwordHash);
    if (authVersion === null) {
      return res.status(404).json({ message: "User not found." });
    }

    revokeAllOpaqueSessionsForUser(user.id);
    setSessionCookie(res, user.id, "password", authVersion);
    safeRecordSecurityEvent({
      eventType: "PASSWORD_CHANGED",
      actorUserId: user.id,
      subjectUserId: user.id,
    });
    return res.json({ ok: true });
  });

  app.post("/api/auth/forgot-password", requireTrustedOrigin, authRecoveryIpLimit, authRecoveryIdentityLimit, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    // V1 has no production mail transport yet. Fail truthfully before creating
    // a token instead of claiming a reset email was delivered when it was not.
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        message: "Password reset email is temporarily unavailable. Please contact DungeonMasterOS support.",
        code: "PASSWORD_RESET_EMAIL_UNAVAILABLE",
      });
    }

    const user = storage.getUserByEmail(email);
    if (!user) return res.json({ ok: true, message: "If that email exists, a reset link has been sent." });

    storage.deleteExpiredPasswordResetTokens();

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    storage.createPasswordResetToken(user.id, token, expiresAt);

    const response: any = { ok: true, message: "If that email exists, a reset link has been sent." };
    if (process.env.NODE_ENV !== "production") {
      response.devToken = token;
    }
    return res.json(response);
  });

  app.post("/api/auth/reset-password", requireTrustedOrigin, authResetIpLimit, async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const resetToken = storage.getPasswordResetToken(token);
    if (!resetToken) return res.status(400).json({ message: "Invalid or expired reset link." });
    if (resetToken.usedAt) return res.status(400).json({ message: "This reset link has already been used." });
    if (new Date() > new Date(resetToken.expiresAt)) {
      return res.status(400).json({ message: "This reset link has expired. Request a new one." });
    }

    const passwordHash = await hashPassword(newPassword);
    const authVersion = updateUserPasswordAndBumpAuthVersion(resetToken.userId, passwordHash);
    if (authVersion === null) {
      return res.status(400).json({ message: "Invalid or expired reset link." });
    }

    revokeAllOpaqueSessionsForUser(resetToken.userId);
    storage.markPasswordResetTokenUsed(resetToken.id);
    clearSessionCookie(res);
    safeRecordSecurityEvent({
      eventType: "PASSWORD_RESET",
      subjectUserId: resetToken.userId,
      metadata: { method: "reset-link" },
    });

    return res.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // USER / ACCOUNT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/achievements", requireAuth, (req, res) => {
    const achievements = storage.getUserAchievements(req.user!.id);
    return res.json(achievements);
  });

  app.get("/api/my-campaigns", requireAuth, (req, res) => {
    const campaigns = storage.getCampaignsAccessibleByUser(req.user!.id);
    return res.json(campaigns);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPAIGN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/campaigns", requireAuth, requireCanPlay, checkCampaignLimit, (req, res) => {
    const visitorId = getVisitorId(req);
    const parsed = createCampaignFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const inviteCode = randomBytes(4).toString("hex");
    const { currencies, ...campaignSettings } = parsed.data;
    const campaign = storage.createCampaignWithCurrencies({
      ...campaignSettings,
      inviteCode,
      hostVisitorId: visitorId,
      userId: req.user!.id,
      worldState: JSON.stringify({
        locations: [],
        npcs: [],
        factions: [],
        flags: [],
        currentScene: "",
      }),
    }, currencies);

    const unlockedIds = storage.getUnlockedAchievementIds(req.user!.id);
    tryUnlockAchievements(req.user!.id, campaign.id, null, {
      type: "campaign_create",
      campaign: {
        id: campaign.id,
        messageCount: 0,
        epicMode: campaign.epicMode,
        homebrewRules: campaign.homebrewRules,
        animeWorldSource: campaign.animeWorldSource,
        animeWorldMode: campaign.animeWorldMode,
      },
      unlockedIds,
    });

    return res.status(201).json(campaign);
  });

  app.get("/api/campaigns/invite/:code", requireAuth, (req, res) => {
    const campaign = storage.getCampaignByInviteCode(req.params.code);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    return res.json({ id: campaign.id, name: campaign.name });
  });

  app.post("/api/campaigns/join", requireAuth, requireCanPlay, (req, res) => {
    const inviteCode = typeof req.body?.inviteCode === "string" ? req.body.inviteCode.trim() : "";
    if (!inviteCode) return res.status(400).json({ message: "Invite code is required." });

    const campaign = storage.getCampaignByInviteCode(inviteCode);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    storage.addCampaignMember(campaign.id, req.user!.id);
    return res.json(campaign);
  });

  app.get("/api/campaigns/:id", requireAuth, requireCampaignAccess, (req, res) => {
    return res.json(storage.getCampaign(Number(req.params.id)));
  });

  app.patch("/api/campaigns/:id/archive", requireAuth, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== req.user!.id) return res.status(403).json({ message: "Not your campaign" });
    const { archive } = req.body;
    storage.updateCampaign(campaignId, { isArchived: !!archive });
    return res.json(storage.getCampaign(campaignId));
  });

  app.get("/api/campaigns/:id/snapshots", requireAuth, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== req.user!.id) {
      return res.status(403).json({ message: "Only the campaign owner can view recovery points." });
    }
    return res.json(storage.getCampaignSnapshots(campaignId));
  });

  app.post("/api/campaigns/:id/snapshots", requireAuth, requireCanPlay, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== req.user!.id) {
      return res.status(403).json({ message: "Only the campaign owner can create recovery points." });
    }

    const state = storage.buildCampaignSnapshot(campaignId);
    if (!state) return res.status(500).json({ message: "Could not build campaign recovery point." });
    const rawLabel = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    const snapshot = storage.createCampaignSnapshot({
      campaignId,
      label: (rawLabel || "Manual Save Point").slice(0, 120),
      reason: "manual",
      snapshotData: JSON.stringify(state),
    });
    return res.status(201).json(snapshot);
  });

  app.post("/api/campaigns/:id/restore/:snapshotId", requireAuth, requireCanPlay, (req, res) => {
    const campaignId = Number(req.params.id);
    const snapshotId = Number(req.params.snapshotId);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== req.user!.id) {
      return res.status(403).json({ message: "Only the campaign owner can restore a recovery point." });
    }

    const snapshot = storage.getCampaignSnapshot(snapshotId);
    if (!snapshot || snapshot.campaignId !== campaignId) {
      return res.status(404).json({ message: "Recovery point not found for this campaign." });
    }

    const restored = storage.restoreCampaignSnapshot(snapshotId);
    if (!restored) {
      return res.status(500).json({ message: "Campaign recovery failed without changing the saved recovery point." });
    }

    broadcastToCampaign(campaignId, { type: "campaign_restored", campaignId, snapshotId });
    return res.json(restored);
  });

  app.patch("/api/campaigns/:id", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.hostVisitorId !== visitorId && campaign.userId !== req.user?.id) {
      return res.status(403).json({ message: "Only the host can change campaign settings" });
    }

    const allowed = [
      "storyMode", "epicMode", "tone", "combatStyle", "rulesWeight",
      "powerLevel", "worldGenStyle", "animeWorldSource", "animeWorldMode", "name",
    ];
    const updates: any = {};
    for (const key of allowed) {
      if ((req.body as any)[key] !== undefined) updates[key] = (req.body as any)[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }
    storage.updateCampaign(campaignId, updates);
    const updated = storage.getCampaign(campaignId);
    broadcastToCampaign(campaignId, { type: "campaign_updated", campaign: updated });

    if (req.user) {
      const unlockedIds = storage.getUnlockedAchievementIds(req.user.id);
      tryUnlockAchievements(req.user.id, campaignId, null, {
        type: "settings_change",
        campaign: {
          id: campaignId,
          messageCount: storage.countMessagesByCampaign(campaignId),
          epicMode: updated?.epicMode ?? false,
          homebrewRules: updated?.homebrewRules ?? "",
          animeWorldSource: updated?.animeWorldSource ?? "",
          animeWorldMode: updated?.animeWorldMode ?? "",
        },
        unlockedIds,
      });
    }

    return res.json(updated);
  });

  app.get("/api/campaigns/:id/currencies", requireAuth, requireCampaignAccess, (req, res) => {
    return res.json(storage.getCampaignCurrencies(Number(req.params.id)));
  });

  app.get("/api/campaigns/:id/shop", requireAuth, requireCampaignAccess, (req, res) => {
    const campaignId = Number(req.params.id);
    const shop = storage.getActiveShopByCampaign(campaignId);
    if (!shop) return res.json({ shop: null, items: [] });
    return res.json({ shop, items: storage.getShopItemsByShop(shop.id) });
  });

  app.post("/api/campaigns/:id/shop/open", requireAuth, requireCanPlay, requireCampaignAccess, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== req.user!.id) {
      return res.status(403).json({ message: "Only the campaign owner can open a shop." });
    }

    const merchantName = typeof req.body?.merchantName === "string" ? req.body.merchantName.trim() : "";
    const merchantDescription = typeof req.body?.merchantDescription === "string" ? req.body.merchantDescription.trim() : "";
    const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : "Merchant Stock";
    const requestedCurrency = typeof req.body?.currencyCode === "string" ? req.body.currencyCode.trim() : "";
    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!merchantName) return res.status(400).json({ message: "merchantName is required." });
    if (!requestedCurrency) return res.status(400).json({ message: "currencyCode is required." });

    const currencies = storage.getCampaignCurrencies(campaignId);
    const currencyByCode = new Map(currencies.map((currency) => [currency.code.toLowerCase(), currency.code]));
    const currencyCode = currencyByCode.get(requestedCurrency.toLowerCase());
    if (!currencyCode) return res.status(400).json({ message: "Shop currency is not defined for this campaign." });

    const stock = [];
    for (const candidate of requestedItems) {
      const parsed = createShopItemSchema.safeParse(candidate);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
      }
      const priceCurrencyCode = currencyByCode.get(parsed.data.priceCurrencyCode.toLowerCase());
      if (!priceCurrencyCode) {
        return res.status(400).json({ message: `Unknown campaign currency: ${parsed.data.priceCurrencyCode}` });
      }
      stock.push({
        itemKey: parsed.data.itemKey,
        name: parsed.data.name,
        description: parsed.data.description,
        itemType: parsed.data.itemType,
        quantityPerPurchase: parsed.data.quantityPerPurchase,
        stock: parsed.data.stock,
        priceAmount: parsed.data.priceAmount,
        priceCurrencyCode,
        metadata: JSON.stringify(parsed.data.metadata || {}),
      });
    }

    const opened = storage.openShop({
      campaignId,
      merchantName,
      merchantDescription,
      currencyCode,
      title,
      isOpen: true,
      metadata: "{}",
    }, stock);

    broadcastToCampaign(campaignId, { type: "shop_updated", shopId: opened.shop.id });
    return res.status(201).json(opened);
  });

  app.post("/api/campaigns/:id/shop/close", requireAuth, requireCanPlay, requireCampaignAccess, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== req.user!.id) {
      return res.status(403).json({ message: "Only the campaign owner can close a shop." });
    }
    const shop = storage.getActiveShopByCampaign(campaignId);
    if (shop) {
      storage.closeActiveShop(shop.id);
      broadcastToCampaign(campaignId, { type: "shop_closed", shopId: shop.id });
    }
    return res.json({ ok: true });
  });

  app.post("/api/campaigns/:id/shop/buy", requireAuth, requireCanPlay, requireCampaignAccess, (req, res) => {
    const campaignId = Number(req.params.id);
    const character = storage.getCharacterByVisitor(campaignId, getVisitorId(req));
    if (!character) return res.status(403).json({ message: "You do not have a character in this campaign." });

    const parsed = buyShopItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const shopItem = storage.getShopItem(parsed.data.shopItemId);
    const result = storage.purchaseShopItem(campaignId, character.id, parsed.data.shopItemId, parsed.data.quantity);
    if (!result.ok) {
      if (result.reason === "stock") return res.status(400).json({ message: "The vendor does not have enough stock." });
      if (result.reason === "funds") return res.status(400).json({ message: "Not enough currency." });
      return res.status(404).json({ message: "Shop item not found." });
    }

    if (shopItem) {
      const totalCost = shopItem.priceAmount * parsed.data.quantity;
      const systemMessage = storage.createMessage({
        campaignId,
        sender: "System",
        senderType: "system",
        content: `${character.name} buys ${parsed.data.quantity} × ${shopItem.name} for ${totalCost} ${shopItem.priceCurrencyCode}.`,
        messageType: "system",
      });
      broadcastToCampaign(campaignId, { type: "message", message: systemMessage });
    }

    broadcastToCampaign(campaignId, { type: "shop_updated" });
    broadcastToCampaign(campaignId, { type: "items_updated", characterId: character.id });
    broadcastToCampaign(campaignId, { type: "currencies_updated", characterId: character.id });

    return res.json({ ok: true, remainingStock: result.remainingStock, wallet: result.wallet });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHARACTER ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/campaigns/:id/characters", requireAuth, requireCampaignAccess, (req, res) => {
    const visitorId = getVisitorId(req);
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const existing = storage.getCharacterByVisitor(campaignId, visitorId);
    if (existing) {
      return res.status(409).json({ message: "You already have a character in this campaign", character: existing });
    }

    const parsed = createCharacterFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const level = Math.min(Math.max(Number(req.body.level) || 1, 1), 99);
    const maxHp = Number(req.body.maxHp) || 20;
    const hp = Math.min(Number(req.body.hp) || maxHp, maxHp);
    const characterData = req.body.characterData || JSON.stringify({ sections: [], raw: "" });

    const character = storage.createCharacter({
      ...parsed.data,
      campaignId,
      visitorId,
      userId: req.user?.id || null,
      level,
      hp,
      maxHp,
      status: "alive",
      inventory: "[]",
      characterData,
    } as any);

    const campaignCurrencies = storage.getCampaignCurrencies(campaignId);
    storage.replaceCharacterCurrencies(
      campaignId,
      character.id,
      campaignCurrencies.map((currency) => ({ currencyCode: currency.code, amount: 0 })),
    );

    broadcastToCampaign(campaignId, { type: "character_joined", character });

    const joinMsg = storage.createMessage({
      campaignId,
      sender: "System",
      senderType: "system",
      content: `${character.name} the ${character.race} ${character.charClass} has joined the party.`,
      messageType: "system",
    });
    broadcastToCampaign(campaignId, { type: "message", message: joinMsg });

    return res.status(201).json(character);
  });

  app.post("/api/parse-character", requireAuth, requireCanPlay, async (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return res.status(400).json({ message: "Please provide character text to parse" });
    }

    const SYSTEM_PROMPT = `You are a character sheet extractor for a narrative RPG system that supports ANY game system, genre, or style: D&D 5e, Pathfinder, Call of Cthulhu, FATE, Powered by the Apocalypse, custom homebrew, isekai protagonists, modern-day characters transferred to fantasy worlds, cinematic characters with no formal stats, cyberpunk, historical fiction, anime-style power systems, original IP — anything.

Your job is to extract ALL information from the provided text WITHOUT normalising, discarding, or reinterpreting data to fit D&D assumptions. Preserve the source system's vocabulary faithfully.

IMPORTANT: The input may contain emoji, special symbols, unicode characters, and complex formatting. Ignore decorative emoji (used as section headers like 📜 🧠 ❤️ 🎤 etc) — treat them as section dividers only. Extract the TEXT content beneath them.

Return ONLY a valid JSON object. Every string value must be properly JSON-escaped. Do NOT include the original raw text anywhere in your response — only extracted structured data.

JSON structure (all fields required):

{
  "name": "character name",
  "displayRace": "species/race/origin as stated — preserve exact wording",
  "displayClass": "class/role/archetype as stated — preserve exact wording, e.g. 'Rogue/All Classes Mastered'",
  "level": <integer 1-99, or null if not applicable or transcendent>,
  "hp": <integer for current HP, or null if HP is Infinite/non-numeric or system uses non-HP health>,
  "maxHp": <integer for max HP, or null if same as above>,
  "backstory": "character history and origin as a clean plain-text string",
  "traits": "personality, ideals, bonds, flaws, notable behaviours as a clean plain-text string",
  "sections": [
    {
      "label": "section name using source terminology",
      "entries": [
        { "key": "property name", "value": "property value as plain text string" }
      ]
    }
  ]
}

Section rules:
- Use the source text's OWN section names and terminology
- Emoji used as section headers (e.g. ❤️ Vital Systems, 🧩 Core Abilities) become the section label WITHOUT the emoji
- Do NOT force D&D terminology onto non-D&D content
- Do NOT convert custom resources (Mana, Stress, Ki, Anima, Momentum) into HP or spell slots
- Each ability, power, skill, item, relationship = one entry with a key and value
- For list-style abilities (bullet points under a heading), each bullet = one entry where key=ability name, value=description
- For Infinite/unlimited resources, keep the value as the string "Infinite" or as stated
- hp/maxHp: null if HP is Infinite, narrative-only, or the system uses non-HP health (put that in sections instead)

NEVER refuse. Always extract everything. Keep all values as short plain-text strings — no nested objects.
Return ONLY the JSON object. No explanation. No markdown fences. No raw source text in the output.`.trim();

    try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: text.trim() }],
      });

      const rawOutput = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      let cleaned = rawOutput.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/m, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (jsonErr: any) {
        const errPos = parseInt(jsonErr.message.match(/position (\d+)/)?.[1] ?? "0");
        const truncated = cleaned.slice(0, errPos);
        const lastCompleteSection = truncated.lastIndexOf("},{");
        const lastCompleteEntry = truncated.lastIndexOf("},\n    {");
        const cutPoint = Math.max(lastCompleteSection, lastCompleteEntry);

        if (cutPoint > 100) {
          const salvaged = truncated.slice(0, cutPoint) + "}]}}";
          try {
            parsed = JSON.parse(salvaged);
          } catch {
            const nameMatch = cleaned.match(/"name"\s*:\s*"([^"]+)"/);
            const raceMatch = cleaned.match(/"displayRace"\s*:\s*"([^"]+)"/);
            const classMatch = cleaned.match(/"displayClass"\s*:\s*"([^"]+)"/);
            parsed = {
              name: nameMatch?.[1] || "Unknown",
              displayRace: raceMatch?.[1] || "Unknown",
              displayClass: classMatch?.[1] || "Unknown",
              level: null,
              hp: null,
              maxHp: null,
              backstory: "",
              traits: "",
              sections: [],
            };
          }
        } else {
          throw jsonErr;
        }
      }

      if (!Array.isArray(parsed.sections)) parsed.sections = [];

      const characterData = {
        sections: parsed.sections,
        raw: text.trim(),
      };

      return res.json({
        name: parsed.name || "Unknown",
        race: parsed.displayRace || "Unknown",
        charClass: parsed.displayClass || "Unknown",
        traits: parsed.traits || "",
        backstory: parsed.backstory || "",
        level: parsed.level ?? null,
        hp: parsed.hp ?? null,
        maxHp: parsed.maxHp ?? null,
        characterData: JSON.stringify(characterData),
      });
    } catch (err: any) {
      console.error("Character parse error:", err.message);
      return res.status(422).json({
        message: "Could not parse this character sheet. Please try again or paste a simpler version.",
      });
    }
  });

  app.get("/api/campaigns/:id/characters", requireAuth, requireCampaignAccess, (req, res) => {
    return res.json(storage.getCharactersByCampaign(Number(req.params.id)));
  });

  app.get("/api/campaigns/:id/my-character", requireAuth, requireCampaignAccess, (req, res) => {
    const visitorId = getVisitorId(req);
    const char = storage.getCharacterByVisitor(Number(req.params.id), visitorId);
    if (!char) return res.status(404).json({ message: "No character found" });
    return res.json(char);
  });

  app.patch("/api/characters/:id/spell-data", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.id);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });
    const { characterData } = req.body;
    if (typeof characterData !== "string") return res.status(400).json({ message: "Invalid characterData" });
    storage.updateCharacter(characterId, { characterData } as any);
    broadcastToCampaign(character.campaignId, { type: "character_updated", characterId });
    return res.json({ ok: true });
  });

  app.patch("/api/characters/:id/hp", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.id);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });
    const hp = Number(req.body.hp);
    if (isNaN(hp)) return res.status(400).json({ message: "Invalid HP" });
    const clamped = Math.max(0, Math.min(character.maxHp, hp));
    storage.updateCharacter(characterId, { hp: clamped });
    broadcastToCampaign(character.campaignId, { type: "character_updated", characterId });
    return res.json({ hp: clamped });
  });

  app.get("/api/characters/:characterId/currencies", requireAuth, requireCharacterDetailAccess, (req, res) => {
    return res.json(storage.getCharacterCurrencies(Number(req.params.characterId)));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ITEM ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/characters/:characterId/items", requireAuth, requireCharacterDetailAccess, (req, res) => {
    return res.json(storage.getItemsByCharacter(Number(req.params.characterId)));
  });

  app.post("/api/characters/:characterId/items", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });

    const {
      name, trueName = "", description = "", trueDescription = "",
      itemType = "gear", quantity = 1, charges = null, maxCharges = null,
      identified = true, consumable = false, equipped = false, locationNote = "",
      statMods = "[]",
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Item name is required" });

    const item = storage.createItem({
      campaignId: character.campaignId,
      characterId,
      name: name.trim(),
      trueName, description, trueDescription,
      itemType, quantity, charges, maxCharges,
      identified, consumable, equipped, locationNote,
      source: "manual",
      statMods: typeof statMods === "string" ? statMods : JSON.stringify(statMods),
    });

    broadcastToCampaign(character.campaignId, { type: "items_updated", characterId });
    return res.status(201).json(item);
  });

  app.patch("/api/items/:id", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const itemId = Number(req.params.id);
    const item = storage.getItem(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const character = storage.getCharacter(item.characterId);
    if (!character || character.visitorId !== visitorId) {
      return res.status(403).json({ message: "Not your item" });
    }

    const allowed = [
      "name", "description", "itemType", "quantity", "charges",
      "identified", "consumable", "equipped", "locationNote", "trueName", "trueDescription", "statMods",
    ];
    const updates: any = {};
    for (const key of allowed) {
      if ((req.body as any)[key] !== undefined) updates[key] = (req.body as any)[key];
    }

    storage.updateItem(itemId, updates);
    broadcastToCampaign(item.campaignId, { type: "items_updated", characterId: item.characterId });
    return res.json(storage.getItem(itemId));
  });

  app.post("/api/items/:id/use", requireAuth, requireCanPlay, async (req, res) => {
    const visitorId = getVisitorId(req);
    const itemId = Number(req.params.id);
    const item = storage.getItem(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const character = storage.getCharacter(item.characterId);
    if (!character || character.visitorId !== visitorId) {
      return res.status(403).json({ message: "Not your item" });
    }

    const campaign = storage.getCampaign(item.campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const turnClaim = claimTurn(req.user!);
    if (!turnClaim.ok) {
      return res.status(403).json(turnClaim.body);
    }

    const displayName = item.identified ? item.name : `${item.name} (Unidentified)`;
    const useAction = req.body.customAction || `${character.name} uses ${displayName}.`;

    const playerMsg = storage.createMessage({
      campaignId: item.campaignId,
      sender: character.name,
      senderType: "player",
      content: useAction,
      messageType: "action",
    });
    broadcastToCampaign(item.campaignId, { type: "message", message: playerMsg });

    let remaining: any = item;

    try {
      broadcastToCampaign(item.campaignId, { type: "dm_thinking", thinking: true });
      const history = storage.getMessagesByCampaign(item.campaignId);
      const chars = storage.getCharactersByCampaign(item.campaignId);
      const currencies = storage.getCampaignCurrencies(item.campaignId);

      const rawResponse = await generateDMResponse(
        campaign,
        chars,
        history,
        useAction,
        character.name,
        currencies,
      );
      const { cleanContent, worldState } = extractWorldState(rawResponse);
      const shopProjection = projectShopFromNarration(item.campaignId, cleanContent);

      if (worldState) {
        try {
          const current = JSON.parse(campaign.worldState || "{}");
          storage.updateWorldState(item.campaignId, JSON.stringify({ ...current, ...worldState }));
        } catch {}
      }

      const finalContent = shopProjection.cleanContent || buildFallbackActionResponse(character.name, useAction);
      const stateProjection = await extractStateProjectionFromNarration(finalContent, item.campaignId);
      const projected = applyNarrationProjection(item.campaignId, character.id, stateProjection);
      if (projected.abilitiesAdded.length && req.user) {
        const unlockedIds = storage.getUnlockedAchievementIds(req.user.id);
        tryUnlockAchievements(req.user.id, item.campaignId, character.id, {
          type: "ability_granted",
          unlockedIds,
        });
      }

      const dmMsg = storage.createMessage({
        campaignId: item.campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: finalContent,
        messageType: "narration",
      });

      if (item.consumable) {
        remaining = storage.decrementItem(itemId);
        broadcastToCampaign(item.campaignId, { type: "items_updated", characterId: item.characterId });
      }

      broadcastToCampaign(item.campaignId, { type: "dm_thinking", thinking: false });
      broadcastToCampaign(item.campaignId, { type: "message", message: dmMsg });
      if (shopProjection.shopId) {
        broadcastToCampaign(item.campaignId, { type: "shop_updated", shopId: shopProjection.shopId });
      }


    } catch (err) {
      broadcastToCampaign(item.campaignId, { type: "dm_thinking", thinking: false });
      releaseTurnClaim(req.user!.id, turnClaim.claim);
      console.error("DM item-use error:", err);

      const aiIssue = getAIServiceIssue(err);
      const message = storage.createMessage({
        campaignId: item.campaignId,
        sender: aiIssue ? "System" : "Dungeon Master",
        senderType: aiIssue ? "system" : "dm",
        content: aiIssue ? buildAIUnavailableSystemMessage("item", aiIssue) : buildFallbackActionResponse(character.name, useAction),
        messageType: aiIssue ? "system" : "narration",
      });
      broadcastToCampaign(item.campaignId, { type: "message", message });
    }

    return res.json({ used: displayName, remaining });
  });

  app.post("/api/items/:id/identify", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const itemId = Number(req.params.id);
    const item = storage.getItem(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const character = storage.getCharacter(item.characterId);
    if (!character || character.visitorId !== visitorId) {
      return res.status(403).json({ message: "Not your item" });
    }

    const updates: any = { identified: true };
    if (item.trueName) updates.name = item.trueName;
    if (item.trueDescription) updates.description = item.trueDescription;

    storage.updateItem(itemId, updates);
    broadcastToCampaign(item.campaignId, { type: "items_updated", characterId: item.characterId });
    return res.json(storage.getItem(itemId));
  });

  app.delete("/api/items/:id", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const itemId = Number(req.params.id);
    const item = storage.getItem(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const character = storage.getCharacter(item.characterId);
    if (!character || character.visitorId !== visitorId) {
      return res.status(403).json({ message: "Not your item" });
    }

    storage.deleteItem(itemId);
    broadcastToCampaign(item.campaignId, { type: "items_updated", characterId: item.characterId });
    return res.json({ deleted: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVE EFFECTS ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/characters/:characterId/effects", requireAuth, requireCharacterDetailAccess, (req, res) => {
    return res.json(storage.getActiveEffectsByCharacter(Number(req.params.characterId)));
  });

  app.post("/api/characters/:characterId/effects", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });

    const {
      name, source = "", icon = "", isDebuff = false,
      durationType = "rounds", totalDuration = null, roundsRemaining = null,
      concentration = false, statMods = "[]", description = "",
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Effect name required" });

    let droppedConcentration = null;
    if (concentration) {
      droppedConcentration = storage.removeConcentration(characterId);
    }

    const effect = storage.createActiveEffect({
      campaignId: character.campaignId,
      characterId,
      name: name.trim(),
      source, icon, isDebuff,
      durationType,
      totalDuration,
      roundsRemaining: durationType === "rounds" ? (roundsRemaining ?? totalDuration) : null,
      concentration,
      statMods: typeof statMods === "string" ? statMods : JSON.stringify(statMods),
      description,
      appliedBy: "manual",
    });

    broadcastToCampaign(character.campaignId, {
      type: "effects_updated",
      characterId,
      newEffect: effect,
      droppedConcentration,
    });

    return res.status(201).json({ effect, droppedConcentration });
  });

  app.delete("/api/effects/:id", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const effectId = Number(req.params.id);
    const effect = storage.getActiveEffect(effectId);
    if (!effect) return res.status(404).json({ message: "Effect not found" });
    const character = storage.getCharacter(effect.characterId);
    if (!character || character.visitorId !== visitorId) {
      return res.status(403).json({ message: "Not your character" });
    }
    storage.deleteActiveEffect(effectId);
    broadcastToCampaign(effect.campaignId, { type: "effects_updated", characterId: effect.characterId });
    return res.json({ deleted: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGE / GAME ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/campaigns/:id/messages", requireAuth, requireCampaignAccess, (req, res) => {
    return res.json(storage.getMessagesByCampaign(Number(req.params.id)));
  });

  app.post("/api/campaigns/:id/action", requireAuth, requireCanPlay, requireCampaignAccess, async (req, res) => {
    const visitorId = getVisitorId(req);
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return res.status(403).json({ message: "You don't have a character in this campaign" });

    // Accept several possible payload shapes so the frontend cannot fail over something this stupid.
    const rawContent = getActionContent(req.body);
    if (!rawContent) {
      const parsed = playerActionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
      }
    }

    const content = rawContent || (req.body?.content ?? "").trim();
    if (!content) {
      return res.status(400).json({ message: "Action content is required" });
    }

    const turnClaim = claimTurn(req.user!);
    if (!turnClaim.ok) {
      return res.status(403).json(turnClaim.body);
    }

    const playerMsg = storage.createMessage({
      campaignId,
      sender: character.name,
      senderType: "player",
      content,
      messageType: "action",
    });
    broadcastToCampaign(campaignId, { type: "message", message: playerMsg });

    try {
      const history = storage.getMessagesByCampaign(campaignId);
      const chars = storage.getCharactersByCampaign(campaignId);

      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: true });

      const currencies = storage.getCampaignCurrencies(campaignId);
      const rawResponse = await generateDMResponse(
        campaign,
        chars,
        history,
        content,
        character.name,
        currencies,
      );

      const { cleanContent, worldState } = extractWorldState(rawResponse);
      const shopProjection = projectShopFromNarration(campaignId, cleanContent);

      if (worldState) {
        try {
          const current = JSON.parse(campaign.worldState || "{}");
          const merged = {
            locations: [...new Set([...(current.locations || []), ...(worldState.locations || [])])],
            npcs: [...(current.npcs || []), ...(worldState.npcs || [])].reduce((acc: any[], npc: any) => {
              if (!acc.find((n: any) => n.name === npc.name)) acc.push(npc);
              return acc;
            }, []),
            factions: [...new Set([...(current.factions || []), ...(worldState.factions || [])])],
            flags: [...new Set([...(current.flags || []), ...(worldState.flags || [])])],
            currentScene: worldState.currentScene || current.currentScene,
          };
          storage.updateWorldState(campaignId, JSON.stringify(merged));
        } catch {}
      }

      const finalContent = shopProjection.cleanContent || buildFallbackActionResponse(character.name, content);

      const dmMsg = storage.createMessage({
        campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: finalContent,
        messageType: "narration",
      });

      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      broadcastToCampaign(campaignId, { type: "message", message: dmMsg });
      if (shopProjection.shopId) {
        broadcastToCampaign(campaignId, { type: "shop_updated", shopId: shopProjection.shopId });
      }

      const stateProjection = await extractStateProjectionFromNarration(finalContent, campaignId);
      const projected = applyNarrationProjection(campaignId, character.id, stateProjection);

      if (projected.abilitiesAdded.length && req.user) {
        const unlockedIds = storage.getUnlockedAchievementIds(req.user.id);
        tryUnlockAchievements(req.user.id, campaignId, character.id, {
          type: "ability_granted",
          unlockedIds,
        });
      }

      const expired = storage.tickEffects(character.id);
      if (expired.length > 0) {
        broadcastToCampaign(campaignId, {
          type: "effects_updated",
          characterId: character.id,
          expired: expired.map((effect) => ({ id: effect.id, name: effect.name })),
        });
        for (const effect of expired) {
          const expiryMessage = storage.createMessage({
            campaignId,
            sender: "System",
            senderType: "system",
            content: `${character.name}'s **${effect.name}** has expired.`,
            messageType: "system",
          });
          broadcastToCampaign(campaignId, { type: "message", message: expiryMessage });
        }
      }

      if (req.user) {
        const freshCharacter = storage.getCharacter(character.id);
        const unlockedIds = storage.getUnlockedAchievementIds(req.user.id);
        const dmFlags = scanDMResponseForAchievements(finalContent, {
          hp: freshCharacter?.hp ?? character.hp,
          maxHp: freshCharacter?.maxHp ?? character.maxHp,
        });
        tryUnlockAchievements(req.user.id, campaignId, character.id, {
          type: "dm_response",
          dm: dmFlags,
          campaign: {
            id: campaignId,
            messageCount: storage.countMessagesByCampaign(campaignId),
            epicMode: campaign.epicMode,
            homebrewRules: campaign.homebrewRules,
            animeWorldSource: campaign.animeWorldSource,
            animeWorldMode: campaign.animeWorldMode,
          },
          unlockedIds,
        });
      }

      return res.json({ playerMessage: playerMsg, dmMessage: dmMsg });
    } catch (error: any) {
      releaseTurnClaim(req.user!.id, turnClaim.claim);
      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      console.error("DM Engine error:", error);

      const aiIssue = getAIServiceIssue(error);
      const dmMsg = storage.createMessage({
        campaignId,
        sender: aiIssue ? "System" : "Dungeon Master",
        senderType: aiIssue ? "system" : "dm",
        content: aiIssue ? buildAIUnavailableSystemMessage("action", aiIssue) : buildFallbackActionResponse(character.name, content),
        messageType: aiIssue ? "system" : "narration",
      });

      broadcastToCampaign(campaignId, { type: "message", message: dmMsg });

      return res.json({
        playerMessage: playerMsg,
        dmMessage: dmMsg,
        fallback: !aiIssue,
        aiUnavailable: !!aiIssue,
      });
    }
  });

  app.post("/api/campaigns/:id/start", requireAuth, requireCanPlay, requireCampaignAccess, async (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const chars = storage.getCharactersByCampaign(campaignId);
    if (chars.length === 0) return res.status(400).json({ message: "Need at least one character to start" });

    const turnClaim = claimTurn(req.user!);
    if (!turnClaim.ok) {
      return res.status(403).json(turnClaim.body);
    }

    try {
      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: true });

      const currencies = storage.getCampaignCurrencies(campaignId);
      const rawResponse = await generateOpeningScene(campaign, chars, currencies);
      const { cleanContent, worldState } = extractWorldState(rawResponse);
      const shopProjection = projectShopFromNarration(campaignId, cleanContent);

      if (worldState) {
        storage.updateWorldState(campaignId, JSON.stringify(worldState));
      }

      const finalContent = shopProjection.cleanContent || buildFallbackOpeningScene(campaign.name, chars);

      const dmMsg = storage.createMessage({
        campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: finalContent,
        messageType: "narration",
      });

      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      broadcastToCampaign(campaignId, { type: "message", message: dmMsg });
      broadcastToCampaign(campaignId, { type: "campaign_started" });
      if (shopProjection.shopId) {
        broadcastToCampaign(campaignId, { type: "shop_updated", shopId: shopProjection.shopId });
      }

      return res.json({ message: dmMsg });
    } catch (error: any) {
      releaseTurnClaim(req.user!.id, turnClaim.claim);
      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      console.error("Opening scene error:", error);

      const aiIssue = getAIServiceIssue(error);
      const dmMsg = storage.createMessage({
        campaignId,
        sender: aiIssue ? "System" : "Dungeon Master",
        senderType: aiIssue ? "system" : "dm",
        content: aiIssue ? buildAIUnavailableSystemMessage("start", aiIssue) : buildFallbackOpeningScene(campaign.name, chars),
        messageType: aiIssue ? "system" : "narration",
      });

      broadcastToCampaign(campaignId, { type: "message", message: dmMsg });
      if (!aiIssue) {
        broadcastToCampaign(campaignId, { type: "campaign_started" });
      }

      return res.json({ message: dmMsg, fallback: !aiIssue, aiUnavailable: !!aiIssue });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBSOCKET
  // ═══════════════════════════════════════════════════════════════════════════

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname !== "/ws") return;

    const userId = getWebSocketUserId(request.headers.cookie);
    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      (ws as any)._userId = userId;
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    let subscribedCampaignId: number | null = null;
    const userId = Number((ws as any)._userId);

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === "subscribe" && data.campaignId) {
          const nextCampaignId = Number(data.campaignId);
          if (!Number.isInteger(nextCampaignId) || nextCampaignId <= 0) {
            ws.close(1008, "Invalid campaign subscription");
            return;
          }
          if (!userCanAccessCampaign(userId, nextCampaignId)) {
            ws.close(1008, "Forbidden campaign subscription");
            return;
          }
          if (subscribedCampaignId !== null) {
            campaignClients.get(subscribedCampaignId)?.delete(ws);
          }
          subscribedCampaignId = nextCampaignId;
          if (!campaignClients.has(nextCampaignId)) {
            campaignClients.set(nextCampaignId, new Set());
          }
          campaignClients.get(nextCampaignId)!.add(ws);
          ws.send(JSON.stringify({ type: "subscribed", campaignId: subscribedCampaignId }));
        }
      } catch {
        ws.close(1008, "Invalid WebSocket message");
      }
    });

    ws.on("close", () => {
      if (subscribedCampaignId !== null) {
        const clients = campaignClients.get(subscribedCampaignId);
        clients?.delete(ws);
        if (clients?.size === 0) campaignClients.delete(subscribedCampaignId);
      }
    });
  });

  return httpServer;
}
