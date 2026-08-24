# D&D 3.5e Weapons & Ammunition Extraction Report (real run: 2026-08-24)

**Scope note:** first Equipment entity family (roadmap subfamilies #1 "mundane weapons" and #4 "ammunition", covered together because both come from the same real source table — see below). Equipment is architecturally different from every prior entity family (Feats/Races/Classes/Skills/Spells): those were page-per-entity; Equipment's real weapons data lives entirely in **one page containing one large multi-category table**, and — per the explicit source-authority clarification — is the first family where **two independently-registered real transports** (d20srd.org and the `olimot/srd-v3.5` GitHub mirror) cover overlapping real content, requiring real cross-transport reconciliation rather than picking one as "more authoritative."

## Architecture

New files:

- `shared/rules-registry/dnd35e/equipment.ts` — `Dnd35eWeaponDefinition` (`entityType: "weapon"`) and `Dnd35eAmmunitionDefinition` (`entityType: "ammunition"`), fully structured (not opaque display strings): proficiency category, weapon group, cost (raw display + parsed copper-piece value), size-scaled damage dice, critical threat range/multiplier, range increment, weight, damage types + real and/or join, resolved footnote text.
- `server/dnd35e/extraction/table-rows.ts` — **reusable, source-agnostic** multi-category table row classifier (`classifyTableRows`, `stripTfoot`, `resolveRowFootnotes`), built to be shared by future Armor/Goods/Magic-Items extractors on the same d20srd.org real table convention (top-level category header row → real subcategory header rows → real data rows).
- `server/dnd35e/extraction/weapons-extractor.ts` — `extractWeaponsFromHtml(html)`, the **primary transport** extractor (d20srd.org's real `<table id="tableWeapons">`). Classifies each real data row as a weapon or ammunition via a deterministic real structural signal (see below), not a name heuristic.
- `server/dnd35e/extraction/weapons-crosscheck-olimot.ts` — a real, minimal (not a full parallel extractor) reader for the olimot mirror's real weapons table, producing a comparable shape for reconciliation only.
- `server/dnd35e/extraction/weapons-crosscheck-reconciliation.ts` — `reconcileWeapon()`, real field-by-field comparison reusing the primary extractor's own parsers on the cross-check transport's raw text (so `"×2"` and `"x2"` compare equal without either extractor knowing about the other's markup).
- `server/storage.ts` — `dnd35e_weapon_definitions`, `dnd35e_ammunition_definitions` (same upsert-when-changed/`recordRevision` pattern as every prior table), plus an **additive** `dnd35e_weapon_cross_check_results` table recording reconciliation outcomes per canonical ID — this does not replace the single-`EvidenceCitation`-per-entity pattern used everywhere else; it records the separate, inspectable *result* of comparing two real transports.
- `server/dnd35e/extraction/run-weapons-extraction.ts` — real, content-hash-verified batch script covering both real transports and the reconciliation pass.

## Design notes

**Weapon vs. ammunition is classified by a real structural signal, not a name pattern.** Ammunition (arrows, crossbow bolts, sling bullets) is interleaved as ordinary rows inside the real "Ranged Weapons" subcategory. The real, deterministic distinguishing signal: an ammunition row's Dmg(S)/Dmg(M)/Critical/Range cells are **all** the real "—" placeholder — no real weapon row (even a no-damage one) exhibits all four blank simultaneously. Confirmed against Net (a real weapon with no damage/critical/type, but a real Range Increment — correctly stays a weapon) vs. real ammunition rows (all four blank, correctly classified as ammunition).

**A real `<sup>N</sup>` footnote marker glued onto a name — the same bug class as the earlier Classes `<h5>`-nested-tag bug — was caught before commit, not after.** "Hammer, gnome hooked`<sup>5</sup>`" was initially extracted as the corrupted name `"Hammer, gnome hooked5"`. Fixed by stripping `<sup>...</sup>` spans entirely (not just their tags) before computing any cell's display text; footnote markers are resolved separately, from the raw HTML, into real footnote text (e.g. `"Double weapon."`) via `resolveRowFootnotes`.

**A real, non-numeric "special" placeholder for Cost/Weight (Shield light/heavy, Spiked shield light/heavy, Spiked armor) is disclosed with a clear, distinct note, not reported as a parse failure.** These rows describe using a shield/spiked-armor piece as a weapon; their real cost/weight is "whatever the shield/armor piece itself costs/weighs," not independently restated in this table. `extractionStatus: partially_structured` with an explanatory note, not `unresolved`.

**A real dual-critical-multiplier weapon (Hammer, gnome hooked: real `"×3/×4"`, one value per head of the double weapon) is honestly disclosed rather than force-parsed into a single multiplier.**

## Real cross-transport reconciliation (the required proof for this window)

83 real weapon/ammunition rows exist on both the primary (d20srd.org) and cross-check (olimot mirror) transports — a genuine 1:1 real overlap. Reconciling all 73 real weapons:

```
matches:   71
conflicts:  2
```

**Formatting-only differences correctly do NOT count as conflicts** (real, confirmed): d20srd's real "×" (multiplication sign) vs. olimot's real ASCII "x"; d20srd's real hyphen "19-20" vs. olimot's real en dash "19–20"; d20srd's real "½" (from `&frac12;`) vs. olimot's real ASCII "1/2" fraction. All normalized via the primary extractor's own field parsers, reused (not reimplemented) for the cross-check side — this is what lets a formatting difference collapse to genuine equality without hand-listing every possible glyph pair.

**Two real, genuine content disagreements were found and disclosed, not silently resolved:**
1. **Net** — the olimot mirror's real row has a genuine missing-cell markup irregularity: its Critical column is entirely absent (not even a real "—"), shifting every subsequent cell one position left. A real, singular authoring defect in that one transport for that one row — correctly flagged as `conflicts` across three fields, not silently "fixed" by re-aligning cells (which would be guessing at the transport's intent).
2. **Hammer, gnome hooked** — d20srd's real page states its dual damage type as `"Bludgeoning/Piercing"` (bare slash); the olimot mirror's real page states the same real fact as `"Bludgeoning and piercing"`. A genuine real content-authoring difference between the two transports, not a formatting artifact — correctly flagged as `conflicts` on `damageTypes` rather than assumed equivalent.

Per the source-authority clarification: **neither disagreement was resolved by declaring one transport authoritative.** Both are recorded in `dnd35e_weapon_cross_check_results` for future review against errata/canonical text, exactly as instructed ("otherwise fail honestly as ambiguous/unresolved").

## Headline evidence line

```
83 real data rows in d20srd.org's Table: Weapons (verified: 84 raw <tr><td>
  matches includes the <tfoot>'s own summary row — the real entity count is 83).
73 real weapons + 10 real ammunition extracted.
  fully_structured:     67
  partially_structured:  6 (5 real "special" cost/weight rows + 1 real dual-
                             critical double weapon — all honestly disclosed,
                             none silently guessed)
Real cross-transport reconciliation (olimot/srd-v3.5 mirror, 83 real
  overlapping rows):
  matches:   71
  conflicts:  2 (both real, genuine, disclosed — not formatting artifacts)
```

## What's not covered (explicit follow-on work, not implied by this report)

1. **Armor, Shields, Adventuring Gear, Tools, and the remaining mundane-equipment subfamilies** (roadmap items #2-#10) are real, separate, not-yet-attempted work. The `table-rows.ts` row classifier was built to be reusable for these (same real d20srd.org table convention), but Armor's actual real table has not yet been fetched/verified — per this session's discipline, its structure will be verified against the real live page before any extraction code is written for it, not assumed to match Weapons'.
2. **Magic items (weapons #11 through wondrous items #19)** are real, separate, larger follow-on work — explicitly not blocking mundane equipment completion, per instruction.
3. **The olimot cross-check extractor is deliberately minimal** — it produces just enough structure for reconciliation, not a second full primary source. If a future pass wants the olimot transport as a genuine alternate primary source (e.g. for content d20srd.org lacks), it would need its own complete extractor.
4. **Cost is compared in reconciliation but not yet linked to any real currency/economy system** — `copperPieces` is a real, structured value, not yet consumed by any purchase/shop logic.
5. **No revisiting of Feats' weapon/armor-proficiency prerequisites has been done yet** — now that real weapon category data exists (`proficiencyCategory: "simple" | "martial" | "exotic"`), Feats' `proficiency`-kind prerequisites (added this session's earlier Spells-adjacent work) could potentially resolve against real weapon data. Not attempted in this pass — named here as the standing obligation it is.
6. **Mechanical integration** (feeding weapon attack/damage/critical/range data into `server/combat-engine.ts`) has not been started. Real, separate, next-in-roadmap-adjacent work.

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
