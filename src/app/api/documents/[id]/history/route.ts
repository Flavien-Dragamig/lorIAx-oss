import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, spaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkDocumentViewAccess } from "@/lib/auth/check-access";
import { getFileHistory, getFileAtCommit } from "@/lib/git/repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const sha = request.nextUrl.searchParams.get("sha");

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  const canView = await checkDocumentViewAccess(user, doc.spaceId, id);
  if (!canView) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, doc.spaceId))
    .limit(1);

  if (!space) return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });

  // Si un sha est specifie, retourner le contenu a cette version
  if (sha) {
    try {
      const content = await getFileAtCommit(space.gitRepoPath, doc.filePath, sha);
      return NextResponse.json({ sha, content });
    } catch {
      return NextResponse.json({ error: "Version introuvable" }, { status: 404 });
    }
  }

  // Sinon, retourner l'historique
  try {
    const history = await getFileHistory(space.gitRepoPath, doc.filePath);
    return NextResponse.json(history);
  } catch {
    return NextResponse.json([]);
  }
}
