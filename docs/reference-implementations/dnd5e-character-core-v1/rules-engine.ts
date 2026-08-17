// Reference implementation only.

import type { Dnd5eCharacterState } from "./domain";
import type { Dnd5eSheetRuntime } from "./sheet-projector";
import { projectDnd5eSheet } from "./sheet-projector";
import { buildTrustedDnd5eAiContext, renderTrustedDnd5eAiContext } from "./ai-context";
import { assertProfileSafeRuntime } from "./runtime-adapters";
import { validateOriginAbilityChoices } from "./origin";
import { validateAttunement } from "./rest-and-runtime";
import { validateModifierProfile } from "./modifiers";
import { withCanonicalProjections } from "./canonical-authority";
import { exhaustion2014 } from "./conditions-2014";
import { exhaustion2024 } from "./conditions-2024";

export type ResolvedDnd5eCharacter = {
  sheet: ReturnType<typeof projectDnd5eSheet>;
  aiContext: ReturnType<typeof buildTrustedDnd5eAiContext>;
  aiPromptBlock: string;
  exhaustion: ReturnType<typeof exhaustion2014> | ReturnType<typeof exhaustion2024>;
  warnings: string[];
};

export function resolveDnd5eCharacter(state:Dnd5eCharacterState,runtime:Dnd5eSheetRuntime):ResolvedDnd5eCharacter{
  const canonical=withCanonicalProjections(state);
  const warnings:string[]=[
    ...validateOriginAbilityChoices(canonical),
    ...validateAttunement(canonical,canonical.attunement.filter(a=>a.attuned).map(a=>a.itemId)),
    ...assertProfileSafeRuntime(canonical.rulesProfileId,runtime.equipment,[]),
    ...validateModifierProfile(canonical.rulesProfileId,[...runtime.numericModifiers,...runtime.rollStateModifiers]),
  ];
  const sheet=projectDnd5eSheet(canonical,runtime);
  const exhaustion=canonical.rulesProfileId==="dnd5e-2024"?exhaustion2024(runtime.exhaustion):exhaustion2014(runtime.exhaustion);
  if(exhaustion.dead) warnings.push("Exhaustion level is lethal under the selected rules profile.");
  const aiContext=buildTrustedDnd5eAiContext(sheet,warnings);
  return {sheet,aiContext,aiPromptBlock:renderTrustedDnd5eAiContext(aiContext),exhaustion,warnings};
}

export const RULES_ENGINE_BOUNDARY=[
  "Input: canonical permanent character state plus authoritative runtime item/effect/resource state.",
  "Output: derived sheet/AI/combat facts and validation warnings.",
  "No database writes occur inside pure resolution helpers.",
  "All writes go through explicit server transactions after validation.",
] as const;
