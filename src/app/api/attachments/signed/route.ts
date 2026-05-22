import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { getFileUrl } from "@/lib/storage/s3";

/**
 * Génère une URL signée Garage S3 pour un fichier attachment.
 * GET /api/attachments/signed?key={clé S3}
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Paramètre key manquant" }, { status: 400 });
  }

  try {
    const url = await getFileUrl(key, 900);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
