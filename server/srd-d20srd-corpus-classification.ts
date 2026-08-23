// server/srd-d20srd-corpus-classification.ts
//
// Deterministic corpus-area classification for d20srd.org leaf pages —
// genuinely separate from server/srd-link-extraction.ts's inclusion
// decision. A page's topic is a property of ITS OWN URL, never of
// whichever discovery root or intermediate leaf page happened to link to
// it — see the Phase 2A plan's "Resolved Design Decisions" for the real
// discovered case (monsterFeats root -> /srd/epic/feats.htm, which must
// classify as "epic", never "monsters") that makes this a genuine bug
// class, not a hypothetical one.
//
// Every prefix/exact-path rule below was verified against a real fetched
// page during this revision's research — this is not a guessed mapping.
// A path matching neither table is NOT silently defaulted to a caller's
// context; classifyD20srdCorpusArea throws, and the resolution is a real
// rule addition (or, for a genuinely one-off ambiguous case, an explicit
// override), never a fallback.

import type { CorpusArea } from "@shared/rules-registry/srd-manifest";

// Path-family prefixes — checked longest-meaningful-match style by
// insertion order below (all current prefixes are mutually exclusive by
// construction, so order does not currently matter, but new prefixes added
// later should be checked for accidental overlap with an existing one).
const PATH_PREFIX_RULES: Array<[string, CorpusArea]> = [
  ["/srd/spellLists/", "spells"],
  ["/srd/spells/", "spells"],
  ["/srd/magicOverview/", "spells"],
  ["/srd/monsters/", "monsters"],
  ["/srd/prestigeClasses/", "prestige-classes"],
  ["/srd/npcClasses/", "classes"],
  ["/srd/classes/", "classes"],
  ["/srd/skills/", "skills"],
  ["/srd/magicItems/", "items-equipment"],
  ["/srd/equipment/", "items-equipment"],
  ["/srd/combat/", "combat-rules"],
  ["/srd/divine/", "divine"],
  ["/srd/epic/", "epic"],
  ["/srd/psionic/", "psionics"],
  ["/srd/variant/", "open-variants"],
];

// Single-file leaf pages with no subdirectory — each individually verified
// against a real fetch during this revision's research.
const EXACT_PATH_RULES: Record<string, CorpusArea> = {
  "/srd/feats.htm": "feats",
  "/srd/conditionSummary.htm": "conditions",
  "/srd/specialAbilities.htm": "conditions",
  "/srd/monsterFeats.htm": "monsters",
  "/srd/typesSubtypes.htm": "monsters",
  "/srd/races.htm": "races",
  "/srd/specialMaterials.htm": "items-equipment",
  "/srd/treasure.htm": "items-equipment",
  "/srd/theBasics.htm": "core",
  "/srd/description.htm": "core",
  "/srd/traps.htm": "core",
  "/srd/planes.htm": "core",
  "/srd/improvingMonsters.htm": "monsters",
  "/srd/monstersAsRaces.htm": "monsters",
  "/srd/carryingCapacity.htm": "core",
  "/srd/movement.htm": "core",
  "/srd/exploration.htm": "core",
  "/srd/dungeons.htm": "core",
  "/srd/wilderness.htm": "core",
  "/srd/weather.htm": "core",
  "/srd/environment.htm": "core",
};

export function classifyD20srdCorpusArea(
  sourcePath: string,
  overrides: Record<string, CorpusArea> = {},
): CorpusArea {
  if (overrides[sourcePath]) return overrides[sourcePath];
  if (EXACT_PATH_RULES[sourcePath]) return EXACT_PATH_RULES[sourcePath];
  for (const [prefix, area] of PATH_PREFIX_RULES) {
    if (sourcePath.startsWith(prefix)) return area;
  }
  throw new Error(
    `Cannot deterministically classify corpus area for "${sourcePath}" — no known path-family prefix or ` +
    `exact-path rule matches, and no override was supplied. Add a real rule to PATH_PREFIX_RULES or ` +
    `EXACT_PATH_RULES in server/srd-d20srd-corpus-classification.ts (verify the real page first), or, for a ` +
    `genuinely one-off ambiguous case, pass an explicit { "${sourcePath}": <area> } override — never fall back ` +
    `to whichever root happened to discover this path.`,
  );
}
