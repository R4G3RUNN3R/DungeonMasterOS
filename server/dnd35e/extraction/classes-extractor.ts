// server/dnd35e/extraction/classes-extractor.ts
//
// Deterministic, regex-based extractor for a real d20srd.org/srd/classes/*
// class page. Pure function: no network, no DB. First implemented and
// verified against the real Fighter page (server/dnd35e/extraction/
// fighter-fixture.html) — a non-spellcasting class, deliberately chosen as
// the simplest real vertical slice. See classes.ts for the explicit
// spellcasting-progression scope gap this leaves for casting classes.
//
// Design note on "honest partial extraction" (same discipline as
// feats/races extractors): the 20-row level-progression table, hit die,
// alignment, skill points, and class-skill list all follow one exact,
// consistent real page format across every core class, so this pass
// extracts them deterministically and fails closed (throws) if a page's
// table header ever doesn't match the expected column order, rather than
// silently mis-mapping columns. Class Features are captured as full,
// un-truncated multi-paragraph text (no single-effect-pattern structuring
// attempted this pass) — the honest, real description, preserved verbatim.

import { buildCanonicalId } from "@shared/rules-registry/canonical-id";
import type {
  Dnd35eAbilityCode,
  Dnd35eBabProgression,
  Dnd35eClassDefinition,
  Dnd35eClassFeature,
  Dnd35eClassLevelProgressionRow,
  Dnd35eClassSkill,
  Dnd35eClassSpellcasting,
  Dnd35eSaveProgression,
  Dnd35eSpellsKnownRow,
  Dnd35eSpellsPerDayRow,
} from "@shared/rules-registry/dnd35e/classes";
import { stripTags, kebabCase } from "./html-utils";

const EXPECTED_HEADERS_STANDARD = ["Level", "Base Attack Bonus", "Fort Save", "Ref Save", "Will Save", "Special"];
// Monk's real table has 4 extra columns beyond the standard 6 (Flurry of
// Blows Attack Bonus, Unarmed Damage, AC Bonus, Unarmored Speed Bonus) — a
// genuine, unique-to-Monk page structure, not a formatting inconsistency.
const EXPECTED_HEADERS_MONK = [...EXPECTED_HEADERS_STANDARD, "Flurry of Blows Attack Bonus", "Unarmed Damage", "AC Bonus", "Unarmored Speed Bonus"];

const TABLE_RE = /<table id="tableThe[a-zA-Z]+"[^>]*>([\s\S]*?)<\/table>/;
// Real page inconsistency: most classes' header cells are bare <th>Level</th>,
// but some (e.g. Barbarian, Rogue, Monk) use <th align="left">Base<br />Attack
// Bonus</th> — attributes on the tag and a <br /> splitting the label across
// two lines. Tolerant of both; header text is normalized below. Monk's
// "Unarmed Damage" header also carries a footnote marker,
// <th>Unarmed<br />Damage<sup>1</sup></th> — the <sup> tag AND its digit
// content are stripped, not just the tag, so the real footnote number never
// leaks into the header text being compared.
const TR_RE = /<tr>([\s\S]*?)<\/tr>/g;
const TD_RE = /<td[^>]*>([\s\S]*?)<\/td>/g;

function normalizeHeaderText(raw: string): string {
  return stripTags(raw.replace(/<br\s*\/?>/gi, " ").replace(/<sup>[\s\S]*?<\/sup>/gi, ""));
}

