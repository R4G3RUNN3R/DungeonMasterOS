import type {
  Dnd35CastingTime,
  Dnd35RuleEffect,
  Dnd35SavingThrow,
  Dnd35SourceRef,
  Dnd35SpellClassAccess,
  Dnd35SpellComponent,
  Dnd35SpellDefinition,
  Dnd35SpellDomainAccess,
  Dnd35SpellDuration,
  Dnd35SpellLevel,
  Dnd35SpellRange,
  Dnd35SpellResistance,
  Dnd35SpellSchool,
  Dnd35SpellTradition,
  Dnd35SpellTargeting,
} from "@shared/dnd35-rules/types";

export const DND35_SRD_SOURCE_REVISION = "c7f30a0ce11a579f75456746f278a4c75f67b4c1";
export const DND35_SRD_SOURCE_REPOSITORY = "olimot/srd-v3.5-md";

export const DND35_SRD_SPELL_FILES = [
  "spells/spells-a-b.md",
  "spells/spells-c.md",
  "spells/spells-d-e.md",
  "spells/spells-f-g.md",
  "spells/spells-h-l.md",
  "spells/spells-m-o.md",
  "spells/spells-p-r.md",
  "spells/spells-s.md",
  "spells/spells-t-z.md",
] as const;

export type Dnd35ImportedSpellComponent = Dnd35SpellComponent & {
  /** SRD M/DF and F/DF notation: the component applies only to this tradition. */
  appliesToTradition?: Dnd35SpellTradition;
  /** Allows human/debug consumers to see the paired alternative requirement. */
  alternativeGroup?: string;
};

export type Dnd35ImportedSpell = Dnd35SpellDefinition & {
  /** Open SRD rules text. This is reference truth even when the effect resolver is not machine-executable yet. */
  rulesText: string;
  executionStatus: "structured";
  importedFrom: {
    repository: typeof DND35_SRD_SOURCE_REPOSITORY;
    revision: typeof DND35_SRD_SOURCE_REVISION;
    path: string;
  };
  components: Dnd35ImportedSpellComponent[];
};

export type Dnd35SrdSpellImportResult = {
  ok: boolean;
  spells: Dnd35ImportedSpell[];
  sourceRevision: string;
  sourceFiles: number;
  errors: string[];
};

const CLASS_ACCESS: Record<string, { classIds: string[]; tradition: Dnd35SpellTradition }> = {
  Brd: { classIds: ["bard"], tradition: "arcane" },
  Clr: { classIds: ["cleric"], tradition: "divine" },
  Drd: { classIds: ["druid"], tradition: "divine" },
  Pal: { classIds: ["paladin"], tradition: "divine" },
  Rgr: { classIds: ["ranger"], tradition: "divine" },
  "Sor/Wiz": { classIds: ["sorcerer", "wizard"], tradition: "arcane" },
  Assassin: { classIds: ["assassin"], tradition: "arcane" },
  Blackguard: { classIds: ["blackguard"], tradition: "divine" },
  Adept: { classIds: ["adept"], tradition: "divine" },
};

const VALID_SCHOOLS = new Set<Dnd35SpellSchool>([
  "abjuration",
  "conjuration",
  "divination",
  "enchantment",
  "evocation",
  "illusion",
  "necromancy",
  "transmutation",
  "universal",
]);

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sourceUrl = (path: string) =>
  `https://raw.githubusercontent.com/${DND35_SRD_SOURCE_REPOSITORY}/${DND35_SRD_SOURCE_REVISION}/${path}`;

function sourceRef(path: string, section: string): Dnd35SourceRef {
  return {
    sourceId: "srd-35",
    sourceKind: "srd-open",
    section,
    url: sourceUrl(path),
    confidence: "verified",
    notes: `Imported from pinned SRD revision ${DND35_SRD_SOURCE_REVISION}.`,
  };
}

