import assert from "node:assert/strict";
import test from "node:test";
import { parseDnd35SrdSpellItems } from "./dnd35-srd-spell-items-importer";

const potions = `# MAGIC ITEMS III
<table><caption>Table: Potions and Oils</caption><tbody>
<tr><th>Minor</th><th>Medium</th><th>Major</th><th>Potion or Oil</th><th>Market Price</th></tr>
<tr><td>01</td><td>—</td><td>—</td><td><i>Cure light wounds</i> (potion)</td><td>50 gp</td></tr>
<tr><td>02</td><td>—</td><td>—</td><td><i>Invisibility</i> (potion or oil)</td><td>300 gp</td></tr>
</tbody></table>`;

const spellItems = `# MAGIC ITEMS IV
<table><caption>Table: Arcane Spell Scrolls</caption><tbody>
<tr><th colspan="3"><i>0-Level Arcane Spells</i></th></tr>
<tr><th>d%</th><th>Spell</th><th>Market Price</th></tr>
<tr><td>01</td><td><i>detect magic</i></td><td>12 gp 5 sp</td></tr>
<tr><th colspan="3"><i>2nd-Level Arcane Spells</i></th></tr>
<tr><th>d%</th><th>Spell</th><th>Market Price</th></tr>
<tr><td>01</td><td><i>acid arrow</i></td><td>150 gp</td></tr>
</tbody></table>
<table><caption>Table: Divine Spell Scrolls</caption><tbody>
<tr><th colspan="3"><i>1st-Level Divine Spells</i></th></tr>
<tr><th>d%</th><th>Spell</th><th>Market Price</th></tr>
<tr><td>01</td><td><i>bless</i></td><td>25 gp</td></tr>
</tbody></table>
## Staff Descriptions
**Fire:** A bronze-bound staff allows use of the following spells:
- _Burning hands_ (1 charge)
- _Fireball_ (2 charges)

Moderate evocation; CL 8th; Craft Staff, burning hands, fireball; Price 17,750 gp.

## Wands
<table><caption>Table: Wands</caption><tbody>
<tr><th>Minor</th><th>Medium</th><th>Major</th><th>Wand</th><th>Market Price</th></tr>
<tr><td>01</td><td>—</td><td>—</td><td><i>Detect magic</i></td><td>375 gp</td></tr>
<tr><td>02</td><td>—</td><td>—</td><td><i>Magic missile (3rd)</i></td><td>2,250 gp</td></tr>
</tbody></table>`;

test("spell-item importer creates separate potion and oil variants", () => {
  const items = parseDnd35SrdSpellItems(potions, spellItems);
  assert.ok(items.some((item) => item.id === "potion:invisibility" && item.magic?.activation === "use-activated"));
  assert.ok(items.some((item) => item.id === "oil:invisibility" && item.magic?.activation === "use-activated"));
  const cure = items.find((item) => item.id === "potion:cure-light-wounds")!;
  assert.equal(cure.magic?.charges, 1);
  assert.equal(cure.magic?.consumesOnUse, true);
  assert.equal(cure.magic?.spellIds?.[0], "cure-light-wounds");
});

test("scroll importer captures tradition spell level caster level and mixed denomination price", () => {
  const items = parseDnd35SrdSpellItems(potions, spellItems);
  const detect = items.find((item) => item.id === "scroll:arcane:0:detect-magic")!;
  assert.equal(detect.price?.amount, 12.5);
  assert.equal(detect.magic?.spellUses?.[0].tradition, "arcane");
  assert.equal(detect.magic?.spellUses?.[0].spellLevel, 0);
  assert.equal(detect.magic?.spellUses?.[0].casterLevel, 1);

  const acidArrow = items.find((item) => item.id === "scroll:arcane:2:acid-arrow")!;
  assert.equal(acidArrow.magic?.spellUses?.[0].casterLevel, 3);
});

test("wand and staff importer preserve charges and caster-level variants", () => {
  const items = parseDnd35SrdSpellItems(potions, spellItems);
  const wand = items.find((item) => item.id === "wand:magic-missile-3rd")!;
  assert.equal(wand.magic?.charges, 50);
  assert.equal(wand.magic?.spellIds?.[0], "magic-missile");
  assert.equal(wand.magic?.casterLevel, 3);

  const staff = items.find((item) => item.id === "staff:fire")!;
  assert.equal(staff.magic?.charges, 50);
  assert.equal(staff.magic?.casterLevel, 8);
  assert.deepEqual(staff.magic?.spellUses?.map((use) => [use.spellId, use.charges]), [["burning-hands", 1], ["fireball", 2]]);
  assert.equal(staff.price?.amount, 17750);
});
