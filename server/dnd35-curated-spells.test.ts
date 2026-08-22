import assert from "node:assert/strict";
import test from "node:test";
import { DND35_SPELLS, getDnd35Spell, getDnd35Grimoire, getDnd35HolyTome } from "@shared/dnd35-rules/catalogue";

const NEW_EXECUTABLE_IDS = [
  "grease",
  "sleep",
  "mage-armor",
  "shield",
  "burning-hands",
  "scorching-ray",
  "lightning-bolt",
  "haste",
  "slow",
  "invisibility",
  "hold-person",
  "web",
] as const;

test("expanded curated foundation contains the verified combat/control spell pack", () => {
  for (const id of NEW_EXECUTABLE_IDS) assert.ok(getDnd35Spell(id), `missing ${id}`);
  assert.ok(DND35_SPELLS.length >= 16, "foundation should contain original seed plus expanded spell pack");
});

test("Haste and Slow retain their canonical counter relationship", () => {
  assert.deepEqual(getDnd35Spell("haste")?.counterspells, ["slow"]);
  assert.deepEqual(getDnd35Spell("slow")?.counterspells, ["haste"]);
});

test("class-list levels remain edition-correct for representative expanded spells", () => {
  const scorchingRay = getDnd35Spell("scorching-ray")!;
  assert.equal(scorchingRay.classAccess.find((entry) => entry.classId === "wizard")?.level, 2);
  assert.equal(scorchingRay.classAccess.find((entry) => entry.classId === "sorcerer")?.level, 2);

  const holdPerson = getDnd35Spell("hold-person")!;
  assert.equal(holdPerson.classAccess.find((entry) => entry.classId === "cleric")?.level, 2);
  assert.equal(holdPerson.classAccess.find((entry) => entry.classId === "bard")?.level, 2);
  assert.equal(holdPerson.classAccess.find((entry) => entry.classId === "wizard")?.level, 3);
});

test("arcane and divine projections remain views over the same canonical records", () => {
  const grimoire = new Set(getDnd35Grimoire().map((spell) => spell.id));
  const holyTome = new Set(getDnd35HolyTome().map((spell) => spell.id));
  assert.ok(grimoire.has("hold-person"));
  assert.ok(holyTome.has("hold-person"));
  assert.ok(grimoire.has("invisibility"));
  assert.ok(!holyTome.has("invisibility"), "domain-only access is not a base divine class-list entry");
});

test("tradition-dependent slash components are encoded as alternatives", () => {
  const hold = getDnd35Spell("hold-person")!;
  const focus = hold.components.find((component) => component.kind === "F");
  const divineFocus = hold.components.find((component) => component.kind === "DF");
  assert.equal(focus?.appliesToTradition, "arcane");
  assert.equal(divineFocus?.appliesToTradition, "divine");
  assert.equal(focus?.alternativeGroup, divineFocus?.alternativeGroup);
});