function stripInlineMarkdown(value: string) {
  return value
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/<sup>.*?<\/sup>/gi, "")
    .replace(/[_*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRulesText(value: string) {
  return value
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/\r/g, "")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function parseSchool(line: string) {
  const clean = stripInlineMarkdown(line);
  const match = clean.match(/^([A-Za-z]+)(?:\s+\(([^)]+)\))?(?:\s+\[([^\]]+)\])?/);
  if (!match) return null;
  const school = match[1].toLowerCase() as Dnd35SpellSchool;
  if (!VALID_SCHOOLS.has(school)) return null;
  return {
    school,
    subschool: match[2]?.trim().toLowerCase(),
    descriptors: match[3]
      ? match[3].split(/\s*,\s*/).map((entry) => entry.trim().toLowerCase()).filter(Boolean)
      : undefined,
  };
}

function parseLevels(text: string, source: Dnd35SourceRef) {
  const classAccess: Dnd35SpellClassAccess[] = [];
  const domainAccess: Dnd35SpellDomainAccess[] = [];

  for (const rawEntry of text.split(/\s*,\s*/)) {
    const entry = stripInlineMarkdown(rawEntry);
    const match = entry.match(/^(.+?)\s+([0-9])$/);
    if (!match) continue;
    const label = match[1].trim();
    const level = Number(match[2]) as Dnd35SpellLevel;
    const classDefinition = CLASS_ACCESS[label];
    if (classDefinition) {
      for (const classId of classDefinition.classIds) {
        classAccess.push({ classId, level, tradition: classDefinition.tradition, source });
      }
    } else {
      domainAccess.push({ domainId: slug(label), level, source });
    }
  }

  return { classAccess, domainAccess };
}

function componentParagraphs(rulesText: string) {
  const result: Partial<Record<"material" | "arcaneMaterial" | "focus" | "arcaneFocus" | "xp", string>> = {};
  for (const paragraph of rulesText.split(/\n\s*\n/)) {
    const normalized = paragraph.trim();
    let match = normalized.match(/^_Arcane Material Component:_\s*([\s\S]+)$/i);
    if (match) { result.arcaneMaterial = stripInlineMarkdown(match[1]); continue; }
    match = normalized.match(/^_Material Component:_\s*([\s\S]+)$/i);
    if (match) { result.material = stripInlineMarkdown(match[1]); continue; }
    match = normalized.match(/^_Arcane Focus:_\s*([\s\S]+)$/i);
    if (match) { result.arcaneFocus = stripInlineMarkdown(match[1]); continue; }
    match = normalized.match(/^_Focus:_\s*([\s\S]+)$/i);
    if (match) { result.focus = stripInlineMarkdown(match[1]); continue; }
    match = normalized.match(/^_XP Cost:_\s*([\s\S]+)$/i);
    if (match) { result.xp = stripInlineMarkdown(match[1]); }
  }
  return result;
}

function numericCost(text: string | undefined, unit: "gp" | "xp") {
  if (!text) return undefined;
  const expression = unit === "gp" ? /([\d,]+)\s*gp\b/i : /([\d,]+)\s*XP\b/i;
  const match = text.match(expression);
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
}

