// Reference implementation only. SRD 5.2.1 public feat catalogue.
// Rules are concise machine-oriented summaries, not copied sourcebook prose.

import type { Dnd5eFeatDefinition, Dnd5eFeatPrerequisite } from "./feat-types";

const level4: Dnd5eFeatPrerequisite = { type: "minimum-level", level: 4 };
const abilityOne = (abilities: Array<"str"|"dex"|"con"|"int"|"wis"|"cha">, minimum = 13): Dnd5eFeatPrerequisite => ({ type:"ability-one-of-minimum", abilities, minimum });
const feat = (value: Dnd5eFeatDefinition) => value;
const general = (id:string, displayName:string, prerequisites:Dnd5eFeatPrerequisite[] = [level4], rules:Dnd5eFeatDefinition["rules"] = [], choices:Dnd5eFeatDefinition["choices"] = []) => feat({ profileId:"dnd5e-2024", id, displayName, category:"general", prerequisites, choices, rules });
const origin = (id:string, displayName:string, rules:Dnd5eFeatDefinition["rules"], choices:Dnd5eFeatDefinition["choices"] = []) => feat({ profileId:"dnd5e-2024", id, displayName, category:"origin", prerequisites:[], choices, rules });
const fighting = (id:string, displayName:string, rules:Dnd5eFeatDefinition["rules"]) => feat({ profileId:"dnd5e-2024", id, displayName, category:"fighting-style", prerequisites:[{type:"fighting-style-feature"}], choices:[], rules });

export const DND5E_2024_ORIGIN_FEATS: Record<string,Dnd5eFeatDefinition> = {
  alert: origin("alert","Alert",[
    {kind:"initiative",data:{proficiencyBonusToInitiative:true}},
    {kind:"initiative",data:{swapInitiativeWithWillingAllyAfterRolls:true}},
  ]),
  crafter: origin("crafter","Crafter",[
    {kind:"proficiency",data:{artisanToolChoices:3}},
    {kind:"other",data:{nonmagicalPurchaseDiscountPercent:20}},
    {kind:"rest",data:{fastCraftingDuringLongRest:true}},
  ],[{choiceId:"crafter:tools",count:3,options:"source-registry",distinct:true}]),
  healer: origin("healer","Healer",[
    {kind:"healing",data:{battleMedicUsesHealersKit:true, targetSpendsHitDie:true}},
    {kind:"healing",data:{rerollHealingDieOnNaturalOne:true, mustUseNewRoll:true}},
  ]),
  lucky: origin("lucky","Lucky",[
    {kind:"resource",data:{luckPoints:"pb",refresh:"long-rest"}},
    {kind:"reroll",data:{spendForAdvantageOnD20Test:true, spendToImposeDisadvantageOnAttackAgainstYou:true}},
  ]),
  "magic-initiate": origin("magic-initiate","Magic Initiate",[
    {kind:"spell",data:{chooseClassList:true, cantrips:2, level1Spells:1, freeLevel1CastPerLongRest:true, slotsAlsoAllowed:true, chooseCastingAbility:true}},
  ],[
    {choiceId:"magic-initiate:list",count:1,options:["cleric","druid","wizard"]},
    {choiceId:"magic-initiate:cantrips",count:2,options:"source-registry",distinct:true},
    {choiceId:"magic-initiate:spell",count:1,options:"source-registry"},
    {choiceId:"magic-initiate:ability",count:1,options:["int","wis","cha"]},
  ]),
  musician: origin("musician","Musician",[
    {kind:"proficiency",data:{musicalInstrumentChoices:3}},
    {kind:"rest",data:{inspireAlliesAfterShortOrLongRest:true, allies:"pb",grantsHeroicInspiration:true}},
  ],[{choiceId:"musician:instruments",count:3,options:"source-registry",distinct:true}]),
  "savage-attacker": origin("savage-attacker","Savage Attacker",[
    {kind:"damage",data:{oncePerTurnRerollWeaponDamageDice:true,useEitherTotal:true}},
  ]),
  skilled: origin("skilled","Skilled",[
    {kind:"proficiency",data:{skillOrToolChoices:3}},
  ],[{choiceId:"skilled:proficiencies",count:3,options:"source-registry",distinct:true}]),
  "tavern-brawler": origin("tavern-brawler","Tavern Brawler",[
    {kind:"weapon",data:{enhancedUnarmedStrike:true,unarmedDamage:"1d4"}},
    {kind:"reroll",data:{rerollNaturalOneOnUnarmedDamage:true}},
    {kind:"action",data:{push5FtAfterUnarmedHitOncePerTurn:true}},
    {kind:"other",data:{improvisedWeaponProficiency:true}},
  ]),
  tough: origin("tough","Tough",[
    {kind:"other",data:{maxHpPerCharacterLevel:2,retroactive:true}},
  ]),
};

