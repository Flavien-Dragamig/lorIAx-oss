import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, spaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { getSpacePermission } from "@/lib/auth/check-access";
import { readDocument, writeDocument } from "@/lib/storage/filesystem";
import { commitFile } from "@/lib/git/repository";
import slugify from "slugify";
import { logActivity } from "@/lib/activity";
import { z } from "zod";

const copySchema = z.object({
  targetSpaceSlug: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = copySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Récupérer le document source
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  // Vérifier la permission de lecture sur l'espace source
  const sourcePerm = await getSpacePermission(user.id, doc.spaceId);
  if (!sourcePerm) {
    return NextResponse.json({ error: "Accès refusé (espace source)" }, { status: 403 });
  }

  // Récupérer l'espace source pour lire le contenu
  const [sourceSpace] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, doc.spaceId))
    .limit(1);
  if (!sourceSpace) return NextResponse.json({ error: "Espace source introuvable" }, { status: 404 });

  // Récupérer l'espace cible
  const [targetSpace] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.slug, parsed.data.targetSpaceSlug))
    .limit(1);
  if (!targetSpace) return NextResponse.json({ error: "Espace cible introuvable" }, { status: 404 });

  // Vérifier la permission d'écriture sur l'espace cible
  const targetPerm = await getSpacePermission(user.id, targetSpace.id);
  if (!targetPerm || targetPerm === "viewer") {
    return NextResponse.json({ error: "Accès refusé (espace cible)" }, { status: 403 });
  }

  // Lire le contenu du document source
  let content = doc.contentText || "";
  if (!doc.isFolder) {
    try {
      content = await readDocument(sourceSpace.gitRepoPath, doc.filePath);
    } catch {
      content = doc.contentText || "";
    }
  }

  // Générer un titre, slug et filePath uniques pour la copie
  const copyTitle = `${doc.title} (copie)`;
  const baseSlug = slugify(copyTitle, { lower: true, strict: true });
  const timestamp = Date.now();
  const copySlug = `${baseSlug}-${timestamp}`;
  const filePath = doc.isFolder ? `${copySlug}/` : `${copySlug}.md`;

  // Écrire le fichier sur le filesystem de l'espace cible
  if (!doc.isFolder) {
    await writeDocument(targetSpace.gitRepoPath, filePath, content);
    await commitFile(
      targetSpace.gitRepoPath,
      filePath,
      `Copie : ${copyTitle}`,
      user.name,
      user.email
    );
  }

  // Insérer la copie en base de données
  const [copyDoc] = await db
    .insert(documents)
    .values({
      spaceId: targetSpace.id,
      parentId: null,
      title: copyTitle,
      slug: copySlug,
      filePath,
      visibility: doc.visibility,
      classification: doc.classification,
      isFolder: doc.isFolder,
      createdBy: user.id,
      contentText: doc.isFolder ? null : (content || null),
    })
    .returning();

  logActivity({
    userId: user.id,
    action: "copy",
    entityType: "document",
    entityId: copyDoc.id,
    metadata: {
      sourceDocumentId: id,
      sourceTitle: doc.title,
      targetSpaceSlug: targetSpace.slug,
    },
  });

  return NextResponse.json({
    ok: true,
    documentId: copyDoc.id,
    spaceSlug: targetSpace.slug,
  });
}
