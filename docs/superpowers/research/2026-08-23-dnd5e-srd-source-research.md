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
- `[EXECUTION ATTESTATION]` records what this documentation-only task did or did not change.
- A **semantic corpus revision** is the versioned body of rules DungeonMasterOS means to expose, independent of the file or legal wrapper used to prove it.
- A **source artifact snapshot** is one immutable fetched representation of evidence, such as the SRD 5.1 CC PDF, the SRD 5.1 OGL PDF, or a captured official landing page.

## Findings at a glance

`[OFFICIAL SOURCE]` The current Wizards/D&D Beyond SRD hub is <https://www.dndbeyond.com/srd>. As of 2026-08-23 it lists **SRD 5.1** for the original 2014 rules and **SRD 5.2.1** as the current English revised-rules SRD. It lists no 5.2.2 or later English revision. The hub says SRD 5.2.1 was published 2025-05-01 and the page was last updated 2026-03-02.

`[OFFICIAL SOURCE]` SRD 5.1 is available under either **Creative Commons Attribution 4.0 International (CC BY 4.0)** or **Open Game License 1.0a (OGL 1.0a)**. SRD 5.2.x is available under **CC BY 4.0 only**. Each exact source/version/license choice must retain its own attribution and provenance.

`[OFFICIAL SOURCE]` The official hub says SRD 5.1 and SRD 5.2 may both be used in a product under their permanent licenses, but compatibility is the implementer's responsibility because rules differ. Permission to use both is not evidence that they form one mechanics ruleset.

`[OFFICIAL SOURCE]` Wizards publishes the open rules corpora as versioned PDFs. No official JSON, CSV, XML, Markdown corpus, bulk schema, or public rules API is listed on the official SRD hub. D&D Beyond Basic Rules pages are convenient official references, but the Creator FAQ says overlapping Basic Rules content is not thereby CC-licensed; the SRD text is the open republication source.

`[INFERENCE]` DungeonMasterOS should treat the official, hashed PDF bytes as authoritative source snapshots and any JSON/API as a separately versioned derived transport. A parser-friendly mirror may accelerate ingestion. It may not establish wording, completeness, license scope, or mechanical correctness.

`[INFERENCE]` Campaigns and canonical entities should identify an exact semantic corpus revision. The CC and OGL PDFs are license-bearing artifact snapshots that may support that corpus; they are not separate gameplay sources merely because their legal pages and pagination differ. Body equivalence must be verified before two artifacts are linked as alternate representations of one semantic corpus.

`[INFERENCE]` Source selection must require an affirmative content-rights state of `verified_open`. `official`, publicly reachable, publisher-authentic, or non-null license metadata do not prove republication rights. `closed` and `unknown` evidence may remain bibliographic or quarantined but cannot supply canonical prose or mechanics.

## Official source and version matrix

