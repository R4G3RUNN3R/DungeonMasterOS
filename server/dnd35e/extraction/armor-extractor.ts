// server/dnd35e/extraction/armor-extractor.ts
//
// Deterministic extractor for the real d20srd.org "Table: Armor and
// Shields" page (server/dnd35e/extraction/armor-table-fixture.html). Unlike
// Weapons' two-tier Simple/Martial/Exotic × Light/One-Handed/... breakdown,
// Armor has a single-tier real category breakdown: Light armor, Medium
// armor, Heavy armor, Shields, Extras (armor spikes, a locked gauntlet,
// shield spikes — real add-ons rather than standalone worn armor). The
// real table's own two-row <thead> (a rowspan/colspan header for the
// "Speed" sub-columns) is deliberately skipped — this extractor reads only
// <tbody>, since the real column order is already known from live
// verification rather than needing to be re-derived from the header cells.

import { buildCanonicalId } from "@shared/rules-registry/canonical-id";
import type { Dnd35eArmorCategory, Dnd35eArmorDefinition } from "@shared/rules-registry/dnd35e/equipment";
import { kebabCase } from "./html-utils";
import { parseCurrencyCost } from "./currency";
import { classifyTableRows, resolveRowFootnotes, stripTfoot } from "./table-rows";

const TABLE_RE = /<table id="tableArmorandShields"[^>]*>([\s\S]*?)<\/table>/;
const TBODY_RE = /<tbody>([\s\S]*?)<\/tbody>/;
const DASH = "—";
const SPECIAL_TEXT = "special";

const CATEGORY_LABELS: Record<string, Dnd35eArmorCategory> = {
  "light armor": "light",
  "medium armor": "medium",
  "heavy armor": "heavy",
  shields: "shield",
  extras: "extra",
};

function parseCost(text: string) {
  return parseCurrencyCost(text, { allowSpecial: true });
}

// Real "Armor/Shield Bonus", "Maximum Dex Bonus" — plain signed integers, or
// the real "—" not-applicable placeholder.
function parseSignedInt(text: string, label: string): { value: number | null; note: string | null } {
  if (text === DASH) return { value: null, note: null };
  const match = /^(-?\d+)$/.exec(text);
  if (!match) return { value: null, note: `Unrecognized real ${label} value "${text}".` };
  return { value: Number(match[1]), note: null };
}

// Real "Armor Check Penalty" is the same real signed-integer shape as
// above, PLUS a real, distinct third value: the literal text "Special"
// (Gauntlet, locked — its real penalty depends on how it's worn, not a
// fixed number). Kept separate from parseSignedInt because most callers
// (Max Dex Bonus, Armor/Shield Bonus) never see this real value and
// shouldn't need to special-case it.
function parseArmorCheckPenalty(text: string): { value: number | null; note: string | null } {
  if (text.toLowerCase() === SPECIAL_TEXT) {
    return { value: null, note: 'Real Armor Check Penalty value is "Special" — this item\'s real penalty depends on how it is worn/used, not a fixed number.' };
  }
  return parseSignedInt(text, "Armor Check Penalty");
}

function parsePercent(text: string): { value: number | null; note: string | null } {
  if (text === DASH) return { value: null, note: null };
  const match = /^(\d+)%$/.exec(text);
  if (!match) return { value: null, note: `Unrecognized real Arcane Spell Failure Chance value "${text}".` };
  return { value: Number(match[1]), note: null };
}

function parseFeet(text: string): { value: number | null; note: string | null } {
  if (text === DASH) return { value: null, note: null };
  const match = /^(\d+)\s*ft\.?$/i.exec(text);
  if (!match) return { value: null, note: `Unrecognized real Speed value "${text}".` };
  return { value: Number(match[1]), note: null };
}

function parseWeight(text: string): { value: number | null; note: string | null } {
  if (text === DASH) return { value: null, note: null };
  const match = /^\+?(\d+(?:\.\d+)?)\s*lb\.?$/i.exec(text);
  if (!match) return { value: null, note: `Unrecognized real Weight value "${text}".` };
  return { value: Number(match[1]), note: null };
}

export interface ArmorExtractionResult {
  armor: Dnd35eArmorDefinition[];
  notes: string[];
}

export function extractArmorFromHtml(html: string): ArmorExtractionResult {
  const tableMatch = TABLE_RE.exec(html);
  if (!tableMatch) throw new Error('No real <table id="tableArmorandShields"> found — not a real armor page.');

  const { bodyHtml, footnotes } = stripTfoot(tableMatch[1]);
  const tbodyMatch = TBODY_RE.exec(bodyHtml);
  if (!tbodyMatch) throw new Error('No real <tbody> found inside the armor table — not a real armor page.');
  // Deliberately classify only <tbody> content — the real <thead> here is a
  // genuine two-row rowspan/colspan header (unlike Weapons, which has no
  // <thead> at all and puts its one-row header directly in the body), and
  // would otherwise be misread as real category-header rows.
  const rows = classifyTableRows(tbodyMatch[1]);

  const armor: Dnd35eArmorDefinition[] = [];
  const notes: string[] = [];
  let currentCategory: Dnd35eArmorCategory | null = null;

  for (const row of rows) {
    if (row.kind === "category-header") {
      notes.push(`Unexpected real full-column-header row "${row.cellsText[0]}" inside the armor table body — not a known real convention for this page.`);
      continue;
    }
    if (row.kind === "subcategory-header") {
      const category = CATEGORY_LABELS[row.label.toLowerCase()];
      if (!category) {
        notes.push(`Unrecognized real category-header label "${row.label}" — rows until the next header are not attributed to any category.`);
        currentCategory = null;
      } else {
        currentCategory = category;
      }
      continue;
    }

    // row.kind === "data"
    if (!currentCategory) {
      notes.push(`Real data row "${row.cellsText[0]}" appeared before a real category header was established — skipped rather than guessed.`);
      continue;
    }
    const [nameText, costText, bonusText, maxDexText, penaltyText, spellFailureText, speed30Text, speed20Text, weightText] = row.cellsText;
    const rowFootnotes = resolveRowFootnotes(row.cellsHtml, footnotes);

    const cost = parseCost(costText);
    const bonus = parseSignedInt(bonusText, "Armor/Shield Bonus");
    const maxDex = parseSignedInt(maxDexText, "Maximum Dex Bonus");
    const penalty = parseArmorCheckPenalty(penaltyText);
    const spellFailure = parsePercent(spellFailureText);
    const speed30 = parseFeet(speed30Text);
    const speed20 = parseFeet(speed20Text);
    const weight = parseWeight(weightText);
    const armorNotes = [cost.note, bonus.note, maxDex.note, penalty.note, spellFailure.note, speed30.note, speed20.note, weight.note].filter(
      (n): n is string => n !== null,
    );

    armor.push({
      canonicalId: buildCanonicalId("dnd35e", "armor", kebabCase(nameText)),
      name: nameText,
      category: currentCategory,
      cost: cost.cost,
      armorOrShieldBonus: bonus.value,
      maxDexBonus: maxDex.value,
      armorCheckPenalty: penalty.value,
      arcaneSpellFailureChancePercent: spellFailure.value,
      speedAt30FtBaseFt: speed30.value,
      speedAt20FtBaseFt: speed20.value,
      weightLb: weight.value,
      footnotes: rowFootnotes,
      extractionStatus: armorNotes.length === 0 ? "fully_structured" : "partially_structured",
      extractionNotes: armorNotes,
    });
  }

  return { armor, notes };
}
