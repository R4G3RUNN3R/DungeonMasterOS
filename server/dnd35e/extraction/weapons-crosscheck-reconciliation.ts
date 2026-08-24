// server/dnd35e/extraction/weapons-crosscheck-reconciliation.ts
//
// Real cross-transport reconciliation for weapons: compares a primary
// extraction (d20srd.org, via weapons-extractor.ts) against a second real,
// independently-registered transport (the olimot/srd-v3.5 mirror, via
// weapons-crosscheck-olimot.ts) for the SAME canonical weapon entity.
//
// Per the established source/provenance architecture: the two transports
// are not competing rules authorities — they are two real representations
// of the same underlying SRD mechanic. This module's job is to determine
// whether they actually agree once real formatting differences (× vs x,
// hyphen vs en dash, "&nbsp;" indentation) are normalized away, and to
// disclose — never silently resolve — any real remaining mechanical
// disagreement.
//
// Deliberately reuses the primary extractor's own field parsers
// (parseCritical/parseRangeIncrement/parseWeight/parseDamageTypes) on the
// cross-check transport's raw text, rather than comparing raw display
// strings directly — this is what makes "×2" and "x2" compare as equal
// (both parse to {threatRangeLow: null, multiplier: 2}) without either
// extractor needing to know about the other's real markup conventions.

import type { Dnd35eWeaponDefinition } from "@shared/rules-registry/dnd35e/equipment";
import { parseCost, parseCritical, parseDamageTypes, parseRangeIncrement, parseWeight } from "./weapons-extractor";
import { olimotWeaponCanonicalId, type OlimotWeaponRow } from "./weapons-crosscheck-olimot";

export type WeaponCrossCheckAgreementStatus = "matches" | "conflicts" | "not_found_in_cross_check";

export interface WeaponCrossCheckResult {
  canonicalId: string;
  agreementStatus: WeaponCrossCheckAgreementStatus;
  conflictingFields: string[];
}

function fieldsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function reconcileWeapon(primary: Dnd35eWeaponDefinition, crossCheckRows: OlimotWeaponRow[]): WeaponCrossCheckResult {
  const crossCheck = crossCheckRows.find((row) => olimotWeaponCanonicalId(row) === primary.canonicalId);
  if (!crossCheck) {
    return { canonicalId: primary.canonicalId, agreementStatus: "not_found_in_cross_check", conflictingFields: [] };
  }

  const conflictingFields: string[] = [];

  const crossCost = parseCost(crossCheck.costDisplay);
  if (primary.cost.copperPieces !== crossCost.cost.copperPieces) conflictingFields.push("cost");

  if (!fieldsEqual(primary.damageSmall, crossCheck.damageSmall)) conflictingFields.push("damageSmall");
  if (!fieldsEqual(primary.damageMedium, crossCheck.damageMedium)) conflictingFields.push("damageMedium");

  const crossCritical = parseCritical(crossCheck.criticalDisplay);
  if (primary.criticalThreatRangeLow !== crossCritical.threatRangeLow) conflictingFields.push("criticalThreatRangeLow");
  if (primary.criticalMultiplier !== crossCritical.multiplier) conflictingFields.push("criticalMultiplier");

  const crossRange = parseRangeIncrement(crossCheck.rangeDisplay);
  if (primary.rangeIncrementFt !== crossRange.value) conflictingFields.push("rangeIncrementFt");

  const crossWeight = parseWeight(crossCheck.weightDisplay);
  // Real, known exception: d20srd's real "special" Cost/Weight rows (Shield
  // light/heavy, Spiked shield light/heavy, Spiked armor) are NOT present
  // in the olimot mirror's real weapons table at all (that transport omits
  // shield/armor-as-weapon rows entirely) — this is a genuine, disclosed
  // transport coverage gap the primary extractor already discloses via its
  // own extractionNotes, not counted again as a cross-check conflict here.
  if (primary.weightLb !== crossWeight.value && !(primary.weightLb === null && crossWeight.value === null)) {
    conflictingFields.push("weightLb");
  }

  const crossTypes = parseDamageTypes(crossCheck.typeDisplay);
  if (!fieldsEqual(primary.damageTypes, crossTypes.types) || primary.damageTypeJoin !== crossTypes.join) {
    conflictingFields.push("damageTypes");
  }

  return {
    canonicalId: primary.canonicalId,
    agreementStatus: conflictingFields.length === 0 ? "matches" : "conflicts",
    conflictingFields,
  };
}
