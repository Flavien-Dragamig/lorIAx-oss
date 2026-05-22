import { db } from "@/lib/db";
import { aiUsageLogs } from "@/lib/db/schema";
import logger from "@/lib/logger";

interface LogAIUsageParams {
  userId: string;
  teamId?: string;
  providerId: string;
  model: string;
  usageType:
    | "chat"
    | "summary_doc"
    | "summary_meeting"
    | "embeddings"
    | "playground";
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  status: "success" | "error" | "timeout" | "fallback" | "quota_exceeded";
  errorMessage?: string;
  fallbackProviderId?: string;
  promptVersionId?: string;
  costEstimate?: number;
  requestBody?: string;
  responseBody?: string;
}

/**
 * Fire-and-forget logger for AI usage.
 * Records every AI request to the ai_usage_logs table.
 * Errors are caught and logged silently — never blocks the caller.
 */
export function logAIUsage(params: LogAIUsageParams): void {
  db.insert(aiUsageLogs)
    .values({
      userId: params.userId,
      teamId: params.teamId,
      providerId: params.providerId,
      model: params.model,
      usageType: params.usageType,
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      latencyMs: params.latencyMs,
      status: params.status,
      errorMessage: params.errorMessage,
      fallbackProviderId: params.fallbackProviderId,
      promptVersionId: params.promptVersionId,
      costEstimate: params.costEstimate
        ? String(params.costEstimate)
        : undefined,
      requestBody: params.requestBody,
      responseBody: params.responseBody,
    })
    .catch((err) => {
      logger.error({ err }, "Failed to log AI usage");
    });
}
