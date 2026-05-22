import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSessionUser } from "@/lib/auth/get-user";
import { s3Client, BUCKET } from "@/lib/storage/s3";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { key: segments } = await params;
  const key = segments.join("/");

  try {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    const buffer = Buffer.from(await response.Body.transformToByteArray());
    const contentType = response.ContentType || "application/octet-stream";

    const filename = segments[segments.length - 1] ?? "file";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const code = (err as { name?: string }).name;
    if (code === "NoSuchKey") {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
