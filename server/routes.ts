import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { generateDMResponse, generateOpeningScene } from "./dm-engine";
import {
  createCampaignFormSchema,
  createCharacterFormSchema,
  playerActionSchema,
} from "@shared/schema";
import {
  attachUser,
  requireAuth,
} from "./auth";
import { randomBytes } from "crypto";
import Anthropic from "@anthropic-ai/sdk";

// ─────────────────────────────────────────────────────────────
// AI CLIENT (THIS IS WHERE YOUR KEY IS USED)
// ─────────────────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────────────────────
// WEBSOCKET REGISTRY
// ─────────────────────────────────────────────────────────────
const campaignClients = new Map<number, Set<WebSocket>>();

function broadcast(campaignId: number, data: any) {
  const clients = campaignClients.get(campaignId);
  if (!clients) return;
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

// ─────────────────────────────────────────────────────────────
// FIXED IDENTITY (THIS WAS YOUR ORIGINAL BUG)
// ─────────────────────────────────────────────────────────────
function getVisitorId(req: Request): string {
  if (req.user?.id) return `user-${req.user.id}`;
  return (
    (req.headers["x-visitor-id"] as string) ||
    `anon-${randomBytes(8).toString("hex")}`
  );
}

// ─────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(attachUser);

  // ───── CREATE CAMPAIGN ─────
  app.post("/api/campaigns", requireAuth, (req, res) => {
    const parsed = createCampaignFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid campaign data" });
    }

    const campaign = storage.createCampaign({
      ...parsed.data,
      inviteCode: randomBytes(4).toString("hex"),
      userId: req.user!.id,
      worldState: JSON.stringify({}),
    });

    return res.status(201).json(campaign);
  });

  // ───── GET CAMPAIGN ─────
  app.get("/api/campaigns/:id", (req, res) => {
    const campaign = storage.getCampaign(Number(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Not found" });
    return res.json(campaign);
  });

  // ───── CHARACTERS ─────
  app.post("/api/campaigns/:id/characters", (req, res) => {
    const campaignId = Number(req.params.id);
    const visitorId = getVisitorId(req);

    const parsed = createCharacterFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid character" });
    }

    const character = storage.createCharacter({
      ...parsed.data,
      campaignId,
      visitorId,
      userId: req.user?.id || null,
    });

    broadcast(campaignId, { type: "character_joined", character });

    return res.status(201).json(character);
  });

  app.get("/api/campaigns/:id/my-character", (req, res) => {
    const char = storage.getCharacterByVisitor(
      Number(req.params.id),
      getVisitorId(req)
    );
    if (!char) return res.status(404).json({ message: "No character found" });
    return res.json(char);
  });

  app.get("/api/campaigns/:id/characters", (req, res) => {
    return res.json(
      storage.getCharactersByCampaign(Number(req.params.id))
    );
  });

  // ───── MESSAGES ─────
  app.get("/api/campaigns/:id/messages", (req, res) => {
    return res.json(
      storage.getMessagesByCampaign(Number(req.params.id))
    );
  });

  // ───── START CAMPAIGN (YOUR PROBLEM AREA) ─────
  app.post(
    "/api/campaigns/:id/start",
    requireAuth,
    async (req: Request, res: Response) => {
      const campaignId = Number(req.params.id);
      const campaign = storage.getCampaign(campaignId);
      if (!campaign)
        return res.status(404).json({ message: "Campaign not found" });

      const chars = storage.getCharactersByCampaign(campaignId);
      if (chars.length === 0) {
        return res.status(400).json({ message: "No characters" });
      }

      try {
        const response = await generateOpeningScene(campaign, chars);

        const message = storage.createMessage({
          campaignId,
          sender: "Dungeon Master",
          senderType: "dm",
          content: response,
          messageType: "narration",
        });

        broadcast(campaignId, { type: "message", message });

        return res.json({ message });
      } catch (err: any) {
        console.error("Opening scene error:", err);
        return res
          .status(422)
          .json({ message: "Failed to generate opening scene" });
      }
    }
  );

  // ───── PLAYER ACTION ─────
  app.post(
    "/api/campaigns/:id/action",
    requireAuth,
    async (req, res) => {
      const campaignId = Number(req.params.id);
      const campaign = storage.getCampaign(campaignId);
      if (!campaign)
        return res.status(404).json({ message: "Campaign not found" });

      const character = storage.getCharacterByVisitor(
        campaignId,
        getVisitorId(req)
      );
      if (!character)
        return res.status(403).json({ message: "No character" });

      const parsed = playerActionSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ message: "Invalid action" });

      const playerMsg = storage.createMessage({
        campaignId,
        sender: character.name,
        senderType: "player",
        content: parsed.data.content,
        messageType: "action",
      });

      broadcast(campaignId, { type: "message", message: playerMsg });

      try {
        const history = storage.getMessagesByCampaign(campaignId);
        const chars = storage.getCharactersByCampaign(campaignId);

        const response = await generateDMResponse(
          campaign,
          chars,
          history,
          parsed.data.content,
          character.name
        );

        const dmMsg = storage.createMessage({
          campaignId,
          sender: "Dungeon Master",
          senderType: "dm",
          content: response,
          messageType: "narration",
        });

        broadcast(campaignId, { type: "message", message: dmMsg });

        return res.json({ dmMsg });
      } catch (err) {
        console.error("DM error:", err);
        return res.status(500).json({ message: "DM failed" });
      }
    }
  );

  // ───── WEBSOCKET ─────
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    if (url.pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  wss.on("connection", (ws) => {
    let campaignId: number | null = null;

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === "subscribe") {
          campaignId = data.campaignId;

          if (!campaignClients.has(campaignId)) {
            campaignClients.set(campaignId, new Set());
          }

          campaignClients.get(campaignId)!.add(ws);
        }
      } catch {}
    });

    ws.on("close", () => {
      if (campaignId !== null) {
        campaignClients.get(campaignId)?.delete(ws);
      }
    });
  });

  return httpServer;
}