// Real page inconsistency: most classes use <h1>Name</h1>, but at least one
// (Rogue) uses <h2 id="slug">Name</h2> instead. Tolerant of both.
const CLASS_NAME_RE = /<h1>([^<]+)<\/h1>|<h2 id="[a-zA-Z]+">([^<]+)<\/h2>/;
const ALIGNMENT_RE = /<h5>Alignment<\/h5>\s*<p>\s*([\s\S]*?)\s*<\/p>/;
const HIT_DIE_RE = /<h5>Hit Die<\/h5>\s*<p>\s*d(\d+)\.?\s*<\/p>/i;
const CLASS_SKILLS_SECTION_RE = /<h4>Class Skills<\/h4>\s*<p>([\s\S]*?)<\/p>/;
const CLASS_SKILL_ENTRY_RE = /<a href="\/srd\/skills\/[^"]+">([^<]+)<\/a>\s*\((Str|Dex|Con|Int|Wis|Cha)\)/g;
const SKILL_POINTS_RE = /<h5>Skill Points at Each Additional Level<\/h5>\s*<p>\s*(\d+)\s*\+\s*Int modifier\.?\s*<\/p>/i;
const CLASS_FEATURES_SECTION_RE = /<h4>Class Features<\/h4>([\s\S]*?)(?=<div class="footer">|$)/;
// Real page inconsistency, found on Druid: some feature headings carry a
// nested tag for a supernatural/extraordinary-ability suffix, e.g.
// <h5 id="wildShape">Wild Shape (<a href="...">Su</a>)</h5>. A heading-text
// capture that stops at the first "<" (like feats-extractor's H3_BLOCK_RE)
// would silently fail to match this <h5> at all — not truncate it, just
// never see it, and with no <p> content anywhere else to catch the loss,
// the whole feature vanishes with no disclosure. [\s\S]*? tolerates any
// nested tags in the heading; the captured text is stripped afterward.
const FEATURE_BLOCK_RE = /<h5(?:\s+id="([a-zA-Z0-9]+)")?[^>]*>([\s\S]*?)<\/h5>([\s\S]*?)(?=<h5|$)/g;
const PARAGRAPH_RE = /<p[^>]*>([\s\S]*?)<\/p>/g;
const SPECIAL_CELL_ANCHOR_RE = /href="#([a-zA-Z0-9]+)"/g;

// Real, standard SRD phrasing for how a class's spellcasting ability is
// stated, e.g. "a cleric must have a Wisdom score equal to at least 10 +
// the spell level." Verified against Cleric; used as the real, deterministic
// signal for both spellcastingAbility and (implicitly) that this is a
// spellcasting class at all.
const SPELLCASTING_ABILITY_RE = /must have an? (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score equal to at least 10 \+ the spell level/i;
// Real, standard SRD phrasing distinguishing prepared casters from
// spontaneous casters (who instead have a real "Spells Known" table). The
// SRD uses two different real closing phrases for this across classes:
// Cleric/Druid say "must choose and prepare spells in advance"; Wizard says
// "must choose and prepare her spells ahead of time" — same rule, genuinely
// different wording, both must match.
const PREPARED_CASTER_RE = /must (?:choose and )?prepare (?:his|her|its|their)?\s*spells? (?:in advance|ahead of time)/i;

const ABILITY_ABBR_TO_CODE: Record<string, Dnd35eAbilityCode> = {
  Str: "str",
  Dex: "dex",
  Con: "con",
  Int: "int",
  Wis: "wis",
  Cha: "cha",
};

const ABILITY_NAME_TO_CODE: Record<string, Dnd35eAbilityCode> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

function classifyBabProgression(level20Bab: number): Dnd35eBabProgression {
  if (level20Bab === 20) return "full";
  if (level20Bab === 15) return "three-quarter";
  if (level20Bab === 10) return "half";
  throw new Error(`Unrecognized BAB progression: level 20 base attack bonus is +${level20Bab}, expected +20/+15/+10`);
}

function classifySaveProgression(level20Save: number): Dnd35eSaveProgression {
  if (level20Save === 12) return "good";
  if (level20Save === 6) return "poor";
  throw new Error(`Unrecognized save progression: level 20 save is +${level20Save}, expected +12 (good) or +6 (poor)`);
}

function headersMatch(headers: string[], expected: string[]): boolean {
  return headers.length === expected.length && headers.every((h, i) => h === expected[i]);
}

// A real cell in a "Spells per Day" column is either an em dash "—" (spells
// of this level aren't available yet at this class level), a plain number,
// or "N+M" (e.g. Cleric's "1+1" — a base allotment plus a real class-specific
// bonus slot, such as a domain spell).
function parseSpellsPerDayCell(raw: string): { base: number | null; bonusSlots: number } {
  const text = stripTags(raw).trim();
  if (text === "—" || text === "-") return { base: null, bonusSlots: 0 };
  const match = /^(\d+)(?:\+(\d+))?$/.exec(text);
  if (!match) throw new Error(`Unrecognized spells-per-day cell value: "${text}"`);
  return { base: Number(match[1]), bonusSlots: match[2] ? Number(match[2]) : 0 };
}

interface LevelProgressionExtraction {
  rows: Dnd35eClassLevelProgressionRow[];
  spellsPerDay: Dnd35eSpellsPerDayRow[] | null;
  spellsKnown: Dnd35eSpellsKnownRow[] | null;
}

interface HeaderCell {
  text: string;
  colspan: number;
}

const TH_WITH_ATTRS_RE = /<th([^>]*)>([\s\S]*?)<\/th>/g;

function collectHeaderCells(tableHtml: string): HeaderCell[] {
  const cells: HeaderCell[] = [];
  TH_WITH_ATTRS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TH_WITH_ATTRS_RE.exec(tableHtml))) {
    const colspanMatch = /colspan="(\d+)"/.exec(m[1]);
    cells.push({ text: normalizeHeaderText(m[2]), colspan: colspanMatch ? Number(colspanMatch[1]) : 1 });
  }
  return cells;
}

