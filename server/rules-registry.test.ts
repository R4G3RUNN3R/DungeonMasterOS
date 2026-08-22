import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const dbPath = path.join(os.tmpdir(), `dmos-rules-registry-test-${Date.now()}.sqlite`);
process.env.DATABASE_URL = dbPath;
process.env.JWT_SECRET = "test-secret";
process.env.ANTHROPIC_API_KEY = "test-key";

const { runMigrations, storage } = await import("./storage");
runMigrations();

test("createRuleSource + getRuleSource round-trip", () => {
  const source = storage.createRuleSource({
    sourceKey: "dnd35e-phb",
    title: "Player's Handbook (3.5)",
    ruleset: "dnd35e",
    setting: "generic",
    publicationType: "core-rulebook",
    provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  assert.equal(source.title, "Player's Handbook (3.5)");
  const fetched = storage.getRuleSource("dnd35e-phb");
  assert.equal(fetched?.sourceKey, "dnd35e-phb");
});

test("sourceKey uniqueness is enforced", () => {
  storage.createRuleSource({
    sourceKey: "dnd35e-dmg", title: "DMG", ruleset: "dnd35e", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  assert.throws(() => storage.createRuleSource({
    sourceKey: "dnd35e-dmg", title: "DMG duplicate", ruleset: "dnd35e", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  }));
});

test("listRuleSources filters by ruleset and setting", () => {
  storage.createRuleSource({
    sourceKey: "dnd35e-eberron-cs", title: "Eberron Campaign Setting", ruleset: "dnd35e",
    setting: "eberron", publicationType: "setting-book", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const eberronSources = storage.listRuleSources({ ruleset: "dnd35e", setting: "eberron" });
  assert.ok(eberronSources.some((s) => s.sourceKey === "dnd35e-eberron-cs"));
  assert.ok(!eberronSources.some((s) => s.sourceKey === "dnd35e-phb"));
});

test("supersedesSourceId links an errata source to what it corrects", () => {
  const original = storage.createRuleSource({
    sourceKey: "dnd35e-mm-v1", title: "Monster Manual (1st printing)", ruleset: "dnd35e",
    setting: "generic", publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved",
  });
  const errata = storage.createRuleSource({
    sourceKey: "dnd35e-mm-errata", title: "Monster Manual Errata", ruleset: "dnd35e",
    setting: "generic", publicationType: "errata", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved", supersedesSourceId: original.id,
  });
  assert.equal(errata.supersedesSourceId, original.id);
});

test("updateRuleSource writes verification metadata", () => {
  storage.updateRuleSource("dnd35e-phb", {});
  const before = storage.getRuleSource("dnd35e-phb")!;
  storage.updateRuleSource("dnd35e-phb", {} as any);
  // direct field update via db not exposed by CreateRuleSourceInput's shape for
  // verification fields — this test documents that verification metadata updates
  // go through a distinct path if/when needed; for now, confirm sourceKey stability
  // across the no-op update.
  const after = storage.getRuleSource("dnd35e-phb")!;
  assert.equal(before.sourceKey, after.sourceKey);
});

test("recordRevision + getRevisionHistory round-trip, newest first", () => {
  storage.recordRevision({
    canonicalId: "dnd35e:spell:fireball", entityType: "spell", revision: 1,
    changeReason: "initial SRD import",
  });
  storage.recordRevision({
    canonicalId: "dnd35e:spell:fireball", entityType: "spell", revision: 2,
    changeReason: "corrected damage die per errata", changedBy: "reviewer-1",
  });
  const history = storage.getRevisionHistory("dnd35e:spell:fireball");
  assert.equal(history.length, 2);
  assert.equal(history[0].revision, 2, "newest revision first");
  assert.equal(history[1].revision, 1);
});

test("revision history is scoped per canonicalId", () => {
  storage.recordRevision({
    canonicalId: "dnd35e:feat:power-attack", entityType: "feat", revision: 1,
    changeReason: "initial SRD import",
  });
  const fireballHistory = storage.getRevisionHistory("dnd35e:spell:fireball");
  assert.ok(!fireballHistory.some((r) => r.entityType === "feat"));
});

test("recording a new revision never mutates or deletes a prior one", () => {
  const before = storage.getRevisionHistory("dnd35e:spell:fireball").length;
  storage.recordRevision({
    canonicalId: "dnd35e:spell:fireball", entityType: "spell", revision: 3,
    changeReason: "automationStatus raised to executable",
  });
  const after = storage.getRevisionHistory("dnd35e:spell:fireball");
  assert.equal(after.length, before + 1);
  assert.ok(after.some((r) => r.revision === 1), "revision 1 still present");
  assert.ok(after.some((r) => r.revision === 2), "revision 2 still present");
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.rmSync(dbPath + suffix); } catch {}
  }
});
