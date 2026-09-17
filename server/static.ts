import express, { type Express } from "express";
import fs from "fs";
import path from "path";

type PublicSeoPage = {
  title: string;
  description: string;
  canonical: string;
  fallback: string;
};

const VOIDSMITH_LINK = '<a href="https://voidsmithindustries.com/">Voidsmith Industries</a>';

const PUBLIC_SEO: Record<string, PublicSeoPage> = {
  "/": {
    title: "DungeonMasterOS | Persistent AI Dungeon Master RPG",
    description:
      "DungeonMasterOS is a persistent multiplayer tabletop RPG experience powered by an AI Dungeon Master, built for ongoing campaigns in the browser.",
    canonical: "https://dungeonmaster-os.com/",
    fallback: `
      <main data-dmos-seo-fallback>
        <h1>DungeonMasterOS: a persistent AI Dungeon Master for real campaigns</h1>
        <p>DungeonMasterOS is a browser-based multiplayer tabletop RPG powered by a persistent AI Dungeon Master. Campaigns keep their world state, character progress, relationships and consequences across sessions.</p>
        <p>Players can run ongoing campaigns with character systems, multiplayer sessions, campaign memory and a living world rather than starting from a blank chatbot conversation every time.</p>
        <nav aria-label="DungeonMasterOS public information">
          <a href="/how-it-works">How DungeonMasterOS works</a>
          <a href="/pricing">DungeonMasterOS pricing</a>
        </nav>
        <footer>Powered by ${VOIDSMITH_LINK}</footer>
      </main>`,
  },
  "/how-it-works": {
    title: "How DungeonMasterOS Works | Persistent AI RPG Campaigns",
    description:
      "Learn how DungeonMasterOS runs persistent AI-guided tabletop RPG campaigns with campaign memory, character systems, multiplayer sessions, and lasting world consequences.",
    canonical: "https://dungeonmaster-os.com/how-it-works",
    fallback: `
      <main data-dmos-seo-fallback>
        <h1>How DungeonMasterOS works</h1>
        <p>DungeonMasterOS combines an AI Dungeon Master with persistent campaign memory, character systems and multiplayer state. The AI narrates scenes, controls NPCs, adjudicates actions and carries important world consequences forward between sessions.</p>
        <p>Campaign data persists beyond a single conversation, so locations, relationships, character progress and prior decisions can continue to matter when the party returns.</p>
        <nav aria-label="DungeonMasterOS public information">
          <a href="/">DungeonMasterOS overview</a>
          <a href="/pricing">View pricing</a>
        </nav>
        <footer>Powered by ${VOIDSMITH_LINK}</footer>
      </main>`,
  },
  "/pricing": {
    title: "DungeonMasterOS Pricing | AI Dungeon Master Plans",
    description:
      "Compare DungeonMasterOS plans for persistent AI Dungeon Master campaigns, multiplayer play, campaign memory, and browser-based tabletop RPG sessions.",
    canonical: "https://dungeonmaster-os.com/pricing",
    fallback: `
      <main data-dmos-seo-fallback>
        <h1>DungeonMasterOS pricing and subscription plans</h1>
        <p>DungeonMasterOS offers a free trial and paid subscription plans for persistent AI Dungeon Master campaigns. Current plan availability, billing intervals and checkout options are loaded by the interactive application.</p>
        <p>Plans support the same persistent campaign foundation, including campaign memory, browser-based play and multiplayer campaign features, with allowances varying by tier.</p>
        <nav aria-label="DungeonMasterOS public information">
          <a href="/">DungeonMasterOS overview</a>
          <a href="/how-it-works">How DungeonMasterOS works</a>
        </nav>
        <footer>Powered by ${VOIDSMITH_LINK}</footer>
      </main>`,
  },
};

function replaceMetaContent(html: string, name: string, value: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(<meta\\s+[^>]*(?:name|property)=["']${escapedName}["'][^>]*content=["'])[^"']*(["'][^>]*>)`, "i");
  return html.replace(pattern, `$1${value}$2`);
}

function renderPublicShell(template: string, page: PublicSeoPage) {
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${page.title}</title>`);
  html = replaceMetaContent(html, "description", page.description);
  html = replaceMetaContent(html, "robots", "index, follow, max-image-preview:large");
  html = replaceMetaContent(html, "og:title", page.title);
  html = replaceMetaContent(html, "og:description", page.description);
  html = replaceMetaContent(html, "og:url", page.canonical);
  html = replaceMetaContent(html, "twitter:title", page.title);
  html = replaceMetaContent(html, "twitter:description", page.description);
  html = html.replace(
    /<link\s+[^>]*rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${page.canonical}" />`,
  );
  html = html.replace('<div id="root"></div>', `<div id="root">${page.fallback}</div>`);
  return html;
}

function renderPrivateShell(template: string) {
  let html = replaceMetaContent(template, "robots", "noindex, follow");
  html = html.replace(/\s*<link\s+[^>]*rel=["']canonical["'][^>]*>/i, "");
  return html;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexPath = path.resolve(distPath, "index.html");
  const template = fs.readFileSync(indexPath, "utf8");

  // Public information pages get route-specific metadata and semantic fallback
  // content in the initial HTTP response. React replaces the fallback after boot.
  for (const [route, page] of Object.entries(PUBLIC_SEO)) {
    app.get(route, (_req, res) => {
      res.type("html").send(renderPublicShell(template, page));
    });
  }

  // Static assets, robots.txt and sitemap.xml remain normal files. Disable the
  // implicit directory index so `/` cannot bypass the route-aware response above.
  app.use(express.static(distPath, { index: false }));

  // Express 4 SPA fallback: application/auth routes still receive the client
  // shell, but the server response is noindex and does not canonicalize them to
  // the public homepage. `/{*path}` is Express 5 syntax and does not work here.
  app.use("*", (_req, res) => {
    res.type("html").send(renderPrivateShell(template));
  });
}
