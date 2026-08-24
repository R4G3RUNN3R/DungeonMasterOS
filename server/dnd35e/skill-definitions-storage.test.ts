// server/dnd35e/skill-definitions-storage.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-dnd35e-skills-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("../storage");
runMigrations();

const REAL_EVIDENCE = { kind: "open_canonical" as const, sourcePageKey: "dnd35e-srd-hypertext-d20::/srd/skills/climb.htm" };

const SAMPLE_SKILL = {
  canonicalId: "dnd35e:skill:climb",
  name: "Climb",
  keyAbility: "str" as const,
  trainedOnly: false,
  armorCheckPenalty: true,
  sections: [
    { heading: "Check", text: "real check text" },
    { heading: "Action", text: "real action text" },
  ],
  extractionStatus: "partially_structured" as const,
  extractionNotes: ["real reason"],
};

test("upsertDnd35eSkillDefinition inserts a new row", () => {
  const row = storage.upsertDnd35eSkillDefinition(SAMPLE_SKILL, REAL_EVIDENCE);
  assert.equal(row.canonicalId, "dnd35e:skill:climb");
  assert.equal(row.keyAbility, "str");
  assert.equal(row.armorCheckPenalty, true);
});

test("upsertDnd35eSkillDefinition throws on an invalid canonical ID rather than silently accepting it", () => {
  assert.throws(() => storage.upsertDnd35eSkillDefinition({ ...SAMPLE_SKILL, canonicalId: "not-a-canonical-id" }, REAL_EVIDENCE));
});

test("upsertDnd35eSkillDefinition throws on a well-formed canonical ID from the wrong ruleset", () => {
  assert.throws(() => storage.upsertDnd35eSkillDefinition({ ...SAMPLE_SKILL, canonicalId: "dnd5e:skill:climb" }, REAL_EVIDENCE));
});

test("upsertDnd35eSkillDefinition throws on a well-formed canonical ID with the wrong entity type", () => {
  assert.throws(() => storage.upsertDnd35eSkillDefinition({ ...SAMPLE_SKILL, canonicalId: "dnd35e:feat:climb" }, REAL_EVIDENCE));
});

test("upsertDnd35eSkillDefinition is a no-op (no revision) when the structured content is unchanged", () => {
  storage.upsertDnd35eSkillDefinition(SAMPLE_SKILL, REAL_EVIDENCE);
  const before = storage.getRevisionHistory("dnd35e:skill:climb").length;
  storage.upsertDnd35eSkillDefinition(SAMPLE_SKILL, REAL_EVIDENCE);
  const after = storage.getRevisionHistory("dnd35e:skill:climb").length;
  assert.equal(after, before, "identical content must never record a new revision");
});

test("upsertDnd35eSkillDefinition records a real revision when structured content genuinely changes", () => {
  storage.upsertDnd35eSkillDefinition(SAMPLE_SKILL, REAL_EVIDENCE);
  const changed = { ...SAMPLE_SKILL, trainedOnly: true };
  storage.upsertDnd35eSkillDefinition(changed, REAL_EVIDENCE);
  const history = storage.getRevisionHistory("dnd35e:skill:climb");
  assert.ok(history.length >= 1, "a genuine structured-content change must record a revision via the existing Phase 0/1 recordRevision, not a new mechanism");
});

test("getDnd35eSkillDefinition round-trips the full structured shape, including sections and boolean flags", () => {
  storage.upsertDnd35eSkillDefinition(SAMPLE_SKILL, REAL_EVIDENCE);
  const row = storage.getDnd35eSkillDefinition("dnd35e:skill:climb");
  assert.deepEqual(row?.sections, SAMPLE_SKILL.sections);
  assert.equal(row?.trainedOnly, false);
  assert.equal(row?.armorCheckPenalty, true);
});

test("listDnd35eSkillDefinitions filters by extractionStatus", () => {
  storage.upsertDnd35eSkillDefinition(SAMPLE_SKILL, REAL_EVIDENCE);
  storage.upsertDnd35eSkillDefinition(
    { ...SAMPLE_SKILL, canonicalId: "dnd35e:skill:some-unresolved-one", extractionStatus: "unresolved", extractionNotes: ["real reason"] },
    REAL_EVIDENCE,
  );
  const unresolved = storage.listDnd35eSkillDefinitions({ extractionStatus: "unresolved" });
  assert.ok(unresolved.every((s) => s.extractionStatus === "unresolved"));
  assert.ok(unresolved.some((s) => s.canonicalId === "dnd35e:skill:some-unresolved-one"));
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
