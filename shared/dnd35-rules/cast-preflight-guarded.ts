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

  // Revised 3.5 spell stat blocks use M/DF and F/DF to mean an arcane caster
  // supplies the material/focus while a divine caster supplies a divine focus.
  // Bulk-imported SRD records carry that distinction explicitly so this guard
  // must not turn the slash into an accidental AND requirement.
  if (component.appliesToTradition && component.appliesToTradition !== tradition) return null;

  if (component.kind === "M") {
    const costly = (component.gpCost ?? 0) > 0;
    const specificallyTagged = Boolean(component.itemTags?.length);
    if (!costly && !specificallyTagged) {
      const passed = access.hasSpellComponentPouch === true;
      return {
        code: "MATERIAL_COMPONENT",
        passed,
        blocking: true,
        message: passed
          ? "A spell component pouch satisfies the non-costly material component."
          : "The spell requires a non-costly material component and no usable component pouch is recorded.",
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
          ? `The spell requires its specific costly material component${component.gpCost ? ` (${component.gpCost} gp)` : ""}; generic wealth or a component pouch does not satisfy this check.`
          : "The spell requires a specific material component that is not present in recorded inventory tags.",
    };
  }
  if (component.kind === "F") {
    const passed = requiredTagsPresent(component.itemTags, access.itemTags);
    return {
      code: "FOCUS_COMPONENT",
      passed,
      blocking: true,
      message: passed
        ? "The required focus is present."
        : "The spell requires a specific focus that is not present in recorded inventory tags.",
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
