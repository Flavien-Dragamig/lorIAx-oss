import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";

export type AIProviderName = "claude" | "openai" | "ollama" | "mistral";

export interface AIProviderConfig {
  name: AIProviderName;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export function getDefaultProvider(): AIProviderConfig {
  const provider = (process.env.DEFAULT_AI_PROVIDER || "claude") as AIProviderName;
  const model = process.env.DEFAULT_AI_MODEL || "claude-sonnet-4-20250514";

  return { name: provider, model };
}

export function createProvider(config: AIProviderConfig) {
  switch (config.name) {
    case "claude":
      return createAnthropic({
        apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      });
    case "openai":
      return createOpenAI({
        apiKey: config.apiKey || process.env.OPENAI_API_KEY,
        baseURL: config.baseUrl,
      });
    case "ollama":
      return createOpenAI({
        baseURL: config.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
        apiKey: "ollama", // Ollama n'a pas besoin de cle mais le SDK l'exige
      });
    case "mistral":
      return createMistral({
        apiKey: config.apiKey || process.env.MISTRAL_API_KEY,
      });
    default:
      throw new Error(`Provider inconnu : ${config.name}`);
  }
}

export function getLanguageModel(config?: AIProviderConfig) {
  const cfg = config || getDefaultProvider();
  const provider = createProvider(cfg);
  return provider.languageModel(cfg.model);
}

// Re-export new resolver for progressive migration
export { resolveProviderForUsage, getLanguageModelForUsage } from "./provider-resolver";
export type { UsageType } from "./provider-resolver";
