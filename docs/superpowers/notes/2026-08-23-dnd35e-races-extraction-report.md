# D&D 3.5e Races/Racial Traits Extraction Report (real run: 2026-08-23)

**Scope note, stated explicitly:** this is a *feat-page*-style single-source extraction covering the 7 core PHB races from one real SRD page (`/srd/races.htm`). It does not cover any monstrous/other-book race, and it does not cover any other entity family (feats, classes, spells, monsters, etc.) — each has its own separate report.

## Architecture

New files, mirroring the Feats entity family's established pattern (Phase 2B-1):

- `shared/rules-registry/dnd35e/races.ts` — `Dnd35eRaceDefinition`, `Dnd35eRacialTrait` (a discriminated union: `ability_modifier`, `size`, `base_land_speed`, `favored_class`, `bonus_feat_count`, `bonus_skill_points`, and a `special_ability` catch-all), `Dnd35eRacialLanguages`.
- `server/dnd35e/extraction/races-extractor.ts` — pure, regex-based `extractRacesFromHtml(html)`, parsing real `<h2 id="slug">Name</h2>` blocks and their `<ul><li>` racial-trait lists.
- `server/dnd35e/extraction/races-fixture.html` — the real, captured `/srd/races.htm` page, committed as a test fixture (same precedent as `feats-fixture.html`).
- `server/storage.ts` — `upsertDnd35eRaceDefinition`/`getDnd35eRaceDefinition`/`listDnd35eRaceDefinitions` on a new `dnd35e_race_definitions` table, structurally identical to the feat-definition storage (same canonical-ID validation, same no-op-vs-revision content-diff logic via `recordRevision(entityType: "race")`).
- `server/dnd35e/extraction/run-races-extraction.ts` — real, committed, re-runnable extraction script, content-hash-verified against Phase 2A's manifest before extracting (identical discipline to `run-feats-extraction.ts`).
- `server/dnd35e/extraction/html-utils.ts` — `stripTags`/`kebabCase` extracted out of `feats-extractor.ts` once a second extractor needed them (more entity-family extractors are planned per the 21-step implementation order, so this avoids re-duplicating them for each one).

## Design note on "honest partial extraction"

Most real racial traits (Stonecunning, Weapon Familiarity, Elven/Orc Blood, Spell-Like Abilities) are genuinely one-off narrative mechanics that don't reduce to a small, fixed set of atomic kinds without a much larger effects-modeling system. This pass structures the handful of shapes that recur across every race — ability modifiers, size, base land speed, automatic/bonus languages, favored class (including resolving the granted class to a real canonical ID when one is linked), and Human's bonus-feat/skill-point grants — and preserves everything else as a real, named `special_ability`, never dropped, never guessed. Real trailing prose a structured pattern doesn't fully consume (a dwarf's medium/heavy-load speed exception, a gnome's burrowing-mammal language note, a half-orc's ability-score-floor clarification) is preserved as its own fact or extraction note, not silently discarded.

## Content-hash verification (fail-closed drift check)

Before extracting, the real page was re-fetched and its SHA-256 compared against the hash Phase 2A's real acceptance scan recorded for this exact page in `srd_manifest_entries` (`dnd35e-srd-hypertext-d20::/srd/races.htm`):

```
Content hash verified — extracting from confirmed-current content.
```

Zero drift — the page has not changed since Phase 2A's scan.

## Headline evidence line

```
extracted 7 real races from https://www.d20srd.org/srd/races.htm → 1 fully_structured → 6 partially_structured → 0 unresolved
```

## Real counts

| Metric | Count |
|---|---|
| Total real races extracted | 7 |
| `fully_structured` (every trait structured, no `special_ability`) | 1 (Humans) |
| `partially_structured` (real structured traits present, plus at least one genuine `special_ability`) | 6 (Dwarves, Elves, Gnomes, Half-Elves, Half-Orcs, Halflings) |
| `unresolved` | 0 |

