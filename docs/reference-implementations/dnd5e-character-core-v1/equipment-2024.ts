// Reference implementation only. SRD 5.2.1 armor/weapons and mastery assignments.

import type { Dnd5eArmorDefinition, Dnd5eWeaponDefinition, MasteryDefinition } from "./equipment-types";

const w = (value: Dnd5eWeaponDefinition) => value;
const a = (value: Dnd5eArmorDefinition) => value;

export const DND5E_2024_WEAPONS: Record<string, Dnd5eWeaponDefinition> = Object.fromEntries([
  w({ profileId:"dnd5e-2024", id:"club", displayName:"Club", category:"simple", kind:"melee", damage:"1d4", damageType:"bludgeoning", weightLb:2, cost:"1 sp", properties:["light"], mastery:"slow" }),
  w({ profileId:"dnd5e-2024", id:"dagger", displayName:"Dagger", category:"simple", kind:"melee", damage:"1d4", damageType:"piercing", weightLb:1, cost:"2 gp", properties:["finesse","light","thrown"], normalRangeFt:20, longRangeFt:60, mastery:"nick" }),
  w({ profileId:"dnd5e-2024", id:"greatclub", displayName:"Greatclub", category:"simple", kind:"melee", damage:"1d8", damageType:"bludgeoning", weightLb:10, cost:"2 sp", properties:["two-handed"], mastery:"push" }),
  w({ profileId:"dnd5e-2024", id:"handaxe", displayName:"Handaxe", category:"simple", kind:"melee", damage:"1d6", damageType:"slashing", weightLb:2, cost:"5 gp", properties:["light","thrown"], normalRangeFt:20, longRangeFt:60, mastery:"vex" }),
  w({ profileId:"dnd5e-2024", id:"javelin", displayName:"Javelin", category:"simple", kind:"melee", damage:"1d6", damageType:"piercing", weightLb:2, cost:"5 sp", properties:["thrown"], normalRangeFt:30, longRangeFt:120, mastery:"slow" }),
  w({ profileId:"dnd5e-2024", id:"light-hammer", displayName:"Light Hammer", category:"simple", kind:"melee", damage:"1d4", damageType:"bludgeoning", weightLb:2, cost:"2 gp", properties:["light","thrown"], normalRangeFt:20, longRangeFt:60, mastery:"nick" }),
  w({ profileId:"dnd5e-2024", id:"mace", displayName:"Mace", category:"simple", kind:"melee", damage:"1d6", damageType:"bludgeoning", weightLb:4, cost:"5 gp", properties:[], mastery:"sap" }),
  w({ profileId:"dnd5e-2024", id:"quarterstaff", displayName:"Quarterstaff", category:"simple", kind:"melee", damage:"1d6", damageType:"bludgeoning", weightLb:4, cost:"2 sp", properties:["versatile"], versatileDamage:"1d8", mastery:"topple" }),
  w({ profileId:"dnd5e-2024", id:"sickle", displayName:"Sickle", category:"simple", kind:"melee", damage:"1d4", damageType:"slashing", weightLb:2, cost:"1 gp", properties:["light"], mastery:"nick" }),
  w({ profileId:"dnd5e-2024", id:"spear", displayName:"Spear", category:"simple", kind:"melee", damage:"1d6", damageType:"piercing", weightLb:3, cost:"1 gp", properties:["thrown","versatile"], normalRangeFt:20, longRangeFt:60, versatileDamage:"1d8", mastery:"sap" }),
  w({ profileId:"dnd5e-2024", id:"dart", displayName:"Dart", category:"simple", kind:"ranged", damage:"1d4", damageType:"piercing", weightLb:0.25, cost:"5 cp", properties:["finesse","thrown"], normalRangeFt:20, longRangeFt:60, mastery:"vex" }),
  w({ profileId:"dnd5e-2024", id:"light-crossbow", displayName:"Light Crossbow", category:"simple", kind:"ranged", damage:"1d8", damageType:"piercing", weightLb:5, cost:"25 gp", properties:["ammunition","loading","two-handed"], normalRangeFt:80, longRangeFt:320, mastery:"slow" }),
  w({ profileId:"dnd5e-2024", id:"shortbow", displayName:"Shortbow", category:"simple", kind:"ranged", damage:"1d6", damageType:"piercing", weightLb:2, cost:"25 gp", properties:["ammunition","two-handed"], normalRangeFt:80, longRangeFt:320, mastery:"vex" }),
  w({ profileId:"dnd5e-2024", id:"sling", displayName:"Sling", category:"simple", kind:"ranged", damage:"1d4", damageType:"bludgeoning", weightLb:0, cost:"1 sp", properties:["ammunition"], normalRangeFt:30, longRangeFt:120, mastery:"slow" }),

  w({ profileId:"dnd5e-2024", id:"battleaxe", displayName:"Battleaxe", category:"martial", kind:"melee", damage:"1d8", damageType:"slashing", weightLb:4, cost:"10 gp", properties:["versatile"], versatileDamage:"1d10", mastery:"topple" }),
  w({ profileId:"dnd5e-2024", id:"flail", displayName:"Flail", category:"martial", kind:"melee", damage:"1d8", damageType:"bludgeoning", weightLb:2, cost:"10 gp", properties:[], mastery:"sap" }),
  w({ profileId:"dnd5e-2024", id:"glaive", displayName:"Glaive", category:"martial", kind:"melee", damage:"1d10", damageType:"slashing", weightLb:6, cost:"20 gp", properties:["heavy","reach","two-handed"], mastery:"graze" }),
  w({ profileId:"dnd5e-2024", id:"greataxe", displayName:"Greataxe", category:"martial", kind:"melee", damage:"1d12", damageType:"slashing", weightLb:7, cost:"30 gp", properties:["heavy","two-handed"], mastery:"cleave" }),
  w({ profileId:"dnd5e-2024", id:"greatsword", displayName:"Greatsword", category:"martial", kind:"melee", damage:"2d6", damageType:"slashing", weightLb:6, cost:"50 gp", properties:["heavy","two-handed"], mastery:"graze" }),
  w({ profileId:"dnd5e-2024", id:"halberd", displayName:"Halberd", category:"martial", kind:"melee", damage:"1d10", damageType:"slashing", weightLb:6, cost:"20 gp", properties:["heavy","reach","two-handed"], mastery:"cleave" }),
  w({ profileId:"dnd5e-2024", id:"lance", displayName:"Lance", category:"martial", kind:"melee", damage:"1d10", damageType:"piercing", weightLb:6, cost:"10 gp", properties:["heavy","reach","two-handed-unless-mounted"], mastery:"topple" }),
  w({ profileId:"dnd5e-2024", id:"longsword", displayName:"Longsword", category:"martial", kind:"melee", damage:"1d8", damageType:"slashing", weightLb:3, cost:"15 gp", properties:["versatile"], versatileDamage:"1d10", mastery:"sap" }),
  w({ profileId:"dnd5e-2024", id:"maul", displayName:"Maul", category:"martial", kind:"melee", damage:"2d6", damageType:"bludgeoning", weightLb:10, cost:"10 gp", properties:["heavy","two-handed"], mastery:"topple" }),
  w({ profileId:"dnd5e-2024", id:"morningstar", displayName:"Morningstar", category:"martial", kind:"melee", damage:"1d8", damageType:"piercing", weightLb:4, cost:"15 gp", properties:[], mastery:"sap" }),
  w({ profileId:"dnd5e-2024", id:"pike", displayName:"Pike", category:"martial", kind:"melee", damage:"1d10", damageType:"piercing", weightLb:18, cost:"5 gp", properties:["heavy","reach","two-handed"], mastery:"push" }),
  w({ profileId:"dnd5e-2024", id:"rapier", displayName:"Rapier", category:"martial", kind:"melee", damage:"1d8", damageType:"piercing", weightLb:2, cost:"25 gp", properties:["finesse"], mastery:"vex" }),
  w({ profileId:"dnd5e-2024", id:"scimitar", displayName:"Scimitar", category:"martial", kind:"melee", damage:"1d6", damageType:"slashing", weightLb:3, cost:"25 gp", properties:["finesse","light"], mastery:"nick" }),
  w({ profileId:"dnd5e-2024", id:"shortsword", displayName:"Shortsword", category:"martial", kind:"melee", damage:"1d6", damageType:"piercing", weightLb:2, cost:"10 gp", properties:["finesse","light"], mastery:"vex" }),
  w({ profileId:"dnd5e-2024", id:"trident", displayName:"Trident", category:"martial", kind:"melee", damage:"1d8", damageType:"piercing", weightLb:4, cost:"5 gp", properties:["thrown","versatile"], normalRangeFt:20, longRangeFt:60, versatileDamage:"1d10", mastery:"topple" }),
  w({ profileId:"dnd5e-2024", id:"war-pick", displayName:"War Pick", category:"martial", kind:"melee", damage:"1d8", damageType:"piercing", weightLb:2, cost:"5 gp", properties:["versatile"], versatileDamage:"1d10", mastery:"sap" }),
  w({ profileId:"dnd5e-2024", id:"warhammer", displayName:"Warhammer", category:"martial", kind:"melee", damage:"1d8", damageType:"bludgeoning", weightLb:5, cost:"15 gp", properties:["versatile"], versatileDamage:"1d10", mastery:"push" }),
  w({ profileId:"dnd5e-2024", id:"whip", displayName:"Whip", category:"martial", kind:"melee", damage:"1d4", damageType:"slashing", weightLb:3, cost:"2 gp", properties:["finesse","reach"], mastery:"slow" }),
  w({ profileId:"dnd5e-2024", id:"blowgun", displayName:"Blowgun", category:"martial", kind:"ranged", damage:"1", damageType:"piercing", weightLb:1, cost:"10 gp", properties:["ammunition","loading"], normalRangeFt:25, longRangeFt:100, mastery:"vex" }),
  w({ profileId:"dnd5e-2024", id:"hand-crossbow", displayName:"Hand Crossbow", category:"martial", kind:"ranged", damage:"1d6", damageType:"piercing", weightLb:3, cost:"75 gp", properties:["ammunition","light","loading"], normalRangeFt:30, longRangeFt:120, mastery:"vex" }),
  w({ profileId:"dnd5e-2024", id:"heavy-crossbow", displayName:"Heavy Crossbow", category:"martial", kind:"ranged", damage:"1d10", damageType:"piercing", weightLb:18, cost:"50 gp", properties:["ammunition","heavy","loading","two-handed"], normalRangeFt:100, longRangeFt:400, mastery:"push" }),
  w({ profileId:"dnd5e-2024", id:"longbow", displayName:"Longbow", category:"martial", kind:"ranged", damage:"1d8", damageType:"piercing", weightLb:2, cost:"50 gp", properties:["ammunition","heavy","two-handed"], normalRangeFt:150, longRangeFt:600, mastery:"slow" }),
  w({ profileId:"dnd5e-2024", id:"musket", displayName:"Musket", category:"martial", kind:"ranged", damage:"1d12", damageType:"piercing", weightLb:10, cost:"500 gp", properties:["ammunition","loading","two-handed"], normalRangeFt:40, longRangeFt:120, mastery:"slow" }),
  w({ profileId:"dnd5e-2024", id:"pistol", displayName:"Pistol", category:"martial", kind:"ranged", damage:"1d10", damageType:"piercing", weightLb:3, cost:"250 gp", properties:["ammunition","loading"], normalRangeFt:30, longRangeFt:90, mastery:"vex" }),
].map((entry) => [entry.id, entry]));

