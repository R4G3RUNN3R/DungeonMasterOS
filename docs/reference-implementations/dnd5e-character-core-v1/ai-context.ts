// Reference implementation only.
// Claude gets trusted resolved facts, not raw user-editable character JSON.

import type { Dnd5eCharacterSheetData } from "./sheet-model";

export type TrustedDnd5eAiContext = {
  rulesProfileId:string;
  identity:{name:string;ancestry:string;background:string;classes:string;level:number;xp:number};
  vital:{hp:string;ac:number;speedFt:number;conditions:string[];exhaustion:number};
  abilities:Record<string,string>;
  saves:Record<string,string>;
  keySkills:Array<{name:string;modifier:number;expertise:boolean}>;
  attacks:Array<{name:string;attackBonus:number;damage:string;mastery?:string;masteryActive?:boolean}>;
  features:string[];
  feats:string[];
  resources:Array<{label:string;current:number;maximum:number;refresh:string}>;
  spellcasting:Array<{classId:string;saveDc:number;attackBonus:number;slots?:Record<string,number>;pactSlots?:{maximum:number;used:number;slotLevel:number};prepared:string[];known:string[]}>;
  equipment:string[];
  languages:string[];
  attunement:string[];
  warnings:string[];
};

export function buildTrustedDnd5eAiContext(sheet:Dnd5eCharacterSheetData,warnings:string[]=[]):TrustedDnd5eAiContext{
  const abilities=Object.fromEntries(Object.entries(sheet.abilities).map(([id,value])=>[id.toUpperCase(),`${value.score} (${value.modifier>=0?"+":""}${value.modifier})`]));
  const saves=Object.fromEntries(sheet.saves.map(save=>[save.ability.toUpperCase(),`${save.modifier>=0?"+":""}${save.modifier}${save.proficient?" proficient":""}`]));
  const keySkills=sheet.skills.filter(skill=>skill.proficient||skill.expertise).map(skill=>({name:skill.name,modifier:skill.modifier,expertise:skill.expertise}));
  return {
    rulesProfileId:sheet.rulesProfileId,
    identity:{
      name:sheet.identity.characterName,ancestry:sheet.identity.ancestry,background:sheet.identity.background,
      classes:sheet.identity.classes.map(c=>`${c.className} ${c.level}${c.subclass?` (${c.subclass})`:""}`).join(" / "),
      level:sheet.identity.totalLevel,xp:sheet.identity.xp,
    },
    vital:{hp:`${sheet.hp.current}/${sheet.hp.maximum}${sheet.hp.temporary?` +${sheet.hp.temporary} temp`:""}`,ac:sheet.armorClass,speedFt:sheet.speedFt,conditions:sheet.conditions.map(c=>c.level?`${c.id} ${c.level}`:c.id),exhaustion:sheet.exhaustion},
    abilities,saves,keySkills,
    attacks:sheet.attacks.map(a=>({name:a.name,attackBonus:a.attackBonus,damage:`${a.damage}${a.damageAbilityBonus?`${a.damageAbilityBonus>=0?"+":""}${a.damageAbilityBonus}`:""}`,mastery:a.mastery,masteryActive:a.masteryActive})),
    features:sheet.features.map(feature=>`${feature.name} [${feature.source}]`),
    feats:sheet.feats.map(feat=>feat.name),
    resources:sheet.resources,
    spellcasting:sheet.spellcasting.map(block=>({classId:block.classId,saveDc:block.saveDc,attackBonus:block.attackBonus,slots:block.slots,pactSlots:block.pactSlots,prepared:block.prepared,known:block.known})),
    equipment:sheet.equipment.filter(item=>item.equipped).map(item=>item.name),languages:sheet.proficiencies.languages,attunement:sheet.attunement.map(item=>item.name),warnings,
  };
}

export function renderTrustedDnd5eAiContext(context:TrustedDnd5eAiContext):string{
  const lines:string[]=[
    `[RULESET: ${context.rulesProfileId}]`,
    `${context.identity.name}: ${context.identity.ancestry}; ${context.identity.background}; ${context.identity.classes}; character level ${context.identity.level}; XP ${context.identity.xp}.`,
    `HP ${context.vital.hp}; AC ${context.vital.ac}; speed ${context.vital.speedFt} ft.${context.vital.conditions.length?` Conditions: ${context.vital.conditions.join(", ")}.`:""}${context.vital.exhaustion?` Exhaustion ${context.vital.exhaustion}.`:""}`,
    `Abilities: ${Object.entries(context.abilities).map(([k,v])=>`${k} ${v}`).join(", ")}.`,
    `Saves: ${Object.entries(context.saves).map(([k,v])=>`${k} ${v}`).join(", ")}.`,
  ];
  if(context.keySkills.length) lines.push(`Trained skills: ${context.keySkills.map(s=>`${s.name} ${s.modifier>=0?"+":""}${s.modifier}${s.expertise?" expertise":""}`).join(", ")}.`);
  if(context.attacks.length) lines.push(`Attacks: ${context.attacks.map(a=>`${a.name} ${a.attackBonus>=0?"+":""}${a.attackBonus}, ${a.damage}${a.masteryActive?`, mastery ${a.mastery}`:""}`).join("; ")}.`);
  if(context.resources.length) lines.push(`Resources: ${context.resources.map(r=>`${r.label} ${r.current}/${r.maximum}`).join(", ")}.`);
  if(context.spellcasting.length) lines.push(`Spellcasting: ${context.spellcasting.map(s=>`${s.classId} DC ${s.saveDc}, attack ${s.attackBonus>=0?"+":""}${s.attackBonus}`).join("; ")}.`);
  if(context.equipment.length) lines.push(`Equipped: ${context.equipment.join(", ")}.`);
  if(context.languages.length) lines.push(`Languages: ${context.languages.join(", ")}.`);
  if(context.warnings.length) lines.push(`RULES WARNINGS: ${context.warnings.join(" | ")}`);
  return lines.join("\n");
}

export const AI_CONTEXT_POLICY=[
  "Do not send raw characterData as mechanically authoritative context.",
  "Do not let model narration mutate HP, inventory, spell slots, conditions, XP, levels, feats or resources directly.",
  "Narrative may propose state changes; the server validates and commits them.",
  "Keep the rules profile explicit in every mechanical prompt block so 2014 and 2024 rulings cannot silently blend.",
] as const;
