import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { users, spacePermissions, documents } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { canViewByClassification } from "@/lib/auth/rbac";
import type { ClassificationLevel } from "@/lib/auth/classification";
import logger from "@/lib/logger";

interface WsUser {
  id: string;
  email: string;
  name: string;
  globalRole: string;
  avatarUrl: string | null;
}

/**
 * Verify a JWT token from WebSocket connection and return user info.
 */
export async function verifyWsToken(token: string): Promise<WsUser | null> {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      logger.error("NEXTAUTH_SECRET not set");
      return null;
    }

    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);

    const userId = payload.id as string | undefined;
    if (!userId) return null;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        globalRole: users.globalRole,
        avatarUrl: users.avatarUrl,
        tokenInvalidatedAt: users.tokenInvalidatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    // Vérifier si le token a été émis avant une invalidation (changement mdp/rôle)
    if (user.tokenInvalidatedAt && payload.iat) {
      const tokenIssuedAt = payload.iat * 1000; // JWT iat en secondes → ms
      if (tokenIssuedAt < user.tokenInvalidatedAt.getTime()) {
        logger.warn({ userId }, "WebSocket token invalidated (issued before credential change)");
        return null;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      avatarUrl: user.avatarUrl,
    };
  } catch (err) {
    logger.error({ err }, "JWT verification failed (WebSocket)");
    return null;
  }
}

/**
 * Check if a user has at least viewer access to a document's space.
 */
export async function checkDocumentAccess(
  userId: string,
  documentId: string,
  globalRole: string
): Promise<boolean> {
  // Admins have access to everything
  if (globalRole === "super_admin" || globalRole === "admin") {
    logger.info({ userId, globalRole }, "[auth-ws] Admin bypass — access granted");
    return true;
  }

  // Get the document + space info (including classification)
  const [doc] = await db
    .select({
      spaceId: documents.spaceId,
      createdBy: documents.createdBy,
      classification: documents.classification,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    logger.warn({ userId, documentId }, "[auth-ws] Document not found");
    return false;
  }

  logger.info({ userId, documentId, spaceId: doc.spaceId, createdBy: doc.createdBy, classification: doc.classification }, "[auth-ws] Document found, checking permissions...");

  // Check space permissions
  const [perm] = await db
    .select({ level: spacePermissions.level })
    .from(spacePermissions)
    .where(
      and(
        eq(spacePermissions.spaceId, doc.spaceId),
        or(eq(spacePermissions.userId, userId))
      )
    )
    .limit(1);

  const isSpaceMember = !!perm;
  const isSpaceAdmin = perm?.level === "admin";
  const isDocumentAuthor = doc.createdBy === userId;

  // Classification check — blocks access to secret docs for non-privileged users
  if (doc.classification) {
    const canView = canViewByClassification(
      doc.classification as ClassificationLevel,
      {
        isAuthenticated: true,
        isSpaceMember,
        isSpaceAdmin,
        isDocumentAuthor,
        userGlobalRole: globalRole as "viewer" | "editor" | "admin" | "super_admin",
      }
    );
    if (!canView) return false;
  }

  // Document creator always has access
  if (isDocumentAuthor) return true;

  return isSpaceMember;
}

/**
 * Check if a user has edit access to a document (for write operations).
 * Re-reads globalRole from the DB to detect role changes since WS connection.
 * Requires at least "editor" level on the space (not just viewer/member).
 */
export async function checkDocumentEditAccess(
  userId: string,
  documentId: string
): Promise<boolean> {
  // Fetch current globalRole from DB (may have changed since WS connection)
  const [user] = await db
    .select({ globalRole: users.globalRole })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return false;

  // Admins can always edit
  if (user.globalRole === "super_admin" || user.globalRole === "admin") {
    return true;
  }

  // Get the document info
  const [doc] = await db
    .select({
      spaceId: documents.spaceId,
      createdBy: documents.createdBy,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) return false;

  // Document author always has edit access
  if (doc.createdBy === userId) return true;

  // Check space permission — require at least "editor" level
  const [perm] = await db
    .select({ level: spacePermissions.level })
    .from(spacePermissions)
    .where(
      and(
        eq(spacePermissions.spaceId, doc.spaceId),
        eq(spacePermissions.userId, userId)
      )
    )
    .limit(1);

  if (!perm) return false;

  // "admin" and "editor" can edit, "viewer" cannot
  return perm.level === "admin" || perm.level === "editor";
}