function parseSpellLevelSubHeaders(texts: string[], context: string): number[] {
  return texts.map((h) => {
    const m = /^(\d+)/.exec(h);
    if (!m) throw new Error(`Unrecognized spell-level sub-header in ${context}: "${h}"`);
    return Number(m[1]);
  });
}

function extractLevelProgression(tableHtml: string): LevelProgressionExtraction {
  const headerCells = collectHeaderCells(tableHtml);
  const headers = headerCells.map((c) => c.text);

  let columnSet: "standard" | "monk" | "caster";
  let spellsPerDayLevels: number[] = [];
  let spellsKnownLevels: number[] = [];
  let hasSpellsKnownGroup = false;

  // A caster table's colspan-N "Spells per Day" group (and, on Bard's real
  // page, a second adjacent "Spells Known" group in the SAME table — a
  // genuinely different real layout from Sorcerer's separate standalone
  // Spells Known table) always sits right after the standard 6 columns.
  if (headersMatch(headers.slice(0, 6), EXPECTED_HEADERS_STANDARD) && headerCells[6]?.text === "Spells per Day") {
    columnSet = "caster";
    const perDayColspan = headerCells[6].colspan;
    let subHeaderStartIndex = 7;
    if (headerCells[7]?.text === "Spells Known") {
      hasSpellsKnownGroup = true;
      const knownColspan = headerCells[7].colspan;
      subHeaderStartIndex = 8;
      const subHeaders = headers.slice(subHeaderStartIndex);
      spellsPerDayLevels = parseSpellLevelSubHeaders(subHeaders.slice(0, perDayColspan), '"Spells per Day"');
      spellsKnownLevels = parseSpellLevelSubHeaders(subHeaders.slice(perDayColspan, perDayColspan + knownColspan), '"Spells Known"');
    } else {
      spellsPerDayLevels = parseSpellLevelSubHeaders(headers.slice(subHeaderStartIndex, subHeaderStartIndex + perDayColspan), '"Spells per Day"');
    }
  } else if (headersMatch(headers, EXPECTED_HEADERS_STANDARD)) {
    columnSet = "standard";
  } else if (headersMatch(headers, EXPECTED_HEADERS_MONK)) {
    columnSet = "monk";
  } else {
    throw new Error(
      `Unexpected class progression table header order: ${JSON.stringify(headers)}, expected the standard 6-column set, Monk's 10-column set, or a "Spells per Day" caster table`,
    );
  }
  const expectedCellCount = columnSet === "caster" ? 6 + spellsPerDayLevels.length + spellsKnownLevels.length : headers.length;

  const rows: Dnd35eClassLevelProgressionRow[] = [];
  const spellsPerDay: Dnd35eSpellsPerDayRow[] = [];
  const spellsKnown: Dnd35eSpellsKnownRow[] = [];
  let trMatch: RegExpExecArray | null;
  TR_RE.lastIndex = 0;
  while ((trMatch = TR_RE.exec(tableHtml))) {
    const cells: string[] = [];
    let tdMatch: RegExpExecArray | null;
    TD_RE.lastIndex = 0;
    while ((tdMatch = TD_RE.exec(trMatch[1]))) {
      cells.push(tdMatch[1]);
    }
    // A header row (<th> only, no <td>) naturally has 0 <td> matches here,
    // and a tfoot footnote row (a single <td colspan="N"> cell) has 1 — both
    // fail this check and are skipped without any position-based "skip the
    // first row" assumption, which would break on tables with 2 real header
    // rows (prepared-caster tables have a grouped-column row plus a
    // spell-level sub-header row).
    if (cells.length !== expectedCellCount) continue;

    const level = Number(stripTags(cells[0]).match(/^(\d+)/)?.[1]);
    const bab = Number(stripTags(cells[1]).match(/^\+(\d+)/)?.[1]);
    const fort = Number(stripTags(cells[2]).match(/^\+(\d+)/)?.[1]);
    const ref = Number(stripTags(cells[3]).match(/^\+(\d+)/)?.[1]);
    const will = Number(stripTags(cells[4]).match(/^\+(\d+)/)?.[1]);
    const specialFeatureSlugs = [...cells[5].matchAll(SPECIAL_CELL_ANCHOR_RE)].map((m) => m[1]);

    const row: Dnd35eClassLevelProgressionRow = { level, baseAttackBonus: bab, fortSave: fort, refSave: ref, willSave: will, specialFeatureSlugs };
    if (columnSet === "monk") {
      row.flurryOfBlowsAttackBonus = stripTags(cells[6]).trim();
      row.unarmedDamage = stripTags(cells[7]).trim();
      row.acBonus = Number(stripTags(cells[8]).match(/^\+(\d+)/)?.[1]);
      row.unarmoredSpeedBonus = Number(stripTags(cells[9]).match(/^\+(\d+)/)?.[1]);
    }
    rows.push(row);

    if (columnSet === "caster") {
      const perDayEntries = spellsPerDayLevels.map((spellLevel, i) => {
        const { base, bonusSlots } = parseSpellsPerDayCell(cells[6 + i]);
        return { spellLevel, base, bonusSlots };
      });
      spellsPerDay.push({ level, entries: perDayEntries });

      if (hasSpellsKnownGroup) {
        const knownOffset = 6 + spellsPerDayLevels.length;
        const knownEntries = spellsKnownLevels.map((spellLevel, i) => {
          const text = stripTags(cells[knownOffset + i]).trim();
          return { spellLevel, known: text === "—" || text === "-" ? null : Number(text) };
        });
        spellsKnown.push({ level, entries: knownEntries });
      }
    }
  }
  return {
    rows,
    spellsPerDay: columnSet === "caster" ? spellsPerDay : null,
    spellsKnown: columnSet === "caster" && hasSpellsKnownGroup ? spellsKnown : null,
  };
}

