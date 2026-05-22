import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { connectorType, apiBaseUrl, apiKey, model } = await request.json();

  if (!model) {
    return NextResponse.json(
      { error: "Le modèle est requis" },
      { status: 400 }
    );
  }

  try {
    let provider;

    if (connectorType === "anthropic") {
      provider = createAnthropic({
        apiKey: apiKey || undefined,
      });
    } else if (connectorType === "mistral") {
      provider = createMistral({
        apiKey: apiKey || undefined,
      });
    } else {
      // openai_compatible
      provider = createOpenAI({
        baseURL: apiBaseUrl || undefined,
        apiKey: apiKey || "no-key",
      });
    }

    const start = Date.now();

    const result = await generateText({
      model: provider.languageModel(model),
      prompt: "Réponds uniquement par le mot: OK",
      maxOutputTokens: 10,
      abortSignal: AbortSignal.timeout(15_000),
    });

    const latency = Date.now() - start;

    return NextResponse.json({
      success: true,
      latency,
      response: result.text.trim(),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json(
      { success: false, error: message },
      { status: 200 }
    );
  }
}
