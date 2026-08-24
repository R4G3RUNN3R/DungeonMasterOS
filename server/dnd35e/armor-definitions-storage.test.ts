// server/dnd35e/armor-definitions-storage.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-dnd35e-armor-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("../storage");
runMigrations();

const REAL_EVIDENCE = { kind: "open_canonical" as const, sourcePageKey: "dnd35e-srd-hypertext-d20::/srd/equipment/armor.htm" };

const SAMPLE_ARMOR = {
  canonicalId: "dnd35e:armor:chainmail",
  name: "Chainmail",
  category: "medium" as const,
  cost: { display: "150 gp", copperPieces: 15000 },
  armorOrShieldBonus: 5,
  maxDexBonus: 2,
  armorCheckPenalty: -5,
  arcaneSpellFailureChancePercent: 30,
  speedAt30FtBaseFt: 20,
  speedAt20FtBaseFt: 15,
  weightLb: 40,
  footnotes: [],
  extractionStatus: "fully_structured" as const,
  extractionNotes: [],
};

test("upsertDnd35eArmorDefinition inserts a new row", () => {
  const row = storage.upsertDnd35eArmorDefinition(SAMPLE_ARMOR, REAL_EVIDENCE);
  assert.equal(row.canonicalId, "dnd35e:armor:chainmail");
  assert.equal(row.category, "medium");
});

test("upsertDnd35eArmorDefinition throws on an invalid canonical ID", () => {
  assert.throws(() => storage.upsertDnd35eArmorDefinition({ ...SAMPLE_ARMOR, canonicalId: "not-a-canonical-id" }, REAL_EVIDENCE));
});

test("upsertDnd35eArmorDefinition throws on a well-formed canonical ID with the wrong entity type", () => {
  assert.throws(() => storage.upsertDnd35eArmorDefinition({ ...SAMPLE_ARMOR, canonicalId: "dnd35e:weapon:chainmail" }, REAL_EVIDENCE));
});

test("upsertDnd35eArmorDefinition is a no-op (no revision) when structured content is unchanged", () => {
  storage.upsertDnd35eArmorDefinition(SAMPLE_ARMOR, REAL_EVIDENCE);
  const before = storage.getRevisionHistory("dnd35e:armor:chainmail").length;
  storage.upsertDnd35eArmorDefinition(SAMPLE_ARMOR, REAL_EVIDENCE);
  const after = storage.getRevisionHistory("dnd35e:armor:chainmail").length;
  assert.equal(after, before, "identical content must never record a new revision");
});

test("getDnd35eArmorDefinition round-trips the full structured shape, including negative armorCheckPenalty and null speed fields", () => {
  storage.upsertDnd35eArmorDefinition(
    { ...SAMPLE_ARMOR, canonicalId: "dnd35e:armor:shield-tower", name: "Shield, tower", speedAt30FtBaseFt: null, speedAt20FtBaseFt: null },
    REAL_EVIDENCE,
  );
  const row = storage.getDnd35eArmorDefinition("dnd35e:armor:shield-tower");
  assert.equal(row?.speedAt30FtBaseFt, null);
  assert.equal(row?.armorCheckPenalty, -5);
  assert.deepEqual(row?.cost, { display: "150 gp", copperPieces: 15000 });
});

test("listDnd35eArmorDefinitions filters by extractionStatus", () => {
  storage.upsertDnd35eArmorDefinition(SAMPLE_ARMOR, REAL_EVIDENCE);
  storage.upsertDnd35eArmorDefinition(
    { ...SAMPLE_ARMOR, canonicalId: "dnd35e:armor:some-partial-one", extractionStatus: "partially_structured", extractionNotes: ["real reason"] },
    REAL_EVIDENCE,
  );
  const partial = storage.listDnd35eArmorDefinitions({ extractionStatus: "partially_structured" });
  assert.ok(partial.every((a) => a.extractionStatus === "partially_structured"));
  assert.ok(partial.some((a) => a.canonicalId === "dnd35e:armor:some-partial-one"));
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
