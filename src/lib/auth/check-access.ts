import { db } from "@/lib/db";
import {
  documents,
  spaces,
  spacePermissions,
  documentPermissions,
  teamMembers,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canViewDocument, canEditDocument, canViewByClassification, canAdminSpace, hasGlobalRole } from "@/lib/auth/rbac";
import { users } from "@/lib/db/schema";
import type { SessionUser, PermissionLevel, ClassificationLevel } from "@/types";

// ─── Cache LRU pour getSpacePermission() ────────────────────────────────────
const PERM_CACHE_TTL = 5_000; // 5 secondes
const PERM_CACHE_MAX = 1000;

interface CacheEntry {
  value: PermissionLevel | null;
  expiresAt: number;
}

const permCache = new Map<string, CacheEntry>();

function getCachedPerm(key: string): PermissionLevel | null | undefined {
  const entry = permCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    permCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedPerm(key: string, value: PermissionLevel | null): void {
  // Éviction LRU simple : supprimer la plus ancienne entrée si max atteint
  if (permCache.size >= PERM_CACHE_MAX) {
    const firstKey = permCache.keys().next().value;
    if (firstKey) permCache.delete(firstKey);
  }
  permCache.set(key, { value, expiresAt: Date.now() + PERM_CACHE_TTL });
}

/** Invalider le cache de permissions pour un espace donné */
export function invalidateSpacePermCache(spaceId: string): void {
  for (const key of permCache.keys()) {
    if (key.endsWith(`:${spaceId}`)) permCache.delete(key);
  }
}

/**
 * Retrieve the user's permission level on a space.
 * Returns the permission level or null if no explicit permission.
 */
export async function getSpacePermission(
  userId: string,
  spaceId: string
): Promise<PermissionLevel | null> {
  const cacheKey = `${userId}:${spaceId}`;
  const cached = getCachedPerm(cacheKey);
  if (cached !== undefined) return cached;

  // Super admins have admin access to all spaces
  const [user] = await db
    .select({ globalRole: users.globalRole })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user && hasGlobalRole(user.globalRole, "admin")) {
    setCachedPerm(cacheKey, "admin");
    return "admin";
  }

  const [perm] = await db
    .select({ level: spacePermissions.level })
    .from(spacePermissions)
    .where(
      and(
        eq(spacePermissions.spaceId, spaceId),
        eq(spacePermissions.userId, userId)
      )
    )
    .limit(1);
  const result = (perm?.level as PermissionLevel) ?? null;

  // If user has a space permission, verify team membership for team-owned spaces
  if (result) {
    const [space] = await db
      .select({ ownerTeamId: spaces.ownerTeamId })
      .from(spaces)
      .where(eq(spaces.id, spaceId))
      .limit(1);

    if (space?.ownerTeamId) {
      const [member] = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, space.ownerTeamId),
            eq(teamMembers.userId, userId)
          )
        )
        .limit(1);

      if (!member) {
        setCachedPerm(cacheKey, null);
        return null;
      }
    }
  }

  setCachedPerm(cacheKey, result);
  return result;
}

/**
 * Retrieve the user's permission level on a document.
 * Returns the permission level or null if no explicit permission.
 */
export async function getDocumentPermission(
  userId: string,
  documentId: string
): Promise<PermissionLevel | null> {
  const [perm] = await db
    .select({ level: documentPermissions.level })
    .from(documentPermissions)
    .where(
      and(
        eq(documentPermissions.documentId, documentId),
        eq(documentPermissions.userId, userId)
      )
    )
    .limit(1);
  return (perm?.level as PermissionLevel) ?? null;
}

/**
 * Check if a user can view a specific document.
 * Also considers space ownership (owner always has access) and classification.
 */
export async function checkDocumentViewAccess(
  user: SessionUser,
  docSpaceId: string,
  docId: string
): Promise<boolean> {
  // Check space ownership
  const [space] = await db
    .select({ ownerUserId: spaces.ownerUserId })
    .from(spaces)
    .where(eq(spaces.id, docSpaceId))
    .limit(1);

  if (space?.ownerUserId === user.id) return true;

  const spacePerm = await getSpacePermission(user.id, docSpaceId);
  const docPerm = await getDocumentPermission(user.id, docId);

  // Vérification RBAC classique
  const canView = canViewDocument(user.globalRole, spacePerm, docPerm);
  if (!canView) return false;

  // Vérification classification
  const [doc] = await db
    .select({ classification: documents.classification, createdBy: documents.createdBy })
    .from(documents)
    .where(eq(documents.id, docId))
    .limit(1);

  if (!doc) return false;

  return canViewByClassification(doc.classification as ClassificationLevel, {
    isAuthenticated: true,
    isSpaceMember: !!spacePerm,
    isSpaceAdmin: spacePerm === "admin",
    isDocumentAuthor: doc.createdBy === user.id,
    userGlobalRole: user.globalRole,
  });
}

/**
 * Check if a user can edit a specific document.
 * Also considers space ownership (owner always has access).
 */
export async function checkDocumentEditAccess(
  user: SessionUser,
  docSpaceId: string,
  docId: string
): Promise<boolean> {
  // Check space ownership
  const [space] = await db
    .select({ ownerUserId: spaces.ownerUserId })
    .from(spaces)
    .where(eq(spaces.id, docSpaceId))
    .limit(1);

  if (space?.ownerUserId === user.id) return true;

  const spacePerm = await getSpacePermission(user.id, docSpaceId);
  const docPerm = await getDocumentPermission(user.id, docId);

  return canEditDocument(user.globalRole, spacePerm, docPerm);
}

/**
 * Get the list of space IDs the user has access to (at least viewer).
 * Includes spaces owned by the user + spaces with explicit permissions.
 */
export async function getAccessibleSpaceIds(
  user: SessionUser
): Promise<string[]> {
  // Admins have access to everything — return empty to signal "no filter"
  if (user.globalRole === "admin" || user.globalRole === "super_admin") {
    return [];
  }

  // Spaces owned by user
  const ownedSpaces = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.ownerUserId, user.id));

  // Spaces with explicit permission
  const permSpaces = await db
    .select({ spaceId: spacePermissions.spaceId })
    .from(spacePermissions)
    .where(eq(spacePermissions.userId, user.id));

  const ids = new Set<string>();
  for (const s of ownedSpaces) ids.add(s.id);
  for (const p of permSpaces) ids.add(p.spaceId);

  return Array.from(ids);
}

/**
 * Returns true if user is admin or super_admin (full access).
 */
export function isGlobalAdmin(user: SessionUser): boolean {
  return user.globalRole === "admin" || user.globalRole === "super_admin";
}

/**
 * Check if a user can view a space based on its classification.
 * Secret spaces are only visible to space admins, owners and global admins.
 */
export async function canViewSpace(
  user: SessionUser,
  spaceId: string,
  spaceClassification: ClassificationLevel,
  ownerUserId: string | null
): Promise<boolean> {
  if (isGlobalAdmin(user)) return true;
  if (ownerUserId === user.id) return true;

  if (spaceClassification === "secret") {
    const spacePerm = await getSpacePermission(user.id, spaceId);
    return canAdminSpace(user.globalRole, spacePerm);
  }

  return true;
}
