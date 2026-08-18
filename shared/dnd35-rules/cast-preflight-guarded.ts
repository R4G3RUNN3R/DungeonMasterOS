import { resolveDnd35CastPreflight as resolveBasePreflight } from "./cast-preflight";
import type {
  Dnd35CastResolution,
  Dnd35FeatDefinition,
  Dnd35RuleDecision,
  Dnd35SpellComponent,
  Dnd35SpellTradition,
} from "./types";
import type { Dnd35CastPreflightInput } from "./cast-preflight";

export type Dnd35ComponentAccessState = {
  hasSpellComponentPouch?: boolean;
  canEschewOrdinaryMaterials?: boolean;
  hasDivineFocus?: boolean;
  itemTags?: string[];
  availableXp?: number;
};

export type Dnd35GuardedCastPreflightInput = Dnd35CastPreflightInput & { componentAccess?: Dnd35ComponentAccessState };

type TraditionAwareComponent = Dnd35SpellComponent & {
  appliesToTradition?: Dnd35SpellTradition;
  alternativeGroup?: string;
};

const requiredTagsPresent = (required: string[] | undefined, available: string[] | undefined) => {
  if (!required?.length) return false;
  const availableSet = new Set(available ?? []);
  return required.every((tag) => availableSet.has(tag));
};

function componentDecision(
  component: TraditionAwareComponent,
  access: Dnd35ComponentAccessState,
  tradition: Dnd35SpellTradition,
): Dnd35RuleDecision | null {
  if (!component.required) return null;

  if (component.appliesToTradition && component.appliesToTradition !== tradition) return null;

  if (component.kind === "M") {
    const gpCost = component.gpCost ?? 0;
    const eschewEligible = gpCost <= 1;
    const costly = gpCost > 1;
    const specificallyTagged = Boolean(component.itemTags?.length);
    const ordinaryAccess = access.hasSpellComponentPouch === true || (eschewEligible && access.canEschewOrdinaryMaterials === true);

    if (!costly && !specificallyTagged) {
      return {
        code: "MATERIAL_COMPONENT",
        passed: ordinaryAccess,
        blocking: true,
        message: ordinaryAccess
          ? access.hasSpellComponentPouch
            ? "A spell component pouch satisfies the ordinary material component."
            : "Eschew Materials satisfies the ordinary material component."
          : "The spell requires an ordinary material component and neither a usable component pouch nor an applicable Eschew Materials feat is recorded.",
      };
    }

    if (!costly && specificallyTagged && ordinaryAccess) {
      return {
        code: "MATERIAL_COMPONENT",
        passed: true,
        blocking: true,
        message: access.hasSpellComponentPouch
          ? "A spell component pouch satisfies this ordinary material component."
          : "Eschew Materials satisfies this material component because its encoded cost does not exceed 1 gp.",
      };
    }

    const passed = requiredTagsPresent(component.itemTags, access.itemTags);
    return {
      code: costly ? "COSTLY_MATERIAL_COMPONENT" : "SPECIFIC_MATERIAL_COMPONENT",
      passed,
      blocking: true,
      message: passed
        ? "The required specific material component is present."
        : costly
          ? `The spell requires its specific costly material component${component.gpCost ? ` (${component.gpCost} gp)` : ""}; generic wealth, a component pouch, and Eschew Materials do not satisfy this check.`
          : "The spell requires a specific material component that is not present in recorded inventory tags.",
    };
  }

  if (component.kind === "F") {
    const costly = (component.gpCost ?? 0) > 0;
    const taggedFocusPresent = requiredTagsPresent(component.itemTags, access.itemTags);
    const passed = costly ? taggedFocusPresent : access.hasSpellComponentPouch === true || taggedFocusPresent;
    return {
      code: costly ? "COSTLY_FOCUS_COMPONENT" : "FOCUS_COMPONENT",
      passed,
      blocking: true,
      message: passed
        ? costly
          ? "The required costly focus is present."
          : "The ordinary focus is available from a spell component pouch or as an explicitly recorded focus."
        : costly
          ? `The spell requires its specific costly focus${component.gpCost ? ` (${component.gpCost} gp)` : ""}; a spell component pouch does not satisfy it.`
          : "The spell requires an ordinary focus and no component pouch or matching focus is recorded. Eschew Materials does not remove focus requirements.",
    };
  }

  if (component.kind === "DF") {
    const passed = access.hasDivineFocus === true;
    return {
      code: "DIVINE_FOCUS",
      passed,
      blocking: true,
      message: passed ? "A divine focus is available." : "The spell requires a divine focus and none is recorded as available.",
    };
  }

  if (component.kind === "XP") {
    const cost = component.xpCost ?? 0;
    const passed = cost > 0 && (access.availableXp ?? 0) >= cost;
    return {
      code: "XP_COMPONENT",
      passed,
      blocking: true,
      message: passed
        ? `The caster can pay the ${cost} XP cost.`
        : cost > 0
          ? `The spell requires ${cost} XP and the caster does not have enough spendable XP recorded.`
          : "The spell has an XP component but its XP cost is not encoded; casting remains blocked until the source record is completed.",
    };
  }

  return null;
}

export function resolveDnd35CastPreflight(input: Dnd35GuardedCastPreflightInput): Dnd35CastResolution {
  const requestedIds = new Set(input.request.metamagicFeatIds ?? []);
  const selectedMetamagic: Dnd35FeatDefinition[] = (input.metamagicFeats ?? []).filter((feat) => requestedIds.has(feat.id));
  const resolution = resolveBasePreflight({ ...input, metamagicFeats: selectedMetamagic });
  if (!input.request.itemAccess) {
    const componentAccess = input.componentAccess ?? {};
    const componentDecisions = input.spell.components
      .map((component) => componentDecision(component as TraditionAwareComponent, componentAccess, input.casting.tradition))
      .filter((decision): decision is Dnd35RuleDecision => decision !== null);
    resolution.decisions.push(...componentDecisions);
    resolution.legal = !resolution.decisions.some((decision) => decision.blocking && !decision.passed);
  }
  return resolution;
}
