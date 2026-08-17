// Reference implementation only.
// Allows full owned/licensed campaign content without embedding commercial books in public core.

import type { Dnd5eRulesProfileId } from "./domain";
import type { Dnd5eAncestryDefinition } from "./species-types";
import type { Dnd5eBackgroundDefinition } from "./background-types";
import type { Dnd5eClassDefinition, Dnd5eSubclassDefinition } from "./class-types";
import type { Dnd5eFeatDefinition } from "./feat-types";
import type { Dnd5eArmorDefinition, Dnd5eWeaponDefinition } from "./equipment-types";

export type Dnd5eSpellDefinitionRef = {
  id:string; displayName:string; spellLevel:number; classes:string[]; sourceId:string;
  rulesProfileId:Dnd5eRulesProfileId;
  /** Runtime rules payload may live in a licensed/private source provider. */
  ruleKey:string;
};

export type Dnd5eRulesSourcePack = {
  id:string;
  displayName:string;
  profileId:Dnd5eRulesProfileId;
  publisher?:string;
  sourceVersion?:string;
  access:"public-srd"|"owned-private"|"licensed-provider"|"homebrew";
  dependencies:string[];
  ancestry:Record<string,Dnd5eAncestryDefinition>;
  backgrounds:Record<string,Dnd5eBackgroundDefinition>;
  classes:Record<string,Dnd5eClassDefinition>;
  subclasses:Record<string,Dnd5eSubclassDefinition>;
  feats:Record<string,Dnd5eFeatDefinition>;
  weapons:Record<string,Dnd5eWeaponDefinition>;
  armor:Record<string,Dnd5eArmorDefinition>;
  spells:Record<string,Dnd5eSpellDefinitionRef>;
  /** Extension hooks for class features, invocations, metamagic, boons, etc. */
  optionRegistries:Record<string,Record<string,unknown>>;
};

export type CampaignSourcePolicy = {
  rulesProfileId:Dnd5eRulesProfileId;
  enabledSourcePackIds:string[];
  optionalRules:Record<string,boolean|string|number>;
};

export function validateSourcePack(pack:Dnd5eRulesSourcePack,policy:CampaignSourcePolicy,availablePackIds:Set<string>):string[]{
  const errors:string[]=[];
  if(pack.profileId!==policy.rulesProfileId) errors.push(`${pack.id} is for ${pack.profileId}, not ${policy.rulesProfileId}.`);
  for(const dependency of pack.dependencies) if(!availablePackIds.has(dependency)) errors.push(`${pack.id} requires source pack ${dependency}.`);
  return errors;
}

export function resolveOption<T>(
  id:string,
  core:Record<string,T>,
  enabledPacks:Dnd5eRulesSourcePack[],
  select:(pack:Dnd5eRulesSourcePack)=>Record<string,T>,
):T|undefined{
  if(core[id]) return core[id];
  for(const pack of enabledPacks){
    const option=select(pack)[id];
    if(option) return option;
  }
  return undefined;
}

export const SOURCE_PACK_RULES=[
  "Campaign source policy controls legality. An option existing somewhere in storage does not make it legal in every campaign.",
  "Commercial user-owned rules may be parsed/indexed privately for the owning campaign, but public GitHub core should contain only lawfully distributable mechanics/content.",
  "Do not combine 2014 and 2024 source packs unless an explicit conversion source pack defines the mapping.",
  "Homebrew is a source pack with the same validation/versioning rules, not an untyped text exception.",
  "Prestige-like optional systems, if a legitimate 5e source actually defines one, register through an extension pack rather than contaminating core class progression.",
] as const;
