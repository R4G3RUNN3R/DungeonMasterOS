import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { registerCompendiumRoutes } from "./compendium-routes";
import { registerKnowledgeRoutes } from "./knowledge-routes";
import { initializeDnd35KnowledgeLibrary } from "./knowledge-library";
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
    res.setHeader("X-XSS-Protection", "0");
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

    // The pinned 3.5 SRD is a knowledge dependency, not an availability
    // dependency. If the remote source cannot be fetched, the Library keeps
    // the curated canonical foundation instead of preventing the server from
    // starting. Partial imports are rejected by the importer itself.
    try {
      const knowledge = await initializeDnd35KnowledgeLibrary();
      log(
        `D&D 3.5 spell library: ${knowledge.spellCorpusStatus}, ${knowledge.totalSpells} total (${knowledge.arcaneSpells} arcane, ${knowledge.divineSpells} divine)`,
        "knowledge",
      );
      if (knowledge.errors.length) {
        console.warn("D&D 3.5 SRD spell import fell back to curated records:", knowledge.errors);
      }
    } catch (error) {
      console.warn("D&D 3.5 knowledge initialization failed unexpectedly; curated records remain available:", error);
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
