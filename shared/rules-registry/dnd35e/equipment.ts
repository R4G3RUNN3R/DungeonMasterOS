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

// Real d20srd.org "Table: Armor and Shields" convention: a single-tier
// category breakdown (unlike Weapons' two-tier Simple/Martial/Exotic ×
// Light/One-Handed/... — Armor has no top-level category, just these five
// real subcategory groups directly).
export type Dnd35eArmorCategory = "light" | "medium" | "heavy" | "shield" | "extra";

export interface Dnd35eArmorDefinition {
  canonicalId: string;
  name: string;
  category: Dnd35eArmorCategory;
  cost: Dnd35eWeaponCost;
  // null for the real "—" cells (e.g. Extras like Armor spikes have no
  // inherent AC bonus of their own — they modify a base armor/shield piece).
  armorOrShieldBonus: number | null;
  // null for the real "—" cells (no maximum Dexterity bonus cap).
  maxDexBonus: number | null;
  // null for the real "—" cells. A real, distinct third state — Gauntlet,
  // locked's real value is the literal text "Special", disclosed via
  // extractionNotes rather than folded into the same null as "—".
  armorCheckPenalty: number | null;
  // Real percentage points (0-100), null for the real "—" cells.
  arcaneSpellFailureChancePercent: number | null;
  // Real resulting speed in feet for a wearer whose own base speed is 30 ft.
  // (typical Medium humanoid) or 20 ft. (typical Small humanoid/dwarf-style
  // slow-but-steady) respectively — both null for the real "—" cells
  // (shields and Extras don't affect speed at all).
  speedAt30FtBaseFt: number | null;
  speedAt20FtBaseFt: number | null;
  weightLb: number | null;
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
