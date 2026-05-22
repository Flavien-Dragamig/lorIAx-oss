import { db } from "@/lib/db";
import { activityLog } from "@/lib/db/schema";
import logger from "@/lib/logger";

type EntityType = "document" | "space" | "user" | "template" | "share";

interface LogActivityParams {
  userId: string;
  action: string;
  entityType: EntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: LogActivityParams): Promise<void> {
  try {
    await db.insert(activityLog).values({
      userId,
      action,
      entityType,
      entityId,
      metadata: metadata || {},
    });
  } catch (error) {
    logger.error({ err: error }, "[activity] Erreur log activité");
  }
}
