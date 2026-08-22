import { test } from "node:test";
import assert from "node:assert/strict";
import { isSourceEnabledForCampaign, type CampaignSourceContext } from "./source-enablement";
import type { RuleSource } from "./sources";

function makeSource(overrides: Partial<RuleSource>): RuleSource {
  return {
    id: 1, sourceKey: "test-source", title: "Test", publisher: "",
    ruleset: "dnd35e", nativeEdition: "", setting: "generic",
    publicationType: "core-rulebook", provenanceClassification: "wotc_official",
    licenseClassification: "all_rights_reserved", publicationDate: null,
    supersedesSourceId: null, verificationMethod: "", verifiedBy: "", verifiedAt: null,
    createdAt: "", updatedAt: "", ...overrides,
  } as RuleSource;
}

test("all_official: a generic-setting source is always enabled for the campaign's ruleset", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "eberron", sourcePreset: "all_official" };
  const source = makeSource({ setting: "generic" });
  assert.equal(isSourceEnabledForCampaign(context, source), true);
});

test("all_official: an Eberron campaign does not see Forgotten Realms setting content", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "eberron", sourcePreset: "all_official" };
  const source = makeSource({ setting: "forgotten-realms" });
  assert.equal(isSourceEnabledForCampaign(context, source), false);
});

test("all_official: an Eberron campaign does see Eberron setting content", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "eberron", sourcePreset: "all_official" };
  const source = makeSource({ setting: "eberron" });
  assert.equal(isSourceEnabledForCampaign(context, source), true);
});

test("all_official: never crosses ruleset, even for a generic-setting source", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "generic", sourcePreset: "all_official" };
  const source = makeSource({ ruleset: "dnd5e", setting: "generic" });
  assert.equal(isSourceEnabledForCampaign(context, source), false);
});

test("core_only: excludes a generic-setting splatbook", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "generic", sourcePreset: "core_only" };
  const source = makeSource({ setting: "generic", publicationType: "splatbook" });
  assert.equal(isSourceEnabledForCampaign(context, source), false);
});

test("core_only: includes a generic-setting core rulebook", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "generic", sourcePreset: "core_only" };
  const source = makeSource({ setting: "generic", publicationType: "core-rulebook" });
  assert.equal(isSourceEnabledForCampaign(context, source), true);
});

test("custom: only explicitly-listed source IDs are enabled, regardless of setting", () => {
  const context: CampaignSourceContext = {
    ruleset: "dnd35e", setting: "eberron", sourcePreset: "custom", customSourceIds: [42],
  };
  const enabled = makeSource({ id: 42, setting: "forgotten-realms" });
  const notEnabled = makeSource({ id: 43, setting: "eberron" });
  assert.equal(isSourceEnabledForCampaign(context, enabled), true, "explicitly listed, crosses setting boundary deliberately");
  assert.equal(isSourceEnabledForCampaign(context, notEnabled), false, "same setting as campaign but not explicitly listed");
});

test("custom: an empty customSourceIds list enables nothing", () => {
  const context: CampaignSourceContext = { ruleset: "dnd35e", setting: "generic", sourcePreset: "custom" };
  const source = makeSource({ id: 1, setting: "generic" });
  assert.equal(isSourceEnabledForCampaign(context, source), false);
});
