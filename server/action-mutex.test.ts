import { test } from "node:test";
import assert from "node:assert/strict";
import { withCampaignLock } from "./action-mutex";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("withCampaignLock: serializes concurrent calls for the same campaign", async () => {
  const order: string[] = [];

  const a = withCampaignLock(1, async () => {
    order.push("a-start");
    await delay(20);
    order.push("a-end");
    return "a";
  });
  const b = withCampaignLock(1, async () => {
    order.push("b-start");
    await delay(5);
    order.push("b-end");
    return "b";
  });

  const [resultA, resultB] = await Promise.all([a, b]);
  assert.equal(resultA, "a");
  assert.equal(resultB, "b");
  // b must not start until a has fully finished, even though b's own work is faster
  assert.deepEqual(order, ["a-start", "a-end", "b-start", "b-end"]);
});

test("withCampaignLock: different campaigns run concurrently, not serialized", async () => {
  const order: string[] = [];

  const a = withCampaignLock(1, async () => {
    order.push("campaign1-start");
    await delay(20);
    order.push("campaign1-end");
  });
  const b = withCampaignLock(2, async () => {
    order.push("campaign2-start");
    await delay(5);
    order.push("campaign2-end");
  });

  await Promise.all([a, b]);
  // campaign2 finishes before campaign1 even though campaign1 started first,
  // proving they ran in parallel rather than being serialized against each other.
  assert.deepEqual(order, ["campaign1-start", "campaign2-start", "campaign2-end", "campaign1-end"]);
});

test("withCampaignLock: a rejected call doesn't block the next queued call for the same campaign", async () => {
  const results: string[] = [];

  const a = withCampaignLock(3, async () => {
    throw new Error("boom");
  });
  const b = withCampaignLock(3, async () => {
    results.push("b-ran");
    return "ok";
  });

  await assert.rejects(a, /boom/);
  const resultB = await b;
  assert.equal(resultB, "ok");
  assert.deepEqual(results, ["b-ran"]);
});
