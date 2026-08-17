// Reference implementation only.

import type {
  Dnd5eCharacterState,
  Dnd5eConditionState,
  Dnd5eDeathState,
  Dnd5eEquipmentSnapshot,
  Dnd5eResourceState,
} from "./domain";
import type { Dnd5eCharacterSheetData } from "./sheet-model";
import type { Dnd5eNumericModifier, Dnd5eRollStateModifier } from "./modifiers";
import { sumNumericModifiers, resolveD20State } from "./modifiers";
import { abilityModifier, nextLevelExperience, passiveScore, proficiencyBonus } from "./core-tables";
import { DND5E_SKILL_DEFINITIONS } from "./skills";
import { aggregateProficiencies, proficiencyMultiplier } from "./proficiencies";
import { ancestryDefinition, backgroundDefinition, effectiveLanguages } from "./origin";
import { classDefinition, classHitDice, classTotals, effectiveAbilities, maximumHitPoints } from "./state-helpers";
import { attacksPerAttackAction, baseLandSpeed, resolveArmorClass, resolveCarrying, resolveWeaponAttack } from "./combat-resolver";
import { deriveClassState, mergeResourceUsage } from "./class-derivations";
import { get2014Subclass } from "./subclasses-2014";
import { get2024Subclass } from "./subclasses-2024";
import { spellcastingNumbers, classSlots, pactMagic } from "./spellcasting";

export type Dnd5eSheetRuntime = {
  playerName?:string;
  characterName:string;
  currentHp:number;
  temporaryHp:number;
  deathState:Dnd5eDeathState;
  spentHitDice?:Record<string,number>;
  inspiration?:boolean;
  equipment:Dnd5eEquipmentSnapshot[];
  conditions:Dnd5eConditionState[];
  exhaustion:number;
  numericModifiers:Dnd5eNumericModifier[];
  rollStateModifiers:Dnd5eRollStateModifier[];
  resources:Dnd5eResourceState[];
  campaignNotes?:string;
};

function subclassFor(state:Dnd5eCharacterState,id:string|undefined){
  if(!id) return undefined;
  return state.rulesProfileId==="dnd5e-2024"?get2024Subclass(id):get2014Subclass(id);
}

function classFeatureRows(state:Dnd5eCharacterState):Array<{name:string;source:string;notes?:string}>{
  const rows:Array<{name:string;source:string;notes?:string}>=[];
  for(const [classId,total] of Object.entries(classTotals(state.levels))){
    const cls=classDefinition(state,classId); if(!cls) continue;
    cls.features.filter(feature=>feature.level<=total).forEach(feature=>rows.push({name:feature.label,source:`${cls.displayName} ${feature.level}`}));
    const subclassId=[...state.levels].reverse().find(level=>level.classId===classId&&level.subclassId)?.subclassId;
    const sub=subclassFor(state,subclassId);
    sub?.features.filter(feature=>feature.level<=total).forEach(feature=>rows.push({name:feature.label,source:`${sub.displayName} ${feature.level}`}));
  }
  const ancestry=ancestryDefinition(state);
  ancestry?.features.forEach(feature=>rows.push({name:feature.label,source:ancestry.displayName}));
  return rows;
}

function spellRows(state:Dnd5eCharacterState){
  const level=state.levels.length;
  const pb=proficiencyBonus(level);
  return state.spellcasting.map(block=>{
    const totals=classTotals(state.levels);
    const classLevel=totals[block.classId]??0;
    const abilities=effectiveAbilities(state);
    const numbers=spellcastingNumbers({characterLevel:level,abilityScore:abilities[block.castingAbility]});
    const pact=block.classId==="warlock"?pactMagic(state.rulesProfileId,classLevel):undefined;
    return {
      classId:block.classId,castingAbility:block.castingAbility,saveDc:numbers.saveDc,attackBonus:numbers.attackBonus,
      slots:block.classId==="warlock"?undefined:Object.fromEntries(Object.entries(classSlots(state.rulesProfileId,block.classId,classLevel)).map(([k,v])=>[k,v])),
      usedSlots:block.usedSlots,
      pactSlots:pact?{maximum:pact.slots,used:block.pactSlots?.used??0,slotLevel:pact.slotLevel}:undefined,
      prepared:block.prepared.map(spell=>spell.name),known:block.known.map(spell=>spell.name),spellbook:block.spellbook.map(spell=>spell.name),alwaysPrepared:block.alwaysPrepared.map(spell=>spell.name),
    };
  });
}

