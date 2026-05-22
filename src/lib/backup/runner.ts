import { spawn } from "child_process";
import { PassThrough } from "stream";
import { Upload } from "@aws-sdk/lib-storage";
import { db } from "@/lib/db";
import { backupJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createBackupS3Client } from "./s3-backup";
import { getTablesForType, type BackupType } from "./tables";

export async function runBackupAsync(
  jobId: string,
  type: BackupType,
): Promise<void> {
  const s3 = await createBackupS3Client();
  if (!s3) {
    await db
      .update(backupJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: "Configuration S3 de sauvegarde non configurée",
      })
      .where(eq(backupJobs.id, jobId));
    return;
  }

  const tables = getTablesForType(type);
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    await db
      .update(backupJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: "DATABASE_URL non définie",
      })
      .where(eq(backupJobs.id, jobId));
    return;
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const s3Key = `backups/${type}/${dateStr}/${jobId}.dump`;

  try {
    // Build pg_dump args
    const args = ["-Fc", `--dbname=${databaseUrl}`];
    for (const table of tables) {
      args.push(`--table=${table}`);
    }

    const pgDump = spawn("pg_dump", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const passthrough = new PassThrough();
    let sizeBytes = 0;

    pgDump.stdout.on("data", (chunk: Buffer) => {
      sizeBytes += chunk.length;
    });

    pgDump.stdout.pipe(passthrough);

    // Collect stderr for error reporting
    let stderr = "";
    pgDump.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    // Start multipart upload
    const upload = new Upload({
      client: s3.client,
      params: {
        Bucket: s3.bucket,
        Key: s3Key,
        Body: passthrough,
        ContentType: "application/octet-stream",
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024, // 5 MB
    });

    // Wait for pg_dump to finish
    const exitCode = await new Promise<number>((resolve, reject) => {
      pgDump.on("close", resolve);
      pgDump.on("error", reject);
    });

    if (exitCode !== 0) {
      throw new Error(`pg_dump a échoué (code ${exitCode}): ${stderr.slice(0, 500)}`);
    }

    // Wait for S3 upload to complete
    await upload.done();

    await db
      .update(backupJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        sizeBytes,
        s3Key,
        s3Bucket: s3.bucket,
        tableCount: tables.length || undefined,
      })
      .where(eq(backupJobs.id, jobId));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
    await db
      .update(backupJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: errorMessage.slice(0, 2000),
      })
      .where(eq(backupJobs.id, jobId));
  }
}
