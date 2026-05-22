import type { PermissionLevel, UserRole, ClassificationLevel } from "@/types";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  editor: 2,
  facility_manager: 2, // rôle parallèle à editor : pas d'accès admin général
  viewer: 1,
};

const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function hasGlobalRole(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Salles de réunion : admin/super_admin OU rôle dédié facility_manager.
 * Volontairement parallèle à `hasGlobalRole("admin")` pour éviter
 * de donner les droits admin globaux au facility_manager.
 */
export function canManageMeetingRooms(userRole: UserRole): boolean {
  return (
    userRole === "super_admin" ||
    userRole === "admin" ||
    userRole === "facility_manager"
  );
}

export function hasPermissionLevel(
  userLevel: PermissionLevel,
  requiredLevel: PermissionLevel
): boolean {
  return PERMISSION_HIERARCHY[userLevel] >= PERMISSION_HIERARCHY[requiredLevel];
}

export function canEditDocument(
  userGlobalRole: UserRole,
  spacePermission?: PermissionLevel | null,
  documentPermission?: PermissionLevel | null
): boolean {
  // Super admin et admin globaux ont toujours acces
  if (hasGlobalRole(userGlobalRole, "admin")) return true;

  // Permission document > permission espace > role global
  if (documentPermission) {
    return hasPermissionLevel(documentPermission, "editor");
  }

  if (spacePermission) {
    return hasPermissionLevel(spacePermission, "editor");
  }

  return userGlobalRole === "editor";
}

export function canViewDocument(
  userGlobalRole: UserRole,
  spacePermission?: PermissionLevel | null,
  documentPermission?: PermissionLevel | null
): boolean {
  if (hasGlobalRole(userGlobalRole, "admin")) return true;

  if (documentPermission) {
    return hasPermissionLevel(documentPermission, "viewer");
  }

  if (spacePermission) {
    return hasPermissionLevel(spacePermission, "viewer");
  }

  return false;
}

export function canAdminSpace(
  userGlobalRole: UserRole,
  spacePermission?: PermissionLevel | null
): boolean {
  if (hasGlobalRole(userGlobalRole, "admin")) return true;
  if (spacePermission) return spacePermission === "admin";
  return false;
}

/**
 * Vérifie si un utilisateur peut voir un document en fonction de sa classification.
 *
 * | Classification | Qui peut voir |
 * |---|---|
 * | public | Tout le monde (y compris via lien externe) |
 * | internal | Tout utilisateur authentifié de l'organisation |
 * | confidential | Membres de l'espace avec permission explicite |
 * | secret | Auteur + admins de l'espace uniquement |
 */
export function canViewByClassification(
  classification: ClassificationLevel,
  options: {
    isAuthenticated: boolean;
    isSpaceMember: boolean;
    isSpaceAdmin: boolean;
    isDocumentAuthor: boolean;
    userGlobalRole: UserRole;
  }
): boolean {
  const { isAuthenticated, isSpaceMember, isSpaceAdmin, isDocumentAuthor, userGlobalRole } = options;

  // Les admins globaux ont toujours accès
  if (hasGlobalRole(userGlobalRole, "admin")) return true;

  switch (classification) {
    case "public":
      return true; // accessible à tous (même non authentifiés via lien public)

    case "internal":
      return isAuthenticated;

    case "confidential":
      return isSpaceMember;

    case "secret":
      return isDocumentAuthor || isSpaceAdmin;

    default:
      return false;
  }
}
