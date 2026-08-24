// server/dnd35e/extraction/table-rows.ts
//
// Reusable, deterministic row-classifier for d20srd.org's real multi-
// category "entity list" table convention (first seen on the real "Table:
// Weapons" page, expected to recur for Armor/Goods/Magic Items — a single
// table spanning several real top-level categories, each announced by a
// full header-cell row, with real subcategory break rows nested inside).
// Deliberately narrow: this module only classifies ROW SHAPE (which real
// <tr> is a header vs data row), not column semantics — each entity family
// still owns interpreting its own real column values.

export type TableRow =
  // A row where every real cell is a <th> — announces a new top-level
  // category; the first cell's real text is that category's name.
  | { kind: "category-header"; cellsHtml: string[]; cellsText: string[] }
  // A row with a single real <th colspan="N"> — announces a subcategory
  // nested inside the current top-level category.
  | { kind: "subcategory-header"; label: string }
  // A real entity row: first cell is a <td>.
  | { kind: "data"; cellsHtml: string[]; cellsText: string[] };

const ROW_TAG_RE = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
const CELL_RE = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g;

function stripTagsLocal(html: string): string {
  // Strip <sup>N</sup> footnote markers entirely (not just the tags) —
  // otherwise a real name like "Hammer, gnome hooked<sup>5</sup>" leaves the
  // bare digit "5" glued onto the visible text with no space, corrupting
  // the name. The marker itself is resolved separately, from the raw HTML,
  // by resolveRowFootnotes — this function only ever needs to produce
  // clean display text.
  return html
    .replace(/<sup>[^<]*<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&times;/g, "×")
    .replace(/&frac12;/g, "½")
    .replace(/\s+/g, " ")
    .trim();
}

// Splits a table's real inner HTML into its <thead>/<tbody> row content,
// deliberately excluding <tfoot> — a table's real footnote list is a
// distinct real concept (see parseTableFootnotes) with its own <td colspan>
// wrapper that would otherwise misclassify as a single-column data row.
export function stripTfoot(tableInnerHtml: string): { bodyHtml: string; footnotes: Record<string, string> } {
  const tfootMatch = /<tfoot>([\s\S]*?)<\/tfoot>/.exec(tableInnerHtml);
  const bodyHtml = tfootMatch ? tableInnerHtml.slice(0, tfootMatch.index) + tableInnerHtml.slice(tfootMatch.index + tfootMatch[0].length) : tableInnerHtml;
  const footnotes: Record<string, string> = {};
  if (tfootMatch) {
    const items = [...tfootMatch[1].matchAll(/<li>([\s\S]*?)<\/li>/g)];
    items.forEach((m, i) => {
      footnotes[String(i + 1)] = stripTagsLocal(m[1]);
    });
  }
  return { bodyHtml, footnotes };
}

export function classifyTableRows(tableInnerHtml: string): TableRow[] {
  const rows: TableRow[] = [];
  for (const rowMatch of tableInnerHtml.matchAll(ROW_TAG_RE)) {
    const rowHtml = rowMatch[0];
    const inner = rowMatch[1];
    const isThRow = /<th/.test(rowHtml);
    const cellsHtml = [...inner.matchAll(CELL_RE)].map((m) => m[1]);
    if (cellsHtml.length === 0) continue;
    const cellsText = cellsHtml.map(stripTagsLocal);

    if (isThRow) {
      const thCount = [...rowHtml.matchAll(/<th\b/g)].length;
      if (thCount === 1 && /colspan/.test(rowHtml)) {
        rows.push({ kind: "subcategory-header", label: cellsText[0] });
      } else {
        rows.push({ kind: "category-header", cellsHtml, cellsText });
      }
    } else {
      rows.push({ kind: "data", cellsHtml, cellsText });
    }
  }
  return rows;
}

// Resolves the real <sup>N</sup> markers present in one or more of a data
// row's real cells into the table's own real footnote text — e.g. a Weight
// cell "1 lb.<sup>1</sup>" resolves to footnote "1"'s real text. Returns the
// resolved real text strings, not the raw marker numbers, so a consumer
// never has to re-look-up the mapping itself.
export function resolveRowFootnotes(cellsHtml: string[], footnotes: Record<string, string>): string[] {
  const markers = new Set<string>();
  for (const html of cellsHtml) {
    for (const m of html.matchAll(/<sup>(\d+)<\/sup>/g)) markers.add(m[1]);
  }
  return [...markers]
    .sort((a, b) => Number(a) - Number(b))
    .map((n) => footnotes[n])
    .filter((text): text is string => typeof text === "string");
}