function parseComponents(text: string, rulesText: string): Dnd35ImportedSpellComponent[] {
  const details = componentParagraphs(rulesText);
  const components: Dnd35ImportedSpellComponent[] = [];

  const push = (component: Dnd35ImportedSpellComponent) => {
    if (!components.some((existing) => existing.kind === component.kind && existing.appliesToTradition === component.appliesToTradition)) {
      components.push(component);
    }
  };

  for (const rawToken of text.split(/\s*,\s*/)) {
    const token = stripInlineMarkdown(rawToken).toUpperCase();
    if (token === "M/DF") {
      const description = details.arcaneMaterial ?? details.material;
      push({
        kind: "M",
        required: true,
        consumed: true,
        description,
        gpCost: numericCost(description, "gp"),
        appliesToTradition: "arcane",
        alternativeGroup: "arcane-material-or-divine-focus",
      });
      push({ kind: "DF", required: true, appliesToTradition: "divine", alternativeGroup: "arcane-material-or-divine-focus" });
      continue;
    }
    if (token === "F/DF") {
      const description = details.arcaneFocus ?? details.focus;
      push({
        kind: "F",
        required: true,
        consumed: false,
        description,
        gpCost: numericCost(description, "gp"),
        appliesToTradition: "arcane",
        alternativeGroup: "arcane-focus-or-divine-focus",
      });
      push({ kind: "DF", required: true, appliesToTradition: "divine", alternativeGroup: "arcane-focus-or-divine-focus" });
      continue;
    }
    if (token === "V" || token === "S") {
      push({ kind: token, required: true });
      continue;
    }
    if (token === "M") {
      const description = details.material ?? details.arcaneMaterial;
      push({ kind: "M", required: true, consumed: true, description, gpCost: numericCost(description, "gp") });
      continue;
    }
    if (token === "F") {
      const description = details.focus ?? details.arcaneFocus;
      push({ kind: "F", required: true, consumed: false, description, gpCost: numericCost(description, "gp") });
      continue;
    }
    if (token === "DF") {
      push({ kind: "DF", required: true });
      continue;
    }
    if (token === "XP") {
      const description = details.xp;
      push({ kind: "XP", required: true, consumed: true, description, xpCost: numericCost(description, "xp") });
    }
  }

  return components;
}

function parseCastingTime(text: string): Dnd35CastingTime {
  const clean = stripInlineMarkdown(text);
  if (/^1\s+standard action$/i.test(clean)) return { kind: "standard", amount: 1, text: clean };
  if (/^1\s+move action$/i.test(clean)) return { kind: "move", amount: 1, text: clean };
  if (/^1\s+free action$/i.test(clean)) return { kind: "free", amount: 1, text: clean };
  if (/^1\s+swift action$/i.test(clean)) return { kind: "swift", amount: 1, text: clean };
  if (/^1\s+immediate action$/i.test(clean)) return { kind: "immediate", amount: 1, text: clean };
  if (/^1\s+full-round action$/i.test(clean)) return { kind: "full_round", amount: 1, text: clean };
  let match = clean.match(/^(\d+)\s+rounds?$/i);
  if (match) return { kind: "rounds", amount: Number(match[1]), text: clean };
  match = clean.match(/^(\d+)\s+minutes?$/i);
  if (match) return { kind: "minutes", amount: Number(match[1]), text: clean };
  match = clean.match(/^(\d+)\s+hours?$/i);
  if (match) return { kind: "hours", amount: Number(match[1]), text: clean };
  return { kind: "special", text: clean || "See source text" };
}

function parseRange(text: string): Dnd35SpellRange {
  const clean = stripInlineMarkdown(text);
  if (/^Personal$/i.test(clean)) return { kind: "personal", text: clean };
  if (/^Touch$/i.test(clean)) return { kind: "touch", text: clean };
  if (/^Close\b/i.test(clean)) return { kind: "close", baseFeet: 25, text: clean };
  if (/^Medium\b/i.test(clean)) return { kind: "medium", baseFeet: 100, feetPerCasterLevel: 10, text: clean };
  if (/^Long\b/i.test(clean)) return { kind: "long", baseFeet: 400, feetPerCasterLevel: 40, text: clean };
  if (/^Unlimited$/i.test(clean)) return { kind: "unlimited", text: clean };
  const fixed = clean.match(/^(\d+)\s*ft\.?$/i);
  if (fixed) return { kind: "fixed", feet: Number(fixed[1]), text: clean };
  return { kind: "special", text: clean || "See source text" };
}

