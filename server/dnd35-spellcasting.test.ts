import assert from "node:assert/strict";
import test from "node:test";
import { getDnd35Spell } from "@shared/dnd35-rules/catalogue";
import { consumeCharacterDnd35SpellUse, resolveCharacterDnd35SpellCast } from "./dnd35-spellcasting";

function wizardCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    campaignId: 55,
    visitorId: "user-1",
    userId: 1,
    name: "Test Wizard",
    race: "Human",
    charClass: "Wizard",
    traits: "",
    backstory: "",
    level: 5,
    xp: 10000,
    hp: 20,
    maxHp: 20,
    tempHp: 0,
    speed: 30,
    attacksPerRound: 1,
    status: "alive",
    inventory: "[]",
    str: 10,
    dex: 12,
    con: 12,
    int: 16,
    wis: 12,
    cha: 10,
    ac: 10,
    attackAbility: "str",
    proficiencies: "[]",
    characterData: JSON.stringify({
      dnd35Sheet: {
        version: 1,
        system: "D&D 3.5e",
        spellcasting: [
          {
            casterClass: "Wizard",
            casterLevel: 5,
            castingAbility: "int",
            spellsPerDay: { "1": 4, "2": 3, "3": 2 },
            spells: [
              { name: "Fireball", level: 3, slotLevel: 3, prepared: 1, used: 0, known: true },
              { name: "Magic Missile", level: 1, slotLevel: 1, prepared: 1, used: 0, known: true },
            ],
          },
        ],
      },
    }),
    ...overrides,
  } as any;
}

const pouch = {
  id: 500,
  campaignId: 55,
  characterId: 101,
  name: "Spell Component Pouch",
  trueName: "",
  description: "Contains ordinary arcane material components.",
  trueDescription: "",
  itemType: "gear",
  quantity: 1,
  charges: null,
  maxCharges: null,
  identified: true,
  consumable: false,
  equipped: false,
  locationNote: "",
  source: "manual",
  statMods: "[]",
  weaponDamageDice: null,
  weight: 2,
  carried: true,
} as any;

test("prepared wizard Fireball is legal only from real recorded spell state", () => {
  const spell = getDnd35Spell("fireball");
  assert.ok(spell);

  const result = resolveCharacterDnd35SpellCast(
    wizardCharacter(),
    spell!,
    "I cast Fireball at the cluster of enemies.",
    [pouch],
    [],
  );

  assert.equal(result.unavailableReason, undefined);
  assert.equal(result.resolution?.legal, true);
  assert.equal(result.resolution?.baseSpellLevel, 3);
  assert.equal(result.resolution?.slotLevel, 3);
  assert.equal(result.resolution?.saveDc, 16);
});

test("Fireball is blocked when its material component cannot be satisfied", () => {
  const spell = getDnd35Spell("fireball")!;
  const result = resolveCharacterDnd35SpellCast(
    wizardCharacter(),
    spell,
    "I cast Fireball.",
    [],
    [],
  );

  assert.equal(result.resolution?.legal, false);
  assert.ok(result.resolution?.decisions.some((decision) => decision.code === "MATERIAL_COMPONENT" && !decision.passed));
});

test("prepared casting is blocked after the prepared copy is expended", () => {
  const data = JSON.parse(wizardCharacter().characterData);
  data.dnd35Sheet.spellcasting[0].spells[0].used = 1;
  const character = wizardCharacter({ characterData: JSON.stringify(data) });
  const result = resolveCharacterDnd35SpellCast(character, getDnd35Spell("fireball")!, "I cast Fireball.", [pouch], []);

  assert.equal(result.resolution?.legal, false);
  assert.ok(result.resolution?.decisions.some((decision) => decision.code === "PREPARED" && !decision.passed));
});

test("successful spell use persists slot expenditure and prepared use", () => {
  const character = wizardCharacter();
  const spell = getDnd35Spell("fireball")!;
  const result = resolveCharacterDnd35SpellCast(character, spell, "I cast Fireball.", [pouch], []);
  assert.equal(result.resolution?.legal, true);

  let updatedData = "";
  const fakeStorage = {
    updateCharacter: (_id: number, updates: { characterData?: string }) => {
      updatedData = updates.characterData || "";
    },
  };
  consumeCharacterDnd35SpellUse(character, spell, result.resolution!, fakeStorage);

  const parsed = JSON.parse(updatedData);
  const block = parsed.dnd35Sheet.spellcasting[0];
  assert.equal(block.spellSlotsExpended["3"], 1);
  assert.equal(block.spells.find((entry: any) => entry.name === "Fireball").used, 1);
});
