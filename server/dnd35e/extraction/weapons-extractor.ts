// server/dnd35e/extraction/weapons-extractor.ts
//
// Deterministic extractor for the real d20srd.org "Table: Weapons" page
// (server/dnd35e/extraction/weapons-table-fixture.html) — one real table
// spanning all three proficiency categories (Simple/Martial/Exotic), each
// broken into real subcategories (Unarmed/Light Melee/One-Handed Melee/
// Two-Handed Melee/Ranged). Real ammunition (arrows, bolts, sling bullets)
// is interleaved as ordinary rows inside the "Ranged Weapons" subcategory —
// distinguished from real weapons by a deterministic, real structural
// signal: an ammunition row's Dmg(S)/Dmg(M)/Critical/Range cells are all
// the real "—" placeholder (it has no attack stats of its own), which no
// real thrown/fired weapon row exhibits (even a no-damage weapon like Net
// still has a real Range Increment).

import { buildCanonicalId } from "@shared/rules-registry/canonical-id";
import type {
  Dnd35eAmmunitionDefinition,
  Dnd35eDamageTypeJoin,
  Dnd35eWeaponCost,
  Dnd35eWeaponDefinition,
  Dnd35eWeaponGroup,
  Dnd35eWeaponProficiencyCategory,
} from "@shared/rules-registry/dnd35e/equipment";
import { kebabCase } from "./html-utils";
import { classifyTableRows, resolveRowFootnotes, stripTfoot } from "./table-rows";

const TABLE_RE = /<table id="tableWeapons"[^>]*>([\s\S]*?)<\/table>/;
const DASH = "—";

const CATEGORY_LABELS: Record<string, Dnd35eWeaponProficiencyCategory> = {
  "simple weapons": "simple",
  "martial weapons": "martial",
  "exotic weapons": "exotic",
};

const GROUP_LABELS: Record<string, Dnd35eWeaponGroup> = {
  "unarmed attacks": "unarmed",
  "light melee weapons": "light-melee",
  "one-handed melee weapons": "one-handed-melee",
  "two-handed melee weapons": "two-handed-melee",
  "ranged weapons": "ranged",
};

const CURRENCY_TO_COPPER: Record<string, number> = { cp: 1, sp: 10, gp: 100, pp: 1000 };

// Real, deliberate SRD value on a handful of weapon rows (Shield light/
// heavy, Spiked shield light/heavy, Spiked armor) — these are shields/armor
// pieces you can also attack with; their real cost and weight are "the same
// as the shield/armor piece itself," not independently repeated in this
// table. Confirmed against the real live page, not a parse failure.
const SPECIAL_TEXT = "special";

export function parseCost(text: string): { cost: Dnd35eWeaponCost; note: string | null } {
  if (text === DASH) return { cost: { display: text, copperPieces: null }, note: null };
  if (text.toLowerCase() === SPECIAL_TEXT) {
    return {
      cost: { display: text, copperPieces: null },
      note: 'Real Cost value is "special" — this item doubles as a shield/armor piece, whose own real cost is not independently repeated on this page.',
    };
  }
  const match = /^([\d.]+)\s*(cp|sp|gp|pp)$/i.exec(text);
  if (!match) return { cost: { display: text, copperPieces: null }, note: `Unrecognized real Cost value "${text}".` };
  return { cost: { display: text, copperPieces: Math.round(Number(match[1]) * CURRENCY_TO_COPPER[match[2].toLowerCase()]) }, note: null };
}

export function parseDamage(text: string): string | null {
  return text === DASH ? null : text;
}

// Accepts both d20srd's real "×" (multiplication sign) and the olimot
// mirror's real ASCII "x", and both a real hyphen "-" and a real en dash
// "–" before "20/" — two real transports of the same real mechanic use
// different real glyphs for it; this is a formatting difference, not a
// mechanical one.
export function parseCritical(text: string): { threatRangeLow: number | null; multiplier: number | null; note: string | null } {
  if (text === DASH) return { threatRangeLow: null, multiplier: null, note: null };
  const match = /^(?:(\d+)[-–]20\/)?[×x](\d+)$/i.exec(text);
  if (!match) return { threatRangeLow: null, multiplier: null, note: `Unrecognized real Critical value "${text}".` };
  return { threatRangeLow: match[1] ? Number(match[1]) : 20, multiplier: Number(match[2]), note: null };
}

export function parseRangeIncrement(text: string): { value: number | null; note: string | null } {
  if (text === DASH) return { value: null, note: null };
  const match = /^(\d+)\s*ft\.?$/i.exec(text);
  if (!match) return { value: null, note: `Unrecognized real Range Increment value "${text}".` };
  return { value: Number(match[1]), note: null };
}

export function parseWeight(text: string): { value: number | null; note: string | null } {
  if (text === DASH) return { value: null, note: null };
  if (text.toLowerCase() === SPECIAL_TEXT) {
    return {
      value: null,
      note: 'Real Weight value is "special" — this item doubles as a shield/armor piece, whose own real weight is not independently repeated on this page.',
    };
  }
  // Accepts both d20srd's real "½" (unicode fraction glyph, from &frac12;)
  // and the olimot mirror's real "1/2" (ASCII fraction) — the same real
  // half-pound value written two different real ways.
  const match = /^(½|1\/2|\d+(?:\.\d+)?)\s*lb\.?$/i.exec(text);
  if (!match) return { value: null, note: `Unrecognized real Weight value "${text}".` };
  return { value: match[1] === "½" || match[1] === "1/2" ? 0.5 : Number(match[1]), note: null };
}

