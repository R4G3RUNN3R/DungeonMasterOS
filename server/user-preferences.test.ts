// server/user-preferences.test.ts
//
// Task 6 of the Options/Settings feature: GET/PATCH /api/user/preferences,
// the personal (non-campaign) half of the settings system. Exercises the
// Zod schema mirroring the client-side PersonalPreferencesV1 shape and the
// requireAuth-gated routes backed by storage.getUserPreferences /
// storage.upsertUserPreferences (Task 1).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-user-preferences-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "user-preferences-test-secret";
process.env.ANTHROPIC_API_KEY = "user-preferences-test";

const { storage, runMigrations } = await import("./storage");
runMigrations();

const { signToken } = await import("./auth");
const { registerRoutes } = await import("./routes");

let httpServer: ReturnType<typeof createServer>;
let baseUrl: string;

before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address !== "object") throw new Error("failed to bind test server");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(dbPath + suffix);
    } catch {
      // ignore
    }
  }
});

const VALID_PREFS = {
  version: 1,
  display: { layoutPreset: "wide", reducedMotion: false },
  notifications: { achievementToasts: "full" },
};

let fixtureCounter = 0;
function makeUser() {
  const unique = `${Date.now()}-${fixtureCounter++}`;
  return storage.createUser({
    email: `user-${unique}@test.dev`,
    username: `user${unique}`,
    passwordHash: "x",
  } as any);
}

test("GET returns null data for a user with no row yet", async () => {
  const user = makeUser();
  const token = signToken(user.id);
  const res = await fetch(`${baseUrl}/api/user/preferences`, { headers: { cookie: `dmos_session=${token}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data, null);
  assert.equal(body.updatedAt, null);
});

test("PATCH validates and upserts; GET returns exactly what was sent", async () => {
  const user = makeUser();
  const token = signToken(user.id);
  const updatedAt = "2026-08-21T00:00:00.000Z";
  const patchRes = await fetch(`${baseUrl}/api/user/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ data: VALID_PREFS, updatedAt }),
  });
  assert.equal(patchRes.status, 200);
  const getRes = await fetch(`${baseUrl}/api/user/preferences`, { headers: { cookie: `dmos_session=${token}` } });
  const body = await getRes.json();
  assert.deepEqual(body.data, VALID_PREFS);
  assert.equal(body.updatedAt, updatedAt);
});

test("invalid shape (unknown key) is rejected with 400", async () => {
  const user = makeUser();
  const token = signToken(user.id);
  const res = await fetch(`${baseUrl}/api/user/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({ data: { ...VALID_PREFS, extraField: true }, updatedAt: "2026-08-21T00:00:00.000Z" }),
  });
  assert.equal(res.status, 400);
});

test("invalid shape (unknown key nested inside display) is rejected with 400", async () => {
  // `.strict()` on the outer object alone does not reject an unknown key
  // nested inside `display`/`notifications` — Zod's default behavior on a
  // non-strict nested object is to silently strip it, not fail. This proves
  // `.strict()` was applied at every level, not just the outer object.
  const user = makeUser();
  const token = signToken(user.id);
  const res = await fetch(`${baseUrl}/api/user/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({
      data: { ...VALID_PREFS, display: { ...VALID_PREFS.display, garbageKey: true } },
      updatedAt: "2026-08-21T00:00:00.000Z",
    }),
  });
  assert.equal(res.status, 400);
});

test("invalid shape (bad enum) is rejected with 400", async () => {
  const user = makeUser();
  const token = signToken(user.id);
  const res = await fetch(`${baseUrl}/api/user/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${token}` },
    body: JSON.stringify({
      data: { ...VALID_PREFS, notifications: { achievementToasts: "chaotic" } },
      updatedAt: "2026-08-21T00:00:00.000Z",
    }),
  });
  assert.equal(res.status, 400);
});

test("one user's preferences are isolated from another's", async () => {
  const userA = makeUser();
  const userB = makeUser();
  const tokenA = signToken(userA.id);
  await fetch(`${baseUrl}/api/user/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: `dmos_session=${tokenA}` },
    body: JSON.stringify({
      data: { ...VALID_PREFS, notifications: { achievementToasts: "compact" } },
      updatedAt: "2026-08-21T00:00:00.000Z",
    }),
  });
  const tokenB = signToken(userB.id);
  const res = await fetch(`${baseUrl}/api/user/preferences`, { headers: { cookie: `dmos_session=${tokenB}` } });
  const body = await res.json();
  assert.equal(body.data, null, "user B must not see user A's preferences");
});

test("unauthenticated request is rejected", async () => {
  const res = await fetch(`${baseUrl}/api/user/preferences`);
  assert.equal(res.status, 401);
});
