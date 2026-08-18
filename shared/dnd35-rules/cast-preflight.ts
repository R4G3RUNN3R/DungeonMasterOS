import type {
  Dnd35CastRequest,
  Dnd35CastResolution,
  Dnd35FeatDefinition,
  Dnd35SpellDefinition,
  Dnd35SpellLevel,
  Dnd35SpellcastingState,
} from "./types";

const abilityModifier = (score: number) => Math.floor((score - 10) / 2);
const findClassAccess = (spell: Dnd35SpellDefinition, classId: string) => spell.classAccess.find((entry) => entry.classId === classId);
const hasComponent = (spell: Dnd35SpellDefinition, kind: "V" | "S") => spell.components.some((component) => component.kind === kind && component.required);
const hasMetamagicTransform = (feats: Dnd35FeatDefinition[], target: string, operation: string) => feats.some((feat) => feat.metamagic?.transformations.some((rule) => rule.target === target && rule.operation === operation));
const numericSlotAdjustment = (feat: Dnd35FeatDefinition) => typeof feat.metamagic?.slotAdjustment === "number" ? feat.metamagic.slotAdjustment : 0;

export type Dnd35CastPreflightInput = {
  spell: Dnd35SpellDefinition;
  casting: Dnd35SpellcastingState;
  request: Dnd35CastRequest;
  characterFeatIds: string[];
  metamagicFeats?: Dnd35FeatDefinition[];
  heightenedLevel?: Dnd35SpellLevel;
};

