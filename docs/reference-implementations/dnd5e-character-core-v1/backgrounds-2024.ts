// Reference implementation only. SRD 5.2.1 public backgrounds.

import type { Dnd5eBackgroundDefinition } from "./background-types";

const bg = (value: Dnd5eBackgroundDefinition) => value;

export const DND5E_2024_BACKGROUNDS: Record<string, Dnd5eBackgroundDefinition> = {
  acolyte: bg({
    profileId: "dnd5e-2024",
    id: "acolyte",
    displayName: "Acolyte",
    abilityOptions: ["int", "wis", "cha"],
    fixedSkillProficiencies: ["insight", "religion"],
    fixedToolProficiencies: ["calligrapher-supplies"],
    originFeatId: "magic-initiate-cleric",
    equipment: {
      packageA: ["calligrapher-supplies", "book-prayers", "holy-symbol", "parchment-x10", "robe"],
      packageACoinGp: 8,
      alternativeGp: 50,
    },
    choices: [],
  }),
  criminal: bg({
    profileId: "dnd5e-2024",
    id: "criminal",
    displayName: "Criminal",
    abilityOptions: ["dex", "con", "int"],
    fixedSkillProficiencies: ["sleight-of-hand", "stealth"],
    fixedToolProficiencies: ["thieves-tools"],
    originFeatId: "alert",
    equipment: {
      packageA: ["dagger-x2", "thieves-tools", "crowbar", "pouch-x2", "travelers-clothes"],
      packageACoinGp: 16,
      alternativeGp: 50,
    },
    choices: [],
  }),
  sage: bg({
    profileId: "dnd5e-2024",
    id: "sage",
    displayName: "Sage",
    abilityOptions: ["con", "int", "wis"],
    fixedSkillProficiencies: ["arcana", "history"],
    fixedToolProficiencies: ["calligrapher-supplies"],
    originFeatId: "magic-initiate-wizard",
    equipment: {
      packageA: ["quarterstaff", "calligrapher-supplies", "book-history", "parchment-x8", "robe"],
      packageACoinGp: 8,
      alternativeGp: 50,
    },
    choices: [],
  }),
  soldier: bg({
    profileId: "dnd5e-2024",
    id: "soldier",
    displayName: "Soldier",
    abilityOptions: ["str", "dex", "con"],
    fixedSkillProficiencies: ["athletics", "intimidation"],
    toolChoice: { count: 1, options: "gaming-sets" },
    originFeatId: "savage-attacker",
    equipment: {
      packageA: ["spear", "shortbow", "arrow-x20", "gaming-set-selected", "healers-kit", "quiver", "travelers-clothes"],
      packageACoinGp: 14,
      alternativeGp: 50,
    },
    choices: [
      { choiceId: "soldier:gaming-set", count: 1, options: "source-registry", description: "Choose one Gaming Set proficiency; the package uses the same set." },
    ],
  }),
};

export function get2024Background(id: string): Dnd5eBackgroundDefinition | undefined {
  return DND5E_2024_BACKGROUNDS[id];
}
