# Character Sheet: Equipment Tab + Spells Tome — Design

**Date:** 2026-08-20
**Status:** Approved by user, ready for implementation plan
**Scope:** 3.5e ruleset only. 5e gets its own recreation later — this spec leaves it untouched/placeholder where it currently exists.

## Goal

Extend the canonical Character Sheet (`client/src/pages/CharacterSheetPage.tsx`) from a single page into three tabs for the 3.5e ruleset:

1. **Sheet** — the existing recreated paper-form page (identity, ability scores, combat strip, saves, base attack + weapons summary, skills, racial traits).
2. **Equipment** — full inventory reference (not a manager) + Feats & Special Abilities, relocated from Sheet's bottom.
3. **Spells** — a "tome" presentation of the already-built but never-wired `SpellSheet.tsx` component, restyled and made ruleset-aware.

The sheet still opens in its own popup window (per the earlier request), and all three tabs live inside that one window — no new routes.

## Non-goals

- No equip/unequip/use/carry actions on the sheet. `InventoryOverlay` remains the sole place inventory state is mutated — Equipment tab is read-only, so we don't recreate the "two inventory managers" problem this session already fixed once.
- No 5e spell-DC formula fix. `SpellSheet.tsx`'s existing flat-DC logic stays as-is and becomes the (unstyled, unfixed) fallback for any non-3.5e ruleset, to be properly addressed when 5e gets its own pass.
- No new database tables. Spells continue to live in `characterData.spellData` (existing JSON blob field), exactly as `SpellSheet.tsx` already reads/writes it via the existing `PATCH /api/characters/:id/spell-data` endpoint.

## Architecture

`CharacterSheetPage` gains a local `activeTab: "sheet" | "equipment" | "spells"` state (default `"sheet"`), shown only when `sheet.ruleset === "dnd35e"`. Non-3.5e rulesets keep today's single-page `GenericSheet` unchanged.

```
CharacterSheetPage
├── header (Back / ruleset badge / Open in window)      — unchanged, always visible
├── identity strip (name / race-class-level / XP)        — moves above the tabs, shared by all three
├── tab bar (Sheet | Equipment | Spells)                 — new, dnd35e only
└── tab body
    ├── Sheet     → existing Dnd35eSheet content, minus Feats section (moved out)
    ├── Equipment → new EquipmentTab component
    └── Spells    → new SpellsTome component (wraps SpellSheet's logic)
```

Data already fetched by `CharacterSheetPage` (character, items, sheet, titles) is passed down to whichever tab is active — no new top-level queries.

## Equipment tab

**Loadout (top):** A small parchment-styled read-only slot list — reuses only the `EQUIPMENT_SLOTS` constant/type from `EquipmentPaperDoll.tsx` (not the component itself, which is dark/leather-themed for `InventoryOverlay` and would create a visual mismatch if reskinned in place). Shows each slot's name and, if occupied, the equipped item's name — no interaction.

**Full inventory (below):** Every item the character owns, grouped by type (same grouping convention as `InventoryOverlay`), each row showing name, full description (untruncated — page 1's weapons table is a summary; this is the reference), quantity, weight, carried/stored state, identified/consumable badges. Read-only — no equip/unequip/use/read buttons; those already exist on `InventoryOverlay`, reachable from the HUD's Inventory button.

**Feats & Special Abilities (bottom):** Relocated as-is from Sheet page's current bottom section (same `characterData.sections` parsing already in `CharacterSheetPage.tsx`'s `safeParseFeats`).

## Spells tome

Visual treatment reuses `CodexOverlay`'s two-page open-book styling (spine gutter, page-turn feel) rather than the flatter form-box language of Sheet/Equipment — this is deliberately the one "special" tab, matching the user's own framing of it as a tome that opens.

Underneath the restyle, this is `SpellSheet.tsx`'s existing, working logic (spell slots, cantrips, prepared-by-level, metamagic, custom resources, long/short rest) — none of that mechanical logic is being rebuilt. Two real fixes:

1. **Ability score source.** `SpellSheet` currently fuzzy-matches ability scores out of `characterData.sections` text. It will instead receive the real `sheet.abilities` (already computed authoritatively by `computeFullCharacterSheet`) as a prop, matching how the rest of the sheet already sources ability data. The existing `castingAbility` selector (STR/DEX/CON/INT/WIS/CHA/Custom — a class like Wizard casts from INT, Cleric from WIS, etc., and this codebase has no class→casting-ability lookup table) stays exactly as it is today, a player choice stored in `spellData`; only the score lookup for whichever ability is selected changes from fuzzy text-matching to the real column.

2. **3.5e DC/attack formula.** Replace the flat "Spell Save DC" / "Spell Attack Bonus" boxes with:
   - A **per-spell-level DC** (`10 + spell level + ability modifier`) shown inline next to each level's slot row — 3.5e has no single flat DC, every level differs.
   - **No separate spell attack bonus box.** 3.5e touch attacks use the character's normal attack bonus, already shown on the Sheet tab's Base Attack section — the tome links back to it instead of duplicating a number.

   This 3.5e-specific formula path only activates when `sheet.ruleset === "dnd35e"`. The existing flat-DC 5e code path is untouched, serving as-is for any non-3.5e ruleset until 5e's own pass fixes it properly.

## Testing

No existing client test infrastructure (Playwright) in this repo (confirmed earlier this session). Verification is manual: seed a 3.5e spellcaster (e.g. Wizard/Cleric) with real `characterData.spellData` locally, walk through all three tabs in the local dev server, confirm per-spell-level DC math against the formula by hand, confirm Equipment tab shows real item data with no mutation controls, confirm the existing spell-slot/rest/metamagic interactions (already working in the orphaned component) still work once wired in and restyled.

## Open questions for plan-writing

None — this spec is scoped tightly enough to plan directly. The implementation plan should sequence Equipment (lower risk, mostly layout) before Spells (touches formula logic and a larger restyle).
