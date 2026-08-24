// server/dnd35e/weapon-definitions-storage.test.ts
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-dnd35e-weapons-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("../storage");
runMigrations();

const REAL_EVIDENCE = { kind: "open_canonical" as const, sourcePageKey: "dnd35e-srd-hypertext-d20::/srd/equipment/weapons.htm" };

const SAMPLE_WEAPON = {
  canonicalId: "dnd35e:weapon:longsword",
  name: "Longsword",
  proficiencyCategory: "martial" as const,
  weaponGroup: "one-handed-melee" as const,
  cost: { display: "15 gp", copperPieces: 1500 },
  damageSmall: "1d6",
  damageMedium: "1d8",
  criticalThreatRangeLow: 19,
  criticalMultiplier: 2,
  rangeIncrementFt: null,
  weightLb: 4,
  damageTypes: ["Slashing"],
  damageTypeJoin: null,
  footnotes: [],
  extractionStatus: "fully_structured" as const,
  extractionNotes: [],
};

const SAMPLE_AMMUNITION = {
  canonicalId: "dnd35e:ammunition:arrows",
  name: "Arrows",
  weaponGroup: "ranged" as const,
  cost: { display: "1 gp", copperPieces: 100 },
  quantityPerPurchase: 20,
  weightLb: 3,
  extractionStatus: "fully_structured" as const,
  extractionNotes: [],
};

test("upsertDnd35eWeaponDefinition inserts a new row", () => {
  const row = storage.upsertDnd35eWeaponDefinition(SAMPLE_WEAPON, REAL_EVIDENCE);
  assert.equal(row.canonicalId, "dnd35e:weapon:longsword");
  assert.equal(row.proficiencyCategory, "martial");
});

test("upsertDnd35eWeaponDefinition throws on an invalid canonical ID", () => {
  assert.throws(() => storage.upsertDnd35eWeaponDefinition({ ...SAMPLE_WEAPON, canonicalId: "not-a-canonical-id" }, REAL_EVIDENCE));
});

test("upsertDnd35eWeaponDefinition throws on a well-formed canonical ID with the wrong entity type", () => {
  assert.throws(() => storage.upsertDnd35eWeaponDefinition({ ...SAMPLE_WEAPON, canonicalId: "dnd35e:spell:longsword" }, REAL_EVIDENCE));
});

test("upsertDnd35eWeaponDefinition is a no-op (no revision) when structured content is unchanged", () => {
  storage.upsertDnd35eWeaponDefinition(SAMPLE_WEAPON, REAL_EVIDENCE);
  const before = storage.getRevisionHistory("dnd35e:weapon:longsword").length;
  storage.upsertDnd35eWeaponDefinition(SAMPLE_WEAPON, REAL_EVIDENCE);
  const after = storage.getRevisionHistory("dnd35e:weapon:longsword").length;
  assert.equal(after, before, "identical content must never record a new revision");
});

test("getDnd35eWeaponDefinition round-trips the full structured shape, including null criticalThreatRangeLow/rangeIncrementFt and a real footnotes array", () => {
  storage.upsertDnd35eWeaponDefinition(
    { ...SAMPLE_WEAPON, canonicalId: "dnd35e:weapon:net", name: "Net", criticalThreatRangeLow: null, criticalMultiplier: null, footnotes: [] },
    REAL_EVIDENCE,
  );
  const row = storage.getDnd35eWeaponDefinition("dnd35e:weapon:net");
  assert.equal(row?.criticalThreatRangeLow, null);
  assert.deepEqual(row?.cost, { display: "15 gp", copperPieces: 1500 });
});

