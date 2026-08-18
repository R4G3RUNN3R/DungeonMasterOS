import type { Dnd35FeatDefinition, Dnd35SpellDefinition } from "./types";

export type Dnd35ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  recordType: "spell" | "feat";
  recordId: string;
  message: string;
};

const duplicateIds = <T extends { id: string }>(records: T[]) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) duplicates.add(record.id);
    seen.add(record.id);
  }
  return duplicates;
};

export function validateDnd35Spells(spells: Dnd35SpellDefinition[]): Dnd35ValidationIssue[] {
  const issues: Dnd35ValidationIssue[] = [];

  for (const id of duplicateIds(spells)) {
    issues.push({ severity: "error", code: "DUPLICATE_SPELL_ID", recordType: "spell", recordId: id, message: `Duplicate spell id: ${id}` });
  }

  for (const spell of spells) {
    if (spell.edition !== "3.5e") {
      issues.push({ severity: "error", code: "EDITION_MISMATCH", recordType: "spell", recordId: spell.id, message: "Spell is not explicitly marked as D&D 3.5e." });
    }
    if (!spell.name.trim()) {
      issues.push({ severity: "error", code: "MISSING_NAME", recordType: "spell", recordId: spell.id, message: "Spell name is empty." });
    }
    if (!spell.classAccess.length && !(spell.domainAccess?.length)) {
      issues.push({ severity: "warning", code: "NO_ACCESS_LIST", recordType: "spell", recordId: spell.id, message: "Spell has no class-list or domain-list access entry." });
    }
    if (!spell.sources.length) {
      issues.push({ severity: "error", code: "MISSING_SOURCE", recordType: "spell", recordId: spell.id, message: "Spell has no provenance source." });
    }
    if (!spell.components.length) {
      issues.push({ severity: "warning", code: "NO_COMPONENT_RECORDS", recordType: "spell", recordId: spell.id, message: "Spell has no component records; verify that it truly has no components." });
    }
    if (!spell.effects.length) {
      issues.push({ severity: "warning", code: "NO_STRUCTURED_EFFECT", recordType: "spell", recordId: spell.id, message: "Spell has no structured effect records and cannot be deterministically applied to game state." });
    }

    for (const access of spell.classAccess) {
      if (access.level < 0 || access.level > 9) {
        issues.push({ severity: "error", code: "INVALID_CLASS_LEVEL", recordType: "spell", recordId: spell.id, message: `Invalid ${access.classId} spell level ${access.level}.` });
      }
      if (!access.source?.sourceId) {
        issues.push({ severity: "error", code: "MISSING_CLASS_ACCESS_SOURCE", recordType: "spell", recordId: spell.id, message: `Class-list entry for ${access.classId} lacks provenance.` });
      }
    }

    for (const component of spell.components) {
      if (component.kind === "XP" && component.required && !component.xpCost) {
        issues.push({ severity: "warning", code: "XP_COST_NOT_ENCODED", recordType: "spell", recordId: spell.id, message: "Required XP component has no encoded XP cost." });
      }
      if ((component.kind === "M" || component.kind === "F") && (component.gpCost ?? 0) > 0 && !component.itemTags?.length) {
        issues.push({ severity: "warning", code: "COSTLY_COMPONENT_NOT_TAGGED", recordType: "spell", recordId: spell.id, message: "Costly component/focus has no inventory tag for deterministic possession checks." });
      }
    }
  }

  return issues;
}

export function validateDnd35Feats(feats: Dnd35FeatDefinition[]): Dnd35ValidationIssue[] {
  const issues: Dnd35ValidationIssue[] = [];

  for (const id of duplicateIds(feats)) {
    issues.push({ severity: "error", code: "DUPLICATE_FEAT_ID", recordType: "feat", recordId: id, message: `Duplicate feat id: ${id}` });
  }

  for (const feat of feats) {
    if (feat.edition !== "3.5e") {
      issues.push({ severity: "error", code: "EDITION_MISMATCH", recordType: "feat", recordId: feat.id, message: "Feat is not explicitly marked as D&D 3.5e." });
    }
    if (!feat.sources.length) {
      issues.push({ severity: "error", code: "MISSING_SOURCE", recordType: "feat", recordId: feat.id, message: "Feat has no provenance source." });
    }
    if (!feat.categories.length) {
      issues.push({ severity: "error", code: "MISSING_CATEGORY", recordType: "feat", recordId: feat.id, message: "Feat has no category." });
    }
    if (feat.categories.includes("metamagic") && !feat.metamagic) {
      issues.push({ severity: "error", code: "METAMAGIC_RULE_MISSING", recordType: "feat", recordId: feat.id, message: "Metamagic feat lacks executable metamagic rules." });
    }
    if (!feat.rulesSummary.trim()) {
      issues.push({ severity: "warning", code: "MISSING_RULE_SUMMARY", recordType: "feat", recordId: feat.id, message: "Feat has no concise rules summary." });
    }
  }

  return issues;
}

export function validateDnd35Corpus(spells: Dnd35SpellDefinition[], feats: Dnd35FeatDefinition[]) {
  const issues = [...validateDnd35Spells(spells), ...validateDnd35Feats(feats)];
  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
    issues,
  };
}
