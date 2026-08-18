import assert from "node:assert/strict";
import test from "node:test";
import { parseDnd35SrdSpellDocument } from "./dnd35-srd-spell-importer";

test("SRD spell parser separates M/DF by casting tradition", () => {
  const source = `This material is Open Game Content.\n\n# SPELLS\n\n## Acid Fog\n\nConjuration (Creation) \\[Acid\\]\n\n**Level:** Sor/Wiz 6, Water 7\n\n**Components:** V, S, M/DF\n\n**Casting Time:** 1 standard action\n\n**Range:** Medium (100 ft. + 10 ft./level)\n\n**Effect:** Fog spreads in 20-ft. radius, 20 ft. high\n\n**Duration:** 1 round/level\n\n**Saving Throw:** None\n\n**Spell Resistance:** No\n\nThe fog deals acid damage to creatures and objects within it.\n\n_Arcane Material Component:_ A pinch of dried, powdered peas combined with powdered animal hoof.`;

  const [spell] = parseDnd35SrdSpellDocument(source, "spells/spells-a-b.md");
  assert.equal(spell.id, "acid-fog");
  assert.equal(spell.school, "conjuration");
  assert.equal(spell.subschool, "creation");
  assert.deepEqual(spell.descriptors, ["acid"]);
  assert.ok(spell.classAccess.some((entry) => entry.classId === "wizard" && entry.level === 6));
  assert.ok(spell.classAccess.some((entry) => entry.classId === "sorcerer" && entry.level === 6));
  assert.ok(spell.domainAccess?.some((entry) => entry.domainId === "water" && entry.level === 7));
  assert.ok(spell.components.some((entry: any) => entry.kind === "M" && entry.appliesToTradition === "arcane"));
  assert.ok(spell.components.some((entry: any) => entry.kind === "DF" && entry.appliesToTradition === "divine"));
  assert.equal(spell.range.kind, "medium");
  assert.equal(spell.duration.kind, "rounds_per_level");
  assert.match(spell.rulesText, /fog deals acid damage/);
  assert.equal((spell as any).executionStatus, "structured");
});

test("SRD spell parser preserves spells with omitted save and SR headers", () => {
  const source = `# SPELLS\n\n## Alter Self\n\nTransmutation\n\n**Level:** Brd 2, Sor/Wiz 2\n\n**Components:** V, S\n\n**Casting Time:** 1 standard action\n\n**Range:** Personal\n\n**Target:** You\n\n**Duration:** 10 min./level (D)\n\nYou assume the form of a creature of the same type as your normal form.`;

  const [spell] = parseDnd35SrdSpellDocument(source, "spells/spells-a-b.md");
  assert.equal(spell.id, "alter-self");
  assert.equal(spell.savingThrow.type, "none");
  assert.equal(spell.spellResistance.applies, false);
  assert.equal(spell.range.kind, "personal");
  assert.equal(spell.duration.kind, "ten_minutes_per_level");
  assert.ok(spell.targeting.delivery.includes("personal"));
});

test("SRD spell parser captures fixed costly focus information", () => {
  const source = `# SPELLS\n\n## Analyze Dweomer\n\nDivination\n\n**Level:** Brd 6, Sor/Wiz 6\n\n**Components:** V, S, F\n\n**Casting Time:** 1 standard action\n\n**Range:** Close (25 ft. + 5 ft./2 levels)\n\n**Targets:** One object or creature per caster level\n\n**Duration:** 1 round/level (D)\n\n**Saving Throw:** None or Will negates; see text\n\n**Spell Resistance:** No\n\nYou discern magical properties.\n\n_Focus:_ A tiny lens set in a golden loop. The gemstone must be worth at least 1,500 gp.`;

  const [spell] = parseDnd35SrdSpellDocument(source, "spells/spells-a-b.md");
  const focus = spell.components.find((entry) => entry.kind === "F");
  assert.equal(focus?.gpCost, 1500);
  assert.match(focus?.description ?? "", /1,500 gp/);
  assert.equal(spell.savingThrow.type, "special");
});