test("listDnd35eWeaponDefinitions filters by extractionStatus", () => {
  storage.upsertDnd35eWeaponDefinition(SAMPLE_WEAPON, REAL_EVIDENCE);
  storage.upsertDnd35eWeaponDefinition(
    { ...SAMPLE_WEAPON, canonicalId: "dnd35e:weapon:some-partial-one", extractionStatus: "partially_structured", extractionNotes: ["real reason"] },
    REAL_EVIDENCE,
  );
  const partial = storage.listDnd35eWeaponDefinitions({ extractionStatus: "partially_structured" });
  assert.ok(partial.every((w) => w.extractionStatus === "partially_structured"));
  assert.ok(partial.some((w) => w.canonicalId === "dnd35e:weapon:some-partial-one"));
});

test("upsertDnd35eAmmunitionDefinition inserts and round-trips a real ammunition record", () => {
  const row = storage.upsertDnd35eAmmunitionDefinition(SAMPLE_AMMUNITION, REAL_EVIDENCE);
  assert.equal(row.canonicalId, "dnd35e:ammunition:arrows");
  assert.equal(row.quantityPerPurchase, 20);
  const fetched = storage.getDnd35eAmmunitionDefinition("dnd35e:ammunition:arrows");
  assert.deepEqual(fetched?.cost, SAMPLE_AMMUNITION.cost);
});

test("upsertDnd35eAmmunitionDefinition throws on the wrong entity type", () => {
  assert.throws(() => storage.upsertDnd35eAmmunitionDefinition({ ...SAMPLE_AMMUNITION, canonicalId: "dnd35e:weapon:arrows" }, REAL_EVIDENCE));
});

test("listDnd35eAmmunitionDefinitions returns inserted rows", () => {
  storage.upsertDnd35eAmmunitionDefinition(SAMPLE_AMMUNITION, REAL_EVIDENCE);
  const all = storage.listDnd35eAmmunitionDefinitions();
  assert.ok(all.some((a) => a.canonicalId === "dnd35e:ammunition:arrows"));
});

test("recordDnd35eWeaponCrossCheckResult inserts and getDnd35eWeaponCrossCheckResults retrieves it", () => {
  storage.recordDnd35eWeaponCrossCheckResult({
    canonicalId: "dnd35e:weapon:longsword",
    primarySourcePageKey: "dnd35e-srd-hypertext-d20::/srd/equipment/weapons.htm",
    crossCheckSourcePageKey: "dnd35e-srd-olimot-mirror::basic-rules-and-legal/equipment.html",
    agreementStatus: "matches",
    conflictingFields: [],
  });
  const results = storage.getDnd35eWeaponCrossCheckResults("dnd35e:weapon:longsword");
  assert.equal(results.length, 1);
  assert.equal(results[0].agreementStatus, "matches");
});

test("recordDnd35eWeaponCrossCheckResult upserts on (canonicalId, crossCheckSourcePageKey) — re-recording the same real pair updates rather than duplicating", () => {
  const crossCheckSourcePageKey = "dnd35e-srd-olimot-mirror::basic-rules-and-legal/equipment.html";
  storage.recordDnd35eWeaponCrossCheckResult({
    canonicalId: "dnd35e:weapon:dagger",
    primarySourcePageKey: "dnd35e-srd-hypertext-d20::/srd/equipment/weapons.htm",
    crossCheckSourcePageKey,
    agreementStatus: "matches",
    conflictingFields: [],
  });
  storage.recordDnd35eWeaponCrossCheckResult({
    canonicalId: "dnd35e:weapon:dagger",
    primarySourcePageKey: "dnd35e-srd-hypertext-d20::/srd/equipment/weapons.htm",
    crossCheckSourcePageKey,
    agreementStatus: "conflicts",
    conflictingFields: ["weightLb"],
  });
  const results = storage.getDnd35eWeaponCrossCheckResults("dnd35e:weapon:dagger");
  assert.equal(results.length, 1, "re-recording the same real (canonicalId, transport) pair must update, not duplicate");
  assert.equal(results[0].agreementStatus, "conflicts");
  assert.deepEqual(results[0].conflictingFields, ["weightLb"]);
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
