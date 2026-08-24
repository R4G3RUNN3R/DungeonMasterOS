# D&D 3.5e Class Spell Lists Extraction Report (real run: 2026-08-24)

**Scope note, stated explicitly:** this is the **first real layer of the Spells/Spellcasting entity family** (step 10 of the 21-step implementation order), and is deliberately narrower than a full spell-description entity family. The SRD has **621 individual spell-description pages** (full range/duration/saving throw/spell resistance/mechanical text per spell) — far too large to extract exhaustively in this pass. Instead, this pass covers the **8 real "class spell list" summary pages**, of which 6 are real entity-bearing pages (Bard, Cleric, Druid, Paladin, Ranger, and the shared Sorcerer/Wizard page) and 2 are out of scope (see below) — a genuine, tractable, honest first slice that already yields real, structured, useful data: which spells each class can cast, at what level, with what component requirements, and a real one-line summary. Full individual spell descriptions remain real, substantial, named future work.

## Architecture

New files, following the exact pattern established by Feats/Races/Classes/Skills:

- `shared/rules-registry/dnd35e/class-spell-lists.ts` — `Dnd35eClassSpellList` (its own canonical ID, `entityType: "class-spell-list"`, plus a `classCanonicalId` reference to the real class entity) containing `Dnd35eClassSpellListEntry[]` (`spellCanonicalId`, `name`, `level`, `componentMarkers`, `summary`).
- `server/dnd35e/extraction/class-spell-lists-extractor.ts` — pure, regex-based `extractClassSpellListFromHtml(html, classCanonicalId, classSlug)`.
- `server/storage.ts` — `upsertDnd35eClassSpellList`/`getDnd35eClassSpellList`/`listDnd35eClassSpellLists` on a new `dnd35e_class_spell_lists` table.
- `server/dnd35e/extraction/run-class-spell-lists-extraction.ts` — real, content-hash-verified extraction script covering all 6 real entity-bearing pages, producing 7 real records (Sorcerer and Wizard share one real page but get two separate records, mirroring how they share one class page but get separate `Dnd35eClassDefinition` records).

## Design notes

**A combined `<li>` entry (e.g. "Detect Chaos/Evil/Good/Law") yields one real entry per real spell, not one entry for the group.** The SRD's own list pages sometimes phrase closely related spells as one shorthand line: `<a>Detect Chaos</a>/<a>Evil</a>/<a>Good</a>/<a>Law</a>: Reveals creatures...`. Each of those 4 anchors links to a real, distinct spell page (`detectChaos.htm`, `detectEvil.htm`, ...). This pass creates 4 separate entries — one per real spell — all sharing that `<li>`'s real level and summary text.

**Shorthand display names are preserved verbatim, never reconstructed.** In the combined entry above, only the first anchor's text is the full name ("Detect Chaos"); the other three are literally just "Evil", "Good", "Law" in the source. This pass keeps each anchor's own real text as that entry's `name` rather than guessing/reconstructing a full name like "Detect Evil" — inferring the shared prefix would be a guess, not a fact read from the page.

**Component markers are preserved as the page's own literal marker text.** Real `<sup><a>M</a></sup>`/`<sup><a>F</a></sup>` links (Material, Focus, and others) are captured as a `componentMarkers: string[]` array per entry (e.g. Augury has real `["M", "F"]`) — not reinterpreted into a richer components model, which belongs to the future full spell-description entity family.

## Headline evidence line

```
dnd35e:class-spell-list:bard: fully_structured, 164 entries.
dnd35e:class-spell-list:cleric: fully_structured, 231 entries.
dnd35e:class-spell-list:druid: fully_structured, 169 entries.
dnd35e:class-spell-list:paladin: fully_structured, 45 entries.
dnd35e:class-spell-list:ranger: fully_structured, 51 entries.
dnd35e:class-spell-list:sorcerer: fully_structured, 377 entries.
dnd35e:class-spell-list:wizard: fully_structured, 377 entries.
```

**1,414 real spell-list entries** across all 7 real class records (with real overlap — many spells appear on multiple classes' lists, exactly as in the real rules; e.g. Cure Light Wounds appears on Cleric/Druid/Bard/Paladin/Ranger's lists independently). Sorcerer and Wizard's counts match exactly (377 each) because they share the same real spell list, per the real rule — verified, not assumed. Zero real extraction failures; all 6 live pages hash-verified, zero drift.

## What's not covered (explicit follow-on work, not implied by this report)

1. **The ~621 individual spell-description pages are the large, real, substantial remaining work.** This pass gives a spell's name, level-per-class, component markers, and a one-line summary — not its range, duration, saving throw, spell resistance, area/target/effect, or full mechanical text. A future pass would extract each real spell page individually (similar in spirit to Feats' per-page extraction, but at roughly 6x the page count) and cross-reference against the `spellCanonicalId`s this pass already established.
2. **`clericDomains.htm`** (domain-to-spell mapping, a genuinely different real structure from a level-organized class list) and **`spellLists.htm`** (a legend/index page, not spell data itself) are real, separate, out-of-scope pages — not attempted, not silently claimed as covered.
3. **Paladin and Ranger's real spell lists only reach 4th level** (verified: 45 and 51 entries respectively, matching their partial-caster nature already confirmed in the Classes report) — consistent with, not contradicting, their `Dnd35eClassSpellcasting.spellsPerDay` 4-column shape.
4. **No cross-reference from `Dnd35eClassSpellcasting` to this data exists yet** — a class's `spellsPerDay`/`spellsKnown` tables (Classes entity family) and its spell list (this entity family) are both real and correct but not yet linked by any code; that's real, separate future integration work.
5. **Per the user's explicit standing instruction**, this data should be revisited to help resolve Feats' remaining unresolved spellcasting-related prerequisites (e.g. "spellcasting capability" or "spell level capability" prerequisite forms named in the original Phase C directive but not yet implemented in `feats-extractor.ts`, since no real spell registry existed to check them against until now) — not attempted in this pass, named here as the standing obligation it is.

None of the above is claimed as done — this section names real, concrete follow-on work, not a completion promise.
