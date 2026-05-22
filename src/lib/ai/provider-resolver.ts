import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiProviders } from "@/lib/db/schema";
import { aiModelAssignments } from "@/lib/db/schema-ai";
import { decrypt } from "@/lib/crypto";
import logger from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UsageType =
  | "chat"
  | "summary_doc"
  | "summary_meeting"
  | "embeddings"
  | "playground";

export interface ResolvedProvider {
  provider: ReturnType<typeof createAnthropic> | ReturnType<typeof createOpenAI> | ReturnType<typeof createMistral>;
  model: string;
  providerId: string | null;
  providerName: string;
  isFallback: boolean;
  // "openai_compatible" → doit utiliser .chat() car .languageModel() route vers Responses API en v3
  connectorType: "anthropic" | "mistral" | "openai_compatible";
}

export interface ResolvedLanguageModel {
  languageModel: ReturnType<ResolvedProvider["provider"]["languageModel"]>;
  providerId: string | null;
  providerName: string;
  model: string;
  isFallback: boolean;
}

// ---------------------------------------------------------------------------
// Helpers (internal)
// ---------------------------------------------------------------------------

function decryptApiKey(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch (err) {
    logger.warn({ err }, "Failed to decrypt API key for AI provider");
    return null;
  }
}

function buildProviderInstance(
  record: typeof aiProviders.$inferSelect,
): { provider: ReturnType<typeof createAnthropic> | ReturnType<typeof createOpenAI> | ReturnType<typeof createMistral>; connectorType: ResolvedProvider["connectorType"] } {
  const apiKey = decryptApiKey(record.apiKeyEnc);

  if (record.connectorType === "anthropic") {
    return { provider: createAnthropic({ apiKey: apiKey || undefined }), connectorType: "anthropic" };
  }

  if (record.connectorType === "mistral") {
    return { provider: createMistral({ apiKey: apiKey || undefined }), connectorType: "mistral" };
  }

  // openai_compatible (Ollama, OpenAI, LM Studio, etc.)
  // IMPORTANT : @ai-sdk/openai v3 — languageModel() pointe vers Responses API.
  // Il faut utiliser provider.chat() pour forcer Chat Completions.
  return {
    provider: createOpenAI({
      baseURL: record.apiBaseUrl || undefined,
      apiKey: apiKey || "no-key",
    }),
    connectorType: "openai_compatible",
  };
}

// ---------------------------------------------------------------------------
// Legacy fallback (env vars)
// ---------------------------------------------------------------------------

