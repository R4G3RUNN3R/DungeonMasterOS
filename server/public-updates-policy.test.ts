import test from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_UPDATES } from "@shared/public-updates";

test("public release updates have stable unique IDs and valid public content", () => {
  assert.ok(PUBLIC_UPDATES.length > 0, "at least one bundled public update is required");

  const ids = new Set<string>();
  const dateTitles = new Set<string>();
  for (const entry of PUBLIC_UPDATES) {
    assert.match(entry.id, /^[a-z0-9][a-z0-9-]*$/);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.title.trim().length > 0);
    assert.ok(entry.description.trim().length > 0);
    assert.equal(ids.has(entry.id), false, `duplicate public update id: ${entry.id}`);
    ids.add(entry.id);

    const dateTitle = `${entry.date}\u0000${entry.title}`;
    assert.equal(dateTitles.has(dateTitle), false, `duplicate public update date/title: ${entry.date} / ${entry.title}`);
    dateTitles.add(dateTitle);
  }
});

test("bundled public release updates stay newest-first", () => {
  for (let index = 1; index < PUBLIC_UPDATES.length; index += 1) {
    assert.ok(
      PUBLIC_UPDATES[index - 1].date >= PUBLIC_UPDATES[index].date,
      "PUBLIC_UPDATES must remain newest-first so release review is deterministic",
    );
  }
});
