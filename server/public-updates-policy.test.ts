import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

test("the newest dated CHANGELOG section has a matching bundled public update", () => {
  const changelog = fs.readFileSync(path.resolve(process.cwd(), "CHANGELOG.md"), "utf8");
  const match = changelog.match(/^## (\d{4}-\d{2}-\d{2})(?:\s|$)/m);
  assert.ok(match, "CHANGELOG.md must contain a dated release section");

  const newestChangelogDate = match[1];
  assert.ok(
    PUBLIC_UPDATES.some((entry) => entry.date === newestChangelogDate),
    `CHANGELOG ${newestChangelogDate} has no bundled public Updates-page entry; production release notes are mandatory`,
  );
});
