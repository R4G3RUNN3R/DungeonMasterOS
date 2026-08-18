import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { registerCompendiumRoutes } from "./compendium-routes";
import { registerKnowledgeRoutes } from "./knowledge-routes";
import { registerDnd35ItemRoutes } from "./dnd35-item-routes";
import { initializeDnd35KnowledgeLibrary } from "./knowledge-library";
import { initializeDnd35ItemLibrary } from "./dnd35-item-library";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from "./storage";
import { initializeCompendium } from "./compendium";

const app = express();
const httpServer = createServer(app);

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && res.statusCode >= 400) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).slice(0, 200)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    runMigrations();
    log("Database migrations complete", "db");

    const compendium = await initializeCompendium();
    log(
      `Item compendium ready: ${compendium.totalDefinitions} definitions (${compendium.canonicalImported} canonical rows imported this run, ${compendium.homebrewSeeded} first-party homebrew definitions seeded)`,
      "compendium",
    );
    if (compendium.canonicalErrors.length) {
      console.warn(
        "Compendium canonical sync completed with non-fatal source errors:",
        compendium.canonicalErrors,
      );
    }

    // Pinned 3.5 SRD corpora are knowledge dependencies, not availability
    // dependencies. Remote/source failures leave the server operational and
    // make the affected shelf report fallback/cataloguing instead of silently
    // publishing a partial rules corpus.
    try {
      const [knowledge, items] = await Promise.all([
        initializeDnd35KnowledgeLibrary(),
        initializeDnd35ItemLibrary(),
      ]);
      log(
        `D&D 3.5 Library: spells ${knowledge.spellCorpusStatus} (${knowledge.totalSpells}; ${knowledge.arcaneSpells} arcane/${knowledge.divineSpells} divine), feats ${knowledge.featCorpusStatus} (${knowledge.totalFeats}; ${knowledge.executableFeats} executable), items ${items.corpusStatus} (${items.totalItems}; ${items.weapons} weapons/ammunition, ${items.armor} armor/shields)`,
        "knowledge",
      );
      if (knowledge.spellErrors.length) {
        console.warn("D&D 3.5 SRD spell import fell back to curated records:", knowledge.spellErrors);
      }
      if (knowledge.featErrors.length) {
        console.warn("D&D 3.5 SRD feat import fell back to curated records:", knowledge.featErrors);
      }
      if (items.errors.length) {
        console.warn("D&D 3.5 SRD equipment import remains unavailable:", items.errors);
      }
    } catch (error) {
      console.warn("D&D 3.5 knowledge initialization failed unexpectedly; safe fallback records remain available:", error);
    }
  } catch (err: any) {
    console.error("Database migration failed:", err);
    process.exit(1);
  }

  // Read-only catalogue and Library of Knowledge routes are registered before
  // campaign handlers. The knowledge layer also owns the narrow 3.5 feat
  // validation guard that must run before the legacy level-up route accepts a
  // feat selection.
  registerCompendiumRoutes(app);
  registerDnd35ItemRoutes(app);
  registerKnowledgeRoutes(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return;
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  httpServer.listen({ port, host }, () => {
    log(`serving on port ${port}`);
  });
})();
