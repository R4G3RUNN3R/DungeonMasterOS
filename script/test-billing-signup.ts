import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-signup-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-signup-test";
delete process.env.STRIPE_SECRET_KEY;

const { runMigrations, storage } = await import("../server/storage");
runMigrations();

const { registerRoutes } = await import("../server/routes");
const app = express();
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const email = "billing-signup-test@example.invalid";
  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      username: "billing_signup_test",
      password: "billing-test-password",
    }),
  });

  assert.equal(response.status, 201);

  const created = storage.getUserByEmail(email);
  assert.ok(created);
  assert.equal(created.tier, "free");
  assert.equal(created.subscriptionStatus, "expired");
  assert.equal(created.trialEndsAt, null);
  assert.equal(created.usageResetAt, null);
  assert.equal(created.aiTurnsUsedThisMonth, 0);
  assert.equal(created.bonusTurns, 0);

  console.log("Billing signup regression tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
