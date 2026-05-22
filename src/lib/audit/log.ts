import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import logger from "@/lib/logger";

/**
 * Log an admin action for audit trail.
 * Fire-and-forget — never blocks the caller.
 */
export function auditLog(
  action: string,
  userId: string | null,
  details?: Record<string, unknown>,
  ip?: string
): void {
  db.insert(auditLogs)
    .values({
      userId,
      action,
      details: details ?? null,
      ip: ip ?? null,
    })
    .then(() => {
      logger.info({ action, userId }, "[audit] %s", action);
    })
    .catch((err) => {
      logger.error({ err, action, userId }, "[audit] Failed to write audit log");
    });
}
