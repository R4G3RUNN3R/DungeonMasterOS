// Reference implementation only. Derives core class resources from class level/profile.

import type { Dnd5eCharacterState, Dnd5eResourceState } from "./domain";
import { abilityModifier } from "./core-tables";
import { classTotals, effectiveAbilities } from "./state-helpers";
import { pactMagic } from "./spellcasting";

const valueAt = (table:number[], level:number) => table[Math.max(0,Math.min(19,level-1))] ?? 0;

const BARBARIAN_RAGES_2024 = [2,2,3,3,3,4,4,4,4,4,4,5,5,5,5,5,6,6,6,6];
const BARBARIAN_RAGES_2014 = [2,2,3,3,3,4,4,4,4,4,4,5,5,5,5,5,6,6,6,99]; // 99 = unlimited sentinel
const BARD_DIE = [6,6,6,6,8,8,8,8,8,10,10,10,10,10,12,12,12,12,12,12];
const CLERIC_CHANNEL_2024 = [0,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3,4,4,4];
const CLERIC_CHANNEL_2014 = [0,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3];
const DRUID_WILD_SHAPE_2024 = [0,2,2,2,2,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4];
const FIGHTER_SECOND_WIND_2024 = [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4];
const FIGHTER_ACTION_SURGE = [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2];
const FIGHTER_INDOMITABLE = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3];
const RANGER_HUNTERS_MARK_FREE_2024 = [2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];

export type Dnd5eClassDerived = {
  resources: Dnd5eResourceState[];
  notes: string[];
  passive: Record<string,string|number|boolean>;
};

function resource(
  id:string,
  label:string,
  maximum:number,
  refresh:Dnd5eResourceState["refresh"],
  classId:string,
): Dnd5eResourceState {
  return { resourceId:id, label, current:maximum, maximum, refresh, source:{sourceId:`class:${classId}`,sourceType:"class",label:classId} };
}

export function deriveClassState(state:Dnd5eCharacterState):Dnd5eClassDerived {
  const totals = classTotals(state.levels);
  const abilities = effectiveAbilities(state);
  const resources:Dnd5eResourceState[]=[];
  const notes:string[]=[];
  const passive:Record<string,string|number|boolean>={};

  const barbarian=totals.barbarian??0;
  if(barbarian){
    const count=valueAt(state.rulesProfileId==="dnd5e-2024"?BARBARIAN_RAGES_2024:BARBARIAN_RAGES_2014,barbarian);
    resources.push(resource("barbarian:rage","Rage",count,"long-rest","barbarian"));
    if(state.rulesProfileId==="dnd5e-2014"&&barbarian===20) notes.push("Barbarian 20 Rage is unlimited; the reference uses 99 only as an internal unlimited sentinel and production should model infinity explicitly.");
    passive["barbarian:rage-damage"]=barbarian>=16?4:barbarian>=9?3:2;
  }

  const bard=totals.bard??0;
  if(bard){
    const uses=Math.max(1,abilityModifier(abilities.cha));
    resources.push(resource("bard:bardic-inspiration","Bardic Inspiration",uses,bard>=5?"short-or-long-rest":"long-rest","bard"));
    passive["bard:inspiration-die"]=`d${valueAt(BARD_DIE,bard)}`;
  }

  const cleric=totals.cleric??0;
  if(cleric>=2){
    resources.push(resource("cleric:channel-divinity","Channel Divinity",valueAt(state.rulesProfileId==="dnd5e-2024"?CLERIC_CHANNEL_2024:CLERIC_CHANNEL_2014,cleric),state.rulesProfileId==="dnd5e-2024"?"short-or-long-rest":"short-or-long-rest","cleric"));
  }

  const druid=totals.druid??0;
  if(druid>=2){
    resources.push(resource("druid:wild-shape","Wild Shape",state.rulesProfileId==="dnd5e-2024"?valueAt(DRUID_WILD_SHAPE_2024,druid):2,"short-or-long-rest","druid"));
  }

  const fighter=totals.fighter??0;
  if(fighter){
    resources.push(resource("fighter:second-wind","Second Wind",state.rulesProfileId==="dnd5e-2024"?valueAt(FIGHTER_SECOND_WIND_2024,fighter):1,"short-or-long-rest","fighter"));
    if(fighter>=2) resources.push(resource("fighter:action-surge","Action Surge",valueAt(FIGHTER_ACTION_SURGE,fighter),"short-or-long-rest","fighter"));
    if(fighter>=9) resources.push(resource("fighter:indomitable","Indomitable",valueAt(FIGHTER_INDOMITABLE,fighter),"long-rest","fighter"));
  }

  const monk=totals.monk??0;
  if(monk>=2){
    resources.push(resource(state.rulesProfileId==="dnd5e-2024"?"monk:focus":"monk:ki",state.rulesProfileId==="dnd5e-2024"?"Focus Points":"Ki Points",monk,"short-or-long-rest","monk"));
  }

  const paladin=totals.paladin??0;
  if(paladin){
    resources.push(resource("paladin:lay-on-hands","Lay on Hands",paladin*5,"long-rest","paladin"));
    if(state.rulesProfileId==="dnd5e-2024"&&paladin>=3) resources.push(resource("paladin:channel-divinity","Channel Divinity",paladin>=11?3:2,"short-or-long-rest","paladin"));
  }

  const ranger=totals.ranger??0;
  if(state.rulesProfileId==="dnd5e-2024"&&ranger){
    resources.push(resource("ranger:favored-enemy-hunters-mark","Free Hunter's Mark",valueAt(RANGER_HUNTERS_MARK_FREE_2024,ranger),"long-rest","ranger"));
  }

  const rogue=totals.rogue??0;
  if(rogue) passive["rogue:sneak-attack"]=`${Math.ceil(rogue/2)}d6`;

  const sorcerer=totals.sorcerer??0;
  if(sorcerer>=2) resources.push(resource("sorcerer:sorcery-points","Sorcery Points",sorcerer,"long-rest","sorcerer"));
  if(state.rulesProfileId==="dnd5e-2024"&&sorcerer) resources.push(resource("sorcerer:innate-sorcery","Innate Sorcery",2,"long-rest","sorcerer"));

  const warlock=totals.warlock??0;
  if(warlock){
    const pact=pactMagic(state.rulesProfileId,warlock);
    if(pact) resources.push(resource("warlock:pact-slots",`Pact Slots (level ${pact.slotLevel})`,pact.slots,"short-or-long-rest","warlock"));
  }

  const wizard=totals.wizard??0;
  if(wizard){
    resources.push(resource("wizard:arcane-recovery","Arcane Recovery",1,"long-rest","wizard"));
    passive["wizard:arcane-recovery-slot-levels"]=Math.ceil(wizard/2);
  }

  return {resources,notes,passive};
}

export function mergeResourceUsage(stored:Dnd5eResourceState[],derived:Dnd5eResourceState[]):Dnd5eResourceState[]{
  const prior=new Map(stored.map(item=>[item.resourceId,item]));
  return derived.map(def=>{
    const old=prior.get(def.resourceId);
    return old?{...def,current:Math.max(0,Math.min(def.maximum,old.current))}:def;
  });
}