// A real "Spells Known" table (Sorcerer's, and eventually Bard's) is a
// genuinely different, simpler shape than the BAB/save table: just a
// rowspan-2 "Level" column plus a colspan-N "Spells Known" group label and
// its spell-level sub-headers — no BAB/Fort/Ref/Will/Special columns at
// all. Located by its own real table id, since (on the shared Sorcerer &
// Wizard page) it sits physically before either class's own named section.
function extractSpellsKnownTable(html: string, tableId: string): Dnd35eSpellsKnownRow[] {
  const tableRe = new RegExp(`<table id="${tableId}"[^>]*>([\\s\\S]*?)</table>`);
  const tableMatch = tableRe.exec(html);
  if (!tableMatch) throw new Error(`No real "${tableId}" Spells Known table found on this page.`);
  const tableHtml = tableMatch[1];

  const headers = collectHeaderCells(tableHtml).map((c) => c.text);

  if (headers[0] !== "Level" || headers[1] !== "Spells Known") {
    throw new Error(`Unexpected "${tableId}" header order: ${JSON.stringify(headers)}, expected ["Level", "Spells Known", ...spell-level sub-headers]`);
  }
  const spellLevels = headers.slice(2).map((h) => {
    const m = /^(\d+)/.exec(h);
    if (!m) throw new Error(`Unrecognized spell-level sub-header in "${tableId}": "${h}"`);
    return Number(m[1]);
  });
  const expectedCellCount = 1 + spellLevels.length;

  const rows: Dnd35eSpellsKnownRow[] = [];
  TR_RE.lastIndex = 0;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = TR_RE.exec(tableHtml))) {
    const cells: string[] = [];
    TD_RE.lastIndex = 0;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = TD_RE.exec(trMatch[1]))) cells.push(tdMatch[1]);
    if (cells.length !== expectedCellCount) continue; // skips header rows and any footnote row, same as extractLevelProgression

    const level = Number(stripTags(cells[0]).match(/^(\d+)/)?.[1]);
    const entries = spellLevels.map((spellLevel, i) => {
      const text = stripTags(cells[1 + i]).trim();
      return { spellLevel, known: text === "—" || text === "-" ? null : Number(text) };
    });
    rows.push({ level, entries });
  }
  return rows;
}

