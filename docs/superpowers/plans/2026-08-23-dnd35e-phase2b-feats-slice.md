# Phase 2B-1 — Feats Canonical Entity Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable canonical-entity extraction architecture (evidence/rights classification, reuse of Phase 0/1's canonical-id/provenance/revisions infra) and prove it completely, end to end, for one real entity family — Feats — extracted deterministically from the real Phase 2A d20srd.org corpus, through to a real, server-side, player-facing prerequisite-checking mechanic.

**Architecture:** See `docs/superpowers/specs/2026-08-23-dnd35e-phase2b-canonical-entities-design.md` for the full design and rationale. This plan implements exactly that design.

**Tech Stack:** Drizzle ORM (SQLite), the existing `runMigrations()` mechanism, `node --import tsx --test`, pure deterministic parsing (no AI, no network at extraction time beyond the one real content-hash-verification re-fetch in Task 5).

## Global Constraints

- Canonical IDs use `buildCanonicalId("dnd35e", "feat", slug)` from the existing `shared/rules-registry/canonical-id.ts` — no second ID scheme.
- Provenance uses the existing `shared/rules-registry/provenance.ts` shapes (`CanonicalProvenance`, `SourceReference`, `IngestionStatus`, `VerificationMetadata`) — extended via the new `EvidenceCitation` type (Task 1), never replaced.
- Revisions use the existing `shared/rules-registry/revisions.ts` (`recordRevision`/`canonical_revisions`) — the SAME table Phase 0/1 built, now populated for the first time.
- 3.5-specific types (`Dnd35eFeatType`, `Dnd35eFeatPrerequisite`, `Dnd35eFeatEffect`, `Dnd35eFeatDefinition`) live under `shared/rules-registry/dnd35e/` and `server/dnd35e/` — never in a shared/edition-neutral file another ruleset's implementation would touch.
- Extraction is deterministic and network-free in its own unit tests (a real captured HTML fixture, no live fetch). The one real network touch (Task 5's content-hash verification against the live page) is explicit, isolated, and not part of the automated test suite — matching Phase 2A's established discipline for real-network steps.
- Parser failures are honest, structured data (`extractionStatus: "unresolved"`/`"partially_structured"`, `extractionNotes`, `{kind: "unresolved", ...}` effects) — never a silently dropped or fabricated mechanic.
- No 5e concepts (proficiency bonus, advantage/disadvantage, 5e six-save names, Weapon Mastery, Heroic Inspiration) appear anywhere in this new code.
- Every task: files affected, expected behavior, tests, and independent verification before the next task begins.

---

### Task 1: Evidence/rights classification type

**Files:**
- Create: `shared/rules-registry/evidence.ts`
- Create: `shared/rules-registry/evidence.test.ts`

**Interfaces:**
- Produces: `EvidenceSourceKind` (the 8-value union from the design doc), `EvidenceCitation` interface.

**Expected behavior:** Pure type definitions plus one small helper, `requiresRightsReview(kind: EvidenceSourceKind): boolean` (`true` only for `"requires_rights_review"`), used later wherever evidence is attached to a canonical entity to force an explicit block rather than a silent pass-through.

**Migration risk:** None — no table, no DB.

**Rollback consideration:** None; unused by anything until Task 4.

- [ ] **Step 1: Write the failing test**

```ts
// shared/rules-registry/evidence.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { requiresRightsReview } from "./evidence";
import type { EvidenceSourceKind } from "./evidence";

const ALL_KINDS: EvidenceSourceKind[] = [
  "open_canonical", "licensed_local_reference", "licensed_digital_reference",
  "official_public_reference", "external_read_only_reference", "third_party_reference",
  "homebrew", "requires_rights_review",
];

test("requiresRightsReview is true only for requires_rights_review", () => {
  for (const kind of ALL_KINDS) {
    assert.equal(requiresRightsReview(kind), kind === "requires_rights_review", `mismatch for ${kind}`);
  }
});

test("all 8 evidence kinds are distinct strings (no accidental alias collision)", () => {
  assert.equal(new Set(ALL_KINDS).size, 8);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test shared/rules-registry/evidence.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `shared/rules-registry/evidence.ts`**

```ts
// shared/rules-registry/evidence.ts
//
// Orthogonal to rule_sources' ProvenanceClassification/LicenseClassification
// (which describe a whole document/transport). This describes what kind of
// evidence backs one specific extracted canonical fact — a single entity can
// be corroborated by a mix of open SRD text, a licensed local book, and a
// public reference, each with a different answer to "can we quote this."
// Never conflate "we verified this mechanic" (any kind here) with "we can
// redistribute this exact source content" (only open_canonical, and even
// then this pipeline prefers structured mechanics over verbatim prose).

export type EvidenceSourceKind =
  | "open_canonical"
  | "licensed_local_reference"
  | "licensed_digital_reference"
  | "official_public_reference"
  | "external_read_only_reference"
  | "third_party_reference"
  | "homebrew"
  | "requires_rights_review";

export interface EvidenceCitation {
  kind: EvidenceSourceKind;
  sourcePageKey?: string;
  citation?: string;
  accessedAt?: string;
  notes?: string;
}

export function requiresRightsReview(kind: EvidenceSourceKind): boolean {
  return kind === "requires_rights_review";
}
```

- [ ] **Step 4: Run tests, full suite, typecheck**

Run: `node --import tsx --test shared/rules-registry/evidence.test.ts` — expect 2/2.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions against the 392-test baseline.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add shared/rules-registry/evidence.ts shared/rules-registry/evidence.test.ts
git commit -m "feat: add evidence/rights classification, additive to Phase 0/1's provenance model"
```

**Independent verification before Task 2 begins:** re-run tests fresh; confirm `evidence.ts` imports nothing from `provenance.ts`/`sources.ts` (a pure additive type, no coupling that could create a circular import later).

---

### Task 2: Feat schema types

**Files:**
- Create: `shared/rules-registry/dnd35e/feats.ts`
- Create: `shared/rules-registry/dnd35e/feats.test.ts`

**Interfaces:**
- Consumes: nothing new (pure types).
- Produces: `Dnd35eFeatType`, `Dnd35eFeatPrerequisite`, `Dnd35eFeatEffect`, `Dnd35eFeatDefinition` (exact shapes from the design doc).

**Expected behavior:** Pure type definitions plus `describeFeatPrerequisite(prereq: Dnd35eFeatPrerequisite | null): string` — a small, real, deterministic pretty-printer (e.g. `{kind: "bab", minimum: 6}` → `"Base attack bonus +6"`) used both for display and as a test oracle proving the structured data round-trips to a real, correct human-readable requirement.

**Migration risk:** None.

**Rollback consideration:** None; unused by anything until Task 3.

- [ ] **Step 1: Write the failing test**

```ts
// shared/rules-registry/dnd35e/feats.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeFeatPrerequisite } from "./feats";
import type { Dnd35eFeatPrerequisite } from "./feats";

test("describeFeatPrerequisite: null means no prerequisites", () => {
  assert.equal(describeFeatPrerequisite(null), "None");
});

test("describeFeatPrerequisite: ability", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "ability", ability: "str", minimum: 13 };
  assert.equal(describeFeatPrerequisite(p), "Str 13");
});

test("describeFeatPrerequisite: bab", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "bab", minimum: 6 };
  assert.equal(describeFeatPrerequisite(p), "Base attack bonus +6");
});

test("describeFeatPrerequisite: skill_ranks", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "skill_ranks", skillCanonicalId: "dnd35e:skill:tumble", ranks: 5 };
  assert.equal(describeFeatPrerequisite(p), "5 ranks in dnd35e:skill:tumble");
});

test("describeFeatPrerequisite: feat", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "feat", featCanonicalId: "dnd35e:feat:dodge" };
  assert.equal(describeFeatPrerequisite(p), "dnd35e:feat:dodge");
});

test("describeFeatPrerequisite: all joins with commas", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "all",
    requirements: [
      { kind: "feat", featCanonicalId: "dnd35e:feat:dodge" },
      { kind: "bab", minimum: 6 },
    ],
  };
  assert.equal(describeFeatPrerequisite(p), "dnd35e:feat:dodge, Base attack bonus +6");
});

test("describeFeatPrerequisite: any joins with 'or'", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "any",
    requirements: [
      { kind: "ability", ability: "str", minimum: 13 },
      { kind: "ability", ability: "dex", minimum: 13 },
    ],
  };
  assert.equal(describeFeatPrerequisite(p), "Str 13 or Dex 13");
});

test("describeFeatPrerequisite: special returns its own real description verbatim", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "special", description: "Wild shape class feature" };
  assert.equal(describeFeatPrerequisite(p), "Wild shape class feature");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test shared/rules-registry/dnd35e/feats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `shared/rules-registry/dnd35e/feats.ts`**

```ts
// shared/rules-registry/dnd35e/feats.ts
//
// D&D 3.5e-specific feat schema. Deliberately NOT in a shared/edition-neutral
// file — BAB, ability-score prerequisites, and 3.5's specific feat-type
// vocabulary are 3.5 concepts, not universal rules-engine concepts. A
// parallel 5e implementation has its own, unrelated feat/feature model.

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
  | { kind: "special"; description: string };

export type Dnd35eFeatEffect =
  | { kind: "skill_check_bonus"; skillCanonicalIds: string[]; bonus: number; bonusType: "competence" | "untyped" }
  | { kind: "unresolved"; rawBenefitText: string; reason: string };

export interface Dnd35eFeatDefinition {
  canonicalId: string;
  name: string;
  featType: Dnd35eFeatType;
  prerequisites: Dnd35eFeatPrerequisite | null;
  benefitSummary: string;
  mechanicalEffects: Dnd35eFeatEffect[];
  extractionStatus: "fully_structured" | "partially_structured" | "unresolved";
  extractionNotes: string[];
}

const ABILITY_LABELS: Record<string, string> = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };

export function describeFeatPrerequisite(prereq: Dnd35eFeatPrerequisite | null): string {
  if (prereq === null) return "None";
  switch (prereq.kind) {
    case "all": return prereq.requirements.map(describeFeatPrerequisite).join(", ");
    case "any": return prereq.requirements.map(describeFeatPrerequisite).join(" or ");
    case "ability": return `${ABILITY_LABELS[prereq.ability]} ${prereq.minimum}`;
    case "bab": return `Base attack bonus +${prereq.minimum}`;
    case "skill_ranks": return `${prereq.ranks} ranks in ${prereq.skillCanonicalId}`;
    case "feat": return prereq.featCanonicalId;
    case "class_level": return `${prereq.classCanonicalId} level ${prereq.minimum}`;
    case "character_level": return `Character level ${prereq.minimum}`;
    case "caster_level": return `Caster level ${prereq.minimum}`;
    case "special": return prereq.description;
  }
}
```

- [ ] **Step 4: Run tests, full suite, typecheck**

Run: `node --import tsx --test shared/rules-registry/dnd35e/feats.test.ts` — expect 8/8.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add shared/rules-registry/dnd35e/feats.ts shared/rules-registry/dnd35e/feats.test.ts
git commit -m "feat: add dnd35e-specific feat schema (prerequisite/effect discriminated unions)"
```

**Independent verification before Task 3 begins:** re-run tests fresh; confirm the file lives under `shared/rules-registry/dnd35e/` (not the top-level `shared/rules-registry/` directory a 5e worker might also touch).

---

### Task 3: Deterministic feats extractor

**Files:**
- Create: `server/dnd35e/extraction/feats-fixture.html` (the real, captured `d20srd.org/srd/feats.htm` content, committed as a test fixture)
- Create: `server/dnd35e/extraction/feats-extractor.ts`
- Create: `server/dnd35e/extraction/feats-extractor.test.ts`