function parseDuration(text: string): Dnd35SpellDuration {
  const original = stripInlineMarkdown(text);
  const dismissible = /\(D\)/i.test(original);
  const clean = original.replace(/\s*\(D\)\s*/gi, "").trim();
  if (/^Instantaneous$/i.test(clean)) return { kind: "instantaneous", dismissible, text: original };
  if (/^1\s+round\/level$/i.test(clean)) return { kind: "rounds_per_level", amount: 1, dismissible, text: original };
  if (/^1\s+min\.?\/level$/i.test(clean)) return { kind: "minutes_per_level", amount: 1, dismissible, text: original };
  if (/^10\s+min\.?\/level$/i.test(clean)) return { kind: "ten_minutes_per_level", amount: 10, dismissible, text: original };
  if (/^1\s+hour\/level$/i.test(clean)) return { kind: "hours_per_level", amount: 1, dismissible, text: original };
  if (/^1\s+day\/level$/i.test(clean)) return { kind: "days_per_level", amount: 1, dismissible, text: original };
  if (/^Permanent$/i.test(clean)) return { kind: "permanent", dismissible, text: original };
  if (/^Concentration$/i.test(clean)) return { kind: "concentration", concentration: true, dismissible, text: original };
  if (/^Concentration\s*\+/i.test(clean)) return { kind: "concentration_plus", concentration: true, dismissible, text: original };
  if (/until discharged/i.test(clean)) return { kind: "until_discharged", dischargeEnds: true, dismissible, text: original };
  const rounds = clean.match(/^(\d+)\s+rounds?$/i);
  if (rounds) return { kind: "rounds", amount: Number(rounds[1]), dismissible, text: original };
  const minutes = clean.match(/^(\d+)\s+minutes?$/i);
  if (minutes) return { kind: "minutes", amount: Number(minutes[1]), dismissible, text: original };
  const hours = clean.match(/^(\d+)\s+hours?$/i);
  if (hours) return { kind: "hours", amount: Number(hours[1]), dismissible, text: original };
  const days = clean.match(/^(\d+)\s+days?$/i);
  if (days) return { kind: "days", amount: Number(days[1]), dismissible, text: original };
  return { kind: "special", dismissible, text: original || "See source text" };
}

function parseSavingThrow(text: string): Dnd35SavingThrow {
  const clean = stripInlineMarkdown(text || "None");
  const lower = clean.toLowerCase();
  if (lower === "none") return { type: "none", text: clean };
  const type: Dnd35SavingThrow["type"] = lower.startsWith("fortitude")
    ? "fortitude"
    : lower.startsWith("reflex")
      ? "reflex"
      : lower.startsWith("will")
        ? "will"
        : "special";
  const outcome: Dnd35SavingThrow["outcome"] = lower.includes("negates")
    ? "negates"
    : lower.includes("half")
      ? "half"
      : lower.includes("partial")
        ? "partial"
        : lower.includes("disbelief")
          ? "disbelief"
          : lower.includes("harmless")
            ? "harmless"
            : lower.includes("object")
              ? "object"
              : "special";
  return {
    type,
    outcome,
    harmless: lower.includes("harmless"),
    object: lower.includes("object"),
    repeated: /each round|repeated/i.test(lower),
    text: clean,
  };
}

function parseSpellResistance(text: string): Dnd35SpellResistance {
  const clean = stripInlineMarkdown(text || "No");
  const lower = clean.toLowerCase();
  return {
    applies: lower === "no" ? false : lower.startsWith("yes") ? true : "special",
    harmless: lower.includes("harmless"),
    object: lower.includes("object"),
    text: clean,
  };
}

