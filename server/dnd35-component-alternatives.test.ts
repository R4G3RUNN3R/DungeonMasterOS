import assert from "node:assert/strict";
import test from "node:test";
import { resolveDnd35CastPreflight } from "@shared/dnd35-rules/cast-preflight-guarded";
import type { Dnd35SpellDefinition, Dnd35SpellcastingState } from "@shared/dnd35-rules/types";

function spellFor(classId: string, tradition: "arcane" | "divine"): Dnd35SpellDefinition {
  return {
    id: "component-alternative-test",
    name: "Component Alternative Test",
    edition: "3.5e",
    school: "conjuration",
    classAccess: [{
      classId,
      level: 1,
      tradition,
      source: { sourceId: "srd-35", sourceKind: "srd-open", confidence: "verified" },
    }],
    castingTime: { kind: "standard" },
    components: [
      { kind: "M", required: true, appliesToTradition: "arcane", alternativeGroup: "m-or-df" } as any,
      { kind: "DF", required: true, appliesToTradition: "divine", alternativeGroup: "m-or-df" } as any,
    ],
    range: { kind: "touch" },
    targeting: { delivery: ["melee_touch"] },
    duration: { kind: "instantaneous" },
    savingThrow: { type: "none" },
    spellResistance: { applies: false },
    effects: [],
    rulesSummary: "Test fixture.",
    sources: [{ sourceId: "srd-35", sourceKind: "srd-open", confidence: "verified" }],
    tags: ["test"],
  };
}

function casting(classId: string, tradition: "arcane" | "divine"): Dnd35SpellcastingState {
  return {
    classId,
    classLevel: 5,
    casterLevel: 5,
    tradition,
    castingAbility: tradition === "arcane" ? "int" : "wis",
    castingAbilityScore: 16,
    mode: "special",
    spellSlots: { 1: { maximum: 2, expended: 0 } },
  };
}

function request(spellId: string) {
  return {
    spellId,
    environment: {
      canSpeak: true,
      hasSomaticFreedom: true,
      threatened: false,
      lineOfEffect: true,
      lineOfSight: true,
      antimagic: false,
    },
  };
}

test("arcane M/DF casting requires the material route, not the divine focus route", () => {
  const spell = spellFor("wizard", "arcane");
  const resolution = resolveDnd35CastPreflight({
    spell,
    casting: casting("wizard", "arcane"),
    request: request(spell.id),
    characterFeatIds: [],
    componentAccess: { hasSpellComponentPouch: true, hasDivineFocus: false },
  });

  assert.equal(resolution.legal, true);
  assert.ok(resolution.decisions.some((decision) => decision.code === "MATERIAL_COMPONENT" && decision.passed));
  assert.ok(!resolution.decisions.some((decision) => decision.code === "DIVINE_FOCUS"));
});

test("divine M/DF casting requires the divine focus route, not the material route", () => {
  const spell = spellFor("cleric", "divine");
  const resolution = resolveDnd35CastPreflight({
    spell,
    casting: casting("cleric", "divine"),
    request: request(spell.id),
    characterFeatIds: [],
    componentAccess: { hasSpellComponentPouch: false, hasDivineFocus: true },
  });

  assert.equal(resolution.legal, true);
  assert.ok(resolution.decisions.some((decision) => decision.code === "DIVINE_FOCUS" && decision.passed));
  assert.ok(!resolution.decisions.some((decision) => decision.code === "MATERIAL_COMPONENT"));
});