| Evidence ID | Official page/document title | Publisher | Generation | Exact version / date | License or rights status | URL | What the source proves |
|---|---|---|---|---|---|---|---|
| `wotc-srd-hub` | SRD v5.2.1 - System Reference Document | Wizards of the Coast / D&D Beyond | both | live page; last updated 2026-03-02 | informational landing page; not itself the rules-content grant | <https://www.dndbeyond.com/srd> | `[OFFICIAL SOURCE]` Canonical downloads, current version, publication dates, license choices, corpus delta summary, localized releases, and FAQ. |
| `wotc-srd-5.1-cc` | System Reference Document 5.1 | Wizards of the Coast | 2014 | SRD 5.1; copyright 2016; CC release announced 2023-01-27 | CC BY 4.0 | <https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf> | `[OFFICIAL SOURCE]` Authoritative open 2014-era rules text and its version-specific CC attribution. |
| `wotc-srd-5.1-ogl` | System Reference Document 5.1 | Wizards of the Coast | 2014 | SRD 5.1; copyright 2016 | OGL 1.0a | <https://media.dndbeyond.com/compendium-images/srd/5.1/SRD-OGL_V5.1.pdf> | `[OFFICIAL SOURCE]` Official 5.1 OGL presentation, including Product Identity/Open Game Content designation and the full OGL. Body equivalence with the CC artifact must be verified before deduplicating canonical content. |
| `wotc-srd-5.1-ogl-legacy-url` | System Reference Document 5.1 | Wizards of the Coast | 2014 | SRD 5.1 | OGL 1.0a | <https://media.wizards.com/2016/downloads/DND/SRD-OGL_V5.1.pdf> | `[OFFICIAL SOURCE]` Older official Wizards-hosted locator for the OGL artifact. |
| `wotc-srd-5.2.0-cc` | System Reference Document 5.2 | Wizards of the Coast | revised 2024 | SRD 5.2.0; published 2025-04-22 | CC BY 4.0 | <https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.pdf> | `[OFFICIAL SOURCE]` Preserved first published revision of the revised open corpus. It is historical, not the current ingestion target. |
| `wotc-srd-5.2.1-cc` | System Reference Document 5.2.1 | Wizards of the Coast | revised 2024 | SRD 5.2.1; published 2025-05-01 | CC BY 4.0 | <https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf> | `[OFFICIAL SOURCE]` Current English revised-rules corpus and its version-specific attribution. |
| `wotc-srd-5.2.1-conversion-guide` | Converting to System Reference Document 5.2.1 | Wizards of the Coast | 2014 → revised | published 2025-05-27 | official evidence; independent republication scope not established here | <https://media.dndbeyond.com/compendium-images/srd/guide/converting-to-srd-5.2.1.pdf> | `[OFFICIAL SOURCE]` Official change taxonomy and section-by-section guidance; authoritative migration evidence, not an exhaustive semantic diff or automatically reusable corpus text. |
| `wotc-community-update` | D&D Community Update | Wizards of the Coast / D&D Beyond | revised | 2025 release notes | informational page | <https://www.dndbeyond.com/community-update> | `[OFFICIAL SOURCE]` Dates and the 5.2.0 → 5.2.1 correction list. |
| `wotc-changelog` | Changelog | Wizards of the Coast / D&D Beyond | both | live; relevant entry dated 2026-03-02 | informational page | <https://www.dndbeyond.com/changelog/> | `[OFFICIAL SOURCE]` Current D&D Beyond clarity labels use 5e for 2014 rules and 5.5e for revised rules without changing the underlying rules. |
| `wotc-cc-announcement` | OGL 1.0a & Creative Commons | Wizards of the Coast / D&D Beyond | 2014 | 2023-01-27 | informational announcement | <https://www.dndbeyond.com/posts/1439-ogl-1-0a-creative-commons> | `[OFFICIAL SOURCE]` Wizards placed the entire SRD 5.1 under CC BY 4.0 and left the OGL option available. |
| `wotc-conversion-release` | You Can Now Publish Your Own Creations Using the SRD 5.2.1 | Wizards of the Coast / D&D Beyond | revised | published 2025-05-27; editor note 2026-03-02 | informational announcement | <https://www.dndbeyond.com/posts/1949-you-can-now-publish-your-own-creations-using-the> | `[OFFICIAL SOURCE]` Purpose/release of SRD 5.2.1 and the official conversion guide. |
| `wotc-creator-faq` | Creator FAQ | Wizards of the Coast / D&D Beyond | both | live | informational rights-boundary guidance | <https://www.dndbeyond.com/creator-faq> | `[OFFICIAL SOURCE]` Open SRD versus Basic Rules/closed-content boundary and creator-use cautions. |
| `cc-by-4.0-legal-code` | Attribution 4.0 International — Legal Code | Creative Commons | both where CC chosen | version 4.0 | CC BY 4.0 | <https://creativecommons.org/licenses/by/4.0/legalcode.en> | `[OFFICIAL SOURCE]` Controlling CC license terms. |
| `cc-by-4.0-deed` | Attribution 4.0 International | Creative Commons | both where CC chosen | version 4.0 | explanatory deed | <https://creativecommons.org/licenses/by/4.0/> | `[OFFICIAL SOURCE]` Human-readable Share/Adapt and attribution/change-indication summary; explicitly not a substitute for legal code. |

## Version and revision history

### SRD 5.1 family

`[OFFICIAL SOURCE]` The SRD 5.1 PDFs identify version 5.1 and copyright 2016. The current official hub continues to offer 5.1 as the open basis for the original 2014 rules.

`[OFFICIAL SOURCE]` Wizards announced the CC BY 4.0 release of the full SRD 5.1 on 2023-01-27. The OGL 1.0a artifact remains separately available; the content did not become “CC only.”

