// server/titles.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { processTitleTags, normalizeTitleText, findRelatedTitle, type TitleRow } from "./titles";

function fakeStorage() {
  const titles: TitleRow[] = [];
  const evidence: Array<{ titleId: number; npcName: string }> = [];
  let nextId = 1;

  return {
    getCharacterTitles: (characterId: number) => titles.filter((t) => t.characterId === characterId),
    createCharacterTitle: (data: Omit<TitleRow, "id" | "established" | "establishedAt">) => {
      const row: TitleRow = { id: nextId++, established: false, establishedAt: null, ...data };
      titles.push(row);
      return row;
    },
    addTitleEvidence: (titleId: number, npcName: string) => {
      const normalized = npcName.trim().toLowerCase();
      const already = evidence.some((e) => e.titleId === titleId && e.npcName === normalized);
      if (!already) evidence.push({ titleId, npcName: normalized });
      const distinctWitnessCount = new Set(
        evidence.filter((e) => e.titleId === titleId).map((e) => e.npcName),
      ).size;
      return { inserted: !already, distinctWitnessCount };
    },
    establishTitle: (titleId: number) => {
      const t = titles.find((row) => row.id === titleId);
      if (t && !t.established) {
        t.established = true;
        t.establishedAt = "now";
      }
    },
    _titles: titles,
  };
}

test("normalizeTitleText: strips articles, punctuation, and case", () => {
  assert.equal(normalizeTitleText("The Shadow"), "shadow");
  assert.equal(normalizeTitleText("Shadow!"), "shadow");
  assert.equal(normalizeTitleText("  a Shadow  "), "shadow");
});

test("processTitleTags: a self-declared alias creates a candidate but never establishes", () => {
  const storage = fakeStorage();
  processTitleTags(
    'He introduces himself as Shadow. [TITLE_CANDIDATE]{"character":"Hennet","title":"Shadow"}[/TITLE_CANDIDATE]',
    1, 10, storage as any,
  );
  assert.equal(storage._titles.length, 1);
  assert.equal(storage._titles[0].selfDeclared, true);
  assert.equal(storage._titles[0].established, false);
});

test("processTitleTags: the same NPC repeating the name does not establish it", () => {
  const storage = fakeStorage();
  const tag = (npc: string) =>
    `"You're Shadow?" ${npc} asks. [TITLE_WITNESS]{"character":"Hennet","title":"Shadow","npc":"${npc}"}[/TITLE_WITNESS]`;
  processTitleTags(tag("Thrain"), 1, 10, storage as any);
  processTitleTags(tag("Thrain"), 1, 10, storage as any);
  processTitleTags(tag("Thrain"), 1, 10, storage as any);
  assert.equal(storage._titles.length, 1);
  assert.equal(storage._titles[0].established, false); // one witness, repeated, is still one witness
});

test("processTitleTags: two independent NPCs establish the title", () => {
  const storage = fakeStorage();
  const tag = (npc: string) =>
    `[TITLE_WITNESS]{"character":"Hennet","title":"Shadow","npc":"${npc}"}[/TITLE_WITNESS]`;
  const r1 = processTitleTags(tag("Thrain"), 1, 10, storage as any);
  assert.equal(r1.titleEstablished, null);
  const r2 = processTitleTags(tag("Mara"), 1, 10, storage as any);
  assert.ok(r2.titleEstablished);
  assert.equal(storage._titles[0].established, true);
});

test("processTitleTags: trivial variants of the same identity accumulate under one title", () => {
  const storage = fakeStorage();
  processTitleTags('[TITLE_CANDIDATE]{"character":"Hennet","title":"Shadow"}[/TITLE_CANDIDATE]', 1, 10, storage as any);
  processTitleTags(
    '[TITLE_WITNESS]{"character":"Hennet","title":"The Shadow","npc":"Thrain"}[/TITLE_WITNESS]',
    1, 10, storage as any,
  );
  processTitleTags(
    '[TITLE_WITNESS]{"character":"Hennet","title":"Dark Shadow","npc":"Mara"}[/TITLE_WITNESS]',
    1, 10, storage as any,
  );
  // "Shadow" / "The Shadow" / "Dark Shadow" all group to one title, not three
  assert.equal(storage._titles.length, 1);
  assert.equal(storage._titles[0].established, true);
});

test("processTitleTags: once established, further witness tags are no-ops (counts exactly once)", () => {
  const storage = fakeStorage();
  const tag = (npc: string) =>
    `[TITLE_WITNESS]{"character":"Hennet","title":"Shadow","npc":"${npc}"}[/TITLE_WITNESS]`;
  processTitleTags(tag("Thrain"), 1, 10, storage as any);
  processTitleTags(tag("Mara"), 1, 10, storage as any);
  assert.equal(storage._titles[0].established, true);
  const establishedAtFirst = storage._titles[0].establishedAt;

  const r3 = processTitleTags(tag("Corvin"), 1, 10, storage as any);
  assert.equal(r3.titleEstablished, null); // no re-establishment event
  assert.equal(storage._titles.length, 1); // still exactly one title row
  assert.equal(storage._titles[0].establishedAt, establishedAtFirst);
});

test("processTitleTags: malformed or absent tags are a complete no-op", () => {
  const storage = fakeStorage();
  const result = processTitleTags("Just ordinary narration, nothing mechanical here.", 1, 10, storage as any);
  assert.equal(storage._titles.length, 0);
  assert.equal(result.candidateCreated, false);
  assert.equal(result.witnessRecorded, false);
  assert.equal(result.titleEstablished, null);
});

test("processTitleTags: an absurdly long title is rejected rather than persisted", () => {
  const storage = fakeStorage();
  const longTitle = "a".repeat(200);
  processTitleTags(
    `[TITLE_CANDIDATE]{"character":"Hennet","title":"${longTitle}"}[/TITLE_CANDIDATE]`,
    1, 10, storage as any,
  );
  assert.equal(storage._titles.length, 0);
});

test("findRelatedTitle: matches by containment in either direction", () => {
  const titles: TitleRow[] = [
    { id: 1, characterId: 1, campaignId: 10, titleText: "Shadow", normalizedTitle: "shadow", selfDeclared: true, established: false, establishedAt: null },
  ];
  assert.equal(findRelatedTitle(titles, "dark shadow")?.id, 1);
  assert.equal(findRelatedTitle(titles, "shadow of shadows")?.id, 1);
  assert.equal(findRelatedTitle(titles, "nightblade"), undefined);
});

test("processTitleTags: different characters never share title rows", () => {
  const storage = fakeStorage();
  processTitleTags('[TITLE_CANDIDATE]{"character":"Hennet","title":"Shadow"}[/TITLE_CANDIDATE]', 1, 10, storage as any);
  processTitleTags('[TITLE_CANDIDATE]{"character":"Mara","title":"Shadow"}[/TITLE_CANDIDATE]', 2, 10, storage as any);
  assert.equal(storage.getCharacterTitles(1).length, 1);
  assert.equal(storage.getCharacterTitles(2).length, 1);
});
