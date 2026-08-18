import type { Dnd35SourceKind } from "./types";

export type Dnd35SourceManifestEntry = {
  id: string;
  title: string;
  abbreviation: string;
  kind: Dnd35SourceKind;
  publicCorpusEligible: boolean;
  notes?: string;
};

export const DND35_SOURCE_MANIFEST: Dnd35SourceManifestEntry[] = [
  {
    id: "srd-35",
    title: "Dungeons & Dragons 3.5 System Reference Document",
    abbreviation: "SRD",
    kind: "srd-open",
    publicCorpusEligible: true,
    notes: "Primary public rules corpus for canonical mechanical records where SRD coverage exists.",
  },
  {
    id: "phb-35",
    title: "Player's Handbook v.3.5",
    abbreviation: "PHB",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
    notes: "Private verification/reference source only; store concise DMOS-authored structured summaries rather than reproducing book prose.",
  },
  {
    id: "dmg-35",
    title: "Dungeon Master's Guide v.3.5",
    abbreviation: "DMG",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
  {
    id: "spell-compendium",
    title: "Spell Compendium",
    abbreviation: "SpC",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
  {
    id: "complete-arcane",
    title: "Complete Arcane",
    abbreviation: "CAr",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
  {
    id: "complete-divine",
    title: "Complete Divine",
    abbreviation: "CD",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
  {
    id: "complete-mage",
    title: "Complete Mage",
    abbreviation: "CM",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
  {
    id: "complete-champion",
    title: "Complete Champion",
    abbreviation: "CC",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
  {
    id: "complete-adventurer",
    title: "Complete Adventurer",
    abbreviation: "CAd",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
  {
    id: "complete-scoundrel",
    title: "Complete Scoundrel",
    abbreviation: "CS",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
  {
    id: "magic-item-compendium",
    title: "Magic Item Compendium",
    abbreviation: "MIC",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
  {
    id: "miniatures-handbook",
    title: "Miniatures Handbook",
    abbreviation: "MH",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
  {
    id: "savage-species",
    title: "Savage Species",
    abbreviation: "SS",
    kind: "official-book-private-reference",
    publicCorpusEligible: false,
  },
];
