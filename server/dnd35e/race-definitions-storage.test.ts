// server/dnd35e/race-definitions-storage.test.ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-dnd35e-races-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("../storage");
runMigrations();

const REAL_EVIDENCE = { kind: "open_canonical" as const, sourcePageKey: "dnd35e-srd-hypertext-d20::/srd/races.htm" };

const SAMPLE_RACE = {
  canonicalId: "dnd35e:race:humans",
  name: "Humans",
  languages: { automatic: ["Common"], bonus: "any" as const },
  traits: [
    { kind: "size" as const, size: "medium" as const },
    { kind: "base_land_speed" as const, feet: 30 },
    { kind: "bonus_feat_count" as const, count: 1, when: "1st level" },
    { kind: "bonus_skill_points" as const, atFirstLevel: 4, perAdditionalLevel: 1 },
    { kind: "favored_class" as const, any: true, classCanonicalId: null, description: "Favored Class: Any." },
  ],
  extractionStatus: "fully_structured" as const,
  extractionNotes: [],
};

test("upsertDnd35eRaceDefinition inserts a new row", () => {
  const row = storage.upsertDnd35eRaceDefinition(SAMPLE_RACE, REAL_EVIDENCE);
  assert.equal(row.canonicalId, "dnd35e:race:humans");
  assert.equal(row.name, "Humans");
});

test("upsertDnd35eRaceDefinition throws on an invalid canonical ID rather than silently accepting it", () => {
  assert.throws(() => storage.upsertDnd35eRaceDefinition({ ...SAMPLE_RACE, canonicalId: "not-a-canonical-id" }, REAL_EVIDENCE));
});

test("upsertDnd35eRaceDefinition throws on a well-formed canonical ID from the wrong ruleset", () => {
  assert.throws(() => storage.upsertDnd35eRaceDefinition({ ...SAMPLE_RACE, canonicalId: "dnd5e:race:humans" }, REAL_EVIDENCE));
});

test("upsertDnd35eRaceDefinition throws on a well-formed canonical ID with the wrong entity type", () => {
  assert.throws(() => storage.upsertDnd35eRaceDefinition({ ...SAMPLE_RACE, canonicalId: "dnd35e:feat:humans" }, REAL_EVIDENCE));
});

test("upsertDnd35eRaceDefinition is a no-op (no revision) when the structured content is unchanged", () => {
  storage.upsertDnd35eRaceDefinition(SAMPLE_RACE, REAL_EVIDENCE);
  const before = storage.getRevisionHistory("dnd35e:race:humans").length;
  storage.upsertDnd35eRaceDefinition(SAMPLE_RACE, REAL_EVIDENCE);
  const after = storage.getRevisionHistory("dnd35e:race:humans").length;
  assert.equal(after, before, "identical content must never record a new revision");
});

test("upsertDnd35eRaceDefinition records a real revision when structured content genuinely changes", () => {
  storage.upsertDnd35eRaceDefinition(SAMPLE_RACE, REAL_EVIDENCE);
  const changed = { ...SAMPLE_RACE, traits: [...SAMPLE_RACE.traits, { kind: "special_ability" as const, name: "Test", description: "test" }] };
  storage.upsertDnd35eRaceDefinition(changed, REAL_EVIDENCE);
  const history = storage.getRevisionHistory("dnd35e:race:humans");
  assert.ok(history.length >= 1, "a genuine structured-content change must record a revision via the existing Phase 0/1 recordRevision, not a new mechanism");
});

test("getDnd35eRaceDefinition round-trips the full structured shape, including traits and languages", () => {
  storage.upsertDnd35eRaceDefinition(SAMPLE_RACE, REAL_EVIDENCE);
  const row = storage.getDnd35eRaceDefinition("dnd35e:race:humans");
  assert.deepEqual(row?.traits, SAMPLE_RACE.traits);
  assert.deepEqual(row?.languages, SAMPLE_RACE.languages);
});

test("listDnd35eRaceDefinitions filters by extractionStatus", () => {
  storage.upsertDnd35eRaceDefinition(SAMPLE_RACE, REAL_EVIDENCE);
  storage.upsertDnd35eRaceDefinition(
    { ...SAMPLE_RACE, canonicalId: "dnd35e:race:some-partial-one", extractionStatus: "partially_structured", extractionNotes: ["real reason"] },
    REAL_EVIDENCE,
  );
  const partial = storage.listDnd35eRaceDefinitions({ extractionStatus: "partially_structured" });
  assert.ok(partial.every((r) => r.extractionStatus === "partially_structured"));
  assert.ok(partial.some((r) => r.canonicalId === "dnd35e:race:some-partial-one"));
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
