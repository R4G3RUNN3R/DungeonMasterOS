// shared/scene-assets.ts
//
// Scene-background asset registry contract (design spec §13-14, and the
// 2026-08-17 "DungeonMasterOS Scene Background Asset Research Report").
// Licensing is a property of the asset, not a comment in a README: nothing
// may enter SCENE_ASSET_REGISTRY without every field below recorded, and
// nothing may be selected by the resolver unless the rights gate passes.

export type EnvironmentKey =
  | "tavern"
  | "tavern-night"
  | "busy-market"
  | "city-street"
  | "city-skyline"
  | "forest"
  | "forest-night"
  | "forest-fog"
  | "forest-camp"
  | "wilderness"
  | "wilderness-mist"
  | "cave"
  | "crypt"
  | "dungeon"
  | "castle-interior"
  | "castle-exterior"
  | "castle-fog"
  | "ruins"
  | "temple-ruins"
  | "mountain-road"
  | "coast"
  | "harbor"
  | "swamp"
  | "desert"
  | "snow"
  | "storm-night"
  | "fog-supernatural"
  | "village";

export const ENVIRONMENT_KEYS: EnvironmentKey[] = [
  "tavern",
  "tavern-night",
  "busy-market",
  "city-street",
  "city-skyline",
  "forest",
  "forest-night",
  "forest-fog",
  "forest-camp",
  "wilderness",
  "wilderness-mist",
  "cave",
  "crypt",
  "dungeon",
  "castle-interior",
  "castle-exterior",
  "castle-fog",
  "ruins",
  "temple-ruins",
  "mountain-road",
  "coast",
  "harbor",
  "swamp",
  "desert",
  "snow",
  "storm-night",
  "fog-supernatural",
  "village",
];

export type LicenseType =
  | "CC0"
  | "CC-BY-3.0"
  | "CC-BY-4.0"
  | "PEXELS"
  | "PIXABAY"
  | "UNSPLASH"
  | "CUSTOM";

export type BundledRedistribution = "allowed" | "conditional" | "prohibited";

export interface SceneAssetLicense {
  type: LicenseType;
  licenseUrl: string;
  checkedAt: string; // ISO date the license was last verified
  attributionRequired: boolean;
  attributionText?: string;
  commercialUse: boolean;
  modification: boolean;
  bundledRedistribution: BundledRedistribution;
  evidenceSnapshot?: string; // note on where the permission language was captured
}

export interface SceneAssetTechnical {
  originalWidth: number | null; // null = not yet verified at ingestion
  originalHeight: number | null;
  landscape: boolean;
  variants: Array<"21:9" | "16:9" | "4:3" | "mobile">;
  checksum: string | null; // null until the real file is acquired
}

export interface SceneAssetProvenance {
  aiGenerated: boolean | "unknown";
  recognizablePeople: boolean;
  trademarksOrLogos: boolean;
  propertyRightsReview: "clear" | "review" | "unknown";
}

export interface SceneAssetSuitability {
  textNoise: "low" | "medium" | "high";
  focalPoint?: "left" | "center" | "right" | "none";
  suggestedDim: number; // 0-100, percent darkening behind the narrative surface
  suggestedVignette: "light" | "medium" | "strong";
  suggestedBlurPx?: number;
}

// Whether this specific candidate has cleared the report's rights gate.
// "cleared" is the only status the resolver may ever select. Everything
// else exists in the registry as a documented, rejected/pending record so
// the same candidate is never re-researched or accidentally re-proposed.
export type ClearanceStatus =
  | "cleared"
  | "pending-technical-verification"
  | "pending-permission"
  | "blocked";

export interface SceneAsset {
  id: string;
  sourceUrl: string;
  creator: string;
  clearanceStatus: ClearanceStatus;
  license: SceneAssetLicense;
  technical: SceneAssetTechnical;
  provenance: SceneAssetProvenance;
  tags: string[];
  genres: string[];
  environments: EnvironmentKey[];
  dayPhase?: "day" | "dusk" | "night";
  weather?: string[];
  suitability: SceneAssetSuitability;
  // Populated only once a real file has been acquired, verified, and
  // committed as an application derivative (never a raw stock download).
  localAssetPath?: string;
}
