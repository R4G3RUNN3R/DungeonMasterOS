# D&D 3.5e Skills Extraction Report (real run: 2026-08-24)

**Scope note, stated explicitly:** this covers **all 36 real individual D&D 3.5e core skills** — every skill page in the SRD manifest's "skills" corpus area except the 3 real overview/rules-essay pages (`skillDescriptions.htm`, `skillsSummary.htm`, `usingSkills.htm`), which are about the skill *system* in general, not any one skill, and are out of scope for this entity family (same source-page-vs-canonical-entity distinction established since Phase 2A). It does not cover any other entity family.

## Architecture

New files, following the exact pattern established by Feats/Races/Classes:

- `shared/rules-registry/dnd35e/skills.ts` — `Dnd35eSkillDefinition`: `keyAbility`, `trainedOnly`, `armorCheckPenalty` (all three derived from the real page's own `<h1>Name (KeyAbility[; flags])</h1>` heading), and `sections: Dnd35eSkillSection[]` — a flat, honestly-named list of every real `{heading, text}` block (Check/Action/Try Again/Special/Synergy/Restriction, plus skill-specific deep-dive subsections), rather than a fixed field set.
- `server/dnd35e/extraction/skills-extractor.ts` — pure, regex-based `extractSkillFromHtml(html)`.
- 3 real captured fixtures, chosen to cover the real structural range: `skill-climb-fixture.html` (a skill with real embedded DC-lookup tables), `skill-jump-fixture.html` (a simple skill with a `<ul><li>`-based Synergy section), `skill-disabledevice-fixture.html` (a Trained Only skill with a Restriction section plus real h4-level deep-dive subsections).
- `server/storage.ts` — `upsertDnd35eSkillDefinition`/`getDnd35eSkillDefinition`/`listDnd35eSkillDefinitions` on a new `dnd35e_skill_definitions` table, structurally identical to the feat/race/class-definition storage.
- `server/dnd35e/extraction/run-skills-extraction.ts` — real, committed, content-hash-verified extraction script covering all 36 real skill pages. Per-page errors are collected and reported rather than crashing the whole batch (a real, deliberate resilience choice — not needed in practice, since all 36 pages extracted cleanly, but a genuine one-bad-page shouldn't silently take down the other 35).

## Design notes

**Sections are captured as a flat, honestly-named list, not a fixed field set.** Unlike Classes (where every core class reliably has Alignment/Hit Die/Class Skills/Skill Points), real skill pages vary far more in which sections they have. Climb/Jump have Check/Action/Special/Synergy; Disable Device additionally has Try Again, Restriction, and 5 real skill-specific deep-dive subsections (`Other Ways To Beat A Trap` and its 4 real children). Forcing a fixed shape would either fail closed on every skill with an unusual section, or silently drop real content — so `sections` is a flat array capturing whatever's really there.

**Real embedded DC-lookup tables are disclosed, not parsed.** Climb's, Jump's, and many other skills' "Check" sections contain a real reference table (e.g. Climb's DC-by-surface-type table). This pass captures the section's real prose but not the table's own rows, and adds an honest `extractionNotes` entry naming exactly which section has an unstructured table — never silently dropped, never guessed. This is why 19 of 36 skills are `partially_structured` rather than `fully_structured`: every one of them has a real reference table in at least one section.

**`<ul><li>` list content is captured alongside `<p>` paragraphs.** Found while verifying Jump: Synergy sections are almost always phrased as a `<ul><li>` list (skill-to-skill synergy bonuses), not `<p>` paragraphs. A paragraph-only extractor would silently leave every Synergy section empty. Fixed by matching both `<p>` and `<li>` content, in document order, before this ever reached a committed extraction.

**Section boundaries respect both `<h4>` and `<h5>`.** Disable Device's real page has an `<h4 id="otherWaysToBeatATrap">` deep-dive heading nested among its `<h5>` sections. A boundary that only looked ahead for the next `<h5>` would swallow the h4 heading and its intro paragraph into the preceding `<h5>` section's text. Verified via a dedicated regression test that "Restriction"'s captured text stops before "Other Ways To Beat A Trap" begins.

## Headline evidence line

```
Total real skills extracted: 36 of 36
  fully_structured: 16
  partially_structured: 19
  unresolved: 1
```

Zero real extraction failures across all 36 real live pages (content-hash verified, zero drift on every page).

## The one real `unresolved` skill: Speak Language

Speak Language's real heading is `<h1>Speak Language (None; Trained Only)</h1>` — the SRD's own text confirms this is by design: "There are no Speak Language checks to fail. The Speak Language skill doesn't work like other skills. ... You don't make Speak Language checks. You either know a language or you don't." This is the one real 3.5e skill with **no key ability at all**, honestly reflected by `extractionStatus: unresolved` and a real extraction note ("No recognized key ability found... 'None; Trained Only'") — not a bug, not a gap in the extractor, a genuine real fact about this one skill.

## What's not covered (explicit follow-on work, not implied by this report)

1. **Real embedded DC-lookup/reference tables are not structured** — 19 of 36 skills have at least one (Climb's climb-DC-by-surface table is the clearest example; many others have similar). A future pass could structure the common shapes (a DC column + a description column) the way Feats' Benefit-effect patterns were deepened — real, concrete follow-on work, not attempted here.
2. **Cross-skill Synergy bonuses are preserved as real text, not cross-referenced or evaluated** — e.g. Jump's real "+2 bonus on Jump checks if you have 5+ ranks in Tumble" is captured verbatim in Jump's `sections`, but there's no structured, queryable "if character has N ranks in skill X, grant +M to skill Y" fact yet. This is exactly the kind of deterministic cross-entity semantics the user asked to revisit once available — Feats' unresolved prerequisites and Races' racial skill bonuses may become resolvable once this exists.
3. **Craft/Knowledge/Perform/Profession are single skill entries, not expanded per-subtype** — 3.5e treats these as "buy a specific subtype" skills (Craft (Alchemy), Knowledge (Arcana), etc.), and the real subtype list lives in each skill's own prose (captured as real text in `sections`), not as a separate structured list of subtypes.
4. **No runtime consumer yet** — like Races and Classes, there is no character-sheet/skill-check-resolution code wired to this table yet; that's real, separate future integration work.
5. **Per the user's explicit instruction**, this entity family should be revisited once it can help resolve previously-`unresolved`/`partially_structured` Feats prerequisites (e.g. `skill_ranks` prerequisites now have a real canonical skill registry to validate against) and Races' skill-bonus `special_ability` text (e.g. a race's "+2 racial bonus on Listen checks" could become a structured fact once a real skill-bonus effect shape exists) — not attempted in this pass, named here as the standing obligation it is.

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
