# Phase 2B — Canonical Entity Extraction (Design)

**Scope of this document, stated honestly up front:** the full request behind this design ("finish the D&D 3.5e ruleset to production quality" — every entity family, every mechanic, sheet/AI projections, full contamination-test suite) is a multi-week engineering effort, not something one implementation pass converges on. This document scopes **Phase 2B-1**: the canonical entity *architecture* (reusable across every future entity family) plus one complete, production-quality vertical slice through it — **Feats** — extracted deterministically from the real Phase 2A corpus, through to a real, server-side, player-facing mechanic (feat prerequisite/entitlement checking). Every later entity family (conditions, skills, races, classes, spells, monsters, equipment, combat maneuvers, psionics, epic rules...) reuses this same architecture and follows in subsequent implementation passes — this document does not re-litigate that scope, it delivers the first real slice through it end to end.

## Why Feats first

- Bounded and countable: the real d20srd.org `/srd/feats.htm` page (already in Phase 2A's manifest, `sourcePageKey` known) contains ~130 real feats in one page, each with a real, regular structure (`<h3 id="slug">Name [Type]</h3>` followed by `<h5>` subsections: Prerequisites, Benefit, Normal, Special, Special (multiple)).
- Directly exercises the hardest real design problem this phase must solve: turning natural-language prerequisite prose into structured, evaluable data, with an honest "unresolved" bucket for what can't be parsed deterministically — the exact discipline ("failures must fail honestly, do not silently fabricate") the whole plan demands.
- Immediately useful: feat selection is a real, permanent player choice (`Player Agency` requirement) that needs real prerequisite validation today.

## Architecture (reusing Phase 0/1's dormant infrastructure for the first time)

```
srd_manifest_entries (Phase 2A, source_verified page)
        ↓ re-fetch, verify contentHash matches (fail loud on drift)
deterministic HTML parser (server/dnd35e/extraction/feats-extractor.ts)
        ↓
candidate FeatDefinition record(s), each with a resolution status
        ↓ schema validation (structural: canonical ID valid, feat type known, etc.)
        ↓ cross-source reconciliation (n/a for a single-source page today; the hook exists for
          future multi-source entity families)
canonical_feat_definitions row (server/storage.ts, new table)
        ↓ recordRevision() — Phase 0/1's existing, previously-unused generic revision table
canonical_revisions row (audit trail, already built, never populated until now)
```

- **Canonical ID**: `buildCanonicalId("dnd35e", "feat", slug)` → `dnd35e:feat:power-attack` — reuses `shared/rules-registry/canonical-id.ts` verbatim, no new ID scheme. The `slug` is derived from the feat's real `id` attribute on d20srd.org (already a stable, human-authored slug: `powerAttack`, `acrobatic`, etc.) — kebab-cased for consistency with the rest of the canonical-ID convention (`power-attack`).
- **Provenance**: every canonical entity's `CanonicalProvenance` (`shared/rules-registry/provenance.ts`, also previously unused) carries `sourceReferences: SourceReference[]` — for Feats today, one reference: `{sourceId: <dnd35e-srd-hypertext-d20's real id>, page: sourcePageKey}`. `ingestionStatus` starts at `"extracted"` (a deterministic parser produced it) and only reaches `"verified"` via the same page-level discipline Phase 2A established — a human or a second independent pass confirms it, never the extractor's own say-so.
- **Revisions**: `recordRevision({canonicalId, entityType: "feat", revision, changeReason, diffSummary})` on every re-extraction that changes the stored record — mirrors `srd_source_page_revisions`' semantics from Phase 2A (append-only, never mutate/delete a prior row) but for canonical entities, using the table Phase 0/1 already built for exactly this.
- **Not one entity per page, not one page per entity**: the extractor produces *N* candidate feats from *one* page (`feats.htm`). The reverse case (one entity needing multiple source locations — e.g. a feat later expanded by errata in a different sourcebook) is supported by `sourceReferences` being an array from day one, even though Feats' first pass only ever populates one entry.

## Evidence / rights classification (new, additive — extends, does not rename, Phase 0/1's existing enums)

Phase 0/1's `ProvenanceClassification`/`LicenseClassification` (on `rule_sources`) describe the **document/transport** ("is this book WotC-official, and can we redistribute it"). This phase adds an orthogonal, per-fact axis: **what kind of evidence backs one specific extracted mechanic**, because a single canonical entity can legitimately be corroborated by a mix of open SRD text, a page in a licensed local PDF, and a public reference site, and each of those carries a different answer to "can we quote this."

New file `shared/rules-registry/evidence.ts`:

```ts
export type EvidenceSourceKind =
  | "open_canonical"              // an existing srd_manifest_entries page (Phase 2A) — free to
                                   // structurally represent and, if ever needed, quote verbatim
                                   // (SRD/OGL content is genuinely open), though this pipeline still
                                   // prefers structured mechanics over verbatim prose everywhere.
  | "licensed_local_reference"    // the user's own Google Drive PDF library — private reference only.
                                   // Never quote verbatim; cite by title + page/chapter only.
  | "licensed_digital_reference"  // reserved for a licensed digital tool/reader distinct from a local
                                   // file, if one is ever connected. Same restriction as above.
  | "official_public_reference"   // official WotC content published publicly outside the SRD/OGL
                                   // (e.g. a free web article) — cite by URL + access date, never
                                   // bulk-quote.
  | "external_read_only_reference"// a public, non-owned reference page used read-only (never behind
                                   // a login/paywall) to cross-check a mechanic. Cite by URL + access
                                   // date, never bulk-quote.
  | "third_party_reference"       // published third-party (non-WotC, non-homebrew) material.
  | "homebrew"                    // user-authored house rule content — never conflated with
                                   // official mechanics.
  | "requires_rights_review";     // explicit "we have not classified this evidence yet" — a real,
                                   // blocking state, never silently defaulted to.

