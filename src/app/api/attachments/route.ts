import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attachments } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/get-user";
import { getSpacePermission } from "@/lib/auth/check-access";
import { uploadFile, getFileUrl } from "@/lib/storage/s3";
import { randomUUID } from "crypto";
import { fileTypeFromBuffer } from "file-type";

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
  "txt", "csv", "json", "xml", "yaml", "yml", "md",
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico",
  "mp4", "webm", "mp3", "wav", "ogg",
  "zip", "tar", "gz",
]);

// Extensions texte que file-type ne peut pas détecter (pas de magic bytes)
const TEXT_EXTENSIONS = new Set([
  "txt", "csv", "json", "xml", "yaml", "yml", "md", "svg",
]);

/**
 * SEC-06 — Sanitise le nom de fichier pour empêcher path traversal et
 * caractères problématiques.
 */
function sanitizeFilename(name: string): string {
  return name
    // Supprimer les séquences de path traversal
    .replace(/\.\.\//g, "")
    .replace(/\.\.\\/g, "")
    // Supprimer les caractères de contrôle et problématiques
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    // Limiter la longueur
    .slice(0, 255)
    // Supprimer les points en début de nom (fichiers cachés)
    .replace(/^\.+/, "")
    || "fichier";
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const spaceId = formData.get("spaceId") as string | null;
  const documentId = formData.get("documentId") as string | null;

  if (!file || !spaceId) {
    return NextResponse.json({ error: "Fichier et spaceId requis" }, { status: 400 });
  }

  // Vérification de la permission sur l'espace
  const permission = await getSpacePermission(user.id, spaceId);
  if (!permission) {
    return NextResponse.json({ error: "Accès refusé à cet espace" }, { status: 403 });
  }

  // Validation de la taille (max 50 Mo)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (max 50 Mo)" },
      { status: 413 }
    );
  }

  // Validation de l'extension
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `Extension .${ext} non autorisée` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // SEC-05 — Vérification des magic bytes pour les fichiers binaires
  if (!TEXT_EXTENSIONS.has(ext)) {
    const detectedType = await fileTypeFromBuffer(buffer);

    if (!detectedType) {
      return NextResponse.json(
        { error: "Type de fichier non reconnu" },
        { status: 415 }
      );
    }

    // Vérifier que l'extension correspond au type MIME réel
    const detectedExt = detectedType.ext;
    // Normaliser jpg/jpeg
    const normalizedExt = ext === "jpg" ? "jpeg" : ext;
    const normalizedDetected = detectedExt === "jpg" ? "jpeg" : detectedExt;

    if (normalizedExt !== normalizedDetected) {
      return NextResponse.json(
        {
          error: `Type de fichier incohérent : extension .${ext} mais contenu détecté comme .${detectedExt}`,
        },
        { status: 400 }
      );
    }
  }

  // SEC-06 — Sanitiser le nom de fichier
  const safeName = sanitizeFilename(file.name);
  const key = `${spaceId}/${randomUUID()}.${ext}`;

  await uploadFile(key, buffer, file.type);

  const [attachment] = await db
    .insert(attachments)
    .values({
      documentId: documentId || undefined,
      spaceId,
      filename: safeName,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey: key,
      uploadedBy: user.id,
    })
    .returning();

  const url = await getFileUrl(key);

  return NextResponse.json({ ...attachment, url }, { status: 201 });
}
