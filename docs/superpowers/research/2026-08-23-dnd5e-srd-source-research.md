# D&D 5e SRD Source, License, and Corpus Research

**Research date and access date for every URL:** 2026-08-23

**Scope:** the open 2014-era SRD 5.1 corpus and the separately open revised-2024 SRD 5.2.x corpus. This is technical provenance research, not legal advice.

## Evidence vocabulary

- `[OFFICIAL SOURCE]` means Wizards of the Coast/D&D Beyond material, or Creative Commons for its own license.
- `[DERIVED SOURCE]` means a community conversion, API, mirror, or investigator-computed artifact property. It is never the authority for a D&D rule.
- `[SECONDARY SOURCE]` means third-party explanatory material. No secondary source controls a recommendation in this report.
- `[REPOSITORY FACT]` is verified in the frozen DungeonMasterOS branch.
- `[INFERENCE]` is an engineering conclusion from cited evidence.
- `[OPEN QUESTION]` is not adequately settled by the evidence reviewed.

## Findings at a glance

`[OFFICIAL SOURCE]` The current Wizards/D&D Beyond SRD hub is <https://www.dndbeyond.com/srd>. As of 2026-08-23 it lists **SRD 5.1** for the original 2014 rules and **SRD 5.2.1** as the current English revised-rules SRD. It lists no 5.2.2 or later English revision. The hub says SRD 5.2.1 was published 2025-05-01 and the page was last updated 2026-03-02.

`[OFFICIAL SOURCE]` SRD 5.1 is available under either **Creative Commons Attribution 4.0 International (CC BY 4.0)** or **Open Game License 1.0a (OGL 1.0a)**. SRD 5.2.x is available under **CC BY 4.0 only**. Each exact source/version/license choice must retain its own attribution and provenance.

`[OFFICIAL SOURCE]` The official hub says SRD 5.1 and SRD 5.2 may both be used in a product under their permanent licenses, but compatibility is the implementer's responsibility because rules differ. Permission to use both is not evidence that they form one mechanics ruleset.

`[OFFICIAL SOURCE]` Wizards publishes the open rules corpora as versioned PDFs. No official JSON, CSV, XML, Markdown corpus, bulk schema, or public rules API is listed on the official SRD hub. D&D Beyond Basic Rules pages are convenient official references, but the Creator FAQ says overlapping Basic Rules content is not thereby CC-licensed; the SRD text is the open republication source.

`[INFERENCE]` DungeonMasterOS should treat the official, hashed PDF bytes as authoritative source snapshots and any JSON/API as a separately versioned derived transport. A parser-friendly mirror may accelerate ingestion. It may not establish wording, completeness, license scope, or mechanical correctness.

## Official source and version matrix