**Interfaces:**
- Consumes: `Dnd35eFeatDefinition`, `Dnd35eFeatType`, `Dnd35eFeatPrerequisite`, `Dnd35eFeatEffect` (Task 2).
- Produces: `extractFeatsFromHtml(html: string): Dnd35eFeatDefinition[]` — pure, no network, no DB.

**Expected behavior:** Parses every real `<h3 id="...">Name [Type]</h3>` block and its `<h5>` subsections. Builds `canonicalId` via `buildCanonicalId("dnd35e", "feat", kebabCase(id))`. Parses Prerequisites prose into `Dnd35eFeatPrerequisite` where a known pattern matches (feat-anchor references joined by commas → `all` of `feat` prerequisites; `"Base attack bonus +N"`; `"Str/Dex/Con/Int/Wis/Cha N"`; `"N ranks in <skill>"`); anything else becomes `{kind: "special", description: <real prose>}`. Parses Benefit text for exactly the `"You get a +N bonus on all X checks and Y checks."` pattern into a `skill_check_bonus` effect; everything else becomes `{kind: "unresolved", rawBenefitText, reason}`. Sets `extractionStatus` from whether prerequisites/effects are fully structured, partially structured (some `special`/`unresolved` present), or wholly unresolved.

**Migration risk:** None — pure function, no DB, no network.

**Rollback consideration:** None; nothing else consumes this until Task 5.

- [ ] **Step 1: Capture the real fixture**

Fetch and save the real page content once (this is the one real network call in this task, done manually before writing the extractor — not part of any automated test):

```bash
node -e "fetch('https://www.d20srd.org/srd/feats.htm').then(r => r.text()).then(html => require('fs').writeFileSync('server/dnd35e/extraction/feats-fixture.html', html))"
```

Confirm the file is real and non-trivial: `wc -l server/dnd35e/extraction/feats-fixture.html` should show several thousand lines.

- [ ] **Step 2: Write the failing test against the real fixture**

