import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-api-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-api-test";
delete process.env.STRIPE_SECRET_KEY;

const { runMigrations, storage } = await import("../server/storage");
runMigrations();

const { signToken } = await import("../server/auth");
const { registerRoutes } = await import("../server/routes");

const app = express();
app.use(cookieParser());
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);

const user = storage.createUser({
  email: "billing-api-test@example.invalid",
  username: "billing_api_test",
  passwordHash: "not-a-real-password",
} as any);

storage.updateUser(user.id, {
  tier: "adventurer",
  subscriptionStatus: "active",
  stripeBillingInterval: "weekly",
  aiTurnsUsedThisMonth: 20,
  bonusTurns: 3,
} as any);

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const token = signToken(user.id);
  const response = await fetch(`http://127.0.0.1:${address.port}/api/billing`, {
    headers: { cookie: `dmos_session=${token}` },
  });

  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.stripeBillingInterval, "weekly");
  assert.equal(body.turnsIncluded, 50);
  assert.equal(body.turnsAvailable, 53);
  assert.equal(body.turnBalance, 33);

  console.log("Billing API entitlement regression tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
