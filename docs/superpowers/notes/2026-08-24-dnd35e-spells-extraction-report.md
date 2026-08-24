# D&D 3.5e Individual Spell Descriptions Extraction Report (real run: 2026-08-24)

**Scope note:** this is the **second layer of the Spells/Spellcasting entity family** (step 10 continued), covering the real per-spell description pages the Class Spell Lists report (2026-08-24) named as its largest remaining follow-on: **608 real individual spell-description pages** discovered in the SRD manifest's "spells" corpus area, each carrying a spell's real school/subschool/descriptors, per-class/domain level, components, casting time, range, target/area/effect, duration, saving throw, spell resistance, and description text.

## Architecture

New files, following the exact pattern established by Feats/Races/Classes/Skills/Class Spell Lists:

- `shared/rules-registry/dnd35e/spells.ts` — `Dnd35eSpellDefinition` (`entityType: "spell"`), with `Dnd35eSpellClassLevel[]` for the per-class/domain level row and a `targetOrAreaOrEffect: { kind, text } | null` union covering the real page-to-page label variance (Target/Targets/Area/Effect).
- `server/dnd35e/extraction/spells-extractor.ts` — pure, regex-based `extractSpellFromHtml(html)`. Scans every real `<tr><th>Label:</th><td>Value</td></tr>` row generically rather than assuming a fixed row set, since real pages omit different rows for different real reasons (see below).
- `server/storage.ts` — `upsertDnd35eSpellDefinition`/`getDnd35eSpellDefinition`/`listDnd35eSpellDefinitions` on a new `dnd35e_spell_definitions` table.
- `server/dnd35e/extraction/run-spells-extraction.ts` — real, content-hash-verified batch extraction script covering all 608 real pages, 50ms delay between requests.

## Design notes: two real, deliberate SRD omission patterns, not extraction failures

An initial pass classified 169/608 spells as `unresolved` for missing Saving Throw, Spell Resistance, Casting Time, Range, and/or Duration rows. Investigating individual real fixtures (not guessing) showed these splits into two genuine, deterministic 3.5e conventions, plus a handful of real one-off irregularities — not a parser defect:

**1. Personal-range spells never print Saving Throw/Spell Resistance rows.** Confirmed against the real live "Blink" page (`Range: Personal`, `Target: You`) and "Mirror Image" (`Range: Personal; see text`) — a 3.5e rule (a personal-range spell only ever affects its own caster) the SRD encodes by omitting the rows entirely rather than writing "None". The extractor now recognizes `range === "Personal"` or `range.startsWith("Personal;")` and represents these fields as real `null` (not `""`, not a fabricated "None") with zero notes — this is the correct real answer for the field, not a gap.

**2. Greater/Mass/Lesser-style variant spells restate only the fields that differ from a named base spell.** Confirmed against the real live "Bull's Strength, Mass" page: its statBlock table has only 3 rows (Level/Range/Targets) with Components/Casting Time/Duration/Saving Throw/Spell Resistance entirely absent, followed by a real sentence: *"This spell functions like bull's strength, except that it affects multiple creatures."* Real phrasing varies page to page — confirmed variants are "This spell functions like `<a>`X`</a>`, except..." (Bull's Strength, Mass), "This spell functions like a `<a>`X`</a>` spell, except..." (Overland Flight, with an inserted article), and "`[Name]` works like `<a>`X`</a>`, except..." (Bear's Endurance, Mass). The extractor detects this real convention, resolves the referenced base spell's own real canonical ID into a new `inheritsFromCanonicalId` field, and replaces what would otherwise be several generic "No real X row found" notes with one consolidated note naming exactly which fields are inherited and from where. `extractionStatus` for these is `partially_structured`, not `unresolved` — the gap is real and disclosed, but it is now explained rather than presented as a bare failure. This pass does **not** resolve the inherited values themselves (copying them from the base spell record); that is real, separate future work, named explicitly, not implied as done.

**Two other real page-format variances found and fixed the same way (verified against live fixtures, not guessed):** a small number of spells' Level cell is plain, un-anchored text (e.g. "Mage's Lucubration": `Wiz 6` with no `<a>` wrapper, unlike every other checked page) — `parseLevelCell` now falls back to the plain cell text when no anchors are present.

## What remains honestly unresolved (2 of 608) — real one-off irregularities, not force-matched

- **Geas/Quest** — the SRD's only real compound-name spell page; its real statBlock table has no Range or Duration row at all (the two variants' differing values live in prose below the table, not in the table itself). A genuinely different real page structure from every other spell page checked.
- **Confusion, Lesser** — uses a third, distinct real cross-reference phrasing ("See the confusion spell, above, to determine the exact effect...") rather than "functions/works like X, except...". Extending `REFERENCE_VARIANT_RE` to catch this one phrase risked over-fitting to a single real page rather than a recurring convention; left honestly unresolved with its real per-field notes rather than force-matched.

Both are disclosed via standard `extractionNotes`, not silently dropped.

## Headline evidence line

```
608 real individual spell pages discovered in the manifest.
605 of 608 real spells extracted (3 real non-spell template/legend pages
  correctly excluded — see below).
  fully_structured:     463
  partially_structured: 140
  unresolved:             2
```

**3 real pages correctly excluded, not fabricated as spell data:** `greaterSpellName.htm`, `lesserSpellName.htm`, `massSpellName.htm` are real d20srd.org generic template/legend pages explaining the Greater/Lesser/Mass naming convention itself (no real `<h1>` spell name, no real statBlock table) — the extractor's fail-closed `throw` on these was verified correct, not a bug to route around.

## What's not covered (explicit follow-on work, not implied by this report)

1. **No cross-reference from Class Spell Lists' `spellCanonicalId` to this data has been verified for coverage.** The two entity families were built independently; a future pass should confirm every real `spellCanonicalId` referenced by a class spell list resolves to a real record here (and vice versa is not expected — many individual spells, e.g. 0-level cantrips outside a class's list, legitimately have no class-spell-list entry for every class).
2. **`inheritsFromCanonicalId` is not yet resolved.** The 140 `partially_structured` variant spells know *which* base spell their missing fields come from, but nothing yet copies those values forward into a usable, complete record. Real, separate future work.
3. **Per the user's explicit standing instruction**, this data should be revisited to help resolve Feats' remaining unresolved spellcasting-related prerequisites now that a real per-spell registry exists — not attempted in this pass, named here as the standing obligation it is.
4. **Spellcasting mechanics integration** (linking `Dnd35eClassSpellcasting`'s spells-per-day/spells-known tables to actual castable spell records) remains real, separate, next-in-roadmap work.

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
