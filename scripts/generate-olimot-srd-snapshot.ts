// scripts/generate-olimot-srd-snapshot.ts
//
// Generates server/srd-manifest-snapshot-olimot.generated.ts from the real,
// pinned GitHub tree API response — never hand-transcribed. Two independent
// manual transcription passes performed while planning Phase 2A produced
// different file counts for the same pinned commit (documented in the plan's
// "Real Source Structure" section); this script exists specifically to
// remove that failure mode by parsing the raw API response programmatically.
//
// Re-run with: node --import tsx scripts/generate-olimot-srd-snapshot.ts

const PINNED_SHA = "faab739130921026db42b96e6adff6d3661bffbd";
const TREE_URL = `https://api.github.com/repos/olimot/srd-v3.5/git/trees/${PINNED_SHA}?recursive=1`;

// Directory -> default CorpusArea. Overridden per-filename below for
// basic-rules-and-legal/, which mixes multiple real corpus areas in one
// directory (confirmed by direct content inspection during planning).
const DIRECTORY_DEFAULT_AREA: Record<string, string> = {
  "spells": "spells",
  "monsters": "monsters",
  "magic-items": "items-equipment",
  "divine": "divine",
  "epic": "epic",
  "psionics": "psionics",
  "basic-rules-and-legal": "core",
};

const FILENAME_AREA_OVERRIDES: Record<string, string> = {
  "character-classes-i.html": "classes",
  "character-classes-ii.html": "classes",
  "npc-classes.html": "classes",
  "combat-i-basics.html": "combat-rules",
  "combat-ii-movement-modifiers-and-special-actions.html": "combat-rules",
  "equipment.html": "items-equipment",
  "special-materials.html": "items-equipment",
  "treasure.html": "items-equipment",
  "feats.html": "feats",
  "prestige-classes.html": "prestige-classes",
  "races.html": "races",
  "skills-i.html": "skills",
  "skills-ii.html": "skills",
  "special-abilities-and-conditions.html": "conditions",
  "types-subtypes-and-special-abilities.html": "monsters",
};

const EXCLUDED_FILENAMES = new Set(["legal-information.html", "index.html"]);

interface TreeEntry { path: string; type: string; }
interface TreeResponse { tree: TreeEntry[]; truncated: boolean; }

async function main() {
  const res = await fetch(TREE_URL);
  if (!res.ok) throw new Error(`GitHub tree API returned ${res.status}`);
  const data = (await res.json()) as TreeResponse;
  if (data.truncated) throw new Error("Tree response was truncated — cannot trust this as a complete listing");

  const entries: Array<{ corpusArea: string; sourcePath: string }> = [];
  for (const item of data.tree) {
    if (item.type !== "blob") continue;
    if (!item.path.endsWith(".html")) continue;
    const filename = item.path.split("/").pop()!;
    if (EXCLUDED_FILENAMES.has(filename)) continue;
    const directory = item.path.split("/")[0];
    const corpusArea = FILENAME_AREA_OVERRIDES[filename] ?? DIRECTORY_DEFAULT_AREA[directory];
    if (corpusArea === undefined) {
      throw new Error(
        `Cannot classify corpus area for "${item.path}" — directory "${directory}" has no entry in ` +
        `DIRECTORY_DEFAULT_AREA and filename "${filename}" has no entry in FILENAME_AREA_OVERRIDES. ` +
        `Add a real rule to one of those tables in scripts/generate-olimot-srd-snapshot.ts (verify the ` +
        `real file's content first) — never silently default to "core".`,
      );
    }
    entries.push({ corpusArea, sourcePath: item.path });
  }

  entries.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  const output = `// GENERATED FILE — produced by scripts/generate-olimot-srd-snapshot.ts
// against pinned commit ${PINNED_SHA}. Do not hand-edit; re-run the script.
// legal-information.html and the repo-root index.html are deliberately excluded.

import type { CorpusArea } from "@shared/rules-registry/srd-manifest";

export const SRD_MANIFEST_SOURCE_OLIMOT: Array<{ corpusArea: CorpusArea; sourcePath: string }> = ${JSON.stringify(entries, null, 2)};
`;

  const fs = await import("node:fs");
  fs.writeFileSync("server/srd-manifest-snapshot-olimot.generated.ts", output);
  console.log(`Wrote ${entries.length} entries to server/srd-manifest-snapshot-olimot.generated.ts`);
}

main();
