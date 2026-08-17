// Reference implementation only.

import type { Dnd5eCharacterState, Dnd5eEquipmentSnapshot, Dnd5eSize } from "./domain";
import type { Dnd5eArmorDefinition, Dnd5eWeaponDefinition } from "./equipment-types";
import { abilityModifier, carryingCapacity, proficiencyBonus } from "./core-tables";
import { classDefinition, classTotals, effectiveAbilities, characterLevel } from "./state-helpers";
import { hasArmorTraining } from "./proficiencies";
import { DND5E_2014_ARMOR, DND5E_2014_WEAPONS } from "./equipment-2014";
import { DND5E_2024_ARMOR, DND5E_2024_WEAPONS } from "./equipment-2024";
import { ancestryDefinition } from "./origin";

export type ArmorResolution = {
  armorClass: number;
  source: string;
  armorId?: string;
  shieldId?: string;
  untrainedArmor: boolean;
  d20DisadvantageTargets: string[];
  cannotCastSpells: boolean;
  speedPenaltyFt: number;
  notes: string[];
};

export type AttackResolution = {
  weaponId: string;
  name: string;
  proficient: boolean;
  attackAbility: "str" | "dex";
  attackBonus: number;
  damage: string;
  damageAbilityBonus: number;
  range?: string;
  mastery?: string;
  masteryActive: boolean;
  disadvantageSources: string[];
  notes: string[];
};

export type CarryResolution = {
  totalWeightLb: number;
  carryingCapacityLb: number;
  pushDragLiftLb: number;
};

function weaponTable(state:Dnd5eCharacterState):Record<string,Dnd5eWeaponDefinition>{
  return state.rulesProfileId==="dnd5e-2024"?DND5E_2024_WEAPONS:DND5E_2014_WEAPONS;
}
function armorTable(state:Dnd5eCharacterState):Record<string,Dnd5eArmorDefinition>{
  return state.rulesProfileId==="dnd5e-2024"?DND5E_2024_ARMOR:DND5E_2014_ARMOR;
}

function selectedSize(state:Dnd5eCharacterState):Dnd5eSize{
  const ancestry=ancestryDefinition(state);
  const chosen=String(state.origin.ancestryChoices.size??"").toLowerCase() as Dnd5eSize;
  return ancestry?.sizeOptions.includes(chosen)?chosen:(ancestry?.sizeOptions[0]??"medium");
}

function itemRuleId(item:Dnd5eEquipmentSnapshot):string{
  return String((item.rules as any)?.catalogueId??item.name).trim().toLowerCase().replace(/\s+/g,"-");
}

function hasWeaponTraining(state:Dnd5eCharacterState,weapon:Dnd5eWeaponDefinition):boolean{
  const ids=new Set(state.proficiencies.filter(p=>p.kind==="weapon").map(p=>p.id));
  // Level-granted starting/multiclass proficiencies are also described by the class registry.
  const classes=Object.keys(classTotals(state.levels)).map(id=>classDefinition(state,id)).filter(Boolean);
  for(const cls of classes){
    const profs=cls!.traits.weaponProficiencies;
    if(profs.includes(weapon.id)||profs.includes(weapon.category)||profs.includes("all-simple")||profs.includes("all-martial")) return true;
    if(profs.includes("simple")&&weapon.category==="simple") return true;
    if(profs.includes("martial")&&weapon.category==="martial") return true;
    if(profs.includes("martial-light")&&weapon.category==="martial"&&weapon.properties.includes("light")) return true;
    if(profs.includes("martial-finesse-or-light")&&weapon.category==="martial"&&(weapon.properties.includes("finesse")||weapon.properties.includes("light"))) return true;
  }
  return ids.has(weapon.id)||ids.has(weapon.category);
}

function masterySelections(state:Dnd5eCharacterState):Set<string>{
  const values:string[]=[];
  for(const level of state.levels){
    for(const choice of level.classChoices){
      if(choice.choiceId.includes("weapon-mastery")){
        if(Array.isArray(choice.values)) values.push(...choice.values.map(String));
        else values.push(String(choice.values));
      }
    }
  }
  for(const feat of state.feats){
    const selection=feat.choices?.weaponMastery;
    if(typeof selection==="string") values.push(selection);
    if(Array.isArray(selection)) values.push(...selection.map(String));
  }
  return new Set(values.map(v=>v.toLowerCase()));
}

