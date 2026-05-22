import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { backupJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { runBackupAsync } from "@/lib/backup/runner";
import { auditLog } from "@/lib/audit/log";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const type = body.type;

  if (!type || !["client", "technical", "full"].includes(type)) {
    return NextResponse.json(
      { error: "Type de sauvegarde invalide" },
      { status: 400 }
    );
  }

  // Check no job of same type is already running
  const [existing] = await db
    .select()
    .from(backupJobs)
    .where(and(eq(backupJobs.type, type), eq(backupJobs.status, "running")))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Une sauvegarde de ce type est déjà en cours" },
      { status: 409 }
    );
  }

  // Create job
  const [job] = await db
    .insert(backupJobs)
    .values({
      type,
      status: "running",
      triggeredBy: user.id,
    })
    .returning();

  // Fire and forget
  runBackupAsync(job.id, type).catch((err) => {
    console.error(`[backup] Erreur inattendue pour le job ${job.id}:`, err);
  });

  auditLog("backup.trigger", user.id, { type, jobId: job.id }, getClientIp(request));

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
