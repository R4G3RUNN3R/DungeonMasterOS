import type { NextFunction, Request, Response } from "express";
import type { User } from "../shared/schema";
import { hasDungeonMasterAccess } from "./access-policy";

export const PERMISSIONS = {
  ADMIN_ACCESS: "admin.access",
  ADMIN_USERS_MANAGE: "admin.users.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Compatibility permission projection.
 *
 * This deliberately preserves V1 effective access while routes migrate away
 * from role-name checks. The mapping can be changed independently once durable
 * admin/DM roles are introduced.
 */
export function resolvePermissions(
  user?: Pick<User, "role" | "isAdmin"> | null,
): ReadonlySet<Permission> {
  const permissions = new Set<Permission>();

  if (hasDungeonMasterAccess(user)) {
    permissions.add(PERMISSIONS.ADMIN_ACCESS);
    permissions.add(PERMISSIONS.ADMIN_USERS_MANAGE);
  }

  return permissions;
}

export function hasPermission(
  user: Pick<User, "role" | "isAdmin"> | null | undefined,
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
      return res.status(403).json({
        message: "DungeonMaster access is required for that action.",
        code: "DUNGEON_MASTER_REQUIRED",
      });
    }

    next();
  };
}
