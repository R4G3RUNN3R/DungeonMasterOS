import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import {
  createEmptyWorldState,
  generateCampaignMemoryUpdate,
  mergeCampaignWorldState,
  parseCampaignWorldState,
  formatCurrentSceneForPrompt,
} from "./campaign-memory";
import { generateDMResponse, generateOpeningScene, extractWorldState, generateNpcTurnAction, buildCombatContext, type PartyInventorySnapshot } from "./dm-engine";
import { getNarrationServiceIssue, getNarrationServiceLabel, generateNarrationText, DM_AI_PROVIDER } from "./dm-provider";
import { hashSnapshot, logAiContextSnapshot, logAiMutations, type AiGenerationPurpose } from "./ai-diagnostics";
import { runDataIntegrityChecks } from "./integrity-checks";
import { stripInternalTags } from "./internal-tag-guard";

// Bump this whenever buildSystemPrompt's structure changes in a way that
// matters for diagnosing a past generation (new grounding section, new tag,
// etc.) — see server/dm-engine.ts's buildSystemPrompt.
const DM_PROMPT_VERSION = "v2-authoritative-inventory";
import { resolveCheckTag } from "./mechanics-resolver";
import { fleeEncounter, applyNpcSurrender, resolveAttack, executeAttack, startEncounter, type AttackResolution } from "./combat-engine";
import { computeFullCharacterSheet } from "./character-stats";
import { classesForRuleset } from "@shared/classes";
import { getRace } from "@shared/races";
import { levelForXp, isAsiLevel, computeLevelUp } from "./leveling";
import { processTitleTags } from "./titles";
import { advanceAndResolveTurns } from "./npc-turn";
import { withCampaignLock } from "./action-mutex";
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleCodeForProfile,
  getGoogleFailureRedirect,
  generateGoogleUsernameBase,
  getGooglePostLoginRedirect,
  isGoogleAuthConfigured,
  type GoogleProfile,
} from "./google-auth";
import type { Campaign, Character } from "@shared/schema";
import {
  createCampaignFormSchema,
  createCharacterFormSchema,
  createShopItemSchema,
  buyShopItemSchema,
  adjustCurrencySchema,
  playerActionSchema,
  registerSchema,
  loginSchema,
  dungeonMasterTargetSchema,
} from "@shared/schema";
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  attachUser,
  requireAuth,
  requireDungeonMaster,
  requireCanPlay,
  checkCampaignLimit,
  checkTurnLimit,
  incrementTurnCount,
  grantDungeonMasterAccess,
  revokeDungeonMasterAccess,
  toPublicUser,
} from "./auth";
import { randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import { TIERS, SQUIRE_PASS, getEffectiveLimits, getIncludedTurns, getNextUsageResetAt, getNewUserBillingState, isPurchasableSubscriptionTier, type BillingInterval, type TierName, type SubscriptionStatus } from "../shared/tiers";
import { ACHIEVEMENT_MAP, checkAchievements, scanDMResponseForAchievements } from "../shared/achievements";

// ── Clients ────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const GOOGLE_STATE_COOKIE = "dmos_google_oauth_state";

let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

const SUPPORT_EMAIL = "admin@voidsmithindustries.com";
const MAIL_FROM = process.env.MAIL_FROM || "DungeonMasterOS <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email send:", subject);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [to],
        subject,
        text,
      }),
    });

    if (!res.ok) {
      console.error("Resend email send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend email send error:", err);
    return false;
  }
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

// Bumps the chosen class's level by 1 inside a multiclass charClass string
// ("Fighter 1 / Rogue 1" + "Fighter" -> "Fighter 2 / Rogue 1"), keeping every
// segment's encoded level in sync with the character's real level column —
// combinedDnd35eBab/combinedDnd35eSaveBonus trust those numbers exactly, so
// they must never drift out of sync. Single-class characters are untouched:
// their level lives purely on the character row, not encoded in the string.
function bumpClassLevel(charClass: string, chosenClass: string): string {
  const parts = charClass.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return charClass;
  return parts
    .map((part) => {
      const match = part.match(/^(.*?)(\d+)$/);
      const name = (match ? match[1] : part).trim();
      const level = match ? parseInt(match[2], 10) : 1;
      if (name.toLowerCase() !== chosenClass.trim().toLowerCase()) {
        return match ? `${name} ${level}` : name;
      }
      return `${name} ${level + 1}`;
    })
    .join(" / ");
}

