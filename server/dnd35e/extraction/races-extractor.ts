// server/dnd35e/extraction/races-extractor.ts
//
// Deterministic, regex-based extractor for the real d20srd.org/srd/races.htm
// page. Pure function: no network, no DB. Each race is a real
// <h2 id="slug">Name</h2> block followed by a <ul> of <li> racial traits.
//
// Design note on "honest partial extraction" (same discipline as
// feats-extractor.ts): most real racial traits (Stonecunning, Weapon
// Familiarity, Elven/Orc Blood, Spell-Like Abilities) are genuinely one-off
// narrative mechanics that don't reduce to a small fixed set of atomic
// kinds. This pass structures the handful of shapes that recur across every
// race (ability modifiers, size, base land speed, languages, favored class,
// and Human's bonus-feat/skill-point grants) and preserves everything else
// as a real, named `special_ability` — never dropped, never guessed. Any
// real trailing prose this pass's structured patterns don't consume (e.g. a
// dwarf's medium/heavy-load speed exception, a gnome's burrowing-mammal
// language note) is preserved as its own `special_ability`, not discarded.

import { buildCanonicalId } from "@shared/rules-registry/canonical-id";
import type {
  Dnd35eAbilityCode,
  Dnd35eRaceDefinition,
  Dnd35eRacialLanguages,
  Dnd35eRacialTrait,
  Dnd35eRaceSize,
} from "@shared/rules-registry/dnd35e/races";
import { stripTags, kebabCase } from "./html-utils";

const H2_BLOCK_RE = /<h2 id="([a-zA-Z0-9]+)">([^<]+)<\/h2>/g;
const UL_RE = /<ul>([\s\S]*?)<\/ul>/;
const LI_RE = /<li>([\s\S]*?)<\/li>/g;

const ABILITY_NAME_TO_CODE: Record<string, Dnd35eAbilityCode> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

const ABILITY_MOD_HEAD_RE =
  /^((?:[+-]\d+ (?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:,\s*)?)+)\.\s*(.*)$/i;
const ABILITY_MOD_CLAUSE_RE = /^([+-]\d+) (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)$/i;

const SIZE_RE = /^(Fine|Diminutive|Tiny|Small|Medium|Large|Huge|Gargantuan|Colossal):\s*/;

