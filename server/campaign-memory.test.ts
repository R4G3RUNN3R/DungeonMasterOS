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
