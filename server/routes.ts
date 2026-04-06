import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";

import { storage } from "./storage";
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
  createShopItemSchema,
  buyShopItemSchema,
  adjustCurrencySchema,
  type CampaignCurrencyDefinition,
  type InsertItem,
} from "../shared/schema";

import {
  attachUser,
  requireAuth,
  requireCanPlay,
  allowReadOnlyForExpired,
  checkCampaignLimit,
  checkTurnLimit,
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  incrementTurnCount,
  toPublicUser,
} from "./auth";

// ─────────────────────────────────────────────────────────────────────────────
// AI CLIENT
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

const campaignClients = new Map<number, Set<WebSocket>>();

function broadcastToCampaign(campaignId: number, data: any) {
  const clients = campaignClients.get(campaignId);
  if (!clients) return;
  const payload = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function getVisitorId(req: Request): string {
  if ((req as any).user?.id) return `user-${(req as any).user.id}`;
  return ((req.headers["x-visitor-id"] as string) || `anon-${randomBytes(8).toString("hex")}`);
}

function getPrimaryCurrencyCode(campaignId: number): string | null {
  const currencies = storage.getCampaignCurrencies(campaignId);
  if (!currencies.length) return null;
  return currencies.find((c) => c.isPrimary)?.code || currencies[0].code;
}

function autoSnapshotIfNeeded(campaignId: number, reason: string, triggerMessageId?: number) {
  const count = storage.countMessagesByCampaign(campaignId);
  if (count === 0) return;
  if (count % 10 !== 0 && reason !== "manual" && reason !== "shop") return;

  const snapshot = storage.buildCampaignSnapshot(campaignId);
  if (!snapshot) return;

  storage.createCampaignSnapshot({
    campaignId,
    label: `Auto Save ${new Date().toLocaleString()}`,
    reason,
    triggerMessageId,
    snapshotData: JSON.stringify(snapshot),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AI EXTRACTION HELPERS
// These convert narration into actual state changes instead of leaving them
// trapped inside pretty prose like decorative lies.
// ─────────────────────────────────────────────────────────────────────────────

async function extractAbilitiesFromNarration(
  narration: string,
): Promise<Array<{ name: string; description: string; category: string }>> {
  const grantKeywords =
    /\b(learns?|gains? the ability|gains? access to|awakens?|unlocks?|masters?|receives? the|is granted|manifests?|activates?|teaches? you|your body remembers|bestow[sd]?|acquire[sd]?)\b/i;

  if (!grantKeywords.test(narration)) return [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: `You extract NEWLY GRANTED abilities from RPG narration.

Return ONLY a JSON array:
[
  {
    "name": "Ability Name",
    "description": "Short practical description",
    "category": "spell|jutsu|devil_fruit|isekai_skill|racial|class_feature|homebrew|passive|active|transformation"
  }
]

Rules:
- Only include abilities newly gained RIGHT NOW
- Do not include pre-existing abilities
- Return [] if none
- Return JSON only`,
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
): Promise<Array<{
  name: string;
  description: string;
  itemType: string;
  quantity: number;
  consumable: boolean;
  identified: boolean;
}>> {
  const itemKeywords =
    /\b(finds?|found|loot|loots?|takes?|taken|receives?|given|hands? you|rewarded|inside .* chest|inside .* pouch|you pocket|you keep|you recover|you acquire|you now have)\b/i;

  if (!itemKeywords.test(narration)) return [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 700,
      system: `Extract item acquisitions from RPG narration.

Return ONLY a JSON array:
[
  {
    "name": "Item Name",
    "description": "Short item description",
    "itemType": "weapon|armor|consumable|gear|tool|magic|misc|property|vehicle|vessel|mount|creature|retainer|key",
    "quantity": 1,
    "consumable": false,
    "identified": true
  }
]

Rules:
- ONLY include things the player now owns or clearly takes
- Do NOT include scenery or things merely mentioned
- Currency should NOT be included here
- Return [] if nothing was acquired
- Return JSON only`,
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

async function extractCurrencyChangesFromNarration(
  narration: string,
  campaignId: number,
): Promise<Array<{ currencyCode: string; amountDelta: number }>> {
  const currencies = storage.getCampaignCurrencies(campaignId);
  if (!currencies.length) return [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: `Extract currency gains or losses from RPG narration.

Campaign currencies:
${currencies.map((c) => `- ${c.code}: ${c.name} ${c.symbol ? `(${c.symbol})` : ""}`).join("\n")}

Return ONLY a JSON array:
[
  {
    "currencyCode": "gold",
    "amountDelta": 50
  }
]

Rules:
- Positive = gained
- Negative = spent/lost/paid
- Only use one of the listed campaign currency codes
- Return [] if no currency changed
- Do NOT invent exchange rates
- Return JSON only`,
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

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(attachUser);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { email, username, password } = parsed.data;

    if (storage.getUserByEmail(email)) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    if (storage.getUserByUsername(username)) {
      return res.status(409).json({ message: "This username is already taken." });
    }

    const passwordHash = await hashPassword(password);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

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
      unlimitedTurns: false,
      isAdmin: false,
    } as any);

    setSessionCookie(res, user.id);
    return res.status(201).json({ user: toPublicUser(user) });
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
    return res.json({ user: toPublicUser((req as any).user!) });
  });

  app.post("/api/auth/complete-onboarding", requireAuth, (req, res) => {
    storage.updateUser((req as any).user!.id, { onboardingComplete: true } as any);
    return res.json({ ok: true });
  });

  app.get("/api/billing", requireAuth, (req, res) => {
    const user = (req as any).user!;
    return res.json({
      tier: user.tier,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      stripeBillingInterval: user.stripeBillingInterval,
      aiTurnsUsedThisMonth: user.aiTurnsUsedThisMonth,
      bonusTurns: user.bonusTurns ?? 0,
      unlimitedTurns: user.unlimitedTurns ?? false,
    });
  });

  app.get("/api/my-campaigns", requireAuth, (req, res) => {
    return res.json(storage.getCampaignsByUser((req as any).user!.id));
  });

  app.get("/api/achievements", requireAuth, (req, res) => {
    return res.json(storage.getUserAchievements((req as any).user!.id));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMPAIGNS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/campaigns", requireAuth, requireCanPlay, checkCampaignLimit, (req, res) => {
    const parsed = createCampaignFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const inviteCode = randomBytes(4).toString("hex");

    const campaign = storage.createCampaign({
      name: parsed.data.name,
      inviteCode,
      hostVisitorId: getVisitorId(req),
      userId: (req as any).user!.id,
      tone: parsed.data.tone,
      rulesWeight: parsed.data.rulesWeight,
      powerLevel: parsed.data.powerLevel,
      worldType: parsed.data.worldType,
      combatStyle: parsed.data.combatStyle,
      storyMode: parsed.data.storyMode,
      worldGenStyle: parsed.data.worldGenStyle,
      homebrewRules: parsed.data.homebrewRules,
      customWorldPrompt: parsed.data.customWorldPrompt,
      epicMode: parsed.data.epicMode,
      animeWorldSource: parsed.data.animeWorldSource,
      animeWorldMode: parsed.data.animeWorldMode,
      worldState: JSON.stringify({
        locations: [],
        npcs: [],
        factions: [],
        flags: [],
        currentScene: "",
      }),
      totalMessages: 0,
      isArchived: false,
    } as any);

    const currencies = parsed.data.currencies.map((c: CampaignCurrencyDefinition) => ({
      campaignId: campaign.id,
      code: c.code.trim().toLowerCase(),
      name: c.name.trim(),
      symbol: c.symbol?.trim() || "",
      isPrimary: !!c.isPrimary,
      exchangeRate: c.exchangeRate ?? 1,
    }));

    storage.replaceCampaignCurrencies(campaign.id, currencies);

    const snapshot = storage.buildCampaignSnapshot(campaign.id);
    if (snapshot) {
      storage.createCampaignSnapshot({
        campaignId: campaign.id,
        label: "Initial Campaign State",
        reason: "manual",
        snapshotData: JSON.stringify(snapshot),
      });
    }

    return res.status(201).json(campaign);
  });

  app.get("/api/campaigns/:id", allowReadOnlyForExpired, (req, res) => {
    const campaign = storage.getCampaign(Number(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    return res.json(campaign);
  });

  app.get("/api/campaigns/invite/:code", allowReadOnlyForExpired, (req, res) => {
    const campaign = storage.getCampaignByInviteCode(req.params.code);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    return res.json(campaign);
  });

  app.get("/api/campaigns/:id/currencies", allowReadOnlyForExpired, (req, res) => {
    return res.json(storage.getCampaignCurrencies(Number(req.params.id)));
  });

  app.patch("/api/campaigns/:id", requireAuth, allowReadOnlyForExpired, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const visitorId = getVisitorId(req);
    if (campaign.hostVisitorId !== visitorId && campaign.userId !== (req as any).user!.id) {
      return res.status(403).json({ message: "Only the host can update this campaign." });
    }

    const allowed = [
      "name",
      "tone",
      "rulesWeight",
      "powerLevel",
      "worldType",
      "combatStyle",
      "storyMode",
      "worldGenStyle",
      "homebrewRules",
      "customWorldPrompt",
      "epicMode",
      "animeWorldSource",
      "animeWorldMode",
      "isArchived",
    ];

    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if ((req.body as any)[key] !== undefined) updates[key] = (req.body as any)[key];
    }

    const updated = storage.updateCampaign(campaignId, updates);
    broadcastToCampaign(campaignId, { type: "campaign_updated", campaign: updated });

    return res.json(updated);
  });

  app.patch("/api/campaigns/:id/archive", requireAuth, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== (req as any).user!.id) return res.status(403).json({ message: "Not your campaign" });

    const archive = !!req.body.archive;
    const updated = storage.updateCampaign(campaignId, { isArchived: archive } as any);
    return res.json(updated);
  });

  app.get("/api/campaigns/:id/snapshots", requireAuth, (req, res) => {
    const campaign = storage.getCampaign(Number(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== (req as any).user!.id && !(req as any).user!.isAdmin) {
      return res.status(403).json({ message: "Not allowed" });
    }

    return res.json(storage.getCampaignSnapshots(campaign.id));
  });

  app.post("/api/campaigns/:id/snapshots", requireAuth, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== (req as any).user!.id && !(req as any).user!.isAdmin) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const snapshot = storage.buildCampaignSnapshot(campaignId);
    if (!snapshot) return res.status(404).json({ message: "Could not build snapshot" });

    const created = storage.createCampaignSnapshot({
      campaignId,
      label: req.body.label?.trim() || "Manual Save Point",
      reason: "manual",
      snapshotData: JSON.stringify(snapshot),
    });

    return res.status(201).json(created);
  });

  app.post("/api/campaigns/:id/restore/:snapshotId", requireAuth, (req, res) => {
    const campaignId = Number(req.params.id);
    const snapshotId = Number(req.params.snapshotId);

    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.userId !== (req as any).user!.id && !(req as any).user!.isAdmin) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const restored = storage.restoreCampaignSnapshot(snapshotId);
    if (!restored) return res.status(404).json({ message: "Snapshot not found or invalid" });

    broadcastToCampaign(campaignId, { type: "campaign_restored", campaignId, snapshotId });
    return res.json(restored);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHARACTERS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/campaigns/:id/characters", allowReadOnlyForExpired, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const visitorId = getVisitorId(req);

    const existing = storage.getCharacterByVisitor(campaignId, visitorId);
    if (existing) {
      return res.status(409).json({
        message: "You already have a character in this campaign.",
        character: existing,
      });
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
      name: parsed.data.name,
      race: parsed.data.race,
      charClass: parsed.data.charClass,
      traits: parsed.data.traits,
      backstory: parsed.data.backstory,
      campaignId,
      visitorId,
      userId: (req as any).user?.id || null,
      level,
      hp,
      maxHp,
      tempHp: 0,
      speed: Number(req.body.speed) || 30,
      attacksPerRound: Number(req.body.attacksPerRound) || 1,
      status: "alive",
      inventory: "[]",
      characterData,
    } as any);

    // Seed wallet for every defined campaign currency
    const currencies = storage.getCampaignCurrencies(campaignId);
    if (currencies.length) {
      storage.replaceCharacterCurrencies(
        campaignId,
        character.id,
        currencies.map((c) => ({
          currencyCode: c.code,
          amount: 0,
        })),
      );
    }

    // If the submitted character data contains typed inventory sections, create real items now
    try {
      const parsedData = JSON.parse(characterData || "{}");
      const sections = Array.isArray(parsedData.sections) ? parsedData.sections : [];

      const createdItems: InsertItem[] = [];

      for (const section of sections) {
        const sectionType = String(section.type || section.label || "").toLowerCase();

        const supportedTypes = new Set([
          "weapon",
          "weapons",
          "armor",
          "armour",
          "consumable",
          "consumables",
          "gear",
          "tool",
          "tools",
          "magic",
          "magic item",
          "property",
          "vehicle",
          "vessel",
          "mount",
          "creature",
          "retainer",
          "key",
          "misc",
        ]);

        if (!supportedTypes.has(sectionType)) continue;

        const entries = Array.isArray(section.entries) ? section.entries : [];
        for (const entry of entries) {
          const name = String(entry.name || entry.key || "").trim();
          if (!name) continue;

          let itemType = "gear";
          if (sectionType.startsWith("weapon")) itemType = "weapon";
          else if (sectionType.startsWith("armor") || sectionType.startsWith("armour")) itemType = "armor";
          else if (sectionType.startsWith("consumable")) itemType = "consumable";
          else if (sectionType.startsWith("tool")) itemType = "tool";
          else if (sectionType.startsWith("magic")) itemType = "magic";
          else if (sectionType.startsWith("property")) itemType = "property";
          else if (sectionType.startsWith("vehicle")) itemType = "vehicle";
          else if (sectionType.startsWith("vessel")) itemType = "vessel";
          else if (sectionType.startsWith("mount")) itemType = "mount";
          else if (sectionType.startsWith("creature")) itemType = "creature";
          else if (sectionType.startsWith("retainer")) itemType = "retainer";
          else if (sectionType.startsWith("key")) itemType = "key";
          else if (sectionType.startsWith("misc")) itemType = "misc";

          createdItems.push({
            campaignId,
            characterId: character.id,
            name,
            trueName: "",
            description: String(entry.description || entry.value || "").trim(),
            trueDescription: "",
            itemType,
            quantity: Number(entry.quantity) || 1,
            charges: entry.charges != null ? Number(entry.charges) : null,
            maxCharges: entry.maxCharges != null ? Number(entry.maxCharges) : null,
            identified: entry.identified !== false,
            consumable: itemType === "consumable",
            equipped: !!entry.equipped,
            locationNote: String(entry.locationNote || "").trim(),
            source: "character_creation",
            statMods: JSON.stringify(entry.statMods || []),
          } as any);
        }
      }

      if (createdItems.length) {
        storage.createItemsMany(createdItems);
      }
    } catch {
      // Character creation should not die because a fancy section blob was malformed.
    }

    const joinMessage = storage.createMessage({
      campaignId,
      sender: "System",
      senderType: "system",
      content: `${character.name} the ${character.race} ${character.charClass} has joined the party.`,
      messageType: "system",
      metadata: "{}",
    });

    broadcastToCampaign(campaignId, { type: "character_joined", character });
    broadcastToCampaign(campaignId, { type: "message", message: joinMessage });
    broadcastToCampaign(campaignId, { type: "items_updated", characterId: character.id });
    broadcastToCampaign(campaignId, { type: "currencies_updated", characterId: character.id });

    return res.status(201).json(character);
  });

  app.post("/api/parse-character", async (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return res.status(400).json({ message: "Please provide character text to parse." });
    }

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: `You extract structured character data from arbitrary RPG character text.

Return ONLY a JSON object:
{
  "name": "Name",
  "race": "Race",
  "charClass": "Class",
  "traits": "Traits",
  "backstory": "Backstory",
  "level": 1,
  "hp": 20,
  "maxHp": 20,
  "characterData": {
    "sections": []
  }
}

Rules:
- Never refuse
- Preserve source terminology where possible
- Use plain JSON only
- If uncertain, do your best with partial extraction`,
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

      const parsed = JSON.parse(cleaned);

      return res.json({
        name: parsed.name || "Unknown",
        race: parsed.race || parsed.displayRace || "Unknown",
        charClass: parsed.charClass || parsed.displayClass || "Unknown",
        traits: parsed.traits || "",
        backstory: parsed.backstory || "",
        level: parsed.level ?? 1,
        hp: parsed.hp ?? 20,
        maxHp: parsed.maxHp ?? 20,
        characterData: JSON.stringify(parsed.characterData || { sections: [], raw: text.trim() }),
      });
    } catch (err: any) {
      console.error("Character parse error:", err.message);
      return res.status(422).json({
        message: "Could not parse this character sheet. Please try again or paste a simpler version.",
      });
    }
  });

  app.get("/api/campaigns/:id/characters", allowReadOnlyForExpired, (req, res) => {
    return res.json(storage.getCharactersByCampaign(Number(req.params.id)));
  });

  app.get("/api/campaigns/:id/my-character", allowReadOnlyForExpired, (req, res) => {
    const campaignId = Number(req.params.id);
    const visitorId = getVisitorId(req);
    const char = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!char) return res.status(404).json({ message: "No character found" });
    return res.json(char);
  });

  app.patch("/api/characters/:id/spell-data", allowReadOnlyForExpired, (req, res) => {
    const characterId = Number(req.params.id);
    const visitorId = getVisitorId(req);

    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });

    const { characterData } = req.body;
    if (typeof characterData !== "string") {
      return res.status(400).json({ message: "Invalid characterData" });
    }

    storage.updateCharacter(characterId, { characterData } as any);
    broadcastToCampaign(character.campaignId, { type: "character_updated", characterId });

    return res.json({ ok: true });
  });

  app.patch("/api/characters/:id/hp", allowReadOnlyForExpired, (req, res) => {
    const characterId = Number(req.params.id);
    const visitorId = getVisitorId(req);
    const character = storage.getCharacter(characterId);

    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId) return res.status(403).json({ message: "Not your character" });

    const hp = Number(req.body.hp);
    if (Number.isNaN(hp)) return res.status(400).json({ message: "Invalid HP" });

    const clamped = Math.max(0, Math.min(character.maxHp, hp));
    storage.updateCharacter(characterId, { hp: clamped } as any);

    broadcastToCampaign(character.campaignId, { type: "character_updated", characterId });
    return res.json({ hp: clamped });
  });

  app.get("/api/characters/:id/currencies", allowReadOnlyForExpired, (req, res) => {
    const character = storage.getCharacter(Number(req.params.id));
    if (!character) return res.status(404).json({ message: "Character not found" });
    return res.json(storage.getCharacterCurrencies(character.id));
  });

  app.patch("/api/characters/:id/currencies", allowReadOnlyForExpired, (req, res) => {
    const characterId = Number(req.params.id);
    const visitorId = getVisitorId(req);

    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId && !(req as any).user?.isAdmin) {
      return res.status(403).json({ message: "Not your character" });
    }

    const parsed = adjustCurrencySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const updated = storage.adjustCharacterCurrency(
      character.campaignId,
      character.id,
      parsed.data.currencyCode,
      parsed.data.amount,
    );

    broadcastToCampaign(character.campaignId, {
      type: "currencies_updated",
      characterId: character.id,
    });

    return res.json(updated);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ITEMS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/characters/:characterId/items", allowReadOnlyForExpired, (req, res) => {
    return res.json(storage.getItemsByCharacter(Number(req.params.characterId)));
  });

  app.post("/api/characters/:characterId/items", allowReadOnlyForExpired, (req, res) => {
    const characterId = Number(req.params.characterId);
    const visitorId = getVisitorId(req);

    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId && !(req as any).user?.isAdmin) {
      return res.status(403).json({ message: "Not your character" });
    }

    const {
      name,
      trueName = "",
      description = "",
      trueDescription = "",
      itemType = "gear",
      quantity = 1,
      charges = null,
      maxCharges = null,
      identified = true,
      consumable = false,
      equipped = false,
      locationNote = "",
      statMods = "[]",
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Item name is required." });
    }

    const item = storage.createItem({
      campaignId: character.campaignId,
      characterId,
      name: name.trim(),
      trueName,
      description,
      trueDescription,
      itemType,
      quantity,
      charges,
      maxCharges,
      identified,
      consumable,
      equipped,
      locationNote,
      source: "manual",
      statMods: typeof statMods === "string" ? statMods : JSON.stringify(statMods),
    } as any);

    broadcastToCampaign(character.campaignId, { type: "items_updated", characterId });
    return res.status(201).json(item);
  });

  app.patch("/api/items/:id", allowReadOnlyForExpired, (req, res) => {
    const itemId = Number(req.params.id);
    const visitorId = getVisitorId(req);

    const item = storage.getItem(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const character = storage.getCharacter(item.characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId && !(req as any).user?.isAdmin) {
      return res.status(403).json({ message: "Not your item" });
    }

    const updated = storage.updateItem(itemId, req.body);
    broadcastToCampaign(item.campaignId, { type: "items_updated", characterId: item.characterId });
    return res.json(updated);
  });

  app.delete("/api/items/:id", allowReadOnlyForExpired, (req, res) => {
    const itemId = Number(req.params.id);
    const visitorId = getVisitorId(req);

    const item = storage.getItem(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const character = storage.getCharacter(item.characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId && !(req as any).user?.isAdmin) {
      return res.status(403).json({ message: "Not your item" });
    }

    storage.deleteItem(itemId);
    broadcastToCampaign(item.campaignId, { type: "items_updated", characterId: item.characterId });
    return res.json({ deleted: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHOPS
  // Narrative + structured transaction overlay.
  // Buying is structured. Haggling, theft, intimidation remain narrative.
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/campaigns/:id/shop", allowReadOnlyForExpired, (req, res) => {
    const campaignId = Number(req.params.id);
    const shop = storage.getActiveShopByCampaign(campaignId);
    if (!shop) return res.status(404).json({ message: "No active shop" });

    const stock = storage.getShopItems(shop.id);
    return res.json({ shop, items: stock });
  });

  app.post("/api/campaigns/:id/shop/open", requireAuth, allowReadOnlyForExpired, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const visitorId = getVisitorId(req);
    if (campaign.hostVisitorId !== visitorId && campaign.userId !== (req as any).user!.id) {
      return res.status(403).json({ message: "Only the host can open a shop panel." });
    }

    const {
      merchantName,
      merchantDescription = "",
      currencyCode,
      title = "Merchant Stock",
      items = [],
    } = req.body || {};

    if (!merchantName?.trim()) return res.status(400).json({ message: "merchantName is required" });
    if (!currencyCode?.trim()) return res.status(400).json({ message: "currencyCode is required" });

    const existing = storage.getActiveShopByCampaign(campaignId);
    if (existing) {
      storage.closeActiveShop(existing.id);
    }

    const shop = storage.createActiveShop({
      campaignId,
      merchantName: merchantName.trim(),
      merchantDescription: merchantDescription.trim(),
      currencyCode: currencyCode.trim().toLowerCase(),
      title: title.trim(),
      isOpen: true,
      metadata: "{}",
    });

    const validatedItems = [];
    for (const item of items) {
      const parsed = createShopItemSchema.safeParse(item);
      if (!parsed.success) continue;
      validatedItems.push({
        shopId: shop.id,
        campaignId,
        itemKey: parsed.data.itemKey,
        name: parsed.data.name,
        description: parsed.data.description,
        itemType: parsed.data.itemType,
        quantityPerPurchase: parsed.data.quantityPerPurchase,
        stock: parsed.data.stock,
        priceAmount: parsed.data.priceAmount,
        priceCurrencyCode: parsed.data.priceCurrencyCode.toLowerCase(),
        metadata: JSON.stringify(parsed.data.metadata || {}),
      });
    }

    if (validatedItems.length) {
      storage.replaceShopItems(shop.id, campaignId, validatedItems as any);
    }

    broadcastToCampaign(campaignId, { type: "shop_updated", shopId: shop.id });

    return res.status(201).json({
      shop,
      items: storage.getShopItems(shop.id),
    });
  });

  app.post("/api/campaigns/:id/shop/close", requireAuth, allowReadOnlyForExpired, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const visitorId = getVisitorId(req);
    if (campaign.hostVisitorId !== visitorId && campaign.userId !== (req as any).user!.id) {
      return res.status(403).json({ message: "Only the host can close a shop panel." });
    }

    const shop = storage.getActiveShopByCampaign(campaignId);
    if (!shop) return res.json({ ok: true });

    storage.closeActiveShop(shop.id);
    broadcastToCampaign(campaignId, { type: "shop_closed", shopId: shop.id });

    return res.json({ ok: true });
  });

  app.post("/api/campaigns/:id/shop/buy", allowReadOnlyForExpired, (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const visitorId = getVisitorId(req);
    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return res.status(403).json({ message: "You do not have a character in this campaign." });

    const shop = storage.getActiveShopByCampaign(campaignId);
    if (!shop) return res.status(404).json({ message: "No active shop." });

    const parsed = buyShopItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const shopItem = storage.getShopItem(parsed.data.shopItemId);
    if (!shopItem || shopItem.shopId !== shop.id) {
      return res.status(404).json({ message: "Shop item not found." });
    }

    const quantity = parsed.data.quantity;
    if (shopItem.stock < quantity) {
      return res.status(400).json({ message: "The vendor does not have enough stock." });
    }

    const unitPrice = shopItem.priceAmount;
    const totalCost = unitPrice * quantity;
    const wallet = storage.getCharacterCurrency(character.id, shopItem.priceCurrencyCode);

    if (!wallet || wallet.amount < totalCost) {
      return res.status(400).json({ message: "Not enough currency." });
    }

    storage.adjustCharacterCurrency(
      campaignId,
      character.id,
      shopItem.priceCurrencyCode,
      -totalCost,
    );

    storage.decrementShopStock(shopItem.id, quantity);

    storage.createItem({
      campaignId,
      characterId: character.id,
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
    } as any);

    const systemMessage = storage.createMessage({
      campaignId,
      sender: "System",
      senderType: "system",
      content: `${character.name} buys ${quantity} × ${shopItem.name} for ${totalCost} ${shopItem.priceCurrencyCode}.`,
      messageType: "system",
      metadata: "{}",
    });

    broadcastToCampaign(campaignId, { type: "message", message: systemMessage });
    broadcastToCampaign(campaignId, { type: "shop_updated", shopId: shop.id });
    broadcastToCampaign(campaignId, { type: "items_updated", characterId: character.id });
    broadcastToCampaign(campaignId, { type: "currencies_updated", characterId: character.id });

    autoSnapshotIfNeeded(campaignId, "shop", systemMessage.id);

    return res.json({
      ok: true,
      remainingStock: storage.getShopItem(shopItem.id)?.stock ?? 0,
      wallet: storage.getCharacterCurrency(character.id, shopItem.priceCurrencyCode),
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/characters/:characterId/effects", allowReadOnlyForExpired, (req, res) => {
    return res.json(storage.getActiveEffectsByCharacter(Number(req.params.characterId)));
  });

  app.post("/api/characters/:characterId/effects", allowReadOnlyForExpired, (req, res) => {
    const characterId = Number(req.params.characterId);
    const visitorId = getVisitorId(req);

    const character = storage.getCharacter(characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId && !(req as any).user?.isAdmin) {
      return res.status(403).json({ message: "Not your character" });
    }

    const {
      name,
      source = "",
      icon = "",
      isDebuff = false,
      durationType = "rounds",
      totalDuration = null,
      roundsRemaining = null,
      concentration = false,
      statMods = "[]",
      description = "",
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Effect name required" });

    if (concentration) {
      storage.removeConcentration(characterId);
    }

    const effect = storage.createActiveEffect({
      campaignId: character.campaignId,
      characterId,
      name: name.trim(),
      source,
      icon,
      isDebuff,
      durationType,
      totalDuration,
      roundsRemaining: durationType === "rounds" ? (roundsRemaining ?? totalDuration) : null,
      concentration,
      statMods: typeof statMods === "string" ? statMods : JSON.stringify(statMods),
      description,
      appliedBy: "manual",
    } as any);

    broadcastToCampaign(character.campaignId, { type: "effects_updated", characterId });
    return res.status(201).json(effect);
  });

  app.delete("/api/effects/:id", allowReadOnlyForExpired, (req, res) => {
    const effectId = Number(req.params.id);
    const visitorId = getVisitorId(req);

    const effect = storage.getActiveEffect(effectId);
    if (!effect) return res.status(404).json({ message: "Effect not found" });

    const character = storage.getCharacter(effect.characterId);
    if (!character) return res.status(404).json({ message: "Character not found" });
    if (character.visitorId !== visitorId && !(req as any).user?.isAdmin) {
      return res.status(403).json({ message: "Not your character" });
    }

    storage.deleteActiveEffect(effectId);
    broadcastToCampaign(effect.campaignId, { type: "effects_updated", characterId: effect.characterId });
    return res.json({ deleted: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGES / GAME LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/campaigns/:id/messages", allowReadOnlyForExpired, (req, res) => {
    return res.json(storage.getMessagesByCampaign(Number(req.params.id)));
  });

  app.post("/api/campaigns/:id/start", requireAuth, requireCanPlay, checkTurnLimit, async (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const chars = storage.getCharactersByCampaign(campaignId);
    if (chars.length === 0) {
      return res.status(400).json({ message: "Need at least one character to start." });
    }

    try {
      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: true });

      const rawResponse = await generateOpeningScene(
        campaign,
        chars,
        storage.getCampaignCurrencies(campaignId),
      );

      const { cleanContent, worldState } = extractWorldState(rawResponse);
      const shopState = extractShopStateFromNarration(rawResponse);

      if (worldState) {
        try {
          storage.updateWorldState(campaignId, JSON.stringify(worldState));
        } catch {}
      }

      // If the opening scene includes a shop, activate it
      if (shopState) {
        const existing = storage.getActiveShopByCampaign(campaignId);
        if (existing) storage.closeActiveShop(existing.id);

        const shop = storage.createActiveShop({
          campaignId,
          merchantName: shopState.merchantName,
          merchantDescription: shopState.merchantDescription || "",
          currencyCode: shopState.currencyCode,
          title: shopState.title || "Merchant Stock",
          isOpen: true,
          metadata: JSON.stringify(shopState.metadata || {}),
        });

        storage.replaceShopItems(
          shop.id,
          campaignId,
          (shopState.items || []).map((item: any) => ({
            shopId: shop.id,
            campaignId,
            itemKey: item.itemKey || item.id || item.name.toLowerCase().replace(/\s+/g, "_"),
            name: item.name,
            description: item.description || "",
            itemType: item.itemType || "gear",
            quantityPerPurchase: item.quantityPerPurchase || 1,
            stock: item.stock ?? 1,
            priceAmount: item.priceAmount ?? item.price ?? 0,
            priceCurrencyCode: (item.priceCurrencyCode || shopState.currencyCode || "").toLowerCase(),
            metadata: JSON.stringify(item.metadata || {}),
          })),
        );
      }

      incrementTurnCount((req as any).user!.id);

      const dmMessage = storage.createMessage({
        campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: cleanContent,
        messageType: "narration",
        metadata: "{}",
      });

      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      broadcastToCampaign(campaignId, { type: "message", message: dmMessage });

      if (shopState) {
        broadcastToCampaign(campaignId, { type: "shop_updated" });
      }

      autoSnapshotIfNeeded(campaignId, "scene_change", dmMessage.id);

      return res.json({ message: dmMessage });
    } catch (error: any) {
      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      console.error("Opening scene error:", error);
      return res.status(422).json({ message: "Failed to generate opening scene" });
    }
  });

  app.post("/api/campaigns/:id/action", requireAuth, requireCanPlay, checkTurnLimit, async (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = storage.getCampaign(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const visitorId = getVisitorId(req);
    const character = storage.getCharacterByVisitor(campaignId, visitorId);
    if (!character) return res.status(403).json({ message: "You don't have a character in this campaign." });

    const parsed = playerActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const playerMessage = storage.createMessage({
      campaignId,
      sender: character.name,
      senderType: "player",
      content: parsed.data.content,
      messageType: "action",
      metadata: "{}",
    });

    broadcastToCampaign(campaignId, { type: "message", message: playerMessage });

    try {
      const history = storage.getMessagesByCampaign(campaignId);
      const chars = storage.getCharactersByCampaign(campaignId);
      const currencies = storage.getCampaignCurrencies(campaignId);

      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: true });

      const rawResponse = await generateDMResponse(
        campaign,
        chars,
        history,
        parsed.data.content,
        character.name,
        currencies,
      );

      const { cleanContent, worldState } = extractWorldState(rawResponse);
      const shopState = extractShopStateFromNarration(rawResponse);

      if (worldState) {
        try {
          const current = JSON.parse(campaign.worldState || "{}");
          const merged = {
            ...current,
            ...worldState,
          };
          storage.updateWorldState(campaignId, JSON.stringify(merged));
        } catch {}
      }

      const dmMessage = storage.createMessage({
        campaignId,
        sender: "Dungeon Master",
        senderType: "dm",
        content: cleanContent,
        messageType: "narration",
        metadata: "{}",
      });

      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      broadcastToCampaign(campaignId, { type: "message", message: dmMessage });

      incrementTurnCount((req as any).user!.id);

      // ── Automatic state sync from normal play ────────────────────────────
      // This is what players expect.
      // They should not have to type "please update my inventory" like a clerk.
      const [grantedItems, currencyChanges, grantedAbilities] = await Promise.all([
        extractItemsFromNarration(cleanContent),
        extractCurrencyChangesFromNarration(cleanContent, campaignId),
        extractAbilitiesFromNarration(cleanContent),
      ]);

      if (grantedItems.length) {
        storage.createItemsMany(
          grantedItems.map((item) => ({
            campaignId,
            characterId: character.id,
            name: item.name,
            trueName: "",
            description: item.description,
            trueDescription: "",
            itemType: item.itemType,
            quantity: item.quantity || 1,
            charges: null,
            maxCharges: null,
            identified: item.identified !== false,
            consumable: !!item.consumable,
            equipped: false,
            locationNote: "",
            source: "dm_auto_award",
            statMods: "[]",
          })) as any[],
        );

        broadcastToCampaign(campaignId, { type: "items_updated", characterId: character.id });
      }

      if (currencyChanges.length) {
        for (const change of currencyChanges) {
          storage.adjustCharacterCurrency(
            campaignId,
            character.id,
            change.currencyCode,
            change.amountDelta,
          );
        }

        broadcastToCampaign(campaignId, { type: "currencies_updated", characterId: character.id });
      }

      if (grantedAbilities.length) {
        try {
          const fresh = storage.getCharacter(character.id);
          if (fresh) {
            const data = JSON.parse((fresh as any).characterData || "{}");
            if (!Array.isArray(data.sections)) data.sections = [];

            let granted = data.sections.find((s: any) => s.label === "Granted Abilities");
            if (!granted) {
              granted = { label: "Granted Abilities", type: "abilities", entries: [] };
              data.sections.push(granted);
            }

            for (const ability of grantedAbilities) {
              if (!granted.entries.find((e: any) => e.key === ability.name || e.name === ability.name)) {
                granted.entries.push({
                  key: ability.name,
                  name: ability.name,
                  value: `[${ability.category}] ${ability.description}`,
                  description: ability.description,
                });
              }
            }

            storage.updateCharacter(character.id, {
              characterData: JSON.stringify(data),
            } as any);

            broadcastToCampaign(campaignId, {
              type: "character_updated",
              characterId: character.id,
            });
          }
        } catch {
          // Ability sync should not kill the scene.
        }
      }

      // Shop detection from ordinary narrative
      if (shopState) {
        const existing = storage.getActiveShopByCampaign(campaignId);
        if (existing) storage.closeActiveShop(existing.id);

        const shop = storage.createActiveShop({
          campaignId,
          merchantName: shopState.merchantName,
          merchantDescription: shopState.merchantDescription || "",
          currencyCode: shopState.currencyCode,
          title: shopState.title || "Merchant Stock",
          isOpen: true,
          metadata: JSON.stringify(shopState.metadata || {}),
        });

        storage.replaceShopItems(
          shop.id,
          campaignId,
          (shopState.items || []).map((item: any) => ({
            shopId: shop.id,
            campaignId,
            itemKey: item.itemKey || item.id || item.name.toLowerCase().replace(/\s+/g, "_"),
            name: item.name,
            description: item.description || "",
            itemType: item.itemType || "gear",
            quantityPerPurchase: item.quantityPerPurchase || 1,
            stock: item.stock ?? 1,
            priceAmount: item.priceAmount ?? item.price ?? 0,
            priceCurrencyCode: (item.priceCurrencyCode || shopState.currencyCode || "").toLowerCase(),
            metadata: JSON.stringify(item.metadata || {}),
          })),
        );

        broadcastToCampaign(campaignId, { type: "shop_updated", shopId: shop.id });
      }

      const expired = storage.tickEffects(character.id);
      if (expired.length) {
        broadcastToCampaign(campaignId, {
          type: "effects_updated",
          characterId: character.id,
          expired: expired.map((e) => ({ id: e.id, name: e.name })),
        });
      }

      autoSnapshotIfNeeded(campaignId, "auto", dmMessage.id);

      return res.json({ playerMessage, dmMessage });
    } catch (error: any) {
      broadcastToCampaign(campaignId, { type: "dm_thinking", thinking: false });
      console.error("DM Engine error:", error);
      return res.status(422).json({ message: "The Dungeon Master encountered an error. Try again." });
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

          subscribedCampaignId = Number(data.campaignId);

          if (!campaignClients.has(subscribedCampaignId)) {
            campaignClients.set(subscribedCampaignId, new Set());
          }

          campaignClients.get(subscribedCampaignId)!.add(ws);

          ws.send(JSON.stringify({
            type: "subscribed",
            campaignId: subscribedCampaignId,
          }));
        }
      } catch {
        // Ignore malformed WS payloads instead of exploding theatrically.
      }
    });

    ws.on("close", () => {
      if (subscribedCampaignId !== null) {
        campaignClients.get(subscribedCampaignId)?.delete(ws);
      }
    });
  });

  return httpServer;
}
