// shared/rules-registry/canonical-id.ts
//
// Canonical entity IDs are ruleset-namespaced from creation, per design
// spec's locked decision #1: dnd35e:spell:fireball and dnd5e:spell:fireball
// are different entities, never queried without a ruleset filter.

const CANONICAL_ID_PATTERN = /^([a-z0-9]+):([a-z-]+):([a-z0-9-]+)$/;

export interface ParsedCanonicalId {
  ruleset: string;
  entityType: string;
  slug: string;
}

export function buildCanonicalId(ruleset: string, entityType: string, slug: string): string {
  return `${ruleset}:${entityType}:${slug}`;
}

export function parseCanonicalId(id: string): ParsedCanonicalId | null {
  const match = CANONICAL_ID_PATTERN.exec(id);
  if (!match) return null;
  return { ruleset: match[1], entityType: match[2], slug: match[3] };
}

export function isValidCanonicalId(id: string): boolean {
  return CANONICAL_ID_PATTERN.test(id);
}
