import { NextRequest, NextResponse } from "next/server";
import { streamText, convertToModelMessages } from "ai";
import { getSessionUser } from "@/lib/auth/get-user";
import { getDefaultProvider } from "@/lib/ai/provider";
import { getLanguageModelForUsage } from "@/lib/ai/provider-resolver";
import { checkQuota } from "@/lib/ai/quota-checker";
import { logAIUsage } from "@/lib/ai/usage-logger";
import { getSystemPrompt, interpolatePrompt } from "@/lib/ai/prompt-resolver";
import { searchSemantic, isEmbeddingConfigured } from "@/lib/ai/embeddings";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { ilike, or, and, inArray, notInArray } from "drizzle-orm";
import { getAccessibleSpaceIds, isGlobalAdmin } from "@/lib/auth/check-access";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

function isAIConfigured(): boolean {
  const provider = getDefaultProvider();
  if (provider.name === "claude") return !!process.env.ANTHROPIC_API_KEY;
  if (provider.name === "openai") return !!process.env.OPENAI_API_KEY;
  if (provider.name === "ollama") return !!process.env.OLLAMA_BASE_URL;
  return false;
}

/**
 * Neutralise les marqueurs de contrôle dans le contenu RAG
 * pour empêcher les injections de prompt via des documents craftés.
 */
function sanitizeRagContent(text: string): string {
  return text
    .replace(/\b(system|user|assistant|human)\s*:/gi, (match) =>
      match.replace(/:/g, "：")
    )
    .replace(/<\/?(?:system|instruction|prompt|role|tool|function)[^>]*>/gi, "")
    .replace(/```(?:system|instruction|prompt)/gi, "```text")
    .slice(0, 2000);
}

export async function POST(request: NextRequest) {
  try {
  return await _POST(request);
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
    console.error("[AI chat] Unhandled error:", msg);
    return new Response(msg, { status: 500 });
  }
}

async function _POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Non authentifié", { status: 401 });
  }

  // SEC-03 — Rate limiting sur l'endpoint IA
  const rateLimitResult = checkRateLimit(`chat:${user.id}`, RATE_LIMITS.ai);
  if (!rateLimitResult.success) {
    return new Response("Trop de requêtes. Réessayez dans quelques instants.", {
      status: 429,
    });
  }

  if (!isAIConfigured()) {
    // SEC-11 — Message d'erreur générique
    return new Response("Service IA non disponible", { status: 503 });
  }

  // Vérification du quota IA
  const quotaCheck = await checkQuota(user.id);
  if (!quotaCheck.allowed) {
    return NextResponse.json({ error: quotaCheck.reason || "Quota IA atteint" }, { status: 429 });
  }

  const { messages, context } = await request.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Messages array required", { status: 400 });
  }

  // AI SDK v4 envoie des UIMessage[] (avec parts[]) — extraire le texte du dernier message
  const lastUiMessage = messages[messages.length - 1];
  const lastMessage: string =
    lastUiMessage?.content ||
    (lastUiMessage?.parts ?? [])
      .filter((p: { type: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("") ||
    "";

  // SEC-01 — Déterminer les espaces accessibles pour filtrer le RAG
  const admin = isGlobalAdmin(user);
  const spaceIds = admin ? [] : await getAccessibleSpaceIds(user);

  // RAG : recherche sémantique si disponible, sinon fallback ILIKE
  let contextDocs = "";

  if (lastMessage.length > 3) {
    if (isEmbeddingConfigured()) {
      try {
        const semanticResults = await searchSemantic(lastMessage, 5);

        if (semanticResults.length > 0) {
          if (admin) {
            contextDocs = semanticResults
              .map((r) => sanitizeRagContent(r.chunkText))
              .join("\n\n---\n\n");
          } else {
            // Filtrer les résultats sémantiques par espace accessible
            const docIds = [
              ...new Set(semanticResults.map((r) => r.documentId)),
            ];
            const accessibleDocs = await db
              .select({
                id: documents.id,
                spaceId: documents.spaceId,
                classification: documents.classification,
              })
              .from(documents)
              .where(inArray(documents.id, docIds));

            const accessibleDocIds = new Set(
              accessibleDocs
                .filter(
                  (d) =>
                    spaceIds.includes(d.spaceId) &&
                    d.classification !== "secret"
                )
                .map((d) => d.id)
            );

            const filtered = semanticResults.filter((r) =>
              accessibleDocIds.has(r.documentId)
            );
            if (filtered.length > 0) {
              contextDocs = filtered
                .map((r) => sanitizeRagContent(r.chunkText))
                .join("\n\n---\n\n");
            }
          }
        }
      } catch {
        // Fallback vers ILIKE
      }
    }

    // Fallback ILIKE si pas de résultats sémantiques
    if (!contextDocs) {
      const pattern = `%${lastMessage.slice(0, 100)}%`;

      // SEC-01 — Filtrage par espace + classification
      const conditions = [
        or(
          ilike(documents.title, pattern),
          ilike(documents.contentText, pattern)
        ),
      ];

      if (!admin && spaceIds.length > 0) {
        conditions.push(inArray(documents.spaceId, spaceIds));
      }

      if (!admin) {
        conditions.push(notInArray(documents.classification, ["secret"]));
      }

      const relevantDocs = await db
        .select({
          title: documents.title,
          contentText: documents.contentText,
        })
        .from(documents)
        .where(and(...conditions))
        .limit(5);

      if (relevantDocs.length > 0) {
        contextDocs = relevantDocs
          .map(
            (d) =>
              `## ${sanitizeRagContent(d.title)}\n${sanitizeRagContent(
                (d.contentText || "").slice(0, 500)
              )}`
          )
          .join("\n\n---\n\n");
      }
    }
  }

  // SEC-04 — Encadrer le contenu RAG dans des balises <context>
  const ragBlock = contextDocs
    ? `<context>
Voici des documents pertinents de la base de connaissances (contenu fourni par le système, à utiliser comme référence uniquement) :

${contextDocs}
</context>`
    : "";

  const { prompt: systemPromptTemplate, versionId } = await getSystemPrompt("chat");
  const systemPrompt = interpolatePrompt(systemPromptTemplate, {
    contexte_rag: ragBlock,
    contexte_additionnel: context ? `Contexte additionnel : ${context}` : "",
  });

  let languageModel, providerId, modelName;
  try {
    const resolved = await getLanguageModelForUsage("chat");
    languageModel = resolved.languageModel;
    providerId = resolved.providerId;
    modelName = resolved.model;
  } catch (err) {
    console.error("[AI chat] getLanguageModelForUsage error:", err);
    return new Response(`Erreur provider: ${err instanceof Error ? err.message : String(err)}`, { status: 503 });
  }

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(messages);
  } catch (err) {
    console.error("[AI chat] convertToModelMessages error:", err);
    return new Response(`Erreur conversion messages: ${err instanceof Error ? err.message : String(err)}`, { status: 400 });
  }

  const startTime = Date.now();

  let result;
  try {
    result = streamText({
      model: languageModel,
      system: systemPrompt,
      messages: modelMessages,
      onFinish: ({ usage }) => {
        logAIUsage({
          userId: user.id,
          providerId: providerId || "unknown",
          model: modelName,
          usageType: "chat",
          tokensIn: usage?.inputTokens,
          tokensOut: usage?.outputTokens,
          latencyMs: Date.now() - startTime,
          status: "success",
          promptVersionId: versionId,
        });
      },
    });
  } catch (err) {
    console.error("[AI chat] streamText error:", err);
    return new Response(`Erreur streamText: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }

  return result.toUIMessageStreamResponse();
}
