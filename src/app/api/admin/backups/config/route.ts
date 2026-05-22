import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit/log";
import { getClientIp } from "@/lib/rate-limit";
import { reloadBackupScheduler } from "@/lib/backup/scheduler";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const [s3Row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "backup_s3"));

  const [scheduleRow] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "backup_schedule"));

  return NextResponse.json({
    s3: s3Row?.value ?? null,
    schedule: scheduleRow?.value ?? { clientCron: "0 2 * * *", technicalCron: "0 3 * * *", enabled: false },
  });
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const now = new Date();

  // Save S3 config
  if (body.s3) {
    const s3Config = { ...body.s3 };
    // Encrypt secret key if not already encrypted
    if (
      typeof s3Config.s3BackupSecretKey === "string" &&
      s3Config.s3BackupSecretKey.length > 0 &&
      !/^[0-9a-f]{32}:[0-9a-f]{32}:/.test(s3Config.s3BackupSecretKey)
    ) {
      s3Config.s3BackupSecretKey = encrypt(s3Config.s3BackupSecretKey);
    }

    await db
      .insert(systemSettings)
      .values({ key: "backup_s3", value: s3Config, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: s3Config, updatedAt: now },
      });
  }

  // Save schedule config
  if (body.schedule) {
    await db
      .insert(systemSettings)
      .values({ key: "backup_schedule", value: body.schedule, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: body.schedule, updatedAt: now },
      });
  }

  // Reload scheduler if schedule changed
  if (body.schedule) {
    await reloadBackupScheduler();
  }

  auditLog("backup.config.update", user.id, {}, getClientIp(request));

  return NextResponse.json({ success: true });
}