| Source ID proposed for research | Generation | Exact version / date | License | URL | What the source proves |
|---|---|---|---|---|---|
| `wotc-srd-hub` | both | live page; last updated 2026-03-02 | informational page | <https://www.dndbeyond.com/srd> | `[OFFICIAL SOURCE]` Canonical downloads, current version, publication dates, license choices, corpus delta summary, localized releases, and FAQ. |
| `wotc-srd-5.1-cc` | 2014 | SRD 5.1; copyright 2016; CC release announced 2023-01-27 | CC BY 4.0 | <https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf> | `[OFFICIAL SOURCE]` Authoritative open 2014-era rules text and its version-specific CC attribution. |
| `wotc-srd-5.1-ogl` | 2014 | SRD 5.1; copyright 2016 | OGL 1.0a | <https://media.dndbeyond.com/compendium-images/srd/5.1/SRD-OGL_V5.1.pdf> | `[OFFICIAL SOURCE]` Same SRD generation under the OGL route, including Product Identity/Open Game Content designation and full OGL text. |
| `wotc-srd-5.1-ogl-legacy-url` | 2014 | SRD 5.1 | OGL 1.0a | <https://media.wizards.com/2016/downloads/DND/SRD-OGL_V5.1.pdf> | `[OFFICIAL SOURCE]` Older official Wizards-hosted locator for the OGL artifact. |
| `wotc-srd-5.2.0-cc` | revised 2024 | SRD 5.2.0; published 2025-04-22 | CC BY 4.0 | <https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf> | `[OFFICIAL SOURCE]` Preserved first published revision of the revised open corpus. It is historical, not the current ingestion target. |
| `wotc-srd-5.2.1-cc` | revised 2024 | SRD 5.2.1; published 2025-05-01 | CC BY 4.0 | <https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf> | `[OFFICIAL SOURCE]` Current English revised-rules corpus and its version-specific attribution. |
| `wotc-srd-5.2.1-conversion-guide` | 2014 → revised | published 2025-05-27 | official guidance; underlying permitted use remains source-dependent | <https://media.dndbeyond.com/compendium-images/srd/guide/converting-to-srd-5.2.1.pdf> | `[OFFICIAL SOURCE]` Official change taxonomy and section-by-section guidance; authoritative migration evidence, not an exhaustive semantic diff. |
| `wotc-community-update` | revised | 2025 release notes | informational page | <https://www.dndbeyond.com/community-update> | `[OFFICIAL SOURCE]` Dates and the 5.2.0 → 5.2.1 correction list. |
| `wotc-changelog` | both | live; relevant entry dated 2026-03-02 | informational page | <https://www.dndbeyond.com/changelog/> | `[OFFICIAL SOURCE]` Current D&D Beyond clarity labels use 5e for 2014 rules and 5.5e for revised rules without changing the underlying rules. |
| `wotc-cc-announcement` | 2014 | 2023-01-27 | informational page | <https://www.dndbeyond.com/posts/1439-ogl-1-0a-creative-commons> | `[OFFICIAL SOURCE]` Wizards placed the entire SRD 5.1 under CC BY 4.0 and left the OGL option available. |
| `wotc-conversion-release` | revised | published 2025-05-27; editor note 2026-03-02 | informational page | <https://www.dndbeyond.com/posts/1949-you-can-now-publish-your-own-creations-using-the> | `[OFFICIAL SOURCE]` Purpose/release of SRD 5.2.1 and the official conversion guide. |
| `wotc-creator-faq` | both | live | informational page | <https://www.dndbeyond.com/creator-faq> | `[OFFICIAL SOURCE]` Open SRD versus Basic Rules/closed-content boundary and creator-use cautions. |
| `cc-by-4.0-legal-code` | both where CC chosen | version 4.0 | CC BY 4.0 | <https://creativecommons.org/licenses/by/4.0/legalcode.en> | `[OFFICIAL SOURCE]` Controlling CC license terms. |
| `cc-by-4.0-deed` | both where CC chosen | version 4.0 | explanatory deed | <https://creativecommons.org/licenses/by/4.0/> | `[OFFICIAL SOURCE]` Human-readable Share/Adapt and attribution/change-indication summary; explicitly not a substitute for legal code. |

## Version and revision history

### SRD 5.1 family

`[OFFICIAL SOURCE]` The SRD 5.1 PDFs identify version 5.1 and copyright 2016. The current official hub continues to offer 5.1 as the open basis for the original 2014 rules.

`[OFFICIAL SOURCE]` Wizards announced the CC BY 4.0 release of the full SRD 5.1 on 2023-01-27. The OGL 1.0a artifact remains separately available; the content did not become “CC only.”

`[OPEN QUESTION]` The live official materials reviewed do not provide a first-party 5.0 → 5.1 line-item changelog or prove a precise original day in 2016. Secondary sources report a date and characterize fixes, but that should not be elevated into authoritative revision metadata without an archived first-party artifact.

### SRD 5.2.x family

`[OFFICIAL SOURCE]` Wizards published SRD 5.2.0 on 2025-04-22 as the open foundation for the revised core rules and stated that it incorporated then-current second-printing errata.

`[OFFICIAL SOURCE]` Wizards published SRD 5.2.1 on 2025-05-01. The Community Update says the point release restored 15 omitted magic items, corrected legal-page spacing/page numbers, replaced a duplicated Iron Golem block with Knight, and added Octopus.

`[OFFICIAL SOURCE]` Wizards published the conversion guide on 2025-05-27. The guide uses `[New Name]`, `[New Rule]`, `[Revised Rule]`, and `[Omitted Rule]` markers and covers terminology, rules sections, content types, capitalization, and revised monster-block presentation.

`[OFFICIAL SOURCE]` German, Spanish, French, and Italian SRD 5.2.1 PDFs were published 2025-12-08. They are official localized artifacts, not implicit aliases of the English snapshot.

