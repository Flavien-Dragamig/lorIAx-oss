import { db } from "@/lib/db";
import { documentEmbeddings, documents } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import logger from "@/lib/logger";
import { logAIUsage } from "@/lib/ai/usage-logger";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

export async function generateEmbedding(text: string, userId?: string): Promise<number[]> {
  const provider = process.env.EMBEDDING_PROVIDER || "openai";
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  const startTime = Date.now();

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY requis pour les embeddings");

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text, model }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI embeddings error: ${err}`);
    }

    const data = await res.json();

    if (userId) {
      logAIUsage({
        userId,
        providerId: "openai",
        model,
        usageType: "embeddings",
        tokensIn: data.usage?.prompt_tokens,
        tokensOut: 0,
        latencyMs: Date.now() - startTime,
        status: "success",
      });
    }

    return data.data[0].embedding;
  }

  if (provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const res = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });

    if (!res.ok) {
      throw new Error(`Ollama embeddings error: ${res.statusText}`);
    }

    const data = await res.json();

    if (userId) {
      logAIUsage({
        userId,
        providerId: "ollama",
        model,
        usageType: "embeddings",
        latencyMs: Date.now() - startTime,
        status: "success",
      });
    }

    return data.embedding;
  }

  throw new Error(`Embedding provider inconnu : ${provider}`);
}

export function isEmbeddingConfigured(): boolean {
  const provider = process.env.EMBEDDING_PROVIDER || "openai";
  if (provider === "openai") return !!process.env.OPENAI_API_KEY;
  if (provider === "ollama") return !!process.env.OLLAMA_BASE_URL;
  return false;
}

export async function indexDocument(documentId: string): Promise<void> {
  if (!isEmbeddingConfigured()) {
    return;
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc || !doc.contentText) return;

  // Supprimer les anciens embeddings
  await db
    .delete(documentEmbeddings)
    .where(eq(documentEmbeddings.documentId, documentId));

  const chunks = chunkText(doc.contentText);
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

  // Générer les embeddings en parallèle (concurrence limitée à 5)
  const CONCURRENCY = 5;
  for (let batch = 0; batch < chunks.length; batch += CONCURRENCY) {
    const batchChunks = chunks.slice(batch, batch + CONCURRENCY);
    const results = await Promise.allSettled(
      batchChunks.map((chunk) => generateEmbedding(chunk))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const chunkIndex = batch + j;

      if (result.status === "rejected") {
        logger.error({ err: result.reason, documentId, chunkIndex }, "Erreur embedding chunk");
        continue;
      }

      try {
        const [inserted] = await db
          .insert(documentEmbeddings)
          .values({
            documentId,
            chunkIndex,
            chunkText: batchChunks[j],
            model,
          })
          .returning({ id: documentEmbeddings.id });

        const vectorStr = `[${result.value.join(",")}]`;
        await db.execute(
          sql`UPDATE document_embeddings SET embedding = ${vectorStr}::vector WHERE id = ${inserted.id}`
        );
      } catch (error) {
        logger.error({ err: error, documentId, chunkIndex }, "Erreur insertion chunk");
      }
    }
  }
}

export async function searchSemantic(
  query: string,
  limit = 10
): Promise<Array<{ documentId: string; chunkText: string; score: number }>> {
  if (!isEmbeddingConfigured()) {
    return [];
  }

  try {
    const queryEmbedding = await generateEmbedding(query);
    const vectorStr = `[${queryEmbedding.join(",")}]`;

    const results = await db.execute(
      sql`SELECT document_id, chunk_text, 1 - (embedding <=> ${vectorStr}::vector) AS score
          FROM document_embeddings
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${limit}`
    );

    return (results.rows as Array<{ document_id: string; chunk_text: string; score: number }>).map((r) => ({
      documentId: r.document_id,
      chunkText: r.chunk_text,
      score: Number(r.score),
    }));
  } catch (error) {
    logger.error({ err: error }, "Erreur recherche sémantique");
    return [];
  }
}
