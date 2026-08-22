// shared/rules-registry/provenance.ts
//
// Shared provenance/status shape every future canonical entity table
// (spell_definitions, feat_definitions, monster_definitions,
// prestige_class_definitions — none built in this plan) embeds, per
// design spec §2 and §4. Ingestion status and automation status are
// independent dimensions: a record can be fully verified and structured
// while remaining reference_only indefinitely.

export type IngestionStatus = "discovered" | "extracted" | "structured" | "verified";
export type AutomationStatus = "reference_only" | "partially_executable" | "executable";

export interface SourceReference {
  sourceId: number;
  page?: string;
}

export interface VerificationMetadata {
  method: "ai_cross_check" | "human_review" | "srd_direct_import";
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface CanonicalProvenance {
  sourceReferences: SourceReference[];
  ingestionStatus: IngestionStatus;
  automationStatus: AutomationStatus;
  verification?: VerificationMetadata;
}

const INGESTION_ORDER: Record<IngestionStatus, number> = {
  discovered: 0, extracted: 1, structured: 2, verified: 3,
};

/**
 * Automation status can never advance past reference_only while ingestion
 * status is below verified — automation status only advances on top of
 * verified data, never ahead of it (design spec §4).
 */
export function isValidStatusPair(ingestion: IngestionStatus, automation: AutomationStatus): boolean {
  if (automation === "reference_only") return true;
  return INGESTION_ORDER[ingestion] >= INGESTION_ORDER["verified"];
}