`[INFERENCE]` A future 5.2.2 must create a new source snapshot, revision, diff, and verification run. It must not overwrite the 5.2.1 bytes or silently update campaigns pinned to 5.2.1.

## License and open-content boundary

### SRD 5.1

`[OFFICIAL SOURCE]` The official hub permits use of the entire SRD 5.1 under either OGL 1.0a or CC BY 4.0. The CC PDF contains a version-specific attribution statement. The OGL PDF contains the complete license and the document's Product Identity/Open Game Content designation.

`[INFERENCE]` Prefer the CC artifact for a new DungeonMasterOS canonical 2014 corpus unless a separately reviewed requirement calls for OGL provenance. Store the chosen license per source snapshot and preserve the exact source-provided attribution. Do not collapse OGL and CC into a generic `open` flag; obligations and attribution chains differ.

### SRD 5.2.x

`[OFFICIAL SOURCE]` The official hub states that new SRDs, including 5.2.x, are released exclusively under CC BY 4.0. The 5.2.1 PDF supplies its own attribution statement and permitted compatibility wording.

`[INFERENCE]` Store the exact 5.2.1 attribution separately from the 5.1 attribution and record any DungeonMasterOS normalization/modification. A compatibility phrase is not a blanket trademark license.

### What is not an ingestion source

`[OFFICIAL SOURCE]` The Creator FAQ distinguishes SRD open text from D&D Beyond Basic Rules and other official content. Official presentation on a public web page is not, by itself, a CC grant.

`[INFERENCE]` Do not ingest or reproduce:

- Player's Handbook, Dungeon Master's Guide, or Monster Manual text absent from the exact SRD;
- paid D&D Beyond content or marketplace data;
- Basic Rules text merely because it overlaps an SRD;
- protected named creatures/settings or other omitted brand content;
- random hosted PDFs, scans, piracy repositories, or unattributed databases.

`[INFERENCE]` Closed official sources may be recorded as non-reproductive bibliographic references or coverage-gap evidence when appropriate. They must never fill a canonical open record's prose or mechanics.

## SRD 5.1 corpus map — 2014 generation only

**Authoritative artifact:** <https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf>

`[OFFICIAL SOURCE]` The 403-page CC PDF has no publisher-supplied table of contents. The following map records the document's observed section order and the official hub's category notes. It does not pretend a generated index is publisher metadata.

| Required area | Presence in SRD 5.1 | Corpus shape and caution |
|---|---|---|
| Legal/open-content information | present | CC legal/attribution page in the CC artifact; separate OGL artifact exists. |
| Character basics | present | Step-by-step creation, six abilities, level/XP/proficiency concepts, alignment, languages, and character details. |
| Race/species | present as **races** | Nine race families are represented, with SRD-selected subrace/trait material where applicable. This is 2014 race semantics, not a revised species/origin model. |
| Classes | present | All twelve core class chassis are represented. |
| Subclasses | present but deliberately bounded | Generally one open archetype/subclass per class chassis; absence of a commercial option is not permission to import it. |
| Backgrounds | present but deliberately sparse | The official hub says SRD 5.1 contains Acolyte as its one background. |
| Feats | present but deliberately sparse | The official hub says SRD 5.1 contains Grappler as its one feat. |
| Ability scores and generation | present | Character generation, modifiers, checks, and ability use are covered. |
| Skills and saving throws | present | Skills/checks and saving throws appear in ability/rules sections and class proficiencies. |
| Advancement and multiclassing | present | Level/XP/proficiency and multiclass prerequisites/proficiencies are included; class progression remains class-specific. |
| Equipment | present | Currency, equipment packs, gear, tools, mounts/vehicles, and services. |
| Weapons and armor | present | 2014 weapon/armor tables, properties, proficiency, donning/doffing, and related rules. |
| Rules of play/adventuring | present | Time, movement, environment, travel, social/exploration procedures, food/water, resting, and related play rules. |
| Combat/action economy | present | Initiative, turns, actions, movement, attacks, damage/healing, opportunity attacks, mounted/underwater combat, and death/dying. |
| Conditions | present | Appendix-style condition definitions. Condition names are not proof of revised semantic equivalence. |
| Rests/recovery/hit dice | present | Short/long rest and hit-die recovery procedures are 2014 definitions. |
| Spellcasting | present | General spellcasting rules, casting time/range/components/duration/targets/saves, concentration, slots, and rituals. |
| Spell lists and spells | present but bounded | Class lists and individual open spell entries; not the complete commercial-book corpus. |
| GM/adventure/encounter rules | present | Includes encounter/adventure procedures and selected GM-facing rules, but is not a complete Dungeon Master's Guide. |
| Environment/travel/reference | present | Travel/environment material plus pantheon and planes appendices that the official hub says were removed from 5.2. |
| Traps, hazards, diseases, madness, objects, poisons | present in selected GM rules | Model only entries/sections actually in the PDF. |
| Magic items | present but bounded | General magic-item rules and selected open definitions; not every commercial item. |
| Monsters/NPCs/animals | present but bounded | Monster rules and selected stat blocks; not the complete Monster Manual. |

