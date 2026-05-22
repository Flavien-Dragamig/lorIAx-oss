import { Cron } from "croner";
import { db } from "@/lib/db";
import { systemSettings, backupJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runBackupAsync } from "./runner";

interface ScheduleConfig {
  clientCron: string;
  technicalCron: string;
  enabled: boolean;
}

let clientJob: Cron | null = null;
let technicalJob: Cron | null = null;

async function triggerScheduledBackup(type: "client" | "technical") {
  try {
    const [job] = await db
      .insert(backupJobs)
      .values({ type, status: "running", triggeredBy: null })
      .returning();

    runBackupAsync(job.id, type).catch((err) => {
      console.error(`[backup-scheduler] Erreur job ${job.id}:`, err);
    });

    console.log(`[backup-scheduler] Sauvegarde ${type} lancée (job ${job.id})`);
  } catch (err) {
    console.error(`[backup-scheduler] Impossible de lancer la sauvegarde ${type}:`, err);
  }
}

export async function initBackupScheduler() {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "backup_schedule"));

    if (!row?.value) return;

    const config = row.value as ScheduleConfig;
    if (!config.enabled) return;

    if (config.clientCron) {
      clientJob = new Cron(config.clientCron, () => triggerScheduledBackup("client"));
      console.log(`[backup-scheduler] Client planifié : ${config.clientCron}`);
    }

    if (config.technicalCron) {
      technicalJob = new Cron(config.technicalCron, () => triggerScheduledBackup("technical"));
      console.log(`[backup-scheduler] Technique planifié : ${config.technicalCron}`);
    }
  } catch (err) {
    console.error("[backup-scheduler] Erreur d'initialisation:", err);
  }
}

export async function reloadBackupScheduler() {
  clientJob?.stop();
  clientJob = null;
  technicalJob?.stop();
  technicalJob = null;
  await initBackupScheduler();
}