function parseTargeting(fields: Record<string, string>, range: Dnd35SpellRange, rulesText: string): Dnd35SpellTargeting {
  const targetText = fields.Target ?? fields.Targets;
  const effectText = fields.Effect;
  const areaText = fields.Area;
  const delivery = new Set<Dnd35SpellTargeting["delivery"][number]>();

  if (range.kind === "personal") delivery.add("personal");
  if (targetText) delivery.add(range.kind === "touch" ? "melee_touch" : "target");
  if (effectText) delivery.add("effect");
  if (areaText) delivery.add("area");

  const targetingText = [targetText, effectText, areaText, rulesText.slice(0, 1200)].filter(Boolean).join(" ").toLowerCase();
  if (/\bray\b/.test(targetingText)) delivery.add("ray");
  if (/ranged touch attack/.test(targetingText)) delivery.add("ranged_touch");
  if (/melee touch attack/.test(targetingText)) delivery.add("melee_touch");
  if (/\bemanation\b/.test(targetingText)) delivery.add("emanation");
  if (/\bburst\b/.test(targetingText)) delivery.add("burst");
  if (/\bspread\b/.test(targetingText)) delivery.add("spread");
  if (/\bcone\b/.test(targetingText)) delivery.add("cone");
  if (/\bline\b/.test(targetingText)) delivery.add("line");
  if (/\bcylinder\b/.test(targetingText)) delivery.add("cylinder");
  if (/\bsphere\b/.test(targetingText)) delivery.add("sphere");
  if (!delivery.size) delivery.add("special");

  const dimensionText = [areaText, effectText].filter(Boolean).join(" ");
  const radius = dimensionText.match(/(\d+)-ft\.?[- ]radius/i);
  const length = dimensionText.match(/(\d+)-ft\.?[- ](?:long|line|cone)/i);
  const height = dimensionText.match(/(\d+)\s*ft\.?\s+high/i);

  return {
    delivery: Array.from(delivery),
    targetText: targetText ? stripInlineMarkdown(targetText) : undefined,
    effectText: effectText ? stripInlineMarkdown(effectText) : undefined,
    areaText: areaText ? stripInlineMarkdown(areaText) : undefined,
    radiusFeet: radius ? Number(radius[1]) : undefined,
    lengthFeet: length ? Number(length[1]) : undefined,
    heightFeet: height ? Number(height[1]) : undefined,
    lineOfEffectRequired: range.kind !== "personal",
    willingOnly: /willing/.test(targetingText) ? true : undefined,
    objectAllowed: /\bobject/.test(targetingText) ? true : undefined,
  };
}

function attackRollFor(rulesText: string, effectText?: string): Dnd35SpellDefinition["attackRoll"] {
  const text = `${effectText ?? ""} ${rulesText.slice(0, 1600)}`.toLowerCase();
  if (/ranged touch attack/.test(text)) return "ranged_touch";
  if (/melee touch attack/.test(text)) return "melee_touch";
  if (/ranged attack/.test(text)) return "ranged_attack";
  return "none";
}

function summaryFor(rulesText: string) {
  const firstParagraph = rulesText
    .split(/\n\s*\n/)
    .map(stripInlineMarkdown)
    .find((paragraph) => paragraph && !/^(Arcane )?(Material Component|Focus|XP Cost):/i.test(paragraph));
  if (!firstParagraph) return "See the canonical SRD rules text for this spell.";
  return firstParagraph.length <= 420 ? firstParagraph : `${firstParagraph.slice(0, 417).trimEnd()}...`;
}

function genericEffects(spellId: string, rulesText: string, save: Dnd35SavingThrow, sr: Dnd35SpellResistance): Dnd35RuleEffect[] {
  return [{
    effectId: `${spellId}-canonical-rules`,
    kind: "special",
    saveApplies: save.type !== "none",
    spellResistanceApplies: sr.applies === true,
    rulesNote: "The complete mechanical effect is grounded by rulesText; this imported record is not yet claiming a fully executable effect resolver.",
    tags: ["canonical-reference", "needs-effect-resolver"],
  }];
}

function parseHeaders(lines: string[]) {
  const fields: Record<string, string> = {};
  let lastHeaderIndex = -1;
  const headerPattern = /^\*\*(Level|Components|Casting Time|Range|Target|Targets|Effect|Area|Duration|Saving Throw|Spell Resistance):\*\*\s*(.*)$/;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(headerPattern);
    if (!match) continue;
    fields[match[1]] = match[2].trim();
    lastHeaderIndex = index;
  }
  return { fields, bodyStart: lastHeaderIndex + 1 };
}

