import assert from "node:assert/strict";
import test from "node:test";
import { getDnd35Spell } from "@shared/dnd35-rules/catalogue";
import { resolveDnd35CastPreflight } from "@shared/dnd35-rules/cast-preflight-guarded";
import type { Dnd35SpellDefinition, Dnd35SpellLevel, Dnd35SpellcastingState } from "@shared/dnd35-rules/types";

function casting(
  classId: string,
  tradition: "arcane" | "divine",
  level: Dnd35SpellLevel,
  spellId: string,
  mode: "prepared_spellbook" | "prepared_divine" = tradition === "arcane" ? "prepared_spellbook" : "prepared_divine",
): Dnd35SpellcastingState {
  return {
    classId,
    classLevel: Math.max(1, level * 2 - 1),
    casterLevel: Math.max(1, level * 2 - 1),
    tradition,
    castingAbility: tradition === "arcane" ? "int" : "wis",
    castingAbilityScore: 18,
    mode,
    spellbookSpellIds: mode === "prepared_spellbook" ? [spellId] : undefined,
    knownSpellIds: [spellId],
    preparedSpells: [{ spellId, slotLevel: level, preparedCount: 1, expendedCount: 0 }],
    spellSlots: { [level]: { level, maximum: 2, expended: 0 } },
  };
}

function resolve(
  spell: Dnd35SpellDefinition,
  state: Dnd35SpellcastingState,
  componentAccess: {
    hasSpellComponentPouch?: boolean;
    canEschewOrdinaryMaterials?: boolean;
    hasDivineFocus?: boolean;
    itemTags?: string[];
  },
) {
  return resolveDnd35CastPreflight({
    spell,
    casting: state,
    characterFeatIds: componentAccess.canEschewOrdinaryMaterials ? ["eschew-materials"] : [],
    request: {
      spellId: spell.id,
      castingClassId: state.classId,
      environment: {
        canSpeak: true,
        hasSomaticFreedom: true,
        lineOfEffect: true,
        lineOfSight: true,
        antimagic: false,
        arcaneSpellFailurePercent: 0,
      },
    },
    componentAccess,
  });
}

test("ordinary focus components are supplied by a real spell component pouch", () => {
  const spell = getDnd35Spell("mage-armor")!;
  const result = resolve(spell, casting("wizard", "arcane", 1, spell.id), { hasSpellComponentPouch: true });
  assert.equal(result.legal, true);
  assert.ok(result.decisions.some((decision) => decision.code === "FOCUS_COMPONENT" && decision.passed));
});

test("Eschew Materials does not satisfy a focus component", () => {
  const spell = getDnd35Spell("mage-armor")!;
  const result = resolve(spell, casting("wizard", "arcane", 1, spell.id), { canEschewOrdinaryMaterials: true });
  assert.equal(result.legal, false);
  assert.ok(result.decisions.some((decision) => decision.code === "FOCUS_COMPONENT" && !decision.passed));
});

test("Eschew Materials satisfies ordinary material components without pretending to be a pouch", () => {
  const spell = getDnd35Spell("fireball")!;
  const result = resolve(spell, casting("wizard", "arcane", 3, spell.id), { canEschewOrdinaryMaterials: true });
  assert.equal(result.legal, true);
  assert.ok(result.decisions.some((decision) => decision.code === "MATERIAL_COMPONENT" && decision.passed));
});

test("F/DF chooses the arcane focus route for an arcane Hold Person casting", () => {
  const spell = getDnd35Spell("hold-person")!;
  const result = resolve(spell, casting("wizard", "arcane", 3, spell.id), { hasSpellComponentPouch: true, hasDivineFocus: false });
  assert.equal(result.legal, true);
  assert.ok(result.decisions.some((decision) => decision.code === "FOCUS_COMPONENT" && decision.passed));
  assert.ok(!result.decisions.some((decision) => decision.code === "DIVINE_FOCUS"));
});

test("F/DF chooses the divine-focus route for a divine Hold Person casting", () => {
  const spell = getDnd35Spell("hold-person")!;
  const result = resolve(spell, casting("cleric", "divine", 2, spell.id), { hasDivineFocus: true, hasSpellComponentPouch: false });
  assert.equal(result.legal, true);
  assert.ok(result.decisions.some((decision) => decision.code === "DIVINE_FOCUS" && decision.passed));
  assert.ok(!result.decisions.some((decision) => decision.code === "FOCUS_COMPONENT"));
});

test("M/DF chooses the arcane material route rather than requiring both", () => {
  const spell = getDnd35Spell("invisibility")!;
  const result = resolve(spell, casting("wizard", "arcane", 2, spell.id), { canEschewOrdinaryMaterials: true, hasDivineFocus: false });
  assert.equal(result.legal, true);
  assert.ok(result.decisions.some((decision) => decision.code === "MATERIAL_COMPONENT" && decision.passed));
  assert.ok(!result.decisions.some((decision) => decision.code === "DIVINE_FOCUS"));
});

test("costly focus cannot be replaced by a spell component pouch", () => {
  const base = getDnd35Spell("mage-armor")!;
  const spell: Dnd35SpellDefinition = {
    ...base,
    id: "test-costly-focus",
    classAccess: base.classAccess,
    components: [
      { kind: "V", required: true },
      { kind: "F", required: true, gpCost: 100, itemTags: ["test-costly-focus"] },
    ],
  };
  const state = casting("wizard", "arcane", 1, spell.id);
  const result = resolve(spell, state, { hasSpellComponentPouch: true });
  assert.equal(result.legal, false);
  assert.ok(result.decisions.some((decision) => decision.code === "COSTLY_FOCUS_COMPONENT" && !decision.passed));
});
