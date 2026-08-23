// server/dnd35e/no-5e-contamination.test.ts
//
// Lexical, not semantic: fails if any 5e-specific term ever appears in the
// dnd35e-specific source tree. Scoped to Phase 2B-1's real files today —
// extend this list and its glob as later entity families land.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_5E_TERMS = [
  "proficiencyBonus", "advantage", "disadvantage", "deathSave",
  "weaponMastery", "heroicInspiration",
];

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full.endsWith(".ts") && !full.endsWith(".test.ts") ? [full] : [];
  });
}

// Accepts either a directory (walked recursively for .ts files) or a single
// file path. server/storage.ts is scanned as a single file: it's a shared,
// edition-neutral module, not a dnd35e-specific directory, but Task 4 added
// ~130 lines of real dnd35e-specific code directly into it (the
// dnd35e_feat_definitions table DDL, IStorage methods, DatabaseStorage impl)
// — exactly where a parallel 5e implementation effort is most likely to add
// 5e-specific vocabulary right next to this 3.5e code.
function scanRoot(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return root.endsWith(".ts") && !root.endsWith(".test.ts") ? [root] : [];
  return walk(root);
}

test("no 5e-specific terms appear anywhere in the dnd35e-specific source tree", () => {
  const roots = [
    path.join(__dirname), // server/dnd35e/
    path.join(__dirname, "..", "..", "shared", "rules-registry", "dnd35e"),
    path.join(__dirname, "..", "storage.ts"), // server/storage.ts — shared, edition-neutral, but carries real dnd35e code
  ];
  const files = roots.flatMap((root) => scanRoot(root));
  assert.ok(files.length > 0, "sanity check: this test must actually find real files to scan");
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    for (const term of FORBIDDEN_5E_TERMS) {
      assert.ok(!content.includes(term), `${file} contains forbidden 5e term "${term}" — dnd35e code must never reference 5e-specific concepts`);
    }
  }
});
