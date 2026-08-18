import assert from "node:assert/strict";
import test from "node:test";
import { dnd35ItemRewardAdapter } from "./dnd35-item-library";
import type { Dnd35ItemDefinition } from "@shared/dnd35-rules/items";

const source = { sourceId: "srd-35", sourceKind: "srd-open" as const, confidence: "verified" as const };

test("3.5 weapon adapter preserves canonical damage and weight for inventory reconciliation", () => {
  const dagger: Dnd35ItemDefinition = {
    id: "equipment:dagger",
    name: "Dagger",
    edition: "3.5e",
    category: "weapon",
    price: { amount: 2, currency: "gp", text: "2 gp" },
    weightLb: 1,
    weapon: { proficiency: "simple", usage: "light", damageSmall: "1d3", damageMedium: "1d4", critical: "19–20/x2", rangeIncrementFeet: 10, damageTypes: ["piercing", "slashing"] },
    rulesSummary: "A standard dagger.",
    executionStatus: "structured",
    sources: [source],
    tags: ["srd", "weapon"],
  };
  const adapted = dnd35ItemRewardAdapter(dagger);
  assert.equal(adapted.ruleset, "dnd35e");
  assert.equal(adapted.definitionKey, "dnd35:equipment:dagger");
  assert.equal(adapted.weight, 1);
  assert.equal(adapted.mechanics.baseDamage, "1d4");
  assert.equal(adapted.mechanics.critical, "19–20/x2");
});

test("3.5 armor adapter produces AC stat mod and preserves spell failure", () => {
  const leather: Dnd35ItemDefinition = {
    id: "equipment:leather",
    name: "Leather",
    edition: "3.5e",
    category: "armor",
    weightLb: 15,
    armor: { armorClass: "light", armorOrShieldBonus: 2, maximumDexBonus: 6, armorCheckPenalty: 0, arcaneSpellFailurePercent: 10, speed30Feet: 30, speed20Feet: 20 },
    rulesSummary: "Leather armor.",
    executionStatus: "structured",
    sources: [source],
    tags: ["srd", "armor"],
  };
  const adapted = dnd35ItemRewardAdapter(leather);
  assert.equal(adapted.mechanics.arcaneSpellFailurePercent, 10);
  assert.deepEqual(adapted.effects, [{ type: "stat_mod", stat: "ac", modifier: 2 }]);
});
