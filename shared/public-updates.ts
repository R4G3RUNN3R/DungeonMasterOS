export type PublicUpdateEntry = {
  id: string;
  date: string;
  title: string;
  description: string;
};

// MANDATORY RELEASE POLICY:
// Every production release that changes player-visible behavior or runtime
// mechanics must add or update an entry here before it is considered deployable.
// The server synchronizes these entries into the public Updates feed at startup,
// so a deployed release cannot rely on a separate manual database post.
export const PUBLIC_UPDATES: readonly PublicUpdateEntry[] = [
  {
    id: "2026-08-24-public-updates-release-sync",
    date: "2026-08-24",
    title: "Updates now ship with every release",
    description:
      "The public changelog is now part of the release itself. From now on, anything deployed to Dungeon Master OS must include its Updates entry in the same verified release, so the website cannot quietly fall behind the live game again. The standard test command has also been hardened to discover the complete nested test suite before a release is accepted.",
  },
  {
    id: "2026-08-24-completed-live-release",
    date: "2026-08-24",
    title: "Player Profiles, Achievements, and a major D&D 3.5e rules upgrade",
    description:
      "Player Profile and Achievements are now live and reachable from the dashboard, using your real account and achievement data rather than placeholder content. This release also ships the largest D&D 3.5e rules-library upgrade so far: a provenance-backed canonical rules registry plus verified core races, all 11 core classes, skills, class spell lists, feats, hundreds of spells, weapons, ammunition, armor, and shields. The new 3.5e data is kept edition-isolated so unfinished 5e 2014/2024 work cannot leak into 3.5e play, while the existing legacy 5e experience remains unchanged. This release also includes the completed source-ingestion and verification foundation that lets future 3.5e rules content be added deterministically instead of guessed by the AI.",
  },
];
