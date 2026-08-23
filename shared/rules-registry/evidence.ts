//
// Orthogonal to rule_sources' ProvenanceClassification/LicenseClassification
// (which describe a whole document/transport). This describes what kind of
// evidence backs one specific extracted canonical fact — a single entity can
// be corroborated by a mix of open SRD text, a licensed local book, and a
// public reference, each with a different answer to "can we quote this."
// Never conflate "we verified this mechanic" (any kind here) with "we can
// redistribute this exact source content" (only open_canonical, and even
// then this pipeline prefers structured mechanics over verbatim prose).

export type EvidenceSourceKind =
  | "open_canonical"
  | "licensed_local_reference"
  | "licensed_digital_reference"
  | "official_public_reference"
  | "external_read_only_reference"
  | "third_party_reference"
  | "homebrew"
  | "requires_rights_review";

export interface EvidenceCitation {
  kind: EvidenceSourceKind;
  sourcePageKey?: string;
  citation?: string;
  accessedAt?: string;
  notes?: string;
}

export function requiresRightsReview(kind: EvidenceSourceKind): boolean {
  return kind === "requires_rights_review";
}
