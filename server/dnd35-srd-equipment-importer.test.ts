import assert from "node:assert/strict";
import test from "node:test";
import { parseDnd35SrdEquipmentDocument } from "./dnd35-srd-equipment-importer";

const source = `# EQUIPMENT

<table><caption>Table: Weapons</caption><tbody>
<tr><th>Simple Weapons</th><th>Cost</th><th>Dmg (S)</th><th>Dmg (M)</th><th>Critical</th><th>Range Increment</th><th>Weight</th><th>Type</th></tr>
<tr><td colspan="8"><i>Light Melee Weapons</i></td></tr>
<tr><td>Dagger</td><td>2 gp</td><td>1d3</td><td>1d4</td><td>19–20/x2</td><td>10 ft.</td><td>1 lb.</td><td>Piercing or slashing</td></tr>
<tr><th>Martial Weapons</th><th>Cost</th><th>Dmg (S)</th><th>Dmg (M)</th><th>Critical</th><th>Range Increment</th><th>Weight</th><th>Type</th></tr>
<tr><td colspan="8"><i>Two-Handed Melee Weapons</i></td></tr>
<tr><td>Glaive</td><td>8 gp</td><td>1d8</td><td>1d10</td><td>x3</td><td>—</td><td>10 lb.</td><td>Slashing</td></tr>
</tbody></table>

**Dagger:** The dagger is a common secondary weapon. You get a +2 bonus on Sleight of Hand checks made to conceal it.

**Glaive:** A glaive is a reach weapon. You can strike opponents 10 feet away with it, but you can’t use it against an adjacent foe.

<table><caption>Table: Armor and Shields</caption><tbody>
<tr><th>Armor</th><th>Cost</th><th>Armor/Shield Bonus</th><th>Maximum Dex Bonus</th><th>Armor Check Penalty</th><th>Arcane Spell Failure Chance</th><th>(30 ft.)</th><th>(20 ft.)</th><th>Weight</th></tr>
<tr><td>Light armor</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
<tr><td>Leather</td><td>10 gp</td><td>+2</td><td>+6</td><td>0</td><td>10%</td><td>30 ft.</td><td>20 ft.</td><td>15 lb.</td></tr>
<tr><td>Shields</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
<tr><td>Shield, heavy steel</td><td>20 gp</td><td>+2</td><td>—</td><td>–2</td><td>15%</td><td>—</td><td>—</td><td>15 lb.</td></tr>
</tbody></table>

**Leather:** Leather armor is made of tough but flexible hide.

**Shield, Heavy Steel:** A heavy steel shield grants its shield bonus while carried properly.
`;

test("equipment parser captures D&D 3.5 weapon mechanics", () => {
  const items = parseDnd35SrdEquipmentDocument(source);
  const dagger = items.find((item) => item.id === "equipment:dagger")!;
  assert.equal(dagger.category, "weapon");
  assert.equal(dagger.price?.amount, 2);
  assert.equal(dagger.weightLb, 1);
  assert.equal(dagger.weapon?.proficiency, "simple");
  assert.equal(dagger.weapon?.usage, "light");
  assert.equal(dagger.weapon?.damageMedium, "1d4");
  assert.equal(dagger.weapon?.critical, "19–20/x2");
  assert.equal(dagger.weapon?.rangeIncrementFeet, 10);
  assert.deepEqual(dagger.weapon?.damageTypes, ["piercing", "slashing"]);
});

test("equipment parser carries reach and armor spell-failure rules", () => {
  const items = parseDnd35SrdEquipmentDocument(source);
  const glaive = items.find((item) => item.id === "equipment:glaive")!;
  assert.equal(glaive.weapon?.proficiency, "martial");
  assert.equal(glaive.weapon?.usage, "two-handed");
  assert.equal(glaive.weapon?.reach, true);

  const leather = items.find((item) => item.id === "equipment:leather")!;
  assert.equal(leather.category, "armor");
  assert.equal(leather.armor?.armorClass, "light");
  assert.equal(leather.armor?.armorOrShieldBonus, 2);
  assert.equal(leather.armor?.maximumDexBonus, 6);
  assert.equal(leather.armor?.arcaneSpellFailurePercent, 10);
  assert.equal(leather.armor?.speed30Feet, 30);

  const shield = items.find((item) => item.id === "equipment:shield-heavy-steel")!;
  assert.equal(shield.category, "shield");
  assert.equal(shield.armor?.armorCheckPenalty, -2);
  assert.equal(shield.armor?.arcaneSpellFailurePercent, 15);
});
