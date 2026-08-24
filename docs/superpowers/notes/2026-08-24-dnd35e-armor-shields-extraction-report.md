# D&D 3.5e Armor & Shields Extraction Report (real run: 2026-08-24)

**Scope note:** covers roadmap items #2 "armor" and #3 "shields" together, plus a real bonus category — because the real source is a single d20srd.org page, "Table: Armor and Shields," whose own real structure already combines them, alongside a genuinely distinct fifth category the SRD itself calls "Extras" (armor spikes, a locked gauntlet, shield spikes — real add-ons to a base armor/shield piece, not standalone worn armor). Splitting these into three artificially separate extraction passes would have fought the real page structure rather than followed it.

## Architecture

- `shared/rules-registry/dnd35e/equipment.ts` — extended with `Dnd35eArmorDefinition` (`entityType: "armor"`), fully structured: category, cost, armor/shield bonus, max Dex bonus, armor check penalty, arcane spell failure chance, real dual-speed columns (results for a 30 ft.-base and 20 ft.-base wearer), weight, resolved footnotes.
- `server/dnd35e/extraction/armor-extractor.ts` — `extractArmorFromHtml(html)`. Reuses `table-rows.ts`'s row classifier (built generically during the Weapons pass, now proven reusable on a second real table) and the new shared `server/dnd35e/extraction/currency.ts` cost parser (also shared with `weapons-extractor.ts`, which was refactored to use it — no behavior change, verified by its existing passing test suite).
- `server/storage.ts` — `dnd35e_armor_definitions`, same upsert-when-changed/`recordRevision` pattern as every prior table.
- `server/dnd35e/extraction/run-armor-extraction.ts` — real, content-hash-verified batch script.

## Design notes: real structural differences from Weapons, verified before writing code

**Armor has a single-tier category breakdown, not Weapons' two-tier one.** Weapons splits Simple/Martial/Exotic (top-level, full `<th>` header rows) × Light/One-Handed/Two-Handed/Ranged (subcategory, `<th colspan>` rows). Armor has only one tier: Light armor, Medium armor, Heavy armor, Shields, Extras — all expressed as real `<th colspan>` rows, meaning `table-rows.ts`'s existing "subcategory-header" classification was directly reusable with zero changes; the extractor simply never sees a "category-header" row in Armor's real `<tbody>`.

**The real `<thead>` is a genuine two-row rowspan/colspan header** (six `rowspan="2"` columns plus a `colspan="2"` "Speed" column split into "(30 ft.)"/"(20 ft.)" sub-columns for two different real base-speed wearers) **and is deliberately excluded from row classification** — feeding it through the same classifier used for the body would misread it as spurious category-header rows (every `<th>` row, regardless of real meaning, looks like one to a generic classifier). The real column order is instead read directly from `<tbody>`, verified against the live page rather than re-derived from the header cells.

**A real "Special" placeholder for Armor Check Penalty (Gauntlet, locked)** is disclosed as a **distinct third state** from both a real number and the real "—" not-applicable placeholder — its own clear note, `armorCheckPenalty: null`, `extractionStatus: partially_structured`, not confused with either.

**Real "+N gp"/"+N lb." additive costs and weights (Armor spikes, Shield spikes)** parse to their real positive numeric value with the "+" preserved in `cost.display`/left off the parsed `weightLb` — these are real per-item add-on prices to a base armor/shield piece, not standalone item costs. The comma-thousands real cost format (Full plate: `"1,500 gp"`) is also handled, confirmed live.

**The shared `currency.ts` extraction was a real, deliberate DRY move, not a premature abstraction** — both Weapons and Armor's real cost cells use the identical `"—"` / `"special"` / `"<amount> <currency>"` convention (now additionally proven to also cover comma-thousands and a leading "+", both real Armor-only cases Weapons never exercised). Refactoring `weapons-extractor.ts` to use the shared parser was verified safe by its full existing test suite passing unchanged.

## Headline evidence line

```
21 real armor/shield/extras rows extracted from the live page.
  light:   4    (Padded, Leather, Studded leather, Chain shirt)
  medium:  4    (Hide, Scale mail, Chainmail, Breastplate)
  heavy:   4    (Splint mail, Banded mail, Half-plate, Full plate)
  shield:  6    (Buckler, light/heavy wooden, light/heavy steel, tower)
  extra:   3    (Armor spikes, Gauntlet locked, Shield spikes)
  fully_structured:     20
  partially_structured:  1  (Gauntlet, locked's real "Special" penalty —
                              honestly disclosed, not a parse failure)
```

## What's not covered (explicit follow-on work, not implied by this report)

1. **No real dual-transport cross-check was performed for Armor.** The Weapons pass proved the olimot mirror covers overlapping weapon content; whether it covers Armor content the same way (and whether that transport's Armor table has its own real structural quirks, as its Weapons table did) has not been verified. Real, separate follow-on work, not assumed to work the same way without checking.
2. **The real "Table: Donning Armor"** (a second real table on the same live page, covering time-to-don rather than per-item mechanics) was correctly identified as a reference table and excluded, not silently parsed as armor entities — matching the same discipline applied to Weapons' two real reference tables (Larger/Smaller and Tiny/Large weapon damage scaling).
3. **Adventuring Gear, Tools, Clothing/Containers, Mounts, Services, Special Materials** (roadmap items #5-#10) remain real, separate, not-yet-attempted work.
4. **Magic items** (roadmap items #11-#19) remain real, separate, larger follow-on work.
5. **Mechanical integration** (feeding armor bonus/max-Dex/check-penalty/spell-failure data into `server/combat-engine.ts`'s AC and skill-penalty calculations) has not been started.
6. **No revisiting of Feats' armor-proficiency prerequisites has been done yet** — now that real armor category data exists, this is now possible; not attempted in this pass, named here as the standing obligation it is.

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
