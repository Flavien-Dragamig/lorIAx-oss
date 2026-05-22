import { Cron } from "croner";
import { getTelemetrySettings, sendHeartbeat } from "./heartbeat";

let job: Cron | null = null;

/**
 * Démarre le heartbeat hebdomadaire si la télémétrie est activée.
 * Cron : tous les lundis à 04h00.
 */
export async function initTelemetryScheduler(): Promise<void> {
  try {
    const settings = await getTelemetrySettings();
    if (!settings?.enabled) return;

    job = new Cron("0 4 * * 1", () => {
      sendHeartbeat().catch((err) =>
        console.error("[telemetry-scheduler] Erreur:", err)
      );
    });
    console.log("[telemetry-scheduler] Heartbeat hebdomadaire planifié");
  } catch (err) {
    console.error("[telemetry-scheduler] Erreur d'initialisation:", err);
  }
}

/** Recharge le planificateur après un changement de réglages. */
export async function reloadTelemetryScheduler(): Promise<void> {
  job?.stop();
  job = null;
  await initTelemetryScheduler();
}