function getVisitorId(req: Request): string {
  // If the user is logged in, use their userId as the stable identity.
  // This ensures character lookups work regardless of browser session/header.
  if (req.user?.id) return `user-${req.user.id}`;
  // A client-supplied header claiming the "user-<id>" shape (the exact
  // identity format an authenticated request resolves to above) must never
  // be honored for an unauthenticated request — that would let anyone
  // impersonate any logged-in user's owned characters/items by guessing
  // their (sequential, autoincrement) user id.
  const headerVisitorId = req.headers["x-visitor-id"] as string | undefined;
  if (headerVisitorId && /^user-/.test(headerVisitorId)) {
    return `anon-${randomBytes(8).toString("hex")}`;
  }
  return headerVisitorId || `anon-${randomBytes(8).toString("hex")}`;
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

// Pulls the real, current items/currency for every character in the party
// straight from storage, for injection into the DM's system prompt. This is
// the authoritative grounding the AI has always been missing — previously
// the model had no structured channel to inventory state at all and had to
// re-derive "what does the party own" purely from its own memory of the
// freeform narrative transcript, which drifts and contradicts real state
// over long campaigns (production investigation, 2026-08-18).
function buildPartyInventorySnapshots(chars: Character[]): PartyInventorySnapshot[] {
  return chars.map((character) => ({
    characterId: character.id,
    characterName: character.name,
    items: storage.getItemsByCharacter(character.id),
    currencies: storage.getCharacterCurrencies(character.id),
  }));
}

// Logs a fingerprint (not the content) of everything the AI is about to be
// told is true, so a later production bug report can be matched back to
// exactly what grounding data was in play. See server/ai-diagnostics.ts.
function logDmGenerationContext(params: {
  purpose: AiGenerationPurpose;
  campaignId: number;
  chars: Character[];
  triggerMessageId: number | null;
  sceneText: string | null | undefined;
  combatActive: boolean;
}): void {
  const inventorySnapshots = buildPartyInventorySnapshots(params.chars);
  logAiContextSnapshot({
    purpose: params.purpose,
    campaignId: params.campaignId,
    characterIds: params.chars.map((c) => c.id),
    triggerMessageId: params.triggerMessageId,
    provider: DM_AI_PROVIDER,
    promptVersion: DM_PROMPT_VERSION,
    sceneHash: hashSnapshot(params.sceneText || ""),
    inventoryHash: hashSnapshot(inventorySnapshots),
    currencyHash: hashSnapshot(inventorySnapshots.map((s) => ({ characterId: s.characterId, currencies: s.currencies }))),
    combatActive: params.combatActive,
  });
}

function buildAIUnavailableSystemMessage(
  context: "start" | "action" | "item",
  issue?: { title: string; detail: string; resolution?: string } | null,
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
    `DMOS cannot reach the ${getNarrationServiceLabel()} right now.`;
  const issueResolution =
    issue?.resolution || "Restore the configured narration provider, then try again.";

  return `${issueTitle}: ${contextLine}

${issueDetail}

${issueResolution} This is a real service-status message, not part of the story.`;
}

function canManageCampaign(req: Request, campaign: { userId: number | null; hostVisitorId: string }): boolean {
  if (req.user?.isAdmin || req.user?.role === "dungeon_master") return true;
  if (req.user?.id && campaign.userId === req.user.id) return true;
  return campaign.hostVisitorId === getVisitorId(req);
}

function setShortLivedCookie(res: Response, name: string, value: string) {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(name, value, {
    httpOnly: true,
    secure: isProduction,
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

function buildNewUserBillingDefaults() {
  return getNewUserBillingState();
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

export async function findOrCreateGoogleUser(profile: GoogleProfile) {
  const googleUser = storage.getUserByGoogleId(profile.sub);
  if (googleUser) {
    storage.updateUser(googleUser.id, {
      googleEmail: profile.email,
      avatarUrl: profile.picture || googleUser.avatarUrl,
    } as any);
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
    } as any);
    return storage.getUser(existingEmailUser.id) || existingEmailUser;
  }

  const passwordHash = await hashPassword(`google:${profile.sub}:${randomBytes(24).toString("hex")}`);
  const user = storage.createUser({
    email: profile.email,
    username: makeUniqueGoogleUsername(profile),
    passwordHash,
    googleId: profile.sub,
    googleEmail: profile.email,
    avatarUrl: profile.picture,
    ...buildNewUserBillingDefaults(),
  } as any);

  return user;
}

function normalizeBasePath(rawBasePath: string | undefined): string {
  if (!rawBasePath) return "";
  const trimmed = rawBasePath.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function getConfiguredBasePath(): string {
  const explicit = normalizeBasePath(process.env.APP_BASE_PATH || process.env.PUBLIC_BASE_PATH);
  if (explicit) return explicit;

  try {
    const appUrl = process.env.APP_URL ? new URL(process.env.APP_URL) : null;
    return normalizeBasePath(appUrl?.pathname);
  } catch {
    return "";
  }
}

function applyBasePathMiddleware(app: Express) {
  const basePath = getConfiguredBasePath();
  if (!basePath) return;

  app.use((req, _res, next) => {
    const [pathname, query = ""] = req.url.split("?");
    if (pathname === basePath || pathname.startsWith(`${basePath}/`)) {
      const strippedPath = pathname.slice(basePath.length) || "/";
      req.url = `${strippedPath}${query ? `?${query}` : ""}`;
    }
    next();
  });
}

function queueCampaignMemoryRefresh(
  campaignId: number,
  characters: any[],
  history: any[],
  latestNarration: string,
) {
  Promise.resolve()
    .then(async () => {
      const freshCampaign = storage.getCampaign(campaignId);
      if (!freshCampaign) return;

      const memoryDelta = await generateCampaignMemoryUpdate({
        campaign: freshCampaign,
        characters,
        history,
        latestNarration,
      });

      if (!memoryDelta) return;

      const latestCampaign = storage.getCampaign(campaignId);
      if (!latestCampaign) return;

      const merged = mergeCampaignWorldState(latestCampaign.worldState, memoryDelta);
      storage.updateWorldState(campaignId, JSON.stringify(merged));
    })
    .catch((error) => console.error("Campaign memory update error:", error));
}

// ── AI extractors ───────────────────────────────────────────────────────────
const BASE_AC = 10;

// Recomputes a character's AC from base + equipped items' "ac" bonus statMods.
// Returns true if the stored AC changed.
function recomputeCharacterAc(characterId: number): boolean {
  const character = storage.getCharacter(characterId);
  if (!character) return false;

  let acBonus = 0;
  for (const item of storage.getItemsByCharacter(characterId)) {
    if (!item.equipped) continue;
    try {
      const mods = JSON.parse((item as any).statMods || "[]");
      if (!Array.isArray(mods)) continue;
      for (const mod of mods) {
        if (mod && mod.stat === "ac" && mod.type === "bonus" && Number.isFinite(mod.modifier)) {
          acBonus += mod.modifier;
        }
      }
    } catch {}
  }

  const newAc = BASE_AC + acBonus;
  if (newAc === (character as any).ac) return false;
  storage.updateCharacter(characterId, { ac: newAc } as any);
  return true;
}

function getKnownItemNames(characterId: number): string[] {
  const names = new Set<string>();

  for (const item of storage.getItemsByCharacter(characterId)) {
    names.add(item.name);
  }

  const character = storage.getCharacter(characterId);
  if (character) {
    try {
      const parsed = JSON.parse((character as any).characterData || "{}");
      const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
      for (const section of sections) {
        if (["notes", "abilities", "currency"].includes(section.type)) continue;
        for (const entry of section.entries || []) {
          const name = entry.name || entry.key;
          if (name) names.add(name);
        }
      }
    } catch {}
  }

  return Array.from(names);
}

async function extractAbilitiesFromNarration(
  narration: string,
  _campaignId: number,
  _characterId: number,
): Promise<Array<{ name: string; description: string; category: string }>> {
  const grantKeywords =
    /\b(learns?|learns? to|gains? the ability|gains? access to|awakens?|unlocks?|masters?|receives? the|is granted|manifests?|activates?|teaches? you|your body remembers|the power of|acquire[sd]?|bestow[sd]?)\b/i;
  if (!grantKeywords.test(narration)) return [];

  try {
    const raw = await generateNarrationText({
      maxTokens: 512,
      purpose: "ability extraction",
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

    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Fallback per-unit weight (lbs) when the AI omits or returns an invalid
// weight for a granted item, keyed by itemType. Approximate but keeps the
// encumbrance system honest rather than silently granting free weight.
const DEFAULT_ITEM_WEIGHT_LBS: Record<string, number> = {
  weapon: 4,
  armor: 15,
  consumable: 0.5,
  gear: 1,
  tool: 2,
  magic: 1,
  misc: 1,
  currency: 0.02,
  key: 0.1,
  property: 0,
  vehicle: 0,
  vessel: 0,
  mount: 0,
  creature: 0,
  retainer: 0,
};

function resolveItemWeight(itemType: string, aiWeight: unknown): number {
  if (typeof aiWeight === "number" && Number.isFinite(aiWeight) && aiWeight >= 0) return aiWeight;
  return DEFAULT_ITEM_WEIGHT_LBS[String(itemType || "misc").toLowerCase()] ?? 1;
}

async function extractItemsFromNarration(
  narration: string,
  campaignId: number,
  characterId: number,
  campaignCurrencies: Array<{ code: string; name: string }> = [],
): Promise<any[]> {
  const grantKeywords =
    /\b(gives?|hands?|grants?|receives?|finds?|picks? up|obtains?|discovers?|rewards?|loot|opens? .{0,20}chest|inside .{0,20}(bag|chest|pack|pouch)|tucks? .{0,30}(into|away)|presses? .{0,20}into|slips? .{0,20}(into|to)|places? .{0,20}in your hand|passes? .{0,20}to you)\b/i;
  if (!grantKeywords.test(narration)) return [];

  const knownItems = getKnownItemNames(characterId);

  // 2026-08-18 live regression testing found a real double-booking bug: the
  // model can narrate a character's own already-known money as a fresh
  // "discovery" (e.g. "your fingers find a purse you'd swear wasn't there
  // before"), and since this function's old instructions told it to treat
  // ANY mention of gold/coins as a grantable itemType "currency", it created
  // a duplicate item row for money that extractCurrencyChangesFromNarration
  // was already tracking correctly via the real currency ledger. Ordinary
  // tracked currency must never be extracted as an item.
  const currencyNote = campaignCurrencies.length
    ? `\nThis campaign's tracked currencies are: ${campaignCurrencies.map((c) => `${c.name} (${c.code})`).join(", ")}. Ordinary amounts of these — coins, purses, "gold pieces" found, paid, or already carried — are handled by a SEPARATE currency system. NEVER extract them here, even as itemType "currency", even if the narration frames having or finding them as a fresh discovery. Only extract a currency-flavored ITEM here if it's a distinct, unique, named object (a single cursed coin, an ancient sigil-coin, one ceremonial doubloon) that the party would keep as a specific object rather than spend as money.\n`
    : "";

  try {
    const raw = await generateNarrationText({
      maxTokens: 512,
      purpose: "item extraction",
      system: `You are an item extractor for a tabletop RPG. Given DM narration, identify any items that were NEWLY GRANTED to the player character in this scene.

Only extract items that were explicitly given/found/received RIGHT NOW in this narration. Do not list items the character already owns.
${knownItems.length ? `\nThe character ALREADY owns these items — do NOT extract any of them again, even if the narration mentions or describes them:\n${knownItems.map((n) => `- ${n}`).join("\n")}\n` : ""}${currencyNote}
Return a JSON array (may be empty []) of objects:
[
  {
    "name": "display name (use 'X (Unidentified)' format if it seems mysterious or magical but unnamed)",
    "description": "one sentence describing what it is, or empty string if unidentified",
    "itemType": "consumable|weapon|armor|gear|magic|key|currency|misc|mount|vessel|property|vehicle|creature|retainer",
    "quantity": 1,
    "consumable": true or false,
    "charges": number or null,
    "weaponDamageDice": "1d8" or null (only for itemType "weapon" — standard damage dice for that weapon type, e.g. dagger=1d4, shortsword/rapier=1d6, longsword/battleaxe=1d8, greatsword/greataxe=2d6),
    "identified": true or false (false if it's mysterious, glowing, unexamined, or described vaguely),
    "weight": realistic weight of ONE unit in pounds (a dagger is about 1, a suit of plate armor about 50, a gold coin about 0.02, a house/wagon/mount/vessel/property/creature/retainer is 0)
  }
]

Rules:
- Ordinary campaign currency (see above) is NEVER extracted here — itemType "currency" is only for a distinct, unique, non-fungible currency-like object, never for ordinary coin amounts
- Potions, scrolls, bombs = consumable true
- Weapons, armor = consumable false
- If the item seems magical but its nature is unclear = identified false
- For "charges": if the consumable is drunk/used gradually over multiple uses (a flask, waterskin, jug, vial of oil, tin of tobacco, etc.), set a starting charge count like 3 or 4 — it will be depleted one charge per use. If the consumable is used up entirely in a single use (a potion, scroll, bomb, single dose), set charges to null and it will be tracked by quantity instead.
- Property, vehicles, vessels, mounts, and creatures are not physically carried — their weight must be 0
- If nothing was granted, return []
- Return ONLY the JSON array. No explanation.`,
      messages: [{ role: "user", content: narration }],
    });

    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any) => {
      const itemType = item.itemType || "misc";
      return {
        campaignId,
        characterId,
        name: item.name || "Unknown Item",
        trueName: "",
        description: item.description || "",
        trueDescription: "",
        itemType,
        quantity: item.quantity || 1,
        charges: typeof item.charges === "number" && item.charges > 0 ? Math.floor(item.charges) : null,
        maxCharges: typeof item.charges === "number" && item.charges > 0 ? Math.floor(item.charges) : null,
        identified: item.identified !== false,
        consumable: !!item.consumable,
        equipped: false,
        weaponDamageDice: itemType === "weapon" && typeof item.weaponDamageDice === "string" ? item.weaponDamageDice : null,
        locationNote: "",
        source: "dm",
        statMods: "[]",
        weight: resolveItemWeight(itemType, item.weight),
        carried: true,
      };
    });
  } catch {
    return [];
  }
}

// Each stem below is written with an explicit inflection group (not a bare
// \b-wrapped word) because a bare word inside \b(...)\b only matches that
// exact form — "snatch" never matches "snatched", "confiscat" never matches
// "confiscated", "returns?" never matches "returned". A 2026-08-18
// production bug (Merchant's Coin Purse never removed after the DM narrated
// "he snatched it back") traced directly to this: the narration used the
// inflected form and the gate silently never fired, so the follow-up
// extraction call that would have removed the item never ran.
const LOSS_KEYWORDS_RE =
  /\b(giv(e|es|ing)? (it|them) (back|away)|gave (it|them) (back|away)|hand(s|ed|ing)? (it|them) (back|over)|hand(s|ed|ing)? .{0,20}over|return(s|ed|ing)?|(is|was|were) taken (from|away from) you|steal(s|ing)?|stole|stolen|snatch(es|ed|ing)?|confiscat(e|es|ed|ing)?|drop(s|ped|ping)?|los(e|es|ing)?|lost|destroy(s|ed|ing)?|shatter(s|ed|ing)?|break(s|ing)?|broke|broken|no longer have|is gone|left behind|discard(s|ed|ing)?|sell(s|ing)?|sold|trad(e|ed|ing) away)\b/i;

export function isLossNarration(narration: string): boolean {
  return LOSS_KEYWORDS_RE.test(narration);
}

// The AI's narration is evidence that a currency change happened, never
// authority to apply one that would overdraw a character's real balance —
// combat/[CHECK] resolutions already follow this "server resolves, AI only
// narrates" pattern; this closes the one gap where narration-inferred
// currency changes were applied unconditionally.
export function resolveCurrencyChange(
  currentBalance: number,
  amount: number,
): { accepted: boolean; reason?: string } {
  if (amount < 0 && currentBalance + amount < 0) {
    return { accepted: false, reason: "insufficient_balance" };
  }
  return { accepted: true };
}

async function extractLostItemsFromNarration(
  narration: string,
  characterId: number,
): Promise<number[]> {
  if (!isLossNarration(narration)) return [];

  const items = storage.getItemsByCharacter(characterId);
  if (!items.length) return [];

  try {
    const raw = await generateNarrationText({
      maxTokens: 256,
      purpose: "item loss extraction",
      system: `You are an inventory-loss extractor for a tabletop RPG. Given DM narration and a list of items the character currently owns, identify which of those items (if any) were explicitly taken away, given away, lost, destroyed, or otherwise removed from the character's possession RIGHT NOW in this narration.

Character's current items (id: name):
${items.map((i) => `${i.id}: ${i.name}`).join("\n")}

Return a JSON array of the numeric ids of items that were removed (may be empty []). Only include an item if the narration is EXPLICIT that the character no longer has it. Do not guess or infer from ambiguous phrasing.
Return ONLY the JSON array. No explanation.`,
      messages: [{ role: "user", content: narration }],
    });

    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    const validIds = new Set(items.map((i) => i.id));
    return parsed.filter((id: any) => typeof id === "number" && validIds.has(id));
  } catch {
    return [];
  }
}

async function extractCurrencyChangesFromNarration(
  narration: string,
  campaignCurrencies: Array<{ code: string; name: string }>,
): Promise<Array<{ currencyCode: string; amount: number }>> {
  if (!campaignCurrencies.length) return [];

  const currencyWords = campaignCurrencies.flatMap((c) => [c.code, c.name]).join("|");
  const currencyKeywords = new RegExp(
    `\\b(${currencyWords}|coin|pay|paid|spend|spent|cost|receive|gain|lose|lost|earn|reward|price)\\b`,
    "i",
  );
  if (!currencyKeywords.test(narration)) return [];

  try {
    const raw = await generateNarrationText({
      maxTokens: 256,
      purpose: "currency change extraction",
      system: `You are a currency-change extractor for a tabletop RPG. Given DM narration, identify any changes to the player character's currency balance that happened RIGHT NOW in this narration (gaining or spending money).

This campaign's ONLY valid currencies are:
${campaignCurrencies.map((c) => `- code "${c.code}" (${c.name})`).join("\n")}

If the narration mentions any other denomination not in this list, ignore it entirely — do not invent it, do not convert it, do not apply it to a currency above.

Return a JSON array (may be empty []) of objects:
[{ "currencyCode": "one of the codes listed above, exactly", "amount": positive or negative whole number }]

Use a negative amount for money spent or lost, positive for money gained. Only include a change that explicitly happened in this narration.
Return ONLY the JSON array. No explanation.`,
      messages: [{ role: "user", content: narration }],
    });

    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    const validCodes = new Set(campaignCurrencies.map((c) => c.code));
    return parsed
      .filter((c: any) => c && validCodes.has(c.currencyCode) && Number.isFinite(c.amount))
      .map((c: any) => ({ currencyCode: c.currencyCode, amount: Math.trunc(c.amount) }));
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

function reserveTurnsFor(turns: number): number {
  return Math.ceil(Math.max(0, turns) * 0.2);
}

function tierForStripePriceId(priceId: string | null | undefined, fallback: TierName = "free"): TierName {
  if (!priceId) return fallback;
  for (const [tierName, tierDef] of Object.entries(TIERS)) {
    if (
      (tierDef.stripePriceIdMonthly && process.env[tierDef.stripePriceIdMonthly] === priceId) ||
      (tierDef.stripePriceIdWeekly && process.env[tierDef.stripePriceIdWeekly] === priceId) ||
      (tierDef.stripePriceIdYearly && process.env[tierDef.stripePriceIdYearly] === priceId)
    ) {
      return tierName as TierName;
    }
  }
  return fallback;
}

export function recordSubscriptionTurnGrant(params: {
  userId: number;
  tier: TierName;
  source: string;
  sourceId: string;
  stripeEventId?: string | null;
  stripeSessionId?: string | null;
  stripeInvoiceId?: string | null;
  interval?: string | null;
}) {
  const interval = params.interval === "weekly" || params.interval === "yearly" ? params.interval : "monthly";
  const turns = getIncludedTurns(params.tier, interval);
  if (turns <= 0) return;

  storage.recordIncludedTurnGrant({
    userId: params.userId,
    turns,
    reserveDelta: reserveTurnsFor(turns),
    reason: "subscription_grant",
    source: params.source,
    sourceId: params.sourceId,
    stripeEventId: params.stripeEventId ?? null,
    stripeSessionId: params.stripeSessionId ?? null,
    stripeInvoiceId: params.stripeInvoiceId ?? null,
    tier: params.tier,
    metadata: { interval: params.interval ?? null, reservePct: 20 },
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
          let turnsGranted = 0;
          if (achievement.rewardTurns && achievement.rewardTurns > 0) {
            // Idempotent on sourceId (belt-and-suspenders alongside the
            // hasAchievement check above) — reuses the same ledger/grant
            // path Stripe fulfillment uses, not a parallel currency system.
            const grant = storage.grantBonusTurns(userId, achievement.rewardTurns, {
              reason: "achievement_reward",
              source: "achievement",
              sourceId: `achievement:${id}:${userId}`,
              metadata: { achievementId: id },
            });
            if (grant.applied) turnsGranted = achievement.rewardTurns;
          }
          broadcastToCampaign(campaignId, {
            type: "achievement_unlocked",
            achievement,
            turnsGranted,
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
  applyBasePathMiddleware(app);
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
    setShortLivedCookie(res, GOOGLE_STATE_COOKIE, state);
    return res.redirect(buildGoogleAuthorizationUrl(state));
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const expectedState = req.cookies?.[GOOGLE_STATE_COOKIE];
    clearShortLivedCookie(res, GOOGLE_STATE_COOKIE);

    if (!code || !state || !expectedState || state !== expectedState) {
      return res.redirect(getGoogleFailureRedirect("state"));
    }

    try {
      const profile = await exchangeGoogleCodeForProfile(code);
      const user = await findOrCreateGoogleUser(profile);
      setSessionCookie(res, user.id);
      return res.redirect(getGooglePostLoginRedirect());
    } catch (err: any) {
      console.error("Google auth error:", err);
      return res.redirect(getGoogleFailureRedirect("failed"));
    }
  });

  app.post("/api/auth/register", async (req, res) => {
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
      const user = storage.createUser({
        email,
        username,
        passwordHash,
        ...getNewUserBillingState(),
      } as any);

      setSessionCookie(res, user.id);
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

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;

    const user = storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ message: "Invalid email or password." });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid email or password." });

    setSessionCookie(res, user.id);
    return res.json({ user: toPublicUser(user) });
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    return res.json({ user: toPublicUser(req.user!) });
  });

  app.get("/api/admin/me", requireDungeonMaster, (req, res) => {
    return res.json({ user: toPublicUser(req.user!) });
  });

  // On-demand production database consistency check (2026-08-18
  // investigation) — see server/integrity-checks.ts for what it actually
  // checks and why. Read-only, admin-gated.
  app.get("/api/admin/integrity-check", requireDungeonMaster, (req, res) => {
    const issues = runDataIntegrityChecks();
    return res.json({ issues, checkedAt: new Date().toISOString() });
  });

  // ── Updates feed ────────────────────────────────────────────────────────
  // Public, read-only. Voidsmith Industries' cross-product Updates page fetches
  // this directly from the browser, so the response is CORS-enabled for it.
  const UPDATES_CORS_ORIGINS = new Set([
    "https://voidsmithindustries.com",
    "https://www.voidsmithindustries.com",
    "https://dungeonmaster-os.com",
  ]);

  app.get("/api/updates", (req, res) => {
    const origin = req.headers.origin;
    if (origin && UPDATES_CORS_ORIGINS.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    const rows = storage.getUpdates();
    return res.json({
      updates: rows.map((row) => ({
        product: "DMOS",
        date: row.date,
        title: row.title,
        description: row.description,
      })),
    });
  });

  app.post("/api/updates", requireAuth, (req, res) => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin only." });
    }
    const { date, title, description } = req.body || {};
    if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "date is required in YYYY-MM-DD format." });
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "title is required." });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ message: "description is required." });
    }
    storage.createUpdate({ date, title: title.trim(), description: description.trim() });
    return res.status(201).json({ message: "Update published." });
  });

  app.post("/api/admin/grant-dungeon-master", requireDungeonMaster, (req, res) => {
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

    return res.json({ user: toPublicUser(updated) });
  });

  app.post("/api/admin/revoke-dungeon-master", requireDungeonMaster, (req, res) => {
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

    return res.json({ user: toPublicUser(updated) });
  });

  app.post("/api/auth/complete-onboarding", requireAuth, (req, res) => {
    storage.updateUser(req.user!.id, { onboardingComplete: true } as any);
    return res.json({ ok: true });
  });

  app.post("/api/auth/change-username", requireAuth, (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ message: "Username must be between 3 and 30 characters." });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ message: "Username may only contain letters, numbers, underscores, and hyphens." });
    }
    const existing = storage.getUserByUsername(username);
    if (existing && existing.id !== req.user!.id) {
      return res.status(409).json({ message: "This username is already taken." });
    }
    storage.updateUser(req.user!.id, { username } as any);
    const updated = storage.getUser(req.user!.id)!;
    return res.json({ user: toPublicUser(updated) });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
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
    storage.updateUser(user.id, { passwordHash } as any);
    return res.json({ ok: true });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const user = storage.getUserByEmail(email);
    if (!user) return res.json({ ok: true, message: "If that email exists, a reset link has been sent." });

    storage.deleteExpiredPasswordResetTokens();

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    storage.createPasswordResetToken(user.id, token, expiresAt);

    const appUrl = process.env.APP_URL || "http://localhost:5000";
    const resetLink = `${appUrl}/#/reset-password?token=${token}`;
    await sendEmail(
      user.email,
      "Reset your DungeonMasterOS password",
      `Someone requested a password reset for your DungeonMasterOS account.\n\nReset your password here (expires in 1 hour):\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`,
    );

    const response: any = { ok: true, message: "If that email exists, a reset link has been sent." };
    if (process.env.NODE_ENV !== "production") {
      response.devToken = token;
    }
    return res.json(response);
  });

  app.post("/api/auth/reset-password", async (req, res) => {
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
    storage.updateUser(resetToken.userId, { passwordHash } as any);
    storage.markPasswordResetTokenUsed(resetToken.id);

    return res.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STRIPE WEBHOOK
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/stripe/webhook", async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe not configured." });

    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not set");
      return res.status(500).json({ message: "Webhook secret not configured." });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody || req.body,
        sig,
        webhookSecret,
      );
    } catch (err: any) {
      console.error("Stripe webhook signature verification failed:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    if (storage.hasStripeEvent(event.id)) {
      return res.json({ received: true, duplicate: true });
    }

    let processedUserId: number | null = null;

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = parseInt(session.metadata?.userId || "0");
          const tier = session.metadata?.tier as TierName | undefined;
          const interval = session.metadata?.interval as string | undefined;
          const topUpTurns = parseInt(session.metadata?.topUpTurns || "0");
          const packId = session.metadata?.packId || null;
          const purchaseType = session.metadata?.purchaseType || null;

          if (!userId) break;
          processedUserId = userId;

          if (purchaseType === "squire") {
            const user = storage.getUser(userId);
            if (user) {
              storage.grantBonusTurns(userId, SQUIRE_PASS.turns, {
                reason: "squire_pass_grant",
                source: "stripe_checkout",
                sourceId: `stripe:checkout:${session.id}:squire`,
                reserveTurns: reserveTurnsFor(SQUIRE_PASS.turns),
                stripeEventId: event.id,
                stripeSessionId: session.id,
                tier: "free",
                metadata: { purchaseType: "squire", reservePct: 20 },
              });

              storage.updateUser(userId, {
                tier: "free",
                subscriptionStatus: "active",
                stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
                stripeSubscriptionId: null,
                stripePriceId: null,
                stripeBillingInterval: null,
                subscriptionCurrentPeriodEnd: null,
                trialEndsAt: null,
                usageResetAt: null,
                aiTurnsUsedThisMonth: 0,
              } as any);
            }
          } else if (topUpTurns > 0) {
            const user = storage.getUser(userId);
            if (user) {
              storage.grantBonusTurns(userId, topUpTurns, {
                reason: "topup_grant",
                source: "stripe_checkout",
                sourceId: `stripe:checkout:${session.id}:topup`,
                reserveTurns: reserveTurnsFor(topUpTurns),
                stripeEventId: event.id,
                stripeSessionId: session.id,
                tier: user.tier,
                packId,
                metadata: { reservePct: 20 },
              });
            }
          } else if (tier && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            const periodEnd = new Date((sub as any).current_period_end * 1000);
            const priceId = (sub.items.data[0]?.price?.id) || null;
            const invoiceId = typeof (session as any).invoice === "string"
              ? (session as any).invoice
              : ((session as any).invoice?.id ?? null);
            const checkoutInterval: BillingInterval =
              interval === "weekly" || interval === "yearly" ? interval : "monthly";
            // A new subscriber's usageResetAt starts null (getNewUserBillingState),
            // and attachUser's auto-reset block only runs when usageResetAt is
            // truthy — so it must be established here, at initial checkout,
            // rather than left to whenever the first invoice.payment_succeeded
            // webhook happens to arrive. If that event were ever missed or
            // delayed, a subscriber with no reset scheduled would accumulate
            // usage forever with nothing to bring it back to zero.
            const usageResetAt = getNextUsageResetAt(checkoutInterval);

            storage.updateUser(userId, {
              tier,
              subscriptionStatus: "active",
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              stripePriceId: priceId,
              stripeBillingInterval: checkoutInterval,
              subscriptionCurrentPeriodEnd: periodEnd.toISOString(),
              aiTurnsUsedThisMonth: 0,
              usageResetAt: usageResetAt.toISOString(),
            } as any);

            recordSubscriptionTurnGrant({
              userId,
              tier,
              source: "stripe_checkout",
              sourceId: invoiceId ? `stripe:invoice:${invoiceId}` : `stripe:checkout:${session.id}:subscription`,
              stripeEventId: event.id,
              stripeSessionId: session.id,
              stripeInvoiceId: invoiceId,
              interval,
            });
          }
          break;
        }

        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const user = storage.getUserByStripeSubscriptionId(sub.id);
          if (!user) break;
          processedUserId = user.id;

          const periodEnd = new Date((sub as any).current_period_end * 1000);
          let status: string = "active";

          if (sub.status === "past_due") status = "past_due";
          else if (sub.status === "canceled") status = "cancelled";
          else if (sub.status === "unpaid") status = "expired";
          else if (sub.status === "active") status = "active";

          // A cancellation made in the Stripe Billing Portal fires this
          // event with status still "active" and cancel_at_period_end:true
          // — the subscription is still live and paid through the current
          // period, it just won't renew. Store this as "cancelled" (not
          // "active") so the UI correctly reflects what the user just did;
          // canPlay()/isReadOnly() still treat "cancelled" as playable, so
          // this doesn't cut off access before the period they already
          // paid for actually ends.
          if (status === "active" && (sub as any).cancel_at_period_end) {
            status = "cancelled";
          }

          const priceId = sub.items.data[0]?.price?.id;
          const recurringInterval = sub.items.data[0]?.price?.recurring?.interval;
          const billingInterval: BillingInterval =
            recurringInterval === "week"
              ? "weekly"
              : recurringInterval === "year"
                ? "yearly"
                : recurringInterval === "month"
                  ? "monthly"
                  : (user.stripeBillingInterval as BillingInterval) || "monthly";
          const tier = tierForStripePriceId(priceId, user.tier as TierName);

          // An interval change (e.g. weekly -> monthly) changes the user's
          // entitlement immediately, but usageResetAt was previously left
          // anchored to the OLD interval's schedule — an upgrade granted a
          // free extra period before the stale anchor caught up, and a
          // downgrade left the user under-provisioned until it did. Only
          // recompute when the interval actually changed, so an ordinary
          // update (e.g. a card-detail change) that fires this same event
          // without an interval change doesn't reset usage mid-period.
          const intervalChanged = billingInterval !== user.stripeBillingInterval;

          storage.updateUser(user.id, {
            tier,
            subscriptionStatus: status,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId || null,
            stripeBillingInterval: billingInterval,
            subscriptionCurrentPeriodEnd: periodEnd.toISOString(),
            ...(intervalChanged
              ? { aiTurnsUsedThisMonth: 0, usageResetAt: getNextUsageResetAt(billingInterval).toISOString() }
              : {}),
          } as any);
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const user = storage.getUserByStripeSubscriptionId(sub.id);
          if (!user) break;
          processedUserId = user.id;

          storage.updateUser(user.id, {
            subscriptionStatus: "expired",
            tier: "free",
            stripeSubscriptionId: null,
            stripePriceId: null,
          } as any);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = typeof (invoice as any).subscription === "string" ? (invoice as any).subscription : null;
          if (!subscriptionId) break;
          const user = storage.getUserByStripeSubscriptionId(subscriptionId);
          if (!user) break;
          processedUserId = user.id;
          storage.updateUser(user.id, { subscriptionStatus: "past_due" } as any);
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = typeof (invoice as any).subscription === "string" ? (invoice as any).subscription : null;
          if (!subscriptionId) break;
          const user = storage.getUserByStripeSubscriptionId(subscriptionId);
          if (!user) break;
          processedUserId = user.id;

          const billingInterval =
            user.stripeBillingInterval === "weekly" || user.stripeBillingInterval === "yearly"
              ? user.stripeBillingInterval
              : "monthly";
          const nextReset = getNextUsageResetAt(billingInterval);
          const priceId = (invoice as any).lines?.data?.[0]?.price?.id || user.stripePriceId;
          const tier = tierForStripePriceId(priceId, user.tier as TierName);

          storage.updateUser(user.id, {
            tier,
            subscriptionStatus: "active",
            aiTurnsUsedThisMonth: 0,
            usageResetAt: nextReset.toISOString(),
          } as any);

          recordSubscriptionTurnGrant({
            userId: user.id,
            tier,
            source: "stripe_invoice",
            sourceId: `stripe:invoice:${invoice.id}`,
            stripeEventId: event.id,
            stripeInvoiceId: invoice.id,
            interval: user.stripeBillingInterval,
          });
          break;
        }

        default:
          break;
      }

      storage.recordStripeEvent({ eventId: event.id, type: event.type, status: "processed", userId: processedUserId });
      return res.json({ received: true });
    } catch (err: any) {
      console.error("Error processing Stripe webhook:", err);
      storage.recordStripeEvent({
        eventId: event.id,
        type: event.type,
        status: "failed",
        userId: processedUserId,
        metadata: { message: String(err?.message || err) },
      });
      return res.status(500).json({ message: "Stripe webhook processing failed." });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STRIPE BILLING ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/stripe/checkout", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe is not configured on this server." });

    const { tier, interval } = req.body as { tier: TierName; interval: "monthly" | "weekly" | "yearly" };

    if (!tier || !interval) {
      return res.status(400).json({ message: "tier and interval are required." });
    }

    if (!isPurchasableSubscriptionTier(tier)) {
      return res.status(400).json({ message: "That subscription tier is not available for purchase." });
    }

    if (interval !== "weekly" && interval !== "monthly" && interval !== "yearly") {
      return res.status(400).json({ message: "That billing interval is not available for purchase." });
    }

    const priceId = getStripePriceId(tier, interval);
    if (!priceId) {
      return res.status(400).json({ message: `No Stripe price configured for ${tier} ${interval}.` });
    }

    const user = req.user!;
    const appUrl = process.env.APP_URL || "http://localhost:5000";

    try {
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.username,
          metadata: { userId: String(user.id) },
        });
        customerId = customer.id;
        storage.updateUser(user.id, { stripeCustomerId: customerId } as any);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/#/dashboard?subscribed=1`,
        cancel_url: `${appUrl}/#/pricing`,
        metadata: {
          userId: String(user.id),
          tier,
          interval,
        },
        subscription_data: {
          metadata: {
            userId: String(user.id),
            tier,
            interval,
          },
        },
        allow_promotion_codes: true,
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe checkout error:", err);
      return res.status(500).json({ message: "Failed to create checkout session." });
    }
  });

  app.post("/api/stripe/squire", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe is not configured on this server." });

    const user = req.user!;

    // Squire's webhook fulfillment (checkout.session.completed with
    // purchaseType === "squire") unconditionally resets tier,
    // subscriptionStatus, stripeSubscriptionId, stripePriceId,
    // stripeBillingInterval and subscriptionCurrentPeriodEnd to the Squire
    // shape. A user with a currently live recurring Stripe subscription
    // must never be allowed to reach that fulfillment path — it would
    // silently orphan a subscription Stripe is still billing them for, with
    // no server-side record of it left. "active" and "past_due" both
    // represent a real, still-billing subscription (past_due just means
    // Stripe is currently retrying/dunning a failed payment on the same
    // subscription — canPlay() still lets these users use the app); only
    // "cancelled" also represents a subscription that is still paid and
    // live through subscriptionCurrentPeriodEnd — Stripe fires
    // customer.subscription.updated with cancel_at_period_end:true well
    // before the subscription actually ends, and this app stores that as
    // "cancelled" so the UI can show it accurately. Squire fulfillment
    // unconditionally wipes stripeSubscriptionId/stripePriceId/
    // stripeBillingInterval/subscriptionCurrentPeriodEnd, so letting a
    // "cancelled" user with time still remaining through would orphan a
    // subscription Stripe is still honoring and strand the days they
    // already paid for. Only once the period has actually ended (or there
    // never was one) does "cancelled"/"expired" mean genuinely stopped.
    const stillWithinPaidPeriod =
      !!user.subscriptionCurrentPeriodEnd && new Date(user.subscriptionCurrentPeriodEnd) > new Date();
    if (
      user.stripeSubscriptionId &&
      (user.subscriptionStatus === "active" ||
        user.subscriptionStatus === "past_due" ||
        (user.subscriptionStatus === "cancelled" && stillWithinPaidPeriod))
    ) {
      return res.status(400).json({
        message: "You already have an active subscription. Squire Pass is for solo, non-subscription play — cancel your subscription first if you want to switch.",
      });
    }

    // The price is never client-supplied. Any priceId/amount fields a
    // client sends in the request body are ignored entirely — the server
    // only ever reads its own configured price from the environment.
    const priceId = process.env[SQUIRE_PASS.stripePriceEnv];
    if (!priceId) {
      return res.status(400).json({ message: "Squire Pass is not configured on this server." });
    }

    const appUrl = process.env.APP_URL || "http://localhost:5000";

    try {
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.username,
          metadata: { userId: String(user.id) },
        });
        customerId = customer.id;
        storage.updateUser(user.id, { stripeCustomerId: customerId } as any);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/#/dashboard?squire=1`,
        cancel_url: `${appUrl}/#/pricing`,
        metadata: {
          userId: String(user.id),
          purchaseType: "squire",
        },
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe Squire checkout error:", err);
      return res.status(500).json({ message: "Failed to create Squire checkout session." });
    }
  });

  app.post("/api/stripe/portal", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe is not configured." });

    const user = req.user!;
    if (!user.stripeCustomerId) {
      return res.status(400).json({ message: "No billing account found. Subscribe first." });
    }

    const appUrl = process.env.APP_URL || "http://localhost:5000";

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${appUrl}/#/dashboard`,
      });
      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe portal error:", err);
      return res.status(500).json({ message: "Failed to open billing portal." });
    }
  });

  app.post("/api/stripe/topup", requireAuth, requireCanPlay, async (_req, res) => {
    // The old turn top-up economics are not approved for the current
    // commercial model. New purchases are deliberately disabled here.
    // reserveTurnsFor and the checkout.session.completed webhook's
    // topUpTurns fulfillment branch (both elsewhere in this file) are
    // intentionally left intact — that's the historical-ledger/fulfillment
    // support any already-completed purchase still needs to be correctly
    // accounted for. shared/tiers.ts's TURN_PACKS/getTopUpPrice and this
    // file's own now-unused getTopUpPriceId were the purchase-creation-only
    // helpers this route used; the latter was removed as genuinely dead
    // code once this was the only caller.
    return res.status(410).json({
      message: "Turn top-ups are no longer available for purchase.",
      code: "TOPUP_DISABLED",
    });
  });

  app.post("/api/stripe/cancel", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe is not configured." });

    const user = req.user!;
    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ message: "No active subscription found." });
    }

    try {
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      storage.updateUser(user.id, { subscriptionStatus: "cancelled" } as any);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("Cancel subscription error:", err);
      return res.status(500).json({ message: "Failed to cancel subscription." });
    }
  });

  app.get("/api/billing", requireAuth, async (req, res) => {
    const user = req.user!;
    const tier = user.tier as TierName;
    const status = user.subscriptionStatus as SubscriptionStatus;
    const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
    const limits = getEffectiveLimits(tier, status, trialEndsAt);
    const billingInterval =
      user.stripeBillingInterval === "weekly" || user.stripeBillingInterval === "yearly"
        ? user.stripeBillingInterval
        : "monthly";
    const turnsIncluded = user.unlimitedTurns
      ? -1
      : status === "trial"
        ? limits.aiTurnsPerMonth
        : getIncludedTurns(tier, billingInterval);
    const turnsAvailable = user.unlimitedTurns ? -1 : turnsIncluded + (user.bonusTurns ?? 0);
    const turnBalance = user.unlimitedTurns
      ? -1
      : Math.max(0, turnsAvailable - user.aiTurnsUsedThisMonth);

    const info: any = {
      tier: user.tier,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      stripeBillingInterval: user.stripeBillingInterval,
      aiTurnsUsedThisMonth: user.aiTurnsUsedThisMonth,
      bonusTurns: user.bonusTurns ?? 0,
      turnsIncluded,
      turnsAvailable,
      turnBalance,
      turnLedger: storage.getTurnLedgerByUser(user.id, 25),
      hasStripe: !!user.stripeCustomerId,
      hasSubscription: !!user.stripeSubscriptionId,
      stripeConfigured: !!stripe,
    };

    return res.json(info);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // USER / ACCOUNT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/achievements", requireAuth, (req, res) => {
    const achievements = storage.getUserAchievements(req.user!.id);
    return res.json(achievements);
  });

  app.get("/api/my-campaigns", requireAuth, (req, res) => {
    const campaigns = storage.getCampaignsByUser(req.user!.id);
    return res.json(campaigns);
  });

  app.post("/api/bug-reports", requireAuth, async (req, res) => {
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    if (!description) {
      return res.status(400).json({ message: "A description is required." });
    }
    if (description.length > 4000) {
      return res.status(400).json({ message: "Description must be 4000 characters or fewer." });
    }

    const campaignId = Number(req.body?.campaignId) || null;
    const excerpt = typeof req.body?.worldStateExcerpt === "string" ? req.body.worldStateExcerpt.trim() : "";

    let campaignContext = "";
    if (campaignId) {
      const campaign = storage.getCampaign(campaignId);
      const character = storage.getCharacterByVisitor(campaignId, getVisitorId(req));
      campaignContext = [
        campaign ? `Campaign: ${campaign.name} (id ${campaign.id})` : `Campaign id: ${campaignId}`,
        character ? `Character: ${character.name} (id ${character.id})` : "",
        campaign ? `\nRaw world state at time of report:\n${campaign.worldState}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    const bodyLines = [
      `Reporter: ${req.user!.username} (${req.user!.email}, user id ${req.user!.id})`,
      "",
      "Player description:",
      description,
    ];
    if (excerpt) {
      bodyLines.push("", "Quoted world-state excerpt the player flagged:", excerpt);
    }
    if (campaignContext) {
      bodyLines.push("", "──────────", campaignContext);
    }

    const sent = await sendEmail(SUPPORT_EMAIL, `DMOS bug report from ${req.user!.username}`, bodyLines.join("\n"));

    if (!sent) {
      return res.status(503).json({ message: "Could not send the report right now. Please try again shortly." });
    }
    return res.json({ ok: true });
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

    const { currencies, ...campaignInput } = parsed.data;
    const inviteCode = randomBytes(4).toString("hex");
    const campaign = storage.createCampaign({
      ...campaignInput,
      inviteCode,
      hostVisitorId: visitorId,
      userId: req.user!.id,
      worldState: JSON.stringify(createEmptyWorldState()),
    });

    for (const currency of currencies) {
      storage.createCampaignCurrency({
        campaignId: campaign.id,
        code: currency.code.toLowerCase(),
        name: currency.name,
        symbol: currency.symbol,
        isPrimary: currency.isPrimary,
        exchangeRate: currency.exchangeRate,
      });
    }

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

  app.get("/api/campaigns/invite/:code", (req, res) => {
    const campaign = storage.getCampaignByInviteCode(req.params.code);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    return res.json(campaign);
  });

  app.get("/api/campaigns/:id", (req, res) => {
    const campaign = storage.getCampaign(Number(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    return res.json(campaign);
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

  app.patch("/api/campaigns/:id", (req, res) => {
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

  app.get("/api/campaigns/:id/currencies", (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    return res.json(storage.getCampaignCurrencies(campaignId));
  });

  app.get("/api/campaigns/:id/shop", (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const shop = storage.getActiveShopByCampaign(campaignId);
    if (!shop) return res.json({ shop: null, items: [] });

    return res.json({ shop, items: storage.getShopItemsByShop(shop.id) });
  });

  app.post("/api/campaigns/:id/shop", requireAuth, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (!canManageCampaign(req, campaign)) {
      return res.status(403).json({ message: "Only the campaign host can manage shops." });
    }

    const campaignCurrencies = storage.getCampaignCurrencies(campaignId);
    const currencyCodes = new Set(campaignCurrencies.map((currency) => currency.code));

    const merchantName = String(req.body?.merchantName || "").trim();
    const currencyCode = String(req.body?.currencyCode || "").trim().toLowerCase();
    const rawItems: unknown[] = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!merchantName) return res.status(400).json({ message: "Merchant name is required." });
    if (!currencyCodes.has(currencyCode)) {
      return res.status(400).json({ message: "Shop currency must be one of the campaign currencies." });
    }
    if (rawItems.length === 0) return res.status(400).json({ message: "At least one shop item is required." });

    const parsedItems = rawItems.map((item: unknown) => createShopItemSchema.safeParse(item));
    const invalidItem = parsedItems.find((item): item is Extract<typeof item, { success: false }> => !item.success);
    if (invalidItem && !invalidItem.success) {
      return res.status(400).json({ message: invalidItem.error.issues[0].message });
    }

    storage.closeActiveShops(campaignId);
    const shop = storage.createActiveShop({
      campaignId,
      merchantName,
      merchantDescription: String(req.body?.merchantDescription || "").trim(),
      currencyCode,
      title: String(req.body?.title || "Merchant Stock").trim(),
      isOpen: true,
      metadata: JSON.stringify(req.body?.metadata || {}),
    });

    for (const parsed of parsedItems) {
      if (!parsed.success) continue;
      const priceCurrencyCode = parsed.data.priceCurrencyCode.toLowerCase();
      if (!currencyCodes.has(priceCurrencyCode)) {
        return res.status(400).json({ message: "Item price currency must be one of the campaign currencies." });
      }

      storage.createShopItem({
        ...parsed.data,
        shopId: shop.id,
        campaignId,
        priceCurrencyCode,
        metadata: JSON.stringify(parsed.data.metadata || {}),
      } as any);
    }

    const payload = { shop, items: storage.getShopItemsByShop(shop.id) };
    broadcastToCampaign(campaignId, { type: "shop_updated", ...payload });
    return res.status(201).json(payload);
  });

  app.post("/api/campaigns/:id/shop/buy", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const parsed = buyShopItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return res.status(403).json({ message: "You don't have a character in this campaign." });

    const shop = storage.getActiveShopByCampaign(campaignId);
    if (!shop) return res.status(404).json({ message: "No active shop is open." });

    const shopItem = storage.getShopItem(parsed.data.shopItemId);
    if (!shopItem || shopItem.campaignId !== campaignId || shopItem.shopId !== shop.id) {
      return res.status(404).json({ message: "Shop item not found." });
    }

    const quantity = parsed.data.quantity;
    if (shopItem.stock < quantity) {
      return res.status(400).json({ message: "Not enough stock available." });
    }

    const totalCost = shopItem.priceAmount * quantity;
    const balance = storage.getCharacterCurrency(character.id, shopItem.priceCurrencyCode);
    if (!balance || balance.amount < totalCost) {
      return res.status(400).json({ message: "Not enough currency for this purchase." });
    }

    const updatedBalance = storage.adjustCharacterCurrency(
      campaignId,
      character.id,
      shopItem.priceCurrencyCode,
      -totalCost,
    );

    storage.updateShopItem(shopItem.id, {
      stock: shopItem.stock - quantity,
      updatedAt: new Date().toISOString(),
    } as any);

    const item = storage.createItem({
      campaignId,
      characterId: character.id,
      name: shopItem.name,
      description: shopItem.description,
      itemType: shopItem.itemType,
      quantity: shopItem.quantityPerPurchase * quantity,
      charges: null,
      maxCharges: null,
      identified: true,
      consumable: shopItem.itemType === "consumable",
      equipped: false,
      locationNote: `Purchased from ${shop.merchantName}`,
      source: "shop",
      statMods: "[]",
    });

    const currency = storage
      .getCampaignCurrencies(campaignId)
      .find((entry) => entry.code === shopItem.priceCurrencyCode);
    const purchaseMessage = storage.createMessage({
      campaignId,
      sender: "System",
      senderType: "system",
      content: `${character.name} bought ${quantity} x ${shopItem.name} for ${totalCost} ${currency?.name || shopItem.priceCurrencyCode}.`,
      messageType: "system",
    });

    broadcastToCampaign(campaignId, { type: "currencies_updated", characterId: character.id });
    broadcastToCampaign(campaignId, { type: "items_updated", characterId: character.id });
    broadcastToCampaign(campaignId, { type: "shop_updated", shop, items: storage.getShopItemsByShop(shop.id) });
    broadcastToCampaign(campaignId, { type: "message", message: purchaseMessage });

    return res.json({
      item,
      balance: updatedBalance,
      shop: storage.getActiveShopByCampaign(campaignId),
      shopItems: storage.getShopItemsByShop(shop.id),
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHARACTER ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/campaigns/:id/characters", (req, res) => {
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

    // Structured rulesets (5e/3.5e) restrict class to the canonical roster —
    // this is the server-side half of the character-creation lockdown; the
    // client dropdown only prevents accidental garbage, not a direct API call.
    // A multiclass string ("Fighter 1 / Rogue 1") is checked segment by segment.
    if (parsed.data.charClass && (campaign.ruleset === "dnd5e" || campaign.ruleset === "dnd35e")) {
      const validClasses = new Set(classesForRuleset(campaign.ruleset).map((c) => c.toLowerCase()));
      const invalidSegment = parsed.data.charClass
        .split("/")
        .map((part) => part.trim().replace(/\d+$/, "").trim())
        .find((name) => name && !validClasses.has(name.toLowerCase()));
      if (invalidSegment) {
        return res.status(400).json({
          message: `"${invalidSegment}" is not a valid ${campaign.ruleset === "dnd35e" ? "3.5e" : "5e"} class`,
        });
      }
    }

    // 3.5e restricts race to the real registry (Canon-doc Phase 1) — same
    // server-side-half-of-the-lockdown pattern as class above. Other
    // rulesets keep free-text race, so this only runs for 3.5e campaigns.
    if (campaign.ruleset === "dnd35e" && !getRace("dnd35e", parsed.data.race)) {
      return res.status(400).json({ message: `"${parsed.data.race}" is not a valid 3.5e race` });
    }

    const level = Math.min(Math.max(Number(req.body.level) || 1, 1), 99);
    const maxHp = Number(req.body.maxHp) || 20;
    const hp = Math.min(Number(req.body.hp) || maxHp, maxHp);

    let characterData: any;
    try {
      characterData = req.body.characterData ? JSON.parse(req.body.characterData) : { sections: [], raw: "" };
    } catch {
      characterData = { sections: [], raw: "" };
    }
    if (!characterData || typeof characterData !== "object") characterData = { sections: [], raw: "" };
    if (!Array.isArray(characterData.sections)) characterData.sections = [];
    const { proficiencies, feats, ...characterFields } = parsed.data;
    if (feats.length > 0) {
      characterData.sections.push({ label: "Feats & Features", content: feats.join("\n") });
    }

    const character = storage.createCharacter({
      ...characterFields,
      campaignId,
      visitorId,
      userId: req.user?.id || null,
      level,
      hp,
      maxHp,
      status: "alive",
      inventory: "[]",
      proficiencies: JSON.stringify(proficiencies),
      characterData: JSON.stringify(characterData),
    } as any);

    for (const currency of storage.getCampaignCurrencies(campaignId)) {
      storage.createCharacterCurrency({
        campaignId,
        characterId: character.id,
        currencyCode: currency.code,
        amount: 0,
      });
    }

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

  app.post("/api/parse-character", async (req, res) => {
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

  app.get("/api/campaigns/:id/characters", (req, res) => {
    return res.json(storage.getCharactersByCampaign(Number(req.params.id)));
  });

  app.get("/api/campaigns/:id/my-character", (req, res) => {
    const visitorId = getVisitorId(req);
    const char = storage.getCharacterByVisitor(Number(req.params.id), visitorId);
    if (!char) return res.status(404).json({ message: "No character found" });
    return res.json(char);
  });

  app.patch("/api/characters/:id/spell-data", (req, res) => {
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

  app.patch("/api/characters/:id/hp", (req, res) => {
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

  app.get("/api/characters/:characterId/currencies", (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId && character.userId !== req.user?.id) {
      return res.status(403).json({ message: "Not your character" });
    }

    return res.json(storage.getCharacterCurrencies(characterId));
  });

  app.post("/api/characters/:characterId/currencies/adjust", requireAuth, (req, res) => {
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });

    const campaign = storage.getCampaign(character.campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (!canManageCampaign(req, campaign)) {
      return res.status(403).json({ message: "Only the campaign host can adjust currency." });
    }

    const parsed = adjustCurrencySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const currencyCode = parsed.data.currencyCode.toLowerCase();
    const currencyExists = storage
      .getCampaignCurrencies(character.campaignId)
      .some((currency) => currency.code === currencyCode);
    if (!currencyExists) return res.status(400).json({ message: "Unknown campaign currency." });

    const updated = storage.adjustCharacterCurrency(
      character.campaignId,
      character.id,
      currencyCode,
      parsed.data.amount,
    );

    broadcastToCampaign(character.campaignId, {
      type: "currencies_updated",
      characterId: character.id,
      balance: updated,
    });

    return res.json(updated);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ITEM ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/characters/:characterId/items", (req, res) => {
    return res.json(storage.getItemsByCharacter(Number(req.params.characterId)));
  });

  // Standalone character identity fetch — needed by the canonical Character
  // Sheet page, which can be opened directly by URL (e.g. "open in separate
  // window") without campaign.tsx's React state already holding the
  // character record. Nothing else fetches a bare character by id today;
  // every other consumer gets it via /api/campaigns/:id/my-character.
  app.get("/api/characters/:characterId", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });
    return res.json(character);
  });

  app.get("/api/characters/:characterId/sheet", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });

    const campaign = storage.getCampaign(character.campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    try {
      const sheet = computeFullCharacterSheet(characterId, { ruleset: campaign.ruleset, combatStyle: campaign.combatStyle }, storage);
      return res.json(sheet);
    } catch (err) {
      console.error("computeFullCharacterSheet error:", err);
      return res.status(500).json({ message: "Could not compute character sheet." });
    }
  });

  // Player-facing surface for emergent titles: established titles only.
  // Candidates, self-declared aliases, and evidence/witness counts are
  // deliberately never exposed here — the whole point of the system is that
  // the player discovers a title through the world using it, not through a
  // progress readout. See server/titles.ts.
  app.get("/api/characters/:characterId/titles", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });

    const titles = storage
      .getEstablishedCharacterTitles(characterId)
      .map((t) => ({ title: t.titleText, establishedAt: t.establishedAt }));
    return res.json(titles);
  });

  app.post("/api/characters/:characterId/long-rest", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });

    const campaign = storage.getCampaign(character.campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    storage.updateCharacter(characterId, { hp: character.maxHp, tempHp: 0 });

    const pendingLevelUps = Math.max(0, levelForXp(character.xp, campaign.ruleset) - character.level);

    const msg = storage.createMessage({
      campaignId: character.campaignId,
      sender: "System",
      senderType: "system",
      content: `${character.name} takes a long rest and wakes fully healed.`,
      messageType: "system",
    });
    broadcastToCampaign(character.campaignId, { type: "message", message: msg });
    broadcastToCampaign(character.campaignId, { type: "character_updated" });

    return res.json({ hp: character.maxHp, maxHp: character.maxHp, pendingLevelUps });
  });

  app.get("/api/characters/:characterId/level-up-options", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });

    const campaign = storage.getCampaign(character.campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const xpLevel = levelForXp(character.xp, campaign.ruleset);
    if (xpLevel <= character.level) {
      return res.json({ eligible: false, classes: [], nextLevel: character.level, isAsiLevel: false, conModifier: 0 });
    }

    const classes = character.charClass
      .split("/")
      .map((p) => p.trim().replace(/\d+$/, "").trim())
      .filter(Boolean);
    const nextLevel = character.level + 1;

    return res.json({
      eligible: true,
      nextLevel,
      classes,
      isAsiLevel: isAsiLevel(nextLevel, campaign.ruleset),
      conModifier: Math.floor((character.con - 10) / 2),
    });
  });

  app.post("/api/characters/:characterId/level-up", requireAuth, (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });

    const campaign = storage.getCampaign(character.campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const xpLevel = levelForXp(character.xp, campaign.ruleset);
    if (xpLevel <= character.level) {
      return res.status(400).json({ message: "Not eligible to level up yet." });
    }

    const existingClasses = character.charClass
      .split("/")
      .map((p) => p.trim().replace(/\d+$/, "").trim())
      .filter(Boolean);
    const chosenClass = typeof req.body.chosenClass === "string" && req.body.chosenClass.trim() ? req.body.chosenClass.trim() : existingClasses[0];
    if (!existingClasses.some((c) => c.toLowerCase() === chosenClass.toLowerCase())) {
      return res.status(400).json({ message: "chosenClass must be one of the character's existing classes." });
    }

    const conModifier = Math.floor((character.con - 10) / 2);
    const result = computeLevelUp(character.level, chosenClass, campaign.ruleset, conModifier, {
      roll: !!req.body.roll,
      rng: Math.random,
    });

    const newLevel = result.newLevel;
    const updates: Record<string, unknown> = {
      level: newLevel,
      charClass: bumpClassLevel(character.charClass, chosenClass),
      maxHp: character.maxHp + result.hpGained,
      hp: character.hp + result.hpGained,
    };

    let asiApplied: Array<{ ability: string; amount: number }> = [];
    let featApplied: string | null = null;

    if (isAsiLevel(newLevel, campaign.ruleset)) {
      const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
      const asiChoice = Array.isArray(req.body.asi) ? req.body.asi : null;
      const featChoice = typeof req.body.feat === "string" ? req.body.feat.trim() : "";

      if (asiChoice) {
        const cleaned = asiChoice.filter(
          (a: any) => a && ABILITIES.includes(a.ability) && (a.amount === 1 || a.amount === 2),
        );
        const totalPoints = cleaned.reduce((sum: number, a: any) => sum + a.amount, 0);
        const distinctAbilities = new Set(cleaned.map((a: any) => a.ability)).size === cleaned.length;
        if (totalPoints !== 2 || !distinctAbilities || cleaned.length > 2) {
          return res.status(400).json({
            message: "Ability Score Improvement must total +2, as either +2 to one ability or +1 to two different abilities.",
          });
        }
        for (const a of cleaned) {
          updates[a.ability] = (character as any)[a.ability] + a.amount;
        }
        asiApplied = cleaned;
      } else if (featChoice) {
        featApplied = featChoice;
      } else {
        return res.status(400).json({ message: "This level grants an Ability Score Improvement or a feat — choose one." });
      }
    }

    if (featApplied) {
      let characterData: any;
      try {
        characterData = JSON.parse(character.characterData || "{}");
      } catch {
        characterData = {};
      }
      if (!Array.isArray(characterData.sections)) characterData.sections = [];
      const featSection = characterData.sections.find((s: any) => s.label === "Feats & Features");
      if (featSection) {
        featSection.content = `${featSection.content}\n${featApplied}`.trim();
      } else {
        characterData.sections.push({ label: "Feats & Features", content: featApplied });
      }
      updates.characterData = JSON.stringify(characterData);
    }

    storage.updateCharacter(characterId, updates as any);
    const updatedCharacter = storage.getCharacter(characterId)!;

    const gainDescription = asiApplied.length ? " and grows stronger" : featApplied ? ` and learns ${featApplied}` : "";
    const msg = storage.createMessage({
      campaignId: character.campaignId,
      sender: "System",
      senderType: "system",
      content: `${character.name} reaches level ${newLevel}${gainDescription}. (+${result.hpGained} HP)`,
      messageType: "system",
    });
    broadcastToCampaign(character.campaignId, { type: "message", message: msg });
    broadcastToCampaign(character.campaignId, { type: "character_updated" });

    // Account-wide, server-only counter behind the "Scars of Experience"
    // achievement — incremented once per real, eligibility-checked level-up
    // (never by narration), regardless of which character earned it.
    const currentUser = storage.getUser(req.user!.id);
    const totalLevelUps = (currentUser?.totalLevelUps ?? 0) + 1;
    storage.updateUser(req.user!.id, { totalLevelUps });
    tryUnlockAchievements(req.user!.id, character.campaignId, characterId, {
      type: "character_update",
      unlockedIds: storage.getUnlockedAchievementIds(req.user!.id),
      account: { totalLevelUps },
    });

    const pendingLevelUps = Math.max(0, levelForXp(updatedCharacter.xp, campaign.ruleset) - updatedCharacter.level);

    return res.json({
      character: updatedCharacter,
      hpGained: result.hpGained,
      hpRoll: result.hpRoll,
      pendingLevelUps,
    });
  });

  app.post("/api/characters/:characterId/items", (req, res) => {
    const visitorId = getVisitorId(req);
    const characterId = Number(req.params.characterId);
    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });

    const {
      name, trueName = "", description = "", trueDescription = "",
      itemType = "gear", quantity = 1, charges = null, maxCharges = null,
      identified = true, consumable = false, equipped = false, locationNote = "",
      statMods = "[]", weaponDamageDice = null, weight = 0, carried = true,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Item name is required" });

    const item = storage.createItem({
      campaignId: character.campaignId,
      characterId,
      name: name.trim(),
      trueName, description, trueDescription,
      itemType, quantity, charges, maxCharges,
      identified, consumable, equipped, locationNote,
      weaponDamageDice,
      source: "manual",
      statMods: typeof statMods === "string" ? statMods : JSON.stringify(statMods),
      weight: typeof weight === "number" && Number.isFinite(weight) && weight >= 0 ? weight : 0,
      carried: carried !== false,
    });

    broadcastToCampaign(character.campaignId, { type: "items_updated", characterId });
    return res.status(201).json(item);
  });

  app.patch("/api/items/:id", (req, res) => {
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
      "identified", "consumable", "equipped", "slot", "locationNote", "trueName", "trueDescription", "statMods",
      "weaponDamageDice", "weight", "carried",
    ];
    const updates: any = {};
    for (const key of allowed) {
      if ((req.body as any)[key] !== undefined) updates[key] = (req.body as any)[key];
    }
    if (updates.weight !== undefined && (typeof updates.weight !== "number" || !Number.isFinite(updates.weight) || updates.weight < 0)) {
      delete updates.weight;
    }
    if (updates.carried !== undefined) updates.carried = updates.carried !== false;

    storage.updateItem(itemId, updates);
    broadcastToCampaign(item.campaignId, { type: "items_updated", characterId: item.characterId });

    if ("equipped" in updates) {
      const acChanged = recomputeCharacterAc(item.characterId);
      if (acChanged) {
        broadcastToCampaign(item.campaignId, { type: "character_updated", characterId: item.characterId });
      }
    }

    return res.json(storage.getItem(itemId));
  });

  app.post("/api/items/:id/use", requireAuth, requireCanPlay, checkTurnLimit(), async (req, res) => {
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
    if (item.consumable) {
      remaining = storage.decrementItem(itemId);
    }
    broadcastToCampaign(item.campaignId, { type: "items_updated", characterId: item.characterId });

    try {
      broadcastToCampaign(item.campaignId, { type: "dm_thinking", thinking: true });
      const history = storage.getMessagesByCampaign(item.campaignId);
      const chars = storage.getCharactersByCampaign(item.campaignId);

      logDmGenerationContext({
        purpose: "item_use",
        campaignId: item.campaignId,
        chars,
        triggerMessageId: playerMsg.id,
        sceneText: campaign.worldState,
        combatActive: false,
      });

      const rawResponse = await generateDMResponse(
        campaign,
        chars,
        history,
        useAction,
        character.name,
        [],
        null,
        buildPartyInventorySnapshots(chars),
      );
      const { cleanContent, worldState } = extractWorldState(rawResponse);

      if (worldState) {
        // Was a raw {...current, ...worldState} spread — unlike the other two
        // worldState write sites (main action handler, opening scene), this
        // bypassed mergeCampaignWorldState's array-dedup and currentScene
        // handling entirely, so a delta from item-use could wholesale
        // replace locations/npcs/factions instead of merging them. Unified
        // onto the same merge function every other write site already uses.
        const merged = mergeCampaignWorldState(campaign.worldState, worldState);
        storage.updateWorldState(item.campaignId, JSON.stringify(merged));
      }

      const newItems = await extractItemsFromNarration(
        cleanContent,
        item.campaignId,
        item.characterId,
        storage.getCampaignCurrencies(item.campaignId),
      );
      for (const newItem of newItems) {
        const created = storage.createItem(newItem);
        broadcastToCampaign(item.campaignId, { type: "item_granted", item: created });
      }
      if (newItems.length) {
        broadcastToCampaign(item.campaignId, { type: "items_updated", characterId: item.characterId });
      }

      const dmMsg = storage.createMessage({
        campaignId: item.campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: cleanContent,
        messageType: "narration",
      });
      broadcastToCampaign(item.campaignId, { type: "dm_thinking", thinking: false });
      broadcastToCampaign(item.campaignId, { type: "message", message: dmMsg });

      incrementTurnCount(req.user!.id);
    } catch (err) {
      broadcastToCampaign(item.campaignId, { type: "dm_thinking", thinking: false });
      console.error("DM item-use error:", err);

      const aiIssue = getNarrationServiceIssue(err);
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

  app.post("/api/items/:id/read", requireAuth, async (req, res) => {
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

    const worldState = parseCampaignWorldState(campaign.worldState);

    try {
      const content = await generateNarrationText({
        system: `You are generating the literal written or visual content of an in-world document or map for a tabletop RPG — not narrating a scene. The player wants to see exactly what this item shows, presented directly as its content: no "you read..." framing, no narration of the character's reaction, just the content itself as if printed on the page.

Item name: ${item.name}
Item description: ${item.description || "none given"}
${item.identified ? "" : "This item is not yet identified — keep the content appropriately vague or mysterious rather than revealing secrets that identification should unlock."}

Campaign tone: ${campaign.tone}, world type: ${campaign.worldType}
Established world context: ${worldState.currentScene || "None established yet."}

Stay strictly consistent with anything already established about this document in the campaign so far — do not invent a name, place, or fact that contradicts prior narration. If this is a map, describe what's drawn on it in a clear, organized way (regions, routes, landmarks). If it's a written notice, letter, or journal, produce the actual text as if quoting it directly.

Keep it to 2-4 short paragraphs.`,
        maxTokens: 500,
        purpose: "item document content",
        messages: [{ role: "user", content: `Show me the content of: ${item.name}` }],
      });

      return res.json({ content: content.trim() });
    } catch (err) {
      console.error("Item read error:", err);
      return res.status(503).json({ message: "Could not read this right now. Try again shortly." });
    }
  });

  app.post("/api/items/:id/identify", (req, res) => {
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

  app.delete("/api/items/:id", (req, res) => {
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

  app.get("/api/characters/:characterId/effects", (req, res) => {
    return res.json(storage.getActiveEffectsByCharacter(Number(req.params.characterId)));
  });

  app.post("/api/characters/:characterId/effects", (req, res) => {
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

  app.delete("/api/effects/:id", (req, res) => {
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

  app.get("/api/campaigns/:id/messages", (req, res) => {
    return res.json(storage.getMessagesByCampaign(Number(req.params.id)));
  });

  interface ActionDeps {
    generateDMResponse: typeof generateDMResponse;
    generateNpcTurnAction: typeof generateNpcTurnAction;
    generateNarrationText: typeof generateNarrationText;
  }

  const realActionDeps: ActionDeps = { generateDMResponse, generateNpcTurnAction, generateNarrationText };

  async function handleFlee(req: Request, res: Response, campaignId: number) {
    const visitorId = getVisitorId(req);
    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return res.status(403).json({ message: "You don't have a character in this campaign" });

    const encounter = storage.getActiveEncounterByCampaign(campaignId);
    if (!encounter) return res.status(404).json({ message: "No active encounter" });

    const result = fleeEncounter(encounter.id, character.name, storage);
    if (!result.fled) return res.status(400).json({ message: "You are not part of this encounter" });

    broadcastToCampaign(campaignId, { type: "encounter_updated", encounterId: encounter.id });
    if (result.encounterEnded) {
      broadcastToCampaign(campaignId, { type: "encounter_ended", encounterId: encounter.id });
    }

    return res.json({ fled: true, encounterEnded: result.encounterEnded });
  }

  app.post("/api/campaigns/:id/encounter/flee", requireAuth, async (req, res) => {
    const campaignId = Number(req.params.id);
    await withCampaignLock(campaignId, () => handleFlee(req, res, campaignId));
  });

  async function handleAction(req: Request, res: Response, campaignId: number, deps: ActionDeps = realActionDeps) {
    const visitorId = getVisitorId(req);
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

    const clientSubmissionId = typeof req.body?.clientSubmissionId === "string" ? req.body.clientSubmissionId : undefined;

    const { message: playerMsg, wasCreated } = storage.createMessageIdempotent({
      campaignId,
      sender: character.name,
      senderType: "player",
      content,
      messageType: "action",
      clientSubmissionId,
    });

    if (!wasCreated) {
      // Duplicate submission — the original was already processed (or is being
      // processed by a call queued ahead of this one on the same campaign lock).
      // Return the existing message rather than reprocessing the action.
      return res.json({ message: playerMsg, duplicate: true });
    }

    broadcastToCampaign(campaignId, { type: "message", message: playerMsg });

    try {
      const history = storage.getMessagesByCampaign(campaignId);
      const chars = storage.getCharactersByCampaign(campaignId);

      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: true });

      const activeEncounterBefore = storage.getActiveEncounterByCampaign(campaignId);
      const combatContext = buildCombatContext(activeEncounterBefore, character);

      logDmGenerationContext({
        purpose: "main_action",
        campaignId,
        chars,
        triggerMessageId: playerMsg.id,
        sceneText: campaign.worldState,
        combatActive: !!combatContext,
      });

      const rawResponse = await deps.generateDMResponse(
        campaign,
        chars,
        history,
        content,
        character.name,
        storage.getCampaignCurrencies(campaignId),
        combatContext,
        buildPartyInventorySnapshots(chars),
      );

      const { cleanContent, worldState } = extractWorldState(rawResponse);

      if (worldState) {
        const merged = mergeCampaignWorldState(campaign.worldState, worldState);
        storage.updateWorldState(campaignId, JSON.stringify(merged));
      }

      let attackResult: AttackResolution | { error: string } | null = null;

      if (activeEncounterBefore) {
        const surrenderResult = applyNpcSurrender(activeEncounterBefore.id, rawResponse, storage);
        if (surrenderResult.message) {
          broadcastToCampaign(campaignId, { type: "message", message: surrenderResult.message });
        }

        if (surrenderResult.surrenderedNames.length === 0 && combatContext?.isSubmittingPlayersTurn) {
          attackResult = await resolveAttack({
            encounterId: activeEncounterBefore.id,
            rawResponse,
            storage,
            rng: Math.random,
            narrate: (prompt) =>
              deps.generateNarrationText({
                system: "You are DMS narrating the fixed outcome of a resolved combat action. Do not restate the numbers; narrate only the consequence, in 2-4 sentences, matching the established DungeonMasterOS narration style.",
                maxTokens: 300,
                purpose: "attack outcome narration",
                messages: [{ role: "user", content: prompt }],
              }),
          });
        }
      } else {
        await startEncounter({
          campaignId,
          rawResponse,
          powerLevel: campaign.powerLevel,
          combatStyle: campaign.combatStyle,
          ruleset: campaign.ruleset,
          storage,
          rng: Math.random,
        });
      }

      const checkResolution = await resolveCheckTag({
        campaignId,
        rawResponse,
        storage,
        rng: Math.random,
        combatStyle: campaign.combatStyle,
        ruleset: campaign.ruleset,
        narrate: (prompt) =>
          deps.generateNarrationText({
            system: "You are DMS narrating the fixed outcome of a resolved dice roll. Do not restate the numbers; narrate only the consequence, in 2-4 sentences, matching the established DungeonMasterOS narration style.",
            maxTokens: 300,
            purpose: "check outcome narration",
            messages: [{ role: "user", content: prompt }],
          }),
      });

      // Emergent titles: parsed from the raw tagged response, same as the
      // other mechanics tags above — never from the cleaned narration shown
      // to the player. Deliberately no broadcast/system message on
      // establishment: the spec is explicit that the world's own narration
      // (an NPC organically using the name) IS the discovery moment, and a
      // mechanical "Title Established" notice would puncture that.
      processTitleTags(rawResponse, character.id, campaignId, storage);

      const attackNarration = attackResult && "narration" in attackResult ? attackResult.narration : undefined;

      // stripInternalTags wraps the whole selection, not just the cleanContent
      // branch: attackNarration/checkResolution.cleanContent are fresh AI
      // completions from a separate narrate() call, not derived from
      // rawResponse, so they can't contain a leftover tag from THIS
      // response — but they're still un-vetted model output, and this is
      // the single choke point finalContent passes through no matter which
      // branch wins. See server/internal-tag-guard.ts.
      const finalContent = stripInternalTags(
        attackNarration || checkResolution?.cleanContent || cleanContent?.trim() || buildFallbackActionResponse(character.name, content),
      );

      const dmMsg = storage.createMessage({
        campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: finalContent,
        messageType: "narration",
        metadata:
          attackResult && "narration" in attackResult
            ? JSON.stringify({
                roll: {
                  attacker: attackResult.attacker,
                  target: attackResult.target,
                  outcome: attackResult.outcome,
                  isCritical: attackResult.isCritical,
                  isFumble: attackResult.isFumble,
                  damageDealt: attackResult.damageDealt,
                },
              })
            : checkResolution
              ? JSON.stringify({ roll: checkResolution.rollData })
              : "{}",
      });

      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      broadcastToCampaign(campaignId, { type: "message", message: dmMsg });

      incrementTurnCount(req.user!.id);

      const historyForMemory = [...history, dmMsg];

      let npcTurnMessages: any[] = [];
      // Track the encounter id regardless of its current status — a status-filtered
      // lookup (storage.getActiveEncounterByCampaign) would miss an encounter this
      // very request just ended (e.g. the player's own attack landed the killing
      // blow), silently skipping the broadcast that tells other clients combat is over.
      const encounterIdInPlay = activeEncounterBefore?.id ?? storage.getActiveEncounterByCampaign(campaignId)?.id ?? null;

      if (encounterIdInPlay) {
        const encounterState = storage.getEncounter(encounterIdInPlay);
        if (encounterState?.status === "active") {
          const worldStateNow = parseCampaignWorldState(campaign.worldState);
          npcTurnMessages = await advanceAndResolveTurns(encounterIdInPlay, storage, {
            generateNpcAction: deps.generateNpcTurnAction,
            narrate: (prompt) =>
              deps.generateNarrationText({
                system: "You are DMS narrating the fixed outcome of an NPC's resolved combat action. Do not restate the numbers; narrate only the consequence, in 2-4 sentences, matching the established DungeonMasterOS narration style.",
                maxTokens: 300,
                purpose: "npc attack outcome narration",
                messages: [{ role: "user", content: prompt }],
              }),
            rng: Math.random,
            currentScene: formatCurrentSceneForPrompt(worldStateNow.currentScene),
            broadcast: (message) => broadcastToCampaign(campaignId, { type: "message", message }),
          });
        }

        broadcastToCampaign(campaignId, { type: "encounter_updated", encounterId: encounterIdInPlay });

        const encounterFinal = storage.getEncounter(encounterIdInPlay);
        if (encounterFinal?.status === "ended") {
          broadcastToCampaign(campaignId, { type: "encounter_ended", encounterId: encounterIdInPlay });
          // A "victory" ending always means the engine just awarded XP
          // (combat-engine's awardVictoryXp runs on every victory path) —
          // tell other connected clients to refetch their character sheets.
          if (encounterFinal.outcome === "victory") {
            broadcastToCampaign(campaignId, { type: "character_updated" });
          }
        }
      }

      // The player's own attack can be the one that ends the fight — in that
      // case advanceAndResolveTurns above never even runs (the encounter is
      // already "ended" by the time it checks), so the loop above never sees
      // it. Surface the XP system message from attackResult directly here.
      if (attackResult && "xpAwarded" in attackResult && attackResult.xpAwarded) {
        const xpMsg = storage.createMessage({
          campaignId,
          sender: "System",
          senderType: "system",
          content: `Victory! The party gains ${attackResult.xpAwarded.perCharacter} XP each.`,
          messageType: "system",
        });
        broadcastToCampaign(campaignId, { type: "message", message: xpMsg });
      }

      // This block used to be a detached Promise.all(...).then(...) fired
      // after the response was already queued, which meant withCampaignLock
      // released before these mutations actually landed — a fast second
      // submission on the same campaign could read pre-mutation inventory/
      // currency state (2026-08-18: found while reconciling an external
      // review's report against this codebase). Awaiting it here keeps the
      // mutation work inside the same lock scope as the request that
      // produced it, at the cost of the response waiting on it too — a
      // worthwhile trade since every extractor here is keyword-gated and
      // returns near-instantly on the (common) turn with nothing to extract.
      const campaignCurrenciesForExtraction = storage.getCampaignCurrencies(campaignId);
      try {
        const [newItems, newAbilities, lostItemIds, currencyChanges] = await Promise.all([
          extractItemsFromNarration(finalContent, campaignId, character.id, campaignCurrenciesForExtraction),
          extractAbilitiesFromNarration(finalContent, campaignId, character.id),
          extractLostItemsFromNarration(finalContent, character.id),
          extractCurrencyChangesFromNarration(finalContent, campaignCurrenciesForExtraction),
        ]);
        for (const newItem of newItems) {
          const created = storage.createItem(newItem);
          broadcastToCampaign(campaignId, { type: "item_granted", item: created });
        }
        if (newItems.length) {
          broadcastToCampaign(campaignId, { type: "items_updated", characterId: character.id });
        }

        for (const lostId of lostItemIds) {
          storage.deleteItem(lostId);
        }
        if (lostItemIds.length) {
          broadcastToCampaign(campaignId, { type: "items_updated", characterId: character.id });
        }

        // Server-side economic authority: a narration-inferred spend can never
        // take a character's balance below zero. The AI's prose is evidence
        // that a purchase happened, not permission to invent currency — if the
        // inferred amount would overdraw the real balance, the change is
        // rejected outright rather than applied and clamped. (2026-08-18:
        // this loop previously applied every inferred change unconditionally.)
        const acceptedCurrencyChanges: typeof currencyChanges = [];
        const rejectedCurrencyChanges: Array<{ currencyCode: string; amount: number; reason: string }> = [];
        for (const change of currencyChanges) {
          const balance = storage.getCharacterCurrency(character.id, change.currencyCode);
          const decision = resolveCurrencyChange(balance?.amount ?? 0, change.amount);
          if (!decision.accepted) {
            rejectedCurrencyChanges.push({ ...change, reason: decision.reason! });
            continue;
          }
          storage.adjustCharacterCurrency(campaignId, character.id, change.currencyCode, change.amount);
          acceptedCurrencyChanges.push(change);
        }
        if (acceptedCurrencyChanges.length) {
          broadcastToCampaign(campaignId, { type: "currencies_updated", characterId: character.id });
        }

        logAiMutations({
          campaignId,
          characterId: character.id,
          narrationMessageId: dmMsg.id,
          proposedItemGrants: newItems.length,
          acceptedItemGrants: newItems.length,
          proposedItemLosses: lostItemIds.length,
          acceptedItemLosses: lostItemIds.length,
          proposedCurrencyChanges: currencyChanges,
          acceptedCurrencyChanges,
          rejectedCurrencyChanges,
        });

        if (newAbilities.length > 0) {
          const freshChar = storage.getCharacter(character.id);
          if (freshChar) {
            try {
              const cd = JSON.parse((freshChar as any).characterData || "{}");
              if (!cd.sections) cd.sections = [];
              let abSec = cd.sections.find((s: any) => s.label === "Granted Abilities");
              if (!abSec) {
                abSec = { label: "Granted Abilities", entries: [] };
                cd.sections.push(abSec);
              }
              for (const ab of newAbilities) {
                if (!abSec.entries.find((e: any) => e.key === ab.name)) {
                  abSec.entries.push({ key: ab.name, value: `[${ab.category}] ${ab.description}` });
                }
              }
              storage.updateCharacter(character.id, { characterData: JSON.stringify(cd) } as any);
              broadcastToCampaign(campaignId, {
                type: "abilities_granted",
                characterId: character.id,
                abilities: newAbilities,
              });
              broadcastToCampaign(campaignId, { type: "character_updated", characterId: character.id });

              if (req.user) {
                const unlockedIds = storage.getUnlockedAchievementIds(req.user.id);
                tryUnlockAchievements(req.user.id, campaignId, character.id, {
                  type: "ability_granted",
                  unlockedIds,
                });
              }
            } catch {}
          }
        }

        const expired = storage.tickEffects(character.id);
        if (expired.length > 0) {
          broadcastToCampaign(campaignId, {
            type: "effects_updated",
            characterId: character.id,
            expired: expired.map((e) => ({ id: e.id, name: e.name })),
          });
          for (const e of expired) {
            const expMsg = storage.createMessage({
              campaignId,
              sender: "System",
              senderType: "system",
              content: `${character.name}'s **${e.name}** has expired.`,
              messageType: "system",
            });
            broadcastToCampaign(campaignId, { type: "message", message: expMsg });
          }
        }

        if (req.user) {
          const freshChar2 = storage.getCharacter(character.id);
          const unlockedIds = storage.getUnlockedAchievementIds(req.user.id);
          const dmFlags = scanDMResponseForAchievements(finalContent, {
            hp: freshChar2?.hp ?? character.hp,
            maxHp: freshChar2?.maxHp ?? character.maxHp,
          });
          const currentUser = storage.getUser(req.user.id);
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
            character: {
              id: character.id,
              hp: freshChar2?.hp ?? character.hp,
              maxHp: freshChar2?.maxHp ?? character.maxHp,
              establishedTitleCount: storage.getEstablishedTitleCount(character.id),
            },
            account: {
              totalLevelUps: currentUser?.totalLevelUps ?? 0,
              establishedTitleCount: storage.getEstablishedTitleCountForUser(req.user.id),
            },
            unlockedIds,
          });
        }

        queueCampaignMemoryRefresh(campaignId, chars, historyForMemory, finalContent);
      } catch (err) {
        console.error("Post-action extraction error:", err);
      }

      return res.json({ playerMessage: playerMsg, dmMessage: dmMsg, npcTurnMessages });
    } catch (error: any) {
      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      console.error("DM Engine error:", error);

      const aiIssue = getNarrationServiceIssue(error);
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
  }

  // `/action` has its own downstream dedup (createMessageIdempotent, inside
  // handleAction) that returns the original result without consuming a new
  // turn, so it's safe to let a replayed clientSubmissionId bypass the
  // turn-limit check here. `/start` has no such downstream dedup — it must
  // NOT be dedupAware, or a replayed submission id lets an over-quota user
  // trigger unlimited free opening-scene generations (final-review issue #1).
  app.post("/api/campaigns/:id/action", requireAuth, requireCanPlay, checkTurnLimit({ dedupAware: true }), async (req, res) => {
    const campaignId = Number(req.params.id);
    await withCampaignLock(campaignId, () => handleAction(req, res, campaignId));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBAT ROUTES
  // Direct player-triggered combat (Attack/Flee buttons), alongside the
  // existing narration-driven path in handleAction. Both share the same
  // combat-engine.ts state machine and Encounter row — a button click here
  // is just a deterministic alternative to the AI proposing an [ATTACK] tag,
  // never a second source of truth.
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/campaigns/:id/encounter", requireAuth, (req, res) => {
    const campaignId = Number(req.params.id);
    const encounter = storage.getActiveEncounterByCampaign(campaignId);
    if (!encounter) return res.json({ encounter: null, participants: [] });
    const participants = JSON.parse(encounter.participants);
    return res.json({ encounter, participants });
  });

  app.post("/api/campaigns/:id/combat/attack", requireAuth, requireCanPlay, checkTurnLimit(), async (req, res) => {
    const visitorId = getVisitorId(req);
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return res.status(403).json({ message: "You don't have a character in this campaign" });

    const encounter = storage.getActiveEncounterByCampaign(campaignId);
    if (!encounter) return res.status(400).json({ message: "There is no active encounter" });

    const participants = JSON.parse(encounter.participants);
    const current = participants[encounter.turnIndex];
    if (!current || current.type !== "character" || current.characterId !== character.id) {
      return res.status(409).json({ message: "It isn't your turn yet" });
    }

    const targetId = String(req.body?.targetParticipantId ?? "");
    const target = participants.find((p: any) => p.id === targetId);
    if (!target || target.type !== "character" && target.type !== "npc" || target.type === current.type || target.isDefeated || target.fled) {
      return res.status(400).json({ message: "Choose a valid target" });
    }

    const result = await executeAttack({
      encounterId: encounter.id,
      attacker: current,
      target,
      storage,
      rng: Math.random,
      narrate: (prompt) =>
        generateNarrationText({
          system: "You are DMS narrating the fixed outcome of a resolved combat action. Do not restate the numbers; narrate only the consequence, in 2-4 sentences, matching the established DungeonMasterOS narration style.",
          maxTokens: 300,
          purpose: "attack outcome narration",
          messages: [{ role: "user", content: prompt }],
        }),
    });

    const msg = storage.createMessage({
      campaignId,
      sender: "Dungeon Master",
      senderType: "dm",
      content: result.narration,
      messageType: "narration",
      metadata: JSON.stringify({
        roll: {
          attacker: result.attacker,
          target: result.target,
          outcome: result.outcome,
          isCritical: result.isCritical,
          isFumble: result.isFumble,
          damageDealt: result.damageDealt,
        },
      }),
    });
    broadcastToCampaign(campaignId, { type: "message", message: msg });

    incrementTurnCount(req.user!.id);

    broadcastToCampaign(campaignId, { type: "encounter_updated", encounterId: encounter.id });

    if (result.encounterEnded) {
      broadcastToCampaign(campaignId, { type: "encounter_ended", encounterId: encounter.id });
      if (result.xpAwarded) {
        broadcastToCampaign(campaignId, { type: "character_updated" });
        const xpMsg = storage.createMessage({
          campaignId,
          sender: "System",
          senderType: "system",
          content: `Victory! The party gains ${result.xpAwarded.perCharacter} XP each.`,
          messageType: "system",
        });
        broadcastToCampaign(campaignId, { type: "message", message: xpMsg });
      }
    } else {
      const worldStateNow = parseCampaignWorldState(campaign.worldState);
      const npcTurnMessages = await advanceAndResolveTurns(encounter.id, storage, {
        generateNpcAction: generateNpcTurnAction,
        narrate: (prompt) =>
          generateNarrationText({
            system: "You are DMS narrating the fixed outcome of an NPC's resolved combat action. Do not restate the numbers; narrate only the consequence, in 2-4 sentences, matching the established DungeonMasterOS narration style.",
            maxTokens: 300,
            purpose: "npc attack outcome narration",
            messages: [{ role: "user", content: prompt }],
          }),
        rng: Math.random,
        currentScene: formatCurrentSceneForPrompt(worldStateNow.currentScene),
        broadcast: (message) => broadcastToCampaign(campaignId, { type: "message", message }),
      });
      broadcastToCampaign(campaignId, { type: "encounter_updated", encounterId: encounter.id });
      const encounterFinal = storage.getEncounter(encounter.id);
      if (encounterFinal?.status === "ended") {
        broadcastToCampaign(campaignId, { type: "encounter_ended", encounterId: encounter.id });
        if (encounterFinal.outcome === "victory") {
          broadcastToCampaign(campaignId, { type: "character_updated" });
        }
      }
      void npcTurnMessages;
    }

    return res.json({ result });
  });

  app.post("/api/campaigns/:id/combat/flee", requireAuth, requireCanPlay, checkTurnLimit(), async (req, res) => {
    const visitorId = getVisitorId(req);
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return res.status(403).json({ message: "You don't have a character in this campaign" });

    const encounter = storage.getActiveEncounterByCampaign(campaignId);
    if (!encounter) return res.status(400).json({ message: "There is no active encounter" });

    const participants = JSON.parse(encounter.participants);
    const current = participants[encounter.turnIndex];
    if (!current || current.type !== "character" || current.characterId !== character.id) {
      return res.status(409).json({ message: "It isn't your turn yet" });
    }

    const fleeResult = fleeEncounter(encounter.id, current.name, storage);
    if (!fleeResult.fled) return res.status(400).json({ message: "Could not flee right now" });

    const msg = storage.createMessage({
      campaignId,
      sender: "System",
      senderType: "system",
      content: `${character.name} flees from the fight.`,
      messageType: "system",
    });
    broadcastToCampaign(campaignId, { type: "message", message: msg });

    incrementTurnCount(req.user!.id);

    broadcastToCampaign(campaignId, { type: "encounter_updated", encounterId: encounter.id });
    if (fleeResult.encounterEnded) {
      broadcastToCampaign(campaignId, { type: "encounter_ended", encounterId: encounter.id });
    } else {
      const worldStateNow = parseCampaignWorldState(campaign.worldState);
      await advanceAndResolveTurns(encounter.id, storage, {
        generateNpcAction: generateNpcTurnAction,
        narrate: (prompt) =>
          generateNarrationText({
            system: "You are DMS narrating the fixed outcome of an NPC's resolved combat action. Do not restate the numbers; narrate only the consequence, in 2-4 sentences, matching the established DungeonMasterOS narration style.",
            maxTokens: 300,
            purpose: "npc attack outcome narration",
            messages: [{ role: "user", content: prompt }],
          }),
        rng: Math.random,
        currentScene: formatCurrentSceneForPrompt(worldStateNow.currentScene),
        broadcast: (message) => broadcastToCampaign(campaignId, { type: "message", message }),
      });
      broadcastToCampaign(campaignId, { type: "encounter_updated", encounterId: encounter.id });
      const encounterFinal = storage.getEncounter(encounter.id);
      if (encounterFinal?.status === "ended") {
        broadcastToCampaign(campaignId, { type: "encounter_ended", encounterId: encounter.id });
      }
    }

    return res.json({ fled: true });
  });

  app.post("/api/campaigns/:id/start", requireAuth, requireCanPlay, checkTurnLimit(), async (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const chars = storage.getCharactersByCampaign(campaignId);
    if (chars.length === 0) return res.status(400).json({ message: "Need at least one character to start" });

    try {
      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: true });

      logDmGenerationContext({
        purpose: "opening_scene",
        campaignId,
        chars,
        triggerMessageId: null,
        sceneText: campaign.worldState,
        combatActive: false,
      });

      const rawResponse = await generateOpeningScene(
        campaign,
        chars,
        storage.getCampaignCurrencies(campaignId),
        buildPartyInventorySnapshots(chars),
      );
      const { cleanContent, worldState } = extractWorldState(rawResponse);

      if (worldState) {
        const merged = mergeCampaignWorldState(campaign.worldState, worldState);
        storage.updateWorldState(campaignId, JSON.stringify(merged));
      }

      const finalContent = cleanContent?.trim() || buildFallbackOpeningScene(campaign.name, chars);

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

      incrementTurnCount(req.user!.id);

      queueCampaignMemoryRefresh(campaignId, chars, [dmMsg], finalContent);

      return res.json({ message: dmMsg });
    } catch (error: any) {
      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      console.error("Opening scene error:", error);

      const aiIssue = getNarrationServiceIssue(error);
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
    if (url.pathname === "/ws" || url.pathname.endsWith("/ws")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws) => {
    let subscribedCampaignId: number | null = null;

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === "subscribe" && data.campaignId) {
          if (subscribedCampaignId !== null) {
            campaignClients.get(subscribedCampaignId)?.delete(ws);
          }
          const nextCampaignId = Number(data.campaignId);
          if (!Number.isInteger(nextCampaignId)) {
            return;
          }
          subscribedCampaignId = nextCampaignId;
          if (!campaignClients.has(nextCampaignId)) {
            campaignClients.set(nextCampaignId, new Set());
          }
          campaignClients.get(nextCampaignId)!.add(ws);
          if (data.userId) (ws as any)._userId = data.userId;
          ws.send(JSON.stringify({ type: "subscribed", campaignId: subscribedCampaignId }));
        }
      } catch {}
    });

    ws.on("close", () => {
      if (subscribedCampaignId !== null) {
        campaignClients.get(subscribedCampaignId)?.delete(ws);
      }
    });
  });

  (registerRoutes as any).handleAction = handleAction;
  (registerRoutes as any).handleFlee = handleFlee;

  return httpServer;
}
