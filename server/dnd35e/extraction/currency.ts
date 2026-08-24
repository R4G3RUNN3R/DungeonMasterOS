// server/dnd35e/extraction/currency.ts
//
// Shared real d20srd.org cost-cell parser, first written for Weapons and
// reused by Armor since both real tables use the identical real convention.
// Handles real variance confirmed across both tables:
//   - a real "+" prefix (Armor's "Extras" — Armor spikes "+50 gp" — an
//     additional cost on top of a base armor/shield piece, not a standalone
//     price; the "+" is preserved in the real display text but does not
//     change the sign of the parsed copper-piece value)
//   - a real "," thousands separator (Armor's "Full plate": "1,500 gp")
//   - the real "—" not-applicable placeholder
//   - the real "special" placeholder (Weapons' shield-as-weapon rows) —
//     opt-in via `allowSpecial`, since not every real cost cell that fails
//     to parse as a number is this specific, known real convention.

import type { Dnd35eWeaponCost } from "@shared/rules-registry/dnd35e/equipment";

const DASH = "—";
const SPECIAL_TEXT = "special";
const CURRENCY_TO_COPPER: Record<string, number> = { cp: 1, sp: 10, gp: 100, pp: 1000 };

export function parseCurrencyCost(text: string, opts: { allowSpecial?: boolean } = {}): { cost: Dnd35eWeaponCost; note: string | null } {
  if (text === DASH) return { cost: { display: text, copperPieces: null }, note: null };
  if (opts.allowSpecial && text.toLowerCase() === SPECIAL_TEXT) {
    return {
      cost: { display: text, copperPieces: null },
      note: 'Real Cost value is "special" — this item doubles as a shield/armor piece, whose own real cost is not independently repeated on this page.',
    };
  }
  const match = /^\+?([\d,]+(?:\.\d+)?)\s*(cp|sp|gp|pp)$/i.exec(text);
  if (!match) return { cost: { display: text, copperPieces: null }, note: `Unrecognized real Cost value "${text}".` };
  const amount = Number(match[1].replace(/,/g, ""));
  return { cost: { display: text, copperPieces: Math.round(amount * CURRENCY_TO_COPPER[match[2].toLowerCase()]) }, note: null };
}
