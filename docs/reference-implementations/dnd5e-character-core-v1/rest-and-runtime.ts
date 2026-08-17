// Reference implementation only.

import type { Dnd5eCharacterState, Dnd5eDeathState } from "./domain";
import { maximumAttunementItems } from "./state-helpers";

export type ConcentrationCheck = {
  required: boolean;
  saveAbility: "con";
  dc: number;
  reason: string;
};

export function concentrationCheckFromDamage(damageTaken:number):ConcentrationCheck{
  return {
    required:damageTaken>0,
    saveAbility:"con",
    dc:Math.max(10,Math.floor(damageTaken/2)),
    reason:"Taking damage while concentrating requires a Constitution saving throw; DC is 10 or half the damage taken, whichever is higher.",
  };
}

export function concentrationEndsForCondition(conditionId:string):boolean{
  return conditionId.toLowerCase()==="incapacitated";
}

export function canStartConcentration(alreadyConcentrating:boolean):{allowed:boolean;endsPrevious:boolean}{
  return {allowed:true,endsPrevious:alreadyConcentrating};
}

export type RestResolution = {
  profileId:"dnd5e-2014"|"dnd5e-2024";
  kind:"short"|"long";
  minimumDurationHours:number;
  restoresAllHp:boolean;
  hitDiceRecovery:"none-during-short-spend-available"|"half-total-min1"|"all-spent";
  resetsDeathSaves:boolean;
  reducesExhaustionBy:number;
  resourceRefreshTags:string[];
  notes:string[];
};

export function shortRest(profileId:"dnd5e-2014"|"dnd5e-2024"):RestResolution{
  return {
    profileId,kind:"short",minimumDurationHours:1,restoresAllHp:false,
    hitDiceRecovery:"none-during-short-spend-available",resetsDeathSaves:false,reducesExhaustionBy:0,
    resourceRefreshTags:["short-rest","short-or-long-rest"],
    notes:["Characters may spend available Hit Dice/Hit Point Dice under the selected profile's rest rules. Feature-specific short-rest refreshes are applied separately."],
  };
}

export function longRest(profileId:"dnd5e-2014"|"dnd5e-2024"):RestResolution{
  return {
    profileId,kind:"long",minimumDurationHours:8,restoresAllHp:true,
    hitDiceRecovery:profileId==="dnd5e-2024"?"all-spent":"half-total-min1",
    resetsDeathSaves:true,reducesExhaustionBy:1,
    resourceRefreshTags:["long-rest","short-or-long-rest"],
    notes:profileId==="dnd5e-2024"
      ?["Revised Long Rest restores all lost HP and all spent Hit Point Dice, and reduces Exhaustion by 1 when the rest is completed normally."]
      :["2014 Long Rest restores all lost HP and up to half the character's total Hit Dice, minimum one, and reduces Exhaustion by 1 when the normal recovery requirements are satisfied."],
  };
}

export function validateAttunement(state:Dnd5eCharacterState,itemIds:number[]):string[]{
  const errors:string[]=[];
  const unique=new Set(itemIds);
  if(unique.size!==itemIds.length) errors.push("The same item cannot occupy multiple attunement slots.");
  const maximum=maximumAttunementItems(state);
  if(unique.size>maximum) errors.push(`Character has ${unique.size} attuned items; default maximum is ${maximum} before feature-specific exceptions.`);
  return errors;
}

export function resetDeathState():Dnd5eDeathState{
  return {deathSaveSuccesses:0,deathSaveFailures:0,stable:false};
}

export type RuntimeResource = {resourceId:string;current:number;maximum:number;refresh:string};

export function applyRestToResources<T extends RuntimeResource>(resources:T[],rest:RestResolution):T[]{
  const tags=new Set(rest.resourceRefreshTags);
  return resources.map(resource=>tags.has(resource.refresh)?{...resource,current:resource.maximum}:resource);
}

export function stabilizeDeathState(state:Dnd5eDeathState):Dnd5eDeathState{
  return {...state,deathSaveSuccesses:0,deathSaveFailures:0,stable:true};
}

export const RUNTIME_STATE_RULES=[
  "Current HP, temporary HP, death saves, spent Hit Dice, concentration, conditions, spell slots and feature uses are runtime state, not permanent level-history choices.",
  "A Long Rest must never rewrite the immutable level-by-level HP roll history.",
  "Starting concentration on a second effect ends the first; the active-effects store should enforce one concentration owner/effect at a time per character.",
  "Attunement is a character-to-item runtime relationship; item ownership remains in the item system.",
] as const;