function extractClassSkills(html: string): Dnd35eClassSkill[] {
  const sectionMatch = CLASS_SKILLS_SECTION_RE.exec(html);
  if (!sectionMatch) return [];
  return [...sectionMatch[1].matchAll(CLASS_SKILL_ENTRY_RE)].map((m) => ({
    skillCanonicalId: buildCanonicalId("dnd35e", "skill", kebabCase(m[1].trim())),
    keyAbility: ABILITY_ABBR_TO_CODE[m[2]],
  }));
}

function extractClassFeatures(html: string): Dnd35eClassFeature[] {
  const sectionMatch = CLASS_FEATURES_SECTION_RE.exec(html);
  if (!sectionMatch) return [];
  const features: Dnd35eClassFeature[] = [];
  let blockMatch: RegExpExecArray | null;
  FEATURE_BLOCK_RE.lastIndex = 0;
  while ((blockMatch = FEATURE_BLOCK_RE.exec(sectionMatch[1]))) {
    const name = stripTags(blockMatch[2]).trim();
    const slug = blockMatch[1] ?? kebabCase(name);
    const paragraphs = [...blockMatch[3].matchAll(PARAGRAPH_RE)].map((p) => stripTags(p[1]));
    features.push({ slug, name, description: paragraphs.join(" ") });
  }
  return features;
}

// Shared core: builds a full Dnd35eClassDefinition from a class's name, the
// HTML region containing its Alignment/Hit Die/Class Skills/Skill Points/
// Class Features sections (the whole page for a normal single-class page;
// just that class's own slice for the shared Sorcerer & Wizard page), and
// its already-parsed level-progression table. `spellsKnown` is passed
// separately since — on the shared page — it lives in its own named table
// outside any single class's region.
function buildClassDefinition(
  name: string,
  regionHtml: string,
  levelProgression: Dnd35eClassLevelProgressionRow[],
  spellsPerDay: Dnd35eSpellsPerDayRow[] | null,
  spellsKnown: Dnd35eSpellsKnownRow[] | null,
): Dnd35eClassDefinition {
  const level20 = levelProgression.find((r) => r.level === 20);
  if (!level20) throw new Error(`No level-20 row found in the real progression table for class "${name}".`);

  const alignmentMatch = ALIGNMENT_RE.exec(regionHtml);
  const hitDieMatch = HIT_DIE_RE.exec(regionHtml);
  const skillPointsMatch = SKILL_POINTS_RE.exec(regionHtml);
  const classSkills = extractClassSkills(regionHtml);
  const classFeatures = extractClassFeatures(regionHtml);

  const notes: string[] = [];
  if (!alignmentMatch) notes.push("Alignment section did not match the expected real page pattern.");
  if (!hitDieMatch) notes.push("Hit Die section did not match the expected real page pattern.");
  if (!skillPointsMatch) notes.push("Skill Points section did not match the expected real page pattern.");
  if (classSkills.length === 0) notes.push("No class skills were extracted — Class Skills section may be absent or differently formatted.");
  if (classFeatures.length === 0) notes.push("No class features were extracted — Class Features section may be absent or differently formatted.");

  let spellcasting: Dnd35eClassSpellcasting | null = null;
  if (spellsPerDay !== null) {
    const abilityMatch = SPELLCASTING_ABILITY_RE.exec(regionHtml);
    if (!abilityMatch) {
      notes.push('This class has a real "Spells per Day" table, but no spellcasting-ability sentence matched the expected real page pattern.');
    } else {
      spellcasting = {
        spellcastingAbility: ABILITY_NAME_TO_CODE[abilityMatch[1].toLowerCase()],
        type: PREPARED_CASTER_RE.test(regionHtml) ? "prepared" : "spontaneous",
        spellsPerDay,
        spellsKnown,
      };
    }
  }

  const extractionStatus: Dnd35eClassDefinition["extractionStatus"] =
    notes.length === 0 ? "fully_structured" : alignmentMatch && hitDieMatch && skillPointsMatch ? "partially_structured" : "unresolved";

  return {
    canonicalId: buildCanonicalId("dnd35e", "class", kebabCase(name)),
    name,
    alignment: alignmentMatch ? stripTags(alignmentMatch[1]) : "",
    hitDie: hitDieMatch ? Number(hitDieMatch[1]) : 0,
    babProgression: classifyBabProgression(level20.baseAttackBonus),
    saveProgression: {
      fort: classifySaveProgression(level20.fortSave),
      ref: classifySaveProgression(level20.refSave),
      will: classifySaveProgression(level20.willSave),
    },
    skillPointsBase: skillPointsMatch ? Number(skillPointsMatch[1]) : 0,
    classSkills,
    levelProgression,
    classFeatures,
    spellcasting,
    extractionStatus,
    extractionNotes: notes,
  };
}

