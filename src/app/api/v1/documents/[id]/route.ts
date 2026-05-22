import { db } from "@/lib/db";
import { documents, spaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { authenticateApiRequest, requireScope } from "@/lib/api/auth-api";
import { apiSuccess, apiError } from "@/lib/api/response";
import {
  checkDocumentViewAccess,
  checkDocumentEditAccess,
} from "@/lib/auth/check-access";
import { logActivity } from "@/lib/activity";
import { writeDocument } from "@/lib/storage/filesystem";
import { commitFile } from "@/lib/git/repository";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  visibility: z.enum(["private", "team", "public"]).optional(),
  classification: z.enum(["public", "internal", "confidential", "secret"]).optional(),
  icon: z.string().max(50).nullable().optional(),
});

/**
 * GET /api/v1/documents/:id — Get a document with content.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const scopeErr = requireScope(auth.user, "documents:read");
  if (scopeErr) return scopeErr;

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) {
    return apiError("Document introuvable", 404);
  }

  const canView = await checkDocumentViewAccess(
    auth.user,
    doc.spaceId,
    doc.id
  );
  if (!canView) {
    return apiError("Accès refusé", 403);
  }

  return apiSuccess({
    id: doc.id,
    spaceId: doc.spaceId,
    parentId: doc.parentId,
    title: doc.title,
    slug: doc.slug,
    icon: doc.icon,
    isFolder: doc.isFolder,
    visibility: doc.visibility,
    classification: doc.classification,
    content: doc.contentText,
    position: doc.position,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

/**
 * PATCH /api/v1/documents/:id — Update a document.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const scopeErr = requireScope(auth.user, "documents:write");
  if (scopeErr) return scopeErr;

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Données invalides", 400);
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) {
    return apiError("Document introuvable", 404);
  }

  const canEdit = await checkDocumentEditAccess(
    auth.user,
    doc.spaceId,
    doc.id
  );
  if (!canEdit) {
    return apiError("Accès refusé", 403);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.visibility !== undefined) updateData.visibility = parsed.data.visibility;
  if (parsed.data.classification !== undefined) updateData.classification = parsed.data.classification;
  if (parsed.data.icon !== undefined) updateData.icon = parsed.data.icon;
  if (parsed.data.content !== undefined) {
    updateData.contentText = parsed.data.content;

    // Write to filesystem + git
    const [space] = await db
      .select({ gitRepoPath: spaces.gitRepoPath })
      .from(spaces)
      .where(eq(spaces.id, doc.spaceId))
      .limit(1);

    if (space) {
      await writeDocument(space.gitRepoPath, doc.filePath, parsed.data.content);
      await commitFile(
        space.gitRepoPath,
        doc.filePath,
        `Mise à jour : ${doc.title}`,
        auth.user.name,
        auth.user.email
      );
    }
  }

  const [updated] = await db
    .update(documents)
    .set(updateData)
    .where(eq(documents.id, id))
    .returning();

  logActivity({
    userId: auth.user.id,
    action: "update",
    entityType: "document",
    entityId: id,
    metadata: { title: updated.title, source: "api" },
  });

  dispatchWebhookEvent("document.updated", {
    documentId: id,
    spaceId: doc.spaceId,
    title: updated.title,
  }, auth.user.id);

  return apiSuccess(updated);
}

/**
 * DELETE /api/v1/documents/:id — Delete a document.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const scopeErr = requireScope(auth.user, "documents:write");
  if (scopeErr) return scopeErr;

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) {
    return apiError("Document introuvable", 404);
  }

  const canEdit = await checkDocumentEditAccess(
    auth.user,
    doc.spaceId,
    doc.id
  );
  if (!canEdit) {
    return apiError("Accès refusé", 403);
  }

  await db.delete(documents).where(eq(documents.id, id));

  logActivity({
    userId: auth.user.id,
    action: "delete",
    entityType: "document",
    entityId: id,
    metadata: { title: doc.title, source: "api" },
  });

  dispatchWebhookEvent("document.deleted", {
    documentId: id,
    spaceId: doc.spaceId,
    title: doc.title,
  }, auth.user.id);

  return apiSuccess({ deleted: true });
}
