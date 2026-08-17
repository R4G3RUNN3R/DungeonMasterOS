// Reference implementation only.
// Core multiclass XP-penalty logic. Prestige classes are deliberately not represented as core base classes here.

import type { Dnd35CharacterState } from "./domain";
import { classTotals } from "./mechanics";
import { getCoreRace } from "./races";

export type MulticlassXpAssessment = {
  penaltyPercent: number;
  penalizedClassIds: string[];
  favoredClassId: string | "any" | null;
  effectiveXpAward: number;
};

/**
 * Core rule: ignore the racial favored class when checking imbalance. For a
 * favored class of "any", ignore the character's highest-level base class.
 * Each remaining class that is two or more levels below the character's
 * highest relevant class produces a 20% XP penalty.
 *
 * Source-pack prestige classes should be flagged as exempt by the production
 * class registry rather than shoved into this core-only helper.
 */
export function assessMulticlassXpPenalty(
  state: Dnd35CharacterState,
  rawXpAward: number,
): MulticlassXpAssessment {
  const totals = classTotals(state.levels);
  const entries = Object.entries(totals).filter(([, level]) => level > 0);
  const race = getCoreRace(state.race.raceId);
  const favored = race?.favoredClass ?? null;

  if (entries.length <= 1) {
    return { penaltyPercent: 0, penalizedClassIds: [], favoredClassId: favored, effectiveXpAward: rawXpAward };
  }

  const ignored = new Set<string>();
  if (favored === "any") {
    const highest = Math.max(...entries.map(([, level]) => level));
    const firstHighest = entries.find(([, level]) => level === highest)?.[0];
    if (firstHighest) ignored.add(firstHighest);
  } else if (favored) {
    ignored.add(favored);
  }

  const relevant = entries.filter(([classId]) => !ignored.has(classId));
  if (relevant.length <= 1) {
    return { penaltyPercent: 0, penalizedClassIds: [], favoredClassId: favored, effectiveXpAward: rawXpAward };
  }

  const highestRelevant = Math.max(...relevant.map(([, level]) => level));
  const penalizedClassIds = relevant
    .filter(([, level]) => highestRelevant - level >= 2)
    .map(([classId]) => classId);

  const penaltyPercent = Math.min(100, penalizedClassIds.length * 20);
  const effectiveXpAward = Math.max(0, Math.floor(rawXpAward * (100 - penaltyPercent) / 100));

  return { penaltyPercent, penalizedClassIds, favoredClassId: favored, effectiveXpAward };
}