`[OPEN QUESTION]` The live official materials reviewed do not provide a first-party 5.0 → 5.1 line-item changelog or prove a precise original day in 2016. Secondary sources report a date and characterize fixes, but that should not be elevated into authoritative revision metadata without an archived first-party artifact.

### SRD 5.2.x family

`[OFFICIAL SOURCE]` Wizards published SRD 5.2.0 on 2025-04-22 as the open foundation for the revised core rules and stated that it incorporated then-current second-printing errata.

`[OFFICIAL SOURCE]` Wizards published SRD 5.2.1 on 2025-05-01. The Community Update says the point release restored 15 omitted magic items, corrected legal-page spacing/page numbers, replaced a duplicated Iron Golem block with Knight, and added Octopus.

`[OFFICIAL SOURCE]` Wizards published the conversion guide on 2025-05-27. The guide uses `[New Name]`, `[New Rule]`, `[Revised Rule]`, and `[Omitted Rule]` markers and covers terminology, rules sections, content types, capitalization, and revised monster-block presentation.

`[INFERENCE]` The guide's official status proves provenance, not an independent CC republication grant for the guide itself. Treat it as bibliographic/migration evidence and do not ship copied guide prose or tables unless its own rights scope is separately established.

`[OFFICIAL SOURCE]` German, Spanish, French, and Italian SRD 5.2.1 PDFs were published 2025-12-08. They are official localized artifacts, not implicit aliases of the English snapshot.

`[INFERENCE]` A future 5.2.2 must create a new source snapshot, revision, diff, and verification run. It must not overwrite the 5.2.1 bytes or silently update campaigns pinned to 5.2.1.

## License and open-content boundary

### SRD 5.1

`[OFFICIAL SOURCE]` The official hub permits use of the entire SRD 5.1 under either OGL 1.0a or CC BY 4.0. The CC PDF contains a version-specific attribution statement. The OGL PDF contains the complete license and the document's Product Identity/Open Game Content designation.

`[INFERENCE]` Prefer the CC artifact for a new DungeonMasterOS canonical 2014 corpus unless a separately reviewed requirement calls for OGL provenance. Store the chosen license per source snapshot and preserve the exact source-provided attribution. Do not collapse OGL and CC into a generic `open` flag; obligations and attribution chains differ.

### SRD 5.2.x

`[OFFICIAL SOURCE]` The official hub states that new SRDs, including 5.2.x, are released exclusively under CC BY 4.0. The 5.2.1 PDF supplies its own attribution statement and permitted compatibility wording.

`[INFERENCE]` Store the exact 5.2.1 attribution separately from the 5.1 attribution and record any DungeonMasterOS normalization/modification. A compatibility phrase is not a blanket trademark license.

### Rights gate and license-obligation evidence

`[INFERENCE]` Rights status is a reviewed property of a specific content scope, not a synonym for source role:

```ts
type ContentRightsStatus = "verified_open" | "closed" | "unknown";

interface LicenseObligationEvidence {
  id: string;
  rightsStatus: ContentRightsStatus;
  scopeLocatorIds: readonly string[];
  licenseId: "CC-BY-4.0" | "OGL-1.0a" | string | null;
  legalInstrumentSnapshotId: string | null;
  legalInstrumentSha256: string | null;
  ccAttribution: {
    creator: string;
    title: string;
    sourceUrl: string;
    licenseUrl: string;
    sourceProvidedAttributionText: string;
    modificationNotice: string | null;
  } | null;
  oglCompliance: {
    fullLicenseSnapshotId: string;
    section15CopyrightNotices: readonly string[];
    productIdentityDesignation: string;
    openGameContentDesignation: string;
  } | null;
  reviewedBy: string;
  reviewedAt: string;
}
```

