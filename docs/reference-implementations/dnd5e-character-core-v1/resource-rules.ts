// Reference implementation only. Supersedes simplistic all-or-nothing refresh tags where a class feature has partial Short Rest recovery.

import type { Dnd5eCharacterState } from "./domain";
import { classTotals } from "./state-helpers";

export type ResourceRecoveryPolicy={
  resourceId:string;
  shortRest:{mode:"none"|"all"|"fixed";amount?:number};
  longRest:{mode:"all"|"fixed";amount?:number};
  notes?:string[];
};

export const RECOVERY_2014:Record<string,ResourceRecoveryPolicy>={
  "barbarian:rage":{resourceId:"barbarian:rage",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "bard:bardic-inspiration:pre5":{resourceId:"bard:bardic-inspiration",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "bard:bardic-inspiration:5plus":{resourceId:"bard:bardic-inspiration",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "cleric:channel-divinity":{resourceId:"cleric:channel-divinity",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "druid:wild-shape":{resourceId:"druid:wild-shape",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "fighter:second-wind":{resourceId:"fighter:second-wind",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "fighter:action-surge":{resourceId:"fighter:action-surge",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "fighter:indomitable":{resourceId:"fighter:indomitable",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "monk:ki":{resourceId:"monk:ki",shortRest:{mode:"all"},longRest:{mode:"all"},notes:["Short Rest recovery requires the class's meditation condition."]},
  "paladin:channel-divinity":{resourceId:"paladin:channel-divinity",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "paladin:lay-on-hands":{resourceId:"paladin:lay-on-hands",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "ranger:favored-enemy-hunters-mark":{resourceId:"ranger:favored-enemy-hunters-mark",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "sorcerer:sorcery-points":{resourceId:"sorcerer:sorcery-points",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "warlock:pact-slots":{resourceId:"warlock:pact-slots",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "wizard:arcane-recovery":{resourceId:"wizard:arcane-recovery",shortRest:{mode:"none"},longRest:{mode:"all"},notes:["Arcane Recovery is USED after a Short Rest, but the once-per-day/Long-Rest feature use itself does not reset every Short Rest."]},
};

export const RECOVERY_2024:Record<string,ResourceRecoveryPolicy>={
  "barbarian:rage":{resourceId:"barbarian:rage",shortRest:{mode:"fixed",amount:1},longRest:{mode:"all"}},
  "bard:bardic-inspiration:pre5":{resourceId:"bard:bardic-inspiration",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "bard:bardic-inspiration:5plus":{resourceId:"bard:bardic-inspiration",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "cleric:channel-divinity":{resourceId:"cleric:channel-divinity",shortRest:{mode:"fixed",amount:1},longRest:{mode:"all"}},
  "druid:wild-shape":{resourceId:"druid:wild-shape",shortRest:{mode:"fixed",amount:1},longRest:{mode:"all"}},
  "fighter:second-wind":{resourceId:"fighter:second-wind",shortRest:{mode:"fixed",amount:1},longRest:{mode:"all"}},
  "fighter:action-surge":{resourceId:"fighter:action-surge",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "fighter:indomitable":{resourceId:"fighter:indomitable",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "monk:focus":{resourceId:"monk:focus",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "paladin:channel-divinity":{resourceId:"paladin:channel-divinity",shortRest:{mode:"fixed",amount:1},longRest:{mode:"all"}},
  "paladin:lay-on-hands":{resourceId:"paladin:lay-on-hands",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "ranger:favored-enemy-hunters-mark":{resourceId:"ranger:favored-enemy-hunters-mark",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "sorcerer:sorcery-points":{resourceId:"sorcerer:sorcery-points",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "sorcerer:innate-sorcery":{resourceId:"sorcerer:innate-sorcery",shortRest:{mode:"none"},longRest:{mode:"all"}},
  "warlock:pact-slots":{resourceId:"warlock:pact-slots",shortRest:{mode:"all"},longRest:{mode:"all"}},
  "wizard:arcane-recovery":{resourceId:"wizard:arcane-recovery",shortRest:{mode:"none"},longRest:{mode:"all"}},
};

export type SpendableResource={resourceId:string;current:number;maximum:number};

export function recoveryPolicyFor(state:Dnd5eCharacterState,resourceId:string):ResourceRecoveryPolicy|undefined{
  const table=state.rulesProfileId==="dnd5e-2024"?RECOVERY_2024:RECOVERY_2014;
  if(resourceId==="bard:bardic-inspiration"){
    const bard=classTotals(state.levels).bard??0;
    return table[`bard:bardic-inspiration:${bard>=5?"5plus":"pre5"}`];
  }
  return table[resourceId];
}

function recover(resource:SpendableResource,rule:{mode:"none"|"all"|"fixed";amount?:number}):SpendableResource{
  if(rule.mode==="none") return resource;
  if(rule.mode==="all") return {...resource,current:resource.maximum};
  return {...resource,current:Math.min(resource.maximum,resource.current+(rule.amount??0))};
}

export function applyShortRestRecovery(state:Dnd5eCharacterState,resources:SpendableResource[]):SpendableResource[]{
  return resources.map(resource=>{const policy=recoveryPolicyFor(state,resource.resourceId);return policy?recover(resource,policy.shortRest):resource;});
}

export function applyLongRestRecovery(state:Dnd5eCharacterState,resources:SpendableResource[]):SpendableResource[]{
  return resources.map(resource=>{const policy=recoveryPolicyFor(state,resource.resourceId);return policy?recover(resource,policy.longRest):resource;});
}
