import {
  createEmptyWorldState,
  generateCampaignMemoryUpdate,
  mergeCampaignWorldState,
} from "../server/campaign-memory";
import { generateDMResponse, generateOpeningScene } from "../server/dm-engine";
import type { Campaign, CampaignCurrency, Character, Message } from "../shared/schema";

async function main() {
  const campaign = {
    name: "Smoke Test - DMS",
    tone: "grounded cinematic",
    rulesWeight: "hybrid",
    powerLevel: "heroic",
    worldType: "custom",
    combatStyle: "consequential",
    storyMode: true,
    worldGenStyle: "continuity-first",
    customWorldPrompt:
      "A storm-battered port city where ships keep vanishing and the harbor guild is hiding something.",
    homebrewRules: "Keep NPC motives grounded and make consequences visible.",
    worldState: JSON.stringify(
      mergeCampaignWorldState(createEmptyWorldState(), {
        flags: ["three ships vanished after docking at Pier Nine"],
        currentScene: "Rain lashes the harbor while rumors spread through the docks.",
        factions: [{ name: "Harbor Guild", currentMove: "deflecting questions about the missing ships" }],
      }),
    ),
  } as Campaign;

  const characters = [
    {
      name: "Marrow Vale",
      race: "Human",
      charClass: "Fighter / Investigator",
    },
  ] as Character[];

  const currencies = [
    {
      code: "gold",
      name: "Gold",
      symbol: "gp",
    },
  ] as CampaignCurrency[];

  const opening = await generateOpeningScene(campaign, characters, currencies);
  console.log("\n=== OPENING SCENE ===\n");
  console.log(opening);

  const history = [
    {
      sender: "Dungeon Master",
      senderType: "dm",
      content: opening,
    },
  ] as Message[];

  const action =
    "I question the dockmaster about the missing ships and watch his face when I mention Pier Nine.";
  const response = await generateDMResponse(
    campaign,
    characters,
    history,
    action,
    "Marrow Vale",
    currencies,
  );

  console.log("\n=== PLAYER ACTION ===\n");
  console.log(action);
  console.log("\n=== DM RESPONSE ===\n");
  console.log(response);

  const memoryDelta = await generateCampaignMemoryUpdate({
    campaign,
    characters,
    history: [
      ...history,
      {
        sender: characters[0].name,
        senderType: "player",
        content: action,
      } as Message,
      {
        sender: "Dungeon Master",
        senderType: "dm",
        content: response,
      } as Message,
    ],
    latestNarration: response,
  });

  console.log("\n=== MEMORY UPDATE ===\n");
  console.log(JSON.stringify(memoryDelta, null, 2));
}

main().catch((error) => {
  console.error("Local DMS smoke test failed.");
  console.error(error);
  process.exit(1);
});
