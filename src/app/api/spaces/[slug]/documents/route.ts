import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  documents,
  spaces,
  templates,
  documentLabels,
  labels,
  documentCollabStates,
  userDatabases,
  userDatabaseColumns,
} from "@/lib/db/schema";
import { eq, isNull, and, asc, desc, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { writeDocument } from "@/lib/storage/filesystem";
import { commitFile } from "@/lib/git/repository";
import slugify from "slugify";
import { logActivity } from "@/lib/activity";
import { getSpacePermission } from "@/lib/auth/check-access";
import { z } from "zod";
import { getBuiltinTemplateById } from "@/lib/templates/builtin";
import { templateContentToYjsState } from "@/lib/editor/template-to-yjs";
import { randomUUID } from "crypto";
import type { ClassificationLevel } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const { slug } = await params;

  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.slug, slug))
    .limit(1);

  if (!space) return NextResponse.json([], { status: 404 });

  // Recuperer les documents racine (sans parent)
  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      slug: documents.slug,
      isFolder: documents.isFolder,
      icon: documents.icon,
      parentId: documents.parentId,
      position: documents.position,
    })
    .from(documents)
    .where(and(eq(documents.spaceId, space.id), isNull(documents.parentId)))
    .orderBy(desc(documents.isFolder), asc(documents.position), asc(documents.title));

  // PERF-01 — Charger TOUS les enfants en une seule requête (fix N+1)
  const folderIds = docs.filter((d) => d.isFolder).map((d) => d.id);

  const childrenByParent = new Map<string, typeof docs>();

  if (folderIds.length > 0) {
    const allChildren = await db
      .select({
        id: documents.id,
        title: documents.title,
        slug: documents.slug,
        isFolder: documents.isFolder,
        icon: documents.icon,
        parentId: documents.parentId,
        position: documents.position,
      })
      .from(documents)
      .where(inArray(documents.parentId, folderIds))
      .orderBy(desc(documents.isFolder), asc(documents.position), asc(documents.title));

    for (const child of allChildren) {
      if (!child.parentId) continue;
      const siblings = childrenByParent.get(child.parentId) || [];
      siblings.push(child);
      childrenByParent.set(child.parentId, siblings);
    }
  }

  // Récupérer les labels de tous les documents (racine + enfants)
  const allDocIds = [
    ...docs.map((d) => d.id),
    ...Array.from(childrenByParent.values()).flatMap((children) => children.map((c) => c.id)),
  ];

  const labelsByDoc = new Map<string, { id: string; name: string; color: string }[]>();

  if (allDocIds.length > 0) {
    const labelsRows = await db
      .select({
        documentId: documentLabels.documentId,
        id: labels.id,
        name: labels.name,
        color: labels.color,
      })
      .from(documentLabels)
      .innerJoin(labels, eq(documentLabels.labelId, labels.id))
      .where(inArray(documentLabels.documentId, allDocIds));

    for (const row of labelsRows) {
      const arr = labelsByDoc.get(row.documentId) ?? [];
      arr.push({ id: row.id, name: row.name, color: row.color });
      labelsByDoc.set(row.documentId, arr);
    }
  }

  const result = docs.map((doc) => {
    if (doc.isFolder) {
      const children = (childrenByParent.get(doc.id) || []).map((child) => ({
        ...child,
        labels: labelsByDoc.get(child.id) ?? [],
      }));
      return { ...doc, children, labels: labelsByDoc.get(doc.id) ?? [] };
    }
    return { ...doc, labels: labelsByDoc.get(doc.id) ?? [] };
  });

  return NextResponse.json(result);
}

const createDocSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  isFolder: z.boolean().optional(),
  templateId: z.string().nullable().optional(),
  visibility: z.enum(["private", "team", "public"]).nullable().optional(),
  classification: z.enum(["public", "internal", "confidential", "secret"]).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;

  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.slug, slug))
    .limit(1);

  if (!space) return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });

  const perm = await getSpacePermission(user.id, space.id);
  if (!perm || perm === "viewer") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createDocSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { title, parentId, isFolder = false, templateId, visibility, classification } = parsed.data;
  let { content = "" } = parsed.data;

  // Résoudre le contenu complet du template
  type TemplateContentData = { markdown?: string; database?: { name: string; columns: Array<{ name: string; type: string; config?: Record<string, unknown> }> } };
  let templateContent: TemplateContentData | null = null;

  if (templateId && !content) {
    if (templateId.startsWith("builtin_")) {
      const builtin = getBuiltinTemplateById(templateId);
      if (builtin?.content) {
        templateContent = builtin.content as TemplateContentData;
        content = templateContent.markdown || "";
      }
    } else {
      const [tmpl] = await db
        .select()
        .from(templates)
        .where(eq(templates.id, templateId))
        .limit(1);

      if (tmpl?.content) {
        templateContent = tmpl.content as TemplateContentData;
        content = templateContent.markdown || "";
      }
    }
  }

  const docSlug = slugify(title, { lower: true, strict: true });
  const filePath = isFolder ? `${docSlug}/` : `${docSlug}.md`;

  // Écrire le fichier sur le filesystem
  if (!isFolder) {
    await writeDocument(space.gitRepoPath, filePath, content);
    await commitFile(
      space.gitRepoPath,
      filePath,
      `Creation : ${title}`,
      user.name,
      user.email
    );
  }

  // Inserer en BDD
  const [doc] = await db
    .insert(documents)
    .values({
      spaceId: space.id,
      parentId,
      title,
      slug: docSlug,
      filePath,
      visibility: visibility || (space.type === "personal" ? "private" : "team"),
      classification: (classification || space.classification || "internal") as ClassificationLevel,
      isFolder,
      templateId: templateId?.startsWith("builtin_") ? null : templateId,
      createdBy: user.id,
      contentText: content || null,
    })
    .returning();

  // Initialiser le Yjs doc depuis le template (markdown + optionnel: bloc base de données)
  if (!isFolder && templateContent) {
    let databaseId: string | undefined;

    // Créer la userDatabase si le template en contient une
    if (templateContent.database) {
      databaseId = randomUUID();
      await db.insert(userDatabases).values({
        id: databaseId,
        spaceId: space.id,
        name: templateContent.database.name,
        createdBy: user.id,
      });

      const columns = templateContent.database.columns;
      if (columns.length > 0) {
        await db.insert(userDatabaseColumns).values(
          columns.map((col, idx) => ({
            databaseId: databaseId!,
            name: col.name,
            type: col.type as "text" | "number" | "date" | "formula" | "select" | "checkbox" | "relation" | "image" | "url" | "email" | "attachment" | "time",
            position: idx,
            config: col.config ?? {},
          }))
        );
      }
    }

    // Convertir le contenu template en état Yjs initial et le persister
    const yjsState = templateContentToYjsState(templateContent, databaseId);
    if (yjsState) {
      const base64 = Buffer.from(yjsState).toString("base64");
      await db.insert(documentCollabStates).values({
        documentId: doc.id,
        yjsState: base64,
        updatedAt: new Date(),
      }).onConflictDoNothing();
    }
  }

  logActivity({
    userId: user.id,
    action: "create",
    entityType: "document",
    entityId: doc.id,
    metadata: { title, spaceSlug: slug },
  });

  return NextResponse.json(doc, { status: 201 });
}
