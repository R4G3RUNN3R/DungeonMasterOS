// Reference implementation only.
// Permanent spell choices are entitlements. The player selects; the engine validates.

import type { Dnd35CharacterState } from "./domain";
import { classLevelAtCharacterLevel, classTotals, effectivePermanentAbilities, abilityModifier } from "./mechanics";
import { spellsKnownEntitlement, CORE_SPELL_PROGRESSION } from "./spellcasting";

export type SpellChoiceEntitlement = {
  id: string;
  classId: string;
  kind: "known" | "spellbook" | "prepared_runtime" | "domain" | "specialization";
  count?: number;
  spellLevel?: number;
  maximumSpellLevel?: number;
  notes: string;
};

function knownCountAtLevel(classId: "bard" | "sorcerer", classLevel: number, spellLevel: number): number {
  return Number(spellsKnownEntitlement(classId, classLevel)?.[spellLevel as any] ?? 0);
}

function previousKnownCount(classId: "bard" | "sorcerer", classLevel: number, spellLevel: number): number {
  return classLevel <= 1 ? 0 : knownCountAtLevel(classId, classLevel - 1, spellLevel);
}

export function spellEntitlementsForNewClassLevel(
  stateBeforeLevel: Dnd35CharacterState,
  classId: string,
): SpellChoiceEntitlement[] {
  const newClassLevel = classLevelAtCharacterLevel(stateBeforeLevel.levels, classId) + 1;
  const progression = CORE_SPELL_PROGRESSION[classId as keyof typeof CORE_SPELL_PROGRESSION];
  if (!progression) return [];

  const entitlements: SpellChoiceEntitlement[] = [];

  if (classId === "wizard") {
    const intBonus = Math.max(0, abilityModifier(effectivePermanentAbilities(stateBeforeLevel).int));
    if (newClassLevel === 1) {
      entitlements.push({
        id: "wizard:spellbook:level-1-zero-level",
        classId,
        kind: "spellbook",
        notes: "Add all legal 0-level wizard spells except any prohibited-school spells. This is automatic, not an AI choice.",
      });
      entitlements.push({
        id: "wizard:spellbook:level-1-first-level",
        classId,
        kind: "spellbook",
        count: 3 + intBonus,
        spellLevel: 1,
        notes: "Player chooses the starting 1st-level spellbook entries. Validate source policy and prohibited schools.",
      });
      entitlements.push({
        id: "wizard:specialization",
        classId,
        kind: "specialization",
        count: 1,
        notes: "Player explicitly chooses generalist or a legal specialist school/prohibited schools. Never infer this from selected spells.",
      });
    } else {
      entitlements.push({
        id: `wizard:spellbook:class-level-${newClassLevel}`,
        classId,
        kind: "spellbook",
        count: 2,
        maximumSpellLevel: Math.ceil(newClassLevel / 2),
        notes: "Player chooses two free wizard spells gained for advancing a wizard level; additional copied/researched spells are separate campaign events.",
      });
    }
  }

  if (classId === "sorcerer" || classId === "bard") {
    const max = classId === "bard" ? 6 : 9;
    for (let spellLevel = 0; spellLevel <= max; spellLevel += 1) {
      const now = knownCountAtLevel(classId, newClassLevel, spellLevel);
      const before = previousKnownCount(classId, newClassLevel, spellLevel);
      const gained = Math.max(0, now - before);
      if (gained > 0) {
        entitlements.push({
          id: `${classId}:known:${newClassLevel}:${spellLevel}`,
          classId,
          kind: "known",
          count: gained,
          spellLevel,
          notes: `Player chooses ${gained} new level-${spellLevel} spell${gained === 1 ? "" : "s"} known from legal sources.`,
        });
      }
    }
    // Spell replacement at higher class levels is a player option, not an automatic rewrite.
    if (newClassLevel >= 4 && classId === "sorcerer") {
      entitlements.push({
        id: `sorcerer:optional-replacement:${newClassLevel}`,
        classId,
        kind: "known",
        count: 0,
        notes: "Optional: player may replace one known sorcerer spell under the class rule when eligible. Do not replace anything automatically.",
      });
    }
    if (newClassLevel >= 5 && classId === "bard") {
      entitlements.push({
        id: `bard:optional-replacement:${newClassLevel}`,
        classId,
        kind: "known",
        count: 0,
        notes: "Optional: player may replace one known bard spell under the class rule when eligible. Do not replace anything automatically.",
      });
    }
  }

  if (classId === "cleric" && newClassLevel === 1) {
    entitlements.push({
      id: "cleric:domains",
      classId,
      kind: "domain",
      count: 2,
      notes: "Player chooses legal domains from deity/campaign source policy. Domain spells/powers derive from these choices.",
    });
  }

  if (["cleric", "druid", "paladin", "ranger", "wizard"].includes(classId)) {
    entitlements.push({
      id: `${classId}:prepared-runtime:${newClassLevel}`,
      classId,
      kind: "prepared_runtime",
      notes: "Prepared spells are runtime/rest choices and should not be silently frozen as permanent level-up decisions.",
    });
  }

  return entitlements;
}

export function expectedPermanentSpellChoiceCounts(state: Dnd35CharacterState): Record<string, number> {
  const totals = classTotals(state.levels);
  const result: Record<string, number> = {};
  for (const [classId, level] of Object.entries(totals)) {
    if (classId !== "bard" && classId !== "sorcerer") continue;
    const known = spellsKnownEntitlement(classId, level) ?? {};
    for (const [spellLevel, count] of Object.entries(known)) {
      result[`${classId}:${spellLevel}`] = Number(count);
    }
  }
  return result;
}
