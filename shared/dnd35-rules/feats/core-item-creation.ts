import type { Dnd35FeatDefinition } from "../types";

const srd = {
  sourceId: "srd-35",
  sourceKind: "srd-open" as const,
  section: "Item Creation Feats",
  confidence: "verified" as const,
};

const itemCreationFeat = (
  id: string,
  name: string,
  minimumCasterLevel: number,
  itemType: string,
  tags: string[],
): Dnd35FeatDefinition => ({
  id,
  name,
  edition: "3.5e",
  categories: ["item_creation"],
  prerequisites: { kind: "caster_level", minimum: minimumCasterLevel },
  prerequisiteSummary: `Caster level ${minimumCasterLevel}th.`,
  modifiers: [
    {
      modifierId: `allow-create-${itemType}`,
      target: `itemCreation.${itemType}`,
      operation: "allow",
      value: true,
      rulesNote: "Actual crafting eligibility also depends on the target item's prerequisites, spells, costs, time, and other creation rules.",
    },
  ],
  rulesSummary: `Allows creation of qualifying ${itemType.replaceAll("-", " ")} magic items when all item-specific prerequisites and creation costs are satisfied.`,
  specialRules: [
    "Item creation remains a separate deterministic workflow: verify creator level, required spells/feats, item prerequisites, gold/material costs, XP costs where applicable, and crafting time before allowing completion.",
  ],
  sources: [srd],
  tags: ["core", "phb", "srd", "item-creation", ...tags],
});

export const DND35_CORE_ITEM_CREATION_FEATS: Dnd35FeatDefinition[] = [
  itemCreationFeat("brew-potion", "Brew Potion", 3, "potion", ["consumable"]),
  itemCreationFeat("craft-magic-arms-and-armor", "Craft Magic Arms and Armor", 5, "magic-arms-and-armor", ["weapon", "armor"]),
  itemCreationFeat("craft-rod", "Craft Rod", 9, "rod", ["rod"]),
  itemCreationFeat("craft-staff", "Craft Staff", 12, "staff", ["staff", "spell-trigger"]),
  itemCreationFeat("craft-wand", "Craft Wand", 5, "wand", ["wand", "spell-trigger"]),
  itemCreationFeat("craft-wondrous-item", "Craft Wondrous Item", 3, "wondrous-item", ["wondrous-item"]),
  itemCreationFeat("forge-ring", "Forge Ring", 12, "ring", ["ring"]),
  itemCreationFeat("scribe-scroll", "Scribe Scroll", 1, "scroll", ["scroll", "spell-completion"]),
];

export const DND35_CORE_ITEM_CREATION_BY_ID = new Map(
  DND35_CORE_ITEM_CREATION_FEATS.map((feat) => [feat.id, feat]),
);