### SRD 5.1 coverage gaps

`[OFFICIAL SOURCE]` The hub explicitly describes the SRD as a foundation for creation, not a complete copy of the game. One background and one feat are intentional open-corpus limits, and many commercial spells/items/monsters/options are absent.

`[INFERENCE]` Corpus completeness means “every in-scope SRD 5.1 section and entity is accounted for,” not “every 2014 D&D option exists.” A manifest must have explicit absent/out-of-scope states so missing closed content is not mistaken for an ingestion defect.

## SRD 5.2.1 corpus map — revised generation only

**Authoritative artifact:** <https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf>

`[OFFICIAL SOURCE]` The 364-page PDF has an explicit table of contents with the following high-level sections:

1. Playing the Game, pages 5–18.
2. Character Creation, pages 19–27.
3. Classes, pages 28–82.
4. Character Origins, pages 83–86.
5. Feats, pages 87–88.
6. Equipment, pages 89–103.
7. Spells, pages 104–175.
8. Rules Glossary, pages 176–191.
9. Gameplay Toolbox, pages 192–203.
10. Magic Items, pages 204–253.
11. Monsters, pages 254–343.
12. Animals, pages 344–364.

| Required area | Presence in SRD 5.2.1 | Corpus shape and caution |
|---|---|---|
| Legal/open-content information | present | CC attribution/license notice for exact version 5.2.1. No OGL alternative. |
| Character basics | present | Revised character record, advancement, alignment, languages, names, and trinkets. |
| Race/species | present as **species** | Nine species: Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc, and Tiefling. Species does not simply inherit the 2014 race field contract. |
| Classes | present | All twelve class chassis with revised presentations. |
| Subclasses | present but deliberately bounded | One open subclass per class: Berserker, Lore, Life, Land, Champion, Open Hand, Devotion, Hunter, Thief, Draconic, Fiend, and Evoker. |
| Backgrounds/origins | present | Acolyte, Criminal, Sage, and Soldier; origin construction is a revised structured system. |
| Feats | present by category | Origin, General, Fighting Style, and Epic Boon categories. The hub lists 15 feats added relative to 5.1; a manifest must distinguish delta count from total entries. |
| Ability scores and generation | present | Revised background-linked ability assignment and core D20 Test vocabulary. |
| Skills and saving throws | present | Covered in Playing the Game, character records, and class definitions. |
| Advancement and multiclassing | present | Level/XP/proficiency, revised progression, tiers, and multiclass rules; individual class definitions remain versioned. |
| Equipment | present | Coins, gear, tools, mounts/vehicles, services, crafting, and revised categories. |
| Weapons and armor | present | Revised properties, Mastery, firearms, armor, and related tables. |
| Rules of play/exploration | present | Playing the Game explicitly includes Rhythm of Play, social interaction, exploration, and combat. |
| Combat/action economy | present | Revised action glossary, initiative/turns, attacks, damage/healing, movement, and death/dying. |
| Conditions | present in Rules Glossary | Alphabetized defined terms and conditions; same labels must remain version-qualified where effects differ. |
| Rests/recovery/hit dice | present | Revised glossary procedures and recovery effects. |
| Spellcasting | present | Revised casting, preparation, slots, rituals, concentration, targets, and action constraints. |
| Spell lists and spells | present but bounded | Class lists and individual 5.2.1 entries; same-name 5.1 spells must not be overwritten. |
| GM/adventure/encounter rules | present in Gameplay Toolbox | Creatures, adventure environments, traps, hazards, travel, environmental effects, siege equipment, poisons, and related procedures. |
| Environment/travel/reference | present | Revised travel pace/environment in the toolbox and glossary. Pantheon/planes appendices are omitted. |
| Magic items | present but bounded | General use/crafting/categories plus selected item definitions. 5.2.1 restored items missing from 5.2.0. |
| Monsters/NPCs | present but bounded | Revised monster-use rules and selected stat blocks. Every imported block must come from the revised artifact, not a reshaped 2014 record. |
| Animals | present as a separate section | Selected animal stat blocks are distinct in the document structure. |

