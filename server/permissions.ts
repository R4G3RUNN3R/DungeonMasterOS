import type { NextFunction, Request, Response } from "express";
import type { User } from "../shared/schema";
import { hasDungeonMasterAccess } from "./access-policy";

export const PERMISSIONS = {
  DUNGEON_MASTER_ACCESS: "dungeon_master.access",
  MODERATION_ACCESS: "moderation.access",
  ADMIN_ACCESS: "admin.access",
  ADMIN_USERS_MANAGE: "admin.users.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

type PermissionPrincipal =
  Pick<User, "role" | "isAdmin"> &
  Partial<Pick<User, "accessRole">>;

function addAdminPermissions(permissions: Set<Permission>): void {
  permissions.add(PERMISSIONS.DUNGEON_MASTER_ACCESS);
  permissions.add(PERMISSIONS.MODERATION_ACCESS);
  permissions.add(PERMISSIONS.ADMIN_ACCESS);
  permissions.add(PERMISSIONS.ADMIN_USERS_MANAGE);
}

export function resolvePermissions(
  user?: PermissionPrincipal | null,
): ReadonlySet<Permission> {
  const permissions = new Set<Permission>();

  if (user?.accessRole != null) {
    switch (user.accessRole) {
      case "admin":
        addAdminPermissions(permissions);
        break;
      case "moderator":
        permissions.add(PERMISSIONS.MODERATION_ACCESS);
        break;
      case "dungeon_master":
        permissions.add(PERMISSIONS.DUNGEON_MASTER_ACCESS);
        break;
      case "player":
        break;
    }
    return permissions;
  }

  // Compatibility fallback for principals created before access_role existed.
  // Legacy DungeonMaster/admin flags historically carried full admin authority.
  if (hasDungeonMasterAccess(user)) {
    addAdminPermissions(permissions);
  }

  return permissions;
}

export function hasPermission(
  user: PermissionPrincipal | null | undefined,
  permission: Permission,
): boolean {
  return resolvePermissions(user).has(permission);
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Sign in to continue.",
        code: "UNAUTHENTICATED",
      });
    }

    if (!hasPermission(req.user, permission)) {
      if (permission === PERMISSIONS.DUNGEON_MASTER_ACCESS) {
        return res.status(403).json({
          message: "DungeonMaster access is required for that action.",
          code: "DUNGEON_MASTER_REQUIRED",
        });
      }

      return res.status(403).json({
        message: "You do not have permission to perform that action.",
        code: "FORBIDDEN",
      });
    }

    next();
  };
}