`[INFERENCE]` CC BY and OGL obligations must not be flattened into one generic `attributionText`. The CC route needs the source-provided attribution, license link, retained notices, and change indication. The OGL route needs the complete license plus the applicable Section 15 notice and the artifact's Product Identity/Open Game Content designations. Preserve the exact legal text/evidence bytes and their hashes used for the review.

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
| `5e-bits/5e-database` | Immutable tree <https://github.com/5e-bits/5e-database/tree/bfd3db4bcc31699cce703b46feb9af3f0ff08999>; commit-permalinked README <https://github.com/5e-bits/5e-database/blob/bfd3db4bcc31699cce703b46feb9af3f0ff08999/README.md>; `main` resolved to Git object `bfd3db4bcc31699cce703b46feb9af3f0ff08999` | `[DERIVED SOURCE]` That pinned repository revision contains separate `src/2014` and `src/2024` trees and JSON used by DungeonMasterOS's current item importer. | The pinned README describes software as MIT and underlying material as OGL 1.0a, language that does not adequately establish provenance for the newer CC-only corpus. Never use `@main`; snapshot and hash every consumed file, retain its exact path, and reconcile every accepted record to the correct official PDF/page/license. The Git object ID pins upstream state but is not a substitute for a SHA-256 of fetched bytes. |
| `5e-bits/5e-srd-api` | Immutable tree <https://github.com/5e-bits/5e-srd-api/tree/da140e3e5efce908cbd03c30e26125230b9aa53e>; commit-permalinked README <https://github.com/5e-bits/5e-srd-api/blob/da140e3e5efce908cbd03c30e26125230b9aa53e/README.md>; `main` resolved to Git object `da140e3e5efce908cbd03c30e26125230b9aa53e` | `[DERIVED SOURCE]` JSON REST API and schema tooling for the related database at that pinned revision. | The pinned README says only `/api/2014` is currently available and `/api/2024` is future work. It is not a current 5.2.1 authority or complete revised transport. Snapshot/hash any API response used as evidence. |
| Open5e API v2 | API docs <https://open5e.com/api-docs>; immutable source tree <https://github.com/open5e/open5e-api/tree/4b314adb19b52ae6caf705f6620311d90ed10a74>; commit-permalinked README <https://github.com/open5e/open5e-api/blob/4b314adb19b52ae6caf705f6620311d90ed10a74/README.md>; `main` resolved to Git object `4b314adb19b52ae6caf705f6620311d90ed10a74` | `[DERIVED SOURCE]` JSON API with source-document metadata including distinct 2014/2024 document keys; useful cross-check and extraction accelerator. | Includes multiple open publishers and mutable corrections. Filter exact document keys, snapshot responses, preserve per-record publisher/content-license evidence, and verify each accepted record against official pages. API availability does not prove Wizards provenance. |
| Volunteer 5.2 parsers/sites | examples exist, including sites that label their own conversion incomplete | `[DERIVED SOURCE]` Potential parser test cases. | Not suitable as canonical input without complete source mapping, license proof, immutable revision, and page-level reconciliation. |

`[REPOSITORY FACT]` Current DungeonMasterOS jsDelivr URLs refer to `5e-bits/5e-database@main`. That is mutable and therefore cannot reproduce a historical import reliably.

`[INFERENCE]` Derived datasets should be optional comparison inputs. The acceptance gate is a canonical record verified against the official source snapshot, not agreement between two mirrors that may share the same upstream typo.

`[DERIVED SOURCE]` Investigator-computed hashes for claim-bearing files fetched from those exact Git commits on 2026-08-23 are below. These hashes pin the inspected bytes, not the repositories' complete datasets and not the truth of their content-license claims.