### SRD 5.2.1 coverage gaps

`[OFFICIAL SOURCE]` The official hub identifies selected additions, removals, renames, and protected-name substitutions. SRD 5.2.1 remains a bounded open subset of the revised Player's Handbook (2024), Dungeon Master's Guide (2024), and Monster Manual (2025).

`[INFERENCE]` Do not use commercial-book counts or D&D Beyond character-builder availability as expected-manifest counts. Expected coverage must be generated from the exact 5.2.1 PDF and reviewed page-by-page.

## Official category delta summary

`[OFFICIAL SOURCE]` The official SRD hub establishes these corpus-level changes between 5.1 and 5.2.1:

- a table of contents was added;
- Playing the Game adds or restructures Rhythm of Play and Exploration;
- character creation and all class/subclass presentations were revised;
- Criminal, Sage, and Soldier backgrounds were added;
- Goliath and Orc species were added while Half-Elf and Half-Orc were omitted from the revised open species list;
- feat categories and 15 added feat names are listed;
- weapon Mastery, firearms, and potion/scroll crafting were added;
- 20 added spells are listed;
- Rules Glossary, Travel Pace, and Environmental Effects material was added or revised;
- 15 magic-item additions are listed, with two SRD-only protected-name substitutions;
- 17 monster additions are listed and stat blocks use the revised format;
- pantheon and planes appendices were removed.

`[INFERENCE]` These are manifest/corpus deltas, not permission to transform a 5.1 record by patching a handful of fields. Canonical definitions must be independently extracted and verified from their own source version.

## Official machine-readable availability

`[OFFICIAL SOURCE]` The canonical hub lists PDF downloads for English and localized SRDs plus a PDF conversion guide. It lists no official machine-readable rules corpus or public bulk-data API as of 2026-08-23.

`[INFERENCE]` The defensible claim is “no official machine-readable SRD corpus is published on the canonical hub,” not “Wizards has no internal structured data.” DungeonMasterOS needs its own reproducible extraction and verification pipeline.

## Derived ingestion transports

| Transport | Live evidence on 2026-08-23 | What it can do | Limitations / required controls |
|---|---|---|---|
| `5e-bits/5e-database` | <https://github.com/5e-bits/5e-database>; `main` resolved to `bfd3db4bcc31699cce703b46feb9af3f0ff08999` | `[DERIVED SOURCE]` Repository contains separate `src/2014` and `src/2024` trees and JSON used by DungeonMasterOS's current item importer. | README describes software as MIT and underlying material as OGL 1.0a, language that does not adequately establish provenance for the newer CC-only corpus. Never use `@main`; pin a commit, snapshot bytes, retain exact source path, and reconcile every accepted record to the correct official PDF/page/license. |
| `5e-bits/5e-srd-api` | <https://github.com/5e-bits/5e-srd-api>; `main` resolved to `da140e3e5efce908cbd03c30e26125230b9aa53e` | `[DERIVED SOURCE]` JSON REST API and schema tooling for the related database. | README says only `/api/2014` is currently available and `/api/2024` is future work. It is not a current 5.2.1 authority or complete revised transport. |
| Open5e API v2 | <https://open5e.com/api-docs>; source at <https://github.com/open5e/open5e-api> | `[DERIVED SOURCE]` JSON API with source-document metadata including distinct 2014/2024 document keys; useful cross-check and extraction accelerator. | Includes multiple open publishers and mutable corrections. Filter exact document keys, pin a commit/release, preserve per-source licensing, and verify against official pages. API availability does not prove Wizards provenance. |
| Volunteer 5.2 parsers/sites | examples exist, including sites that label their own conversion incomplete | `[DERIVED SOURCE]` Potential parser test cases. | Not suitable as canonical input without complete source mapping, license proof, immutable revision, and page-level reconciliation. |

