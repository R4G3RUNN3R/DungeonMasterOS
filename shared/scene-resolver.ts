// shared/scene-resolver.ts
//
// Layered scene-background fallback model (design spec §13, and the
// research report's resolver diagram): explicit location asset wins, then
// the campaign's own environment pool, then the global environment pool,
// then a procedural fallback. No React component should ever branch on a
// specific location name — this is the one place that logic lives.
//
// A resolved asset is only ever returned when it is clearanceStatus
// "cleared" AND has a localAssetPath (a real, acquired, verified file).
// Today no registry entry has a localAssetPath yet, so this always
// resolves to the procedural fallback — that is the correct, honest
// behavior until real assets are downloaded and approved, not a bug.

import type { EnvironmentKey, SceneAsset } from "./scene-assets";
import { SCENE_ASSET_REGISTRY } from "./scene-asset-registry";

export type SceneResolutionSource = "explicit" | "campaign-pool" | "global-pool" | "fallback";

export interface SceneResolverInput {
  environmentKey?: EnvironmentKey | null;
  // Explicit location assignment, once a per-location scene-assignment
  // system exists (design spec §13's tier 1). Unused today.
  explicitAssetId?: string | null;
  // Campaign-specific pool, once campaign scene assignments exist (design
  // spec §13's tier 2). Unused today.
  campaignAssetIds?: string[];
}

export interface ResolvedScene {
  asset: SceneAsset | null;
  source: SceneResolutionSource;
}

function isSelectable(asset: SceneAsset): boolean {
  return asset.clearanceStatus === "cleared" && !!asset.localAssetPath;
}

function matchesEnvironment(asset: SceneAsset, environmentKey?: EnvironmentKey | null): boolean {
  if (!environmentKey) return true;
  return asset.environments.includes(environmentKey);
}

export function resolveSceneAsset(input: SceneResolverInput): ResolvedScene {
  const { environmentKey, explicitAssetId, campaignAssetIds } = input;

  if (explicitAssetId) {
    const explicit = SCENE_ASSET_REGISTRY.find((a) => a.id === explicitAssetId);
    if (explicit && isSelectable(explicit)) {
      return { asset: explicit, source: "explicit" };
    }
  }

  if (campaignAssetIds && campaignAssetIds.length > 0) {
    const campaignMatch = SCENE_ASSET_REGISTRY.find(
      (a) => campaignAssetIds.includes(a.id) && isSelectable(a) && matchesEnvironment(a, environmentKey),
    );
    if (campaignMatch) {
      return { asset: campaignMatch, source: "campaign-pool" };
    }
  }

  // Without a known environment, there is no honest basis to pick a
  // specific scene out of the global pool — that would show an arbitrary,
  // possibly unrelated image once real assets exist. Fall back instead.
  if (environmentKey) {
    const globalMatch = SCENE_ASSET_REGISTRY.find((a) => isSelectable(a) && matchesEnvironment(a, environmentKey));
    if (globalMatch) {
      return { asset: globalMatch, source: "global-pool" };
    }
  }

  return { asset: null, source: "fallback" };
}
