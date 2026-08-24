// shared/rules-registry/dnd35e/equipment.ts
//
// D&D 3.5e mundane equipment: weapons and ammunition, extracted from the
// real d20srd.org "Table: Weapons" (one table covering all three
// proficiency categories). Deliberately 3.5-specific: proficiency category
// (Simple/Martial/Exotic), the Dmg(S)/Dmg(M) size-scaled damage columns, and
// the threat-range/multiplier critical model are 3.5 concepts.

export type Dnd35eWeaponProficiencyCategory = "simple" | "martial" | "exotic";

// The real table's own subcategory header rows — "Unarmed Attacks" only
// appears once (under Simple), never repeated under Martial/Exotic.
export type Dnd35eWeaponGroup = "unarmed" | "light-melee" | "one-handed-melee" | "two-handed-melee" | "ranged";

export interface Dnd35eWeaponCost {
  // Real display text exactly as printed (e.g. "15 gp", "—" for weapons
  // with no listed cost like the bare-handed Unarmed strike).
  display: string;
  // Parsed into copper pieces when the display text is a real, unambiguous
  // "<number> <cp|sp|gp|pp>" amount; null when not (e.g. "—").
  copperPieces: number | null;
}

// Real per-row damage-type join, from the table's own footnote 2: "When two
// types are given, the weapon is both types if the entry specifies 'and,'
// or either type if the entry specifies 'or.'" null when only one type (or
// none, e.g. ammunition) is listed — there is nothing to join.
export type Dnd35eDamageTypeJoin = "and" | "or" | null;

export interface Dnd35eWeaponDefinition {
  canonicalId: string;
  name: string;
  proficiencyCategory: Dnd35eWeaponProficiencyCategory;
  weaponGroup: Dnd35eWeaponGroup;
  cost: Dnd35eWeaponCost;
  // Real dice-notation strings ("1d6"), null for the real "—" cells that
  // appear on a small number of rows (e.g. Net, which deals no damage).
  damageSmall: string | null;
  damageMedium: string | null;
  // Real threat range low end (19 for "19-20/x2", 20 when unstated — i.e. a
  // plain "x2" critical means threat range is the default 20 only). Both
  // fields null for the real "—" case (e.g. Net: it entangles rather than
  // dealing damage, so it has no real critical at all).
  criticalThreatRangeLow: number | null;
  criticalMultiplier: number | null;
  // Real range increment in feet; null for the real "—" cells (a weapon
  // with no listed range increment cannot be thrown/fired at range).
  rangeIncrementFt: number | null;
  // Real weight in pounds; null only for the real "—" cell (Unarmed
  // strike). d20srd's real "&frac12;" (dart, shuriken) parses to 0.5.
  weightLb: number | null;
  damageTypes: string[];
  damageTypeJoin: Dnd35eDamageTypeJoin;
  // Real resolved footnote text this row's <sup> markers point to (e.g.
  // "Reach weapon.", "Double weapon.") — resolved once per extraction
  // against the table's own real <tfoot>, not hand-maintained separately.
  footnotes: string[];
  extractionStatus: "fully_structured" | "partially_structured" | "unresolved";
  extractionNotes: string[];
}

export interface Dnd35eAmmunitionDefinition {
  canonicalId: string;
  name: string;
  // Real "compatible weapon" grouping this ammunition's row sat under in
  // the source table (e.g. Arrows sit under "Ranged Weapons" alongside the
  // bows that use them) — not a resolved weapon canonicalId cross-reference,
  // since the real page never states that link explicitly per-row.
  weaponGroup: Dnd35eWeaponGroup;
  cost: Dnd35eWeaponCost;
  // Real "(N)" quantity suffix on the name, e.g. "Arrows (20)" -> 20. null
  // on the rare real row that has no quantity suffix at all.
  quantityPerPurchase: number | null;
  weightLb: number | null;
  extractionStatus: "fully_structured" | "partially_structured" | "unresolved";
  extractionNotes: string[];
}
