import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
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
} from "@shared/schema";
import {
  attachUser,
  requireAuth,
  requireCanPlay,
  checkTurnLimit,
  incrementTurnCount,
} from "./auth";
import { randomBytes } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// FIXED VISITOR ID (THIS WAS YOUR MAIN BUG)
// ─────────────────────────────────────────────────────────────────────────────

function getVisitorId(req: any): string {
  if (req.user?.id) return `user-${req.user.id}`;
  return req.headers["x-visitor-id"] || "anon";
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET
// ─────────────────────────────────────────────────────────────────────────────

const campaignClients = new Map<number, Set<WebSocket>>();

function broadcast(campaignId: number, data: any) {
  const clients = campaignClients.get(campaignId);
  if (!clients) return;

  const json = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(json);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO ITEM EXTRACTION (REAL FIX FOR YOUR PROBLEM)
// ─────────────────────────────────────────────────────────────────────────────

async function extractItemsFromNarration(
  text: string,
  campaignId: number,
  characterId: number
) {
  const regex =
    /\b(found|loot|picked up|takes|take|receives|gains|obtains|acquires)\b/i;

  if (!regex.test(text)) return [];

  // basic heuristic extraction (can be improved later)
  const matches = [...text.matchAll(/(?:a|an|the)?\s?([A-Z][a-zA-Z\s]+)(?:\.)/g)];

  return matches.map((m) => ({
    campaignId,
    characterId,
    name: m[1],
    description: "",
    itemType: "misc",
    quantity: 1,
    consumable: false,
    identified: true,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(attachUser);

  // ─────────────────────────────────────────────────
  // CREATE CAMPAIGN
  // ─────────────────────────────────────────────────

  app.post("/api/campaigns", requireAuth, (req, res) => {
    const parsed = createCampaignFormSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid campaign" });

    const campaign = storage.createCampaign({
      ...parsed.data,
      inviteCode: randomBytes(4).toString("hex"),
      userId: req.user.id,
      worldState: JSON.stringify({}),
    });

    return res.json(campaign);
  });

  // ─────────────────────────────────────────────────
  // GET CAMPAIGN
  // ─────────────────────────────────────────────────

  app.get("/api/campaigns/:id", (req, res) => {
    const campaign = storage.getCampaign(Number(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Not found" });
    return res.json(campaign);
  });

  // ─────────────────────────────────────────────────
  // CREATE CHARACTER (FIXED)
  // ─────────────────────────────────────────────────

  app.post("/api/campaigns/:id/characters", (req, res) => {
    const campaignId = Number(req.params.id);
    const visitorId = getVisitorId(req);

    const parsed = createCharacterFormSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid character" });

    const character = storage.createCharacter({
      ...parsed.data,
      campaignId,
      visitorId,
      userId: req.user?.id || null,
      level: 1,
      hp: 20,
      maxHp: 20,
      inventory: "[]",
      characterData: "{}",
    });

    broadcast(campaignId, { type: "character_joined", character });

    return res.json(character);
  });

  // ─────────────────────────────────────────────────
  // GET MY CHARACTER (FIXED)
  // ─────────────────────────────────────────────────

  app.get("/api/campaigns/:id/my-character", (req, res) => {
    const visitorId = getVisitorId(req);

    const char = storage.getCharacterByVisitor(
      Number(req.params.id),
      visitorId
    );

    if (!char)
      return res.status(404).json({ message: "No character found" });

    return res.json(char);
  });

  // ─────────────────────────────────────────────────
  // GET MESSAGES
  // ─────────────────────────────────────────────────

  app.get("/api/campaigns/:id/messages", (req, res) => {
    return res.json(
      storage.getMessagesByCampaign(Number(req.params.id))
    );
  });

  // ─────────────────────────────────────────────────
  // START CAMPAIGN (FIXED + CURRENCY SUPPORT)
  // ─────────────────────────────────────────────────

  app.post(
    "/api/campaigns/:id/start",
    requireAuth,
    async (req, res) => {
      const campaignId = Number(req.params.id);

      const campaign = storage.getCampaign(campaignId);
      const chars = storage.getCharactersByCampaign(campaignId);
      const currencies = storage.getCurrenciesByCampaign(campaignId);

      if (!campaign) return res.status(404).json({ message: "Not found" });

      const raw = await generateOpeningScene(
        campaign,
        chars,
        currencies
      );

      const { cleanContent, worldState } = extractWorldState(raw);

      if (worldState) {
        storage.updateWorldState(
          campaignId,
          JSON.stringify(worldState)
        );
      }

      const shop = extractShopStateFromNarration(raw);
      if (shop) {
        storage.setShopState(campaignId, JSON.stringify(shop));
        broadcast(campaignId, { type: "shop_update", shop });
      }

      const msg = storage.createMessage({
        campaignId,
        sender: "DM",
        senderType: "dm",
        content: cleanContent,
        messageType: "narration",
      });

      broadcast(campaignId, { type: "message", message: msg });

      incrementTurnCount(req.user.id);

      return res.json(msg);
    }
  );

  // ─────────────────────────────────────────────────
  // PLAYER ACTION (CORE ENGINE)
  // ─────────────────────────────────────────────────

  app.post(
    "/api/campaigns/:id/action",
    requireAuth,
    requireCanPlay,
    checkTurnLimit,
    async (req, res) => {
      const campaignId = Number(req.params.id);
      const visitorId = getVisitorId(req);

      const campaign = storage.getCampaign(campaignId);
      const char = storage.getCharacterByVisitor(campaignId, visitorId);
      const currencies = storage.getCurrenciesByCampaign(campaignId);

      if (!char)
        return res.status(403).json({ message: "No character" });

      const parsed = playerActionSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ message: "Invalid action" });

      const playerMsg = storage.createMessage({
        campaignId,
        sender: char.name,
        senderType: "player",
        content: parsed.data.content,
        messageType: "action",
      });

      broadcast(campaignId, { type: "message", message: playerMsg });

      const history = storage.getMessagesByCampaign(campaignId);

      const raw = await generateDMResponse(
        campaign,
        storage.getCharactersByCampaign(campaignId),
        history,
        parsed.data.content,
        char.name,
        currencies
      );

      const { cleanContent, worldState } = extractWorldState(raw);

      if (worldState) {
        storage.updateWorldState(
          campaignId,
          JSON.stringify(worldState)
        );
      }

      // ───────── AUTO INVENTORY SYSTEM ─────────

      const items = await extractItemsFromNarration(
        cleanContent,
        campaignId,
        char.id
      );

      for (const item of items) {
        const created = storage.createItem(item);

        broadcast(campaignId, {
          type: "item_granted",
          item: created,
        });
      }

      if (items.length) {
        broadcast(campaignId, {
          type: "items_updated",
          characterId: char.id,
        });
      }

      // ───────── SHOP SYSTEM ─────────

      const shop = extractShopStateFromNarration(raw);

      if (shop) {
        storage.setShopState(campaignId, JSON.stringify(shop));

        broadcast(campaignId, {
          type: "shop_update",
          shop,
        });
      }

      const dmMsg = storage.createMessage({
        campaignId,
        sender: "DM",
        senderType: "dm",
        content: cleanContent,
        messageType: "narration",
      });

      broadcast(campaignId, { type: "message", message: dmMsg });

      incrementTurnCount(req.user.id);

      return res.json({ ok: true });
    }
  );

  // ─────────────────────────────────────────────────
  // WEBSOCKET
  // ─────────────────────────────────────────────────

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    if (url.pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws);
      });
    }
  });

  wss.on("connection", (ws) => {
    let campaignId: number | null = null;

    ws.on("message", (raw) => {
      const data = JSON.parse(raw.toString());

      if (data.type === "subscribe") {
        campaignId = data.campaignId;

        if (!campaignClients.has(campaignId)) {
          campaignClients.set(campaignId, new Set());
        }

        campaignClients.get(campaignId)!.add(ws);
      }
    });

    ws.on("close", () => {
      if (campaignId !== null) {
        campaignClients.get(campaignId)?.delete(ws);
      }
    });
  });

  return httpServer;
}