export const DND5E_2024_FIGHTING_STYLE_FEATS: Record<string,Dnd5eFeatDefinition> = {
  archery: fighting("fighting-style:archery","Archery",[{kind:"weapon",data:{rangedWeaponAttackBonus:2}}]),
  "blind-fighting": fighting("fighting-style:blind-fighting","Blind Fighting",[{kind:"other",data:{blindsightFt:10}}]),
  defense: fighting("fighting-style:defense","Defense",[{kind:"armor",data:{acBonus:1,requiresArmor:true}}]),
  dueling: fighting("fighting-style:dueling","Dueling",[{kind:"damage",data:{meleeWeaponDamageBonus:2,oneHandedNoOtherWeapon:true}}]),
  "great-weapon-fighting": fighting("fighting-style:great-weapon-fighting","Great Weapon Fighting",[{kind:"damage",data:{minimumWeaponDamageDieResult:3,requiresTwoHandedOrVersatileTwoHands:true}}]),
  interception: fighting("fighting-style:interception","Interception",[{kind:"reaction",data:{reduceNearbyAllyDamage:"1d10+pb",requiresShieldOrWeapon:true}}]),
  protection: fighting("fighting-style:protection","Protection",[{kind:"reaction",data:{imposeDisadvantageOnAttackAgainstNearbyAlly:true,requiresShield:true}}]),
  "thrown-weapon-fighting": fighting("fighting-style:thrown-weapon-fighting","Thrown Weapon Fighting",[{kind:"damage",data:{thrownWeaponDamageBonus:2}}]),
  "two-weapon-fighting": fighting("fighting-style:two-weapon-fighting","Two-Weapon Fighting",[{kind:"damage",data:{addAbilityModifierToLightPropertyExtraAttack:true}}]),
  "unarmed-fighting": fighting("fighting-style:unarmed-fighting","Unarmed Fighting",[{kind:"weapon",data:{unarmedDamage:"1d6-or-1d8-empty-hands"}},{kind:"damage",data:{grappledCreatureDamageAtTurnStart:"1d4"}}]),
};

