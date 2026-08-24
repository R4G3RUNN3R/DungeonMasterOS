// server/dnd35e/spell-definitions-storage.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-dnd35e-spells-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("../storage");
runMigrations();

const REAL_EVIDENCE = { kind: "open_canonical" as const, sourcePageKey: "dnd35e-srd-hypertext-d20::/srd/spells/magicMissile.htm" };

const SAMPLE_SPELL = {
  canonicalId: "dnd35e:spell:magic-missile",
  name: "Magic Missile",
  school: "Evocation",
  subschool: null,
  descriptors: ["Force"],
  classLevels: [{ classOrDomainLabel: "Sor", level: 1 }, { classOrDomainLabel: "Wiz", level: 1 }],
  components: ["V", "S"],
  castingTime: "1 standard action",
  range: "Medium (100 ft. + 10 ft./level)",
  targetOrAreaOrEffect: { kind: "targets" as const, text: "Up to five creatures" },
  duration: "Instantaneous",
  savingThrow: "None",
  spellResistance: "Yes",
  inheritsFromCanonicalId: null,
  description: "real description",
  extractionStatus: "fully_structured" as const,
  extractionNotes: [],
};

test("upsertDnd35eSpellDefinition inserts a new row", () => {
  const row = storage.upsertDnd35eSpellDefinition(SAMPLE_SPELL, REAL_EVIDENCE);
  assert.equal(row.canonicalId, "dnd35e:spell:magic-missile");
  assert.equal(row.school, "Evocation");
});

test("upsertDnd35eSpellDefinition throws on an invalid canonical ID rather than silently accepting it", () => {
  assert.throws(() => storage.upsertDnd35eSpellDefinition({ ...SAMPLE_SPELL, canonicalId: "not-a-canonical-id" }, REAL_EVIDENCE));
});

test("upsertDnd35eSpellDefinition throws on a well-formed canonical ID with the wrong entity type", () => {
  assert.throws(() => storage.upsertDnd35eSpellDefinition({ ...SAMPLE_SPELL, canonicalId: "dnd35e:feat:magic-missile" }, REAL_EVIDENCE));
});

test("upsertDnd35eSpellDefinition is a no-op (no revision) when the structured content is unchanged", () => {
  storage.upsertDnd35eSpellDefinition(SAMPLE_SPELL, REAL_EVIDENCE);
  const before = storage.getRevisionHistory("dnd35e:spell:magic-missile").length;
  storage.upsertDnd35eSpellDefinition(SAMPLE_SPELL, REAL_EVIDENCE);
  const after = storage.getRevisionHistory("dnd35e:spell:magic-missile").length;
  assert.equal(after, before, "identical content must never record a new revision");
});

test("getDnd35eSpellDefinition round-trips the full structured shape, including classLevels and targetOrAreaOrEffect", () => {
  storage.upsertDnd35eSpellDefinition(SAMPLE_SPELL, REAL_EVIDENCE);
  const row = storage.getDnd35eSpellDefinition("dnd35e:spell:magic-missile");
  assert.deepEqual(row?.classLevels, SAMPLE_SPELL.classLevels);
  assert.deepEqual(row?.targetOrAreaOrEffect, SAMPLE_SPELL.targetOrAreaOrEffect);
  assert.equal(row?.subschool, null);
  assert.equal(row?.inheritsFromCanonicalId, null);
});

test("getDnd35eSpellDefinition round-trips a real reference-based variant spell: null savingThrow/spellResistance and a resolved inheritsFromCanonicalId", () => {
  storage.upsertDnd35eSpellDefinition(
    {
      ...SAMPLE_SPELL,
      canonicalId: "dnd35e:spell:bulls-strength-mass",
      name: "Bull's Strength, Mass",
      savingThrow: null,
      spellResistance: null,
      inheritsFromCanonicalId: "dnd35e:spell:bulls-strength",
      extractionStatus: "partially_structured",
      extractionNotes: ["real reference-based variant note"],
    },
    REAL_EVIDENCE,
  );
  const row = storage.getDnd35eSpellDefinition("dnd35e:spell:bulls-strength-mass");
  assert.equal(row?.savingThrow, null);
  assert.equal(row?.spellResistance, null);
  assert.equal(row?.inheritsFromCanonicalId, "dnd35e:spell:bulls-strength");
});

test("listDnd35eSpellDefinitions filters by extractionStatus", () => {
  storage.upsertDnd35eSpellDefinition(SAMPLE_SPELL, REAL_EVIDENCE);
  storage.upsertDnd35eSpellDefinition(
    { ...SAMPLE_SPELL, canonicalId: "dnd35e:spell:some-unresolved-one", extractionStatus: "unresolved", extractionNotes: ["real reason"] },
    REAL_EVIDENCE,
  );
  const unresolved = storage.listDnd35eSpellDefinitions({ extractionStatus: "unresolved" });
  assert.ok(unresolved.every((s) => s.extractionStatus === "unresolved"));
  assert.ok(unresolved.some((s) => s.canonicalId === "dnd35e:spell:some-unresolved-one"));
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
