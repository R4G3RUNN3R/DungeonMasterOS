// Reference implementation only. Read model, never authoritative storage.

import type { Dnd5eAbility, Dnd5eRulesProfileId } from "./domain";

export type Dnd5eSheetAbility = { score:number; modifier:number; save:number; saveProficient:boolean };
export type Dnd5eSheetSkill = { id:string; name:string; ability:Dnd5eAbility; proficient:boolean; expertise:boolean; modifier:number; passive?:number };
export type Dnd5eSheetAttack = {
  name:string; attackBonus:number; damage:string; damageAbilityBonus:number; range?:string;
  proficient:boolean; mastery?:string; masteryActive?:boolean; notes?:string[];
};

export type Dnd5eCharacterSheetData = {
  version:1;
  rulesProfileId:Dnd5eRulesProfileId;
  identity:{
    playerName?:string; characterName:string; ancestry:string; background:string;
    classes:Array<{classId:string;className:string;level:number;subclass?:string}>;
    totalLevel:number; xp:number; nextLevelXp:number; alignment?:string; deity?:string; size:string;
  };
  abilities:Record<Dnd5eAbility,Dnd5eSheetAbility>;
  proficiencyBonus:number;
  inspiration?:boolean;
  armorClass:number;
  armorClassSource:string;
  initiative:{modifier:number;advantageSources:string[];disadvantageSources:string[]};
  speedFt:number;
  hp:{current:number;maximum:number;temporary:number;deathSuccesses:number;deathFailures:number;stable:boolean};
  hitDice:Array<{classId:string;die:number;total:number;spent:number}>;
  saves:Array<{ability:Dnd5eAbility;modifier:number;proficient:boolean}>;
  skills:Dnd5eSheetSkill[];
  passive:{perception:number;investigation:number;insight:number};
  proficiencies:{armor:string[];weapons:string[];tools:string[];languages:string[]};
  attacks:Dnd5eSheetAttack[];
  equipment:Array<{id:number;name:string;quantity:number;equipped:boolean;identified:boolean;weightLb?:number;attuned?:boolean}>;
  carrying:{currentWeightLb:number;capacityLb:number;pushDragLiftLb:number};
  features:Array<{name:string;source:string;notes?:string}>;
  feats:Array<{name:string;source:string}>;
  resources:Array<{id:string;label:string;current:number;maximum:number;refresh:string}>;
  conditions:Array<{id:string;level?:number;source?:string}>;
  exhaustion:number;
  spellcasting:Array<{
    classId:string;castingAbility:Dnd5eAbility;saveDc:number;attackBonus:number;
    slots?:Record<string,number>;usedSlots?:Record<string,number>;
    pactSlots?:{maximum:number;used:number;slotLevel:number};
    prepared:string[];known:string[];spellbook:string[];alwaysPrepared:string[];
  }>;
  attunement:Array<{itemId:number;name:string}>;
  notes?:{personality?:string;campaign?:string};
};