export interface EvidenceCitation {
  kind: EvidenceSourceKind;
  // For open_canonical: the real srd_manifest_entries.sourcePageKey.
  sourcePageKey?: string;
  // For licensed/official/external/third-party: a human-readable citation — title + page/chapter
  // for a book, URL + accessedAt for a web reference. Never the source's own body text.
  citation?: string;
  accessedAt?: string;
  notes?: string;
}
```

`CanonicalProvenance.sourceReferences` (Phase 0/1, already generic) gains no new required field — `EvidenceCitation` is Phase 2B's own richer shape, attached alongside a `SourceReference` when the evidence isn't a `srd_manifest_entries` page. Distinguishing **"we verified this mechanic"** (any evidence kind, including licensed local reference) from **"we can redistribute this exact source content"** (only `open_canonical`, and even then only as a last resort — structured mechanics remain the default representation everywhere) is enforced by construction: nothing in this pipeline ever writes source *body text* into a canonical entity row, regardless of `EvidenceSourceKind` — only structured fields and short citations.

## Feat schema

New file `shared/rules-registry/dnd35e/feats.ts` (ruleset-specific — 3.5 mechanics stay out of shared/rules-registry's edition-neutral files, per the shared-infrastructure discipline):

```ts
export type Dnd35eFeatType = "general" | "fighter" | "item-creation" | "metamagic" | "special";

export type Dnd35eFeatPrerequisite =
  | { kind: "all"; requirements: Dnd35eFeatPrerequisite[] }
  | { kind: "any"; requirements: Dnd35eFeatPrerequisite[] }
  | { kind: "ability"; ability: "str" | "dex" | "con" | "int" | "wis" | "cha"; minimum: number }
  | { kind: "bab"; minimum: number }
  | { kind: "skill_ranks"; skillCanonicalId: string; ranks: number }
  | { kind: "feat"; featCanonicalId: string }
  | { kind: "class_level"; classCanonicalId: string; minimum: number }
  | { kind: "character_level"; minimum: number }
  | { kind: "caster_level"; minimum: number }
  | { kind: "special"; description: string }; // a real prerequisite that could not be
                                                // deterministically structured — see "Honest
                                                // extraction gaps" below. NEVER silently dropped.

export interface Dnd35eFeatDefinition {
  canonicalId: string;              // dnd35e:feat:<slug>
  name: string;                     // real display name, e.g. "Acrobatic"
  featType: Dnd35eFeatType;
  prerequisites: Dnd35eFeatPrerequisite | null; // null = genuinely no prerequisites
  benefitSummary: string;           // short, original (not copied verbatim), structured-oriented
                                     // description used for display; NOT the mechanic itself
  mechanicalEffects: Dnd35eFeatEffect[]; // structured, evaluable effects — see below
  extractionStatus: "fully_structured" | "partially_structured" | "unresolved";
  extractionNotes: string[];        // honest record of what couldn't be parsed and why
}

export type Dnd35eFeatEffect =
  | { kind: "skill_check_bonus"; skillCanonicalIds: string[]; bonus: number; bonusType: "competence" | "untyped" }
  | { kind: "unresolved"; rawBenefitText: string; reason: string }; // extractionStatus reflects this
