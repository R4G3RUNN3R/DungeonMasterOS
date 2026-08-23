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

test("upsertDnd35eFeatDefinition throws on a well-formed canonical ID from the wrong ruleset", () => {
  assert.throws(() => storage.upsertDnd35eFeatDefinition({ ...SAMPLE_FEAT, canonicalId: "dnd5e:feat:acrobatic" }, REAL_EVIDENCE));
});

test("upsertDnd35eFeatDefinition throws on a well-formed canonical ID with the wrong entity type", () => {
  assert.throws(() => storage.upsertDnd35eFeatDefinition({ ...SAMPLE_FEAT, canonicalId: "dnd35e:skill:jump" }, REAL_EVIDENCE));
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
