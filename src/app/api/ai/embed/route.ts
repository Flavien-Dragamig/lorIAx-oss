import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { indexDocument, isEmbeddingConfigured } from "@/lib/ai/embeddings";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import logger from "@/lib/logger";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limiting par utilisateur
  const rl = checkRateLimit(`embed:${user.id}`, RATE_LIMITS.embed);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Trop de requêtes d'indexation. Réessayez dans quelques instants." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  if (!isEmbeddingConfigured()) {
    return NextResponse.json(
      { error: "Aucun provider d'embeddings configuré. Ajoutez OPENAI_API_KEY ou configurez Ollama." },
      { status: 503 }
    );
  }

  const { documentId } = await request.json();

  if (!documentId) {
    return NextResponse.json({ error: "documentId requis" }, { status: 400 });
  }

  try {
    await indexDocument(documentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error, documentId }, "Erreur indexation embedding");
    return NextResponse.json(
      { error: "Erreur lors de l'indexation" },
      { status: 500 }
    );
  }
}
