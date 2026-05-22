import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {};
  let healthy = true;

  // Check PostgreSQL
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latency: Date.now() - start };
  } catch {
    checks.database = { status: "error" };
    healthy = false;
  }

  // Check S3 storage (Garage / MinIO / AWS S3)
  try {
    const start = Date.now();
    const s3 = new S3Client({
      endpoint: `http${process.env.S3_USE_SSL === "true" ? "s" : ""}://${process.env.S3_ENDPOINT}:${process.env.S3_PORT}`,
      region: process.env.S3_REGION || "garage",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: true,
    });
    await s3.send(
      new HeadBucketCommand({ Bucket: process.env.S3_BUCKET || "loriax-files" })
    );
    checks.storage = { status: "ok", latency: Date.now() - start };
  } catch {
    checks.storage = { status: "error" };
    healthy = false;
  }

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || process.env.npm_package_version || "dev",
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
