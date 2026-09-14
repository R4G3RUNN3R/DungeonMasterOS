import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "fs";
import path from "path";

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const backupArg = readArg("--backup");
  const targetArg = readArg("--target");
  if (!backupArg || !targetArg) {
    fail("Usage: restore-database.ts --backup <backup.db> --target <new-target.db>");
  }

  const backupPath = path.resolve(backupArg);
  const targetPath = path.resolve(targetArg);
  if (!existsSync(backupPath)) fail(`Backup database does not exist: ${backupPath}`);
  if (backupPath === targetPath) fail("Restore target must not be the backup file.");
  if (existsSync(targetPath)) {
    fail(`Restore target already exists. Refusing to overwrite: ${targetPath}`);
  }

  const backup = new Database(backupPath, { readonly: true, fileMustExist: true });
  try {
    const sourceCheck = backup.pragma("quick_check", { simple: true });
    if (sourceCheck !== "ok") fail(`Backup failed PRAGMA quick_check: ${String(sourceCheck)}`);

    mkdirSync(path.dirname(targetPath), { recursive: true });
    await backup.backup(targetPath);
  } finally {
    backup.close();
  }

  try {
    const restored = new Database(targetPath, { readonly: true, fileMustExist: true });
    try {
      const restoredCheck = restored.pragma("quick_check", { simple: true });
      if (restoredCheck !== "ok") {
        throw new Error(`Restored database failed PRAGMA quick_check: ${String(restoredCheck)}`);
      }
    } finally {
      restored.close();
    }
  } catch (error) {
    rmSync(targetPath, { force: true });
    throw error;
  }

  console.log(JSON.stringify({ ok: true, backup: backupPath, restored: targetPath }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
