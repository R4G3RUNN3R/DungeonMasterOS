// Reference implementation only. SRD 5.1 armor/weapons.

import type { Dnd5eArmorDefinition, Dnd5eWeaponDefinition } from "./equipment-types";

const w = (value: Dnd5eWeaponDefinition) => value;
const a = (value: Dnd5eArmorDefinition) => value;

export const DND5E_2014_WEAPONS: Record<string, Dnd5eWeaponDefinition> = Object.fromEntries([
  w({profileId:"dnd5e-2014",id:"club",displayName:"Club",category:"simple",kind:"melee",damage:"1d4",damageType:"bludgeoning",weightLb:2,cost:"1 sp",properties:["light"]}),
  w({profileId:"dnd5e-2014",id:"dagger",displayName:"Dagger",category:"simple",kind:"melee",damage:"1d4",damageType:"piercing",weightLb:1,cost:"2 gp",properties:["finesse","light","thrown"],normalRangeFt:20,longRangeFt:60}),
  w({profileId:"dnd5e-2014",id:"greatclub",displayName:"Greatclub",category:"simple",kind:"melee",damage:"1d8",damageType:"bludgeoning",weightLb:10,cost:"2 sp",properties:["two-handed"]}),
  w({profileId:"dnd5e-2014",id:"handaxe",displayName:"Handaxe",category:"simple",kind:"melee",damage:"1d6",damageType:"slashing",weightLb:2,cost:"5 gp",properties:["light","thrown"],normalRangeFt:20,longRangeFt:60}),
  w({profileId:"dnd5e-2014",id:"javelin",displayName:"Javelin",category:"simple",kind:"melee",damage:"1d6",damageType:"piercing",weightLb:2,cost:"5 sp",properties:["thrown"],normalRangeFt:30,longRangeFt:120}),
  w({profileId:"dnd5e-2014",id:"light-hammer",displayName:"Light Hammer",category:"simple",kind:"melee",damage:"1d4",damageType:"bludgeoning",weightLb:2,cost:"2 gp",properties:["light","thrown"],normalRangeFt:20,longRangeFt:60}),
  w({profileId:"dnd5e-2014",id:"mace",displayName:"Mace",category:"simple",kind:"melee",damage:"1d6",damageType:"bludgeoning",weightLb:4,cost:"5 gp",properties:[]}),
  w({profileId:"dnd5e-2014",id:"quarterstaff",displayName:"Quarterstaff",category:"simple",kind:"melee",damage:"1d6",damageType:"bludgeoning",weightLb:4,cost:"2 sp",properties:["versatile"],versatileDamage:"1d8"}),
  w({profileId:"dnd5e-2014",id:"sickle",displayName:"Sickle",category:"simple",kind:"melee",damage:"1d4",damageType:"slashing",weightLb:2,cost:"1 gp",properties:["light"]}),
  w({profileId:"dnd5e-2014",id:"spear",displayName:"Spear",category:"simple",kind:"melee",damage:"1d6",damageType:"piercing",weightLb:3,cost:"1 gp",properties:["thrown","versatile"],normalRangeFt:20,longRangeFt:60,versatileDamage:"1d8"}),
  w({profileId:"dnd5e-2014",id:"light-crossbow",displayName:"Light Crossbow",category:"simple",kind:"ranged",damage:"1d8",damageType:"piercing",weightLb:5,cost:"25 gp",properties:["ammunition","loading","two-handed"],normalRangeFt:80,longRangeFt:320}),
  w({profileId:"dnd5e-2014",id:"dart",displayName:"Dart",category:"simple",kind:"ranged",damage:"1d4",damageType:"piercing",weightLb:0.25,cost:"5 cp",properties:["finesse","thrown"],normalRangeFt:20,longRangeFt:60}),
  w({profileId:"dnd5e-2014",id:"shortbow",displayName:"Shortbow",category:"simple",kind:"ranged",damage:"1d6",damageType:"piercing",weightLb:2,cost:"25 gp",properties:["ammunition","two-handed"],normalRangeFt:80,longRangeFt:320}),
  w({profileId:"dnd5e-2014",id:"sling",displayName:"Sling",category:"simple",kind:"ranged",damage:"1d4",damageType:"bludgeoning",weightLb:0,cost:"1 sp",properties:["ammunition"],normalRangeFt:30,longRangeFt:120}),
  w({profileId:"dnd5e-2014",id:"battleaxe",displayName:"Battleaxe",category:"martial",kind:"melee",damage:"1d8",damageType:"slashing",weightLb:4,cost:"10 gp",properties:["versatile"],versatileDamage:"1d10"}),
  w({profileId:"dnd5e-2014",id:"flail",displayName:"Flail",category:"martial",kind:"melee",damage:"1d8",damageType:"bludgeoning",weightLb:2,cost:"10 gp",properties:[]}),
  w({profileId:"dnd5e-2014",id:"glaive",displayName:"Glaive",category:"martial",kind:"melee",damage:"1d10",damageType:"slashing",weightLb:6,cost:"20 gp",properties:["heavy","reach","two-handed"]}),
  w({profileId:"dnd5e-2014",id:"greataxe",displayName:"Greataxe",category:"martial",kind:"melee",damage:"1d12",damageType:"slashing",weightLb:7,cost:"30 gp",properties:["heavy","two-handed"]}),
  w({profileId:"dnd5e-2014",id:"greatsword",displayName:"Greatsword",category:"martial",kind:"melee",damage:"2d6",damageType:"slashing",weightLb:6,cost:"50 gp",properties:["heavy","two-handed"]}),
  w({profileId:"dnd5e-2014",id:"halberd",displayName:"Halberd",category:"martial",kind:"melee",damage:"1d10",damageType:"slashing",weightLb:6,cost:"20 gp",properties:["heavy","reach","two-handed"]}),
  w({profileId:"dnd5e-2014",id:"lance",displayName:"Lance",category:"martial",kind:"melee",damage:"1d12",damageType:"piercing",weightLb:6,cost:"10 gp",properties:["reach","special"]}),
  w({profileId:"dnd5e-2014",id:"longsword",displayName:"Longsword",category:"martial",kind:"melee",damage:"1d8",damageType:"slashing",weightLb:3,cost:"15 gp",properties:["versatile"],versatileDamage:"1d10"}),
  w({profileId:"dnd5e-2014",id:"maul",displayName:"Maul",category:"martial",kind:"melee",damage:"2d6",damageType:"bludgeoning",weightLb:10,cost:"10 gp",properties:["heavy","two-handed"]}),
  w({profileId:"dnd5e-2014",id:"morningstar",displayName:"Morningstar",category:"martial",kind:"melee",damage:"1d8",damageType:"piercing",weightLb:4,cost:"15 gp",properties:[]}),
  w({profileId:"dnd5e-2014",id:"pike",displayName:"Pike",category:"martial",kind:"melee",damage:"1d10",damageType:"piercing",weightLb:18,cost:"5 gp",properties:["heavy","reach","two-handed"]}),
  w({profileId:"dnd5e-2014",id:"rapier",displayName:"Rapier",category:"martial",kind:"melee",damage:"1d8",damageType:"piercing",weightLb:2,cost:"25 gp",properties:["finesse"]}),
  w({profileId:"dnd5e-2014",id:"scimitar",displayName:"Scimitar",category:"martial",kind:"melee",damage:"1d6",damageType:"slashing",weightLb:3,cost:"25 gp",properties:["finesse","light"]}),
  w({profileId:"dnd5e-2014",id:"shortsword",displayName:"Shortsword",category:"martial",kind:"melee",damage:"1d6",damageType:"piercing",weightLb:2,cost:"10 gp",properties:["finesse","light"]}),
  w({profileId:"dnd5e-2014",id:"trident",displayName:"Trident",category:"martial",kind:"melee",damage:"1d6",damageType:"piercing",weightLb:4,cost:"5 gp",properties:["thrown","versatile"],normalRangeFt:20,longRangeFt:60,versatileDamage:"1d8"}),
  w({profileId:"dnd5e-2014",id:"war-pick",displayName:"War Pick",category:"martial",kind:"melee",damage:"1d8",damageType:"piercing",weightLb:2,cost:"5 gp",properties:[]}),
  w({profileId:"dnd5e-2014",id:"warhammer",displayName:"Warhammer",category:"martial",kind:"melee",damage:"1d8",damageType:"bludgeoning",weightLb:2,cost:"15 gp",properties:["versatile"],versatileDamage:"1d10"}),
  w({profileId:"dnd5e-2014",id:"whip",displayName:"Whip",category:"martial",kind:"melee",damage:"1d4",damageType:"slashing",weightLb:3,cost:"2 gp",properties:["finesse","reach"]}),
  w({profileId:"dnd5e-2014",id:"blowgun",displayName:"Blowgun",category:"martial",kind:"ranged",damage:"1",damageType:"piercing",weightLb:1,cost:"10 gp",properties:["ammunition","loading"],normalRangeFt:25,longRangeFt:100}),
  w({profileId:"dnd5e-2014",id:"hand-crossbow",displayName:"Hand Crossbow",category:"martial",kind:"ranged",damage:"1d6",damageType:"piercing",weightLb:3,cost:"75 gp",properties:["ammunition","light","loading"],normalRangeFt:30,longRangeFt:120}),
  w({profileId:"dnd5e-2014",id:"heavy-crossbow",displayName:"Heavy Crossbow",category:"martial",kind:"ranged",damage:"1d10",damageType:"piercing",weightLb:18,cost:"50 gp",properties:["ammunition","heavy","loading","two-handed"],normalRangeFt:100,longRangeFt:400}),
  w({profileId:"dnd5e-2014",id:"longbow",displayName:"Longbow",category:"martial",kind:"ranged",damage:"1d8",damageType:"piercing",weightLb:2,cost:"50 gp",properties:["ammunition","heavy","two-handed"],normalRangeFt:150,longRangeFt:600}),
  w({profileId:"dnd5e-2014",id:"net",displayName:"Net",category:"martial",kind:"ranged",damage:"0",damageType:"bludgeoning",weightLb:3,cost:"1 gp",properties:["special","thrown"],normalRangeFt:5,longRangeFt:15}),
].map((entry) => [entry.id, entry]));

