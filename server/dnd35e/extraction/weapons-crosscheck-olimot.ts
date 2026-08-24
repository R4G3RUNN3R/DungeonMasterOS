// server/dnd35e/extraction/weapons-crosscheck-olimot.ts
//
// Real, minimal extractor for the olimot/srd-v3.5 GitHub mirror's
// "basic-rules-and-legal/equipment.html" real weapons table — the SECOND
// real, independently-registered transport that overlaps with the primary
// d20srd.org weapons extraction (weapons-extractor.ts). Deliberately not a
// full parallel extractor: this exists to produce a comparable structured
// shape for real cross-transport reconciliation (see
// weapons-crosscheck-reconciliation.ts), not to be a second primary source.
//
// Real structural differences from d20srd.org's table, all confirmed
// against the live page (server/dnd35e/extraction/
// weapons-crosscheck-olimot-equipment-fixture.html):
//   - Subcategory break rows are a single real <td colspan="9"><i>Label</i>
//     </td> — NOT a <th colspan> like d20srd.org. A different real markup
//     convention for the same real concept.
//   - The real Critical column header/cells use colspan="2" (a real,
//     cosmetic table-layout choice — one logical column, two grid cells).
//   - Real item names carry a literal "&nbsp;&nbsp;" indentation prefix.
//   - Real dash/multiplier glyphs differ: "x2" (ASCII x) vs d20srd's "×2"
//     (real multiplication sign), "19–20" (real en dash) vs d20srd's
//     "19-20" (real hyphen) — cosmetic, not mechanical, differences.

import { kebabCase } from "./html-utils";

export interface OlimotWeaponRow {
  name: string;
  costDisplay: string;
  damageSmall: string | null;
  damageMedium: string | null;
  criticalDisplay: string;
  rangeDisplay: string;
  weightDisplay: string;
  typeDisplay: string;
}

const TABLE_RE = /<table[^>]*>\s*<caption>\s*Table: Weapons\s*<\/caption>([\s\S]*?)<\/table>/;
const ROW_RE = /<tr>([\s\S]*?)<\/tr>/g;
const CELL_RE = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g;
const DASH = "—";

function stripTagsLocal(html: string): string {
  return html
    .replace(/<sup>[^<]*<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractOlimotWeaponRows(html: string): OlimotWeaponRow[] {
  const tableMatch = TABLE_RE.exec(html);
  if (!tableMatch) throw new Error('No real "Table: Weapons" found in the olimot mirror page — not a real equipment page.');

  const rows: OlimotWeaponRow[] = [];
  for (const rowMatch of tableMatch[1].matchAll(ROW_RE)) {
    const rowHtml = rowMatch[0];
    if (/<th/.test(rowHtml)) continue; // real category-header row
    const cellsHtml = [...rowMatch[1].matchAll(CELL_RE)].map((m) => m[1]);
    if (cellsHtml.length <= 1) continue; // real subcategory-header row (single <td colspan>)

    const [nameHtml, costHtml, dmgSHtml, dmgMHtml, criticalHtml, rangeHtml, weightHtml, typeHtml] = cellsHtml;
    const name = stripTagsLocal(nameHtml);
    const dmgS = stripTagsLocal(dmgSHtml);
    const dmgM = stripTagsLocal(dmgMHtml);
    rows.push({
      name,
      costDisplay: stripTagsLocal(costHtml),
      damageSmall: dmgS === DASH ? null : dmgS,
      damageMedium: dmgM === DASH ? null : dmgM,
      criticalDisplay: stripTagsLocal(criticalHtml),
      rangeDisplay: stripTagsLocal(rangeHtml),
      weightDisplay: stripTagsLocal(weightHtml),
      typeDisplay: stripTagsLocal(typeHtml),
    });
  }
  return rows;
}

// A real weapon's canonicalId is derived the same way the primary
// extractor derives it (kebabCase of its real display name) — this is what
// lets reconciliation match a row from this transport to a row from the
// primary transport without either side knowing about the other.
export function olimotWeaponCanonicalId(row: OlimotWeaponRow): string {
  return `dnd35e:weapon:${kebabCase(row.name)}`;
}
