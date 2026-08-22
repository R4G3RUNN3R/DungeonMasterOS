import type { Dnd35FeatDefinition } from "../types";

const srd = (section: string) => ({ sourceId: "srd-35", sourceKind: "srd-open" as const, section, confidence: "verified" as const });

export const DND35_CORE_SPELLCASTING_FEATS: Dnd35FeatDefinition[] = [
  {
    id: "augment-summoning", name: "Augment Summoning", edition: "3.5e", categories: ["general"],
    prerequisites: { kind: "feat", featId: "spell-focus", parameter: "conjuration" }, prerequisiteSummary: "Spell Focus (conjuration).",
    modifiers: [
      { modifierId: "augment-summoning-str", target: "summonedCreature.strength", operation: "add", value: 4, bonusType: "enhancement", condition: "Creature is summoned by the caster using a conjuration (summoning) spell while this feat applies." },
      { modifierId: "augment-summoning-con", target: "summonedCreature.constitution", operation: "add", value: 4, bonusType: "enhancement", condition: "Creature is summoned by the caster using a conjuration (summoning) spell while this feat applies." },
    ],
    rulesSummary: "Creatures summoned by the caster's qualifying conjuration (summoning) spells gain +4 enhancement bonuses to Strength and Constitution for the summon duration.", sources: [srd("Augment Summoning")], tags: ["core", "phb", "srd", "spellcasting", "summoning"],
  },
  {
    id: "combat-casting", name: "Combat Casting", edition: "3.5e", categories: ["general"],
    modifiers: [{ modifierId: "combat-casting-concentration", target: "skill.concentration.check", operation: "add", value: 4, bonusType: "untyped", condition: "Concentration check made to cast defensively or while grappling/pinned where the feat applies." }],
    rulesSummary: "Grants a +4 bonus on qualifying Concentration checks made to cast under close-combat pressure.", sources: [srd("Combat Casting")], tags: ["core", "phb", "srd", "spellcasting", "concentration"],
  },
  {
    id: "eschew-materials", name: "Eschew Materials", edition: "3.5e", categories: ["general"],
    modifiers: [{ modifierId: "eschew-low-cost-materials", target: "spell.components.M", operation: "remove", value: true, condition: "Material component has a listed cost of 1 gp or less (including ordinary non-costly components).", rulesNote: "Does not remove focus, divine focus, XP, or more expensive material requirements." }],
    rulesSummary: "Allows casting without ordinary material components costing 1 gp or less; more expensive materials and other component types remain required.", sources: [srd("Eschew Materials")], tags: ["core", "phb", "srd", "spellcasting", "component", "material"],
  },
  {
    id: "improved-counterspell", name: "Improved Counterspell", edition: "3.5e", categories: ["general"],
    modifiers: [{ modifierId: "improved-counterspell-option", target: "counterspell.allowedReplacement", operation: "allow", value: true, condition: "Countering spell is of the same school and at least one spell level higher than the spell being countered, subject to normal counterspell rules." }],
    rulesSummary: "Expands counterspell options by permitting a higher-level spell of the same school under the feat's normal counterspell restrictions.", sources: [srd("Improved Counterspell")], tags: ["core", "phb", "srd", "spellcasting", "counterspell"],
  },
  {
    id: "spell-focus", name: "Spell Focus", edition: "3.5e", categories: ["general"], parameters: [{ id: "school", kind: "spell_school", required: true }], repeatable: true,
    repeatRule: "May be selected multiple times for different schools; selecting the same school again does not stack unless another rule explicitly permits it.",
    modifiers: [{ modifierId: "spell-focus-save-dc", target: "spell.saveDc", operation: "add", value: 1, condition: "Spell belongs to the selected school.", stackingKey: "spell-focus-school" }],
    rulesSummary: "Adds +1 to save DCs for spells from the selected school.", sources: [srd("Spell Focus")], tags: ["core", "phb", "srd", "spellcasting", "save-dc", "school"],
  },
  {
    id: "greater-spell-focus", name: "Greater Spell Focus", edition: "3.5e", categories: ["general"], parameters: [{ id: "school", kind: "spell_school", required: true, sameAsPrerequisiteParameter: "school" }],
    prerequisites: { kind: "feat", featId: "spell-focus" }, prerequisiteSummary: "Spell Focus in the selected school.", repeatable: true,
    repeatRule: "May be selected for different schools for which the prerequisite Spell Focus selection exists.",
    modifiers: [{ modifierId: "greater-spell-focus-save-dc", target: "spell.saveDc", operation: "add", value: 1, condition: "Spell belongs to the selected school.", stackingKey: "greater-spell-focus-school" }],
    rulesSummary: "Adds a further +1 to save DCs for spells from the selected school and stacks with Spell Focus.", sources: [srd("Greater Spell Focus")], tags: ["core", "phb", "srd", "spellcasting", "save-dc", "school"],
  },
  {
    id: "spell-penetration", name: "Spell Penetration", edition: "3.5e", categories: ["general"],
    modifiers: [{ modifierId: "spell-penetration-sr", target: "spellResistance.casterLevelCheck", operation: "add", value: 2, condition: "Caster-level check made to overcome spell resistance." }],
    rulesSummary: "Adds +2 to caster-level checks made to overcome spell resistance.", sources: [srd("Spell Penetration")], tags: ["core", "phb", "srd", "spellcasting", "spell-resistance"],
  },
  {
    id: "greater-spell-penetration", name: "Greater Spell Penetration", edition: "3.5e", categories: ["general"], prerequisites: { kind: "feat", featId: "spell-penetration" }, prerequisiteSummary: "Spell Penetration.",
    modifiers: [{ modifierId: "greater-spell-penetration-sr", target: "spellResistance.casterLevelCheck", operation: "add", value: 2, condition: "Caster-level check made to overcome spell resistance." }],
    rulesSummary: "Adds another +2 to caster-level checks to overcome spell resistance and stacks with Spell Penetration.", sources: [srd("Greater Spell Penetration")], tags: ["core", "phb", "srd", "spellcasting", "spell-resistance"],
  },
  {
    id: "spell-mastery", name: "Spell Mastery", edition: "3.5e", categories: ["special"], prerequisites: { kind: "class_level", classId: "wizard", minimum: 1 }, prerequisiteSummary: "Wizard level 1st.",
    parameters: [{ id: "masteredSpells", kind: "spell", required: true }], repeatable: true,
    repeatRule: "Each selection chooses a new set of eligible wizard spells according to the feat rule and the wizard's Intelligence at selection time.",
    modifiers: [{ modifierId: "spell-mastery-prepare-without-book", target: "wizard.preparation.requiresSpellbook", operation: "allow", value: false, condition: "Preparing a spell selected for this Spell Mastery instance." }],
    rulesSummary: "Allows a wizard to prepare selected mastered spells without referring to a spellbook.", sources: [srd("Spell Mastery")], tags: ["core", "phb", "srd", "wizard", "spellbook", "preparation"],
  },
  {
    id: "natural-spell", name: "Natural Spell", edition: "3.5e", categories: ["general"],
    prerequisites: { kind: "all", requirements: [{ kind: "ability", ability: "wis", minimum: 13 }, { kind: "special", rule: "wild-shape" }] }, prerequisiteSummary: "Wis 13, wild shape ability.",
    modifiers: [{ modifierId: "natural-spell-wild-shape", target: "spellcasting.wildShape", operation: "allow", value: true, condition: "Caster is using wild shape; components are adjudicated according to Natural Spell's special rules rather than assuming ordinary humanoid speech/hands." }],
    rulesSummary: "Allows a character with wild shape to cast spells while in wild shape under the feat's component-handling rules.", sources: [srd("Natural Spell")], tags: ["core", "phb", "srd", "druid", "wild-shape", "spellcasting"],
  },
];

export const DND35_CORE_SPELLCASTING_FEATS_BY_ID = new Map(DND35_CORE_SPELLCASTING_FEATS.map((feat) => [feat.id, feat]));
