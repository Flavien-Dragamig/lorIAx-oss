import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getSessionUser } from "@/lib/auth/get-user";
import { getLanguageModel, getDefaultProvider } from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { documents, spaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { readDocument } from "@/lib/storage/filesystem";

function isAIConfigured(): boolean {
  const provider = getDefaultProvider();
  if (provider.name === "claude") return !!process.env.ANTHROPIC_API_KEY;
  if (provider.name === "openai") return !!process.env.OPENAI_API_KEY;
  if (provider.name === "ollama") return !!process.env.OLLAMA_BASE_URL;
  return false;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: "Aucun provider IA configuré. Ajoutez ANTHROPIC_API_KEY, OPENAI_API_KEY, ou configurez Ollama." },
      { status: 503 }
    );
  }

  const { documentId } = await request.json();

  if (!documentId) {
    return NextResponse.json({ error: "documentId requis" }, { status: 400 });
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Document non trouve" }, { status: 404 });
  }

  // Lire le contenu
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, doc.spaceId))
    .limit(1);

  let content = doc.contentText || "";
  if (space) {
    try {
      content = await readDocument(space.gitRepoPath, doc.filePath);
    } catch {
      // Utiliser contentText comme fallback
    }
  }

  if (!content) {
    return NextResponse.json({ error: "Document vide" }, { status: 400 });
  }

  const model = getLanguageModel();

  const { text } = await generateText({
    model,
    system:
      "Tu es un assistant qui produit des resumes concis et structures en francais. Utilise des bullet points.",
    prompt: `Resume le document suivant :\n\n# ${doc.title}\n\n${content}`,
  });

  return NextResponse.json({ summary: text });
}
