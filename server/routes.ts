import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import {
  generateDMResponse,
  generateOpeningScene,
  extractWorldState,
  extractCombatStart,
  extractSurrender,
  narrateCombatResult,
  type ProposedCombatant,
} from "./dm-engine";
import { resolveAttack, defaultAttackBonusForLevel, defaultArmorClassForLevel } from "./combat-engine";
import type { Campaign, Character } from "@shared/schema";
import {
  createCampaignFormSchema,
  createCharacterFormSchema,
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
import { TIERS, TURN_PACKS, TRIAL_DAYS, type TierName } from "../shared/tiers";
import { ACHIEVEMENT_MAP, checkAchievements, scanDMResponseForAchievements } from "../shared/achievements";

// ── Clients ────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT ORCHESTRATION
// The DM proposes encounters/surrenders via structured tags; everything
// here is the server's own mechanical authority — see combat-engine.ts's
// file header for why this uses simplified, level-derived numbers rather
// than full 3.5e BAB/AC math.
// ─────────────────────────────────────────────────────────────────────────────

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function startEncounterIfProposed(
  campaignId: number,
  proposedCombatants: ProposedCombatant[] | null,
  chars: Character[],
): Promise<void> {
  if (!proposedCombatants || proposedCombatants.length === 0) return;
  if (storage.getActiveEncounter(campaignId)) return; // never stack a second encounter

  const encounter = storage.createEncounter({
    campaignId,
    status: "active",
    round: 1,
    currentTurnIndex: 0,
  });

  let turnOrder = 0;
  for (const char of chars) {
    if (char.hp <= 0) continue; // an already-downed character doesn't join the fight
    storage.createCombatant({
      encounterId: encounter.id,
      kind: "player",
      characterId: char.id,
      name: char.name,
      hp: char.hp,
      maxHp: char.maxHp,
      attackBonus: defaultAttackBonusForLevel(char.level),
      armorClass: defaultArmorClassForLevel(char.level),
      damageDie: "1d6",
      initiative: 0,
      turnOrder: turnOrder++,
      isDefeated: false,
      hasFled: false,
    });
  }
  for (const proposed of proposedCombatants) {
    const hp = clampInt(proposed.hp, 1, 500);
    const damageDie = proposed.damageDie && /^\d+d\d+(\s*[+-]\s*\d+)?$/i.test(proposed.damageDie)
      ? proposed.damageDie
      : "1d6";
    storage.createCombatant({
      encounterId: encounter.id,
      kind: "npc",
      characterId: null,
      name: proposed.name,
      hp,
      maxHp: hp,
      attackBonus: clampInt(proposed.attackBonus ?? 3, 0, 20),
      armorClass: clampInt(proposed.armorClass ?? 12, 5, 40),
      damageDie,
      initiative: 0,
      turnOrder: turnOrder++,
      isDefeated: false,
      hasFled: false,
    });
  }

  broadcastToCampaign(campaignId, { type: "combat_started", encounterId: encounter.id });
}

function applySurrenderIfProposed(campaignId: number, surrenderedName: string | null): void {
  if (!surrenderedName) return;
  const encounter = storage.getActiveEncounter(campaignId);
  if (!encounter) return;
  const combatant = storage
    .getCombatantsByEncounter(encounter.id)
    .find(
      (c) =>
        c.kind === "npc" &&
        !c.isDefeated &&
        !c.hasFled &&
        c.name.toLowerCase() === surrenderedName.toLowerCase(),
    );
  if (!combatant) return;
  storage.updateCombatant(combatant.id, { hasFled: true });
  broadcastToCampaign(campaignId, { type: "combat_updated", encounterId: encounter.id });
}

function checkEncounterEndReason(encounterId: number): "victory" | "defeat" | "flee" | null {
  const combatants = storage.getCombatantsByEncounter(encounterId);
  const players = combatants.filter((c) => c.kind === "player");
  const activePlayers = players.filter((c) => !c.isDefeated && !c.hasFled);
  const activeNpcs = combatants.filter((c) => c.kind === "npc" && !c.isDefeated && !c.hasFled);
  if (activePlayers.length === 0) {
    // Distinguish "everyone ran" from "everyone was struck down" -- both
    // clear the encounter, but they mean very different things for any
    // future feature (achievements, campaign history) reading endReason.
    return players.some((c) => c.isDefeated) ? "defeat" : "flee";
  }
  if (activeNpcs.length === 0) return "victory";
  return null;
}

function endEncounter(encounterId: number, campaignId: number, reason: string): void {
  storage.updateEncounter(encounterId, {
    status: "ended",
    endReason: reason,
    endedAt: new Date().toISOString(),
  });
  broadcastToCampaign(campaignId, { type: "combat_ended", encounterId, reason });
}

// Auto-resolves NPC turns until it's a player's turn or the fight ends.
// Never invents an outcome — every hit/miss/damage number comes from
// combat-engine.ts's dice functions; the AI is only asked to narrate a
// result already decided.
async function advanceCombatTurns(campaignId: number, campaign: Campaign, chars: Character[]): Promise<void> {
  let encounter = storage.getActiveEncounter(campaignId);
  if (!encounter) return;

  for (let guard = 0; guard < 50; guard++) {
    const endReason = checkEncounterEndReason(encounter.id);
    if (endReason) {
      endEncounter(encounter.id, campaignId, endReason);
      return;
    }

    const combatants = storage.getCombatantsByEncounter(encounter.id).filter((c) => !c.isDefeated && !c.hasFled);
    if (combatants.length === 0) return;

    const current = combatants[encounter.currentTurnIndex % combatants.length];
    if (current.kind === "player") return; // wait for the player's real action

    const activePlayers = combatants.filter((c) => c.kind === "player");
    if (activePlayers.length === 0) {
      endEncounter(encounter.id, campaignId, "defeat");
      return;
    }
    const target = activePlayers[Math.floor(Math.random() * activePlayers.length)];

    const result = resolveAttack(current.attackBonus, target.armorClass, current.damageDie);
    if (result.hit) {
      const newHp = Math.max(0, target.hp - result.damage);
      storage.updateCombatant(target.id, { hp: newHp, isDefeated: newHp <= 0 });
      if (target.characterId) {
        storage.updateCharacter(target.characterId, { hp: newHp });
        broadcastToCampaign(campaignId, { type: "character_updated", characterId: target.characterId });
      }
    }

    const summary = `${current.name} attacks ${target.name}: d20 roll ${result.attackRoll} + attack bonus ${current.attackBonus} = ${result.attackTotal} vs armor class ${target.armorClass} -> ${
      result.hit ? `HIT for ${result.damage} damage` : "MISS"
    }${result.critical ? " (natural 20, critical hit)" : ""}${result.fumble ? " (natural 1, fumble)" : ""}.`;

    let narration: string;
    try {
      narration = await narrateCombatResult(campaign, chars, summary);
    } catch {
      narration = summary;
    }

    const msg = storage.createMessage({
      campaignId,
      sender: "Dungeon Master",
      senderType: "dm",
      content: narration,
      messageType: "narration",
    });
    broadcastToCampaign(campaignId, { type: "message", message: msg });
    broadcastToCampaign(campaignId, { type: "combat_updated", encounterId: encounter.id });

    const beforeAdvance = storage.getEncounter(encounter.id);
    if (!beforeAdvance) return;
    storage.updateEncounter(encounter.id, { currentTurnIndex: beforeAdvance.currentTurnIndex + 1 });
    encounter = storage.getEncounter(encounter.id)!;
  }
}

function getAIServiceIssue(error: unknown): { title: string; detail: string } | null {
  const status = Number((error as any)?.status);
  const message = String((error as any)?.message || "");

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
      model: ANTHROPIC_MODEL,
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
): Promise<any[]> {
  const grantKeywords =
    /\b(gives?|hands?|grants?|receives?|finds?|picks? up|obtains?|discovers?|rewards?|loot|opens? .{0,20}chest|inside .{0,20}(bag|chest|pack|pouch)|tucks? .{0,30}(into|away)|presses? .{0,20}into|slips? .{0,20}(into|to)|places? .{0,20}in your hand|passes? .{0,20}to you)\b/i;
  if (!grantKeywords.test(narration)) return [];

  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
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
    "identified": true or false (false if it's mysterious, glowing, unexamined, or described vaguely),
    "weight": realistic weight of ONE unit in pounds (a dagger is about 1, a suit of plate armor about 50, a gold coin about 0.02, a house/wagon/mount/vessel/property/creature/retainer is 0)
  }
]

Rules:
- Currency mentioned (gold, coins, silver) = itemType "currency"
- Potions, scrolls, bombs = consumable true
- Weapons, armor = consumable false
- If the item seems magical but its nature is unclear = identified false
- Property, vehicles, vessels, mounts, and creatures are not physically carried — their weight must be 0
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
        charges: null,
        maxCharges: null,
        identified: item.identified !== false,
        consumable: !!item.consumable,
        equipped: false,
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
  app.use(attachUser);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

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

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = parseInt(session.metadata?.userId || "0");
          const tier = session.metadata?.tier as TierName | undefined;
          const interval = session.metadata?.interval as string | undefined;
          const topUpTurns = parseInt(session.metadata?.topUpTurns || "0");

          if (!userId) break;

          if (topUpTurns > 0) {
            const user = storage.getUser(userId);
            if (user) {
              storage.updateUser(userId, {
                bonusTurns: (user.bonusTurns ?? 0) + topUpTurns,
              } as any);
            }
          } else if (tier && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            const periodEnd = new Date((sub as any).current_period_end * 1000);

            storage.updateUser(userId, {
              tier,
              subscriptionStatus: "active",
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              stripePriceId: (sub.items.data[0]?.price?.id) || null,
              stripeBillingInterval: interval || "monthly",
              subscriptionCurrentPeriodEnd: periodEnd.toISOString(),
            } as any);
          }
          break;
        }

        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const user = storage.getUserByStripeSubscriptionId(sub.id);
          if (!user) break;

          const periodEnd = new Date((sub as any).current_period_end * 1000);
          let status: string = "active";

          if (sub.status === "past_due") status = "past_due";
          else if (sub.status === "canceled") status = "cancelled";
          else if (sub.status === "unpaid") status = "expired";
          else if (sub.status === "active") status = "active";

          let tier: TierName = user.tier as TierName;
          const priceId = sub.items.data[0]?.price?.id;
          if (priceId) {
            for (const [tierName, tierDef] of Object.entries(TIERS)) {
              if (
                (tierDef.stripePriceIdMonthly && process.env[tierDef.stripePriceIdMonthly] === priceId) ||
                (tierDef.stripePriceIdWeekly && process.env[tierDef.stripePriceIdWeekly] === priceId) ||
                (tierDef.stripePriceIdYearly && process.env[tierDef.stripePriceIdYearly] === priceId)
              ) {
                tier = tierName as TierName;
                break;
              }
            }
          }

          storage.updateUser(user.id, {
            tier,
            subscriptionStatus: status,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId || null,
            subscriptionCurrentPeriodEnd: periodEnd.toISOString(),
          } as any);
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const user = storage.getUserByStripeSubscriptionId(sub.id);
          if (!user) break;

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
          if (!invoice.subscription) break;
          const user = storage.getUserByStripeSubscriptionId(invoice.subscription as string);
          if (!user) break;
          storage.updateUser(user.id, { subscriptionStatus: "past_due" } as any);
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          if (!invoice.subscription) break;
          const user = storage.getUserByStripeSubscriptionId(invoice.subscription as string);
          if (!user) break;
          const nextReset = new Date();
          nextReset.setMonth(nextReset.getMonth() + 1);
          nextReset.setDate(1);
          nextReset.setHours(0, 0, 0, 0);
          storage.updateUser(user.id, {
            subscriptionStatus: "active",
            aiTurnsUsedThisMonth: 0,
            usageResetAt: nextReset.toISOString(),
          } as any);
          break;
        }

        default:
          break;
      }
    } catch (err: any) {
      console.error("Error processing Stripe webhook:", err);
    }

    return res.json({ received: true });
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

  app.post("/api/stripe/topup", requireAuth, requireCanPlay, async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe is not configured." });

    const { packId } = req.body;
    if (!packId) return res.status(400).json({ message: "packId is required." });

    const user = req.user!;
    const tier = user.tier as TierName;
    const pack = TURN_PACKS.find((p) => p.id === packId);
    if (!pack) return res.status(400).json({ message: "Invalid pack." });
    if (pack.prices[tier] === null) {
      return res.status(403).json({ message: "Subscribe first to purchase turn top-ups." });
    }

    const priceId = getTopUpPriceId(packId, tier);
    if (!priceId) {
      return res.status(400).json({
        message: `Top-up pricing for this pack is not configured. Contact support.`,
      });
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
        success_url: `${appUrl}/#/dashboard?topup=1`,
        cancel_url: `${appUrl}/#/dashboard`,
        metadata: {
          userId: String(user.id),
          topUpTurns: String(pack.turns),
          packId,
        },
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe topup error:", err);
      return res.status(500).json({ message: "Failed to create top-up checkout." });
    }
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
    const info: any = {
      tier: user.tier,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      stripeBillingInterval: user.stripeBillingInterval,
      aiTurnsUsedThisMonth: user.aiTurnsUsedThisMonth,
      bonusTurns: user.bonusTurns ?? 0,
      hasStripe: !!user.stripeCustomerId,
      hasSubscription: !!user.stripeSubscriptionId,
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
    const campaign = storage.createCampaign({
      ...parsed.data,
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
    });

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

  // Frontend currently expects these endpoints.
  // Return safe empty data instead of pointless 404 spam.
  app.get("/api/campaigns/:id/currencies", (_req, res) => {
    return res.json([]);
  });

  app.get("/api/campaigns/:id/shop", (_req, res) => {
    return res.json({ shop: null, items: [] });
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

  app.get("/api/characters/:characterId/currencies", (_req, res) => {
    return res.json([]);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ITEM ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/characters/:characterId/items", (req, res) => {
    return res.json(storage.getItemsByCharacter(Number(req.params.characterId)));
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
      statMods = "[]", weight = 0, carried = true,
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
      "identified", "consumable", "equipped", "locationNote", "trueName", "trueDescription", "statMods",
      "weight", "carried",
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
    return res.json(storage.getItem(itemId));
  });

  app.post("/api/items/:id/use", async (req, res) => {
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

      const rawResponse = await generateDMResponse(campaign, chars, history, useAction, character.name);
      const { cleanContent, worldState } = extractWorldState(rawResponse);

      if (worldState) {
        try {
          const current = JSON.parse(campaign.worldState || "{}");
          storage.updateWorldState(item.campaignId, JSON.stringify({ ...current, ...worldState }));
        } catch {}
      }

      const newItems = await extractItemsFromNarration(cleanContent, item.campaignId, item.characterId);
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

      if (req.user) incrementTurnCount(req.user.id);
    } catch (err) {
      broadcastToCampaign(item.campaignId, { type: "dm_thinking", thinking: false });
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

  app.post("/api/campaigns/:id/action", requireAuth, requireCanPlay, checkTurnLimit, async (req, res) => {
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

      const rawResponse = await generateDMResponse(
        campaign,
        chars,
        history,
        content,
        character.name,
      );

      const { cleanContent: contentAfterWorldState, worldState } = extractWorldState(rawResponse);

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

      const { cleanContent: contentAfterCombatStart, combatants: proposedCombatants } =
        extractCombatStart(contentAfterWorldState);
      const { cleanContent, surrenderedName } = extractSurrender(contentAfterCombatStart);

      const finalContent = cleanContent?.trim() || buildFallbackActionResponse(character.name, content);

      const dmMsg = storage.createMessage({
        campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: finalContent,
        messageType: "narration",
      });

      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      broadcastToCampaign(campaignId, { type: "message", message: dmMsg });

      incrementTurnCount(req.user!.id);

      (async () => {
        const chars = storage.getCharactersByCampaign(campaignId);
        await startEncounterIfProposed(campaignId, proposedCombatants, chars);
        applySurrenderIfProposed(campaignId, surrenderedName);
        await advanceCombatTurns(campaignId, campaign, chars);
      })().catch((err) => console.error("Combat orchestration error:", err));

      Promise.all([
        extractItemsFromNarration(finalContent, campaignId, character.id),
        extractAbilitiesFromNarration(finalContent, campaignId, character.id),
      ]).then(([newItems, newAbilities]) => {
        for (const newItem of newItems) {
          const created = storage.createItem(newItem);
          broadcastToCampaign(campaignId, { type: "item_granted", item: created });
        }
        if (newItems.length) {
          broadcastToCampaign(campaignId, { type: "items_updated", characterId: character.id });
        }

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
      }).catch((err) => console.error("Post-action extraction error:", err));

      return res.json({ playerMessage: playerMsg, dmMessage: dmMsg });
    } catch (error: any) {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBAT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/campaigns/:id/encounter", requireAuth, (req, res) => {
    const campaignId = Number(req.params.id);
    const encounter = storage.getActiveEncounter(campaignId);
    if (!encounter) return res.json({ encounter: null, combatants: [] });
    const combatants = storage.getCombatantsByEncounter(encounter.id);
    return res.json({ encounter, combatants });
  });

  app.post("/api/campaigns/:id/combat/attack", requireAuth, requireCanPlay, checkTurnLimit, async (req, res) => {
    const visitorId = getVisitorId(req);
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return res.status(403).json({ message: "You don't have a character in this campaign" });

    const encounter = storage.getActiveEncounter(campaignId);
    if (!encounter) return res.status(400).json({ message: "There is no active encounter" });

    const combatants = storage.getCombatantsByEncounter(encounter.id).filter((c) => !c.isDefeated && !c.hasFled);
    const attacker = combatants.find((c) => c.kind === "player" && c.characterId === character.id);
    if (!attacker) return res.status(403).json({ message: "Your character isn't in this fight" });

    const current = combatants[encounter.currentTurnIndex % combatants.length];
    if (current.id !== attacker.id) {
      return res.status(409).json({ message: "It isn't your turn yet" });
    }

    const targetId = Number(req.body?.targetCombatantId);
    const target = combatants.find((c) => c.id === targetId && c.kind === "npc");
    if (!target) return res.status(400).json({ message: "Choose a valid target" });

    const result = resolveAttack(attacker.attackBonus, target.armorClass, attacker.damageDie);
    if (result.hit) {
      const newHp = Math.max(0, target.hp - result.damage);
      storage.updateCombatant(target.id, { hp: newHp, isDefeated: newHp <= 0 });
    }

    const summary = `${attacker.name} attacks ${target.name}: d20 roll ${result.attackRoll} + attack bonus ${attacker.attackBonus} = ${result.attackTotal} vs armor class ${target.armorClass} -> ${
      result.hit ? `HIT for ${result.damage} damage` : "MISS"
    }${result.critical ? " (natural 20, critical hit)" : ""}${result.fumble ? " (natural 1, fumble)" : ""}.`;

    let narration: string;
    try {
      narration = await narrateCombatResult(campaign, storage.getCharactersByCampaign(campaignId), summary);
    } catch {
      narration = summary;
    }

    const msg = storage.createMessage({
      campaignId,
      sender: "Dungeon Master",
      senderType: "dm",
      content: narration,
      messageType: "narration",
    });
    broadcastToCampaign(campaignId, { type: "message", message: msg });

    const afterAttack = storage.getEncounter(encounter.id);
    if (afterAttack) {
      storage.updateEncounter(encounter.id, { currentTurnIndex: afterAttack.currentTurnIndex + 1 });
    }
    broadcastToCampaign(campaignId, { type: "combat_updated", encounterId: encounter.id });

    incrementTurnCount(req.user!.id);

    const chars = storage.getCharactersByCampaign(campaignId);
    await advanceCombatTurns(campaignId, campaign, chars);

    return res.json({ result });
  });

  app.post("/api/campaigns/:id/combat/flee", requireAuth, requireCanPlay, checkTurnLimit, async (req, res) => {
    const visitorId = getVisitorId(req);
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return res.status(403).json({ message: "You don't have a character in this campaign" });

    const encounter = storage.getActiveEncounter(campaignId);
    if (!encounter) return res.status(400).json({ message: "There is no active encounter" });

    const combatant = storage
      .getCombatantsByEncounter(encounter.id)
      .find((c) => c.kind === "player" && c.characterId === character.id && !c.isDefeated && !c.hasFled);
    if (!combatant) return res.status(403).json({ message: "Your character isn't in this fight" });

    storage.updateCombatant(combatant.id, { hasFled: true });

    const msg = storage.createMessage({
      campaignId,
      sender: "System",
      senderType: "system",
      content: `${character.name} flees from the fight.`,
      messageType: "system",
    });
    broadcastToCampaign(campaignId, { type: "message", message: msg });
    broadcastToCampaign(campaignId, { type: "combat_updated", encounterId: encounter.id });

    incrementTurnCount(req.user!.id);

    const chars = storage.getCharactersByCampaign(campaignId);
    await advanceCombatTurns(campaignId, campaign, chars);

    return res.json({ fled: true });
  });

  app.post("/api/campaigns/:id/start", requireAuth, requireCanPlay, checkTurnLimit, async (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const chars = storage.getCharactersByCampaign(campaignId);
    if (chars.length === 0) return res.status(400).json({ message: "Need at least one character to start" });

    try {
      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: true });

      const rawResponse = await generateOpeningScene(campaign, chars);
      const { cleanContent, worldState } = extractWorldState(rawResponse);

      if (worldState) {
        storage.updateWorldState(campaignId, JSON.stringify(worldState));
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

      return res.json({ message: dmMsg });
    } catch (error: any) {
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
    if (url.pathname === "/ws") {
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

  return httpServer;
}