export function parseDamageTypes(text: string): { types: string[]; join: Dnd35eDamageTypeJoin } {
  if (text === DASH) return { types: [], join: null };
  if (text.includes(" or ")) return { types: text.split(" or ").map((t) => t.trim()), join: "or" };
  if (text.includes(" and ")) return { types: text.split(" and ").map((t) => t.trim()), join: "and" };
  return { types: [text], join: null };
}

// A real ammunition row has none of a weapon's core combat stats — this is
// the deterministic real signal that distinguishes it from a real weapon
// row (even a no-damage weapon like Net still has a real Range Increment).
function isAmmunitionRow(dmgSText: string, dmgMText: string, criticalText: string, rangeText: string): boolean {
  return dmgSText === DASH && dmgMText === DASH && criticalText === DASH && rangeText === DASH;
}

export interface WeaponsExtractionResult {
  weapons: Dnd35eWeaponDefinition[];
  ammunition: Dnd35eAmmunitionDefinition[];
  notes: string[];
}

export function extractWeaponsFromHtml(html: string): WeaponsExtractionResult {
  const tableMatch = TABLE_RE.exec(html);
  if (!tableMatch) throw new Error('No real <table id="tableWeapons"> found — not a real weapons page.');

  const { bodyHtml, footnotes } = stripTfoot(tableMatch[1]);
  const rows = classifyTableRows(bodyHtml);

  const weapons: Dnd35eWeaponDefinition[] = [];
  const ammunition: Dnd35eAmmunitionDefinition[] = [];
  const notes: string[] = [];

  let currentCategory: Dnd35eWeaponProficiencyCategory | null = null;
  let currentGroup: Dnd35eWeaponGroup | null = null;

  for (const row of rows) {
    if (row.kind === "category-header") {
      const label = row.cellsText[0].toLowerCase();
      const category = CATEGORY_LABELS[label];
      if (!category) {
        notes.push(`Unrecognized real category-header label "${row.cellsText[0]}" — rows until the next header are not attributed to any category.`);
        currentCategory = null;
      } else {
        currentCategory = category;
      }
      currentGroup = null;
      continue;
    }
    if (row.kind === "subcategory-header") {
      const group = GROUP_LABELS[row.label.toLowerCase()];
      if (!group) {
        notes.push(`Unrecognized real subcategory-header label "${row.label}" — rows until the next header are not attributed to any group.`);
        currentGroup = null;
      } else {
        currentGroup = group;
      }
      continue;
    }

    // row.kind === "data"
    if (!currentCategory || !currentGroup) {
      notes.push(`Real data row "${row.cellsText[0]}" appeared before a real category/subcategory header was established — skipped rather than guessed.`);
      continue;
    }
    const [nameText, costText, dmgSText, dmgMText, criticalText, rangeText, weightText, typeText] = row.cellsText;
    const rowFootnotes = resolveRowFootnotes(row.cellsHtml, footnotes);

    if (isAmmunitionRow(dmgSText, dmgMText, criticalText, rangeText)) {
      const quantityMatch = /\((\d+)\)\s*$/.exec(nameText);
      const name = quantityMatch ? nameText.slice(0, quantityMatch.index).trim() : nameText;
      const quantityPerPurchase = quantityMatch ? Number(quantityMatch[1]) : null;
      const weight = parseWeight(weightText);
      const cost = parseCost(costText);
      const ammoNotes: string[] = [];
      if (cost.note) ammoNotes.push(cost.note);
      if (weight.note) ammoNotes.push(weight.note);
      if (!quantityPerPurchase) ammoNotes.push(`No real "(N)" quantity suffix found on ammunition name "${nameText}".`);
      ammunition.push({
        canonicalId: buildCanonicalId("dnd35e", "ammunition", kebabCase(name)),
        name,
        weaponGroup: currentGroup,
        cost: cost.cost,
        quantityPerPurchase,
        weightLb: weight.value,
        extractionStatus: ammoNotes.length === 0 ? "fully_structured" : "partially_structured",
        extractionNotes: ammoNotes,
      });
      continue;
    }

    const critical = parseCritical(criticalText);
    const range = parseRangeIncrement(rangeText);
    const weight = parseWeight(weightText);
    const cost = parseCost(costText);
    const { types, join } = parseDamageTypes(typeText);
    const weaponNotes: string[] = [critical.note, range.note, weight.note, cost.note].filter((n): n is string => n !== null);

    weapons.push({
      canonicalId: buildCanonicalId("dnd35e", "weapon", kebabCase(nameText)),
      name: nameText,
      proficiencyCategory: currentCategory,
      weaponGroup: currentGroup,
      cost: cost.cost,
      damageSmall: parseDamage(dmgSText),
      damageMedium: parseDamage(dmgMText),
      criticalThreatRangeLow: critical.threatRangeLow,
      criticalMultiplier: critical.multiplier,
      rangeIncrementFt: range.value,
      weightLb: weight.value,
      damageTypes: types,
      damageTypeJoin: join,
      footnotes: rowFootnotes,
      extractionStatus: weaponNotes.length === 0 ? "fully_structured" : "partially_structured",
      extractionNotes: weaponNotes,
    });
  }

  return { weapons, ammunition, notes };
}