export function projectDnd5eSheet(state:Dnd5eCharacterState,runtime:Dnd5eSheetRuntime):Dnd5eCharacterSheetData{
  const level=state.levels.length;
  const abilities=effectiveAbilities(state);
  const pb=proficiencyBonus(level);
  const profs=aggregateProficiencies(state);
  const ancestry=ancestryDefinition(state);
  const background=backgroundDefinition(state);
  const ac=resolveArmorClass(state,runtime.equipment);
  const carry=resolveCarrying(state,runtime.equipment);
  const initiativeNumeric=sumNumericModifiers(runtime.numericModifiers.filter(mod=>mod.target==="initiative"));
  const initiativeState=resolveD20State(runtime.rollStateModifiers,"initiative");
  const saveAbilities=["str","dex","con","int","wis","cha"] as const;

  const abilityRows={} as Dnd5eCharacterSheetData["abilities"];
  for(const ability of saveAbilities){
    const saveProf=proficiencyMultiplier(state,"save",ability)>0;
    const misc=sumNumericModifiers(runtime.numericModifiers.filter(mod=>mod.target===`save:${ability}`));
    const save=abilityModifier(abilities[ability])+(saveProf?pb:0)+misc;
    abilityRows[ability]={score:abilities[ability],modifier:abilityModifier(abilities[ability]),save,saveProficient:saveProf};
  }

  const skills=Object.values(DND5E_SKILL_DEFINITIONS).map(skill=>{
    const multi=proficiencyMultiplier(state,"skill",skill.id);
    const misc=sumNumericModifiers(runtime.numericModifiers.filter(mod=>mod.target===`skill:${skill.id}`));
    const modifier=abilityModifier(abilities[skill.defaultAbility])+pb*multi+misc;
    return {
      id:skill.id,name:skill.displayName,ability:skill.defaultAbility,proficient:multi>=1,expertise:multi===2,modifier,
      passive:passiveScore(abilities[skill.defaultAbility],pb,multi,misc),
    };
  });
  const skillById=new Map(skills.map(skill=>[skill.id,skill]));

  const attacks=runtime.equipment.filter(item=>item.equipped&&item.itemType==="weapon").flatMap(item=>{
    const id=item.name.toLowerCase().replace(/\s+/g,"-");
    try{const attack=resolveWeaponAttack(state,id);return [{name:attack.name,attackBonus:attack.attackBonus,damage:attack.damage,damageAbilityBonus:attack.damageAbilityBonus,range:attack.range,proficient:attack.proficient,mastery:attack.mastery,masteryActive:attack.masteryActive,notes:attack.notes}];}catch{return [{name:item.name,attackBonus:0,damage:"—",damageAbilityBonus:0,proficient:false,notes:["No profile-tagged weapon catalogue match; do not invent mechanics from the item name."]}];}
  });

  const classDerived=deriveClassState(state);
  const resources=mergeResourceUsage([...state.resources,...runtime.resources],classDerived.resources);
  const classes=Object.entries(classTotals(state.levels)).map(([classId,total])=>{
    const cls=classDefinition(state,classId);
    const subId=[...state.levels].reverse().find(record=>record.classId===classId&&record.subclassId)?.subclassId;
    return {classId,className:cls?.displayName??classId,level:total,subclass:subclassFor(state,subId)?.displayName??subId};
  });
  const attuned=state.attunement.filter(entry=>entry.attuned).flatMap(entry=>{
    const item=runtime.equipment.find(candidate=>candidate.itemId===entry.itemId); return item?[{itemId:entry.itemId,name:item.name}]:[];
  });

  return {
    version:1,rulesProfileId:state.rulesProfileId,
    identity:{playerName:runtime.playerName,characterName:runtime.characterName,ancestry:ancestry?.displayName??state.origin.ancestryId,background:background?.displayName??state.origin.backgroundId,classes,totalLevel:level,xp:state.experiencePoints,nextLevelXp:nextLevelExperience(level),alignment:state.persistentChoices.alignment,deity:state.persistentChoices.deity,size:String(state.origin.ancestryChoices.size??ancestry?.sizeOptions[0]??"medium")},
    abilities:abilityRows,proficiencyBonus:pb,inspiration:runtime.inspiration,
    armorClass:ac.armorClass,armorClassSource:ac.source,
    initiative:{modifier:abilityModifier(abilities.dex)+initiativeNumeric,advantageSources:initiativeState.advantageSources.map(x=>x.sourceLabel),disadvantageSources:initiativeState.disadvantageSources.map(x=>x.sourceLabel)},
    speedFt:baseLandSpeed(state,runtime.equipment),
    hp:{current:runtime.currentHp,maximum:maximumHitPoints(state),temporary:runtime.temporaryHp,deathSuccesses:runtime.deathState.deathSaveSuccesses,deathFailures:runtime.deathState.deathSaveFailures,stable:runtime.deathState.stable},
    hitDice:classHitDice(state).map(die=>({...die,total:die.count,spent:runtime.spentHitDice?.[die.classId]??0})),
    saves:saveAbilities.map(ability=>({ability,modifier:abilityRows[ability].save,proficient:abilityRows[ability].saveProficient})),
    skills,passive:{perception:skillById.get("perception")?.passive??10,investigation:skillById.get("investigation")?.passive??10,insight:skillById.get("insight")?.passive??10},
    proficiencies:{armor:profs.filter(p=>p.kind==="armor"||p.kind==="shield").map(p=>p.id),weapons:profs.filter(p=>p.kind==="weapon").map(p=>p.id),tools:profs.filter(p=>p.kind==="tool").map(p=>p.id),languages:effectiveLanguages(state)},
    attacks,
    equipment:runtime.equipment.map(item=>({id:item.itemId,name:item.name,quantity:item.quantity,equipped:item.equipped,identified:item.identified,weightLb:item.rules?.weightLb,attuned:state.attunement.some(a=>a.itemId===item.itemId&&a.attuned)})),
    carrying:{currentWeightLb:carry.totalWeightLb,capacityLb:carry.carryingCapacityLb,pushDragLiftLb:carry.pushDragLiftLb},
    features:classFeatureRows(state),
    feats:state.feats.map(feat=>({name:feat.featId,source:`${feat.source} at level ${feat.acquiredAtCharacterLevel}`})),
    resources:resources.map(resource=>({id:resource.resourceId,label:resource.label,current:resource.current,maximum:resource.maximum,refresh:resource.refresh})),
    conditions:runtime.conditions.map(condition=>({id:condition.conditionId,level:condition.level,source:condition.source})),exhaustion:runtime.exhaustion,
    spellcasting:spellRows(state),attunement:attuned,
    notes:{personality:state.persistentChoices.personalityNotes,campaign:runtime.campaignNotes},
  };
}