export const DND5E_2024_GENERAL_FEATS: Record<string,Dnd5eFeatDefinition> = {
  "ability-score-improvement": general("ability-score-improvement","Ability Score Improvement",[level4],[{kind:"ability-increase",data:{pattern:"+2 one or +1/+1 two",maximum:20}}],[{choiceId:"asi:abilities",count:1,options:"any-ability"}]),
  charger: general("charger","Charger",[level4,abilityOne(["str","dex"])],[{kind:"action",data:{dashThenAttackOrShoveBonus:true,straightLineFt:10,oncePerTurn:true}}]),
  "crossbow-expert": general("crossbow-expert","Crossbow Expert",[level4,abilityOne(["dex"])],[{kind:"ability-increase",data:{choose:"dex",amount:1,maximum:20}},{kind:"weapon",data:{ignoreCrossbowLoading:true,noCloseRangeDisadvantage:true,dualWieldHandCrossbowAbilityDamage:true}}]),
  "defensive-duelist": general("defensive-duelist","Defensive Duelist",[level4,abilityOne(["dex"])],[{kind:"ability-increase",data:{choose:"dex",amount:1,maximum:20}},{kind:"reaction",data:{finesseWeaponAddPbToAcAgainstMeleeAttack:true}}]),
  "dual-wielder": general("dual-wielder","Dual Wielder",[level4,abilityOne(["str","dex"])],[{kind:"ability-increase",data:{choose:"str-or-dex",amount:1,maximum:20}},{kind:"weapon",data:{enhancedDualWielding:true,quickDraw:true}}]),
  durable: general("durable","Durable",[level4,abilityOne(["con"])],[{kind:"ability-increase",data:{choose:"con",amount:1,maximum:20}},{kind:"healing",data:{hitDiceMinimumHealing:"2x-con-mod-min2"}},{kind:"other",data:{advantageDeathSaves:true}}]),
  "elemental-adept": general("elemental-adept","Elemental Adept",[level4,{type:"spellcasting"}],[{kind:"spell",data:{chooseDamageType:true,ignoreResistance:true,minimumDamageDieResult:2}}],[{choiceId:"elemental-adept:type",count:1,options:["acid","cold","fire","lightning","thunder"]}]),
  grappler: general("grappler","Grappler",[level4,abilityOne(["str","dex"])],[{kind:"ability-increase",data:{choose:"str-or-dex",amount:1,maximum:20}},{kind:"action",data:{punchAndGrab:true,attackAdvantageAgainstGrappledTarget:true,moveGrappledSameSizeWithoutExtraCost:true}}]),
  "great-weapon-master": general("great-weapon-master","Great Weapon Master",[level4,abilityOne(["str"])],[{kind:"ability-increase",data:{choose:"str",amount:1,maximum:20}},{kind:"damage",data:{heavyWeaponDamageBonus:"pb-on-attack-action-hit"}},{kind:"bonus-action",data:{extraAttackAfterCritOrReduceTo0:true}}]),
  "heavily-armored": general("heavily-armored","Heavily Armored",[level4,{type:"proficiency",kind:"armor",id:"medium"}],[{kind:"ability-increase",data:{choose:"str-or-con",amount:1,maximum:20}},{kind:"proficiency",data:{heavyArmorTraining:true}}]),
  "heavy-armor-master": general("heavy-armor-master","Heavy Armor Master",[level4,{type:"proficiency",kind:"armor",id:"heavy"}],[{kind:"ability-increase",data:{choose:"str-or-con",amount:1,maximum:20}},{kind:"damage",data:{physicalDamageReduction:"pb",requiresHeavyArmor:true}}]),
  "inspiring-leader": general("inspiring-leader","Inspiring Leader",[level4,abilityOne(["wis","cha"])],[{kind:"ability-increase",data:{choose:"wis-or-cha",amount:1,maximum:20}},{kind:"rest",data:{grantTempHpAfterShortOrLongRest:"2x-level+chosen-ability-mod",targetsUpTo6:true}}]),
  "mage-slayer": general("mage-slayer","Mage Slayer",[level4],[{kind:"ability-increase",data:{choose:"str-or-dex",amount:1,maximum:20}},{kind:"save",data:{advantageIntWisChaSavesFromCreatureWithin5Ft:true}},{kind:"reaction",data:{attackAfterNearbyCreatureCastsSpell:true}}]),
  "martial-weapon-training": general("martial-weapon-training","Martial Weapon Training",[level4],[{kind:"ability-increase",data:{choose:"str-or-dex",amount:1,maximum:20}},{kind:"proficiency",data:{martialWeapons:true}}]),
  "medium-armor-master": general("medium-armor-master","Medium Armor Master",[level4,{type:"proficiency",kind:"armor",id:"medium"}],[{kind:"ability-increase",data:{choose:"str-or-dex",amount:1,maximum:20}},{kind:"armor",data:{mediumArmorDexCap:3,noStealthDisadvantageFromMediumArmor:true}}]),
  "mounted-combatant": general("mounted-combatant","Mounted Combatant",[level4],[{kind:"ability-increase",data:{choose:"str-dex-wis",amount:1,maximum:20}},{kind:"advantage",data:{meleeAttacksVsSmallerUnmountedTargets:true}},{kind:"other",data:{redirectMountAttacksToSelf:true,mountEvasion:true}}]),
  observant: general("observant","Observant",[level4,abilityOne(["int","wis"])],[{kind:"ability-increase",data:{choose:"int-or-wis",amount:1,maximum:20}},{kind:"proficiency",data:{chooseInsightInvestigationPerceptionExpertiseOrProficiency:true}},{kind:"bonus-action",data:{searchAction:true}}]),
  piercer: general("piercer","Piercer",[level4],[{kind:"ability-increase",data:{choose:"str-or-dex",amount:1,maximum:20}},{kind:"damage",data:{rerollOnePiercingDamageDiePerTurn:true,extraDieOnPiercingCritical:true}}]),
  poisoner: general("poisoner","Poisoner",[level4],[{kind:"ability-increase",data:{choose:"dex-or-int",amount:1,maximum:20}},{kind:"proficiency",data:{poisonersKit:true}},{kind:"damage",data:{ignorePoisonResistance:true}},{kind:"other",data:{craftPoison:true}}]),
  "polearm-master": general("polearm-master","Polearm Master",[level4,abilityOne(["str","dex"])],[{kind:"ability-increase",data:{choose:"str-or-dex",amount:1,maximum:20}},{kind:"bonus-action",data:{poleStrike:true}},{kind:"reaction",data:{reactiveStrikeWhenCreatureEntersReach:true}}]),
  resilient: general("resilient","Resilient",[level4],[{kind:"ability-increase",data:{chosenAbilityAmount:1,maximum:20}},{kind:"proficiency",data:{savingThrowForChosenAbility:true}}],[{choiceId:"resilient:ability",count:1,options:"any-ability"}]),
  "ritual-caster": general("ritual-caster","Ritual Caster",[level4,abilityOne(["int","wis","cha"])],[{kind:"ability-increase",data:{choose:"int-wis-cha",amount:1,maximum:20}},{kind:"spell",data:{ritualSpellsPrepared:"pb",replaceOnLevel:true,quickRitualOncePerLongRest:true}}]),
  sentinel: general("sentinel","Sentinel",[level4],[{kind:"ability-increase",data:{choose:"str-or-dex",amount:1,maximum:20}},{kind:"reaction",data:{guardianOpportunityAttack:true,haltMovementOnOpportunityHit:true}}]),
  "shadow-touched": general("shadow-touched","Shadow Touched",[level4],[{kind:"ability-increase",data:{choose:"int-wis-cha",amount:1,maximum:20}},{kind:"spell",data:{alwaysPreparedInvisibility:true,chooseOneLevel1IllusionOrNecromancy:true,freeCastEachPerLongRest:true,slotsAlsoAllowed:true}}]),
  sharpshooter: general("sharpshooter","Sharpshooter",[level4,abilityOne(["dex"])],[{kind:"ability-increase",data:{choose:"dex",amount:1,maximum:20}},{kind:"weapon",data:{ignoreCoverHalfThreeQuarters:true,noLongRangeDisadvantage:true,pointBlankNoDisadvantage:true}}]),
  "shield-master": general("shield-master","Shield Master",[level4,{type:"proficiency",kind:"shield",id:"shield"}],[{kind:"ability-increase",data:{choose:"str",amount:1,maximum:20}},{kind:"action",data:{shieldBashAfterAttack:true}},{kind:"save",data:{interposeShieldDexSaveBonus:true}}]),
  "skill-expert": general("skill-expert","Skill Expert",[level4],[{kind:"ability-increase",data:{chosenAbilityAmount:1,maximum:20}},{kind:"proficiency",data:{skillChoice:1}},{kind:"expertise",data:{skillChoice:1}}]),
  skulker: general("skulker","Skulker",[level4,abilityOne(["dex"])],[{kind:"ability-increase",data:{choose:"dex",amount:1,maximum:20}},{kind:"other",data:{blindsightFt:10,advantageStealthInCombat:true,missDoesNotRevealPosition:true}}]),
  slasher: general("slasher","Slasher",[level4],[{kind:"ability-increase",data:{choose:"str-or-dex",amount:1,maximum:20}},{kind:"damage",data:{reduceSpeedOnSlashingHitOncePerTurnFt:10,criticalImposesAttackDisadvantage:true}}]),
  speedy: general("speedy","Speedy",[level4,abilityOne(["dex","con"])],[{kind:"ability-increase",data:{choose:"dex-or-con",amount:1,maximum:20}},{kind:"movement",data:{speedBonusFt:10,dashDifficultTerrainIgnored:true,opportunityAttacksDisadvantage:true}}]),
  "spell-sniper": general("spell-sniper","Spell Sniper",[level4,{type:"spellcasting"}],[{kind:"ability-increase",data:{choose:"int-wis-cha",amount:1,maximum:20}},{kind:"spell",data:{ignoreCoverOnSpellAttacks:true,noCloseRangeDisadvantage:true,rangeIncreaseForAttackSpells:true}}]),
  telekinetic: general("telekinetic","Telekinetic",[level4],[{kind:"ability-increase",data:{choose:"int-wis-cha",amount:1,maximum:20}},{kind:"spell",data:{mageHandAlwaysPreparedEnhanced:true}},{kind:"bonus-action",data:{telekineticShove:true}}]),
  telepathic: general("telepathic","Telepathic",[level4],[{kind:"ability-increase",data:{choose:"int-wis-cha",amount:1,maximum:20}},{kind:"other",data:{telepathyFt:60}},{kind:"spell",data:{detectThoughtsAlwaysPreparedFreeCastLongRest:true}}]),
  "war-caster": general("war-caster","War Caster",[level4,{type:"spellcasting"}],[{kind:"ability-increase",data:{choose:"int-wis-cha",amount:1,maximum:20}},{kind:"advantage",data:{concentrationSaves:true}},{kind:"spell",data:{somaticWithHandsOccupied:true,reactiveSpellInsteadOpportunityAttack:true}}]),
  "weapon-master": general("weapon-master","Weapon Master",[level4],[{kind:"ability-increase",data:{choose:"str-or-dex",amount:1,maximum:20}},{kind:"mastery",data:{oneWeaponMasteryProperty:true,changeAfterLongRest:true}}]),
};

/** Epic Boons are a distinct level-19+ category. Full public boon mechanics stay in a separate source table. */
export const DND5E_2024_FEATS: Record<string,Dnd5eFeatDefinition> = {
  ...DND5E_2024_ORIGIN_FEATS,
  ...DND5E_2024_FIGHTING_STYLE_FEATS,
  ...DND5E_2024_GENERAL_FEATS,
};

export function get2024Feat(id:string): Dnd5eFeatDefinition | undefined {
  return DND5E_2024_FEATS[id];
}
