// Reference implementation only. SRD 5.1 exposes Grappler as the public feat example.
// Additional 2014 PHB/commercial feats belong in owned/licensed source packs.

import type { Dnd5eFeatDefinition } from "./feat-types";

export const DND5E_2014_FEATS: Record<string,Dnd5eFeatDefinition> = {
  grappler: {
    profileId: "dnd5e-2014",
    id: "grappler",
    displayName: "Grappler",
    category: "2014-feat",
    prerequisites: [{ type: "ability-minimum", ability: "str", minimum: 13 }],
    choices: [],
    rules: [
      { kind: "advantage", data: { attacksAgainstCreatureYouAreGrappling: true } },
      { kind: "action", data: { pinGrappledCreatureWithAnotherGrappleCheck: true, successRestrainsBoth: true } },
    ],
    notes: [
      "The SRD 5.1 public feat sample is not a complete catalogue of every 2014 Player's Handbook feat.",
      "Do not publish non-SRD commercial feat mechanics into the public reference merely to make the list look complete.",
    ],
  },
};

export function get2014Feat(id:string): Dnd5eFeatDefinition | undefined {
  return DND5E_2014_FEATS[id];
}
