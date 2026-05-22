import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/storage/s3";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import sharp from "sharp";
import { guardSetupNotCompleted } from "@/lib/setup/guards";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 2 * 1024 * 1024; // 2 Mo

// Magic bytes pour la détection réelle du type
const MAGIC_SIGNATURES: Array<{ bytes: number[]; offset: number; mime: string }> = [
  { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4E, 0x47], offset: 0, mime: "image/png" },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mime: "image/webp" }, // RIFF header
];

function detectMimeFromBuffer(buffer: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (buffer.length < sig.offset + sig.bytes.length) continue;
    const match = sig.bytes.every((b, i) => buffer[sig.offset + i] === b);
    if (match) {
      // Pour WebP, vérifier aussi "WEBP" à l'offset 8
      if (sig.mime === "image/webp") {
        if (buffer.length >= 12 && buffer.toString("ascii", 8, 12) === "WEBP") {
          return "image/webp";
        }
        continue;
      }
      return sig.mime;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const blocked = await guardSetupNotCompleted();
  if (blocked) return blocked;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null; // "logo" ou "favicon"

  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  if (!type || !["logo", "favicon"].includes(type)) {
    return NextResponse.json({ error: "Type invalide (logo ou favicon)" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 2 Mo)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Valider le type réel via magic bytes (pas la déclaration client)
  const detectedMime = detectMimeFromBuffer(buffer);
  if (!detectedMime || !ALLOWED_MIME.has(detectedMime)) {
    return NextResponse.json(
      { error: "Format non supporté. Utilisez JPG, PNG ou WebP." },
      { status: 400 }
    );
  }

  let key: string;
  let contentType: string;
  let processedBuffer: Buffer;

  if (type === "favicon") {
    // Favicon : redimensionner à 32x32 en PNG
    processedBuffer = await sharp(buffer)
      .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    key = "branding/favicon.png";
    contentType = "image/png";
  } else {
    // Logo : redimensionner max 512px de large, format WebP
    processedBuffer = await sharp(buffer)
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
    key = "branding/logo.webp";
    contentType = "image/webp";
  }

  await uploadFile(key, processedBuffer, contentType);

  // Stocker l'URL dans system_settings
  const settingKey = type === "logo" ? "org_logo_url" : "org_favicon_url";
  const url = `/api/setup/upload?type=${type}`;
  const now = new Date();

  await db
    .insert(systemSettings)
    .values({ key: settingKey, value: url, updatedAt: now })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: url, updatedAt: now },
    });

  return NextResponse.json({ url });
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  if (!type || !["logo", "favicon"].includes(type)) {
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }

  const { s3Client, BUCKET } = await import("@/lib/storage/s3");
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");

  const key = type === "logo" ? "branding/logo.webp" : "branding/favicon.png";
  const mime = type === "logo" ? "image/webp" : "image/png";

  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    const bytes = await response.Body.transformToByteArray();

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