export const DND5E_2024_ARMOR: Record<string, Dnd5eArmorDefinition> = Object.fromEntries([
  a({profileId:"dnd5e-2024",id:"padded",displayName:"Padded Armor",category:"light",baseAc:11,dexMode:"full",stealthDisadvantage:true,weightLb:8,cost:"5 gp"}),
  a({profileId:"dnd5e-2024",id:"leather",displayName:"Leather Armor",category:"light",baseAc:11,dexMode:"full",stealthDisadvantage:false,weightLb:10,cost:"10 gp"}),
  a({profileId:"dnd5e-2024",id:"studded-leather",displayName:"Studded Leather Armor",category:"light",baseAc:12,dexMode:"full",stealthDisadvantage:false,weightLb:13,cost:"45 gp"}),
  a({profileId:"dnd5e-2024",id:"hide",displayName:"Hide Armor",category:"medium",baseAc:12,dexMode:"max-2",stealthDisadvantage:false,weightLb:12,cost:"10 gp"}),
  a({profileId:"dnd5e-2024",id:"chain-shirt",displayName:"Chain Shirt",category:"medium",baseAc:13,dexMode:"max-2",stealthDisadvantage:false,weightLb:20,cost:"50 gp"}),
  a({profileId:"dnd5e-2024",id:"scale-mail",displayName:"Scale Mail",category:"medium",baseAc:14,dexMode:"max-2",stealthDisadvantage:true,weightLb:45,cost:"50 gp"}),
  a({profileId:"dnd5e-2024",id:"breastplate",displayName:"Breastplate",category:"medium",baseAc:14,dexMode:"max-2",stealthDisadvantage:false,weightLb:20,cost:"400 gp"}),
  a({profileId:"dnd5e-2024",id:"half-plate",displayName:"Half Plate Armor",category:"medium",baseAc:15,dexMode:"max-2",stealthDisadvantage:true,weightLb:40,cost:"750 gp"}),
  a({profileId:"dnd5e-2024",id:"ring-mail",displayName:"Ring Mail",category:"heavy",baseAc:14,dexMode:"none",stealthDisadvantage:true,weightLb:40,cost:"30 gp"}),
  a({profileId:"dnd5e-2024",id:"chain-mail",displayName:"Chain Mail",category:"heavy",baseAc:16,dexMode:"none",strengthRequirement:13,stealthDisadvantage:true,weightLb:55,cost:"75 gp"}),
  a({profileId:"dnd5e-2024",id:"splint",displayName:"Splint Armor",category:"heavy",baseAc:17,dexMode:"none",strengthRequirement:15,stealthDisadvantage:true,weightLb:60,cost:"200 gp"}),
  a({profileId:"dnd5e-2024",id:"plate",displayName:"Plate Armor",category:"heavy",baseAc:18,dexMode:"none",strengthRequirement:15,stealthDisadvantage:true,weightLb:65,cost:"1500 gp"}),
  a({profileId:"dnd5e-2024",id:"shield",displayName:"Shield",category:"shield",baseAc:0,dexMode:"none",stealthDisadvantage:false,weightLb:6,cost:"10 gp",shieldBonus:2}),
].map((entry) => [entry.id, entry]));

