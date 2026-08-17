// Reference implementation only. SRD 5.1 exposes Acolyte as its player-background example.
// Other 2014 PHB/commercial backgrounds belong in campaign-enabled owned/licensed source packs.

import type { Dnd5eBackgroundDefinition } from "./background-types";

export const DND5E_2014_BACKGROUNDS: Record<string, Dnd5eBackgroundDefinition> = {
  acolyte: {
    profileId: "dnd5e-2014",
    id: "acolyte",
    displayName: "Acolyte",
    fixedSkillProficiencies: ["insight", "religion"],
    languageChoiceCount: 2,
    featureId: "shelter-of-the-faithful",
    equipment: {
      packageA: ["holy-symbol", "prayer-book-or-wheel", "incense-x5", "vestments", "common-clothes"],
      packageACoinGp: 15,
    },
    choices: [
      { choiceId: "acolyte:languages", count: 2, options: "any-language", description: "Choose two languages." },
    ],
  },
};

export function get2014Background(id: string): Dnd5eBackgroundDefinition | undefined {
  return DND5E_2014_BACKGROUNDS[id];
}
