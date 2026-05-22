import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET } from "@/lib/storage/s3";

export async function getPutSignedUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  try {
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  } catch (err) {
    console.error("[presign] Erreur génération URL signée :", err);
    throw new Error("Impossible de générer l'URL de téléversement");
  }
}