export function resolveCarrying(state:Dnd5eCharacterState,equipment:Dnd5eEquipmentSnapshot[]):CarryResolution{
  const totalWeightLb=equipment.reduce((sum,item)=>sum+(item.rules?.weightLb??0)*Math.max(1,item.quantity),0);
  const capacity=carryingCapacity(state.rulesProfileId,effectiveAbilities(state).str,selectedSize(state));
  return {totalWeightLb,carryingCapacityLb:capacity.carryingLb,pushDragLiftLb:capacity.pushDragLiftLb};
}

export function resolveArmorClass(state:Dnd5eCharacterState,equipment:Dnd5eEquipmentSnapshot[]):ArmorResolution{
  const abilities=effectiveAbilities(state);
  const dex=abilityModifier(abilities.dex);
  const equipped=equipment.filter(item=>item.equipped);
  const table=armorTable(state);
  const armorItem=equipped.find(item=>item.itemType==="armor"&&itemRuleId(item)!=="shield");
  const shieldItem=equipped.find(item=>itemRuleId(item)==="shield"||(item.rules?.armor?.category==="shield"));
  const armor=armorItem?table[itemRuleId(armorItem)]:undefined;
  const shield=shieldItem?table[itemRuleId(shieldItem)]??DND5E_2024_ARMOR.shield:undefined;
  const notes:string[]=[];
  let ac:number;
  let source:string;

  if(armor){
    const dexContribution=armor.dexMode==="full"?dex:armor.dexMode==="max-2"?Math.min(2,dex):0;
    ac=armor.baseAc+dexContribution;
    source=armor.displayName;
  }else{
    const alternatives:Array<{value:number;source:string;shieldAllowed:boolean}>=[];
    alternatives.push({value:10+dex,source:"Unarmored",shieldAllowed:true});
    const totals=classTotals(state.levels);
    if(totals.barbarian) alternatives.push({value:10+dex+abilityModifier(abilities.con),source:"Barbarian Unarmored Defense",shieldAllowed:true});
    if(totals.monk&&!shieldItem) alternatives.push({value:10+dex+abilityModifier(abilities.wis),source:"Monk Unarmored Defense",shieldAllowed:false});
    const sorcererLevel=totals.sorcerer??0;
    const draconic=state.levels.find(level=>level.classId==="sorcerer"&&level.subclassId&&level.subclassId.includes("draconic"));
    if(sorcererLevel&&draconic){
      alternatives.push(state.rulesProfileId==="dnd5e-2024"
        ?{value:10+dex+abilityModifier(abilities.cha),source:"Draconic Resilience",shieldAllowed:true}
        :{value:13+dex,source:"Draconic Resilience",shieldAllowed:true});
    }
    alternatives.sort((a,b)=>b.value-a.value);
    const chosen=alternatives.find(option=>!shieldItem||option.shieldAllowed)??alternatives[0];
    ac=chosen.value; source=chosen.source;
  }

  if(shield) ac+=(shield.shieldBonus??2);
  const armorCategory=armor?.category;
  const untrainedArmor=!!armorCategory&&!hasArmorTraining(state,armorCategory as "light"|"medium"|"heavy")||!!shield&&!hasArmorTraining(state,"shield");
  const d20DisadvantageTargets=untrainedArmor
    ? state.rulesProfileId==="dnd5e-2024"
      ?["D20 Tests involving Strength or Dexterity"]
      :["Strength/Dexterity ability checks","Strength/Dexterity saving throws","attack rolls"]
    :[];
  const cannotCastSpells=untrainedArmor;

  let speedPenaltyFt=0;
  if(armor?.category==="heavy"&&armor.strengthRequirement&&abilities.str<armor.strengthRequirement){
    speedPenaltyFt=10;
    notes.push(`Strength ${abilities.str} is below ${armor.displayName}'s requirement ${armor.strengthRequirement}; speed is reduced by 10 ft.`);
  }
  if(state.rulesProfileId==="dnd5e-2014"&&selectedSize(state)==="small") notes.push("2014 Heavy weapon disadvantage for Small creatures is resolved per weapon attack, not through AC.");
  if(untrainedArmor) notes.push("Armor/shield is being used without the required training/proficiency; casting and D20 penalties apply under the selected profile.");

  return {armorClass:ac,source,armorId:armor?.id,shieldId:shield?.id,untrainedArmor,d20DisadvantageTargets,cannotCastSpells,speedPenaltyFt,notes};
}

