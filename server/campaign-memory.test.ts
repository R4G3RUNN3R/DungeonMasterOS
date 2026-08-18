import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCampaignMemoryUpdate, mergeCampaignWorldState, parseCampaignWorldState } from "./campaign-memory";

function fakeCampaign(overrides: any = {}) {
  return { id: 19, name: "Test Campaign", worldState: null, ...overrides };
}

test("generateCampaignMemoryUpdate: never returns currentScene, even when the model includes one", async () => {
  const fakeGenerate = async () =>
    JSON.stringify({
      currentScene: "The party is suddenly in a merchant's counting house full of ledgers and strongboxes.",
      memory: {
        summary: "The party investigated the warehouse.",
        activeThreads: ["Find the missing shipment"],
        discoveredFacts: [],
        npcNotes: [],
        recentConsequences: [],
      },
    });

  const result = await generateCampaignMemoryUpdate(
    {
      campaign: fakeCampaign(),
      characters: [{ id: 22, name: "Kira", race: "Human", charClass: "Rogue" } as any],
      history: [],
      latestNarration: "Kira searches the warehouse office.",
    },
    fakeGenerate as any,
  );

  assert.ok(result);
  assert.equal("currentScene" in result!, false);
  assert.equal(result?.memory?.summary, "The party investigated the warehouse.");
});

test("generateCampaignMemoryUpdate: a currentScene-smuggling response can never overwrite world state via mergeCampaignWorldState", async () => {
  const fakeGenerate = async () =>
    JSON.stringify({
      currentScene: "A completely unrelated location with mud and bootprints.",
      memory: { summary: "", activeThreads: [], discoveredFacts: [], npcNotes: [], recentConsequences: [] },
    });

  const delta = await generateCampaignMemoryUpdate(
    {
      campaign: fakeCampaign({ worldState: JSON.stringify({ ...parseCampaignWorldState(null), currentScene: "The party stands in the warehouse office." }) }),
      characters: [],
      history: [],
      latestNarration: "Kira searches the warehouse office.",
    },
    fakeGenerate as any,
  );

  const base = parseCampaignWorldState(
    JSON.stringify({ ...parseCampaignWorldState(null), currentScene: "The party stands in the warehouse office." }),
  );
  const merged = mergeCampaignWorldState(base, delta ?? {});

  assert.equal(merged.currentScene, "The party stands in the warehouse office.");
});

test("mergeCampaignWorldState: accepts a structured {name, description} currentScene, as the DM prompt's own [WORLD_STATE] instructions ask for", () => {
  // 2026-08-18: dm-engine.ts's WORLD_STATE prompt section tells the model to
  // emit currentScene as an object, but this merge used to only accept a
  // string delta — silently discarding a model that correctly followed its
  // own prompt. Confirmed both the object-accepting path and that it still
  // replaces (not merges into) the prior scene, matching string behavior.
  const base = parseCampaignWorldState(null);
  const merged = mergeCampaignWorldState(base, {
    currentScene: { name: "The Rusted Anchor Tavern", description: "A smoky dockside tavern" },
  });

  assert.deepEqual(merged.currentScene, { name: "The Rusted Anchor Tavern", description: "A smoky dockside tavern" });
});

test("mergeCampaignWorldState: a structured currentScene round-trips through parseCampaignWorldState after being persisted", () => {
  const merged = mergeCampaignWorldState(parseCampaignWorldState(null), {
    currentScene: { name: "Port Vaelis Docks" },
  });
  const reparsed = parseCampaignWorldState(JSON.stringify(merged));

  assert.deepEqual(reparsed.currentScene, { name: "Port Vaelis Docks" });
});

test("mergeCampaignWorldState: an empty/malformed currentScene delta never overwrites an existing structured scene", () => {
  const base = mergeCampaignWorldState(parseCampaignWorldState(null), {
    currentScene: { name: "The Rusted Anchor Tavern" },
  });
  const merged = mergeCampaignWorldState(base, { currentScene: {} });

  assert.deepEqual(merged.currentScene, { name: "The Rusted Anchor Tavern" });
});