```

`extractionStatus`/`extractionNotes`/the `unresolved` effect variant are not an afterthought — they are the mechanism satisfying "support... parser failures... ambiguous extraction... unresolved records" and "failures must fail honestly." A feat whose Benefit prose doesn't match a known structured pattern is stored with its real name, type, and (where parseable) real prerequisites, `extractionStatus: "unresolved"` or `"partially_structured"`, and an honest note — never a fabricated effect.

## Deterministic extractor scope for this pass

`server/dnd35e/extraction/feats-extractor.ts` — pure function `extractFeatsFromHtml(html: string): Dnd35eFeatDefinition[]`, no network/DB access, fully unit-testable against a real captured fixture (the actual `feats.htm` content fetched during this design's research).

- **Identity + type**: parsed from every real `<h3 id="...">Name [Type]</h3>` — deterministic, 100% coverage expected.
- **Prerequisites**: pattern-matched against the real, recurring prose forms found in the live page (`"X, Y."` = an `all` of feat-anchor-referenced prerequisites; `"Base attack bonus +N"`; `"Str/Dex/Con/Int/Wis/Cha N"`; `"N ranks in <skill>"`; class-level phrasings). Anything not matching a known pattern becomes `{kind: "special", description: <real prose>}` — structured as *data*, never dropped, never guessed.
- **Mechanical effects**: this pass structures exactly one real, extremely common family — `"You get a +N bonus on all <Skill> checks and <Skill> checks."` (covers a real, large fraction of the General feats, confirmed against the live page: Acrobatic, Agile, Alertness, Animal Affinity, and more share this exact template). Every other Benefit text becomes `{kind: "unresolved", rawBenefitText: <real text>, reason: "no matching structured-effect pattern"}` and the feat's `extractionStatus` reflects it. This is a deliberately honest, bounded first pass — later passes add more effect patterns (numeric AC/save/attack bonuses, granted special abilities, metamagic rules, etc.) without needing to revisit this task's architecture.

## What this slice does NOT do (explicitly out of scope for Phase 2B-1)

- Any other entity family (races, classes, spells, monsters, conditions, skills-as-their-own-entities, equipment, combat maneuvers, psionics, epic rules, prestige classes) — architecture is reusable, extraction work is not done here.
- Full structured coverage of every feat's Benefit text — honestly reported as `unresolved`/`partially_structured` where a pattern doesn't exist yet.
- Sheet/AI projection wiring, WebSocket/route integration, character-creation UI — this slice proves the extraction → canonical entity → mechanic chain with a real storage-layer function and its tests; wiring it into the live character-creation flow is follow-on work.
- Licensed Google Drive book consultation — the real library was inventoried (confirmed present and real, 3.5e material included) but this slice's evidence is 100% `open_canonical` (the SRD is authoritative and sufficient for core General/Fighter feat mechanics); licensed-book cross-referencing is valuable for feats absent from the SRD (e.g. Complete Warrior feats) and is explicitly follow-on work once the open-SRD slice is proven.
- Cross-ruleset conversion — untouched, per the standing parked-project instruction.

## Testing plan (TDD, matching this whole project's established discipline)

- `server/dnd35e/extraction/feats-extractor.test.ts`: real fixture (the actual captured `feats.htm` content) — asserts real counts, spot-checks specific real feats' full structured output (Acrobatic's skill-bonus effect, Armor Proficiency (Heavy)'s feat-reference prerequisite), and asserts the unresolved bucket is non-empty and honestly reasoned for feats whose Benefit doesn't match the one structured pattern this pass covers.
- `server/storage.ts` additions (create/get/list canonical feat definitions, wired through `recordRevision`): real SQLite round-trip tests, including a revision-on-change test mirroring Phase 2A's `srd_source_page_revisions` discipline.
- A real, honest extraction-coverage report (mirroring Phase 2A's acceptance-report discipline): run the extractor against the real, currently-committed `feats.htm` fixture and report real counts — total feats found, fully-structured count, partially-structured count, unresolved count — committed as a doc, not asserted as 100% coverage.
- A real mechanic test: `evaluateFeatPrerequisites(prerequisite, characterState): {qualified, failureReasons}` — pure function, unit-tested against constructed character states, proving the "server determines legal selections" requirement is real and callable, not just data sitting inert in a table.
- No-contamination check: confirm nothing in this new code path references any 5e concept (proficiency bonus, advantage/disadvantage, 5e six-save names) — a real grep-based test, matching the plan's contamination-testing requirement, scoped honestly to what this slice actually touches (feat prerequisite evaluation) rather than asserting blanket coverage of mechanics not yet built.

## Self-review

- **Placeholder scan**: no TBD/TODO in the schema or extractor scope — every field has a real, complete type; the `unresolved` states are a deliberate design feature, not a placeholder.
- **Reuse discipline**: canonical-id.ts, provenance.ts, revisions.ts are consumed, not re-implemented. No second canonical-ID system.
- **Shared-infrastructure discipline**: `Dnd35eFeatPrerequisite`/`Dnd35eFeatEffect` live in a `dnd35e`-specific file, never in a file another ruleset's worker would touch.
- **Honesty discipline**: extraction failures are structured data (`extractionStatus`, `extractionNotes`, `unresolved` effect kind), never silent gaps or fabricated mechanics.
