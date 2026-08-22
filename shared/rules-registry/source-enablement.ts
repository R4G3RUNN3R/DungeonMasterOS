// shared/rules-registry/source-enablement.ts
//
// Implements design spec §5: RULESET -> CAMPAIGN SETTING -> ENABLED SOURCES.
// "All Official Sources" means all sources applicable to the campaign's
// ruleset AND active setting (generic-setting sources always included) —
// never indiscriminately every setting ever published for that ruleset.
// This function is pure and takes no DB dependency: callers (a future
// Phase 3 task, not this plan) are responsible for fetching the relevant
// RuleSource rows and the campaign's context before calling this.

import type { RuleSource } from "./sources";

export type SourcePreset = "all_official" | "core_only" | "custom";

export interface CampaignSourceContext {
  ruleset: string;
  setting: string;
  sourcePreset: SourcePreset;
  customSourceIds?: number[];
}

export function isSourceEnabledForCampaign(
  context: CampaignSourceContext,
  source: RuleSource,
): boolean {
  if (context.sourcePreset === "custom") {
    return (context.customSourceIds ?? []).includes(source.id);
  }

  if (source.ruleset !== context.ruleset) return false;
  const settingApplies = source.setting === "generic" || source.setting === context.setting;
  if (!settingApplies) return false;

  if (context.sourcePreset === "core_only") {
    return source.publicationType === "core-rulebook";
  }

  // all_official
  return true;
}