Zero `unresolved` is a real, honest result, not a gap: every one of the 7 races has at least ability-score/size/speed/language/favored-class facts structured (Humans has zero real special-ability-shaped traits at all in the source text). It is not evidence of complete coverage of racial mechanics — see "What's not covered" below.

## Real per-race breakdown

- **Humans** (`fully_structured`) — size medium, speed 30 ft, 1 bonus feat at 1st level, 4+1 bonus skill points, Common automatic / any bonus language, Favored Class: Any.
- **Dwarves** (`partially_structured`) — Con+2/Cha-2, size medium, speed 20 ft (plus a real armor-load speed exception, preserved), Common+Dwarven automatic / 6 literal bonus languages, Favored Class: Fighter (resolved to `dnd35e:class:fighter`). Real special abilities preserved: Darkvision, Stonecunning, Weapon Familiarity, Stability, plus 6 more untitled `+N racial bonus...` lines.
- **Elves** (`partially_structured`) — Dex+2/Con-2, size medium, speed 30 ft, Common+Elven automatic / 6 literal bonus languages, Favored Class: Wizard (resolved). Real special abilities preserved: sleep immunity/enchantment save, Low-Light Vision, Weapon Proficiency (bonus feats), a skill-bonus line.
- **Gnomes** (`partially_structured`) — Con+2/Str-2, size small, speed 20 ft, Common+Gnome automatic / 6 literal bonus languages (plus a real burrowing-mammal speak-with-animals note, preserved as an extraction note), Favored Class: Bard (resolved). Real special abilities preserved: Low-Light Vision, Weapon Familiarity, Spell-Like Abilities, 4 more untitled bonus lines.
- **Half-Elves** (`partially_structured`) — size medium, speed 30 ft, Common+Elven automatic / any bonus language, Favored Class: Any. Real special abilities preserved: sleep immunity, Low-Light Vision, Elven Blood, 2 skill-bonus lines.
- **Half-Orcs** (`partially_structured`) — Str+2/Int-2/Cha-2 (plus a real "Intelligence floor of 3" clarification, preserved), size medium, speed 30 ft, Common+Orc automatic / 5 literal bonus languages, Favored Class: Barbarian (resolved). Real special abilities preserved: Darkvision, Orc Blood.
- **Halflings** (`partially_structured`) — Dex+2/Str-2, size small, speed 20 ft, Common+Halfling automatic / 5 literal bonus languages, Favored Class: Rogue (resolved). Real special abilities preserved: 4 untitled bonus lines (skills, saves, fear morale bonus, thrown-weapon attack bonus).

## What's not covered (explicit follow-on work, not implied by this report)

1. **Monstrous/other-book races** — this page only covers the 7 core PHB races. Later races (per the Source Audit's Races of X series, once licensed-book extraction begins) are separate, future work.
2. **Racial special-ability structuring** — the `special_ability` catch-all (Darkvision, Stonecunning, Weapon Familiarity, Spell-Like Abilities, skill/save/attack bonus lines, etc.) is real, preserved text, not yet further decomposed into typed mechanical effects the way Feats' `skill_check_bonus`/`save_bonus` patterns do. A future pass could structure the recurring `"+N racial bonus on X checks"` and `"+N racial bonus on Y saving throws"` shapes the same way Feats' Benefit-effect patterns were deepened — real, concrete follow-on work, not attempted here.
3. **No evaluator exists yet for racial traits** — unlike Feats (`feat-prerequisites.ts`), there is no "does this character qualify for/benefit from this race" mechanic wired up. That's expected: races are chosen at character creation, not gated by prerequisites, so the analogous need doesn't exist the same way — but applying racial traits to a character's computed sheet (ability scores, speed, bonus feats/skills) is real, separate, future integration work (steps 15-18 of the 21-step order: authoritative character state, sheet projection).

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
