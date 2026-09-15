import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import path from "path";

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const sourcePath = path.resolve(
    readArg("--source") || process.env.DATABASE_URL || path.resolve(process.cwd(), "data.db"),
  );
  const outputArg = readArg("--output");
  if (!outputArg) fail("Usage: backup-database.mjs --output <backup.db> [--source <source.db>]");
  const outputPath = path.resolve(outputArg);

  if (!existsSync(sourcePath)) fail(`Source database does not exist: ${sourcePath}`);
  if (sourcePath === outputPath) fail("Backup output must not be the source database.");
  if (existsSync(outputPath)) fail(`Backup output already exists: ${outputPath}`);

  mkdirSync(path.dirname(outputPath), { recursive: true });

  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    const sourceCheck = source.pragma("quick_check", { simple: true });
    if (sourceCheck !== "ok") fail(`Source database failed PRAGMA quick_check: ${String(sourceCheck)}`);
    await source.backup(outputPath);
  } finally {
    source.close();
  }

  const backup = new Database(outputPath, { readonly: true, fileMustExist: true });
  try {
    const backupCheck = backup.pragma("quick_check", { simple: true });
    if (backupCheck !== "ok") fail(`Backup failed PRAGMA quick_check: ${String(backupCheck)}`);
  } finally {
    backup.close();
  }

  console.log(JSON.stringify({ ok: true, source: sourcePath, backup: outputPath }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