export function resolveDnd35CastPreflight(input: Dnd35CastPreflightInput): Dnd35CastResolution {
  const { spell, casting, request, characterFeatIds } = input;
  const metamagicFeats = input.metamagicFeats ?? [];
  const decisions: Dnd35CastResolution["decisions"] = [];
  const push = (code: string, passed: boolean, blocking: boolean, message: string) => decisions.push({ code, passed, blocking, message });

  if (request.itemAccess) {
    const item = request.itemAccess;
    push("ITEM_ACCESS", true, false, `Casting through item access: ${item.itemName}.`);
    push("ITEM_SPELL_MATCH", !item.spellId || item.spellId === spell.id, true, !item.spellId || item.spellId === spell.id ? "The selected item can provide this spell." : "The selected item does not provide this spell.");
    if (typeof item.chargesRemaining === "number" && item.chargesRemaining <= 0) push("ITEM_CHARGES", false, true, "The selected item has no charges remaining.");
  }

  const classId = request.castingClassId ?? casting.classId;
  const classAccess = findClassAccess(spell, classId);
  const itemBypassesClassList = Boolean(request.itemAccess && request.itemAccess.requiresClassList === false);
  push("CLASS_LIST", Boolean(classAccess || itemBypassesClassList), true, classAccess ? `Spell is on the ${classId} spell list.` : itemBypassesClassList ? "Item activation does not require class-list access." : `Spell is not available on the ${classId} spell list for this casting route.`);

  const baseSpellLevel = classAccess?.level ?? request.itemAccess?.spellLevel;
  push("SPELL_LEVEL", baseSpellLevel !== undefined, true, baseSpellLevel === undefined ? "Unable to determine the spell level for this casting route." : `Base spell level is ${baseSpellLevel}.`);

  if (baseSpellLevel !== undefined && !request.itemAccess) {
    const requiredAbility = 10 + baseSpellLevel;
    push("ABILITY_SCORE", casting.castingAbilityScore >= requiredAbility, true, casting.castingAbilityScore >= requiredAbility ? `Casting ability meets the minimum score ${requiredAbility}.` : `Casting ability score ${casting.castingAbilityScore} is below the required ${requiredAbility}.`);
  }

  push("PROHIBITED_SCHOOL", !(casting.prohibitedSchools?.includes(spell.school) && !request.itemAccess), true, casting.prohibitedSchools?.includes(spell.school) && !request.itemAccess ? `${spell.school} is a prohibited school for this caster.` : "Spell school is permitted for this casting route.");

  const requestedMetamagicIds = request.metamagicFeatIds ?? [];
  for (const featId of requestedMetamagicIds) push(`METAMAGIC_KNOWN:${featId}`, characterFeatIds.includes(featId), true, characterFeatIds.includes(featId) ? `Caster has ${featId}.` : `Caster does not have metamagic feat ${featId}.`);
  for (const featId of requestedMetamagicIds.filter((featId) => !metamagicFeats.some((feat) => feat.id === featId))) push(`METAMAGIC_DEFINITION:${featId}`, false, true, `No executable metamagic definition is loaded for ${featId}.`);

  let slotLevel = baseSpellLevel;
  if (baseSpellLevel !== undefined) {
    const fixedAdjustment = metamagicFeats.reduce((sum, feat) => sum + numericSlotAdjustment(feat), 0);
    slotLevel = (baseSpellLevel + fixedAdjustment) as Dnd35SpellLevel;
    const heighten = metamagicFeats.find((feat) => feat.id === "heighten-spell");
    if (heighten) {
      if (input.heightenedLevel === undefined || input.heightenedLevel <= baseSpellLevel) push("HEIGHTEN_LEVEL", false, true, "Heighten Spell requires a selected spell level above the spell's normal level.");
      else { slotLevel = (input.heightenedLevel + fixedAdjustment) as Dnd35SpellLevel; push("HEIGHTEN_LEVEL", true, false, `Spell is heightened to level ${input.heightenedLevel}.`); }
    }
    push("SLOT_LEVEL_RANGE", slotLevel <= 9, true, slotLevel > 9 ? `Modified spell requires level ${slotLevel}, above the normal 0-9 spell-slot range.` : `Modified spell requires a level ${slotLevel} slot.`);
  }

  const effectiveSpellLevel = metamagicFeats.some((feat) => feat.metamagic?.effectiveSpellLevel === "slot_level") ? input.heightenedLevel ?? baseSpellLevel : baseSpellLevel;

  if (!request.itemAccess && baseSpellLevel !== undefined) {
    const spellKnown = casting.knownSpellIds?.includes(spell.id) ?? false;
    const inSpellbook = casting.spellbookSpellIds?.includes(spell.id) ?? false;
    const prepared = casting.preparedSpells?.some((entry) => entry.spellId === spell.id && entry.preparedCount > entry.expendedCount && (slotLevel === undefined || entry.slotLevel === slotLevel)) ?? false;
    if (casting.mode === "spontaneous_known") push("SPELL_KNOWN", spellKnown, true, spellKnown ? "Spell is known by the spontaneous caster." : "Spell is not known by the spontaneous caster.");
    else if (casting.mode === "prepared_spellbook") {
      push("SPELLBOOK", inSpellbook, true, inSpellbook ? "Spell is recorded in the caster's spellbook." : "Spell is not recorded in the caster's spellbook.");
      push("PREPARED", prepared, true, prepared ? "A matching prepared casting remains." : "No matching prepared casting remains.");
    } else if (casting.mode === "prepared_divine") push("PREPARED", prepared, true, prepared ? "A matching prepared divine casting remains." : "No matching prepared divine casting remains.");

    if (slotLevel !== undefined && slotLevel <= 9) {
      const normalPool = casting.spellSlots[slotLevel];
      const bonusPool = casting.bonusSpellSlots?.[slotLevel];
      const available = (normalPool ? normalPool.maximum - normalPool.expended : 0) + (bonusPool ? bonusPool.maximum - bonusPool.expended : 0);
      push("SPELL_SLOT", available > 0, true, available > 0 ? `At least one level ${slotLevel} slot remains.` : `No level ${slotLevel} spell slot remains.`);
    }
  }

  const silentApplied = hasMetamagicTransform(metamagicFeats, "spell.components.V", "remove");
  const stillApplied = hasMetamagicTransform(metamagicFeats, "spell.components.S", "remove");
  if (hasComponent(spell, "V") && !silentApplied) push("VERBAL_COMPONENT", request.environment.canSpeak, true, request.environment.canSpeak ? "Verbal component can be provided." : "Caster cannot provide the verbal component.");
  if (hasComponent(spell, "S") && !stillApplied) push("SOMATIC_COMPONENT", request.environment.hasSomaticFreedom, true, request.environment.hasSomaticFreedom ? "Somatic component can be provided." : "Caster cannot provide the somatic component.");

  push("ANTIMAGIC", !request.environment.antimagic, true, request.environment.antimagic ? "The casting environment is flagged as antimagic; spell resolution requires an explicit exception before proceeding." : "No antimagic suppression is flagged.");
  if (spell.targeting.lineOfEffectRequired) push("LINE_OF_EFFECT", request.environment.lineOfEffect !== false, true, request.environment.lineOfEffect === false ? "Required line of effect is blocked." : "Required line of effect is available or not flagged as blocked.");
  if (spell.targeting.lineOfSightRequired) push("LINE_OF_SIGHT", request.environment.lineOfSight !== false, true, request.environment.lineOfSight === false ? "Required line of sight is blocked." : "Required line of sight is available or not flagged as blocked.");
  if (!request.itemAccess && casting.mode === "spontaneous_known" && requestedMetamagicIds.includes("quicken-spell")) push("SPONTANEOUS_QUICKEN", false, true, "Core spontaneous metamagic casting-time rules prevent spontaneous Quicken Spell unless another rule explicitly overrides them.");

  const arcaneSpellFailureCheckRequired = !request.itemAccess && casting.tradition === "arcane" && (request.environment.arcaneSpellFailurePercent ?? 0) > 0 && hasComponent(spell, "S") && !stillApplied;
  if (arcaneSpellFailureCheckRequired) push("ARCANE_SPELL_FAILURE", true, false, `Arcane spell failure check required at ${request.environment.arcaneSpellFailurePercent}%.`);

  const saveDc = effectiveSpellLevel !== undefined && !request.itemAccess ? 10 + effectiveSpellLevel + abilityModifier(casting.castingAbilityScore) : undefined;
  const legal = !decisions.some((decision) => decision.blocking && !decision.passed);
  return { legal, baseSpellLevel, slotLevel, effectiveSpellLevel, casterLevel: request.itemAccess?.casterLevel ?? casting.casterLevel, saveDc, attackRoll: spell.attackRoll, spellResistanceCheckRequired: spell.spellResistance.applies === true, arcaneSpellFailureCheckRequired, decisions };
}