export function extractClassFromHtml(html: string): Dnd35eClassDefinition {
  const nameMatch = CLASS_NAME_RE.exec(html);
  if (!nameMatch) throw new Error("No <h1> or <h2 id> class name found on this page — not a real class page.");
  const name = (nameMatch[1] ?? nameMatch[2]).trim();

  const tableMatch = TABLE_RE.exec(html);
  if (!tableMatch) throw new Error(`No real level-progression table found for class "${name}".`);
  const { rows: levelProgression, spellsPerDay, spellsKnown } = extractLevelProgression(tableMatch[1]);

  return buildClassDefinition(name, html, levelProgression, spellsPerDay, spellsKnown);
}

// The real d20srd.org/srd/classes/sorcererWizard.htm page covers BOTH
// classes under one <h1>Sorcerers & Wizards</h1> — genuinely different from
// every other core class page, which is why this needs its own entry point
// rather than reusing extractClassFromHtml. Real, page-specific layout:
// Sorcerer's two tables (BAB/saves, and its separate Spells Known table)
// sit physically BEFORE either class's own <h2 id="sorcerer">/<h2 id="wizard">
// section — located by explicit table id, not by table-after-heading
// position. Wizard's own table sits inside its own <h2>-delimited region,
// same as every single-class page.
const SORCERER_H2_RE = /<h2 id="sorcerer">/;
const WIZARD_H2_RE = /<h2 id="wizard">/;
const FAMILIARS_H2_RE = /<h2 id="familiars">/;

export function extractSorcererAndWizardFromHtml(html: string): [Dnd35eClassDefinition, Dnd35eClassDefinition] {
  const sorcererH2 = SORCERER_H2_RE.exec(html);
  const wizardH2 = WIZARD_H2_RE.exec(html);
  const familiarsH2 = FAMILIARS_H2_RE.exec(html);
  if (!sorcererH2 || !wizardH2 || !familiarsH2) {
    throw new Error('Expected real <h2 id="sorcerer">, <h2 id="wizard">, and <h2 id="familiars"> markers on the Sorcerer & Wizard page — not found.');
  }
  if (!(sorcererH2.index < wizardH2.index && wizardH2.index < familiarsH2.index)) {
    throw new Error("Sorcerer/Wizard/Familiars section markers were found out of the expected real page order.");
  }

  const sorcererRegion = html.slice(sorcererH2.index, wizardH2.index);
  const wizardRegion = html.slice(wizardH2.index, familiarsH2.index);

  const sorcererTableMatch = /<table id="tableTheSorcerer"[^>]*>([\s\S]*?)<\/table>/.exec(html);
  if (!sorcererTableMatch) throw new Error('No real "tableTheSorcerer" level-progression table found.');
  const { rows: sorcererLevelProgression, spellsPerDay: sorcererSpellsPerDay } = extractLevelProgression(sorcererTableMatch[1]);
  const sorcererSpellsKnown = extractSpellsKnownTable(html, "tableSorcererSpellsKnown");
  const sorcerer = buildClassDefinition("Sorcerer", sorcererRegion, sorcererLevelProgression, sorcererSpellsPerDay, sorcererSpellsKnown);

  const wizardTableMatch = /<table id="tableTheWizard"[^>]*>([\s\S]*?)<\/table>/.exec(wizardRegion);
  if (!wizardTableMatch) throw new Error('No real "tableTheWizard" level-progression table found.');
  const { rows: wizardLevelProgression, spellsPerDay: wizardSpellsPerDay } = extractLevelProgression(wizardTableMatch[1]);
  const wizard = buildClassDefinition("Wizard", wizardRegion, wizardLevelProgression, wizardSpellsPerDay, null);

  return [sorcerer, wizard];
}
