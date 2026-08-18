// server/titles.ts
//
// Emergent titles: aliases/epithets/nicknames a character becomes known by
// through actual gameplay, not a picklist. Claude proposes candidate/witness
// events via the [TITLE_CANDIDATE]/[TITLE_WITNESS] tags (mechanics-tags.ts);
// this module is the server-authoritative validation and lifecycle layer —
// the same "AI proposes, server persists" split as every other mechanics tag
// in this codebase (attacks, checks, combat starts). Titles carry no
// mechanical effect whatsoever — no stats, no XP, no feats. They're pure
// character/world history.
//
// Deliberately NOT implemented here yet (a documented simplification, not a
// silent gap): NPC-knowledge-scoped title visibility and secret-identity /
// persona binding. DMOS has no NPC knowledge-boundary system to hang that
// off yet — every established title is currently visible campaign-wide,
// rather than gated per-NPC on whether that NPC could plausibly know it.

import { extractTitleCandidateTag, extractTitleWitnessTag } from "./mechanics-tags";

export interface TitleRow {
  id: number;
  characterId: number;
  campaignId: number;
  titleText: string;
  normalizedTitle: string;
  selfDeclared: boolean;
  established: boolean;
  establishedAt: string | null;
}

export interface StorageLike {
  getCharacterTitles(characterId: number): TitleRow[];
  createCharacterTitle(data: {
    characterId: number;
    campaignId: number;
    titleText: string;
    normalizedTitle: string;
    selfDeclared: boolean;
  }): TitleRow;
  addTitleEvidence(titleId: number, npcName: string): { inserted: boolean; distinctWitnessCount: number };
  establishTitle(titleId: number): void;
}

// Minimum number of DISTINCT NPCs who must independently use a title before
// it's promoted from candidate to established. One NPC repeating a name ten
// times is still one witness — this constant is the anti-farming backbone
// of the whole system: it's what makes "tell everyone to call me X" alone
// insufficient, since every witness still has to be a genuinely separate
// [TITLE_WITNESS] tag naming a different NPC.
const INDEPENDENT_WITNESS_THRESHOLD = 2;

const MAX_TITLE_LENGTH = 60;

export function normalizeTitleText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Trivial-variant grouping: "Shadow" / "Dark Shadow" / "Shadow of Shadows"
// share a core token and should accumulate evidence toward ONE title rather
// than spawning a new candidate per phrasing. A real semantic-similarity
// model is out of scope for this pass — substring containment on the
// normalized text is a deliberately simple, testable heuristic that covers
// the concrete anti-farming example in the spec (see module doc comment).
export function findRelatedTitle(titles: TitleRow[], normalized: string): TitleRow | undefined {
  if (!normalized) return undefined;
  return titles.find(
    (t) =>
      t.normalizedTitle === normalized ||
      t.normalizedTitle.includes(normalized) ||
      normalized.includes(t.normalizedTitle),
  );
}

function findOrCreateTitle(
  storage: StorageLike,
  characterId: number,
  campaignId: number,
  rawTitle: string,
  selfDeclared: boolean,
): TitleRow {
  const normalized = normalizeTitleText(rawTitle);
  const existing = findRelatedTitle(storage.getCharacterTitles(characterId), normalized);
  if (existing) return existing;
  return storage.createCharacterTitle({
    characterId,
    campaignId,
    titleText: rawTitle.trim(),
    normalizedTitle: normalized,
    selfDeclared,
  });
}

export interface ProcessTitleTagsResult {
  candidateCreated: boolean;
  witnessRecorded: boolean;
  titleEstablished: { titleText: string } | null;
}

// Called once per resolved DM turn, alongside extractItemsFromNarration and
// friends in routes.ts. Never throws — a malformed or absent tag is simply a
// no-op for titles that turn, same "AI proposal failures don't break
// gameplay" posture as the rest of the extraction pipeline.
export function processTitleTags(
  rawResponse: string,
  characterId: number,
  campaignId: number,
  storage: StorageLike,
): ProcessTitleTagsResult {
  const result: ProcessTitleTagsResult = { candidateCreated: false, witnessRecorded: false, titleEstablished: null };

  const candidateTag = extractTitleCandidateTag(rawResponse);
  if (candidateTag && candidateTag.title.trim().length > 0 && candidateTag.title.trim().length <= MAX_TITLE_LENGTH) {
    const normalized = normalizeTitleText(candidateTag.title);
    if (normalized && !findRelatedTitle(storage.getCharacterTitles(characterId), normalized)) {
      storage.createCharacterTitle({
        characterId,
        campaignId,
        titleText: candidateTag.title.trim(),
        normalizedTitle: normalized,
        selfDeclared: true,
      });
      result.candidateCreated = true;
    }
  }

  const witnessTag = extractTitleWitnessTag(rawResponse);
  if (witnessTag && witnessTag.title.trim().length > 0 && witnessTag.title.trim().length <= MAX_TITLE_LENGTH) {
    const normalized = normalizeTitleText(witnessTag.title);
    if (normalized) {
      const title = findOrCreateTitle(storage, characterId, campaignId, witnessTag.title, false);
      if (!title.established) {
        const { inserted, distinctWitnessCount } = storage.addTitleEvidence(title.id, witnessTag.npc);
        result.witnessRecorded = inserted;
        if (distinctWitnessCount >= INDEPENDENT_WITNESS_THRESHOLD) {
          storage.establishTitle(title.id);
          result.titleEstablished = { titleText: title.titleText };
        }
      }
    }
  }

  return result;
}