export const DND5E_2024_MASTERY: Record<string, MasteryDefinition> = {
  cleave: { id:"cleave", trigger:"hit-a-creature-with-melee-attack", oncePerTurn:true, rules:{ extraAttackAgainstSecondCreatureWithin5FtOfFirstAndReach:true, addAbilityModifierToDamage:false } },
  graze: { id:"graze", trigger:"miss-with-weapon-attack", rules:{ dealDamageEqualToAttackAbilityModifier:true, damageTypeMatchesWeapon:true } },
  nick: { id:"nick", trigger:"extra-attack-from-light-property", oncePerTurn:true, rules:{ makeExtraAttackAsPartOfAttackAction:true, extraAttackNotBonusAction:true } },
  push: { id:"push", trigger:"hit-creature", rules:{ pushFt:10, maximumTargetSize:"large" } },
  sap: { id:"sap", trigger:"hit-creature", rules:{ targetDisadvantageNextAttackBeforeStartOfYourNextTurn:true } },
  slow: { id:"slow", trigger:"hit-creature-and-deal-damage", oncePerTurn:true, rules:{ speedPenaltyFt:10, lastsUntilStartOfYourNextTurn:true, penaltiesDontStack:true } },
  topple: { id:"topple", trigger:"hit-creature", save:"con", saveDc:"8+attack-ability-mod+pb", rules:{ failedSaveProne:true } },
  vex: { id:"vex", trigger:"hit-creature-and-deal-damage", rules:{ advantageOnNextAttackAgainstSameTargetBeforeEndOfYourNextTurn:true } },
};
