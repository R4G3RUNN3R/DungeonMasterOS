// server/dnd35e/class-spell-list-storage.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-dnd35e-spelllist-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("../storage");
runMigrations();

const REAL_EVIDENCE = { kind: "open_canonical" as const, sourcePageKey: "dnd35e-srd-hypertext-d20::/srd/spellLists/clericSpells.htm" };

const SAMPLE_LIST = {
  canonicalId: "dnd35e:class-spell-list:cleric",
  classCanonicalId: "dnd35e:class:cleric",
  entries: [
    { spellCanonicalId: "dnd35e:spell:create-water", name: "Create Water", level: 0, componentMarkers: [], summary: "Creates 2 gallons/level of pure water." },
    { spellCanonicalId: "dnd35e:spell:bless-water", name: "Bless Water", level: 1, componentMarkers: ["M"], summary: "Makes holy water." },
  ],
  extractionStatus: "fully_structured" as const,
  extractionNotes: [],
};

test("upsertDnd35eClassSpellList inserts a new row", () => {
  const row = storage.upsertDnd35eClassSpellList(SAMPLE_LIST, REAL_EVIDENCE);
  assert.equal(row.canonicalId, "dnd35e:class-spell-list:cleric");
  assert.equal(row.classCanonicalId, "dnd35e:class:cleric");
});

test("upsertDnd35eClassSpellList throws on an invalid canonical ID rather than silently accepting it", () => {
  assert.throws(() => storage.upsertDnd35eClassSpellList({ ...SAMPLE_LIST, canonicalId: "not-a-canonical-id" }, REAL_EVIDENCE));
});

test("upsertDnd35eClassSpellList throws on a well-formed canonical ID with the wrong entity type", () => {
  assert.throws(() => storage.upsertDnd35eClassSpellList({ ...SAMPLE_LIST, canonicalId: "dnd35e:class:cleric" }, REAL_EVIDENCE));
});

test("upsertDnd35eClassSpellList is a no-op (no revision) when the structured content is unchanged", () => {
  storage.upsertDnd35eClassSpellList(SAMPLE_LIST, REAL_EVIDENCE);
  const before = storage.getRevisionHistory("dnd35e:class-spell-list:cleric").length;
  storage.upsertDnd35eClassSpellList(SAMPLE_LIST, REAL_EVIDENCE);
  const after = storage.getRevisionHistory("dnd35e:class-spell-list:cleric").length;
  assert.equal(after, before, "identical content must never record a new revision");
});

test("getDnd35eClassSpellList round-trips the full structured shape, including entries with component markers", () => {
  storage.upsertDnd35eClassSpellList(SAMPLE_LIST, REAL_EVIDENCE);
  const row = storage.getDnd35eClassSpellList("dnd35e:class-spell-list:cleric");
  assert.deepEqual(row?.entries, SAMPLE_LIST.entries);
});

test("listDnd35eClassSpellLists lists all real rows", () => {
  storage.upsertDnd35eClassSpellList(SAMPLE_LIST, REAL_EVIDENCE);
  storage.upsertDnd35eClassSpellList({ ...SAMPLE_LIST, canonicalId: "dnd35e:class-spell-list:druid", classCanonicalId: "dnd35e:class:druid" }, REAL_EVIDENCE);
  const all = storage.listDnd35eClassSpellLists();
  assert.ok(all.some((l) => l.canonicalId === "dnd35e:class-spell-list:cleric"));
  assert.ok(all.some((l) => l.canonicalId === "dnd35e:class-spell-list:druid"));
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