`[REPOSITORY FACT]` Current DungeonMasterOS jsDelivr URLs refer to `5e-bits/5e-database@main`. That is mutable and therefore cannot reproduce a historical import reliably.

`[INFERENCE]` Derived datasets should be optional comparison inputs. The acceptance gate is a canonical record verified against the official source snapshot, not agreement between two mirrors that may share the same upstream typo.

## Reproducible official artifact evidence

`[DERIVED SOURCE]` The following values were computed on 2026-08-23 from bytes fetched directly from the official URLs. They are investigator-computed SHA-256 values, not publisher signatures:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `SRD_CC_v5.1.pdf` | 3,158,713 | `2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0` |
| `SRD-OGL_V5.1.pdf` | 4,857,826 | `d3f94417d2532f42a5abaec07e71a59007bf6cc46992c6458be6667f7a9f1e34` |
| `SRD_CC_v5.2.pdf` | 5,953,304 | `cf18e1f88a360646940b6fada63fd1bd04c1c02581ca668a9115c2f4577bf8aa` |
| `SRD_CC_v5.2.1.pdf` | 6,031,375 | `8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87` |
| `converting-to-srd-5.2.1.pdf` | 2,472,344 | `f7290fb7568c5456066553885591d2adbb87745198c539c11e49740c4a6b1864` |

`[INFERENCE]` A versioned URL is helpful but remains publisher-controlled. Future ingestion should preserve a content-addressed raw snapshot and record URL, UTC acquisition time, byte length, SHA-256, HTTP ETag/Last-Modified when present, extractor name/version/configuration, and any normalization changes.

## Proposed provenance chain

```text
Wizards SRD hub/version announcement
  -> exact versioned official PDF URL
  -> immutable DungeonMasterOS raw snapshot + SHA-256
  -> source-page manifest and extraction evidence
  -> extractor version + normalization report
  -> canonical generation-qualified entity + page anchors
  -> independent verification and append-only revision

Optional parallel evidence:
pinned community JSON/API commit
  -> immutable derived snapshot + its own license/provenance
  -> record-level comparison report
  -> never promoted to authoritative original source
```

`[INFERENCE]` Minimum original-source snapshot metadata:

```ts
interface SourceArtifactSnapshot {
  sourceId: string;
  rulesetId: "dnd5e2014" | "dnd5e2024";
  srdVersion: "5.1" | "5.2.0" | "5.2.1";
  sourceRole: "authoritative_original";
  publisher: "Wizards of the Coast";
  licenseId: "CC-BY-4.0" | "OGL-1.0a";
  officialUrl: string;
  acquiredAt: string;
  byteLength: number;
  sha256: string;
  httpEtag: string | null;
  httpLastModified: string | null;
  attributionText: string;
  supersedesSnapshotId: string | null;
}
```

`[INFERENCE]` Minimum derived-transport metadata:

```ts
interface DerivedTransportSnapshot {
  transportSourceId: string;
  derivedFromSourceId: string;
  repositoryUrl: string;
  immutableCommit: string;
  pathOrEndpoint: string;
  acquiredAt: string;
  byteLength: number;
  sha256: string;
  softwareLicense: string | null;
  contentLicenseClaim: string | null;
  verificationStatus: "unverified" | "sampled" | "record_reconciled";
}
```

`[INFERENCE]` A derived record with a perfect checksum but no verified official page anchor is reproducibly unverified, which is at least honest but still not canonical.

## Source-manifest strategy

`[INFERENCE]` Maintain independent manifests for each exact authoritative artifact:

- `dnd5e2014` / SRD 5.1 CC;
- optionally SRD 5.1 OGL as a separate license-bearing source view rather than duplicate mechanics;
- `dnd5e2024` / SRD 5.2.1 CC;
- SRD 5.2.0 as a preserved historical source, not an enabled current corpus;
- the conversion guide as migration evidence, not canonical gameplay content.

`[INFERENCE]` Each manifest entry should record page range, section path, expected entity family, extraction state, source-verification state, canonical-link count, and explicit disposition (`canonical`, `reference_only`, `legal`, `index`, `out_of_scope`, or `manual_review`). Page processing and canonical automation status must remain independent.

