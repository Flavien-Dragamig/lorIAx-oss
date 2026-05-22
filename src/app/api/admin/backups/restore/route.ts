import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { backupJobs, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createBackupS3Client } from "@/lib/backup/s3-backup";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { spawn } from "child_process";
import { createWriteStream, chmodSync, rmSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import bcrypt from "bcryptjs";
import { auditLog } from "@/lib/audit/log";
import { getClientIp } from "@/lib/rate-limit";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { jobId, confirmPassword } = body;

  if (!jobId || !confirmPassword) {
    return NextResponse.json(
      { error: "Identifiant de sauvegarde et mot de passe requis" },
      { status: 400 }
    );
  }

  // Verify password
  const [dbUser] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!dbUser?.passwordHash) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 400 });
  }

  const isValid = await bcrypt.compare(confirmPassword, dbUser.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 403 });
  }

  // Get backup job
  const [job] = await db
    .select()
    .from(backupJobs)
    .where(eq(backupJobs.id, jobId))
    .limit(1);

  if (!job || job.status !== "completed" || !job.s3Key) {
    return NextResponse.json(
      { error: "Sauvegarde introuvable ou non disponible" },
      { status: 404 }
    );
  }

  const s3 = await createBackupS3Client();
  if (!s3) {
    return NextResponse.json(
      { error: "Configuration S3 manquante" },
      { status: 500 }
    );
  }

  // Create isolated temp directory with restricted permissions (0o700: rwx------)
  const tempDir = mkdtempSync(join(tmpdir(), "loriax-restore-"));
  chmodSync(tempDir, 0o700);
  const tmpFile = join(tempDir, `${job.id}.dump`);

  try {
    // Download dump from S3
    const response = await s3.client.send(
      new GetObjectCommand({
        Bucket: job.s3Bucket || s3.bucket,
        Key: job.s3Key,
      })
    );

    if (!response.Body) {
      throw new Error("Fichier de sauvegarde vide");
    }

    // Stream to temp file
    const nodeStream = response.Body as Readable;
    const writeStream = createWriteStream(tmpFile);
    await pipeline(nodeStream, writeStream);

    // Run pg_restore
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL non définie");
    }

    const pgRestore = spawn("pg_restore", [
      "-Fc",
      "--clean",
      "--if-exists",
      `--dbname=${databaseUrl}`,
      tmpFile,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    pgRestore.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      pgRestore.on("close", resolve);
      pgRestore.on("error", reject);
    });

    // pg_restore returns 0 on success, 1 on warnings (non-fatal), 2+ on errors
    if (exitCode >= 2) {
      throw new Error(`pg_restore a échoué (code ${exitCode}): ${stderr.slice(0, 500)}`);
    }

    auditLog(
      "backup.restore",
      user.id,
      { jobId: job.id, type: job.type, s3Key: job.s3Key },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      warnings: exitCode === 1 ? stderr.slice(0, 500) : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
