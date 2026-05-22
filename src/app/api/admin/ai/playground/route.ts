import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { logAIUsage } from "@/lib/ai/usage-logger";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const {
    providerId,
    model,
    systemPrompt,
    userPrompt,
    temperature = 0.7,
    maxTokens = 2048,
    topP = 1,
  } = body;

  if (!providerId || !model || !userPrompt) {
    return NextResponse.json(
      { error: "providerId, model et userPrompt sont requis" },
      { status: 400 }
    );
  }

  // Load provider
  const [provider] = await db
    .select()
    .from(aiProviders)
    .where(eq(aiProviders.id, providerId))
    .limit(1);

  if (!provider) {
    return NextResponse.json(
      { error: "Fournisseur introuvable" },
      { status: 404 }
    );
  }

  // Decrypt API key if present
  let apiKey: string | undefined;
  if (provider.apiKeyEnc) {
    try {
      apiKey = decrypt(provider.apiKeyEnc);
    } catch {
      return NextResponse.json(
        { error: "Impossible de déchiffrer la clé API du fournisseur" },
        { status: 500 }
      );
    }
  }

  // Create provider instance based on connectorType
  let aiProvider;
  if (provider.connectorType === "anthropic") {
    aiProvider = createAnthropic({ apiKey });
  } else {
    // openai_compatible — covers OpenAI, Ollama, etc.
    aiProvider = createOpenAI({
      apiKey: apiKey || "ollama",
      baseURL: provider.apiBaseUrl || undefined,
    });
  }

  const startTime = Date.now();

  const result = streamText({
    model: aiProvider.languageModel(model),
    system: systemPrompt || undefined,
    prompt: userPrompt,
    temperature,
    maxOutputTokens: maxTokens,
    topP,
    onFinish: ({ usage, text }) => {
      const latencyMs = Date.now() - startTime;
      const pricing = provider.pricing as Record<string, number> | null;
      let costEstimate: number | undefined;

      if (pricing && usage) {
        const inputCost =
          (usage.inputTokens || 0) * (pricing.inputPerMillion || 0) / 1_000_000;
        const outputCost =
          (usage.outputTokens || 0) * (pricing.outputPerMillion || 0) / 1_000_000;
        costEstimate = inputCost + outputCost;
      }

      logAIUsage({
        userId: user.id,
        providerId: provider.id,
        model,
        usageType: "playground",
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
        latencyMs,
        status: "success",
        costEstimate,
        requestBody: JSON.stringify({
          systemPrompt: systemPrompt?.slice(0, 200),
          userPrompt: userPrompt.slice(0, 200),
        }),
        responseBody: text?.slice(0, 500),
      });
    },
  });

  return result.toTextStreamResponse();
}