`[INFERENCE]` SRD 5.1 needs a generated, reviewer-approved page/section index because the publisher did not supply a TOC. SRD 5.2.1 can seed section boundaries from its official TOC, but entity counts still require page-anchored extraction and duplicate detection.

`[INFERENCE]` Completeness gates must compare every in-scope manifest entry to an explicit disposition and every canonical entity to at least one verified source anchor. A row-count threshold is not corpus evidence. It is numerology wearing a database badge.

## Current and future source drift policy

`[INFERENCE]`

1. Poll the official hub for a newly named version, never for an implicit “latest” body replacement.
2. Re-fetch known URLs only into a candidate snapshot and compare SHA-256/HTTP metadata.
3. If bytes at an existing versioned URL drift, quarantine the candidate, retain both byte sets, and require review.
4. If a new SRD version appears, register it as a new source and create an explicit source/canonical diff.
5. Never mutate old canonical revisions or campaign rules snapshots in place.
6. Re-run manifest completeness, parser regression, license-attribution, and cross-generation contamination tests before enabling the new revision.

## Player-facing terminology supported by official evidence

`[OFFICIAL SOURCE]` The current official changelog uses `5e` for the 2014 rules and `5.5e` for the revised 2024 rules, while saying the label change is not a new edition and the revised rules are backward compatible. The SRD's legal/version identity remains 5.1 versus 5.2.1.

`[INFERENCE]` Clear DungeonMasterOS labels should lead with the familiar game name and year, then expose the exact SRD in supporting text:

- **D&D 5e (2014)** — Open rules source: SRD 5.1.
- **D&D 5e Revised (2024)** — Also commonly/officially labelled 5.5e on D&D Beyond; open rules source: SRD 5.2.1.

`[INFERENCE]` Do not make `5.5e` the only visible name. Do not store `5e`/`5.5e` as a substitute for the ruleset ID or SRD revision. Marketing terminology, rule generation, and source version are separate fields because, apparently, one version number would have been dangerously straightforward.

## Recommended internal source identities

`[INFERENCE]` Mechanics identities should remain compact and consistent with the repository's existing lower-case alphanumeric convention:

- `dnd5e2014`
- `dnd5e2024`

`[INFERENCE]` Source identity should be more precise than mechanics identity. Suggested stable source IDs:

- `wotc-srd-5-1-cc-by-4-0`
- `wotc-srd-5-1-ogl-1-0a`
- `wotc-srd-5-2-0-cc-by-4-0`
- `wotc-srd-5-2-1-cc-by-4-0`
- `wotc-srd-5-2-1-conversion-guide`
- `transport-5e-bits-5e-database-bfd3db4`

The full immutable commit belongs in the source revision/snapshot, even when a readable short suffix appears in a transport source ID.

## Research conclusions and open questions

`[INFERENCE]` Implement 2014/SRD 5.1 first, then revised/SRD 5.2.1. That order aligns the historical compatibility target with a stable official corpus while preserving the revised corpus as an independent sibling. It does not authorize treating legacy `dnd5e` state as verified SRD 5.1 without a migration audit.

- `[OPEN QUESTION]` Recover a first-party archived SRD 5.0 → 5.1 release/delta artifact if exact early revision history matters.
- `[OPEN QUESTION]` Generate authoritative entity counts from page-anchored extraction. Community projects disagree, and the official hub's “15 feats added” is a delta rather than necessarily the total.
- `[OPEN QUESTION]` Decide whether DungeonMasterOS stores raw licensed PDFs in repository releases, object storage, or another immutable evidence store after security/backup/license review.
- `[OPEN QUESTION]` Decide whether to register the OGL and CC 5.1 artifacts as two source records pointing to one verified semantic corpus or as separate source snapshots with a controlled equivalence relation.
- `[OPEN QUESTION]` Validate each localized PDF independently before offering localized canonical text; do not assume byte or record equivalence.
- `[OPEN QUESTION]` Monitor the official hub for future point releases. The “current” conclusion is verified only as of 2026-08-23.

## Non-ingestion confirmation

`[REPOSITORY FACT]` This research created documentation only. No SRD content was ingested into DungeonMasterOS, no source was registered, no schema or application code changed, and no closed rulebook content was copied into the repository.
