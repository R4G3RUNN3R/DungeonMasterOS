// server/srd-manifest-roots-d20srd.ts
//
// The 44 real d20srd.org discovery ROOTS — not the corpus itself. Verified
// via the Claude Browser tool against the live site on 2026-08-22 (WebFetch
// returned HTTP 403 for every URL on this domain). This is the one list in
// this plan that is necessarily hand-verified rather than generated, since
// no tree API exists for a live website's site map. The prior revision of
// this plan miscounted this same real navigation as 40 — recounting it
// directly here gives the correct 44, the second real hand-count error this
// plan has now caught and corrected on its own (the first was olimot's
// directory counts). scripts/generate-d20srd-srd-snapshot.ts crawls exactly
// these 44 roots to generate the real leaf-page manifest (Step 4 below).

import type { CorpusArea } from "@shared/rules-registry/srd-manifest";

export const SRD_MANIFEST_ROOTS_D20SRD: Array<{ corpusArea: CorpusArea; sourcePath: string }> = [
  // Core Rules (22)
  { corpusArea: "core", sourcePath: "/indexes/basicsRacesDescription.htm" },
  { corpusArea: "classes", sourcePath: "/indexes/classes.htm" },
  { corpusArea: "skills", sourcePath: "/indexes/skills.htm" },
  { corpusArea: "feats", sourcePath: "/indexes/feats.htm" },
  { corpusArea: "items-equipment", sourcePath: "/indexes/magicItems.htm" },
  { corpusArea: "items-equipment", sourcePath: "/indexes/equipment.htm" },
  { corpusArea: "combat-rules", sourcePath: "/indexes/combat.htm" },
  { corpusArea: "conditions", sourcePath: "/indexes/conditions.htm" },
  { corpusArea: "conditions", sourcePath: "/indexes/specialAbilities.htm" },
  { corpusArea: "spells", sourcePath: "/indexes/magicOverview.htm" },
  { corpusArea: "spells", sourcePath: "/indexes/spellLists.htm" },
  { corpusArea: "spells", sourcePath: "/indexes/spells.htm" },
  { corpusArea: "monsters", sourcePath: "/indexes/monsters.htm" },
  { corpusArea: "monsters", sourcePath: "/indexes/typesSubtypes.htm" },
  { corpusArea: "monsters", sourcePath: "/indexes/improvingMonsters.htm" },
  { corpusArea: "monsters", sourcePath: "/indexes/monsterFeats.htm" },
  { corpusArea: "monsters", sourcePath: "/indexes/monstersAsRaces.htm" },
  { corpusArea: "core", sourcePath: "/indexes/carryingMovementExploration.htm" },
  { corpusArea: "core", sourcePath: "/indexes/wildernessWeatherEnvironment.htm" },
  { corpusArea: "core", sourcePath: "/indexes/traps.htm" },
  { corpusArea: "items-equipment", sourcePath: "/indexes/treasure.htm" },
  { corpusArea: "core", sourcePath: "/indexes/planes.htm" },

  // Epic Rules (6)
  { corpusArea: "epic", sourcePath: "/indexes/epicBasicsAndClasses.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicSkills.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicFeats.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicSpells.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicMagicItems.htm" },
  { corpusArea: "epic", sourcePath: "/indexes/epicMonstersAndObstacles.htm" },

  // Psionic Rules (7)
  { corpusArea: "psionics", sourcePath: "/indexes/psionicRacesClassesSkillsSpells.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicFeats.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicPowersOverview.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicPowerList.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicPowers.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicItems.htm" },
  { corpusArea: "psionics", sourcePath: "/indexes/psionicMonsters.htm" },

  // Divine Rules (3)
  { corpusArea: "divine", sourcePath: "/indexes/divineRanksPowers.htm" },
  { corpusArea: "divine", sourcePath: "/indexes/divineAbilitiesFeats.htm" },
  { corpusArea: "divine", sourcePath: "/indexes/divineMinionsDomainsSpells.htm" },

  // Variant Rules (6) — "open content from Unearthed Arcana". The one
  // corpus area olimot/srd-v3.5 has zero coverage of.
  { corpusArea: "open-variants", sourcePath: "/indexes/variantRaces.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantClasses.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantBuildingCharacters.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantAdventuring.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantMagic.htm" },
  { corpusArea: "open-variants", sourcePath: "/indexes/variantCampaigns.htm" },
];
