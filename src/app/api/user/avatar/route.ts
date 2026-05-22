import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { uploadFile, deleteFile, s3Client, BUCKET } from "@/lib/storage/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import logger from "@/lib/logger";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2 Mo
const AVATAR_SIZE = 400; // 400×400 retina

/**
 * GET /api/user/avatar?id={userId}
 * Proxy vers le stockage S3 — sert l'image avatar avec cache long
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("id");
  if (!userId) {
    return NextResponse.json({ error: "Paramètre id manquant" }, { status: 400 });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: `avatars/${userId}.webp`,
    });
    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Avatar introuvable" }, { status: 404 });
    }

    const bytes = await response.Body.transformToByteArray();

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Avatar introuvable" }, { status: 404 });
  }
}

/**
 * POST /api/user/avatar
 * Upload d'avatar avec crop et redimensionnement
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    // Validation type MIME
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format non supporté. Utilisez JPG, PNG ou WebP." },
        { status: 400 }
      );
    }

    // Validation taille
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 2 Mo)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Crop si cropData fourni
    const cropDataStr = formData.get("cropData") as string | null;
    let processed = sharp(buffer);

    if (cropDataStr) {
      try {
        const cropData = JSON.parse(cropDataStr);
        const metadata = await sharp(buffer).metadata();
        const imgWidth = metadata.width || AVATAR_SIZE;
        const imgHeight = metadata.height || AVATAR_SIZE;

        // cropData en pourcentages → pixels
        const left = Math.round((cropData.x / 100) * imgWidth);
        const top = Math.round((cropData.y / 100) * imgHeight);
        const width = Math.round((cropData.width / 100) * imgWidth);
        const height = Math.round((cropData.height / 100) * imgHeight);

        if (width > 0 && height > 0) {
          processed = processed.extract({ left, top, width, height });
        }
      } catch {
        // Ignorer les données de crop invalides, on continue sans crop
      }
    }

    // Redimensionner à 400×400 en WebP
    const webpBuffer = await processed
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();

    // Upload vers le stockage S3
    const key = `avatars/${user.id}.webp`;
    await uploadFile(key, webpBuffer, "image/webp");

    // Mettre à jour avatarUrl en BDD avec la route proxy
    const avatarUrl = `/api/user/avatar?id=${user.id}`;
    await db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    logger.error({ err: error }, "Erreur upload avatar");
    return NextResponse.json(
      { error: "Erreur lors du traitement de l'image" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/avatar
 * Suppression de l'avatar → retour au VizHash
 */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    // Supprimer du stockage S3
    await deleteFile(`avatars/${user.id}.webp`);
  } catch {
    // Pas grave si le fichier n'existait pas
  }

  // Mettre avatarUrl à null en BDD
  await db
    .update(users)
    .set({ avatarUrl: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return NextResponse.json({ success: true });
}
