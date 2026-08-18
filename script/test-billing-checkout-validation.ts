import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `dmos-billing-checkout-validation-test-${Date.now()}.sqlite`);
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

process.env.DATABASE_URL = dbPath;
process.env.ANTHROPIC_API_KEY = "billing-checkout-validation-test";
process.env.STRIPE_SECRET_KEY = "sk_test_billing_checkout_validation_test";
delete process.env.STRIPE_PRICE_CHRONICLER_MONTHLY;

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
  email: "billing-checkout-validation-test@example.invalid",
  username: "billing_checkout_validation_test",
  passwordHash: "not-a-real-password",
} as any);

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const token = signToken(user.id);
  const response = await fetch(`http://127.0.0.1:${address.port}/api/stripe/checkout`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `dmos_session=${token}`,
    },
    body: JSON.stringify({ tier: "chronicler", interval: "monthly" }),
  });

  assert.equal(response.status, 400);
  const body = await response.json() as any;
  assert.equal(body.message, "That subscription tier is not available for purchase.");

  const invalidIntervalResponse = await fetch(`http://127.0.0.1:${address.port}/api/stripe/checkout`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `dmos_session=${token}`,
    },
    body: JSON.stringify({ tier: "adventurer", interval: "fortnightly" }),
  });

  assert.equal(invalidIntervalResponse.status, 400);
  const invalidIntervalBody = await invalidIntervalResponse.json() as any;
  assert.equal(invalidIntervalBody.message, "That billing interval is not available for purchase.");

  console.log("Billing checkout validation regression tests passed.");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