| Commit-pinned evidence file | Bytes | SHA-256 |
|---|---:|---|
| `5e-bits/5e-database@bfd3db4.../README.md` | 3,483 | `1d8bc317e534886f01b921b3ef18e02562888315b3229d96006bc6350d5b49ff` |
| [`5e-bits/5e-database@bfd3db4.../LICENSE.md`](https://github.com/5e-bits/5e-database/blob/bfd3db4bcc31699cce703b46feb9af3f0ff08999/LICENSE.md) | 1,096 | `86271294069a91d9f43d9e902d9710719998fe8dd040d607737c85617617baa9` |
| `5e-bits/5e-srd-api@da140e3.../README.md` | 6,620 | `e09257d27f0149218a70e972e7fd56b1af7b476bbb5e5a04ab677c04b601bfde` |
| `open5e/open5e-api@4b314ad.../README.md` | 6,795 | `7e2ac6817d93b34354eac6be3d93f7134785e13c73f257d68ef165fe9859dfb0` |

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
immutable Wizards hub/version-announcement web snapshot + SHA-256
  -> exact semantic corpus revision selected
  -> exact versioned official PDF artifact snapshot + SHA-256
  -> reviewed content-rights/license-obligation evidence
  -> source-page manifest and extraction evidence tied to the artifact hash
  -> extractor version + normalization report
  -> canonical generation-qualified entity + physical/printed page and span anchors
  -> independent verification and append-only revision

Optional parallel evidence:
pinned community JSON/API commit
  -> immutable derived snapshot + its own license/provenance
  -> many-to-many record/segment lineage + comparison report
  -> never promoted to authoritative original source
```

`[INFERENCE]` Minimum semantic-corpus and original-artifact metadata:

```ts
interface SemanticCorpusRevision {
  id: string;
  mechanicalRulesetId: "dnd5e2014" | "dnd5e2024";
  srdVersion: "5.1" | "5.2.0" | "5.2.1";
  rightsStatus: ContentRightsStatus;
  supportingArtifactBindingIds: readonly string[];
  normalizedRulesBodyHash: string;
  revisesCorpusRevisionId: string | null;
}

interface SourceArtifactSnapshot {
  id: string;
  sourceRole: "authoritative_original" | "derived_transport" | "bibliographic_evidence";
  publisher: string;
  rightsStatus: ContentRightsStatus;
  licenseObligationEvidenceIds: readonly string[];
  sourceUrl: string;
  landingPageEvidenceSnapshotIds: readonly string[];
  acquiredAt: string;
  byteLength: number;
  sha256: string;
  httpEtag: string | null;
  httpLastModified: string | null;
  revisesArtifactSnapshotId: string | null;
}

interface WebEvidenceSnapshot {
  id: string;
  evidenceId: string;
  pageTitle: string;
  publisher: string;
  requestedUrl: string;
  finalUrl: string;
  acquiredAt: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  httpEtag: string | null;
  httpLastModified: string | null;
  relevantSectionLocator: string;
  revisesWebEvidenceSnapshotId: string | null;
}
```

`[INFERENCE]` Capture the hub, Community Update, Creator FAQ, changelog, CC legal code, and other claim-bearing live pages as immutable web evidence. The PDF bytes prove rules text; those web snapshots prove current-version status, publication/update dates, correction history, terminology, and rights-boundary guidance. A later page edit creates a new evidence snapshot and `revises` link rather than rewriting history.

`[INFERENCE]` Minimum derived-transport metadata:

```ts
interface DerivedLineageEdge {
  derivedRecordOrSegmentLocator: string;
  semanticCorpusRevisionId: string;
  sourceArtifactSnapshotId: string;
  officialSourceLocatorIds: readonly string[];
  contentLicenseEvidenceId: string;
  reconciliationStatus: "unverified" | "sampled" | "record_reconciled";
}

interface DerivedTransportSnapshot {
  transportSourceId: string;
  sourceArtifactSnapshotId: string;
  repositoryUrl: string;
  immutableCommit: string;
  pathOrEndpoint: string;
  acquiredAt: string;
  byteLength: number;
  sha256: string;
  softwareLicenseEvidenceId: string | null;
  lineage: readonly DerivedLineageEdge[];
  artifactIntegrityStatus: "unverified" | "hash_verified";
  upstreamRevisionStatus: "unverified" | "commit_verified";
  rightsStatus: ContentRightsStatus;
  recordReconciliationStatus: "unverified" | "sampled" | "record_reconciled";
  corpusCoverageStatus: "unknown" | "partial" | "complete";
}
```

`[INFERENCE]` Derived lineage is many-to-many because one transport may aggregate multiple publishers, documents, licenses, and SRD generations. Every accepted record or segment needs its own official-source and license edge. A derived record with a perfect checksum but no verified official page anchor is reproducibly unverified, which is at least honest but still not canonical. Artifact integrity, upstream revision, rights review, record reconciliation, and corpus coverage are independent verification axes; none may stand in for the others.

## Source-manifest strategy

`[INFERENCE]` Maintain one semantic manifest for each exact corpus revision, with every locator bound to an exact artifact snapshot:

- `dnd5e2014` / semantic SRD 5.1, initially proven from the CC artifact;
- the SRD 5.1 OGL PDF as an alternate license-bearing artifact only after normalized rules-body equivalence is reviewed, never as duplicate mechanics;
- `dnd5e2024` / semantic SRD 5.2.1, proven from its CC artifact;
- semantic SRD 5.2.0 plus its artifact as a preserved historical revision, not an enabled current corpus;
- the conversion guide as a separate bibliographic/migration evidence set, not canonical gameplay content and not presumed CC-reusable.

`[INFERENCE]` Each manifest entry should record source artifact SHA-256; zero-based physical PDF page index; printed page label; section path; exact evidence span or bounding locator; extracted-span SHA-256; expected entity family; extraction state; the independent verification axes above; canonical-link count; and explicit disposition (`canonical`, `reference_only`, `legal`, `index`, `out_of_scope`, or `manual_review`). Physical pages and printed labels must both be retained because legal wrappers and localized artifacts can shift one without the other. Page processing and canonical automation status must remain independent.

`[INFERENCE]` SRD 5.1 needs a generated, reviewer-approved page/section index because the publisher did not supply a TOC. SRD 5.2.1 can seed section boundaries from its official TOC, but entity counts still require page-anchored extraction and duplicate detection.

`[INFERENCE]` Completeness gates must compare every in-scope manifest entry to an explicit disposition and every canonical entity to at least one verified source anchor. A row-count threshold is not corpus evidence. It is numerology wearing a database badge.

## Current and future source drift policy

`[INFERENCE]`

1. Poll and immutably snapshot the official hub for a newly named version, never for an implicit “latest” body replacement.
2. Re-fetch known URLs only into a candidate snapshot and compare SHA-256/HTTP metadata.
3. If bytes at an existing versioned URL drift, quarantine the candidate, retain both byte sets, and require review.
4. If a new SRD version appears, register new semantic-corpus and artifact revisions with explicit `revises` links and create a source/canonical diff.
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

- `semantic-srd-5-1`
- `semantic-srd-5-2-0`
- `semantic-srd-5-2-1`
- `wotc-srd-5-1-cc-by-4-0`
- `wotc-srd-5-1-ogl-1-0a`
- `wotc-srd-5-2-0-cc-by-4-0`
- `wotc-srd-5-2-1-cc-by-4-0`
- `wotc-srd-5-2-1-conversion-guide`
- `transport-5e-bits-5e-database-bfd3db4`

The `semantic-*` IDs identify rules corpora; the `wotc-*` IDs identify artifact/evidence sources. The full immutable commit belongs in the transport snapshot, even when a readable short suffix appears in a transport source ID.

## Research conclusions and open questions

`[INFERENCE]` Implement 2014/SRD 5.1 first, then revised/SRD 5.2.1. That order aligns the historical compatibility target with a stable official corpus while preserving the revised corpus as an independent sibling. It does not authorize treating legacy `dnd5e` state as verified SRD 5.1 without a migration audit.

- `[OPEN QUESTION]` Recover a first-party archived SRD 5.0 → 5.1 release/delta artifact if exact early revision history matters.
- `[OPEN QUESTION]` Generate authoritative entity counts from page-anchored extraction. Community projects disagree, and the official hub's “15 feats added” is a delta rather than necessarily the total.
- `[OPEN QUESTION]` Determine whether Claude's landed Phase 2A already supplies an artifact-byte store with equivalent hash, retention, reference, and backup semantics. If it does not, the companion design/plan uses a content-addressed SQLite BLOB fallback; either route still requires a production backup-and-restore rehearsal before publication is enabled.
- `[OPEN QUESTION]` Perform a normalized rules-body equivalence review before linking the OGL and CC 5.1 PDFs as alternate artifacts for one semantic corpus. Campaign enablement selects the semantic corpus either way; it never enables both legal wrappers as duplicate mechanics.
- `[OPEN QUESTION]` Validate each localized PDF independently before offering localized canonical text; do not assume byte or record equivalence.
- `[OPEN QUESTION]` Monitor the official hub for future point releases. The “current” conclusion is verified only as of 2026-08-23.

## Non-ingestion confirmation

`[EXECUTION ATTESTATION]` This research created documentation only. No SRD content was ingested into DungeonMasterOS, no source was registered, no schema or application code changed, and no closed rulebook content was copied into the repository.