const BASE_LAND_SPEED_RE = /^[A-Za-z '-]+? base land speed is (\d+) feet\.?\s*(.*)$/i;

const BONUS_FEAT_RE = /^(\d+) extra feats? at 1st level\.?$/i;
const BONUS_SKILL_RE = /^(\d+) extra skill points? at 1st level and (\d+) extra skill points? at each additional level\.?$/i;

const LANGUAGES_RE = /^Automatic Languages?:\s*([^.]+)\.\s*Bonus Languages?:\s*([^.]+)\./i;

const FAVORED_CLASS_PREFIX_RE = /^Favored Class:\s*/i;
const CLASS_ANCHOR_RE = /<a href="\/srd\/classes\/[^"#]+(?:#[a-zA-Z]+)?">([^<]*)<\/a>/;

const LABELED_TRAIT_RE = /^([A-Z][A-Za-z '-]{1,40}):\s*(.+)$/;

function splitLanguageList(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((s) => s.trim().replace(/^and\s+/i, ""))
      .filter((s) => s.length > 0);
  }
  return trimmed
    .split(/\s+and\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Classifies one <li>'s raw HTML into either a `languages` field value or
// zero-or-more racial traits. Never both — a languages <li> is structurally
// distinct from a trait <li> on this real page.
function classifyRacialLi(rawLiHtml: string): { languages: Dnd35eRacialLanguages; residualNote: string | null } | Dnd35eRacialTrait[] {
  const text = stripTags(rawLiHtml);
  if (text.length === 0) return [];

  const languagesMatch = LANGUAGES_RE.exec(text);
  if (languagesMatch) {
    const automatic = splitLanguageList(languagesMatch[1]);
    const bonusRaw = languagesMatch[2].trim();
    const bonus: string[] | "any" = /^any\b/i.test(bonusRaw) ? "any" : splitLanguageList(bonusRaw);
    const residual = text.slice(languagesMatch.index + languagesMatch[0].length).trim();
    return { languages: { automatic, bonus }, residualNote: residual.length > 0 ? residual : null };
  }

  const abilityHead = ABILITY_MOD_HEAD_RE.exec(text);
  if (abilityHead) {
    const clauses = abilityHead[1].split(",").map((c) => c.trim());
    const traits: Dnd35eRacialTrait[] = [];
    for (const clause of clauses) {
      const clauseMatch = ABILITY_MOD_CLAUSE_RE.exec(clause);
      if (clauseMatch) {
        traits.push({
          kind: "ability_modifier",
          ability: ABILITY_NAME_TO_CODE[clauseMatch[2].toLowerCase()],
          modifier: Number(clauseMatch[1]),
        });
      }
    }
    const residual = abilityHead[2].trim();
    if (residual.length > 0) {
      traits.push({ kind: "special_ability", name: "Ability score adjustment note", description: residual });
    }
    return traits;
  }

  const sizeMatch = SIZE_RE.exec(text);
  if (sizeMatch) {
    return [{ kind: "size", size: sizeMatch[1].toLowerCase() as Dnd35eRaceSize }];
  }

  const speedMatch = BASE_LAND_SPEED_RE.exec(text);
  if (speedMatch) {
    const traits: Dnd35eRacialTrait[] = [{ kind: "base_land_speed", feet: Number(speedMatch[1]) }];
    const residual = speedMatch[2].trim();
    if (residual.length > 0) {
      traits.push({ kind: "special_ability", name: "Base land speed note", description: residual });
    }
    return traits;
  }

  const bonusFeatMatch = BONUS_FEAT_RE.exec(text);
  if (bonusFeatMatch) {
    return [{ kind: "bonus_feat_count", count: Number(bonusFeatMatch[1]), when: "1st level" }];
  }

  const bonusSkillMatch = BONUS_SKILL_RE.exec(text);
  if (bonusSkillMatch) {
    return [
      {
        kind: "bonus_skill_points",
        atFirstLevel: Number(bonusSkillMatch[1]),
        perAdditionalLevel: Number(bonusSkillMatch[2]),
      },
    ];
  }

  if (FAVORED_CLASS_PREFIX_RE.test(text)) {
    const afterPrefix = text.replace(FAVORED_CLASS_PREFIX_RE, "");
    const isAny = /^any\b/i.test(afterPrefix);
    const classAnchor = CLASS_ANCHOR_RE.exec(rawLiHtml);
    return [
      {
        kind: "favored_class",
        any: isAny,
        classCanonicalId: !isAny && classAnchor ? buildCanonicalId("dnd35e", "class", kebabCase(classAnchor[1])) : null,
        description: text,
      },
    ];
  }

  const labeled = LABELED_TRAIT_RE.exec(text);
  if (labeled) {
    return [{ kind: "special_ability", name: labeled[1].trim(), description: text }];
  }

  return [{ kind: "special_ability", name: "", description: text }];
}

export function extractRacesFromHtml(html: string): Dnd35eRaceDefinition[] {
  const blocks: { slug: string; name: string; start: number; end: number }[] = [];
  let h2Match: RegExpExecArray | null;
  H2_BLOCK_RE.lastIndex = 0;
  while ((h2Match = H2_BLOCK_RE.exec(html))) {
    blocks.push({ slug: h2Match[1], name: h2Match[2].trim(), start: H2_BLOCK_RE.lastIndex, end: -1 });
  }
  for (let i = 0; i < blocks.length; i++) {
    blocks[i].end = i + 1 < blocks.length ? blocks[i + 1].start : html.length;
  }

  const races: Dnd35eRaceDefinition[] = [];

  for (const block of blocks) {
    const blockHtml = html.slice(block.start, block.end);
    const ulMatch = UL_RE.exec(blockHtml);
    if (!ulMatch) continue; // not a real race block (none observed on this page, but fail-closed rather than crash)

    const traits: Dnd35eRacialTrait[] = [];
    let languages: Dnd35eRacialLanguages | null = null;
    const notes: string[] = [];

    let liMatch: RegExpExecArray | null;
    LI_RE.lastIndex = 0;
    while ((liMatch = LI_RE.exec(ulMatch[1]))) {
      const result = classifyRacialLi(liMatch[1]);
      if (Array.isArray(result)) {
        traits.push(...result);
      } else {
        languages = result.languages;
        if (result.residualNote) {
          notes.push(`Languages entry had real trailing text this pass didn't structure: "${result.residualNote}"`);
        }
      }
    }

    const specialAbilities = traits.filter((t) => t.kind === "special_ability");
    for (const sa of specialAbilities) {
      notes.push(
        sa.name.length > 0
          ? `"${sa.name}" is a real racial trait this pass preserved verbatim rather than forcing into a structured kind: "${sa.description}"`
          : `Real racial trait text this pass preserved verbatim rather than forcing into a structured kind: "${sa.description}"`,
      );
    }

    let extractionStatus: Dnd35eRaceDefinition["extractionStatus"];
    const structuredTraitCount = traits.length - specialAbilities.length;
    if (languages !== null && specialAbilities.length === 0 && structuredTraitCount > 0) {
      extractionStatus = "fully_structured";
    } else if (structuredTraitCount === 0 && languages === null) {
      extractionStatus = "unresolved";
    } else {
      extractionStatus = "partially_structured";
    }

    races.push({
      canonicalId: buildCanonicalId("dnd35e", "race", kebabCase(block.slug)),
      name: block.name,
      languages,
      traits,
      extractionStatus,
      extractionNotes: notes,
    });
  }

  return races;
}