async function legacyFallback(): Promise<ResolvedProvider> {
  // Try to find a default provider in DB first
  const [defaultProvider] = await db
    .select()
    .from(aiProviders)
    .where(eq(aiProviders.isDefault, true))
    .limit(1);

  if (defaultProvider && defaultProvider.isEnabled) {
    const { provider, connectorType } = buildProviderInstance(defaultProvider);
    const model = defaultProvider.defaultModel || "gemma4:e4b";

    logger.info(
      { provider: defaultProvider.name, model },
      "Using default DB provider (legacy fallback)",
    );

    return {
      provider,
      model,
      providerId: defaultProvider.id,
      providerName: defaultProvider.displayName,
      isFallback: false,
      connectorType,
    };
  }

  // Pure env-based fallback
  const providerName =
    (process.env.DEFAULT_AI_PROVIDER as string) || "ollama";
  const model = process.env.DEFAULT_AI_MODEL || "gemma4:e4b";

  let provider: ReturnType<typeof createAnthropic> | ReturnType<typeof createOpenAI> | ReturnType<typeof createMistral>;
  let connectorType: ResolvedProvider["connectorType"];

  if (providerName === "anthropic" || providerName === "claude") {
    provider = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    connectorType = "anthropic";
  } else if (providerName === "mistral") {
    provider = createMistral({ apiKey: process.env.MISTRAL_API_KEY });
    connectorType = "mistral";
  } else {
    // openai_compatible / ollama / anything else
    const baseURL =
      providerName === "ollama"
        ? (process.env.OLLAMA_BASE_URL || "http://localhost:11434") + "/v1"
        : undefined;

    provider = createOpenAI({
      baseURL,
      apiKey: process.env.OPENAI_API_KEY || "no-key",
    });
    connectorType = "openai_compatible";
  }

  logger.info(
    { provider: providerName, model },
    "Using env-based provider (legacy fallback)",
  );

  return {
    provider,
    model,
    providerId: null,
    providerName,
    isFallback: false,
    connectorType,
  };
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolve which AI provider and model to use for a given usage type.
 *
 * Resolution order:
 * 1. `ai_model_assignments` entry for the usage type
 * 2. If primary provider disabled or missing → fallback provider from assignment
 * 3. If no assignment exists → legacy fallback (default DB provider or env vars)
 */
export async function resolveProviderForUsage(
  usageType: UsageType,
): Promise<ResolvedProvider> {
  try {
    // 1. Look up the assignment for this usage type
    const [assignment] = await db
      .select()
      .from(aiModelAssignments)
      .where(eq(aiModelAssignments.usageType, usageType))
      .limit(1);

    if (!assignment || !assignment.isEnabled) {
      logger.debug(
        { usageType },
        "No active assignment found, using legacy fallback",
      );
      return legacyFallback();
    }

    // 2. Load primary provider
    const [primaryProvider] = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.id, assignment.providerId))
      .limit(1);

    if (primaryProvider && primaryProvider.isEnabled) {
      const { provider, connectorType } = buildProviderInstance(primaryProvider);

      logger.debug(
        {
          usageType,
          provider: primaryProvider.name,
          model: assignment.model,
        },
        "Resolved primary provider for usage",
      );

      return {
        provider,
        model: assignment.model,
        providerId: primaryProvider.id,
        providerName: primaryProvider.displayName,
        isFallback: false,
        connectorType,
      };
    }

    // 3. Primary unavailable — try fallback
    if (assignment.fallbackProviderId && assignment.fallbackModel) {
      const [fallbackProvider] = await db
        .select()
        .from(aiProviders)
        .where(eq(aiProviders.id, assignment.fallbackProviderId))
        .limit(1);

      if (fallbackProvider && fallbackProvider.isEnabled) {
        const { provider, connectorType } = buildProviderInstance(fallbackProvider);

        logger.info(
          {
            usageType,
            fallbackProvider: fallbackProvider.name,
            fallbackModel: assignment.fallbackModel,
          },
          "Primary provider unavailable, using fallback",
        );

        return {
          provider,
          model: assignment.fallbackModel,
          providerId: fallbackProvider.id,
          providerName: fallbackProvider.displayName,
          isFallback: true,
          connectorType,
        };
      }
    }

    // 4. Neither primary nor fallback available
    logger.warn(
      { usageType },
      "Neither primary nor fallback provider available, using legacy fallback",
    );
    return legacyFallback();
  } catch (err) {
    logger.error(
      { err, usageType },
      "Error resolving provider for usage, falling back to legacy",
    );
    return legacyFallback();
  }
}

/**
 * Convenience wrapper: resolve provider + return a ready-to-use LanguageModel.
 */
export async function getLanguageModelForUsage(
  usageType: UsageType,
): Promise<ResolvedLanguageModel> {
  const resolved = await resolveProviderForUsage(usageType);

  // @ai-sdk/openai v3 : languageModel() route vers Responses API (POST /v1/responses).
  // Ollama et providers openai_compatible ne supportent que Chat Completions.
  // → utiliser .chat() pour ces providers.
  const languageModel =
    resolved.connectorType === "openai_compatible"
      ? (resolved.provider as ReturnType<typeof createOpenAI>).chat(resolved.model)
      : resolved.provider.languageModel(resolved.model);

  return {
    languageModel,
    providerId: resolved.providerId,
    providerName: resolved.providerName,
    model: resolved.model,
    isFallback: resolved.isFallback,
  };
}