function attackAbility(weapon:Dnd5eWeaponDefinition,abilities:ReturnType<typeof effectiveAbilities>):"str"|"dex"{
  if(weapon.kind==="ranged"&&!weapon.properties.includes("thrown")) return "dex";
  if(weapon.properties.includes("finesse")) return abilityModifier(abilities.dex)>abilityModifier(abilities.str)?"dex":"str";
  return "str";
}

export function resolveWeaponAttack(state:Dnd5eCharacterState,weaponId:string):AttackResolution{
  const weapon=weaponTable(state)[weaponId];
  if(!weapon) throw new Error(`Unknown ${state.rulesProfileId} weapon ${weaponId}.`);
  const abilities=effectiveAbilities(state);
  const ability=attackAbility(weapon,abilities);
  const abilityMod=abilityModifier(abilities[ability]);
  const proficient=hasWeaponTraining(state,weapon);
  const pb=proficiencyBonus(characterLevel(state));
  const attackBonus=abilityMod+(proficient?pb:0);
  const disadvantageSources:string[]=[];
  const size=selectedSize(state);
  if(state.rulesProfileId==="dnd5e-2014"&&weapon.properties.includes("heavy")&&size==="small") disadvantageSources.push("2014 Heavy weapon used by Small creature");
  if(state.rulesProfileId==="dnd5e-2024"&&weapon.properties.includes("heavy")){
    const minimumAbility=weapon.kind==="melee"?abilities.str:abilities.dex;
    if(minimumAbility<13) disadvantageSources.push(`2024 Heavy property requires ${weapon.kind==="melee"?"STR":"DEX"} 13 for normal attack rolls`);
  }
  const masteryActive=state.rulesProfileId==="dnd5e-2024"&&!!weapon.mastery&&masterySelections(state).has(weapon.id);
  return {
    weaponId:weapon.id,name:weapon.displayName,proficient,attackAbility:ability,attackBonus,
    damage:weapon.damage,damageAbilityBonus:abilityMod,
    range:weapon.normalRangeFt?`${weapon.normalRangeFt}/${weapon.longRangeFt} ft.`:undefined,
    mastery:weapon.mastery,masteryActive,disadvantageSources,
    notes:masteryActive?[`${weapon.mastery} mastery is active for this weapon.`]:weapon.mastery?[`${weapon.mastery} is the weapon's mastery property but this character has not selected mastery for it.`]:[],
  };
}

export function attacksPerAttackAction(state:Dnd5eCharacterState):number{
  const totals=classTotals(state.levels);
  if((totals.fighter??0)>=20) return 4;
  if((totals.fighter??0)>=11) return 3;
  if(Object.entries(totals).some(([id,level])=>["barbarian","bard","fighter","monk","paladin","ranger"].includes(id)&&level>=5)) return 2;
  return 1;
}

export function baseLandSpeed(state:Dnd5eCharacterState,equipment:Dnd5eEquipmentSnapshot[]):number{
  const ancestry=ancestryDefinition(state);
  let speed=ancestry?.speedFt??30;
  const totals=classTotals(state.levels);
  if((totals.barbarian??0)>=5){
    const heavy=equipment.some(item=>item.equipped&&item.rules?.armor?.category==="heavy");
    if(!heavy) speed+=10;
  }
  const monk=totals.monk??0;
  if(monk>=2){
    const armored=equipment.some(item=>item.equipped&&!!item.rules?.armor);
    if(!armored){
      const bonus=state.rulesProfileId==="dnd5e-2024"?(monk>=18?30:monk>=14?25:monk>=10?20:monk>=6?15:10):(monk>=18?30:monk>=14?25:monk>=10?20:monk>=6?15:10);
      speed+=bonus;
    }
  }
  speed-=resolveArmorClass(state,equipment).speedPenaltyFt;
  return Math.max(0,speed);
}
