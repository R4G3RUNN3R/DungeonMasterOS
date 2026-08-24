import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["server", path.join("shared", "rules-registry")];

function collectTestFiles(root: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".test.ts")) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files;
}

const testFiles = roots.flatMap(collectTestFiles).sort();
if (testFiles.length === 0) {
  console.error("No test files discovered.");
  process.exit(1);
}

console.log(`Discovered ${testFiles.length} test files.`);

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...testFiles],
  { stdio: "inherit", shell: false },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