export function parseDnd35SrdSpellDocument(markdown: string, path: string): Dnd35ImportedSpell[] {
  const normalized = markdown.replace(/\r/g, "");
  const sections = normalized.split(/\n(?=##\s+)/g);
  const spells: Dnd35ImportedSpell[] = [];

  for (const rawSection of sections) {
    if (!rawSection.startsWith("## ")) continue;
    const lines = rawSection.split("\n");
    const name = stripInlineMarkdown(lines.shift()!.replace(/^##\s+/, ""));
    if (!name) continue;

    while (lines.length && !lines[0].trim()) lines.shift();
    const schoolLine = lines.shift()?.trim() ?? "";
    const school = parseSchool(schoolLine);
    const { fields, bodyStart } = parseHeaders(lines);
    if (!school || !fields.Level || !fields.Components || !fields["Casting Time"] || !fields.Range || !fields.Duration) continue;

    const rulesText = cleanRulesText(lines.slice(bodyStart).join("\n"));
    const source = sourceRef(path, name);
    const levels = parseLevels(fields.Level, source);
    if (!levels.classAccess.length && !levels.domainAccess.length) continue;

    const range = parseRange(fields.Range);
    const savingThrow = parseSavingThrow(fields["Saving Throw"] ?? "None");
    const spellResistance = parseSpellResistance(fields["Spell Resistance"] ?? "No");
    const id = slug(name);
    const tags = new Set<string>([
      "srd",
      "spell",
      school.school,
      ...(school.descriptors ?? []),
      ...levels.classAccess.map((access) => access.classId),
      ...levels.classAccess.map((access) => access.tradition),
      ...levels.domainAccess.map((access) => `domain:${access.domainId}`),
    ]);

    spells.push({
      id,
      name,
      edition: "3.5e",
      school: school.school,
      subschool: school.subschool,
      descriptors: school.descriptors,
      classAccess: levels.classAccess,
      domainAccess: levels.domainAccess.length ? levels.domainAccess : undefined,
      castingTime: parseCastingTime(fields["Casting Time"]),
      components: parseComponents(fields.Components, rulesText),
      range,
      targeting: parseTargeting(fields, range, rulesText),
      duration: parseDuration(fields.Duration),
      savingThrow,
      spellResistance,
      attackRoll: attackRollFor(rulesText, fields.Effect),
      effects: genericEffects(id, rulesText, savingThrow, spellResistance),
      permanencyEligible: /made permanent with (?:a )?_?permanency_?/i.test(rulesText),
      rulesSummary: summaryFor(rulesText),
      rulesText,
      executionStatus: "structured",
      sources: [source],
      tags: Array.from(tags),
      importedFrom: { repository: DND35_SRD_SOURCE_REPOSITORY, revision: DND35_SRD_SOURCE_REVISION, path },
    });
  }

  return spells;
}

export async function loadDnd35SrdSpellCorpus(
  fetcher: typeof fetch = fetch,
): Promise<Dnd35SrdSpellImportResult> {
  const errors: string[] = [];
  const documents = await Promise.all(
    DND35_SRD_SPELL_FILES.map(async (path) => {
      try {
        const response = await fetcher(sourceUrl(path), {
          headers: { "User-Agent": "DungeonMasterOS/knowledge-library" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { path, text: await response.text() };
      } catch (error: any) {
        errors.push(`${path}: ${error?.message || String(error)}`);
        return null;
      }
    }),
  );

  if (errors.length || documents.some((document) => !document)) {
    return { ok: false, spells: [], sourceRevision: DND35_SRD_SOURCE_REVISION, sourceFiles: DND35_SRD_SPELL_FILES.length, errors };
  }

  const spells = documents.flatMap((document) => parseDnd35SrdSpellDocument(document!.text, document!.path));
  const byId = new Map<string, Dnd35ImportedSpell>();
  for (const spell of spells) {
    if (byId.has(spell.id)) {
      errors.push(`Duplicate spell id ${spell.id} while importing ${spell.importedFrom.path}.`);
      continue;
    }
    byId.set(spell.id, spell);
  }

  // The core Revised 3.5 SRD contains hundreds of spells. Treat a suspiciously
  // tiny parse as a failed import rather than quietly publishing a partial book.
  if (byId.size < 300) {
    errors.push(`SRD spell import produced only ${byId.size} unique records; refusing partial corpus.`);
  }

  return {
    ok: errors.length === 0,
    spells: errors.length ? [] : Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)),
    sourceRevision: DND35_SRD_SOURCE_REVISION,
    sourceFiles: DND35_SRD_SPELL_FILES.length,
    errors,
  };
}