export const DND5E_2014_ARMOR: Record<string, Dnd5eArmorDefinition> = Object.fromEntries([
  a({profileId:"dnd5e-2014",id:"padded",displayName:"Padded",category:"light",baseAc:11,dexMode:"full",stealthDisadvantage:true,weightLb:8,cost:"5 gp"}),
  a({profileId:"dnd5e-2014",id:"leather",displayName:"Leather",category:"light",baseAc:11,dexMode:"full",stealthDisadvantage:false,weightLb:10,cost:"10 gp"}),
  a({profileId:"dnd5e-2014",id:"studded-leather",displayName:"Studded Leather",category:"light",baseAc:12,dexMode:"full",stealthDisadvantage:false,weightLb:13,cost:"45 gp"}),
  a({profileId:"dnd5e-2014",id:"hide",displayName:"Hide",category:"medium",baseAc:12,dexMode:"max-2",stealthDisadvantage:false,weightLb:12,cost:"10 gp"}),
  a({profileId:"dnd5e-2014",id:"chain-shirt",displayName:"Chain Shirt",category:"medium",baseAc:13,dexMode:"max-2",stealthDisadvantage:false,weightLb:20,cost:"50 gp"}),
  a({profileId:"dnd5e-2014",id:"scale-mail",displayName:"Scale Mail",category:"medium",baseAc:14,dexMode:"max-2",stealthDisadvantage:true,weightLb:45,cost:"50 gp"}),
  a({profileId:"dnd5e-2014",id:"breastplate",displayName:"Breastplate",category:"medium",baseAc:14,dexMode:"max-2",stealthDisadvantage:false,weightLb:20,cost:"400 gp"}),
  a({profileId:"dnd5e-2014",id:"half-plate",displayName:"Half Plate",category:"medium",baseAc:15,dexMode:"max-2",stealthDisadvantage:true,weightLb:40,cost:"750 gp"}),
  a({profileId:"dnd5e-2014",id:"ring-mail",displayName:"Ring Mail",category:"heavy",baseAc:14,dexMode:"none",stealthDisadvantage:true,weightLb:40,cost:"30 gp"}),
  a({profileId:"dnd5e-2014",id:"chain-mail",displayName:"Chain Mail",category:"heavy",baseAc:16,dexMode:"none",strengthRequirement:13,stealthDisadvantage:true,weightLb:55,cost:"75 gp"}),
  a({profileId:"dnd5e-2014",id:"splint",displayName:"Splint",category:"heavy",baseAc:17,dexMode:"none",strengthRequirement:15,stealthDisadvantage:true,weightLb:60,cost:"200 gp"}),
  a({profileId:"dnd5e-2014",id:"plate",displayName:"Plate",category:"heavy",baseAc:18,dexMode:"none",strengthRequirement:15,stealthDisadvantage:true,weightLb:65,cost:"1500 gp"}),
  a({profileId:"dnd5e-2014",id:"shield",displayName:"Shield",category:"shield",baseAc:0,dexMode:"none",stealthDisadvantage:false,weightLb:6,cost:"10 gp",shieldBonus:2}),
].map((entry) => [entry.id, entry]));
