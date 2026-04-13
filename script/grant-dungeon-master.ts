import "dotenv/config";

import { grantDungeonMasterAccess } from "../server/auth";
import { runMigrations, storage } from "../server/storage";

function usage(): never {
  console.error("Usage: npx tsx script/grant-dungeon-master.ts <email-or-username>");
  process.exit(1);
}

const identifier = process.argv[2]?.trim();
if (!identifier) usage();

runMigrations();

const user =
  identifier.includes("@")
    ? storage.getUserByEmail(identifier)
    : storage.getUserByUsername(identifier);

if (!user) {
  console.error(`No user found for "${identifier}".`);
  process.exit(1);
}

const updated = grantDungeonMasterAccess(user.id);
if (!updated) {
  console.error("Failed to grant DungeonMaster access.");
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      id: updated.id,
      email: updated.email,
      username: updated.username,
      role: updated.role,
      isAdmin: updated.isAdmin,
      unlimitedTurns: updated.unlimitedTurns,
      tier: updated.tier,
    },
    null,
    2,
  ),
);
