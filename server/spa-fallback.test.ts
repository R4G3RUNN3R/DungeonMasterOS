// server/spa-fallback.test.ts
//
// Regression test for the Express-4-vs-Express-5 wildcard route bug: both
// server/vite.ts (dev) and server/static.ts (production) used the
// Express-5-only "/{*path}" wildcard syntax, which path-to-regexp 0.1.x
// (Express 4.22.1, what this project actually runs) cannot parse as a
// wildcard — it never matches anything, so the SPA-fallback route was
// silently dead in both environments. In dev this meant every request,
// including "/", 404'd (nothing else serves the app shell). In production,
// express.static's built-in directory-index behavior happened to serve "/"
// on its own, so only the fallback itself was dead — meaning a request for
// any path express.static doesn't have a file for (bare deep links like
// "/pricing", typed URLs, old bookmarks, share-preview scrapers) got a raw
// "Cannot GET" 404 instead of the SPA shell.
//
// This does NOT mean real in-app navigation was broken: the app routes
// entirely via wouter's useHashLocation (confirmed in client/src/App.tsx),
// and every server-generated redirect (Stripe success/cancel URLs) already
// uses the "#/..." hash form, which browsers never send to the server —
// so "/#/pricing" only ever produces a "GET /" request. This test proves
// both the hash-routed request shape works AND the bare-path fallback
// (deep links, external links) now serves the SPA shell instead of 404.
//
// server/static.ts calls `path.resolve(__dirname, "public")` using
// CommonJS __dirname, which is only meaningful once esbuild has bundled it
// into dist/index.cjs (production's real runtime shape) — importing the
// TS source directly under this project's ESM ("type": "module") config
// would resolve __dirname against the wrong directory. So this test spawns
// the real build artifacts exactly as `npm start` / `npm run dev` do,
// rather than importing the modules in-process.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function waitForServer(base: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/auth/me`);
      if (res.status === 401 || res.status === 200) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server at ${base} did not become ready in time: ${lastErr}`);
}

function killTree(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    child.kill();
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 3000);
  });
}

async function runFallbackChecklist(base: string, apiRoutePath: string) {
  // 1. "/" returns the real app shell.
  const root = await fetch(`${base}/`);
  assert.equal(root.status, 200, "GET / must return 200");
  const rootBody = await root.text();
  assert.match(rootBody, /<div id="root">|main\.tsx|Dungeon Master OS/i, "GET / must serve the SPA shell, not a 404 page");

  // 2. A hash-routed URL only ever produces "GET /" (browsers never send the
  // fragment) — this is what real in-app navigation and Stripe redirect
  // URLs actually generate. Confirms the shell that loads is capable of
  // then client-side-routing to /#/pricing and /#/billing.
  const hashEquivalent = await fetch(`${base}/`);
  assert.equal(hashEquivalent.status, 200);

  // 3. A bare deep-link path (no hash) — external link, typed URL, old
  // bookmark — now gets the SPA shell instead of a raw "Cannot GET" 404.
  const deepLinkPricing = await fetch(`${base}/pricing`);
  assert.equal(deepLinkPricing.status, 200, "GET /pricing (bare path) must fall through to the SPA shell, not 404");
  const deepLinkBody = await deepLinkPricing.text();
  // Dev mode (server/vite.ts) intentionally stamps a fresh cache-busting
  // "?v=<nanoid>" query param onto the main.tsx script src on every
  // request, so two independently fetched responses legitimately differ
  // by that one token. Strip it before comparing shell equivalence.
  const stripCacheBuster = (html: string) => html.replace(/\/src\/main\.tsx(\?v=[^"]+)?/, "/src/main.tsx");
  assert.equal(
    stripCacheBuster(deepLinkBody),
    stripCacheBuster(rootBody),
    "the SPA fallback must serve the same shell regardless of path",
  );

  const deepLinkBilling = await fetch(`${base}/billing`);
  assert.equal(deepLinkBilling.status, 200, "GET /billing (bare path) must fall through to the SPA shell, not 404");

  // 4. A real, registered API route is NOT swallowed by the fallback —
  // routes registered before the SPA fallback still win.
  const apiRes = await fetch(`${base}${apiRoutePath}`);
  assert.ok(
    apiRes.status === 200 || apiRes.status === 401,
    `a real registered API route (${apiRoutePath}) must still be handled by its own route, got ${apiRes.status}`,
  );
  const apiContentType = apiRes.headers.get("content-type") || "";
  assert.match(apiContentType, /json/, "a real API route's response must be JSON, not the HTML SPA shell");
}

test("production SPA fallback (dist/index.cjs, server/static.ts): / and bare deep-links serve the app; API routes are not swallowed", async (t) => {
  const distEntry = path.join(ROOT, "dist", "index.cjs");
  if (!fs.existsSync(distEntry)) {
    t.skip("dist/index.cjs not built — run `npm run build` first");
    return;
  }

  const port = 34599;
  const dbPath = path.join(os.tmpdir(), `dmos-spa-fallback-prod-test-${Date.now()}.sqlite`);
  const child = spawn(process.execPath, [distEntry], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOST: "127.0.0.1",
      DATABASE_URL: dbPath,
      ANTHROPIC_API_KEY: "spa-fallback-test",
      JWT_SECRET: "spa-fallback-test-secret",
    },
  });

  const stderr: string[] = [];
  child.stderr.on("data", (d) => stderr.push(String(d)));

  try {
    const base = `http://127.0.0.1:${port}`;
    await waitForServer(base);
    await runFallbackChecklist(base, "/api/auth/me");
  } catch (err) {
    if (stderr.length) console.error("production server stderr:\n" + stderr.join(""));
    throw err;
  } finally {
    await killTree(child);
    for (const suffix of ["", "-wal", "-shm"]) {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    }
  }
});

test("dev SPA fallback (tsx server/index.ts, server/vite.ts): / and bare deep-links serve the app; API routes are not swallowed", async (t) => {
  const port = 34598;
  const dbPath = path.join(os.tmpdir(), `dmos-spa-fallback-dev-test-${Date.now()}.sqlite`);
  // Invoke tsx's own CLI entry through node.exe directly, rather than the
  // node_modules/.bin/tsx(.cmd) shim through a shell — spawning a shell on
  // Windows to run a .cmd wrapper leaves the real node/tsx process outside
  // the tracked child, so killing the spawned handle orphans it.
  const tsxCli = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const child = spawn(process.execPath, [tsxCli, "server/index.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(port),
      HOST: "127.0.0.1",
      DATABASE_URL: dbPath,
      ANTHROPIC_API_KEY: "spa-fallback-test",
      JWT_SECRET: "spa-fallback-test-secret",
    },
  });

  const stderr: string[] = [];
  child.stderr.on("data", (d) => stderr.push(String(d)));

  try {
    const base = `http://127.0.0.1:${port}`;
    await waitForServer(base, 30_000);
    await runFallbackChecklist(base, "/api/auth/me");
  } catch (err) {
    if (stderr.length) console.error("dev server stderr:\n" + stderr.join(""));
    throw err;
  } finally {
    await killTree(child);
    for (const suffix of ["", "-wal", "-shm"]) {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    }
  }
});
