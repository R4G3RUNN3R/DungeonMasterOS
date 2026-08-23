// server/dnd35e/class-definitions-storage.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-dnd35e-classes-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("../storage");
runMigrations();

const REAL_EVIDENCE = { kind: "open_canonical" as const, sourcePageKey: "dnd35e-srd-hypertext-d20::/srd/classes/fighter.htm" };

const SAMPLE_CLASS = {
  canonicalId: "dnd35e:class:fighter",
  name: "Fighter",
  alignment: "Any.",
  hitDie: 10,
  babProgression: "full" as const,
  saveProgression: { fort: "good" as const, ref: "poor" as const, will: "poor" as const },
  skillPointsBase: 2,
  classSkills: [{ skillCanonicalId: "dnd35e:skill:climb", keyAbility: "str" as const }],
  levelProgression: [{ level: 1, baseAttackBonus: 1, fortSave: 2, refSave: 0, willSave: 0, specialFeatureSlugs: ["bonusFeats"] }],
  classFeatures: [{ slug: "bonusFeats", name: "Bonus Feats", description: "real description" }],
  extractionStatus: "fully_structured" as const,
  extractionNotes: [],
};

test("upsertDnd35eClassDefinition inserts a new row", () => {
  const row = storage.upsertDnd35eClassDefinition(SAMPLE_CLASS, REAL_EVIDENCE);
  assert.equal(row.canonicalId, "dnd35e:class:fighter");
  assert.equal(row.babProgression, "full");
});

test("upsertDnd35eClassDefinition throws on an invalid canonical ID rather than silently accepting it", () => {
  assert.throws(() => storage.upsertDnd35eClassDefinition({ ...SAMPLE_CLASS, canonicalId: "not-a-canonical-id" }, REAL_EVIDENCE));
});

test("upsertDnd35eClassDefinition throws on a well-formed canonical ID from the wrong ruleset", () => {
  assert.throws(() => storage.upsertDnd35eClassDefinition({ ...SAMPLE_CLASS, canonicalId: "dnd5e:class:fighter" }, REAL_EVIDENCE));
});

test("upsertDnd35eClassDefinition throws on a well-formed canonical ID with the wrong entity type", () => {
  assert.throws(() => storage.upsertDnd35eClassDefinition({ ...SAMPLE_CLASS, canonicalId: "dnd35e:feat:fighter" }, REAL_EVIDENCE));
});

test("upsertDnd35eClassDefinition is a no-op (no revision) when the structured content is unchanged", () => {
  storage.upsertDnd35eClassDefinition(SAMPLE_CLASS, REAL_EVIDENCE);
  const before = storage.getRevisionHistory("dnd35e:class:fighter").length;
  storage.upsertDnd35eClassDefinition(SAMPLE_CLASS, REAL_EVIDENCE);
  const after = storage.getRevisionHistory("dnd35e:class:fighter").length;
  assert.equal(after, before, "identical content must never record a new revision");
});

test("upsertDnd35eClassDefinition records a real revision when structured content genuinely changes", () => {
  storage.upsertDnd35eClassDefinition(SAMPLE_CLASS, REAL_EVIDENCE);
  const changed = { ...SAMPLE_CLASS, hitDie: 12 };
  storage.upsertDnd35eClassDefinition(changed, REAL_EVIDENCE);
  const history = storage.getRevisionHistory("dnd35e:class:fighter");
  assert.ok(history.length >= 1, "a genuine structured-content change must record a revision via the existing Phase 0/1 recordRevision, not a new mechanism");
});

test("getDnd35eClassDefinition round-trips the full structured shape, including the level-progression table", () => {
  storage.upsertDnd35eClassDefinition(SAMPLE_CLASS, REAL_EVIDENCE);
  const row = storage.getDnd35eClassDefinition("dnd35e:class:fighter");
  assert.deepEqual(row?.levelProgression, SAMPLE_CLASS.levelProgression);
  assert.deepEqual(row?.classFeatures, SAMPLE_CLASS.classFeatures);
});

test("listDnd35eClassDefinitions filters by extractionStatus", () => {
  storage.upsertDnd35eClassDefinition(SAMPLE_CLASS, REAL_EVIDENCE);
  storage.upsertDnd35eClassDefinition(
    { ...SAMPLE_CLASS, canonicalId: "dnd35e:class:some-partial-one", extractionStatus: "partially_structured", extractionNotes: ["real reason"] },
    REAL_EVIDENCE,
  );
  const partial = storage.listDnd35eClassDefinitions({ extractionStatus: "partially_structured" });
  assert.ok(partial.every((c) => c.extractionStatus === "partially_structured"));
  assert.ok(partial.some((c) => c.canonicalId === "dnd35e:class:some-partial-one"));
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
