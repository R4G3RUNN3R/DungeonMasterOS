import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalRulesContext } from "./knowledge-library";

function characterWithFeat() {
  return {
    characterData: JSON.stringify({
      dnd35Feats: [
        {
          featId: "spell-focus",
          name: "Spell Focus",
          parameters: { school: "evocation" },
          sourceIds: ["srd-35"],
          rulesSummary: "Adds +1 to save DCs for spells from the selected school.",
          modifiers: [{ target: "spell.saveDc", operation: "add", value: 1 }],
          selectedAtLevel: 3,
        },
      ],
    }),
  } as any;
}

test("3.5 DM context uses canonical Fireball and owned feat records", () => {
  const context = buildCanonicalRulesContext(
    "dnd35e",
    "I cast Fireball at the goblins.",
    [characterWithFeat()],
  );

  assert.match(context, /CANONICAL RULES LIBRARY/);
  assert.match(context, /SPELL Fireball:/);
  assert.match(context, /wizard 3/);
  assert.match(context, /CHARACTER FEAT Spell Focus:/);
  assert.match(context, /override model memory/i);
  assert.match(context, /different-edition rule/i);
});

test("other rulesets do not receive D&D 3.5 canonical context", () => {
  assert.equal(buildCanonicalRulesContext("dnd5e", "I cast Fireball.", [characterWithFeat()]), "");
});