```ts
// server/dnd35e/extraction/feats-extractor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { extractFeatsFromHtml } from "./feats-extractor";

const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, "feats-fixture.html"), "utf-8");

test("extractFeatsFromHtml finds a real, substantial number of feats (the real page has ~130)", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  assert.ok(feats.length > 100, `expected > 100 real feats, got ${feats.length}`);
});

test("every extracted feat has a real dnd35e:feat: canonical ID and a non-empty name", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  for (const feat of feats) {
    assert.match(feat.canonicalId, /^dnd35e:feat:[a-z0-9-]+$/, `bad canonicalId: ${feat.canonicalId}`);
    assert.ok(feat.name.length > 0);
  }
});

test("Acrobatic: real feat with a fully-structured skill_check_bonus effect and no prerequisites", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const acrobatic = feats.find((f) => f.canonicalId === "dnd35e:feat:acrobatic");
  assert.ok(acrobatic, "Acrobatic must be found in the real fixture");
  assert.equal(acrobatic!.featType, "general");
  assert.equal(acrobatic!.prerequisites, null);
  assert.equal(acrobatic!.extractionStatus, "fully_structured");
  assert.deepEqual(acrobatic!.mechanicalEffects, [
    { kind: "skill_check_bonus", skillCanonicalIds: ["dnd35e:skill:jump", "dnd35e:skill:tumble"], bonus: 2, bonusType: "competence" },
  ]);
});

test("Armor Proficiency (Heavy): real feat with a structured feat-reference prerequisite", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const armorHeavy = feats.find((f) => f.name.startsWith("Armor Proficiency (Heavy)"));
  assert.ok(armorHeavy, "Armor Proficiency (Heavy) must be found in the real fixture");
  assert.ok(armorHeavy!.prerequisites !== null, "must have real, structured prerequisites, not null");
});

test("at least one real feat has a genuinely unresolved Benefit — extraction honestly reports it, never fabricates a mechanic", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  const unresolved = feats.filter((f) => f.extractionStatus === "unresolved" || f.extractionStatus === "partially_structured");
  assert.ok(unresolved.length > 0, "the real page has feats far more complex than the one structured pattern this pass covers — some must be honestly unresolved");
  for (const feat of unresolved) {
    assert.ok(feat.extractionNotes.length > 0, `${feat.canonicalId} is unresolved/partial but has no explanatory note`);
  }
});

test("no extracted feat silently invents a mechanical effect for prose it could not parse", () => {
  const feats = extractFeatsFromHtml(FIXTURE_HTML);
  for (const feat of feats) {
    for (const effect of feat.mechanicalEffects) {
      if (effect.kind === "unresolved") {
        assert.ok(effect.rawBenefitText.length > 0, "an unresolved effect must retain the real raw text, never an empty placeholder");
      }
    }
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --import tsx --test server/dnd35e/extraction/feats-extractor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `server/dnd35e/extraction/feats-extractor.ts`**

Implement `extractFeatsFromHtml` matching the design doc's parsing rules exactly:
- Split the fixture on `<h3 id="([a-zA-Z0-9]+)">([^<]+?)(?:\s*\[([^\]]+)\])?</h3>` to get each feat block's slug, name, and bracketed type (default `"general"` when absent, matching the real page's convention for General feats which omit the bracket in some cases — verify against the real fixture during implementation and adjust the regex to the real observed pattern, not a guessed one).
- Within each block (up to the next `<h3`), extract each `<h5[^>]*>([^<]+)</h5>\s*<p>\s*([\s\S]*?)\s*</p>` pair, keyed by the real heading text (`Prerequisites`, `Benefit`, `Normal`, `Special`).
- Prerequisite parsing: if the Prerequisites text is a comma/period-separated list of `<a href="#slug">...</a>` links with no other real content, produce `{kind: "all", requirements: [{kind: "feat", featCanonicalId: buildCanonicalId("dnd35e","feat",slug)}, ...]}` (a single link becomes that one requirement directly, not a length-1 `all`). Match `/Base attack bonus \+(\d+)/` for BAB. Match `/(Str|Dex|Con|Int|Wis|Cha) (\d+)/` for ability scores. Match `/(\d+) ranks? in ([A-Za-z ]+)/` for skill ranks (map the real skill name to a `dnd35e:skill:<kebab-case>` canonical ID — Task 2's skill entity family doesn't exist yet, so this is a forward-reference ID string, not a validated foreign key; that's expected and fine for this pass). Anything else (including any prose this plan didn't anticipate from the real page) becomes `{kind: "special", description: <the real, stripped-of-HTML-tags text>}`.
- Benefit effect parsing: match `/You get a \+(\d+) bonus on all <a[^>]*>([^<]+)<\/a> checks and <a[^>]*>([^<]+)<\/a> checks/` → `skill_check_bonus`. No match → `{kind: "unresolved", rawBenefitText: <stripped text>, reason: "no matching structured-effect pattern"}`.
- `extractionStatus`: `"fully_structured"` when prerequisites contain no `special` node and every effect is non-`unresolved`; `"unresolved"` when there are zero structured effects and prerequisites (if any) are entirely `special`; `"partially_structured"` otherwise.
- `benefitSummary`: the real Benefit text with HTML tags stripped (not a fabricated paraphrase — the literal, tag-stripped SRD text, which is legally fine to display since this source is `open_canonical`/SRD-open, per the design doc's `EvidenceSourceKind` distinction — displaying vs. treating-as-the-authoritative-mechanic are different concerns, and this field is explicitly documentation/display, never consulted by the mechanical evaluator in Task 6).

- [ ] **Step 5: Run tests, iterate against real failures**

Run: `node --import tsx --test server/dnd35e/extraction/feats-extractor.test.ts` repeatedly while implementing — since this is real regex against real, messy HTML, expect several iterations. Do not weaken a test to make it pass; fix the parser, or if a real edge case in the fixture genuinely can't be handled by the patterns above, let it correctly fall into `special`/`unresolved` rather than forcing a match.

Expected once correct: 6/6 pass.

- [ ] **Step 6: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 7: Commit**

```bash
git add server/dnd35e/extraction/feats-fixture.html server/dnd35e/extraction/feats-extractor.ts server/dnd35e/extraction/feats-extractor.test.ts
git commit -m "feat: add deterministic feats extractor against the real d20srd.org feats page"
```

**Independent verification before Task 4 begins:** re-run tests fresh; manually spot-check 3 more real feats from the committed fixture beyond the two named in the tests (pick ones the implementer didn't specifically target) and confirm their real extracted structure matches the real page by eye; confirm the extractor has zero `fetch`/network calls anywhere in its own module (grep for `fetch(`).

---

### Task 4: Storage layer — canonical feat definitions + revision wiring

**Files:**
- Modify: `server/storage.ts`
- Create: `server/dnd35e/feat-definitions-storage.test.ts`

**Interfaces:**
- Consumes: `Dnd35eFeatDefinition` (Task 2), `recordRevision`/`getRevisionHistory` (Phase 0/1, `shared/rules-registry/revisions.ts` — already implemented, first real consumer), `isValidCanonicalId` (Phase 0/1, `shared/rules-registry/canonical-id.ts`).
- Produces: `storage.upsertDnd35eFeatDefinition(feat: Dnd35eFeatDefinition, evidence: EvidenceCitation): Dnd35eFeatDefinitionRow` (insert or update-with-revision, mirroring Phase 2A's `upsertSrdManifestEntry`'s three-way discipline: no existing row → insert; identical structured content → no-op that still stamps `updatedAt`; changed content → update + `recordRevision`), `storage.getDnd35eFeatDefinition(canonicalId: string): Dnd35eFeatDefinitionRow | undefined`, `storage.listDnd35eFeatDefinitions(filter?: {extractionStatus?}): Dnd35eFeatDefinitionRow[]`.

**Expected behavior:** New table `dnd35e_feat_definitions` (`canonical_id TEXT PRIMARY KEY`, `name`, `feat_type`, `prerequisites_json`, `benefit_summary`, `mechanical_effects_json`, `extraction_status`, `extraction_notes_json`, `evidence_json`, `created_at`, `updated_at`) via `CREATE TABLE IF NOT EXISTS` inside `runMigrations()`. `upsertDnd35eFeatDefinition` validates `isValidCanonicalId(feat.canonicalId)` and throws if invalid — this table must never accept a malformed canonical ID. On a genuine content change (comparing the new JSON-serialized structured fields against the existing row's), call `recordRevision({canonicalId, entityType: "feat", revision: <derived from getRevisionHistory, same discipline as Phase 2A's srd_source_page_revisions — never from an unrelated counter>, changeReason, diffSummary})`.

**Migration risk:** Low — one new table, no existing table touched.

**Rollback consideration:** Dropping the table has zero effect on any other Phase 0/1/2A table; `canonical_revisions` rows for `entityType: "feat"` become orphaned but harmless (the table has no FK, per the existing entity-type-agnostic design).

- [ ] **Step 1: Write the failing tests**

```ts
// server/dnd35e/feat-definitions-storage.test.ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-dnd35e-feats-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("../storage");
runMigrations();

const REAL_EVIDENCE = { kind: "open_canonical" as const, sourcePageKey: "dnd35e-srd-hypertext-d20::/srd/feats.htm" };

const SAMPLE_FEAT = {
  canonicalId: "dnd35e:feat:acrobatic",
  name: "Acrobatic",
  featType: "general" as const,
  prerequisites: null,
  benefitSummary: "You get a +2 bonus on all Jump checks and Tumble checks.",
  mechanicalEffects: [{ kind: "skill_check_bonus" as const, skillCanonicalIds: ["dnd35e:skill:jump", "dnd35e:skill:tumble"], bonus: 2, bonusType: "competence" as const }],
  extractionStatus: "fully_structured" as const,
  extractionNotes: [],
};

test("upsertDnd35eFeatDefinition inserts a new row", () => {
  const row = storage.upsertDnd35eFeatDefinition(SAMPLE_FEAT, REAL_EVIDENCE);
  assert.equal(row.canonicalId, "dnd35e:feat:acrobatic");
  assert.equal(row.name, "Acrobatic");
});

test("upsertDnd35eFeatDefinition throws on an invalid canonical ID rather than silently accepting it", () => {
  assert.throws(() => storage.upsertDnd35eFeatDefinition({ ...SAMPLE_FEAT, canonicalId: "not-a-canonical-id" }, REAL_EVIDENCE));
});

test("upsertDnd35eFeatDefinition is a no-op (no revision) when the structured content is unchanged", () => {
  storage.upsertDnd35eFeatDefinition(SAMPLE_FEAT, REAL_EVIDENCE);
  const history = storage.getRevisionHistory("dnd35e:feat:acrobatic");
  const before = history.length;
  storage.upsertDnd35eFeatDefinition(SAMPLE_FEAT, REAL_EVIDENCE);
  const after = storage.getRevisionHistory("dnd35e:feat:acrobatic");
  assert.equal(after.length, before, "identical content must never record a new revision");
});

test("upsertDnd35eFeatDefinition records a real revision when structured content genuinely changes", () => {
  storage.upsertDnd35eFeatDefinition(SAMPLE_FEAT, REAL_EVIDENCE);
  const changed = { ...SAMPLE_FEAT, mechanicalEffects: [{ kind: "skill_check_bonus" as const, skillCanonicalIds: ["dnd35e:skill:jump", "dnd35e:skill:tumble"], bonus: 3, bonusType: "competence" as const }] };
  storage.upsertDnd35eFeatDefinition(changed, REAL_EVIDENCE);
  const history = storage.getRevisionHistory("dnd35e:feat:acrobatic");
  assert.ok(history.length >= 1, "a genuine structured-content change must record a revision via the existing Phase 0/1 recordRevision, not a new mechanism");
});

test("getDnd35eFeatDefinition round-trips the full structured shape, including mechanicalEffects", () => {
  storage.upsertDnd35eFeatDefinition(SAMPLE_FEAT, REAL_EVIDENCE);
  const row = storage.getDnd35eFeatDefinition("dnd35e:feat:acrobatic");
  assert.deepEqual(row?.mechanicalEffects, SAMPLE_FEAT.mechanicalEffects);
});

test("listDnd35eFeatDefinitions filters by extractionStatus", () => {
  storage.upsertDnd35eFeatDefinition(SAMPLE_FEAT, REAL_EVIDENCE);
  storage.upsertDnd35eFeatDefinition({ ...SAMPLE_FEAT, canonicalId: "dnd35e:feat:some-unresolved-one", extractionStatus: "unresolved", extractionNotes: ["real reason"] }, REAL_EVIDENCE);
  const unresolved = storage.listDnd35eFeatDefinitions({ extractionStatus: "unresolved" });
  assert.ok(unresolved.every((f) => f.extractionStatus === "unresolved"));
  assert.ok(unresolved.some((f) => f.canonicalId === "dnd35e:feat:some-unresolved-one"));
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test server/dnd35e/feat-definitions-storage.test.ts`
Expected: FAIL — `storage.upsertDnd35eFeatDefinition` is not a function.

- [ ] **Step 3: Add the migration + CRUD to `server/storage.ts`**

Add the `CREATE TABLE IF NOT EXISTS dnd35e_feat_definitions` block inside `runMigrations()`, storing `prerequisitesJson`/`mechanicalEffectsJson`/`extractionNotesJson`/`evidenceJson` as `JSON.stringify`d text columns (matching this codebase's existing convention for structured-JSON-in-SQLite columns — check an existing example like `compendium.ts` or `campaigns.characterData` for the exact serialize/deserialize idiom already used elsewhere in this file, and match it). Implement `upsertDnd35eFeatDefinition`/`getDnd35eFeatDefinition`/`listDnd35eFeatDefinitions` on `IStorage`/`DatabaseStorage`, following exactly the change-detection-then-revision discipline described in "Expected behavior" above — read Task 3 of the Phase 2A plan (`docs/superpowers/plans/2026-08-22-dnd35-srd-ingestion-foundation-phase2a.md`, if still present in this branch's history) for the established pattern of comparing existing-vs-new structured content before deciding whether a call is a no-op, if you want a concrete precedent to match stylistically — but this table's revision mechanism is `recordRevision`/`canonical_revisions` (Phase 0/1), never `recordSourcePageRevision`/`srd_source_page_revisions` (Phase 2A, page-scoped, not applicable to canonical entities).

- [ ] **Step 4: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/dnd35e/feat-definitions-storage.test.ts` — expect 6/6.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add server/storage.ts server/dnd35e/feat-definitions-storage.test.ts
git commit -m "feat: add canonical feat-definition storage, first real consumer of Phase 0/1's recordRevision"
```

**Independent verification before Task 5 begins:** re-run tests fresh; confirm `recordRevision`'s `entityType` argument is genuinely `"feat"` (not `"srd_manifest_entry"` or another Phase 2A concept) by reading the code; confirm no route in `server/routes.ts` exposes any of these three new methods (grep, zero hits expected — this stays storage-layer only until a future task explicitly wires read-only entity browsing into the API, which this plan does not do).

---

### Task 5: Real extraction run + honest coverage report

**Files:**
- Create: `docs/superpowers/notes/2026-08-23-dnd35e-feats-extraction-report.md`

**Interfaces:**
- Consumes: `extractFeatsFromHtml` (Task 3), `storage.upsertDnd35eFeatDefinition` (Task 4), the real `srd_manifest_entries` row for `feats.htm` (Phase 2A, already in the real dev DB from the Task 9 acceptance scan).

**Expected behavior:** A real, one-off run (not part of the automated test suite, matching Phase 2A's Task 9 discipline for real-network/real-DB steps) that: (1) re-fetches the live `feats.htm` page, computes its SHA-256, and asserts it matches the `contentHash` already recorded in `srd_manifest_entries` for that page — if it has drifted since Phase 2A's scan, stop and report the drift rather than silently extracting from now-unverified content; (2) runs `extractFeatsFromHtml` against the real, freshly-confirmed content; (3) writes every extracted feat into the real dev DB via `upsertDnd35eFeatDefinition` with `evidence: {kind: "open_canonical", sourcePageKey: "dnd35e-srd-hypertext-d20::/srd/feats.htm"}`; (4) writes an honest coverage report — real total feat count, real `fully_structured`/`partially_structured`/`unresolved` counts, and the real list of every `unresolved`/`partially_structured` feat's name and reason, never just a summary number.

**Migration risk:** None — additive dev-database rows, same discipline as Phase 2A. Do not target the live VPS database.

**Rollback consideration:** `DELETE FROM dnd35e_feat_definitions;` — trivially reversible.

- [ ] **Step 1: Write and run the real extraction script**

```ts
// (run directly, not committed as a permanent script unless Step 3 below decides to keep it)
import { createHash } from "crypto";
import { storage, runMigrations } from "./server/storage";
import { extractFeatsFromHtml } from "./server/dnd35e/extraction/feats-extractor";

async function main() {
  runMigrations();
  const manifestEntry = storage.getSrdManifestEntry("dnd35e-srd-hypertext-d20::/srd/feats.htm");
  if (!manifestEntry) throw new Error("Run Phase 2A's Task 9 acceptance scan first — no manifest entry for feats.htm.");

  const res = await fetch("https://www.d20srd.org/srd/feats.htm");
  if (!res.ok) throw new Error(`Real re-fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  const freshHash = createHash("sha256").update(html).digest("hex");
  if (freshHash !== manifestEntry.contentHash) {
    throw new Error(`Content drift detected: feats.htm's live hash (${freshHash}) no longer matches the manifest's recorded hash (${manifestEntry.contentHash}). Re-run Phase 2A discovery before extracting from drifted content.`);
  }
  console.log("Content hash verified — extracting from confirmed-current content.");

  const feats = extractFeatsFromHtml(html);
  const evidence = { kind: "open_canonical" as const, sourcePageKey: "dnd35e-srd-hypertext-d20::/srd/feats.htm" };
  for (const feat of feats) storage.upsertDnd35eFeatDefinition(feat, evidence);

  const byStatus = { fully_structured: 0, partially_structured: 0, unresolved: 0 };
  const gaps: Array<{ canonicalId: string; name: string; status: string; notes: string[] }> = [];
  for (const feat of feats) {
    byStatus[feat.extractionStatus]++;
    if (feat.extractionStatus !== "fully_structured") gaps.push({ canonicalId: feat.canonicalId, name: feat.name, status: feat.extractionStatus, notes: feat.extractionNotes });
  }
  console.log(`Total: ${feats.length}`, JSON.stringify(byStatus));
  console.log("Gaps:", JSON.stringify(gaps, null, 2));
}
main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
```

Run it for real, capture the real output.

- [ ] **Step 2: Write the real coverage report**

`docs/superpowers/notes/2026-08-23-dnd35e-feats-extraction-report.md` — real total feat count, real per-status breakdown, and the real, complete list of every `unresolved`/`partially_structured` feat's canonical ID, name, and extraction notes (never a bare count for the gaps — same "name every failure" discipline as Phase 2A's acceptance report). State plainly that this is a first pass covering one structured-effect pattern (`skill_check_bonus`) and that expanding pattern coverage for the remaining feats is explicit follow-on work, not silently implied to be complete.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/notes/2026-08-23-dnd35e-feats-extraction-report.md
git commit -m "docs: capture real feats extraction run against the live, hash-verified d20srd.org page"
```

**Independent verification before Task 6 begins:** re-run the extraction script fresh — the second run's `upsertDnd35eFeatDefinition` calls should all be no-ops (structured content unchanged), confirmed by `getRevisionHistory` showing no new revisions for any feat between the two runs; confirm the coverage report's `fully_structured` count is genuinely less than the total (proving the honest-gaps discipline is real, not just asserted) unless the real page turns out to have zero feats matching only the one covered pattern's complement, which would itself be a surprising, worth-double-checking result.

---

### Task 6: Feat prerequisite evaluator (the real mechanic)

**Files:**
- Create: `server/dnd35e/mechanics/feat-prerequisites.ts`
- Create: `server/dnd35e/mechanics/feat-prerequisites.test.ts`

**Interfaces:**
- Consumes: `Dnd35eFeatPrerequisite` (Task 2).
- Produces: `Dnd35eCharacterQualificationState` (a plain data shape: abilities, baseAttackBonus, characterLevel, classLevels, skillRanks, featCanonicalIds, casterLevel), `evaluateFeatPrerequisite(prerequisite: Dnd35eFeatPrerequisite | null, state: Dnd35eCharacterQualificationState): {qualified: boolean; failureReasons: string[]}`.

**Expected behavior:** A pure, deterministic evaluator — no DB, no network — proving the "server determines legal selections" requirement is real and callable. `null` prerequisite always qualifies. `all`/`any` compose recursively. Every leaf kind compares the real structured requirement against the real structured character state and returns a real, specific failure reason (using `describeFeatPrerequisite`, Task 2, so failure messages and prerequisite descriptions never drift out of sync with each other). A `special` prerequisite (prose that couldn't be structured) never silently qualifies — it always fails with a reason directing a human to manually confirm it, since the server cannot mechanically verify prose it couldn't parse. This is the correct, honest behavior per "AI must not silently make permanent character-development decisions" and "failures must fail honestly" — a `special` prerequisite is exactly the case where the SERVER (not just the AI) cannot automatically decide, so it fails closed rather than silently passing.

**Migration risk:** None.

**Rollback consideration:** None; this is the terminal consumer for this task's data — nothing else depends on it yet (character-creation UI wiring is explicit follow-on work, per the design doc's stated out-of-scope list).

- [ ] **Step 1: Write the failing tests**

```ts
// server/dnd35e/mechanics/feat-prerequisites.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateFeatPrerequisite } from "./feat-prerequisites";
import type { Dnd35eFeatPrerequisite } from "../../../shared/rules-registry/dnd35e/feats";
import type { Dnd35eCharacterQualificationState } from "./feat-prerequisites";

const BASE_STATE: Dnd35eCharacterQualificationState = {
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  baseAttackBonus: 0,
  characterLevel: 1,
  classLevels: {},
  skillRanks: {},
  featCanonicalIds: [],
  casterLevel: 0,
};

test("null prerequisite always qualifies", () => {
  assert.deepEqual(evaluateFeatPrerequisite(null, BASE_STATE), { qualified: true, failureReasons: [] });
});

test("ability prerequisite: qualifies at exactly the minimum, fails below it", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "ability", ability: "str", minimum: 13 };
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, abilities: { ...BASE_STATE.abilities, str: 13 } }).qualified, true);
  const result = evaluateFeatPrerequisite(p, { ...BASE_STATE, abilities: { ...BASE_STATE.abilities, str: 12 } });
  assert.equal(result.qualified, false);
  assert.equal(result.failureReasons[0], "Str 13");
});

test("bab prerequisite: real boundary check", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "bab", minimum: 6 };
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, baseAttackBonus: 6 }).qualified, true);
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, baseAttackBonus: 5 }).qualified, false);
});

test("feat prerequisite: checks real featCanonicalIds membership", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "feat", featCanonicalId: "dnd35e:feat:dodge" };
  assert.equal(evaluateFeatPrerequisite(p, { ...BASE_STATE, featCanonicalIds: ["dnd35e:feat:dodge"] }).qualified, true);
  assert.equal(evaluateFeatPrerequisite(p, BASE_STATE).qualified, false);
});

test("all: qualifies only when every child qualifies, collects every real failure reason", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "all",
    requirements: [{ kind: "bab", minimum: 6 }, { kind: "ability", ability: "str", minimum: 13 }],
  };
  const result = evaluateFeatPrerequisite(p, BASE_STATE);
  assert.equal(result.qualified, false);
  assert.equal(result.failureReasons.length, 2, "both real unmet requirements must be reported, not just the first");
});

test("any: qualifies when at least one child qualifies", () => {
  const p: Dnd35eFeatPrerequisite = {
    kind: "any",
    requirements: [{ kind: "ability", ability: "str", minimum: 13 }, { kind: "ability", ability: "dex", minimum: 13 }],
  };
  const result = evaluateFeatPrerequisite(p, { ...BASE_STATE, abilities: { ...BASE_STATE.abilities, dex: 13 } });
  assert.equal(result.qualified, true);
});

test("special prerequisite NEVER silently qualifies — the server cannot verify unstructured prose, so it fails closed with an explicit human-review reason", () => {
  const p: Dnd35eFeatPrerequisite = { kind: "special", description: "Wild shape class feature" };
  const result = evaluateFeatPrerequisite(p, BASE_STATE);
  assert.equal(result.qualified, false, "an unparseable prerequisite must never be treated as automatically satisfied");
  assert.match(result.failureReasons[0], /Wild shape class feature/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test server/dnd35e/mechanics/feat-prerequisites.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `server/dnd35e/mechanics/feat-prerequisites.ts`**

```ts
// server/dnd35e/mechanics/feat-prerequisites.ts
//
// Pure, deterministic feat-prerequisite evaluation. The server determines
// legal selections (Player Agency requirement) — this is that determination,
// real and callable, not inert data. A "special" (unstructured) prerequisite
// always fails: the server cannot mechanically verify prose it couldn't
// parse, and silently passing it would let a permanent character-development
// choice go unvalidated. That is a real, deliberate fail-closed default, not
// an oversight — matches "failures must fail honestly."

import { describeFeatPrerequisite } from "../../../shared/rules-registry/dnd35e/feats";
import type { Dnd35eFeatPrerequisite } from "../../../shared/rules-registry/dnd35e/feats";

export interface Dnd35eCharacterQualificationState {
  abilities: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>;
  baseAttackBonus: number;
  characterLevel: number;
  classLevels: Record<string, number>;
  skillRanks: Record<string, number>;
  featCanonicalIds: string[];
  casterLevel: number;
}

export interface Dnd35eFeatQualificationResult {
  qualified: boolean;
  failureReasons: string[];
}

export function evaluateFeatPrerequisite(
  prerequisite: Dnd35eFeatPrerequisite | null,
  state: Dnd35eCharacterQualificationState,
): Dnd35eFeatQualificationResult {
  if (prerequisite === null) return { qualified: true, failureReasons: [] };

  switch (prerequisite.kind) {
    case "all": {
      const results = prerequisite.requirements.map((req) => evaluateFeatPrerequisite(req, state));
      return {
        qualified: results.every((r) => r.qualified),
        failureReasons: results.filter((r) => !r.qualified).flatMap((r) => r.failureReasons),
      };
    }
    case "any": {
      const results = prerequisite.requirements.map((req) => evaluateFeatPrerequisite(req, state));
      if (results.some((r) => r.qualified)) return { qualified: true, failureReasons: [] };
      return { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    }
    case "ability": {
      const actual = state.abilities[prerequisite.ability];
      return actual >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    }
    case "bab":
      return state.baseAttackBonus >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "skill_ranks":
      return (state.skillRanks[prerequisite.skillCanonicalId] ?? 0) >= prerequisite.ranks
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "feat":
      return state.featCanonicalIds.includes(prerequisite.featCanonicalId)
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "class_level":
      return (state.classLevels[prerequisite.classCanonicalId] ?? 0) >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "character_level":
      return state.characterLevel >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "caster_level":
      return state.casterLevel >= prerequisite.minimum
        ? { qualified: true, failureReasons: [] }
        : { qualified: false, failureReasons: [describeFeatPrerequisite(prerequisite)] };
    case "special":
      // Never silently qualifies — see module header.
      return { qualified: false, failureReasons: [`Requires manual confirmation: ${prerequisite.description}`] };
  }
}
```

- [ ] **Step 4: Run tests, full suite, typecheck**

Run: `node --import tsx --test server/dnd35e/mechanics/feat-prerequisites.test.ts` — expect 7/7.
Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add server/dnd35e/mechanics/feat-prerequisites.ts server/dnd35e/mechanics/feat-prerequisites.test.ts
git commit -m "feat: add real feat-prerequisite evaluator (server-determined legal selections)"
```

**Independent verification before Task 7 begins:** re-run tests fresh; confirm the `special` case's fail-closed behavior by reading the code directly, not just the passing test; confirm zero references to any 5e concept anywhere in this file (grep for `proficiencyBonus`, `advantage`, `disadvantage`).

---

### Task 7: No-5e-contamination regression test for this slice

**Files:**
- Create: `server/dnd35e/no-5e-contamination.test.ts`

**Interfaces:**
- Consumes: nothing new — a structural/textual check over the files this plan created.

**Expected behavior:** A real, automated regression test — not a manual grep the implementer ran once — that fails if any file under `server/dnd35e/` or `shared/rules-registry/dnd35e/` ever comes to reference a defined list of 5e-specific terms (`proficiencyBonus`, `advantage`, `disadvantage`, `deathSave`, `weaponMastery`, `heroicInspiration`, `hitDice` used in the 5e sense — scope the exact list to what's realistic to false-positive-check; comment honestly that this is a lexical check, not a semantic one, and will need extending as more 5e-adjacent-sounding-but-actually-3.5e terms are identified in future entity families). This is Phase 2B-1's honest, bounded contribution to the plan's much larger "no 5e contamination" requirement — it proves the discipline is real and automated for the code that exists today, not a claim of blanket coverage over code not yet written.

**Migration risk:** None.

**Rollback consideration:** None.

- [ ] **Step 1: Write the test**

```ts
// server/dnd35e/no-5e-contamination.test.ts
//
// Lexical, not semantic: fails if any 5e-specific term ever appears in the
// dnd35e-specific source tree. Scoped to Phase 2B-1's real files today —
// extend this list and its glob as later entity families land.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const FORBIDDEN_5E_TERMS = [
  "proficiencyBonus", "advantage", "disadvantage", "deathSave",
  "weaponMastery", "heroicInspiration",
];

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full.endsWith(".ts") && !full.endsWith(".test.ts") ? [full] : [];
  });
}

test("no 5e-specific terms appear anywhere in the dnd35e-specific source tree", () => {
  const roots = [
    path.join(__dirname), // server/dnd35e/
    path.join(__dirname, "..", "..", "shared", "rules-registry", "dnd35e"),
  ];
  const files = roots.flatMap((root) => (fs.existsSync(root) ? walk(root) : []));
  assert.ok(files.length > 0, "sanity check: this test must actually find real files to scan");
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    for (const term of FORBIDDEN_5E_TERMS) {
      assert.ok(!content.includes(term), `${file} contains forbidden 5e term "${term}" — dnd35e code must never reference 5e-specific concepts`);
    }
  }
});
```

- [ ] **Step 2: Run it**

Run: `node --import tsx --test server/dnd35e/no-5e-contamination.test.ts`
Expected: PASS (this is a real, currently-true assertion about the code this plan just wrote — a regression guard for the future, not expected to fail today).

- [ ] **Step 3: Run full suite + typecheck**

Run: `node --import tsx --test server/**/*.test.ts shared/rules-registry/**/*.test.ts` — no regressions; expect the running total to have grown by the sum of every prior task's new tests.
Run: `npx tsc --noEmit` — clean.

- [ ] **Step 4: Commit**

```bash
git add server/dnd35e/no-5e-contamination.test.ts
git commit -m "test: add automated no-5e-contamination regression guard for the dnd35e source tree"
```

**Independent verification before this plan is considered complete:** re-run the full suite fresh; run `npm run build` fresh; confirm every file this plan created lives under `server/dnd35e/` or `shared/rules-registry/dnd35e/`, never in a shared/edition-neutral path (`ls`/`find` the diff's file list and eyeball every path).

---

## Self-Review

**Placeholder scan:** every step has real, complete code — the `special`/`unresolved` states are a deliberate design feature (per the design doc), not a placeholder standing in for unfinished work.

**Type consistency:** `Dnd35eFeatPrerequisite`/`Dnd35eFeatEffect` (Task 2) are consumed identically by the extractor (Task 3), storage (Task 4), and evaluator (Task 6) — same import, no redefinition.

**Reuse discipline:** `canonical-id.ts`/`provenance.ts`/`revisions.ts` (Phase 0/1) are consumed via their existing exports throughout; no second canonical-ID or revision mechanism is introduced.

**Honesty discipline:** Task 3's extractor and Task 5's real run both surface unresolved/partial extraction as first-class, reported data — never a silently dropped feat or a fabricated effect. Task 6's evaluator fails closed on unstructured prerequisites rather than silently passing them.

**Scope discipline:** this plan explicitly does not claim full-ruleset completion — the design doc's "What this slice does NOT do" section is the authoritative scope boundary, and no task here contradicts it.

Ready for implementation via subagent-driven-development.
